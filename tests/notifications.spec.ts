import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { RunJournal } from '../src/persistence/journal.ts'
import { loadWorkflow } from '../src/workflow/loader.ts'
import { deliverOutcome, deliverWebhook } from '../src/runtime/notifications.ts'
import { publicWebhookUrl } from '../src/workflow/notifications.ts'

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'antfarm-notifications-')))
  onTestFinished(async () => { vi.unstubAllGlobals(); vi.useRealTimers(); await rm(root, { recursive: true, force: true }) })
  const workflow = await loadWorkflow('smoke', [join(import.meta.dirname, '../workflows')])
  const journal = await RunJournal.create(root, { runId: 'af-notice', ownerSessionId: 'owner', workflowId: 'smoke', task: 'Notify', baseCwd: root, workspace: join(root, 'workspace'), branch: 'antfarm/af-notice', baseRevision: 'a'.repeat(40), provider: 'spawn', resolvedWorkflowSnapshot: workflow })
  await journal.append({ type: 'run-end', data: { status: 'failed', reason: 'repair budget exhausted' } })
  return journal
}

describe('durable notification results', () => {
  it('deduplicates confirmed owner delivery by business transition after diagnostic writes', async () => {
    const journal = await fixture()
    const send = vi.fn()
    const parent = { id: SessionId('owner'), send } as Agent
    const flush = vi.fn(async () => true)
    await deliverOutcome(journal, parent, '', undefined, new AbortController().signal, flush)
    await journal.append({ type: 'health', data: { kind: 'retained', detail: 'inspect' } })
    await deliverOutcome(journal, parent, '', undefined, new AbortController().signal, flush)
    expect(send).toHaveBeenCalledTimes(1)
    expect(flush).toHaveBeenCalledTimes(1)
    expect(journal.state.status).toBe('failed')
  })

  it('bounds a webhook wait at five seconds and retains uncertainty without storing secrets', async () => {
    const journal = await fixture()
    vi.useFakeTimers()
    vi.stubGlobal('fetch', (_url: string, options: RequestInit) => new Promise((_resolve, reject) => { options.signal?.addEventListener('abort', () => reject(new Error('credential must not be logged: secret-value')), { once: true }) }))
    const delivery = deliverWebhook(journal, 'stable-event', 'run.failed', 'repair budget exhausted', 'https://example.test/hooks', 'secret-value', new AbortController().signal)
    // Journal fsync completes before fetch starts, so synchronize on the persisted pending notice.
    await vi.waitFor(() => { expect(journal.latest('notification')?.data).toMatchObject({ status: 'pending' }) })
    await vi.advanceTimersByTimeAsync(5000)
    await delivery
    expect(journal.latest('notification')?.data).toMatchObject({ status: 'failed' })
    expect(await readFile(journal.eventsPath, 'utf8')).not.toContain('secret-value')
    expect(journal.state.status).toBe('failed')
  })

  it('refuses credentials and fragments in public workflow subscriptions', () => {
    expect(publicWebhookUrl('https://example.test/hooks')).toBe('https://example.test/hooks')
    for (const url of ['https://example.test/hooks#auth=secret', 'https://user:secret@example.test/', 'https://example.test/?token=secret']) expect(() => publicWebhookUrl(url)).toThrow('credentials')
  })
})
