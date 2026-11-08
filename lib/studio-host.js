import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region lib/types/studio-host/index.js
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) {
			if (kind === "field") initializers.unshift(_);
			else descriptor[key] = _;
		}
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/** Read the runtime's authoritative run state without activating an Agent. */
let AntfarmStudioGateway = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators;
	let _status_decorators;
	let _start_decorators;
	let _control_decorators;
	let _board_decorators;
	let _page_decorators;
	let _workflows_decorators;
	let _workflow_decorators;
	let _saveWorkflow_decorators;
	let _removeWorkflow_decorators;
	let _events_decorators;
	let _health_decorators;
	let _healthHistory_decorators;
	let _ensureExecution_decorators;
	let _copyWorkflow_decorators;
	let _setWorkflowEnabled_decorators;
	return class AntfarmStudioGateway extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote({ resources: { session: (sessionId) => sessionId } })];
			_status_decorators = [Remote({ resources: { session: (_runId, sessionId) => sessionId } })];
			_start_decorators = [Remote({ resources: { session: (request) => request.sessionId } })];
			_control_decorators = [Remote({ resources: { session: (request) => request.sessionId } })];
			_board_decorators = [Remote({ resources: { session: (owners) => owners } })];
			_page_decorators = [Remote({ resources: { session: (owners) => owners } })];
			_workflows_decorators = [Remote({ resources: { session: (sessionId) => sessionId } })];
			_workflow_decorators = [Remote({ resources: { session: (_id, sessionId) => sessionId } })];
			_saveWorkflow_decorators = [Remote({ resources: { session: (_draft, _scope, sessionId) => sessionId } })];
			_removeWorkflow_decorators = [Remote({ resources: { session: (_id, _revision, _scope, sessionId) => sessionId } })];
			_events_decorators = [Remote({ resources: { session: (_runId, sessionId) => sessionId } })];
			_health_decorators = [Remote({ resources: { session: (sessionId) => sessionId } })];
			_healthHistory_decorators = [Remote({ resources: { session: (sessionId) => sessionId } })];
			_ensureExecution_decorators = [Remote({ resources: { session: (sessionId) => sessionId } })];
			_copyWorkflow_decorators = [Remote({ resources: { session: (_draft, _newId, sessionId) => sessionId } })];
			_setWorkflowEnabled_decorators = [Remote({ resources: { session: (_draft, _enabled, sessionId) => sessionId } })];
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _status_decorators, {
				kind: "method",
				name: "status",
				static: false,
				private: false,
				access: {
					has: (obj) => "status" in obj,
					get: (obj) => obj.status
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _start_decorators, {
				kind: "method",
				name: "start",
				static: false,
				private: false,
				access: {
					has: (obj) => "start" in obj,
					get: (obj) => obj.start
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _control_decorators, {
				kind: "method",
				name: "control",
				static: false,
				private: false,
				access: {
					has: (obj) => "control" in obj,
					get: (obj) => obj.control
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _board_decorators, {
				kind: "method",
				name: "board",
				static: false,
				private: false,
				access: {
					has: (obj) => "board" in obj,
					get: (obj) => obj.board
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _page_decorators, {
				kind: "method",
				name: "page",
				static: false,
				private: false,
				access: {
					has: (obj) => "page" in obj,
					get: (obj) => obj.page
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _workflows_decorators, {
				kind: "method",
				name: "workflows",
				static: false,
				private: false,
				access: {
					has: (obj) => "workflows" in obj,
					get: (obj) => obj.workflows
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _workflow_decorators, {
				kind: "method",
				name: "workflow",
				static: false,
				private: false,
				access: {
					has: (obj) => "workflow" in obj,
					get: (obj) => obj.workflow
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _saveWorkflow_decorators, {
				kind: "method",
				name: "saveWorkflow",
				static: false,
				private: false,
				access: {
					has: (obj) => "saveWorkflow" in obj,
					get: (obj) => obj.saveWorkflow
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _removeWorkflow_decorators, {
				kind: "method",
				name: "removeWorkflow",
				static: false,
				private: false,
				access: {
					has: (obj) => "removeWorkflow" in obj,
					get: (obj) => obj.removeWorkflow
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _events_decorators, {
				kind: "method",
				name: "events",
				static: false,
				private: false,
				access: {
					has: (obj) => "events" in obj,
					get: (obj) => obj.events
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _health_decorators, {
				kind: "method",
				name: "health",
				static: false,
				private: false,
				access: {
					has: (obj) => "health" in obj,
					get: (obj) => obj.health
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _healthHistory_decorators, {
				kind: "method",
				name: "healthHistory",
				static: false,
				private: false,
				access: {
					has: (obj) => "healthHistory" in obj,
					get: (obj) => obj.healthHistory
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _ensureExecution_decorators, {
				kind: "method",
				name: "ensureExecution",
				static: false,
				private: false,
				access: {
					has: (obj) => "ensureExecution" in obj,
					get: (obj) => obj.ensureExecution
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _copyWorkflow_decorators, {
				kind: "method",
				name: "copyWorkflow",
				static: false,
				private: false,
				access: {
					has: (obj) => "copyWorkflow" in obj,
					get: (obj) => obj.copyWorkflow
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _setWorkflowEnabled_decorators, {
				kind: "method",
				name: "setWorkflowEnabled",
				static: false,
				private: false,
				access: {
					has: (obj) => "setWorkflowEnabled" in obj,
					get: (obj) => obj.setWorkflowEnabled
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["antfarm"];
		/** @param ctx - Host context carrying the Antfarm runtime. */
		constructor(ctx) {
			super(ctx, "antfarmStudio");
			__runInitializers(this, _instanceExtraInitializers);
		}
		/**
		* List runs owned by the selected Session.
		* @param sessionId - Session whose owned runs are visible.
		* @param signal - caller lifetime; runtime reads finish independently of transport cancellation.
		* @returns the owner's runs in runtime order.
		*/
		async list(sessionId, signal) {
			return await this.ctx.antfarm.list(sessionId);
		}
		/**
		* Inspect a run through its original owner's authority.
		* @param runId - run selected from the owner's listing.
		* @param sessionId - Session authorizing the read.
		* @param signal - caller lifetime; runtime reads finish independently of transport cancellation.
		* @returns durable run details; another owner's run is refused by the runtime.
		*/
		async status(runId, sessionId, signal) {
			return await this.ctx.antfarm.status(runId, sessionId);
		}
		/**
		* Admit a workflow using a stable request identity and root Session authority.
		* @param request - Stable launch identity and selected owner.
		* @param signal - Admission lifetime.
		* @returns Admitted Run projection.
		*/
		async start(request, signal) {
			signal.throwIfAborted();
			const parent = await this.ctx.antfarm.resolveOwner(request.sessionId);
			const receipt = await this.ctx.antfarm.start({
				parent,
				task: request.task,
				workflowId: request.workflowId,
				requestId: request.requestId,
				...request.notificationUrl === void 0 ? {} : { notificationUrl: request.notificationUrl },
				signal
			});
			return (await this.ctx.antfarm.status(receipt.runId, request.sessionId)).summary;
		}
		/**
		* Apply an owner-authorized operation against the expected Run revision.
		* @param request - Original owner and expected Run revision.
		* @param signal - Operation admission lifetime.
		* @returns Settled operation projection.
		*/
		async control(request, signal) {
			signal.throwIfAborted();
			if ((await this.ctx.antfarm.status(request.runId, request.sessionId)).summary.revision !== request.revision) throw new Error("Run changed; refresh before applying this operation");
			const parent = await this.ctx.antfarm.resolveOwner(request.sessionId);
			signal.throwIfAborted();
			if (request.action === "resume") {
				await this.ctx.antfarm.resume({
					parent,
					runId: request.runId,
					revision: request.revision,
					...request.guidance === void 0 ? {} : { guidance: request.guidance },
					signal
				});
				return (await this.ctx.antfarm.status(request.runId, request.sessionId)).summary;
			}
			return this.ctx.antfarm.cancel(request.runId, parent.id, "cancelled by user", request.revision);
		}
		/**
		* List recent Runs across explicitly authorized root Sessions.
		* @param owners - Explicit authorized Session resources.
		* @param signal - Query lifetime.
		* @returns At most two hundred recent Runs.
		*/
		async board(owners, signal) {
			signal.throwIfAborted();
			if (owners.length === 0 || owners.length > 100) throw new Error("select one to one hundred Sessions for the board");
			return (await Promise.all([...new Set(owners)].map((owner) => this.ctx.antfarm.list(owner)))).flat().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200);
		}
		/**
		* Read a bounded page of Runs authorized by explicit Session resources.
		* @param owners - Explicit authorized Sessions, at most one hundred per page.
		* @param offset - Previously loaded row count.
		* @param signal - Read lifetime.
		* @returns Fifty indexed Run summaries.
		*/
		async page(owners, offset, signal) {
			signal.throwIfAborted();
			return this.ctx.antfarm.page([...new Set(owners)], offset);
		}
		/**
		* Discover workflow choices for the authorized Session.
		* @param sessionId - Catalog scope.
		* @param signal - Query lifetime.
		* @returns Workflow choices.
		*/
		async workflows(sessionId, signal) {
			signal.throwIfAborted();
			return this.ctx.antfarm.workflowCatalog(sessionId);
		}
		/**
		* Read revision-bound editable resources for the selected workflow.
		* @param id - Selected workflow.
		* @param sessionId - Catalog scope.
		* @param signal - Query lifetime.
		* @returns Revision-bound editable resources.
		*/
		async workflow(id, sessionId, signal) {
			signal.throwIfAborted();
			return this.ctx.antfarm.workflowDraft(sessionId, id);
		}
		/**
		* Validate and atomically save a revision-bound workflow copy.
		* @param draft - Validated-copy input.
		* @param scope - Save location.
		* @param sessionId - Owner.
		* @param signal - Admission lifetime.
		* @returns Saved revision.
		*/
		async saveWorkflow(draft, scope, sessionId, signal) {
			if (scope === "profile" && this.ctx.invocation !== void 0 && this.ctx.invocation.peer.principal.kind !== "owner") throw new Error("profile workflow edits require the Host owner");
			signal.throwIfAborted();
			const parent = await this.ctx.antfarm.resolveOwner(sessionId);
			signal.throwIfAborted();
			return this.ctx.antfarm.saveWorkflow(parent, draft, scope);
		}
		/**
		* Remove a matching writable override after checking active dependencies.
		* @param id - Writable override.
		* @param revision - Saved source.
		* @param scope - Destination.
		* @param sessionId - Owner.
		* @param signal - Admission lifetime.
		*/
		async removeWorkflow(id, revision, scope, sessionId, signal) {
			if (scope === "profile" && this.ctx.invocation !== void 0 && this.ctx.invocation.peer.principal.kind !== "owner") throw new Error("profile workflow edits require the Host owner");
			signal.throwIfAborted();
			const parent = await this.ctx.antfarm.resolveOwner(sessionId);
			signal.throwIfAborted();
			await this.ctx.antfarm.removeWorkflow(parent, id, revision, scope);
		}
		/**
		* Read bounded committed events after an exclusive sequence cursor.
		* @param runId - Owned Run.
		* @param sessionId - Owner.
		* @param after - Exclusive cursor.
		* @param signal - Read lifetime.
		* @returns Committed facts.
		*/
		async events(runId, sessionId, after, signal) {
			signal.throwIfAborted();
			return this.ctx.antfarm.events(runId, sessionId, after);
		}
		/**
		* Inspect Run health under the selected Session’s authority.
		* @param sessionId - Authorized owner.
		* @param signal - Admission lifetime.
		* @returns Diagnosed Run health.
		*/
		async health(sessionId, signal) {
			signal.throwIfAborted();
			return this.ctx.antfarm.checkHealth(sessionId);
		}
		/**
		* Read bounded health history and current monitoring settings.
		* @param sessionId - Authorized owner.
		* @param signal - Read lifetime.
		* @returns Health settings and bounded history.
		*/
		async healthHistory(sessionId, signal) {
			signal.throwIfAborted();
			return this.ctx.antfarm.healthHistory(sessionId);
		}
		/**
		* Dispatch safe inactive work through the existing executor.
		* @param sessionId - Authorized owner.
		* @param signal - Admission lifetime.
		* @returns Safely dispatched inactive Run ids.
		*/
		async ensureExecution(sessionId, signal) {
			signal.throwIfAborted();
			return this.ctx.antfarm.ensureExecution(sessionId);
		}
		/**
		* Create an independent project workflow from a matching source revision.
		* @param draft - Source and expected revision.
		* @param newId - New project workflow identity.
		* @param sessionId - Owner.
		* @param signal - Admission lifetime.
		* @returns Validated independent copy.
		*/
		async copyWorkflow(draft, newId, sessionId, signal) {
			signal.throwIfAborted();
			const parent = await this.ctx.antfarm.resolveOwner(sessionId);
			signal.throwIfAborted();
			return this.ctx.antfarm.copyWorkflow(parent, draft, newId);
		}
		/**
		* Change workflow availability after checking revision and active dependencies.
		* @param draft - Workflow identity and expected source revision.
		* @param enabled - Install or uninstall.
		* @param sessionId - Owner.
		* @param signal - Admission lifetime.
		*/
		async setWorkflowEnabled(draft, enabled, sessionId, signal) {
			signal.throwIfAborted();
			const parent = await this.ctx.antfarm.resolveOwner(sessionId);
			signal.throwIfAborted();
			await this.ctx.antfarm.setWorkflowEnabled(parent, draft.id, enabled, false, draft);
		}
	};
})();
//#endregion
export { AntfarmStudioGateway, AntfarmStudioGateway as default };
