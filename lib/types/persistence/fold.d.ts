/** One reducer for running, inspected, and recovered Antfarm state. */
import type { FileArtifact, CheckEvidence, Attempt, Checkpoint, JournalEvent, RunStartData } from './types.ts';
export type { FoldedStory } from './types.ts';
/** Run state obtained exclusively from committed journal records. */
export interface FoldedRun {
    readonly start: RunStartData;
    readonly checkpoint: Checkpoint;
    readonly status: 'queued' | 'starting' | 'interrupted' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled';
    readonly prepared: boolean;
    readonly openAttempt: Attempt | null;
    readonly childSessionIds: readonly string[];
    readonly updatedAt: number;
    readonly revision: number;
    readonly workspaceDisposition: 'present' | 'retained' | 'cleaned';
    readonly workspaceReason: string;
    readonly resumeGuidance: string;
    readonly retryGrant: number;
    readonly checks: readonly CheckEvidence[];
    readonly artifacts: readonly FileArtifact[];
}
/**
 * Rebuild accepted state without promoting attempt results into checkpoints.
 * @param events - Validated records in contiguous sequence order.
 * @returns State at the last durable commit; an open attempt has an uncertain outcome.
 */
export declare function foldJournal(events: readonly JournalEvent[]): FoldedRun;
//# sourceMappingURL=fold.d.ts.map