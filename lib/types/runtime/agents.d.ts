import type { Context } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ResolvedAgent, ResolvedWorkflow } from '../workflow/types.ts';
import { type ClaimedStep } from '../persistence/database.ts';
/** A role deadline expires without an original completion response. */
export declare class AttemptTimeoutError extends Error {
}
/** Child teardown cannot confirm that effects have stopped. */
export declare class AttemptTeardownError extends Error {
}
/** @param role - Original role. @param tool - DSH tool name. @returns Whether the role may invoke the tool. */
export declare function roleAllows(role: ResolvedAgent['role'], tool: string): boolean;
/** DSH transport; persona is selected by attempt identity, never by a role preset. */
export declare class AntfarmAgents {
    private readonly ctx;
    private readonly root;
    private readonly active;
    /** @param ctx - Native host. @param root - Private installed agent workspaces. */
    constructor(ctx: Context, root: string);
    /** @param workflow - Installed method. @param agent - Stable role identity. @param provision - Update owned resources only under a claimed agent. @returns Canonical workspace path. */
    workspace(workflow: ResolvedWorkflow, agent: ResolvedAgent, provision?: boolean): Promise<string>;
    /** @param workflow - Run method. @param claim - Persisted claimant. @param parent - Native owner. @param cwd - Agent workspace. @param project - Owner project. @param provider - Native spawn provider. @param signal - Attempt cancellation. @returns Original text output. */
    execute(workflow: ResolvedWorkflow, claim: ClaimedStep, parent: Agent, cwd: string, project: string, provider: string, signal: AbortSignal): Promise<string>;
}
//# sourceMappingURL=agents.d.ts.map