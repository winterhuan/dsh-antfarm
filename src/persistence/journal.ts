import { StringDecoder } from 'node:string_decoder'
import { createHash, randomUUID } from 'node:crypto'
/** Serialized, flush-on-append journal with validation at the disk boundary. */
import { mkdir, open, readFile, realpath, rename } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { z } from 'zod'
import { validateResolvedWorkflow } from '../workflow/loader.ts'
import { foldJournal, type FoldedRun } from './fold.ts'
import type { JournalEvent, JournalRecord, RunStartData } from './types.ts'

const id = z.string().regex(/^af-[a-z0-9-]{1,64}$/)
const stringMap = z.record(z.string(), z.string())
const story = z.strictObject({ id: z.string().min(1), title: z.string().min(1), description: z.string().min(1), acceptanceCriteria: z.array(z.string().min(1)).min(1), maxRetries: z.number().int().nonnegative(), status: z.enum(['pending', 'done', 'retry', 'failed']), retryCount: z.number().int().nonnegative(), feedback: z.string().optional() })
const startSchema = z.strictObject({ runId: id, requestId: z.string().min(1).max(128).optional(), number: z.number().int().positive().optional(), ownerSessionId: z.string().min(1), workflowId: z.string().min(1), task: z.string().min(1), baseCwd: z.string().min(1), workspaceKind: z.enum(['git', 'files']).optional(), fileInputs: z.array(z.strictObject({ path: z.string(), sha256: z.string(), content: z.string() })).optional(), baseRevision: z.string(), workspace: z.string().min(1), branch: z.string(), provider: z.string().min(1), model: z.string().optional(), notificationUrl: z.string().url().optional(), githubReviewerTokenEnv: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(), executionPolicy: z.strictObject({ maxAttempts: z.number().int().positive().max(10000).optional(), timeoutSeconds: z.number().int().positive().max(2147483), maxStories: z.number().int().positive().max(100), maxStoryRetries: z.number().int().nonnegative().max(20), maxSummaryChars: z.number().int().positive().max(65536), cleanupCompleted: z.boolean(), cleanupCancelled: z.boolean() }).optional(), resolvedWorkflowSnapshot: z.unknown().transform(validateResolvedWorkflow) })
const checkpoint = z.strictObject({ cursor: z.number().int().nonnegative(), context: stringMap, stories: z.array(story).nullable(), retries: z.record(z.string(), z.number().int().nonnegative()), feedback: stringMap, repair: z.strictObject({ targetId: z.string().min(1), sourceStepId: z.string().min(1) }).nullable(), acceptedChecks: z.record(z.string(), z.strictObject({ candidate: z.string().regex(/^[a-f0-9]{64}$/), callIds: z.array(z.string()) })).optional(), blocked: z.string().nullable() })
const record = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('run-start'), data: startSchema }),
  z.strictObject({ type: z.literal('run-dispatch'), data: z.strictObject({}) }),
  z.strictObject({ type: z.literal('run-queue'), data: z.strictObject({}) }),
  z.strictObject({ type: z.literal('run-interrupt'), data: z.strictObject({ reason: z.string() }) }),
  z.strictObject({ type: z.literal('tail-recovered'), data: z.strictObject({ source: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive() }) }),
  z.strictObject({ type: z.literal('workspace-ready'), data: z.strictObject({}) }),
  z.strictObject({ type: z.literal('attempt-start'), data: z.strictObject({ stepId: z.string().min(1), childSessionId: z.string().min(1), execution: z.enum(['single', 'story', 'verify', 'repair']), storyId: z.string().optional(), effect: z.enum(['pull-request', 'github-review']).optional(), candidate: z.string().regex(/^[a-f0-9]{64}$/).optional() }) }),
  z.strictObject({ type: z.literal('attempt-end'), data: z.strictObject({ childSessionId: z.string().min(1), passed: z.boolean(), summary: z.string() }) }),
  z.strictObject({ type: z.literal('check-evidence'), data: z.strictObject({ callId: z.string(), childSessionId: z.string(), stepId: z.string(), command: z.string(), cwd: z.string(), candidate: z.string(), afterCandidate: z.string(), passed: z.boolean(), exitCode: z.number().int().nullable(), stdout: z.string(), stderr: z.string() }) }),
  z.strictObject({ type: z.literal('checkpoint'), data: checkpoint }),
  z.strictObject({ type: z.literal('run-resume'), data: z.strictObject({ guidance: z.string(), retryGrant: z.number().int().nonnegative().max(20).optional() }) }),
  z.strictObject({ type: z.literal('run-end'), data: z.strictObject({ status: z.enum(['completed', 'failed', 'cancelled']), reason: z.string() }) }),
  z.strictObject({ type: z.literal('file-artifacts'), data: z.strictObject({ candidate: z.string(), artifacts: z.array(z.strictObject({ path: z.string(), sha256: z.string(), bytes: z.number().int().nonnegative() })) }) }),
  z.strictObject({ type: z.literal('notification'), data: z.strictObject({ id: z.string(), channel: z.enum(['owner', 'webhook']), status: z.enum(['pending', 'delivered', 'failed']), detail: z.string().max(2048) }) }),
  z.strictObject({ type: z.literal('health'), data: z.strictObject({ kind: z.string(), detail: z.string().max(2048) }) }),
  z.strictObject({ type: z.literal('workspace-disposition'), data: z.strictObject({ disposition: z.enum(['retained', 'cleaned']), reason: z.string() }) }),
])
const envelope = z.object({ version: z.literal(3), seq: z.number().int().nonnegative(), time: z.number().int().nonnegative() })
const identity = z.object({ runId: id, number: z.number().int().positive().optional(), ownerSessionId: z.string().min(1), workflowId: z.string().min(1), workspace: z.string(), branch: z.string() })

/**
 * Read a journal's first identity without interpreting old business state.
 * @param root - Configured journal root.
 * @param runId - Safe run directory identifier.
 * @returns Validated attribution and the recorded format version.
 */
export async function readJournalIdentity(root: string, runId: string) {
  id.parse(runId)
  const directory = join(await realpath(root), runId)
  if (await realpath(directory) !== directory) throw new Error('journal directory resolves outside its recorded path')
  const path = join(directory, 'events.jsonl')
  if (await realpath(path) !== path) throw new Error('journal identity file must not be a symbolic link')
  const file = await open(path, 'r')
  let source = ''
  const decoder = new StringDecoder('utf8')
  try {
    const buffer = Buffer.alloc(65536)
    while (!source.includes('\n')) {
      const { bytesRead } = await file.read(buffer)
      if (bytesRead === 0) break
      source += decoder.write(buffer.subarray(0, bytesRead))
      if (Buffer.byteLength(source) > 4 * 1024 * 1024) throw new Error('journal identity exceeds the supported size')
    }
  } finally { await file.close() }
  const first = z.object({ version: z.number(), data: identity }).parse(JSON.parse(source.split('\n', 1)[0] ?? ''))
  if (first.data.runId !== runId) throw new Error('journal identity differs from its directory')
  return first
}

/** A single writer owns committed state; readers never observe unflushed changes. */
export class RunJournal {
  private writing: Promise<void> = Promise.resolve()
  private committed: FoldedRun | undefined
  private constructor(readonly eventsPath: string, private events: JournalEvent[]) {
    if (events.length > 0) this.committed = foldJournal(events)
  }

  /** Revision of the last committed event; used to reject stale UI actions. */
  get revision(): number { return this.events.length - 1 }

  /** Original start time of the unsettled native attempt; diagnostics do not renew its deadline. */
  get attemptTime(): number | undefined { return this.events.findLast(event => event.type === 'attempt-start')?.time }

  /** @param type - Committed fact kind. @returns Last matching event without scanning through a Remote. */
  latest(type: JournalRecord['type']): JournalEvent | undefined { return this.events.findLast(event => event.type === type) }

  /** @param id - Stable notice identity. @param channel - Destination channel. @returns Whether durable delivery was already confirmed. */
  delivered(id: string, channel: 'owner' | 'webhook'): boolean { return this.events.some(event => event.type === 'notification' && event.data.id === id && event.data.channel === channel && event.data.status === 'delivered') }

  /** @param after - Exclusive event cursor. @param limit - Maximum records. @returns Committed event page. */
  records(after: number, limit: number): readonly JournalEvent[] {
    if (!Number.isInteger(after) || after < -1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid event page')
    return this.events.slice(after + 1, after + 1 + limit)
  }

  /** Last successfully flushed reducer result. */
  get state(): FoldedRun { if (this.committed === undefined) throw new Error('Run start has not committed'); return this.committed }

  /**
   * Create a unique journal and persist its start before accepting work.
   * @param root - Configured storage directory.
   * @param start - Validated resolved execution inputs.
   * @returns Sole writer for the new run.
   */
  static async create(root: string, start: RunStartData): Promise<RunJournal> {
    startSchema.parse(start)
    await mkdir(resolve(root), { recursive: true })
    const directory = join(await realpath(root), start.runId)
    await mkdir(directory)
    const journal = new RunJournal(join(directory, 'events.jsonl'), [])
    await journal.append({ type: 'run-start', data: start })
    return journal
  }

  /**
   * Open version 3 evidence without modifying its bytes.
   * @param root - Configured storage directory.
   * @param runId - Safe run identity.
   * @returns Writer; unsupported, truncated, or corrupt evidence rejects.
   */
  static async open(root: string, runId: string): Promise<RunJournal> {
    id.parse(runId)
    const directory = join(await realpath(root), runId)
    if (await realpath(directory) !== directory) throw new Error('journal directory resolves outside its recorded path')
    const path = join(directory, 'events.jsonl')
    if (await realpath(path) !== path) throw new Error('journal file resolves outside its recorded path')
    const source = await readFile(path, 'utf8')
    if (!source.endsWith('\n')) throw new Error('journal has an incomplete final record; retain evidence before recovery')
    const events: JournalEvent[] = source.slice(0, -1).split('\n').map((line, seq) => {
      const value: unknown = JSON.parse(line)
      const meta = envelope.parse(value)
      if (meta.seq !== seq) throw new Error('journal has a sequence gap')
      const payload = z.object({ type: z.string(), data: z.unknown() }).parse(value)
      return { ...record.parse(payload), ...meta }
    })
    const journal = new RunJournal(join(directory, 'events.jsonl'), events)
    if (journal.state.start.runId !== runId) throw new Error('journal identity differs from its directory')
    return journal
  }

  /**
   * Recover only an incomplete final write under the storage-root writer lock.
   * @param root - Owned storage root.
   * @param runId - Run whose complete prefix will be validated.
   * @returns Recovered journal with a retained, hashed source receipt.
   */
  static async recoverTail(root: string, runId: string): Promise<RunJournal> {
    const first = await readJournalIdentity(root, runId)
    if (first.version !== 3) throw new Error('only version 3 torn tails can be recovered')
    const directory = join(await realpath(root), id.parse(runId))
    const path = join(directory, 'events.jsonl')
    if (await realpath(path) !== path) throw new Error('journal file must not be a symbolic link')
    const bytes = await readFile(path)
    if (bytes.at(-1) === 10) return RunJournal.open(root, runId)
    const last = bytes.lastIndexOf(10)
    if (last < 0) throw new Error('journal has no proven complete prefix')
    const prefix = bytes.subarray(0, last + 1)
    const events = prefix.toString('utf8').trimEnd().split('\n').map((line, seq) => {
      const value: unknown = JSON.parse(line)
      const meta = envelope.parse(value)
      if (meta.seq !== seq) throw new Error('journal has a sequence gap')
      return { ...record.parse(z.object({ type: z.string(), data: z.unknown() }).parse(value)), ...meta }
    })
    const journal = new RunJournal(path, events)
    if (journal.state.start.runId !== runId) throw new Error('journal identity differs')
    const source = `events.torn-${randomUUID()}.jsonl`
    const temporary = join(directory, `events.recovered-${randomUUID()}.tmp`)
    const receipt: JournalEvent = { type: 'tail-recovered', data: { source, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }, version: 3, seq: events.length, time: Date.now() }
    foldJournal([...events, receipt])
    const recoveredBytes = Buffer.concat([prefix, Buffer.from(`${JSON.stringify(receipt)}\n`)])
    for (const [target, content] of [[join(directory, source), bytes], [temporary, recoveredBytes]] as const) {
      const file = await open(target, 'wx', 0o600)
      try { await file.writeFile(content); await file.sync() } finally { await file.close() }
    }
    await syncDirectory(directory)
    await rename(temporary, path)
    await syncDirectory(directory)
    return new RunJournal(path, [...events, receipt])
  }

  /**
   * Serialize and flush one complete state transition.
   * @param value - Business checkpoint or execution fact.
   * @returns Completion after the write and reducer commit; failure poisons this writer.
   */
  append(value: JournalRecord): Promise<void> {
    const operation = this.writing.then(async () => {
      const event: JournalEvent = { ...record.parse(value), version: 3, seq: this.events.length, time: Date.now() }
      const next = [...this.events, event]
      const state = foldJournal(next)
      const file = await open(this.eventsPath, 'a')
      try { await file.writeFile(`${JSON.stringify(event)}\n`); await file.sync() } finally { await file.close() }
      if (event.seq === 0) { await syncDirectory(resolve(this.eventsPath, '..')); await syncDirectory(resolve(this.eventsPath, '../..')) }
      this.events = next
      this.committed = state
    })
    this.writing = operation
    return operation
  }
}

async function syncDirectory(path: string): Promise<void> {
  const file = await open(path, 'r')
  try { await file.sync() } finally { await file.close() }
}
