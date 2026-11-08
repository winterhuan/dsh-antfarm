/** Load canonical workflow YAML and validate durable resolved snapshots. */
import type { ResolvedWorkflow } from './types.ts';
/**
 * Validate a journal's complete workflow snapshot without reading source files.
 * @param value - Decoded durable workflow data.
 * @returns A validated version 2 snapshot.
 */
export declare function validateResolvedWorkflow(value: unknown): ResolvedWorkflow;
/**
 * Validate workflow YAML and its execution references without reading Markdown files.
 * @param id - Selected workflow id.
 * @param document - Canonical YAML text.
 */
export declare function validateWorkflowSchema(id: string, document: string): void;
/**
 * Resolve the first matching workflow and capture its Markdown instructions.
 * @param id - Workflow id.
 * @param roots - Workflow roots in precedence order.
 * @returns Validated workflow snapshot ready for execution.
 */
export declare function loadWorkflow(id: string, roots: readonly string[]): Promise<ResolvedWorkflow>;
//# sourceMappingURL=loader.d.ts.map