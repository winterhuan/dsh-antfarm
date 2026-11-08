import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** Cross-session workflow stage board over explicitly authorized Host resources. */
import { useMemo, useState } from 'react';
import { Button, IconChecklistOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { SessionId } from '@deepseek-ai/dsh-session/types';
import { useAntfarmRuns } from "./queries.js";
import { RunsPanel } from "./RunsPanel.js";
import { WorkflowPanel } from "./WorkflowPanel.js";
import css from './RunsPanel.module.css';
/** @param props - Root Session list hook and scoped Host actions. @returns Workflow stage cards and progressive detail. */
export function BoardPanel({ useSessions, usePanelInfo, useRefreshInterval, queries, operations, openChild, t }) {
    const ownersKey = useSessions(state => JSON.stringify(state.ids));
    const owners = useMemo(() => JSON.parse(ownersKey).map(SessionId), [ownersKey]);
    const sessionsKey = useSessions(state => JSON.stringify(state.ids.flatMap(id => {
        const row = state.byId[id];
        return row?.cwd !== undefined && row.parentId === undefined && row.origin !== 'subagent' ? [{ id, title: row.displayTitle, cwd: row.cwd }] : [];
    })));
    const sessions = useMemo(() => JSON.parse(sessionsKey), [sessionsKey]);
    const [target, setTarget] = useState('');
    const session = sessions.find(row => row.id === target) ?? sessions[0];
    const reader = useMemo(() => queries(owners), [queries, owners]);
    const visible = usePanelInfo(state => state.activePanelId === 'antfarm-board');
    const interval = useRefreshInterval(value => value);
    const state = useAntfarmRuns(owners[0] ?? SessionId('antfarm-board-empty'), visible, reader, interval);
    const [workflow, setWorkflow] = useState('');
    const rows = state.rows.filter(row => workflow === '' || row.workflowId === workflow);
    const groups = new Map();
    for (const row of rows) {
        const key = `${row.workflowId} · ${row.status === 'running' || row.status === 'starting' ? row.currentStep ?? row.status : row.status}`;
        groups.set(key, [...groups.get(key) ?? [], row]);
    }
    const selected = state.rows.find(row => row.runId === state.selectedRunId);
    return _jsxs("main", { className: css.board, children: [_jsxs("header", { className: css.header, children: [_jsx("h1", { children: t('board') }), _jsx(Button, { size: "sm", disabled: state.loading, onClick: state.refresh, children: t('refresh') })] }), _jsxs("section", { className: css.launch, children: [_jsx("h2", { children: t('newRun') }), _jsx("p", { className: css.secondary, children: t('boardHelp') }), session === undefined ? _jsx("p", { children: t('noProjectSession') }) : _jsxs(_Fragment, { children: [_jsxs("label", { className: css.form, children: [t('projectSession'), _jsx("select", { value: session.id, onChange: event => { setTarget(event.target.value); }, children: sessions.map(row => _jsxs("option", { value: row.id, children: [row.title, " \u00B7 ", row.cwd] }, row.id)) })] }), _jsx("p", { className: css.project, children: session.cwd }), _jsx(WorkflowPanel, { owner: SessionId(session.id), visible: visible, operations: operations, t: t, launched: runId => { setWorkflow(''); state.select(runId); state.refresh(); } }, session.id)] })] }), _jsxs("header", { className: css.header, children: [_jsx("h2", { children: t('runs') }), _jsxs("select", { "aria-label": t('filterWorkflow'), value: workflow, onChange: event => { setWorkflow(event.target.value); }, children: [_jsx("option", { value: "", children: t('allWorkflows') }), [...new Set(state.rows.map(row => row.workflowId))].map(id => _jsx("option", { value: id, children: id }, id))] })] }), state.failed && _jsx("p", { role: "status", children: t('loadError') }), state.rows.length === 0 && !state.loading && !state.failed && _jsxs("div", { className: css.empty, children: [_jsx("p", { children: t('emptyBoard') }), _jsx("p", { children: t('emptyHelp') })] }), _jsx("div", { className: css.columns, children: [...groups].map(([group, rows]) => _jsxs("section", { className: css.column, children: [_jsxs("h2", { children: [group, " (", rows.length, ")"] }), rows.map(row => _jsxs("button", { type: "button", className: css.card, "aria-expanded": state.selectedRunId === row.runId, onClick: () => { state.select(row.runId); }, children: [_jsx("span", { children: row.task ?? row.workflowId }), _jsxs("span", { className: css.secondary, children: ["#", row.number ?? row.runId, " \u00B7 ", t(row.status)] }), (row.totalStories ?? 0) > 0 && _jsx("span", { children: t('acceptedProgress', { done: row.acceptedStories ?? 0, total: row.totalStories ?? 0 }) }), row.reason !== undefined && row.reason !== '' && _jsx("span", { className: css.reason, children: row.reason })] }, row.runId))] }, group)) }), state.hasMore === true && _jsx(Button, { size: "sm", disabled: state.loading, onClick: state.loadMore, children: t('moreRuns') }), selected !== undefined && _jsx(RunsPanel, { state: { ...state, rows: [selected], hasMore: false }, workspace: selected.workspace, owner: SessionId(selected.ownerSessionId), operations: operations, showLaunch: false, visible: visible, t: t, openChild: child => { openChild(child, selected.ownerSessionId); } })] });
}
/** @param props - Native sidebar icon size. @returns Existing checklist glyph. */
export function BoardIcon({ size }) { return _jsx(IconChecklistOutlineRegular, { size: size }); }
//# sourceMappingURL=BoardPanel.js.map