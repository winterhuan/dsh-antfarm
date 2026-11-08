/** Original workflow events are best-effort webhooks; SQL acceptance does not depend on delivery. */
import type { WorkflowEvent } from '../persistence/database.ts'
import { publicWebhookUrl } from '../workflow/notifications.ts'

/** Own all HTTP requests until they settle or the host stops. */
export class WorkflowNotifications {
  private readonly controller = new AbortController()
  private readonly pending = new Set<Promise<void>>()
  /** @param timeoutMs - Request deadline. @param token - Optional deployment credential. */
  constructor(
    private readonly timeoutMs: number,
    private readonly token?: string,
  ) {}

  /** @param event - Committed original event. @param endpoint - Explicit workflow/run subscription. */
  send(event: WorkflowEvent, endpoint: string | null): void {
    if (!endpoint || this.controller.signal.aborted) return
    const url = publicWebhookUrl(endpoint)
    const request = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: this.token } : {}) },
      body: JSON.stringify(event),
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(this.timeoutMs)]),
    })
      .then(async (response) => {
        await response.body?.cancel()
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
      })
      .catch((error) => {
        if (!this.controller.signal.aborted)
          console.error('Antfarm webhook delivery failed:', error instanceof Error ? error.name : 'request failure')
      })
      .finally(() => {
        this.pending.delete(request)
      })
    this.pending.add(request)
  }

  /** Abort pending requests and wait for all request callbacks. */
  async dispose(): Promise<void> {
    this.controller.abort()
    await Promise.allSettled(this.pending)
  }
}
