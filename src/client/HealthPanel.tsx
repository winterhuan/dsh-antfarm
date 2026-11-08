/** Manual diagnostics and safe redispatch share the existing Run executor. */
import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { AntfarmHealthHistory, AntfarmHealthReport, AntfarmSessionId } from '../types.ts'
import type { AntfarmOperations } from './operations.ts'
import css from './RunsPanel.module.css'

/** @param props - Authorized owner, native operations and locale. @returns Health disclosure. */
export function HealthPanel({ owner, operations, refresh, t }: PropsLocale<'antfarmRuns'> & { readonly owner: AntfarmSessionId; readonly operations: AntfarmOperations; refresh(): void }) {
  const [report, setReport] = useState<AntfarmHealthReport | null>(null)
  const [pending, setPending] = useState(false)
  const [history, setHistory] = useState<AntfarmHealthHistory | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    let current = true
    void operations.healthHistory(owner).then(value => { if (current) setHistory(value) }).catch(() => { if (current) operations.report(false) })
    return () => { current = false }
  }, [open, owner, operations, report])
  const check = async (repair: boolean) => {
    if (pending) return
    setPending(true)
    try { if (repair) await operations.ensureExecution(owner); setReport(await operations.health(owner)); refresh(); operations.report(true) }
    catch { operations.report(false) }
    finally { setPending(false) }
  }
  return <details onToggle={event => { setOpen(event.currentTarget.open) }}><summary>{t('health')}</summary><section className={css.form} aria-busy={pending}><p className={css.secondary}>{t('healthHelp')}</p><div className={css.actions}>
    <Button size="sm" disabled={pending} onClick={() => { void check(false) }}>{t('checkHealth')}</Button>
    <Button size="sm" disabled={pending} onClick={() => { void check(true) }}>{t('ensureExecution')}</Button>
  </div>{report !== null && <pre className={css.output}>{JSON.stringify(report, null, 2)}</pre>}{history !== null && <details><summary>{t('healthHistory')}</summary><pre className={css.output}>{JSON.stringify(history, null, 2)}</pre></details>}</section></details>
}
