/** Narrow browser operation face; the Host rechecks owner, revision and state. */
import type { AntfarmArtifactContent, AntfarmControlRequest, AntfarmEventSummary, AntfarmHealthHistory, AntfarmHealthReport, AntfarmLaunchRequest, AntfarmRunSummary, AntfarmSessionId } from '../types.ts';
import type { WorkflowDraft } from '../workflow/types.ts';
/** Session-scoped editor state retained across sidebar and Session navigation. */
export interface AntfarmEditorDraft {
    readonly id: string;
    readonly task: string;
    readonly source: WorkflowDraft | null;
    readonly draft: WorkflowDraft | null;
    readonly scope: 'project' | 'profile';
    readonly file: string;
    readonly editor: boolean;
    readonly request?: {
        readonly task: string;
        readonly workflowId: string;
        readonly owner: AntfarmSessionId;
        readonly id: string;
    } | null;
}
/** Actions and configuration reads owned by the mounted Remote. */
export interface AntfarmOperations {
    /** @param owner - View identity. @returns Retained draft without effects. */
    readDraft(owner: AntfarmSessionId): AntfarmEditorDraft | undefined;
    /** @param owner - View identity. @param patch - Gesture or query result to retain. */
    rememberDraft(owner: AntfarmSessionId, patch: Partial<AntfarmEditorDraft>): void;
    /** @param request - Idempotent launch. @returns Admitted Run. */
    start(request: AntfarmLaunchRequest): Promise<AntfarmRunSummary>;
    /** @param request - Revision-bound operation. @returns Current Run. */
    control(request: AntfarmControlRequest): Promise<AntfarmRunSummary>;
    /** @param owner - Catalog scope. @param signal - Read lifetime. @returns Workflow ids. */
    workflows(owner: AntfarmSessionId, signal: AbortSignal): Promise<string[]>;
    /** @param id - Selected template. @param owner - Scope. @param signal - Read lifetime. @returns Editable copy. */
    workflow(id: string, owner: AntfarmSessionId, signal: AbortSignal): Promise<WorkflowDraft>;
    /** @param draft - Complete source. @param scope - Destination. @param owner - Owner. @returns Saved revision. */
    save(draft: WorkflowDraft, scope: 'project' | 'profile', owner: AntfarmSessionId): Promise<WorkflowDraft>;
    /** @param draft - Current source. @param scope - Destination. @param owner - Owner. */
    remove(draft: WorkflowDraft, scope: 'project' | 'profile', owner: AntfarmSessionId): Promise<void>;
    /** @param draft - Validated source. @param newId - New identity. @param owner - Owner. @returns New project copy. */
    copy(draft: WorkflowDraft, newId: string, owner: AntfarmSessionId): Promise<WorkflowDraft>;
    /** @param id - Workflow identity. @param enabled - Desired state. @param owner - Owner. */
    setEnabled(draft: WorkflowDraft, enabled: boolean, owner: AntfarmSessionId): Promise<void>;
    /** @param runId - Selected Run. @param owner - Owner. @param after - Cursor. @returns Event page. */
    events(runId: string, owner: AntfarmSessionId, after: number): Promise<AntfarmEventSummary[]>;
    /** @param runId - Selected Run. @param owner - Owner. @param digest - Saved output. @returns Text preview. */
    artifact(runId: string, owner: AntfarmSessionId, digest: string): Promise<string>;
    /** @param runId - Owned Run. @param owner - Original owner. @param digest - Retained digest. @param signal - View lifetime. @returns Verified bytes. */
    artifactContent(runId: string, owner: AntfarmSessionId, digest: string, signal: AbortSignal): Promise<AntfarmArtifactContent>;
    /** @param owner - Explicit resource scope. @returns Diagnosed health. */
    health(owner: AntfarmSessionId): Promise<AntfarmHealthReport>;
    /** @param owner - Authorized resource. @returns Diagnostic history without performing a check. */
    healthHistory(owner: AntfarmSessionId): Promise<AntfarmHealthHistory>;
    /** @param owner - Explicit resource scope. @returns Safely dispatched Runs. */
    ensureExecution(owner: AntfarmSessionId): Promise<string[]>;
    /** @param success - Settled result. */
    report(success: boolean): void;
}
//# sourceMappingURL=operations.d.ts.map