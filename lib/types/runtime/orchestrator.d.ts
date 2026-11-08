import type { Agent } from '@deepseek-ai/dsh-agent';
import type { JobOutcome } from '@deepseek-ai/dsh-jobs';
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent';
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import { type ExecutionEvidence } from './evidence.ts';
import type { GitHubDelivery } from './github.ts';
import { RunJournal } from '../persistence/journal.ts';
import type { JournalRecord } from '../persistence/types.ts';
import { type WorktreeSpec } from '../workspace/git.ts';
/** Runtime capabilities needed by one driver. */
export interface OrchestratorDependencies {
    readonly subagents: Pick<SubagentRuntime, 'startActivation'>;
    readonly subprocess: SubprocessRuntime;
    readonly evidence?: ExecutionEvidence;
    readonly delivery?: GitHubDelivery;
    /** Wait without starting the execution clock; release after the complete attempt settles. */
    readonly acquireAttempt?: () => Promise<() => void>;
    /** @param record - Committed business event. @param revision - Its committed sequence. */
    readonly onEvent?: (record: JournalRecord, revision: number) => Promise<void>;
}
/** One admitted run's resource owner and validated execution policy. */
export interface OrchestratorSpec {
    readonly journal: RunJournal;
    readonly parent: Agent;
    readonly worktree: WorktreeSpec | null;
    readonly signal: AbortSignal;
    readonly timeoutSeconds: number;
    readonly maxAttempts?: number | undefined;
    readonly maxStories: number;
    readonly maxStoryRetries: number;
    readonly maxSummaryChars: number;
    readonly cleanupCompleted: boolean;
    readonly cleanupCancelled: boolean;
    readonly interrupted?: () => boolean;
    onChange(): void;
}
/**
 * Execute an admitted workflow and settle only after child and workspace teardown.
 * @param dependencies - Host child and process execution services.
 * @param spec - The sole driver's journal, authority, and cancellation lifetime.
 * @returns Job outcome; blocked runs end their job while retaining resumable checkpoints.
 */
export declare function runWorkflow(dependencies: OrchestratorDependencies, spec: OrchestratorSpec): Promise<JobOutcome>;
//# sourceMappingURL=orchestrator.d.ts.map