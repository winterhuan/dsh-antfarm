/** Restore the original Session's execution authority through native lifecycle owners. */
import type { Context } from '@deepseek-ai/cordis'
import { installModelSelection, type Agent, type AgentHandle } from '@deepseek-ai/dsh-agent'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-session-query'
import type {} from '@deepseek-ai/dsh-workspace'

/** Native handles are owned only when Antfarm itself resumed them. */
export class RunOwnerResolver {
  private readonly pending = new Map<SessionId, Promise<Agent>>()
  private readonly owned = new Map<SessionId, AgentHandle>()
  private closing = false

  /** @param ctx - Host context used as the native resume lifetime owner. */
  constructor(private readonly ctx: Context) {}

  /**
   * Resolve a live root or resume its persisted native composition without a model turn.
   * @param id - Original authorization owner; never replaced by a new Session.
   * @returns Exact native Agent after archive and lineage validation.
   */
  async resolve(id: SessionId): Promise<Agent> {
    this.allowed(id)
    const live = this.ctx.agents.get(id)
    if (live !== undefined) return this.root(live, id)
    let pending = this.pending.get(id)
    if (pending === undefined) {
      pending = this.restore(id).finally(() => { this.pending.delete(id) })
      this.pending.set(id, pending)
    }
    const agent = await pending
    this.allowed(id)
    return this.root(agent, id)
  }

  private allowed(id: SessionId): void {
    if (this.closing) throw new Error('antfarm owner resolver is closing')
    if (this.ctx.get('workspaceRegistry')?.archivedSessionIds.includes(id)) throw new Error('restore the archived owning session before resuming antfarm')
  }

  private root(agent: Agent, id: SessionId): Agent {
    if (agent.id !== id || this.ctx.agents.get(id) !== agent) throw new Error('antfarm owner changed while resolving execution authority')
    if (agent.session.header.origin === 'subagent') throw new Error('antfarm requires a root owning session')
    return agent
  }

  private async restore(id: SessionId): Promise<Agent> {
    const controller = this.ctx.get('sessionController')
    if (controller !== undefined) {
      const result = await controller.resolveAgent(id)
      if ('error' in result) throw result.error
      return result.agent
    }
    const query = this.ctx.get('sessionQuery')
    if (query === undefined) throw new Error('cold antfarm owner recovery requires native Session query or Session controller')
    using observation = await query.observeSession(id)
    this.allowed(id)
    if (observation.header.origin === 'subagent') throw new Error('antfarm cannot resume a subagent as its owner')
    const preset = observation.projections?.values.agentPreset
    if (preset !== null && preset !== undefined && (typeof preset !== 'string' || preset === '')) throw new Error('persisted antfarm owner has an invalid native Agent preset')
    const handle = await this.ctx.agents.resume({
      resumeSessionId: id,
      setup: async agentCtx => {
        installModelSelection(agentCtx)
        // Native headless roots inherit their profile and have no selected preset.
        if (typeof preset === 'string') await this.ctx.agentPresets.mount(agentCtx, preset)
      },
    })
    this.owned.set(id, handle)
    if (this.closing) {
      await handle.dispose()
      this.owned.delete(id)
      throw new Error('antfarm owner recovery was disposed')
    }
    return handle.agent
  }

  /** Wait for in-flight restores, then dispose only handles created by this resolver. */
  async dispose(): Promise<void> {
    this.closing = true
    await Promise.allSettled(this.pending.values())
    await Promise.all([...this.owned.values()].map(handle => handle.dispose()))
    this.owned.clear()
  }
}
