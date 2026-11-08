/** Stable persona updates and native attempt teardown preserve owned resources. */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SubagentResult } from '@deepseek-ai/dsh-subagent'
import { expect, it, onTestFinished, vi } from 'vitest'
import { AntfarmAgents, AttemptTimeoutError, roleAllows } from '../src/runtime/agents.ts'
import { AntfarmDatabase } from '../src/persistence/database.ts'
import { loadWorkflow } from '../src/workflow/loader.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((finish) => {
    resolve = finish
  })
  return { promise, resolve }
}
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'antfarm-persona-'))
  const ctx = new Context()
  const db = new AntfarmDatabase(join(home, 'antfarm.db'))
  onTestFinished(async () => {
    await ctx.fiber.dispose()
    db.dispose()
    await rm(home, { recursive: true, force: true })
  })
  let persona = ''
  let section: { text(context: { agent?: { id: string } }): string } | undefined
  ctx.provide('systemPrompt', {
    section: (value: typeof section) => {
      section = value
      return () => {}
    },
  })
  ctx.provide('tools', { guard: () => () => {}, schemas: () => [] })
  ctx.provide('skills', { get: async () => undefined })
  const transport = new AntfarmAgents(ctx, join(home, 'agents'))
  const workflow = await loadWorkflow('feature-dev', [join(import.meta.dirname, '../workflows')])
  const agent = workflow.agents[0]!
  const cwd = await transport.workspace(workflow, agent)
  const parentId = SessionId('owner')
  const parent = { id: parentId, session: Session.create(parentId) } as Agent
  const run = db.start(workflow, 'Native lifetime test', parentId, home)
  const claim = db.claim(run)!
  const started = deferred<void>()
  const child = deferred<SubagentResult>()
  const disposal = deferred<void>()
  const disposed = deferred<void>()
  ctx.provide('subagents', {
    startActivation: async () => {
      persona = section!.text({ agent: { id: claim.sessionId } })
      started.resolve()
      return {
        childId: SessionId(claim.sessionId),
        result: child.promise,
        dispose: async () => {
          disposed.resolve()
          await disposal.promise
        },
      }
    },
  })
  return {
    home,
    transport,
    workflow,
    agent,
    cwd,
    parent,
    claim,
    started,
    child,
    disposal,
    disposed,
    persona: () => persona,
  }
}

it('updates installed persona files while preserving conflicting local edits', async () => {
  const { transport, workflow, agent, cwd } = await fixture()
  const revised = { ...agent, files: { ...agent.files, 'SOUL.md': 'Updated workflow persona' } }
  await transport.workspace(workflow, revised)
  expect(await readFile(join(cwd, 'SOUL.md'), 'utf8')).toBe('Updated workflow persona')
  await writeFile(join(cwd, 'SOUL.md'), 'Local user edits')
  await expect(transport.workspace(workflow, agent)).rejects.toThrow('local edits')
  expect(await readFile(join(cwd, 'SOUL.md'), 'utf8')).toBe('Local user edits')
})

it('waits for child teardown before reporting the original role timeout', async () => {
  const f = await fixture()
  vi.useFakeTimers()
  onTestFinished(() => vi.useRealTimers())
  const workflow = { ...f.workflow, agents: [{ ...f.agent, timeoutSeconds: 1 }, ...f.workflow.agents.slice(1)] }
  const executing = f.transport.execute(
    workflow,
    f.claim,
    f.parent,
    f.cwd,
    f.home,
    'fixture',
    new AbortController().signal,
  )
  const rejected = expect(executing).rejects.toBeInstanceOf(AttemptTimeoutError)
  await f.started.promise
  await vi.advanceTimersByTimeAsync(1000)
  await f.disposed.promise
  let settled = false
  void executing.then(
    () => {
      settled = true
    },
    () => {
      settled = true
    },
  )
  expect(settled).toBe(false)
  f.disposal.resolve()
  await rejected
  f.child.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'STATUS: done' }] })
})

it('discloses missing optional skills in the persona and still executes', async () => {
  const f = await fixture()
  const workflow = {
    ...f.workflow,
    agents: [
      { ...f.agent, workspace: { ...f.agent.workspace, skills: ['uninstalled-browser'] } },
      ...f.workflow.agents.slice(1),
    ],
  }
  const executing = f.transport.execute(
    workflow,
    f.claim,
    f.parent,
    f.cwd,
    f.home,
    'fixture',
    new AbortController().signal,
  )
  await f.started.promise
  expect(f.persona()).toContain('Optional skill: uninstalled-browser')
  f.disposal.resolve()
  f.child.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'STATUS: done' }] })
  expect(await executing).toBe('STATUS: done')
})

it('maps original gateway and cron restrictions to native management tools', () => {
  expect(roleAllows('coding', 'schedule_create')).toBe(false)
  expect(roleAllows('testing', 'schedule_edit')).toBe(false)
  expect(roleAllows('analysis', 'plugin_manager')).toBe(false)
})
