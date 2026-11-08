import { publicWebhookUrl } from "../workflow/notifications.js";
/** Own all HTTP requests until they settle or the host stops. */
export class WorkflowNotifications {
    timeoutMs;
    token;
    controller = new AbortController();
    pending = new Set();
    /** @param timeoutMs - Request deadline. @param token - Optional deployment credential. */
    constructor(timeoutMs, token) {
        this.timeoutMs = timeoutMs;
        this.token = token;
    }
    /** @param event - Committed original event. @param endpoint - Explicit workflow/run subscription. */
    send(event, endpoint) {
        if (!endpoint || this.controller.signal.aborted)
            return;
        const url = publicWebhookUrl(endpoint);
        const request = fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: this.token } : {}) },
            body: JSON.stringify(event),
            signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(this.timeoutMs)]),
        })
            .then(async (response) => {
            await response.body?.cancel();
            if (!response.ok)
                throw new Error(`HTTP ${response.status}`);
        })
            .catch((error) => {
            if (!this.controller.signal.aborted)
                console.error('Antfarm webhook delivery failed:', error instanceof Error ? error.name : 'request failure');
        })
            .finally(() => {
            this.pending.delete(request);
        });
        this.pending.add(request);
    }
    /** Abort pending requests and wait for all request callbacks. */
    async dispose() {
        this.controller.abort();
        await Promise.allSettled(this.pending);
    }
}
//# sourceMappingURL=notifications.js.map