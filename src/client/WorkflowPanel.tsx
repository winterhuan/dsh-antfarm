/** Workflow selection, idempotent launch and revision-bound source editing. */
import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { AntfarmSessionId } from '../types.ts'
import type { WorkflowDraft } from '../workflow/types.ts'
import type { AntfarmOperations } from './operations.ts'
import { TeamPanel } from './TeamPanel.tsx'
import css from './RunsPanel.module.css'

interface Props extends PropsLocale<'antfarmRuns'> {
  readonly owner: AntfarmSessionId
  readonly visible: boolean
  readonly operations: AntfarmOperations
  launched(runId: string): void
}

/** @param props - Session-scoped operations and localized copy. @returns Launch and configuration forms. */
export function WorkflowPanel({ owner, visible, operations, launched, t }: Props) {
  const initial = operations.readDraft(owner)
  const [catalog, setCatalog] = useState<{ owner: AntfarmSessionId; ids: string[] }>({ owner, ids: [] })
  const [selected, setSelected] = useState<{ owner: AntfarmSessionId; id: string }>({ owner, id: initial?.id ?? '' })
  const [source, setSource] = useState<WorkflowDraft | null>(initial?.source ?? null)
  const [draft, setDraft] = useState<WorkflowDraft | null>(initial?.draft ?? null)
  const [latest, setLatest] = useState<WorkflowDraft | null>(null)
  const [newId, setNewId] = useState('')
  const [file, setFile] = useState(initial?.file ?? 'workflow.yml')
  const [task, setTask] = useState(initial?.task ?? '')
  const [scope, setScope] = useState<'project' | 'profile'>(initial?.scope ?? 'project')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const [editor, setEditor] = useState(initial?.editor ?? false)
  const [discard, setDiscard] = useState(false)
  const [request, setRequest] = useState<{ task: string; workflowId: string; owner: AntfarmSessionId; id: string } | null>(initial?.request ?? null)
  const ids = catalog.owner === owner ? catalog.ids : []
  const id = selected.owner === owner && selected.id !== '' ? selected.id : ids.includes('feature-dev') ? 'feature-dev' : ids[0] ?? ''
  const dirty = draft !== null && source !== null && (draft.document !== source.document || JSON.stringify(draft.files) !== JSON.stringify(source.files))

  useEffect(() => {
    if (!visible) return
    const abort = new AbortController()
    void operations.workflows(owner, abort.signal).then(ids => { if (!abort.signal.aborted) setCatalog({ owner, ids }) }).catch(() => { if (!abort.signal.aborted) setError(t('catalogError')) })
    return () => { abort.abort() }
  }, [owner, visible, operations, reload, t])

  useEffect(() => {
    if (!visible || id === '') return
    const abort = new AbortController()
    void operations.workflow(id, owner, abort.signal).then(value => {
      if (abort.signal.aborted) return
      const retained = operations.readDraft(owner)
      const edited = retained?.source !== null && retained?.source !== undefined && retained.draft !== null && (retained.source.document !== retained.draft.document || JSON.stringify(retained.source.files) !== JSON.stringify(retained.draft.files))
      setLatest(value)
      if (edited && retained.id === id) { if (retained.source?.revision !== value.revision) setError(t('staleDraft')); return }
      setSource(value); setDraft(value); setFile('workflow.yml'); setError('')
      operations.rememberDraft(owner, { id, source: value, draft: value, file: 'workflow.yml' })
    }).catch(() => { if (!abort.signal.aborted) setError(t('workflowError')) })
    return () => { abort.abort() }
  }, [id, owner, visible, operations, reload, t])

  const start = async () => {
    if (pending || task.trim() === '' || id === '' || source?.id !== id) return
    setPending(true); setError('')
    const stable = request?.task === task && request.workflowId === id && request.owner === owner ? request : { task, workflowId: id, owner, id: crypto.randomUUID() }
    setRequest(stable)
    operations.rememberDraft(owner, { request: stable })
    try {
      const row = await operations.start({ sessionId: owner, requestId: stable.id, workflowId: id, task })
      operations.report(true); setTask(''); operations.rememberDraft(owner, { task: '', request: null }); setRequest(null); launched(row.runId)
    } catch (error) { operations.report(false); setError(error instanceof Error ? error.message : t('operationError')) }
    finally { setPending(false) }
  }
  const save = async () => {
    if (draft === null || pending) return
    setPending(true); setError('')
    try { const value = await operations.save(draft, scope, owner); setSource(value); setDraft(value); setLatest(value); operations.rememberDraft(owner, { source: value, draft: value }); operations.report(true) }
    catch (error) { operations.report(false); setError(error instanceof Error ? error.message : t('operationError')) }
    finally { setPending(false) }
  }
  const remove = async () => {
    if (source === null || dirty || pending) return
    setPending(true); setError('')
    try { await operations.remove(source, scope, owner); operations.rememberDraft(owner, { source: null, draft: null }); setReload(value => value + 1); operations.report(true) }
    catch (error) { operations.report(false); setError(error instanceof Error ? error.message : t('operationError')) }
    finally { setPending(false) }
  }
  const copy = async () => {
    if (draft === null || pending) return
    setPending(true); setError('')
    try {
      const value = await operations.copy(draft, newId, owner)
      setSelected({ owner, id: value.id }); setSource(value); setDraft(value); operations.rememberDraft(owner, { id: value.id, source: value, draft: value }); setReload(value => value + 1); operations.report(true)
    } catch (error) { operations.report(false); setError(error instanceof Error ? error.message : t('operationError')) }
    finally { setPending(false) }
  }
  const toggle = async () => {
    if (source === null || pending) return
    setPending(true)
    try { await operations.setEnabled(source, source.enabled === false, owner); setReload(value => value + 1); operations.report(true) }
    catch (error) { operations.report(false); setError(error instanceof Error ? error.message : t('operationError')) }
    finally { setPending(false) }
  }

  return <section className={css.form} aria-busy={pending}>
    <label>{t('workflow')}<select value={id} disabled={pending || dirty} onChange={event => { setSelected({ owner, id: event.target.value }); setSource(null); setDraft(null); operations.rememberDraft(owner, { id: event.target.value, source: null, draft: null }) }}>
      <option value="">{t('chooseWorkflow')}</option>{ids.map(id => <option key={id} value={id}>{id}</option>)}
    </select></label>
    {draft?.id === id && <TeamPanel draft={draft} pending={pending} t={t} change={next => { setDraft(next); operations.rememberDraft(owner, { draft: next }) }} />}
    <label>{t('task')}<textarea value={task} maxLength={65536} disabled={pending} onChange={event => { setTask(event.target.value); operations.rememberDraft(owner, { task: event.target.value }) }} /></label>
    <p className={css.secondary}>{t('launchHelp')}</p>
    <div className={css.actions}><Button size="sm" disabled={pending || id === '' || source?.id !== id || source.enabled === false || task.trim() === '' || dirty} onClick={() => { void start() }}>{t('startRun')}</Button>
      {dirty && <Button size="sm" disabled={pending} onClick={() => { void save() }}>{t('save')}</Button>}
      <Button size="sm" disabled={id === '' || draft === null} onClick={() => { setEditor(!editor); operations.rememberDraft(owner, { editor: !editor }) }}>{t('advancedConfig')}</Button></div>
    {dirty && <p className={css.secondary}>{t('unsavedDraft')}</p>}
    {error !== '' && <div className={css.notice} role="status"><p>{error}</p><Button size="sm" disabled={pending} onClick={() => { setReload(value => value + 1) }}>{t('retry')}</Button></div>}
    {editor && draft?.id === id && <section className={css.form}>
      <p className={css.secondary}>{t('source')}: <code>{source?.sourceDirectory}</code></p>
      <p className={css.secondary}>{t('editHelp')}</p>
      <Button size="sm" disabled={pending || dirty} onClick={() => { void toggle() }}>{t(source?.enabled === false ? 'installWorkflow' : 'uninstallWorkflow')}</Button>
      <label>{t('saveScope')}<select value={scope} disabled={pending || dirty} onChange={event => { const next = event.target.value === 'profile' ? 'profile' : 'project'; setScope(next); operations.rememberDraft(owner, { scope: next }) }}><option value="project">{t('projectScope')}</option><option value="profile">{t('profileScope')}</option></select></label>
      <label>{t('resource')}<select value={file} onChange={event => { setFile(event.target.value); operations.rememberDraft(owner, { file: event.target.value }) }}><option value="workflow.yml">workflow.yml</option>{Object.keys(draft.files).map(path => <option key={path} value={path}>{path}</option>)}</select></label>
      <textarea className={css.editor} aria-label={t('workflowSource')} value={file === 'workflow.yml' ? draft.document : draft.files[file] ?? ''} disabled={pending} onChange={event => { const next = file === 'workflow.yml' ? { ...draft, document: event.target.value } : { ...draft, files: { ...draft.files, [file]: event.target.value } }; setDraft(next); operations.rememberDraft(owner, { draft: next }) }} />
      {latest !== null && latest.revision !== source?.revision && <details><summary>{t('compareSource')}</summary><pre className={css.output}>{file === 'workflow.yml' ? latest.document : latest.files[file] ?? ''}</pre></details>}
      <div className={css.actions}><Button size="sm" disabled={pending} onClick={() => { if (dirty) setDiscard(true); else setReload(value => value + 1) }}>{t('reload')}</Button>
        <Button size="sm" disabled={pending || dirty} onClick={() => { setDiscard(true) }}>{t('restoreInherited')}</Button></div>
      <label>{t('newWorkflowId')}<input value={newId} disabled={pending} onChange={event => { setNewId(event.target.value) }} /></label>
      <Button size="sm" disabled={pending || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newId)} onClick={() => { void copy() }}>{t('copyWorkflow')}</Button>
      {discard && <div className={css.notice}><p>{t(dirty ? 'discardHelp' : 'removeHelp')}</p><div className={css.actions}>
        <Button size="sm" onClick={() => { setDiscard(false) }}>{t('keepEditing')}</Button>
        <Button size="sm" disabled={pending} onClick={() => { setDiscard(false); if (dirty) { setDraft(source); operations.rememberDraft(owner, { draft: source }); setReload(value => value + 1) } else void remove() }}>{t(dirty ? 'discard' : 'removeOverride')}</Button>
      </div></div>}
    </section>}
  </section>
}
