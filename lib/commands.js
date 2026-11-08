import { CommandDefinitionId } from "@deepseek-ai/dsh-commands";
//#region lib/types/commands/index.js
const name = "antfarm-commands";
const inject = ["antfarm", "commands"];
const USAGE = "Usage: /antfarm <task...> | run [--workflow <id>] <task...> | fix <task...> | audit <task...> | smoke <task...> | list | status <runId> | stories <runId> | logs [runId] | cancel <runId> [reason...] | resume <runId> [--retry-grant 1..20] [guidance...] | cleanup <runId> | workflows | import <directory> <sourceRoot> [--files] | install|uninstall <id|all> [--force] | health | ensure-execution | help | version | ant";
const SHORTCUTS = {
	fix: "bug-fix",
	audit: "security-audit",
	smoke: "smoke"
};
function words(input) {
	return input.trim().split(/\s+/u).filter(Boolean);
}
/**
* Parse one human command without applying runtime defaults or side effects.
* @param input - Command text after /antfarm.
* @returns Requested operation, or undefined for invalid input.
*/
function parseAntfarmCommand(input) {
	const tokens = words(input);
	const [first, second, ...rest] = tokens;
	if (first === void 0) return void 0;
	if ([
		"workflows",
		"help",
		"version",
		"ant",
		"health",
		"ensure-execution"
	].includes(first)) return tokens.length === 1 ? { action: first } : void 0;
	if (first === "install" || first === "uninstall") return second !== void 0 && (rest.length === 0 || rest.length === 1 && rest[0] === "--force") ? {
		action: first,
		id: second,
		force: rest[0] === "--force"
	} : void 0;
	if (first === "import") return second !== void 0 && (rest.length === 1 || rest.length === 2 && rest[1] === "--files") ? {
		action: "import",
		directory: second,
		sourceRoot: rest[0],
		...rest[1] === "--files" ? { workspace: "files" } : {}
	} : void 0;
	if (first === "list") return tokens.length === 1 ? { action: "list" } : void 0;
	if (first === "logs") return {
		action: "logs",
		...second === void 0 ? {} : { runId: [second, ...rest].join(" ") }
	};
	if (first === "status" || first === "cleanup" || first === "stories") return second !== void 0 ? {
		action: first,
		runId: [second, ...rest].join(" ")
	} : void 0;
	if (first === "cancel") return second === void 0 ? void 0 : {
		action: "cancel",
		runId: second,
		reason: rest.join(" ") || "cancelled by user"
	};
	if (first === "resume") {
		if (second === void 0) return void 0;
		const grantFlag = rest.indexOf("--retry-grant");
		let retryGrant;
		if (grantFlag >= 0) {
			retryGrant = Number(rest[grantFlag + 1]);
			if (!Number.isInteger(retryGrant) || retryGrant < 1 || retryGrant > 20) return void 0;
			rest.splice(grantFlag, 2);
		}
		const guidance = rest.join(" ");
		return {
			...retryGrant === void 0 ? {} : { retryGrant },
			action: "resume",
			runId: second,
			...guidance === "" ? {} : { guidance }
		};
	}
	if (first === "run") {
		if (second === "--workflow") {
			const [workflowId, ...task] = rest;
			return workflowId === void 0 || task.length === 0 ? void 0 : {
				action: "start",
				workflowId,
				task: task.join(" ")
			};
		}
		const task = tokens.slice(1).join(" ");
		return task === "" ? void 0 : {
			action: "start",
			task
		};
	}
	const workflowId = SHORTCUTS[first];
	if (workflowId !== void 0) {
		const task = tokens.slice(1).join(" ");
		return task === "" ? void 0 : {
			action: "start",
			workflowId,
			task
		};
	}
	return {
		action: "start",
		task: tokens.join(" ")
	};
}
async function executeAntfarm(ctx, invocation) {
	const command = parseAntfarmCommand(invocation.rawInput);
	if (command === void 0) return {
		kind: "error",
		text: USAGE
	};
	switch (command.action) {
		case "help": return {
			kind: "success",
			text: USAGE
		};
		case "version": return {
			kind: "success",
			text: "dsh-antfarm 0.2.0; journal format 3; native workflow format 2"
		};
		case "ant": return {
			kind: "success",
			text: "Antfarm: install a specialist team, run bounded work, and verify its delivery."
		};
		case "health": return {
			kind: "success",
			text: JSON.stringify(await ctx.antfarm.checkHealth(invocation.agent.id), null, 2)
		};
		case "ensure-execution": return {
			kind: "success",
			text: `Dispatched: ${(await ctx.antfarm.ensureExecution(invocation.agent.id)).join(", ") || "no safely resumable work"}`
		};
		case "install":
		case "uninstall":
			await ctx.antfarm.setWorkflowEnabled(invocation.agent, command.id, command.action === "install", command.force);
			return {
				kind: "success",
				text: `${command.id}: ${command.action === "install" ? "installed" : "uninstalled"}`
			};
		case "workflows": return {
			kind: "success",
			text: (await ctx.antfarm.listWorkflows(invocation.agent)).join("\n")
		};
		case "import": {
			const value = await ctx.antfarm.importWorkflow(invocation.agent, command.directory, command.sourceRoot, command.workspace);
			return {
				kind: "success",
				text: `Imported ${value.id} into ${value.sourceDirectory}`
			};
		}
		case "stories": {
			const status = await ctx.antfarm.status(await ctx.antfarm.find(command.runId, invocation.agent.id), invocation.agent.id);
			return {
				kind: "success",
				text: JSON.stringify(status.stories, null, 2)
			};
		}
		case "logs": {
			const runs = command.runId === void 0 ? await ctx.antfarm.list(invocation.agent.id) : [(await ctx.antfarm.status(await ctx.antfarm.find(command.runId, invocation.agent.id), invocation.agent.id)).summary];
			const pages = await Promise.all(runs.filter((run) => run.status !== "legacy" && run.status !== "corrupt").map(async (run) => {
				return (await ctx.antfarm.events(run.runId, invocation.agent.id, Math.max(-1, (run.revision ?? 49) - 50))).map((event) => ({
					runId: run.runId,
					...event
				}));
			}));
			return {
				kind: "success",
				text: JSON.stringify(pages.flat().sort((a, b) => a.time - b.time).slice(-50), null, 2)
			};
		}
		case "start": {
			const receipt = await ctx.antfarm.start({
				task: command.task,
				parent: invocation.agent,
				...command.workflowId === void 0 ? {} : { workflowId: command.workflowId },
				signal: invocation.signal
			});
			return {
				kind: "success",
				text: `Antfarm run ${receipt.runId} started as job ${receipt.jobId}.\nWorkflow: ${receipt.workflowId}\nWorkspace: ${receipt.workspace}\nBranch: ${receipt.branch}`
			};
		}
		case "list": {
			const runs = await ctx.antfarm.list(invocation.agent.id);
			return {
				kind: "success",
				text: runs.length === 0 ? "No Antfarm runs in this session." : runs.map((run) => `#${run.number ?? "?"} ${run.runId} [${run.status}] ${run.workflowId}${run.currentStep === void 0 ? "" : ` step=${run.currentStep}`}\n  ${run.task ?? ""}\n  ${run.workspace}`).join("\n")
			};
		}
		case "status": {
			const status = await ctx.antfarm.status(await ctx.antfarm.find(command.runId, invocation.agent.id), invocation.agent.id);
			const stories = status.stories.map((story) => `- ${story.id} [${story.status}] retries=${story.retryCount}${story.feedback === void 0 ? "" : `: ${story.feedback}`}`);
			return {
				kind: "success",
				text: `${command.runId} [${status.summary.status}] ${status.summary.workflowId}\nWorkspace: ${status.summary.workspace}${status.summary.currentStep === void 0 ? "" : `\nCurrent step: ${status.summary.currentStep}`}${stories.length === 0 ? "" : `\nStories:\n${stories.join("\n")}`}`
			};
		}
		case "cancel": {
			const summary = await ctx.antfarm.cancel(await ctx.antfarm.find(command.runId, invocation.agent.id), invocation.agent.id, command.reason);
			return {
				kind: "success",
				text: `Cancellation requested for ${command.runId}. Current status: ${summary.status}.`
			};
		}
		case "resume": {
			const receipt = await ctx.antfarm.resume({
				runId: await ctx.antfarm.find(command.runId, invocation.agent.id),
				parent: invocation.agent,
				...command.guidance === void 0 ? {} : { guidance: command.guidance },
				...command.retryGrant === void 0 ? {} : { retryGrant: command.retryGrant },
				signal: invocation.signal
			});
			return {
				kind: "success",
				text: `Antfarm run ${command.runId} resumed as job ${receipt.jobId}.`
			};
		}
		case "cleanup": {
			const summary = await ctx.antfarm.cleanup(await ctx.antfarm.find(command.runId, invocation.agent.id), invocation.agent.id);
			return {
				kind: "success",
				text: `Clean-only cleanup checked ${command.runId}. Workspace: ${summary.workspace}`
			};
		}
	}
}
/** Register the human-facing antfarm command. */
function apply(ctx) {
	ctx.effect(() => ctx.commands.register({
		definitionId: CommandDefinitionId("dsh-antfarm/antfarm"),
		name: "antfarm",
		description: "run and control antfarm team workflows",
		input: { hint: "<task> | run|fix|audit|smoke|list|status|cancel|resume|cleanup ..." },
		handler: (invocation) => executeAntfarm(ctx, invocation)
	}));
}
//#endregion
export { apply, inject, name, parseAntfarmCommand };
