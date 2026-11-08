import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Manual diagnostics and safe redispatch share the existing Run executor. */
import { useEffect, useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './RunsPanel.module.css';
/** @param props - Authorized owner, native operations and locale. @returns Health disclosure. */
export function HealthPanel({ owner, operations, refresh, t }) {
    const [report, setReport] = useState(null);
    const [pending, setPending] = useState(false);
    const [history, setHistory] = useState(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open)
            return;
        let current = true;
        void operations.healthHistory(owner).then(value => { if (current)
            setHistory(value); }).catch(() => { if (current)
            operations.report(false); });
        return () => { current = false; };
    }, [open, owner, operations, report]);
    const check = async (repair) => {
        if (pending)
            return;
        setPending(true);
        try {
            if (repair)
                await operations.ensureExecution(owner);
            setReport(await operations.health(owner));
            refresh();
            operations.report(true);
        }
        catch {
            operations.report(false);
        }
        finally {
            setPending(false);
        }
    };
    return _jsxs("details", { onToggle: event => { setOpen(event.currentTarget.open); }, children: [_jsx("summary", { children: t('health') }), _jsxs("section", { className: css.form, "aria-busy": pending, children: [_jsx("p", { className: css.secondary, children: t('healthHelp') }), _jsxs("div", { className: css.actions, children: [_jsx(Button, { size: "sm", disabled: pending, onClick: () => { void check(false); }, children: t('checkHealth') }), _jsx(Button, { size: "sm", disabled: pending, onClick: () => { void check(true); }, children: t('ensureExecution') })] }), report !== null && _jsx("pre", { className: css.output, children: JSON.stringify(report, null, 2) }), history !== null && _jsxs("details", { children: [_jsx("summary", { children: t('healthHistory') }), _jsx("pre", { className: css.output, children: JSON.stringify(history, null, 2) })] })] })] });
}
//# sourceMappingURL=HealthPanel.js.map