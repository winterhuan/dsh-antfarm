import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { loadWorkflow } from '../src/workflow/loader.ts'
import { matchesExpectedLine, parseKeyValues, parseStories, resolveTemplate } from '../src/workflow/template.ts'

async function writeWorkflow(root: string, id: string, name = id): Promise<void> {
  const dir = join(root, id)
  await mkdir(join(dir, 'agents', 'worker'), { recursive: true })
  await writeFile(join(dir, 'workflow.yml'), `id: ${id}\nname: ${name}\nversion: 1\nagents:\n  - id: worker\n    role: coding\nsteps:\n  - id: execute\n    agent: worker\n    type: single\n    input: "Do {{task}}"\n    expects: "STATUS: done"\n`)
  await writeFile(join(dir, 'agents', 'worker', 'IDENTITY.md'), 'You are Worker.')
  await writeFile(join(dir, 'agents', 'worker', 'AGENTS.md'), 'Complete the task.')
}

describe('workflow loader', () => {
  it('loads all bundled workflows and shared personas', async () => {
    const root = join(import.meta.dirname, '..', 'workflows')
    const feature = await loadWorkflow('feature-dev', [root])
    expect(feature.agents).toHaveLength(6)
    expect(feature.steps.map(step => `${step.type}:${step.id}`)).toEqual(['single:plan', 'single:setup', 'loop:implement', 'single:verify-story', 'single:test', 'single:review'])
    const bugFix = await loadWorkflow('bug-fix', [root])
    expect(bugFix.agents.map(agent => agent.persona.length > 0)).toEqual([true, true, true, true])
    expect(bugFix.steps.map(step => step.id)).toEqual(['reproduce', 'repair', 'verify-fix', 'regression'])
    const security = await loadWorkflow('security-audit', [root])
    expect(security.steps.map(step => step.id)).toEqual(['audit', 'remediate', 'verify-remediation', 'final-audit'])
  })

  it('uses the first matching root', async () => {
    const base = await mkdtemp(join(tmpdir(), 'antfarm-workflow-'))
    const high = join(base, 'high')
    const low = join(base, 'low')
    await writeWorkflow(high, 'smoke', 'High')
    await writeWorkflow(low, 'smoke', 'Low')
    expect((await loadWorkflow('smoke', [high, low])).name).toBe('High')
  })

  it('resolves shared agent content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antfarm-shared-'))
    const shared = join(root, 'shared', 'worker')
    const workflow = join(root, 'smoke')
    await mkdir(shared, { recursive: true })
    await mkdir(workflow, { recursive: true })
    await writeFile(join(shared, 'IDENTITY.md'), 'Shared identity.')
    await writeFile(join(shared, 'SOUL.md'), 'Shared soul.')
    await writeFile(join(shared, 'AGENTS.md'), 'Shared instructions.')
    await writeFile(join(workflow, 'workflow.yml'), 'id: smoke\nname: Smoke\nversion: 1\nagents:\n  - id: worker\n    role: coding\n    extends: shared/worker\nsteps:\n  - id: execute\n    agent: worker\n    type: single\n    input: Work\n')
    const loaded = await loadWorkflow('smoke', [root])
    expect(loaded.agents[0]?.persona).toBe('Shared identity.\n\nShared soul.')
    expect(loaded.agents[0]?.instructions).toBe('Shared instructions.')
  })

  it('loads loop verification and top-level repair edges', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antfarm-loop-'))
    const dir = join(root, 'feature-dev')
    for (const agent of ['developer', 'verifier', 'tester']) {
      await mkdir(join(dir, 'agents', agent), { recursive: true })
      await writeFile(join(dir, 'agents', agent, 'IDENTITY.md'), `${agent} identity`)
      await writeFile(join(dir, 'agents', agent, 'AGENTS.md'), `${agent} instructions`)
    }
    await writeFile(join(dir, 'workflow.yml'), `id: feature-dev\nname: Feature Dev\nversion: 1\nagents:\n  - id: developer\n    role: coding\n  - id: verifier\n    role: verification\n  - id: tester\n    role: testing\nsteps:\n  - id: implement\n    agent: developer\n    type: loop\n    over: stories\n    completion: all_done\n    freshSession: true\n    input: "{{current_story}} {{verify_feedback}}"\n    verifyEach: true\n    verifyStep: verify\n    repairInput: "Repair {{issues}}"\n  - id: verify\n    agent: verifier\n    type: single\n    input: "Verify {{current_story}}"\n    expects: "STATUS: done"\n  - id: test\n    agent: tester\n    type: single\n    input: Test\n    expects: "STATUS: done"\n    onFail:\n      retryStep: implement\n      maxRetries: 2\n      onExhausted:\n        escalateTo: human\n`)
    const loaded = await loadWorkflow('feature-dev', [root])
    expect(loaded.steps[0]).toMatchObject({ type: 'loop', verifyEach: true, verifyStep: 'verify', repairInput: 'Repair {{issues}}' })
    expect(loaded.steps[2]).toMatchObject({ onFail: { retryStep: 'implement', maxRetries: 2, onExhausted: { escalateTo: 'human' } } })
  })

  it('rejects a loop retry target without repairInput', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antfarm-loop-invalid-'))
    const dir = join(root, 'invalid-loop')
    await mkdir(join(dir, 'agents', 'worker'), { recursive: true })
    await writeFile(join(dir, 'agents', 'worker', 'IDENTITY.md'), 'Worker')
    await writeFile(join(dir, 'agents', 'worker', 'AGENTS.md'), 'Work')
    await writeFile(join(dir, 'workflow.yml'), 'id: invalid-loop\nname: Invalid\nversion: 1\nagents:\n  - id: worker\n    role: coding\nsteps:\n  - id: loop\n    agent: worker\n    type: loop\n    over: stories\n    completion: all_done\n    freshSession: true\n    input: Work\n  - id: test\n    agent: worker\n    type: single\n    input: Test\n    onFail:\n      retryStep: loop\n')
    await expect(loadWorkflow('invalid-loop', [root])).rejects.toThrow('requires repairInput')
  })

  it('rejects an unknown agent reference', async () => {
    const root = await mkdtemp(join(tmpdir(), 'antfarm-invalid-'))
    await writeWorkflow(root, 'smoke')
    const file = join(root, 'smoke', 'workflow.yml')
    await writeFile(file, 'id: smoke\nname: Smoke\nversion: 1\nagents:\n  - id: worker\n    role: coding\nsteps:\n  - id: execute\n    agent: absent\n    type: single\n    input: Work\n')
    await expect(loadWorkflow('smoke', [root])).rejects.toThrow('unknown agent')
  })
})

describe('workflow text protocol', () => {
  it('resolves strict templates', () => {
    expect(resolveTemplate('Task: {{task}}', { task: 'ship' })).toBe('Task: ship')
    expect(() => resolveTemplate('{{missing}}', {})).toThrow('missing workflow template values: missing')
  })

  it('parses multiline key-value sections and matches complete expected lines', () => {
    expect(parseKeyValues('noise\nSTATUS: done\nCHANGES: src/a.ts\nsrc/b.ts')).toEqual({ STATUS: 'done', CHANGES: 'src/a.ts\nsrc/b.ts' })
    expect(matchesExpectedLine('prefix STATUS: done suffix\nSTATUS: retry', 'STATUS: done')).toBe(false)
    expect(matchesExpectedLine('notes\nSTATUS: done\n', 'STATUS: done')).toBe(true)
  })

  it('parses and validates STORIES_JSON', () => {
    const output = 'STORIES_JSON: [\n  {"id":"S1","title":"First","description":"Build it","acceptanceCriteria":["works"],"maxRetries":3}\n]\nSTATUS: done'
    const expected = [{ id: 'S1', title: 'First', description: 'Build it', acceptanceCriteria: ['works'], maxRetries: 3 }]
    expect(parseStories(output)).toEqual(expected)
    expect(parseStories('STORIES_JSON:\n```json\n[{"id":"S1","title":"First","description":"Build it","acceptanceCriteria":["works"],"maxRetries":3}]\n```\nSTATUS: done')).toEqual(expected)
    expect(parseKeyValues(output)).toEqual({ STATUS: 'done' })
    expect(() => parseStories('STORIES_JSON: [{"id":"S1","title":"A","description":"A","acceptanceCriteria":["x"]},{"id":"S1","title":"B","description":"B","acceptanceCriteria":["y"]}]')).toThrow('duplicate story id')
  })
})
