/** Original Antfarm workflows on native DSH child Sessions and SQLite. */
import { realpath } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JobId } from '@deepseek-ai/dsh-jobs'
import { SessionId as sessionId, type SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-working-directory'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-session-query'
import z from '@deepseek-ai/schemastery'
import { AntfarmDatabase, type RunRow } from '../persistence/database.ts'
import { LegacyRuns } from '../persistence/legacy.ts'
import { AntfarmAgents, AttemptTeardownError, AttemptTimeoutError } from './agents.ts'
import { WorkflowNotifications } from './notifications.ts'
import { archiveProgress, frontendChanges, readProgress } from './progress.ts'
import { publicWebhookUrl } from '../workflow/notifications.ts'
import { RunCapacity } from './capacity.ts'
import { RunOwnerResolver } from './owner.ts'
import { loadWorkflow, validateResolvedWorkflow } from '../workflow/loader.ts'
import { WorkflowManager, projectWorkflowRoot, type WorkflowDraft } from '../workflow/manager.ts'
import type {
  AntfarmEventSummary,
  AntfarmHealthHistory,
  AntfarmHealthReport,
  AntfarmRunSummary,
  AntfarmStatus,
} from '../types.ts'
import type { AntfarmResumeRequest, AntfarmRunReceipt, AntfarmStartRequest } from './types.ts'
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.resolve('dsh-antfarm/package.json')))
interface Operation {
  owner: SessionId
  controller: AbortController
  done: Promise<void>
  jobId?: JobId
  interrupted: boolean
}
declare module '@deepseek-ai/cordis' {
  interface Context {
    antfarm: AntfarmRuntime
  }
}
declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap {
    antfarm: 'antfarm'
  }
}
/** Owns native execution; workflow state is read directly from SQLite. */
export class AntfarmRuntime extends Service {
  static inject = [
    'agents',
    'sessions',
    'workingDirectory',
    'agentPresets',
    'jobs',
    'subagents',
    'subprocess',
    'systemPrompt',
    'tools',
  ]
  static Config = z.object({
    journalRoot: z.string().required(),
    workflowDirs: z.array(z.string()).default([]),
    defaultWorkflowId: z.string().default('feature-dev').volatile(),
    subagentProvider: z.string().default('spawn'),
    maxActiveRunsPerOwner: z.natural().min(1).max(100).default(2),
    maxActiveRuns: z.natural().min(1).max(100).default(8),
    dispatchIntervalMs: z.natural().min(10).max(2147483647).default(1000),
    gitTimeoutMs: z.natural().min(1).max(2147483647).default(10000),
    subprocessGraceMs: z.natural().min(1).max(2147483647).default(1000),
    webhookTimeoutMs: z.natural().min(1).max(2147483647).default(5000),
    webhookTokenEnv: z.string(),
    healthEnabled: z.boolean().default(true).volatile(),
    healthIntervalMs: z.natural().min(1000).max(2147483647).default(300000).volatile(),
  })
  private database!: AntfarmDatabase
  private readonly legacy: LegacyRuns
  private readonly notifications: WorkflowNotifications
  private readonly operations = new Map<string, Operation>()
  private readonly capacity: RunCapacity
  private readonly owners: RunOwnerResolver
  private readonly agents: AntfarmAgents
  private readonly workflows = new WorkflowManager(resolve(PACKAGE_ROOT, 'workflows'))
  private closing = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly history: AntfarmHealthReport[] = []
  constructor(
    ctx: Context,
    private readonly config: Config,
  ) {
    super(ctx, 'antfarm')
    this.legacy = new LegacyRuns(config.journalRoot)
    const token = config.webhookTokenEnv ? process.env[config.webhookTokenEnv] : undefined
    if (config.webhookTokenEnv && !token)
      throw new Error('Configured Antfarm webhook credential environment variable is missing')
    this.notifications = new WorkflowNotifications(config.webhookTimeoutMs, token)
    this.capacity = new RunCapacity(config.maxActiveRuns, config.maxActiveRunsPerOwner)
    this.owners = new RunOwnerResolver(ctx)
    this.agents = new AntfarmAgents(ctx, join(dirname(config.journalRoot), 'workspaces'))
    ctx.on('agent/disposed', ({ agent }) => {
      for (const operation of this.operations.values())
        if (operation.owner === agent.id) {
          operation.interrupted = true
          operation.controller.abort(new Error('owning Agent unloaded'))
        }
    })
    ctx.on('workspace/session-stop', ({ sessionId }) => {
      for (const operation of this.operations.values())
        if (operation.owner === sessionId) {
          operation.interrupted = true
          operation.controller.abort(new Error('owning Session stopped'))
        }
    })
    ctx.effect(() => async () => {
      this.closing = true
      clearTimeout(this.timer)
      for (const operation of this.operations.values()) {
        operation.interrupted = true
        operation.controller.abort(new Error('Antfarm host stopped'))
      }
      await Promise.allSettled([...this.operations.values()].map((operation) => operation.done))
      await this.notifications.dispose()
      await this.owners.dispose()
      this.database?.dispose()
    })
  }
  /** Open original-format SQLite and resume safe queued work through its owner. */
  async [Service.init](): Promise<void> {
    this.database = new AntfarmDatabase(join(dirname(this.config.journalRoot), 'antfarm.db'), (event, endpoint) =>
      this.notifications.send(event, endpoint),
    )
    this.database.acquireHost()
    for (const run of this.database.list())
      if (run.status === 'running') {
        const active = this.database.attempts(run.id).some((attempt) => attempt.state === 'running')
        if (active) {
          this.database.pause(run.id, 'Inspect the interrupted native attempt before resuming')
          continue
        }
        if (!this.database.binding(run.id).paused)
          try {
            this.launch(run.id, await this.owners.resolve(sessionId(this.database.binding(run.id).owner)))
          } catch (error) {
            this.database.pause(run.id, String(error))
          }
      }
    this.scheduleHealth()
  }
  private scheduleHealth(): void {
    if (this.closing) return
    this.timer = setTimeout(() => {
      const checking = this.config.healthEnabled.get() ? this.checkHealth() : Promise.resolve()
      void checking
        .catch((error) =>
          console.error('Antfarm health check failed:', error instanceof Error ? error.message : String(error)),
        )
        .finally(() => this.scheduleHealth())
    }, this.config.healthIntervalMs.get())
    this.timer.unref()
  }
  /**
   * Diagnose inactive native execution without approving or replaying work.
   * @param owner - Optional owner filter.
   * @returns Native execution diagnostics.
   */
  async checkHealth(owner?: SessionId): Promise<AntfarmHealthReport> {
    const findings: AntfarmHealthReport['findings'][number][] = []
    for (const run of this.database.list(owner))
      if (run.status === 'running' && !this.operations.has(run.id))
        findings.push({
          runId: run.id,
          kind: 'inactive',
          detail: this.database.binding(run.id).reason ?? 'No active native execution',
        })
    const report = { time: Date.now(), enabled: this.config.healthEnabled.get(), findings }
    this.history.push(report)
    if (this.history.length > 20) this.history.shift()
    return report
  }
  /**
   * Read Session-authorized diagnostic history.
   * @param owner - Authorized owner.
   * @returns Recent diagnostic history.
   */
  async healthHistory(owner: SessionId): Promise<AntfarmHealthHistory> {
    const ids = new Set(this.database.list(owner).map((run) => run.id))
    const reports = this.history.map((report) => ({
      ...report,
      findings: report.findings.filter((row) => ids.has(row.runId)),
    }))
    return {
      reports,
      issues24h: reports
        .filter((report) => report.time >= Date.now() - 24 * 60 * 60 * 1000)
        .reduce((sum, report) => sum + report.findings.length, 0),
      enabled: this.config.healthEnabled.get(),
      intervalMs: this.config.healthIntervalMs.get(),
    }
  }
  /**
   * Dispatch safe inactive work through the original native owner.
   * @param owner - Original owner.
   * @returns Runs dispatched without changing completed work.
   */
  async ensureExecution(owner: SessionId): Promise<string[]> {
    const started: string[] = []
    for (const run of this.database.list(owner))
      if (run.status === 'running' && !this.operations.has(run.id) && !this.database.binding(run.id).paused) {
        this.launch(run.id, await this.owners.resolve(owner))
        started.push(run.id)
      }
    return started
  }
  /** SQLite is authoritative and requires no journal index rebuild. */
  get indexError(): undefined {
    return undefined
  }
  /**
   * Restore the original root Session authority without a model turn.
   * @param owner - Original root Session.
   * @returns Its live execution authority.
   */
  async resolveOwner(owner: SessionId): Promise<Agent> {
    return this.owners.resolve(owner)
  }

  private async observedWorkflowRoots(owner: SessionId): Promise<string[]> {
    const live = this.ctx.agents.get(owner)
    let cwd = live === undefined ? undefined : this.ctx.workingDirectory.get(live.session)
    if (cwd === undefined) {
      const query = this.ctx.get('sessionQuery')
      if (query === undefined) throw new Error('workflow discovery requires native Session query')
      using observation = await query.observeSession(owner)
      const projected = observation.projections?.values.workingDirectory
      cwd = typeof projected === 'string' ? projected : observation.header.cwd
    }
    if (cwd === undefined) throw new Error('selected Session has no workflow input root')
    return [await projectWorkflowRoot(cwd), ...this.config.workflowDirs]
  }

  /**
   * Discover workflows for a selected Session without activating its owner.
   * @param owner - Selected Session.
   * @returns Workflow catalog without resuming a model owner.
   */
  async workflowCatalog(owner: SessionId): Promise<string[]> {
    return this.workflows.list(await this.observedWorkflowRoots(owner))
  }

  /**
   * Read revision-bound workflow resources for a selected Session.
   * @param owner - Selected Session.
   * @param id - Workflow.
   * @returns Editable source without owner activation.
   */
  async workflowDraft(owner: SessionId, id: string): Promise<WorkflowDraft> {
    return this.workflows.read(id, await this.observedWorkflowRoots(owner))
  }

  private async workflowRoots(parent: Agent): Promise<string[]> {
    this.live(parent, new AbortController().signal)
    const cwd = await this.ctx.workingDirectory.ensure(parent)
    return [await projectWorkflowRoot(cwd), ...this.config.workflowDirs]
  }

  /**
   * List available workflows under the live owner’s configuration.
   * @param parent - Authorized root.
   * @returns Installed and packaged workflow ids.
   */
  async listWorkflows(parent: Agent): Promise<string[]> {
    return this.workflows.list(await this.workflowRoots(parent))
  }

  /**
   * Read editable workflow resources under the live owner’s configuration.
   * @param parent - Authorized root.
   * @param id - Workflow id.
   * @returns Editable resolved copy.
   */
  async readWorkflow(parent: Agent, id: string): Promise<WorkflowDraft> {
    return this.workflows.read(id, await this.workflowRoots(parent))
  }

  /**
   * Validate and atomically save a revision-bound workflow copy.
   * @param parent - Authorized root.
   * @param value - Revision-bound copy.
   * @param scope - Destination.
   * @returns Saved copy.
   */
  async saveWorkflow(parent: Agent, value: WorkflowDraft, scope: 'project' | 'profile'): Promise<WorkflowDraft> {
    const roots = await this.workflowRoots(parent)
    const root = scope === 'project' ? roots[0]! : this.config.workflowDirs[0]
    if (root === undefined) throw new Error('configure a writable profile workflow directory first')
    this.live(parent, new AbortController().signal)
    return this.workflows.save(value, root, roots)
  }

  /**
   * Import confined original Antfarm resources into a project copy.
   * @param parent - Authorized root.
   * @param directory - Original workflow.
   * @param sourceRoot - Shared-resource root.
   * @returns Installed project copy.
   */
  async importWorkflow(parent: Agent, directory: string, sourceRoot: string): Promise<WorkflowDraft> {
    const roots = await this.workflowRoots(parent)
    this.live(parent, new AbortController().signal)
    return this.workflows.import(directory, sourceRoot, roots[0]!)
  }

  /**
   * Remove a matching writable override after checking active dependencies.
   * @param parent - Authorized root.
   * @param id - Workflow.
   * @param revision - Current copy.
   * @param scope - Override root.
   */
  async removeWorkflow(parent: Agent, id: string, revision: string, scope: 'project' | 'profile'): Promise<void> {
    const roots = await this.workflowRoots(parent)
    const root = scope === 'project' ? roots[0]! : this.config.workflowDirs[0]
    if (root === undefined) throw new Error('configure a writable profile workflow directory first')
    if (this.database.list().some((run) => run.workflow_id === id && run.status === 'running'))
      throw new Error('settle active workflow Runs before uninstalling their resources')
    this.live(parent, new AbortController().signal)
    await this.workflows.remove(id, root, revision)
  }

  /**
   * Change workflow availability after checking revision and active dependencies.
   * @param parent - Root owner.
   * @param id - Workflow id or all.
   * @param enabled - Install or disable.
   * @param force - Cancel this owner's active Runs first.
   * @param expected - Source revision and enabled state required by the caller.
   */
  async setWorkflowEnabled(
    parent: Agent,
    id: string,
    enabled: boolean,
    force: boolean = false,
    expected?: WorkflowDraft,
  ): Promise<void> {
    const roots = await this.workflowRoots(parent)
    const ids = id === 'all' ? await this.workflows.list(roots) : [id]
    if (!enabled)
      for (const [runId, operation] of this.operations) {
        if (!ids.includes(this.database.run(runId).workflow_id)) continue
        if (!force || operation.owner !== parent.id)
          throw new Error('settle active workflow Runs before uninstalling; force can cancel only this owner’s Runs')
        await this.cancel(runId, parent.id, 'workflow disabled by owner')
      }
    for (const workflowId of ids) {
      this.live(parent, new AbortController().signal)
      const current = await this.workflows.enabled(workflowId, roots)
      await this.workflows.setEnabled(workflowId, roots, enabled, expected?.enabled ?? current, expected?.revision)
    }
  }

  /**
   * Create an independent project workflow from a matching source revision.
   * @param parent - Root owner.
   * @param source - Revision-bound source.
   * @param newId - New id.
   * @returns Validated project copy.
   */
  async copyWorkflow(parent: Agent, source: WorkflowDraft, newId: string): Promise<WorkflowDraft> {
    const roots = await this.workflowRoots(parent)
    this.live(parent, new AbortController().signal)
    return this.workflows.copy(source, newId, roots, roots[0]!)
  }

  private live(parent: Agent, signal: AbortSignal): void {
    signal.throwIfAborted()
    if (this.closing || this.ctx.agents.get(parent.id) !== parent || parent.session.header.origin === 'subagent')
      throw new Error('Antfarm requires a live root owner')
  }
  private owned(runId: string, owner: SessionId): RunRow {
    const run = this.database.run(runId)
    if (this.database.binding(runId).owner !== owner) throw new Error('run belongs to another Session')
    return run
  }
  /**
   * Persist original workflow admission before accepting native execution.
   * @param request - Owner and original workflow task.
   * @returns Durable admission receipt.
   */
  async start(request: AntfarmStartRequest): Promise<AntfarmRunReceipt> {
    this.live(request.parent, request.signal ?? new AbortController().signal)
    const id = request.workflowId ?? this.config.defaultWorkflowId.get(),
      roots = await this.workflowRoots(request.parent)
    if (!(await this.workflows.enabled(id, roots))) throw new Error('workflow is disabled')
    const workflow = await loadWorkflow(id, [...roots, join(PACKAGE_ROOT, 'workflows')])
    if (request.notificationUrl) publicWebhookUrl(request.notificationUrl)
    const provider = this.ctx.subagents.getProvider(this.config.subagentProvider)
    if (!provider || provider.inheritsParentContext || !provider.prepareContinuable)
      throw new Error('Antfarm requires a fresh local DSH child provider')
    const cwd = await realpath(await this.ctx.workingDirectory.ensure(request.parent))
    for (const agent of workflow.agents) await this.agents.workspace(workflow, agent, false)
    this.live(request.parent, request.signal ?? new AbortController().signal)
    const runId = this.database.start(
      workflow,
      request.task,
      request.parent.id,
      cwd,
      request.requestId,
      request.notificationUrl,
    )
    if (
      !this.operations.has(runId) &&
      this.database.run(runId).status === 'running' &&
      !this.database.binding(runId).paused
    )
      this.launch(runId, request.parent)
    return this.receipt(runId)
  }
  /**
   * Resume a failed or reconciled interrupted run through its original owner.
   * @param request - Original owner and recovery guidance.
   * @returns Resumed run receipt.
   */
  async resume(request: AntfarmResumeRequest): Promise<AntfarmRunReceipt> {
    this.live(request.parent, request.signal ?? new AbortController().signal)
    this.owned(request.runId, request.parent.id)
    if (this.operations.has(request.runId)) throw new Error('run already has an executor')
    this.revision(request.runId, request.revision)
    const active = this.database.attempts(request.runId).filter((attempt) => attempt.state === 'running')
    for (const attempt of active)
      if (this.ctx.agents.get(sessionId(attempt.session_id)))
        throw new Error('stop the active native attempt before resuming')
    if (active.length && !request.guidance?.trim())
      throw new Error('inspect the interrupted attempt and provide recovery guidance')
    this.database.resume(request.runId, request.guidance)
    this.launch(request.runId, request.parent)
    return this.receipt(request.runId)
  }
  private receipt(runId: string): AntfarmRunReceipt {
    const summary = this.summary(this.database.run(runId))
    return {
      runId,
      workflowId: summary.workflowId,
      status: summary.status as AntfarmRunReceipt['status'],
      workspace: summary.workspace,
      branch: summary.branch,
      ...(this.operations.get(runId)?.jobId ? { jobId: this.operations.get(runId)!.jobId! } : {}),
    }
  }
  private launch(runId: string, parent: Agent): void {
    if (this.operations.has(runId)) throw new Error('run already has an executor')
    const operation: Operation = {
      owner: parent.id,
      controller: new AbortController(),
      done: Promise.resolve(),
      interrupted: false,
    }
    this.operations.set(runId, operation)
    const drive = async () => {
      let release: (() => void) | undefined
      try {
        release = await this.capacity.acquire(parent.id, operation.controller.signal)
        const binding = this.database.binding(runId),
          workflow = validateResolvedWorkflow(JSON.parse(binding.workflow))
        const loop = workflow.steps.find((step) => step.type === 'loop'),
          worker = workflow.agents.find((agent) => agent.id === loop?.agent)
        while (this.database.run(runId).status === 'running') {
          this.live(parent, operation.controller.signal)
          const before = this.database.binding(runId).revision
          const context: Record<string, string> = JSON.parse(this.database.run(runId).context)
          let progress = '(no progress yet)'
          if (worker) {
            const cwd = await this.agents.workspace(workflow, worker, false)
            progress = (await readProgress(cwd, runId))?.text ?? progress
          }
          const frontend =
            context.repo && context.branch
              ? await frontendChanges(
                  this.ctx,
                  context.repo,
                  context.branch,
                  operation.controller.signal,
                  this.config.gitTimeoutMs,
                  this.config.subprocessGraceMs,
                )
              : 'false'
          const claim = this.database.claim(runId, progress, frontend)
          if (!claim) {
            if (this.database.binding(runId).revision !== before) continue
            await delay(this.config.dispatchIntervalMs, undefined, { signal: operation.controller.signal })
            continue
          }
          const agent = workflow.agents.find((agent) => `${workflow.id}_${agent.id}` === claim.step.agent_id)!
          try {
            const cwd = await this.agents.workspace(workflow, agent)
            const output = await this.agents.execute(
              workflow,
              claim,
              parent,
              cwd,
              binding.cwd,
              this.config.subagentProvider,
              operation.controller.signal,
            )
            operation.controller.signal.throwIfAborted()
            this.database.complete(claim.sessionId, output)
          } catch (error) {
            if (error instanceof AttemptTeardownError) throw error
            if (operation.controller.signal.aborted) throw error
            if (error instanceof AttemptTimeoutError) this.database.abandon(claim.sessionId)
            else this.database.fail(claim.sessionId, String(error))
          }
        }
        if (worker) {
          try {
            await archiveProgress(await this.agents.workspace(workflow, worker, false), runId)
          } catch (error) {
            console.error('Antfarm progress archive failed:', error instanceof Error ? error.message : String(error))
          }
        }
        return {
          status: this.database.run(runId).status === 'completed' ? ('completed' as const) : ('failed' as const),
          detail: this.database.run(runId).status,
        }
      } catch (error) {
        if (operation.interrupted || error instanceof AttemptTeardownError) this.database.pause(runId, String(error))
        else if (operation.controller.signal.aborted) this.database.cancel(runId)
        else this.database.pause(runId, String(error))
        return { status: 'failed' as const, detail: String(error) }
      } finally {
        release?.()
        this.operations.delete(runId)
      }
    }
    try {
      operation.jobId = this.ctx.jobs.start({
        kind: 'antfarm',
        label: `Antfarm ${this.database.run(runId).workflow_id}`,
        owner: parent.id,
        run: () => {
          const done = drive()
          operation.done = done.then(() => {})
          return { cancel: (reason) => operation.controller.abort(new Error(reason ?? 'cancelled')), done }
        },
      })
    } catch (error) {
      operation.interrupted = true
      operation.controller.abort(error)
      this.database.pause(runId, String(error))
      this.operations.delete(runId)
      throw new Error(`Run ${runId} was admitted but its native job could not start; inspect and resume it`, {
        cause: error,
      })
    }
  }
  private summary(run: RunRow): AntfarmRunSummary {
    const binding = this.database.binding(run.id),
      stories = this.database.stories(run.id),
      context: Record<string, string> = JSON.parse(run.context)
    return {
      runId: run.id,
      number: run.run_number,
      task: run.task,
      revision: binding.revision,
      workflowId: run.workflow_id,
      status: binding.paused && run.status === 'running' ? 'interrupted' : (run.status as AntfarmRunSummary['status']),
      workspace: context.repo ?? binding.cwd,
      branch: context.branch ?? '',
      currentStep: this.database.steps(run.id).find((step) => ['running', 'pending'].includes(step.status))?.step_id,
      ownerSessionId: binding.owner,
      updatedAt: Date.parse(run.updated_at.endsWith('Z') ? run.updated_at : run.updated_at + 'Z'),
      workspaceDisposition: 'retained',
      acceptedStories: stories.filter((story) => story.status === 'done').length,
      totalStories: stories.length,
      ...(binding.reason ? { reason: binding.reason } : {}),
    }
  }
  /**
   * Combine original SQL runs and attributable read-only historical snapshots.
   * @param owner - Selected Session.
   * @returns Its original SQLite runs.
   */
  async list(owner: SessionId): Promise<AntfarmRunSummary[]> {
    return [
      ...this.database.list(owner).map((run) => this.summary(run)),
      ...(await this.legacy.list(owner)).map((value) => value.summary),
    ].sort((a, b) => b.updatedAt - a.updatedAt)
  }
  /**
   * Read bounded owner-authorized run summaries.
   * @param owners - Authorized Sessions.
   * @param offset - Page offset.
   * @returns Fifty runs.
   */
  async page(owners: readonly SessionId[], offset: number): Promise<AntfarmRunSummary[]> {
    return (await Promise.all(owners.map((owner) => this.list(owner))))
      .flat()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(offset, offset + 50)
  }
  /**
   * Read original business rows and native attempt addresses.
   * @param runId - Run identity.
   * @param owner - Authorized owner.
   * @returns Business state and native attempts.
   */
  async status(runId: string, owner: SessionId): Promise<AntfarmStatus> {
    if (runId.startsWith('af-')) return this.legacy.status(runId, owner)
    const run = this.owned(runId, owner),
      attempts = this.database.attempts(runId)
    return {
      summary: this.summary(run),
      context: JSON.parse(run.context),
      stories: this.database
        .stories(runId)
        .map((row) => ({
          id: row.story_id,
          title: row.title,
          description: row.description,
          acceptanceCriteria: JSON.parse(row.acceptance_criteria),
          status: row.status,
          retryCount: row.retry_count,
          maxRetries: row.max_retries,
        })),
      steps: this.database
        .steps(runId)
        .map((step) => ({
          id: step.step_id,
          agent: step.agent_id,
          status: step.status,
          output: step.output,
          retries: step.retry_count,
        })),
      childSessionIds: attempts.map((attempt) => attempt.session_id),
      uncertain: attempts.some((attempt) => attempt.state === 'running') && !this.operations.has(runId),
    }
  }
  /**
   * Wait for the current executor without transferring Run cancellation to the caller.
   * @param runId - Run identity.
   * @param owner - Authorized owner.
   * @param signal - Caller wait.
   * @returns Settled state.
   */
  async wait(runId: string, owner: SessionId, signal?: AbortSignal): Promise<AntfarmStatus> {
    this.owned(runId, owner)
    signal?.throwIfAborted()
    let abort: (() => void) | undefined
    try {
      const done = this.operations.get(runId)?.done
      if (signal)
        await Promise.race([
          done,
          new Promise<never>((_resolve, reject) => {
            abort = () => reject(signal.reason)
            signal.addEventListener('abort', abort, { once: true })
          }),
        ])
      else await done
      return this.status(runId, owner)
    } finally {
      if (signal && abort) signal.removeEventListener('abort', abort)
    }
  }
  /**
   * Resolve an owner-scoped exact id, number or unique textual query.
   * @param query - Run number, task or id prefix.
   * @param owner - Authorized owner.
   * @returns Unique match.
   */
  async find(query: string, owner: SessionId): Promise<string> {
    const rows = await this.list(owner)
    const exact = rows.find((run) => run.runId === query || String(run.number) === query)
    if (exact) return exact.runId
    const matches = rows.filter(
      (run) => run.runId.startsWith(query) || (run.task ?? '').toLowerCase().includes(query.toLowerCase()),
    )
    if (matches.length !== 1) throw new Error(matches.length ? 'ambiguous run query' : 'run not found')
    return matches[0]!.runId
  }
  /**
   * Read complete observation events without using them as business state.
   * @param runId - Run identity.
   * @param owner - Authorized owner.
   * @param after - Event offset.
   * @returns Observation log page.
   */
  async events(runId: string, owner: SessionId, after: number): Promise<AntfarmEventSummary[]> {
    if (!Number.isInteger(after) || after < -1) throw new Error('invalid event cursor')
    if (runId.startsWith('af-')) return this.legacy.events(runId, owner, after)
    this.owned(runId, owner)
    return this.database
      .events(runId)
      .map((event, index) => ({
        seq: index + 1,
        time: Date.parse(event.ts),
        type: event.event,
        detail: event.detail ?? event.stepId ?? '',
      }))
      .filter((event) => event.seq > after)
      .slice(0, 100)
  }
  private revision(runId: string, expected?: number): void {
    if (expected !== undefined && this.database.binding(runId).revision !== expected)
      throw new Error('Run changed; refresh before applying this operation')
  }
  /**
   * Stop the exact native child and wait for disposal before acknowledging cancellation.
   * @param runId - Owned run.
   * @param owner - Root Session.
   * @param reason - User cancellation reason.
   * @param revision - Expected revision.
   * @returns Cancelled state after child exit.
   */
  async cancel(
    runId: string,
    owner: SessionId,
    reason: string = 'cancelled by user',
    revision?: number,
  ): Promise<AntfarmRunSummary> {
    const run = this.owned(runId, owner)
    this.revision(runId, revision)
    if (['completed', 'cancelled'].includes(run.status)) return this.summary(run)
    const operation = this.operations.get(runId)
    if (operation) {
      operation.controller.abort(new Error(reason))
      await operation.done
    } else this.database.cancel(runId)
    return this.summary(this.database.run(runId))
  }
}
/** Configuration of the SQLite runtime and native scheduling. */
export type Config = ReturnType<typeof AntfarmRuntime.Config>
export type { AntfarmResumeRequest, AntfarmRunReceipt, AntfarmStartRequest } from './types.ts'
export default AntfarmRuntime
