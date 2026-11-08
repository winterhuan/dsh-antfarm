import { readFile, mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, it, expect, onTestFinished } from 'vitest'
import { loadWorkflow, inferRole, parseWorkflow, validateResolvedWorkflow } from '../src/workflow/loader.ts'
const root = join(import.meta.dirname, '../workflows'),
  baseline = join(import.meta.dirname, 'fixtures/original-antfarm')
describe('original workflow resources', () => {
  it.each(['feature-dev', 'bug-fix', 'security-audit'])('ships %s and every persona resource unchanged', async (id) => {
    const workflow = await loadWorkflow(id, [root]),
      original = await loadWorkflow(id, [join(baseline, 'workflows')])
    expect(workflow.document).toBe(original.document)
    expect(workflow.agents.map((agent) => agent.files)).toEqual(original.agents.map((agent) => agent.files))
    for (const agent of workflow.agents) {
      expect(agent).not.toHaveProperty('preset')
      expect(agent.files['SOUL.md']).toBeTruthy()
      expect(agent.files['IDENTITY.md']).toBeTruthy()
    }
  })
  it('keeps role policies distinct and infers omitted original roles', () => {
    expect(['planner', 'developer', 'verifier', 'tester', 'scanner', 'pr'].map(inferRole)).toEqual([
      'analysis',
      'coding',
      'verification',
      'testing',
      'scanning',
      'pr',
    ])
  })
  it('rejects resources escaping an explicit import root, including symlinks', async () => {
    const home = await mkdtemp(join(tmpdir(), 'antfarm-source-'))
    onTestFinished(() => rm(home, { recursive: true, force: true }))
    const directory = join(home, 'workflow')
    await mkdir(directory)
    const path = join(home, 'outside.md')
    await writeFile(path, 'outside')
    await symlink(path, join(directory, 'role.md'))
    const document =
      'id: test\nagents:\n  - id: worker\n    workspace:\n      baseDir: worker\n      files:\n        AGENTS.md: role.md\nsteps:\n  - id: work\n    agent: worker\n    input: task\n    expects: "STATUS: done"\n'
    await expect(parseWorkflow(document, directory, directory)).rejects.toThrow('source root')
  })
  it('registers no role presets', async () => {
    expect(await readFile(join(root, '../cordis.patch.yml'), 'utf8')).not.toContain('dsh-agent-preset')
  })
  it('checks references in saved snapshots as strictly as installed workflows', async () => {
    const workflow = await loadWorkflow('feature-dev', [root])
    expect(() => validateResolvedWorkflow({ ...workflow, steps: [{ ...workflow.steps[0], agent: 'absent' }] })).toThrow(
      'unknown agent',
    )
    expect(() => validateResolvedWorkflow({ ...workflow, agents: [...workflow.agents, workflow.agents[0]] })).toThrow(
      'duplicate',
    )
    expect(() => validateResolvedWorkflow({ ...workflow, steps: [] })).toThrow()
  })
})
