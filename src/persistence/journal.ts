import { mkdir, open, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { ResolvedWorkflow } from '../workflow/types.ts'
import type {
  JournalEvent, JournalEventMap, JournalEventOf, JournalEventType, RunBlockedData, RunEndData, RunIsolation, RunStartData, RunResumeData, StepExecutionKind,
  StoriesRegisteredData, StoryEndData, StepEndData, StepStartData, WorkspaceCleanedData, WorkspaceRetainedData,
} from './types.ts'

const TYPES = new Set<JournalEventType>([
  'run-start', 'step-start', 'step-end', 'stories-registered', 'story-end', 'run-blocked', 'run-resume', 'run-end', 'workspace-cleaned', 'workspace-retained',
])

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

function text(row: Record<string, unknown>, key: string, label: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value === '') throw new Error(`${label}.${key} must be a non-empty string`)
  return value
}

function optionalText(row: Record<string, unknown>, key: string, label: string): string | undefined {
  const value = row[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`${label}.${key} must be a string when present`)
  return value
}

function optionalExecution(value: unknown, label: string): StepExecutionKind | undefined {
  if (value === undefined) return undefined
  if (value !== 'normal' && value !== 'story' && value !== 'verify' && value !== 'repair') throw new Error(`${label}.execution is invalid`)
  return value
}

function integer(row: Record<string, unknown>, key: string, label: string, minimum = 0): number {
  const value = row[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label}.${key} must be a safe integer >= ${minimum}`)
  }
  return value
}

function stringMap(value: unknown, label: string): Record<string, string> {
  const row = object(value, label)
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(row)) {
    if (typeof item !== 'string') throw new Error(`${label}.${key} must be a string`)
    result[key] = item
  }
  return result
}

function workflowSnapshot(value: unknown): ResolvedWorkflow {
  const row = object(value, 'run-start.resolvedWorkflowSnapshot')
  if (!Array.isArray(row['agents']) || !Array.isArray(row['steps'])) throw new Error('run-start.resolvedWorkflowSnapshot is invalid')
  return value as ResolvedWorkflow
}

function runStart(value: unknown): RunStartData {
  const row = object(value, 'run-start')
  const isolation = text(row, 'isolation', 'run-start')
  if (isolation !== 'worktree' && isolation !== 'shared') throw new Error('run-start.isolation is invalid')
  const model = optionalText(row, 'model', 'run-start')
  return {
    runId: text(row, 'runId', 'run-start'),
    ownerSessionId: text(row, 'ownerSessionId', 'run-start'),
    workflowId: text(row, 'workflowId', 'run-start'),
    task: text(row, 'task', 'run-start'),
    baseCwd: text(row, 'baseCwd', 'run-start'),
    baseRevision: text(row, 'baseRevision', 'run-start'),
    baseStatus: optionalText(row, 'baseStatus', 'run-start') ?? '',
    workspace: text(row, 'workspace', 'run-start'),
    branch: text(row, 'branch', 'run-start'),
    isolation: isolation as RunIsolation,
    provider: text(row, 'provider', 'run-start'),
    ...(model === undefined ? {} : { model }),
    resolvedWorkflowSnapshot: workflowSnapshot(row['resolvedWorkflowSnapshot']),
  }
}

function stepStart(value: unknown): StepStartData {
  const row = object(value, 'step-start')
  const storyId = optionalText(row, 'storyId', 'step-start')
  const execution = optionalExecution(row['execution'], 'step-start')
  const sourceStepId = optionalText(row, 'sourceStepId', 'step-start')
  return { runId: text(row, 'runId', 'step-start'), stepId: text(row, 'stepId', 'step-start'), attempt: integer(row, 'attempt', 'step-start', 1), ...(storyId === undefined ? {} : { storyId }), ...(execution === undefined ? {} : { execution }), ...(sourceStepId === undefined ? {} : { sourceStepId }) }
}

function stepEnd(value: unknown): StepEndData {
  const row = object(value, 'step-end')
  const outcome = text(row, 'outcome', 'step-end')
  if (outcome !== 'done' && outcome !== 'failed') throw new Error('step-end.outcome is invalid')
  const storyId = optionalText(row, 'storyId', 'step-end')
  const childSessionId = optionalText(row, 'childSessionId', 'step-end')
  const error = optionalText(row, 'error', 'step-end')
  const execution = optionalExecution(row['execution'], 'step-end')
  const sourceStepId = optionalText(row, 'sourceStepId', 'step-end')
  return {
    runId: text(row, 'runId', 'step-end'),
    stepId: text(row, 'stepId', 'step-end'),
    attempt: integer(row, 'attempt', 'step-end', 1),
    ...(storyId === undefined ? {} : { storyId }),
    outcome,
    contextDelta: stringMap(row['contextDelta'], 'step-end.contextDelta'),
    ...(childSessionId === undefined ? {} : { childSessionId }),
    ...(error === undefined ? {} : { error }),
    ...(execution === undefined ? {} : { execution }),
    ...(sourceStepId === undefined ? {} : { sourceStepId }),
  }
}

function story(value: unknown, index: number): StoriesRegisteredData['stories'][number] {
  const row = object(value, `stories-registered.stories[${index}]`)
  const criteria = row['acceptanceCriteria']
  if (!Array.isArray(criteria) || criteria.length === 0 || !criteria.every(item => typeof item === 'string' && item !== '')) {
    throw new Error(`stories-registered.stories[${index}].acceptanceCriteria is invalid`)
  }
  return {
    id: text(row, 'id', `stories-registered.stories[${index}]`),
    title: text(row, 'title', `stories-registered.stories[${index}]`),
    description: text(row, 'description', `stories-registered.stories[${index}]`),
    acceptanceCriteria: criteria,
    maxRetries: integer(row, 'maxRetries', `stories-registered.stories[${index}]`),
  }
}

function storiesRegistered(value: unknown): StoriesRegisteredData {
  const row = object(value, 'stories-registered')
  const stories = row['stories']
  if (!Array.isArray(stories) || stories.length === 0 || stories.length > 20) throw new Error('stories-registered.stories is invalid')
  const parsed = stories.map(story)
  if (new Set(parsed.map(item => item.id)).size !== parsed.length) throw new Error('stories-registered contains duplicate story ids')
  return { runId: text(row, 'runId', 'stories-registered'), stepId: text(row, 'stepId', 'stories-registered'), stories: parsed }
}

function storyEnd(value: unknown): StoryEndData {
  const row = object(value, 'story-end')
  const outcome = text(row, 'outcome', 'story-end')
  if (outcome !== 'done' && outcome !== 'retry' && outcome !== 'failed') throw new Error('story-end.outcome is invalid')
  const feedback = optionalText(row, 'feedback', 'story-end')
  return {
    runId: text(row, 'runId', 'story-end'),
    stepId: text(row, 'stepId', 'story-end'),
    storyId: text(row, 'storyId', 'story-end'),
    outcome,
    retryCount: integer(row, 'retryCount', 'story-end'),
    ...(feedback === undefined ? {} : { feedback }),
  }
}

function runBlocked(value: unknown): RunBlockedData {
  const row = object(value, 'run-blocked')
  const storyId = optionalText(row, 'storyId', 'run-blocked')
  const feedback = optionalText(row, 'feedback', 'run-blocked')
  return {
    runId: text(row, 'runId', 'run-blocked'),
    stepId: text(row, 'stepId', 'run-blocked'),
    ...(storyId === undefined ? {} : { storyId }),
    reason: text(row, 'reason', 'run-blocked'),
    ...(feedback === undefined ? {} : { feedback }),
  }
}

function runResume(value: unknown): RunResumeData {
  const row = object(value, 'run-resume')
  const guidance = optionalText(row, 'guidance', 'run-resume')
  const stepId = optionalText(row, 'stepId', 'run-resume')
  const storyId = optionalText(row, 'storyId', 'run-resume')
  return {
    runId: text(row, 'runId', 'run-resume'),
    authority: text(row, 'authority', 'run-resume'),
    ...(guidance === undefined ? {} : { guidance }),
    ...(stepId === undefined ? {} : { stepId }),
    ...(storyId === undefined ? {} : { storyId }),
  }
}

function runEnd(value: unknown): RunEndData {
  const row = object(value, 'run-end')
  const stopReason = text(row, 'stopReason', 'run-end')
  if (stopReason !== 'completed' && stopReason !== 'failed' && stopReason !== 'cancelled') throw new Error('run-end.stopReason is invalid')
  const error = optionalText(row, 'error', 'run-end')
  return { runId: text(row, 'runId', 'run-end'), stopReason, ...(error === undefined ? {} : { error }) }
}

function workspaceCleaned(value: unknown): WorkspaceCleanedData {
  const row = object(value, 'workspace-cleaned')
  return { runId: text(row, 'runId', 'workspace-cleaned'), path: text(row, 'path', 'workspace-cleaned') }
}

function workspaceRetained(value: unknown): WorkspaceRetainedData {
  const row = object(value, 'workspace-retained')
  return { runId: text(row, 'runId', 'workspace-retained'), path: text(row, 'path', 'workspace-retained'), reason: text(row, 'reason', 'workspace-retained') }
}

function parseData<T extends JournalEventType>(type: T, value: unknown): JournalEventMap[T] {
  switch (type) {
    case 'run-start': return runStart(value) as JournalEventMap[T]
    case 'step-start': return stepStart(value) as JournalEventMap[T]
    case 'step-end': return stepEnd(value) as JournalEventMap[T]
    case 'stories-registered': return storiesRegistered(value) as JournalEventMap[T]
    case 'story-end': return storyEnd(value) as JournalEventMap[T]
    case 'run-blocked': return runBlocked(value) as JournalEventMap[T]
    case 'run-resume': return runResume(value) as JournalEventMap[T]
    case 'run-end': return runEnd(value) as JournalEventMap[T]
    case 'workspace-cleaned': return workspaceCleaned(value) as JournalEventMap[T]
    case 'workspace-retained': return workspaceRetained(value) as JournalEventMap[T]
  }
}

function parseEvent(value: unknown, expectedSeq: number, expectedRunId: string): JournalEvent {
  const row = object(value, `journal event ${expectedSeq}`)
  if (row['version'] !== 1) throw new Error(`journal event ${expectedSeq} has unsupported version`)
  const seq = integer(row, 'seq', `journal event ${expectedSeq}`)
  if (seq !== expectedSeq) throw new Error(`journal sequence gap: expected ${expectedSeq}, received ${seq}`)
  const time = integer(row, 'time', `journal event ${expectedSeq}`)
  const typeValue = row['type']
  if (typeof typeValue !== 'string' || !TYPES.has(typeValue as JournalEventType)) throw new Error(`journal event ${expectedSeq} has unknown type`)
  const type = typeValue as JournalEventType
  const data = parseData(type, row['data'])
  if (data.runId !== expectedRunId) throw new Error(`journal event ${expectedSeq} belongs to run "${data.runId}", expected "${expectedRunId}"`)
  return { version: 1, seq, time, type, data } as JournalEvent
}

export type JournalStatusHint = 'active' | 'blocked' | 'completed' | 'failed' | 'cancelled'
export interface JournalMeta {
  readonly runId: string
  readonly workflowId: string
  readonly ownerSessionId: string
  readonly updatedAt: number
  readonly statusHint: JournalStatusHint
}

/** Flush-on-append owner for one run's event journal. */
export class RunJournal {
  readonly directory: string
  readonly eventsPath: string
  readonly metaPath: string
  private nextSeq = 0
  private statusHint: JournalStatusHint = 'active'

  private constructor(readonly root: string, readonly runId: string) {
    this.directory = join(resolve(root), runId)
    this.eventsPath = join(this.directory, 'events.jsonl')
    this.metaPath = join(this.directory, 'meta.json')
  }

  static async create(root: string, start: RunStartData): Promise<RunJournal> {
    const journal = new RunJournal(root, start.runId)
    await mkdir(resolve(root), { recursive: true })
    await mkdir(journal.directory, { recursive: false })
    await journal.writeMeta({ runId: start.runId, workflowId: start.workflowId, ownerSessionId: start.ownerSessionId, updatedAt: Date.now(), statusHint: 'active' })
    await journal.append('run-start', start)
    return journal
  }

  static async open(root: string, runId: string): Promise<RunJournal> {
    const journal = new RunJournal(root, runId)
    journal.nextSeq = (await journal.load()).length
    try {
      journal.statusHint = (await readJournalMeta(root, runId)).statusHint
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return journal
  }

  async append<T extends JournalEventType>(type: T, data: JournalEventMap[T]): Promise<JournalEventOf<T>> {
    if (data.runId !== this.runId) throw new Error(`cannot append run "${data.runId}" to journal "${this.runId}"`)
    const event: JournalEventOf<T> = { version: 1, seq: this.nextSeq, time: Date.now(), type, data }
    const handle = await open(this.eventsPath, 'a')
    try {
      await handle.write(`${JSON.stringify(event)}\n`)
      await handle.sync()
    } finally {
      await handle.close()
    }
    this.nextSeq += 1
    if (type === 'run-blocked') this.statusHint = 'blocked'
    if (type === 'run-end') this.statusHint = (data as RunEndData).stopReason
    await this.writeMeta(await this.readMeta(this.statusHint))
    return event
  }

  async load(): Promise<JournalEvent[]> {
    const content = await readFile(this.eventsPath, 'utf8')
    const lines = content.split('\n').filter(line => line !== '')
    return lines.map((line, index) => {
      let value: unknown
      try { value = JSON.parse(line) } catch (error: unknown) { throw new Error(`invalid JSON in journal line ${index + 1}`, { cause: error }) }
      return parseEvent(value, index, this.runId)
    })
  }

  private async readMeta(statusHint = this.statusHint): Promise<JournalMeta> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.metaPath, 'utf8'))
      const row = object(parsed, 'journal meta')
      const runId = text(row, 'runId', 'journal meta')
      const workflowId = text(row, 'workflowId', 'journal meta')
      const ownerSessionId = text(row, 'ownerSessionId', 'journal meta')
      return { runId, workflowId, ownerSessionId, updatedAt: Date.now(), statusHint }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error
      throw new Error(`invalid journal meta for run "${this.runId}"`, { cause: error })
    }
  }

  private async writeMeta(meta: JournalMeta): Promise<void> {
    await mkdir(dirname(this.metaPath), { recursive: true })
    const temporary = `${this.metaPath}.tmp`
    await writeFile(temporary, `${JSON.stringify(meta)}\n`, 'utf8')
    await rename(temporary, this.metaPath)
  }
}

/** Read the fast-locator metadata without treating it as run state. */
export async function readJournalMeta(root: string, runId: string): Promise<JournalMeta> {
  const path = join(resolve(root), runId, 'meta.json')
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(path, 'utf8'))
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error
    throw new Error(`unable to read journal meta for run "${runId}"`, { cause: error })
  }
  const row = object(parsed, 'journal meta')
  const value = row['statusHint']
  if (value !== 'active' && value !== 'blocked' && value !== 'completed' && value !== 'failed' && value !== 'cancelled') {
    throw new Error(`journal meta for run "${runId}" has invalid statusHint`)
  }
  return {
    runId: text(row, 'runId', 'journal meta'),
    workflowId: text(row, 'workflowId', 'journal meta'),
    ownerSessionId: text(row, 'ownerSessionId', 'journal meta'),
    updatedAt: integer(row, 'updatedAt', 'journal meta', 0),
    statusHint: value,
  }
}
