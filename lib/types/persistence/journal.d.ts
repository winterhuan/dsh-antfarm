import { type FoldedRun } from './fold.ts';
import type { JournalEvent, JournalRecord, RunStartData } from './types.ts';
/**
 * Read a journal's first identity without interpreting old business state.
 * @param root - Configured journal root.
 * @param runId - Safe run directory identifier.
 * @returns Validated attribution and the recorded format version.
 */
export declare function readJournalIdentity(root: string, runId: string): Promise<{
    version: number;
    data: {
        runId: string;
        ownerSessionId: string;
        workflowId: string;
        workspace: string;
        branch: string;
        number?: number | undefined;
    };
}>;
/** A single writer owns committed state; readers never observe unflushed changes. */
export declare class RunJournal {
    readonly eventsPath: string;
    private events;
    private writing;
    private committed;
    private constructor();
    /** Revision of the last committed event; used to reject stale UI actions. */
    get revision(): number;
    /** Original start time of the unsettled native attempt; diagnostics do not renew its deadline. */
    get attemptTime(): number | undefined;
    /** @param type - Committed fact kind. @returns Last matching event without scanning through a Remote. */
    latest(type: JournalRecord['type']): JournalEvent | undefined;
    /** @param id - Stable notice identity. @param channel - Destination channel. @returns Whether durable delivery was already confirmed. */
    delivered(id: string, channel: 'owner' | 'webhook'): boolean;
    /** @param after - Exclusive event cursor. @param limit - Maximum records. @returns Committed event page. */
    records(after: number, limit: number): readonly JournalEvent[];
    /** Last successfully flushed reducer result. */
    get state(): FoldedRun;
    /**
     * Create a unique journal and persist its start before accepting work.
     * @param root - Configured storage directory.
     * @param start - Validated resolved execution inputs.
     * @returns Sole writer for the new run.
     */
    static create(root: string, start: RunStartData): Promise<RunJournal>;
    /**
     * Open version 3 evidence without modifying its bytes.
     * @param root - Configured storage directory.
     * @param runId - Safe run identity.
     * @returns Writer; unsupported, truncated, or corrupt evidence rejects.
     */
    static open(root: string, runId: string): Promise<RunJournal>;
    /**
     * Recover only an incomplete final write under the storage-root writer lock.
     * @param root - Owned storage root.
     * @param runId - Run whose complete prefix will be validated.
     * @returns Recovered journal with a retained, hashed source receipt.
     */
    static recoverTail(root: string, runId: string): Promise<RunJournal>;
    /**
     * Serialize and flush one complete state transition.
     * @param value - Business checkpoint or execution fact.
     * @returns Completion after the write and reducer commit; failure poisons this writer.
     */
    append(value: JournalRecord): Promise<void>;
}
//# sourceMappingURL=journal.d.ts.map