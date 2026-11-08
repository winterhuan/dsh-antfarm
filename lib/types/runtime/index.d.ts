import { Context, Service } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionId } from '@deepseek-ai/dsh-session';
import z from '@deepseek-ai/schemastery';
import { RunJournal } from '../persistence/journal.ts';
import { type WorkflowDraft } from '../workflow/manager.ts';
import type { AntfarmArtifactContent, AntfarmEventSummary, AntfarmHealthHistory, AntfarmHealthReport, AntfarmRunSummary, AntfarmStatus } from '../types.ts';
import type { AntfarmResumeRequest, AntfarmRunReceipt, AntfarmStartRequest } from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        antfarm: AntfarmRuntime;
    }
}
declare module '@deepseek-ai/dsh-jobs' {
    interface JobKindMap {
        antfarm: 'antfarm';
    }
}
/** Owner-scoped admission and lifecycle around durable workflow drivers. */
export declare class AntfarmRuntime extends Service {
    private readonly config;
    static inject: string[];
    static Config: z<Schemastery.ObjectS<NoInfer<{
        journalRoot: z<string, string, "defined">;
        workflowDirs: z<string[], string[], "defined">;
        defaultWorkflowId: z<string, string, "volatile-defined">;
        worktreeDirectory: z<string, string, "defined">;
        defaultStepTimeoutSeconds: z<number, number, "volatile-defined">;
        subagentProvider: z<string, string, "defined">;
        maxActiveRunsPerOwner: z<number, number, "defined">;
        maxActiveRuns: z<number, number, "defined">;
        maxAttempts: z<number, number, "volatile-defined">;
        maxStories: z<number, number, "volatile-defined">;
        maxStoryRetries: z<number, number, "volatile-defined">;
        maxSummaryChars: z<number, number, "volatile-defined">;
        cleanupCompletedWorktrees: z<boolean, boolean, "volatile-defined">;
        cleanupCancelledWorktrees: z<boolean, boolean, "volatile-defined">;
        healthEnabled: z<boolean, boolean, "volatile-defined">;
        healthIntervalMs: z<number, number, "volatile-defined">;
        notifyOwner: z<boolean, boolean, "volatile-defined">;
        webhookUrl: z<string, string, "volatile-defined">;
        webhookTokenEnv: z<string, string, "volatile-defined">;
        githubReviewerTokenEnv: z<string, string, "volatile-defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        journalRoot: z<string, string, "defined">;
        workflowDirs: z<string[], string[], "defined">;
        defaultWorkflowId: z<string, string, "volatile-defined">;
        worktreeDirectory: z<string, string, "defined">;
        defaultStepTimeoutSeconds: z<number, number, "volatile-defined">;
        subagentProvider: z<string, string, "defined">;
        maxActiveRunsPerOwner: z<number, number, "defined">;
        maxActiveRuns: z<number, number, "defined">;
        maxAttempts: z<number, number, "volatile-defined">;
        maxStories: z<number, number, "volatile-defined">;
        maxStoryRetries: z<number, number, "volatile-defined">;
        maxSummaryChars: z<number, number, "volatile-defined">;
        cleanupCompletedWorktrees: z<boolean, boolean, "volatile-defined">;
        cleanupCancelledWorktrees: z<boolean, boolean, "volatile-defined">;
        healthEnabled: z<boolean, boolean, "volatile-defined">;
        healthIntervalMs: z<number, number, "volatile-defined">;
        notifyOwner: z<boolean, boolean, "volatile-defined">;
        webhookUrl: z<string, string, "volatile-defined">;
        webhookTokenEnv: z<string, string, "volatile-defined">;
        githubReviewerTokenEnv: z<string, string, "volatile-defined">;
    }>>, "plain">;
    private readonly admissions;
    private readonly operations;
    private closing;
    private storage;
    private nextNumber;
    private readonly evidence;
    private readonly capacity;
    private readonly owners;
    private readonly workflows;
    private healthTimer;
    private healthWork;
    private readonly healthChecks;
    private readonly healthController;
    constructor(ctx: Context, config: Config);
    /** Acquire Host ownership, rebuild projections, and recover safe persisted work. */
    [Service.init](): Promise<void>;
    private scheduleHealth;
    /**
     * Inspect and persist health diagnostics without accepting work.
     * @param owner - Authorized Session scope, or internal Host scope.
     * @returns Persisted health facts without inferring acceptance.
     */
    checkHealth(owner?: SessionId): Promise<AntfarmHealthReport>;
    private inspectHealth;
    /**
     * Read bounded health history and current monitoring settings.
     * @param owner - Explicit authorized scope.
     * @returns Retained checks and current native settings.
     */
    healthHistory(owner: SessionId): Promise<AntfarmHealthHistory>;
    /**
     * Dispatch safe inactive work through the existing executor.
     * @param owner - Explicit authorization scope.
     * @returns Runs dispatched by the existing sole executor.
     */
    ensureExecution(owner: SessionId): Promise<string[]>;
    /**
     * Rebuild the disposable index from disk after startup or explicit repair.
     * @returns Supported journals available for recovery.
     */
    rebuildIndex(): Promise<RunJournal[]>;
    private policy;
    private indexFailure;
    private project;
    /** Last derived-index error; business evidence remains authoritative. */
    get indexError(): string | undefined;
    /**
     * Restore the original root Session authority without a model turn.
     * @param owner - Original root Session.
     * @returns Native authority without a model turn.
     */
    resolveOwner(owner: SessionId): Promise<Agent>;
    private observedWorkflowRoots;
    /**
     * Discover workflows for a selected Session without activating its owner.
     * @param owner - Selected Session.
     * @returns Workflow catalog without resuming a model owner.
     */
    workflowCatalog(owner: SessionId): Promise<string[]>;
    /**
     * Read revision-bound workflow resources for a selected Session.
     * @param owner - Selected Session.
     * @param id - Workflow.
     * @returns Editable source without owner activation.
     */
    workflowDraft(owner: SessionId, id: string): Promise<WorkflowDraft>;
    private workflowRoots;
    /**
     * List available workflows under the live owner’s configuration.
     * @param parent - Authorized root.
     * @returns Installed and packaged workflow ids.
     */
    listWorkflows(parent: Agent): Promise<string[]>;
    /**
     * Read editable workflow resources under the live owner’s configuration.
     * @param parent - Authorized root.
     * @param id - Workflow id.
     * @returns Editable resolved copy.
     */
    readWorkflow(parent: Agent, id: string): Promise<WorkflowDraft>;
    /**
     * Validate and atomically save a revision-bound workflow copy.
     * @param parent - Authorized root.
     * @param value - Revision-bound copy.
     * @param scope - Destination.
     * @returns Saved copy.
     */
    saveWorkflow(parent: Agent, value: WorkflowDraft, scope: 'project' | 'profile'): Promise<WorkflowDraft>;
    /**
     * Import confined original Antfarm resources into a project copy.
     * @param parent - Authorized root.
     * @param directory - Original workflow.
     * @param sourceRoot - Shared-resource root.
     * @param workspace - Git or owned file workspace for the imported workflow.
     * @returns Installed project copy.
     */
    importWorkflow(parent: Agent, directory: string, sourceRoot: string, workspace?: 'git' | 'files'): Promise<WorkflowDraft>;
    /**
     * Remove a matching writable override after checking active dependencies.
     * @param parent - Authorized root.
     * @param id - Workflow.
     * @param revision - Current copy.
     * @param scope - Override root.
     */
    removeWorkflow(parent: Agent, id: string, revision: string, scope: 'project' | 'profile'): Promise<void>;
    /**
     * Change workflow availability after checking revision and active dependencies.
     * @param parent - Root owner.
     * @param id - Workflow id or all.
     * @param enabled - Install or disable.
     * @param force - Cancel this owner's active Runs first.
     * @param expected - Source revision and enabled state required by the caller.
     */
    setWorkflowEnabled(parent: Agent, id: string, enabled: boolean, force?: boolean, expected?: WorkflowDraft): Promise<void>;
    /**
     * Create an independent project workflow from a matching source revision.
     * @param parent - Root owner.
     * @param source - Revision-bound source.
     * @param newId - New id.
     * @returns Validated project copy.
     */
    copyWorkflow(parent: Agent, source: WorkflowDraft, newId: string): Promise<WorkflowDraft>;
    private live;
    private admit;
    private reserve;
    private release;
    private provider;
    /**
     * Start in an owned worktree after reserving owner capacity and persisting identity.
     * @param request - Task and exact live initiating Agent.
     * @returns Receipt after journal and native job acceptance.
     */
    start(request: AntfarmStartRequest): Promise<AntfarmRunReceipt>;
    private startNew;
    /**
     * Resume from the saved workflow; uncertain attempts require explicit reconciliation guidance.
     * @param request - Original run, live owner and any reconciliation guidance.
     * @returns Receipt for the resumed native job.
     */
    resume(request: AntfarmResumeRequest): Promise<AntfarmRunReceipt>;
    private interrupted;
    private launch;
    /**
     * Wait for this Run's whole execution interval and final workspace disposition.
     * @param runId - Owned Run, including a queued execution.
     * @param owner - Session authorizing the wait.
     * @param signal - Optional caller wait cancellation; omission waits until settlement.
     * @returns Completed, failed, cancelled, blocked or interrupted business state.
     */
    wait(runId: string, owner: SessionId, signal?: AbortSignal): Promise<AntfarmStatus>;
    private summary;
    private owned;
    private worktree;
    /**
     * Read up to fifty recent runs attributed to the selected session, including terminal evidence.
     * @param owner - Session authorizing the listing.
     * @returns Recent owner-attributed run summaries.
     */
    list(owner: SessionId): Promise<AntfarmRunSummary[]>;
    /**
     * Read a bounded page of Runs authorized by explicit Session resources.
     * @param owners - Explicit authorized resources.
     * @param offset - Number of newer rows already read.
     * @returns Bounded indexed page.
     */
    page(owners: readonly SessionId[], offset: number): Promise<AntfarmRunSummary[]>;
    /**
     * Inspect accepted context and durable native child identities under session ownership.
     * @param runId - Durable run identity.
     * @param owner - Session authorizing inspection.
     * @returns Accepted state and any uncertain child attempt.
     */
    status(runId: string, owner: SessionId): Promise<AntfarmStatus>;
    /**
     * Resolve a unique owned Run by id, number, prefix or task text.
     * @param query - Exact id, stable number, id prefix or task text.
     * @param owner - Authorized owner.
     * @returns Unique run id.
     */
    find(query: string, owner: SessionId): Promise<string>;
    /**
     * Read bounded committed events after an exclusive sequence cursor.
     * @param runId - Owned Run.
     * @param owner - Authorization resource.
     * @param after - Exclusive cursor.
     * @returns Up to fifty bounded facts.
     */
    events(runId: string, owner: SessionId, after: number): Promise<AntfarmEventSummary[]>;
    /**
     * Read a verified UTF-8 preview of a retained artifact.
     * @param runId - Owned Run.
     * @param owner - Authorization resource.
     * @param sha256 - Retained artifact.
     * @returns Bounded UTF-8 output text.
     */
    artifact(runId: string, owner: SessionId, sha256: string): Promise<string>;
    /**
     * Read digest-verified retained bytes for download.
     * @param runId - Owned Run.
     * @param owner - Authorization resource.
     * @param sha256 - Retained digest.
     * @returns Verified output up to sixteen MiB.
     */
    artifactContent(runId: string, owner: SessionId, sha256: string): Promise<AntfarmArtifactContent>;
    /**
     * Cancel and await the active driver, or settle inactive owned evidence under a writer lease.
     * @param runId - Run to settle.
     * @param owner - Session authorizing cancellation.
     * @param reason - Diagnostic recorded in durable evidence.
     * @param revision - Optional expected journal revision; stale operations are refused.
     * @returns Summary after cancellation and active teardown.
     */
    cancel(runId: string, owner: SessionId, reason?: string, revision?: number): Promise<AntfarmRunSummary>;
    /**
     * Remove only an inactive, identity-validated, clean worktree; retain its branch.
     * @param runId - Settled run whose workspace was reviewed.
     * @param owner - Session authorizing cleanup.
     * @param revision - Optional expected journal revision; stale operations are refused.
     * @returns Updated workspace disposition and retention reason.
     */
    cleanup(runId: string, owner: SessionId, revision?: number): Promise<AntfarmRunSummary>;
}
/** Parsed Host settings; volatile defaults are captured once per Run. */
export type Config = ReturnType<typeof AntfarmRuntime.Config>;
export type { AntfarmResumeRequest, AntfarmRunReceipt, AntfarmStartRequest } from './types.ts';
export default AntfarmRuntime;
//# sourceMappingURL=index.d.ts.map