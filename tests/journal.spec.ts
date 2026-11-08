import { mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, onTestFinished } from 'vitest'
import { RunJournal, readJournalIdentity } from '../src/persistence/journal.ts'
import type { Checkpoint, JournalRecord, RunStartData } from '../src/persistence/types.ts'

function start(runId = 'af-journal'): RunStartData {
  return {
    runId, ownerSessionId: 'owner', workflowId: 'smoke', task: 'complete the task',
    baseCwd: '/repo', baseRevision: 'a'.repeat(40), workspace: `/repo/.worktrees/antfarm/${runId}`,
    branch: `antfarm/${runId}`, provider: 'spawn',
    resolvedWorkflowSnapshot: {
      id: 'smoke', name: 'Smoke', version: 2, sourceDirectory: '/workflows/smoke',
      agents: [{ id: 'worker', name: 'Worker', preset: 'antfarm-coding', instructions: 'Complete the task.' }],
      steps: [{ id: 'execute', agent: 'worker', type: 'single', input: '{{task}}', output: 'result', maxRetries: 1 }],
    },
  }
}

function checkpoint(): Checkpoint {
  return { cursor: 0, context: {}, stories: null, retries: {}, feedback: {}, repair: null, blocked: null }
}

async function root(): Promise<string> {
  const path = await realpath(await mkdtemp(join(tmpdir(), 'antfarm-journal-')))
  onTestFinished(() => rm(path, { recursive: true, force: true }))
  return path
}

async function rawJournal(root: string, runId: string, records: readonly object[]): Promise<string> {
  const dir = join(root, runId)
  await mkdir(dir)
  const path = join(dir, 'events.jsonl')
  await writeFile(path, records.map((value, seq) => JSON.stringify({ ...value, version: 3, seq, time: 0 })).join('\n') + '\n')
  return path
}

describe('version 3 run journals', () => {
  it('persists start before returning and serializes concurrent writes', async () => {
    const path = await root()
    const journal = await RunJournal.create(join(path, 'runs'), start())
    expect(JSON.parse((await readFile(journal.eventsPath, 'utf8')).trim())).toMatchObject({ version: 3, seq: 0, type: 'run-start' })
    await Promise.all([
      journal.append({ type: 'workspace-ready', data: {} }),
      journal.append({ type: 'checkpoint', data: { ...checkpoint(), context: { setup: 'ready' } } }),
      journal.append({ type: 'run-resume', data: { guidance: 'continue' } }),
    ])
    const reopened = await RunJournal.open(join(path, 'runs'), 'af-journal')
    expect(reopened.state).toEqual(journal.state)
    const events = (await readFile(journal.eventsPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
    expect(events.map(event => event.seq)).toEqual([0, 1, 2, 3])
    expect(reopened.state.checkpoint.context).toEqual({ setup: 'ready' })
  })

  it('keeps completed and failed child results out of accepted context until a checkpoint', async () => {
    const path = await root()
    const journal = await RunJournal.create(path, start())
    await journal.append({ type: 'workspace-ready', data: {} })
    await journal.append({ type: 'attempt-start', data: { stepId: 'execute', childSessionId: 'child-1', execution: 'single' } })
    await journal.append({ type: 'attempt-end', data: { childSessionId: 'child-1', passed: false, summary: 'rejected output' } })
    expect(journal.state.checkpoint.context).toEqual({})
    expect(journal.state.openAttempt?.childSessionId).toBe('child-1')
    await journal.append({ type: 'checkpoint', data: { ...checkpoint(), retries: { execute: 1 }, feedback: { execute: 'rejected output' } } })
    await journal.append({ type: 'attempt-start', data: { stepId: 'execute', childSessionId: 'child-2', execution: 'single' } })
    await journal.append({ type: 'attempt-end', data: { childSessionId: 'child-2', passed: true, summary: 'accepted output' } })
    expect(journal.state.checkpoint.context).toEqual({})
    await journal.append({ type: 'checkpoint', data: { ...checkpoint(), cursor: 1, context: { execute: 'accepted output' } } })
    await journal.append({ type: 'run-end', data: { status: 'completed', reason: '' } })
    expect((await RunJournal.open(path, 'af-journal')).state).toMatchObject({ status: 'completed', openAttempt: null, checkpoint: { cursor: 1, context: { execute: 'accepted output' } }, childSessionIds: ['child-1', 'child-2'] })
  })

  it('requires explicit reconciliation guidance for an uncertain attempt', async () => {
    const path = await root()
    const journal = await RunJournal.create(path, start())
    await journal.append({ type: 'workspace-ready', data: {} })
    await journal.append({ type: 'attempt-start', data: { stepId: 'execute', childSessionId: 'uncertain-child', execution: 'single' } })
    const reopened = await RunJournal.open(path, 'af-journal')
    await expect(reopened.append({ type: 'run-resume', data: { guidance: '' } })).rejects.toThrow('reconciliation guidance')
    const reconciled = await RunJournal.open(path, 'af-journal')
    await reconciled.append({ type: 'run-resume', data: { guidance: 'Inspect the retained diff before repeating this step.' } })
    expect(reconciled.state.resumeGuidance).toContain('retained diff')
    expect(reconciled.state.openAttempt?.childSessionId).toBe('uncertain-child')
  })

  it('keeps version 1 evidence readable for attribution and refuses to reinterpret or rewrite it', async () => {
    const path = await root()
    const file = await rawJournal(path, 'af-legacy', [{ type: 'run-start', data: start('af-legacy') }])
    const source = (await readFile(file, 'utf8')).replaceAll('"version":3', '"version":1')
    await writeFile(file, source)
    expect(await readJournalIdentity(path, 'af-legacy')).toMatchObject({ version: 1, data: { runId: 'af-legacy', ownerSessionId: 'owner' } })
    await expect(RunJournal.open(path, 'af-legacy')).rejects.toThrow()
    expect(await readFile(file, 'utf8')).toBe(source)
  })

  it.each(['incomplete', 'malformed', 'sequence', 'identity', 'snapshot'])('retains %s disk evidence after refusing recovery', async kind => {
    const path = await root()
    const file = await rawJournal(path, 'af-corrupt', [{ type: 'run-start', data: start('af-corrupt') }])
    let source = await readFile(file, 'utf8')
    if (kind === 'incomplete') source += '{"version":3'
    if (kind === 'malformed') source += '{bad json}\n'
    if (kind === 'sequence') source += JSON.stringify({ type: 'workspace-ready', data: {}, version: 3, seq: 2, time: 0 }) + '\n'
    if (kind === 'identity') source = source.replace('"runId":"af-corrupt"', '"runId":"af-other"')
    if (kind === 'snapshot') source = source.replace('"preset":"antfarm-coding"', '"preset":false')
    await writeFile(file, source)
    await expect(RunJournal.open(path, 'af-corrupt')).rejects.toThrow()
    expect(await readFile(file, 'utf8')).toBe(source)
  })

  it.each([
    ['overlapping child', [{ type: 'workspace-ready', data: {} }, { type: 'attempt-start', data: { stepId: 'execute', childSessionId: 'child-1', execution: 'single' } }, { type: 'attempt-start', data: { stepId: 'execute', childSessionId: 'child-2', execution: 'single' } }], 'overlaps'],
    ['unknown step', [{ type: 'workspace-ready', data: {} }, { type: 'attempt-start', data: { stepId: 'missing', childSessionId: 'child-1', execution: 'single' } }], 'unknown step'],
    ['premature completion', [{ type: 'workspace-ready', data: {} }, { type: 'run-end', data: { status: 'completed', reason: '' } }], 'accepted workflow checkpoints'],
    ['oversized cursor', [{ type: 'workspace-ready', data: {} }, { type: 'checkpoint', data: { ...checkpoint(), cursor: 2 } }], 'exceeds workflow'],
  ] as const)('rejects %s transitions from disk', async (_name, records, message) => {
    const path = await root()
    await rawJournal(path, 'af-transitions', [{ type: 'run-start', data: start('af-transitions') }, ...records])
    await expect(RunJournal.open(path, 'af-transitions')).rejects.toThrow(message)
  })

  it('recovers a torn final write, preserves its exact bytes and keeps the attempt uncertain', async () => {
    const path = await root()
    const journal = await RunJournal.create(path, start())
    await journal.append({ type: 'workspace-ready', data: {} })
    await journal.append({ type: 'attempt-start', data: { stepId: 'execute', childSessionId: 'uncertain', execution: 'single' } })
    const source = (await readFile(journal.eventsPath, 'utf8')) + '{"version":3,"type":"attempt-end"'
    await writeFile(journal.eventsPath, source)
    const recovered = await RunJournal.recoverTail(path, 'af-journal')
    expect(recovered.state.openAttempt?.childSessionId).toBe('uncertain')
    const receipt = JSON.parse((await readFile(journal.eventsPath, 'utf8')).trim().split('\n').at(-1)!)
    expect(receipt.type).toBe('tail-recovered')
    expect(await readFile(join(path, 'af-journal', receipt.data.source), 'utf8')).toBe(source)
    expect(receipt.data.bytes).toBe(Buffer.byteLength(source))
    await expect(recovered.append({ type: 'run-resume', data: { guidance: '' } })).rejects.toThrow('reconciliation')
  })

  it('refuses middle corruption even when a final write is torn', async () => {
    const path = await root(); const journal = await RunJournal.create(path, start())
    const source = (await readFile(journal.eventsPath, 'utf8')) + '{bad json}\n{"version":3'
    await writeFile(journal.eventsPath, source)
    await expect(RunJournal.recoverTail(path, 'af-journal')).rejects.toThrow()
    expect(await readFile(journal.eventsPath, 'utf8')).toBe(source)
  })

  it('resumes a failed Run in place with cumulative budget and accepted history', async () => {
    const path = await root(); const journal = await RunJournal.create(path, start())
    await journal.append({ type: 'workspace-ready', data: {} })
    await journal.append({ type: 'checkpoint', data: { ...checkpoint(), context: { baseline: 'kept' }, retries: { execute: 2 } } })
    await journal.append({ type: 'run-end', data: { status: 'failed', reason: 'exhausted' } })
    await journal.append({ type: 'run-resume', data: { guidance: 'dependency corrected', retryGrant: 1 } })
    expect(journal.state).toMatchObject({ status: 'queued', retryGrant: 1, checkpoint: { context: { baseline: 'kept' }, retries: { execute: 2 } } })
  })

  it('poisons a writer after storage fails and preserves its last committed state', async () => {
    const path = await root()
    const journal = await RunJournal.create(path, start())
    const source = await readFile(journal.eventsPath, 'utf8')
    const backup = journal.eventsPath + '.backup'
    await rename(journal.eventsPath, backup)
    await mkdir(journal.eventsPath)
    await expect(journal.append({ type: 'workspace-ready', data: {} })).rejects.toThrow()
    expect(journal.state.prepared).toBe(false)
    await rm(journal.eventsPath, { recursive: true })
    await rename(backup, journal.eventsPath)
    const record: JournalRecord = { type: 'workspace-ready', data: {} }
    await expect(journal.append(record)).rejects.toThrow()
    expect(await readFile(journal.eventsPath, 'utf8')).toBe(source)
    expect((await RunJournal.open(path, 'af-journal')).state.prepared).toBe(false)
  })
})
