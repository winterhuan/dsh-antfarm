/** Sidebar query lifetimes: retain settled data and ignore obsolete Session or selection responses. */
import { useCallback, useEffect, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AntfarmRunSummary, AntfarmStatus } from '../types.ts'

/** Cancellable reads supplied by the mounted Remote namespace. */
export interface AntfarmQueries {
  /** @param sessionId - run owner. @param signal - query lifetime. @returns owned runs. */
  list(sessionId: SessionId, signal: AbortSignal): Promise<AntfarmRunSummary[]>
  /** @param sessionId - Scope. @param offset - Previously loaded rows. @param signal - Query lifetime. @returns Next page. */
  page?(sessionId: SessionId, offset: number, signal: AbortSignal): Promise<AntfarmRunSummary[]>
  /** @param runId - selected run. @param sessionId - owner. @param signal - query lifetime. @returns durable details. */
  status(runId: string, sessionId: SessionId, signal: AbortSignal): Promise<AntfarmStatus>
}

interface Listing {
  readonly sessionId: SessionId
  readonly rows: readonly AntfarmRunSummary[]
  readonly loading: boolean
  readonly failed: boolean
}

interface Detail {
  readonly sessionId: SessionId
  readonly runId: string
  readonly value: AntfarmStatus | null
  readonly loading: boolean
  readonly failed: boolean
}

/** Settled rows and the selected detail, with separate retryable query failures. */
export interface AntfarmViewState {
  readonly rows: readonly AntfarmRunSummary[]
  readonly loading: boolean
  readonly failed: boolean
  readonly selectedRunId: string | null
  readonly detail: AntfarmStatus | null
  readonly detailLoading: boolean
  readonly detailFailed: boolean
  readonly hasMore?: boolean
  /** Expand the bounded query window by one page. */
  loadMore?(): void
  /** @param runId - owned run to expand, or null to close it. */
  select(runId: string | null): void
  /** Reload the listing and the selected detail. */
  refresh(): void
}

/**
 * Read visible run data, polling through run settlement and its workspace disposition.
 * @param sessionId - Session owning the view.
 * @param visible - whether this tab is in the foreground.
 * @param queries - cancellable list and detail reads.
 * @param refreshIntervalMs - configured active-run polling interval.
 * @returns retained query state and user actions.
 */
export function useAntfarmRuns(sessionId: SessionId, visible: boolean, queries: AntfarmQueries, refreshIntervalMs: number): AntfarmViewState {
  const [listing, setListing] = useState<Listing>({ sessionId, rows: [], loading: true, failed: false })
  const [selection, setSelection] = useState<{ sessionId: SessionId; runId: string | null }>({ sessionId, runId: null })
  const [detail, setDetail] = useState<Detail | null>(null)
  const [revision, setRevision] = useState(0)
  const [window, setWindow] = useState({ sessionId, pages: 1 })
  const [hasMore, setHasMore] = useState(false)
  const pages = window.sessionId === sessionId ? window.pages : 1
  const refresh = useCallback(() => { setRevision(current => current + 1) }, [])
  const rows = listing.sessionId === sessionId ? listing.rows : []
  const selectedRunId = selection.sessionId === sessionId ? selection.runId : null
  const currentDetail = detail?.sessionId === sessionId && detail.runId === selectedRunId ? detail : null
  const reading = listing.loading || currentDetail?.loading === true

  useEffect(() => {
    if (!visible) return
    const request = new AbortController()
    setListing(current => ({ sessionId, rows: current.sessionId === sessionId ? current.rows : [], loading: true, failed: false }))
    const read = async () => {
      if (queries.page === undefined) return queries.list(sessionId, request.signal)
      const batches = await Promise.all(Array.from({ length: pages }, (_, page) => queries.page!(sessionId, page * 50, request.signal)))
      if (!request.signal.aborted) setHasMore((batches.at(-1)?.length ?? 0) >= 50)
      return [...new Map(batches.flat().map(row => [row.runId, row])).values()]
    }
    void read().then(value => {
      if (!request.signal.aborted) setListing({ sessionId, rows: value, loading: false, failed: false })
    }).catch(() => {
      if (!request.signal.aborted) setListing(current => ({ ...current, loading: false, failed: true }))
    })
    return () => { request.abort() }
  }, [sessionId, visible, queries, revision, pages])

  useEffect(() => {
    if (!visible || selectedRunId === null) return
    const runId = selectedRunId
    const request = new AbortController()
    setDetail(current => ({ sessionId, runId, value: current?.sessionId === sessionId && current.runId === runId ? current.value : null, loading: true, failed: false }))
    void queries.status(runId, sessionId, request.signal).then(value => {
      if (!request.signal.aborted) setDetail({ sessionId, runId, value, loading: false, failed: false })
    }).catch(() => {
      if (!request.signal.aborted) setDetail(current => current === null ? null : { ...current, loading: false, failed: true })
    })
    return () => { request.abort() }
  }, [sessionId, selectedRunId, visible, queries, revision])

  useEffect(() => {
    if (!visible || reading) return
    const timer = setTimeout(refresh, refreshIntervalMs)
    return () => { clearTimeout(timer) }
  }, [visible, reading, refreshIntervalMs, refresh])

  return {
    rows,
    loading: listing.sessionId !== sessionId || listing.loading,
    failed: listing.sessionId === sessionId && listing.failed,
    selectedRunId,
    detail: currentDetail?.value ?? null,
    detailLoading: selectedRunId !== null && (currentDetail === null || currentDetail.loading),
    detailFailed: currentDetail?.failed ?? false,
    hasMore,
    loadMore: () => { setWindow({ sessionId, pages: pages + 1 }) },
    select: runId => { setSelection({ sessionId, runId }) },
    refresh,
  }
}
