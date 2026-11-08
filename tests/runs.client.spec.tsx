// @vitest-environment jsdom
/** Retained run content, native navigation affordances, and cancellable query updates. */
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { Context } from '@deepseek-ai/cordis'
import type { AntfarmRunSummary, AntfarmStatus } from '../src/types.ts'
import { RunsPanel } from '../src/client/RunsPanel.tsx'
import { en, zh } from '../src/client/locales.ts'
import { useAntfarmRuns, type AntfarmQueries, type AntfarmViewState } from '../src/client/queries.ts'
import { Config } from '../src/client/config.ts'
import { mountAntfarm } from '../src/client/mount.tsx'

// The published primitive barrel depends on the Web shell's shared modules; this unit lane exercises Antfarm's content and actions.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const { createElement } = await import('react')
  return {
    Button: ({ children, size, variant, icon, ...props }: import('react').ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; variant?: string; icon?: import('react').ReactNode }) => {
      void size; void variant
      return createElement('button', { type: 'button', ...props }, icon, children)
    },
    DisclosureRow: ({ title, open, onToggle, collapsedContent, children }: { title: string; open: boolean; onToggle(): void; collapsedContent: import('react').ReactNode; children: import('react').ReactNode }) => createElement('div', null,
      createElement('button', { type: 'button', onClick: onToggle, 'aria-expanded': open }, title, collapsedContent), open ? children : null),
    IconChecklistOutlineRegular: () => null,
    StateDot: () => null,
  }
})

afterEach(() => { cleanup(); vi.useRealTimers() })

const owner = SessionId('owner')
const row: AntfarmRunSummary = { runId: 'af-demo', workflowId: 'feature-dev', status: 'blocked', ownerSessionId: owner, workspace: '/repo/.worktrees/antfarm/af-demo', branch: 'antfarm/af-demo', currentStep: 'verify', updatedAt: 1, workspaceDisposition: 'retained', workspaceReason: 'Check the failing regression' }
const detail: AntfarmStatus = { summary: row, context: {}, stories: [{ id: 'story-1', title: 'Payment callback', status: 'retry', retryCount: 2, feedback: 'Missing regression test' }], childSessionIds: ['child-1'], uncertain: true }

function state(overrides: Partial<AntfarmViewState> = {}): AntfarmViewState {
  return { rows: [row], loading: false, failed: false, selectedRunId: row.runId, detail, detailLoading: false, detailFailed: false, refresh: vi.fn(), select: vi.fn(), ...overrides }
}

for (const dictionary of [en, zh]) {
  it(`shows run facts, uncertain result and child navigation in ${dictionary.branch}`, () => {
    const openChild = vi.fn()
    const t = (key: keyof typeof en, values?: Record<string, unknown>): string => Object.entries(values ?? {}).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), dictionary[key])
    render(<RunsPanel state={state()} workspace="/repo" openChild={openChild} t={t} />)
    expect(screen.getByText(dictionary.description)).toBeTruthy()
    expect(screen.getByText(row.workspace)).toBeTruthy()
    expect(screen.getByText(row.branch)).toBeTruthy()
    expect(screen.getByText('Payment callback')).toBeTruthy()
    expect(screen.getByText(dictionary.uncertain)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: t('openChild', { id: 'child-1' }) }))
    expect(openChild).toHaveBeenCalledWith('child-1')
  })
}

it('keeps settled run and story content visible when either query fails', () => {
  const current = state({ failed: true, detailFailed: true })
  render(<RunsPanel state={current} workspace="/repo" openChild={vi.fn()} t={key => en[key]} />)
  expect(screen.getByText(en.loadError)).toBeTruthy()
  expect(screen.getByText(en.detailError)).toBeTruthy()
  expect(screen.getByText('Payment callback')).toBeTruthy()
  expect(screen.getByText(row.workspace)).toBeTruthy()
  fireEvent.click(screen.getAllByRole('button', { name: en.retry })[0]!)
  expect(current.refresh).toHaveBeenCalledOnce()
})

it('distinguishes initial loading from an empty settled listing', () => {
  const view = render(<RunsPanel state={state({ rows: [], loading: true, detail: null, selectedRunId: null })} workspace="/repo" openChild={vi.fn()} t={key => en[key]} />)
  expect(screen.queryByText(en.empty)).toBeNull()
  view.rerender(<RunsPanel state={state({ rows: [], detail: null, selectedRunId: null })} workspace="/repo" openChild={vi.fn()} t={key => en[key]} />)
  expect(screen.getByText(en.empty)).toBeTruthy()
  expect(screen.getByText(en.emptyHelp)).toBeTruthy()
})

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(finish => { resolve = finish })
  return { promise, resolve }
}

it('ignores an old Session listing that resolves after the view switches', async () => {
  const old = deferred<AntfarmRunSummary[]>()
  const next = SessionId('next')
  const nextRow = { ...row, runId: 'af-next', ownerSessionId: next }
  let oldSignal: AbortSignal | undefined
  const queries: AntfarmQueries = {
    list: (sessionId, signal) => { if (sessionId === owner) { oldSignal = signal; return old.promise }; return Promise.resolve([nextRow]) },
    status: async () => detail,
  }
  const hook = renderHook(({ sessionId }) => useAntfarmRuns(sessionId, true, queries, 2000), { initialProps: { sessionId: owner } })
  hook.rerender({ sessionId: next })
  await waitFor(() => { expect(hook.result.current.rows).toEqual([nextRow]) })
  expect(oldSignal?.aborted).toBe(true)
  await act(async () => { old.resolve([row]); await old.promise })
  expect(hook.result.current.rows).toEqual([nextRow])
})

it('retains rows and details after a failed refresh', async () => {
  let fail = false
  const queries: AntfarmQueries = {
    list: async () => { if (fail) throw new Error('offline'); return [row] },
    status: async () => { if (fail) throw new Error('offline'); return detail },
  }
  const hook = renderHook(() => useAntfarmRuns(owner, true, queries, 2000))
  await waitFor(() => { expect(hook.result.current.rows).toEqual([row]) })
  act(() => { hook.result.current.select(row.runId) })
  await waitFor(() => { expect(hook.result.current.detail).toEqual(detail) })
  fail = true
  act(() => { hook.result.current.refresh() })
  await waitFor(() => { expect(hook.result.current.failed && hook.result.current.detailFailed).toBe(true) })
  expect(hook.result.current.rows).toEqual([row])
  expect(hook.result.current.detail).toEqual(detail)
})

it('polls active runs only while visible and disposes the interval', async () => {
  vi.useFakeTimers()
  const queries: AntfarmQueries = { list: vi.fn(async () => [{ ...row, status: 'running' }]), status: async () => detail }
  const hook = renderHook(({ visible }) => useAntfarmRuns(owner, visible, queries, 2000), { initialProps: { visible: true } })
  await act(async () => { await Promise.resolve() })
  expect(queries.list).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(queries.list).toHaveBeenCalledTimes(2)
  hook.rerender({ visible: false })
  await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
  expect(queries.list).toHaveBeenCalledTimes(2)
  hook.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps polling after workspace settlement so newly admitted Runs appear', async () => {
  vi.useFakeTimers()
  const rows: AntfarmRunSummary[] = [
    { ...row, status: 'running', workspaceDisposition: 'present' },
    { ...row, status: 'completed', workspaceDisposition: 'present' },
    { ...row, status: 'completed', workspaceDisposition: 'cleaned' },
  ]
  let index = 0
  const queries: AntfarmQueries = { list: vi.fn(async () => [rows[Math.min(index++, rows.length - 1)]!]), status: async () => detail }
  const hook = renderHook(() => useAntfarmRuns(owner, true, queries, 2000))
  await act(async () => { await Promise.resolve() })
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(hook.result.current.rows[0]?.workspaceDisposition).toBe('present')
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(hook.result.current.rows[0]?.workspaceDisposition).toBe('cleaned')
  await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
  expect(queries.list).toHaveBeenCalledTimes(4)
  hook.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('lets a slow polling read finish before scheduling another refresh', async () => {
  vi.useFakeTimers()
  const slow = deferred<AntfarmRunSummary[]>()
  const activeRow: AntfarmRunSummary = { ...row, status: 'running' }
  let signal: AbortSignal | undefined
  let reads = 0
  const queries: AntfarmQueries = {
    list: vi.fn((_sessionId, lifetime) => { if (reads++ === 1) { signal = lifetime; return slow.promise }; return Promise.resolve([activeRow]) }),
    status: async () => detail,
  }
  const hook = renderHook(() => useAntfarmRuns(owner, true, queries, 2000))
  await act(async () => { await Promise.resolve() })
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
  expect(queries.list).toHaveBeenCalledTimes(2)
  expect(signal?.aborted).toBe(false)
  await act(async () => { slow.resolve([activeRow]); await slow.promise })
  await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
  expect(queries.list).toHaveBeenCalledTimes(3)
  hook.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('cancels an obsolete selected-run read and ignores its result', async () => {
  const old = deferred<AntfarmStatus>()
  const nextRow = { ...row, runId: 'af-next' }
  const nextDetail = { ...detail, summary: nextRow }
  let signal: AbortSignal | undefined
  const queries: AntfarmQueries = {
    list: async () => [row, nextRow],
    status: (runId, _sessionId, lifetime) => { if (runId === row.runId) { signal = lifetime; return old.promise }; return Promise.resolve(nextDetail) },
  }
  const hook = renderHook(() => useAntfarmRuns(owner, true, queries, 2000))
  act(() => { hook.result.current.select(row.runId) })
  act(() => { hook.result.current.select(nextRow.runId) })
  await waitFor(() => { expect(hook.result.current.detail).toEqual(nextDetail) })
  expect(signal?.aborted).toBe(true)
  await act(async () => { old.resolve(detail); await old.promise })
  expect(hook.result.current.detail).toEqual(nextDetail)
})

function mountFixture(failBody = false) {
  const ctx = new Context()
  const events: string[] = []
  const count = { dictionaries: 0, tabs: 0, bodies: 0, remotes: 0, overlays: 0, boards: 0, launchers: 0 }
  const release = (name: keyof typeof count) => { count[name]++; return () => { count[name]--; events.push(`release:${name}`) } }
  ctx.provide('remote', {
    $mount: async () => { events.push('mount:remote'); return release('remotes') },
    antfarmStudio: { list: async () => ({ ok: true, value: [] }), status: async () => ({ ok: true, value: detail }) },
  })
  ctx.provide('remote.antfarmStudio', {})
  ctx.provide('locale', { register: () => release('dictionaries'), bind: () => (key: keyof typeof en) => en[key] })
  ctx.provide('sidebarRightTabs', { register: () => { events.push('mount:tab'); return release('tabs') } })
  ctx.provide('slots', {
    inject: (_name: string, register: () => () => void) => register(),
    register: (entry: { name: string }) => { if (entry.name === 'shell.overlay') return release('overlays'); if (entry.name === 'main') return release('boards'); if (entry.name === 'sidebar.panellist') return release('launchers'); if (failBody) throw new Error('body registration failed'); events.push('mount:body'); return release('bodies') },
  })
  return { ctx, count, events }
}

it('mounts the Remote before readers and withdraws the complete sidebar', async () => {
  const fixture = mountFixture()
  const dispose = await mountAntfarm(fixture.ctx, { package: '@winterhuan/dsh-antfarm', descriptors: [] }, Config({ refreshIntervalMs: 2000 }))
  try {
    expect(fixture.events.slice(0, 3)).toEqual(['mount:remote', 'mount:tab', 'mount:body'])
    expect(fixture.count).toEqual({ dictionaries: 1, tabs: 1, bodies: 1, remotes: 1, overlays: 1, boards: 1, launchers: 1 })
  } finally { await dispose() }
  expect(fixture.count).toEqual({ dictionaries: 0, tabs: 0, bodies: 0, remotes: 0, overlays: 0, boards: 0, launchers: 0 })
  expect(fixture.events.at(-1)).toBe('release:remotes')
})

it('rolls back registered UI and the Remote when sidebar mounting fails', async () => {
  const fixture = mountFixture(true)
  await expect(mountAntfarm(fixture.ctx, { package: '@winterhuan/dsh-antfarm', descriptors: [] }, Config({ refreshIntervalMs: 2000 }))).rejects.toThrow('body registration failed')
  expect(fixture.count).toEqual({ dictionaries: 0, tabs: 0, bodies: 0, remotes: 0, overlays: 0, boards: 0, launchers: 0 })
  expect(fixture.events.at(-1)).toBe('release:remotes')
})
