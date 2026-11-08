/** Verify declared GitHub delivery through read-only queries after native tool effects. */
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { RunStartData } from '../persistence/types.ts';
/** Host checks remote facts; publishing and reviewing remain native role-tool operations. */
export declare class GitHubDelivery {
    private readonly subprocess;
    /** @param subprocess - Host subprocess owner. */
    constructor(subprocess: SubprocessRuntime);
    private query;
    /** @param start - Owned branch. @param effect - Upcoming declared operation. @param signal - Run lifetime. @returns Current GitHub actor without changing global credentials. */
    preflight(start: RunStartData, effect: 'pull-request' | 'github-review', signal: AbortSignal): Promise<string>;
    /** @param start - Saved Run identity. @param effect - Declared delivery phase. @param values - Child's claimed references. @param signal - Run lifetime. @returns Verified PR references. */
    verify(start: RunStartData, effect: 'pull-request' | 'github-review', values: Readonly<Record<string, string>>, signal: AbortSignal): Promise<Record<string, string>>;
}
//# sourceMappingURL=github.d.ts.map