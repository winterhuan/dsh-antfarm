/** Session-scoped Antfarm sidebar registration and Remote lifetime. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@winterhuan/dsh-antfarm/remote'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { IconChecklistOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { useEffect } from 'react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { HostObservable, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { en, NS, zh } from './locales.ts'
import type { Config } from './config.ts'
import { RunsPanel } from './RunsPanel.tsx'
import { useAntfarmRuns, type AntfarmQueries } from './queries.ts'
import type { AntfarmEditorDraft, AntfarmOperations } from './operations.ts'
import { createNotices, OperationNotice } from './notice.tsx'
import { BoardPanel, BoardIcon } from './BoardPanel.tsx'

/** Browser services required before mounting the plugin's own Remote. */
export const inject = ['remote', 'slots', 'locale', 'sessions', 'uiSession', 'uiWorkspace', 'sidebarRightTabs']

const TAB_ID = 'dsh-antfarm'
interface RefreshFace { readonly hooks: { readonly refreshInterval: HostObservable<number> } }
type SidebarProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<typeof NS> & InjectFace<RefreshFace>

/**
 * Mount the plugin's own Remote before registering sidebar readers.
 * @param ctx - browser plugin context.
 * @param contribution - generated Antfarm Remote descriptors.
 * @param config - active-run refresh policy.
 * @returns disposer joining UI and Remote withdrawal, including setup rollback.
 */
export async function mountAntfarm(ctx: Context, contribution: TypertRemoteContribution, config: Config): Promise<() => Promise<void>> {
  const disposeRemote = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(['remote.antfarmStudio'], current => { registerSidebar(current, config) })
  try { await ui } catch (error) {
    try { await ui.dispose() } finally { await disposeRemote() }
    throw error
  }
  return async () => { try { await ui.dispose() } finally { await disposeRemote() } }
}

function registerSidebar(ctx: Context, config: Config): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'Antfarm: dictionaries')
  const t = ctx.locale.bind(NS)
  const refreshInterval = createSnapshotStore(config.refreshIntervalMs.get())
  ctx.on('loader/volatile-update', () => { refreshInterval.set(config.refreshIntervalMs.get()) })
  const notices = createNotices()
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'antfarm-notice', locale: NS, inject: () => notices.face }, OperationNotice)), 'Antfarm: operation feedback')
  const remote = ctx.remote.antfarmStudio
  const drafts = new Map<SessionId, AntfarmEditorDraft>()
  ctx.effect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if ([...drafts.values()].some(value => value.source !== null && value.draft !== null && (value.source.document !== value.draft.document || JSON.stringify(value.source.files) !== JSON.stringify(value.draft.files)))) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', protect)
    return () => { window.removeEventListener('beforeunload', protect) }
  }, 'Antfarm: unsaved source protection')
  const operations: AntfarmOperations = {
    readDraft: owner => drafts.get(owner),
    rememberDraft: (owner, patch) => { drafts.set(owner, { id: '', task: '', source: null, draft: null, scope: 'project', file: 'workflow.yml', editor: false, ...drafts.get(owner), ...patch }) },
    async start(request) { const result = await remote.start(request, new AbortController().signal); if (!result.ok) throw result.error; return result.value },
    async control(request) { const result = await remote.control(request, new AbortController().signal); if (!result.ok) throw result.error; return result.value },
    async workflows(owner, signal) { const result = await remote.workflows(owner, signal); if (!result.ok) throw result.error; return result.value },
    async workflow(id, owner, signal) { const result = await remote.workflow(id, owner, signal); if (!result.ok) throw result.error; return result.value },
    async save(draft, scope, owner) { const result = await remote.saveWorkflow(draft, scope, owner, new AbortController().signal); if (!result.ok) throw result.error; return result.value },
    async remove(draft, scope, owner) { const result = await remote.removeWorkflow(draft.id, draft.revision, scope, owner, new AbortController().signal); if (!result.ok) throw result.error },
    async copy(draft, newId, owner) { const result = await remote.copyWorkflow(draft, newId, owner, new AbortController().signal); if (!result.ok) throw result.error; return result.value },
    async setEnabled(draft, enabled, owner) { const result = await remote.setWorkflowEnabled(draft, enabled, owner, new AbortController().signal); if (!result.ok) throw result.error },
    async events(runId, owner, after) { const result = await remote.events(runId, owner, after, new AbortController().signal); if (!result.ok) throw result.error; return result.value },
    async health(owner) { const result = await remote.health(owner, new AbortController().signal); if (!result.ok) throw result.error; return result.value },
    async healthHistory(owner) { const result = await remote.healthHistory(owner, new AbortController().signal); if (!result.ok) throw result.error; return result.value },
    async ensureExecution(owner) { const result = await remote.ensureExecution(owner, new AbortController().signal); if (!result.ok) throw result.error; return result.value },
    report: notices.report,
  }
  const queries: AntfarmQueries = {
    async page(sessionId, offset, signal) {
      const result = await remote.page([sessionId], offset, signal)
      if (!result.ok) throw result.error
      return result.value
    },
    async list(sessionId, signal) {
      const result = await ctx.remote.antfarmStudio.list(sessionId, signal)
      if (!result.ok) throw result.error
      return result.value
    },
    async status(runId, sessionId, signal) {
      const result = await ctx.remote.antfarmStudio.status(runId, sessionId, signal)
      if (!result.ok) throw result.error
      return result.value
    },
  }
  ctx.effect(() => ctx.sidebarRightTabs.register({
    id: TAB_ID,
    kind: 'antfarm',
    title: () => t('title'),
    guide: [{ id: 'runs', order: 25, title: () => t('title'), description: () => t('description'), icon: IconChecklistOutlineRegular }],
  }), 'Antfarm: sidebar type')

  const boardQueries = (owners: readonly SessionId[]): AntfarmQueries => {
    const attribution = new Map<string, SessionId>()
    return {
      async page(_view, offset, signal) {
        const chunks = Array.from({ length: Math.ceil(owners.length / 100) }, (_, index) => owners.slice(index * 100, index * 100 + 100))
        const batches = await Promise.all(chunks.map(async chunk => {
          const result = await remote.page(chunk, offset, signal)
          if (!result.ok) throw result.error
          return result.value
        }))
        const rows = batches.flat().sort((a, b) => b.updatedAt - a.updatedAt)
        for (const row of rows) attribution.set(row.runId, SessionId(row.ownerSessionId))
        return rows
      },
      async list(_view, signal) {
        if (owners.length === 0) return []
        const result = await remote.board(owners, signal)
        if (!result.ok) throw result.error
        attribution.clear()
        for (const row of result.value) attribution.set(row.runId, SessionId(row.ownerSessionId))
        return result.value
      },
      async status(runId, _view, signal) {
        const owner = attribution.get(runId)
        if (owner === undefined) throw new Error('Run is no longer in the authorized board')
        return queries.status(runId, owner, signal)
      },
    }
  }
  ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'antfarm-board', locale: NS,
    inject: () => ({ hooks: { refreshInterval }, queries: boardQueries, operations, openChild: (child: string, parent: string) => {
      const address = ctx.sessions.subagentAddress(SessionId(child))
      ctx.uiWorkspace.openSession(address ?? { parentSessionId: SessionId(parent), childSessionId: SessionId(child), mode: 'unknown' })
    } }),
  }, BoardPanel)), 'Antfarm: workflow board')
  ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'antfarm-board', order: 25, label: () => t('board'), locale: NS }, BoardIcon)), 'Antfarm: board launcher')

  function Sidebar({ sessionId, useTabInfo, useSessions, useRefreshInterval, t: copy }: SidebarProps) {
    const { tab } = useTabInfo()
    const workspace = useSessions(state => state.byId[sessionId]?.cwd)
    const interval = useRefreshInterval(value => value)
    const state = useAntfarmRuns(sessionId, tab.visible, queries, interval)
    useEffect(() => tab.actions.bindCommands({ refresh: state.refresh }), [tab.actions, state.refresh])
    return <RunsPanel state={state} workspace={workspace} owner={sessionId} visible={tab.visible} operations={operations} t={copy} openChild={rawId => {
      const childSessionId = SessionId(rawId)
      const address = ctx.sessions.subagentAddress(childSessionId)
      ctx.uiWorkspace.openSession(address ?? { parentSessionId: sessionId, childSessionId, mode: 'unknown' })
    }} />
  }

  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID, locale: NS, inject: () => ({ hooks: { refreshInterval } }) }, Sidebar)), 'Antfarm: sidebar body')
}
