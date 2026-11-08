import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { stringify } from 'yaml'
import { describe, expect, it, onTestFinished } from 'vitest'
import { loadWorkflow, validateResolvedWorkflow, validateWorkflowSchema } from '../src/workflow/loader.ts'
import { resolveTemplate, templateKeys } from '../src/workflow/template.ts'
import type { ResolvedWorkflow } from '../src/workflow/types.ts'

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'antfarm-workflow-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  return root
}

function definition(name = 'Smoke') {
  return {
    id: 'smoke', name, version: 2,
    agents: [{ id: 'worker', preset: 'antfarm-coding', instructions: 'worker.md' }],
    steps: [{ id: 'execute', agent: 'worker', type: 'single', input: 'Do {{task}}' }],
  }
}

async function writeWorkflow(root: string, value: ReturnType<typeof definition>): Promise<void> {
  const dir = join(root, value.id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'workflow.yml'), stringify(value))
  await writeFile(join(dir, 'worker.md'), 'Complete the task and run focused checks.\n')
}

function snapshot(): ResolvedWorkflow {
  return {
    id: 'smoke', name: 'Smoke', version: 2, sourceDirectory: '/saved/workflows/smoke',
    agents: [{ id: 'worker', name: 'Worker', preset: 'antfarm-coding', instructions: 'Complete the task.' }],
    steps: [{ id: 'execute', agent: 'worker', type: 'single', input: '{{task}}', output: 'result', maxRetries: 1 }],
  }
}

describe('workflow loader', () => {
  it('loads all bundled workflows with preset instructions and structured outputs', async () => {
    const root = join(import.meta.dirname, '..', 'workflows')
    for (const id of ['smoke', 'feature-dev', 'bug-fix', 'security-audit']) {
      const workflow = await loadWorkflow(id, [root])
      expect(workflow.version).toBe(2)
      expect(workflow.agents.every(agent => agent.instructions.length > 0 && agent.preset.startsWith('antfarm-'))).toBe(true)
      expect(validateResolvedWorkflow(workflow)).toEqual(workflow)
    }
    const feature = await loadWorkflow('feature-dev', [root])
    expect(feature.agents).toHaveLength(7)
    expect(feature.steps.map(step => `${step.type}:${step.id}`)).toEqual(['single:plan', 'single:setup', 'loop:implement', 'single:verify-story', 'single:test', 'single:pr', 'single:review'])
    expect(feature.steps[0]).toMatchObject({ output: 'stories' })
    expect(feature.steps[2]).toMatchObject({ type: 'loop', verifyEach: true, verifyStep: 'verify-story', repairInput: expect.stringContaining('{{issues}}') })
    expect(feature.steps[4]).toMatchObject({ onFail: { retryStep: 'implement', maxRetries: 2, onExhausted: { escalateTo: 'human' } } })
    const bugFix = await loadWorkflow('bug-fix', [root])
    const security = await loadWorkflow('security-audit', [root])
    expect(bugFix.agents.find(agent => agent.id === 'fixer')?.instructions).toBe(security.agents.find(agent => agent.id === 'fixer')?.instructions)
  })

  it('uses the first matching root and resolves the selected Markdown source', async () => {
    const base = await temporaryRoot()
    const high = join(base, 'high')
    const low = join(base, 'low')
    await writeWorkflow(high, definition('High'))
    await writeWorkflow(low, definition('Low'))
    const loaded = await loadWorkflow('smoke', [high, low])
    expect(loaded.name).toBe('High')
    expect(loaded.agents[0]).toMatchObject({ name: 'worker', instructions: 'Complete the task and run focused checks.' })
    expect(loaded.steps[0]).toMatchObject({ output: 'result', maxRetries: 1 })
  })

  it('reports an invalid overriding workflow instead of falling back to a bundled definition', async () => {
    const base = await temporaryRoot()
    const high = join(base, 'high')
    const low = join(base, 'low')
    await writeWorkflow(high, { ...definition(), version: 1 })
    await writeWorkflow(low, definition())
    await expect(loadWorkflow('smoke', [high, low])).rejects.toThrow('workflow.version must be 2')
  })

  it('rejects an empty instruction file', async () => {
    const root = await temporaryRoot()
    await writeWorkflow(root, definition())
    await writeFile(join(root, 'smoke', 'worker.md'), ' \n')
    await expect(loadWorkflow('smoke', [root])).rejects.toThrow('instructions file must not be empty')
  })

  it('rejects invalid instruction paths before reading a file', () => {
    for (const instructions of ['/etc/instructions.md', 'worker.txt']) {
      const raw = definition()
      expect(() => validateWorkflowSchema('smoke', stringify({ ...raw, agents: [{ ...raw.agents[0], instructions }] }))).toThrow('relative Markdown file')
    }
  })

  it('rejects a relative instruction path outside the configured workflow root', async () => {
    const base = await temporaryRoot()
    const root = join(base, 'workflows')
    const raw = definition()
    await writeWorkflow(root, { ...raw, agents: [{ ...raw.agents[0]!, instructions: '../../outside.md' }] })
    await writeFile(join(base, 'outside.md'), 'Outside instructions.\n')
    await expect(loadWorkflow('smoke', [root])).rejects.toThrow('remain within the configured workflow root')
  })

  // Windows symbolic links require host privileges that parser tests do not own.
  it.skipIf(process.platform === 'win32')('rejects instruction and workflow symlinks outside the configured root', async () => {
    const base = await temporaryRoot()
    const root = join(base, 'workflows')
    await writeWorkflow(root, definition())
    await writeFile(join(base, 'outside.md'), 'Outside instructions.\n')
    await rm(join(root, 'smoke', 'worker.md'))
    await symlink(join(base, 'outside.md'), join(root, 'smoke', 'worker.md'))
    await expect(loadWorkflow('smoke', [root])).rejects.toThrow('remain within the configured workflow root')
    await rm(join(root, 'smoke'), { recursive: true })
    await writeWorkflow(base, definition())
    await symlink(join(base, 'smoke'), join(root, 'smoke'), 'dir')
    await expect(loadWorkflow('smoke', [root])).rejects.toThrow('remain within the configured workflow root')
  })

  it('rejects an unknown agent reference', () => {
    const raw = definition()
    expect(() => validateWorkflowSchema('smoke', stringify({ ...raw, steps: [{ ...raw.steps[0], agent: 'absent' }] }))).toThrow('unknown agent')
  })

  it('rejects unsafe workflow ids and missing workflows', async () => {
    const root = await temporaryRoot()
    await expect(loadWorkflow('../smoke', [root])).rejects.toThrow('kebab-case')
    await expect(loadWorkflow('smoke', [root])).rejects.toThrow('was not found')
  })
})

describe('durable workflow validation', () => {
  it('validates captured instructions without reopening source files', () => {
    expect(validateResolvedWorkflow(snapshot())).toEqual(snapshot())
  })

  it.each([
    ['old workflow version', (value: ResolvedWorkflow) => ({ ...value, version: 1 }), 'legacy workflows require conversion'],
    ['relative source directory', (value: ResolvedWorkflow) => ({ ...value, sourceDirectory: './smoke' }), 'absolute path'],
    ['missing preset', (value: ResolvedWorkflow) => ({ ...value, agents: [{ ...value.agents[0], preset: undefined }] }), 'preset must be a non-empty string'],
    ['invalid agent role', (value: ResolvedWorkflow) => ({ ...value, agents: [{ ...value.agents[0], role: 'magic' }] }), 'Invalid option'],
    ['invalid agent timeout', (value: ResolvedWorkflow) => ({ ...value, agents: [{ ...value.agents[0], timeoutSeconds: 2147484 }] }), 'timer limit'],
    ['negative retries', (value: ResolvedWorkflow) => ({ ...value, steps: [{ ...value.steps[0], maxRetries: -1 }] }), 'safe integer'],
    ['invalid verdict declaration', (value: ResolvedWorkflow) => ({ ...value, steps: [{ ...value.steps[0], expects: 'done' }] }), 'KEY: value'],
    ['unknown structured output', (value: ResolvedWorkflow) => ({ ...value, steps: [{ ...value.steps[0], output: 'text' }] }), 'output must be result or stories'],
    ['unknown context key', (value: ResolvedWorkflow) => ({ ...value, steps: [{ ...value.steps[0], input: '{{STATUS}}' }] }), 'unsupported template'],
    ['story context outside a loop', (value: ResolvedWorkflow) => ({ ...value, steps: [{ ...value.steps[0], input: '{{current_story}}' }] }), 'requires story context'],
    ['duplicate agents', (value: ResolvedWorkflow) => ({ ...value, agents: [...value.agents, ...value.agents] }), 'duplicate ids'],
  ])('rejects %s', (_name, invalid, message) => {
    expect(() => validateResolvedWorkflow(invalid(snapshot()))).toThrow(message)
  })

  it('requires the stories producer to precede the loop', async () => {
    const feature = await loadWorkflow('feature-dev', [join(import.meta.dirname, '..', 'workflows')])
    expect(() => validateResolvedWorkflow({ ...feature, steps: feature.steps.slice(1) })).toThrow('preceding stories output step')
    expect(() => validateResolvedWorkflow({ ...feature, steps: [...feature.steps.slice(1), feature.steps[0]] })).toThrow('preceding stories output step')
  })

  it('rejects multiple story producers and multiple story loops', async () => {
    const feature = await loadWorkflow('feature-dev', [join(import.meta.dirname, '..', 'workflows')])
    for (const [index, id] of [[0, 'other-plan'], [2, 'other-loop']] as const) {
      expect(() => validateResolvedWorkflow({ ...feature, steps: [...feature.steps, { ...feature.steps[index], id }] })).toThrow('at most one stories producer and one story loop')
    }
  })

  it('rejects missing verification and repair targets', async () => {
    const feature = await loadWorkflow('feature-dev', [join(import.meta.dirname, '..', 'workflows')])
    const loop = feature.steps[2]
    expect(() => validateResolvedWorkflow({ ...feature, steps: feature.steps.map(step => step === loop ? { ...step, verifyStep: 'missing' } : step) })).toThrow('different single result step')
    expect(() => validateResolvedWorkflow({ ...feature, steps: feature.steps.map(step => step === loop ? { ...step, repairInput: undefined } : step) })).toThrow('requires repairInput')
    expect(() => validateResolvedWorkflow({ ...feature, steps: feature.steps.map(step => step.id === 'test' ? { ...step, onFail: { retryStep: 'review', maxRetries: 1, onExhausted: {} } } : step) })).toThrow('earlier step')
  })
})

describe('workflow templates', () => {
  it('resolves repeated references and reports every missing key before execution', () => {
    expect(resolveTemplate('Task: {{task}} / {{ task }}', { task: 'ship' })).toBe('Task: ship / ship')
    expect(templateKeys('{{task}} {{workspace}} {{task}}')).toEqual(['task', 'workspace'])
    expect(() => resolveTemplate('{{zeta}} {{alpha}} {{zeta}}', {})).toThrow('missing workflow template values: alpha, zeta')
  })
})
