import { Context } from '@deepseek-ai/cordis'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { RunJournal } from '../src/persistence/journal.ts'
import AntfarmStudioGateway from '../src/studio-host/index.ts'
import type { RunStartData } from '../src/persistence/types.ts'

const workflow = {
  id: 'demo', name: 'Demo', version: 1, sourceDirectory: '/workflows/demo',
  agents: [{ id: 'worker', name: 'Worker', role: 'coding' as const, skills: [], persona: 'Worker', instructions: 'Work' }],
  steps: [{ id: 'execute', agent: 'worker', type: 'single' as const, input: '{{task}}', maxRetries: 1 }],
}

function start(runId: string): RunStartData {
  return { runId, ownerSessionId: 'owner', workflowId: 'demo', task: 'test', baseCwd: '/repo', baseRevision: 'abc123', baseStatus: '', workspace: '/repo/.worktrees/antfarm/run', branch: `antfarm/${runId}`, isolation: 'worktree', provider: 'spawn', resolvedWorkflowSnapshot: workflow }
}

describe('Antfarm Studio gateway', () => {
  it('projects journals and edits only canonical workflow files', async () => {
    const base = await mkdtemp(join(tmpdir(), 'antfarm-studio-'))
    const journals = join(base, 'runs')
    const workflows = join(base, 'workflows')
    const directory = join(workflows, 'demo')
    const shared = join(workflows, 'shared', 'worker')
    await mkdir(directory, { recursive: true })
    await mkdir(shared, { recursive: true })
    const yaml = 'id: demo\nagents:\n  - id: worker\n    extends: shared/worker\n'
    await writeFile(join(directory, 'workflow.yml'), yaml)
    await writeFile(join(shared, 'IDENTITY.md'), 'Identity\n')
    await writeFile(join(shared, 'SOUL.md'), 'Soul\n')
    await writeFile(join(shared, 'AGENTS.md'), 'Work\n')
    const journal = await RunJournal.create(journals, start('af-studio'))
    await journal.append('run-end', { runId: 'af-studio', stopReason: 'completed' })

    const ctx = new Context()
    const fiber = await ctx.plugin(AntfarmStudioGateway, { journalRoot: journals, workflowDirs: [workflows], editable: true })
    const gateway = ctx.get('antfarmStudio') as AntfarmStudioGateway
    await expect(gateway.index()).resolves.toMatchObject({ workflows: ['demo'], runs: [{ runId: 'af-studio', status: 'completed' }] })
    const initial = await gateway.workflow('demo') as { revision: string }
    expect(initial).toMatchObject({ id: 'demo', yaml, agents: [{ id: 'worker', files: { 'IDENTITY.md': 'Identity\n', 'SOUL.md': 'Soul\n' }, paths: { 'IDENTITY.md': 'shared/worker/IDENTITY.md' } }] })
    await expect(gateway.save('demo', 'shared/worker/SOUL.md', 'Updated soul\n')).resolves.toEqual({ saved: true })
    await expect(readFile(join(shared, 'SOUL.md'), 'utf8')).resolves.toBe('Updated soul\n')
    await expect(gateway.workflow('demo')).resolves.not.toMatchObject({ revision: initial.revision })
    await expect(gateway.save('demo', '../outside', 'unsafe')).rejects.toThrow('not an editable workflow file')
    await expect(gateway.save('demo', 'workflow.yml', 'invalid: [')).rejects.toThrow()
    await expect(gateway.save('demo', 'workflow.yml', 'id: demo\nname: Missing fields\nversion: 1\n')).rejects.toThrow('workflow.agents')
    await expect(readFile(join(directory, 'workflow.yml'), 'utf8')).resolves.toBe(yaml)
    await fiber.dispose()
    expect(ctx.get('antfarmStudio')).toBeUndefined()

    const readOnly = new Context()
    const readOnlyFiber = await readOnly.plugin(AntfarmStudioGateway, { journalRoot: journals, workflowDirs: [workflows], editable: false })
    await expect((readOnly.get('antfarmStudio') as AntfarmStudioGateway).save('demo', 'workflow.yml', yaml)).rejects.toThrow('editing is disabled')
    await readOnlyFiber.dispose()
  })
})
