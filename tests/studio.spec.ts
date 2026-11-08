/** Read-only Studio calls preserve the runtime's owner checks and service lifetime. */
import { Context, Service } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { expect, it, onTestFinished } from 'vitest'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import Gateway from '../src/studio-host/index.ts'
import type { AntfarmRunSummary, AntfarmStatus } from '../src/types.ts'

const owner = SessionId('owner')
const row: AntfarmRunSummary = { runId: 'af-demo', workflowId: 'smoke', status: 'completed', ownerSessionId: owner, workspace: '/repo/.worktrees/antfarm/af-demo', branch: 'antfarm/af-demo', updatedAt: 1, workspaceDisposition: 'retained' }
const details: AntfarmStatus = { summary: row, context: {}, stories: [], childSessionIds: ['child'], uncertain: false }

class Runtime extends Service {
  constructor(ctx: Context) { super(ctx, 'antfarm') }
  async list(sessionId: SessionId): Promise<AntfarmRunSummary[]> { return sessionId === owner ? [row] : [] }
  async status(runId: string, sessionId: SessionId): Promise<AntfarmStatus> {
    if (sessionId !== owner || runId !== row.runId) throw new Error('Run is not owned by this Session')
    return details
  }
}

it('reads only session-owned runs and declares resource authorization for operations', async () => {
  const ctx = new Context()
  const runtime = ctx.plugin(Runtime)
  onTestFinished(() => runtime.dispose())
  await runtime
  const fiber = ctx.plugin(Gateway)
  onTestFinished(() => fiber.dispose())
  await fiber
  const gateway = ctx.get('antfarmStudio')
  expect(gateway).toBeDefined()
  if (gateway === undefined) throw new Error('missing Studio gateway')
  const signal = new AbortController().signal
  await expect(gateway.list(owner, signal)).resolves.toEqual([row])
  await expect(gateway.list(SessionId('other'), signal)).resolves.toEqual([])
  await expect(gateway.status(row.runId, owner, signal)).resolves.toEqual(details)
  await expect(gateway.status(row.runId, SessionId('other'), signal)).rejects.toThrow('not owned')
  const methods = remoteMethods(gateway)
  expect(methods.map(method => method.method)).toContain('control')
  expect(methods.map(method => method.method)).toContain('saveWorkflow')
  expect(methods.every(method => method.resources !== undefined)).toBe(true)
  await fiber.dispose()
  expect(ctx.get('antfarmStudio')).toBeUndefined()
})
