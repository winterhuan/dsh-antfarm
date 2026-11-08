/** Run controls, accepted evidence and native child-session navigation. */
import { useState, type ReactNode } from 'react'
import { Button, DisclosureRow, IconChecklistOutlineRegular, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { AntfarmEventSummary, AntfarmRunSummary, AntfarmSessionId } from '../types.ts'
import type { AntfarmViewState } from './queries.ts'
import type { AntfarmOperations } from './operations.ts'
import { WorkflowPanel } from './WorkflowPanel.tsx'
import { RunControls } from './RunControls.tsx'
import { HealthPanel } from './HealthPanel.tsx'
import { ArtifactPanel } from './ArtifactPanel.tsx'
import css from './RunsPanel.module.css'

interface Props extends PropsLocale<'antfarmRuns'> {
  readonly state: AntfarmViewState
  readonly workspace: string | undefined
  readonly owner?: AntfarmSessionId
  readonly visible?: boolean
  readonly operations?: AntfarmOperations
  readonly showLaunch?: boolean
  /** @param childSessionId - durable child id belonging to the selected run. */
  readonly openChild: (childSessionId: string) => void
}

function runDot(status: AntfarmRunSummary['status']): 'done' | 'warning' | 'ongoing' | 'error' | 'idle' {
  if (status === 'starting' || status === 'running') return 'ongoing'
  if (status === 'completed') return 'done'
  if (status === 'failed' || status === 'corrupt') return 'error'
  if (status === 'blocked' || status === 'interrupted' || status === 'legacy') return 'warning'
  return 'idle'
}

function Skeleton(): ReactNode {
  return <div className={css.skeleton} aria-hidden><span /><span /><span /></div>
}

/**
 * Render the Session's run list and its selected durable details.
 * @param props - run queries, selected Session workspace, localized copy and child navigation.
 * @returns retained run content with retryable query notices.
 */
export function RunsPanel({ state, workspace, openChild, owner, visible = true, operations, showLaunch = true, t }: Props): ReactNode {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [events, setEvents] = useState<{ runId: string; values: AntfarmEventSummary[] } | null>(null)
  const rows = state.rows.filter(row => (filter === '' || row.status === filter) && `${row.task ?? ''} ${row.runId} ${row.number ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  const loadEvents = async (runId: string) => {
    if (operations === undefined || owner === undefined) return
    const previous = events?.runId === runId ? events.values : []
    try { const page = await operations.events(runId, owner, previous.at(-1)?.seq ?? -1); setEvents({ runId, values: [...previous, ...page] }) }
    catch { operations.report(false) }
  }
  return (
    <section className={css.root} data-antfarm-runs aria-busy={state.loading || state.detailLoading}>
      <header className={css.header}>
        <div className={css.heading}>
          <h2>{t('title')}</h2>
          <p>{t('description')}</p>
        </div>
        <Button size="sm" onClick={state.refresh} disabled={state.loading}>{t('refresh')}</Button>
      </header>
      <p className={css.project}>{workspace ?? t('noWorkspace')}</p>
      {showLaunch && operations !== undefined && owner !== undefined && <WorkflowPanel key={owner} owner={owner} visible={visible} operations={operations} t={t} launched={runId => { state.select(runId); state.refresh() }} />}
      {operations !== undefined && owner !== undefined && <HealthPanel key={`health:${owner}`} owner={owner} operations={operations} refresh={state.refresh} t={t} />}
      <div className={css.filters}><input aria-label={t('search')} placeholder={t('search')} value={search} onChange={event => { setSearch(event.target.value) }} />
        <select aria-label={t('allStates')} value={filter} onChange={event => { setFilter(event.target.value) }}><option value="">{t('allStates')}</option>{(['queued', 'running', 'blocked', 'interrupted', 'completed', 'failed', 'cancelled'] as const).map(status => <option key={status} value={status}>{t(status)}</option>)}</select></div>
      {state.failed && <div className={css.notice} role="status"><span>{t('loadError')}</span><Button size="sm" onClick={state.refresh}>{t('retry')}</Button></div>}
      {state.loading && state.rows.length === 0 ? <Skeleton /> : state.rows.length === 0 && !state.failed ? (
        <div className={css.empty}><p>{t('empty')}</p><p>{t('emptyHelp')}</p></div>
      ) : rows.map(row => {
        const open = state.selectedRunId === row.runId
        const detail = open ? state.detail : null
        return (
          <DisclosureRow
            key={row.runId}
            className={css.run}
            rowClassName={css.runHeader}
            contentClassName={css.runContent}
            contentLayoutClassName={css.runLabels}
            titleClassName={css.runTitle}
            icon={<IconChecklistOutlineRegular />}
            title={row.task ?? row.workflowId}
            open={open}
            expandable
            expandOnRowClick
            keepContentWhenOpen
            onToggle={() => { state.select(open ? null : row.runId) }}
            collapsedContent={<span className={css.status} data-status={row.status}><StateDot state={runDot(row.status)} /><span>{t(row.status)}</span></span>}
          >
            <div className={css.details}>
              <code className={css.runId}>{row.runId}</code>
              <p className={css.secondary}>{row.number === undefined ? '' : `#${row.number} · `}{row.workflowId}</p>
              {row.totalStories !== undefined && row.totalStories > 0 && <p>{t('acceptedProgress', { done: row.acceptedStories ?? 0, total: row.totalStories })}</p>}
              <dl>
                <dt>{t('branch')}</dt><dd>{row.branch}</dd>
                <dt>{t('workspace')}</dt><dd>{row.workspace}</dd>
                {row.currentStep !== undefined && <><dt>{t('step')}</dt><dd>{row.currentStep}</dd></>}
              </dl>
              {row.workspaceDisposition !== 'present' && <p>{t(row.workspaceDisposition === 'cleaned' ? 'cleaned' : 'retained')}</p>}
              {row.workspaceReason !== undefined && <p className={css.reason}>{row.workspaceReason}</p>}
              {state.detailFailed && <div className={css.notice} role="status"><span>{t('detailError')}</span><Button size="sm" onClick={state.refresh}>{t('retry')}</Button></div>}
              {state.detailLoading && detail === null ? <div className={css.pending}><StateDot state="ongoing" /></div> : detail !== null && <>
                {detail.uncertain && <p className={css.notice}>{t('uncertain')}</p>}
                {operations !== undefined && owner !== undefined && <RunControls key={row.runId} owner={owner} detail={detail} operations={operations} refresh={state.refresh} t={t} />}
                {detail.steps !== undefined && <section className={css.stories}><h3>{t('steps')}</h3>{detail.steps.map(step => <div key={step.id} className={css.story}><span>{step.id}</span><span className={css.secondary}>{step.agent} · {t(step.accepted ? 'done' : 'pending')}</span></div>)}</section>}
                {detail.stories.length > 0 && <section className={css.stories}><h3>{t('stories')}</h3>{detail.stories.map(story => (
                  <div className={css.story} key={story.id}>
                    <span>{story.title}</span>
                    <span className={css.secondary}>{t(story.status === 'retry' ? 'retrying' : story.status)}</span>
                    <span className={css.secondary}>{t('retries', { count: story.retryCount })}</span>
                    {(story.acceptanceCriteria?.length ?? 0) > 0 && <ul>{story.acceptanceCriteria.map(criterion => <li key={criterion}>{criterion}</li>)}</ul>}
                    {story.feedback !== undefined && <p className={css.reason}>{story.feedback}</p>}
                  </div>
                ))}</section>}
                {detail.childSessionIds.length > 0 && <section className={css.children}><h3>{t('children')}</h3>{detail.childSessionIds.map(id => (
                  <Button key={id} size="sm" className={css.child} aria-label={t('openChild', { id })} onClick={() => { openChild(id) }}>{id}</Button>
                ))}</section>}
                {Object.keys(detail.context).length > 0 && <details><summary>{t('output')}</summary><dl>{Object.entries(detail.context).map(([key, value]) => <div key={key}><dt>{key}</dt><dd><pre className={css.output}>{value}</pre></dd></div>)}</dl></details>}
                {Object.keys(detail.acceptedChecks ?? {}).length > 0 && <details><summary>{t('acceptedChecks')}</summary>{Object.entries(detail.acceptedChecks ?? {}).map(([step, proof]) => <div key={step}><p>{step}</p><code className={css.runId}>{proof.candidate}</code><p className={css.secondary}>{proof.callIds.join(', ')}</p></div>)}</details>}
                {(detail.checkEvidence?.length ?? 0) > 0 && <details><summary>{t('executionEvidence')}</summary>{detail.checkEvidence?.map(check => <details key={check.callId}><summary>{check.stepId} · {t(check.passed ? 'checkEligible' : 'checkNotEligible')} · {check.command}</summary><p>{t('executionExit', { code: check.exitCode ?? '—' })}</p><code className={css.runId}>{check.candidate}</code><pre className={css.output}>{check.stdout}{check.stderr === '' ? '' : `\n${check.stderr}`}</pre><Button size="sm" onClick={() => { openChild(check.childSessionId) }}>{t('openChild', { id: check.childSessionId })}</Button></details>)}</details>}
                {detail.executionPolicy !== undefined && <details><summary>{t('policy')}</summary><pre className={css.output}>{JSON.stringify(detail.executionPolicy, null, 2)}</pre></details>}
                {(detail.artifacts?.length ?? 0) > 0 && operations !== undefined && owner !== undefined && <ArtifactPanel key={`${owner}:${row.runId}`} runId={row.runId} owner={owner} artifacts={detail.artifacts ?? []} operations={operations} t={t} />}
                {operations !== undefined && <details><summary>{t('events')}</summary><Button size="sm" onClick={() => { void loadEvents(row.runId) }}>{t(events?.runId === row.runId ? 'moreEvents' : 'loadEvents')}</Button>
                  {events?.runId === row.runId && <ol className={css.events}>{events.values.map(event => <li key={event.seq}><span>#{event.seq} {event.type}</span><pre className={css.output}>{event.detail}</pre></li>)}</ol>}</details>}
              </>}
            </div>
          </DisclosureRow>
        )
      })}
      {state.hasMore === true && <Button size="sm" disabled={state.loading} onClick={state.loadMore}>{t('moreRuns')}</Button>}
    </section>
  )
}
