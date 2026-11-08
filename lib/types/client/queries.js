/** Sidebar query lifetimes: retain settled data and ignore obsolete Session or selection responses. */
import { useCallback, useEffect, useState } from 'react';
/**
 * Read visible run data, polling through run settlement and its workspace disposition.
 * @param sessionId - Session owning the view.
 * @param visible - whether this tab is in the foreground.
 * @param queries - cancellable list and detail reads.
 * @param refreshIntervalMs - configured active-run polling interval.
 * @returns retained query state and user actions.
 */
export function useAntfarmRuns(sessionId, visible, queries, refreshIntervalMs) {
    const [listing, setListing] = useState({ sessionId, rows: [], loading: true, failed: false });
    const [selection, setSelection] = useState({ sessionId, runId: null });
    const [detail, setDetail] = useState(null);
    const [revision, setRevision] = useState(0);
    const [window, setWindow] = useState({ sessionId, pages: 1 });
    const [hasMore, setHasMore] = useState(false);
    const pages = window.sessionId === sessionId ? window.pages : 1;
    const refresh = useCallback(() => { setRevision(current => current + 1); }, []);
    const rows = listing.sessionId === sessionId ? listing.rows : [];
    const selectedRunId = selection.sessionId === sessionId ? selection.runId : null;
    const currentDetail = detail?.sessionId === sessionId && detail.runId === selectedRunId ? detail : null;
    const reading = listing.loading || currentDetail?.loading === true;
    useEffect(() => {
        if (!visible)
            return;
        const request = new AbortController();
        setListing(current => ({ sessionId, rows: current.sessionId === sessionId ? current.rows : [], loading: true, failed: false }));
        const read = async () => {
            if (queries.page === undefined)
                return queries.list(sessionId, request.signal);
            const batches = await Promise.all(Array.from({ length: pages }, (_, page) => queries.page(sessionId, page * 50, request.signal)));
            if (!request.signal.aborted)
                setHasMore((batches.at(-1)?.length ?? 0) >= 50);
            return [...new Map(batches.flat().map(row => [row.runId, row])).values()];
        };
        void read().then(value => {
            if (!request.signal.aborted)
                setListing({ sessionId, rows: value, loading: false, failed: false });
        }).catch(() => {
            if (!request.signal.aborted)
                setListing(current => ({ ...current, loading: false, failed: true }));
        });
        return () => { request.abort(); };
    }, [sessionId, visible, queries, revision, pages]);
    useEffect(() => {
        if (!visible || selectedRunId === null)
            return;
        const runId = selectedRunId;
        const request = new AbortController();
        setDetail(current => ({ sessionId, runId, value: current?.sessionId === sessionId && current.runId === runId ? current.value : null, loading: true, failed: false }));
        void queries.status(runId, sessionId, request.signal).then(value => {
            if (!request.signal.aborted)
                setDetail({ sessionId, runId, value, loading: false, failed: false });
        }).catch(() => {
            if (!request.signal.aborted)
                setDetail(current => current === null ? null : { ...current, loading: false, failed: true });
        });
        return () => { request.abort(); };
    }, [sessionId, selectedRunId, visible, queries, revision]);
    useEffect(() => {
        if (!visible || reading)
            return;
        const timer = setTimeout(refresh, refreshIntervalMs);
        return () => { clearTimeout(timer); };
    }, [visible, reading, refreshIntervalMs, refresh]);
    return {
        rows,
        loading: listing.sessionId !== sessionId || listing.loading,
        failed: listing.sessionId === sessionId && listing.failed,
        selectedRunId,
        detail: currentDetail?.value ?? null,
        detailLoading: selectedRunId !== null && (currentDetail === null || currentDetail.loading),
        detailFailed: currentDetail?.failed ?? false,
        hasMore,
        loadMore: () => { setWindow({ sessionId, pages: pages + 1 }); },
        select: runId => { setSelection({ sessionId, runId }); },
        refresh,
    };
}
//# sourceMappingURL=queries.js.map