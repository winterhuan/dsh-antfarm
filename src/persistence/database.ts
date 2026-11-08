/** Authoritative Antfarm rows and atomic worker transitions. Derived from snarktank/antfarm; see NOTICE. */
import { DatabaseSync } from 'node:sqlite'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { ResolvedWorkflow, LoopConfig } from '../workflow/types.ts'
import { migrate } from './schema.ts'

/** Original run row. */
const runRowSchema = z.object({
  id: z.string(),
  workflow_id: z.string(),
  task: z.string(),
  status: z.string(),
  context: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  notify_url: z.string().nullable(),
  run_number: z.number(),
})
export type RunRow = z.infer<typeof runRowSchema>
/** Original step row. */
const stepRowSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  step_id: z.string(),
  agent_id: z.string(),
  step_index: z.number(),
  input_template: z.string(),
  expects: z.string(),
  status: z.enum(['pending', 'waiting', 'running', 'done', 'failed', 'skipped']),
  output: z.string().nullable(),
  retry_count: z.number(),
  max_retries: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  type: z.string(),
  loop_config: z.string().nullable(),
  current_story_id: z.string().nullable(),
  abandoned_count: z.number(),
})
export type StepRow = z.infer<typeof stepRowSchema>
/** Original story row. */
const storyRowSchema = z.object({
  id: z.string(),
  run_id: z.string(),
  story_index: z.number(),
  story_id: z.string(),
  title: z.string(),
  description: z.string(),
  acceptance_criteria: z.string(),
  status: z.enum(['pending', 'running', 'done', 'failed']),
  output: z.string().nullable(),
  retry_count: z.number(),
  max_retries: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type StoryRow = z.infer<typeof storyRowSchema>
/** DSH association; workflow progress remains in the original tables. */
const runBindingSchema = z.object({
  run_id: z.string(),
  owner: z.string(),
  cwd: z.string(),
  workflow: z.string(),
  request_id: z.string().nullable(),
  revision: z.number(),
  paused: z.number(),
  reason: z.string().nullable(),
})
export type RunBinding = z.infer<typeof runBindingSchema>
/** Native execution identity used to reject duplicate or late results. */
const attemptRowSchema = z.object({
  session_id: z.string(),
  run_id: z.string(),
  step_id: z.string(),
  agent_id: z.string(),
  pid: z.number(),
  state: z.string(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
})
export type AttemptRow = z.infer<typeof attemptRowSchema>
/** Original observation event. */
export interface WorkflowEvent {
  ts: string
  event: string
  runId: string
  workflowId?: string | undefined
  stepId?: string | undefined
  agentId?: string | undefined
  storyId?: string | undefined
  storyTitle?: string | undefined
  detail?: string | undefined
}
/** Claimed input and the native Session reserved for it. */
export interface ClaimedStep {
  step: StepRow
  sessionId: string
  input: string
}
const now = () => new Date().toISOString()
/** @param output - Original KEY: value response. @returns Lowercase context entries. */
export function parseOutputKeyValues(output: string): Record<string, string> {
  const values: Record<string, string> = {}
  let key: string | undefined
  for (const line of output.split('\n')) {
    const match = /^([A-Z_]+):\s*(.*)$/.exec(line)
    if (match) {
      key = match[1]!.toLowerCase()
      values[key] = match[2]!
    } else if (key) values[key] += '\n' + line
  }
  for (const key of Object.keys(values)) values[key] = values[key]!.trim()
  delete values.stories_json
  return values
}
/** @param template - Original input. @param context - Run facts. @returns Input with case-insensitive placeholders. */
export function resolveTemplate(template: string, context: Readonly<Record<string, string>>): string {
  return template.replace(
    /\{\{(\w+(?:\.\w+)*)\}\}/g,
    (_match, key: string) => context[key] ?? context[key.toLowerCase()] ?? `[missing: ${key}]`,
  )
}
/** One database connection; each multi-row transition commits as a unit. */
export class AntfarmDatabase {
  readonly db: DatabaseSync
  private readonly eventPath: string
  private pendingEvents: WorkflowEvent[] | undefined
  private hostToken: string | undefined
  /** @param path - antfarm.db path, distinct from historical journal directories. */
  constructor(
    path: string,
    private readonly onEvent?: (event: WorkflowEvent, endpoint: string | null) => void,
  ) {
    mkdirSync(dirname(path), { recursive: true })
    this.eventPath = join(dirname(path), 'events.jsonl')
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000')
    migrate(this.db)
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS dsh_runs (run_id TEXT PRIMARY KEY REFERENCES runs(id), owner TEXT NOT NULL, cwd TEXT NOT NULL, workflow TEXT NOT NULL, request_id TEXT, revision INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, reason TEXT, UNIQUE(owner,request_id));
      CREATE TABLE IF NOT EXISTS dsh_attempts (session_id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), step_id TEXT NOT NULL REFERENCES steps(id), agent_id TEXT NOT NULL, pid INTEGER NOT NULL, state TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS dsh_active_step ON dsh_attempts(step_id) WHERE state='running';
      CREATE UNIQUE INDEX IF NOT EXISTS dsh_active_agent ON dsh_attempts(agent_id) WHERE state='running';
      CREATE TABLE IF NOT EXISTS dsh_host (id INTEGER PRIMARY KEY CHECK(id=1), pid INTEGER NOT NULL, token TEXT NOT NULL);`)
  }
  /** Acquire the exclusive native dispatcher; original business rows remain accessible to readers. */
  acquireHost(): void {
    const token = randomUUID()
    this.transaction(() => {
      const row = this.db.prepare('SELECT pid FROM dsh_host WHERE id=1').get()
      if (row) {
        try {
          process.kill(Number(row.pid), 0)
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) throw error
          this.db.prepare('DELETE FROM dsh_host WHERE id=1').run()
        }
        if (this.db.prepare('SELECT 1 FROM dsh_host WHERE id=1').get())
          throw new Error('Another Antfarm host owns this database')
      }
      this.db.prepare('INSERT INTO dsh_host(id,pid,token) VALUES(1,?,?)').run(process.pid, token)
    })
    this.hostToken = token
  }
  /** Close after all native attempts have settled. */
  dispose(): void {
    if (this.hostToken) this.db.prepare('DELETE FROM dsh_host WHERE token=?').run(this.hostToken)
    this.db.close()
  }
  /** @param work - Synchronous SQL operation. @returns Its committed value. */
  transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE')
    this.pendingEvents = []
    let result: T
    try {
      result = work()
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      this.pendingEvents = undefined
      throw error
    }
    const events = this.pendingEvents
    this.pendingEvents = undefined
    for (const event of events) this.writeEvent(event)
    return result
  }
  private writeEvent(event: WorkflowEvent): void {
    try {
      appendFileSync(this.eventPath, JSON.stringify(event) + '\n', { mode: 0o600 })
    } catch (error) {
      console.error('Antfarm event log unavailable:', error instanceof Error ? error.message : String(error))
    }
    try {
      this.onEvent?.(event, this.run(event.runId).notify_url)
    } catch (error) {
      console.error('Antfarm event subscriber unavailable:', error instanceof Error ? error.message : String(error))
    }
  }
  private event(runId: string, event: string, step?: StepRow, detail?: string): void {
    const value: WorkflowEvent = {
      ts: now(),
      event,
      runId,
      workflowId: this.run(runId).workflow_id,
      ...(step ? { stepId: step.step_id, agentId: step.agent_id } : {}),
      ...(detail ? { detail } : {}),
    }
    if (this.pendingEvents) this.pendingEvents.push(value)
    else this.writeEvent(value)
  }
  private touch(runId: string): void {
    this.db.prepare('UPDATE runs SET updated_at=? WHERE id=?').run(now(), runId)
    this.db.prepare('UPDATE dsh_runs SET revision=revision+1 WHERE run_id=?').run(runId)
  }
  /** @param id - Run identity. @returns Original run row. */
  run(id: string): RunRow {
    const row = this.db.prepare('SELECT * FROM runs WHERE id=?').get(id)
    if (!row) throw new Error('run not found')
    return runRowSchema.parse(row)
  }
  /** @param id - Run identity. @returns Native owner association. */
  binding(id: string): RunBinding {
    const row = this.db.prepare('SELECT * FROM dsh_runs WHERE run_id=?').get(id)
    if (!row) throw new Error('run has no DSH owner')
    return runBindingSchema.parse(row)
  }
  /** @param runId - Run identity. @returns Ordered original steps. */
  steps(runId: string): StepRow[] {
    return this.db
      .prepare('SELECT * FROM steps WHERE run_id=? ORDER BY step_index')
      .all(runId)
      .map((row) => stepRowSchema.parse(row))
  }
  /** @param runId - Run identity. @returns Ordered original stories. */
  stories(runId: string): StoryRow[] {
    return this.db
      .prepare('SELECT * FROM stories WHERE run_id=? ORDER BY story_index')
      .all(runId)
      .map((row) => storyRowSchema.parse(row))
  }
  /** @param owner - Optional owning Session. @returns Newest runs associated with DSH. */
  list(owner?: string): RunRow[] {
    return this.db
      .prepare(
        `SELECT r.* FROM runs r JOIN dsh_runs d ON d.run_id=r.id ${owner === undefined ? '' : 'WHERE d.owner=?'} ORDER BY r.run_number DESC`,
      )
      .all(...(owner === undefined ? [] : [owner]))
      .map((row) => runRowSchema.parse(row))
  }
  /** @param runId - Run identity. @returns Native execution history. */
  attempts(runId: string): AttemptRow[] {
    return this.db
      .prepare('SELECT * FROM dsh_attempts WHERE run_id=? ORDER BY started_at,rowid')
      .all(runId)
      .map((row) => attemptRowSchema.parse(row))
  }
  /** @param workflow - Original definition. @param task - User request. @param owner - Native root Session. @param cwd - Project directory. @param requestId - Idempotent admission key. @param notifyUrl - Explicit webhook. @returns Stored run id. */
  start(
    workflow: ResolvedWorkflow,
    task: string,
    owner: string,
    cwd: string,
    requestId?: string,
    notifyUrl?: string,
  ): string {
    return this.transaction(() => {
      if (requestId) {
        const previous = this.db
          .prepare('SELECT run_id,workflow FROM dsh_runs WHERE owner=? AND request_id=?')
          .get(owner, requestId) as { run_id: string; workflow: string } | undefined
        if (previous) {
          const run = this.run(previous.run_id)
          if (run.task !== task || run.workflow_id !== workflow.id)
            throw new Error('request id already belongs to another task')
          return run.id
        }
      }
      const id = randomUUID(),
        time = now()
      const number = Number(this.db.prepare('SELECT COALESCE(MAX(run_number),0)+1 AS next FROM runs').get()!['next'])
      this.db
        .prepare(
          "INSERT INTO runs(id,workflow_id,task,status,context,created_at,updated_at,notify_url,run_number) VALUES(?,?,?,'running',?,?,?,?,?)",
        )
        .run(
          id,
          workflow.id,
          task,
          JSON.stringify({ task, ...workflow.context }),
          time,
          time,
          notifyUrl ?? workflow.notifications?.url ?? null,
          number,
        )
      this.db
        .prepare('INSERT INTO dsh_runs(run_id,owner,cwd,workflow,request_id) VALUES(?,?,?,?,?)')
        .run(id, owner, cwd, JSON.stringify(workflow), requestId ?? null)
      const insert = this.db.prepare(
        'INSERT INTO steps(id,run_id,step_id,agent_id,step_index,input_template,expects,status,max_retries,type,loop_config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      workflow.steps.forEach((step, index) =>
        insert.run(
          randomUUID(),
          id,
          step.id,
          `${workflow.id}_${step.agent}`,
          index,
          step.input,
          step.expects,
          index === 0 ? 'pending' : 'waiting',
          step.max_retries,
          step.type,
          step.loop ? JSON.stringify(step.loop) : null,
          time,
          time,
        ),
      )
      this.event(id, 'run.started')
      return id
    })
  }
  /** @param agentId - Workflow-qualified identity. @returns Original inexpensive work indicator. */
  peek(agentId: string): 'HAS_WORK' | 'NO_WORK' {
    return this.db
      .prepare(
        "SELECT 1 FROM steps s JOIN runs r ON r.id=s.run_id WHERE s.agent_id=? AND s.status IN ('pending','waiting') AND r.status='running' LIMIT 1",
      )
      .get(agentId)
      ? 'HAS_WORK'
      : 'NO_WORK'
  }
  /** @param runId - Scheduled run. @param progress - Agent progress text. @param frontend - Original frontend detection. @returns Exclusive ready attempt, if any. */
  claim(runId: string, progress = '(no progress yet)', frontend = 'false'): ClaimedStep | undefined {
    return this.transaction(() => {
      if (this.run(runId).status !== 'running' || this.binding(runId).paused) return
      const steps = this.steps(runId)
      const step = steps.find(
        (candidate) =>
          candidate.status === 'pending' &&
          steps
            .filter((previous) => previous.step_index < candidate.step_index)
            .every(
              (previous) =>
                ['done', 'skipped'].includes(previous.status) ||
                (previous.type === 'loop' &&
                  previous.status === 'running' &&
                  JSON.parse(previous.loop_config ?? '{}').verifyStep === candidate.step_id),
            ),
      )
      if (
        !step ||
        this.db.prepare("SELECT 1 FROM dsh_attempts WHERE agent_id=? AND state='running'").get(step.agent_id)
      )
        return
      const context: Record<string, string> = JSON.parse(this.run(runId).context)
      context.run_id = runId
      context.has_frontend_changes = frontend
      const stories = this.stories(runId)
      if (stories.length) context.progress = progress
      if (step.type === 'loop') {
        if (!stories.length) {
          this.failRun(step, 'Loop cannot run because planning did not produce STORIES_JSON.')
          return
        }
        const story = stories.find((story) => story.status === 'pending')
        if (!story) {
          this.continueLoop(step)
          return
        }
        this.db.prepare("UPDATE stories SET status='running',updated_at=? WHERE id=?").run(now(), story.id)
        step.current_story_id = story.id
        context.current_story = `Story ${story.story_id}: ${story.title}\n\n${story.description}\n\nAcceptance Criteria:\n${(JSON.parse(story.acceptance_criteria) as string[]).map((value, index) => `  ${index + 1}. ${value}`).join('\n')}`
        context.current_story_id = story.story_id
        context.current_story_title = story.title
        context.completed_stories =
          stories
            .filter((story) => story.status === 'done')
            .map((story) => `- ${story.story_id}: ${story.title}`)
            .join('\n') || '(none yet)'
        context.stories_remaining = String(
          stories.filter((story) => ['pending', 'running'].includes(story.status)).length,
        )
        context.progress = progress
        context.verify_feedback ??= ''
        this.db.prepare('UPDATE runs SET context=? WHERE id=?').run(JSON.stringify(context), runId)
        this.event(runId, 'story.started', step, story.story_id)
      }
      const missing = [...step.input_template.matchAll(/\{\{(\w+(?:\.\w+)*)\}\}/g)]
        .map((match) => match[1]!)
        .filter((key) => context[key] === undefined && context[key.toLowerCase()] === undefined)
      if (missing.length) {
        this.failRun(
          step,
          `Step input is not ready: missing required template key(s) ${[...new Set(missing)].join(', ')}`,
        )
        return
      }
      this.db.prepare('UPDATE runs SET context=? WHERE id=?').run(JSON.stringify(context), runId)
      const sessionId = randomUUID()
      this.db
        .prepare("UPDATE steps SET status='running',current_story_id=?,updated_at=? WHERE id=?")
        .run(step.current_story_id, now(), step.id)
      this.db
        .prepare(
          "INSERT INTO dsh_attempts(session_id,run_id,step_id,agent_id,pid,state,started_at) VALUES(?,?,?,?,?,'running',?)",
        )
        .run(sessionId, runId, step.id, step.agent_id, process.pid, now())
      this.touch(runId)
      this.event(runId, 'step.running', step)
      return { step: { ...step, status: 'running' }, sessionId, input: resolveTemplate(step.input_template, context) }
    })
  }
  private active(sessionId: string): { attempt: AttemptRow; step: StepRow } | undefined {
    const attempt = this.db
      .prepare("SELECT * FROM dsh_attempts WHERE session_id=? AND state='running'")
      .get(sessionId) as AttemptRow | undefined
    if (!attempt || this.run(attempt.run_id).status !== 'running') return
    const step = this.steps(attempt.run_id).find((step) => step.id === attempt.step_id)
    return step?.status === 'running' ? { attempt, step } : undefined
  }
  private settle(sessionId: string, state: string): void {
    this.db.prepare('UPDATE dsh_attempts SET state=?,finished_at=? WHERE session_id=?').run(state, now(), sessionId)
  }
  /** @param sessionId - Exact claimant. @param output - Original worker text. @returns Whether this completion was current. */
  complete(sessionId: string, output: string): boolean {
    return this.transaction(() => {
      const active = this.active(sessionId)
      if (!active) return false
      const { step } = active
      const context: Record<string, string> = {
        ...JSON.parse(this.run(step.run_id).context),
        ...parseOutputKeyValues(output),
      }
      this.insertStories(step.run_id, output)
      this.db.prepare('UPDATE runs SET context=? WHERE id=?').run(JSON.stringify(context), step.run_id)
      this.settle(sessionId, 'done')
      this.db.prepare('UPDATE steps SET output=?,updated_at=? WHERE id=?').run(output, now(), step.id)
      if (step.type === 'loop' && step.current_story_id) {
        this.db
          .prepare("UPDATE stories SET status='done',output=?,updated_at=? WHERE id=?")
          .run(output, now(), step.current_story_id)
        this.db.prepare('UPDATE steps SET current_story_id=NULL WHERE id=?').run(step.id)
        this.event(step.run_id, 'story.done', step)
        const loop: LoopConfig = JSON.parse(step.loop_config ?? '{}')
        if (loop.verifyEach && loop.verifyStep)
          this.db
            .prepare("UPDATE steps SET status='pending',updated_at=? WHERE run_id=? AND step_id=?")
            .run(now(), step.run_id, loop.verifyStep)
        else this.continueLoop(step)
      } else {
        const loopStep = this.steps(step.run_id).find(
          (row) =>
            row.type === 'loop' &&
            JSON.parse(row.loop_config ?? '{}').verifyEach &&
            JSON.parse(row.loop_config ?? '{}').verifyStep === step.step_id,
        )
        if (loopStep) {
          this.db.prepare("UPDATE steps SET status='waiting' WHERE id=?").run(step.id)
          if (context.status?.toLowerCase() === 'retry') {
            const story = this.stories(step.run_id)
              .filter((row) => row.status === 'done')
              .at(-1)
            if (story) {
              const retry = story.retry_count + 1
              this.db
                .prepare('UPDATE stories SET status=?,retry_count=?,updated_at=? WHERE id=?')
                .run(retry > story.max_retries ? 'failed' : 'pending', retry, now(), story.id)
              if (retry > story.max_retries) this.failRun(loopStep, 'Verification retries exhausted')
              else {
                context.verify_feedback = context.issues ?? output
                this.db.prepare("UPDATE steps SET status='pending' WHERE id=?").run(loopStep.id)
                this.event(step.run_id, 'story.retry', step, context.verify_feedback)
              }
            }
          } else {
            delete context.verify_feedback
            this.event(step.run_id, 'story.verified', step)
            this.continueLoop(loopStep)
          }
          this.db.prepare('UPDATE runs SET context=? WHERE id=?').run(JSON.stringify(context), step.run_id)
        } else {
          this.db.prepare("UPDATE steps SET status='done' WHERE id=?").run(step.id)
          this.event(step.run_id, 'step.done', step)
          this.advance(step.run_id)
        }
      }
      this.touch(step.run_id)
      return true
    })
  }
  private insertStories(runId: string, output: string): void {
    const match = /^STORIES_JSON:\s*([\s\S]*?)(?=^[A-Z_]+:\s|$(?![\s\S]))/m.exec(output)
    if (!match) return
    const parsed: unknown = JSON.parse(match[1]!)
    if (!Array.isArray(parsed) || parsed.length > 20)
      throw new Error('STORIES_JSON must be an array of at most 20 stories')
    const seen = new Set<string>()
    for (const raw of parsed) {
      if (!raw || typeof raw !== 'object') throw new Error('invalid story')
      const row = raw as Record<string, unknown>,
        criteria = row.acceptanceCriteria ?? row.acceptance_criteria
      if (
        typeof row.id !== 'string' ||
        !row.id ||
        typeof row.title !== 'string' ||
        typeof row.description !== 'string' ||
        !Array.isArray(criteria) ||
        !criteria.length ||
        criteria.some((value) => typeof value !== 'string') ||
        seen.has(row.id)
      )
        throw new Error('story requires unique id, title, description and acceptanceCriteria')
      seen.add(row.id)
      this.db
        .prepare(
          "INSERT INTO stories(id,run_id,story_index,story_id,title,description,acceptance_criteria,status,retry_count,max_retries,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',0,2,?,?)",
        )
        .run(
          randomUUID(),
          runId,
          seen.size - 1,
          row.id,
          row.title,
          row.description,
          JSON.stringify(criteria),
          now(),
          now(),
        )
    }
  }
  private continueLoop(step: StepRow): void {
    const stories = this.stories(step.run_id)
    if (stories.some((story) => story.status === 'pending')) {
      this.db.prepare("UPDATE steps SET status='pending',updated_at=? WHERE id=?").run(now(), step.id)
      return
    }
    if (stories.some((story) => story.status === 'failed')) {
      this.failRun(step, 'Loop has failed stories and no pending stories')
      return
    }
    this.db.prepare("UPDATE steps SET status='done',updated_at=? WHERE id=?").run(now(), step.id)
    const loop: LoopConfig = JSON.parse(step.loop_config ?? '{}')
    if (loop.verifyEach && loop.verifyStep)
      this.db.prepare("UPDATE steps SET status='done' WHERE run_id=? AND step_id=?").run(step.run_id, loop.verifyStep)
    this.advance(step.run_id)
  }
  private advance(runId: string): void {
    if (this.run(runId).status !== 'running') return
    const steps = this.steps(runId)
    if (steps.some((step) => ['running', 'pending', 'failed'].includes(step.status))) return
    const next = steps.find((step) => step.status === 'waiting')
    if (next) {
      this.db.prepare("UPDATE steps SET status='pending',updated_at=? WHERE id=?").run(now(), next.id)
      this.event(runId, 'pipeline.advanced', next)
      this.event(runId, 'step.pending', next)
    } else {
      this.db.prepare("UPDATE runs SET status='completed' WHERE id=?").run(runId)
      this.event(runId, 'run.completed')
    }
  }
  private failRun(step: StepRow, error: string): void {
    this.db.prepare("UPDATE steps SET status='failed',output=?,updated_at=? WHERE id=?").run(error, now(), step.id)
    this.db.prepare("UPDATE runs SET status='failed' WHERE id=?").run(step.run_id)
    this.touch(step.run_id)
    this.event(step.run_id, 'step.failed', step, error)
    this.event(step.run_id, 'run.failed', step, error)
  }
  /** @param sessionId - Exact claimant. @param error - Failure text. @returns Whether a current attempt failed. */
  fail(sessionId: string, error: string): boolean {
    return this.transaction(() => {
      const active = this.active(sessionId)
      if (!active) return false
      const { step } = active
      this.settle(sessionId, 'failed')
      const story = step.current_story_id
        ? this.stories(step.run_id).find((row) => row.id === step.current_story_id)
        : undefined
      const retry = (story?.retry_count ?? step.retry_count) + 1,
        maximum = story?.max_retries ?? step.max_retries
      if (story)
        this.db
          .prepare('UPDATE stories SET status=?,retry_count=?,updated_at=? WHERE id=?')
          .run(retry > maximum ? 'failed' : 'pending', retry, now(), story.id)
      else this.db.prepare('UPDATE steps SET retry_count=? WHERE id=?').run(retry, step.id)
      if (retry > maximum) this.failRun(step, error)
      else
        this.db
          .prepare("UPDATE steps SET status='pending',current_story_id=NULL,output=?,updated_at=? WHERE id=?")
          .run(error, now(), step.id)
      this.touch(step.run_id)
      return true
    })
  }
  /** @param sessionId - Timed-out claimant whose child has stopped. @returns Whether its original abandonment budget changed. */
  abandon(sessionId: string): boolean {
    const active = this.active(sessionId)
    if (!active) return false
    if (active.step.current_story_id) return this.fail(sessionId, 'Story abandoned')
    return this.transaction(() => {
      const { step } = active
      this.settle(sessionId, 'abandoned')
      const count = step.abandoned_count + 1
      this.db.prepare('UPDATE steps SET abandoned_count=? WHERE id=?').run(count, step.id)
      if (count >= 5) this.failRun(step, 'Agent abandoned step without completing five times')
      else this.db.prepare("UPDATE steps SET status='pending',updated_at=? WHERE id=?").run(now(), step.id)
      this.touch(step.run_id)
      this.event(step.run_id, 'step.timeout', step)
      return true
    })
  }
  /** @param runId - Stopped execution. @param reason - Native interruption. */
  pause(runId: string, reason: string): void {
    this.db.prepare('UPDATE dsh_runs SET paused=1,reason=?,revision=revision+1 WHERE run_id=?').run(reason, runId)
  }
  /** @param runId - Cancelled run. */
  cancel(runId: string): void {
    this.transaction(() => {
      this.db.prepare("UPDATE runs SET status='cancelled' WHERE id=?").run(runId)
      this.db
        .prepare(
          "UPDATE steps SET status='failed',output='Cancelled by user',updated_at=? WHERE run_id=? AND status IN ('waiting','pending','running')",
        )
        .run(now(), runId)
      this.db
        .prepare("UPDATE dsh_attempts SET state='cancelled',finished_at=? WHERE run_id=? AND state='running'")
        .run(now(), runId)
      this.touch(runId)
      this.event(runId, 'run.failed', undefined, 'Cancelled by user')
    })
  }
  /** @param runId - Failed or interrupted run. @param guidance - User recovery input. */
  resume(runId: string, guidance = ''): void {
    this.transaction(() => {
      const run = this.run(runId)
      if (['completed', 'cancelled'].includes(run.status)) throw new Error('terminal run cannot resume')
      if (run.status === 'running' && !this.binding(runId).paused)
        throw new Error('Only failed or interrupted runs can resume')
      const steps = this.steps(runId)
      let step = steps.find((row) => row.status === 'failed') ?? steps.find((row) => row.status === 'running')
      if (step) {
        const loop = steps.find(
          (row) => row.type === 'loop' && JSON.parse(row.loop_config ?? '{}').verifyStep === step!.step_id,
        )
        if (loop) {
          this.db.prepare("UPDATE steps SET status='waiting',retry_count=0,updated_at=? WHERE id=?").run(now(), step.id)
          step = loop
        }
        this.db
          .prepare("UPDATE stories SET status='pending',updated_at=? WHERE run_id=? AND status IN ('failed','running')")
          .run(now(), runId)
        this.db
          .prepare("UPDATE steps SET status='pending',current_story_id=NULL,retry_count=0,updated_at=? WHERE id=?")
          .run(now(), step.id)
        this.db
          .prepare("UPDATE dsh_attempts SET state='interrupted',finished_at=? WHERE run_id=? AND state='running'")
          .run(now(), runId)
      }
      const context: Record<string, string> = JSON.parse(run.context)
      if (guidance) context.resume_guidance = guidance
      this.db.prepare("UPDATE runs SET status='running',context=? WHERE id=?").run(JSON.stringify(context), runId)
      this.db.prepare('UPDATE dsh_runs SET paused=0,reason=NULL WHERE run_id=?').run(runId)
      this.touch(runId)
    })
  }
  /** @param runId - Observed run. @returns Events in append order. */
  events(runId: string): WorkflowEvent[] {
    try {
      return readFileSync(this.eventPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as WorkflowEvent)
        .filter((event) => event.runId === runId)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }
  }
}
