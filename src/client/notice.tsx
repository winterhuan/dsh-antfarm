/** Operation feedback remains mounted when the initiating sidebar closes. */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { IconWarningOutlineRegular, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

interface Notice { readonly seq: number; readonly success: boolean }
interface NoticeFace { readonly hooks: { readonly notice: HostObservable<Notice | null> }; dismiss(): void }

/** @returns Scope-owned feedback source and narrow overlay injection. */
export function createNotices() {
  const source = createSnapshotStore<Notice | null>(null)
  let seq = 0
  return { report: (success: boolean) => source.set({ seq: ++seq, success }), face: { hooks: { notice: source }, dismiss: () => source.set(null) } satisfies NoticeFace }
}

/** @param props - Framework-bound notice and locale. @returns Transient banner. */
export function OperationNotice({ useNotice, dismiss, t }: PropsRuntime<'shell.overlay'> & PropsLocale<'antfarmRuns'> & InjectFace<NoticeFace>) {
  const notice = useNotice(value => value)
  if (notice === null) return null
  return <Toast key={notice.seq} text={t(notice.success ? 'operationSuccess' : 'operationError')} {...notice.success ? { tone: 'success' as const } : { icon: <IconWarningOutlineRegular /> }} onDone={dismiss} />
}
