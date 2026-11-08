import type { FileInput, FileArtifact } from '../persistence/types.ts';
/** @param base - Authorized input root. @param paths - Explicit relative UTF-8 inputs. @returns Bounded snapshots. */
export declare function captureFileInputs(base: string, paths: readonly string[]): Promise<FileInput[]>;
/** @param base - Original input root. @param runId - Run identity. @returns Owned output workspace path. */
export declare function fileWorkspacePath(base: string, runId: string): string;
/**
 * Create a new owned workspace using saved input bytes, without modifying source inputs.
 * @param workspace - Run's recorded output directory.
 * @param runId - Ownership marker identity.
 * @param inputs - Immutable input snapshots from admission.
 */
export declare function createFileWorkspace(workspace: string, runId: string, inputs: readonly FileInput[]): Promise<void>;
/** @param workspace - Retained directory. @param runId - Original owner. */
export declare function validateFileWorkspace(workspace: string, runId: string): Promise<void>;
/** @param root - Owned workspace. @returns Relative regular files; links and oversized trees refuse. */
export declare function fileInventory(root: string): Promise<string[]>;
/** @param root - Owned directory. @returns Content identity of all current files. */
export declare function fileCandidateVersion(root: string): Promise<string>;
/** @param root - Owned workspace. @param destination - Private Run evidence directory. @returns Immutable output references. */
export declare function retainFileOutputs(root: string, destination: string): Promise<FileArtifact[]>;
//# sourceMappingURL=files.d.ts.map