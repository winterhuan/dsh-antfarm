/** Original-format imports use the same parser as bundled and custom workflows. */
import { parseWorkflow } from './loader.ts'
import type { ResolvedWorkflow } from './types.ts'
/** @param document - Original YAML. @param directory - Workflow directory. @param sourceRoot - Explicit resource root. @returns Resolved original workflow. */
export async function importOriginalWorkflow(
  document: string,
  directory: string,
  sourceRoot: string,
): Promise<ResolvedWorkflow> {
  return parseWorkflow(document, directory, sourceRoot)
}
