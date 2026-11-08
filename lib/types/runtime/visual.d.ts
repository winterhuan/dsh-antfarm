import type { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess';
import type { CheckEvidence, FileArtifact, RunStartData } from '../persistence/types.ts';
/** @param files - Actual changed paths. @returns Frontend paths, excluding test files. */
export declare function frontendPaths(files: readonly string[]): string[];
/** @param subprocess - Native provider. @param start - Owned Git candidate. @param signal - Run lifetime. @returns Diff paths with frontend effects. */
export declare function changedFrontendPaths(subprocess: SubprocessRuntime, start: RunStartData, signal: AbortSignal): Promise<string[]>;
/** @param workspace - Owned candidate. @param paths - Claimed screenshots. @param records - Native browser commands. @param candidate - Checked version. @param destination - Private artifacts. @returns Retained image references. */
export declare function retainScreenshots(workspace: string, paths: readonly string[], records: readonly CheckEvidence[], candidate: string, destination: string): Promise<FileArtifact[]>;
//# sourceMappingURL=visual.d.ts.map