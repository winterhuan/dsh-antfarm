import type { ResolvedWorkflow } from './types.ts';
/**
 * Load all role files under an explicitly selected source root; no package writes occur.
 * @param document - Original workflow YAML.
 * @param directory - Directory containing that document.
 * @param sourceRoot - Explicit import root containing shared role resources.
 * @returns Resolved snapshot preserving original metadata and declared verdicts.
 */
export declare function importOriginalWorkflow(document: string, directory: string, sourceRoot: string, workspace?: 'git' | 'files'): Promise<ResolvedWorkflow>;
//# sourceMappingURL=original.d.ts.map