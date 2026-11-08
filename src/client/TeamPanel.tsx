/** Agent settings edit the same revision-bound document and persona resources as the source editor. */
import { useMemo, useState } from 'react'
import { isMap, isScalar, isSeq, parseDocument } from 'yaml'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkflowDraft } from '../workflow/types.ts'
import css from './RunsPanel.module.css'

interface Props extends PropsLocale<'antfarmRuns'> {
  readonly draft: WorkflowDraft
  readonly pending: boolean
  change(draft: WorkflowDraft): void
}

function Persona({ files, draft, pending, change, t }: Props & { readonly files: readonly { name: string; path: string }[] }) {
  const [selected, setSelected] = useState('AGENTS.md')
  const file = files.find(file => file.name === selected) ?? files[0]
  if (file === undefined) return null
  return <>
    <label>{t('personaFile')}<select value={file.name} disabled={pending} onChange={event => { setSelected(event.target.value) }}>{files.map(file => <option key={file.name} value={file.name}>{file.name}</option>)}</select></label>
    <label>{t('persona')}<textarea className={css.editor} value={draft.files[file.path] ?? ''} disabled={pending} onChange={event => { change({ ...draft, files: { ...draft.files, [file.path]: event.target.value } }) }} /></label>
  </>
}

/** @param props - Current source draft and a gesture-owned update. @returns Team overview and common Agent settings. */
export function TeamPanel({ draft, pending, change, t }: Props) {
  const document = useMemo(() => parseDocument(draft.document), [draft.document])
  const agents = document.get('agents', true)
  if (document.errors.length > 0 || !isSeq(agents) || agents.items.some(agent => !isMap(agent))) return <p role="status">{t('invalidTeamSource')}</p>
  const text = (path: readonly (string | number)[]) => { const value = document.getIn(path); return typeof value === 'string' ? value : '' }
  const update = (index: number, key: string, value: string | number | undefined) => {
    const next = parseDocument(draft.document)
    const path = ['agents', index, key]
    if (value === undefined || value === '') next.deleteIn(path)
    else next.setIn(path, value)
    change({ ...draft, document: next.toString() })
  }
  const steps = document.get('steps', true)
  return <section className={css.team}>
    <h3>{text(['name']) || draft.id}</h3>
    {text(['description']) !== '' && <p className={css.secondary}>{text(['description'])}</p>}
    {isSeq(steps) && <p className={css.secondary}>{t('steps')}: {steps.items.map((_step, index) => text(['steps', index, 'id'])).join(' → ')}</p>}
    <h3>{t('agents', { count: agents.items.length })}</h3><p className={css.secondary}>{t('teamHelp')}</p>
    <div className={css.agents}>{agents.items.map((_agent, index) => {
      const id = text(['agents', index, 'id'])
      const role = text(['agents', index, 'role'])
      const model = text(['agents', index, 'model'])
      const fallback = text(['polling', 'model'])
      const files = document.getIn(['agents', index, 'workspace', 'files'], true)
      const resources = isMap(files) ? files.items.flatMap(pair => {
        const name: unknown = isScalar(pair.key) ? pair.key.value : undefined
        const path: unknown = isScalar(pair.value) ? pair.value.value : undefined
        return typeof name === 'string' && typeof path === 'string' && Object.hasOwn(draft.files, path) ? [{ name, path }] : []
      }) : []
      const timeout = document.getIn(['agents', index, 'timeoutSeconds'])
      return <details className={css.agent} key={id}>
        <summary><span>{text(['agents', index, 'name']) || id}</span><span className={css.secondary}>{role} · {(model || fallback) !== 'default' && (model || fallback) !== '' ? model || fallback : t('defaultModel')}</span></summary>
        <div className={css.form}>
          <code className={css.secondary}>{draft.id}/{id}</code>
          {text(['agents', index, 'description']) !== '' && <p>{text(['agents', index, 'description'])}</p>}
          <label>{t('agentName')}<input value={text(['agents', index, 'name'])} placeholder={id} disabled={pending} onChange={event => { update(index, 'name', event.target.value) }} /></label>
          <label>{t('agentModel')}<input value={model} placeholder={fallback && fallback !== 'default' ? fallback : t('defaultModel')} disabled={pending} onChange={event => { update(index, 'model', event.target.value) }} /></label>
          <p className={css.secondary}>{t('modelHelp')}</p>
          <label>{t('agentTimeout')}<input type="number" min={1} max={2147483} step={1} value={typeof timeout === 'number' ? timeout : ''} disabled={pending} placeholder={t('defaultTimeout')} onChange={event => { update(index, 'timeoutSeconds', event.target.value === '' ? undefined : Number(event.target.value)) }} /></label>
          <Persona files={resources} draft={draft} pending={pending} change={change} t={t} />
        </div>
      </details>
    })}</div>
  </section>
}
