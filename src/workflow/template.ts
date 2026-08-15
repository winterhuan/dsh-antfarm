import type { Story } from './types.ts'

const TEMPLATE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
const KEY_VALUE = /^([A-Z][A-Z0-9_]*):\s*(.*)$/
const STORY_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

/** Resolve every antfarm template key or fail before spawning a child. */
export function resolveTemplate(template: string, context: Readonly<Record<string, string>>): string {
  const missing = new Set<string>()
  const rendered = template.replace(TEMPLATE, (_match, key: string) => {
    const value = context[key]
    if (value === undefined) {
      missing.add(key)
      return ''
    }
    return value
  })
  if (missing.size > 0) throw new Error(`missing workflow template values: ${[...missing].sort().join(', ')}`)
  return rendered
}

/** Return template references in source order without resolving them. */
export function templateKeys(template: string): readonly string[] {
  const keys: string[] = []
  TEMPLATE.lastIndex = 0
  for (let match = TEMPLATE.exec(template); match !== null; match = TEMPLATE.exec(template)) {
    const key = match[1]
    if (key !== undefined && !keys.includes(key)) keys.push(key)
  }
  TEMPLATE.lastIndex = 0
  return keys
}

function parseProtocolValues(output: string): Record<string, string> {
  const values: Record<string, string> = {}
  let key: string | undefined
  let lines: string[] = []
  const commit = (): void => {
    if (key !== undefined) values[key] = lines.join('\n').trim()
    key = undefined
    lines = []
  }
  for (const line of output.split(/\r?\n/)) {
    const match = KEY_VALUE.exec(line)
    if (match !== null) {
      commit()
      key = match[1]
      lines = [match[2] ?? '']
    } else if (key !== undefined) {
      lines.push(line)
    }
  }
  commit()
  return values
}

/** Parse top-level `KEY: value` sections, excluding the dedicated stories payload. */
export function parseKeyValues(output: string, allowedKeys?: ReadonlySet<string>): Record<string, string> {
  const values = parseProtocolValues(output)
  delete values['STORIES_JSON']
  if (allowedKeys !== undefined) {
    for (const key of Object.keys(values)) {
      if (!allowedKeys.has(key)) throw new Error(`output contains unknown protocol key "${key}"`)
    }
  }
  return values
}

function storyRecord(value: unknown, index: number): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`STORIES_JSON[${index}] must be an object`)
  return value as Record<string, unknown>
}

function storyText(row: Record<string, unknown>, key: string, index: number): string {
  const value = row[key]
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`STORIES_JSON[${index}].${key} must be a non-empty string`)
  return value.trim()
}

/** Parse and validate the bounded STORIES_JSON protocol payload. */
export function parseStories(output: string): Story[] | undefined {
  const encoded = parseProtocolValues(output)['STORIES_JSON']
  if (encoded === undefined) return undefined
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(encoded.trim())
  const json = fenced?.[1] ?? encoded
  let value: unknown
  try { value = JSON.parse(json) } catch (error: unknown) { throw new Error('STORIES_JSON is not valid JSON', { cause: error }) }
  if (!Array.isArray(value)) throw new Error('STORIES_JSON must be an array')
  if (value.length === 0 || value.length > 20) throw new Error('STORIES_JSON must contain between 1 and 20 stories')
  const seen = new Set<string>()
  return value.map((item, index) => {
    const row = storyRecord(item, index)
    const id = storyText(row, 'id', index)
    if (!STORY_ID.test(id)) throw new Error(`STORIES_JSON[${index}].id contains unsupported characters`)
    if (seen.has(id)) throw new Error(`STORIES_JSON contains duplicate story id "${id}"`)
    seen.add(id)
    const rawCriteria = row['acceptanceCriteria'] ?? row['acceptance_criteria']
    if (!Array.isArray(rawCriteria) || rawCriteria.length === 0 || !rawCriteria.every(criterion => typeof criterion === 'string' && criterion.trim() !== '')) {
      throw new Error(`STORIES_JSON[${index}].acceptanceCriteria must contain non-empty strings`)
    }
    const rawRetries = row['maxRetries'] ?? row['max_retries'] ?? 2
    if (typeof rawRetries !== 'number' || !Number.isSafeInteger(rawRetries) || rawRetries < 0) throw new Error(`STORIES_JSON[${index}].maxRetries must be a non-negative safe integer`)
    return {
      id,
      title: storyText(row, 'title', index),
      description: storyText(row, 'description', index),
      acceptanceCriteria: rawCriteria.map(criterion => (criterion as string).trim()),
      maxRetries: rawRetries,
    }
  })
}

/** Match an expected status as a complete normalized output line. */
export function matchesExpectedLine(output: string, expected: string): boolean {
  const target = expected.trim()
  return output.split(/\r?\n/).some(line => line.trim() === target)
}

/** Reject persona text that would enter DSH strict prompt interpolation. */
export function assertStaticPersona(persona: string, agentId: string): void {
  if (TEMPLATE.test(persona)) throw new Error(`agent "${agentId}" persona must not contain {{...}} templates`)
  TEMPLATE.lastIndex = 0
}
