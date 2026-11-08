/** Read historical per-run journals without changing or replaying their business state. */
import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { AntfarmEventSummary, AntfarmStatus } from '../types.ts'

const identity = z.object({
  runId: z.string(),
  ownerSessionId: z.string(),
  workflowId: z.string(),
  workspace: z.string(),
  branch: z.string(),
  task: z.string().optional(),
  number: z.number().optional(),
})
const envelope = z.object({
  version: z.number(),
  seq: z.number().int(),
  time: z.number(),
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
})
const checkpoint = z.object({
  context: z.record(z.string(), z.string()),
  stories: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string(),
        acceptanceCriteria: z.array(z.string()),
        maxRetries: z.number(),
        retryCount: z.number(),
        status: z.enum(['pending', 'done', 'retry', 'failed']),
        feedback: z.string().optional(),
      }),
    )
    .nullable(),
})

/** Historical data stays outside the original-format SQLite executor. */
export class LegacyRuns {
  /** @param root - Historical per-run journal directory. */
  constructor(private readonly root: string) {}

  private async read(runId: string) {
    if (!/^af-[a-z0-9-]{1,64}$/.test(runId)) throw new Error('invalid historical run id')
    const root = await realpath(this.root)
    const directory = join(root, runId)
    const path = join(directory, 'events.jsonl')
    if ((await realpath(directory)) !== directory || (await realpath(path)) !== path)
      throw new Error('historical journal must not use symbolic links')
    if ((await stat(path)).size > 64 * 1024 * 1024) throw new Error('historical journal exceeds 64 MiB')
    const source = await readFile(path, 'utf8')
    const lines = source.split('\n')
    const first = envelope.parse(JSON.parse(lines[0]!))
    if (first.type !== 'run-start') throw new Error('historical journal has no start identity')
    const start = identity.parse(first.data)
    if (start.runId !== runId) throw new Error('historical journal identity differs from directory')
    const events: z.infer<typeof envelope>[] = []
    let corrupt = !source.endsWith('\n')
    for (const line of lines.slice(0, -1)) {
      try {
        const event = envelope.parse(JSON.parse(line))
        if (event.seq !== events.length || event.version !== first.version)
          throw new Error('historical journal sequence changed')
        events.push(event)
      } catch (error) {
        if (!(error instanceof Error)) throw error
        corrupt = true
        break
      }
    }
    return { start, events, corrupt }
  }

  /** @param runId - Historical identity. @param owner - Read authority. @returns Valid complete-prefix facts, marked inspection-only. */
  async status(runId: string, owner: string): Promise<AntfarmStatus> {
    const { start, events, corrupt } = await this.read(runId)
    if (start.ownerSessionId !== owner) throw new Error('run belongs to another Session')
    const saved = events.findLast((event) => event.type === 'checkpoint')
    const projection = saved ? checkpoint.safeParse(saved.data) : undefined
    const last = events.at(-1)
    return {
      summary: {
        runId: start.runId,
        ownerSessionId: start.ownerSessionId,
        workflowId: start.workflowId,
        workspace: start.workspace,
        branch: start.branch,
        ...(start.task === undefined ? {} : { task: start.task }),
        ...(start.number === undefined ? {} : { number: start.number }),
        status: corrupt ? 'corrupt' : 'legacy',
        updatedAt: last?.time ?? 0,
        workspaceDisposition: 'retained',
        reason: 'Historical journal: inspect its files and native Sessions; execution is disabled.',
      },
      context: projection?.success ? projection.data.context : {},
      stories: projection?.success ? (projection.data.stories ?? []) : [],
      childSessionIds: events
        .filter((event) => event.type === 'attempt-start')
        .flatMap((event) => (typeof event.data.childSessionId === 'string' ? [event.data.childSessionId] : [])),
      uncertain: false,
    }
  }

  /** @param owner - Read authority. @returns Attributable historical runs. Unreadable identities remain on disk. */
  async list(owner: string): Promise<AntfarmStatus[]> {
    let entries: string[]
    try {
      entries = await readdir(this.root)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }
    const results: AntfarmStatus[] = []
    for (const entry of entries) {
      if (!/^af-[a-z0-9-]{1,64}$/.test(entry)) continue
      try {
        const value = await this.status(entry, owner)
        results.push(value)
      } catch (error) {
        if (!(error instanceof Error)) throw error
      }
    }
    return results
  }

  /** @param runId - Historical identity. @param owner - Read authority. @param after - Exclusive cursor. @returns A hundred complete-prefix events. */
  async events(runId: string, owner: string, after: number): Promise<AntfarmEventSummary[]> {
    const { start, events } = await this.read(runId)
    if (start.ownerSessionId !== owner) throw new Error('run belongs to another Session')
    return events
      .filter((event) => event.seq > after)
      .slice(0, 100)
      .map((event) => ({
        seq: event.seq,
        time: event.time,
        type: event.type,
        detail: JSON.stringify(event.data).slice(0, 4000),
      }))
  }
}
