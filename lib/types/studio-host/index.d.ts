/** Resource-authorized inspection and revision-bound Antfarm operations. */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { AntfarmControlRequest, AntfarmEventSummary, AntfarmHealthHistory, AntfarmHealthReport, AntfarmLaunchRequest, AntfarmRunSummary, AntfarmSessionId, AntfarmStatus } from '../types.ts';
import type { WorkflowDraft } from '../workflow/types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Authorized Antfarm inspection and operations. */
        antfarmStudio: AntfarmStudioGateway;
    }
}
/** Read the runtime's authoritative run state without activating an Agent. */
export declare class AntfarmStudioGateway extends TypertRemoteService {
    static inject: string[];
    /** @param ctx - Host context carrying the Antfarm runtime. */
    constructor(ctx: Context);
    /**
     * List runs owned by the selected Session.
     * @param sessionId - Session whose owned runs are visible.
     * @param signal - caller lifetime; runtime reads finish independently of transport cancellation.
     * @returns the owner's runs in runtime order.
     */
    list(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<AntfarmRunSummary[]>;
    /**
     * Inspect a run through its original owner's authority.
     * @param runId - run selected from the owner's listing.
     * @param sessionId - Session authorizing the read.
     * @param signal - caller lifetime; runtime reads finish independently of transport cancellation.
     * @returns durable run details; another owner's run is refused by the runtime.
     */
    status(runId: string, sessionId: AntfarmSessionId, signal: AbortSignal): Promise<AntfarmStatus>;
    /**
     * Admit a workflow using a stable request identity and root Session authority.
     * @param request - Stable launch identity and selected owner.
     * @param signal - Admission lifetime.
     * @returns Admitted Run projection.
     */
    start(request: AntfarmLaunchRequest, signal: AbortSignal): Promise<AntfarmRunSummary>;
    /**
     * Apply an owner-authorized operation against the expected Run revision.
     * @param request - Original owner and expected Run revision.
     * @param signal - Operation admission lifetime.
     * @returns Settled operation projection.
     */
    control(request: AntfarmControlRequest, signal: AbortSignal): Promise<AntfarmRunSummary>;
    /**
     * List recent Runs across explicitly authorized root Sessions.
     * @param owners - Explicit authorized Session resources.
     * @param signal - Query lifetime.
     * @returns At most two hundred recent Runs.
     */
    board(owners: readonly AntfarmSessionId[], signal: AbortSignal): Promise<AntfarmRunSummary[]>;
    /**
     * Read a bounded page of Runs authorized by explicit Session resources.
     * @param owners - Explicit authorized Sessions, at most one hundred per page.
     * @param offset - Previously loaded row count.
     * @param signal - Read lifetime.
     * @returns Fifty indexed Run summaries.
     */
    page(owners: readonly AntfarmSessionId[], offset: number, signal: AbortSignal): Promise<AntfarmRunSummary[]>;
    /**
     * Discover workflow choices for the authorized Session.
     * @param sessionId - Catalog scope.
     * @param signal - Query lifetime.
     * @returns Workflow choices.
     */
    workflows(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<string[]>;
    /**
     * Read revision-bound editable resources for the selected workflow.
     * @param id - Selected workflow.
     * @param sessionId - Catalog scope.
     * @param signal - Query lifetime.
     * @returns Revision-bound editable resources.
     */
    workflow(id: string, sessionId: AntfarmSessionId, signal: AbortSignal): Promise<WorkflowDraft>;
    /**
     * Validate and atomically save a revision-bound workflow copy.
     * @param draft - Validated-copy input.
     * @param scope - Save location.
     * @param sessionId - Owner.
     * @param signal - Admission lifetime.
     * @returns Saved revision.
     */
    saveWorkflow(draft: WorkflowDraft, scope: 'project' | 'profile', sessionId: AntfarmSessionId, signal: AbortSignal): Promise<WorkflowDraft>;
    /**
     * Remove a matching writable override after checking active dependencies.
     * @param id - Writable override.
     * @param revision - Saved source.
     * @param scope - Destination.
     * @param sessionId - Owner.
     * @param signal - Admission lifetime.
     */
    removeWorkflow(id: string, revision: string, scope: 'project' | 'profile', sessionId: AntfarmSessionId, signal: AbortSignal): Promise<void>;
    /**
     * Read bounded committed events after an exclusive sequence cursor.
     * @param runId - Owned Run.
     * @param sessionId - Owner.
     * @param after - Exclusive cursor.
     * @param signal - Read lifetime.
     * @returns Committed facts.
     */
    events(runId: string, sessionId: AntfarmSessionId, after: number, signal: AbortSignal): Promise<AntfarmEventSummary[]>;
    /**
     * Inspect Run health under the selected Session’s authority.
     * @param sessionId - Authorized owner.
     * @param signal - Admission lifetime.
     * @returns Diagnosed Run health.
     */
    health(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<AntfarmHealthReport>;
    /**
     * Read bounded health history and current monitoring settings.
     * @param sessionId - Authorized owner.
     * @param signal - Read lifetime.
     * @returns Health settings and bounded history.
     */
    healthHistory(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<AntfarmHealthHistory>;
    /**
     * Dispatch safe inactive work through the existing executor.
     * @param sessionId - Authorized owner.
     * @param signal - Admission lifetime.
     * @returns Safely dispatched inactive Run ids.
     */
    ensureExecution(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<string[]>;
    /**
     * Create an independent project workflow from a matching source revision.
     * @param draft - Source and expected revision.
     * @param newId - New project workflow identity.
     * @param sessionId - Owner.
     * @param signal - Admission lifetime.
     * @returns Validated independent copy.
     */
    copyWorkflow(draft: WorkflowDraft, newId: string, sessionId: AntfarmSessionId, signal: AbortSignal): Promise<WorkflowDraft>;
    /**
     * Change workflow availability after checking revision and active dependencies.
     * @param draft - Workflow identity and expected source revision.
     * @param enabled - Install or uninstall.
     * @param sessionId - Owner.
     * @param signal - Admission lifetime.
     */
    setWorkflowEnabled(draft: WorkflowDraft, enabled: boolean, sessionId: AntfarmSessionId, signal: AbortSignal): Promise<void>;
}
export default AntfarmStudioGateway;
//# sourceMappingURL=index.d.ts.map