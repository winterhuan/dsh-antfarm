import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/** Verified retained outputs remain available after workspace cleanup. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './RunsPanel.module.css';
/** @param props - Owned references, cancellable reads and locale. @returns Text/image preview and downloads. */
export function ArtifactPanel({ runId, owner, artifacts, operations, t }) {
    const [content, setContent] = useState(null);
    const [url, setUrl] = useState('');
    const [pending, setPending] = useState(false);
    const request = useRef(null);
    useEffect(() => () => { request.current?.abort(); }, []);
    useEffect(() => {
        if (content === null)
            return;
        const bytes = Uint8Array.from(atob(content.base64), char => char.charCodeAt(0));
        const objectUrl = URL.createObjectURL(new Blob([bytes], { type: content.mime }));
        setUrl(objectUrl);
        return () => { URL.revokeObjectURL(objectUrl); };
    }, [content]);
    const read = async (artifact) => {
        request.current?.abort();
        const abort = new AbortController();
        request.current = abort;
        setPending(true);
        try {
            const result = await operations.artifactContent(runId, owner, artifact.sha256, abort.signal);
            if (!abort.signal.aborted)
                setContent(result);
        }
        catch {
            if (!abort.signal.aborted)
                operations.report(false);
        }
        finally {
            if (!abort.signal.aborted)
                setPending(false);
        }
    };
    return _jsxs("section", { className: css.stories, "aria-busy": pending, children: [_jsx("h3", { children: t('artifacts') }), artifacts.map(artifact => _jsx(Button, { size: "sm", disabled: pending, onClick: () => { void read(artifact); }, children: t('preview', { path: artifact.path }) }, `${artifact.path}:${artifact.sha256}`)), content !== null && url !== '' && _jsxs(_Fragment, { children: [_jsx("a", { href: url, download: content.path.split('/').at(-1), children: t('download', { path: content.path }) }), content.mime.startsWith('image/') && _jsx("img", { className: css.artifactImage, src: url, alt: content.path }), content.mime === 'text/plain' && content.base64.length <= 1_398_104 && _jsx("pre", { className: css.output, children: new TextDecoder().decode(Uint8Array.from(atob(content.base64), char => char.charCodeAt(0))) })] })] });
}
//# sourceMappingURL=ArtifactPanel.js.map