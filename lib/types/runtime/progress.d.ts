import type { Context } from '@deepseek-ai/cordis';
/** @param files - Changed Git paths. @returns Whether production frontend files changed, following Antfarm's detector. */
export declare function isFrontendChange(files: readonly string[]): boolean;
/** @param ctx - Native subprocess owner. @param repo - Recorded project. @param branch - Original branch output. @param signal - Run lifetime. @param timeoutMs - Git deadline. @param graceMs - Native termination grace. @returns Original true/false frontend context. */
export declare function frontendChanges(ctx: Context, repo: string, branch: string, signal: AbortSignal, timeoutMs: number, graceMs: number): Promise<string>;
/** @param workspace - Stable developer workspace. @param runId - Original run identity. @returns Per-run progress, falling back to the original shared file. */
export declare function readProgress(workspace: string, runId: string): Promise<{
    path: string;
    text: string;
} | undefined>;
/** @param workspace - Stable developer workspace. @param runId - Completed original run. */
export declare function archiveProgress(workspace: string, runId: string): Promise<void>;
//# sourceMappingURL=progress.d.ts.map