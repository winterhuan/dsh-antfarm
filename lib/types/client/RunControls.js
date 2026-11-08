import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** State-specific actions preserve reconciliation guidance until acceptance. */
import { useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './RunsPanel.module.css';
/** @param props - Durable state, revision-bound operations and localized copy. @returns Valid lifecycle actions. */
export function RunControls({ owner, detail, operations, refresh, t }) {
    const [pending, setPending] = useState(false);
    const [guidance, setGuidance] = useState('');
    const [grant, setGrant] = useState(1);
    const [confirm, setConfirm] = useState(false);
    const [error, setError] = useState('');
    const row = detail.summary;
    const resume = ['blocked', 'interrupted', 'failed'].includes(row.status) && row.workspaceDisposition !== 'cleaned';
    const cancel = ['queued', 'starting', 'running', 'blocked', 'interrupted'].includes(row.status);
    const clean = ['completed', 'failed', 'cancelled'].includes(row.status) && row.workspaceDisposition !== 'cleaned';
    const control = async (action) => {
        if (pending || row.revision === undefined)
            return;
        setPending(true);
        setError('');
        try {
            await operations.control({ action, sessionId: owner, runId: row.runId, revision: row.revision, ...(action !== 'resume' ? {} : { guidance, retryGrant: grant }) });
            setGuidance('');
            setConfirm(false);
            operations.report(true);
            refresh();
        }
        catch (error) {
            operations.report(false);
            setError(error instanceof Error ? error.message : t('operationError'));
            refresh();
        }
        finally {
            setPending(false);
        }
    };
    return _jsxs("section", { className: css.form, "aria-busy": pending, children: [resume && _jsxs(_Fragment, { children: [_jsxs("label", { children: [t('guidance'), _jsx("textarea", { value: guidance, disabled: pending, onChange: event => { setGuidance(event.target.value); } })] }), _jsxs("label", { children: [t('retryGrant'), _jsx("input", { type: "number", min: 0, max: 20, value: grant, disabled: pending, onChange: event => { setGrant(Number(event.target.value)); } })] }), _jsx("p", { className: css.secondary, children: t('resumeHelp') })] }), _jsxs("div", { className: css.actions, children: [resume && _jsx(Button, { size: "sm", disabled: pending || row.revision === undefined || (detail.uncertain && guidance.trim() === '') || !Number.isInteger(grant) || grant < (row.status === 'failed' ? 1 : 0) || grant > 20, onClick: () => { void control('resume'); }, children: t('resumeRun') }), cancel && _jsx(Button, { size: "sm", disabled: pending || row.revision === undefined, onClick: () => { void control('cancel'); }, children: t('cancelRun') }), clean && _jsx(Button, { size: "sm", disabled: pending || row.revision === undefined, onClick: () => { setConfirm(!confirm); }, children: t('cleanupRun') })] }), confirm && _jsxs("div", { className: css.notice, children: [_jsx("p", { children: t('cleanupHelp') }), _jsx("code", { children: row.workspace }), _jsx(Button, { size: "sm", disabled: pending, onClick: () => { void control('cleanup'); }, children: t('confirmCleanup') })] }), error !== '' && _jsx("p", { className: css.notice, role: "status", children: error })] });
}
//# sourceMappingURL=RunControls.js.map