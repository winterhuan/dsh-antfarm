/** Browser-safe Antfarm inspection projections. */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { JobId } from '@deepseek-ai/dsh-jobs/brand';
import type { FileArtifact, FoldedStory, Checkpoint, CheckEvidence } from './persistence/types.ts';
/** Bounded inspection; live authority-bearing handles are never exposed. */
export interface AntfarmRunSummary {
    readonly runId: string;
    readonly number?: number | undefined;
    readonly task?: string;
    readonly revision?: number;
    readonly jobId?: JobId;
    readonly workflowId: string;
    readonly status: 'queued' | 'starting' | 'running' | 'interrupted' | 'blocked' | 'completed' | 'failed' | 'cancelled' | 'legacy' | 'corrupt';
    readonly workspace: string;
    readonly branch: string;
    readonly currentStep?: string;
    readonly ownerSessionId: string;
    readonly updatedAt: number;
    readonly workspaceDisposition: 'present' | 'retained' | 'cleaned';
    readonly workspaceReason?: string;
    readonly acceptedStories?: number;
    readonly totalStories?: number;
    readonly reason?: string;
}
/** Accepted checkpoint, stories, and native child addresses for one run. */
export interface AntfarmStatus {
    readonly summary: AntfarmRunSummary;
    readonly context: Readonly<Record<string, string>>;
    readonly stories: readonly FoldedStory[];
    readonly childSessionIds: readonly string[];
    readonly uncertain: boolean;
    readonly steps?: readonly {
        readonly id: string;
        readonly agent: string;
        readonly accepted: boolean;
    }[];
    readonly acceptedChecks?: Checkpoint['acceptedChecks'];
    readonly checkEvidence?: readonly CheckEvidence[];
    readonly artifacts?: readonly FileArtifact[];
    readonly retryGrant?: number;
    readonly executionPolicy?: import('./persistence/types.ts').RunStartData['executionPolicy'];
}
/** A bounded diagnostic fact; output bodies are read separately. */
export interface AntfarmEventSummary {
    readonly seq: number;
    readonly time: number;
    readonly type: string;
    readonly detail: string;
}
/** Verified retained output suitable for a browser preview or download. */
export interface AntfarmArtifactContent {
    readonly path: string;
    readonly mime: 'text/plain' | 'image/png' | 'image/jpeg' | 'application/octet-stream';
    readonly base64: string;
}
/** Health facts never infer successful acceptance from elapsed time or child completion. */
export interface AntfarmHealthReport {
    readonly time: number;
    readonly enabled: boolean;
    readonly findings: readonly {
        readonly runId: string;
        readonly kind: 'uncertain' | 'inactive' | 'overdue' | 'retained' | 'unreadable';
        readonly detail: string;
    }[];
}
/** Bounded health history and rolling issue counts for an authorized Session. */
export interface AntfarmHealthHistory {
    readonly reports: readonly AntfarmHealthReport[];
    readonly issues24h: number;
    readonly enabled: boolean;
    readonly intervalMs: number;
}
/** Selected Session identity authorizing Antfarm Remote reads. */
export type AntfarmSessionId = SessionId;
/** A browser launch identity survives retries and lost responses. */
export interface AntfarmLaunchRequest {
    readonly sessionId: AntfarmSessionId;
    readonly requestId: string;
    readonly task: string;
    readonly workflowId: string;
    readonly notificationUrl?: string;
}
/** A revision-bound operation under the selected original owner's authority. */
export interface AntfarmControlRequest {
    readonly sessionId: AntfarmSessionId;
    readonly runId: string;
    readonly revision: number;
    readonly action: 'resume' | 'cancel' | 'cleanup';
    readonly guidance?: string;
    readonly retryGrant?: number;
}
//# sourceMappingURL=types.d.ts.map