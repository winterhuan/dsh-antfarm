/** Original workflow events are best-effort webhooks; SQL acceptance does not depend on delivery. */
import type { WorkflowEvent } from '../persistence/database.ts';
/** Own all HTTP requests until they settle or the host stops. */
export declare class WorkflowNotifications {
    private readonly timeoutMs;
    private readonly token?;
    private readonly controller;
    private readonly pending;
    /** @param timeoutMs - Request deadline. @param token - Optional deployment credential. */
    constructor(timeoutMs: number, token?: string | undefined);
    /** @param event - Committed original event. @param endpoint - Explicit workflow/run subscription. */
    send(event: WorkflowEvent, endpoint: string | null): void;
    /** Abort pending requests and wait for all request callbacks. */
    dispose(): Promise<void>;
}
//# sourceMappingURL=notifications.d.ts.map