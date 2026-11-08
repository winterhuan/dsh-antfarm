import { Context, Service } from '@deepseek-ai/cordis';
import type { Agent } from '@deepseek-ai/dsh-agent';
import { type SessionId } from '@deepseek-ai/dsh-session';
import z from '@deepseek-ai/schemastery';
import { type WorkflowDraft } from '../workflow/manager.ts';
import type { AntfarmEventSummary, AntfarmHealthHistory, AntfarmHealthReport, AntfarmRunSummary, AntfarmStatus } from '../types.ts';
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
/** Owns native execution; workflow state is read directly from SQLite. */
export declare class AntfarmRuntime extends Service {
    private readonly config;
    static inject: string[];
    static Config: z<Schemastery.ObjectS<NoInfer<{
        journalRoot: z<string, string, "defined">;
        workflowDirs: z<string[], string[], "defined">;
        defaultWorkflowId: z<string, string, "volatile-defined">;
        subagentProvider: z<string, string, "defined">;
        maxActiveRunsPerOwner: z<number, number, "defined">;
        maxActiveRuns: z<number, number, "defined">;
        dispatchIntervalMs: z<number, number, "defined">;
        gitTimeoutMs: z<number, number, "defined">;
        subprocessGraceMs: z<number, number, "defined">;
        webhookTimeoutMs: z<number, number, "defined">;
        webhookTokenEnv: z<string, string, "plain">;
        healthEnabled: z<boolean, boolean, "volatile-defined">;
        healthIntervalMs: z<number, number, "volatile-defined">;
    }>>, Schemastery.ObjectT<NoInfer<{
        journalRoot: z<string, string, "defined">;
        workflowDirs: z<string[], string[], "defined">;
        defaultWorkflowId: z<string, string, "volatile-defined">;
        subagentProvider: z<string, string, "defined">;
        maxActiveRunsPerOwner: z<number, number, "defined">;
        maxActiveRuns: z<number, number, "defined">;
        dispatchIntervalMs: z<number, number, "defined">;
        gitTimeoutMs: z<number, number, "defined">;
        subprocessGraceMs: z<number, number, "defined">;
        webhookTimeoutMs: z<number, number, "defined">;
        webhookTokenEnv: z<string, string, "plain">;
        healthEnabled: z<boolean, boolean, "volatile-defined">;
        healthIntervalMs: z<number, number, "volatile-defined">;
    }>>, "plain">;
    private database;
    private readonly legacy;
    private readonly notifications;
    private readonly operations;
    private readonly capacity;
    private readonly owners;
    private readonly agents;
    private readonly workflows;
    private closing;
    private timer;
    private readonly history;
    constructor(ctx: Context, config: Config);
    /** Open original-format SQLite and resume safe queued work through its owner. */
    [Service.init](): Promise<void>;
    private scheduleHealth;
    /**
     * Diagnose inactive native execution without approving or replaying work.
     * @param owner - Optional owner filter.
     * @returns Native execution diagnostics.
     */
    checkHealth(owner?: SessionId): Promise<AntfarmHealthReport>;
    /**
     * Read Session-authorized diagnostic history.
     * @param owner - Authorized owner.
     * @returns Recent diagnostic history.
     */
    healthHistory(owner: SessionId): Promise<AntfarmHealthHistory>;
    /**
     * Dispatch safe inactive work through the original native owner.
     * @param owner - Original owner.
     * @returns Runs dispatched without changing completed work.
     */
    ensureExecution(owner: SessionId): Promise<string[]>;
    /** SQLite is authoritative and requires no journal index rebuild. */
    get indexError(): undefined;
    /**
     * Restore the original root Session authority without a model turn.
     * @param owner - Original root Session.
     * @returns Its live execution authority.
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
     * @returns Installed project copy.
     */
    importWorkflow(parent: Agent, directory: string, sourceRoot: string): Promise<WorkflowDraft>;
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
    private owned;
    /**
     * Persist original workflow admission before accepting native execution.
     * @param request - Owner and original workflow task.
     * @returns Durable admission receipt.
     */
    start(request: AntfarmStartRequest): Promise<AntfarmRunReceipt>;
    /**
     * Resume a failed or reconciled interrupted run through its original owner.
     * @param request - Original owner and recovery guidance.
     * @returns Resumed run receipt.
     */
    resume(request: AntfarmResumeRequest): Promise<AntfarmRunReceipt>;
    private receipt;
    private launch;
    private summary;
    /**
     * Combine original SQL runs and attributable read-only historical snapshots.
     * @param owner - Selected Session.
     * @returns Its original SQLite runs.
     */
    list(owner: SessionId): Promise<AntfarmRunSummary[]>;
    /**
     * Read bounded owner-authorized run summaries.
     * @param owners - Authorized Sessions.
     * @param offset - Page offset.
     * @returns Fifty runs.
     */
    page(owners: readonly SessionId[], offset: number): Promise<AntfarmRunSummary[]>;
    /**
     * Read original business rows and native attempt addresses.
     * @param runId - Run identity.
     * @param owner - Authorized owner.
     * @returns Business state and native attempts.
     */
    status(runId: string, owner: SessionId): Promise<AntfarmStatus>;
    /**
     * Wait for the current executor without transferring Run cancellation to the caller.
     * @param runId - Run identity.
     * @param owner - Authorized owner.
     * @param signal - Caller wait.
     * @returns Settled state.
     */
    wait(runId: string, owner: SessionId, signal?: AbortSignal): Promise<AntfarmStatus>;
    /**
     * Resolve an owner-scoped exact id, number or unique textual query.
     * @param query - Run number, task or id prefix.
     * @param owner - Authorized owner.
     * @returns Unique match.
     */
    find(query: string, owner: SessionId): Promise<string>;
    /**
     * Read complete observation events without using them as business state.
     * @param runId - Run identity.
     * @param owner - Authorized owner.
     * @param after - Event offset.
     * @returns Observation log page.
     */
    events(runId: string, owner: SessionId, after: number): Promise<AntfarmEventSummary[]>;
    private revision;
    /**
     * Stop the exact native child and wait for disposal before acknowledging cancellation.
     * @param runId - Owned run.
     * @param owner - Root Session.
     * @param reason - User cancellation reason.
     * @param revision - Expected revision.
     * @returns Cancelled state after child exit.
     */
    cancel(runId: string, owner: SessionId, reason?: string, revision?: number): Promise<AntfarmRunSummary>;
}
/** Configuration of the SQLite runtime and native scheduling. */
export type Config = ReturnType<typeof AntfarmRuntime.Config>;
export type { AntfarmResumeRequest, AntfarmRunReceipt, AntfarmStartRequest } from './types.ts';
export default AntfarmRuntime;
//# sourceMappingURL=index.d.ts.map