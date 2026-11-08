/** Resource-authorized inspection and revision-bound Antfarm operations. */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type {} from '../runtime/index.ts'
import type { AntfarmControlRequest, AntfarmEventSummary, AntfarmHealthHistory, AntfarmHealthReport, AntfarmLaunchRequest, AntfarmRunSummary, AntfarmSessionId, AntfarmStatus } from '../types.ts'
import type { WorkflowDraft } from '../workflow/types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Authorized Antfarm inspection and operations. */
    antfarmStudio: AntfarmStudioGateway
  }
}

/** Read the runtime's authoritative run state without activating an Agent. */
export class AntfarmStudioGateway extends TypertRemoteService {
  static inject = ['antfarm']

  /** @param ctx - Host context carrying the Antfarm runtime. */
  constructor(ctx: Context) {
    super(ctx, 'antfarmStudio')
  }

  /**
   * List runs owned by the selected Session.
   * @param sessionId - Session whose owned runs are visible.
   * @param signal - caller lifetime; runtime reads finish independently of transport cancellation.
   * @returns the owner's runs in runtime order.
   */
  @Remote({ resources: { session: (sessionId: AntfarmSessionId) => sessionId } })
  async list(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<AntfarmRunSummary[]> {
    void signal
    return await this.ctx.antfarm.list(sessionId)
  }

  /**
   * Inspect a run through its original owner's authority.
   * @param runId - run selected from the owner's listing.
   * @param sessionId - Session authorizing the read.
   * @param signal - caller lifetime; runtime reads finish independently of transport cancellation.
   * @returns durable run details; another owner's run is refused by the runtime.
   */
  @Remote({ resources: { session: (_runId: string, sessionId: AntfarmSessionId) => sessionId } })
  async status(runId: string, sessionId: AntfarmSessionId, signal: AbortSignal): Promise<AntfarmStatus> {
    void signal
    return await this.ctx.antfarm.status(runId, sessionId)
  }

  /**
   * Admit a workflow using a stable request identity and root Session authority.
   * @param request - Stable launch identity and selected owner.
   * @param signal - Admission lifetime.
   * @returns Admitted Run projection.
   */
  @Remote({ resources: { session: (request: AntfarmLaunchRequest) => request.sessionId } })
  async start(request: AntfarmLaunchRequest, signal: AbortSignal): Promise<AntfarmRunSummary> {
    signal.throwIfAborted()
    const parent = await this.ctx.antfarm.resolveOwner(request.sessionId)
    const receipt = await this.ctx.antfarm.start({ parent, task: request.task, workflowId: request.workflowId, requestId: request.requestId, ...(request.notificationUrl === undefined ? {} : { notificationUrl: request.notificationUrl }), signal })
    return (await this.ctx.antfarm.status(receipt.runId, request.sessionId)).summary
  }

  /**
   * Apply an owner-authorized operation against the expected Run revision.
   * @param request - Original owner and expected Run revision.
   * @param signal - Operation admission lifetime.
   * @returns Settled operation projection.
   */
  @Remote({ resources: { session: (request: AntfarmControlRequest) => request.sessionId } })
  async control(request: AntfarmControlRequest, signal: AbortSignal): Promise<AntfarmRunSummary> {
    signal.throwIfAborted()
    const current = await this.ctx.antfarm.status(request.runId, request.sessionId)
    if (current.summary.revision !== request.revision) throw new Error('Run changed; refresh before applying this operation')
    const parent = await this.ctx.antfarm.resolveOwner(request.sessionId)
    signal.throwIfAborted()
    if (request.action === 'resume') {
      await this.ctx.antfarm.resume({ parent, runId: request.runId, revision: request.revision,
        ...(request.guidance === undefined ? {} : { guidance: request.guidance }), signal })
      return (await this.ctx.antfarm.status(request.runId, request.sessionId)).summary
    }
    return this.ctx.antfarm.cancel(request.runId, parent.id, 'cancelled by user', request.revision)
  }

  /**
   * List recent Runs across explicitly authorized root Sessions.
   * @param owners - Explicit authorized Session resources.
   * @param signal - Query lifetime.
   * @returns At most two hundred recent Runs.
   */
  @Remote({ resources: { session: (owners: readonly AntfarmSessionId[]) => owners } })
  async board(owners: readonly AntfarmSessionId[], signal: AbortSignal): Promise<AntfarmRunSummary[]> {
    signal.throwIfAborted()
    if (owners.length === 0 || owners.length > 100) throw new Error('select one to one hundred Sessions for the board')
    const rows = await Promise.all([...new Set(owners)].map(owner => this.ctx.antfarm.list(owner)))
    return rows.flat().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200)
  }

  /**
   * Read a bounded page of Runs authorized by explicit Session resources.
   * @param owners - Explicit authorized Sessions, at most one hundred per page.
   * @param offset - Previously loaded row count.
   * @param signal - Read lifetime.
   * @returns Fifty indexed Run summaries.
   */
  @Remote({ resources: { session: (owners: readonly AntfarmSessionId[]) => owners } })
  async page(owners: readonly AntfarmSessionId[], offset: number, signal: AbortSignal): Promise<AntfarmRunSummary[]> {
    signal.throwIfAborted()
    return this.ctx.antfarm.page([...new Set(owners)], offset)
  }

  /**
   * Discover workflow choices for the authorized Session.
   * @param sessionId - Catalog scope.
   * @param signal - Query lifetime.
   * @returns Workflow choices.
   */
  @Remote({ resources: { session: (sessionId: AntfarmSessionId) => sessionId } })
  async workflows(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<string[]> {
    signal.throwIfAborted()
    return this.ctx.antfarm.workflowCatalog(sessionId)
  }

  /**
   * Read revision-bound editable resources for the selected workflow.
   * @param id - Selected workflow.
   * @param sessionId - Catalog scope.
   * @param signal - Query lifetime.
   * @returns Revision-bound editable resources.
   */
  @Remote({ resources: { session: (_id: string, sessionId: AntfarmSessionId) => sessionId } })
  async workflow(id: string, sessionId: AntfarmSessionId, signal: AbortSignal): Promise<WorkflowDraft> {
    signal.throwIfAborted()
    return this.ctx.antfarm.workflowDraft(sessionId, id)
  }

  /**
   * Validate and atomically save a revision-bound workflow copy.
   * @param draft - Validated-copy input.
   * @param scope - Save location.
   * @param sessionId - Owner.
   * @param signal - Admission lifetime.
   * @returns Saved revision.
   */
  @Remote({ resources: { session: (_draft: WorkflowDraft, _scope: 'project' | 'profile', sessionId: AntfarmSessionId) => sessionId } })
  async saveWorkflow(draft: WorkflowDraft, scope: 'project' | 'profile', sessionId: AntfarmSessionId, signal: AbortSignal): Promise<WorkflowDraft> {
    if (scope === 'profile' && this.ctx.invocation !== undefined && this.ctx.invocation.peer.principal.kind !== 'owner') throw new Error('profile workflow edits require the Host owner')
    signal.throwIfAborted()
    const parent = await this.ctx.antfarm.resolveOwner(sessionId)
    signal.throwIfAborted()
    return this.ctx.antfarm.saveWorkflow(parent, draft, scope)
  }

  /**
   * Remove a matching writable override after checking active dependencies.
   * @param id - Writable override.
   * @param revision - Saved source.
   * @param scope - Destination.
   * @param sessionId - Owner.
   * @param signal - Admission lifetime.
   */
  @Remote({ resources: { session: (_id: string, _revision: string, _scope: 'project' | 'profile', sessionId: AntfarmSessionId) => sessionId } })
  async removeWorkflow(id: string, revision: string, scope: 'project' | 'profile', sessionId: AntfarmSessionId, signal: AbortSignal): Promise<void> {
    if (scope === 'profile' && this.ctx.invocation !== undefined && this.ctx.invocation.peer.principal.kind !== 'owner') throw new Error('profile workflow edits require the Host owner')
    signal.throwIfAborted()
    const parent = await this.ctx.antfarm.resolveOwner(sessionId)
    signal.throwIfAborted()
    await this.ctx.antfarm.removeWorkflow(parent, id, revision, scope)
  }

  /**
   * Read bounded committed events after an exclusive sequence cursor.
   * @param runId - Owned Run.
   * @param sessionId - Owner.
   * @param after - Exclusive cursor.
   * @param signal - Read lifetime.
   * @returns Committed facts.
   */
  @Remote({ resources: { session: (_runId: string, sessionId: AntfarmSessionId) => sessionId } })
  async events(runId: string, sessionId: AntfarmSessionId, after: number, signal: AbortSignal): Promise<AntfarmEventSummary[]> {
    signal.throwIfAborted()
    return this.ctx.antfarm.events(runId, sessionId, after)
  }

  /**
   * Inspect Run health under the selected Session’s authority.
   * @param sessionId - Authorized owner.
   * @param signal - Admission lifetime.
   * @returns Diagnosed Run health.
   */
  @Remote({ resources: { session: (sessionId: AntfarmSessionId) => sessionId } })
  async health(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<AntfarmHealthReport> {
    signal.throwIfAborted()
    return this.ctx.antfarm.checkHealth(sessionId)
  }

  /**
   * Read bounded health history and current monitoring settings.
   * @param sessionId - Authorized owner.
   * @param signal - Read lifetime.
   * @returns Health settings and bounded history.
   */
  @Remote({ resources: { session: (sessionId: AntfarmSessionId) => sessionId } })
  async healthHistory(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<AntfarmHealthHistory> {
    signal.throwIfAborted()
    return this.ctx.antfarm.healthHistory(sessionId)
  }

  /**
   * Dispatch safe inactive work through the existing executor.
   * @param sessionId - Authorized owner.
   * @param signal - Admission lifetime.
   * @returns Safely dispatched inactive Run ids.
   */
  @Remote({ resources: { session: (sessionId: AntfarmSessionId) => sessionId } })
  async ensureExecution(sessionId: AntfarmSessionId, signal: AbortSignal): Promise<string[]> {
    signal.throwIfAborted()
    return this.ctx.antfarm.ensureExecution(sessionId)
  }

  /**
   * Create an independent project workflow from a matching source revision.
   * @param draft - Source and expected revision.
   * @param newId - New project workflow identity.
   * @param sessionId - Owner.
   * @param signal - Admission lifetime.
   * @returns Validated independent copy.
   */
  @Remote({ resources: { session: (_draft: WorkflowDraft, _newId: string, sessionId: AntfarmSessionId) => sessionId } })
  async copyWorkflow(draft: WorkflowDraft, newId: string, sessionId: AntfarmSessionId, signal: AbortSignal): Promise<WorkflowDraft> {
    signal.throwIfAborted()
    const parent = await this.ctx.antfarm.resolveOwner(sessionId)
    signal.throwIfAborted()
    return this.ctx.antfarm.copyWorkflow(parent, draft, newId)
  }

  /**
   * Change workflow availability after checking revision and active dependencies.
   * @param draft - Workflow identity and expected source revision.
   * @param enabled - Install or uninstall.
   * @param sessionId - Owner.
   * @param signal - Admission lifetime.
   */
  @Remote({ resources: { session: (_draft: WorkflowDraft, _enabled: boolean, sessionId: AntfarmSessionId) => sessionId } })
  async setWorkflowEnabled(draft: WorkflowDraft, enabled: boolean, sessionId: AntfarmSessionId, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted()
    const parent = await this.ctx.antfarm.resolveOwner(sessionId)
    signal.throwIfAborted()
    await this.ctx.antfarm.setWorkflowEnabled(parent, draft.id, enabled, false, draft)
  }
}

export default AntfarmStudioGateway
