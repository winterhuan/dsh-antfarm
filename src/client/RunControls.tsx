/** State-specific actions preserve reconciliation guidance until acceptance. */
import { useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { AntfarmSessionId, AntfarmStatus } from '../types.ts'
import type { AntfarmOperations } from './operations.ts'
import css from './RunsPanel.module.css'

/** @param props - Durable state, revision-bound operations and localized copy. @returns Valid lifecycle actions. */
export function RunControls({ owner, detail, operations, refresh, t }: PropsLocale<'antfarmRuns'> & { readonly owner: AntfarmSessionId; readonly detail: AntfarmStatus; readonly operations: AntfarmOperations; refresh(): void }) {
  const [pending, setPending] = useState(false)
  const [guidance, setGuidance] = useState('')
  const [error, setError] = useState('')
  const row = detail.summary
  const resume = ['blocked', 'interrupted', 'failed'].includes(row.status) && row.workspaceDisposition !== 'cleaned'
  const cancel = ['queued', 'starting', 'running', 'blocked', 'interrupted'].includes(row.status)
  const control = async (action: 'resume' | 'cancel') => {
    if (pending || row.revision === undefined) return
    setPending(true); setError('')
    try {
      await operations.control({ action, sessionId: owner, runId: row.runId, revision: row.revision, ...(action !== 'resume' ? {} : { guidance }) })
      setGuidance(''); operations.report(true); refresh()
    } catch (error) { operations.report(false); setError(error instanceof Error ? error.message : t('operationError')); refresh() }
    finally { setPending(false) }
  }
  return <section className={css.form} aria-busy={pending}>
    {resume && <><label>{t('guidance')}<textarea value={guidance} disabled={pending} onChange={event => { setGuidance(event.target.value) }} /></label>
      <p className={css.secondary}>{t('resumeHelp')}</p></>}
    <div className={css.actions}>
      {resume && <Button size="sm" disabled={pending || row.revision === undefined || (detail.uncertain && guidance.trim() === '')} onClick={() => { void control('resume') }}>{t('resumeRun')}</Button>}
      {cancel && <Button size="sm" disabled={pending || row.revision === undefined} onClick={() => { void control('cancel') }}>{t('cancelRun')}</Button>}
    </div>
    {error !== '' && <p className={css.notice} role="status">{error}</p>}
  </section>
}
