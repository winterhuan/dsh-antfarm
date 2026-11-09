import z from "@deepseek-ai/schemastery";
import { copyFile, lstat, mkdir, readFile, readdir, realpath, rename, rm, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as setTimeout$1 } from "node:timers/promises";
import { Service } from "@deepseek-ai/cordis";
import { SessionId } from "@deepseek-ai/dsh-session";
import { DatabaseSync } from "node:sqlite";
import { z as z$1 } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { installModelSelection } from "@deepseek-ai/dsh-agent";
import { parse, stringify } from "yaml";
//#region lib/types/persistence/schema.js
/**
* Create original business tables and apply their additive compatibility columns.
* @param db - Open Antfarm database.
*/
function migrate(db) {
	db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      context TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      step_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      input_template TEXT NOT NULL,
      expects TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      output TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      story_index INTEGER NOT NULL,
      story_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      output TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
	const cols = db.prepare("PRAGMA table_info(steps)").all();
	const colNames = new Set(cols.map((c) => c.name));
	if (!colNames.has("type")) db.exec("ALTER TABLE steps ADD COLUMN type TEXT NOT NULL DEFAULT 'single'");
	if (!colNames.has("loop_config")) db.exec("ALTER TABLE steps ADD COLUMN loop_config TEXT");
	if (!colNames.has("current_story_id")) db.exec("ALTER TABLE steps ADD COLUMN current_story_id TEXT");
	if (!colNames.has("abandoned_count")) db.exec("ALTER TABLE steps ADD COLUMN abandoned_count INTEGER DEFAULT 0");
	const runCols = db.prepare("PRAGMA table_info(runs)").all();
	const runColNames = new Set(runCols.map((c) => c.name));
	if (!runColNames.has("notify_url")) db.exec("ALTER TABLE runs ADD COLUMN notify_url TEXT");
	if (!runColNames.has("run_number")) {
		db.exec("ALTER TABLE runs ADD COLUMN run_number INTEGER");
		db.exec(`
      UPDATE runs SET run_number = (
        SELECT COUNT(*) FROM runs r2 WHERE r2.created_at <= runs.created_at
      ) WHERE run_number IS NULL
    `);
	}
}
//#endregion
//#region lib/types/persistence/database.js
/** Authoritative Antfarm rows and atomic worker transitions. Derived from snarktank/antfarm; see NOTICE. */
/** Original run row. */
const runRowSchema = z$1.object({
	id: z$1.string(),
	workflow_id: z$1.string(),
	task: z$1.string(),
	status: z$1.string(),
	context: z$1.string(),
	created_at: z$1.string(),
	updated_at: z$1.string(),
	notify_url: z$1.string().nullable(),
	run_number: z$1.number()
});
/** Original step row. */
const stepRowSchema = z$1.object({
	id: z$1.string(),
	run_id: z$1.string(),
	step_id: z$1.string(),
	agent_id: z$1.string(),
	step_index: z$1.number(),
	input_template: z$1.string(),
	expects: z$1.string(),
	status: z$1.enum([
		"pending",
		"waiting",
		"running",
		"done",
		"failed",
		"skipped"
	]),
	output: z$1.string().nullable(),
	retry_count: z$1.number(),
	max_retries: z$1.number(),
	created_at: z$1.string(),
	updated_at: z$1.string(),
	type: z$1.string(),
	loop_config: z$1.string().nullable(),
	current_story_id: z$1.string().nullable(),
	abandoned_count: z$1.number()
});
/** Original story row. */
const storyRowSchema = z$1.object({
	id: z$1.string(),
	run_id: z$1.string(),
	story_index: z$1.number(),
	story_id: z$1.string(),
	title: z$1.string(),
	description: z$1.string(),
	acceptance_criteria: z$1.string(),
	status: z$1.enum([
		"pending",
		"running",
		"done",
		"failed"
	]),
	output: z$1.string().nullable(),
	retry_count: z$1.number(),
	max_retries: z$1.number(),
	created_at: z$1.string(),
	updated_at: z$1.string()
});
/** DSH association; workflow progress remains in the original tables. */
const runBindingSchema = z$1.object({
	run_id: z$1.string(),
	owner: z$1.string(),
	cwd: z$1.string(),
	workflow: z$1.string(),
	request_id: z$1.string().nullable(),
	revision: z$1.number(),
	paused: z$1.number(),
	reason: z$1.string().nullable()
});
/** Native execution identity used to reject duplicate or late results. */
const attemptRowSchema = z$1.object({
	session_id: z$1.string(),
	run_id: z$1.string(),
	step_id: z$1.string(),
	agent_id: z$1.string(),
	pid: z$1.number(),
	state: z$1.string(),
	started_at: z$1.string(),
	finished_at: z$1.string().nullable()
});
const now = () => (/* @__PURE__ */ new Date()).toISOString();
/** @param output - Original KEY: value response. @returns Lowercase context entries. */
function parseOutputKeyValues(output) {
	const values = {};
	let key;
	for (const line of output.split("\n")) {
		const match = /^([A-Z_]+):\s*(.*)$/.exec(line);
		if (match) {
			key = match[1].toLowerCase();
			values[key] = match[2];
		} else if (key) values[key] += "\n" + line;
	}
	for (const key of Object.keys(values)) values[key] = values[key].trim();
	delete values.stories_json;
	return values;
}
/** @param template - Original input. @param context - Run facts. @returns Input with case-insensitive placeholders. */
function resolveTemplate(template, context) {
	return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key) => context[key] ?? context[key.toLowerCase()] ?? `[missing: ${key}]`);
}
/** One database connection; each multi-row transition commits as a unit. */
var AntfarmDatabase = class {
	onEvent;
	db;
	eventPath;
	pendingEvents;
	hostToken;
	/** @param path - antfarm.db path, distinct from historical journal directories. */
	constructor(path, onEvent) {
		this.onEvent = onEvent;
		mkdirSync(dirname(path), { recursive: true });
		this.eventPath = join(dirname(path), "events.jsonl");
		this.db = new DatabaseSync(path);
		this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
		migrate(this.db);
		this.db.exec(`CREATE TABLE IF NOT EXISTS dsh_runs (run_id TEXT PRIMARY KEY REFERENCES runs(id), owner TEXT NOT NULL, cwd TEXT NOT NULL, workflow TEXT NOT NULL, request_id TEXT, revision INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, reason TEXT, UNIQUE(owner,request_id));
      CREATE TABLE IF NOT EXISTS dsh_attempts (session_id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), step_id TEXT NOT NULL REFERENCES steps(id), agent_id TEXT NOT NULL, pid INTEGER NOT NULL, state TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS dsh_active_step ON dsh_attempts(step_id) WHERE state='running';
      CREATE UNIQUE INDEX IF NOT EXISTS dsh_active_agent ON dsh_attempts(agent_id) WHERE state='running';
      CREATE TABLE IF NOT EXISTS dsh_host (id INTEGER PRIMARY KEY CHECK(id=1), pid INTEGER NOT NULL, token TEXT NOT NULL);`);
	}
	/** Acquire the exclusive native dispatcher; original business rows remain accessible to readers. */
	acquireHost() {
		const token = randomUUID();
		this.transaction(() => {
			const row = this.db.prepare("SELECT pid FROM dsh_host WHERE id=1").get();
			if (row) {
				try {
					process.kill(Number(row.pid), 0);
				} catch (error) {
					if (!(error instanceof Error && "code" in error && error.code === "ESRCH")) throw error;
					this.db.prepare("DELETE FROM dsh_host WHERE id=1").run();
				}
				if (this.db.prepare("SELECT 1 FROM dsh_host WHERE id=1").get()) throw new Error("Another Antfarm host owns this database");
			}
			this.db.prepare("INSERT INTO dsh_host(id,pid,token) VALUES(1,?,?)").run(process.pid, token);
		});
		this.hostToken = token;
	}
	/** Close after all native attempts have settled. */
	dispose() {
		if (this.hostToken) this.db.prepare("DELETE FROM dsh_host WHERE token=?").run(this.hostToken);
		this.db.close();
	}
	/** @param work - Synchronous SQL operation. @returns Its committed value. */
	transaction(work) {
		this.db.exec("BEGIN IMMEDIATE");
		this.pendingEvents = [];
		let result;
		try {
			result = work();
			this.db.exec("COMMIT");
		} catch (error) {
			this.db.exec("ROLLBACK");
			this.pendingEvents = void 0;
			throw error;
		}
		const events = this.pendingEvents;
		this.pendingEvents = void 0;
		for (const event of events) this.writeEvent(event);
		return result;
	}
	writeEvent(event) {
		try {
			appendFileSync(this.eventPath, JSON.stringify(event) + "\n", { mode: 384 });
		} catch (error) {
			console.error("Antfarm event log unavailable:", error instanceof Error ? error.message : String(error));
		}
		try {
			this.onEvent?.(event, this.run(event.runId).notify_url);
		} catch (error) {
			console.error("Antfarm event subscriber unavailable:", error instanceof Error ? error.message : String(error));
		}
	}
	event(runId, event, step, detail) {
		const value = {
			ts: now(),
			event,
			runId,
			workflowId: this.run(runId).workflow_id,
			...step ? {
				stepId: step.step_id,
				agentId: step.agent_id
			} : {},
			...detail ? { detail } : {}
		};
		if (this.pendingEvents) this.pendingEvents.push(value);
		else this.writeEvent(value);
	}
	touch(runId) {
		this.db.prepare("UPDATE runs SET updated_at=? WHERE id=?").run(now(), runId);
		this.db.prepare("UPDATE dsh_runs SET revision=revision+1 WHERE run_id=?").run(runId);
	}
	/** @param id - Run identity. @returns Original run row. */
	run(id) {
		const row = this.db.prepare("SELECT * FROM runs WHERE id=?").get(id);
		if (!row) throw new Error("run not found");
		return runRowSchema.parse(row);
	}
	/** @param id - Run identity. @returns Native owner association. */
	binding(id) {
		const row = this.db.prepare("SELECT * FROM dsh_runs WHERE run_id=?").get(id);
		if (!row) throw new Error("run has no DSH owner");
		return runBindingSchema.parse(row);
	}
	/** @param runId - Run identity. @returns Ordered original steps. */
	steps(runId) {
		return this.db.prepare("SELECT * FROM steps WHERE run_id=? ORDER BY step_index").all(runId).map((row) => stepRowSchema.parse(row));
	}
	/** @param runId - Run identity. @returns Ordered original stories. */
	stories(runId) {
		return this.db.prepare("SELECT * FROM stories WHERE run_id=? ORDER BY story_index").all(runId).map((row) => storyRowSchema.parse(row));
	}
	/** @param owner - Optional owning Session. @returns Newest runs associated with DSH. */
	list(owner) {
		return this.db.prepare(`SELECT r.* FROM runs r JOIN dsh_runs d ON d.run_id=r.id ${owner === void 0 ? "" : "WHERE d.owner=?"} ORDER BY r.run_number DESC`).all(...owner === void 0 ? [] : [owner]).map((row) => runRowSchema.parse(row));
	}
	/** @param runId - Run identity. @returns Native execution history. */
	attempts(runId) {
		return this.db.prepare("SELECT * FROM dsh_attempts WHERE run_id=? ORDER BY started_at,rowid").all(runId).map((row) => attemptRowSchema.parse(row));
	}
	/** @param workflow - Original definition. @param task - User request. @param owner - Native root Session. @param cwd - Project directory. @param requestId - Idempotent admission key. @param notifyUrl - Explicit webhook. @returns Stored run id. */
	start(workflow, task, owner, cwd, requestId, notifyUrl) {
		return this.transaction(() => {
			if (requestId) {
				const previous = this.db.prepare("SELECT run_id,workflow FROM dsh_runs WHERE owner=? AND request_id=?").get(owner, requestId);
				if (previous) {
					const run = this.run(previous.run_id);
					if (run.task !== task || run.workflow_id !== workflow.id) throw new Error("request id already belongs to another task");
					return run.id;
				}
			}
			const id = randomUUID(), time = now();
			const number = Number(this.db.prepare("SELECT COALESCE(MAX(run_number),0)+1 AS next FROM runs").get()["next"]);
			this.db.prepare("INSERT INTO runs(id,workflow_id,task,status,context,created_at,updated_at,notify_url,run_number) VALUES(?,?,?,'running',?,?,?,?,?)").run(id, workflow.id, task, JSON.stringify({
				task,
				...workflow.context
			}), time, time, notifyUrl ?? workflow.notifications?.url ?? null, number);
			this.db.prepare("INSERT INTO dsh_runs(run_id,owner,cwd,workflow,request_id) VALUES(?,?,?,?,?)").run(id, owner, cwd, JSON.stringify(workflow), requestId ?? null);
			const insert = this.db.prepare("INSERT INTO steps(id,run_id,step_id,agent_id,step_index,input_template,expects,status,max_retries,type,loop_config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)");
			workflow.steps.forEach((step, index) => insert.run(randomUUID(), id, step.id, `${workflow.id}_${step.agent}`, index, step.input, step.expects, index === 0 ? "pending" : "waiting", step.max_retries, step.type, step.loop ? JSON.stringify(step.loop) : null, time, time));
			this.event(id, "run.started");
			return id;
		});
	}
	/** @param agentId - Workflow-qualified identity. @returns Original inexpensive work indicator. */
	peek(agentId) {
		return this.db.prepare("SELECT 1 FROM steps s JOIN runs r ON r.id=s.run_id WHERE s.agent_id=? AND s.status IN ('pending','waiting') AND r.status='running' LIMIT 1").get(agentId) ? "HAS_WORK" : "NO_WORK";
	}
	/** @param runId - Scheduled run. @param progress - Agent progress text. @param frontend - Original frontend detection. @returns Exclusive ready attempt, if any. */
	claim(runId, progress = "(no progress yet)", frontend = "false") {
		return this.transaction(() => {
			if (this.run(runId).status !== "running" || this.binding(runId).paused) return;
			const steps = this.steps(runId);
			const step = steps.find((candidate) => candidate.status === "pending" && steps.filter((previous) => previous.step_index < candidate.step_index).every((previous) => ["done", "skipped"].includes(previous.status) || previous.type === "loop" && previous.status === "running" && JSON.parse(previous.loop_config ?? "{}").verifyStep === candidate.step_id));
			if (!step || this.db.prepare("SELECT 1 FROM dsh_attempts WHERE agent_id=? AND state='running'").get(step.agent_id)) return;
			const context = JSON.parse(this.run(runId).context);
			context.run_id = runId;
			context.has_frontend_changes = frontend;
			const stories = this.stories(runId);
			if (stories.length) context.progress = progress;
			if (step.type === "loop") {
				if (!stories.length) {
					this.failRun(step, "Loop cannot run because planning did not produce STORIES_JSON.");
					return;
				}
				const story = stories.find((story) => story.status === "pending");
				if (!story) {
					this.continueLoop(step);
					return;
				}
				this.db.prepare("UPDATE stories SET status='running',updated_at=? WHERE id=?").run(now(), story.id);
				step.current_story_id = story.id;
				context.current_story = `Story ${story.story_id}: ${story.title}\n\n${story.description}\n\nAcceptance Criteria:\n${JSON.parse(story.acceptance_criteria).map((value, index) => `  ${index + 1}. ${value}`).join("\n")}`;
				context.current_story_id = story.story_id;
				context.current_story_title = story.title;
				context.completed_stories = stories.filter((story) => story.status === "done").map((story) => `- ${story.story_id}: ${story.title}`).join("\n") || "(none yet)";
				context.stories_remaining = String(stories.filter((story) => ["pending", "running"].includes(story.status)).length);
				context.progress = progress;
				context.verify_feedback ??= "";
				this.db.prepare("UPDATE runs SET context=? WHERE id=?").run(JSON.stringify(context), runId);
				this.event(runId, "story.started", step, story.story_id);
			}
			const missing = [...step.input_template.matchAll(/\{\{(\w+(?:\.\w+)*)\}\}/g)].map((match) => match[1]).filter((key) => context[key] === void 0 && context[key.toLowerCase()] === void 0);
			if (missing.length) {
				this.failRun(step, `Step input is not ready: missing required template key(s) ${[...new Set(missing)].join(", ")}`);
				return;
			}
			this.db.prepare("UPDATE runs SET context=? WHERE id=?").run(JSON.stringify(context), runId);
			const sessionId = randomUUID();
			this.db.prepare("UPDATE steps SET status='running',current_story_id=?,updated_at=? WHERE id=?").run(step.current_story_id, now(), step.id);
			this.db.prepare("INSERT INTO dsh_attempts(session_id,run_id,step_id,agent_id,pid,state,started_at) VALUES(?,?,?,?,?,'running',?)").run(sessionId, runId, step.id, step.agent_id, process.pid, now());
			this.touch(runId);
			this.event(runId, "step.running", step);
			const input = [resolveTemplate(step.input_template, context)];
			if (context.baseline) input.push(`Baseline: ${context.baseline}`);
			if (context.ci_notes) input.push(`CI notes: ${context.ci_notes}`);
			if (step.output && parseOutputKeyValues(step.output).status !== "done") input.push(`Previous attempt feedback:\n${step.output}`);
			if (context.resume_guidance) input.push(`Recovery guidance:\n${context.resume_guidance}`);
			return {
				step: {
					...step,
					status: "running"
				},
				sessionId,
				input: input.join("\n\n"),
				context
			};
		});
	}
	active(sessionId) {
		const attempt = this.db.prepare("SELECT * FROM dsh_attempts WHERE session_id=? AND state='running'").get(sessionId);
		if (!attempt || this.run(attempt.run_id).status !== "running") return;
		const step = this.steps(attempt.run_id).find((step) => step.id === attempt.step_id);
		return step?.status === "running" ? {
			attempt,
			step
		} : void 0;
	}
	settle(sessionId, state) {
		this.db.prepare("UPDATE dsh_attempts SET state=?,finished_at=? WHERE session_id=?").run(state, now(), sessionId);
	}
	/** @param sessionId - Exact claimant. @param output - Worker text with an explicit STATUS. @returns Whether the current attempt was accepted, retried or rejected. @throws If the reply omits a valid status or expected success text. */
	complete(sessionId, output) {
		if (!this.active(sessionId)) return false;
		const parsed = parseOutputKeyValues(output);
		const status = parsed.status?.toLowerCase();
		if (status === "failed") return this.fail(sessionId, output);
		if (status !== "done" && status !== "retry") throw new Error("Worker reply must include STATUS: done, STATUS: retry or STATUS: failed.");
		return this.transaction(() => {
			const active = this.active(sessionId);
			if (!active) return false;
			const { step } = active;
			const loopStep = this.steps(step.run_id).find((row) => row.type === "loop" && JSON.parse(row.loop_config ?? "{}").verifyEach && JSON.parse(row.loop_config ?? "{}").verifyStep === step.step_id);
			if (status === "retry" && !loopStep) {
				this.settle(sessionId, "failed");
				this.failRun(step, output);
				this.touch(step.run_id);
				return true;
			}
			if (status === "done" && !output.includes(step.expects)) throw new Error(`Worker reply does not contain expected output: ${step.expects}`);
			const context = {
				...JSON.parse(this.run(step.run_id).context),
				...parsed
			};
			this.insertStories(step.run_id, output);
			this.db.prepare("UPDATE runs SET context=? WHERE id=?").run(JSON.stringify(context), step.run_id);
			this.settle(sessionId, "done");
			this.db.prepare("UPDATE steps SET output=?,updated_at=? WHERE id=?").run(output, now(), step.id);
			if (step.type === "loop" && step.current_story_id) {
				this.db.prepare("UPDATE stories SET status='done',output=?,updated_at=? WHERE id=?").run(output, now(), step.current_story_id);
				this.db.prepare("UPDATE steps SET current_story_id=NULL WHERE id=?").run(step.id);
				this.event(step.run_id, "story.done", step);
				const loop = JSON.parse(step.loop_config ?? "{}");
				if (loop.verifyEach && loop.verifyStep) this.db.prepare("UPDATE steps SET status='pending',updated_at=? WHERE run_id=? AND step_id=?").run(now(), step.run_id, loop.verifyStep);
				else this.continueLoop(step);
			} else if (loopStep) {
				this.db.prepare("UPDATE steps SET status='waiting' WHERE id=?").run(step.id);
				if (status === "retry") {
					const story = this.stories(step.run_id).filter((row) => row.status === "done").at(-1);
					if (story) {
						const retry = story.retry_count + 1;
						this.db.prepare("UPDATE stories SET status=?,retry_count=?,updated_at=? WHERE id=?").run(retry > story.max_retries ? "failed" : "pending", retry, now(), story.id);
						if (retry > story.max_retries) this.failRun(loopStep, "Verification retries exhausted");
						else {
							context.verify_feedback = context.issues ?? output;
							this.db.prepare("UPDATE steps SET status='pending' WHERE id=?").run(loopStep.id);
							this.event(step.run_id, "story.retry", step, context.verify_feedback);
						}
					}
				} else {
					delete context.verify_feedback;
					this.event(step.run_id, "story.verified", step);
					this.continueLoop(loopStep);
				}
				this.db.prepare("UPDATE runs SET context=? WHERE id=?").run(JSON.stringify(context), step.run_id);
			} else {
				this.db.prepare("UPDATE steps SET status='done' WHERE id=?").run(step.id);
				this.event(step.run_id, "step.done", step);
				this.advance(step.run_id);
			}
			this.touch(step.run_id);
			return true;
		});
	}
	insertStories(runId, output) {
		const match = /^STORIES_JSON:\s*([\s\S]*?)(?=^[A-Z_]+:\s|$(?![\s\S]))/m.exec(output);
		if (!match) return;
		const parsed = JSON.parse(match[1]);
		if (!Array.isArray(parsed) || parsed.length > 20) throw new Error("STORIES_JSON must be an array of at most 20 stories");
		const seen = /* @__PURE__ */ new Set();
		for (const raw of parsed) {
			if (!raw || typeof raw !== "object") throw new Error("invalid story");
			const row = raw, criteria = row.acceptanceCriteria ?? row.acceptance_criteria;
			if (typeof row.id !== "string" || !row.id || typeof row.title !== "string" || typeof row.description !== "string" || !Array.isArray(criteria) || !criteria.length || criteria.some((value) => typeof value !== "string") || seen.has(row.id)) throw new Error("story requires unique id, title, description and acceptanceCriteria");
			seen.add(row.id);
			this.db.prepare("INSERT INTO stories(id,run_id,story_index,story_id,title,description,acceptance_criteria,status,retry_count,max_retries,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'pending',0,2,?,?)").run(randomUUID(), runId, seen.size - 1, row.id, row.title, row.description, JSON.stringify(criteria), now(), now());
		}
	}
	continueLoop(step) {
		const stories = this.stories(step.run_id);
		if (stories.some((story) => story.status === "pending")) {
			this.db.prepare("UPDATE steps SET status='pending',updated_at=? WHERE id=?").run(now(), step.id);
			return;
		}
		if (stories.some((story) => story.status === "failed")) {
			this.failRun(step, "Loop has failed stories and no pending stories");
			return;
		}
		this.db.prepare("UPDATE steps SET status='done',updated_at=? WHERE id=?").run(now(), step.id);
		const loop = JSON.parse(step.loop_config ?? "{}");
		if (loop.verifyEach && loop.verifyStep) this.db.prepare("UPDATE steps SET status='done' WHERE run_id=? AND step_id=?").run(step.run_id, loop.verifyStep);
		this.advance(step.run_id);
	}
	advance(runId) {
		if (this.run(runId).status !== "running") return;
		const steps = this.steps(runId);
		if (steps.some((step) => [
			"running",
			"pending",
			"failed"
		].includes(step.status))) return;
		const next = steps.find((step) => step.status === "waiting");
		if (next) {
			this.db.prepare("UPDATE steps SET status='pending',updated_at=? WHERE id=?").run(now(), next.id);
			this.event(runId, "pipeline.advanced", next);
			this.event(runId, "step.pending", next);
		} else {
			this.db.prepare("UPDATE runs SET status='completed' WHERE id=?").run(runId);
			this.event(runId, "run.completed");
		}
	}
	failRun(step, error) {
		this.db.prepare("UPDATE steps SET status='failed',output=?,updated_at=? WHERE id=?").run(error, now(), step.id);
		this.db.prepare("UPDATE runs SET status='failed' WHERE id=?").run(step.run_id);
		this.touch(step.run_id);
		this.event(step.run_id, "step.failed", step, error);
		this.event(step.run_id, "run.failed", step, error);
	}
	/** @param sessionId - Exact claimant. @param error - Failure text. @returns Whether a current attempt failed. */
	fail(sessionId, error) {
		return this.transaction(() => {
			const active = this.active(sessionId);
			if (!active) return false;
			const { step } = active;
			this.settle(sessionId, "failed");
			const story = step.current_story_id ? this.stories(step.run_id).find((row) => row.id === step.current_story_id) : void 0;
			const retry = (story?.retry_count ?? step.retry_count) + 1, maximum = story?.max_retries ?? step.max_retries;
			if (story) this.db.prepare("UPDATE stories SET status=?,retry_count=?,updated_at=? WHERE id=?").run(retry > maximum ? "failed" : "pending", retry, now(), story.id);
			else this.db.prepare("UPDATE steps SET retry_count=? WHERE id=?").run(retry, step.id);
			if (retry > maximum) this.failRun(step, error);
			else this.db.prepare("UPDATE steps SET status='pending',current_story_id=NULL,output=?,updated_at=? WHERE id=?").run(error, now(), step.id);
			this.touch(step.run_id);
			return true;
		});
	}
	/** @param sessionId - Timed-out claimant whose child has stopped. @returns Whether its original abandonment budget changed. */
	abandon(sessionId) {
		const active = this.active(sessionId);
		if (!active) return false;
		if (active.step.current_story_id) return this.fail(sessionId, "Story abandoned");
		return this.transaction(() => {
			const { step } = active;
			this.settle(sessionId, "abandoned");
			const count = step.abandoned_count + 1;
			this.db.prepare("UPDATE steps SET abandoned_count=? WHERE id=?").run(count, step.id);
			if (count >= 5) this.failRun(step, "Agent abandoned step without completing five times");
			else this.db.prepare("UPDATE steps SET status='pending',updated_at=? WHERE id=?").run(now(), step.id);
			this.touch(step.run_id);
			this.event(step.run_id, "step.timeout", step);
			return true;
		});
	}
	/** @param runId - Stopped execution. @param reason - Native interruption. */
	pause(runId, reason) {
		this.db.prepare("UPDATE dsh_runs SET paused=1,reason=?,revision=revision+1 WHERE run_id=?").run(reason, runId);
	}
	/** @param runId - Cancelled run. */
	cancel(runId) {
		this.transaction(() => {
			this.db.prepare("UPDATE runs SET status='cancelled' WHERE id=?").run(runId);
			this.db.prepare("UPDATE steps SET status='failed',output='Cancelled by user',updated_at=? WHERE run_id=? AND status IN ('waiting','pending','running')").run(now(), runId);
			this.db.prepare("UPDATE dsh_attempts SET state='cancelled',finished_at=? WHERE run_id=? AND state='running'").run(now(), runId);
			this.touch(runId);
			this.event(runId, "run.failed", void 0, "Cancelled by user");
		});
	}
	/** @param runId - Failed or interrupted run. @param guidance - User recovery input. */
	resume(runId, guidance = "") {
		this.transaction(() => {
			const run = this.run(runId);
			if (["completed", "cancelled"].includes(run.status)) throw new Error("terminal run cannot resume");
			if (run.status === "running" && !this.binding(runId).paused) throw new Error("Only failed or interrupted runs can resume");
			const steps = this.steps(runId);
			let step = steps.find((row) => row.status === "failed") ?? steps.find((row) => row.status === "running");
			if (step) {
				const loop = steps.find((row) => row.type === "loop" && JSON.parse(row.loop_config ?? "{}").verifyStep === step.step_id);
				if (loop) {
					this.db.prepare("UPDATE steps SET status='waiting',retry_count=0,updated_at=? WHERE id=?").run(now(), step.id);
					step = loop;
				}
				this.db.prepare("UPDATE stories SET status='pending',updated_at=? WHERE run_id=? AND status IN ('failed','running')").run(now(), runId);
				this.db.prepare("UPDATE steps SET status='pending',current_story_id=NULL,retry_count=0,updated_at=? WHERE id=?").run(now(), step.id);
				this.db.prepare("UPDATE dsh_attempts SET state='interrupted',finished_at=? WHERE run_id=? AND state='running'").run(now(), runId);
			}
			const context = JSON.parse(run.context);
			if (guidance) context.resume_guidance = guidance;
			else delete context.resume_guidance;
			this.db.prepare("UPDATE runs SET status='running',context=? WHERE id=?").run(JSON.stringify(context), runId);
			this.db.prepare("UPDATE dsh_runs SET paused=0,reason=NULL WHERE run_id=?").run(runId);
			this.touch(runId);
		});
	}
	/** @param runId - Observed run. @returns Events in append order. */
	events(runId) {
		try {
			return readFileSync(this.eventPath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)).filter((event) => event.runId === runId);
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
			throw error;
		}
	}
};
//#endregion
//#region lib/types/persistence/legacy.js
/** Read historical per-run journals without changing or replaying their business state. */
const identity = z$1.object({
	runId: z$1.string(),
	ownerSessionId: z$1.string(),
	workflowId: z$1.string(),
	workspace: z$1.string(),
	branch: z$1.string(),
	task: z$1.string().optional(),
	number: z$1.number().optional()
});
const envelope = z$1.object({
	version: z$1.number(),
	seq: z$1.number().int(),
	time: z$1.number(),
	type: z$1.string(),
	data: z$1.record(z$1.string(), z$1.unknown())
});
const checkpoint = z$1.object({
	context: z$1.record(z$1.string(), z$1.string()),
	stories: z$1.array(z$1.object({
		id: z$1.string(),
		title: z$1.string(),
		description: z$1.string(),
		acceptanceCriteria: z$1.array(z$1.string()),
		maxRetries: z$1.number(),
		retryCount: z$1.number(),
		status: z$1.enum([
			"pending",
			"done",
			"retry",
			"failed"
		]),
		feedback: z$1.string().optional()
	})).nullable()
});
/** Historical data stays outside the original-format SQLite executor. */
var LegacyRuns = class {
	root;
	/** @param root - Historical per-run journal directory. */
	constructor(root) {
		this.root = root;
	}
	async read(runId) {
		if (!/^af-[a-z0-9-]{1,64}$/.test(runId)) throw new Error("invalid historical run id");
		const root = await realpath(this.root);
		const directory = join(root, runId);
		const path = join(directory, "events.jsonl");
		if (await realpath(directory) !== directory || await realpath(path) !== path) throw new Error("historical journal must not use symbolic links");
		if ((await stat(path)).size > 67108864) throw new Error("historical journal exceeds 64 MiB");
		const source = await readFile(path, "utf8");
		const lines = source.split("\n");
		const first = envelope.parse(JSON.parse(lines[0]));
		if (first.type !== "run-start") throw new Error("historical journal has no start identity");
		const start = identity.parse(first.data);
		if (start.runId !== runId) throw new Error("historical journal identity differs from directory");
		const events = [];
		let corrupt = !source.endsWith("\n");
		for (const line of lines.slice(0, -1)) try {
			const event = envelope.parse(JSON.parse(line));
			if (event.seq !== events.length || event.version !== first.version) throw new Error("historical journal sequence changed");
			events.push(event);
		} catch (error) {
			if (!(error instanceof Error)) throw error;
			corrupt = true;
			break;
		}
		return {
			start,
			events,
			corrupt
		};
	}
	/** @param runId - Historical identity. @param owner - Read authority. @returns Valid complete-prefix facts, marked inspection-only. */
	async status(runId, owner) {
		const { start, events, corrupt } = await this.read(runId);
		if (start.ownerSessionId !== owner) throw new Error("run belongs to another Session");
		const saved = events.findLast((event) => event.type === "checkpoint");
		const projection = saved ? checkpoint.safeParse(saved.data) : void 0;
		const last = events.at(-1);
		return {
			summary: {
				runId: start.runId,
				ownerSessionId: start.ownerSessionId,
				workflowId: start.workflowId,
				workspace: start.workspace,
				branch: start.branch,
				...start.task === void 0 ? {} : { task: start.task },
				...start.number === void 0 ? {} : { number: start.number },
				status: corrupt ? "corrupt" : "legacy",
				updatedAt: last?.time ?? 0,
				workspaceDisposition: "retained",
				reason: "Historical journal: inspect its files and native Sessions; execution is disabled."
			},
			context: projection?.success ? projection.data.context : {},
			stories: projection?.success ? projection.data.stories ?? [] : [],
			childSessionIds: events.filter((event) => event.type === "attempt-start").flatMap((event) => typeof event.data.childSessionId === "string" ? [event.data.childSessionId] : []),
			uncertain: false
		};
	}
	/** @param owner - Read authority. @returns Attributable historical runs. Unreadable identities remain on disk. */
	async list(owner) {
		let entries;
		try {
			entries = await readdir(this.root);
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
			throw error;
		}
		const results = [];
		for (const entry of entries) {
			if (!/^af-[a-z0-9-]{1,64}$/.test(entry)) continue;
			try {
				const value = await this.status(entry, owner);
				results.push(value);
			} catch (error) {
				if (!(error instanceof Error)) throw error;
			}
		}
		return results;
	}
	/** @param runId - Historical identity. @param owner - Read authority. @param after - Exclusive cursor. @returns A hundred complete-prefix events. */
	async events(runId, owner, after) {
		const { start, events } = await this.read(runId);
		if (start.ownerSessionId !== owner) throw new Error("run belongs to another Session");
		return events.filter((event) => event.seq > after).slice(0, 100).map((event) => ({
			seq: event.seq,
			time: event.time,
			type: event.type,
			detail: JSON.stringify(event.data).slice(0, 4e3)
		}));
	}
};
//#endregion
//#region lib/types/runtime/agents.js
/** Stable Antfarm identities rendered into fresh native child Sessions. */
const writes = /* @__PURE__ */ new Set([
	"write",
	"edit",
	"apply_patch"
]);
const delegation = /* @__PURE__ */ new Set([
	"subagent",
	"subagent_fork",
	"workflow",
	"spawn_teammate",
	"send_message",
	"interrupt_agent",
	"list_agents",
	"wait_agent",
	"antfarm_run",
	"antfarm_resume"
]);
/** A role deadline expires without an original completion response. */
var AttemptTimeoutError = class extends Error {};
/** Child teardown cannot confirm that effects have stopped. */
var AttemptTeardownError = class extends Error {};
/** @param role - Original role. @param tool - DSH tool name. @returns Whether the role may invoke the tool. */
function roleAllows(role, tool) {
	if (delegation.has(tool) || tool.startsWith("team_task_")) return false;
	if (tool.startsWith("schedule_") || tool === "plugin_manager") return false;
	if (role !== "coding" && writes.has(tool)) return false;
	if (["web_search", "web_fetch"].includes(tool)) return role === "testing" || role === "scanning";
	if (tool.includes("browser") || tool.startsWith("computer_")) return role === "testing";
	return ![
		"image",
		"tts",
		"gateway",
		"cron",
		"message",
		"nodes",
		"canvas"
	].includes(tool);
}
/** DSH transport; persona is selected by attempt identity, never by a role preset. */
var AntfarmAgents = class {
	ctx;
	root;
	active = /* @__PURE__ */ new Map();
	/** @param ctx - Native host. @param root - Private installed agent workspaces. */
	constructor(ctx, root) {
		this.ctx = ctx;
		this.root = root;
		ctx.effect(() => ctx.systemPrompt.section({
			name: "antfarm-identity",
			order: 640,
			interpolate: false,
			text: (context) => this.active.get(context.agent?.id ?? "")?.persona ?? ""
		}));
		ctx.effect(() => ctx.tools.guard((exec) => {
			const identity = this.active.get(exec.agent?.id ?? "");
			return identity && !roleAllows(identity.agent.role, exec.name) ? `Antfarm ${identity.agent.role} role cannot invoke ${exec.name}.` : void 0;
		}));
		ctx.on("agent/created", ({ agent }) => {
			const identity = this.active.get(agent.id);
			if (!identity) return;
			for (const tool of ctx.tools.schemas(agent)) if (!roleAllows(identity.agent.role, tool.name)) try {
				agent.ctx.tools.restrict({ deny: [tool.name] });
			} catch (error) {
				if (!(error instanceof Error) || !error.message.includes("unknown global tool")) throw error;
			}
		});
	}
	/** @param workflow - Installed method. @param agent - Stable role identity. @param provision - Update owned resources only under a claimed agent. @returns Canonical workspace path. */
	async workspace(workflow, agent, provision = true) {
		await mkdir(this.root, { recursive: true });
		const root = await realpath(this.root), target = resolve(root, workflow.id, agent.workspace.baseDir);
		const rel = relative(root, target);
		if (isAbsolute(rel) || rel.startsWith(`..${sep}`)) throw new Error("agent workspace escaped its root");
		let path = root;
		for (const part of rel.split(sep)) {
			path = join(path, part);
			await mkdir(path, { recursive: true });
			if (await realpath(path) !== path) throw new Error("agent workspace must not use symbolic links");
		}
		if (!provision) return target;
		const manifestPath = join(target, ".antfarm-persona.json");
		let previous = {};
		try {
			if (await realpath(manifestPath) !== manifestPath) throw new Error("agent resource manifest must not be a symbolic link");
			previous = z$1.record(z$1.string(), z$1.string()).parse(JSON.parse(await readFile(manifestPath, "utf8")));
		} catch (error) {
			if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
		}
		const digests = {};
		for (const [name, content] of Object.entries(agent.files)) {
			const file = resolve(target, name);
			if (!file.startsWith(target + sep)) throw new Error("agent resource escaped workspace");
			await mkdir(dirname(file), { recursive: true });
			if (await realpath(dirname(file)) !== dirname(file)) throw new Error("agent resource directory must not use symbolic links");
			try {
				await writeFile(file, content, {
					flag: "wx",
					mode: 384
				});
			} catch (error) {
				if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
				if (await realpath(file) !== file) throw new Error("agent resource must not be a symbolic link");
				const current = await readFile(file, "utf8");
				const sourceDigest = createHash("sha256").update(content).digest("hex");
				if (current !== content && previous[name] !== sourceDigest) {
					if (previous[name] !== createHash("sha256").update(current).digest("hex")) throw new Error(`Agent resource ${name} has local edits; save them in the workflow definition before starting`);
					await writeFile(file, content, { mode: 384 });
				}
			}
			digests[name] = createHash("sha256").update(content).digest("hex");
		}
		await writeFile(manifestPath, JSON.stringify(digests), { mode: 384 });
		return target;
	}
	/** @param workflow - Run method. @param claim - Persisted claimant. @param parent - Native owner. @param cwd - Agent workspace. @param project - Owner project. @param provider - Native spawn provider. @param signal - Attempt cancellation. @returns Original text output. */
	async execute(workflow, claim, parent, cwd, project, provider, signal) {
		const agent = workflow.agents.find((agent) => `${workflow.id}_${agent.id}` === claim.step.agent_id);
		if (!agent) throw new Error("claimed agent is not in workflow");
		const sections = await Promise.all(Object.keys(agent.files).map(async (name) => {
			const content = await readFile(join(cwd, name), "utf8");
			const missing = [...content.matchAll(/\{\{(\w+(?:\.\w+)*)\}\}/g)].map((match) => match[1]).filter((key) => claim.context[key] === void 0 && claim.context[key.toLowerCase()] === void 0);
			if (missing.length) throw new Error(`Agent resource ${name} is missing context: ${[...new Set(missing)].join(", ")}`);
			return `## ${name}\n${resolveTemplate(content, claim.context)}`;
		}));
		for (const name of agent.workspace.skills ?? []) {
			const skill = await this.ctx.get("skills")?.get(name, {
				cwd: project,
				scope: parent,
				signal
			});
			if (!skill) {
				sections.push(`## Optional skill: ${name}\nThis skill is unavailable in the owning DSH profile. Use available tools; report any capability needed to finish the task.`);
				continue;
			}
			sections.push(`## Skill: ${name}\n${skill.path ? `Instruction path: ${skill.path}\n` : ""}${skill.content}`);
		}
		const persona = `# Antfarm identity: ${workflow.id}/${agent.id}\n${sections.join("\n\n")}`;
		this.active.set(claim.sessionId, {
			agent,
			persona
		});
		const model = agent.model ?? workflow.polling?.model;
		const controller = new AbortController(), timer = setTimeout(() => controller.abort(new AttemptTimeoutError("Antfarm step timed out")), agent.timeoutSeconds * 1e3);
		const attemptSignal = AbortSignal.any([signal, controller.signal]);
		try {
			const activation = await this.ctx.subagents.startActivation({
				provider,
				label: agent.name,
				childId: SessionId(claim.sessionId),
				delivery: "caller",
				signal: attemptSignal,
				request: {
					parent,
					cwd,
					agentPreset: "standard",
					prompt: [{
						type: "text",
						text: `Project directory: ${project}\n\n${claim.input}\n\nReturn the requested KEY: value output in your final reply. Use STATUS: done only when the work succeeds. Use STATUS: retry with specific feedback when verification rejects the work. If you cannot execute the task, return STATUS: failed and ERROR: the reason. The host records the result; do not call the OpenClaw antfarm CLI.`
					}],
					...model === void 0 || model === "default" ? {} : { agentOptions: { model } }
				}
			});
			let disposal;
			const dispose = () => disposal ??= activation.dispose();
			let abort;
			try {
				const cancelled = new Promise((_resolve, reject) => {
					abort = () => {
						dispose().catch(reject);
						reject(attemptSignal.reason);
					};
					attemptSignal.addEventListener("abort", abort, { once: true });
					if (attemptSignal.aborted) abort();
				});
				const result = await Promise.race([activation.result, cancelled]);
				attemptSignal.throwIfAborted();
				if (result.stopReason !== "completed") throw new Error(result.diagnostic ?? `Agent stopped: ${result.stopReason}`);
				return result.output.filter((block) => block.type === "text").map((block) => block.text).join("\n");
			} finally {
				if (abort) attemptSignal.removeEventListener("abort", abort);
				try {
					await dispose();
				} catch (error) {
					throw new AttemptTeardownError("Native child teardown failed; inspect the attempt before resuming", { cause: error });
				}
			}
		} finally {
			clearTimeout(timer);
			this.active.delete(claim.sessionId);
		}
	}
};
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
//#region lib/types/runtime/notifications.js
/** Own all HTTP requests until they settle or the host stops. */
var WorkflowNotifications = class {
	timeoutMs;
	token;
	controller = new AbortController();
	pending = /* @__PURE__ */ new Set();
	/** @param timeoutMs - Request deadline. @param token - Optional deployment credential. */
	constructor(timeoutMs, token) {
		this.timeoutMs = timeoutMs;
		this.token = token;
	}
	/** @param event - Committed original event. @param endpoint - Explicit workflow/run subscription. */
	send(event, endpoint) {
		if (!endpoint || this.controller.signal.aborted) return;
		const url = publicWebhookUrl(endpoint);
		const request = fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...this.token ? { Authorization: this.token } : {}
			},
			body: JSON.stringify(event),
			signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(this.timeoutMs)])
		}).then(async (response) => {
			await response.body?.cancel();
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
		}).catch((error) => {
			if (!this.controller.signal.aborted) console.error("Antfarm webhook delivery failed:", error instanceof Error ? error.name : "request failure");
		}).finally(() => {
			this.pending.delete(request);
		});
		this.pending.add(request);
	}
	/** Abort pending requests and wait for all request callbacks. */
	async dispose() {
		this.controller.abort();
		await Promise.allSettled(this.pending);
	}
};
//#endregion
//#region lib/types/runtime/progress.js
/** Original progress files and frontend-change context use the native subprocess provider. */
/** @param files - Changed Git paths. @returns Whether production frontend files changed, following Antfarm's detector. */
function isFrontendChange(files) {
	return files.some((file) => {
		if ([
			".test.",
			".spec.",
			"__tests__/"
		].some((value) => file.includes(value))) return false;
		if (/\.(html|css|scss|less|jsx|tsx|vue|svelte)$/i.test(file)) return true;
		return /(^|\/)(public|static|assets|components|pages|views|styles)\//.test(file.replaceAll("\\", "/"));
	});
}
/** @param ctx - Native subprocess owner. @param repo - Recorded project. @param branch - Original branch output. @param signal - Run lifetime. @param timeoutMs - Git deadline. @param graceMs - Native termination grace. @returns Original true/false frontend context. */
async function frontendChanges(ctx, repo, branch, signal, timeoutMs, graceMs) {
	const timeout = AbortSignal.timeout(timeoutMs);
	const handle = ctx.subprocess.spawn({
		argv: [
			"git",
			"diff",
			"--name-only",
			`main..${branch}`
		],
		cwd: repo,
		stdio: {
			stdin: "ignore",
			stdout: { maxBytes: 1048576 },
			stderr: { maxBytes: 4096 }
		},
		graceMs,
		signal: AbortSignal.any([signal, timeout])
	});
	try {
		const outcome = await handle.done;
		signal.throwIfAborted();
		const output = handle.collected.stdout?.readFrom(0);
		return outcome.exitCode === 0 && output && !output.lossy && isFrontendChange(output.text.split("\n")) ? "true" : "false";
	} finally {
		handle.terminate();
		await handle.waitForExit();
	}
}
/** @param workspace - Stable developer workspace. @param runId - Original run identity. @returns Per-run progress, falling back to the original shared file. */
async function readProgress(workspace, runId) {
	for (const path of [join(workspace, `progress-${runId}.txt`), join(workspace, "progress.txt")]) try {
		return {
			path,
			text: await readFile(path, "utf8")
		};
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
	}
}
/** @param workspace - Stable developer workspace. @param runId - Completed original run. */
async function archiveProgress(workspace, runId) {
	const progress = await readProgress(workspace, runId);
	if (!progress) return;
	const archive = join(workspace, "archive", runId);
	await mkdir(archive, { recursive: true });
	await copyFile(progress.path, join(archive, "progress.txt"));
	await unlink(progress.path);
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
//#region lib/types/workflow/loader.js
/** Parse original YAML and read role resources within the selected source root. */
const id = z$1.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const fail = z$1.object({
	retry_step: id.optional(),
	max_retries: z$1.number().int().nonnegative().optional(),
	escalate_to: z$1.string().optional(),
	on_exhausted: z$1.object({ escalate_to: z$1.string().optional() }).optional()
});
const schema = z$1.object({
	id,
	name: z$1.string().optional(),
	version: z$1.number().int().positive().default(1),
	description: z$1.string().optional(),
	context: z$1.record(z$1.string(), z$1.string()).default({}),
	polling: z$1.object({
		model: z$1.string().optional(),
		timeoutSeconds: z$1.number().positive().optional()
	}).optional(),
	cron: z$1.object({ interval_ms: z$1.number().int().positive() }).optional(),
	notifications: z$1.object({ url: z$1.string().url().optional() }).optional(),
	agents: z$1.array(z$1.object({
		id,
		name: z$1.string().optional(),
		role: z$1.enum([
			"analysis",
			"coding",
			"verification",
			"testing",
			"pr",
			"scanning"
		]).optional(),
		description: z$1.string().optional(),
		model: z$1.string().optional(),
		pollingModel: z$1.string().optional(),
		timeoutSeconds: z$1.number().int().positive().max(2147483).optional(),
		workspace: z$1.object({
			baseDir: z$1.string().min(1),
			files: z$1.record(z$1.string(), z$1.string().min(1)),
			skills: z$1.array(z$1.string()).optional()
		})
	})).min(1),
	steps: z$1.array(z$1.object({
		id,
		agent: id,
		type: z$1.enum(["single", "loop"]).default("single"),
		input: z$1.string().min(1),
		expects: z$1.string().min(1),
		max_retries: z$1.number().int().nonnegative().optional(),
		on_fail: fail.optional(),
		loop: z$1.object({
			over: z$1.literal("stories"),
			completion: z$1.literal("all_done"),
			fresh_session: z$1.boolean().optional(),
			freshSession: z$1.boolean().optional(),
			verify_each: z$1.boolean().optional(),
			verifyEach: z$1.boolean().optional(),
			verify_step: id.optional(),
			verifyStep: id.optional()
		}).optional()
	})).min(1)
});
/**
* Parse editable original YAML with the same shape used by workflow loading.
* @param document - Original workflow YAML.
* @returns Validated document fields.
*/
function parseWorkflowDocument(document) {
	return schema.parse(parse(document));
}
function validateReferences(workflow) {
	const names = new Set(workflow.agents.map((agent) => agent.id));
	const stepIds = new Set(workflow.steps.map((step) => step.id));
	if (names.size !== workflow.agents.length || stepIds.size !== workflow.steps.length) throw new Error("duplicate workflow agent or step id");
	for (const agent of workflow.agents) {
		if (isAbsolute(agent.workspace.baseDir) || agent.workspace.baseDir.split(/[\\/]/).includes("..")) throw new Error("agent workspace must remain a relative child directory");
		for (const name of Object.keys(agent.files)) if (isAbsolute(name) || name.split(/[\\/]/).includes("..")) throw new Error("agent file must remain within its workspace");
	}
	for (const step of workflow.steps) {
		if (!names.has(step.agent)) throw new Error(`unknown agent ${step.agent}`);
		if (step.type === "loop" && step.loop === void 0) throw new Error("loop step requires loop configuration");
		if (step.loop?.verifyEach && (!step.loop.verifyStep || !stepIds.has(step.loop.verifyStep))) throw new Error("loop verification step is missing");
		if (step.on_fail?.retry_step && !stepIds.has(step.on_fail.retry_step)) throw new Error("retry step is missing");
	}
}
/** @param name - Original agent id. @returns Original inferred tool role. */
function inferRole(name) {
	if (/planner|prioritizer|reviewer|investigator|triager/.test(name)) return "analysis";
	if (name.includes("verifier")) return "verification";
	if (name.includes("tester")) return "testing";
	if (name.includes("scanner")) return "scanning";
	return name === "pr" ? "pr" : "coding";
}
/** @param document - Original YAML. @param directory - Its directory. @param sourceRoot - Allowed resource root. @returns Resolved identity and workflow snapshot. */
async function parseWorkflow(document, directory, sourceRoot) {
	const value = parseWorkflowDocument(document);
	if (value.notifications?.url) publicWebhookUrl(value.notifications.url);
	const root = await realpath(sourceRoot);
	const sourceDirectory = await realpath(directory);
	const confined = async (path) => {
		const canonical = await realpath(path);
		const rel = relative(root, canonical);
		if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`)) throw new Error("workflow resource escapes its selected source root");
		return canonical;
	};
	await confined(directory);
	const agents = await Promise.all(value.agents.map(async (agent) => {
		if (isAbsolute(agent.workspace.baseDir) || agent.workspace.baseDir.split(/[\\/]/).includes("..")) throw new Error("agent workspace must remain a relative child directory");
		const files = {};
		for (const [name, path] of Object.entries(agent.workspace.files)) {
			if (isAbsolute(name) || name.split(/[\\/]/).includes("..")) throw new Error("agent file must remain within its workspace");
			const content = await readFile(await confined(resolve(sourceDirectory, path)), "utf8");
			if (Buffer.byteLength(content) > 65536) throw new Error("agent resource exceeds 64 KiB");
			files[name] = content;
		}
		const role = agent.role ?? inferRole(agent.id);
		return {
			...agent,
			name: agent.name ?? agent.id,
			role,
			timeoutSeconds: agent.timeoutSeconds ?? (role === "coding" || role === "testing" ? 1800 : 1200),
			files
		};
	}));
	const steps = value.steps.map((step) => ({
		...step,
		max_retries: step.max_retries ?? step.on_fail?.max_retries ?? 2,
		...step.loop === void 0 ? {} : { loop: {
			over: step.loop.over,
			completion: step.loop.completion,
			freshSession: step.loop.fresh_session ?? step.loop.freshSession ?? true,
			verifyEach: step.loop.verify_each ?? step.loop.verifyEach ?? false,
			...step.loop.verify_step === void 0 && step.loop.verifyStep === void 0 ? {} : { verifyStep: step.loop.verify_step ?? step.loop.verifyStep }
		} }
	}));
	validateReferences({
		agents,
		steps
	});
	return {
		...value,
		name: value.name ?? value.id,
		agents,
		steps,
		sourceDirectory,
		document
	};
}
/** @param id - Workflow directory name. @param roots - Precedence-ordered registries. @returns Resolved original workflow. */
async function loadWorkflow(id, roots) {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("invalid workflow id");
	for (const root of roots) {
		const directory = join(root, id);
		let document;
		try {
			document = await readFile(join(directory, "workflow.yml"), "utf8");
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
			throw error;
		}
		const sourceRoot = root.endsWith(`${sep}workflows`) ? dirname(root) : root;
		const workflow = await parseWorkflow(document, directory, sourceRoot);
		if (workflow.id !== id) throw new Error("workflow id differs from directory");
		return workflow;
	}
	throw new Error(`workflow ${id} was not found`);
}
/** @param value - Saved resolved workflow. @returns Checked native storage value. */
function validateResolvedWorkflow(value) {
	const saved = schema.extend({
		name: z$1.string(),
		document: z$1.string(),
		sourceDirectory: z$1.string(),
		agents: z$1.array(schema.shape.agents.element.extend({
			name: z$1.string(),
			role: z$1.enum([
				"analysis",
				"coding",
				"verification",
				"testing",
				"pr",
				"scanning"
			]),
			timeoutSeconds: z$1.number().int().positive().max(2147483),
			files: z$1.record(z$1.string(), z$1.string())
		})).min(1),
		steps: z$1.array(schema.shape.steps.element.extend({ max_retries: z$1.number().int().nonnegative() })).min(1)
	}).parse(value);
	validateReferences(saved);
	if (saved.notifications?.url) publicWebhookUrl(saved.notifications.url);
	return saved;
}
//#endregion
//#region lib/types/workflow/original.js
/** Original-format imports use the same parser as bundled and custom workflows. */
/** @param document - Original YAML. @param directory - Workflow directory. @param sourceRoot - Explicit resource root. @returns Resolved original workflow. */
async function importOriginalWorkflow(document, directory, sourceRoot) {
	return parseWorkflow(document, directory, sourceRoot);
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
	const definition = parseWorkflowDocument(workflow.document);
	const files = {};
	definition.agents = workflow.agents.map((agent) => {
		const original = definition.agents.find((row) => row.id === agent.id);
		const references = {};
		for (const [name, content] of Object.entries(agent.files)) {
			const path = `agents/${agent.id}/${name}`;
			files[path] = content;
			references[name] = path;
		}
		return {
			...original,
			workspace: {
				...original.workspace,
				files: references
			}
		};
	});
	const document = stringify(definition);
	const revision = createHash("sha256").update(JSON.stringify({
		document,
		files
	})).digest("hex");
	return {
		id: workflow.id,
		document,
		files,
		revision,
		sourceDirectory: workflow.sourceDirectory
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
			const definition = parseWorkflowDocument(source.document);
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
	import(directory, sourceRoot, root) {
		return this.serialize(async () => {
			const canonical = await realpath(directory);
			const path = await realpath(join(canonical, "workflow.yml"));
			if (path !== join(canonical, "workflow.yml")) throw new Error("import document must not be a symbolic link");
			const workflow = validateResolvedWorkflow(await importOriginalWorkflow(await readFile(path, "utf8"), canonical, sourceRoot));
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
			const value = draft(workflow);
			for (const [name, content] of Object.entries(value.files)) {
				const file = child(revisionDirectory, name);
				await mkdir(dirname(file), { recursive: true });
				await writeFile(file, content, {
					flag: "wx",
					mode: 384
				});
			}
			const definition = parseWorkflowDocument(value.document);
			for (const agent of definition.agents) for (const name of Object.keys(agent.workspace.files)) agent.workspace.files[name] = `${relativeRevision}/${agent.workspace.files[name]}`;
			const canonicalDocument = stringify(definition);
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
//#region lib/types/runtime/index.js
/** Original Antfarm workflows on native DSH child Sessions and SQLite. */
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
const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.resolve("@winterhuan/dsh-antfarm/package.json")));
/** Owns native execution; workflow state is read directly from SQLite. */
var AntfarmRuntime = class extends Service {
	config;
	static inject = [
		"agents",
		"sessions",
		"workingDirectory",
		"agentPresets",
		"jobs",
		"subagents",
		"subprocess",
		"systemPrompt",
		"tools"
	];
	static Config = z.object({
		journalRoot: z.string().required(),
		workflowDirs: z.array(z.string()).default([]),
		defaultWorkflowId: z.string().default("feature-dev").volatile(),
		subagentProvider: z.string().default("spawn"),
		maxActiveRunsPerOwner: z.natural().min(1).max(100).default(2),
		maxActiveRuns: z.natural().min(1).max(100).default(8),
		dispatchIntervalMs: z.natural().min(10).max(2147483647).default(1e3),
		gitTimeoutMs: z.natural().min(1).max(2147483647).default(1e4),
		subprocessGraceMs: z.natural().min(1).max(2147483647).default(1e3),
		webhookTimeoutMs: z.natural().min(1).max(2147483647).default(5e3),
		webhookTokenEnv: z.string(),
		healthEnabled: z.boolean().default(true).volatile(),
		healthIntervalMs: z.natural().min(1e3).max(2147483647).default(3e5).volatile()
	});
	database;
	legacy;
	notifications;
	operations = /* @__PURE__ */ new Map();
	capacity;
	owners;
	agents;
	workflows = new WorkflowManager(resolve(PACKAGE_ROOT, "workflows"));
	closing = false;
	timer;
	history = [];
	constructor(ctx, config) {
		super(ctx, "antfarm");
		this.config = config;
		this.legacy = new LegacyRuns(config.journalRoot);
		const token = config.webhookTokenEnv ? process.env[config.webhookTokenEnv] : void 0;
		if (config.webhookTokenEnv && !token) throw new Error("Configured Antfarm webhook credential environment variable is missing");
		this.notifications = new WorkflowNotifications(config.webhookTimeoutMs, token);
		this.capacity = new RunCapacity(config.maxActiveRuns, config.maxActiveRunsPerOwner);
		this.owners = new RunOwnerResolver(ctx);
		this.agents = new AntfarmAgents(ctx, join(dirname(config.journalRoot), "workspaces"));
		ctx.on("agent/disposed", ({ agent }) => {
			for (const operation of this.operations.values()) if (operation.owner === agent.id) {
				operation.interrupted = true;
				operation.controller.abort(/* @__PURE__ */ new Error("owning Agent unloaded"));
			}
		});
		ctx.on("workspace/session-stop", ({ sessionId }) => {
			for (const operation of this.operations.values()) if (operation.owner === sessionId) {
				operation.interrupted = true;
				operation.controller.abort(/* @__PURE__ */ new Error("owning Session stopped"));
			}
		});
		ctx.effect(() => async () => {
			this.closing = true;
			clearTimeout(this.timer);
			for (const operation of this.operations.values()) {
				operation.interrupted = true;
				operation.controller.abort(/* @__PURE__ */ new Error("Antfarm host stopped"));
			}
			await Promise.allSettled([...this.operations.values()].map((operation) => operation.done));
			await this.notifications.dispose();
			await this.owners.dispose();
			this.database?.dispose();
		});
	}
	/** Open original-format SQLite and resume safe queued work through its owner. */
	async [Service.init]() {
		this.database = new AntfarmDatabase(join(dirname(this.config.journalRoot), "antfarm.db"), (event, endpoint) => this.notifications.send(event, endpoint));
		this.database.acquireHost();
		for (const run of this.database.list()) if (run.status === "running") {
			if (this.database.attempts(run.id).some((attempt) => attempt.state === "running")) {
				this.database.pause(run.id, "Inspect the interrupted native attempt before resuming");
				continue;
			}
			if (!this.database.binding(run.id).paused) try {
				this.launch(run.id, await this.owners.resolve(SessionId(this.database.binding(run.id).owner)));
			} catch (error) {
				this.database.pause(run.id, String(error));
			}
		}
		this.scheduleHealth();
	}
	scheduleHealth() {
		if (this.closing) return;
		this.timer = setTimeout(() => {
			(this.config.healthEnabled.get() ? this.checkHealth() : Promise.resolve()).catch((error) => console.error("Antfarm health check failed:", error instanceof Error ? error.message : String(error))).finally(() => this.scheduleHealth());
		}, this.config.healthIntervalMs.get());
		this.timer.unref();
	}
	/**
	* Diagnose inactive native execution without approving or replaying work.
	* @param owner - Optional owner filter.
	* @returns Native execution diagnostics.
	*/
	async checkHealth(owner) {
		const findings = [];
		for (const run of this.database.list(owner)) if (run.status === "running" && !this.operations.has(run.id)) findings.push({
			runId: run.id,
			kind: "inactive",
			detail: this.database.binding(run.id).reason ?? "No active native execution"
		});
		const report = {
			time: Date.now(),
			enabled: this.config.healthEnabled.get(),
			findings
		};
		this.history.push(report);
		if (this.history.length > 20) this.history.shift();
		return report;
	}
	/**
	* Read Session-authorized diagnostic history.
	* @param owner - Authorized owner.
	* @returns Recent diagnostic history.
	*/
	async healthHistory(owner) {
		const ids = new Set(this.database.list(owner).map((run) => run.id));
		const reports = this.history.map((report) => ({
			...report,
			findings: report.findings.filter((row) => ids.has(row.runId))
		}));
		return {
			reports,
			issues24h: reports.filter((report) => report.time >= Date.now() - 864e5).reduce((sum, report) => sum + report.findings.length, 0),
			enabled: this.config.healthEnabled.get(),
			intervalMs: this.config.healthIntervalMs.get()
		};
	}
	/**
	* Dispatch safe inactive work through the original native owner.
	* @param owner - Original owner.
	* @returns Runs dispatched without changing completed work.
	*/
	async ensureExecution(owner) {
		const started = [];
		for (const run of this.database.list(owner)) if (run.status === "running" && !this.operations.has(run.id) && !this.database.binding(run.id).paused) {
			this.launch(run.id, await this.owners.resolve(owner));
			started.push(run.id);
		}
		return started;
	}
	/** SQLite is authoritative and requires no journal index rebuild. */
	get indexError() {}
	/**
	* Restore the original root Session authority without a model turn.
	* @param owner - Original root Session.
	* @returns Its live execution authority.
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
		return [await projectWorkflowRoot(cwd), ...this.config.workflowDirs];
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
		return [await projectWorkflowRoot(await this.ctx.workingDirectory.ensure(parent)), ...this.config.workflowDirs];
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
	* @returns Installed project copy.
	*/
	async importWorkflow(parent, directory, sourceRoot) {
		const roots = await this.workflowRoots(parent);
		this.live(parent, new AbortController().signal);
		return this.workflows.import(directory, sourceRoot, roots[0]);
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
		if (this.database.list().some((run) => run.workflow_id === id && run.status === "running")) throw new Error("settle active workflow Runs before uninstalling their resources");
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
			if (!ids.includes(this.database.run(runId).workflow_id)) continue;
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
		if (this.closing || this.ctx.agents.get(parent.id) !== parent || parent.session.header.origin === "subagent") throw new Error("Antfarm requires a live root owner");
	}
	owned(runId, owner) {
		const run = this.database.run(runId);
		if (this.database.binding(runId).owner !== owner) throw new Error("run belongs to another Session");
		return run;
	}
	/**
	* Persist original workflow admission before accepting native execution.
	* @param request - Owner and original workflow task.
	* @returns Durable admission receipt.
	*/
	async start(request) {
		this.live(request.parent, request.signal ?? new AbortController().signal);
		const id = request.workflowId ?? this.config.defaultWorkflowId.get(), roots = await this.workflowRoots(request.parent);
		if (!await this.workflows.enabled(id, roots)) throw new Error("workflow is disabled");
		const workflow = await loadWorkflow(id, [...roots, join(PACKAGE_ROOT, "workflows")]);
		if (request.notificationUrl) publicWebhookUrl(request.notificationUrl);
		const provider = this.ctx.subagents.getProvider(this.config.subagentProvider);
		if (!provider || provider.inheritsParentContext || !provider.prepareContinuable) throw new Error("Antfarm requires a fresh local DSH child provider");
		const cwd = await realpath(await this.ctx.workingDirectory.ensure(request.parent));
		for (const agent of workflow.agents) await this.agents.workspace(workflow, agent, false);
		this.live(request.parent, request.signal ?? new AbortController().signal);
		const runId = this.database.start(workflow, request.task, request.parent.id, cwd, request.requestId, request.notificationUrl);
		if (!this.operations.has(runId) && this.database.run(runId).status === "running" && !this.database.binding(runId).paused) this.launch(runId, request.parent);
		return this.receipt(runId);
	}
	/**
	* Resume a failed or reconciled interrupted run through its original owner.
	* @param request - Original owner and recovery guidance.
	* @returns Resumed run receipt.
	*/
	async resume(request) {
		this.live(request.parent, request.signal ?? new AbortController().signal);
		this.owned(request.runId, request.parent.id);
		if (this.operations.has(request.runId)) throw new Error("run already has an executor");
		this.revision(request.runId, request.revision);
		const active = this.database.attempts(request.runId).filter((attempt) => attempt.state === "running");
		for (const attempt of active) if (this.ctx.agents.get(SessionId(attempt.session_id))) throw new Error("stop the active native attempt before resuming");
		if (active.length && !request.guidance?.trim()) throw new Error("inspect the interrupted attempt and provide recovery guidance");
		this.database.resume(request.runId, request.guidance);
		this.launch(request.runId, request.parent);
		return this.receipt(request.runId);
	}
	receipt(runId) {
		const summary = this.summary(this.database.run(runId));
		return {
			runId,
			workflowId: summary.workflowId,
			status: summary.status,
			workspace: summary.workspace,
			branch: summary.branch,
			...this.operations.get(runId)?.jobId ? { jobId: this.operations.get(runId).jobId } : {}
		};
	}
	launch(runId, parent) {
		if (this.operations.has(runId)) throw new Error("run already has an executor");
		const operation = {
			owner: parent.id,
			controller: new AbortController(),
			done: Promise.resolve(),
			interrupted: false
		};
		this.operations.set(runId, operation);
		const drive = async () => {
			let release;
			try {
				release = await this.capacity.acquire(parent.id, operation.controller.signal);
				const binding = this.database.binding(runId), workflow = validateResolvedWorkflow(JSON.parse(binding.workflow));
				const loop = workflow.steps.find((step) => step.type === "loop"), worker = workflow.agents.find((agent) => agent.id === loop?.agent);
				while (this.database.run(runId).status === "running") {
					this.live(parent, operation.controller.signal);
					const before = this.database.binding(runId).revision;
					const context = JSON.parse(this.database.run(runId).context);
					let progress = "(no progress yet)";
					if (worker) progress = (await readProgress(await this.agents.workspace(workflow, worker, false), runId))?.text ?? progress;
					const frontend = context.repo && context.branch ? await frontendChanges(this.ctx, context.repo, context.branch, operation.controller.signal, this.config.gitTimeoutMs, this.config.subprocessGraceMs) : "false";
					const claim = this.database.claim(runId, progress, frontend);
					if (!claim) {
						if (this.database.binding(runId).revision !== before) continue;
						await setTimeout$1(this.config.dispatchIntervalMs, void 0, { signal: operation.controller.signal });
						continue;
					}
					const agent = workflow.agents.find((agent) => `${workflow.id}_${agent.id}` === claim.step.agent_id);
					try {
						const cwd = await this.agents.workspace(workflow, agent);
						const output = await this.agents.execute(workflow, claim, parent, cwd, binding.cwd, this.config.subagentProvider, operation.controller.signal);
						operation.controller.signal.throwIfAborted();
						this.database.complete(claim.sessionId, output);
					} catch (error) {
						if (error instanceof AttemptTeardownError) throw error;
						if (operation.controller.signal.aborted) throw error;
						if (error instanceof AttemptTimeoutError) this.database.abandon(claim.sessionId);
						else this.database.fail(claim.sessionId, String(error));
					}
				}
				if (worker) try {
					await archiveProgress(await this.agents.workspace(workflow, worker, false), runId);
				} catch (error) {
					console.error("Antfarm progress archive failed:", error instanceof Error ? error.message : String(error));
				}
				return {
					status: this.database.run(runId).status === "completed" ? "completed" : "failed",
					detail: this.database.run(runId).status
				};
			} catch (error) {
				if (operation.interrupted || error instanceof AttemptTeardownError) this.database.pause(runId, String(error));
				else if (operation.controller.signal.aborted) this.database.cancel(runId);
				else this.database.pause(runId, String(error));
				return {
					status: "failed",
					detail: String(error)
				};
			} finally {
				release?.();
				this.operations.delete(runId);
			}
		};
		try {
			operation.jobId = this.ctx.jobs.start({
				kind: "antfarm",
				label: `Antfarm ${this.database.run(runId).workflow_id}`,
				owner: parent.id,
				run: () => {
					const done = drive();
					operation.done = done.then(() => {});
					return {
						cancel: (reason) => operation.controller.abort(new Error(reason ?? "cancelled")),
						done
					};
				}
			});
		} catch (error) {
			operation.interrupted = true;
			operation.controller.abort(error);
			this.database.pause(runId, String(error));
			this.operations.delete(runId);
			throw new Error(`Run ${runId} was admitted but its native job could not start; inspect and resume it`, { cause: error });
		}
	}
	summary(run) {
		const binding = this.database.binding(run.id), stories = this.database.stories(run.id), context = JSON.parse(run.context);
		return {
			runId: run.id,
			number: run.run_number,
			task: run.task,
			revision: binding.revision,
			workflowId: run.workflow_id,
			status: binding.paused && run.status === "running" ? "interrupted" : run.status,
			workspace: context.repo ?? binding.cwd,
			branch: context.branch ?? "",
			currentStep: this.database.steps(run.id).find((step) => ["running", "pending"].includes(step.status))?.step_id,
			ownerSessionId: binding.owner,
			updatedAt: Date.parse(run.updated_at.endsWith("Z") ? run.updated_at : run.updated_at + "Z"),
			workspaceDisposition: "retained",
			acceptedStories: stories.filter((story) => story.status === "done").length,
			totalStories: stories.length,
			...binding.reason ? { reason: binding.reason } : {}
		};
	}
	/**
	* Combine original SQL runs and attributable read-only historical snapshots.
	* @param owner - Selected Session.
	* @returns Its original SQLite runs.
	*/
	async list(owner) {
		return [...this.database.list(owner).map((run) => this.summary(run)), ...(await this.legacy.list(owner)).map((value) => value.summary)].sort((a, b) => b.updatedAt - a.updatedAt);
	}
	/**
	* Read bounded owner-authorized run summaries.
	* @param owners - Authorized Sessions.
	* @param offset - Page offset.
	* @returns Fifty runs.
	*/
	async page(owners, offset) {
		return (await Promise.all(owners.map((owner) => this.list(owner)))).flat().sort((a, b) => b.updatedAt - a.updatedAt).slice(offset, offset + 50);
	}
	/**
	* Read original business rows and native attempt addresses.
	* @param runId - Run identity.
	* @param owner - Authorized owner.
	* @returns Business state and native attempts.
	*/
	async status(runId, owner) {
		if (runId.startsWith("af-")) return this.legacy.status(runId, owner);
		const run = this.owned(runId, owner), attempts = this.database.attempts(runId);
		return {
			summary: this.summary(run),
			context: JSON.parse(run.context),
			stories: this.database.stories(runId).map((row) => ({
				id: row.story_id,
				title: row.title,
				description: row.description,
				acceptanceCriteria: JSON.parse(row.acceptance_criteria),
				status: row.status,
				retryCount: row.retry_count,
				maxRetries: row.max_retries
			})),
			steps: this.database.steps(runId).map((step) => ({
				id: step.step_id,
				agent: step.agent_id,
				status: step.status,
				output: step.output,
				retries: step.retry_count
			})),
			childSessionIds: attempts.map((attempt) => attempt.session_id),
			uncertain: attempts.some((attempt) => attempt.state === "running") && !this.operations.has(runId)
		};
	}
	/**
	* Wait for the current executor without transferring Run cancellation to the caller.
	* @param runId - Run identity.
	* @param owner - Authorized owner.
	* @param signal - Caller wait.
	* @returns Settled state.
	*/
	async wait(runId, owner, signal) {
		this.owned(runId, owner);
		signal?.throwIfAborted();
		let abort;
		try {
			const done = this.operations.get(runId)?.done;
			if (signal) await Promise.race([done, new Promise((_resolve, reject) => {
				abort = () => reject(signal.reason);
				signal.addEventListener("abort", abort, { once: true });
			})]);
			else await done;
			return this.status(runId, owner);
		} finally {
			if (signal && abort) signal.removeEventListener("abort", abort);
		}
	}
	/**
	* Resolve an owner-scoped exact id, number or unique textual query.
	* @param query - Run number, task or id prefix.
	* @param owner - Authorized owner.
	* @returns Unique match.
	*/
	async find(query, owner) {
		const rows = await this.list(owner);
		const exact = rows.find((run) => run.runId === query || String(run.number) === query);
		if (exact) return exact.runId;
		const matches = rows.filter((run) => run.runId.startsWith(query) || (run.task ?? "").toLowerCase().includes(query.toLowerCase()));
		if (matches.length !== 1) throw new Error(matches.length ? "ambiguous run query" : "run not found");
		return matches[0].runId;
	}
	/**
	* Read complete observation events without using them as business state.
	* @param runId - Run identity.
	* @param owner - Authorized owner.
	* @param after - Event offset.
	* @returns Observation log page.
	*/
	async events(runId, owner, after) {
		if (!Number.isInteger(after) || after < -1) throw new Error("invalid event cursor");
		if (runId.startsWith("af-")) return this.legacy.events(runId, owner, after);
		this.owned(runId, owner);
		return this.database.events(runId).map((event, index) => ({
			seq: index + 1,
			time: Date.parse(event.ts),
			type: event.event,
			detail: event.detail ?? event.stepId ?? ""
		})).filter((event) => event.seq > after).slice(0, 100);
	}
	revision(runId, expected) {
		if (expected !== void 0 && this.database.binding(runId).revision !== expected) throw new Error("Run changed; refresh before applying this operation");
	}
	/**
	* Stop the exact native child and wait for disposal before acknowledging cancellation.
	* @param runId - Owned run.
	* @param owner - Root Session.
	* @param reason - User cancellation reason.
	* @param revision - Expected revision.
	* @returns Cancelled state after child exit.
	*/
	async cancel(runId, owner, reason = "cancelled by user", revision) {
		const run = this.owned(runId, owner);
		this.revision(runId, revision);
		if (["completed", "cancelled"].includes(run.status)) return this.summary(run);
		const operation = this.operations.get(runId);
		if (operation) {
			operation.controller.abort(new Error(reason));
			await operation.done;
		} else this.database.cancel(runId);
		return this.summary(this.database.run(runId));
	}
};
//#endregion
export { AntfarmRuntime, AntfarmRuntime as default };
