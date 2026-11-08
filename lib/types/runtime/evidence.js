/** Candidate-bound facts captured from the native tool execution pipeline. */
import { createHash } from 'node:crypto';
import { lstat, readFile, readlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { fileCandidateVersion } from "../workspace/files.js";
import { runGit } from "../workspace/git.js";
/**
 * Hash tracked and untracked source without including ignored dependency/build trees.
 * @param subprocess - Native Git subprocess owner.
 * @param workspace - Owned candidate directory.
 * @returns SHA-256 candidate identity; missing or oversized sources refuse acceptance.
 */
export async function candidateVersion(subprocess, workspace, kind = 'git') {
    if (kind === 'files')
        return fileCandidateVersion(workspace);
    const files = await runGit(subprocess, workspace, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
    if (files.exitCode !== 0)
        throw new Error('candidate source inventory could not be read');
    const hash = createHash('sha256');
    const head = await runGit(subprocess, workspace, ['rev-parse', '--verify', 'HEAD^{commit}']);
    if (head.exitCode !== 0)
        throw new Error('candidate commit could not be read');
    hash.update(head.stdout.trim());
    const names = [...new Set(files.stdout.split('\0').filter(Boolean))].sort();
    if (names.length > 100000)
        throw new Error('candidate source inventory exceeds 100000 files');
    for (const name of names) {
        const path = resolve(workspace, name);
        const rel = relative(workspace, path);
        if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`))
            throw new Error('candidate path escapes its owned workspace');
        hash.update(JSON.stringify(name));
        let stat;
        try {
            stat = await lstat(path);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                hash.update('deleted');
                continue;
            }
            ;
            throw error;
        }
        hash.update(String(stat.mode));
        if (stat.isSymbolicLink())
            hash.update(await readlink(path));
        else if (stat.isFile()) {
            if (stat.size > 32 * 1024 * 1024)
                throw new Error(`candidate source ${name} exceeds 32 MiB`);
            hash.update(await readFile(path));
        }
        else
            hash.update('directory');
    }
    return hash.digest('hex');
}
/** @param subprocess - Native provider. @param workspace - Owned Git workspace. @returns Refuses an uncommitted source candidate. */
export async function requireCommittedCandidate(subprocess, workspace) {
    const result = await runGit(subprocess, workspace, ['status', '--porcelain=v1', '--untracked-files=all']);
    if (result.exitCode !== 0 || result.stdout.trim() !== '')
        throw new Error('verification requires a clean, committed candidate including new source files');
}
const foreground = z.object({ kind: z.literal('foreground'), cwd: z.string(), exitCode: z.number().int().nullable(), signal: z.string().nullable(), timedOut: z.boolean(), aborted: z.boolean(), stdout: z.object({ text: z.string(), truncated: z.boolean() }), stderr: z.object({ text: z.string(), truncated: z.boolean() }) });
/** Owns capture listeners; durable writes are awaited before accepting a child result. */
export class ExecutionEvidence {
    attempts = new Map();
    calls = new Map();
    /** @param ctx - Native tools and subprocess context. */
    constructor(ctx) {
        ctx.on('tools/execute', async (exec, next) => {
            const attempt = exec.agent === undefined ? undefined : this.attempts.get(exec.agent.id);
            if (attempt === undefined || exec.name !== 'bash')
                return next();
            const args = z.object({ command: z.string() }).parse(exec.arguments);
            const before = await candidateVersion(ctx.subprocess, attempt.workspace, attempt.journal.state.start.workspaceKind);
            const result = await next();
            const after = await candidateVersion(ctx.subprocess, attempt.workspace, attempt.journal.state.start.workspaceKind);
            this.calls.set(exec.callId, { attempt, childId: exec.agent.id, command: args.command, before, after });
            return result;
        });
        ctx.on('tools/post-execute', async (exec, result, next) => {
            const decision = await next();
            if (!this.calls.has(exec.callId) || result.isError || !foreground.safeParse(result.value).success || decision.kind !== 'accept' || decision.value !== undefined)
                return decision;
            return { ...decision, content: [...decision.content ?? result.content, { type: 'text', text: `Antfarm execution reference: ${exec.callId}. Cite this as checks[].call_id; the runtime separately verifies success and candidate identity.` }] };
        });
        ctx.on('tools/result', (exec, result) => {
            const call = this.calls.get(exec.callId);
            if (call === undefined)
                return;
            this.calls.delete(exec.callId);
            const pending = this.record(exec.callId, call, result).catch(error => { call.attempt.error = error; });
            call.attempt.pending.add(pending);
            void pending.finally(() => { call.attempt.pending.delete(pending); });
        });
    }
    /** @param childId - Reserved child. @param journal - Sole Run writer. @param stepId - Role step. */
    begin(childId, journal, stepId) {
        this.attempts.set(childId, { journal, stepId, workspace: journal.state.start.workspace, records: [], pending: new Set() });
    }
    /** @param childId - Disposed child. @returns Committed actual checks; capture failure rejects. */
    async finish(childId) {
        const attempt = this.attempts.get(childId);
        if (attempt === undefined)
            return [];
        await Promise.all(attempt.pending);
        this.attempts.delete(childId);
        if (attempt.error !== undefined)
            throw new Error('native execution evidence could not be committed', { cause: attempt.error });
        return attempt.records;
    }
    async record(callId, call, result) {
        if (result.isError)
            return;
        const value = foreground.safeParse(result.value);
        if (!value.success)
            return;
        const facts = value.data;
        const evidence = { callId, childSessionId: call.childId, stepId: call.attempt.stepId, command: call.command, cwd: facts.cwd, candidate: call.before, afterCandidate: call.after,
            passed: facts.exitCode === 0 && facts.signal === null && !facts.timedOut && !facts.aborted && !facts.stdout.truncated && !facts.stderr.truncated && call.before === call.after && resolve(facts.cwd) === resolve(call.attempt.workspace) && facts.stdout.text.length <= 65536 && facts.stderr.text.length <= 65536,
            exitCode: facts.exitCode, stdout: facts.stdout.text.slice(-65536), stderr: facts.stderr.text.slice(-65536) };
        await call.attempt.journal.append({ type: 'check-evidence', data: evidence });
        call.attempt.records.push(evidence);
    }
}
//# sourceMappingURL=evidence.js.map