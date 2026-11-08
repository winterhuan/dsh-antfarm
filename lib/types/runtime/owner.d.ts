/** Restore the original Session's execution authority through native lifecycle owners. */
import type { Context } from '@deepseek-ai/cordis';
import { type Agent } from '@deepseek-ai/dsh-agent';
import type { SessionId } from '@deepseek-ai/dsh-session';
/** Native handles are owned only when Antfarm itself resumed them. */
export declare class RunOwnerResolver {
    private readonly ctx;
    private readonly pending;
    private readonly owned;
    private closing;
    /** @param ctx - Host context used as the native resume lifetime owner. */
    constructor(ctx: Context);
    /**
     * Resolve a live root or resume its persisted native composition without a model turn.
     * @param id - Original authorization owner; never replaced by a new Session.
     * @returns Exact native Agent after archive and lineage validation.
     */
    resolve(id: SessionId): Promise<Agent>;
    private allowed;
    private root;
    private restore;
    /** Wait for in-flight restores, then dispose only handles created by this resolver. */
    dispose(): Promise<void>;
}
//# sourceMappingURL=owner.d.ts.map