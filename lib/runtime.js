import z from "@deepseek-ai/schemastery";
import { createHash, randomUUID } from "node:crypto";
import { access, lstat, mkdir, open, readFile, readdir, readlink, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Service } from "@deepseek-ai/cordis";
import { DatabaseSync } from "node:sqlite";
import { z as z$1 } from "zod";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { SessionId } from "@deepseek-ai/dsh-session";
import { StringDecoder } from "node:string_decoder";
import { parse, stringify } from "yaml";
//#region lib/types/persistence/storage.js
/** OS-backed Host exclusion and a rebuildable query projection. */
/** One local storage root has one Host writer until its OS lock is released. */
var RunStorage = class RunStorage {
	lease;
	index;
	constructor(lease, index) {
		this.lease = lease;
		this.index = index;
	}
	/**
	* Acquire SQLite's process lock; elapsed time never authorizes a takeover.
	* @param root - Local filesystem storage root, shared by all plugin instances.
	* @returns Owner of the root and its disposable derived index.
	*/
	static async acquire(root) {
		await mkdir(root, { recursive: true });
		const canonical = await realpath(root);
		for (const name of ["host.sqlite", "index.sqlite"]) try {
			if (await realpath(join(canonical, name)) !== join(canonical, name)) throw new Error("antfarm storage file must not be a symbolic link");
		} catch (error) {
			if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
		}
		const lease = new DatabaseSync(join(canonical, "host.sqlite"));
		let index;
		try {
			lease.exec("PRAGMA busy_timeout=0; BEGIN EXCLUSIVE");
			index = new DatabaseSync(join(canonical, "index.sqlite"));
			index.exec("CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, updated INTEGER NOT NULL, summary TEXT NOT NULL); CREATE INDEX IF NOT EXISTS runs_owner ON runs(owner, updated DESC)");
			index.exec("CREATE TABLE IF NOT EXISTS health_reports (id INTEGER PRIMARY KEY, time INTEGER NOT NULL, report TEXT NOT NULL)");
			return new RunStorage(lease, index);
		} catch (error) {
			index?.close();
			lease.close();
			throw new Error("antfarm storage root is already being held or is unavailable", { cause: error });
		}
	}
	/** Drop derived rows before rebuilding from authoritative Run journals. */
	reset() {
		this.index.exec("DELETE FROM runs");
	}
	/** @param row - Projection of an already committed Run transition. */
	put(row) {
		this.index.prepare("INSERT INTO runs VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, updated=excluded.updated, summary=excluded.summary").run(row.runId, row.ownerSessionId, row.updatedAt, JSON.stringify(row));
	}
	/** @param owner - Authorized Session. @returns At most fifty recent projections. */
	list(owner) {
		return this.page([owner], 0);
	}
	/** @param owners - Authorized resources. @param offset - Number of newer rows already read. @returns Fifty ordered projections. */
	page(owners, offset) {
		if (owners.length === 0) return [];
		if (owners.length > 100 || !Number.isSafeInteger(offset) || offset < 0) throw new Error("invalid Run page");
		return this.index.prepare(`SELECT summary FROM runs WHERE owner IN (${owners.map(() => "?").join(",")}) ORDER BY updated DESC, id LIMIT 50 OFFSET ?`).all(...owners, offset).map((row) => JSON.parse(String(row["summary"])));
	}
	/** @param owner - Optional owner scope. @returns Bounded unsettled projections for health inspection. */
	unsettled(owner) {
		const sql = "SELECT summary FROM runs WHERE json_extract(summary, '$.status') NOT IN ('completed','cancelled')";
		return (owner === void 0 ? this.index.prepare(`${sql} ORDER BY updated LIMIT 200`).all() : this.index.prepare(`${sql} AND owner=? ORDER BY updated LIMIT 200`).all(owner)).map((row) => JSON.parse(String(row["summary"])));
	}
	/** @param owner - Authorized owner. @param query - Id, number, prefix or literal task substring. @returns At most two matches, preserving ambiguity. */
	search(owner, query) {
		const exact = this.index.prepare("SELECT summary FROM runs WHERE owner=? AND (id=? OR CAST(json_extract(summary,'$.number') AS TEXT)=?) LIMIT 2").all(owner, query, query);
		return (exact.length > 0 ? exact : this.index.prepare("SELECT summary FROM runs WHERE owner=? AND (substr(id,1,length(?))=? OR instr(lower(COALESCE(json_extract(summary,'$.task'),'')),lower(?))>0) LIMIT 2").all(owner, query, query, query)).map((row) => JSON.parse(String(row["summary"])));
	}
	/** @param report - Diagnostic facts, independent of business acceptance. */
	recordHealth(report) {
		this.index.prepare("INSERT INTO health_reports(time, report) VALUES (?,?)").run(report.time, JSON.stringify(report));
		this.index.exec("DELETE FROM health_reports WHERE id NOT IN (SELECT id FROM health_reports ORDER BY id DESC LIMIT 500)");
	}
	/** @param owner - Explicit authorized resource. @returns Last twenty relevant checks and rolling issue count. */
	healthHistory(owner) {
		const all = this.index.prepare("SELECT report FROM health_reports ORDER BY id DESC LIMIT 500").all().map((row) => JSON.parse(String(row["report"])));
		const owned = new Set(this.index.prepare("SELECT id FROM runs WHERE owner=?").all(owner).map((row) => String(row["id"])));
		const relevant = all.map((report) => ({
			...report,
			findings: report.findings.filter((finding) => owned.has(finding.runId))
		}));
		return {
			reports: relevant.slice(0, 20),
			issues24h: relevant.filter((report) => report.time >= Date.now() - 864e5).reduce((total, report) => total + report.findings.length, 0)
		};
	}
	/** Release the lock only after all owned drivers and writes have stopped. */
	dispose() {
		this.index.close();
		this.lease.close();
	}
};
//#endregion
//#region lib/types/workspace/files.js
/** Owned non-Git workspaces and retained content-addressed output snapshots. */
function confined(root, path) {
	const target = resolve(root, path);
	const rel = relative(root, target);
	if (isAbsolute(rel) || rel === ".." || rel === "" || rel.startsWith(`..${sep}`)) throw new Error("file workspace resource escapes its owned root");
	return target;
}
/** @param base - Authorized input root. @param paths - Explicit relative UTF-8 inputs. @returns Bounded snapshots. */
async function captureFileInputs(base, paths) {
	const canonical = await realpath(base);
	if (paths.length > 100) throw new Error("file workflow accepts at most 100 explicit inputs");
	const inputs = [];
	let bytes = 0;
	for (const path of paths) {
		if (isAbsolute(path)) throw new Error("file workflow inputs must be relative to its input root");
		const source = await realpath(confined(canonical, path));
		confined(canonical, relative(canonical, source));
		const content = await readFile(source);
		bytes += content.length;
		if (bytes > 1048576) throw new Error("file workflow inputs exceed 1 MiB");
		const text = content.toString("utf8");
		if (!Buffer.from(text).equals(content)) throw new Error("file workflow inputs must be UTF-8 text");
		inputs.push({
			path,
			sha256: createHash("sha256").update(content).digest("hex"),
			content: text
		});
	}
	return inputs;
}
/** @param base - Original input root. @param runId - Run identity. @returns Owned output workspace path. */
function fileWorkspacePath(base, runId) {
	return confined(base, join(".antfarm/runs", runId));
}
/**
* Create a new owned workspace using saved input bytes, without modifying source inputs.
* @param workspace - Run's recorded output directory.
* @param runId - Ownership marker identity.
* @param inputs - Immutable input snapshots from admission.
*/
async function createFileWorkspace(workspace, runId, inputs) {
	let ancestor = dirname(workspace);
	for (;;) try {
		if (await realpath(ancestor) !== ancestor) throw new Error("file workspace ancestors must not be symbolic links");
		break;
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
		ancestor = dirname(ancestor);
	}
	await mkdir(dirname(workspace), { recursive: true });
	await mkdir(workspace);
	await writeFile(join(workspace, ".antfarm-owner.json"), JSON.stringify({
		runId,
		workspace
	}), {
		flag: "wx",
		mode: 384
	});
	for (const input of inputs) {
		if (createHash("sha256").update(input.content).digest("hex") !== input.sha256) throw new Error("saved input snapshot does not match its digest");
		const path = confined(join(workspace, "inputs"), input.path);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, input.content, {
			flag: "wx",
			mode: 256
		});
	}
}
/** @param workspace - Retained directory. @param runId - Original owner. */
async function validateFileWorkspace(workspace, runId) {
	if (await realpath(workspace) !== workspace) throw new Error("file workspace moved or became a symbolic link");
	const marker = join(workspace, ".antfarm-owner.json");
	if ((await lstat(marker)).isSymbolicLink()) throw new Error("file workspace marker must not be a symbolic link");
	const value = JSON.parse(await readFile(marker, "utf8"));
	if (value === null || typeof value !== "object" || !("runId" in value) || !("workspace" in value) || value.runId !== runId || value.workspace !== workspace) throw new Error("file workspace ownership does not match");
}
/** @param root - Owned workspace. @returns Relative regular files; links and oversized trees refuse. */
async function fileInventory(root) {
	const files = [];
	const visit = async (directory) => {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isSymbolicLink()) throw new Error("file workflow outputs must not contain symbolic links");
			if (entry.isDirectory()) await visit(path);
			else if (entry.isFile() && entry.name !== ".antfarm-owner.json") files.push(relative(root, path));
			if (files.length > 1e3) throw new Error("file workflow output exceeds 1000 files");
		}
	};
	await visit(root);
	return files.sort();
}
/** @param root - Owned directory. @returns Content identity of all current files. */
async function fileCandidateVersion(root) {
	const hash = createHash("sha256");
	for (const name of await fileInventory(root)) {
		const bytes = await readFile(confined(root, name));
		if (bytes.length > 16777216) throw new Error("file workflow artifact exceeds 16 MiB");
		hash.update(JSON.stringify(name));
		hash.update(bytes);
	}
	return hash.digest("hex");
}
/** @param root - Owned workspace. @param destination - Private Run evidence directory. @returns Immutable output references. */
async function retainFileOutputs(root, destination) {
	await mkdir(destination, { recursive: true });
	const artifacts = [];
	for (const path of await fileInventory(root)) {
		if (path.startsWith(`inputs${sep}`)) continue;
		const bytes = await readFile(confined(root, path));
		if (bytes.length > 16777216) throw new Error("file workflow artifact exceeds 16 MiB");
		const sha256 = createHash("sha256").update(bytes).digest("hex");
		const output = join(destination, sha256);
		let file;
		try {
			file = await open(output, "wx", 256);
		} catch (error) {
			if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
			if (!bytes.equals(await readFile(output))) throw new Error("retained output digest differs");
			artifacts.push({
				path,
				sha256,
				bytes: bytes.length
			});
			continue;
		}
		try {
			await file.writeFile(bytes);
			await file.sync();
		} finally {
			await file.close();
		}
		artifacts.push({
			path,
			sha256,
			bytes: bytes.length
		});
	}
	return artifacts;
}
//#endregion
//#region lib/types/workspace/git.js
/** Own project-local Git worktrees and retain output when cleanup is unsafe. */
const OUTPUT_LIMIT = 1048576;
const GRACE_MS = 5e3;
/**
* Execute Git through the configured subprocess provider, without a shell.
* @param subprocess - Host execution provider.
* @param cwd - Working directory.
* @param args - Literal Git arguments.
* @param signal - Cancellation signal.
* @returns Complete command output; rejects lossy collection.
*/
async function runGit(subprocess, cwd, args, signal) {
	return runExecutable(subprocess, "git", cwd, args, signal);
}
/** @param subprocess - Native provider. @param program - Executable name. @param cwd - Authorized workspace. @param args - Literal arguments. @param signal - Lifetime. @returns Complete collected output. */
async function runExecutable(subprocess, program, cwd, args, signal, env) {
	signal?.throwIfAborted();
	const executable = await subprocess.resolveExecutable(program, void 0, signal);
	const handle = subprocess.spawn({
		argv: [executable, ...args],
		cwd,
		stdio: {
			stdin: "ignore",
			stdout: { maxBytes: OUTPUT_LIMIT },
			stderr: { maxBytes: OUTPUT_LIMIT }
		},
		graceMs: GRACE_MS,
		...signal === void 0 ? {} : { signal },
		...env === void 0 ? {} : { env }
	});
	const outcome = await handle.done;
	await handle.waitForExit();
	const stdout = handle.collected.stdout?.readFrom(0);
	const stderr = handle.collected.stderr?.readFrom(0);
	if (stdout?.lossy || stderr?.lossy) throw new Error(program === "git" ? "Git output exceeded the collection limit; workspace state cannot be verified" : "command output exceeded the collection limit; state cannot be verified");
	signal?.throwIfAborted();
	return {
		stdout: stdout?.text ?? "",
		stderr: stderr?.text ?? "",
		exitCode: outcome.exitCode
	};
}
async function checkedGit(subprocess, cwd, args, signal) {
	const result = await runGit(subprocess, cwd, args, signal);
	if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `git ${args[0]} failed with exit ${result.exitCode ?? "signal"}`);
	return result.stdout.replace(/\r?\n$/, "");
}
async function commonDirectory(subprocess, cwd, signal) {
	const common = await checkedGit(subprocess, cwd, ["rev-parse", "--git-common-dir"], signal);
	return realpath(isAbsolute(common) ? common : resolve(cwd, common));
}
/**
* Capture a non-bare repository's identity and current commit.
* @param subprocess - Host execution provider.
* @param cwd - Any directory within the repository.
* @param signal - Cancellation signal.
* @returns Canonical root, common Git directory, and full commit hash.
*/
async function prepareRepository(subprocess, cwd, signal) {
	const canonicalCwd = await realpath(cwd);
	if (!(await stat(canonicalCwd)).isDirectory()) throw new Error("base cwd must be a directory");
	if (await checkedGit(subprocess, canonicalCwd, ["rev-parse", "--is-bare-repository"], signal) !== "false") throw new Error("antfarm requires a non-bare Git working tree");
	const root = await realpath(await checkedGit(subprocess, canonicalCwd, ["rev-parse", "--show-toplevel"], signal));
	return {
		root,
		baseRevision: await checkedGit(subprocess, root, [
			"rev-parse",
			"--verify",
			"HEAD^{commit}"
		], signal),
		gitCommonDirectory: await commonDirectory(subprocess, root, signal)
	};
}
function withinRoot(root, path) {
	const rel = relative(root, path);
	return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
}
function worktreePath(root, directory, runId) {
	if (!isAbsolute(root) || isAbsolute(directory) || /[\0\r\n]/.test(directory)) throw new Error("worktreeDirectory must be a relative directory within the repository");
	const base = resolve(root, directory);
	if (base === root || !withinRoot(root, base)) throw new Error("worktreeDirectory must name a child directory of the repository root");
	return join(base, runId);
}
/**
* Resolve the run's expected worktree identity without mutating Git.
* @param repository - Captured repository identity.
* @param worktreeDirectory - Project-relative destination directory.
* @param runId - Run identifier.
* @returns Expected branch and absolute worktree path.
*/
function resolveWorktreeSpec(repository, worktreeDirectory, runId) {
	if (!/^[a-z0-9][a-z0-9-]*$/.test(runId)) throw new Error("invalid worktree run id");
	if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(repository.baseRevision)) throw new Error("worktree base revision must be a full Git commit hash");
	const path = worktreePath(repository.root, worktreeDirectory, runId);
	if (withinRoot(repository.gitCommonDirectory, path) || withinRoot(join(repository.root, ".git"), path)) throw new Error("worktreeDirectory must be outside Git metadata");
	return {
		runId,
		branch: `antfarm/${runId}`,
		path,
		repository,
		directory: relative(repository.root, dirname(path))
	};
}
async function validateSpec(subprocess, spec, signal) {
	const expected = resolveWorktreeSpec(spec.repository, spec.directory, spec.runId);
	if (spec.path !== expected.path || spec.branch !== expected.branch) throw new Error("worktree path or branch does not match its run identity");
	if (await realpath(spec.repository.root) !== spec.repository.root) throw new Error("repository root is no longer canonical");
	const root = await realpath(await checkedGit(subprocess, spec.repository.root, ["rev-parse", "--show-toplevel"], signal));
	if (root !== spec.repository.root || await commonDirectory(subprocess, root, signal) !== spec.repository.gitCommonDirectory) throw new Error("repository Git identity changed");
}
async function assertCanonicalAncestors(path) {
	let current = path;
	for (;;) try {
		if ((await lstat(current)).isSymbolicLink()) throw new Error("worktree path contains a symlink or moved directory");
		if (await realpath(current) !== current) throw new Error("worktree path contains a symlink or moved directory");
		return;
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
		const parent = dirname(current);
		if (parent === current) throw error;
		current = parent;
	}
}
async function rejectTrackedDirectory(subprocess, spec, signal) {
	const directory = spec.directory.split(sep).join("/");
	const ancestors = directory.split("/").map((_part, index, parts) => parts.slice(0, index + 1).join("/"));
	if ((await checkedGit(subprocess, spec.repository.root, [
		"ls-files",
		"-z",
		"--",
		...ancestors.map((path) => `:(literal)${path}`)
	], signal)).split("\0").some((path) => path !== "" && (path === directory || path.startsWith(`${directory}/`) || directory.startsWith(`${path}/`)))) throw new Error(`repository tracks ${directory} or its ancestor; antfarm refuses this worktree directory`);
}
async function ensureLocalExclude(spec) {
	const info = join(spec.repository.gitCommonDirectory, "info");
	const exclude = join(info, "exclude");
	await assertCanonicalAncestors(exclude);
	await mkdir(info, { recursive: true });
	let current = "";
	try {
		current = await readFile(exclude, "utf8");
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	const pattern = `/${spec.directory.split(sep).join("/").replace(/([\\#!*?\[\] ])/g, "\\$1")}/`;
	if (current.split(/\r?\n/).includes(pattern)) return;
	const handle = await open(exclude, "a");
	try {
		await handle.write(`${current !== "" && !current.endsWith("\n") ? "\n" : ""}${pattern}\n`);
		await handle.sync();
	} finally {
		await handle.close();
	}
}
/**
* Create a new worktree after verifying repository, destination, and branch ownership.
* @param subprocess - Host execution provider.
* @param spec - Expected run worktree.
* @param signal - Cancellation signal.
*/
async function createWorktree(subprocess, spec, signal) {
	await validateSpec(subprocess, spec, signal);
	await rejectTrackedDirectory(subprocess, spec, signal);
	await assertCanonicalAncestors(spec.path);
	try {
		await lstat(spec.path);
		throw new Error("worktree destination already exists");
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	await ensureLocalExclude(spec);
	await mkdir(dirname(spec.path), { recursive: true });
	await assertCanonicalAncestors(dirname(spec.path));
	await mkdir(spec.path);
	await checkedGit(subprocess, spec.repository.root, [
		"worktree",
		"add",
		"-b",
		spec.branch,
		spec.path,
		spec.repository.baseRevision
	], signal);
	await validateWorktree(subprocess, spec, signal);
}
/**
* Verify a retained worktree's path, Git repository, branch, and base ancestry.
* @param subprocess - Host execution provider.
* @param spec - Journal-recorded run worktree.
* @param signal - Cancellation signal.
*/
async function validateWorktree(subprocess, spec, signal) {
	await validateSpec(subprocess, spec, signal);
	if (await realpath(spec.path) !== spec.path) throw new Error("worktree path is no longer canonical");
	if (await realpath(await checkedGit(subprocess, spec.path, ["rev-parse", "--show-toplevel"], signal)) !== spec.path || await commonDirectory(subprocess, spec.path, signal) !== spec.repository.gitCommonDirectory) throw new Error("worktree belongs to a different Git repository");
	const branch = await runGit(subprocess, spec.path, [
		"symbolic-ref",
		"--quiet",
		"--short",
		"HEAD"
	], signal);
	if (branch.exitCode !== 0 || branch.stdout.trim() !== spec.branch) throw new Error(`worktree branch changed or is detached; expected ${spec.branch}`);
	if ((await runGit(subprocess, spec.path, [
		"merge-base",
		"--is-ancestor",
		spec.repository.baseRevision,
		"HEAD"
	], signal)).exitCode !== 0) throw new Error("worktree HEAD no longer descends from its recorded base revision");
}
/**
* Remove only an unchanged worktree whose complete identity still matches the run.
* @param subprocess - Host execution provider.
* @param spec - Journal-recorded run worktree.
* @returns Retained on identity mismatch, tracked/untracked changes, or Git failure.
*/
async function cleanupWorktree(subprocess, spec) {
	try {
		await validateWorktree(subprocess, spec);
		if (await checkedGit(subprocess, spec.path, [
			"status",
			"--porcelain=v1",
			"--untracked-files=all",
			"--ignored=matching"
		]) !== "") return {
			disposition: "retained",
			reason: "worktree contains tracked or untracked changes"
		};
		await checkedGit(subprocess, spec.repository.root, [
			"worktree",
			"remove",
			spec.path
		]);
		return { disposition: "cleaned" };
	} catch (error) {
		return {
			disposition: "retained",
			reason: error instanceof Error ? error.message : String(error)
		};
	}
}
//#endregion
//#region lib/types/runtime/evidence.js
/** Candidate-bound facts captured from the native tool execution pipeline. */
/**
* Hash tracked and untracked source without including ignored dependency/build trees.
* @param subprocess - Native Git subprocess owner.
* @param workspace - Owned candidate directory.
* @returns SHA-256 candidate identity; missing or oversized sources refuse acceptance.
*/
async function candidateVersion(subprocess, workspace, kind = "git") {
	if (kind === "files") return fileCandidateVersion(workspace);
	const files = await runGit(subprocess, workspace, [
		"ls-files",
		"-z",
		"--cached",
		"--others",
		"--exclude-standard"
	]);
	if (files.exitCode !== 0) throw new Error("candidate source inventory could not be read");
	const hash = createHash("sha256");
	const head = await runGit(subprocess, workspace, [
		"rev-parse",
		"--verify",
		"HEAD^{commit}"
	]);
	if (head.exitCode !== 0) throw new Error("candidate commit could not be read");
	hash.update(head.stdout.trim());
	const names = [...new Set(files.stdout.split("\0").filter(Boolean))].sort();
	if (names.length > 1e5) throw new Error("candidate source inventory exceeds 100000 files");
	for (const name of names) {
		const path = resolve(workspace, name);
		const rel = relative(workspace, path);
		if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("candidate path escapes its owned workspace");
		hash.update(JSON.stringify(name));
		let stat;
		try {
			stat = await lstat(path);
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") {
				hash.update("deleted");
				continue;
			}
			throw error;
		}
		hash.update(String(stat.mode));
		if (stat.isSymbolicLink()) hash.update(await readlink(path));
		else if (stat.isFile()) {
			if (stat.size > 33554432) throw new Error(`candidate source ${name} exceeds 32 MiB`);
			hash.update(await readFile(path));
		} else hash.update("directory");
	}
	return hash.digest("hex");
}
/** @param subprocess - Native provider. @param workspace - Owned Git workspace. @returns Refuses an uncommitted source candidate. */
async function requireCommittedCandidate(subprocess, workspace) {
	const result = await runGit(subprocess, workspace, [
		"status",
		"--porcelain=v1",
		"--untracked-files=all"
	]);
	if (result.exitCode !== 0 || result.stdout.trim() !== "") throw new Error("verification requires a clean, committed candidate including new source files");
}
const foreground = z$1.object({
	kind: z$1.literal("foreground"),
	cwd: z$1.string(),
	exitCode: z$1.number().int().nullable(),
	signal: z$1.string().nullable(),
	timedOut: z$1.boolean(),
	aborted: z$1.boolean(),
	stdout: z$1.object({
		text: z$1.string(),
		truncated: z$1.boolean()
	}),
	stderr: z$1.object({
		text: z$1.string(),
		truncated: z$1.boolean()
	})
});
/** Owns capture listeners; durable writes are awaited before accepting a child result. */
var ExecutionEvidence = class {
	attempts = /* @__PURE__ */ new Map();
	calls = /* @__PURE__ */ new Map();
	/** @param ctx - Native tools and subprocess context. */
	constructor(ctx) {
		ctx.on("tools/execute", async (exec, next) => {
			const attempt = exec.agent === void 0 ? void 0 : this.attempts.get(exec.agent.id);
			if (attempt === void 0 || exec.name !== "bash") return next();
			const args = z$1.object({ command: z$1.string() }).parse(exec.arguments);
			const before = await candidateVersion(ctx.subprocess, attempt.workspace, attempt.journal.state.start.workspaceKind);
			const result = await next();
			const after = await candidateVersion(ctx.subprocess, attempt.workspace, attempt.journal.state.start.workspaceKind);
			this.calls.set(exec.callId, {
				attempt,
				childId: exec.agent.id,
				command: args.command,
				before,
				after
			});
			return result;
		});
		ctx.on("tools/post-execute", async (exec, result, next) => {
			const decision = await next();
			if (!this.calls.has(exec.callId) || result.isError || !foreground.safeParse(result.value).success || decision.kind !== "accept" || decision.value !== void 0) return decision;
			return {
				...decision,
				content: [...decision.content ?? result.content, {
					type: "text",
					text: `Antfarm execution reference: ${exec.callId}. Cite this as checks[].call_id; the runtime separately verifies success and candidate identity.`
				}]
			};
		});
		ctx.on("tools/result", (exec, result) => {
			const call = this.calls.get(exec.callId);
			if (call === void 0) return;
			this.calls.delete(exec.callId);
			const pending = this.record(exec.callId, call, result).catch((error) => {
				call.attempt.error = error;
			});
			call.attempt.pending.add(pending);
			pending.finally(() => {
				call.attempt.pending.delete(pending);
			});
		});
	}
	/** @param childId - Reserved child. @param journal - Sole Run writer. @param stepId - Role step. */
	begin(childId, journal, stepId) {
		this.attempts.set(childId, {
			journal,
			stepId,
			workspace: journal.state.start.workspace,
			records: [],
			pending: /* @__PURE__ */ new Set()
		});
	}
	/** @param childId - Disposed child. @returns Committed actual checks; capture failure rejects. */
	async finish(childId) {
		const attempt = this.attempts.get(childId);
		if (attempt === void 0) return [];
		await Promise.all(attempt.pending);
		this.attempts.delete(childId);
		if (attempt.error !== void 0) throw new Error("native execution evidence could not be committed", { cause: attempt.error });
		return attempt.records;
	}
	async record(callId, call, result) {
		if (result.isError) return;
		const value = foreground.safeParse(result.value);
		if (!value.success) return;
		const facts = value.data;
		const evidence = {
			callId,
			childSessionId: call.childId,
			stepId: call.attempt.stepId,
			command: call.command,
			cwd: facts.cwd,
			candidate: call.before,
			afterCandidate: call.after,
			passed: facts.exitCode === 0 && facts.signal === null && !facts.timedOut && !facts.aborted && !facts.stdout.truncated && !facts.stderr.truncated && call.before === call.after && resolve(facts.cwd) === resolve(call.attempt.workspace) && facts.stdout.text.length <= 65536 && facts.stderr.text.length <= 65536,
			exitCode: facts.exitCode,
			stdout: facts.stdout.text.slice(-65536),
			stderr: facts.stderr.text.slice(-65536)
		};
		await call.attempt.journal.append({
			type: "check-evidence",
			data: evidence
		});
		call.attempt.records.push(evidence);
	}
};
//#endregion
//#region lib/types/runtime/github.js
const pullRequest = z$1.object({
	url: z$1.string().url(),
	headRefOid: z$1.string().regex(/^[a-f0-9]{40,64}$/),
	headRefName: z$1.string(),
	state: z$1.literal("OPEN"),
	author: z$1.object({ login: z$1.string() }),
	reviews: z$1.array(z$1.object({
		id: z$1.string(),
		author: z$1.object({ login: z$1.string() }).nullable(),
		state: z$1.string(),
		commit: z$1.object({ oid: z$1.string() })
	}))
});
/** Host checks remote facts; publishing and reviewing remain native role-tool operations. */
var GitHubDelivery = class {
	subprocess;
	/** @param subprocess - Host subprocess owner. */
	constructor(subprocess) {
		this.subprocess = subprocess;
	}
	async query(start, effect, args, signal) {
		const ref = effect === "github-review" ? start.githubReviewerTokenEnv : void 0;
		if (ref !== void 0 && (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref) || process.env[ref] === void 0)) throw new Error("the configured native reviewer credential reference is unavailable");
		return runExecutable(this.subprocess, "gh", start.workspace, args, signal, ref === void 0 ? void 0 : { GH_TOKEN: process.env[ref] });
	}
	/** @param start - Owned branch. @param effect - Upcoming declared operation. @param signal - Run lifetime. @returns Current GitHub actor without changing global credentials. */
	async preflight(start, effect, signal) {
		const actor = await this.query(start, effect, [
			"api",
			"user",
			"--jq",
			".login"
		], signal);
		const repository = await this.query(start, effect, [
			"repo",
			"view",
			"--json",
			"viewerPermission"
		], signal);
		if (actor.exitCode !== 0 || actor.stdout.trim() === "" || repository.exitCode !== 0) throw new Error("GitHub authentication or repository access is unavailable; configure the native role environment");
		if (!z$1.object({ viewerPermission: z$1.enum([
			"WRITE",
			"MAINTAIN",
			"ADMIN"
		]) }).safeParse(JSON.parse(repository.stdout)).success) throw new Error("the GitHub actor needs write permission for the declared PR or review operation");
		if (effect === "github-review") {
			const result = await this.query(start, effect, [
				"pr",
				"view",
				start.branch,
				"--json",
				"url,headRefOid,headRefName,state,author,reviews"
			], signal);
			if (result.exitCode !== 0) throw new Error("create and verify the candidate PR before its GitHub review");
			const pr = pullRequest.parse(JSON.parse(result.stdout));
			if (pr.author.login === actor.stdout.trim() && approvingReview(pr) === void 0) throw new Error("GitHub prevents self-approval; obtain an approving human review on this PR head, then resume, or configure a distinct native reviewer identity");
		}
		return actor.stdout.trim();
	}
	/** @param start - Saved Run identity. @param effect - Declared delivery phase. @param values - Child's claimed references. @param signal - Run lifetime. @returns Verified PR references. */
	async verify(start, effect, values, signal) {
		const dirty = await runGit(this.subprocess, start.workspace, ["status", "--porcelain"], signal);
		const head = await runGit(this.subprocess, start.workspace, ["rev-parse", "HEAD"], signal);
		if (dirty.exitCode !== 0 || dirty.stdout.trim() !== "" || head.exitCode !== 0) throw new Error("commit and check the complete candidate before GitHub delivery");
		const result = await this.query(start, effect, [
			"pr",
			"view",
			start.branch,
			"--json",
			"url,headRefOid,headRefName,state,author,reviews"
		], signal);
		if (result.exitCode !== 0) throw new Error("GitHub delivery could not be verified; inspect authentication and the retained branch");
		const pr = pullRequest.parse(JSON.parse(result.stdout));
		if (pr.headRefOid !== head.stdout.trim() || pr.headRefName !== start.branch || values["pr_url"] !== void 0 && values["pr_url"] !== pr.url) throw new Error("PR head or branch differs from the accepted candidate");
		const refs = {
			pr_url: pr.url,
			pr_head: pr.headRefOid,
			pr_author: pr.author.login
		};
		if (effect === "github-review") {
			const review = approvingReview(pr, values["review_id"]);
			if (review === void 0) throw new Error("publish an approving review for this PR head using a reviewer identity distinct from the PR author");
			refs["review_id"] = review.id;
		}
		return refs;
	}
};
function approvingReview(pr, reviewId) {
	const latest = /* @__PURE__ */ new Map();
	for (const review of pr.reviews) if (review.author !== null && review.state !== "PENDING" && review.state !== "COMMENTED") latest.set(review.author.login, review);
	return [...latest.values()].find((review) => review.commit.oid === pr.headRefOid && review.state === "APPROVED" && review.author?.login !== pr.author.login && (reviewId === void 0 || reviewId === review.id));
}
//#endregion
//#region lib/types/runtime/notifications.js
/** @param journal - Sole writer. @param parent - Exact native owner. @param webhookUrl - Explicit subscription; never persisted. @param token - Optional native credential value; never persisted. @param signal - Host lifetime. */
async function deliverOutcome(journal, parent, webhookUrl, token, signal, flush) {
	const state = journal.state;
	const transition = journal.latest(state.status === "blocked" ? "checkpoint" : state.status === "interrupted" ? "run-interrupt" : "run-end");
	const id = `${state.start.runId}:${transition?.seq ?? 0}:${state.status}:${parent.id}`;
	const text = `Antfarm ${state.start.runId} [${state.status}]: ${(state.checkpoint.blocked ?? state.workspaceReason) || "Workflow accepted"}. Inspect the Antfarm run for results and next actions.`;
	await deliverOwnerNotice(journal, parent, id, text, signal, flush);
	await deliverWebhook(journal, id, `run.${state.status}`, text, webhookUrl, token, signal);
}
/** @param journal - Sole writer. @param parent - Authorized recipient. @param id - Stable transition identity. @param text - Public notice. @param signal - Delivery lifetime. @param flush - Native persistence confirmation. */
async function deliverOwnerNotice(journal, parent, id, text, signal, flush) {
	if (journal.delivered(id, "owner")) return;
	const state = journal.state;
	const message = createUserMessage({
		content: [{
			type: "text",
			text
		}],
		source: {
			kind: "antfarm",
			runId: state.start.runId,
			noticeId: id,
			form: "notice",
			summary: `Antfarm ${state.status}`
		}
	});
	await journal.append({
		type: "notification",
		data: {
			id,
			channel: "owner",
			status: "pending",
			detail: "outcome notice"
		}
	});
	try {
		signal.throwIfAborted();
		parent.send(message, "next-step", false);
		if (!await flush()) throw new Error("native Session has no participating persistence listener");
		await journal.append({
			type: "notification",
			data: {
				id,
				channel: "owner",
				status: "delivered",
				detail: "native owner inbox accepted the notice"
			}
		});
	} catch {
		await journal.append({
			type: "notification",
			data: {
				id,
				channel: "owner",
				status: "failed",
				detail: "owner notice could not be confirmed; inspect the Run history"
			}
		});
	}
}
/** @param journal - Sole writer. @param id - Stable event identity. @param event - Lifecycle kind. @param detail - Bounded public facts. @param url - Explicit subscription, never logged. @param token - Native secret, never logged. @param signal - Delivery lifetime. */
async function deliverWebhook(journal, id, event, detail, url, token, signal) {
	if (url === "" || journal.delivered(id, "webhook")) return;
	const state = journal.state;
	await journal.append({
		type: "notification",
		data: {
			id,
			channel: "webhook",
			status: "pending",
			detail: "explicit outcome subscription"
		}
	});
	const deadline = new AbortController();
	const timer = setTimeout(() => deadline.abort(), 5e3);
	try {
		const response = await fetch(url, {
			method: "POST",
			redirect: "error",
			headers: {
				"content-type": "application/json",
				...token === void 0 ? {} : { authorization: `Bearer ${token}` }
			},
			body: JSON.stringify({
				id,
				event,
				runId: state.start.runId,
				workflowId: state.start.workflowId,
				status: state.status,
				detail: detail.slice(0, 2048)
			}),
			signal: AbortSignal.any([signal, deadline.signal])
		});
		await response.body?.cancel();
		if (!response.ok) throw new Error("webhook rejected");
		await journal.append({
			type: "notification",
			data: {
				id,
				channel: "webhook",
				status: "delivered",
				detail: "subscription accepted the event"
			}
		});
	} catch {
		await journal.append({
			type: "notification",
			data: {
				id,
				channel: "webhook",
				status: "failed",
				detail: "delivery was not confirmed; remote delivery may have occurred"
			}
		});
	} finally {
		clearTimeout(timer);
	}
}
//#endregion
//#region lib/types/runtime/capacity.js
/** FIFO within owners, with round-robin selection between eligible owners. */
var RunCapacity = class {
	hostLimit;
	ownerLimit;
	waiting = [];
	active = /* @__PURE__ */ new Map();
	lastOwner;
	/** @param hostLimit - Total writers. @param ownerLimit - Writers per owner. */
	constructor(hostLimit, ownerLimit) {
		this.hostLimit = hostLimit;
		this.ownerLimit = ownerLimit;
	}
	/**
	* Wait for a slot; abort removes only this request without consuming capacity.
	* @param owner - Original owning Session.
	* @param signal - Lifetime of this execution request.
	* @returns Idempotent release, called after driver teardown.
	*/
	acquire(owner, signal) {
		signal.throwIfAborted();
		return new Promise((grant, reject) => {
			const row = {
				owner,
				signal,
				grant,
				reject,
				abort: () => {
					const index = this.waiting.indexOf(row);
					if (index >= 0) this.waiting.splice(index, 1);
					signal.removeEventListener("abort", row.abort);
					reject(signal.reason);
					this.drain();
				}
			};
			this.waiting.push(row);
			signal.addEventListener("abort", row.abort, { once: true });
			this.drain();
		});
	}
	drain() {
		while ([...this.active.values()].reduce((sum, count) => sum + count, 0) < this.hostLimit) {
			const eligible = this.waiting.filter((row) => (this.active.get(row.owner) ?? 0) < this.ownerLimit);
			const row = eligible.find((candidate) => candidate.owner !== this.lastOwner) ?? eligible[0];
			if (row === void 0) return;
			this.waiting.splice(this.waiting.indexOf(row), 1);
			row.signal.removeEventListener("abort", row.abort);
			this.active.set(row.owner, (this.active.get(row.owner) ?? 0) + 1);
			this.lastOwner = row.owner;
			let released = false;
			row.grant(() => {
				if (released) return;
				released = true;
				const count = (this.active.get(row.owner) ?? 1) - 1;
				if (count === 0) this.active.delete(row.owner);
				else this.active.set(row.owner, count);
				this.drain();
			});
		}
	}
};
//#endregion
//#region lib/types/runtime/owner.js
var __addDisposableResource$1 = function(env, value, async) {
	if (value !== null && value !== void 0) {
		if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
		var dispose, inner;
		if (async) {
			if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
			dispose = value[Symbol.asyncDispose];
		}
		if (dispose === void 0) {
			if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
			dispose = value[Symbol.dispose];
			if (async) inner = dispose;
		}
		if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
		if (inner) dispose = function() {
			try {
				inner.call(this);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		env.stack.push({
			value,
			dispose,
			async
		});
	} else if (async) env.stack.push({ async: true });
	return value;
};
var __disposeResources$1 = (function(SuppressedError) {
	return function(env) {
		function fail(e) {
			env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
			env.hasError = true;
		}
		var r, s = 0;
		function next() {
			while (r = env.stack.pop()) try {
				if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
				if (r.dispose) {
					var result = r.dispose.call(r.value);
					if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
						fail(e);
						return next();
					});
				} else s |= 1;
			} catch (e) {
				fail(e);
			}
			if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
			if (env.hasError) throw env.error;
		}
		return next();
	};
})(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
	var e = new Error(message);
	return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
/** Native handles are owned only when Antfarm itself resumed them. */
var RunOwnerResolver = class {
	ctx;
	pending = /* @__PURE__ */ new Map();
	owned = /* @__PURE__ */ new Map();
	closing = false;
	/** @param ctx - Host context used as the native resume lifetime owner. */
	constructor(ctx) {
		this.ctx = ctx;
	}
	/**
	* Resolve a live root or resume its persisted native composition without a model turn.
	* @param id - Original authorization owner; never replaced by a new Session.
	* @returns Exact native Agent after archive and lineage validation.
	*/
	async resolve(id) {
		this.allowed(id);
		const live = this.ctx.agents.get(id);
		if (live !== void 0) return this.root(live, id);
		let pending = this.pending.get(id);
		if (pending === void 0) {
			pending = this.restore(id).finally(() => {
				this.pending.delete(id);
			});
			this.pending.set(id, pending);
		}
		const agent = await pending;
		this.allowed(id);
		return this.root(agent, id);
	}
	allowed(id) {
		if (this.closing) throw new Error("antfarm owner resolver is closing");
		if (this.ctx.get("workspaceRegistry")?.archivedSessionIds.includes(id)) throw new Error("restore the archived owning session before resuming antfarm");
	}
	root(agent, id) {
		if (agent.id !== id || this.ctx.agents.get(id) !== agent) throw new Error("antfarm owner changed while resolving execution authority");
		if (agent.session.header.origin === "subagent") throw new Error("antfarm requires a root owning session");
		return agent;
	}
	async restore(id) {
		const env_1 = {
			stack: [],
			error: void 0,
			hasError: false
		};
		try {
			const controller = this.ctx.get("sessionController");
			if (controller !== void 0) {
				const result = await controller.resolveAgent(id);
				if ("error" in result) throw result.error;
				return result.agent;
			}
			const query = this.ctx.get("sessionQuery");
			if (query === void 0) throw new Error("cold antfarm owner recovery requires native Session query or Session controller");
			const observation = __addDisposableResource$1(env_1, await query.observeSession(id), false);
			this.allowed(id);
			if (observation.header.origin === "subagent") throw new Error("antfarm cannot resume a subagent as its owner");
			const preset = observation.projections?.values.agentPreset;
			if (preset !== null && preset !== void 0 && (typeof preset !== "string" || preset === "")) throw new Error("persisted antfarm owner has an invalid native Agent preset");
			const handle = await this.ctx.agents.resume({
				resumeSessionId: id,
				setup: async (agentCtx) => {
					installModelSelection(agentCtx);
					if (typeof preset === "string") await this.ctx.agentPresets.mount(agentCtx, preset);
				}
			});
			this.owned.set(id, handle);
			if (this.closing) {
				await handle.dispose();
				this.owned.delete(id);
				throw new Error("antfarm owner recovery was disposed");
			}
			return handle.agent;
		} catch (e_1) {
			env_1.error = e_1;
			env_1.hasError = true;
		} finally {
			__disposeResources$1(env_1);
		}
	}
	/** Wait for in-flight restores, then dispose only handles created by this resolver. */
	async dispose() {
		this.closing = true;
		await Promise.allSettled(this.pending.values());
		await Promise.all([...this.owned.values()].map((handle) => handle.dispose()));
		this.owned.clear();
	}
};
//#endregion
//#region lib/types/workflow/template.js
/** Strict substitution for the runtime context named by workflow steps. */
const TEMPLATE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
/**
* Substitute every referenced context value before starting a child.
* @param template - Workflow input text.
* @param context - Values captured for this execution.
* @returns Rendered text; throws when a referenced value is unavailable.
*/
function resolveTemplate(template, context) {
	const missing = /* @__PURE__ */ new Set();
	const rendered = template.replace(TEMPLATE, (_match, key) => {
		const value = context[key];
		if (value === void 0) {
			missing.add(key);
			return "";
		}
		return value;
	});
	if (missing.size > 0) throw new Error(`missing workflow template values: ${[...missing].sort().join(", ")}`);
	return rendered;
}
/**
* Read context references without resolving their values.
* @param template - Workflow input text.
* @returns Unique references in source order.
*/
function templateKeys(template) {
	return [...new Set([...template.matchAll(TEMPLATE)].map((match) => match[1]))];
}
//#endregion
//#region lib/types/workflow/notifications.js
/** Workflow endpoints are public; authentication belongs to native secret settings. */
/** @param value - Public workflow notification endpoint. @returns Endpoint without URL credentials. */
function publicWebhookUrl(value) {
	const url = new URL(value);
	if (!["https:", "http:"].includes(url.protocol) || url.username !== "" || url.password !== "" || url.hash !== "" || url.search !== "") throw new Error("workflow notification URLs must omit credentials, queries and fragments; configure native secret settings instead");
	return value;
}
//#endregion
//#region lib/types/workflow/loader.js
/** Load canonical workflow YAML and validate durable resolved snapshots. */
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTEXT_KEYS = /* @__PURE__ */ new Set([
	"task",
	"branch",
	"workspace",
	"current_story",
	"verify_feedback",
	"changes",
	"issues",
	"stories_summary",
	"resume_guidance",
	"results"
]);
function record$1(value, label, keys) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
	const row = value;
	for (const key of Object.keys(row)) if (!keys.includes(key)) throw new Error(`${label}.${key} is unsupported in workflow version 2`);
	return row;
}
function text(row, key, label) {
	const value = row[key];
	if (typeof value !== "string" || value.trim() === "") throw new Error(`${label}.${key} must be a non-empty string`);
	return value;
}
function optionalText(row, key, label) {
	return row[key] === void 0 ? void 0 : text(row, key, label);
}
function integer(value, label, fallback, minimum = 0) {
	if (value === void 0 && fallback !== void 0) return fallback;
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new Error(`${label} must be a safe integer >= ${minimum}`);
	return value;
}
function safeId$1(value, label) {
	if (!ID.test(value)) throw new Error(`${label} must be kebab-case`);
	return value;
}
function assertWithinRoot(root, path) {
	const rel = relative(root, path);
	if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("workflow sources must remain within the configured workflow root");
}
function parseAgent(value, index) {
	const label = `workflow.agents[${index}]`;
	const row = record$1(value, label, [
		"id",
		"name",
		"preset",
		"instructions",
		"model",
		"timeoutSeconds",
		"skills",
		"role",
		"description"
	]);
	const id = safeId$1(text(row, "id", label), `${label}.id`);
	const model = optionalText(row, "model", label);
	const timeout = row["timeoutSeconds"] === void 0 ? void 0 : integer(row["timeoutSeconds"], `${label}.timeoutSeconds`, void 0, 1);
	if (timeout !== void 0 && timeout > Math.floor(2147483647 / 1e3)) throw new Error(`${label}.timeoutSeconds exceeds the timer limit`);
	return {
		id,
		name: optionalText(row, "name", label) ?? id,
		preset: text(row, "preset", label),
		instructions: text(row, "instructions", label),
		...row["skills"] === void 0 ? {} : { skills: z$1.array(z$1.string().min(1)).parse(row["skills"]) },
		...row["role"] === void 0 ? {} : { role: z$1.enum([
			"analysis",
			"coding",
			"verification",
			"testing",
			"pr",
			"scanning"
		]).parse(row["role"]) },
		...row["description"] === void 0 ? {} : { description: text(row, "description", label) },
		...model === void 0 ? {} : { model },
		...timeout === void 0 ? {} : { timeoutSeconds: timeout }
	};
}
function parseOnFail(value, label) {
	if (value === void 0) return void 0;
	const row = record$1(value, label, [
		"retryStep",
		"maxRetries",
		"onExhausted"
	]);
	const escalateTo = (row["onExhausted"] === void 0 ? {} : record$1(row["onExhausted"], `${label}.onExhausted`, ["escalateTo"]))["escalateTo"];
	if (escalateTo !== void 0 && escalateTo !== "human") throw new Error(`${label}.onExhausted.escalateTo must be human`);
	const retryStep = optionalText(row, "retryStep", label);
	return {
		...retryStep === void 0 ? {} : { retryStep: safeId$1(retryStep, `${label}.retryStep`) },
		maxRetries: integer(row["maxRetries"], `${label}.maxRetries`, 1),
		onExhausted: escalateTo === void 0 ? {} : { escalateTo }
	};
}
function parseStep(value, index) {
	const label = `workflow.steps[${index}]`;
	const type = record$1(value, label, [
		"id",
		"agent",
		"type",
		"input",
		"output",
		"maxRetries",
		"onFail",
		"over",
		"completion",
		"freshSession",
		"verifyEach",
		"verifyStep",
		"repairInput",
		"expects",
		"requireChecks",
		"requireVisuals",
		"effect"
	])["type"] ?? "single";
	if (type !== "single" && type !== "loop") throw new Error(`${label}.type must be single or loop`);
	const row = record$1(value, label, type === "single" ? [
		"id",
		"agent",
		"type",
		"input",
		"output",
		"maxRetries",
		"onFail",
		"expects",
		"requireChecks",
		"requireVisuals",
		"effect"
	] : [
		"id",
		"agent",
		"type",
		"input",
		"maxRetries",
		"onFail",
		"over",
		"completion",
		"freshSession",
		"verifyEach",
		"verifyStep",
		"repairInput",
		"expects",
		"requireChecks"
	]);
	const onFail = parseOnFail(row["onFail"], `${label}.onFail`);
	const common = {
		id: safeId$1(text(row, "id", label), `${label}.id`),
		agent: safeId$1(text(row, "agent", label), `${label}.agent`),
		input: text(row, "input", label),
		...row["requireChecks"] === void 0 ? {} : { requireChecks: z$1.boolean().parse(row["requireChecks"]) },
		...row["expects"] === void 0 ? {} : { expects: z$1.string().regex(/^[A-Z][A-Z0-9_]*: [^\n]+(?:\n[A-Z][A-Z0-9_]*: [^\n]+)*$/, "expects must declare KEY: value verdicts").parse(row["expects"]) },
		maxRetries: integer(row["maxRetries"], `${label}.maxRetries`, 1),
		...onFail === void 0 ? {} : { onFail }
	};
	if (type === "single") {
		const output = row["output"] ?? "result";
		if (output !== "result" && output !== "stories") throw new Error(`${label}.output must be result or stories`);
		return {
			...common,
			type,
			output,
			...row["requireVisuals"] === void 0 ? {} : { requireVisuals: z$1.boolean().parse(row["requireVisuals"]) },
			...row["effect"] === void 0 ? {} : { effect: z$1.enum(["pull-request", "github-review"]).parse(row["effect"]) }
		};
	}
	if (row["over"] !== "stories") throw new Error(`${label}.over must be stories`);
	if (row["completion"] !== "all_done") throw new Error(`${label}.completion must be all_done`);
	if (row["freshSession"] !== true) throw new Error(`${label}.freshSession must be true`);
	const verifyEach = row["verifyEach"] ?? false;
	if (typeof verifyEach !== "boolean") throw new Error(`${label}.verifyEach must be boolean`);
	const verifyStep = optionalText(row, "verifyStep", label);
	const repairInput = optionalText(row, "repairInput", label);
	if (verifyEach && verifyStep === void 0) throw new Error(`${label}.verifyStep is required when verifyEach is true`);
	if (!verifyEach && verifyStep !== void 0) throw new Error(`${label}.verifyStep requires verifyEach`);
	return {
		...common,
		type,
		over: "stories",
		completion: "all_done",
		freshSession: true,
		verifyEach,
		...verifyStep === void 0 ? {} : { verifyStep: safeId$1(verifyStep, `${label}.verifyStep`) },
		...repairInput === void 0 ? {} : { repairInput }
	};
}
function validateReferences(workflow) {
	const { agents, steps } = workflow;
	if (new Set(agents.map((agent) => agent.id)).size !== agents.length) throw new Error("workflow.agents contains duplicate ids");
	if (new Set(steps.map((step) => step.id)).size !== steps.length) throw new Error("workflow.steps contains duplicate ids");
	const producers = steps.filter((step) => step.type === "single" && step.output === "stories");
	const loops = steps.filter((step) => step.type === "loop");
	if (producers.length > 1 || loops.length > 1) throw new Error("workflow supports at most one stories producer and one story loop");
	const agentIds = new Set(agents.map((agent) => agent.id));
	for (const [index, step] of steps.entries()) {
		if (!agentIds.has(step.agent)) throw new Error(`step "${step.id}" references unknown agent "${step.agent}"`);
		const isVerify = loops.some((loop) => loop.verifyStep === step.id);
		const isRepair = steps.some((candidate) => candidate.onFail?.retryStep === step.id);
		for (const key of templateKeys(step.input)) {
			if (!CONTEXT_KEYS.has(key) && workflow.source === void 0 && workflow.context?.[key] === void 0) throw new Error(`step "${step.id}" references unsupported template "{{${key}}}"`);
			if (workflow.source === void 0 && [
				"current_story",
				"verify_feedback",
				"changes"
			].includes(key) && step.type === "single" && !isVerify) throw new Error(`step "${step.id}" requires story context for "{{${key}}}"`);
			if (workflow.source === void 0 && key === "issues" && !isRepair) throw new Error(`step "${step.id}" requires repair context for "{{${key}}}"`);
			if (workflow.source === void 0 && key === "stories_summary" && !isRepair && !producers.some((producer) => steps.indexOf(producer) < index)) throw new Error(`step "${step.id}" requires a preceding plan for "{{${key}}}"`);
		}
		if (step.type === "loop") {
			const producer = producers[0];
			if (producer === void 0 || steps.indexOf(producer) >= index) throw new Error(`loop "${step.id}" requires a preceding stories output step`);
			if (step.verifyStep !== void 0) {
				const target = steps.find((candidate) => candidate.id === step.verifyStep);
				if (target === void 0 || target.id === step.id || target.type !== "single" || target.output !== "result") throw new Error(`loop "${step.id}" verifyStep must reference a different single result step`);
			}
			if (step.repairInput !== void 0) {
				for (const key of templateKeys(step.repairInput)) if (!CONTEXT_KEYS.has(key) || [
					"current_story",
					"verify_feedback",
					"changes"
				].includes(key)) throw new Error(`loop "${step.id}" repairInput references unsupported template "{{${key}}}"`);
			}
		}
		const retryStep = step.onFail?.retryStep;
		if (retryStep !== void 0) {
			const targetIndex = steps.findIndex((candidate) => candidate.id === retryStep);
			if (targetIndex < 0 || targetIndex >= index) throw new Error(`step "${step.id}" retryStep must reference an earlier step`);
			const target = steps[targetIndex];
			if (target.type === "loop" && target.repairInput === void 0) throw new Error(`loop retry target "${target.id}" requires repairInput`);
			if (target.type === "single" && target.output === "stories") throw new Error(`step "${step.id}" cannot retry a stories producer`);
		}
	}
}
function parseDefinition(value) {
	const row = record$1(value, "workflow", [
		"id",
		"name",
		"version",
		"description",
		"agents",
		"steps",
		"context",
		"source",
		"workspace",
		"inputs",
		"allowEmptyPlan",
		"notifications"
	]);
	if (row["version"] !== 2) throw new Error("workflow.version must be 2; legacy workflows require conversion");
	if (!Array.isArray(row["agents"]) || row["agents"].length === 0) throw new Error("workflow.agents must be a non-empty array");
	if (!Array.isArray(row["steps"]) || row["steps"].length === 0) throw new Error("workflow.steps must be a non-empty array");
	const description = optionalText(row, "description", "workflow");
	const workflow = {
		id: safeId$1(text(row, "id", "workflow"), "workflow.id"),
		name: text(row, "name", "workflow"),
		version: 2,
		...description === void 0 ? {} : { description },
		agents: row["agents"].map(parseAgent),
		steps: row["steps"].map(parseStep),
		...row["allowEmptyPlan"] === void 0 ? {} : { allowEmptyPlan: z$1.boolean().parse(row["allowEmptyPlan"]) },
		...row["workspace"] === void 0 ? {} : { workspace: z$1.enum(["git", "files"]).parse(row["workspace"]) },
		...row["inputs"] === void 0 ? {} : { inputs: z$1.array(z$1.string().min(1)).max(100).parse(row["inputs"]) },
		...row["notifications"] === void 0 ? {} : { notifications: z$1.strictObject({ url: z$1.string().url().transform(publicWebhookUrl).optional() }).parse(row["notifications"]) },
		...row["context"] === void 0 ? {} : { context: z$1.record(z$1.string().regex(/^[a-zA-Z0-9_]+$/), z$1.string()).parse(row["context"]) },
		...row["source"] === void 0 ? {} : { source: z$1.strictObject({
			format: z$1.literal("snarktank-antfarm"),
			version: z$1.number().int().positive(),
			polling: z$1.strictObject({
				model: z$1.string().optional(),
				timeoutSeconds: z$1.number().int().positive().optional()
			}),
			cron: z$1.strictObject({ interval_ms: z$1.number().int().positive().optional() }),
			notifications: z$1.strictObject({ url: z$1.string().url().transform(publicWebhookUrl).optional() })
		}).parse(row["source"]) }
	};
	if (Buffer.byteLength(JSON.stringify(workflow)) > 1048576) throw new Error("resolved workflow exceeds 1 MiB");
	validateReferences(workflow);
	return workflow;
}
/**
* Validate a journal's complete workflow snapshot without reading source files.
* @param value - Decoded durable workflow data.
* @returns A validated version 2 snapshot.
*/
function validateResolvedWorkflow(value) {
	const { sourceDirectory, ...definition } = record$1(value, "workflow", [
		"id",
		"name",
		"version",
		"description",
		"agents",
		"steps",
		"sourceDirectory",
		"context",
		"source",
		"workspace",
		"inputs",
		"allowEmptyPlan",
		"notifications"
	]);
	if (typeof sourceDirectory !== "string" || !isAbsolute(sourceDirectory)) throw new Error("workflow.sourceDirectory must be an absolute path");
	return {
		...parseDefinition(definition),
		sourceDirectory
	};
}
function parseDocument(id, document) {
	const workflow = parseDefinition(parse(document));
	if (workflow.id !== id) throw new Error(`workflow document id "${workflow.id}" does not match selected workflow "${id}"`);
	for (const agent of workflow.agents) if (isAbsolute(agent.instructions) || !agent.instructions.endsWith(".md")) throw new Error(`agent "${agent.id}" instructions must name a relative Markdown file`);
	return workflow;
}
/**
* Resolve the first matching workflow and capture its Markdown instructions.
* @param id - Workflow id.
* @param roots - Workflow roots in precedence order.
* @returns Validated workflow snapshot ready for execution.
*/
async function loadWorkflow(id, roots) {
	safeId$1(id, "workflow id");
	for (const root of roots) {
		const candidate = resolve(root, id);
		try {
			await access(join(candidate, "workflow.yml"));
		} catch (error) {
			if (error.code === "ENOENT") continue;
			throw error;
		}
		const canonicalRoot = await realpath(root);
		const sourceDirectory = await realpath(candidate);
		const workflowPath = await realpath(join(sourceDirectory, "workflow.yml"));
		assertWithinRoot(canonicalRoot, sourceDirectory);
		assertWithinRoot(canonicalRoot, workflowPath);
		const definition = parseDocument(id, await readFile(workflowPath, "utf8"));
		const agents = await Promise.all(definition.agents.map(async (agent) => {
			const instructionsPath = await realpath(resolve(sourceDirectory, agent.instructions));
			assertWithinRoot(canonicalRoot, instructionsPath);
			const instructions = (await readFile(instructionsPath, "utf8")).trim();
			if (instructions === "") throw new Error(`agent "${agent.id}" instructions file must not be empty`);
			return {
				...agent,
				instructions
			};
		}));
		return {
			...definition,
			agents,
			sourceDirectory
		};
	}
	throw new Error(`workflow "${id}" was not found in: ${roots.map((root) => resolve(root)).join(", ") || "(no roots)"}`);
}
//#endregion
//#region lib/types/persistence/fold.js
/**
* Rebuild accepted state without promoting attempt results into checkpoints.
* @param events - Validated records in contiguous sequence order.
* @returns State at the last durable commit; an open attempt has an uncertain outcome.
*/
function foldJournal(events) {
	const first = events[0];
	if (first?.type !== "run-start") throw new Error("journal must begin with run-start");
	const start = first.data;
	if (start.workflowId !== start.resolvedWorkflowSnapshot.id) throw new Error("workflow snapshot identity differs");
	const stepIds = new Set(start.resolvedWorkflowSnapshot.steps.map((step) => step.id));
	let checkpoint = {
		cursor: 0,
		context: {},
		stories: null,
		retries: {},
		feedback: {},
		repair: null,
		blocked: null
	};
	let status = "queued";
	let prepared = false;
	let openAttempt = null;
	const childSessionIds = [];
	let workspaceDisposition = "present";
	let workspaceReason = "";
	let resumeGuidance = "";
	let retryGrant = 0;
	const checks = [];
	let artifacts = [];
	let terminal = false;
	let attemptEnded = false;
	let resumed = false;
	for (const event of events.slice(1)) {
		if (terminal && ![
			"workspace-disposition",
			"tail-recovered",
			"file-artifacts",
			"notification",
			"health"
		].includes(event.type) && !(status === "failed" && event.type === "run-resume")) throw new Error("journal contains execution after run settlement");
		switch (event.type) {
			case "run-start": throw new Error("journal has more than one run-start");
			case "run-dispatch":
				status = prepared ? "running" : "starting";
				break;
			case "run-queue":
				status = "queued";
				break;
			case "run-interrupt":
				status = "interrupted";
				workspaceReason = event.data.reason;
				break;
			case "tail-recovered": break;
			case "notification": break;
			case "health": break;
			case "workspace-ready":
				if (prepared) throw new Error("workspace was prepared more than once");
				prepared = true;
				status = "running";
				break;
			case "attempt-start":
				if (!prepared) throw new Error("child started before workspace readiness");
				if (openAttempt !== null && !attemptEnded && !resumed) throw new Error("child attempt overlaps an unsettled child");
				if (!stepIds.has(event.data.stepId)) throw new Error("child references an unknown step");
				if (childSessionIds.includes(event.data.childSessionId)) throw new Error("child identity reused");
				attemptEnded = false;
				resumed = false;
				openAttempt = event.data;
				childSessionIds.push(event.data.childSessionId);
				status = "running";
				break;
			case "attempt-end":
				if (openAttempt?.childSessionId !== event.data.childSessionId) throw new Error("child result has no matching attempt");
				if (attemptEnded) throw new Error("child result recorded twice");
				attemptEnded = true;
				break;
			case "check-evidence":
				if (openAttempt?.childSessionId !== event.data.childSessionId || openAttempt.stepId !== event.data.stepId) throw new Error("check evidence has no matching attempt");
				if (checks.some((check) => check.callId === event.data.callId)) throw new Error("check evidence identity reused");
				checks.push(event.data);
				break;
			case "checkpoint":
				if (event.data.cursor > start.resolvedWorkflowSnapshot.steps.length) throw new Error("checkpoint position exceeds workflow");
				if (!prepared) throw new Error("checkpoint precedes workspace readiness");
				const stories = event.data.stories;
				if (stories !== null && new Set(stories.map((story) => story.id)).size !== stories.length) throw new Error("checkpoint contains duplicate stories");
				if (event.data.repair !== null && (!stepIds.has(event.data.repair.targetId) || !stepIds.has(event.data.repair.sourceStepId))) throw new Error("checkpoint repair references an unknown step");
				for (const proof of Object.values(event.data.acceptedChecks ?? {})) if (proof.callIds.length === 0 || proof.callIds.some((id) => !checks.some((check) => check.callId === id && check.passed && check.candidate === proof.candidate && check.afterCandidate === proof.candidate))) throw new Error("accepted check has no committed matching execution");
				checkpoint = event.data;
				openAttempt = null;
				status = checkpoint.blocked === null ? "running" : "blocked";
				break;
			case "run-resume":
				if (status === "completed" || status === "cancelled" || workspaceDisposition === "cleaned") throw new Error("settled output cannot be resumed");
				if (status === "failed" && (event.data.retryGrant ?? 0) < 1) throw new Error("failed resume requires a retry budget grant");
				if (openAttempt !== null && event.data.guidance.trim() === "") throw new Error("uncertain attempt requires reconciliation guidance");
				terminal = false;
				retryGrant += event.data.retryGrant ?? 0;
				resumed = true;
				resumeGuidance = event.data.guidance;
				status = "queued";
				break;
			case "run-end":
				if (event.data.status === "completed" && (openAttempt !== null || checkpoint.cursor !== start.resolvedWorkflowSnapshot.steps.length)) throw new Error("completion precedes accepted workflow checkpoints");
				if (event.data.status === "completed") {
					const perStory = new Set(start.resolvedWorkflowSnapshot.steps.flatMap((step) => step.type === "loop" && step.verifyStep !== void 0 ? [step.verifyStep] : []));
					const proofs = start.resolvedWorkflowSnapshot.steps.filter((step) => step.requireChecks && !perStory.has(step.id) && step.type === "single").map((step) => checkpoint.acceptedChecks?.[step.id]);
					if (proofs.some((proof) => proof === void 0) || new Set(proofs.map((proof) => proof?.candidate)).size > 1) throw new Error("completion requires all final checks on the same candidate");
				}
				status = event.data.status;
				workspaceReason = event.data.reason;
				terminal = true;
				break;
			case "file-artifacts":
				artifacts = event.data.artifacts;
				break;
			case "workspace-disposition":
				workspaceDisposition = event.data.disposition;
				workspaceReason = event.data.reason;
		}
	}
	return {
		revision: events.length - 1,
		start,
		checkpoint,
		status,
		prepared,
		openAttempt,
		childSessionIds,
		updatedAt: events.findLast((event) => event.type !== "notification" && event.type !== "health")?.time ?? first.time,
		workspaceDisposition,
		workspaceReason,
		resumeGuidance,
		retryGrant,
		checks,
		artifacts
	};
}
//#endregion
//#region lib/types/persistence/journal.js
/** Serialized, flush-on-append journal with validation at the disk boundary. */
const id$1 = z$1.string().regex(/^af-[a-z0-9-]{1,64}$/);
const stringMap = z$1.record(z$1.string(), z$1.string());
const story = z$1.strictObject({
	id: z$1.string().min(1),
	title: z$1.string().min(1),
	description: z$1.string().min(1),
	acceptanceCriteria: z$1.array(z$1.string().min(1)).min(1),
	maxRetries: z$1.number().int().nonnegative(),
	status: z$1.enum([
		"pending",
		"done",
		"retry",
		"failed"
	]),
	retryCount: z$1.number().int().nonnegative(),
	feedback: z$1.string().optional()
});
const startSchema = z$1.strictObject({
	runId: id$1,
	requestId: z$1.string().min(1).max(128).optional(),
	number: z$1.number().int().positive().optional(),
	ownerSessionId: z$1.string().min(1),
	workflowId: z$1.string().min(1),
	task: z$1.string().min(1),
	baseCwd: z$1.string().min(1),
	workspaceKind: z$1.enum(["git", "files"]).optional(),
	fileInputs: z$1.array(z$1.strictObject({
		path: z$1.string(),
		sha256: z$1.string(),
		content: z$1.string()
	})).optional(),
	baseRevision: z$1.string(),
	workspace: z$1.string().min(1),
	branch: z$1.string(),
	provider: z$1.string().min(1),
	model: z$1.string().optional(),
	notificationUrl: z$1.string().url().optional(),
	githubReviewerTokenEnv: z$1.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(),
	executionPolicy: z$1.strictObject({
		maxAttempts: z$1.number().int().positive().max(1e4).optional(),
		timeoutSeconds: z$1.number().int().positive().max(2147483),
		maxStories: z$1.number().int().positive().max(100),
		maxStoryRetries: z$1.number().int().nonnegative().max(20),
		maxSummaryChars: z$1.number().int().positive().max(65536),
		cleanupCompleted: z$1.boolean(),
		cleanupCancelled: z$1.boolean()
	}).optional(),
	resolvedWorkflowSnapshot: z$1.unknown().transform(validateResolvedWorkflow)
});
const checkpoint = z$1.strictObject({
	cursor: z$1.number().int().nonnegative(),
	context: stringMap,
	stories: z$1.array(story).nullable(),
	retries: z$1.record(z$1.string(), z$1.number().int().nonnegative()),
	feedback: stringMap,
	repair: z$1.strictObject({
		targetId: z$1.string().min(1),
		sourceStepId: z$1.string().min(1)
	}).nullable(),
	acceptedChecks: z$1.record(z$1.string(), z$1.strictObject({
		candidate: z$1.string().regex(/^[a-f0-9]{64}$/),
		callIds: z$1.array(z$1.string())
	})).optional(),
	blocked: z$1.string().nullable()
});
const record = z$1.discriminatedUnion("type", [
	z$1.strictObject({
		type: z$1.literal("run-start"),
		data: startSchema
	}),
	z$1.strictObject({
		type: z$1.literal("run-dispatch"),
		data: z$1.strictObject({})
	}),
	z$1.strictObject({
		type: z$1.literal("run-queue"),
		data: z$1.strictObject({})
	}),
	z$1.strictObject({
		type: z$1.literal("run-interrupt"),
		data: z$1.strictObject({ reason: z$1.string() })
	}),
	z$1.strictObject({
		type: z$1.literal("tail-recovered"),
		data: z$1.strictObject({
			source: z$1.string(),
			sha256: z$1.string().regex(/^[a-f0-9]{64}$/),
			bytes: z$1.number().int().positive()
		})
	}),
	z$1.strictObject({
		type: z$1.literal("workspace-ready"),
		data: z$1.strictObject({})
	}),
	z$1.strictObject({
		type: z$1.literal("attempt-start"),
		data: z$1.strictObject({
			stepId: z$1.string().min(1),
			childSessionId: z$1.string().min(1),
			execution: z$1.enum([
				"single",
				"story",
				"verify",
				"repair"
			]),
			storyId: z$1.string().optional(),
			effect: z$1.enum(["pull-request", "github-review"]).optional(),
			candidate: z$1.string().regex(/^[a-f0-9]{64}$/).optional()
		})
	}),
	z$1.strictObject({
		type: z$1.literal("attempt-end"),
		data: z$1.strictObject({
			childSessionId: z$1.string().min(1),
			passed: z$1.boolean(),
			summary: z$1.string()
		})
	}),
	z$1.strictObject({
		type: z$1.literal("check-evidence"),
		data: z$1.strictObject({
			callId: z$1.string(),
			childSessionId: z$1.string(),
			stepId: z$1.string(),
			command: z$1.string(),
			cwd: z$1.string(),
			candidate: z$1.string(),
			afterCandidate: z$1.string(),
			passed: z$1.boolean(),
			exitCode: z$1.number().int().nullable(),
			stdout: z$1.string(),
			stderr: z$1.string()
		})
	}),
	z$1.strictObject({
		type: z$1.literal("checkpoint"),
		data: checkpoint
	}),
	z$1.strictObject({
		type: z$1.literal("run-resume"),
		data: z$1.strictObject({
			guidance: z$1.string(),
			retryGrant: z$1.number().int().nonnegative().max(20).optional()
		})
	}),
	z$1.strictObject({
		type: z$1.literal("run-end"),
		data: z$1.strictObject({
			status: z$1.enum([
				"completed",
				"failed",
				"cancelled"
			]),
			reason: z$1.string()
		})
	}),
	z$1.strictObject({
		type: z$1.literal("file-artifacts"),
		data: z$1.strictObject({
			candidate: z$1.string(),
			artifacts: z$1.array(z$1.strictObject({
				path: z$1.string(),
				sha256: z$1.string(),
				bytes: z$1.number().int().nonnegative()
			}))
		})
	}),
	z$1.strictObject({
		type: z$1.literal("notification"),
		data: z$1.strictObject({
			id: z$1.string(),
			channel: z$1.enum(["owner", "webhook"]),
			status: z$1.enum([
				"pending",
				"delivered",
				"failed"
			]),
			detail: z$1.string().max(2048)
		})
	}),
	z$1.strictObject({
		type: z$1.literal("health"),
		data: z$1.strictObject({
			kind: z$1.string(),
			detail: z$1.string().max(2048)
		})
	}),
	z$1.strictObject({
		type: z$1.literal("workspace-disposition"),
		data: z$1.strictObject({
			disposition: z$1.enum(["retained", "cleaned"]),
			reason: z$1.string()
		})
	})
]);
const envelope = z$1.object({
	version: z$1.literal(3),
	seq: z$1.number().int().nonnegative(),
	time: z$1.number().int().nonnegative()
});
const identity = z$1.object({
	runId: id$1,
	number: z$1.number().int().positive().optional(),
	ownerSessionId: z$1.string().min(1),
	workflowId: z$1.string().min(1),
	workspace: z$1.string(),
	branch: z$1.string()
});
/**
* Read a journal's first identity without interpreting old business state.
* @param root - Configured journal root.
* @param runId - Safe run directory identifier.
* @returns Validated attribution and the recorded format version.
*/
async function readJournalIdentity(root, runId) {
	id$1.parse(runId);
	const directory = join(await realpath(root), runId);
	if (await realpath(directory) !== directory) throw new Error("journal directory resolves outside its recorded path");
	const path = join(directory, "events.jsonl");
	if (await realpath(path) !== path) throw new Error("journal identity file must not be a symbolic link");
	const file = await open(path, "r");
	let source = "";
	const decoder = new StringDecoder("utf8");
	try {
		const buffer = Buffer.alloc(65536);
		while (!source.includes("\n")) {
			const { bytesRead } = await file.read(buffer);
			if (bytesRead === 0) break;
			source += decoder.write(buffer.subarray(0, bytesRead));
			if (Buffer.byteLength(source) > 4194304) throw new Error("journal identity exceeds the supported size");
		}
	} finally {
		await file.close();
	}
	const first = z$1.object({
		version: z$1.number(),
		data: identity
	}).parse(JSON.parse(source.split("\n", 1)[0] ?? ""));
	if (first.data.runId !== runId) throw new Error("journal identity differs from its directory");
	return first;
}
/** A single writer owns committed state; readers never observe unflushed changes. */
var RunJournal = class RunJournal {
	eventsPath;
	events;
	writing = Promise.resolve();
	committed;
	constructor(eventsPath, events) {
		this.eventsPath = eventsPath;
		this.events = events;
		if (events.length > 0) this.committed = foldJournal(events);
	}
	/** Revision of the last committed event; used to reject stale UI actions. */
	get revision() {
		return this.events.length - 1;
	}
	/** Original start time of the unsettled native attempt; diagnostics do not renew its deadline. */
	get attemptTime() {
		return this.events.findLast((event) => event.type === "attempt-start")?.time;
	}
	/** @param type - Committed fact kind. @returns Last matching event without scanning through a Remote. */
	latest(type) {
		return this.events.findLast((event) => event.type === type);
	}
	/** @param id - Stable notice identity. @param channel - Destination channel. @returns Whether durable delivery was already confirmed. */
	delivered(id, channel) {
		return this.events.some((event) => event.type === "notification" && event.data.id === id && event.data.channel === channel && event.data.status === "delivered");
	}
	/** @param after - Exclusive event cursor. @param limit - Maximum records. @returns Committed event page. */
	records(after, limit) {
		if (!Number.isInteger(after) || after < -1 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("invalid event page");
		return this.events.slice(after + 1, after + 1 + limit);
	}
	/** Last successfully flushed reducer result. */
	get state() {
		if (this.committed === void 0) throw new Error("Run start has not committed");
		return this.committed;
	}
	/**
	* Create a unique journal and persist its start before accepting work.
	* @param root - Configured storage directory.
	* @param start - Validated resolved execution inputs.
	* @returns Sole writer for the new run.
	*/
	static async create(root, start) {
		startSchema.parse(start);
		await mkdir(resolve(root), { recursive: true });
		const directory = join(await realpath(root), start.runId);
		await mkdir(directory);
		const journal = new RunJournal(join(directory, "events.jsonl"), []);
		await journal.append({
			type: "run-start",
			data: start
		});
		return journal;
	}
	/**
	* Open version 3 evidence without modifying its bytes.
	* @param root - Configured storage directory.
	* @param runId - Safe run identity.
	* @returns Writer; unsupported, truncated, or corrupt evidence rejects.
	*/
	static async open(root, runId) {
		id$1.parse(runId);
		const directory = join(await realpath(root), runId);
		if (await realpath(directory) !== directory) throw new Error("journal directory resolves outside its recorded path");
		const path = join(directory, "events.jsonl");
		if (await realpath(path) !== path) throw new Error("journal file resolves outside its recorded path");
		const source = await readFile(path, "utf8");
		if (!source.endsWith("\n")) throw new Error("journal has an incomplete final record; retain evidence before recovery");
		const events = source.slice(0, -1).split("\n").map((line, seq) => {
			const value = JSON.parse(line);
			const meta = envelope.parse(value);
			if (meta.seq !== seq) throw new Error("journal has a sequence gap");
			const payload = z$1.object({
				type: z$1.string(),
				data: z$1.unknown()
			}).parse(value);
			return {
				...record.parse(payload),
				...meta
			};
		});
		const journal = new RunJournal(join(directory, "events.jsonl"), events);
		if (journal.state.start.runId !== runId) throw new Error("journal identity differs from its directory");
		return journal;
	}
	/**
	* Recover only an incomplete final write under the storage-root writer lock.
	* @param root - Owned storage root.
	* @param runId - Run whose complete prefix will be validated.
	* @returns Recovered journal with a retained, hashed source receipt.
	*/
	static async recoverTail(root, runId) {
		if ((await readJournalIdentity(root, runId)).version !== 3) throw new Error("only version 3 torn tails can be recovered");
		const directory = join(await realpath(root), id$1.parse(runId));
		const path = join(directory, "events.jsonl");
		if (await realpath(path) !== path) throw new Error("journal file must not be a symbolic link");
		const bytes = await readFile(path);
		if (bytes.at(-1) === 10) return RunJournal.open(root, runId);
		const last = bytes.lastIndexOf(10);
		if (last < 0) throw new Error("journal has no proven complete prefix");
		const prefix = bytes.subarray(0, last + 1);
		const events = prefix.toString("utf8").trimEnd().split("\n").map((line, seq) => {
			const value = JSON.parse(line);
			const meta = envelope.parse(value);
			if (meta.seq !== seq) throw new Error("journal has a sequence gap");
			return {
				...record.parse(z$1.object({
					type: z$1.string(),
					data: z$1.unknown()
				}).parse(value)),
				...meta
			};
		});
		if (new RunJournal(path, events).state.start.runId !== runId) throw new Error("journal identity differs");
		const source = `events.torn-${randomUUID()}.jsonl`;
		const temporary = join(directory, `events.recovered-${randomUUID()}.tmp`);
		const receipt = {
			type: "tail-recovered",
			data: {
				source,
				sha256: createHash("sha256").update(bytes).digest("hex"),
				bytes: bytes.length
			},
			version: 3,
			seq: events.length,
			time: Date.now()
		};
		foldJournal([...events, receipt]);
		const recoveredBytes = Buffer.concat([prefix, Buffer.from(`${JSON.stringify(receipt)}\n`)]);
		for (const [target, content] of [[join(directory, source), bytes], [temporary, recoveredBytes]]) {
			const file = await open(target, "wx", 384);
			try {
				await file.writeFile(content);
				await file.sync();
			} finally {
				await file.close();
			}
		}
		await syncDirectory(directory);
		await rename(temporary, path);
		await syncDirectory(directory);
		return new RunJournal(path, [...events, receipt]);
	}
	/**
	* Serialize and flush one complete state transition.
	* @param value - Business checkpoint or execution fact.
	* @returns Completion after the write and reducer commit; failure poisons this writer.
	*/
	append(value) {
		const operation = this.writing.then(async () => {
			const event = {
				...record.parse(value),
				version: 3,
				seq: this.events.length,
				time: Date.now()
			};
			const next = [...this.events, event];
			const state = foldJournal(next);
			const file = await open(this.eventsPath, "a");
			try {
				await file.writeFile(`${JSON.stringify(event)}\n`);
				await file.sync();
			} finally {
				await file.close();
			}
			if (event.seq === 0) {
				await syncDirectory(resolve(this.eventsPath, ".."));
				await syncDirectory(resolve(this.eventsPath, "../.."));
			}
			this.events = next;
			this.committed = state;
		});
		this.writing = operation;
		return operation;
	}
};
async function syncDirectory(path) {
	const file = await open(path, "r");
	try {
		await file.sync();
	} finally {
		await file.close();
	}
}
//#endregion
//#region lib/types/workflow/original.js
/** Import original Antfarm documents into the native fresh-attempt runtime. */
const id = z$1.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const failure = z$1.strictObject({
	retry_step: id.optional(),
	max_retries: z$1.number().int().nonnegative().optional(),
	on_exhausted: z$1.strictObject({ escalate_to: z$1.literal("human").optional() }).optional(),
	escalate_to: z$1.literal("human").optional()
});
const schema = z$1.strictObject({
	id,
	name: z$1.string().optional(),
	version: z$1.number().int().positive().optional(),
	description: z$1.string().optional(),
	polling: z$1.strictObject({
		model: z$1.string().optional(),
		timeoutSeconds: z$1.number().int().positive().optional()
	}).optional(),
	cron: z$1.strictObject({ interval_ms: z$1.number().int().positive() }).optional(),
	context: z$1.record(z$1.string(), z$1.string()).optional(),
	notifications: z$1.strictObject({ url: z$1.string().url().transform(publicWebhookUrl).optional() }).optional(),
	agents: z$1.array(z$1.strictObject({
		id,
		name: z$1.string().optional(),
		description: z$1.string().optional(),
		role: z$1.enum([
			"analysis",
			"coding",
			"verification",
			"testing",
			"pr",
			"scanning"
		]).default("coding"),
		model: z$1.string().optional(),
		pollingModel: z$1.string().optional(),
		timeoutSeconds: z$1.number().int().positive().max(2147483).optional(),
		workspace: z$1.strictObject({
			baseDir: z$1.string().min(1),
			files: z$1.record(z$1.string(), z$1.string().min(1)),
			skills: z$1.array(z$1.string().min(1)).optional()
		})
	})).min(1),
	steps: z$1.array(z$1.strictObject({
		id,
		agent: id,
		type: z$1.enum(["single", "loop"]).optional(),
		input: z$1.string().min(1),
		expects: z$1.string().min(1),
		max_retries: z$1.number().int().nonnegative().optional(),
		on_fail: failure.optional(),
		loop: z$1.strictObject({
			over: z$1.literal("stories"),
			completion: z$1.literal("all_done"),
			fresh_session: z$1.boolean().optional(),
			freshSession: z$1.boolean().optional(),
			verify_each: z$1.boolean().optional(),
			verify_step: id.optional()
		}).optional()
	})).min(1)
});
/**
* Load all role files under an explicitly selected source root; no package writes occur.
* @param document - Original workflow YAML.
* @param directory - Directory containing that document.
* @param sourceRoot - Explicit import root containing shared role resources.
* @returns Resolved snapshot preserving original metadata and declared verdicts.
*/
async function importOriginalWorkflow(document, directory, sourceRoot, workspace = "git") {
	const original = schema.parse(parse(document));
	const root = await realpath(sourceRoot);
	const sourceDirectory = await realpath(directory);
	const confined = async (path) => {
		const canonical = await realpath(path);
		const rel = relative(root, canonical);
		if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("original workflow resource escapes its selected source root");
		return canonical;
	};
	await confined(sourceDirectory);
	const agents = await Promise.all(original.agents.map(async (agent) => {
		if (isAbsolute(agent.workspace.baseDir) || agent.workspace.baseDir.split(/[\\/]/).includes("..")) throw new Error("original role workspace must be a relative child directory");
		const files = await Promise.all(Object.entries(agent.workspace.files).map(async ([name, source]) => {
			if (isAbsolute(name) || name.split(/[\\/]/).includes("..")) throw new Error("original role file name must remain within its workspace");
			const content = await readFile(await confined(resolve(sourceDirectory, source)), "utf8");
			if (Buffer.byteLength(content) > 65536) throw new Error("original role file exceeds 64 KiB");
			return `## ${name}\n${content.trim()}`;
		}));
		const model = agent.model ?? original.polling?.model;
		const preset = agent.role === "coding" ? "antfarm-coding" : agent.role === "analysis" ? "antfarm-analysis" : `antfarm-${agent.role}`;
		return {
			id: agent.id,
			name: agent.name ?? agent.id,
			preset,
			instructions: files.join("\n\n"),
			role: agent.role,
			skills: agent.workspace.skills ?? [],
			...agent.description === void 0 ? {} : { description: agent.description },
			...model === void 0 || model === "default" ? {} : { model },
			timeoutSeconds: agent.timeoutSeconds ?? (agent.role === "coding" || agent.role === "testing" ? 1800 : 1200)
		};
	}));
	const steps = original.steps.map((step) => {
		const fail = step.on_fail;
		const onFail = fail === void 0 ? void 0 : {
			...fail.retry_step === void 0 ? {} : { retryStep: fail.retry_step },
			maxRetries: fail.max_retries ?? 2,
			onExhausted: fail.escalate_to === "human" || fail.on_exhausted?.escalate_to === "human" ? { escalateTo: "human" } : {}
		};
		const common = {
			id: step.id,
			agent: step.agent,
			input: step.input,
			expects: step.expects,
			maxRetries: step.max_retries ?? fail?.max_retries ?? 2,
			...onFail === void 0 ? {} : { onFail }
		};
		if (step.type !== "loop") return {
			...common,
			type: "single",
			output: /\bSTORIES_JSON\s*:/i.test(step.input) ? "stories" : "result"
		};
		if (step.loop === void 0) throw new Error("original loop step requires its loop configuration");
		return {
			...common,
			type: "loop",
			over: "stories",
			completion: "all_done",
			freshSession: true,
			verifyEach: step.loop.verify_each ?? false,
			...step.loop.verify_step === void 0 ? {} : { verifyStep: step.loop.verify_step },
			repairInput: "Repair the retained candidate for {{task}}.\nFailures: {{issues}}\nAccepted work: {{stories_summary}}"
		};
	});
	return {
		id: original.id,
		name: original.name ?? original.id,
		version: 2,
		sourceDirectory,
		agents,
		steps,
		workspace,
		...original.description === void 0 ? {} : { description: original.description },
		context: original.context ?? {},
		source: {
			format: "snarktank-antfarm",
			version: original.version ?? 1,
			polling: original.polling ?? {},
			cron: original.cron ?? {},
			notifications: original.notifications ?? {}
		}
	};
}
//#endregion
//#region lib/types/workflow/manager.js
/** Validated, revision-checked workflow copies in writable user roots. */
const safeId = (id) => {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("workflow id must be kebab-case");
	return id;
};
function child(root, name) {
	const target = resolve(root, name);
	const rel = relative(root, target);
	if (isAbsolute(rel) || rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("workflow file must be a child of its writable directory");
	return target;
}
/** @param cwd - Canonical project input root. @returns Project registry path confined through existing ancestors. */
async function projectWorkflowRoot(cwd) {
	const root = await realpath(cwd);
	const target = join(root, ".antfarm/workflows");
	let ancestor = target;
	while (ancestor !== root) try {
		child(root, await realpath(ancestor));
		return target;
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
		ancestor = dirname(ancestor);
	}
	return target;
}
function draft(workflow) {
	const { sourceDirectory, ...definition } = workflow;
	const files = Object.fromEntries(workflow.agents.map((agent) => [`agents/${agent.id}.md`, agent.instructions]));
	const document = stringify({
		...definition,
		agents: workflow.agents.map((agent) => ({
			...agent,
			instructions: `agents/${agent.id}.md`
		}))
	});
	const revision = createHash("sha256").update(JSON.stringify({
		document,
		files
	})).digest("hex");
	return {
		id: workflow.id,
		document,
		files,
		revision,
		sourceDirectory
	};
}
/** A single Host serializes workflow effects while Run snapshots remain immutable. */
var WorkflowManager = class {
	packageRoot;
	writing = Promise.resolve();
	/** @param packageRoot - Last-precedence read-only workflow root. */
	constructor(packageRoot) {
		this.packageRoot = packageRoot;
	}
	/** @param roots - Roots in precedence order. @returns Discoverable workflow ids. */
	async list(roots) {
		const ids = /* @__PURE__ */ new Set();
		for (const root of [...roots, this.packageRoot]) {
			let entries;
			try {
				entries = await readdir(root, { withFileTypes: true });
			} catch (error) {
				if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
				throw error;
			}
			for (const entry of entries) if (entry.isDirectory() && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) try {
				await lstat(join(root, entry.name, "workflow.yml"));
				ids.add(entry.name);
			} catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
			}
		}
		return [...ids].sort();
	}
	/** @param id - Selected workflow. @param roots - User roots. @returns Validated editable copy. */
	async read(id, roots) {
		return {
			...draft(await loadWorkflow(safeId(id), [...roots, this.packageRoot])),
			enabled: await this.enabled(id, roots)
		};
	}
	/** @param id - Workflow identity. @param roots - Explicit user roots. @returns Enablement from owned marker files. */
	async enabled(id, roots) {
		for (const root of roots) {
			const path = join(root, ".disabled", safeId(id));
			try {
				const marker = await lstat(path);
				if (!marker.isFile() || marker.isSymbolicLink()) throw new Error("workflow enablement marker must be a regular file");
				return false;
			} catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
			}
		}
		return true;
	}
	/** @param id - Workflow identity. @param roots - Source roots. @param enabled - Desired state. @param expected - Previously observed state. */
	setEnabled(id, roots, enabled, expected, revision) {
		return this.serialize(async () => {
			const current = await this.read(id, roots);
			if (revision !== void 0 && current.revision !== revision) throw new Error("workflow source changed; reload before applying this operation");
			if (await this.enabled(id, roots) !== expected) throw new Error("workflow enablement changed; reload before applying this operation");
			if (enabled === expected) return;
			const root = roots[0];
			if (root === void 0) throw new Error("no writable workflow registry root");
			await mkdir(root, { recursive: true });
			const canonical = await realpath(root);
			const directory = join(canonical, ".disabled");
			await mkdir(directory, { recursive: true });
			if (await realpath(directory) !== directory) throw new Error("workflow enablement directory must not be a symbolic link");
			const marker = join(directory, safeId(id));
			if (enabled) {
				await rm(marker, { force: true });
				if (!await this.enabled(id, roots)) throw new Error("workflow is disabled by a profile marker; enable it in that scope");
			} else await writeFile(marker, "disabled\n", {
				flag: "wx",
				mode: 384
			});
		});
	}
	/** @param source - Revision-bound source. @param newId - New workflow id. @param roots - Effective roots. @param root - Destination. @returns New validated copy. */
	copy(source, newId, roots, root) {
		return this.serialize(async () => {
			if ((await this.read(source.id, roots)).revision !== source.revision) throw new Error("workflow changed; reload before copying it");
			if ((await this.list(roots)).includes(safeId(newId))) throw new Error("workflow id already exists");
			const definition = parse(source.document);
			if (definition === null || typeof definition !== "object" || Array.isArray(definition)) throw new Error("workflow copy requires an object definition");
			return this.install(newId, stringify({
				...definition,
				id: newId
			}), source.files, root, true);
		});
	}
	/**
	* Save a self-contained copy with an atomic definition replacement after validating references and source revision.
	* @param value - Draft contents; the revision must match the currently inherited source.
	* @param root - Authorized writable root, never the package root.
	* @param roots - Current effective roots in precedence order.
	* @returns Saved draft with its new revision.
	*/
	save(value, root, roots) {
		return this.serialize(async () => {
			const current = await this.read(value.id, roots);
			if (current.revision !== value.revision) throw new Error("workflow changed; reload before saving your draft");
			try {
				await lstat(join(root, value.id, "workflow.yml"));
				if ((await this.read(value.id, [root])).sourceDirectory !== current.sourceDirectory) throw new Error("another workflow copy exists at this save location; open that source before replacing it");
			} catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
			}
			return this.install(value.id, value.document, value.files, root);
		});
	}
	/**
	* Import original resources into a new writable workflow; an existing id refuses.
	* @param directory - Original workflow directory.
	* @param sourceRoot - Explicit root containing its shared files.
	* @param root - Authorized destination.
	* @returns Self-contained native workflow copy.
	*/
	import(directory, sourceRoot, root, workspace = "git") {
		return this.serialize(async () => {
			const canonical = await realpath(directory);
			const path = await realpath(join(canonical, "workflow.yml"));
			if (path !== join(canonical, "workflow.yml")) throw new Error("import document must not be a symbolic link");
			const workflow = validateResolvedWorkflow(await importOriginalWorkflow(await readFile(path, "utf8"), canonical, sourceRoot, workspace));
			const target = join(root, safeId(workflow.id));
			try {
				await lstat(target);
				throw new Error("workflow already exists; edit or select another writable root");
			} catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
			}
			const value = draft(workflow);
			return this.install(value.id, value.document, value.files, root, true);
		});
	}
	/** @param id - Override to remove. @param root - Writable root. @param revision - Saved revision. */
	remove(id, root, revision) {
		return this.serialize(async () => {
			const value = await this.read(id, [root]);
			const canonical = await realpath(root);
			if (value.sourceDirectory !== join(canonical, safeId(id))) throw new Error("there is no writable override to remove");
			if (value.revision !== revision) throw new Error("workflow changed; reload before removing it");
			await rm(value.sourceDirectory, { recursive: true });
		});
	}
	serialize(work) {
		const result = this.writing.then(work);
		this.writing = result.then(() => {}, () => {});
		return result;
	}
	async install(id, document, files, root, newOnly = false) {
		if (Buffer.byteLength(document) > 65536 || Object.keys(files).length > 100 || Object.values(files).reduce((bytes, file) => bytes + Buffer.byteLength(file), 0) > 1048576) throw new Error("workflow copy exceeds its resource limit");
		await mkdir(root, { recursive: true });
		const canonical = await realpath(root);
		if (canonical === await realpath(this.packageRoot)) throw new Error("packaged workflows are read-only");
		const target = join(canonical, safeId(id));
		const temporaryRoot = join(canonical, `.draft-${randomUUID()}`);
		const temporary = join(temporaryRoot, id);
		await mkdir(temporary, { recursive: true });
		try {
			await writeFile(join(temporary, "workflow.yml"), document, {
				flag: "wx",
				mode: 384
			});
			for (const [name, content] of Object.entries(files)) {
				const path = child(temporary, name);
				await mkdir(dirname(path), { recursive: true });
				await writeFile(path, content, {
					flag: "wx",
					mode: 384
				});
			}
			const workflow = await loadWorkflow(id, [temporaryRoot]);
			try {
				const stat = await lstat(target);
				if (newOnly) throw new Error("workflow id already exists");
				if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("workflow override must be a real directory");
			} catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
				await mkdir(target);
			}
			const revisions = join(target, ".revisions");
			await mkdir(revisions, { recursive: true });
			if (await realpath(revisions) !== revisions) throw new Error("workflow revisions directory must not be a symbolic link");
			const revisionDirectory = join(revisions, randomUUID());
			await mkdir(revisionDirectory);
			const relativeRevision = relative(target, revisionDirectory);
			for (const agent of workflow.agents) await writeFile(join(revisionDirectory, `${agent.id}.md`), agent.instructions, {
				flag: "wx",
				mode: 384
			});
			const { sourceDirectory: _source, ...definition } = workflow;
			const canonicalDocument = stringify({
				...definition,
				agents: workflow.agents.map((agent) => ({
					...agent,
					instructions: `${relativeRevision}/${agent.id}.md`
				}))
			});
			const pending = join(target, `.workflow-${randomUUID()}.tmp`);
			await writeFile(pending, canonicalDocument, {
				flag: "wx",
				mode: 384
			});
			try {
				await rename(pending, join(target, "workflow.yml"));
			} finally {
				await rm(pending, { force: true });
			}
			return draft(await loadWorkflow(id, [canonical]));
		} finally {
			await rm(temporaryRoot, {
				recursive: true,
				force: true
			});
		}
	}
};
//#endregion
//#region lib/types/runtime/visual.js
/** Candidate diff detection and immutable screenshot retention for frontend checks. */
const extensions = /* @__PURE__ */ new Set([
	".html",
	".css",
	".scss",
	".less",
	".jsx",
	".tsx",
	".vue",
	".svelte"
]);
const directories = [
	"public/",
	"static/",
	"assets/",
	"components/",
	"pages/",
	"views/",
	"styles/"
];
/** @param files - Actual changed paths. @returns Frontend paths, excluding test files. */
function frontendPaths(files) {
	return files.filter((file) => ![
		".test.",
		".spec.",
		"__tests__/"
	].some((pattern) => file.includes(pattern)) && (extensions.has(extname(file).toLowerCase()) || directories.some((directory) => file.replaceAll("\\", "/").includes(`/${directory}`) || file.startsWith(directory))));
}
/** @param subprocess - Native provider. @param start - Owned Git candidate. @param signal - Run lifetime. @returns Diff paths with frontend effects. */
async function changedFrontendPaths(subprocess, start, signal) {
	if (start.workspaceKind === "files") return [];
	const result = await runGit(subprocess, start.workspace, [
		"diff",
		"--name-only",
		"-z",
		start.baseRevision,
		"--"
	], signal);
	if (result.exitCode !== 0) throw new Error("frontend candidate diff could not be inspected");
	return frontendPaths(result.stdout.split("\0").filter(Boolean));
}
/** @param workspace - Owned candidate. @param paths - Claimed screenshots. @param records - Native browser commands. @param candidate - Checked version. @param destination - Private artifacts. @returns Retained image references. */
async function retainScreenshots(workspace, paths, records, candidate, destination) {
	if (paths.length === 0 || paths.length > 10 || !records.some((record) => record.passed && record.candidate === candidate && record.afterCandidate === candidate && /^(?:pnpm exec |npx )?(?:playwright|puppeteer|cypress|ego-browser)\b/.test(record.command))) throw new Error("frontend acceptance requires successful native browser execution and one to ten screenshots");
	await mkdir(destination, { recursive: true });
	const artifacts = [];
	for (const path of paths) {
		if (isAbsolute(path)) throw new Error("screenshot path must be relative to the owned workspace");
		const source = await realpath(resolve(workspace, path));
		const rel = relative(workspace, source);
		if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("screenshot escapes the owned workspace");
		const bytes = await readFile(source);
		if (bytes.length > 16777216 || !(bytes.subarray(0, 8).equals(Buffer.from([
			137,
			80,
			78,
			71,
			13,
			10,
			26,
			10
		])) || bytes.subarray(0, 3).equals(Buffer.from([
			255,
			216,
			255
		])))) throw new Error("screenshot must be a PNG or JPEG of at most 16 MiB");
		const sha256 = createHash("sha256").update(bytes).digest("hex");
		let file;
		try {
			file = await open(join(destination, sha256), "wx", 256);
		} catch (error) {
			if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
			if (!bytes.equals(await readFile(join(destination, sha256)))) throw new Error("retained screenshot integrity differs");
		}
		if (file !== void 0) try {
			await file.writeFile(bytes);
			await file.sync();
		} finally {
			await file.close();
		}
		artifacts.push({
			path,
			sha256,
			bytes: bytes.length
		});
	}
	return artifacts;
}
//#endregion
//#region lib/types/runtime/orchestrator.js
/** Serial activation driver; only complete checkpoints accept business output. */
function outputSchema(planning, spec) {
	const text = {
		type: "string",
		description: `Nonempty text, at most ${spec.maxSummaryChars} characters.`
	};
	return {
		type: "object",
		additionalProperties: false,
		required: planning ? [
			"passed",
			"summary",
			"stories"
		] : ["passed", "summary"],
		properties: {
			passed: {
				type: "boolean",
				description: planning ? "Whether repository analysis and the implementation plan are complete. Implementation, tests and delivery happen in later steps and need not be complete now." : "Whether the work assigned to this step is complete and its required checks passed."
			},
			blocked: {
				type: "boolean",
				description: "Set true when credentials, browser capability or a human decision is required for this step to proceed."
			},
			summary: text,
			screenshots: {
				type: "array",
				items: { type: "string" },
				description: "Relative PNG/JPEG screenshot paths from your successful native browser command when frontend checking is required."
			},
			checks: {
				type: "array",
				description: "For each acceptance criterion, cite the Antfarm execution reference from a successful bash result as call_id. Alternatively supply the complete command verbatim, including every line. One execution may cover several criteria.",
				items: {
					type: "object",
					additionalProperties: false,
					required: ["criterion"],
					properties: {
						call_id: {
							type: "string",
							description: "Antfarm execution reference from a successful bash result. Supply this or the complete command."
						},
						criterion: {
							...text,
							description: "Copy a supplied acceptance criterion verbatim. If no criteria were supplied, describe the checked condition."
						},
						command: text
					}
				}
			},
			values: {
				type: "array",
				items: {
					type: "object",
					additionalProperties: false,
					required: ["key", "value"],
					properties: {
						key: { type: "string" },
						value: text
					}
				},
				description: "Named KEY values requested by the step, with unique lowercase keys. Include status and verdict fields when declared."
			},
			...planning ? { stories: {
				type: "array",
				description: `At most ${spec.maxStories} unique implementation stories; an empty list is allowed. Keep descriptions and criteria about implementation behavior and tests. Independent verification, PR delivery and review belong to separate workflow steps, not story work or criteria.`,
				items: {
					type: "object",
					additionalProperties: false,
					required: [
						"id",
						"title",
						"description",
						"acceptanceCriteria",
						"maxRetries"
					],
					properties: {
						id: {
							type: "string",
							description: "Unique alphanumeric id with dots, underscores or hyphens, at most 100 characters."
						},
						title: text,
						description: text,
						acceptanceCriteria: {
							type: "array",
							description: "One to twenty nonempty acceptance criteria.",
							items: text
						},
						maxRetries: {
							type: "integer",
							description: `Retry limit between zero and ${spec.maxStoryRetries}.`
						}
					}
				}
			} } : {}
		}
	};
}
function parseOutput(value, planning, spec) {
	const text = z$1.string().trim().min(1).max(spec.maxSummaryChars);
	const base = z$1.strictObject({
		passed: z$1.boolean(),
		blocked: z$1.boolean().optional(),
		summary: text,
		screenshots: z$1.array(z$1.string().min(1)).max(10).optional(),
		checks: z$1.array(z$1.strictObject({
			criterion: text,
			command: text.optional(),
			call_id: z$1.string().min(1).max(256).optional()
		}).refine((check) => check.command !== void 0 || check.call_id !== void 0, "check requires an execution reference or complete command").transform(({ call_id, ...check }) => ({
			...check,
			...call_id === void 0 ? {} : { callId: call_id }
		}))).max(200).optional(),
		values: z$1.array(z$1.strictObject({
			key: z$1.string().regex(/^[a-z][a-z0-9_]*$/),
			value: text
		})).max(100).refine((rows) => new Set(rows.map((row) => row.key)).size === rows.length, "duplicate handoff keys").transform((rows) => Object.fromEntries(rows.map((row) => [row.key, row.value]))).optional()
	});
	if (!planning) return base.parse(value);
	const result = base.extend({ stories: z$1.array(z$1.strictObject({
		id: z$1.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/).max(100),
		title: text,
		description: text,
		acceptanceCriteria: z$1.array(text).min(1).max(20),
		maxRetries: z$1.number().int().min(0).max(spec.maxStoryRetries)
	})).max(spec.maxStories) }).parse(value);
	if (new Set(result.stories.map((story) => story.id)).size !== result.stories.length) throw new Error("planner returned duplicate story ids");
	return result;
}
function errorText(error, limit) {
	return (error instanceof Error ? error.message : String(error)).slice(0, limit);
}
function deadline(parent, seconds) {
	parent.throwIfAborted();
	const timer = new AbortController();
	const handle = setTimeout(() => timer.abort(/* @__PURE__ */ new Error("step deadline exceeded")), seconds * 1e3);
	return {
		signal: AbortSignal.any([parent, timer.signal]),
		dispose: () => clearTimeout(handle)
	};
}
/**
* Execute an admitted workflow and settle only after child and workspace teardown.
* @param dependencies - Host child and process execution services.
* @param spec - The sole driver's journal, authority, and cancellation lifetime.
* @returns Job outcome; blocked runs end their job while retaining resumable checkpoints.
*/
async function runWorkflow(dependencies, spec) {
	const { journal } = spec;
	const start = journal.state.start;
	const workflow = start.resolvedWorkflowSnapshot;
	const write = async (record) => {
		await journal.append(record);
		const revision = journal.revision;
		spec.onChange();
		await dependencies.onEvent?.(record, revision);
	};
	const commit = (checkpoint) => write({
		type: "checkpoint",
		data: checkpoint
	});
	const contextFor = (extra = {}) => ({
		...workflow.context,
		...journal.state.checkpoint.context,
		task: start.task,
		repo: start.workspace,
		completed_stories: JSON.stringify((journal.state.checkpoint.stories ?? []).filter((story) => story.status === "done")),
		stories_remaining: String((journal.state.checkpoint.stories ?? []).filter((story) => story.status !== "done").length),
		progress: JSON.stringify(journal.state.checkpoint.context),
		branch: start.branch,
		workspace: start.workspace,
		resume_guidance: journal.state.resumeGuidance,
		current_story: "",
		verify_feedback: "",
		changes: journal.state.checkpoint.context["changes"] ?? JSON.stringify((journal.state.checkpoint.stories ?? []).filter((story) => story.status === "done")),
		issues: "",
		stories_summary: JSON.stringify(journal.state.checkpoint.stories ?? []),
		results: JSON.stringify(journal.state.checkpoint.context),
		...extra
	});
	const agentFor = (step) => {
		const agent = workflow.agents.find((candidate) => candidate.id === step.agent);
		if (agent === void 0) throw new Error(`step ${step.id} has no agent`);
		return agent;
	};
	const child = async (step, execution, extra = {}, storyId, input = step.input) => {
		spec.signal.throwIfAborted();
		if (journal.state.childSessionIds.length >= (spec.maxAttempts ?? 500) + journal.state.retryGrant) throw new Error("total native attempt budget exhausted; grant recovery budget after inspecting this Run");
		const agent = agentFor(step);
		const guidance = journal.state.resumeGuidance;
		const frontend = step.type === "single" && step.requireVisuals ? await changedFrontendPaths(dependencies.subprocess, start, spec.signal) : [];
		const criteria = storyId === void 0 ? (journal.state.checkpoint.stories ?? []).flatMap((story) => story.acceptanceCriteria) : journal.state.checkpoint.stories?.find((story) => story.id === storyId)?.acceptanceCriteria ?? [];
		const reviewCredentials = step.type === "single" && step.effect === "github-review" && start.githubReviewerTokenEnv !== void 0 ? `For gh review commands, set GH_TOKEN from the existing environment variable ${start.githubReviewerTokenEnv} only for that command. Never print the credential or change global accounts.\n` : "";
		const workspaceInstructions = start.workspaceKind === "files" ? "Use the supplied owned file workspace and its immutable inputs." : "Use the supplied owned workspace and branch; they are already created.";
		const retryFeedback = execution === "single" ? journal.state.checkpoint.feedback[step.id] ?? "" : "";
		const prompt = `${reviewCredentials}${frontend.length === 0 ? "" : `Frontend changes: ${JSON.stringify(frontend)}. Run native browser checks using playwright, puppeteer, cypress or ego-browser; inspect rendered behavior and visual quality. Save PNG/JPEG screenshots in a Git-ignored output directory and return relative paths in screenshots. If necessary, add only that output directory to the repository-local Git exclude; do not edit tracked ignore files or candidate source during checks. Reuse any browser session supplied by the task and leave it open for subsequent steps; do not close or transfer that shared session. Missing browser capability requires passed=false and blocked=true.\n`}${workspaceInstructions} Return a structured result and include requested KEY values in values.${step.requireChecks ? `\nVerification requires actual native shell checks for every criterion. Copy each criterion verbatim into checks[].criterion and cite the Antfarm execution reference from its bash result as checks[].call_id. Alternatively cite the complete command verbatim. Criteria: ${JSON.stringify(criteria)}` : ""}\n${agent.instructions}${retryFeedback === "" ? "" : `\nPrevious rejected attempt for this step:\n${retryFeedback}`}${(agent.skills?.length ?? 0) === 0 ? "" : `\nRequired skills: ${agent.skills.join(", ")}. Load them through the native skill tool before using them.`}\n\n${resolveTemplate(input, contextFor(extra))}${guidance === "" ? "" : `\n\nHuman reconciliation guidance:\n${guidance}`}`;
		if (prompt.length > 262144) throw new Error("assembled Antfarm input exceeds 262144 characters; provide bounded handoffs");
		const childId = SessionId(randomUUID());
		const planning = step.type === "single" && step.output === "stories" && execution === "single";
		const releaseAttempt = await dependencies.acquireAttempt?.();
		let clock;
		try {
			clock = deadline(spec.signal, agent.timeoutSeconds ?? spec.timeoutSeconds);
		} catch (error) {
			releaseAttempt?.();
			throw error;
		}
		let result;
		let deliveryBlocked = false;
		dependencies.evidence?.begin(childId, journal, step.id);
		try {
			await write({
				type: "attempt-start",
				data: {
					stepId: step.id,
					childSessionId: childId,
					execution,
					...storyId === void 0 ? {} : { storyId },
					...step.type === "single" && step.effect !== void 0 ? {
						effect: step.effect,
						candidate: await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind)
					} : {}
				}
			});
			if (step.type === "single" && step.effect !== void 0) {
				deliveryBlocked = true;
				if (dependencies.delivery === void 0) throw new Error("GitHub delivery verification is unavailable");
				await dependencies.delivery.preflight(start, step.effect, clock.signal);
				deliveryBlocked = false;
			}
			if (step.requireChecks && start.workspaceKind !== "files") await requireCommittedCandidate(dependencies.subprocess, start.workspace);
			clock.signal.throwIfAborted();
			const activation = await dependencies.subagents.startActivation({
				provider: start.provider,
				label: agent.name,
				childId,
				delivery: "caller",
				signal: clock.signal,
				request: {
					parent: spec.parent,
					cwd: start.workspace,
					agentPreset: agent.preset,
					prompt: [{
						type: "text",
						text: prompt
					}],
					outputSchema: outputSchema(planning, spec),
					...agent.model === void 0 ? {} : { agentOptions: { model: agent.model } }
				}
			});
			let disposal;
			const dispose = () => disposal ??= activation.dispose();
			let abort;
			const interrupted = new Promise((_resolve, reject) => {
				abort = reject;
			});
			const onAbort = () => {
				abort(clock.signal.reason);
				dispose().catch(() => {});
			};
			clock.signal.addEventListener("abort", onAbort, { once: true });
			if (clock.signal.aborted) onAbort();
			try {
				const outcome = await Promise.race([activation.result, interrupted]);
				clock.signal.throwIfAborted();
				if (outcome.stopReason !== "completed") throw new Error(outcome.diagnostic ?? `child stopped with ${outcome.stopReason}`);
				result = parseOutput(outcome.structured, planning, spec);
				if (result.passed && step.expects !== void 0) for (const line of step.expects.split("\n").filter((line) => line.trim() !== "")) {
					const match = /^([A-Z][A-Z0-9_]*):\s*(.*)$/.exec(line.trim());
					if (match === null || result.values?.[match[1].toLowerCase()] !== match[2]) throw new Error(`required verdict missing or different: ${line}`);
				}
			} finally {
				clock.signal.removeEventListener("abort", onAbort);
				await dispose();
			}
			const records = await dependencies.evidence?.finish(childId) ?? [];
			if (result.passed && planning && result.stories?.length === 0 && workflow.allowEmptyPlan === false) throw new Error("this workflow requires a nonempty implementation plan");
			if (result.passed && step.requireChecks) {
				if (start.workspaceKind !== "files") await requireCommittedCandidate(dependencies.subprocess, start.workspace);
				const version = await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind);
				const referenced = (result.checks ?? []).map((check) => records.find((record) => (check.callId === void 0 || record.callId === check.callId) && (check.command === void 0 || record.command === check.command) && record.passed && record.candidate === version && record.afterCandidate === version));
				const missingCriteria = criteria.filter((criterion) => !result.checks?.some((check) => check.criterion === criterion));
				const unmatchedCommands = (result.checks ?? []).filter((_check, index) => referenced[index] === void 0).map((check) => check.callId ?? check.command);
				if (referenced.length === 0 || unmatchedCommands.length > 0 || missingCriteria.length > 0) throw new Error(`required acceptance criteria lack actual successful execution evidence for this candidate. Missing verbatim criteria: ${JSON.stringify(missingCriteria).slice(0, 2048)}. Unmatched execution references: ${JSON.stringify(unmatchedCommands).slice(0, 2048)}. Execute foreground bash checks in the supplied workspace and cite every command line exactly.`);
				result = {
					...result,
					proof: {
						candidate: version,
						callIds: referenced.flatMap((record) => record === void 0 ? [] : [record.callId])
					}
				};
			}
			if (result.passed && frontend.length > 0) {
				const version = await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind);
				const artifacts = await retainScreenshots(start.workspace, result.screenshots ?? [], records, version, join(dirname(journal.eventsPath), "artifacts"));
				if (version !== await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind)) throw new Error("candidate changed while retaining screenshots");
				await write({
					type: "file-artifacts",
					data: {
						candidate: version,
						artifacts: [...new Map([...journal.state.artifacts, ...artifacts].map((artifact) => [`${artifact.path}:${artifact.sha256}`, artifact])).values()]
					}
				});
			}
			if (result.passed && step.type === "single" && step.effect !== void 0) {
				if (dependencies.delivery === void 0) throw new Error("GitHub delivery verification is unavailable");
				let refs;
				try {
					refs = await dependencies.delivery.verify(start, step.effect, {
						...journal.state.checkpoint.context,
						...result.values
					}, clock.signal);
				} catch (error) {
					deliveryBlocked = true;
					throw error;
				}
				result = {
					...result,
					values: {
						...result.values,
						...refs
					}
				};
			}
			spec.signal.throwIfAborted();
		} catch (error) {
			if (spec.signal.aborted) throw error;
			result = {
				passed: false,
				blocked: deliveryBlocked,
				summary: errorText(error, spec.maxSummaryChars)
			};
		} finally {
			clock.dispose();
			try {
				await dependencies.evidence?.finish(childId);
			} finally {
				releaseAttempt?.();
			}
		}
		await write({
			type: "attempt-end",
			data: {
				childSessionId: childId,
				passed: result.passed,
				summary: result.summary
			}
		});
		return result;
	};
	const settle = async (status, reason) => {
		if (status === "completed" && start.workspaceKind === "files") {
			await validateFileWorkspace(start.workspace, start.runId);
			const version = await candidateVersion(dependencies.subprocess, start.workspace, "files");
			const artifacts = await retainFileOutputs(start.workspace, join(dirname(journal.eventsPath), "artifacts"));
			if (artifacts.length === 0) throw new Error("file workflow produced no retained output");
			if (version !== await candidateVersion(dependencies.subprocess, start.workspace, "files")) throw new Error("file outputs changed during retention");
			await write({
				type: "file-artifacts",
				data: {
					candidate: version,
					artifacts
				}
			});
		}
		await write({
			type: "run-end",
			data: {
				status,
				reason
			}
		});
		const disposition = (status === "completed" ? spec.cleanupCompleted : status === "cancelled" && spec.cleanupCancelled) && journal.state.prepared && spec.worktree !== null ? await cleanupWorktree(dependencies.subprocess, spec.worktree) : {
			disposition: "retained",
			reason: reason || "workspace retained for inspection"
		};
		await write({
			type: "workspace-disposition",
			data: {
				disposition: disposition.disposition,
				reason: disposition.reason ?? ""
			}
		});
		return {
			status: status === "completed" ? "completed" : status === "cancelled" ? "killed" : "failed",
			detail: reason || start.runId
		};
	};
	const exhausted = async (checkpoint, reason, human) => {
		if (!human) {
			await commit(checkpoint);
			return settle("failed", reason);
		}
		await commit({
			...checkpoint,
			blocked: reason
		});
		await write({
			type: "workspace-disposition",
			data: {
				disposition: "retained",
				reason
			}
		});
		return {
			status: "completed",
			detail: `blocked: ${reason}`
		};
	};
	try {
		spec.signal.throwIfAborted();
		if (!journal.state.prepared) {
			if (spec.worktree === null) await createFileWorkspace(start.workspace, start.runId, start.fileInputs ?? []);
			else await createWorktree(dependencies.subprocess, spec.worktree, spec.signal);
			await write({
				type: "workspace-ready",
				data: {}
			});
		} else if (spec.worktree === null) await validateFileWorkspace(start.workspace, start.runId);
		else await validateWorktree(dependencies.subprocess, spec.worktree, spec.signal);
		const recovered = journal.state.checkpoint;
		if (recovered.blocked !== null) await commit({
			...recovered,
			blocked: null,
			stories: recovered.stories?.map((story) => story.status === "failed" ? {
				...story,
				status: "retry"
			} : story) ?? null
		});
		const verificationSteps = new Set(workflow.steps.flatMap((step) => step.type === "loop" && step.verifyStep !== void 0 ? [step.verifyStep] : []));
		for (;;) {
			while (journal.state.checkpoint.cursor < workflow.steps.length) {
				spec.signal.throwIfAborted();
				const state = journal.state.checkpoint;
				const step = workflow.steps[state.cursor];
				if (step === void 0) throw new Error("invalid workflow position");
				if (state.repair !== null) {
					const target = workflow.steps.find((candidate) => candidate.id === state.repair?.targetId);
					if (target === void 0) throw new Error("repair target is missing");
					const repaired = await child(target, "repair", {
						issues: state.feedback[step.id] ?? "",
						stories_summary: JSON.stringify(state.stories ?? [])
					}, void 0, target.type === "loop" ? target.repairInput ?? target.input : target.input);
					if (!repaired.passed) return exhausted(state, repaired.summary, step.onFail?.onExhausted.escalateTo === "human");
					await commit({
						...state,
						repair: null,
						acceptedChecks: {},
						cursor: Math.min(state.cursor, ...workflow.steps.map((candidate, index) => candidate.requireChecks && !verificationSteps.has(candidate.id) ? index : state.cursor)),
						context: {
							...state.context,
							[`${target.id}:repair`]: repaired.summary
						}
					});
					continue;
				}
				if (verificationSteps.has(step.id)) {
					await commit({
						...state,
						cursor: state.cursor + 1
					});
					continue;
				}
				if (step.type === "single" && step.effect !== void 0 && workflow.id === "security-audit" && state.stories?.length === 0) {
					await commit({
						...state,
						cursor: state.cursor + 1,
						context: {
							...state.context,
							[step.id]: "No demonstrated findings; no remediation PR required"
						}
					});
					continue;
				}
				if (step.type === "loop") {
					if (state.stories === null) throw new Error(`loop ${step.id} has no committed plan`);
					const story = state.stories.find((candidate) => candidate.status !== "done");
					if (story === void 0) {
						await commit({
							...state,
							cursor: state.cursor + 1
						});
						continue;
					}
					const extra = {
						current_story: JSON.stringify(story),
						verify_feedback: story.feedback ?? journal.state.resumeGuidance
					};
					const implemented = await child(step, "story", extra, story.id);
					let verified = implemented;
					const verifyStep = step.verifyStep === void 0 ? void 0 : workflow.steps.find((candidate) => candidate.id === step.verifyStep);
					if (implemented.passed && step.verifyEach && verifyStep !== void 0) verified = await child(verifyStep, "verify", {
						...extra,
						changes: implemented.summary
					}, story.id);
					const passed = implemented.passed && verified.passed;
					if (implemented.blocked || verified.blocked) return exhausted(state, verified.summary, true);
					const updated = passed ? {
						...story,
						status: "done"
					} : {
						...story,
						status: story.retryCount < story.maxRetries + journal.state.retryGrant ? "retry" : "failed",
						retryCount: story.retryCount + 1,
						feedback: verified.summary
					};
					const next = {
						...state,
						stories: state.stories.map((candidate) => candidate.id === story.id ? updated : candidate),
						acceptedChecks: {
							...state.acceptedChecks,
							...verified.proof === void 0 ? {} : { [`${verifyStep?.id ?? step.id}:${story.id}`]: verified.proof }
						},
						context: passed ? {
							...state.context,
							...implemented.values,
							[`${step.id}:${story.id}`]: implemented.summary,
							...verifyStep === void 0 ? {} : { [`${verifyStep.id}:${story.id}`]: verified.summary }
						} : state.context
					};
					if (updated.status === "failed") return exhausted(next, verified.summary, verifyStep?.onFail?.onExhausted.escalateTo === "human" || step.onFail?.onExhausted.escalateTo === "human");
					await commit(next);
					continue;
				}
				const output = await child(step, "single", { issues: state.feedback[step.id] ?? "" });
				if (output.passed) {
					await commit({
						...state,
						cursor: state.cursor + 1,
						acceptedChecks: {
							...state.acceptedChecks,
							...output.proof === void 0 ? {} : { [step.id]: output.proof }
						},
						context: {
							...state.context,
							...output.values,
							[step.id]: output.summary
						},
						stories: step.output === "stories" ? (output.stories ?? []).map((story) => ({
							...story,
							status: "pending",
							retryCount: 0
						})) : state.stories
					});
					continue;
				}
				const failures = state.retries[step.id] ?? 0;
				const next = {
					...state,
					feedback: {
						...state.feedback,
						[step.id]: output.summary
					},
					retries: {
						...state.retries,
						[step.id]: failures + 1
					}
				};
				if (output.blocked || step.effect === "pull-request") return exhausted(next, output.summary, true);
				if (failures < step.maxRetries + journal.state.retryGrant) {
					await commit(next);
					continue;
				}
				const repairs = state.retries[`${step.id}:repair`] ?? 0;
				if (step.onFail?.retryStep !== void 0 && repairs < step.onFail.maxRetries + journal.state.retryGrant) {
					await commit({
						...next,
						retries: {
							...next.retries,
							[step.id]: 0,
							[`${step.id}:repair`]: repairs + 1
						},
						repair: {
							targetId: step.onFail.retryStep,
							sourceStepId: step.id
						}
					});
					continue;
				}
				return exhausted(next, output.summary, step.onFail?.onExhausted.escalateTo === "human");
			}
			const finalSteps = workflow.steps.filter((step) => step.type === "single" && step.requireChecks && !verificationSteps.has(step.id));
			if (finalSteps.length === 0) break;
			const version = await candidateVersion(dependencies.subprocess, start.workspace, start.workspaceKind);
			const stale = finalSteps.find((step) => journal.state.checkpoint.acceptedChecks?.[step.id]?.candidate !== version);
			if (stale === void 0) break;
			const cursor = workflow.steps.indexOf(stale);
			const invalid = new Set(workflow.steps.slice(cursor).map((step) => step.id));
			await commit({
				...journal.state.checkpoint,
				cursor,
				acceptedChecks: Object.fromEntries(Object.entries(journal.state.checkpoint.acceptedChecks ?? {}).filter(([id]) => !invalid.has(id))),
				context: Object.fromEntries(Object.entries(journal.state.checkpoint.context).filter(([id]) => !invalid.has(id)))
			});
		}
		spec.signal.throwIfAborted();
		for (const step of workflow.steps) {
			if (step.type !== "single" || step.effect === void 0 || workflow.id === "security-audit" && journal.state.checkpoint.stories?.length === 0) continue;
			if (dependencies.delivery === void 0) throw new Error("GitHub delivery verification is unavailable");
			try {
				await dependencies.delivery.verify(start, step.effect, journal.state.checkpoint.context, spec.signal);
			} catch (error) {
				return exhausted({
					...journal.state.checkpoint,
					cursor: workflow.steps.indexOf(step)
				}, errorText(error, spec.maxSummaryChars), true);
			}
		}
		return await settle("completed", "");
	} catch (error) {
		if (spec.interrupted?.()) {
			await write({
				type: "run-interrupt",
				data: { reason: "Host stopped; inspect any uncertain attempt before recovery" }
			});
			return {
				status: "killed",
				detail: "interrupted"
			};
		}
		const status = spec.signal.aborted ? "cancelled" : "failed";
		const reason = errorText(error, spec.maxSummaryChars);
		try {
			return await settle(status, reason);
		} catch (journalError) {
			return {
				status: "failed",
				detail: `run evidence could not be committed: ${errorText(journalError, spec.maxSummaryChars)}`
			};
		}
	}
}
//#endregion
//#region lib/types/runtime/index.js
var __addDisposableResource = function(env, value, async) {
	if (value !== null && value !== void 0) {
		if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
		var dispose, inner;
		if (async) {
			if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
			dispose = value[Symbol.asyncDispose];
		}
		if (dispose === void 0) {
			if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
			dispose = value[Symbol.dispose];
			if (async) inner = dispose;
		}
		if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
		if (inner) dispose = function() {
			try {
				inner.call(this);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		env.stack.push({
			value,
			dispose,
			async
		});
	} else if (async) env.stack.push({ async: true });
	return value;
};
var __disposeResources = (function(SuppressedError) {
	return function(env) {
		function fail(e) {
			env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
			env.hasError = true;
		}
		var r, s = 0;
		function next() {
			while (r = env.stack.pop()) try {
				if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
				if (r.dispose) {
					var result = r.dispose.call(r.value);
					if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
						fail(e);
						return next();
					});
				} else s |= 1;
			} catch (e) {
				fail(e);
			}
			if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
			if (env.hasError) throw env.error;
		}
		return next();
	};
})(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
	var e = new Error(message);
	return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.resolve("dsh-antfarm/package.json")));
/** Owner-scoped admission and lifecycle around durable workflow drivers. */
var AntfarmRuntime = class extends Service {
	config;
	static inject = [
		"agents",
		"sessions",
		"workingDirectory",
		"agentPresets",
		"jobs",
		"subagents",
		"subprocess"
	];
	static Config = z.object({
		journalRoot: z.string().required(),
		workflowDirs: z.array(z.string()).default([]),
		defaultWorkflowId: z.string().default("feature-dev").volatile(),
		worktreeDirectory: z.string().default(".worktrees/antfarm"),
		defaultStepTimeoutSeconds: z.natural().min(1).max(2147483).default(1800).volatile(),
		subagentProvider: z.string().default("spawn"),
		maxActiveRunsPerOwner: z.natural().min(1).max(100).default(2),
		maxActiveRuns: z.natural().min(1).max(100).default(8),
		maxAttempts: z.natural().min(1).max(1e4).default(500).volatile(),
		maxStories: z.natural().min(1).max(100).default(20).volatile(),
		maxStoryRetries: z.natural().max(20).default(2).volatile(),
		maxSummaryChars: z.natural().min(1).max(65536).default(8192).volatile(),
		cleanupCompletedWorktrees: z.boolean().default(true).volatile(),
		cleanupCancelledWorktrees: z.boolean().default(true).volatile(),
		healthEnabled: z.boolean().default(true).volatile(),
		healthIntervalMs: z.natural().min(1e3).max(2147483647).default(3e5).volatile(),
		notifyOwner: z.boolean().default(true).volatile(),
		webhookUrl: z.string().role("secret").default("").volatile(),
		webhookTokenEnv: z.string().role("credential-ref").default("").volatile(),
		githubReviewerTokenEnv: z.string().role("credential-ref").default("").volatile()
	});
	admissions = /* @__PURE__ */ new Map();
	operations = /* @__PURE__ */ new Map();
	closing = false;
	storage;
	nextNumber = 1;
	evidence;
	capacity;
	owners;
	workflows = new WorkflowManager(resolve(PACKAGE_ROOT, "workflows"));
	healthTimer;
	healthWork;
	healthChecks = /* @__PURE__ */ new Set();
	healthController = new AbortController();
	constructor(ctx, config) {
		super(ctx, "antfarm");
		this.config = config;
		this.evidence = new ExecutionEvidence(ctx);
		this.capacity = new RunCapacity(config.maxActiveRuns, config.maxActiveRunsPerOwner);
		this.owners = new RunOwnerResolver(ctx);
		ctx.on("loader/volatile-update", () => {
			if (this.healthTimer === void 0 || this.healthWork !== void 0) return;
			clearTimeout(this.healthTimer);
			this.scheduleHealth();
		});
		ctx.on("workspace/session-stop", ({ sessionId }) => {
			for (const operation of this.operations.values()) if (operation.owner === sessionId) {
				operation.interrupted = true;
				operation.controller.abort(/* @__PURE__ */ new Error("owning session archived"));
			}
		});
		ctx.on("agent/disposed", ({ agent }) => {
			for (const operation of this.operations.values()) if (operation.owner === agent.id) {
				operation.interrupted = true;
				operation.controller.abort(/* @__PURE__ */ new Error("owning Agent was unloaded; restore its authority before recovery"));
			}
		});
		ctx.effect(() => async () => {
			this.closing = true;
			clearTimeout(this.healthTimer);
			this.healthController.abort();
			const operations = [...this.operations.values()];
			for (const operation of operations) {
				operation.interrupted = true;
				operation.controller.abort(/* @__PURE__ */ new Error("antfarm service disposed"));
			}
			await Promise.all(operations.map((operation) => operation.done));
			await Promise.allSettled([...this.healthChecks]);
			await this.owners.dispose();
			this.storage?.dispose();
		});
	}
	/** Acquire Host ownership, rebuild projections, and recover safe persisted work. */
	async [Service.init]() {
		this.storage = await RunStorage.acquire(this.config.journalRoot);
		const recovered = await this.rebuildIndex();
		for (const journal of recovered) {
			const state = journal.state;
			if (![
				"queued",
				"starting",
				"running",
				"interrupted"
			].includes(state.status)) continue;
			if (state.openAttempt !== null) {
				await journal.append({
					type: "run-interrupt",
					data: { reason: "inspect the uncertain native attempt before resuming" }
				});
				this.project(journal);
				continue;
			}
			try {
				const parent = await this.owners.resolve(SessionId(state.start.ownerSessionId));
				const operation = this.admit(state.start.runId, parent);
				operation.journal = journal;
				this.project(journal);
				try {
					await this.provider(state.start.provider, state.start.resolvedWorkflowSnapshot, state.start.baseCwd);
					const worktree = await this.worktree(state, operation.controller.signal);
					this.launch(state.start.runId, operation, parent, worktree);
				} catch (error) {
					this.release(state.start.runId, operation);
					throw error;
				}
			} catch (error) {
				await journal.append({
					type: "run-interrupt",
					data: { reason: String(error).slice(0, this.config.maxSummaryChars.get()) }
				});
				this.project(journal);
			}
		}
		this.scheduleHealth();
	}
	scheduleHealth() {
		if (this.closing) return;
		this.healthTimer = setTimeout(() => {
			const work = this.checkHealth();
			this.healthWork = work;
			work.catch(() => {}).finally(() => {
				this.healthWork = void 0;
				this.scheduleHealth();
			});
		}, this.config.healthIntervalMs.get());
		this.healthTimer.unref();
	}
	/**
	* Inspect and persist health diagnostics without accepting work.
	* @param owner - Authorized Session scope, or internal Host scope.
	* @returns Persisted health facts without inferring acceptance.
	*/
	checkHealth(owner) {
		const work = this.inspectHealth(owner);
		this.healthChecks.add(work);
		work.finally(() => {
			this.healthChecks.delete(work);
		}).catch(() => {});
		return work;
	}
	async inspectHealth(owner) {
		const findings = [];
		if (!this.config.healthEnabled.get()) return {
			time: Date.now(),
			enabled: false,
			findings
		};
		for (const row of this.storage.unsettled(owner)) {
			if (this.closing) break;
			const existing = this.operations.get(row.runId);
			if (existing !== void 0 && existing.journal === void 0) continue;
			const diagnostic = existing === void 0 ? this.reserve(row.runId, SessionId(row.ownerSessionId)) : void 0;
			try {
				const journal = existing?.journal ?? await this.owned(row.runId, SessionId(row.ownerSessionId));
				if (diagnostic !== void 0) diagnostic.journal = journal;
				const state = journal.state;
				let kind;
				let detail = "";
				if (state.openAttempt !== null && existing === void 0) {
					kind = "uncertain";
					detail = "inspect the previous native child before granting recovery";
				} else if (existing === void 0 && [
					"queued",
					"starting",
					"running",
					"interrupted"
				].includes(state.status)) {
					kind = "inactive";
					detail = "ensure execution can recover this inactive Run after owner validation";
				} else if (state.openAttempt !== null && Date.now() - (journal.attemptTime ?? state.updatedAt) > (state.start.resolvedWorkflowSnapshot.agents.find((agent) => agent.id === state.start.resolvedWorkflowSnapshot.steps.find((step) => step.id === state.openAttempt?.stepId)?.agent)?.timeoutSeconds ?? state.start.executionPolicy?.timeoutSeconds ?? this.config.defaultStepTimeoutSeconds.get()) * 1e3 + 5e3) {
					kind = "overdue";
					detail = "native attempt exceeded its expected deadline; inspect cancellation and subprocess teardown";
				} else if (state.status === "failed" || state.status === "blocked") {
					kind = "retained";
					detail = state.checkpoint.blocked ?? state.workspaceReason;
				}
				if (kind !== void 0) {
					findings.push({
						runId: row.runId,
						kind,
						detail
					});
					const previous = journal.latest("health");
					if (previous?.type !== "health" || previous.data.kind !== kind || previous.data.detail !== detail.slice(0, 2048)) {
						await journal.append({
							type: "health",
							data: {
								kind,
								detail: detail.slice(0, 2048)
							}
						});
						const eventId = `${row.runId}:${journal.revision}:health`;
						if (this.config.notifyOwner.get() && kind !== "retained") try {
							const parent = await this.resolveOwner(SessionId(row.ownerSessionId));
							await deliverOwnerNotice(journal, parent, eventId, `Antfarm health alert for ${row.runId}: ${detail}`, this.healthController.signal, () => this.ctx.sessions.flush(parent.session));
						} catch {
							await journal.append({
								type: "notification",
								data: {
									id: eventId,
									channel: "owner",
									status: "failed",
									detail: "health notice recipient is unavailable; inspect Run health history"
								}
							});
						}
						this.project(journal);
					}
				}
			} catch {
				findings.push({
					runId: row.runId,
					kind: "unreadable",
					detail: "Run evidence is unavailable; retain its workspace and inspect the logs"
				});
			} finally {
				if (diagnostic !== void 0) this.release(row.runId, diagnostic);
			}
		}
		const report = {
			time: Date.now(),
			enabled: true,
			findings
		};
		if (!this.closing) this.storage.recordHealth(report);
		return report;
	}
	/**
	* Read bounded health history and current monitoring settings.
	* @param owner - Explicit authorized scope.
	* @returns Retained checks and current native settings.
	*/
	async healthHistory(owner) {
		return {
			...this.storage.healthHistory(owner),
			enabled: this.config.healthEnabled.get(),
			intervalMs: this.config.healthIntervalMs.get()
		};
	}
	/**
	* Dispatch safe inactive work through the existing executor.
	* @param owner - Explicit authorization scope.
	* @returns Runs dispatched by the existing sole executor.
	*/
	async ensureExecution(owner) {
		const dispatched = [];
		for (const row of this.storage.unsettled(owner)) {
			if (this.operations.has(row.runId) || ![
				"queued",
				"starting",
				"running",
				"interrupted"
			].includes(row.status)) continue;
			const journal = await this.owned(row.runId, owner);
			if (journal.state.openAttempt !== null) continue;
			const parent = await this.resolveOwner(owner);
			const operation = this.admit(row.runId, parent);
			operation.journal = journal;
			try {
				await this.provider(journal.state.start.provider, journal.state.start.resolvedWorkflowSnapshot, journal.state.start.baseCwd);
				const worktree = await this.worktree(journal.state, operation.controller.signal);
				this.launch(row.runId, operation, parent, worktree);
				dispatched.push(row.runId);
			} catch (error) {
				this.release(row.runId, operation);
				throw error;
			}
		}
		return dispatched;
	}
	/**
	* Rebuild the disposable index from disk after startup or explicit repair.
	* @returns Supported journals available for recovery.
	*/
	async rebuildIndex() {
		this.storage.reset();
		const recovered = [];
		for (const entry of await readdir(this.config.journalRoot, { withFileTypes: true })) {
			if (!entry.isDirectory() || !/^af-[a-z0-9-]{1,64}$/.test(entry.name)) continue;
			let identity;
			try {
				identity = await readJournalIdentity(this.config.journalRoot, entry.name);
			} catch {
				continue;
			}
			this.nextNumber = Math.max(this.nextNumber, (identity.data.number ?? 0) + 1);
			try {
				let journal;
				try {
					journal = this.operations.get(entry.name)?.journal ?? await RunJournal.open(this.config.journalRoot, entry.name);
				} catch {
					journal = await RunJournal.recoverTail(this.config.journalRoot, entry.name);
				}
				this.nextNumber = Math.max(this.nextNumber, (journal.state.start.number ?? 0) + 1);
				this.project(journal);
				recovered.push(journal);
			} catch {
				this.storage.put({
					...identity.data,
					status: identity.version === 3 ? "corrupt" : "legacy",
					updatedAt: 0,
					workspaceDisposition: "retained",
					workspaceReason: "unsupported or corrupt evidence; retain for inspection"
				});
			}
		}
		return recovered;
	}
	policy() {
		return {
			maxAttempts: this.config.maxAttempts.get(),
			timeoutSeconds: this.config.defaultStepTimeoutSeconds.get(),
			maxStories: this.config.maxStories.get(),
			maxStoryRetries: this.config.maxStoryRetries.get(),
			maxSummaryChars: this.config.maxSummaryChars.get(),
			cleanupCompleted: this.config.cleanupCompletedWorktrees.get(),
			cleanupCancelled: this.config.cleanupCancelledWorktrees.get()
		};
	}
	indexFailure;
	project(journal) {
		try {
			this.storage.put(this.summary(journal.state));
			this.indexFailure = void 0;
		} catch (error) {
			this.indexFailure = String(error);
		}
	}
	/** Last derived-index error; business evidence remains authoritative. */
	get indexError() {
		return this.indexFailure;
	}
	/**
	* Restore the original root Session authority without a model turn.
	* @param owner - Original root Session.
	* @returns Native authority without a model turn.
	*/
	async resolveOwner(owner) {
		return this.owners.resolve(owner);
	}
	async observedWorkflowRoots(owner) {
		const live = this.ctx.agents.get(owner);
		let cwd = live === void 0 ? void 0 : this.ctx.workingDirectory.get(live.session);
		if (cwd === void 0) {
			const env_1 = {
				stack: [],
				error: void 0,
				hasError: false
			};
			try {
				const query = this.ctx.get("sessionQuery");
				if (query === void 0) throw new Error("workflow discovery requires native Session query");
				const observation = __addDisposableResource(env_1, await query.observeSession(owner), false);
				const projected = observation.projections?.values.workingDirectory;
				cwd = typeof projected === "string" ? projected : observation.header.cwd;
			} catch (e_1) {
				env_1.error = e_1;
				env_1.hasError = true;
			} finally {
				__disposeResources(env_1);
			}
		}
		if (cwd === void 0) throw new Error("selected Session has no workflow input root");
		return [await projectWorkflowRoot((await prepareRepository(this.ctx.subprocess, cwd).catch(() => null))?.root ?? cwd), ...this.config.workflowDirs];
	}
	/**
	* Discover workflows for a selected Session without activating its owner.
	* @param owner - Selected Session.
	* @returns Workflow catalog without resuming a model owner.
	*/
	async workflowCatalog(owner) {
		return this.workflows.list(await this.observedWorkflowRoots(owner));
	}
	/**
	* Read revision-bound workflow resources for a selected Session.
	* @param owner - Selected Session.
	* @param id - Workflow.
	* @returns Editable source without owner activation.
	*/
	async workflowDraft(owner, id) {
		return this.workflows.read(id, await this.observedWorkflowRoots(owner));
	}
	async workflowRoots(parent) {
		this.live(parent, new AbortController().signal);
		const cwd = await this.ctx.workingDirectory.ensure(parent);
		return [await projectWorkflowRoot((await prepareRepository(this.ctx.subprocess, cwd).catch(() => null))?.root ?? cwd), ...this.config.workflowDirs];
	}
	/**
	* List available workflows under the live owner’s configuration.
	* @param parent - Authorized root.
	* @returns Installed and packaged workflow ids.
	*/
	async listWorkflows(parent) {
		return this.workflows.list(await this.workflowRoots(parent));
	}
	/**
	* Read editable workflow resources under the live owner’s configuration.
	* @param parent - Authorized root.
	* @param id - Workflow id.
	* @returns Editable resolved copy.
	*/
	async readWorkflow(parent, id) {
		return this.workflows.read(id, await this.workflowRoots(parent));
	}
	/**
	* Validate and atomically save a revision-bound workflow copy.
	* @param parent - Authorized root.
	* @param value - Revision-bound copy.
	* @param scope - Destination.
	* @returns Saved copy.
	*/
	async saveWorkflow(parent, value, scope) {
		const roots = await this.workflowRoots(parent);
		const root = scope === "project" ? roots[0] : this.config.workflowDirs[0];
		if (root === void 0) throw new Error("configure a writable profile workflow directory first");
		this.live(parent, new AbortController().signal);
		return this.workflows.save(value, root, roots);
	}
	/**
	* Import confined original Antfarm resources into a project copy.
	* @param parent - Authorized root.
	* @param directory - Original workflow.
	* @param sourceRoot - Shared-resource root.
	* @param workspace - Git or owned file workspace for the imported workflow.
	* @returns Installed project copy.
	*/
	async importWorkflow(parent, directory, sourceRoot, workspace = "git") {
		const roots = await this.workflowRoots(parent);
		this.live(parent, new AbortController().signal);
		return this.workflows.import(directory, sourceRoot, roots[0], workspace);
	}
	/**
	* Remove a matching writable override after checking active dependencies.
	* @param parent - Authorized root.
	* @param id - Workflow.
	* @param revision - Current copy.
	* @param scope - Override root.
	*/
	async removeWorkflow(parent, id, revision, scope) {
		const roots = await this.workflowRoots(parent);
		const root = scope === "project" ? roots[0] : this.config.workflowDirs[0];
		if (root === void 0) throw new Error("configure a writable profile workflow directory first");
		if ([...this.operations.values()].some((operation) => operation.journal?.state.start.workflowId === id)) throw new Error("settle active workflow Runs before uninstalling their resources");
		this.live(parent, new AbortController().signal);
		await this.workflows.remove(id, root, revision);
	}
	/**
	* Change workflow availability after checking revision and active dependencies.
	* @param parent - Root owner.
	* @param id - Workflow id or all.
	* @param enabled - Install or disable.
	* @param force - Cancel this owner's active Runs first.
	* @param expected - Source revision and enabled state required by the caller.
	*/
	async setWorkflowEnabled(parent, id, enabled, force = false, expected) {
		const roots = await this.workflowRoots(parent);
		const ids = id === "all" ? await this.workflows.list(roots) : [id];
		if (!enabled) for (const [runId, operation] of this.operations) {
			if (!ids.includes(operation.journal?.state.start.workflowId ?? "")) continue;
			if (!force || operation.owner !== parent.id) throw new Error("settle active workflow Runs before uninstalling; force can cancel only this owner’s Runs");
			await this.cancel(runId, parent.id, "workflow disabled by owner");
		}
		for (const workflowId of ids) {
			this.live(parent, new AbortController().signal);
			const current = await this.workflows.enabled(workflowId, roots);
			await this.workflows.setEnabled(workflowId, roots, enabled, expected?.enabled ?? current, expected?.revision);
		}
	}
	/**
	* Create an independent project workflow from a matching source revision.
	* @param parent - Root owner.
	* @param source - Revision-bound source.
	* @param newId - New id.
	* @returns Validated project copy.
	*/
	async copyWorkflow(parent, source, newId) {
		const roots = await this.workflowRoots(parent);
		this.live(parent, new AbortController().signal);
		return this.workflows.copy(source, newId, roots, roots[0]);
	}
	live(parent, signal) {
		signal.throwIfAborted();
		if (this.closing || this.ctx.agents.get(parent.id) !== parent) throw new Error("antfarm requires the current live initiating agent");
		if (this.ctx.get("workspaceRegistry")?.archivedSessionIds.includes(parent.id)) throw new Error("restore the archived owning session before starting antfarm");
		if (parent.session.header.origin === "subagent") throw new Error("antfarm workflows require a root initiating session");
	}
	admit(runId, parent) {
		this.live(parent, new AbortController().signal);
		return this.reserve(runId, parent.id);
	}
	reserve(runId, owner) {
		if (this.closing) throw new Error("antfarm service is closing");
		if (this.operations.has(runId)) throw new Error("antfarm run already has an active operation");
		let finish;
		const operation = {
			owner,
			controller: new AbortController(),
			done: new Promise((resolve) => {
				finish = resolve;
			}),
			finish: () => finish()
		};
		this.operations.set(runId, operation);
		return operation;
	}
	release(runId, operation) {
		this.operations.delete(runId);
		operation.finish();
	}
	async provider(name, workflow, cwd) {
		const provider = this.ctx.subagents.getProvider(name);
		if (provider === void 0 || provider.inheritsParentContext || provider.prepareContinuable === void 0 || !provider.capabilities.agentPreset || !provider.capabilities.outputSchema || !provider.capabilities.agentOptions) throw new Error(`antfarm provider ${name} must support fresh local preset-based structured activations`);
		for (const role of workflow.agents) {
			const preset = await this.ctx.agentPresets.resolve(role.preset);
			if (preset.broken !== void 0) throw new Error(`antfarm preset ${role.preset} is unavailable: ${preset.broken}`);
			if ((role.skills?.length ?? 0) > 0) {
				const env_2 = {
					stack: [],
					error: void 0,
					hasError: false
				};
				try {
					const skills = this.ctx.get("skills");
					if (skills === void 0) throw new Error(`role ${role.id} requires the native skill registry`);
					const scope = __addDisposableResource(env_2, await this.ctx.agentPresets.acquireScope(role.preset), true);
					const catalog = await skills.snapshot({
						cwd,
						scope: scope.key
					});
					if (!catalog.complete) throw new Error(`role ${role.id} skill discovery is incomplete; check its configured skill roots`);
					for (const name of role.skills ?? []) if (!catalog.skills.some((skill) => skill.name === name && skill.invocation.modelInvocable)) throw new Error(`role ${role.id} requires unavailable model skill ${name}`);
				} catch (e_2) {
					env_2.error = e_2;
					env_2.hasError = true;
				} finally {
					const result_1 = __disposeResources(env_2);
					if (result_1) await result_1;
				}
			}
		}
	}
	/**
	* Start in an owned worktree after reserving owner capacity and persisting identity.
	* @param request - Task and exact live initiating Agent.
	* @returns Receipt after journal and native job acceptance.
	*/
	async start(request) {
		if (request.requestId === void 0) return this.startNew(request);
		if (request.requestId.length === 0 || request.requestId.length > 128) throw new Error("invalid Antfarm admission request identity");
		const key = JSON.stringify([request.parent.id, request.requestId]);
		const pending = this.admissions.get(key);
		const signature = JSON.stringify([
			request.task,
			request.workflowId,
			request.notificationUrl
		]);
		if (pending !== void 0) {
			if (pending.signature !== signature) throw new Error("Antfarm request identity was reused with different inputs");
			return pending.work;
		}
		const work = this.startNew(request).finally(() => {
			this.admissions.delete(key);
		});
		this.admissions.set(key, {
			signature,
			work
		});
		return work;
	}
	async startNew(request) {
		const runId = request.requestId === void 0 ? `af-${randomUUID()}` : `af-${createHash("sha256").update(JSON.stringify([request.parent.id, request.requestId])).digest("hex").slice(0, 48)}`;
		this.live(request.parent, request.signal ?? new AbortController().signal);
		if (request.requestId !== void 0) try {
			const journal = this.operations.get(runId)?.journal ?? await this.owned(runId, request.parent.id);
			const start = journal.state.start;
			if (start.task !== request.task || start.notificationUrl !== request.notificationUrl || request.workflowId !== void 0 && start.workflowId !== request.workflowId) throw new Error("Antfarm request identity was reused with different inputs");
			const jobId = this.operations.get(runId)?.jobId;
			return {
				runId,
				...jobId === void 0 ? {} : { jobId },
				workflowId: start.workflowId,
				status: journal.state.status,
				workspace: start.workspace,
				branch: start.branch
			};
		} catch (error) {
			if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
		}
		const operation = this.admit(runId, request.parent);
		const signal = request.signal === void 0 ? operation.controller.signal : AbortSignal.any([request.signal, operation.controller.signal]);
		try {
			this.live(request.parent, signal);
			if (request.task.length > 65536) throw new Error("antfarm task exceeds 65536 characters");
			if (request.task.trim() === "") throw new Error("antfarm task must not be empty");
			const cwd = await this.ctx.workingDirectory.ensure(request.parent, signal);
			const repository = await prepareRepository(this.ctx.subprocess, cwd, signal).catch(() => {
				signal.throwIfAborted();
				return null;
			});
			const roots = [await projectWorkflowRoot(repository?.root ?? cwd), ...this.config.workflowDirs];
			const workflow = await loadWorkflow(request.workflowId ?? this.config.defaultWorkflowId.get(), [...roots, resolve(PACKAGE_ROOT, "workflows")]);
			if (workflow.workspace !== "files" && repository === null) throw new Error("this workflow requires a Git repository with a committed base; choose a file workflow for research or writing");
			if (!await this.workflows.enabled(workflow.id, roots)) throw new Error("workflow is uninstalled; install or enable it before starting a new Run");
			await this.provider(this.config.subagentProvider, workflow, repository?.root ?? cwd);
			this.live(request.parent, signal);
			const worktree = workflow.workspace === "files" || repository === null ? null : resolveWorktreeSpec(repository, this.config.worktreeDirectory, runId);
			const baseCwd = repository?.root ?? await realpath(cwd);
			const workspace = worktree?.path ?? fileWorkspacePath(baseCwd, runId);
			const fileInputs = worktree === null ? await captureFileInputs(baseCwd, workflow.inputs ?? []) : void 0;
			const notificationUrl = request.notificationUrl === void 0 ? void 0 : publicWebhookUrl(request.notificationUrl);
			operation.journal = await RunJournal.create(this.config.journalRoot, {
				runId,
				...request.requestId === void 0 ? {} : { requestId: request.requestId },
				number: this.nextNumber++,
				ownerSessionId: request.parent.id,
				workflowId: workflow.id,
				task: request.task,
				baseCwd,
				baseRevision: repository?.baseRevision ?? "",
				workspace,
				branch: worktree?.branch ?? "",
				workspaceKind: worktree === null ? "files" : "git",
				...fileInputs === void 0 ? {} : { fileInputs },
				provider: this.config.subagentProvider,
				...notificationUrl === void 0 ? {} : { notificationUrl },
				resolvedWorkflowSnapshot: workflow,
				...this.config.githubReviewerTokenEnv.get() === "" ? {} : { githubReviewerTokenEnv: this.config.githubReviewerTokenEnv.get() },
				executionPolicy: this.policy()
			});
			this.live(request.parent, signal);
			return this.launch(runId, operation, request.parent, worktree);
		} catch (error) {
			if (operation.journal !== void 0) await operation.journal.append(this.interrupted(operation, request.parent) ? {
				type: "run-interrupt",
				data: { reason: String(error) }
			} : {
				type: "run-end",
				data: {
					status: signal.aborted ? "cancelled" : "failed",
					reason: String(error)
				}
			}).catch(() => {});
			this.release(runId, operation);
			throw error;
		}
	}
	/**
	* Resume from the saved workflow; uncertain attempts require explicit reconciliation guidance.
	* @param request - Original run, live owner and any reconciliation guidance.
	* @returns Receipt for the resumed native job.
	*/
	async resume(request) {
		const operation = this.admit(request.runId, request.parent);
		const signal = request.signal === void 0 ? operation.controller.signal : AbortSignal.any([request.signal, operation.controller.signal]);
		try {
			operation.journal = await this.owned(request.runId, request.parent.id);
			if (request.revision !== void 0 && operation.journal.revision !== request.revision) throw new Error("Run changed; refresh before resuming");
			const state = operation.journal.state;
			if (["completed", "cancelled"].includes(state.status) || state.workspaceDisposition === "cleaned") throw new Error("antfarm run is not resumable");
			if (state.openAttempt !== null && (request.guidance?.trim() ?? "") === "") throw new Error("inspect the uncertain child and worktree, then supply reconciliation guidance to resume");
			if (state.status === "failed" && (request.retryGrant ?? 0) < 1) throw new Error("failed antfarm resume requires an explicit retry budget grant");
			const worktree = await this.worktree(state, signal);
			if (state.prepared && worktree !== null) await validateWorktree(this.ctx.subprocess, worktree, signal);
			await this.provider(state.start.provider, state.start.resolvedWorkflowSnapshot, state.start.baseCwd);
			this.live(request.parent, signal);
			await operation.journal.append({
				type: "run-resume",
				data: {
					guidance: request.guidance ?? "",
					retryGrant: request.retryGrant ?? 0
				}
			});
			return this.launch(request.runId, operation, request.parent, worktree);
		} catch (error) {
			this.release(request.runId, operation);
			throw error;
		}
	}
	interrupted(operation, parent) {
		if (operation.interrupted === true || this.closing) return true;
		try {
			parent.ctx.fiber.assertActive();
			this.ctx.fiber.assertActive();
			return false;
		} catch {
			return true;
		}
	}
	launch(runId, operation, parent, worktree) {
		const journal = operation.journal;
		if (journal === void 0) throw new Error("antfarm journal was not admitted");
		const policy = journal.state.start.executionPolicy ?? this.policy();
		const currentPolicy = this.policy();
		for (const key of [
			"maxStories",
			"maxStoryRetries",
			"maxSummaryChars"
		]) if (policy[key] > currentPolicy[key]) throw new Error(`saved antfarm ${key} exceeds the current deployment limit`);
		if ((policy.maxAttempts ?? 500) > currentPolicy.maxAttempts) throw new Error("saved antfarm attempt budget exceeds the current deployment limit");
		const drive = async () => {
			let release;
			try {
				release = await this.capacity.acquire(parent.id, operation.controller.signal);
				this.live(parent, operation.controller.signal);
				await journal.append({
					type: "run-dispatch",
					data: {}
				});
				this.project(journal);
				return await runWorkflow({
					subagents: this.ctx.subagents,
					subprocess: this.ctx.subprocess,
					evidence: this.evidence,
					delivery: new GitHubDelivery(this.ctx.subprocess),
					acquireAttempt: async () => {
						await journal.append({
							type: "run-queue",
							data: {}
						});
						this.project(journal);
						release?.();
						release = void 0;
						const slot = await this.capacity.acquire(parent.id, operation.controller.signal);
						try {
							this.live(parent, operation.controller.signal);
							await journal.append({
								type: "run-dispatch",
								data: {}
							});
							this.project(journal);
							return slot;
						} catch (error) {
							slot();
							throw error;
						}
					},
					onEvent: async (record, revision) => {
						if (![
							"workspace-ready",
							"attempt-start",
							"attempt-end",
							"checkpoint",
							"run-end",
							"run-interrupt"
						].includes(record.type)) return;
						const url = journal.state.start.notificationUrl ?? journal.state.start.resolvedWorkflowSnapshot.notifications?.url ?? journal.state.start.resolvedWorkflowSnapshot.source?.notifications.url ?? this.config.webhookUrl.get();
						const tokenEnv = this.config.webhookTokenEnv.get();
						await deliverWebhook(journal, `${runId}:${revision}`, record.type, record.type === "attempt-start" ? `${record.data.stepId} ${record.data.execution}` : journal.state.checkpoint.blocked ?? journal.state.status, url, tokenEnv === "" ? void 0 : process.env[tokenEnv], operation.controller.signal);
					}
				}, {
					journal,
					parent,
					worktree,
					signal: operation.controller.signal,
					...policy,
					interrupted: () => this.interrupted(operation, parent),
					onChange: () => this.project(journal)
				});
			} catch (error) {
				await journal.append(this.interrupted(operation, parent) ? {
					type: "run-interrupt",
					data: { reason: String(error) }
				} : {
					type: "run-end",
					data: {
						status: operation.controller.signal.aborted ? "cancelled" : "failed",
						reason: String(error)
					}
				});
				return {
					status: operation.controller.signal.aborted ? "killed" : "failed",
					detail: String(error)
				};
			} finally {
				if (this.config.notifyOwner.get() && [
					"completed",
					"failed",
					"cancelled",
					"blocked",
					"interrupted"
				].includes(journal.state.status)) await deliverOutcome(journal, parent, "", void 0, new AbortController().signal, () => this.ctx.sessions.flush(parent.session)).catch(() => {});
				this.release(runId, operation);
				this.project(journal);
				release?.();
			}
		};
		const jobId = this.ctx.jobs.start({
			kind: "antfarm",
			label: `antfarm ${journal.state.start.workflowId}: ${journal.state.start.task.slice(0, 120)}`,
			owner: parent.id,
			run: () => ({
				cancel: (reason) => operation.controller.abort(new Error(reason ?? "cancelled by user")),
				done: drive()
			})
		});
		operation.jobId = jobId;
		this.project(journal);
		const start = journal.state.start;
		return {
			runId,
			jobId,
			workflowId: start.workflowId,
			status: "queued",
			workspace: start.workspace,
			branch: start.branch
		};
	}
	/**
	* Wait for this Run's whole execution interval and final workspace disposition.
	* @param runId - Owned Run, including a queued execution.
	* @param owner - Session authorizing the wait.
	* @param signal - Optional caller wait cancellation; omission waits until settlement.
	* @returns Completed, failed, cancelled, blocked or interrupted business state.
	*/
	async wait(runId, owner, signal) {
		await this.owned(runId, owner);
		const operation = this.operations.get(runId);
		if (operation !== void 0) {
			if (signal === void 0) await operation.done;
			else {
				signal.throwIfAborted();
				let abort;
				const cancelled = new Promise((_resolve, reject) => {
					abort = () => reject(signal.reason);
					signal.addEventListener("abort", abort, { once: true });
				});
				try {
					await Promise.race([operation.done, cancelled]);
				} finally {
					signal.removeEventListener("abort", abort);
				}
			}
		}
		return this.status(runId, owner);
	}
	summary(state) {
		const start = state.start;
		const operation = this.operations.get(start.runId);
		const step = start.resolvedWorkflowSnapshot.steps[state.checkpoint.cursor];
		return {
			revision: state.revision,
			runId: start.runId,
			...start.number === void 0 ? {} : { number: start.number },
			task: start.task,
			workflowId: start.workflowId,
			status: operation?.jobId !== void 0 ? state.status : state.status === "starting" || state.status === "running" ? "interrupted" : state.status,
			workspace: start.workspace,
			branch: start.branch,
			ownerSessionId: start.ownerSessionId,
			updatedAt: state.updatedAt,
			workspaceDisposition: state.workspaceDisposition,
			workspaceReason: state.workspaceReason,
			acceptedStories: state.checkpoint.stories?.filter((story) => story.status === "done").length ?? 0,
			totalStories: state.checkpoint.stories?.length ?? 0,
			reason: state.checkpoint.blocked ?? state.workspaceReason,
			...operation?.jobId === void 0 ? {} : { jobId: operation.jobId },
			...step === void 0 ? {} : { currentStep: step.id }
		};
	}
	async owned(runId, owner) {
		if ((await readJournalIdentity(this.config.journalRoot, runId)).data.ownerSessionId !== owner) throw new Error("antfarm run is not visible to this session");
		return RunJournal.open(this.config.journalRoot, runId);
	}
	async worktree(state, signal) {
		if (state.start.workspaceKind === "files") {
			if (fileWorkspacePath(state.start.baseCwd, state.start.runId) !== state.start.workspace) throw new Error("recorded file workspace identity changed");
			if (state.prepared) await validateFileWorkspace(state.start.workspace, state.start.runId);
			return null;
		}
		const repository = await prepareRepository(this.ctx.subprocess, state.start.baseCwd, signal);
		if (repository.root !== state.start.baseCwd) throw new Error("recorded repository root changed");
		const directory = relative(repository.root, dirname(state.start.workspace));
		const worktree = resolveWorktreeSpec({
			...repository,
			baseRevision: state.start.baseRevision
		}, directory, state.start.runId);
		if (worktree.path !== state.start.workspace || worktree.branch !== state.start.branch) throw new Error("recorded worktree identity changed");
		return worktree;
	}
	/**
	* Read up to fifty recent runs attributed to the selected session, including terminal evidence.
	* @param owner - Session authorizing the listing.
	* @returns Recent owner-attributed run summaries.
	*/
	async list(owner) {
		return this.storage.list(owner);
	}
	/**
	* Read a bounded page of Runs authorized by explicit Session resources.
	* @param owners - Explicit authorized resources.
	* @param offset - Number of newer rows already read.
	* @returns Bounded indexed page.
	*/
	async page(owners, offset) {
		return this.storage.page(owners, offset);
	}
	/**
	* Inspect accepted context and durable native child identities under session ownership.
	* @param runId - Durable run identity.
	* @param owner - Session authorizing inspection.
	* @returns Accepted state and any uncertain child attempt.
	*/
	async status(runId, owner) {
		const journal = this.operations.get(runId)?.journal ?? await this.owned(runId, owner);
		if (journal.state.start.ownerSessionId !== owner) throw new Error("antfarm run is not visible to this session");
		const state = journal.state;
		return {
			summary: this.summary(state),
			context: state.checkpoint.context,
			stories: state.checkpoint.stories ?? [],
			childSessionIds: [...state.childSessionIds],
			uncertain: state.openAttempt !== null,
			steps: state.start.resolvedWorkflowSnapshot.steps.map((step, index) => ({
				id: step.id,
				agent: step.agent,
				accepted: index < state.checkpoint.cursor
			})),
			acceptedChecks: state.checkpoint.acceptedChecks ?? {},
			artifacts: state.artifacts,
			retryGrant: state.retryGrant,
			checkEvidence: state.checks.slice(-50).map((check) => ({
				...check,
				stdout: check.stdout.slice(-2048),
				stderr: check.stderr.slice(-2048)
			})),
			...state.start.executionPolicy === void 0 ? {} : { executionPolicy: state.start.executionPolicy }
		};
	}
	/**
	* Resolve a unique owned Run by id, number, prefix or task text.
	* @param query - Exact id, stable number, id prefix or task text.
	* @param owner - Authorized owner.
	* @returns Unique run id.
	*/
	async find(query, owner) {
		if (query.trim() === "") throw new Error("select an Antfarm Run id, number or task");
		const matches = this.storage.search(owner, query);
		if (matches.length !== 1) throw new Error(matches.length === 0 ? "no matching Antfarm Run" : "multiple Runs match; select an exact Run id or number");
		return matches[0].runId;
	}
	/**
	* Read bounded committed events after an exclusive sequence cursor.
	* @param runId - Owned Run.
	* @param owner - Authorization resource.
	* @param after - Exclusive cursor.
	* @returns Up to fifty bounded facts.
	*/
	async events(runId, owner, after) {
		return (await this.owned(runId, owner)).records(after, 50).map((event) => ({
			seq: event.seq,
			time: event.time,
			type: event.type,
			detail: JSON.stringify(event.data).slice(0, 2048)
		}));
	}
	/**
	* Read a verified UTF-8 preview of a retained artifact.
	* @param runId - Owned Run.
	* @param owner - Authorization resource.
	* @param sha256 - Retained artifact.
	* @returns Bounded UTF-8 output text.
	*/
	async artifact(runId, owner, sha256) {
		const content = await this.artifactContent(runId, owner, sha256);
		const bytes = Buffer.from(content.base64, "base64");
		if (bytes.length > 1048576 || content.mime !== "text/plain") throw new Error("artifact exceeds the 1 MiB UTF-8 text preview limit");
		return bytes.toString("utf8");
	}
	/**
	* Read digest-verified retained bytes for download.
	* @param runId - Owned Run.
	* @param owner - Authorization resource.
	* @param sha256 - Retained digest.
	* @returns Verified output up to sixteen MiB.
	*/
	async artifactContent(runId, owner, sha256) {
		const journal = await this.owned(runId, owner);
		const artifact = journal.state.artifacts.find((value) => value.sha256 === sha256);
		if (artifact === void 0 || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error("artifact is not retained by this Run");
		if (artifact.bytes > 16777216) throw new Error("artifact exceeds the sixteen MiB download limit");
		const path = resolve(dirname(journal.eventsPath), "artifacts", sha256);
		if (await realpath(path) !== path) throw new Error("retained artifact must not be a symbolic link");
		const bytes = await readFile(path);
		if (bytes.length !== artifact.bytes || createHash("sha256").update(bytes).digest("hex") !== sha256) throw new Error("retained artifact integrity check failed");
		const text = bytes.toString("utf8");
		const mime = bytes.subarray(0, 8).equals(Buffer.from([
			137,
			80,
			78,
			71,
			13,
			10,
			26,
			10
		])) ? "image/png" : bytes.subarray(0, 3).equals(Buffer.from([
			255,
			216,
			255
		])) ? "image/jpeg" : Buffer.from(text).equals(bytes) ? "text/plain" : "application/octet-stream";
		return {
			path: artifact.path,
			mime,
			base64: bytes.toString("base64")
		};
	}
	/**
	* Cancel and await the active driver, or settle inactive owned evidence under a writer lease.
	* @param runId - Run to settle.
	* @param owner - Session authorizing cancellation.
	* @param reason - Diagnostic recorded in durable evidence.
	* @param revision - Optional expected journal revision; stale operations are refused.
	* @returns Summary after cancellation and active teardown.
	*/
	async cancel(runId, owner, reason = "cancelled by user", revision) {
		await this.owned(runId, owner);
		const active = this.operations.get(runId);
		if (active !== void 0) {
			if (revision !== void 0 && active.journal?.revision !== revision) throw new Error("Run changed; refresh before cancelling");
			active.controller.abort(new Error(reason));
			await active.done;
			return (await this.status(runId, owner)).summary;
		}
		const operation = this.reserve(runId, owner);
		try {
			const current = await this.owned(runId, owner);
			operation.journal = current;
			if (revision !== void 0 && current.revision !== revision) throw new Error("Run changed; refresh before cancelling");
			if ([
				"completed",
				"failed",
				"cancelled"
			].includes(current.state.status)) throw new Error("antfarm run is already settled");
			operation.controller.signal.throwIfAborted();
			await current.append({
				type: "run-end",
				data: {
					status: "cancelled",
					reason
				}
			});
			await current.append({
				type: "workspace-disposition",
				data: {
					disposition: "retained",
					reason
				}
			});
			this.project(current);
			return this.summary(current.state);
		} finally {
			this.release(runId, operation);
		}
	}
	/**
	* Remove only an inactive, identity-validated, clean worktree; retain its branch.
	* @param runId - Settled run whose workspace was reviewed.
	* @param owner - Session authorizing cleanup.
	* @param revision - Optional expected journal revision; stale operations are refused.
	* @returns Updated workspace disposition and retention reason.
	*/
	async cleanup(runId, owner, revision) {
		if (this.operations.has(runId)) throw new Error("cannot clean an active antfarm operation");
		await this.owned(runId, owner);
		const operation = this.reserve(runId, owner);
		try {
			const current = await this.owned(runId, owner);
			operation.journal = current;
			if (revision !== void 0 && current.revision !== revision) throw new Error("Run changed; refresh before cleaning");
			if (current.state.workspaceDisposition === "cleaned") return this.summary(current.state);
			if (![
				"completed",
				"failed",
				"cancelled"
			].includes(current.state.status)) throw new Error("cancel or complete the run before cleaning its workspace");
			const spec = await this.worktree(current.state, operation.controller.signal);
			operation.controller.signal.throwIfAborted();
			let result;
			if (spec === null) {
				const candidate = await fileCandidateVersion(current.state.start.workspace);
				const artifacts = await retainFileOutputs(current.state.start.workspace, resolve(dirname(current.eventsPath), "artifacts"));
				if (candidate !== await fileCandidateVersion(current.state.start.workspace)) throw new Error("file outputs changed during retention; inspect before cleaning");
				await current.append({
					type: "file-artifacts",
					data: {
						candidate,
						artifacts
					}
				});
				await rm(current.state.start.workspace, { recursive: true });
				result = {
					disposition: "cleaned",
					reason: "immutable file artifacts retained"
				};
			} else result = await cleanupWorktree(this.ctx.subprocess, spec);
			await current.append({
				type: "workspace-disposition",
				data: {
					disposition: result.disposition,
					reason: result.reason ?? ""
				}
			});
			this.project(current);
			return this.summary(current.state);
		} finally {
			this.release(runId, operation);
		}
	}
};
//#endregion
export { AntfarmRuntime, AntfarmRuntime as default };
