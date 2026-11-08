import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Workflow selection, idempotent launch and revision-bound source editing. */
import { useEffect, useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import { TeamPanel } from "./TeamPanel.js";
import css from './RunsPanel.module.css';
/** @param props - Session-scoped operations and localized copy. @returns Launch and configuration forms. */
export function WorkflowPanel({ owner, visible, operations, launched, t }) {
    const initial = operations.readDraft(owner);
    const [catalog, setCatalog] = useState({ owner, ids: [] });
    const [selected, setSelected] = useState({ owner, id: initial?.id ?? '' });
    const [source, setSource] = useState(initial?.source ?? null);
    const [draft, setDraft] = useState(initial?.draft ?? null);
    const [latest, setLatest] = useState(null);
    const [newId, setNewId] = useState('');
    const [file, setFile] = useState(initial?.file ?? 'workflow.yml');
    const [task, setTask] = useState(initial?.task ?? '');
    const [scope, setScope] = useState(initial?.scope ?? 'project');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const [reload, setReload] = useState(0);
    const [editor, setEditor] = useState(initial?.editor ?? false);
    const [discard, setDiscard] = useState(false);
    const [request, setRequest] = useState(initial?.request ?? null);
    const ids = catalog.owner === owner ? catalog.ids : [];
    const id = selected.owner === owner && selected.id !== '' ? selected.id : ids.includes('feature-dev') ? 'feature-dev' : ids[0] ?? '';
    const dirty = draft !== null && source !== null && (draft.document !== source.document || JSON.stringify(draft.files) !== JSON.stringify(source.files));
    useEffect(() => {
        if (!visible)
            return;
        const abort = new AbortController();
        void operations.workflows(owner, abort.signal).then(ids => { if (!abort.signal.aborted)
            setCatalog({ owner, ids }); }).catch(() => { if (!abort.signal.aborted)
            setError(t('catalogError')); });
        return () => { abort.abort(); };
    }, [owner, visible, operations, reload, t]);
    useEffect(() => {
        if (!visible || id === '')
            return;
        const abort = new AbortController();
        void operations.workflow(id, owner, abort.signal).then(value => {
            if (abort.signal.aborted)
                return;
            const retained = operations.readDraft(owner);
            const edited = retained?.source !== null && retained?.source !== undefined && retained.draft !== null && (retained.source.document !== retained.draft.document || JSON.stringify(retained.source.files) !== JSON.stringify(retained.draft.files));
            setLatest(value);
            if (edited && retained.id === id) {
                if (retained.source?.revision !== value.revision)
                    setError(t('staleDraft'));
                return;
            }
            setSource(value);
            setDraft(value);
            setFile('workflow.yml');
            setError('');
            operations.rememberDraft(owner, { id, source: value, draft: value, file: 'workflow.yml' });
        }).catch(() => { if (!abort.signal.aborted)
            setError(t('workflowError')); });
        return () => { abort.abort(); };
    }, [id, owner, visible, operations, reload, t]);
    const start = async () => {
        if (pending || task.trim() === '' || id === '' || source?.id !== id)
            return;
        setPending(true);
        setError('');
        const stable = request?.task === task && request.workflowId === id && request.owner === owner ? request : { task, workflowId: id, owner, id: crypto.randomUUID() };
        setRequest(stable);
        operations.rememberDraft(owner, { request: stable });
        try {
            const row = await operations.start({ sessionId: owner, requestId: stable.id, workflowId: id, task });
            operations.report(true);
            setTask('');
            operations.rememberDraft(owner, { task: '', request: null });
            setRequest(null);
            launched(row.runId);
        }
        catch (error) {
            operations.report(false);
            setError(error instanceof Error ? error.message : t('operationError'));
        }
        finally {
            setPending(false);
        }
    };
    const save = async () => {
        if (draft === null || pending)
            return;
        setPending(true);
        setError('');
        try {
            const value = await operations.save(draft, scope, owner);
            setSource(value);
            setDraft(value);
            setLatest(value);
            operations.rememberDraft(owner, { source: value, draft: value });
            operations.report(true);
        }
        catch (error) {
            operations.report(false);
            setError(error instanceof Error ? error.message : t('operationError'));
        }
        finally {
            setPending(false);
        }
    };
    const remove = async () => {
        if (source === null || dirty || pending)
            return;
        setPending(true);
        setError('');
        try {
            await operations.remove(source, scope, owner);
            operations.rememberDraft(owner, { source: null, draft: null });
            setReload(value => value + 1);
            operations.report(true);
        }
        catch (error) {
            operations.report(false);
            setError(error instanceof Error ? error.message : t('operationError'));
        }
        finally {
            setPending(false);
        }
    };
    const copy = async () => {
        if (draft === null || pending)
            return;
        setPending(true);
        setError('');
        try {
            const value = await operations.copy(draft, newId, owner);
            setSelected({ owner, id: value.id });
            setSource(value);
            setDraft(value);
            operations.rememberDraft(owner, { id: value.id, source: value, draft: value });
            setReload(value => value + 1);
            operations.report(true);
        }
        catch (error) {
            operations.report(false);
            setError(error instanceof Error ? error.message : t('operationError'));
        }
        finally {
            setPending(false);
        }
    };
    const toggle = async () => {
        if (source === null || pending)
            return;
        setPending(true);
        try {
            await operations.setEnabled(source, source.enabled === false, owner);
            setReload(value => value + 1);
            operations.report(true);
        }
        catch (error) {
            operations.report(false);
            setError(error instanceof Error ? error.message : t('operationError'));
        }
        finally {
            setPending(false);
        }
    };
    return _jsxs("section", { className: css.form, "aria-busy": pending, children: [_jsxs("label", { children: [t('workflow'), _jsxs("select", { value: id, disabled: pending || dirty, onChange: event => { setSelected({ owner, id: event.target.value }); setSource(null); setDraft(null); operations.rememberDraft(owner, { id: event.target.value, source: null, draft: null }); }, children: [_jsx("option", { value: "", children: t('chooseWorkflow') }), ids.map(id => _jsx("option", { value: id, children: id }, id))] })] }), draft?.id === id && _jsx(TeamPanel, { draft: draft, pending: pending, t: t, change: next => { setDraft(next); operations.rememberDraft(owner, { draft: next }); } }), _jsxs("label", { children: [t('task'), _jsx("textarea", { value: task, maxLength: 65536, disabled: pending, onChange: event => { setTask(event.target.value); operations.rememberDraft(owner, { task: event.target.value }); } })] }), _jsx("p", { className: css.secondary, children: t('launchHelp') }), _jsxs("div", { className: css.actions, children: [_jsx(Button, { size: "sm", disabled: pending || id === '' || source?.id !== id || source.enabled === false || task.trim() === '' || dirty, onClick: () => { void start(); }, children: t('startRun') }), dirty && _jsx(Button, { size: "sm", disabled: pending, onClick: () => { void save(); }, children: t('save') }), _jsx(Button, { size: "sm", disabled: id === '' || draft === null, onClick: () => { setEditor(!editor); operations.rememberDraft(owner, { editor: !editor }); }, children: t('advancedConfig') })] }), dirty && _jsx("p", { className: css.secondary, children: t('unsavedDraft') }), error !== '' && _jsxs("div", { className: css.notice, role: "status", children: [_jsx("p", { children: error }), _jsx(Button, { size: "sm", disabled: pending, onClick: () => { setReload(value => value + 1); }, children: t('retry') })] }), editor && draft?.id === id && _jsxs("section", { className: css.form, children: [_jsxs("p", { className: css.secondary, children: [t('source'), ": ", _jsx("code", { children: source?.sourceDirectory })] }), _jsx("p", { className: css.secondary, children: t('editHelp') }), _jsx(Button, { size: "sm", disabled: pending || dirty, onClick: () => { void toggle(); }, children: t(source?.enabled === false ? 'installWorkflow' : 'uninstallWorkflow') }), _jsxs("label", { children: [t('saveScope'), _jsxs("select", { value: scope, disabled: pending || dirty, onChange: event => { const next = event.target.value === 'profile' ? 'profile' : 'project'; setScope(next); operations.rememberDraft(owner, { scope: next }); }, children: [_jsx("option", { value: "project", children: t('projectScope') }), _jsx("option", { value: "profile", children: t('profileScope') })] })] }), _jsxs("label", { children: [t('resource'), _jsxs("select", { value: file, onChange: event => { setFile(event.target.value); operations.rememberDraft(owner, { file: event.target.value }); }, children: [_jsx("option", { value: "workflow.yml", children: "workflow.yml" }), Object.keys(draft.files).map(path => _jsx("option", { value: path, children: path }, path))] })] }), _jsx("textarea", { className: css.editor, "aria-label": t('workflowSource'), value: file === 'workflow.yml' ? draft.document : draft.files[file] ?? '', disabled: pending, onChange: event => { const next = file === 'workflow.yml' ? { ...draft, document: event.target.value } : { ...draft, files: { ...draft.files, [file]: event.target.value } }; setDraft(next); operations.rememberDraft(owner, { draft: next }); } }), latest !== null && latest.revision !== source?.revision && _jsxs("details", { children: [_jsx("summary", { children: t('compareSource') }), _jsx("pre", { className: css.output, children: file === 'workflow.yml' ? latest.document : latest.files[file] ?? '' })] }), _jsxs("div", { className: css.actions, children: [_jsx(Button, { size: "sm", disabled: pending, onClick: () => { if (dirty)
                                    setDiscard(true);
                                else
                                    setReload(value => value + 1); }, children: t('reload') }), _jsx(Button, { size: "sm", disabled: pending || dirty, onClick: () => { setDiscard(true); }, children: t('restoreInherited') })] }), _jsxs("label", { children: [t('newWorkflowId'), _jsx("input", { value: newId, disabled: pending, onChange: event => { setNewId(event.target.value); } })] }), _jsx(Button, { size: "sm", disabled: pending || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newId), onClick: () => { void copy(); }, children: t('copyWorkflow') }), discard && _jsxs("div", { className: css.notice, children: [_jsx("p", { children: t(dirty ? 'discardHelp' : 'removeHelp') }), _jsxs("div", { className: css.actions, children: [_jsx(Button, { size: "sm", onClick: () => { setDiscard(false); }, children: t('keepEditing') }), _jsx(Button, { size: "sm", disabled: pending, onClick: () => { setDiscard(false); if (dirty) {
                                            setDraft(source);
                                            operations.rememberDraft(owner, { draft: source });
                                            setReload(value => value + 1);
                                        }
                                        else
                                            void remove(); }, children: t(dirty ? 'discard' : 'removeOverride') })] })] })] })] });
}
//# sourceMappingURL=WorkflowPanel.js.map