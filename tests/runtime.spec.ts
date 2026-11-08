/** Native attempts keep their identities, cancellation and scheduling under the owning host. */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { JobId, type JobSpec } from '@deepseek-ai/dsh-jobs'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SubagentActivationSpec, SubagentResult } from '@deepseek-ai/dsh-subagent'
import { expect, it, onTestFinished } from 'vitest'
import Runtime from '../src/runtime/index.ts'
import { roleAllows } from '../src/runtime/agents.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}
const result = (output: string): SubagentResult => ({
  output: [{ type: 'text', text: output }],
  stopReason: 'completed',
})
const output =
  'STATUS: done\nCHANGES: fixed\nTESTS: pass\nTEST_CMD: npm test\nBUILD_CMD: npm run build\nBASELINE: pass\nRESULTS: pass\nPR: https://example.test/pr/1\nDECISION: approved'

async function fixture(first?: { result: Promise<SubagentResult>; dispose(): Promise<void> }) {
  const home = await mkdtemp(join(tmpdir(), 'antfarm-runtime-'))
  const ctx = new Context()
  onTestFinished(async () => {
    await ctx.fiber.dispose()
    await rm(home, { recursive: true, force: true })
  })
  const id = SessionId('owner')
  const parent = { id, session: Session.create(id) } as Agent
  const personas: string[] = []
  const calls: SubagentActivationSpec[] = []
  const started = deferred<void>()
  let section: { text(context: { agent?: { id: string } }): string } | undefined
  ctx.provide('agents', { get: (value: string) => (value === id ? parent : undefined) })
  ctx.provide('sessions', {})
  ctx.provide('workingDirectory', { ensure: async () => home, get: () => home })
  ctx.provide('agentPresets', {})
  ctx.provide('skills', { get: async (name: string) => ({ name, content: 'Use the configured browser capability.' }) })
  ctx.provide('subprocess', {
    spawn: () => ({
      done: Promise.resolve({ exitCode: 1, signal: null }),
      collected: {},
      terminate() {},
      waitForExit: async () => true,
    }),
  })
  ctx.provide('systemPrompt', {
    section: (value: typeof section) => {
      section = value
      return () => {}
    },
  })
  ctx.provide('tools', { guard: () => () => {}, schemas: () => [] })
  ctx.provide('jobs', {
    start: (spec: JobSpec) => {
      spec.run({ id: JobId('fixture'), append() {}, updateProgress() {} })
      return JobId('fixture')
    },
  })
  ctx.provide('subagents', {
    getProvider: () => ({ inheritsParentContext: false, prepareContinuable() {} }),
    startActivation: async (spec: SubagentActivationSpec) => {
      calls.push(spec)
      const persona = section?.text({ agent: { id: spec.childId! } }) ?? ''
      personas.push(persona)
      started.resolve()
      if (calls.length === 1 && first) return { childId: spec.childId!, ...first }
      const text = persona.includes('/planner')
        ? `STATUS: done\nREPO: ${home}\nBRANCH: feature/test\nSTORIES_JSON: [{"id":"S1","title":"Feature","description":"Implement it","acceptanceCriteria":["Tests pass"]}]`
        : output
      return { childId: spec.childId!, result: Promise.resolve(result(text)), dispose: async () => {} }
    },
  })
  const fiber = ctx.plugin(Runtime, {
    journalRoot: join(home, 'runs'),
    dispatchIntervalMs: 10,
    healthIntervalMs: 300000,
  })
  await fiber
  return { ctx, parent, calls, personas, started, runtime: ctx.antfarm }
}

it('runs the original pipeline with complete personas and distinct fresh Session ids', async () => {
  const { runtime, parent, calls, personas } = await fixture()
  const receipt = await runtime.start({ parent, task: 'Implement feature' })
  const status = await runtime.wait(receipt.runId, parent.id)
  expect(status.summary.status, JSON.stringify(status.steps)).toBe('completed')
  expect(calls).toHaveLength(7)
  expect(new Set(calls.map((call) => call.childId)).size).toBe(7)
  expect(calls.every((call) => call.request.agentPreset === 'standard')).toBe(true)
  expect(personas[0]).toContain('IDENTITY.md')
  expect(personas[0]).toContain('SOUL.md')
  expect(personas[0]).toContain('AGENTS.md')
  expect(personas[0]).toContain('feature-dev/planner')
  expect(personas[2]).toContain('feature-dev/developer')
  expect(status.childSessionIds).toEqual(calls.map((call) => call.childId))
})

it('waits for exact child disposal before acknowledging cancellation', async () => {
  const disposal = deferred<void>()
  const disposed = deferred<void>()
  const child = deferred<SubagentResult>()
  const { runtime, parent, started } = await fixture({
    result: child.promise,
    dispose: async () => {
      disposed.resolve()
      await disposal.promise
    },
  })
  const receipt = await runtime.start({ parent, task: 'Cancel feature' })
  await started.promise
  const cancellation = runtime.cancel(receipt.runId, parent.id)
  await disposed.promise
  expect((await runtime.status(receipt.runId, parent.id)).summary.status).toBe('running')
  disposal.resolve()
  expect((await cancellation).status).toBe('cancelled')
  child.resolve(result(output))
  expect((await runtime.status(receipt.runId, parent.id)).summary.status).toBe('cancelled')
})

it('dispatches a second Run after its stable agent is released', async () => {
  const child = deferred<SubagentResult>()
  const { runtime, parent, started, calls } = await fixture({ result: child.promise, dispose: async () => {} })
  const first = await runtime.start({ parent, task: 'First' })
  await started.promise
  const second = await runtime.start({ parent, task: 'Second' })
  await runtime.cancel(first.runId, parent.id)
  child.resolve(result(output))
  const secondStatus = await runtime.wait(second.runId, parent.id)
  expect(secondStatus.summary.status, JSON.stringify(secondStatus.steps)).toBe('completed')
  expect(calls).toHaveLength(8)
})

it('cancels a caller wait without cancelling the independent Run', async () => {
  const child = deferred<SubagentResult>()
  const { runtime, parent, started } = await fixture({ result: child.promise, dispose: async () => {} })
  const receipt = await runtime.start({ parent, task: 'Continue in background' })
  await started.promise
  const controller = new AbortController()
  const waiting = runtime.wait(receipt.runId, parent.id, controller.signal)
  controller.abort(new Error('caller stopped waiting'))
  await expect(waiting).rejects.toThrow('caller stopped waiting')
  expect((await runtime.status(receipt.runId, parent.id)).summary.status).toBe('running')
  await runtime.cancel(receipt.runId, parent.id)
  child.resolve(result(output))
})

it('leaves an uncertain attempt interrupted when its native owner stops', async () => {
  const child = deferred<SubagentResult>()
  const { ctx, runtime, parent, started } = await fixture({ result: child.promise, dispose: async () => {} })
  const receipt = await runtime.start({ parent, task: 'Owner stops' })
  await started.promise
  await ctx.parallel('workspace/session-stop', { sessionId: parent.id })
  const status = await runtime.wait(receipt.runId, parent.id)
  expect(status.summary.status).toBe('interrupted')
  expect(status.uncertain).toBe(true)
  await expect(runtime.resume({ parent, runId: receipt.runId })).rejects.toThrow('recovery guidance')
  child.resolve(result(output))
})

it('applies original role tools without declaring dedicated Agent Presets', () => {
  for (const role of ['analysis', 'verification', 'testing', 'scanning', 'pr'] as const) {
    expect(roleAllows(role, 'write')).toBe(false)
    expect(roleAllows(role, 'bash')).toBe(true)
    expect(roleAllows(role, 'subagent')).toBe(false)
  }
  expect(roleAllows('coding', 'write')).toBe(true)
  expect(roleAllows('testing', 'browser_open')).toBe(true)
  expect(roleAllows('scanning', 'web_fetch')).toBe(true)
  expect(roleAllows('verification', 'web_fetch')).toBe(false)
  expect(roleAllows('scanning', 'browser_open')).toBe(false)
})

it('preserves an uncertain attempt when native child disposal fails', async () => {
  const { runtime, parent } = await fixture({
    result: Promise.resolve(result(output)),
    dispose: async () => {
      throw new Error('native disposal failed')
    },
  })
  const receipt = await runtime.start({ parent, task: 'Teardown failure' })
  const status = await runtime.wait(receipt.runId, parent.id)
  expect(status.summary.status).toBe('interrupted')
  expect(status.uncertain).toBe(true)
  expect(status.steps[0]?.status).toBe('running')
  await expect(runtime.resume({ parent, runId: receipt.runId })).rejects.toThrow('recovery guidance')
})
