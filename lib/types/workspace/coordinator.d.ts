import type { Agent, AgentHandle } from '@deepseek-ai/dsh-agent';
/** Create a model-idle agent whose session carries one run workspace. */
export declare function createWorkspaceCoordinator(parent: Agent, workspace: string, signal: AbortSignal): Promise<AgentHandle>;
//# sourceMappingURL=coordinator.d.ts.map