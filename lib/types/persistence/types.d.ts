/** Durable version 3 checkpoints; native sessions retain child transcripts. */
import type { ResolvedWorkflow, Story } from '../workflow/types.ts';
/** Story verification and retry facts committed with the run position. */
export interface FoldedStory extends Story {
    readonly status: 'pending' | 'done' | 'retry' | 'failed';
    readonly retryCount: number;
    readonly feedback?: string | undefined;
}
/** Accepted business state. A null plan means no planner checkpoint has committed. */
export interface Checkpoint {
    readonly cursor: number;
    readonly context: Readonly<Record<string, string>>;
    readonly stories: readonly FoldedStory[] | null;
    readonly retries: Readonly<Record<string, number>>;
    readonly feedback: Readonly<Record<string, string>>;
    readonly repair: {
        readonly targetId: string;
        readonly sourceStepId: string;
    } | null;
    readonly acceptedChecks?: Readonly<Record<string, {
        readonly candidate: string;
        readonly callIds: readonly string[];
    }>> | undefined;
    readonly blocked: string | null;
}
/** Identity and resolved inputs persisted before a start receipt is returned. */
export interface RunStartData {
    readonly runId: string;
    readonly number?: number | undefined;
    readonly requestId?: string | undefined;
    readonly ownerSessionId: string;
    readonly workflowId: string;
    readonly task: string;
    readonly baseCwd: string;
    readonly workspaceKind?: 'git' | 'files' | undefined;
    readonly fileInputs?: readonly FileInput[] | undefined;
    readonly baseRevision: string;
    readonly workspace: string;
    readonly branch: string;
    readonly provider: string;
    readonly model?: string | undefined;
    readonly notificationUrl?: string | undefined;
    readonly githubReviewerTokenEnv?: string | undefined;
    readonly resolvedWorkflowSnapshot: ResolvedWorkflow;
    readonly executionPolicy?: {
        readonly maxAttempts?: number | undefined;
        readonly timeoutSeconds: number;
        readonly maxStories: number;
        readonly maxStoryRetries: number;
        readonly maxSummaryChars: number;
        readonly cleanupCompleted: boolean;
        readonly cleanupCancelled: boolean;
    } | undefined;
}
/** Reserved native child identity retained even if startup or capture is interrupted. */
export interface Attempt {
    readonly stepId: string;
    readonly childSessionId: string;
    readonly execution: 'single' | 'story' | 'verify' | 'repair';
    readonly storyId?: string | undefined;
    readonly effect?: 'pull-request' | 'github-review' | undefined;
    readonly candidate?: string | undefined;
}
/** One complete business checkpoint or execution fact. */
export type JournalRecord = {
    readonly type: 'run-start';
    readonly data: RunStartData;
} | {
    readonly type: 'run-dispatch';
    readonly data: Record<string, never>;
} | {
    readonly type: 'run-queue';
    readonly data: Record<string, never>;
} | {
    readonly type: 'run-interrupt';
    readonly data: {
        readonly reason: string;
    };
} | {
    readonly type: 'tail-recovered';
    readonly data: {
        readonly source: string;
        readonly sha256: string;
        readonly bytes: number;
    };
} | {
    readonly type: 'workspace-ready';
    readonly data: Record<string, never>;
} | {
    readonly type: 'attempt-start';
    readonly data: Attempt;
} | {
    readonly type: 'attempt-end';
    readonly data: {
        readonly childSessionId: string;
        readonly passed: boolean;
        readonly summary: string;
    };
} | {
    readonly type: 'check-evidence';
    readonly data: CheckEvidence;
} | {
    readonly type: 'checkpoint';
    readonly data: Checkpoint;
} | {
    readonly type: 'run-resume';
    readonly data: {
        readonly guidance: string;
        readonly retryGrant?: number | undefined;
    };
} | {
    readonly type: 'run-end';
    readonly data: {
        readonly status: 'completed' | 'failed' | 'cancelled';
        readonly reason: string;
    };
} | {
    readonly type: 'file-artifacts';
    readonly data: {
        readonly candidate: string;
        readonly artifacts: readonly FileArtifact[];
    };
} | {
    readonly type: 'notification';
    readonly data: {
        readonly id: string;
        readonly channel: 'owner' | 'webhook';
        readonly status: 'pending' | 'delivered' | 'failed';
        readonly detail: string;
    };
} | {
    readonly type: 'health';
    readonly data: {
        readonly kind: string;
        readonly detail: string;
    };
} | {
    readonly type: 'workspace-disposition';
    readonly data: {
        readonly disposition: 'retained' | 'cleaned';
        readonly reason: string;
    };
};
/** Sequenced and flushed envelope. Version 1 evidence is never rewritten. */
export type JournalEvent = JournalRecord & {
    readonly version: 3;
    readonly seq: number;
    readonly time: number;
};
/** Recorded shell check, bound to the exact source version before and after execution. */
export interface CheckEvidence {
    readonly callId: string;
    readonly childSessionId: string;
    readonly stepId: string;
    readonly command: string;
    readonly cwd: string;
    readonly candidate: string;
    readonly afterCandidate: string;
    readonly passed: boolean;
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
}
/** Immutable input bytes captured during Run admission. */
export interface FileInput {
    readonly path: string;
    readonly sha256: string;
    readonly content: string;
}
/** Retained output identity; native child transcripts remain separate. */
export interface FileArtifact {
    readonly path: string;
    readonly sha256: string;
    readonly bytes: number;
}
//# sourceMappingURL=types.d.ts.map