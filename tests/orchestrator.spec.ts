import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { Context } from '@deepseek-ai/cordis'
import { MessageId, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ToolExecution, ToolExecutionResult } from '@deepseek-ai/dsh-tools'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { SubagentActivation, SubagentActivationSpec, SubagentResult, SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { RunJournal } from '../src/persistence/journal.ts'
import type { JournalEvent, RunStartData } from '../src/persistence/types.ts'
import { runWorkflow, type OrchestratorSpec } from '../src/runtime/orchestrator.ts'
import { ExecutionEvidence } from '../src/runtime/evidence.ts'
import type { ResolvedStep, ResolvedWorkflow, Story } from '../src/workflow/types.ts'
import type { WorktreeSpec } from '../src/workspace/git.ts'

vi.mock('../src/workspace/git.ts', () => ({
  createWorktree: vi.fn(async () => {}),
  validateWorktree: vi.fn(async () => {}),
  cleanupWorktree: vi.fn(async () => ({ disposition: 'cleaned' })),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}

const done = (summary = 'done') => ({ passed: true, summary })
const failed = (summary: string) => ({ passed: false, summary })
const story: Story = { id: 'story-1', title: 'First', description: 'Implement it', acceptanceCriteria: ['It works'], maxRetries: 1 }
const single = (id: string, agent = 'developer', overrides: Partial<Extract<ResolvedStep, { type: 'single' }>> = {}): ResolvedStep => ({ id, agent, type: 'single', input: '{{task}}', output: 'result', maxRetries: 0, ...overrides })
const loop = (verifyEach = true): ResolvedStep => ({ id: 'implement', agent: 'developer', type: 'loop', input: '{{current_story}}\nFeedback: {{verify_feedback}}', over: 'stories', completion: 'all_done', freshSession: true, verifyEach, ...verifyEach ? { verifyStep: 'verify' } : {}, maxRetries: 0, repairInput: 'Repair {{issues}}\nStories: {{stories_summary}}' })
const plan = () => single('plan', 'planner', { output: 'stories' })
const verifier = () => single('verify', 'verifier', { input: '{{current_story}}\nChanges: {{changes}}', onFail: { maxRetries: 0, onExhausted: { escalateTo: 'human' } } })

function workflow(steps: readonly ResolvedStep[]): ResolvedWorkflow {
  return {
    id: 'focused', name: 'Focused workflow', version: 2, sourceDirectory: '/workflows/focused',
    agents: [
      { id: 'planner', name: 'Planner', preset: 'antfarm-analysis', instructions: 'Plan from repository evidence.' },
      { id: 'developer', name: 'Developer', preset: 'antfarm-coding', instructions: 'Implement the assigned task.' },
      { id: 'verifier', name: 'Verifier', preset: 'antfarm-verification', instructions: 'Verify independently.' },
    ], steps,
  }
}

interface ChildPlan {
  readonly output?: unknown
  readonly result?: Promise<SubagentResult>
  readonly onDispose?: () => Promise<void>
  readonly onStart?: (spec: SubagentActivationSpec) => Promise<void>
}

function children(plans: readonly ChildPlan[]) {
  const specs: SubagentActivationSpec[] = []
  const events: string[] = []
  const started = deferred<void>()
  const live = new Set<() => Promise<void>>()
  const runtime: Pick<SubagentRuntime, 'startActivation'> = {
    async startActivation(spec: SubagentActivationSpec): Promise<SubagentActivation & { messageId: MessageId }> {
      if (live.size !== 0) throw new Error('previous child was not disposed')
      const index = specs.length
      const plan = plans[index]
      if (plan === undefined) throw new Error(`unexpected child ${index}`)
      specs.push(spec)
      events.push(`start:${index}`)
      started.resolve()
      await plan.onStart?.(spec)
      let disposal: Promise<void> | undefined
      const dispose = () => disposal ??= (async () => {
        events.push(`dispose:${index}:start`)
        await plan.onDispose?.()
        live.delete(dispose)
        events.push(`dispose:${index}:end`)
      })()
      live.add(dispose)
      return {
        childId: spec.childId ?? SessionId(`child-${index}`), messageId: MessageId(`message-${index}`), dispose,
        result: plan.result ?? Promise.resolve({ output: [], structured: plan.output, stopReason: 'completed' }),
      }
    },
  }
  return { runtime, specs, events, started: started.promise, disposeAll: () => Promise.allSettled([...live].map(dispose => dispose())) }
}

async function fixture(resolved: ResolvedWorkflow, child: ReturnType<typeof children>, controller = new AbortController()) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'antfarm-orchestrator-')))
  const running: Promise<unknown>[] = []
  let beforeCleanup = () => {}
  onTestFinished(async () => {
    controller.abort(new Error('test cleanup'))
    beforeCleanup()
    await child.disposeAll()
    await Promise.allSettled(running)
    await rm(root, { recursive: true, force: true })
  })
  const worktree: WorktreeSpec = { runId: 'af-focused', branch: 'antfarm/af-focused', path: '/repo/.worktrees/antfarm/af-focused', directory: '.worktrees/antfarm', repository: { root: '/repo', baseRevision: 'a'.repeat(40), gitCommonDirectory: '/repo/.git' } }
  const files = resolved.workspace === 'files'
  const start: RunStartData = { runId: worktree.runId, ownerSessionId: 'owner', workflowId: resolved.id, task: 'complete the task', baseCwd: files ? root : '/repo', baseRevision: worktree.repository.baseRevision, workspace: files ? join(root, 'workspace') : worktree.path, branch: files ? '' : worktree.branch, provider: 'spawn', resolvedWorkflowSnapshot: resolved, ...(files ? { workspaceKind: 'files', fileInputs: [] } : {}) }
  const journal = await RunJournal.create(root, start)
  // This executor passes the exact parent through; Agent construction belongs to composition tests.
  const parent = { id: SessionId('owner') } as Agent
  const spec: OrchestratorSpec = { journal, parent, worktree: files ? null : worktree, signal: controller.signal, timeoutSeconds: 30, maxStories: 20, maxStoryRetries: 3, maxSummaryChars: 1000, cleanupCompleted: false, cleanupCancelled: false, onChange: () => {} }
  const dependencies = { subagents: child.runtime, subprocess: {} as SubprocessRuntime }
  let evidence: ExecutionEvidence | undefined
  return {
    journal, spec, root, controller,
    setCleanup(callback: () => void) { beforeCleanup = callback },
    setEvidence(value: ExecutionEvidence) { evidence = value },
    run(overrides: Partial<OrchestratorSpec> = {}) {
      const result = runWorkflow({ ...dependencies, ...(evidence === undefined ? {} : { evidence }) }, { ...spec, ...overrides })
      running.push(result)
      return result
    },
    async events(): Promise<JournalEvent[]> { return (await readFile(journal.eventsPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line)) },
  }
}

const prompt = (spec: SubagentActivationSpec | undefined) => spec?.request.prompt.filter(block => block.type === 'text').map(block => block.text).join('\n') ?? ''

describe('structured workflow execution', () => {
  it.each([
    { name: 'current reference', reference: 'actual-check', command: undefined, accepted: true },
    { name: 'foreign reference', reference: 'other-attempt-check', command: undefined, accepted: false },
    { name: 'mismatched command', reference: 'actual-check', command: 'different command', accepted: false },
  ])('validates $name against captured execution and candidate facts', async ({ reference, command, accepted }) => {
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    ctx.provide('subprocess', {} as SubprocessRuntime)
    const evidence = new ExecutionEvidence(ctx)
    const child = children([{ output: { ...done('file checked'), checks: [{ criterion: 'report exists', call_id: reference, ...(command === undefined ? {} : { command }) }] }, onStart: async activation => {
      const cwd = activation.request.cwd!
      await writeFile(join(cwd, 'report.md'), 'Accepted report')
      const exec: ToolExecution = { callId: ToolCallId('actual-check'), rootCallId: ToolCallId('actual-check'), token: Symbol('test execution') as ToolExecution['token'], name: 'bash', arguments: { command: 'node check-report.mjs' }, signal: activation.signal!, agent: { id: activation.childId! } as Agent }
      const result: ToolExecutionResult = { isError: false, content: [{ type: 'text', text: 'checked' }], value: { kind: 'foreground', cwd, exitCode: 0, signal: null, timedOut: false, aborted: false, stdout: { text: 'checked', truncated: false }, stderr: { text: '', truncated: false } } }
      const outcome = await ctx.waterfall('tools/execute', exec, async () => result)
      const decision = await ctx.waterfall('tools/post-execute', exec, outcome, async () => ({ kind: 'accept' }))
      expect(decision.kind).toBe('accept')
      if (decision.kind === 'accept') expect(decision.content).toContainEqual(expect.objectContaining({ text: expect.stringContaining('actual-check') }))
      ctx.emit('tools/result', exec, outcome)
    } }])
    const test = await fixture({ ...workflow([single('check', 'verifier', { requireChecks: true })]), workspace: 'files' }, child)
    test.setEvidence(evidence)
    await test.run()
    expect(test.journal.state.status).toBe(accepted ? 'completed' : 'failed')
    if (accepted) expect(test.journal.state.checkpoint.acceptedChecks?.['check']?.callIds).toEqual(['actual-check'])
    else expect(test.journal.state.workspaceReason).toContain('Unmatched execution references')
  })

  it('passes the exact parent, selected preset and worktree cwd and commits before completion', async () => {
    const child = children([{ output: done('implemented') }])
    const test = await fixture(workflow([single('only')]), child)
    expect((await test.run()).status).toBe('completed')
    expect(child.specs[0]).toMatchObject({ provider: 'spawn', delivery: 'caller', request: { parent: test.spec.parent, cwd: test.spec.worktree.path, agentPreset: 'antfarm-coding' } })
    expect(test.journal.state).toMatchObject({ status: 'completed', openAttempt: null, checkpoint: { cursor: 1, context: { only: 'implemented' } } })
    expect(child.events).toEqual(['start:0', 'dispose:0:start', 'dispose:0:end'])
  })

  it('commits the planner cursor and stories atomically and accepts an explicit empty audit', async () => {
    const child = children([{ output: { ...done('no material findings'), stories: [] } }])
    const test = await fixture(workflow([plan(), loop(false)]), child)
    expect(test.journal.state.checkpoint.stories).toBeNull()
    expect((await test.run()).status).toBe('completed')
    const checkpoints = (await test.events()).filter(event => event.type === 'checkpoint')
    expect(checkpoints[0]?.data).toMatchObject({ cursor: 1, context: { plan: 'no material findings' }, stories: [] })
    expect(child.specs).toHaveLength(1)
  })

  it('repeats an uncertain planner instead of skipping implementation after a crash', async () => {
    const child = children([{ output: { ...done('new plan'), stories: [story] } }, { output: done('implemented') }])
    const test = await fixture(workflow([plan(), loop(false)]), child)
    await test.journal.append({ type: 'workspace-ready', data: {} })
    await test.journal.append({ type: 'attempt-start', data: { stepId: 'plan', childSessionId: 'uncertain-planner', execution: 'single' } })
    await test.journal.append({ type: 'attempt-end', data: { childSessionId: 'uncertain-planner', passed: true, summary: 'uncommitted plan' } })
    expect(test.journal.state.checkpoint).toMatchObject({ cursor: 0, stories: null, context: {} })
    await test.journal.append({ type: 'run-resume', data: { guidance: 'Review the previous plan, then produce a complete plan.' } })
    expect((await test.run()).status).toBe('completed')
    expect(child.specs).toHaveLength(2)
    expect(prompt(child.specs[0])).toContain('Review the previous plan')
    expect(test.journal.state.checkpoint.stories).toMatchObject([{ id: story.id, status: 'done' }])
  })

  it('feeds only accepted context into later steps after a failed attempt', async () => {
    const child = children([{ output: failed('rejected output') }, { output: done('approved output') }, { output: done('final result') }])
    const test = await fixture(workflow([single('first', 'developer', { maxRetries: 1 }), single('second', 'verifier', { input: '{{results}}' })]), child)
    expect((await test.run()).status).toBe('completed')
    expect(prompt(child.specs[2])).toContain('approved output')
    expect(prompt(child.specs[2])).not.toContain('rejected output')
    expect(test.journal.state.checkpoint.context).toEqual({ first: 'approved output', second: 'final result' })
  })

  it('passes independent verification feedback into a fresh story retry', async () => {
    const child = children([{ output: { ...done('plan'), stories: [story] } }, { output: done('first changes') }, { output: failed('add the missing assertion') }, { output: done('second changes') }, { output: done('verified') }])
    const test = await fixture(workflow([plan(), loop(), verifier()]), child)
    expect((await test.run()).status).toBe('completed')
    expect(prompt(child.specs[3])).toContain('Feedback: add the missing assertion')
    expect(prompt(child.specs[4])).toContain('Changes: second changes')
    expect(test.journal.state.checkpoint.stories).toMatchObject([{ status: 'done', retryCount: 1 }])
    expect(new Set(child.specs.map(spec => spec.childId)).size).toBe(5)
    expect(test.journal.state.checkpoint.context).toEqual({ plan: 'plan', 'implement:story-1': 'second changes', 'verify:story-1': 'verified' })
  })

  it('retains exhausted story counters across a human resume and grants one manual attempt', async () => {
    const child = children([{ output: { ...done('plan'), stories: [story] } }, { output: done('first') }, { output: failed('still broken') }, { output: done('second') }, { output: failed('still broken') }, { output: failed('manual attempt also failed') }])
    const test = await fixture(workflow([plan(), loop(), verifier()]), child)
    expect((await test.run()).status).toBe('completed')
    expect(test.journal.state).toMatchObject({ status: 'blocked', checkpoint: { cursor: 1, stories: [{ status: 'failed', retryCount: 2 }] } })
    await test.journal.append({ type: 'run-resume', data: { guidance: 'Inspect the omitted assertion before editing.' } })
    expect((await test.run()).status).toBe('completed')
    expect(test.journal.state).toMatchObject({ status: 'blocked', checkpoint: { stories: [{ status: 'failed', retryCount: 3 }] } })
    expect(child.specs).toHaveLength(6)
    expect(prompt(child.specs[5])).toContain('Inspect the omitted assertion')
  })

  it('retains a top-level exhausted retry counter after explicit resume', async () => {
    const child = children([{ output: failed('first failure') }, { output: failed('manual failure') }])
    const test = await fixture(workflow([single('only', 'developer', { onFail: { maxRetries: 0, onExhausted: { escalateTo: 'human' } } })]), child)
    await test.run()
    expect(test.journal.state.checkpoint.retries).toEqual({ only: 1 })
    await test.journal.append({ type: 'run-resume', data: { guidance: 'Retry with the corrected requirement.' } })
    await test.run()
    expect(test.journal.state.checkpoint.retries).toEqual({ only: 2 })
    expect(test.journal.state.status).toBe('blocked')
  })

  it('runs a repair and then repeats the failed final verifier', async () => {
    const child = children([{ output: { ...done('plan'), stories: [story] } }, { output: done('implementation') }, { output: failed('integration failure') }, { output: done('repair') }, { output: done('verified') }])
    const test = await fixture(workflow([plan(), loop(false), single('test', 'verifier', { onFail: { retryStep: 'implement', maxRetries: 1, onExhausted: { escalateTo: 'human' } } })]), child)
    expect((await test.run()).status).toBe('completed')
    expect(prompt(child.specs[3])).toContain('Repair integration failure')
    expect(prompt(child.specs[3])).toContain(story.title)
    expect(prompt(child.specs[2])).not.toContain('Previous rejected attempt')
    expect(prompt(child.specs[4])).toContain('Previous rejected attempt for this step:\nintegration failure')
    expect((await test.events()).filter(event => event.type === 'attempt-start').map(event => [event.data.stepId, event.data.execution])).toEqual([['plan', 'single'], ['implement', 'story'], ['test', 'single'], ['implement', 'repair'], ['test', 'single']])
    expect(test.journal.state.checkpoint.retries['test:repair']).toBe(1)
  })

  it('cancels before child startup without running a model', async () => {
    const child = children([])
    const controller = new AbortController()
    controller.abort(new Error('cancel before start'))
    const test = await fixture(workflow([single('only')]), child, controller)
    expect((await test.run()).status).toBe('killed')
    expect(child.specs).toHaveLength(0)
    expect(test.journal.state.status).toBe('cancelled')
  })

  it('does not start the next step after cancellation during prior-child disposal', async () => {
    const controller = new AbortController()
    const child = children([{ output: done(), onDispose: async () => { controller.abort(new Error('cancel between steps')) } }, { output: done('must not run') }])
    const test = await fixture(workflow([single('first'), single('second')]), child, controller)
    expect((await test.run()).status).toBe('killed')
    expect(child.specs).toHaveLength(1)
    expect(test.journal.state.checkpoint.cursor).toBe(0)
    expect(test.journal.state.status).toBe('cancelled')
  })

  it('cancels a published child through dispose and waits for teardown before settlement', async () => {
    const controller = new AbortController()
    const entered = deferred<void>()
    const released = deferred<void>()
    const result = deferred<SubagentResult>()
    const child = children([{ result: result.promise, onDispose: async () => { entered.resolve(); await released.promise; result.resolve({ output: [], stopReason: 'completed', structured: done('late result') }) } }])
    const test = await fixture(workflow([single('only')]), child, controller)
    test.setCleanup(() => { released.resolve(); result.resolve({ output: [], stopReason: 'completed', structured: done('cleanup') }) })
    const running = test.run()
    // Native start signals do not settle already published activations.
    await child.started
    controller.abort(new Error('cancel active child'))
    await entered.promise
    let settled = false
    void running.then(() => { settled = true })
    expect(settled).toBe(false)
    expect(test.journal.state.status).toBe('running')
    released.resolve()
    expect((await running).status).toBe('killed')
    expect(test.journal.state.status).toBe('cancelled')
    expect(test.journal.state.checkpoint.context).toEqual({})
    expect(child.events).toEqual(['start:0', 'dispose:0:start', 'dispose:0:end'])
  })
})
