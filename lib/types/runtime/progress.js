/** Original progress files and frontend-change context use the native subprocess provider. */
import { copyFile, mkdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
/** @param files - Changed Git paths. @returns Whether production frontend files changed, following Antfarm's detector. */
export function isFrontendChange(files) {
    return files.some((file) => {
        if (['.test.', '.spec.', '__tests__/'].some((value) => file.includes(value)))
            return false;
        if (/\.(html|css|scss|less|jsx|tsx|vue|svelte)$/i.test(file))
            return true;
        return /(^|\/)(public|static|assets|components|pages|views|styles)\//.test(file.replaceAll('\\', '/'));
    });
}
/** @param ctx - Native subprocess owner. @param repo - Recorded project. @param branch - Original branch output. @param signal - Run lifetime. @param timeoutMs - Git deadline. @param graceMs - Native termination grace. @returns Original true/false frontend context. */
export async function frontendChanges(ctx, repo, branch, signal, timeoutMs, graceMs) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const handle = ctx.subprocess.spawn({
        argv: ['git', 'diff', '--name-only', `main..${branch}`],
        cwd: repo,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 1024 * 1024 }, stderr: { maxBytes: 4096 } },
        graceMs,
        signal: AbortSignal.any([signal, timeout]),
    });
    try {
        const outcome = await handle.done;
        signal.throwIfAborted();
        const output = handle.collected.stdout?.readFrom(0);
        return outcome.exitCode === 0 && output && !output.lossy && isFrontendChange(output.text.split('\n'))
            ? 'true'
            : 'false';
    }
    finally {
        handle.terminate();
        await handle.waitForExit();
    }
}
/** @param workspace - Stable developer workspace. @param runId - Original run identity. @returns Per-run progress, falling back to the original shared file. */
export async function readProgress(workspace, runId) {
    for (const path of [join(workspace, `progress-${runId}.txt`), join(workspace, 'progress.txt')]) {
        try {
            return { path, text: await readFile(path, 'utf8') };
        }
        catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
                throw error;
        }
    }
    return undefined;
}
/** @param workspace - Stable developer workspace. @param runId - Completed original run. */
export async function archiveProgress(workspace, runId) {
    const progress = await readProgress(workspace, runId);
    if (!progress)
        return;
    const archive = join(workspace, 'archive', runId);
    await mkdir(archive, { recursive: true });
    await copyFile(progress.path, join(archive, 'progress.txt'));
    await unlink(progress.path);
}
//# sourceMappingURL=progress.js.map