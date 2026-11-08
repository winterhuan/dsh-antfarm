import type { AntfarmHealthReport, AntfarmRunSummary } from '../types.ts';
/** One local storage root has one Host writer until its OS lock is released. */
export declare class RunStorage {
    private readonly lease;
    private readonly index;
    private constructor();
    /**
     * Acquire SQLite's process lock; elapsed time never authorizes a takeover.
     * @param root - Local filesystem storage root, shared by all plugin instances.
     * @returns Owner of the root and its disposable derived index.
     */
    static acquire(root: string): Promise<RunStorage>;
    /** Drop derived rows before rebuilding from authoritative Run journals. */
    reset(): void;
    /** @param row - Projection of an already committed Run transition. */
    put(row: AntfarmRunSummary): void;
    /** @param owner - Authorized Session. @returns At most fifty recent projections. */
    list(owner: string): AntfarmRunSummary[];
    /** @param owners - Authorized resources. @param offset - Number of newer rows already read. @returns Fifty ordered projections. */
    page(owners: readonly string[], offset: number): AntfarmRunSummary[];
    /** @param owner - Optional owner scope. @returns Bounded unsettled projections for health inspection. */
    unsettled(owner?: string): AntfarmRunSummary[];
    /** @param owner - Authorized owner. @param query - Id, number, prefix or literal task substring. @returns At most two matches, preserving ambiguity. */
    search(owner: string, query: string): AntfarmRunSummary[];
    /** @param report - Diagnostic facts, independent of business acceptance. */
    recordHealth(report: AntfarmHealthReport): void;
    /** @param owner - Explicit authorized resource. @returns Last twenty relevant checks and rolling issue count. */
    healthHistory(owner: string): {
        readonly reports: readonly AntfarmHealthReport[];
        readonly issues24h: number;
    };
    /** Release the lock only after all owned drivers and writes have stopped. */
    dispose(): void;
}
//# sourceMappingURL=storage.d.ts.map