import type { AgentRole, ResolvedWorkflow } from './types.ts';
/**
 * Parse editable original YAML with the same shape used by workflow loading.
 * @param document - Original workflow YAML.
 * @returns Validated document fields.
 */
export declare function parseWorkflowDocument(document: string): {
    id: string;
    version: number;
    context: Record<string, string>;
    agents: {
        id: string;
        workspace: {
            baseDir: string;
            files: Record<string, string>;
            skills?: string[] | undefined;
        };
        name?: string | undefined;
        role?: "analysis" | "coding" | "verification" | "testing" | "pr" | "scanning" | undefined;
        description?: string | undefined;
        model?: string | undefined;
        pollingModel?: string | undefined;
        timeoutSeconds?: number | undefined;
    }[];
    steps: {
        id: string;
        agent: string;
        type: "single" | "loop";
        input: string;
        expects: string;
        max_retries?: number | undefined;
        on_fail?: {
            retry_step?: string | undefined;
            max_retries?: number | undefined;
            escalate_to?: string | undefined;
            on_exhausted?: {
                escalate_to?: string | undefined;
            } | undefined;
        } | undefined;
        loop?: {
            over: "stories";
            completion: "all_done";
            fresh_session?: boolean | undefined;
            freshSession?: boolean | undefined;
            verify_each?: boolean | undefined;
            verifyEach?: boolean | undefined;
            verify_step?: string | undefined;
            verifyStep?: string | undefined;
        } | undefined;
    }[];
    name?: string | undefined;
    description?: string | undefined;
    polling?: {
        model?: string | undefined;
        timeoutSeconds?: number | undefined;
    } | undefined;
    cron?: {
        interval_ms: number;
    } | undefined;
    notifications?: {
        url?: string | undefined;
    } | undefined;
};
/** @param name - Original agent id. @returns Original inferred tool role. */
export declare function inferRole(name: string): AgentRole;
/** @param document - Original YAML. @param directory - Its directory. @param sourceRoot - Allowed resource root. @returns Resolved identity and workflow snapshot. */
export declare function parseWorkflow(document: string, directory: string, sourceRoot: string): Promise<ResolvedWorkflow>;
/** @param id - Workflow directory name. @param roots - Precedence-ordered registries. @returns Resolved original workflow. */
export declare function loadWorkflow(id: string, roots: readonly string[]): Promise<ResolvedWorkflow>;
/** @param value - Saved resolved workflow. @returns Checked native storage value. */
export declare function validateResolvedWorkflow(value: unknown): ResolvedWorkflow;
//# sourceMappingURL=loader.d.ts.map