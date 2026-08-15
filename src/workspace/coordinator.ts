import { randomUUID } from 'node:crypto'
import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  appendDelegatedPolicyOverrides,
  applyChildComposition,
  captureDelegatedPolicyOverrides,
  childSessionMeta,
  delegationDepthOf,
} from '@deepseek-ai/dsh-subagent'

/** Create a model-idle agent whose session carries one run workspace. */
export async function createWorkspaceCoordinator(
  parent: Agent,
  workspace: string,
  signal: AbortSignal,
): Promise<AgentHandle> {
  const overrides = captureDelegatedPolicyOverrides(parent)
  const parentDepth = delegationDepthOf(parent)
  const baseMeta = childSessionMeta(parent, parentDepth, 0)
  return await parent.ctx.agents.create({
    sessionId: SessionId(`antfarm-coordinator-${randomUUID()}`),
    meta: { ...baseMeta, cwd: workspace, delegationDepth: parentDepth },
    agentOptions: { ...parent.options, subagentDepth: parentDepth },
    signal,
    setup(agentCtx) {
      const coordinator = agentCtx.agent
      if (coordinator === undefined) throw new Error('coordinator setup has no unpublished agent')
      applyChildComposition(agentCtx, parent, {})
      appendDelegatedPolicyOverrides(coordinator.session, overrides)
    },
  })
}
