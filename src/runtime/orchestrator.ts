import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JobOutcome } from '@deepseek-ai/dsh-jobs'
import type { SubagentRuntime, SubagentResult } from '@deepseek-ai/dsh-subagent'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type { ToolRestriction } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-skill'
import { mkdir, writeFile } from 'node:fs/promises'
import { RunJournal } from '../persistence/journal.ts'
import type { RunStartData } from '../persistence/types.ts'
import type { FoldedRun, FoldedStory } from '../persistence/fold.ts'
import { matchesExpectedLine, parseKeyValues, parseStories, resolveTemplate } from '../workflow/template.ts'
import type { ResolvedAgent, ResolvedLoopStep, ResolvedSingleStep, ResolvedWorkflow, Story } from '../workflow/types.ts'
import { cleanupWorktree, copyWorktreeFiles, createWorktree, removeWorktreeFiles } from '../workspace/git.ts'
import type { WorktreeSpec } from '../workspace/git.ts'
import { createWorkspaceCoordinator } from '../workspace/coordinator.ts'
export interface OrchestratorDependencies {
  readonly subagents: SubagentRuntime
  readonly subprocess: SubprocessRuntime
}

export interface OrchestratorSpec {
  readonly runId: string
  readonly parent: Agent
  readonly provider: string
  readonly model?: string
  readonly task: string
  readonly workflow: ResolvedWorkflow
  readonly isolation: 'worktree' | 'shared'
  readonly workspace: string
  readonly branch: string
  readonly baseCwd: string
  readonly baseRevision: string
  readonly baseStatus: string
  readonly journalRoot: string
  readonly worktree?: WorktreeSpec
  readonly timeoutSeconds: number
  readonly cleanupCompleted: boolean
  readonly cleanupCancelled: boolean
  readonly roleToolRestrictions: Readonly<Record<string, ToolRestriction | null>>
  readonly envFiles: readonly string[]
  readonly resume?: FoldedRun
  readonly resumeGuidance?: string
  readonly signal: AbortSignal
  readonly progressPath?: string
  readonly managedFiles?: readonly string[]
  onStep(stepId: string | undefined): void
  onStatus(status: 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled'): void
}

function outputText(result: SubagentResult): string {
  return result.output.filter(block => block.type === 'text').map(block => block.text).join('')
}

function restrictionFor(role: ResolvedAgent['role'], overrides: Readonly<Record<string, ToolRestriction | null>>): ToolRestriction | undefined {
  if (Object.prototype.hasOwnProperty.call(overrides, role)) return overrides[role] ?? undefined
  switch (role) {
    case 'analysis': return { deny: ['write', 'edit', 'bash'] }
    case 'coding': return undefined
    case 'verification':
    case 'testing':
    case 'pr':
    case 'scanning': return { deny: ['write', 'edit'] }
  }
}

function promptFor(agent: ResolvedAgent, input: string): string {
  return `${agent.instructions.trim()}\n\n${input.trim()}`
}

async function runChild(
  subagents: SubagentRuntime,
  provider: string,
  parent: Agent,
  agent: ResolvedAgent,
  prompt: string,
  model: string | undefined,
  signal: AbortSignal,
  roleToolRestrictions: Readonly<Record<string, ToolRestriction | null>>,
): Promise<{ result: SubagentResult; childSessionId: string }> {
  if (agent.skills.length > 0) {
    const skills = parent.ctx.get('skills')
    if (skills === undefined) throw new Error(`agent "${agent.id}" declares skills but the skill service is unavailable`)
    for (const name of agent.skills) {
      const definition = await skills.get(name, { cwd: parent.session.header.cwd, scope: parent, signal })
      if (definition === undefined) throw new Error(`agent "${agent.id}" requires unavailable skill "${name}"`)
    }
  }
  const restriction = restrictionFor(agent.role, roleToolRestrictions)
  const selectedModel = agent.model ?? model
  const skillPrompt = agent.skills.length === 0 ? prompt : `Required skills for this step: ${agent.skills.join(', ')}. Load and follow each declared skill before acting.\n\n${prompt}`
  const run = await subagents.start(provider, {
    parent,
    label: agent.name,
    prompt: [{ type: 'text', text: skillPrompt }],
    signal,
    persona: agent.persona,
    ...(restriction === undefined ? {} : { toolFilter: restriction }),
    ...(selectedModel === undefined ? {} : { agentOptions: { model: selectedModel } }),
  })
  try {
    return { result: await run.result, childSessionId: String(run.id) }
  } finally {
    await run.dispose()
  }
}

function deadline(parent: AbortSignal, seconds: number): { signal: AbortSignal; dispose(): void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`step exceeded ${seconds}s deadline`)), seconds * 1000)
  const abort = (): void => controller.abort(parent.reason)
  parent.addEventListener('abort', abort, { once: true })
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer)
      parent.removeEventListener('abort', abort)
    },
  }
}

function formatStory(story: Story): string {
  return `Story ${story.id}: ${story.title}\n\n${story.description}\n\nAcceptance Criteria:\n${story.acceptanceCriteria.map((criterion, index) => `${index + 1}. ${criterion}`).join('\n')}`
}

interface ChildExecution {
  readonly text: string
  readonly delta: Record<string, string>
  readonly childSessionId: string
  readonly stories?: readonly Story[]
  readonly error?: string
}

function allowedProtocolKeys(workflow: ResolvedWorkflow): ReadonlySet<string> {
  const keys = new Set(['STATUS', 'ISSUES', 'CHANGES', 'STORIES_JSON'])
  for (const step of workflow.steps) {
    for (const source of [step.input, step.type === 'loop' ? step.repairInput : undefined]) {
      if (source === undefined) continue
      for (const match of source.matchAll(/\{\{\s*([A-Z][A-Z0-9_]*)\s*\}\}/g)) {
        const key = match[1]
        if (key !== undefined) keys.add(key)
      }
    }
  }
  return keys
}

async function executeChild(
  dependencies: OrchestratorDependencies,
  spec: OrchestratorSpec,
  parent: Agent,
  journal: RunJournal,
  step: ResolvedSingleStep | ResolvedLoopStep,
  agent: ResolvedAgent,
  context: Readonly<Record<string, string>>,
  attempt: number,
  storyId?: string,
  execution: 'normal' | 'story' | 'verify' | 'repair' = storyId === undefined ? 'normal' : 'story',
  sourceStepId?: string,
): Promise<ChildExecution> {
  await journal.append('step-start', { runId: spec.runId, stepId: step.id, attempt, ...(storyId === undefined ? {} : { storyId }), execution, ...(sourceStepId === undefined ? {} : { sourceStepId }) })
  const stepDeadline = deadline(spec.signal, agent.timeoutSeconds ?? spec.timeoutSeconds)
  try {
    const input = resolveTemplate(step.input, context)
    const child = await runChild(dependencies.subagents, spec.provider, parent, agent, promptFor(agent, input), spec.model, stepDeadline.signal, spec.roleToolRestrictions)
    const text = outputText(child.result)
    const stopError = child.result.stopReason === 'completed' ? undefined : `child stopped with ${child.result.stopReason}`
    const expectError = step.expects === undefined || matchesExpectedLine(text, step.expects) ? undefined : `output did not contain expected line: ${step.expects}`
    const error = stopError ?? expectError
    const delta = parseKeyValues(text, allowedProtocolKeys(spec.workflow))
    let stories: readonly Story[] | undefined
    try {
      stories = parseStories(text)
    } catch (parseError: unknown) {
      const message = parseError instanceof Error ? parseError.message : String(parseError)
      await journal.append('step-end', {
        runId: spec.runId, stepId: step.id, attempt, ...(storyId === undefined ? {} : { storyId }), outcome: 'failed', contextDelta: delta, childSessionId: child.childSessionId, error: message, execution, ...(sourceStepId === undefined ? {} : { sourceStepId }),
      })
      return { text, delta, childSessionId: child.childSessionId, error: message }
    }
    await journal.append('step-end', {
      runId: spec.runId,
      stepId: step.id,
      attempt,
      ...(storyId === undefined ? {} : { storyId }),
      outcome: error === undefined ? 'done' : 'failed',
      contextDelta: delta,
      childSessionId: child.childSessionId,
      ...(error === undefined ? {} : { error }),
      execution,
      ...(sourceStepId === undefined ? {} : { sourceStepId }),
    })
    return { text, delta, childSessionId: child.childSessionId, ...(stories === undefined ? {} : { stories }), ...(error === undefined ? {} : { error }) }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    await journal.append('step-end', { runId: spec.runId, stepId: step.id, attempt, ...(storyId === undefined ? {} : { storyId }), outcome: 'failed', contextDelta: {}, error: message, execution, ...(sourceStepId === undefined ? {} : { sourceStepId }) })
    if (spec.signal.aborted) throw error
    return { text: '', delta: {}, childSessionId: '', error: message }
  } finally {
    stepDeadline.dispose()
  }
}

async function writeWorkspaceDisposition(
  journal: RunJournal,
  dependencies: OrchestratorDependencies,
  spec: OrchestratorSpec,
): Promise<void> {
  if (spec.worktree === undefined) return
  const cleanup = await cleanupWorktree(dependencies.subprocess, spec.worktree)
  if (cleanup.disposition === 'cleaned') {
    await journal.append('workspace-cleaned', { runId: spec.runId, path: spec.workspace })
  } else {
    await journal.append('workspace-retained', { runId: spec.runId, path: spec.workspace, reason: cleanup.reason ?? 'cleanup declined' })
  }
}

async function runRepairTarget(
  dependencies: OrchestratorDependencies,
  spec: OrchestratorSpec,
  coordinator: Agent,
  journal: RunJournal,
  workflow: ResolvedWorkflow,
  targetId: string,
  issues: string,
  stories: readonly Story[] | undefined,
  context: Record<string, string>,
  attempt: number,
): Promise<string | undefined> {
  const target = workflow.steps.find(step => step.id === targetId)
  if (target === undefined) return `retry target "${targetId}" is missing`
  const agent = workflow.agents.find(candidate => candidate.id === target.agent)
  if (agent === undefined) return `retry target "${targetId}" has no agent`
  const repairContext = {
    ...context,
    issues,
    stories_summary: stories?.map(story => `- ${story.id}: ${story.title}`).join('\n') ?? '(no stories)',
  }
  if (target.type === 'single') {
    const result = await executeChild(dependencies, spec, coordinator, journal, target, agent, repairContext, attempt, undefined, 'repair', targetId)
    if (result.error === undefined) Object.assign(context, result.delta)
    return result.error
  }
  if (target.repairInput === undefined) return `loop retry target "${target.id}" has no repairInput`
  const repair: ResolvedSingleStep = {
    id: `${target.id}-repair`,
    agent: target.agent,
    type: 'single',
    input: target.repairInput,
    maxRetries: 1,
  }
  const result = await executeChild(dependencies, spec, coordinator, journal, repair, agent, repairContext, attempt, undefined, 'repair', targetId)
  if (result.error === undefined) Object.assign(context, result.delta)
  return result.error
}

interface LoopOutcome { readonly kind: 'done' | 'failed' | 'blocked'; readonly error?: string }

async function runStoryLoop(
  dependencies: OrchestratorDependencies,
  spec: OrchestratorSpec,
  coordinator: Agent,
  journal: RunJournal,
  step: ResolvedLoopStep,
  workflow: ResolvedWorkflow,
  stories: readonly Story[],
  context: Record<string, string>,
  priorStories: readonly FoldedStory[] = [],
  resumeGuidance: string | undefined,
): Promise<LoopOutcome> {
  const implementer = workflow.agents.find(agent => agent.id === step.agent)
  if (implementer === undefined) return { kind: 'failed', error: `loop "${step.id}" has no agent` }
  const verifyStep = step.verifyStep === undefined ? undefined : workflow.steps.find(candidate => candidate.id === step.verifyStep)
  if (verifyStep !== undefined && verifyStep.type !== 'single') return { kind: 'failed', error: `loop "${step.id}" verifyStep is not single` }
  const verifier = verifyStep === undefined ? undefined : workflow.agents.find(agent => agent.id === verifyStep.agent)
  if (verifyStep !== undefined && verifier === undefined) return { kind: 'failed', error: `verify step "${verifyStep.id}" has no agent` }
  for (const story of stories) {
    const prior = priorStories.find(candidate => candidate.id === story.id)
    if (prior?.status === 'done') continue
    let feedback = resumeGuidance ?? prior?.feedback ?? '(none)'
    let done = false
    const firstRetry = prior?.retryCount ?? 0
    const retryLimit = prior?.status === 'failed' ? firstRetry : story.maxRetries
    for (let retryCount = firstRetry; retryCount <= retryLimit && !done; retryCount += 1) {
      const storyContext = { ...context, current_story: formatStory(story), verify_feedback: feedback }
      const implemented = await executeChild(dependencies, spec, coordinator, journal, step, implementer, storyContext, retryCount + 1, story.id, 'story')
      if (implemented.error !== undefined) {
        feedback = implemented.error
      } else if (!step.verifyEach || verifyStep === undefined || verifier === undefined) {
        Object.assign(context, implemented.delta)
        await journal.append('story-end', { runId: spec.runId, stepId: step.id, storyId: story.id, outcome: 'done', retryCount })
        done = true
        continue
      } else {
        const verifyContext = { ...context, current_story: formatStory(story), changes: implemented.delta['CHANGES'] ?? '(inspect current diff)', verify_feedback: feedback }
        const verified = await executeChild(dependencies, spec, coordinator, journal, verifyStep, verifier, verifyContext, retryCount + 1, story.id, 'verify')
        if (verified.error === undefined && matchesExpectedLine(verified.text, 'STATUS: done')) {
          Object.assign(context, implemented.delta, verified.delta)
          await journal.append('story-end', { runId: spec.runId, stepId: step.id, storyId: story.id, outcome: 'done', retryCount })
          done = true
          continue
        }
        feedback = verified.delta['ISSUES'] ?? verified.error ?? 'verification requested retry without ISSUES'
      }
      if (retryCount < story.maxRetries) {
        await journal.append('story-end', { runId: spec.runId, stepId: step.id, storyId: story.id, outcome: 'retry', retryCount: retryCount + 1, feedback })
      } else {
        const blocked = verifyStep?.onFail?.onExhausted.escalateTo === 'human'
        await journal.append('story-end', { runId: spec.runId, stepId: step.id, storyId: story.id, outcome: 'failed', retryCount: retryCount + 1, feedback })
        if (blocked) {
          await journal.append('run-blocked', { runId: spec.runId, stepId: step.id, storyId: story.id, reason: `story "${story.id}" exhausted its retry budget`, feedback })
          return { kind: 'blocked', error: feedback }
        }
        return { kind: 'failed', error: `story "${story.id}" failed: ${feedback}` }
      }
    }
  }
  return { kind: 'done' }
}

/** Execute one serial antfarm run and always settle as a JobOutcome. */
export async function runWorkflow(dependencies: OrchestratorDependencies, spec: OrchestratorSpec): Promise<JobOutcome> {
  let journal: RunJournal | undefined
  let coordinator: Awaited<ReturnType<typeof createWorkspaceCoordinator>> | undefined
  let cleanupAfterQuiescence = false
  let retainWorkspace = false
  let managedFiles = [...(spec.managedFiles ?? [])]
  try {
    const resume = spec.resume
    if (resume === undefined) {
      const start: RunStartData = {
        runId: spec.runId,
        ownerSessionId: String(spec.parent.id),
        workflowId: spec.workflow.id,
        task: spec.task,
        baseCwd: spec.baseCwd,
        baseRevision: spec.baseRevision,
        baseStatus: spec.baseStatus,
        workspace: spec.workspace,
        branch: spec.branch,
        isolation: spec.isolation,
        provider: spec.provider,
        ...(spec.model === undefined ? {} : { model: spec.model }),
        resolvedWorkflowSnapshot: spec.workflow,
      }
      journal = await RunJournal.create(spec.journalRoot, start)
    } else {
      journal = await RunJournal.open(spec.journalRoot, spec.runId)
      await journal.append('run-resume', {
        runId: spec.runId,
        authority: String(spec.parent.id),
        ...(spec.resumeGuidance === undefined ? {} : { guidance: spec.resumeGuidance }),
        ...(resume.currentStep === undefined ? {} : { stepId: resume.currentStep }),
        ...(resume.openStep?.storyId === undefined ? {} : { storyId: resume.openStep.storyId }),
      })
    }
    if (spec.worktree !== undefined && resume === undefined) await createWorktree(dependencies.subprocess, spec.worktree, spec.signal)
    if (spec.worktree !== undefined && spec.progressPath !== undefined && resume === undefined) {
      await mkdir(spec.progressPath.replace(/\/[^/]+$/, ''), { recursive: true })
      await writeFile(spec.progressPath, `# Antfarm run ${spec.runId}\n\nTask: ${spec.task}\nBranch: ${spec.branch}\n`, 'utf8')
      managedFiles.push(spec.progressPath)
    }
    if (spec.worktree !== undefined && resume === undefined && spec.envFiles.length > 0) {
      const copied = await copyWorktreeFiles(spec.envFiles, spec.baseCwd, spec.workspace)
      managedFiles.push(...copied)
    }
    coordinator = await createWorkspaceCoordinator(spec.parent, spec.workspace, spec.signal)
    spec.onStatus('running')
    const context: Record<string, string> = resume === undefined
      ? { task: spec.task, branch: spec.branch, workspace: spec.workspace }
      : { ...resume.context }
    if (spec.resumeGuidance !== undefined) context.resume_guidance = spec.resumeGuidance
    const verifyTemplates = new Set<string>()
    for (const candidate of spec.workflow.steps) {
      if (candidate.type === 'loop' && candidate.verifyStep !== undefined) verifyTemplates.add(candidate.verifyStep)
    }
    let stories: Story[] | undefined = resume?.stories.map(story => ({
      id: story.id, title: story.title, description: story.description, acceptanceCriteria: story.acceptanceCriteria, maxRetries: story.maxRetries,
    }))
    const completedSteps = new Set(resume?.completedSteps ?? [])

    if (resume?.openStep?.execution === 'repair') {
      const targetId = resume.openStep.sourceStepId ?? (resume.openStep.stepId.endsWith('-repair') ? resume.openStep.stepId.slice(0, -7) : resume.openStep.stepId)
      const repairError = await runRepairTarget(dependencies, spec, coordinator.agent, journal, spec.workflow, targetId, spec.resumeGuidance ?? resume.blockedReason ?? 'resume interrupted repair', stories, context, resume.openStep.attempt)
      if (repairError !== undefined) throw new Error(`repair target "${targetId}" failed during resume: ${repairError}`)
    }

    for (const step of spec.workflow.steps) {
      if (verifyTemplates.has(step.id) || completedSteps.has(step.id)) continue
      spec.onStep(step.id)
      if (step.type === 'loop') {
        if (stories === undefined) throw new Error(`loop step "${step.id}" requires a preceding STORIES_JSON payload`)
        const outcome = await runStoryLoop(dependencies, spec, coordinator.agent, journal, step, spec.workflow, stories, context, resume?.stories ?? [], spec.resumeGuidance)
        if (outcome.kind === 'blocked') {
          await journal.append('workspace-retained', { runId: spec.runId, path: spec.workspace, reason: outcome.error ?? 'run blocked' })
          spec.onStatus('blocked')
          retainWorkspace = true
          return { status: 'completed', detail: 'workflow blocked', output: `Antfarm run ${spec.runId} is blocked: ${outcome.error ?? 'human action required'}` }
        }
        if (outcome.kind === 'failed') throw new Error(outcome.error ?? `loop step "${step.id}" failed`)
        continue
      }
      const agent = spec.workflow.agents.find(candidate => candidate.id === step.agent)
      if (agent === undefined) throw new Error(`resolved step "${step.id}" has no agent "${step.agent}"`)
      let finished = false
      let lastError = ''
      const attemptLimit = Math.max(1, step.maxRetries + 1)
      const openAttempt = resume?.openStep?.stepId === step.id ? resume.openStep.attempt : undefined
      const priorAttempt = resume?.attempts[step.id] ?? 0
      let feedbackRound: number
      let consumedInRound: number
      if (openAttempt !== undefined) {
        const beforeOrphan = Math.max(0, openAttempt - 1)
        feedbackRound = Math.floor(beforeOrphan / attemptLimit)
        consumedInRound = beforeOrphan % attemptLimit
      } else if (priorAttempt === 0) {
        feedbackRound = 0
        consumedInRound = 0
      } else {
        feedbackRound = Math.floor((priorAttempt - 1) / attemptLimit)
        consumedInRound = priorAttempt - feedbackRound * attemptLimit
      }
      const humanCredit = resume?.status === 'blocked' && resume.currentStep === step.id ? 1 : 0
      while (!finished) {
        const roundLimit = attemptLimit + (feedbackRound >= (step.onFail?.maxRetries ?? 0) ? humanCredit : 0)
        for (let attempt = consumedInRound + 1; attempt <= roundLimit && !finished; attempt += 1) {
          const execution = await executeChild(dependencies, spec, coordinator.agent, journal, step, agent, context, attempt + feedbackRound * attemptLimit)
          lastError = execution.delta['ISSUES'] ?? execution.error ?? ''
          if (execution.error === undefined) {
            Object.assign(context, execution.delta)
            if (execution.stories !== undefined) {
              if (stories !== undefined) throw new Error('workflow emitted STORIES_JSON more than once')
              stories = [...execution.stories]
              await journal.append('stories-registered', { runId: spec.runId, stepId: step.id, stories })
            }
            finished = true
          }
        }
        if (finished) break
        const retryStep = step.onFail?.retryStep
        if (retryStep === undefined || feedbackRound >= (step.onFail?.maxRetries ?? 0)) {
          if (step.onFail?.onExhausted.escalateTo === 'human') {
            await journal.append('run-blocked', { runId: spec.runId, stepId: step.id, reason: `step "${step.id}" exhausted retries`, feedback: lastError })
            await journal.append('workspace-retained', { runId: spec.runId, path: spec.workspace, reason: lastError || 'step retries exhausted' })
            spec.onStatus('blocked')
            retainWorkspace = true
            return { status: 'completed', detail: 'workflow blocked', output: `Antfarm run ${spec.runId} is blocked: ${lastError}` }
          }
          throw new Error(`step "${step.id}" failed after retries: ${lastError}`)
        }
        feedbackRound += 1
        consumedInRound = 0
        const repairError = await runRepairTarget(dependencies, spec, coordinator.agent, journal, spec.workflow, retryStep, lastError, stories, context, feedbackRound)
        if (repairError !== undefined) lastError = `repair target "${retryStep}" failed: ${repairError}`
      }
    }
    spec.onStep(undefined)
    await journal.append('run-end', { runId: spec.runId, stopReason: 'completed' })
    spec.onStatus('completed')
    cleanupAfterQuiescence = spec.cleanupCompleted
    return { status: 'completed', detail: 'workflow completed', output: `Antfarm run ${spec.runId} completed.` }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const cancelled = spec.signal.aborted
    if (journal !== undefined) {
      try {
        await journal.append('run-end', { runId: spec.runId, stopReason: cancelled ? 'cancelled' : 'failed', error: message })
        if (!cancelled || !spec.cleanupCancelled) await journal.append('workspace-retained', { runId: spec.runId, path: spec.workspace, reason: message })
      } catch {
        // The original failure remains the job result when journal persistence is unavailable.
      }
    }
    spec.onStatus(cancelled ? 'cancelled' : 'failed')
    retainWorkspace = !cancelled || !spec.cleanupCancelled
    if (cancelled) cleanupAfterQuiescence = spec.cleanupCancelled
    return cancelled
      ? { status: 'killed', detail: message, output: `Antfarm run ${spec.runId} was cancelled.` }
      : { status: 'failed', detail: message, output: `Antfarm run ${spec.runId} failed: ${message}` }
  } finally {
    if (coordinator !== undefined) {
      try {
        await coordinator.dispose()
      } catch {
        // Job settlement cannot reject; DSH agent disposal already reports its own diagnostics.
      }
    }
    if (cleanupAfterQuiescence && journal !== undefined) {
      try {
        await removeWorktreeFiles(managedFiles)
        await writeWorkspaceDisposition(journal, dependencies, spec)
      } catch (error: unknown) {
        try {
          await journal.append('workspace-retained', { runId: spec.runId, path: spec.workspace, reason: error instanceof Error ? error.message : String(error) })
        } catch {
          // The terminal run event remains authoritative when cleanup diagnostics cannot be persisted.
        }
      }
    } else if (retainWorkspace && journal !== undefined && spec.worktree !== undefined) {
      // The failure/blocked path already records the reason before returning.
    }
  }
}
