import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { AntfarmRunSummary, AntfarmStatus } from '../types.ts';
/** Cancellable reads supplied by the mounted Remote namespace. */
export interface AntfarmQueries {
    /** @param sessionId - run owner. @param signal - query lifetime. @returns owned runs. */
    list(sessionId: SessionId, signal: AbortSignal): Promise<AntfarmRunSummary[]>;
    /** @param sessionId - Scope. @param offset - Previously loaded rows. @param signal - Query lifetime. @returns Next page. */
    page?(sessionId: SessionId, offset: number, signal: AbortSignal): Promise<AntfarmRunSummary[]>;
    /** @param runId - selected run. @param sessionId - owner. @param signal - query lifetime. @returns durable details. */
    status(runId: string, sessionId: SessionId, signal: AbortSignal): Promise<AntfarmStatus>;
}
/** Settled rows and the selected detail, with separate retryable query failures. */
export interface AntfarmViewState {
    readonly rows: readonly AntfarmRunSummary[];
    readonly loading: boolean;
    readonly failed: boolean;
    readonly selectedRunId: string | null;
    readonly detail: AntfarmStatus | null;
    readonly detailLoading: boolean;
    readonly detailFailed: boolean;
    readonly hasMore?: boolean;
    /** Expand the bounded query window by one page. */
    loadMore?(): void;
    /** @param runId - owned run to expand, or null to close it. */
    select(runId: string | null): void;
    /** Reload the listing and the selected detail. */
    refresh(): void;
}
/**
 * Read visible run data, polling through run settlement and its workspace disposition.
 * @param sessionId - Session owning the view.
 * @param visible - whether this tab is in the foreground.
 * @param queries - cancellable list and detail reads.
 * @param refreshIntervalMs - configured active-run polling interval.
 * @returns retained query state and user actions.
 */
export declare function useAntfarmRuns(sessionId: SessionId, visible: boolean, queries: AntfarmQueries, refreshIntervalMs: number): AntfarmViewState;
//# sourceMappingURL=queries.d.ts.map