/** Explicit owner and webhook delivery, recorded independently of business acceptance. */
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage, type ContextFormed } from '@deepseek-ai/dsh-llm'
import type { RunJournal } from '../persistence/journal.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** Durable Antfarm outcome notice for its original root owner. */
    antfarm: { readonly kind: 'antfarm'; readonly runId: string; readonly noticeId: string } & ContextFormed
  }
}

/** @param journal - Sole writer. @param parent - Exact native owner. @param webhookUrl - Explicit subscription; never persisted. @param token - Optional native credential value; never persisted. @param signal - Host lifetime. */
export async function deliverOutcome(journal: RunJournal, parent: Agent, webhookUrl: string, token: string | undefined, signal: AbortSignal, flush: () => Promise<boolean>): Promise<void> {
  const state = journal.state
  const transition = journal.latest(state.status === 'blocked' ? 'checkpoint' : state.status === 'interrupted' ? 'run-interrupt' : 'run-end')
  const id = `${state.start.runId}:${transition?.seq ?? 0}:${state.status}:${parent.id}`
  const text = `Antfarm ${state.start.runId} [${state.status}]: ${(state.checkpoint.blocked ?? state.workspaceReason) || 'Workflow accepted'}. Inspect the Antfarm run for results and next actions.`
  await deliverOwnerNotice(journal, parent, id, text, signal, flush)
  await deliverWebhook(journal, id, `run.${state.status}`, text, webhookUrl, token, signal)
}

/** @param journal - Sole writer. @param parent - Authorized recipient. @param id - Stable transition identity. @param text - Public notice. @param signal - Delivery lifetime. @param flush - Native persistence confirmation. */
export async function deliverOwnerNotice(journal: RunJournal, parent: Agent, id: string, text: string, signal: AbortSignal, flush: () => Promise<boolean>): Promise<void> {
  if (journal.delivered(id, 'owner')) return
  const state = journal.state
  const message = createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'antfarm', runId: state.start.runId, noticeId: id, form: 'notice', summary: `Antfarm ${state.status}` } })
  await journal.append({ type: 'notification', data: { id, channel: 'owner', status: 'pending', detail: 'outcome notice' } })
  try {
    signal.throwIfAborted()
    parent.send(message, 'next-step', false)
    if (!await flush()) throw new Error('native Session has no participating persistence listener')
    await journal.append({ type: 'notification', data: { id, channel: 'owner', status: 'delivered', detail: 'native owner inbox accepted the notice' } })
  } catch {
    await journal.append({ type: 'notification', data: { id, channel: 'owner', status: 'failed', detail: 'owner notice could not be confirmed; inspect the Run history' } })
  }
}

/** @param journal - Sole writer. @param id - Stable event identity. @param event - Lifecycle kind. @param detail - Bounded public facts. @param url - Explicit subscription, never logged. @param token - Native secret, never logged. @param signal - Delivery lifetime. */
export async function deliverWebhook(journal: RunJournal, id: string, event: string, detail: string, url: string, token: string | undefined, signal: AbortSignal): Promise<void> {
  if (url === '' || journal.delivered(id, 'webhook')) return
  const state = journal.state
  await journal.append({ type: 'notification', data: { id, channel: 'webhook', status: 'pending', detail: 'explicit outcome subscription' } })
  const deadline = new AbortController()
  const timer = setTimeout(() => deadline.abort(), 5000)
  try {
    const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { 'content-type': 'application/json', ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) }, body: JSON.stringify({ id, event, runId: state.start.runId, workflowId: state.start.workflowId, status: state.status, detail: detail.slice(0, 2048) }), signal: AbortSignal.any([signal, deadline.signal]) })
    await response.body?.cancel()
    if (!response.ok) throw new Error('webhook rejected')
    await journal.append({ type: 'notification', data: { id, channel: 'webhook', status: 'delivered', detail: 'subscription accepted the event' } })
  } catch {
    await journal.append({ type: 'notification', data: { id, channel: 'webhook', status: 'failed', detail: 'delivery was not confirmed; remote delivery may have occurred' } })
  } finally { clearTimeout(timer) }
}
