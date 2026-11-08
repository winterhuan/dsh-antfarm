import type { WorkflowDraft } from './types.ts';
export type { WorkflowDraft } from './types.ts';
/** @param cwd - Canonical project input root. @returns Project registry path confined through existing ancestors. */
export declare function projectWorkflowRoot(cwd: string): Promise<string>;
/** A single Host serializes workflow effects while Run snapshots remain immutable. */
export declare class WorkflowManager {
    private readonly packageRoot;
    private writing;
    /** @param packageRoot - Last-precedence read-only workflow root. */
    constructor(packageRoot: string);
    /** @param roots - Roots in precedence order. @returns Discoverable workflow ids. */
    list(roots: readonly string[]): Promise<string[]>;
    /** @param id - Selected workflow. @param roots - User roots. @returns Validated editable copy. */
    read(id: string, roots: readonly string[]): Promise<WorkflowDraft>;
    /** @param id - Workflow identity. @param roots - Explicit user roots. @returns Enablement from owned marker files. */
    enabled(id: string, roots: readonly string[]): Promise<boolean>;
    /** @param id - Workflow identity. @param roots - Source roots. @param enabled - Desired state. @param expected - Previously observed state. */
    setEnabled(id: string, roots: readonly string[], enabled: boolean, expected: boolean, revision?: string): Promise<void>;
    /** @param source - Revision-bound source. @param newId - New workflow id. @param roots - Effective roots. @param root - Destination. @returns New validated copy. */
    copy(source: WorkflowDraft, newId: string, roots: readonly string[], root: string): Promise<WorkflowDraft>;
    /**
     * Save a self-contained copy with an atomic definition replacement after validating references and source revision.
     * @param value - Draft contents; the revision must match the currently inherited source.
     * @param root - Authorized writable root, never the package root.
     * @param roots - Current effective roots in precedence order.
     * @returns Saved draft with its new revision.
     */
    save(value: WorkflowDraft, root: string, roots: readonly string[]): Promise<WorkflowDraft>;
    /**
     * Import original resources into a new writable workflow; an existing id refuses.
     * @param directory - Original workflow directory.
     * @param sourceRoot - Explicit root containing its shared files.
     * @param root - Authorized destination.
     * @returns Self-contained native workflow copy.
     */
    import(directory: string, sourceRoot: string, root: string): Promise<WorkflowDraft>;
    /** @param id - Override to remove. @param root - Writable root. @param revision - Saved revision. */
    remove(id: string, root: string, revision: string): Promise<void>;
    private serialize;
    private install;
}
//# sourceMappingURL=manager.d.ts.map