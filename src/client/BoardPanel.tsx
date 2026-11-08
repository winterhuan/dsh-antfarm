/** Cross-session workflow stage board over explicitly authorized Host resources. */
import { useMemo, useState } from 'react'
import { Button, IconChecklistOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { AntfarmRunSummary } from '../types.ts'
import type { AntfarmQueries } from './queries.ts'
import { useAntfarmRuns } from './queries.ts'
import { RunsPanel } from './RunsPanel.tsx'
import { WorkflowPanel } from './WorkflowPanel.tsx'
import type { AntfarmOperations } from './operations.ts'
import css from './RunsPanel.module.css'

interface Actions {
  readonly hooks: { readonly refreshInterval: HostObservable<number> }
  /** @param owners - Explicit authorized resources. @returns Bounded query face. */
  queries(owners: readonly SessionId[]): AntfarmQueries
  readonly operations: AntfarmOperations
  /** @param child - Native child id. @param parent - Native parent id. */
  openChild(child: string, parent: string): void
}

/** @param props - Root Session list hook and scoped Host actions. @returns Workflow stage cards and progressive detail. */
export function BoardPanel({ useSessions, usePanelInfo, useRefreshInterval, queries, operations, openChild, t }: PropsRuntime<'main'> & PropsLocale<'antfarmRuns'> & InjectFace<Actions>) {
  const ownersKey = useSessions(state => JSON.stringify(state.ids))
  const owners = useMemo(() => (JSON.parse(ownersKey) as string[]).map(SessionId), [ownersKey])
  const sessionsKey = useSessions(state => JSON.stringify(state.ids.flatMap(id => {
    const row = state.byId[id]
    return row?.cwd !== undefined && row.parentId === undefined && row.origin !== 'subagent' ? [{ id, title: row.displayTitle, cwd: row.cwd }] : []
  })))
  const sessions = useMemo(() => JSON.parse(sessionsKey) as { id: string; title: string; cwd: string }[], [sessionsKey])
  const [target, setTarget] = useState('')
  const session = sessions.find(row => row.id === target) ?? sessions[0]
  const reader = useMemo(() => queries(owners), [queries, owners])
  const visible = usePanelInfo(state => state.activePanelId === 'antfarm-board')
  const interval = useRefreshInterval(value => value)
  const state = useAntfarmRuns(owners[0] ?? SessionId('antfarm-board-empty'), visible, reader, interval)
  const [workflow, setWorkflow] = useState('')
  const rows = state.rows.filter(row => workflow === '' || row.workflowId === workflow)
  const groups = new Map<string, AntfarmRunSummary[]>()
  for (const row of rows) { const key = `${row.workflowId} · ${row.status === 'running' || row.status === 'starting' ? row.currentStep ?? row.status : row.status}`; groups.set(key, [...groups.get(key) ?? [], row]) }
  const selected = state.rows.find(row => row.runId === state.selectedRunId)
  return <main className={css.board}>
    <header className={css.header}><h1>{t('board')}</h1><Button size="sm" disabled={state.loading} onClick={state.refresh}>{t('refresh')}</Button></header>
    <section className={css.launch}>
      <h2>{t('newRun')}</h2><p className={css.secondary}>{t('boardHelp')}</p>
      {session === undefined ? <p>{t('noProjectSession')}</p> : <>
        <label className={css.form}>{t('projectSession')}<select value={session.id} onChange={event => { setTarget(event.target.value) }}>{sessions.map(row => <option key={row.id} value={row.id}>{row.title} · {row.cwd}</option>)}</select></label>
        <p className={css.project}>{session.cwd}</p>
        <WorkflowPanel key={session.id} owner={SessionId(session.id)} visible={visible} operations={operations} t={t} launched={runId => { setWorkflow(''); state.select(runId); state.refresh() }} />
      </>}
    </section>
    <header className={css.header}><h2>{t('runs')}</h2><select aria-label={t('filterWorkflow')} value={workflow} onChange={event => { setWorkflow(event.target.value) }}><option value="">{t('allWorkflows')}</option>{[...new Set(state.rows.map(row => row.workflowId))].map(id => <option key={id} value={id}>{id}</option>)}</select></header>
    {state.failed && <p role="status">{t('loadError')}</p>}
    {state.rows.length === 0 && !state.loading && !state.failed && <div className={css.empty}><p>{t('emptyBoard')}</p><p>{t('emptyHelp')}</p></div>}
    <div className={css.columns}>{[...groups].map(([group, rows]) => <section key={group} className={css.column}><h2>{group} ({rows.length})</h2>{rows.map(row => <button type="button" key={row.runId} className={css.card} aria-expanded={state.selectedRunId === row.runId} onClick={() => { state.select(row.runId) }}>
      <span>{row.task ?? row.workflowId}</span><span className={css.secondary}>#{row.number ?? row.runId} · {t(row.status)}</span>
      {(row.totalStories ?? 0) > 0 && <span>{t('acceptedProgress', { done: row.acceptedStories ?? 0, total: row.totalStories ?? 0 })}</span>}
      {row.reason !== undefined && row.reason !== '' && <span className={css.reason}>{row.reason}</span>}
    </button>)}</section>)}</div>
    {state.hasMore === true && <Button size="sm" disabled={state.loading} onClick={state.loadMore}>{t('moreRuns')}</Button>}
    {selected !== undefined && <RunsPanel state={{ ...state, rows: [selected], hasMore: false }} workspace={selected.workspace} owner={SessionId(selected.ownerSessionId)} operations={operations} showLaunch={false} visible={visible} t={t} openChild={child => { openChild(child, selected.ownerSessionId) }} />}
  </main>
}

/** @param props - Native sidebar icon size. @returns Existing checklist glyph. */
export function BoardIcon({ size }: PropsRuntime<'sidebar.panellist'>) { return <IconChecklistOutlineRegular size={size} /> }
