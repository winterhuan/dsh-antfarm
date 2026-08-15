import { access, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'
import { assertStaticPersona, templateKeys } from './template.ts'
import type { AgentRole, ResolvedAgent, ResolvedOnFail, ResolvedStep, ResolvedWorkflow } from './types.ts'

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const ROLES = new Set<AgentRole>(['analysis', 'coding', 'verification', 'testing', 'pr', 'scanning'])

interface RawAgent {
  readonly id: string
  readonly name?: string
  readonly role?: AgentRole
  readonly model?: string
  readonly timeoutSeconds?: number
  readonly skills?: readonly string[]
  readonly extends?: string
}

type RawStep = ResolvedStep

interface RawWorkflow {
  readonly id: string
  readonly name: string
  readonly version: number
  readonly description?: string
  readonly agents: readonly RawAgent[]
  readonly steps: readonly RawStep[]
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as Record<string, unknown>
}

function stringField(value: Record<string, unknown>, key: string, label: string): string {
  const field = value[key]
  if (typeof field !== 'string' || field.trim() === '') throw new Error(`${label}.${key} must be a non-empty string`)
  return field
}

function optionalString(value: Record<string, unknown>, key: string, label: string): string | undefined {
  const field = value[key]
  if (field === undefined) return undefined
  if (typeof field !== 'string' || field.trim() === '') throw new Error(`${label}.${key} must be a non-empty string when present`)
  return field
}

function positiveInteger(value: unknown, label: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer`)
  return value
}

function nonNegativeInteger(value: unknown, label: string, fallback?: number): number {
  if (value === undefined && fallback !== undefined) return fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`)
  return value
}

function safeId(value: string, label: string): string {
  if (!ID.test(value)) throw new Error(`${label} must be kebab-case`)
  return value
}

function parseAgent(value: unknown, index: number): RawAgent {
  const label = `workflow.agents[${index}]`
  const row = record(value, label)
  const roleValue = row['role']
  let role: AgentRole | undefined
  if (roleValue !== undefined) {
    if (typeof roleValue !== 'string' || !ROLES.has(roleValue as AgentRole)) throw new Error(`${label}.role is unsupported`)
    role = roleValue as AgentRole
  }
  const skillsValue = row['skills']
  let skills: string[] | undefined
  if (skillsValue !== undefined) {
    if (!Array.isArray(skillsValue) || !skillsValue.every(item => typeof item === 'string' && ID.test(item))) {
      throw new Error(`${label}.skills must contain kebab-case strings`)
    }
    skills = [...skillsValue] as string[]
  }
  const timeoutValue = row['timeoutSeconds'] ?? row['timeout_seconds']
  const name = optionalString(row, 'name', label)
  const model = optionalString(row, 'model', label)
  const extendsAgent = optionalString(row, 'extends', label)
  return {
    id: safeId(stringField(row, 'id', label), `${label}.id`),
    ...(name === undefined ? {} : { name }),
    ...(role === undefined ? {} : { role }),
    ...(model === undefined ? {} : { model }),
    ...(timeoutValue === undefined ? {} : { timeoutSeconds: positiveInteger(timeoutValue, `${label}.timeoutSeconds`) }),
    ...(skills === undefined ? {} : { skills }),
    ...(extendsAgent === undefined ? {} : { extends: extendsAgent }),
  }
}

function parseOnFail(value: unknown, label: string): ResolvedOnFail | undefined {
  if (value === undefined) return undefined
  const row = record(value, label)
  const retryStep = optionalString(row, 'retryStep', label) ?? optionalString(row, 'retry_step', label)
  const exhaustedValue = row['onExhausted'] ?? row['on_exhausted']
  let escalateTo: 'human' | undefined
  if (exhaustedValue !== undefined) {
    const exhausted = record(exhaustedValue, `${label}.onExhausted`)
    const rawEscalation = exhausted['escalateTo'] ?? exhausted['escalate_to']
    if (rawEscalation !== undefined && rawEscalation !== 'human') throw new Error(`${label}.onExhausted.escalateTo must be human`)
    escalateTo = rawEscalation
  }
  return {
    ...(retryStep === undefined ? {} : { retryStep: safeId(retryStep, `${label}.retryStep`) }),
    maxRetries: nonNegativeInteger(row['maxRetries'] ?? row['max_retries'], `${label}.maxRetries`, 1),
    onExhausted: escalateTo === undefined ? {} : { escalateTo },
  }
}

function parseStep(value: unknown, index: number): RawStep {
  const label = `workflow.steps[${index}]`
  const row = record(value, label)
  const type = row['type'] ?? 'single'
  if (type !== 'single' && type !== 'loop') throw new Error(`${label}.type must be single or loop`)
  const retryValue = row['maxRetries'] ?? row['max_retries']
  const expects = optionalString(row, 'expects', label)
  const onFail = parseOnFail(row['onFail'] ?? row['on_fail'], `${label}.onFail`)
  const common = {
    id: safeId(stringField(row, 'id', label), `${label}.id`),
    agent: safeId(stringField(row, 'agent', label), `${label}.agent`),
    input: stringField(row, 'input', label),
    ...(expects === undefined ? {} : { expects }),
    maxRetries: retryValue === undefined ? 1 : nonNegativeInteger(retryValue, `${label}.maxRetries`),
    ...(onFail === undefined ? {} : { onFail }),
  }
  if (type === 'single') return { ...common, type }
  const over = row['over']
  const completion = row['completion']
  const freshSession = row['freshSession'] ?? row['fresh_session']
  if (over !== 'stories') throw new Error(`${label}.over must be stories`)
  if (completion !== 'all_done') throw new Error(`${label}.completion must be all_done`)
  if (freshSession !== true) throw new Error(`${label}.freshSession must be true`)
  const verifyEachValue = row['verifyEach'] ?? row['verify_each'] ?? false
  if (typeof verifyEachValue !== 'boolean') throw new Error(`${label}.verifyEach must be boolean`)
  const verifyStep = optionalString(row, 'verifyStep', label) ?? optionalString(row, 'verify_step', label)
  const repairInput = optionalString(row, 'repairInput', label) ?? optionalString(row, 'repair_input', label)
  if (verifyEachValue && verifyStep === undefined) throw new Error(`${label}.verifyStep is required when verifyEach is true`)
  return {
    ...common,
    type,
    over,
    completion,
    freshSession,
    verifyEach: verifyEachValue,
    ...(verifyStep === undefined ? {} : { verifyStep: safeId(verifyStep, `${label}.verifyStep`) }),
    ...(repairInput === undefined ? {} : { repairInput }),
  }
}

function parseWorkflow(value: unknown): RawWorkflow {
  const row = record(value, 'workflow')
  if (!Array.isArray(row['agents']) || row['agents'].length === 0) throw new Error('workflow.agents must be a non-empty array')
  if (!Array.isArray(row['steps']) || row['steps'].length === 0) throw new Error('workflow.steps must be a non-empty array')
  const description = optionalString(row, 'description', 'workflow')
  return {
    id: safeId(stringField(row, 'id', 'workflow'), 'workflow.id'),
    name: stringField(row, 'name', 'workflow'),
    version: positiveInteger(row['version'], 'workflow.version'),
    ...(description === undefined ? {} : { description }),
    agents: row['agents'].map(parseAgent),
    steps: row['steps'].map(parseStep),
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function optionalText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

async function findWorkflowDirectory(id: string, roots: readonly string[]): Promise<string> {
  safeId(id, 'workflow id')
  for (const root of roots) {
    const candidate = join(resolve(root), id)
    if (await exists(join(candidate, 'workflow.yml'))) return candidate
  }
  throw new Error(`workflow "${id}" was not found in: ${roots.map(root => resolve(root)).join(', ') || '(no roots)'}`)
}

async function findSharedDirectory(reference: string, roots: readonly string[]): Promise<string> {
  const match = /^shared\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(reference)
  if (match === null || match[1] === undefined) throw new Error(`agent extends must be shared/<id>, received ${JSON.stringify(reference)}`)
  for (const root of roots) {
    const candidate = join(resolve(root), 'shared', match[1])
    if (await exists(candidate)) return candidate
  }
  throw new Error(`shared agent "${reference}" was not found`)
}

async function loadAgentContent(raw: RawAgent, workflowDir: string, roots: readonly string[]): Promise<ResolvedAgent> {
  const localDir = join(workflowDir, 'agents', raw.id)
  const sharedDir = raw.extends === undefined ? undefined : await findSharedDirectory(raw.extends, roots)
  const readLayered = async (filename: string): Promise<string> => {
    const local = await optionalText(join(localDir, filename))
    if (local !== undefined) return local.trim()
    if (sharedDir !== undefined) {
      const inherited = await optionalText(join(sharedDir, filename))
      if (inherited !== undefined) return inherited.trim()
    }
    return ''
  }
  const identity = await readLayered('IDENTITY.md')
  const soul = await readLayered('SOUL.md')
  const instructions = await readLayered('AGENTS.md')
  const persona = [identity, soul].filter(Boolean).join('\n\n')
  if (persona === '') throw new Error(`agent "${raw.id}" requires IDENTITY.md or SOUL.md`)
  if (instructions === '') throw new Error(`agent "${raw.id}" requires AGENTS.md`)
  assertStaticPersona(persona, raw.id)
  const role = raw.role
  if (role === undefined) throw new Error(`agent "${raw.id}" requires role after extends resolution`)
  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    role,
    ...raw.model === undefined ? {} : { model: raw.model },
    ...raw.timeoutSeconds === undefined ? {} : { timeoutSeconds: raw.timeoutSeconds },
    skills: raw.skills ?? [],
    persona,
    instructions,
  }
}

function assertUnique(values: readonly string[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label} contains duplicate id "${value}"`)
    seen.add(value)
  }
}

/** Validate the top-level workflow document and its typed fields. */
export function validateWorkflowSchema(id: string, document: string): void {
  const raw = parseWorkflow(parse(document))
  if (raw.id !== id) throw new Error(`workflow document id "${raw.id}" does not match selected workflow "${id}"`)
  assertUnique(raw.agents.map(agent => agent.id), 'workflow.agents')
  assertUnique(raw.steps.map(step => step.id), 'workflow.steps')
}

/** Load the highest-precedence workflow and resolve all agent content. */
export async function loadWorkflow(id: string, roots: readonly string[]): Promise<ResolvedWorkflow> {
  const workflowDir = await findWorkflowDirectory(id, roots)
  const raw = parseWorkflow(parse(await readFile(join(workflowDir, 'workflow.yml'), 'utf8')))
  if (raw.id !== id) throw new Error(`workflow directory id "${id}" does not match workflow.yml id "${raw.id}"`)
  assertUnique(raw.agents.map(agent => agent.id), 'workflow.agents')
  assertUnique(raw.steps.map(step => step.id), 'workflow.steps')
  const agentIds = new Set(raw.agents.map(agent => agent.id))
  const stepById = new Map(raw.steps.map((step, index) => [step.id, { step, index }]))
  for (const [index, step] of raw.steps.entries()) {
    if (!agentIds.has(step.agent)) throw new Error(`step "${step.id}" references unknown agent "${step.agent}"`)
    if (step.type === 'loop' && step.verifyStep !== undefined) {
      const target = stepById.get(step.verifyStep)
      if (target === undefined) throw new Error(`loop step "${step.id}" references unknown verifyStep "${step.verifyStep}"`)
      if (target.step.id === step.id || target.step.type !== 'single') throw new Error(`loop step "${step.id}" verifyStep must reference a different single step`)
    }
    const keys = templateKeys(step.input)
    const reserved = new Set(['task', 'workspace', 'branch', 'resume_guidance', 'current_story', 'verify_feedback', 'changes', 'issues', 'stories_summary'])
    for (const key of keys) {
      if (!reserved.has(key) && !/^[A-Z][A-Z0-9_]*$/.test(key)) {
        throw new Error(`step "${step.id}" references unsupported template "{{${key}}}"; use declared runtime context keys`)
      }
      if ((key === 'current_story' || key === 'verify_feedback' || key === 'changes') && step.type === 'single') {
        const isVerify = raw.steps.some(candidate => candidate.type === 'loop' && candidate.verifyStep === step.id)
        if (!isVerify) throw new Error(`step "${step.id}" cannot use story verification template "{{${key}}}"`)
      }
      if ((key === 'issues' || key === 'stories_summary') && step.type === 'single') {
        const isRepair = raw.steps.some(candidate => candidate.type === 'loop' && candidate.repairInput === step.input)
        if (!isRepair) throw new Error(`step "${step.id}" cannot use repair template "{{${key}}}"`)
      }
    }
    if (step.type === 'loop' && step.verifyEach && step.verifyStep === undefined) throw new Error(`loop step "${step.id}" requires verifyStep`)
    if (step.type === 'loop' && step.repairInput !== undefined) {
      for (const key of templateKeys(step.repairInput)) {
        if (key !== 'issues' && key !== 'stories_summary' && key !== 'task' && key !== 'workspace' && key !== 'branch' && !/^[A-Z][A-Z0-9_]*$/.test(key)) {
          throw new Error(`loop step "${step.id}" repairInput references unsupported template "{{${key}}}"`)
        }
      }
    }
    const retryStep = step.onFail?.retryStep
    if (retryStep !== undefined) {
      const target = stepById.get(retryStep)
      if (target === undefined) throw new Error(`step "${step.id}" references unknown retryStep "${retryStep}"`)
      if (target.index >= index) throw new Error(`step "${step.id}" retryStep must reference an earlier step`)
      if (target.step.type === 'loop' && target.step.repairInput === undefined) {
        throw new Error(`loop retry target "${target.step.id}" requires repairInput`)
      }
    }
  }
  const agents = await Promise.all(raw.agents.map(agent => loadAgentContent(agent, workflowDir, roots)))
  const steps: ResolvedStep[] = raw.steps.map(step => ({ ...step }))
  return {
    id: raw.id,
    name: raw.name,
    version: raw.version,
    ...raw.description === undefined ? {} : { description: raw.description },
    agents,
    steps,
    sourceDirectory: workflowDir,
  }
}
