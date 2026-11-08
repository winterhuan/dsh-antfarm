import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import { stringify } from 'yaml'
import { validateResolvedWorkflow } from '../src/workflow/loader.ts'
import { WorkflowManager } from '../src/workflow/manager.ts'
import { importOriginalWorkflow } from '../src/workflow/original.ts'

const bundled = join(import.meta.dirname, '../workflows')
const original = join(import.meta.dirname, 'fixtures/original-antfarm')
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'antfarm-workflow-management-')))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  return { root, manager: new WorkflowManager(bundled) }
}

describe('workflow resources and original compatibility', () => {
  it.each(['feature-dev', 'bug-fix', 'security-audit'])('imports all original %s roles, steps and expectations', async id => {
    const directory = join(original, 'workflows', id)
    const source = await readFile(join(directory, 'workflow.yml'), 'utf8')
    const workflow = validateResolvedWorkflow(await importOriginalWorkflow(source, directory, original))
    expect(workflow.id).toBe(id)
    expect(workflow.document).toBe(source)
    expect(workflow.steps.every(step => step.expects !== undefined)).toBe(true)
    expect(workflow.agents.every(agent => agent.files['AGENTS.md'] && agent.files['SOUL.md'])).toBe(true)
    expect(workflow.steps.at(-1)?.id).toBe(id === 'feature-dev' ? 'review' : 'pr')
  })

  it('keeps package resources unchanged while saving an inherited project copy', async () => {
    const { root, manager } = await fixture()
    const originalBytes = await readFile(join(bundled, 'feature-dev/workflow.yml'), 'utf8')
    const value = await manager.read('feature-dev', [root])
    const saved = await manager.save({ ...value, document: value.document.replace('Feature Development Workflow', 'Edited feature workflow') }, root, [root])
    expect(saved.sourceDirectory).toBe(join(root, 'feature-dev'))
    expect(saved.revision).not.toBe(value.revision)
    expect(await readFile(join(bundled, 'feature-dev/workflow.yml'), 'utf8')).toBe(originalBytes)
    await manager.remove('feature-dev', root, saved.revision)
    expect((await manager.read('feature-dev', [root])).revision).toBe(value.revision)
  })

  it('rejects a stale competing save and preserves the winning draft', async () => {
    const { root, manager } = await fixture()
    const draft = await manager.read('feature-dev', [root])
    const first = { ...draft, document: draft.document.replace('Feature Development Workflow', 'First smoke') }
    const second = { ...draft, document: draft.document.replace('Feature Development Workflow', 'Second smoke') }
    const results = await Promise.allSettled([manager.save(first, root, [root]), manager.save(second, root, [root])])
    expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected'])
    expect((await manager.read('feature-dev', [root])).document).toContain('First smoke')
  })

  it('binds enablement to observed state and source revision and preserves independent copies', async () => {
    const { root, manager } = await fixture()
    const source = await manager.read('feature-dev', [root])
    await manager.setEnabled('feature-dev', [root], false, true, source.revision)
    await expect(manager.setEnabled('feature-dev', [root], true, true, source.revision)).rejects.toThrow('enablement changed')
    const copy = await manager.copy(source, 'my-smoke', [root], root)
    expect(copy.id).toBe('my-smoke')
    await expect(manager.copy(source, 'my-smoke', [root], root)).rejects.toThrow('already exists')
    expect((await manager.read('feature-dev', [root])).enabled).toBe(false)
    expect((await manager.read('my-smoke', [root])).enabled).toBe(true)
  })

  it('refuses traversal and symbolic link overrides without changing inherited files', async () => {
    const { root, manager } = await fixture()
    const draft = await manager.read('feature-dev', [root])
    await expect(manager.save({ ...draft, files: { '../escape.md': 'escape' } }, root, [root])).rejects.toThrow('child')
    const outside = join(root, 'outside'); await mkdir(outside)
    await symlink(outside, join(root, 'feature-dev'), 'dir')
    await expect(manager.save(draft, root, [root])).rejects.toThrow('real directory')
    expect(await manager.list([root])).toContain('feature-dev')
  })

  it('loads a custom research and writing handoff with explicit work-model fallback', async () => {
    const { root } = await fixture()
    const source = join(original, 'workflows/feature-dev')
    const document = stringify({ id: 'research-write', polling: { model: 'configured-research-model' }, context: { subject: 'A subject' }, agents: [{ id: 'researcher', role: 'analysis', workspace: { baseDir: 'researcher', files: { 'AGENTS.md': 'agents/planner/AGENTS.md' } } }], steps: [{ id: 'research', agent: 'researcher', input: 'Research {{subject}}', expects: 'STATUS: done' }, { id: 'write', agent: 'researcher', input: 'Write using {{research}}', expects: 'STATUS: done' }] })
    const result = validateResolvedWorkflow(await importOriginalWorkflow(document, source, original))
    expect(result.polling?.model).toBe('configured-research-model')
    expect(result.steps[0]?.max_retries).toBe(2)
    expect(result.context?.subject).toBe('A subject')
    await expect(importOriginalWorkflow(document, source, root)).rejects.toThrow('source root')
  })

  it('refuses a symbolic revisions directory before writing role files outside the override', async () => {
    const { root, manager } = await fixture()
    const source = await manager.read('feature-dev', [root])
    const revisions = join(root, 'feature-dev/.revisions')
    const outside = join(root, 'outside')
    await mkdir(outside)
    await mkdir(join(root, 'feature-dev'))
    await symlink(outside, revisions, 'dir')
    await expect(manager.save(source, root, [root])).rejects.toThrow('revisions directory')
    expect(await readdir(outside)).toEqual([])
  })
})
