import type { Context } from '@deepseek-ai/cordis';
export declare const name = "antfarm-commands";
export declare const inject: string[];
/** Parsed human operation before runtime admission. */
export type ParsedAntfarmCommand = {
    readonly action: 'start';
    readonly task: string;
    readonly workflowId?: string;
} | {
    readonly action: 'list' | 'workflows' | 'help' | 'version' | 'ant' | 'health' | 'ensure-execution';
} | {
    readonly action: 'install' | 'uninstall';
    readonly id: string;
    readonly force: boolean;
} | {
    readonly action: 'import';
    readonly directory: string;
    readonly sourceRoot: string;
    readonly workspace?: 'files';
} | {
    readonly action: 'status' | 'cleanup';
    readonly runId: string;
} | {
    readonly action: 'stories';
    readonly runId: string;
} | {
    readonly action: 'logs';
    readonly runId?: string;
} | {
    readonly action: 'cancel';
    readonly runId: string;
    readonly reason: string;
} | {
    readonly action: 'resume';
    readonly runId: string;
    readonly guidance?: string;
    readonly retryGrant?: number;
};
/**
 * Parse one human command without applying runtime defaults or side effects.
 * @param input - Command text after /antfarm.
 * @returns Requested operation, or undefined for invalid input.
 */
export declare function parseAntfarmCommand(input: string): ParsedAntfarmCommand | undefined;
/** Register the human-facing antfarm command. */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=index.d.ts.map