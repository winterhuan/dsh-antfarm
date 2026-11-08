/** Verified retained outputs remain available after workspace cleanup. */
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { FileArtifact } from '../persistence/types.ts'
import type { AntfarmArtifactContent, AntfarmSessionId } from '../types.ts'
import type { AntfarmOperations } from './operations.ts'
import css from './RunsPanel.module.css'

/** @param props - Owned references, cancellable reads and locale. @returns Text/image preview and downloads. */
export function ArtifactPanel({ runId, owner, artifacts, operations, t }: PropsLocale<'antfarmRuns'> & { readonly runId: string; readonly owner: AntfarmSessionId; readonly artifacts: readonly FileArtifact[]; readonly operations: AntfarmOperations }) {
  const [content, setContent] = useState<AntfarmArtifactContent | null>(null)
  const [url, setUrl] = useState('')
  const [pending, setPending] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort() }, [])
  useEffect(() => {
    if (content === null) return
    const bytes = Uint8Array.from(atob(content.base64), char => char.charCodeAt(0))
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: content.mime }))
    setUrl(objectUrl)
    return () => { URL.revokeObjectURL(objectUrl) }
  }, [content])
  const read = async (artifact: FileArtifact) => {
    request.current?.abort()
    const abort = new AbortController(); request.current = abort
    setPending(true)
    try { const result = await operations.artifactContent(runId, owner, artifact.sha256, abort.signal); if (!abort.signal.aborted) setContent(result) }
    catch { if (!abort.signal.aborted) operations.report(false) }
    finally { if (!abort.signal.aborted) setPending(false) }
  }
  return <section className={css.stories} aria-busy={pending}><h3>{t('artifacts')}</h3>{artifacts.map(artifact => <Button key={`${artifact.path}:${artifact.sha256}`} size="sm" disabled={pending} onClick={() => { void read(artifact) }}>{t('preview', { path: artifact.path })}</Button>)}
    {content !== null && url !== '' && <>
      <a href={url} download={content.path.split('/').at(-1)}>{t('download', { path: content.path })}</a>
      {content.mime.startsWith('image/') && <img className={css.artifactImage} src={url} alt={content.path} />}
      {content.mime === 'text/plain' && content.base64.length <= 1_398_104 && <pre className={css.output}>{new TextDecoder().decode(Uint8Array.from(atob(content.base64), char => char.charCodeAt(0)))}</pre>}
    </>}
  </section>
}
