import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SubagentResult, SubagentRuntime, SubagentRun } from '@deepseek-ai/dsh-subagent'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { foldJournal } from '../src/persistence/fold.ts'
import { RunJournal } from '../src/persistence/journal.ts'
import { runWorkflow, type OrchestratorSpec } from '../src/runtime/orchestrator.ts'
import type { ResolvedAgent, ResolvedStep, ResolvedWorkflow } from '../src/workflow/types.ts'
import type { RunStartData } from '../src/persistence/types.ts'

const lifecycle = vi.hoisted(() => ({ events: [] as string[] }))

vi.mock('../src/workspace/coordinator.ts', () => ({
  createWorkspaceCoordinator: async (_parent: Agent, workspace: string) => ({
    agent: {
      id: 'coordinator',
      options: {},
      session: { header: { cwd: workspace } },
      ctx: { get: () => undefined },
    } as unknown as Agent,
    dispose: async () => { lifecycle.events.push('coordinator:dispose') },
  }),
}))

const temporaryRoots: string[] = []

afterEach(async () => {
  lifecycle.events.length = 0
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

function agent(id: string, role: ResolvedAgent['role']): ResolvedAgent {
  return { id, name: id, role, skills: [], persona: `${id} persona`, instructions: `${id} instructions` }
}

function workflow(steps: readonly ResolvedStep[]): ResolvedWorkflow {
  return {
    id: 'focused',
    name: 'Focused workflow',
    version: 1,
    agents: [agent('planner', 'analysis'), agent('developer', 'coding'), agent('verifier', 'verification')],
    steps,
    sourceDirectory: '/workflow',
  }
}

interface ChildFixture {
  readonly runtime: SubagentRuntime
  readonly prompts: string[]
}

function children(outputs: readonly (string | ((signal: AbortSignal) => Promise<SubagentResult>))[]): ChildFixture {
  let index = 0
  let active = false
  const prompts: string[] = []
  const runtime = {
    async start(_provider: string, request: { prompt: readonly { type: string; text: string }[]; signal: AbortSignal }): Promise<SubagentRun> {
      if (active) throw new Error('next child started before prior child disposal')
      const child = index++
      const output = outputs[child]
      if (output === undefined) throw new Error(`unexpected child ${child}`)
      active = true
      prompts.push(request.prompt.map(block => block.text).join(''))
      lifecycle.events.push(`child:${child}:start`)
      const result = typeof output === 'function'
        ? output(request.signal)
        : Promise.resolve({ output: [{ type: 'text', text: output }], stopReason: 'completed' } as SubagentResult)
      return {
        id: `child-${child}` as SubagentRun['id'],
        localAgent: undefined,
        result,
        async dispose() {
          active = false
          lifecycle.events.push(`child:${child}:dispose`)
        },
      }
    },
  } as unknown as SubagentRuntime
  return { runtime, prompts }
}

async function fixture(resolvedWorkflow: ResolvedWorkflow, subagents: SubagentRuntime, signal = new AbortController().signal) {
  const journalRoot = await mkdtemp(join(tmpdir(), 'antfarm-orchestrator-'))
  temporaryRoots.push(journalRoot)
  const statuses: string[] = []
  const steps: (string | undefined)[] = []
  const parent = { id: 'parent-session', options: {}, session: { header: { cwd: '/workspace' } }, ctx: {} } as unknown as Agent
  const spec: OrchestratorSpec = {
    runId: 'af-focused',
    parent,
    provider: 'spawn',
    task: 'exercise the state machine',
    workflow: resolvedWorkflow,
    isolation: 'shared',
    workspace: '/workspace',
    branch: 'main',
    baseCwd: '/workspace',
    baseRevision: 'abc123',
    baseStatus: '',
    journalRoot,
    timeoutSeconds: 30,
    cleanupCompleted: false,
    cleanupCancelled: false,
    roleToolRestrictions: {},
    envFiles: [],
    signal,
    onStep: step => { steps.push(step) },
    onStatus: status => { statuses.push(status) },
  }
  const dependencies = { subagents, subprocess: {} as SubprocessRuntime }
  return {
    spec,
    dependencies,
    statuses,
    steps,
    async events() { return await (await RunJournal.open(journalRoot, spec.runId)).load() },
  }
}

const story = { id: 'story-1', title: 'First', description: 'Implement it', acceptanceCriteria: ['It works'], maxRetries: 1 }
const storyJson = `STORIES_JSON: ${JSON.stringify([story])}`

function runStart(spec: OrchestratorSpec): RunStartData {
  return {
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
    resolvedWorkflowSnapshot: spec.workflow,
  }
}

describe('runWorkflow', () => {
  it('completes a minimal workflow and disposes the child before its coordinator', async () => {
    const child = children(['STATUS: done'])
    const test = await fixture(workflow([
      { id: 'only', agent: 'developer', type: 'single', input: '{{task}}', expects: 'STATUS: done', maxRetries: 0 },
    ]), child.runtime)

    const outcome = await runWorkflow(test.dependencies, test.spec)
    const folded = foldJournal(await test.events())

    expect(outcome).toMatchObject({ status: 'completed', detail: 'workflow completed' })
    expect(folded.status).toBe('completed')
    expect(folded.completedSteps).toEqual(['only'])
    expect(test.statuses).toEqual(['running', 'completed'])
    expect(test.steps).toEqual(['only', undefined])
    expect(lifecycle.events).toEqual(['child:0:start', 'child:0:dispose', 'coordinator:dispose'])
  })

  it('feeds verification issues into a fresh implementation retry and then succeeds', async () => {
    const child = children([
      storyJson,
      'CHANGES: first pass',
      'STATUS: retry\nISSUES: add the missing assertion',
      'CHANGES: second pass',
      'STATUS: done',
    ])
    const test = await fixture(workflow([
      { id: 'plan', agent: 'planner', type: 'single', input: '{{task}}', maxRetries: 0 },
      { id: 'implement', agent: 'developer', type: 'loop', over: 'stories', completion: 'all_done', freshSession: true, input: '{{current_story}}\nFeedback: {{verify_feedback}}', maxRetries: 0, verifyEach: true, verifyStep: 'verify' },
      { id: 'verify', agent: 'verifier', type: 'single', input: '{{current_story}}\nChanges: {{changes}}', expects: 'STATUS: done', maxRetries: 0, onFail: { maxRetries: 0, onExhausted: { escalateTo: 'human' } } },
    ]), child.runtime)

    const outcome = await runWorkflow(test.dependencies, test.spec)
    const events = await test.events()
    const folded = foldJournal(events)

    expect(outcome.status).toBe('completed')
    expect(child.prompts[3]).toContain('Feedback: add the missing assertion')
    expect(events.filter(event => event.type === 'story-end').map(event => event.data)).toMatchObject([
      { outcome: 'retry', retryCount: 1, feedback: 'add the missing assertion' },
      { outcome: 'done', retryCount: 1 },
    ])
    expect(folded.stories).toMatchObject([{ id: 'story-1', status: 'done', retryCount: 1 }])
    expect(lifecycle.events.at(-1)).toBe('coordinator:dispose')
  })

  it('blocks when per-story verification exhausts its retry budget', async () => {
    const child = children([
      storyJson,
      'CHANGES: first pass',
      'STATUS: retry\nISSUES: first issue',
      'CHANGES: second pass',
      'STATUS: retry\nISSUES: still broken',
    ])
    const test = await fixture(workflow([
      { id: 'plan', agent: 'planner', type: 'single', input: '{{task}}', maxRetries: 0 },
      { id: 'implement', agent: 'developer', type: 'loop', over: 'stories', completion: 'all_done', freshSession: true, input: '{{current_story}}\n{{verify_feedback}}', maxRetries: 0, verifyEach: true, verifyStep: 'verify' },
      { id: 'verify', agent: 'verifier', type: 'single', input: '{{current_story}}\n{{changes}}', expects: 'STATUS: done', maxRetries: 0, onFail: { maxRetries: 0, onExhausted: { escalateTo: 'human' } } },
    ]), child.runtime)

    const outcome = await runWorkflow(test.dependencies, test.spec)
    const folded = foldJournal(await test.events())

    expect(outcome).toMatchObject({ status: 'completed', detail: 'workflow blocked' })
    expect(folded.status).toBe('blocked')
    expect(folded.blockedReason).toBe('story "story-1" exhausted its retry budget')
    expect(folded.stories).toMatchObject([{ status: 'failed', retryCount: 2, feedback: 'still broken' }])
    expect(test.statuses).toEqual(['running', 'blocked'])
  })

  it('settles cancellation only after the active child and coordinator are disposed', async () => {
    let childStarted!: () => void
    const started = new Promise<void>(resolve => { childStarted = resolve })
    const controller = new AbortController()
    const child = children([
      signal => new Promise<SubagentResult>((_resolve, reject) => {
        childStarted()
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      }),
    ])
    const test = await fixture(workflow([
      { id: 'only', agent: 'developer', type: 'single', input: '{{task}}', maxRetries: 0 },
    ]), child.runtime, controller.signal)

    const running = runWorkflow(test.dependencies, test.spec)
    await started
    controller.abort(new Error('cancel requested'))
    const outcome = await running
    const folded = foldJournal(await test.events())

    expect(outcome).toMatchObject({ status: 'killed', detail: 'cancel requested' })
    expect(folded.status).toBe('cancelled')
    expect(test.statuses).toEqual(['running', 'cancelled'])
    expect(lifecycle.events).toEqual(['child:0:start', 'child:0:dispose', 'coordinator:dispose'])
  })

  it('reruns an orphan step without consuming its persisted retry budget', async () => {
    const resolved = workflow([{ id: 'only', agent: 'developer', type: 'single', input: '{{task}}', expects: 'STATUS: done', maxRetries: 0 }])
    const child = children(['STATUS: done'])
    const test = await fixture(resolved, child.runtime)
    const journal = await RunJournal.create(test.spec.journalRoot, runStart(test.spec))
    await journal.append('step-start', { runId: test.spec.runId, stepId: 'only', attempt: 1 })
    const resume = foldJournal(await journal.load())

    const outcome = await runWorkflow(test.dependencies, { ...test.spec, resume })
    const starts = (await test.events()).filter(event => event.type === 'step-start')

    expect(outcome.status).toBe('completed')
    expect(starts.map(event => event.data.attempt)).toEqual([1, 1])
    expect(child.prompts).toHaveLength(1)
  })

  it('continues a persisted retry budget instead of resetting it on resume', async () => {
    const resolved = workflow([{ id: 'only', agent: 'developer', type: 'single', input: '{{task}}', expects: 'STATUS: done', maxRetries: 1 }])
    const child = children(['STATUS: retry'])
    const test = await fixture(resolved, child.runtime)
    const journal = await RunJournal.create(test.spec.journalRoot, runStart(test.spec))
    await journal.append('step-start', { runId: test.spec.runId, stepId: 'only', attempt: 1 })
    await journal.append('step-end', { runId: test.spec.runId, stepId: 'only', attempt: 1, outcome: 'failed', contextDelta: {}, error: 'first failure' })
    const resume = foldJournal(await journal.load())

    const outcome = await runWorkflow(test.dependencies, { ...test.spec, resume })
    const starts = (await test.events()).filter(event => event.type === 'step-start')

    expect(outcome.status).toBe('failed')
    expect(starts.map(event => event.data.attempt)).toEqual([1, 2])
    expect(child.prompts).toHaveLength(1)
  })

  it('continues a persisted story retry without rerunning completed work', async () => {
    const resolved = workflow([
      { id: 'plan', agent: 'planner', type: 'single', input: '{{task}}', maxRetries: 0 },
      { id: 'implement', agent: 'developer', type: 'loop', over: 'stories', completion: 'all_done', freshSession: true, input: '{{current_story}}', maxRetries: 0, verifyEach: false },
    ])
    const child = children(['CHANGES: completed on resume'])
    const test = await fixture(resolved, child.runtime)
    const journal = await RunJournal.create(test.spec.journalRoot, runStart(test.spec))
    await journal.append('step-start', { runId: test.spec.runId, stepId: 'plan', attempt: 1 })
    await journal.append('step-end', { runId: test.spec.runId, stepId: 'plan', attempt: 1, outcome: 'done', contextDelta: {} })
    await journal.append('stories-registered', { runId: test.spec.runId, stepId: 'plan', stories: [story] })
    await journal.append('story-end', { runId: test.spec.runId, stepId: 'implement', storyId: story.id, outcome: 'retry', retryCount: 1, feedback: 'resume this story' })
    const resume = foldJournal(await journal.load())

    const outcome = await runWorkflow(test.dependencies, { ...test.spec, resume })
    const starts = (await test.events()).filter(event => event.type === 'step-start')

    expect(outcome.status).toBe('completed')
    expect(starts.map(event => [event.data.stepId, event.data.attempt])).toEqual([['plan', 1], ['implement', 2]])
    expect(child.prompts).toHaveLength(1)
  })

  it('runs one loop repair pass before retrying a failed top-level verifier', async () => {
    const child = children([
      storyJson,
      'CHANGES: implementation',
      'STATUS: retry\nISSUES: failing integration test',
      'CHANGES: repaired',
      'STATUS: done',
    ])
    const test = await fixture(workflow([
      { id: 'plan', agent: 'planner', type: 'single', input: '{{task}}', maxRetries: 0 },
      { id: 'implement', agent: 'developer', type: 'loop', over: 'stories', completion: 'all_done', freshSession: true, input: '{{current_story}}', repairInput: 'Repair these issues:\n{{issues}}\nStories:\n{{stories_summary}}', maxRetries: 0, verifyEach: false },
      { id: 'test', agent: 'verifier', type: 'single', input: 'Verify the workspace', expects: 'STATUS: done', maxRetries: 0, onFail: { retryStep: 'implement', maxRetries: 1, onExhausted: { escalateTo: 'human' } } },
    ]), child.runtime)

    const outcome = await runWorkflow(test.dependencies, test.spec)
    const events = await test.events()

    expect(outcome.status).toBe('completed')
    expect(child.prompts[3]).toContain('Repair these issues:')
    expect(child.prompts[3]).toContain('failing integration test')
    expect(child.prompts[3]).toContain('- story-1: First')
    expect(events.filter(event => event.type === 'step-start').map(event => event.data)).toMatchObject([
      { stepId: 'plan', execution: 'normal' },
      { stepId: 'implement', execution: 'story' },
      { stepId: 'test', execution: 'normal', attempt: 1 },
      { stepId: 'implement-repair', execution: 'repair', sourceStepId: 'implement' },
      { stepId: 'test', execution: 'normal', attempt: 2 },
    ])
  })
})
