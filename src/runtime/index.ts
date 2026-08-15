import { randomUUID } from 'node:crypto'
import { readdir, realpath } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JobId } from '@deepseek-ai/dsh-jobs'
import z from '@deepseek-ai/schemastery'
import { foldJournal, type FoldedRun } from '../persistence/fold.ts'
import { RunJournal, readJournalMeta } from '../persistence/journal.ts'
import { loadWorkflow } from '../workflow/loader.ts'
import { cleanupWorktree, prepareRepository, resolveWorktreeSpec, runGit, validateWorktree } from '../workspace/git.ts'
import type { PreparedRepository, WorktreeSpec } from '../workspace/git.ts'
import { runWorkflow } from './orchestrator.ts'
import type { AntfarmResumeRequest, AntfarmRoleToolRestrictions, AntfarmRunReceipt, AntfarmRunSummary, AntfarmStartRequest, AntfarmStatus } from './types.ts'

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_ROLE_RESTRICTIONS: AntfarmRoleToolRestrictions = {
  analysis: { deny: ['write', 'edit', 'bash'] },
  verification: { deny: ['write', 'edit'] },
  testing: { deny: ['write', 'edit'] },
  pr: { deny: ['write', 'edit'] },
  scanning: { deny: ['write', 'edit'] },
}

export interface Config {
  readonly journalRoot: string
  readonly workflowDirs?: string[]
  readonly worktreeDirectory?: string
  readonly defaultIsolation?: 'worktree' | 'shared'
  readonly defaultStepTimeoutSeconds?: number
  readonly subagentProvider?: string
  readonly maxActiveRunsPerOwner?: number
  readonly roleToolRestrictions?: AntfarmRoleToolRestrictions
  readonly envFiles?: string[]
  readonly cleanupCompletedWorktrees?: boolean
  readonly cleanupCancelledWorktrees?: boolean
}

interface MutableSummary {
  runId: string
  jobId?: JobId
  workflowId: string
  status: AntfarmRunSummary['status']
  workspace: string
  branch: string
  currentStep?: string
  ownerSessionId: string
  baseCwd: string
  baseRevision: string
  isolation: 'worktree' | 'shared'
  provider: string
  model?: string
}

declare module '@deepseek-ai/cordis' {
  interface Context { antfarm: AntfarmRuntime }
}

declare module '@deepseek-ai/dsh-jobs' {
  interface JobKindMap { antfarm: 'antfarm' }
}

function copySummary(summary: MutableSummary): AntfarmRunSummary {
  return { ...summary }
}

function worktreeFor(folded: FoldedRun, repository: PreparedRepository, directory: string): WorktreeSpec | undefined {
  if (folded.isolation !== 'worktree') return undefined
  return { ...resolveWorktreeSpec({ ...repository, baseRevision: folded.baseRevision }, directory, folded.runId), branch: folded.branch, path: folded.workspace }
}

/** Host-wide antfarm registry, scheduler, reconciliation and resume service. */
export class AntfarmRuntime extends Service {
  static inject = ['jobs', 'subagents', 'subprocess']
  static Config: z<Config> = z.object({
    journalRoot: z.string().required(),
    workflowDirs: z.array(z.string()).default([]),
    worktreeDirectory: z.string().default('.worktrees/antfarm'),
    defaultIsolation: z.union(['worktree', 'shared'] as const).default('worktree'),
    defaultStepTimeoutSeconds: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(1800),
    subagentProvider: z.string().default('spawn'),
    maxActiveRunsPerOwner: z.natural().min(1).max(Number.MAX_SAFE_INTEGER).default(2),
    roleToolRestrictions: z.dict(z.union([
      z.object({ allow: z.array(z.string()), deny: z.array(z.string()) }),
      z.const(null),
    ])).default({}),
    envFiles: z.array(z.string()).default([]),
    cleanupCompletedWorktrees: z.boolean().default(true),
    cleanupCancelledWorktrees: z.boolean().default(true),
  }) as unknown as z<Config>
  private readonly runs = new Map<string, MutableSummary>()
  private readonly sharedOwners = new Map<string, string>()
  private readonly controllers = new Map<string, AbortController>()
  private readonly workflowRoots: readonly string[]
  private readonly ready: Promise<void>

  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'antfarm')
    this.workflowRoots = [...(config.workflowDirs ?? []), resolve(PACKAGE_ROOT, 'workflows')]
    this.ready = this.reconcileRuns()
  }

  /** Start one background workflow after deterministic preflight. */
  async start(request: AntfarmStartRequest): Promise<AntfarmRunReceipt> {
    await this.ready
    request.signal?.throwIfAborted()
    if (request.task.trim() === '') throw new Error('antfarm task must not be empty')
    const cwd = await realpath(request.cwd ?? request.parent.session.header.cwd ?? process.cwd())
    const repository = await prepareRepository(this.ctx.subprocess, cwd, request.signal)
    const workflow = await loadWorkflow(request.workflowId, [resolve(repository.root, '.antfarm/workflows'), ...this.workflowRoots])
    const isolation = request.isolation ?? this.config.defaultIsolation ?? 'worktree'
    const provider = request.provider ?? this.config.subagentProvider ?? 'spawn'
    const registered = this.ctx.subagents.getProvider(provider)
    if (registered === undefined) throw new Error(`antfarm subagent provider "${provider}" is not registered`)
    if (!registered.capabilities.persona || !registered.capabilities.toolFilter) {
      throw new Error(`antfarm provider "${provider}" must support persona and toolFilter`)
    }
    const ownerSessionId = String(request.parent.id)
    const active = [...this.runs.values()].filter(run => run.ownerSessionId === ownerSessionId && (run.status === 'starting' || run.status === 'running'))
    if (active.length >= (this.config.maxActiveRunsPerOwner ?? 2)) throw new Error(`owner already has ${active.length} active antfarm run(s)`)
    if (isolation === 'shared' && (this.config.envFiles?.length ?? 0) > 0) throw new Error('envFiles cannot be copied into shared isolation')
    const runId = `af-${randomUUID().slice(0, 12)}`
    const worktree = isolation === 'worktree'
      ? resolveWorktreeSpec(repository, this.config.worktreeDirectory ?? '.worktrees/antfarm', runId)
      : undefined
    const workspace = worktree?.path ?? repository.root
    const branch = worktree?.branch ?? await this.currentBranch(repository.root, request.signal)
    if (isolation === 'shared') {
      const existing = this.sharedOwners.get(repository.root)
      if (existing !== undefined) throw new Error(`shared workspace ${repository.root} is already owned by antfarm run ${existing}`)
    }
    const controller = new AbortController()
    const summary: MutableSummary = {
      runId,
      workflowId: workflow.id,
      status: 'starting',
      workspace,
      branch,
      ownerSessionId,
      baseCwd: repository.root,
      baseRevision: repository.baseRevision,
      isolation,
      provider,
      ...(request.model === undefined ? {} : { model: request.model }),
    }
    const jobId = this.ctx.jobs.start({
      kind: 'antfarm',
      label: `antfarm ${workflow.id}: ${request.task.slice(0, 120)}`,
      owner: request.parent,
      run: () => ({
        cancel: reason => controller.abort(new Error(reason ?? 'antfarm run cancelled')),
        done: runWorkflow(
          { subagents: this.ctx.subagents, subprocess: this.ctx.subprocess },
          {
            runId,
            parent: request.parent,
            provider,
            ...(request.model === undefined ? {} : { model: request.model }),
            task: request.task,
            workflow,
            isolation,
            workspace,
            branch,
            baseCwd: repository.root,
            baseRevision: repository.baseRevision,
            baseStatus: repository.baseStatus,
            journalRoot: this.config.journalRoot,
            ...(worktree === undefined ? {} : { worktree }),
            timeoutSeconds: this.config.defaultStepTimeoutSeconds ?? 1800,
            cleanupCompleted: this.config.cleanupCompletedWorktrees ?? true,
            cleanupCancelled: this.config.cleanupCancelledWorktrees ?? true,
            roleToolRestrictions: this.effectiveRestrictions(),
            envFiles: this.config.envFiles ?? [],
            ...(worktree === undefined ? {} : { progressPath: join(workspace, '.antfarm', `progress-${runId}.md`) }),
            signal: controller.signal,
            onStep: stepId => {
              if (stepId === undefined) delete summary.currentStep
              else summary.currentStep = stepId
            },
            onStatus: status => { summary.status = status },
          },
        ).finally(() => {
          this.controllers.delete(runId)
          if (isolation === 'shared' && this.sharedOwners.get(repository.root) === runId) this.sharedOwners.delete(repository.root)
        }),
      }),
    })
    summary.jobId = jobId
    this.runs.set(runId, summary)
    this.controllers.set(runId, controller)
    if (isolation === 'shared') this.sharedOwners.set(repository.root, runId)
    return { runId, jobId, workflowId: workflow.id, status: 'starting', workspace, branch }
  }

  /** Return bounded summaries visible to one owning agent. */
  async list(caller: Agent): Promise<AntfarmRunSummary[]> {
    await this.ready
    return [...this.runs.values()]
      .filter(run => run.ownerSessionId === String(caller.id) && (run.status === 'starting' || run.status === 'running' || run.status === 'interrupted' || run.status === 'blocked'))
      .slice(-50)
      .map(copySummary)
  }

  /** Return folded durable state for one owning agent. */
  async status(runId: string, caller: Agent): Promise<AntfarmStatus> {
    await this.ready
    const summary = await this.authorize(runId, caller)
    const folded = await this.fold(runId)
    return {
      summary: copySummary(summary),
      context: folded.context,
      stories: folded.stories.map(story => ({ id: story.id, title: story.title, status: story.status, retryCount: story.retryCount, ...(story.feedback === undefined ? {} : { feedback: story.feedback }) })),
    }
  }

  /** Request cancellation of an active run. */
  async cancel(runId: string, caller: Agent, reason = 'cancelled by user'): Promise<AntfarmRunSummary> {
    await this.ready
    const summary = await this.authorize(runId, caller)
    if (summary.jobId !== undefined && (summary.status === 'starting' || summary.status === 'running')) {
      this.ctx.jobs.kill(summary.jobId, caller, reason)
      return copySummary(summary)
    }
    if (summary.status === 'blocked' || summary.status === 'interrupted') {
      const journal = await RunJournal.open(this.config.journalRoot, runId)
      await journal.append('run-end', { runId, stopReason: 'cancelled', error: reason })
      summary.status = 'cancelled'
      return copySummary(summary)
    }
    throw new Error(`antfarm run "${runId}" is not cancellable (status ${summary.status})`)
  }

  /** Explicitly resume a blocked or interrupted run under the original owner. */
  async resume(request: AntfarmResumeRequest): Promise<AntfarmRunReceipt> {
    await this.ready
    request.signal?.throwIfAborted()
    const summary = await this.authorize(request.runId, request.parent)
    if (summary.status !== 'blocked' && summary.status !== 'interrupted') throw new Error(`antfarm run "${request.runId}" is not resumable (status ${summary.status})`)
    const folded = await this.fold(request.runId)
    const repository = await prepareRepository(this.ctx.subprocess, folded.baseCwd, request.signal)
    const worktree = worktreeFor(folded, repository, this.config.worktreeDirectory ?? '.worktrees/antfarm')
    if (worktree !== undefined) await validateWorktree(this.ctx.subprocess, worktree, request.signal)
    else if (await this.currentBranch(repository.root, request.signal) !== folded.branch) throw new Error(`shared workspace branch changed from ${folded.branch}`)
    const provider = folded.provider || this.config.subagentProvider || 'spawn'
    const registered = this.ctx.subagents.getProvider(provider)
    if (registered === undefined || !registered.capabilities.persona || !registered.capabilities.toolFilter) throw new Error(`antfarm provider "${provider}" is unavailable for resume`)
    const controller = new AbortController()
    const nextSummary: MutableSummary = { ...summary, status: 'starting', provider, ...(folded.model === undefined ? {} : { model: folded.model }) }
    const jobId = this.ctx.jobs.start({
      kind: 'antfarm',
      label: `antfarm resume ${folded.workflowId}`,
      owner: request.parent,
      run: () => ({
        cancel: reason => controller.abort(new Error(reason ?? 'antfarm run cancelled')),
        done: runWorkflow(
          { subagents: this.ctx.subagents, subprocess: this.ctx.subprocess },
          {
            runId: folded.runId,
            parent: request.parent,
            provider,
            ...(folded.model === undefined ? {} : { model: folded.model }),
            task: folded.task,
            workflow: folded.workflow,
            isolation: folded.isolation,
            workspace: folded.workspace,
            branch: folded.branch,
            baseCwd: folded.baseCwd,
            baseRevision: folded.baseRevision,
            baseStatus: folded.baseStatus,
            journalRoot: this.config.journalRoot,
            ...(worktree === undefined ? {} : { worktree }),
            timeoutSeconds: this.config.defaultStepTimeoutSeconds ?? 1800,
            cleanupCompleted: this.config.cleanupCompletedWorktrees ?? true,
            cleanupCancelled: this.config.cleanupCancelledWorktrees ?? true,
            roleToolRestrictions: this.effectiveRestrictions(),
            envFiles: this.config.envFiles ?? [],
            resume: folded,
            ...(request.guidance === undefined ? {} : { resumeGuidance: request.guidance }),
            signal: controller.signal,
            onStep: stepId => {
              if (stepId === undefined) delete nextSummary.currentStep
              else nextSummary.currentStep = stepId
            },
            onStatus: status => { nextSummary.status = status },
          },
        ).finally(() => {
          this.controllers.delete(folded.runId)
          if (folded.isolation === 'shared' && this.sharedOwners.get(folded.baseCwd) === folded.runId) this.sharedOwners.delete(folded.baseCwd)
        }),
      }),
    })
    nextSummary.jobId = jobId
    this.runs.set(folded.runId, nextSummary)
    this.controllers.set(folded.runId, controller)
    return { runId: folded.runId, jobId, workflowId: folded.workflowId, status: 'starting', workspace: folded.workspace, branch: folded.branch }
  }

  /** Clean one retained worktree after a human has reviewed it. */
  async cleanup(runId: string, caller: Agent): Promise<AntfarmRunSummary> {
    await this.ready
    const summary = await this.authorize(runId, caller)
    if (summary.status === 'starting' || summary.status === 'running') throw new Error(`cannot clean active antfarm run "${runId}"`)
    const folded = await this.fold(runId)
    const repository = await prepareRepository(this.ctx.subprocess, folded.baseCwd)
    const worktree = worktreeFor(folded, repository, this.config.worktreeDirectory ?? '.worktrees/antfarm')
    if (worktree === undefined) return copySummary(summary)
    const journal = await RunJournal.open(this.config.journalRoot, runId)
    const result = await cleanupWorktree(this.ctx.subprocess, worktree)
    if (result.disposition === 'cleaned') await journal.append('workspace-cleaned', { runId, path: folded.workspace })
    else await journal.append('workspace-retained', { runId, path: folded.workspace, reason: result.reason ?? 'cleanup declined' })
    return copySummary(summary)
  }

  private async authorize(runId: string, caller: Agent): Promise<MutableSummary> {
    let summary = this.runs.get(runId)
    if (summary === undefined) {
      try {
        const folded = await this.fold(runId)
        summary = {
          runId: folded.runId,
          workflowId: folded.workflowId,
          status: folded.status === 'active' ? 'interrupted' : folded.status,
          workspace: folded.workspace,
          branch: folded.branch,
          ...(folded.currentStep === undefined ? {} : { currentStep: folded.currentStep }),
          ownerSessionId: folded.ownerSessionId,
          baseCwd: folded.baseCwd,
          baseRevision: folded.baseRevision,
          isolation: folded.isolation,
          provider: folded.provider,
          ...(folded.model === undefined ? {} : { model: folded.model }),
        }
        this.runs.set(runId, summary)
      } catch {
        throw new Error(`antfarm run "${runId}" is not visible to this agent`)
      }
    }
    if (summary.ownerSessionId !== String(caller.id)) throw new Error(`antfarm run "${runId}" is not visible to this agent`)
    return summary
  }

  private async fold(runId: string): Promise<FoldedRun> {
    const journal = await RunJournal.open(this.config.journalRoot, runId)
    return foldJournal(await journal.load())
  }

  private async reconcileRuns(): Promise<void> {
    let entries
    try {
      entries = await readdir(resolve(this.config.journalRoot), { withFileTypes: true })
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      try {
        const meta = await readJournalMeta(this.config.journalRoot, entry.name)
        if (meta.statusHint !== 'active' && meta.statusHint !== 'blocked') continue
        const folded = await this.fold(entry.name)
        if (folded.status === 'completed' || folded.status === 'failed' || folded.status === 'cancelled') continue
        const status: AntfarmRunSummary['status'] = folded.status === 'blocked' ? 'blocked' : 'interrupted'
        this.runs.set(folded.runId, { runId: folded.runId, workflowId: folded.workflowId, status, workspace: folded.workspace, branch: folded.branch, ...(folded.currentStep === undefined ? {} : { currentStep: folded.currentStep }), ownerSessionId: folded.ownerSessionId, baseCwd: folded.baseCwd, baseRevision: folded.baseRevision, isolation: folded.isolation, provider: folded.provider, ...(folded.model === undefined ? {} : { model: folded.model }) })
        if (folded.isolation === 'shared') this.sharedOwners.set(folded.baseCwd, folded.runId)
      } catch {
        // A malformed journal remains visible to an explicit status call through its read error; startup does not execute it.
      }
    }
  }

  private effectiveRestrictions(): AntfarmRoleToolRestrictions {
    return { ...DEFAULT_ROLE_RESTRICTIONS, ...(this.config.roleToolRestrictions ?? {}) }
  }

  private async currentBranch(cwd: string, signal?: AbortSignal): Promise<string> {
    const result = await runGit(this.ctx.subprocess, cwd, ['branch', '--show-current'], signal)
    if (result.exitCode !== 0 || result.stdout.trim() === '') throw new Error('shared isolation requires a named current branch')
    return result.stdout.trim()
  }
}

export type { AntfarmResumeRequest, AntfarmRunReceipt, AntfarmRunSummary, AntfarmStartRequest, AntfarmStatus } from './types.ts'
export default AntfarmRuntime
