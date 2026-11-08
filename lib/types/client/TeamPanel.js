import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** Agent settings edit the same revision-bound document and persona resources as the source editor. */
import { useMemo, useState } from 'react';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';
import css from './RunsPanel.module.css';
function Persona({ files, draft, pending, change, t }) {
    const [selected, setSelected] = useState('AGENTS.md');
    const file = files.find(file => file.name === selected) ?? files[0];
    if (file === undefined)
        return null;
    return _jsxs(_Fragment, { children: [_jsxs("label", { children: [t('personaFile'), _jsx("select", { value: file.name, disabled: pending, onChange: event => { setSelected(event.target.value); }, children: files.map(file => _jsx("option", { value: file.name, children: file.name }, file.name)) })] }), _jsxs("label", { children: [t('persona'), _jsx("textarea", { className: css.editor, value: draft.files[file.path] ?? '', disabled: pending, onChange: event => { change({ ...draft, files: { ...draft.files, [file.path]: event.target.value } }); } })] })] });
}
/** @param props - Current source draft and a gesture-owned update. @returns Team overview and common Agent settings. */
export function TeamPanel({ draft, pending, change, t }) {
    const document = useMemo(() => parseDocument(draft.document), [draft.document]);
    const agents = document.get('agents', true);
    if (document.errors.length > 0 || !isSeq(agents) || agents.items.some(agent => !isMap(agent)))
        return _jsx("p", { role: "status", children: t('invalidTeamSource') });
    const text = (path) => { const value = document.getIn(path); return typeof value === 'string' ? value : ''; };
    const update = (index, key, value) => {
        const next = parseDocument(draft.document);
        const path = ['agents', index, key];
        if (value === undefined || value === '')
            next.deleteIn(path);
        else
            next.setIn(path, value);
        change({ ...draft, document: next.toString() });
    };
    const steps = document.get('steps', true);
    return _jsxs("section", { className: css.team, children: [_jsx("h3", { children: text(['name']) || draft.id }), text(['description']) !== '' && _jsx("p", { className: css.secondary, children: text(['description']) }), isSeq(steps) && _jsxs("p", { className: css.secondary, children: [t('steps'), ": ", steps.items.map((_step, index) => text(['steps', index, 'id'])).join(' → ')] }), _jsx("h3", { children: t('agents', { count: agents.items.length }) }), _jsx("p", { className: css.secondary, children: t('teamHelp') }), _jsx("div", { className: css.agents, children: agents.items.map((_agent, index) => {
                    const id = text(['agents', index, 'id']);
                    const role = text(['agents', index, 'role']);
                    const model = text(['agents', index, 'model']);
                    const fallback = text(['polling', 'model']);
                    const files = document.getIn(['agents', index, 'workspace', 'files'], true);
                    const resources = isMap(files) ? files.items.flatMap(pair => {
                        const name = isScalar(pair.key) ? pair.key.value : undefined;
                        const path = isScalar(pair.value) ? pair.value.value : undefined;
                        return typeof name === 'string' && typeof path === 'string' && Object.hasOwn(draft.files, path) ? [{ name, path }] : [];
                    }) : [];
                    const timeout = document.getIn(['agents', index, 'timeoutSeconds']);
                    return _jsxs("details", { className: css.agent, children: [_jsxs("summary", { children: [_jsx("span", { children: text(['agents', index, 'name']) || id }), _jsxs("span", { className: css.secondary, children: [role, " \u00B7 ", (model || fallback) !== 'default' && (model || fallback) !== '' ? model || fallback : t('defaultModel')] })] }), _jsxs("div", { className: css.form, children: [_jsxs("code", { className: css.secondary, children: [draft.id, "/", id] }), text(['agents', index, 'description']) !== '' && _jsx("p", { children: text(['agents', index, 'description']) }), _jsxs("label", { children: [t('agentName'), _jsx("input", { value: text(['agents', index, 'name']), placeholder: id, disabled: pending, onChange: event => { update(index, 'name', event.target.value); } })] }), _jsxs("label", { children: [t('agentModel'), _jsx("input", { value: model, placeholder: fallback && fallback !== 'default' ? fallback : t('defaultModel'), disabled: pending, onChange: event => { update(index, 'model', event.target.value); } })] }), _jsx("p", { className: css.secondary, children: t('modelHelp') }), _jsxs("label", { children: [t('agentTimeout'), _jsx("input", { type: "number", min: 1, max: 2147483, step: 1, value: typeof timeout === 'number' ? timeout : '', disabled: pending, placeholder: t('defaultTimeout'), onChange: event => { update(index, 'timeoutSeconds', event.target.value === '' ? undefined : Number(event.target.value)); } })] }), _jsx(Persona, { files: resources, draft: draft, pending: pending, change: change, t: t })] })] }, id);
                }) })] });
}
//# sourceMappingURL=TeamPanel.js.map