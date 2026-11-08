import { createHash, randomUUID } from 'node:crypto'
import { readFile, readdir, realpath, rm } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JobId } from '@deepseek-ai/dsh-jobs'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-working-directory'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-skill'
import z from '@deepseek-ai/schemastery'
import { RunStorage } from '../persistence/storage.ts'
import { ExecutionEvidence } from './evidence.ts'
import { GitHubDelivery } from './github.ts'
import { deliverOutcome, deliverOwnerNotice, deliverWebhook } from './notifications.ts'
import { RunCapacity } from './capacity.ts'
import { RunOwnerResolver } from './owner.ts'
import { SessionId as sessionId } from '@deepseek-ai/dsh-session'
import { RunJournal, readJournalIdentity } from '../persistence/journal.ts'
import type { FoldedRun } from '../persistence/fold.ts'
import { loadWorkflow } from '../workflow/loader.ts'
import { WorkflowManager, projectWorkflowRoot, type WorkflowDraft } from '../workflow/manager.ts'
import { publicWebhookUrl } from '../workflow/notifications.ts'
import type { ResolvedWorkflow } from '../workflow/types.ts'
import { captureFileInputs, fileWorkspacePath, validateFileWorkspace, retainFileOutputs, fileCandidateVersion } from '../workspace/files.ts'
import { cleanupWorktree, prepareRepository, resolveWorktreeSpec, validateWorktree, type WorktreeSpec } from '../workspace/git.ts'
import { runWorkflow } from './orchestrator.ts'
import type { AntfarmArtifactContent, AntfarmEventSummary, AntfarmHealthHistory, AntfarmHealthReport, AntfarmRunSummary, AntfarmStatus } from '../types.ts'
import type { AntfarmResumeRequest, AntfarmRunReceipt, AntfarmStartRequest } from './types.ts'

const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.resolve('dsh-antfarm/package.json')))

interface Operation {
  owner: SessionId
  controller: AbortController
  done: Promise<void>
  finish(): void
  journal?: RunJournal
  interrupted?: boolean
  jobId?: JobId
}

declare module '@deepseek-ai/cordis' { interface Context { antfarm: AntfarmRuntime } }
declare module '@deepseek-ai/dsh-jobs' { interface JobKindMap { antfarm: 'antfarm' } }

/** Owner-scoped admission and lifecycle around durable workflow drivers. */
export class AntfarmRuntime extends Service {
  static inject = ['agents', 'sessions', 'workingDirectory', 'agentPresets', 'jobs', 'subagents', 'subprocess']
  static Config = z.object({
    journalRoot: z.string().required(), workflowDirs: z.array(z.string()).default([]),
    defaultWorkflowId: z.string().default('feature-dev').volatile(), worktreeDirectory: z.string().default('.worktrees/antfarm'),
    defaultStepTimeoutSeconds: z.natural().min(1).max(2147483).default(1800).volatile(),
    subagentProvider: z.string().default('spawn'), maxActiveRunsPerOwner: z.natural().min(1).max(100).default(2),
    maxActiveRuns: z.natural().min(1).max(100).default(8),
    maxAttempts: z.natural().min(1).max(10000).default(500).volatile(),
    maxStories: z.natural().min(1).max(100).default(20).volatile(), maxStoryRetries: z.natural().max(20).default(2).volatile(),
    maxSummaryChars: z.natural().min(1).max(65536).default(8192).volatile(),
    cleanupCompletedWorktrees: z.boolean().default(true).volatile(), cleanupCancelledWorktrees: z.boolean().default(true).volatile(),
    healthEnabled: z.boolean().default(true).volatile(), healthIntervalMs: z.natural().min(1000).max(2147483647).default(300000).volatile(),
    notifyOwner: z.boolean().default(true).volatile(),
    webhookUrl: z.string().role('secret').default('').volatile(), webhookTokenEnv: z.string().role('credential-ref').default('').volatile(),
    githubReviewerTokenEnv: z.string().role('credential-ref').default('').volatile(),
  })
  private readonly admissions = new Map<string, { readonly signature: string; readonly work: Promise<AntfarmRunReceipt> }>()
  private readonly operations = new Map<string, Operation>()
  private closing = false
  private storage!: RunStorage
  private nextNumber = 1
  private readonly evidence: ExecutionEvidence
  private readonly capacity: RunCapacity
  private readonly owners: RunOwnerResolver
  private readonly workflows = new WorkflowManager(resolve(PACKAGE_ROOT, 'workflows'))
  private healthTimer: ReturnType<typeof setTimeout> | undefined
  private healthWork: Promise<AntfarmHealthReport> | undefined
  private readonly healthChecks = new Set<Promise<AntfarmHealthReport>>()
  private readonly healthController = new AbortController()
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'antfarm')
    this.evidence = new ExecutionEvidence(ctx)
    this.capacity = new RunCapacity(config.maxActiveRuns, config.maxActiveRunsPerOwner)
    this.owners = new RunOwnerResolver(ctx)
    ctx.on('loader/volatile-update', () => {
      if (this.healthTimer === undefined || this.healthWork !== undefined) return
      clearTimeout(this.healthTimer); this.scheduleHealth()
    })
    ctx.on('workspace/session-stop', ({ sessionId }) => {
      for (const operation of this.operations.values()) {
        if (operation.owner === sessionId) { operation.interrupted = true; operation.controller.abort(new Error('owning session archived')) }
      }
    })
    ctx.on('agent/disposed', ({ agent }) => {
      for (const operation of this.operations.values()) if (operation.owner === agent.id) { operation.interrupted = true; operation.controller.abort(new Error('owning Agent was unloaded; restore its authority before recovery')) }
    })
    ctx.effect(() => async () => {
      this.closing = true
      clearTimeout(this.healthTimer)
      this.healthController.abort()
      const operations = [...this.operations.values()]
      for (const operation of operations) { operation.interrupted = true; operation.controller.abort(new Error('antfarm service disposed')) }
      await Promise.all(operations.map(operation => operation.done))
      await Promise.allSettled([...this.healthChecks])
      await this.owners.dispose()
      this.storage?.dispose()
    })
  }

  /** Acquire Host ownership, rebuild projections, and recover safe persisted work. */
  async [Service.init](): Promise<void> {
    this.storage = await RunStorage.acquire(this.config.journalRoot)
    const recovered = await this.rebuildIndex()
    for (const journal of recovered) {
      const state = journal.state
      if (!['queued', 'starting', 'running', 'interrupted'].includes(state.status)) continue
      if (state.openAttempt !== null) {
        await journal.append({ type: 'run-interrupt', data: { reason: 'inspect the uncertain native attempt before resuming' } })
        this.project(journal)
        continue
      }
      try {
        const parent = await this.owners.resolve(sessionId(state.start.ownerSessionId))
        const operation = this.admit(state.start.runId, parent)
        operation.journal = journal
        this.project(journal)
        try {
          await this.provider(state.start.provider, state.start.resolvedWorkflowSnapshot, state.start.baseCwd)
          const worktree = await this.worktree(state, operation.controller.signal)
          this.launch(state.start.runId, operation, parent, worktree)
        } catch (error) { this.release(state.start.runId, operation); throw error }
      } catch (error) {
        await journal.append({ type: 'run-interrupt', data: { reason: String(error).slice(0, this.config.maxSummaryChars.get()) } })
        this.project(journal)
      }
    }
    this.scheduleHealth()
  }

  private scheduleHealth(): void {
    if (this.closing) return
    this.healthTimer = setTimeout(() => {
      const work = this.checkHealth()
      this.healthWork = work
      void work.catch(() => {}).finally(() => { this.healthWork = undefined; this.scheduleHealth() })
    }, this.config.healthIntervalMs.get())
    this.healthTimer.unref()
  }

  /**
   * Inspect and persist health diagnostics without accepting work.
   * @param owner - Authorized Session scope, or internal Host scope.
   * @returns Persisted health facts without inferring acceptance.
   */
  checkHealth(owner?: SessionId): Promise<AntfarmHealthReport> {
    const work = this.inspectHealth(owner)
    this.healthChecks.add(work)
    void work.finally(() => { this.healthChecks.delete(work) }).catch(() => {})
    return work
  }

  private async inspectHealth(owner?: SessionId): Promise<AntfarmHealthReport> {
    const findings: AntfarmHealthReport['findings'][number][] = []
    if (!this.config.healthEnabled.get()) return { time: Date.now(), enabled: false, findings }
    for (const row of this.storage.unsettled(owner)) {
      if (this.closing) break
      const existing = this.operations.get(row.runId)
      if (existing !== undefined && existing.journal === undefined) continue
      const diagnostic = existing === undefined ? this.reserve(row.runId, sessionId(row.ownerSessionId)) : undefined
      try {
        const journal = existing?.journal ?? await this.owned(row.runId, sessionId(row.ownerSessionId))
        if (diagnostic !== undefined) diagnostic.journal = journal
        const state = journal.state
        let kind: AntfarmHealthReport['findings'][number]['kind'] | undefined
        let detail = ''
        if (state.openAttempt !== null && existing === undefined) { kind = 'uncertain'; detail = 'inspect the previous native child before granting recovery' }
        else if (existing === undefined && ['queued', 'starting', 'running', 'interrupted'].includes(state.status)) { kind = 'inactive'; detail = 'ensure execution can recover this inactive Run after owner validation' }
        else if (state.openAttempt !== null && Date.now() - (journal.attemptTime ?? state.updatedAt) > (state.start.resolvedWorkflowSnapshot.agents.find(agent => agent.id === state.start.resolvedWorkflowSnapshot.steps.find(step => step.id === state.openAttempt?.stepId)?.agent)?.timeoutSeconds ?? state.start.executionPolicy?.timeoutSeconds ?? this.config.defaultStepTimeoutSeconds.get()) * 1000 + 5000) { kind = 'overdue'; detail = 'native attempt exceeded its expected deadline; inspect cancellation and subprocess teardown' }
        else if (state.status === 'failed' || state.status === 'blocked') { kind = 'retained'; detail = state.checkpoint.blocked ?? state.workspaceReason }
        if (kind !== undefined) {
          findings.push({ runId: row.runId, kind, detail })
          const previous = journal.latest('health')
          if (previous?.type !== 'health' || previous.data.kind !== kind || previous.data.detail !== detail.slice(0, 2048)) {
            await journal.append({ type: 'health', data: { kind, detail: detail.slice(0, 2048) } })
            const eventId = `${row.runId}:${journal.revision}:health`
            if (this.config.notifyOwner.get() && kind !== 'retained') {
              try {
                const parent = await this.resolveOwner(sessionId(row.ownerSessionId))
                await deliverOwnerNotice(journal, parent, eventId, `Antfarm health alert for ${row.runId}: ${detail}`, this.healthController.signal, () => this.ctx.sessions.flush(parent.session))
              } catch { await journal.append({ type: 'notification', data: { id: eventId, channel: 'owner', status: 'failed', detail: 'health notice recipient is unavailable; inspect Run health history' } }) }
            }
            this.project(journal)
          }
        }
      } catch { findings.push({ runId: row.runId, kind: 'unreadable', detail: 'Run evidence is unavailable; retain its workspace and inspect the logs' }) }
      finally { if (diagnostic !== undefined) this.release(row.runId, diagnostic) }
    }
    const report = { time: Date.now(), enabled: true, findings }
    if (!this.closing) this.storage.recordHealth(report)
    return report
  }

  /**
   * Read bounded health history and current monitoring settings.
   * @param owner - Explicit authorized scope.
   * @returns Retained checks and current native settings.
   */
  async healthHistory(owner: SessionId): Promise<AntfarmHealthHistory> { return { ...this.storage.healthHistory(owner), enabled: this.config.healthEnabled.get(), intervalMs: this.config.healthIntervalMs.get() } }

  /**
   * Dispatch safe inactive work through the existing executor.
   * @param owner - Explicit authorization scope.
   * @returns Runs dispatched by the existing sole executor.
   */
  async ensureExecution(owner: SessionId): Promise<string[]> {
    const dispatched: string[] = []
    for (const row of this.storage.unsettled(owner)) {
      if (this.operations.has(row.runId) || !['queued', 'starting', 'running', 'interrupted'].includes(row.status)) continue
      const journal = await this.owned(row.runId, owner)
      if (journal.state.openAttempt !== null) continue
      const parent = await this.resolveOwner(owner)
      const operation = this.admit(row.runId, parent)
      operation.journal = journal
      try {
        await this.provider(journal.state.start.provider, journal.state.start.resolvedWorkflowSnapshot, journal.state.start.baseCwd)
        const worktree = await this.worktree(journal.state, operation.controller.signal)
        this.launch(row.runId, operation, parent, worktree); dispatched.push(row.runId)
      } catch (error) { this.release(row.runId, operation); throw error }
    }
    return dispatched
  }

  /**
   * Rebuild the disposable index from disk after startup or explicit repair.
   * @returns Supported journals available for recovery.
   */
  async rebuildIndex(): Promise<RunJournal[]> {
    this.storage.reset()
    const recovered: RunJournal[] = []
    for (const entry of await readdir(this.config.journalRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^af-[a-z0-9-]{1,64}$/.test(entry.name)) continue
      let identity
      try { identity = await readJournalIdentity(this.config.journalRoot, entry.name) } catch { continue }
      this.nextNumber = Math.max(this.nextNumber, (identity.data.number ?? 0) + 1)
      try {
        let journal: RunJournal
        try { journal = this.operations.get(entry.name)?.journal ?? await RunJournal.open(this.config.journalRoot, entry.name) }
        catch { journal = await RunJournal.recoverTail(this.config.journalRoot, entry.name) }
        this.nextNumber = Math.max(this.nextNumber, (journal.state.start.number ?? 0) + 1)
        this.project(journal)
        recovered.push(journal)
      } catch {
        this.storage.put({ ...identity.data, status: identity.version === 3 ? 'corrupt' : 'legacy', updatedAt: 0, workspaceDisposition: 'retained', workspaceReason: 'unsupported or corrupt evidence; retain for inspection' })
      }
    }
    return recovered
  }

  private policy() {
    return { maxAttempts: this.config.maxAttempts.get(), timeoutSeconds: this.config.defaultStepTimeoutSeconds.get(), maxStories: this.config.maxStories.get(), maxStoryRetries: this.config.maxStoryRetries.get(), maxSummaryChars: this.config.maxSummaryChars.get(), cleanupCompleted: this.config.cleanupCompletedWorktrees.get(), cleanupCancelled: this.config.cleanupCancelledWorktrees.get() }
  }

  private indexFailure: string | undefined
  private project(journal: RunJournal): void {
    try { this.storage.put(this.summary(journal.state)); this.indexFailure = undefined }
    catch (error) { this.indexFailure = String(error) }
  }

  /** Last derived-index error; business evidence remains authoritative. */
  get indexError(): string | undefined { return this.indexFailure }

  /**
   * Restore the original root Session authority without a model turn.
   * @param owner - Original root Session.
   * @returns Native authority without a model turn.
   */
  async resolveOwner(owner: SessionId): Promise<Agent> { return this.owners.resolve(owner) }

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
    const repository = await prepareRepository(this.ctx.subprocess, cwd).catch(() => null)
    return [await projectWorkflowRoot(repository?.root ?? cwd), ...this.config.workflowDirs]
  }

  /**
   * Discover workflows for a selected Session without activating its owner.
   * @param owner - Selected Session.
   * @returns Workflow catalog without resuming a model owner.
   */
  async workflowCatalog(owner: SessionId): Promise<string[]> { return this.workflows.list(await this.observedWorkflowRoots(owner)) }

  /**
   * Read revision-bound workflow resources for a selected Session.
   * @param owner - Selected Session.
   * @param id - Workflow.
   * @returns Editable source without owner activation.
   */
  async workflowDraft(owner: SessionId, id: string): Promise<WorkflowDraft> { return this.workflows.read(id, await this.observedWorkflowRoots(owner)) }

  private async workflowRoots(parent: Agent): Promise<string[]> {
    this.live(parent, new AbortController().signal)
    const cwd = await this.ctx.workingDirectory.ensure(parent)
    const repository = await prepareRepository(this.ctx.subprocess, cwd).catch(() => null)
    return [await projectWorkflowRoot(repository?.root ?? cwd), ...this.config.workflowDirs]
  }

  /**
   * List available workflows under the live owner’s configuration.
   * @param parent - Authorized root.
   * @returns Installed and packaged workflow ids.
   */
  async listWorkflows(parent: Agent): Promise<string[]> { return this.workflows.list(await this.workflowRoots(parent)) }

  /**
   * Read editable workflow resources under the live owner’s configuration.
   * @param parent - Authorized root.
   * @param id - Workflow id.
   * @returns Editable resolved copy.
   */
  async readWorkflow(parent: Agent, id: string): Promise<WorkflowDraft> { return this.workflows.read(id, await this.workflowRoots(parent)) }

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
   * @param workspace - Git or owned file workspace for the imported workflow.
   * @returns Installed project copy.
   */
  async importWorkflow(parent: Agent, directory: string, sourceRoot: string, workspace: 'git' | 'files' = 'git'): Promise<WorkflowDraft> {
    const roots = await this.workflowRoots(parent)
    this.live(parent, new AbortController().signal)
    return this.workflows.import(directory, sourceRoot, roots[0]!, workspace)
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
    if ([...this.operations.values()].some(operation => operation.journal?.state.start.workflowId === id)) throw new Error('settle active workflow Runs before uninstalling their resources')
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
  async setWorkflowEnabled(parent: Agent, id: string, enabled: boolean, force: boolean = false, expected?: WorkflowDraft): Promise<void> {
    const roots = await this.workflowRoots(parent)
    const ids = id === 'all' ? await this.workflows.list(roots) : [id]
    if (!enabled) for (const [runId, operation] of this.operations) {
      if (!ids.includes(operation.journal?.state.start.workflowId ?? '')) continue
      if (!force || operation.owner !== parent.id) throw new Error('settle active workflow Runs before uninstalling; force can cancel only this owner’s Runs')
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
    if (this.closing || this.ctx.agents.get(parent.id) !== parent) throw new Error('antfarm requires the current live initiating agent')
    if (this.ctx.get('workspaceRegistry')?.archivedSessionIds.includes(parent.id)) throw new Error('restore the archived owning session before starting antfarm')
    if (parent.session.header.origin === 'subagent') throw new Error('antfarm workflows require a root initiating session')
  }
  private admit(runId: string, parent: Agent): Operation {
    this.live(parent, new AbortController().signal)
    return this.reserve(runId, parent.id)
  }
  private reserve(runId: string, owner: SessionId): Operation {
    if (this.closing) throw new Error('antfarm service is closing')
    if (this.operations.has(runId)) throw new Error('antfarm run already has an active operation')
    let finish!: () => void
    const operation: Operation = { owner, controller: new AbortController(), done: new Promise(resolve => { finish = resolve }), finish: () => finish() }
    this.operations.set(runId, operation)
    return operation
  }
  private release(runId: string, operation: Operation): void {
    this.operations.delete(runId)
    operation.finish()
  }
  private async provider(name: string, workflow: ResolvedWorkflow, cwd?: string): Promise<void> {
    const provider = this.ctx.subagents.getProvider(name)
    if (provider === undefined || provider.inheritsParentContext || provider.prepareContinuable === undefined || !provider.capabilities.agentPreset || !provider.capabilities.outputSchema || !provider.capabilities.agentOptions) throw new Error(`antfarm provider ${name} must support fresh local preset-based structured activations`)
    for (const role of workflow.agents) {
      const preset = await this.ctx.agentPresets.resolve(role.preset)
      if (preset.broken !== undefined) throw new Error(`antfarm preset ${role.preset} is unavailable: ${preset.broken}`)
      if ((role.skills?.length ?? 0) > 0) {
        const skills = this.ctx.get('skills')
        if (skills === undefined) throw new Error(`role ${role.id} requires the native skill registry`)
        await using scope = await this.ctx.agentPresets.acquireScope(role.preset)
        const catalog = await skills.snapshot({ cwd, scope: scope.key })
        if (!catalog.complete) throw new Error(`role ${role.id} skill discovery is incomplete; check its configured skill roots`)
        for (const name of role.skills ?? []) if (!catalog.skills.some(skill => skill.name === name && skill.invocation.modelInvocable)) throw new Error(`role ${role.id} requires unavailable model skill ${name}`)
      }
    }
  }

  /**
   * Start in an owned worktree after reserving owner capacity and persisting identity.
   * @param request - Task and exact live initiating Agent.
   * @returns Receipt after journal and native job acceptance.
   */
  async start(request: AntfarmStartRequest): Promise<AntfarmRunReceipt> {
    if (request.requestId === undefined) return this.startNew(request)
    if (request.requestId.length === 0 || request.requestId.length > 128) throw new Error('invalid Antfarm admission request identity')
    const key = JSON.stringify([request.parent.id, request.requestId])
    const pending = this.admissions.get(key)
    const signature = JSON.stringify([request.task, request.workflowId, request.notificationUrl])
    if (pending !== undefined) {
      if (pending.signature !== signature) throw new Error('Antfarm request identity was reused with different inputs')
      return pending.work
    }
    const work = this.startNew(request).finally(() => { this.admissions.delete(key) })
    this.admissions.set(key, { signature, work })
    return work
  }

  private async startNew(request: AntfarmStartRequest): Promise<AntfarmRunReceipt> {
    const runId = request.requestId === undefined ? `af-${randomUUID()}` : `af-${createHash('sha256').update(JSON.stringify([request.parent.id, request.requestId])).digest('hex').slice(0, 48)}`
    this.live(request.parent, request.signal ?? new AbortController().signal)
    if (request.requestId !== undefined) {
      try {
        const journal = this.operations.get(runId)?.journal ?? await this.owned(runId, request.parent.id)
        const start = journal.state.start
        if (start.task !== request.task || start.notificationUrl !== request.notificationUrl || (request.workflowId !== undefined && start.workflowId !== request.workflowId)) throw new Error('Antfarm request identity was reused with different inputs')
        const jobId = this.operations.get(runId)?.jobId
        return { runId, ...(jobId === undefined ? {} : { jobId }), workflowId: start.workflowId, status: journal.state.status, workspace: start.workspace, branch: start.branch }
      } catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error }
    }
    const operation = this.admit(runId, request.parent)
    const signal = request.signal === undefined ? operation.controller.signal : AbortSignal.any([request.signal, operation.controller.signal])
    try {
      this.live(request.parent, signal)
      if (request.task.length > 65536) throw new Error('antfarm task exceeds 65536 characters')
      if (request.task.trim() === '') throw new Error('antfarm task must not be empty')
      const cwd = await this.ctx.workingDirectory.ensure(request.parent, signal)
      const repository = await prepareRepository(this.ctx.subprocess, cwd, signal).catch(() => { signal.throwIfAborted(); return null })
      const roots = [await projectWorkflowRoot(repository?.root ?? cwd), ...this.config.workflowDirs]
      const workflow = await loadWorkflow(request.workflowId ?? this.config.defaultWorkflowId.get(), [...roots, resolve(PACKAGE_ROOT, 'workflows')])
      if (workflow.workspace !== 'files' && repository === null) throw new Error('this workflow requires a Git repository with a committed base; choose a file workflow for research or writing')
      if (!await this.workflows.enabled(workflow.id, roots)) throw new Error('workflow is uninstalled; install or enable it before starting a new Run')
      await this.provider(this.config.subagentProvider, workflow, repository?.root ?? cwd)
      this.live(request.parent, signal)
      const worktree = workflow.workspace === 'files' || repository === null ? null : resolveWorktreeSpec(repository, this.config.worktreeDirectory, runId)
      const baseCwd = repository?.root ?? await realpath(cwd)
      const workspace = worktree?.path ?? fileWorkspacePath(baseCwd, runId)
      const fileInputs = worktree === null ? await captureFileInputs(baseCwd, workflow.inputs ?? []) : undefined
      const notificationUrl = request.notificationUrl === undefined ? undefined : publicWebhookUrl(request.notificationUrl)
      const journal = await RunJournal.create(this.config.journalRoot, { runId, ...(request.requestId === undefined ? {} : { requestId: request.requestId }), number: this.nextNumber++, ownerSessionId: request.parent.id, workflowId: workflow.id, task: request.task, baseCwd, baseRevision: repository?.baseRevision ?? '', workspace, branch: worktree?.branch ?? '', workspaceKind: worktree === null ? 'files' : 'git', ...(fileInputs === undefined ? {} : { fileInputs }), provider: this.config.subagentProvider, ...(notificationUrl === undefined ? {} : { notificationUrl }), resolvedWorkflowSnapshot: workflow, ...(this.config.githubReviewerTokenEnv.get() === '' ? {} : { githubReviewerTokenEnv: this.config.githubReviewerTokenEnv.get() }), executionPolicy: this.policy() })
      operation.journal = journal
      this.live(request.parent, signal)
      return this.launch(runId, operation, request.parent, worktree)
    } catch (error) {
      if (operation.journal !== undefined) await operation.journal.append(this.interrupted(operation, request.parent) ? { type: 'run-interrupt', data: { reason: String(error) } } : { type: 'run-end', data: { status: signal.aborted ? 'cancelled' : 'failed', reason: String(error) } }).catch(() => {})
      this.release(runId, operation)
      throw error
    }
  }

  /**
   * Resume from the saved workflow; uncertain attempts require explicit reconciliation guidance.
   * @param request - Original run, live owner and any reconciliation guidance.
   * @returns Receipt for the resumed native job.
   */
  async resume(request: AntfarmResumeRequest): Promise<AntfarmRunReceipt> {
    const operation = this.admit(request.runId, request.parent)
    const signal = request.signal === undefined ? operation.controller.signal : AbortSignal.any([request.signal, operation.controller.signal])
    try {
      operation.journal = await this.owned(request.runId, request.parent.id)
      if (request.revision !== undefined && operation.journal.revision !== request.revision) throw new Error('Run changed; refresh before resuming')
      const state = operation.journal.state
      if (['completed', 'cancelled'].includes(state.status) || state.workspaceDisposition === 'cleaned') throw new Error('antfarm run is not resumable')
      if (state.openAttempt !== null && (request.guidance?.trim() ?? '') === '') throw new Error('inspect the uncertain child and worktree, then supply reconciliation guidance to resume')
      if (state.status === 'failed' && (request.retryGrant ?? 0) < 1) throw new Error('failed antfarm resume requires an explicit retry budget grant')
      const worktree = await this.worktree(state, signal)
      if (state.prepared && worktree !== null) await validateWorktree(this.ctx.subprocess, worktree, signal)
      await this.provider(state.start.provider, state.start.resolvedWorkflowSnapshot, state.start.baseCwd)
      this.live(request.parent, signal)
      await operation.journal.append({ type: 'run-resume', data: { guidance: request.guidance ?? '', retryGrant: request.retryGrant ?? 0 } })
      return this.launch(request.runId, operation, request.parent, worktree)
    } catch (error) {
      this.release(request.runId, operation)
      throw error
    }
  }

  private interrupted(operation: Operation, parent: Agent): boolean {
    // Native owner-job cleanup precedes agent/disposed; the unloading scope is authoritative during that interval.
    if (operation.interrupted === true || this.closing) return true
    try { parent.ctx.fiber.assertActive(); this.ctx.fiber.assertActive(); return false }
    catch { return true }
  }

  private launch(runId: string, operation: Operation, parent: Agent, worktree: WorktreeSpec | null): AntfarmRunReceipt {
    const journal = operation.journal
    if (journal === undefined) throw new Error('antfarm journal was not admitted')
    const policy = journal.state.start.executionPolicy ?? this.policy()
    const currentPolicy = this.policy()
    for (const key of ['maxStories', 'maxStoryRetries', 'maxSummaryChars'] as const) {
      if (policy[key] > currentPolicy[key]) throw new Error(`saved antfarm ${key} exceeds the current deployment limit`)
    }
    if ((policy.maxAttempts ?? 500) > currentPolicy.maxAttempts) throw new Error('saved antfarm attempt budget exceeds the current deployment limit')
    const drive = async () => {
      let release: (() => void) | undefined
      try {
        release = await this.capacity.acquire(parent.id, operation.controller.signal)
        this.live(parent, operation.controller.signal)
        await journal.append({ type: 'run-dispatch', data: {} })
        this.project(journal)
        return await runWorkflow({ subagents: this.ctx.subagents, subprocess: this.ctx.subprocess, evidence: this.evidence, delivery: new GitHubDelivery(this.ctx.subprocess),
          acquireAttempt: async () => {
            await journal.append({ type: 'run-queue', data: {} }); this.project(journal)
            release?.(); release = undefined
            const slot = await this.capacity.acquire(parent.id, operation.controller.signal)
            try { this.live(parent, operation.controller.signal); await journal.append({ type: 'run-dispatch', data: {} }); this.project(journal); return slot }
            catch (error) { slot(); throw error }
          },
          onEvent: async (record, revision) => {
            if (!['workspace-ready', 'attempt-start', 'attempt-end', 'checkpoint', 'run-end', 'run-interrupt'].includes(record.type)) return
            const url = journal.state.start.notificationUrl ?? journal.state.start.resolvedWorkflowSnapshot.notifications?.url ?? journal.state.start.resolvedWorkflowSnapshot.source?.notifications.url ?? this.config.webhookUrl.get()
            const tokenEnv = this.config.webhookTokenEnv.get()
            await deliverWebhook(journal, `${runId}:${revision}`, record.type, record.type === 'attempt-start' ? `${record.data.stepId} ${record.data.execution}` : journal.state.checkpoint.blocked ?? journal.state.status, url, tokenEnv === '' ? undefined : process.env[tokenEnv], operation.controller.signal)
          },
        }, {
          journal, parent, worktree, signal: operation.controller.signal,
          ...policy,
          interrupted: () => this.interrupted(operation, parent), onChange: () => this.project(journal),
        })
      } catch (error) {
        await journal.append(this.interrupted(operation, parent) ? { type: 'run-interrupt', data: { reason: String(error) } } : { type: 'run-end', data: { status: operation.controller.signal.aborted ? 'cancelled' : 'failed', reason: String(error) } })
        return { status: operation.controller.signal.aborted ? 'killed' as const : 'failed' as const, detail: String(error) }
      } finally {
        if (this.config.notifyOwner.get() && ['completed', 'failed', 'cancelled', 'blocked', 'interrupted'].includes(journal.state.status)) {
          await deliverOutcome(journal, parent, '', undefined, new AbortController().signal, () => this.ctx.sessions.flush(parent.session)).catch(() => {})
        }
        this.release(runId, operation); this.project(journal); release?.()
      }
    }
    const jobId = this.ctx.jobs.start({ kind: 'antfarm', label: `antfarm ${journal.state.start.workflowId}: ${journal.state.start.task.slice(0, 120)}`, owner: parent.id,
      run: () => ({ cancel: reason => operation.controller.abort(new Error(reason ?? 'cancelled by user')), done: drive() }),
    })
    operation.jobId = jobId
    this.project(journal)
    const start = journal.state.start
    return { runId, jobId, workflowId: start.workflowId, status: 'queued', workspace: start.workspace, branch: start.branch }
  }

  /**
   * Wait for this Run's whole execution interval and final workspace disposition.
   * @param runId - Owned Run, including a queued execution.
   * @param owner - Session authorizing the wait.
   * @param signal - Optional caller wait cancellation; omission waits until settlement.
   * @returns Completed, failed, cancelled, blocked or interrupted business state.
   */
  async wait(runId: string, owner: SessionId, signal?: AbortSignal): Promise<AntfarmStatus> {
    await this.owned(runId, owner)
    const operation = this.operations.get(runId)
    if (operation !== undefined) {
      if (signal === undefined) await operation.done
      else {
        signal.throwIfAborted()
        let abort!: () => void
        const cancelled = new Promise<never>((_resolve, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }) })
        try { await Promise.race([operation.done, cancelled]) } finally { signal.removeEventListener('abort', abort) }
      }
    }
    return this.status(runId, owner)
  }

  private summary(state: FoldedRun): AntfarmRunSummary {
    const start = state.start
    const operation = this.operations.get(start.runId)
    const step = start.resolvedWorkflowSnapshot.steps[state.checkpoint.cursor]
    return { revision: state.revision, runId: start.runId, ...(start.number === undefined ? {} : { number: start.number }), task: start.task, workflowId: start.workflowId, status: operation?.jobId !== undefined ? state.status : state.status === 'starting' || state.status === 'running' ? 'interrupted' : state.status,
      workspace: start.workspace, branch: start.branch, ownerSessionId: start.ownerSessionId, updatedAt: state.updatedAt,
      workspaceDisposition: state.workspaceDisposition, workspaceReason: state.workspaceReason,
      acceptedStories: state.checkpoint.stories?.filter(story => story.status === 'done').length ?? 0, totalStories: state.checkpoint.stories?.length ?? 0,
      reason: state.checkpoint.blocked ?? state.workspaceReason,
      ...operation?.jobId === undefined ? {} : { jobId: operation.jobId }, ...step === undefined ? {} : { currentStep: step.id } }
  }
  private async owned(runId: string, owner: SessionId): Promise<RunJournal> {
    const identity = await readJournalIdentity(this.config.journalRoot, runId)
    if (identity.data.ownerSessionId !== owner) throw new Error('antfarm run is not visible to this session')
    return RunJournal.open(this.config.journalRoot, runId)
  }
  private async worktree(state: FoldedRun, signal?: AbortSignal): Promise<WorktreeSpec | null> {
    if (state.start.workspaceKind === 'files') {
      if (fileWorkspacePath(state.start.baseCwd, state.start.runId) !== state.start.workspace) throw new Error('recorded file workspace identity changed')
      if (state.prepared) await validateFileWorkspace(state.start.workspace, state.start.runId)
      return null
    }
    const repository = await prepareRepository(this.ctx.subprocess, state.start.baseCwd, signal)
    if (repository.root !== state.start.baseCwd) throw new Error('recorded repository root changed')
    const directory = relative(repository.root, dirname(state.start.workspace))
    const worktree = resolveWorktreeSpec({ ...repository, baseRevision: state.start.baseRevision }, directory, state.start.runId)
    if (worktree.path !== state.start.workspace || worktree.branch !== state.start.branch) throw new Error('recorded worktree identity changed')
    return worktree
  }

  /**
   * Read up to fifty recent runs attributed to the selected session, including terminal evidence.
   * @param owner - Session authorizing the listing.
   * @returns Recent owner-attributed run summaries.
   */
  async list(owner: SessionId): Promise<AntfarmRunSummary[]> {
    return this.storage.list(owner)
  }

  /**
   * Read a bounded page of Runs authorized by explicit Session resources.
   * @param owners - Explicit authorized resources.
   * @param offset - Number of newer rows already read.
   * @returns Bounded indexed page.
   */
  async page(owners: readonly SessionId[], offset: number): Promise<AntfarmRunSummary[]> { return this.storage.page(owners, offset) }

  /**
   * Inspect accepted context and durable native child identities under session ownership.
   * @param runId - Durable run identity.
   * @param owner - Session authorizing inspection.
   * @returns Accepted state and any uncertain child attempt.
   */
  async status(runId: string, owner: SessionId): Promise<AntfarmStatus> {
    const journal = this.operations.get(runId)?.journal ?? await this.owned(runId, owner)
    if (journal.state.start.ownerSessionId !== owner) throw new Error('antfarm run is not visible to this session')
    const state = journal.state
    return { summary: this.summary(state), context: state.checkpoint.context, stories: state.checkpoint.stories ?? [], childSessionIds: [...state.childSessionIds], uncertain: state.openAttempt !== null,
      steps: state.start.resolvedWorkflowSnapshot.steps.map((step, index) => ({ id: step.id, agent: step.agent, accepted: index < state.checkpoint.cursor })),
      acceptedChecks: state.checkpoint.acceptedChecks ?? {}, artifacts: state.artifacts, retryGrant: state.retryGrant,
      checkEvidence: state.checks.slice(-50).map(check => ({ ...check, stdout: check.stdout.slice(-2048), stderr: check.stderr.slice(-2048) })),
      ...(state.start.executionPolicy === undefined ? {} : { executionPolicy: state.start.executionPolicy }) }
  }

  /**
   * Resolve a unique owned Run by id, number, prefix or task text.
   * @param query - Exact id, stable number, id prefix or task text.
   * @param owner - Authorized owner.
   * @returns Unique run id.
   */
  async find(query: string, owner: SessionId): Promise<string> {
    if (query.trim() === '') throw new Error('select an Antfarm Run id, number or task')
    const matches = this.storage.search(owner, query)
    if (matches.length !== 1) throw new Error(matches.length === 0 ? 'no matching Antfarm Run' : 'multiple Runs match; select an exact Run id or number')
    return matches[0]!.runId
  }

  /**
   * Read bounded committed events after an exclusive sequence cursor.
   * @param runId - Owned Run.
   * @param owner - Authorization resource.
   * @param after - Exclusive cursor.
   * @returns Up to fifty bounded facts.
   */
  async events(runId: string, owner: SessionId, after: number): Promise<AntfarmEventSummary[]> {
    const journal = await this.owned(runId, owner)
    return journal.records(after, 50).map(event => ({ seq: event.seq, time: event.time, type: event.type,
      detail: JSON.stringify(event.data).slice(0, 2048) }))
  }

  /**
   * Read a verified UTF-8 preview of a retained artifact.
   * @param runId - Owned Run.
   * @param owner - Authorization resource.
   * @param sha256 - Retained artifact.
   * @returns Bounded UTF-8 output text.
   */
  async artifact(runId: string, owner: SessionId, sha256: string): Promise<string> {
    const content = await this.artifactContent(runId, owner, sha256)
    const bytes = Buffer.from(content.base64, 'base64')
    if (bytes.length > 1024 * 1024 || content.mime !== 'text/plain') throw new Error('artifact exceeds the 1 MiB UTF-8 text preview limit')
    return bytes.toString('utf8')
  }

  /**
   * Read digest-verified retained bytes for download.
   * @param runId - Owned Run.
   * @param owner - Authorization resource.
   * @param sha256 - Retained digest.
   * @returns Verified output up to sixteen MiB.
   */
  async artifactContent(runId: string, owner: SessionId, sha256: string): Promise<AntfarmArtifactContent> {
    const journal = await this.owned(runId, owner)
    const artifact = journal.state.artifacts.find(value => value.sha256 === sha256)
    if (artifact === undefined || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('artifact is not retained by this Run')
    if (artifact.bytes > 16 * 1024 * 1024) throw new Error('artifact exceeds the sixteen MiB download limit')
    const path = resolve(dirname(journal.eventsPath), 'artifacts', sha256)
    if (await realpath(path) !== path) throw new Error('retained artifact must not be a symbolic link')
    const bytes = await readFile(path)
    if (bytes.length !== artifact.bytes || createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('retained artifact integrity check failed')
    const text = bytes.toString('utf8')
    const mime = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png' : bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'image/jpeg' : Buffer.from(text).equals(bytes) ? 'text/plain' : 'application/octet-stream'
    return { path: artifact.path, mime, base64: bytes.toString('base64') }
  }

  /**
   * Cancel and await the active driver, or settle inactive owned evidence under a writer lease.
   * @param runId - Run to settle.
   * @param owner - Session authorizing cancellation.
   * @param reason - Diagnostic recorded in durable evidence.
   * @param revision - Optional expected journal revision; stale operations are refused.
   * @returns Summary after cancellation and active teardown.
   */
  async cancel(runId: string, owner: SessionId, reason: string = 'cancelled by user', revision?: number): Promise<AntfarmRunSummary> {
    await this.owned(runId, owner)
    const active = this.operations.get(runId)
    if (active !== undefined) {
      if (revision !== undefined && active.journal?.revision !== revision) throw new Error('Run changed; refresh before cancelling')
      active.controller.abort(new Error(reason)); await active.done; return (await this.status(runId, owner)).summary
    }
    const operation = this.reserve(runId, owner)
    try {
      const current = await this.owned(runId, owner)
      operation.journal = current
      if (revision !== undefined && current.revision !== revision) throw new Error('Run changed; refresh before cancelling')
      if (['completed', 'failed', 'cancelled'].includes(current.state.status)) throw new Error('antfarm run is already settled')
      operation.controller.signal.throwIfAborted()
      await current.append({ type: 'run-end', data: { status: 'cancelled', reason } })
      await current.append({ type: 'workspace-disposition', data: { disposition: 'retained', reason } })
      this.project(current)
      return this.summary(current.state)
    } finally { this.release(runId, operation) }
  }

  /**
   * Remove only an inactive, identity-validated, clean worktree; retain its branch.
   * @param runId - Settled run whose workspace was reviewed.
   * @param owner - Session authorizing cleanup.
   * @param revision - Optional expected journal revision; stale operations are refused.
   * @returns Updated workspace disposition and retention reason.
   */
  async cleanup(runId: string, owner: SessionId, revision?: number): Promise<AntfarmRunSummary> {
    if (this.operations.has(runId)) throw new Error('cannot clean an active antfarm operation')
    await this.owned(runId, owner)
    const operation = this.reserve(runId, owner)
    try {
      const current = await this.owned(runId, owner)
      operation.journal = current
      if (revision !== undefined && current.revision !== revision) throw new Error('Run changed; refresh before cleaning')
      if (current.state.workspaceDisposition === 'cleaned') return this.summary(current.state)
      if (!['completed', 'failed', 'cancelled'].includes(current.state.status)) throw new Error('cancel or complete the run before cleaning its workspace')
      const spec = await this.worktree(current.state, operation.controller.signal)
      operation.controller.signal.throwIfAborted()
      let result
      if (spec === null) {
        const candidate = await fileCandidateVersion(current.state.start.workspace)
        const artifacts = await retainFileOutputs(current.state.start.workspace, resolve(dirname(current.eventsPath), 'artifacts'))
        if (candidate !== await fileCandidateVersion(current.state.start.workspace)) throw new Error('file outputs changed during retention; inspect before cleaning')
        await current.append({ type: 'file-artifacts', data: { candidate, artifacts } })
        await rm(current.state.start.workspace, { recursive: true })
        result = { disposition: 'cleaned' as const, reason: 'immutable file artifacts retained' }
      } else result = await cleanupWorktree(this.ctx.subprocess, spec)
      await current.append({ type: 'workspace-disposition', data: { disposition: result.disposition, reason: result.reason ?? '' } })
      this.project(current)
      return this.summary(current.state)
    } finally { this.release(runId, operation) }
  }
}
/** Parsed Host settings; volatile defaults are captured once per Run. */
export type Config = ReturnType<typeof AntfarmRuntime.Config>
export type { AntfarmResumeRequest, AntfarmRunReceipt, AntfarmStartRequest } from './types.ts'
export default AntfarmRuntime
