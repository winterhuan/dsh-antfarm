/** Own project-local Git worktrees and retain output when cleanup is unsafe. */
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
type GitSubprocess = Pick<SubprocessRuntime, 'resolveExecutable' | 'spawn'>;
/** Complete collected output of one Git command. */
export interface GitCommandResult {
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number | null;
}
/**
 * Execute Git through the configured subprocess provider, without a shell.
 * @param subprocess - Host execution provider.
 * @param cwd - Working directory.
 * @param args - Literal Git arguments.
 * @param signal - Cancellation signal.
 * @returns Complete command output; rejects lossy collection.
 */
export declare function runGit(subprocess: GitSubprocess, cwd: string, args: readonly string[], signal?: AbortSignal): Promise<GitCommandResult>;
/** @param subprocess - Native provider. @param program - Executable name. @param cwd - Authorized workspace. @param args - Literal arguments. @param signal - Lifetime. @returns Complete collected output. */
export declare function runExecutable(subprocess: GitSubprocess, program: string, cwd: string, args: readonly string[], signal?: AbortSignal, env?: Readonly<Record<string, string>>): Promise<GitCommandResult>;
/** Canonical repository identity and the commit selected for new worktrees. */
export interface PreparedRepository {
    readonly root: string;
    readonly baseRevision: string;
    readonly gitCommonDirectory: string;
}
/**
 * Capture a non-bare repository's identity and current commit.
 * @param subprocess - Host execution provider.
 * @param cwd - Any directory within the repository.
 * @param signal - Cancellation signal.
 * @returns Canonical root, common Git directory, and full commit hash.
 */
export declare function prepareRepository(subprocess: GitSubprocess, cwd: string, signal?: AbortSignal): Promise<PreparedRepository>;
/** Deterministic path and branch reserved for one run. */
export interface WorktreeSpec {
    readonly runId: string;
    readonly branch: string;
    readonly path: string;
    readonly repository: PreparedRepository;
    readonly directory: string;
}
/**
 * Resolve the run's expected worktree identity without mutating Git.
 * @param repository - Captured repository identity.
 * @param worktreeDirectory - Project-relative destination directory.
 * @param runId - Run identifier.
 * @returns Expected branch and absolute worktree path.
 */
export declare function resolveWorktreeSpec(repository: PreparedRepository, worktreeDirectory: string, runId: string): WorktreeSpec;
/**
 * Create a new worktree after verifying repository, destination, and branch ownership.
 * @param subprocess - Host execution provider.
 * @param spec - Expected run worktree.
 * @param signal - Cancellation signal.
 */
export declare function createWorktree(subprocess: GitSubprocess, spec: WorktreeSpec, signal?: AbortSignal): Promise<void>;
/**
 * Verify a retained worktree's path, Git repository, branch, and base ancestry.
 * @param subprocess - Host execution provider.
 * @param spec - Journal-recorded run worktree.
 * @param signal - Cancellation signal.
 */
export declare function validateWorktree(subprocess: GitSubprocess, spec: WorktreeSpec, signal?: AbortSignal): Promise<void>;
/** Outcome of clean-only worktree removal. */
export interface WorktreeCleanupResult {
    readonly disposition: 'cleaned' | 'retained';
    readonly reason?: string;
}
/**
 * Remove only an unchanged worktree whose complete identity still matches the run.
 * @param subprocess - Host execution provider.
 * @param spec - Journal-recorded run worktree.
 * @returns Retained on identity mismatch, tracked/untracked changes, or Git failure.
 */
export declare function cleanupWorktree(subprocess: GitSubprocess, spec: WorktreeSpec): Promise<WorktreeCleanupResult>;
export {};
//# sourceMappingURL=git.d.ts.map