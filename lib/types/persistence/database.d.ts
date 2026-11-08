/** Authoritative Antfarm rows and atomic worker transitions. Derived from snarktank/antfarm; see NOTICE. */
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import type { ResolvedWorkflow } from '../workflow/types.ts';
/** Original run row. */
declare const runRowSchema: z.ZodObject<{
    id: z.ZodString;
    workflow_id: z.ZodString;
    task: z.ZodString;
    status: z.ZodString;
    context: z.ZodString;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    notify_url: z.ZodNullable<z.ZodString>;
    run_number: z.ZodNumber;
}, z.core.$strip>;
export type RunRow = z.infer<typeof runRowSchema>;
/** Original step row. */
declare const stepRowSchema: z.ZodObject<{
    id: z.ZodString;
    run_id: z.ZodString;
    step_id: z.ZodString;
    agent_id: z.ZodString;
    step_index: z.ZodNumber;
    input_template: z.ZodString;
    expects: z.ZodString;
    status: z.ZodEnum<{
        pending: "pending";
        running: "running";
        done: "done";
        failed: "failed";
        waiting: "waiting";
        skipped: "skipped";
    }>;
    output: z.ZodNullable<z.ZodString>;
    retry_count: z.ZodNumber;
    max_retries: z.ZodNumber;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    type: z.ZodString;
    loop_config: z.ZodNullable<z.ZodString>;
    current_story_id: z.ZodNullable<z.ZodString>;
    abandoned_count: z.ZodNumber;
}, z.core.$strip>;
export type StepRow = z.infer<typeof stepRowSchema>;
/** Original story row. */
declare const storyRowSchema: z.ZodObject<{
    id: z.ZodString;
    run_id: z.ZodString;
    story_index: z.ZodNumber;
    story_id: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    acceptance_criteria: z.ZodString;
    status: z.ZodEnum<{
        pending: "pending";
        running: "running";
        done: "done";
        failed: "failed";
    }>;
    output: z.ZodNullable<z.ZodString>;
    retry_count: z.ZodNumber;
    max_retries: z.ZodNumber;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, z.core.$strip>;
export type StoryRow = z.infer<typeof storyRowSchema>;
/** DSH association; workflow progress remains in the original tables. */
declare const runBindingSchema: z.ZodObject<{
    run_id: z.ZodString;
    owner: z.ZodString;
    cwd: z.ZodString;
    workflow: z.ZodString;
    request_id: z.ZodNullable<z.ZodString>;
    revision: z.ZodNumber;
    paused: z.ZodNumber;
    reason: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type RunBinding = z.infer<typeof runBindingSchema>;
/** Native execution identity used to reject duplicate or late results. */
declare const attemptRowSchema: z.ZodObject<{
    session_id: z.ZodString;
    run_id: z.ZodString;
    step_id: z.ZodString;
    agent_id: z.ZodString;
    pid: z.ZodNumber;
    state: z.ZodString;
    started_at: z.ZodString;
    finished_at: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
export type AttemptRow = z.infer<typeof attemptRowSchema>;
/** Original observation event. */
export interface WorkflowEvent {
    ts: string;
    event: string;
    runId: string;
    workflowId?: string | undefined;
    stepId?: string | undefined;
    agentId?: string | undefined;
    storyId?: string | undefined;
    storyTitle?: string | undefined;
    detail?: string | undefined;
}
/** Claimed input and the native Session reserved for it. */
export interface ClaimedStep {
    step: StepRow;
    sessionId: string;
    input: string;
}
/** @param output - Original KEY: value response. @returns Lowercase context entries. */
export declare function parseOutputKeyValues(output: string): Record<string, string>;
/** @param template - Original input. @param context - Run facts. @returns Input with case-insensitive placeholders. */
export declare function resolveTemplate(template: string, context: Readonly<Record<string, string>>): string;
/** One database connection; each multi-row transition commits as a unit. */
export declare class AntfarmDatabase {
    private readonly onEvent?;
    readonly db: DatabaseSync;
    private readonly eventPath;
    private pendingEvents;
    private hostToken;
    /** @param path - antfarm.db path, distinct from historical journal directories. */
    constructor(path: string, onEvent?: ((event: WorkflowEvent, endpoint: string | null) => void) | undefined);
    /** Acquire the exclusive native dispatcher; original business rows remain accessible to readers. */
    acquireHost(): void;
    /** Close after all native attempts have settled. */
    dispose(): void;
    /** @param work - Synchronous SQL operation. @returns Its committed value. */
    transaction<T>(work: () => T): T;
    private writeEvent;
    private event;
    private touch;
    /** @param id - Run identity. @returns Original run row. */
    run(id: string): RunRow;
    /** @param id - Run identity. @returns Native owner association. */
    binding(id: string): RunBinding;
    /** @param runId - Run identity. @returns Ordered original steps. */
    steps(runId: string): StepRow[];
    /** @param runId - Run identity. @returns Ordered original stories. */
    stories(runId: string): StoryRow[];
    /** @param owner - Optional owning Session. @returns Newest runs associated with DSH. */
    list(owner?: string): RunRow[];
    /** @param runId - Run identity. @returns Native execution history. */
    attempts(runId: string): AttemptRow[];
    /** @param workflow - Original definition. @param task - User request. @param owner - Native root Session. @param cwd - Project directory. @param requestId - Idempotent admission key. @param notifyUrl - Explicit webhook. @returns Stored run id. */
    start(workflow: ResolvedWorkflow, task: string, owner: string, cwd: string, requestId?: string, notifyUrl?: string): string;
    /** @param agentId - Workflow-qualified identity. @returns Original inexpensive work indicator. */
    peek(agentId: string): 'HAS_WORK' | 'NO_WORK';
    /** @param runId - Scheduled run. @param progress - Agent progress text. @param frontend - Original frontend detection. @returns Exclusive ready attempt, if any. */
    claim(runId: string, progress?: string, frontend?: string): ClaimedStep | undefined;
    private active;
    private settle;
    /** @param sessionId - Exact claimant. @param output - Original worker text. @returns Whether this completion was current. */
    complete(sessionId: string, output: string): boolean;
    private insertStories;
    private continueLoop;
    private advance;
    private failRun;
    /** @param sessionId - Exact claimant. @param error - Failure text. @returns Whether a current attempt failed. */
    fail(sessionId: string, error: string): boolean;
    /** @param sessionId - Timed-out claimant whose child has stopped. @returns Whether its original abandonment budget changed. */
    abandon(sessionId: string): boolean;
    /** @param runId - Stopped execution. @param reason - Native interruption. */
    pause(runId: string, reason: string): void;
    /** @param runId - Cancelled run. */
    cancel(runId: string): void;
    /** @param runId - Failed or interrupted run. @param guidance - User recovery input. */
    resume(runId: string, guidance?: string): void;
    /** @param runId - Observed run. @returns Events in append order. */
    events(runId: string): WorkflowEvent[];
}
export {};
//# sourceMappingURL=database.d.ts.map