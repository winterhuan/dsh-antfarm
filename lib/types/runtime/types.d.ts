/** Run projections shared with the browser and Host initiation requests. */
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { JobId } from '@deepseek-ai/dsh-jobs';
/** Start from the exact live parent; omission uses the configured workflow. */
export interface AntfarmStartRequest {
    readonly task: string;
    readonly parent: Agent;
    readonly workflowId?: string;
    readonly requestId?: string;
    readonly notificationUrl?: string;
    readonly signal?: AbortSignal;
}
/** Explicit continuation by the original owning session. */
export interface AntfarmResumeRequest {
    readonly runId: string;
    readonly parent: Agent;
    readonly guidance?: string;
    readonly revision?: number;
    readonly signal?: AbortSignal;
}
/** Receipt returned after both durable start and job acceptance. */
export interface AntfarmRunReceipt {
    readonly runId: string;
    readonly jobId?: JobId;
    readonly workflowId: string;
    readonly status: 'queued' | 'starting' | 'running' | 'interrupted' | 'blocked' | 'completed' | 'failed' | 'cancelled';
    readonly workspace: string;
    readonly branch: string;
}
//# sourceMappingURL=types.d.ts.map