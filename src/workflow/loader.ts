/** Load canonical workflow YAML and validate durable resolved snapshots. */

import { access, readFile, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'
import { templateKeys } from './template.ts'
import type { ResolvedAgent, ResolvedOnFail, ResolvedStep, ResolvedWorkflow } from './types.ts'
import { publicWebhookUrl } from './notifications.ts'

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CONTEXT_KEYS = new Set(['task', 'branch', 'workspace', 'current_story', 'verify_feedback', 'changes', 'issues', 'stories_summary', 'resume_guidance', 'results'])
type WorkflowDefinition = Omit<ResolvedWorkflow, 'sourceDirectory'>

function record(value: unknown, label: string, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  const row = value as Record<string, unknown>
  for (const key of Object.keys(row)) {
    if (!keys.includes(key)) throw new Error(`${label}.${key} is unsupported in workflow version 2`)
  }
  return row
}

function text(row: Record<string, unknown>, key: string, label: string): string {
  const value = row[key]
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label}.${key} must be a non-empty string`)
  return value
}

function optionalText(row: Record<string, unknown>, key: string, label: string): string | undefined {
  return row[key] === undefined ? undefined : text(row, key, label)
}

function integer(value: unknown, label: string, fallback?: number, minimum = 0): number {
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`${label} must be a safe integer >= ${minimum}`)
  return value
}

function safeId(value: string, label: string): string {
  if (!ID.test(value)) throw new Error(`${label} must be kebab-case`)
  return value
}

function assertWithinRoot(root: string, path: string): void {
  const rel = relative(root, path)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('workflow sources must remain within the configured workflow root')
}

function parseAgent(value: unknown, index: number): ResolvedAgent {
  const label = `workflow.agents[${index}]`
  const row = record(value, label, ['id', 'name', 'preset', 'instructions', 'model', 'timeoutSeconds', 'skills', 'role', 'description'])
  const id = safeId(text(row, 'id', label), `${label}.id`)
  const model = optionalText(row, 'model', label)
  const timeout = row['timeoutSeconds'] === undefined ? undefined : integer(row['timeoutSeconds'], `${label}.timeoutSeconds`, undefined, 1)
  if (timeout !== undefined && timeout > Math.floor(0x7fffffff / 1000)) throw new Error(`${label}.timeoutSeconds exceeds the timer limit`)
  return {
    id,
    name: optionalText(row, 'name', label) ?? id,
    preset: text(row, 'preset', label),
    instructions: text(row, 'instructions', label),
    ...(row['skills'] === undefined ? {} : { skills: z.array(z.string().min(1)).parse(row['skills']) }),
    ...(row['role'] === undefined ? {} : { role: z.enum(['analysis', 'coding', 'verification', 'testing', 'pr', 'scanning']).parse(row['role']) }),
    ...(row['description'] === undefined ? {} : { description: text(row, 'description', label) }),
    ...(model === undefined ? {} : { model }),
    ...(timeout === undefined ? {} : { timeoutSeconds: timeout }),
  }
}

function parseOnFail(value: unknown, label: string): ResolvedOnFail | undefined {
  if (value === undefined) return undefined
  const row = record(value, label, ['retryStep', 'maxRetries', 'onExhausted'])
  const exhausted = row['onExhausted'] === undefined ? {} : record(row['onExhausted'], `${label}.onExhausted`, ['escalateTo'])
  const escalateTo = exhausted['escalateTo']
  if (escalateTo !== undefined && escalateTo !== 'human') throw new Error(`${label}.onExhausted.escalateTo must be human`)
  const retryStep = optionalText(row, 'retryStep', label)
  return {
    ...(retryStep === undefined ? {} : { retryStep: safeId(retryStep, `${label}.retryStep`) }),
    maxRetries: integer(row['maxRetries'], `${label}.maxRetries`, 1),
    onExhausted: escalateTo === undefined ? {} : { escalateTo },
  }
}

function parseStep(value: unknown, index: number): ResolvedStep {
  const label = `workflow.steps[${index}]`
  const untyped = record(value, label, ['id', 'agent', 'type', 'input', 'output', 'maxRetries', 'onFail', 'over', 'completion', 'freshSession', 'verifyEach', 'verifyStep', 'repairInput', 'expects', 'requireChecks', 'requireVisuals', 'effect'])
  const type = untyped['type'] ?? 'single'
  if (type !== 'single' && type !== 'loop') throw new Error(`${label}.type must be single or loop`)
  const row = record(value, label, type === 'single'
    ? ['id', 'agent', 'type', 'input', 'output', 'maxRetries', 'onFail', 'expects', 'requireChecks', 'requireVisuals', 'effect']
    : ['id', 'agent', 'type', 'input', 'maxRetries', 'onFail', 'over', 'completion', 'freshSession', 'verifyEach', 'verifyStep', 'repairInput', 'expects', 'requireChecks'])
  const onFail = parseOnFail(row['onFail'], `${label}.onFail`)
  const common = {
    id: safeId(text(row, 'id', label), `${label}.id`),
    agent: safeId(text(row, 'agent', label), `${label}.agent`),
    input: text(row, 'input', label),
    ...(row['requireChecks'] === undefined ? {} : { requireChecks: z.boolean().parse(row['requireChecks']) }),
    ...(row['expects'] === undefined ? {} : { expects: z.string().regex(/^[A-Z][A-Z0-9_]*: [^\n]+(?:\n[A-Z][A-Z0-9_]*: [^\n]+)*$/, 'expects must declare KEY: value verdicts').parse(row['expects']) }),
    maxRetries: integer(row['maxRetries'], `${label}.maxRetries`, 1),
    ...(onFail === undefined ? {} : { onFail }),
  }
  if (type === 'single') {
    const output = row['output'] ?? 'result'
    if (output !== 'result' && output !== 'stories') throw new Error(`${label}.output must be result or stories`)
    return { ...common, type, output, ...(row['requireVisuals'] === undefined ? {} : { requireVisuals: z.boolean().parse(row['requireVisuals']) }), ...(row['effect'] === undefined ? {} : { effect: z.enum(['pull-request', 'github-review']).parse(row['effect']) }) }
  }
  if (row['over'] !== 'stories') throw new Error(`${label}.over must be stories`)
  if (row['completion'] !== 'all_done') throw new Error(`${label}.completion must be all_done`)
  if (row['freshSession'] !== true) throw new Error(`${label}.freshSession must be true`)
  const verifyEach = row['verifyEach'] ?? false
  if (typeof verifyEach !== 'boolean') throw new Error(`${label}.verifyEach must be boolean`)
  const verifyStep = optionalText(row, 'verifyStep', label)
  const repairInput = optionalText(row, 'repairInput', label)
  if (verifyEach && verifyStep === undefined) throw new Error(`${label}.verifyStep is required when verifyEach is true`)
  if (!verifyEach && verifyStep !== undefined) throw new Error(`${label}.verifyStep requires verifyEach`)
  return {
    ...common, type, over: 'stories', completion: 'all_done', freshSession: true, verifyEach,
    ...(verifyStep === undefined ? {} : { verifyStep: safeId(verifyStep, `${label}.verifyStep`) }),
    ...(repairInput === undefined ? {} : { repairInput }),
  }
}

function validateReferences(workflow: WorkflowDefinition): void {
  const { agents, steps } = workflow
  if (new Set(agents.map(agent => agent.id)).size !== agents.length) throw new Error('workflow.agents contains duplicate ids')
  if (new Set(steps.map(step => step.id)).size !== steps.length) throw new Error('workflow.steps contains duplicate ids')
  const producers = steps.filter(step => step.type === 'single' && step.output === 'stories')
  const loops = steps.filter(step => step.type === 'loop')
  if (producers.length > 1 || loops.length > 1) throw new Error('workflow supports at most one stories producer and one story loop')
  const agentIds = new Set(agents.map(agent => agent.id))
  for (const [index, step] of steps.entries()) {
    if (!agentIds.has(step.agent)) throw new Error(`step "${step.id}" references unknown agent "${step.agent}"`)
    const isVerify = loops.some(loop => loop.verifyStep === step.id)
    const isRepair = steps.some(candidate => candidate.onFail?.retryStep === step.id)
    for (const key of templateKeys(step.input)) {
      if (!CONTEXT_KEYS.has(key) && workflow.source === undefined && workflow.context?.[key] === undefined) throw new Error(`step "${step.id}" references unsupported template "{{${key}}}"`)
      if (workflow.source === undefined && ['current_story', 'verify_feedback', 'changes'].includes(key) && step.type === 'single' && !isVerify) throw new Error(`step "${step.id}" requires story context for "{{${key}}}"`)
      if (workflow.source === undefined && key === 'issues' && !isRepair) throw new Error(`step "${step.id}" requires repair context for "{{${key}}}"`)
      if (workflow.source === undefined && key === 'stories_summary' && !isRepair && !producers.some(producer => steps.indexOf(producer) < index)) throw new Error(`step "${step.id}" requires a preceding plan for "{{${key}}}"`)
    }
    if (step.type === 'loop') {
      const producer = producers[0]
      if (producer === undefined || steps.indexOf(producer) >= index) throw new Error(`loop "${step.id}" requires a preceding stories output step`)
      if (step.verifyStep !== undefined) {
        const target = steps.find(candidate => candidate.id === step.verifyStep)
        if (target === undefined || target.id === step.id || target.type !== 'single' || target.output !== 'result') throw new Error(`loop "${step.id}" verifyStep must reference a different single result step`)
      }
      if (step.repairInput !== undefined) {
        for (const key of templateKeys(step.repairInput)) {
          if (!CONTEXT_KEYS.has(key) || ['current_story', 'verify_feedback', 'changes'].includes(key)) throw new Error(`loop "${step.id}" repairInput references unsupported template "{{${key}}}"`)
        }
      }
    }
    const retryStep = step.onFail?.retryStep
    if (retryStep !== undefined) {
      const targetIndex = steps.findIndex(candidate => candidate.id === retryStep)
      if (targetIndex < 0 || targetIndex >= index) throw new Error(`step "${step.id}" retryStep must reference an earlier step`)
      const target = steps[targetIndex]!
      if (target.type === 'loop' && target.repairInput === undefined) throw new Error(`loop retry target "${target.id}" requires repairInput`)
      if (target.type === 'single' && target.output === 'stories') throw new Error(`step "${step.id}" cannot retry a stories producer`)
    }
  }
}

function parseDefinition(value: unknown): WorkflowDefinition {
  const row = record(value, 'workflow', ['id', 'name', 'version', 'description', 'agents', 'steps', 'context', 'source', 'workspace', 'inputs', 'allowEmptyPlan', 'notifications'])
  if (row['version'] !== 2) throw new Error('workflow.version must be 2; legacy workflows require conversion')
  if (!Array.isArray(row['agents']) || row['agents'].length === 0) throw new Error('workflow.agents must be a non-empty array')
  if (!Array.isArray(row['steps']) || row['steps'].length === 0) throw new Error('workflow.steps must be a non-empty array')
  const description = optionalText(row, 'description', 'workflow')
  const workflow: WorkflowDefinition = {
    id: safeId(text(row, 'id', 'workflow'), 'workflow.id'),
    name: text(row, 'name', 'workflow'), version: 2,
    ...(description === undefined ? {} : { description }),
    agents: row['agents'].map(parseAgent),
    steps: row['steps'].map(parseStep),
    ...(row['allowEmptyPlan'] === undefined ? {} : { allowEmptyPlan: z.boolean().parse(row['allowEmptyPlan']) }),
    ...(row['workspace'] === undefined ? {} : { workspace: z.enum(['git', 'files']).parse(row['workspace']) }),
    ...(row['inputs'] === undefined ? {} : { inputs: z.array(z.string().min(1)).max(100).parse(row['inputs']) }),
    ...(row['notifications'] === undefined ? {} : { notifications: z.strictObject({ url: z.string().url().transform(publicWebhookUrl).optional() }).parse(row['notifications']) }),
    ...(row['context'] === undefined ? {} : { context: z.record(z.string().regex(/^[a-zA-Z0-9_]+$/), z.string()).parse(row['context']) }),
    ...(row['source'] === undefined ? {} : { source: z.strictObject({ format: z.literal('snarktank-antfarm'), version: z.number().int().positive(), polling: z.strictObject({ model: z.string().optional(), timeoutSeconds: z.number().int().positive().optional() }), cron: z.strictObject({ interval_ms: z.number().int().positive().optional() }), notifications: z.strictObject({ url: z.string().url().transform(publicWebhookUrl).optional() }) }).parse(row['source']) }),
  }
  if (Buffer.byteLength(JSON.stringify(workflow)) > 1024 * 1024) throw new Error('resolved workflow exceeds 1 MiB')
  validateReferences(workflow)
  return workflow
}

/**
 * Validate a journal's complete workflow snapshot without reading source files.
 * @param value - Decoded durable workflow data.
 * @returns A validated version 2 snapshot.
 */
export function validateResolvedWorkflow(value: unknown): ResolvedWorkflow {
  const row = record(value, 'workflow', ['id', 'name', 'version', 'description', 'agents', 'steps', 'sourceDirectory', 'context', 'source', 'workspace', 'inputs', 'allowEmptyPlan', 'notifications'])
  const { sourceDirectory, ...definition } = row
  if (typeof sourceDirectory !== 'string' || !isAbsolute(sourceDirectory)) throw new Error('workflow.sourceDirectory must be an absolute path')
  return { ...parseDefinition(definition), sourceDirectory }
}

function parseDocument(id: string, document: string): WorkflowDefinition {
  const workflow = parseDefinition(parse(document))
  if (workflow.id !== id) throw new Error(`workflow document id "${workflow.id}" does not match selected workflow "${id}"`)
  for (const agent of workflow.agents) {
    if (isAbsolute(agent.instructions) || !agent.instructions.endsWith('.md')) throw new Error(`agent "${agent.id}" instructions must name a relative Markdown file`)
  }
  return workflow
}

/**
 * Validate workflow YAML and its execution references without reading Markdown files.
 * @param id - Selected workflow id.
 * @param document - Canonical YAML text.
 */
export function validateWorkflowSchema(id: string, document: string): void {
  parseDocument(id, document)
}

/**
 * Resolve the first matching workflow and capture its Markdown instructions.
 * @param id - Workflow id.
 * @param roots - Workflow roots in precedence order.
 * @returns Validated workflow snapshot ready for execution.
 */
export async function loadWorkflow(id: string, roots: readonly string[]): Promise<ResolvedWorkflow> {
  safeId(id, 'workflow id')
  for (const root of roots) {
    const candidate = resolve(root, id)
    try {
      await access(join(candidate, 'workflow.yml'))
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
    const canonicalRoot = await realpath(root)
    const sourceDirectory = await realpath(candidate)
    const workflowPath = await realpath(join(sourceDirectory, 'workflow.yml'))
    assertWithinRoot(canonicalRoot, sourceDirectory)
    assertWithinRoot(canonicalRoot, workflowPath)
    const definition = parseDocument(id, await readFile(workflowPath, 'utf8'))
    const agents = await Promise.all(definition.agents.map(async agent => {
      const instructionsPath = await realpath(resolve(sourceDirectory, agent.instructions))
      assertWithinRoot(canonicalRoot, instructionsPath)
      const instructions = (await readFile(instructionsPath, 'utf8')).trim()
      if (instructions === '') throw new Error(`agent "${agent.id}" instructions file must not be empty`)
      return { ...agent, instructions }
    }))
    return { ...definition, agents, sourceDirectory }
  }
  throw new Error(`workflow "${id}" was not found in: ${roots.map(root => resolve(root)).join(', ') || '(no roots)'}`)
}
