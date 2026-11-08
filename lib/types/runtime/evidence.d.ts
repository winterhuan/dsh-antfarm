import type { Context } from '@deepseek-ai/cordis';
import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { RunJournal } from '../persistence/journal.ts';
import type { CheckEvidence } from '../persistence/types.ts';
/**
 * Hash tracked and untracked source without including ignored dependency/build trees.
 * @param subprocess - Native Git subprocess owner.
 * @param workspace - Owned candidate directory.
 * @returns SHA-256 candidate identity; missing or oversized sources refuse acceptance.
 */
export declare function candidateVersion(subprocess: SubprocessRuntime, workspace: string, kind?: 'git' | 'files'): Promise<string>;
/** @param subprocess - Native provider. @param workspace - Owned Git workspace. @returns Refuses an uncommitted source candidate. */
export declare function requireCommittedCandidate(subprocess: SubprocessRuntime, workspace: string): Promise<void>;
/** Owns capture listeners; durable writes are awaited before accepting a child result. */
export declare class ExecutionEvidence {
    private readonly attempts;
    private readonly calls;
    /** @param ctx - Native tools and subprocess context. */
    constructor(ctx: Context);
    /** @param childId - Reserved child. @param journal - Sole Run writer. @param stepId - Role step. */
    begin(childId: string, journal: RunJournal, stepId: string): void;
    /** @param childId - Disposed child. @returns Committed actual checks; capture failure rejects. */
    finish(childId: string): Promise<readonly CheckEvidence[]>;
    private record;
}
//# sourceMappingURL=evidence.d.ts.map