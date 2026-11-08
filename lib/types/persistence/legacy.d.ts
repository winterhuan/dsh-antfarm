import type { AntfarmEventSummary, AntfarmStatus } from '../types.ts';
/** Historical data stays outside the original-format SQLite executor. */
export declare class LegacyRuns {
    private readonly root;
    /** @param root - Historical per-run journal directory. */
    constructor(root: string);
    private read;
    /** @param runId - Historical identity. @param owner - Read authority. @returns Valid complete-prefix facts, marked inspection-only. */
    status(runId: string, owner: string): Promise<AntfarmStatus>;
    /** @param owner - Read authority. @returns Attributable historical runs. Unreadable identities remain on disk. */
    list(owner: string): Promise<AntfarmStatus[]>;
    /** @param runId - Historical identity. @param owner - Read authority. @param after - Exclusive cursor. @returns A hundred complete-prefix events. */
    events(runId: string, owner: string, after: number): Promise<AntfarmEventSummary[]>;
}
//# sourceMappingURL=legacy.d.ts.map