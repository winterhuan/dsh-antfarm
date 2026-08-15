import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { foldJournal } from '../src/persistence/fold.ts'
import { RunJournal } from '../src/persistence/journal.ts'
import type { RunStartData } from '../src/persistence/types.ts'

const workflow = {
  id: 'smoke', name: 'Smoke', version: 1, sourceDirectory: '/workflows/smoke',
  agents: [{ id: 'worker', name: 'worker', role: 'coding' as const, skills: [], persona: 'Worker', instructions: 'Work' }],
  steps: [{ id: 'execute', agent: 'worker', type: 'single' as const, input: '{{task}}', maxRetries: 1 }],
}

function start(runId: string): RunStartData {
  return { runId, ownerSessionId: 'owner-1', workflowId: 'smoke', task: 'test', baseCwd: '/repo', baseRevision: '0123456789abcdef', baseStatus: '', workspace: '/repo/.worktrees/antfarm/run-1', branch: `antfarm/${runId}`, isolation: 'worktree', provider: 'spawn', resolvedWorkflowSnapshot: workflow }
}

describe('run journal', () => {
  it('creates a missing journal root on first use', async () => {
    const base = await mkdtemp(join(tmpdir(), 'antfarm-first-run-'))
    const root = join(base, 'antfarm', 'runs')
    const journal = await RunJournal.create(root, start('first-run'))
    expect((await journal.load()).map(event => event.type)).toEqual(['run-start'])
  })

  it('appends, reloads, and folds one completed run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antfarm-journal-'))
    const journal = await RunJournal.create(root, start('run-1'))
    await journal.append('step-start', { runId: 'run-1', stepId: 'execute', attempt: 1 })
    await journal.append('step-end', { runId: 'run-1', stepId: 'execute', attempt: 1, outcome: 'done', contextDelta: { STATUS: 'done' }, childSessionId: 'child-1' })
    await journal.append('run-end', { runId: 'run-1', stopReason: 'completed' })
    await journal.append('workspace-retained', { runId: 'run-1', path: '/repo/.worktrees/antfarm/run-1', reason: 'dirty' })
    const events = await (await RunJournal.open(root, 'run-1')).load()
    expect(events.map(event => event.seq)).toEqual([0, 1, 2, 3, 4])
    expect(foldJournal(events)).toMatchObject({ status: 'completed', context: { task: 'test', branch: 'antfarm/run-1', STATUS: 'done' }, workspaceDisposition: 'retained', workspaceReason: 'dirty' })
  })

  it('folds story retries and a blocked run without making it terminal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antfarm-blocked-'))
    const journal = await RunJournal.create(root, start('run-blocked'))
    await journal.append('stories-registered', { runId: 'run-blocked', stepId: 'plan', stories: [{ id: 'S1', title: 'First', description: 'Build it', acceptanceCriteria: ['works'], maxRetries: 2 }] })
    await journal.append('story-end', { runId: 'run-blocked', stepId: 'implement', storyId: 'S1', outcome: 'retry', retryCount: 1, feedback: 'missing test' })
    await journal.append('story-end', { runId: 'run-blocked', stepId: 'implement', storyId: 'S1', outcome: 'failed', retryCount: 2, feedback: 'still missing' })
    await journal.append('run-blocked', { runId: 'run-blocked', stepId: 'implement', storyId: 'S1', reason: 'verification exhausted', feedback: 'still missing' })
    expect(foldJournal(await journal.load())).toMatchObject({ status: 'blocked', blockedReason: 'verification exhausted', stories: [{ id: 'S1', status: 'failed', retryCount: 2, feedback: 'still missing' }] })
  })

  it('marks an open step interrupted and abandons it on resume', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antfarm-interrupted-'))
    const journal = await RunJournal.create(root, start('run-2'))
    await journal.append('step-start', { runId: 'run-2', stepId: 'execute', attempt: 1 })
    expect(foldJournal(await journal.load())).toMatchObject({ status: 'interrupted', openStep: { stepId: 'execute', attempt: 1 } })
    await journal.append('run-resume', { runId: 'run-2', authority: 'owner-1', stepId: 'execute' })
    expect(foldJournal(await journal.load())).toMatchObject({ status: 'interrupted', resumeCount: 1 })
    expect(foldJournal(await journal.load()).openStep).toBeUndefined()
    await journal.append('run-end', { runId: 'run-2', stopReason: 'cancelled' })
    expect(foldJournal(await journal.load()).status).toBe('cancelled')
  })

  it('rejects malformed JSON, sequence gaps, and run mismatches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antfarm-corrupt-'))
    const malformedDir = join(root, 'bad-json')
    await mkdir(malformedDir)
    await writeFile(join(malformedDir, 'events.jsonl'), '{bad}\n')
    await expect(RunJournal.open(root, 'bad-json')).rejects.toThrow('invalid JSON')

    const gapDir = join(root, 'gap')
    await mkdir(gapDir)
    await writeFile(join(gapDir, 'events.jsonl'), `${JSON.stringify({ version: 1, seq: 1, time: 1, type: 'run-start', data: start('gap') })}\n`)
    await expect(RunJournal.open(root, 'gap')).rejects.toThrow('sequence gap')

    const mismatchDir = join(root, 'expected')
    await mkdir(mismatchDir)
    await writeFile(join(mismatchDir, 'events.jsonl'), `${JSON.stringify({ version: 1, seq: 0, time: 1, type: 'run-start', data: start('other') })}\n`)
    await expect(RunJournal.open(root, 'expected')).rejects.toThrow('belongs to run')
  })
})
