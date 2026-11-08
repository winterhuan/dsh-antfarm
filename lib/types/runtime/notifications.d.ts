/** Explicit owner and webhook delivery, recorded independently of business acceptance. */
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type ContextFormed } from '@deepseek-ai/dsh-llm';
import type { RunJournal } from '../persistence/journal.ts';
declare module '@deepseek-ai/dsh-llm' {
    interface MessageSourceMap {
        /** Durable Antfarm outcome notice for its original root owner. */
        antfarm: {
            readonly kind: 'antfarm';
            readonly runId: string;
            readonly noticeId: string;
        } & ContextFormed;
    }
}
/** @param journal - Sole writer. @param parent - Exact native owner. @param webhookUrl - Explicit subscription; never persisted. @param token - Optional native credential value; never persisted. @param signal - Host lifetime. */
export declare function deliverOutcome(journal: RunJournal, parent: Agent, webhookUrl: string, token: string | undefined, signal: AbortSignal, flush: () => Promise<boolean>): Promise<void>;
/** @param journal - Sole writer. @param parent - Authorized recipient. @param id - Stable transition identity. @param text - Public notice. @param signal - Delivery lifetime. @param flush - Native persistence confirmation. */
export declare function deliverOwnerNotice(journal: RunJournal, parent: Agent, id: string, text: string, signal: AbortSignal, flush: () => Promise<boolean>): Promise<void>;
/** @param journal - Sole writer. @param id - Stable event identity. @param event - Lifecycle kind. @param detail - Bounded public facts. @param url - Explicit subscription, never logged. @param token - Native secret, never logged. @param signal - Delivery lifetime. */
export declare function deliverWebhook(journal: RunJournal, id: string, event: string, detail: string, url: string, token: string | undefined, signal: AbortSignal): Promise<void>;
//# sourceMappingURL=notifications.d.ts.map