import { jsx as _jsx } from "react/jsx-runtime";
/** Operation feedback remains mounted when the initiating sidebar closes. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { IconWarningOutlineRegular, Toast } from '@deepseek-ai/dsh-client-ui-primitives';
/** @returns Scope-owned feedback source and narrow overlay injection. */
export function createNotices() {
    const source = createSnapshotStore(null);
    let seq = 0;
    return { report: (success) => source.set({ seq: ++seq, success }), face: { hooks: { notice: source }, dismiss: () => source.set(null) } };
}
/** @param props - Framework-bound notice and locale. @returns Transient banner. */
export function OperationNotice({ useNotice, dismiss, t }) {
    const notice = useNotice(value => value);
    if (notice === null)
        return null;
    return _jsx(Toast, { text: t(notice.success ? 'operationSuccess' : 'operationError'), ...notice.success ? { tone: 'success' } : { icon: _jsx(IconWarningOutlineRegular, {}) }, onDone: dismiss }, notice.seq);
}
//# sourceMappingURL=notice.js.map