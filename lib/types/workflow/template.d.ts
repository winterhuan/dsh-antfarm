/** Strict substitution for the runtime context named by workflow steps. */
/**
 * Substitute every referenced context value before starting a child.
 * @param template - Workflow input text.
 * @param context - Values captured for this execution.
 * @returns Rendered text; throws when a referenced value is unavailable.
 */
export declare function resolveTemplate(template: string, context: Readonly<Record<string, string>>): string;
/**
 * Read context references without resolving their values.
 * @param template - Workflow input text.
 * @returns Unique references in source order.
 */
export declare function templateKeys(template: string): readonly string[];
//# sourceMappingURL=template.d.ts.map