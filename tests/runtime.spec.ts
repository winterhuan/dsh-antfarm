import { mkdtemp, realpath, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { JobId, type JobOutcome, type JobSpec } from '@deepseek-ai/dsh-jobs'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import Runtime from '../src/runtime/index.ts'
import { RunJournal } from '../src/persistence/journal.ts'
import { loadWorkflow } from '../src/workflow/loader.ts'

const gates = vi.hoisted(() => ({ prepare: undefined as (() => Promise<void>) | undefined, driver: undefined as (() => Promise<void>) | undefined }))
vi.mock('../src/workspace/git.ts', () => ({
  prepareRepository: async (_subprocess: unknown, cwd: string) => { await gates.prepare?.(); return { root: cwd, baseRevision: 'a'.repeat(40), gitCommonDirectory: join(cwd, '.git') } },
  resolveWorktreeSpec: (repository: { root: string }, directory: string, runId: string) => ({ runId, repository, directory, branch: `antfarm/${runId}`, path: join(repository.root, directory, runId) }),
  validateWorktree: async () => {}, cleanupWorktree: async () => ({ disposition: 'cleaned' }),
}))
vi.mock('../src/runtime/orchestrator.ts', () => ({
  runWorkflow: async (_dependencies: unknown, spec: { journal: RunJournal; signal: AbortSignal }): Promise<JobOutcome> => {
    await gates.driver?.()
    if (spec.signal.aborted) await spec.journal.append({ type: 'run-end', data: { status: 'cancelled', reason: 'cancelled' } })
    return { status: spec.signal.aborted ? 'killed' : 'completed', detail: '' }
  },
}))
function deferred() { let resolve!: () => void; return { promise: new Promise<void>(done => { resolve = done }), resolve: () => resolve() } }
async function fixture(rootPath?: string) {
  const temporary = rootPath ?? await realpath(await mkdtemp(join(tmpdir(), 'antfarm-runtime-')))
  const ctx = new Context()
  const owner = { id: SessionId('parent'), session: Session.create(SessionId('parent')) } as Agent
  let current: Agent | undefined = owner
  const jobs: JobSpec[] = []
  const outcomes: Promise<JobOutcome>[] = []
  ctx.provide('agents', { get: () => current })
  ctx.provide('sessions', { flush: async () => true })
  ctx.provide('workingDirectory', { ensure: async () => temporary })
  ctx.provide('agentPresets', { resolve: async (id: string) => ({ id }) })
  ctx.provide('jobs', { start: (spec: JobSpec) => { jobs.push(spec); outcomes.push(spec.run({ append() {} }).done); return JobId(`antfarm-${jobs.length}`) } })
  ctx.provide('subagents', { getProvider: () => ({ inheritsParentContext: false, prepareContinuable() {}, capabilities: { agentPreset: true, outputSchema: true, agentOptions: true } }) })
  ctx.provide('subprocess', {})
  const config = Runtime.Config({ journalRoot: join(temporary, 'runs'), maxActiveRunsPerOwner: 1 })
  const fiber = ctx.plugin(Runtime, { journalRoot: config.journalRoot, maxActiveRunsPerOwner: 1 })
  await fiber
  onTestFinished(async () => { gates.prepare = undefined; gates.driver = undefined; await fiber.dispose(); await Promise.all(outcomes); if (rootPath === undefined) await rm(temporary, { recursive: true, force: true }) })
  return { temporary, ctx, owner, jobs, outcomes, fiber, runtime: ctx.antfarm, config, replaceParent() { current = { id: owner.id } as Agent } }
}
async function saved(test: Awaited<ReturnType<typeof fixture>>, runId = 'af-saved') {
  const workflow = await loadWorkflow('smoke', [join(import.meta.dirname, '..', 'workflows')])
  return RunJournal.create(test.config.journalRoot, { runId, ownerSessionId: test.owner.id, workflowId: workflow.id, task: 'test', baseCwd: test.temporary, baseRevision: 'a'.repeat(40), workspace: join(test.temporary, '.worktrees/antfarm', runId), branch: `antfarm/${runId}`, provider: 'spawn', resolvedWorkflowSnapshot: workflow })
}

describe('runtime admission and durable ownership', () => {
  it('persists multiple starts while bounding actual drivers per owner', async () => {
    const test = await fixture()
    const gate = deferred(); gates.driver = () => gate.promise
    const first = await test.runtime.start({ task: 'work', parent: test.owner, workflowId: 'smoke' })
    const second = await test.runtime.start({ task: 'second', parent: test.owner, workflowId: 'smoke' })
    expect(test.jobs).toHaveLength(2)
    expect((await test.runtime.status(second.runId, test.owner.id)).summary.status).toBe('queued')
    expect((await RunJournal.open(test.config.journalRoot, first.runId)).state.start.task).toBe('work')
    expect((await RunJournal.open(test.config.journalRoot, second.runId)).state.start.number).toBe(2)
    const cancelled = await test.runtime.cancel(second.runId, test.owner.id)
    expect(cancelled.status).toBe('cancelled')
    gate.resolve()
  })
  it('rechecks exact parent identity after asynchronous preflight', async () => {
    const test = await fixture(); const gate = deferred(); gates.prepare = () => gate.promise
    const pending = test.runtime.start({ task: 'work', parent: test.owner, workflowId: 'smoke' })
    test.replaceParent(); gate.resolve()
    await expect(pending).rejects.toThrow('current live')
    expect(test.jobs).toHaveLength(0)
  })
  it('denies workflow start and resume from child sessions before reserving work', async () => {
    const test = await fixture()
    const child = { ...test.owner, session: Session.create(test.owner.id, [], { ...test.owner.session.header, origin: 'subagent' }) } as Agent
    test.ctx.agents.get = () => child
    await expect(test.runtime.start({ task: 'recursive', parent: child })).rejects.toThrow('root initiating session')
    await expect(test.runtime.resume({ runId: 'af-saved', parent: child })).rejects.toThrow('root initiating session')
    expect(test.jobs).toHaveLength(0)
  })
  it('reserves a single resume driver before reading evidence', async () => {
    const test = await fixture(); await saved(test); const gate = deferred(); gates.driver = () => gate.promise
    const first = test.runtime.resume({ runId: 'af-saved', parent: test.owner })
    await expect(test.runtime.resume({ runId: 'af-saved', parent: test.owner })).rejects.toThrow('active operation')
    await first; gate.resolve()
  })
  it('refuses a second Host on the same storage root before any effects', async () => {
    const first = await fixture()
    await expect(fixture(first.temporary)).rejects.toThrow('already being held')
  })
  it('denies foreign reads and lists completed runs for their owner', async () => {
    const test = await fixture(); const journal = await saved(test)
    await journal.append({ type: 'run-end', data: { status: 'failed', reason: 'evidence' } })
    await test.runtime.rebuildIndex()
    expect((await test.runtime.list(test.owner.id))[0]?.status).toBe('failed')
    expect(await test.runtime.list(SessionId('stranger'))).toEqual([])
    await expect(test.runtime.status('af-saved', SessionId('stranger'))).rejects.toThrow('not visible')
    await expect(test.runtime.resume({ runId: 'af-saved', parent: test.owner })).rejects.toThrow('retry budget grant')
  })
  it('requires explicit guidance for a native child with an uncertain checkpoint', async () => {
    const test = await fixture(); const journal = await saved(test)
    await journal.append({ type: 'workspace-ready', data: {} })
    await journal.append({ type: 'attempt-start', data: { stepId: journal.state.start.resolvedWorkflowSnapshot.steps[0]!.id, execution: 'single', childSessionId: 'orphan' } })
    await expect(test.runtime.resume({ runId: 'af-saved', parent: test.owner })).rejects.toThrow('reconciliation guidance')
    const receipt = await test.runtime.resume({ runId: 'af-saved', parent: test.owner, guidance: 'reviewed the workspace; retry safely' })
    expect(receipt.runId).toBe('af-saved')
  })
  it('retains legacy and corrupt rows without rewriting their bytes', async () => {
    const test = await fixture(); const journal = await saved(test)
    const original = await readFile(journal.eventsPath, 'utf8')
    const legacy = { ...JSON.parse(original), version: 1 }
    const legacyBytes = `${JSON.stringify(legacy)}\n`
    await writeFile(journal.eventsPath, legacyBytes)
    await test.runtime.rebuildIndex()
    expect((await test.runtime.list(test.owner.id))[0]?.status).toBe('legacy')
    await expect(test.runtime.resume({ runId: 'af-saved', parent: test.owner })).rejects.toThrow()
    expect(await readFile(journal.eventsPath, 'utf8')).toBe(legacyBytes)
  })
  it('awaits active cancellation and service teardown before releasing admission', async () => {
    const test = await fixture(); const gate = deferred(); gates.driver = () => gate.promise
    const receipt = await test.runtime.start({ task: 'work', parent: test.owner, workflowId: 'smoke' })
    let settled = false
    const cancelling = test.runtime.cancel(receipt.runId, test.owner.id).then(value => { settled = true; return value })
    await new Promise(resolve => setImmediate(resolve)); expect(settled).toBe(false)
    gate.resolve(); expect((await cancelling).status).toBe('cancelled')
    await test.fiber.dispose()
    await expect(test.runtime.start({ task: 'work', parent: test.owner })).rejects.toThrow('current live')
  })
})
