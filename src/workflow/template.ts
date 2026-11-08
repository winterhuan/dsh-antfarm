/** Strict substitution for the runtime context named by workflow steps. */

const TEMPLATE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/**
 * Substitute every referenced context value before starting a child.
 * @param template - Workflow input text.
 * @param context - Values captured for this execution.
 * @returns Rendered text; throws when a referenced value is unavailable.
 */
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

/**
 * Read context references without resolving their values.
 * @param template - Workflow input text.
 * @returns Unique references in source order.
 */
export function templateKeys(template: string): readonly string[] {
  return [...new Set([...template.matchAll(TEMPLATE)].map(match => match[1]!))]
}
