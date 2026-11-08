import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import { describe, expect, it } from 'vitest'
import { RunOwnerResolver } from '../src/runtime/owner.ts'

function agent(id = SessionId('owner')): Agent {
  return { id, session: Session.create(id) } as Agent
}

describe('native Run owner recovery', () => {
  it('uses the exact live owner without creating a coordinator', async () => {
    const ctx = new Context(); const owner = agent()
    ctx.provide('agents', { get: () => owner })
    const resolver = new RunOwnerResolver(ctx)
    expect(await resolver.resolve(owner.id)).toBe(owner)
    await resolver.dispose()
  })

  it('deduplicates cold native controller recovery without driving a model', async () => {
    const ctx = new Context(); const owner = agent()
    let live: Agent | undefined; let calls = 0
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    ctx.provide('agents', { get: () => live })
    ctx.provide('sessionController', { resolveAgent: async () => { calls++; await gate; live = owner; return { agent: owner } } })
    const resolver = new RunOwnerResolver(ctx)
    const one = resolver.resolve(owner.id); const two = resolver.resolve(owner.id)
    release()
    expect(await one).toBe(owner); expect(await two).toBe(owner); expect(calls).toBe(1)
    await resolver.dispose()
  })

  it('rejects archived owners and subagent identities', async () => {
    const ctx = new Context(); const owner = agent()
    ctx.provide('agents', { get: () => owner })
    ctx.provide('workspaceRegistry', { archivedSessionIds: [owner.id] })
    const resolver = new RunOwnerResolver(ctx)
    await expect(resolver.resolve(owner.id)).rejects.toThrow('archived')
    await resolver.dispose()
    const childCtx = new Context()
    const child = { ...owner, session: Session.create(owner.id, [], { ...owner.session.header, origin: 'subagent' }) } as Agent
    childCtx.provide('agents', { get: () => child })
    const childResolver = new RunOwnerResolver(childCtx)
    await expect(childResolver.resolve(owner.id)).rejects.toThrow('root')
    await childResolver.dispose()
  })

  it('never adopts a stale Agent or activates after resolver disposal', async () => {
    const ctx = new Context(); const owner = agent()
    ctx.provide('agents', { get: () => undefined })
    ctx.provide('sessionController', { resolveAgent: async () => ({ agent: owner }) })
    const resolver = new RunOwnerResolver(ctx)
    await expect(resolver.resolve(owner.id)).rejects.toThrow('changed')
    await resolver.dispose()
    await expect(resolver.resolve(owner.id)).rejects.toThrow('closing')
  })
})
