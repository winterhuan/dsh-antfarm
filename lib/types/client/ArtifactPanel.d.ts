import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { FileArtifact } from '../persistence/types.ts';
import type { AntfarmSessionId } from '../types.ts';
import type { AntfarmOperations } from './operations.ts';
/** @param props - Owned references, cancellable reads and locale. @returns Text/image preview and downloads. */
export declare function ArtifactPanel({ runId, owner, artifacts, operations, t }: PropsLocale<'antfarmRuns'> & {
    readonly runId: string;
    readonly owner: AntfarmSessionId;
    readonly artifacts: readonly FileArtifact[];
    readonly operations: AntfarmOperations;
}): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ArtifactPanel.d.ts.map