window.__ModuleLoader__.load({
	id: "@winterhuan/dsh-antfarm",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let zod = require("zod");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react = require("react");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region node_modules/.pnpm/@deepseek-ai+dsh-typert-protocol@0.2.2-rc.1_@deepseek-ai+cordis@4.1.0/node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/remote-info.js
		/** Lazy assembly of generated Remote definitions using caller-supplied Zod; no runtime imports. */
		/**
		* Retain one generated definition per endpoint without constructing parsers or projections.
		* The class instance builds its shared descriptor/method index on first access;
		* input schemas and JSON Schema projections are cached only when requested.
		* @param spec - compiler-produced method facts and Zod factories.
		* @param zod - the generated artifact's Zod runtime for named-input parsers.
		* @returns a lazy, mountable info instance with no registration or transport effects.
		*/
		function createTypertRemoteInfo(spec, zod) {
			return new RemoteInfo(spec, zod);
		}
		var RemoteInfo = class {
			spec;
			zod;
			index;
			constructor(spec, zod) {
				this.spec = spec;
				this.zod = zod;
			}
			get package() {
				return this.spec.package;
			}
			get descriptors() {
				return this.resolve().descriptors;
			}
			get methods() {
				return this.resolve().methods;
			}
			resolve() {
				if (this.index !== void 0) return this.index;
				const zod = this.zod;
				const descriptors = [];
				const methods = Object.create(null);
				for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
					const separator = endpoint.indexOf("/");
					const namespace = endpoint.slice(0, separator);
					const method = endpoint.slice(separator + 1);
					const parameters = definition.parameters.map((parameter) => ({
						...parameter,
						wire: parameter.wire ?? parameter.name
					}));
					const descriptor = {
						...definition,
						id: `${this.spec.package}#${endpoint}`,
						namespace,
						method,
						parameters,
						result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
					};
					if (definition.invocation.kind === "direct") {
						const inputs = [];
						methods[endpoint] = Object.assign(descriptor, {
							input(options) {
								const strict = options?.strict === true;
								return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
							},
							invoke(remote, input, signal) {
								const named = input;
								const values = parameters.map((parameter) => named[parameter.wire]);
								if (definition.cancellation !== void 0) values.push(signal);
								const receiver = Reflect.get(remote, namespace);
								return Reflect.get(receiver, method).apply(receiver, values);
							}
						});
					}
					descriptors.push(descriptor);
				}
				return this.index = {
					descriptors,
					methods
				};
			}
		};
		function optional(parameter) {
			return parameter.source === "json" && parameter.acceptsUndefined === true;
		}
		var NamedInput = class {
			parameters;
			strict;
			zod;
			schema;
			projection;
			constructor(parameters, strict, zod) {
				this.parameters = parameters;
				this.strict = strict;
				this.zod = zod;
			}
			codec(parameter) {
				return this.strict ? parameter.strictCodec : parameter.codec;
			}
			create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
				const value = this.codec(parameter).create();
				return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
			})));
			get jsonSchema() {
				return this.project().jsonSchema;
			}
			get jsonSchemaError() {
				return this.project().jsonSchemaError;
			}
			project() {
				if (this.projection !== void 0) return this.projection;
				const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
				if (unavailable !== void 0) return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
				return this.projection = { jsonSchema: {
					type: "object",
					properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
						...this.codec(parameter).jsonSchema,
						...parameter.description === void 0 ? {} : { description: parameter.description }
					}])),
					required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
					additionalProperties: false
				} };
			}
		};
		var ResultValue = class {
			spec;
			projection;
			constructor(spec) {
				this.spec = spec;
			}
			get mode() {
				return this.spec.mode;
			}
			get typeSymbol() {
				return this.spec.typeSymbol;
			}
			get create() {
				return this.spec.create;
			}
			get decode() {
				return this.spec.decode;
			}
			get encode() {
				return this.spec.encode;
			}
			get description() {
				return this.spec.description;
			}
			get jsonSchemaError() {
				return this.spec.jsonSchemaError;
			}
			get jsonSchema() {
				if (this.projection === void 0) {
					const schema = this.spec.jsonSchema;
					this.projection = { value: schema === void 0 ? void 0 : {
						...schema,
						description: this.spec.description
					} };
				}
				return this.projection.value;
			}
		};
		//#endregion
		//#region lib/typert.remote-client.js
		let _winterhuan_dsh_antfarm_antfarmStudio_board_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_board_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_board_parameter_0$schema$value ??= zod.z.array(zod.z.string());
		let _winterhuan_dsh_antfarm_antfarmStudio_board_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_board_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_board_result$schema$value ??= zod.z.array(zod.z.object({
			"runId": zod.z.string().readonly(),
			"number": zod.z.union([zod.z.undefined(), zod.z.number()]).readonly().optional(),
			"task": zod.z.string().readonly().optional(),
			"revision": zod.z.number().readonly().optional(),
			"jobId": zod.z.string().readonly().optional(),
			"workflowId": zod.z.string().readonly(),
			"status": zod.z.union([
				zod.z.literal("queued"),
				zod.z.literal("starting"),
				zod.z.literal("running"),
				zod.z.literal("interrupted"),
				zod.z.literal("blocked"),
				zod.z.literal("completed"),
				zod.z.literal("failed"),
				zod.z.literal("cancelled"),
				zod.z.literal("legacy"),
				zod.z.literal("corrupt")
			]).readonly(),
			"workspace": zod.z.string().readonly(),
			"branch": zod.z.string().readonly(),
			"currentStep": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"ownerSessionId": zod.z.string().readonly(),
			"updatedAt": zod.z.number().readonly(),
			"workspaceDisposition": zod.z.union([
				zod.z.literal("present"),
				zod.z.literal("retained"),
				zod.z.literal("cleaned")
			]).readonly(),
			"workspaceReason": zod.z.string().readonly().optional(),
			"acceptedStories": zod.z.number().readonly().optional(),
			"totalStories": zod.z.number().readonly().optional(),
			"reason": zod.z.string().readonly().optional()
		}));
		let _winterhuan_dsh_antfarm_antfarmStudio_control_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_control_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_control_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"runId": zod.z.string().readonly(),
			"revision": zod.z.number().readonly(),
			"action": zod.z.union([zod.z.literal("resume"), zod.z.literal("cancel")]).readonly(),
			"guidance": zod.z.string().readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_control_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_control_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_control_result$schema$value ??= zod.z.object({
			"runId": zod.z.string().readonly(),
			"number": zod.z.union([zod.z.undefined(), zod.z.number()]).readonly().optional(),
			"task": zod.z.string().readonly().optional(),
			"revision": zod.z.number().readonly().optional(),
			"jobId": zod.z.string().readonly().optional(),
			"workflowId": zod.z.string().readonly(),
			"status": zod.z.union([
				zod.z.literal("queued"),
				zod.z.literal("starting"),
				zod.z.literal("running"),
				zod.z.literal("interrupted"),
				zod.z.literal("blocked"),
				zod.z.literal("completed"),
				zod.z.literal("failed"),
				zod.z.literal("cancelled"),
				zod.z.literal("legacy"),
				zod.z.literal("corrupt")
			]).readonly(),
			"workspace": zod.z.string().readonly(),
			"branch": zod.z.string().readonly(),
			"currentStep": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"ownerSessionId": zod.z.string().readonly(),
			"updatedAt": zod.z.number().readonly(),
			"workspaceDisposition": zod.z.union([
				zod.z.literal("present"),
				zod.z.literal("retained"),
				zod.z.literal("cleaned")
			]).readonly(),
			"workspaceReason": zod.z.string().readonly().optional(),
			"acceptedStories": zod.z.number().readonly().optional(),
			"totalStories": zod.z.number().readonly().optional(),
			"reason": zod.z.string().readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_0$schema$value ??= zod.z.object({
			"id": zod.z.string().readonly(),
			"document": zod.z.string().readonly(),
			"files": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"revision": zod.z.string().readonly(),
			"sourceDirectory": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"enabled": zod.z.union([
				zod.z.undefined(),
				zod.z.literal(false),
				zod.z.literal(true)
			]).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_1$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_1$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_1$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_2$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_2$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_2$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_result$schema$value ??= zod.z.object({
			"id": zod.z.string().readonly(),
			"document": zod.z.string().readonly(),
			"files": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"revision": zod.z.string().readonly(),
			"sourceDirectory": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"enabled": zod.z.union([
				zod.z.undefined(),
				zod.z.literal(false),
				zod.z.literal(true)
			]).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_parameter_0$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_result$schema$value ??= zod.z.array(zod.z.string());
		let _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_0$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_1$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_1$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_1$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_2$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_2$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_2$schema$value ??= zod.z.number();
		let _winterhuan_dsh_antfarm_antfarmStudio_events_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_events_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_events_result$schema$value ??= zod.z.array(zod.z.object({
			"seq": zod.z.number().readonly(),
			"time": zod.z.number().readonly(),
			"type": zod.z.string().readonly(),
			"detail": zod.z.string().readonly()
		}));
		let _winterhuan_dsh_antfarm_antfarmStudio_health_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_health_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_health_parameter_0$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_health_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_health_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_health_result$schema$value ??= zod.z.object({
			"time": zod.z.number().readonly(),
			"enabled": zod.z.boolean().readonly(),
			"findings": zod.z.array(zod.z.object({
				"runId": zod.z.string().readonly(),
				"kind": zod.z.union([
					zod.z.literal("retained"),
					zod.z.literal("uncertain"),
					zod.z.literal("inactive"),
					zod.z.literal("overdue"),
					zod.z.literal("unreadable")
				]).readonly(),
				"detail": zod.z.string().readonly()
			})).readonly()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_parameter_0$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_result$schema$value ??= zod.z.object({
			"reports": zod.z.array(zod.z.object({
				"time": zod.z.number().readonly(),
				"enabled": zod.z.boolean().readonly(),
				"findings": zod.z.array(zod.z.object({
					"runId": zod.z.string().readonly(),
					"kind": zod.z.union([
						zod.z.literal("retained"),
						zod.z.literal("uncertain"),
						zod.z.literal("inactive"),
						zod.z.literal("overdue"),
						zod.z.literal("unreadable")
					]).readonly(),
					"detail": zod.z.string().readonly()
				})).readonly()
			})).readonly(),
			"issues24h": zod.z.number().readonly(),
			"enabled": zod.z.boolean().readonly(),
			"intervalMs": zod.z.number().readonly()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_list_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_list_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_list_parameter_0$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_list_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_list_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_list_result$schema$value ??= zod.z.array(zod.z.object({
			"runId": zod.z.string().readonly(),
			"number": zod.z.union([zod.z.undefined(), zod.z.number()]).readonly().optional(),
			"task": zod.z.string().readonly().optional(),
			"revision": zod.z.number().readonly().optional(),
			"jobId": zod.z.string().readonly().optional(),
			"workflowId": zod.z.string().readonly(),
			"status": zod.z.union([
				zod.z.literal("queued"),
				zod.z.literal("starting"),
				zod.z.literal("running"),
				zod.z.literal("interrupted"),
				zod.z.literal("blocked"),
				zod.z.literal("completed"),
				zod.z.literal("failed"),
				zod.z.literal("cancelled"),
				zod.z.literal("legacy"),
				zod.z.literal("corrupt")
			]).readonly(),
			"workspace": zod.z.string().readonly(),
			"branch": zod.z.string().readonly(),
			"currentStep": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"ownerSessionId": zod.z.string().readonly(),
			"updatedAt": zod.z.number().readonly(),
			"workspaceDisposition": zod.z.union([
				zod.z.literal("present"),
				zod.z.literal("retained"),
				zod.z.literal("cleaned")
			]).readonly(),
			"workspaceReason": zod.z.string().readonly().optional(),
			"acceptedStories": zod.z.number().readonly().optional(),
			"totalStories": zod.z.number().readonly().optional(),
			"reason": zod.z.string().readonly().optional()
		}));
		let _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_0$schema$value ??= zod.z.array(zod.z.string());
		let _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_1$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_1$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_1$schema$value ??= zod.z.number();
		let _winterhuan_dsh_antfarm_antfarmStudio_page_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_page_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_page_result$schema$value ??= zod.z.array(zod.z.object({
			"runId": zod.z.string().readonly(),
			"number": zod.z.union([zod.z.undefined(), zod.z.number()]).readonly().optional(),
			"task": zod.z.string().readonly().optional(),
			"revision": zod.z.number().readonly().optional(),
			"jobId": zod.z.string().readonly().optional(),
			"workflowId": zod.z.string().readonly(),
			"status": zod.z.union([
				zod.z.literal("queued"),
				zod.z.literal("starting"),
				zod.z.literal("running"),
				zod.z.literal("interrupted"),
				zod.z.literal("blocked"),
				zod.z.literal("completed"),
				zod.z.literal("failed"),
				zod.z.literal("cancelled"),
				zod.z.literal("legacy"),
				zod.z.literal("corrupt")
			]).readonly(),
			"workspace": zod.z.string().readonly(),
			"branch": zod.z.string().readonly(),
			"currentStep": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"ownerSessionId": zod.z.string().readonly(),
			"updatedAt": zod.z.number().readonly(),
			"workspaceDisposition": zod.z.union([
				zod.z.literal("present"),
				zod.z.literal("retained"),
				zod.z.literal("cleaned")
			]).readonly(),
			"workspaceReason": zod.z.string().readonly().optional(),
			"acceptedStories": zod.z.number().readonly().optional(),
			"totalStories": zod.z.number().readonly().optional(),
			"reason": zod.z.string().readonly().optional()
		}));
		let _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_0$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_1$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_1$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_1$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_2$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_2$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_2$schema$value ??= zod.z.union([zod.z.literal("project"), zod.z.literal("profile")]);
		let _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_3$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_3$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_3$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_result$schema$value ??= zod.z.void();
		let _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_0$schema$value ??= zod.z.object({
			"id": zod.z.string().readonly(),
			"document": zod.z.string().readonly(),
			"files": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"revision": zod.z.string().readonly(),
			"sourceDirectory": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"enabled": zod.z.union([
				zod.z.undefined(),
				zod.z.literal(false),
				zod.z.literal(true)
			]).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_1$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_1$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_1$schema$value ??= zod.z.union([zod.z.literal("project"), zod.z.literal("profile")]);
		let _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_2$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_2$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_2$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_result$schema$value ??= zod.z.object({
			"id": zod.z.string().readonly(),
			"document": zod.z.string().readonly(),
			"files": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"revision": zod.z.string().readonly(),
			"sourceDirectory": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"enabled": zod.z.union([
				zod.z.undefined(),
				zod.z.literal(false),
				zod.z.literal(true)
			]).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_0$schema$value ??= zod.z.object({
			"id": zod.z.string().readonly(),
			"document": zod.z.string().readonly(),
			"files": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"revision": zod.z.string().readonly(),
			"sourceDirectory": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"enabled": zod.z.union([
				zod.z.undefined(),
				zod.z.literal(false),
				zod.z.literal(true)
			]).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_1$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_1$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_1$schema$value ??= zod.z.boolean();
		let _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_2$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_2$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_2$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_result$schema$value ??= zod.z.void();
		let _winterhuan_dsh_antfarm_antfarmStudio_start_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_start_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_start_parameter_0$schema$value ??= zod.z.object({
			"sessionId": zod.z.string().readonly(),
			"requestId": zod.z.string().readonly(),
			"task": zod.z.string().readonly(),
			"workflowId": zod.z.string().readonly(),
			"notificationUrl": zod.z.string().readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_start_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_start_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_start_result$schema$value ??= zod.z.object({
			"runId": zod.z.string().readonly(),
			"number": zod.z.union([zod.z.undefined(), zod.z.number()]).readonly().optional(),
			"task": zod.z.string().readonly().optional(),
			"revision": zod.z.number().readonly().optional(),
			"jobId": zod.z.string().readonly().optional(),
			"workflowId": zod.z.string().readonly(),
			"status": zod.z.union([
				zod.z.literal("queued"),
				zod.z.literal("starting"),
				zod.z.literal("running"),
				zod.z.literal("interrupted"),
				zod.z.literal("blocked"),
				zod.z.literal("completed"),
				zod.z.literal("failed"),
				zod.z.literal("cancelled"),
				zod.z.literal("legacy"),
				zod.z.literal("corrupt")
			]).readonly(),
			"workspace": zod.z.string().readonly(),
			"branch": zod.z.string().readonly(),
			"currentStep": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"ownerSessionId": zod.z.string().readonly(),
			"updatedAt": zod.z.number().readonly(),
			"workspaceDisposition": zod.z.union([
				zod.z.literal("present"),
				zod.z.literal("retained"),
				zod.z.literal("cleaned")
			]).readonly(),
			"workspaceReason": zod.z.string().readonly().optional(),
			"acceptedStories": zod.z.number().readonly().optional(),
			"totalStories": zod.z.number().readonly().optional(),
			"reason": zod.z.string().readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_0$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_1$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_1$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_1$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_status_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_status_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_status_result$schema$value ??= zod.z.object({
			"summary": zod.z.object({
				"runId": zod.z.string().readonly(),
				"number": zod.z.union([zod.z.undefined(), zod.z.number()]).readonly().optional(),
				"task": zod.z.string().readonly().optional(),
				"revision": zod.z.number().readonly().optional(),
				"jobId": zod.z.string().readonly().optional(),
				"workflowId": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("queued"),
					zod.z.literal("starting"),
					zod.z.literal("running"),
					zod.z.literal("interrupted"),
					zod.z.literal("blocked"),
					zod.z.literal("completed"),
					zod.z.literal("failed"),
					zod.z.literal("cancelled"),
					zod.z.literal("legacy"),
					zod.z.literal("corrupt")
				]).readonly(),
				"workspace": zod.z.string().readonly(),
				"branch": zod.z.string().readonly(),
				"currentStep": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"ownerSessionId": zod.z.string().readonly(),
				"updatedAt": zod.z.number().readonly(),
				"workspaceDisposition": zod.z.union([
					zod.z.literal("present"),
					zod.z.literal("retained"),
					zod.z.literal("cleaned")
				]).readonly(),
				"workspaceReason": zod.z.string().readonly().optional(),
				"acceptedStories": zod.z.number().readonly().optional(),
				"totalStories": zod.z.number().readonly().optional(),
				"reason": zod.z.string().readonly().optional()
			}).readonly(),
			"context": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"stories": zod.z.array(zod.z.object({
				"status": zod.z.union([
					zod.z.literal("running"),
					zod.z.literal("failed"),
					zod.z.literal("pending"),
					zod.z.literal("done"),
					zod.z.literal("retry")
				]).readonly(),
				"retryCount": zod.z.number().readonly(),
				"feedback": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
				"id": zod.z.string().readonly(),
				"title": zod.z.string().readonly(),
				"description": zod.z.string().readonly(),
				"acceptanceCriteria": zod.z.array(zod.z.string()).readonly(),
				"maxRetries": zod.z.number().readonly()
			})).readonly(),
			"childSessionIds": zod.z.array(zod.z.string()).readonly(),
			"uncertain": zod.z.boolean().readonly(),
			"steps": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"agent": zod.z.string().readonly(),
				"status": zod.z.union([
					zod.z.literal("running"),
					zod.z.literal("failed"),
					zod.z.literal("pending"),
					zod.z.literal("done"),
					zod.z.literal("waiting"),
					zod.z.literal("skipped")
				]).readonly(),
				"output": zod.z.union([zod.z.literal(null), zod.z.string()]).readonly(),
				"retries": zod.z.number().readonly()
			})).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_0$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_1$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_1$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_1$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_workflow_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_workflow_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_workflow_result$schema$value ??= zod.z.object({
			"id": zod.z.string().readonly(),
			"document": zod.z.string().readonly(),
			"files": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"revision": zod.z.string().readonly(),
			"sourceDirectory": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"enabled": zod.z.union([
				zod.z.undefined(),
				zod.z.literal(false),
				zod.z.literal(true)
			]).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_workflows_parameter_0$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_workflows_parameter_0$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_workflows_parameter_0$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_workflows_result$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_workflows_result$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_workflows_result$schema$value ??= zod.z.array(zod.z.string());
		let _winterhuan_dsh_antfarm_antfarmStudio_board_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_board_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_board_parameter_0_strict$schema$value ??= zod.z.array(zod.z.string());
		let _winterhuan_dsh_antfarm_antfarmStudio_control_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_control_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_control_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"runId": zod.z.string().readonly(),
			"revision": zod.z.number().readonly(),
			"action": zod.z.union([zod.z.literal("resume"), zod.z.literal("cancel")]).readonly(),
			"guidance": zod.z.string().readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"id": zod.z.string().readonly(),
			"document": zod.z.string().readonly(),
			"files": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"revision": zod.z.string().readonly(),
			"sourceDirectory": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"enabled": zod.z.union([
				zod.z.undefined(),
				zod.z.literal(false),
				zod.z.literal(true)
			]).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_1_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_1_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_1_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_2_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_2_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_2_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_parameter_0_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_0_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_1_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_1_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_1_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_2_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_2_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_2_strict$schema$value ??= zod.z.number();
		let _winterhuan_dsh_antfarm_antfarmStudio_health_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_health_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_health_parameter_0_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_parameter_0_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_list_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_list_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_list_parameter_0_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_0_strict$schema$value ??= zod.z.array(zod.z.string());
		let _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_1_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_1_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_1_strict$schema$value ??= zod.z.number();
		let _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_0_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_1_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_1_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_1_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_2_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_2_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_2_strict$schema$value ??= zod.z.union([zod.z.literal("project"), zod.z.literal("profile")]);
		let _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_3_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_3_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_3_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"id": zod.z.string().readonly(),
			"document": zod.z.string().readonly(),
			"files": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"revision": zod.z.string().readonly(),
			"sourceDirectory": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"enabled": zod.z.union([
				zod.z.undefined(),
				zod.z.literal(false),
				zod.z.literal(true)
			]).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_1_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_1_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_1_strict$schema$value ??= zod.z.union([zod.z.literal("project"), zod.z.literal("profile")]);
		let _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_2_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_2_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_2_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"id": zod.z.string().readonly(),
			"document": zod.z.string().readonly(),
			"files": zod.z.record(zod.z.string(), zod.z.string()).readonly().readonly(),
			"revision": zod.z.string().readonly(),
			"sourceDirectory": zod.z.union([zod.z.undefined(), zod.z.string()]).readonly().optional(),
			"enabled": zod.z.union([
				zod.z.undefined(),
				zod.z.literal(false),
				zod.z.literal(true)
			]).readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_1_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_1_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_1_strict$schema$value ??= zod.z.boolean();
		let _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_2_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_2_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_2_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_start_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_start_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_start_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"sessionId": zod.z.string().readonly(),
			"requestId": zod.z.string().readonly(),
			"task": zod.z.string().readonly(),
			"workflowId": zod.z.string().readonly(),
			"notificationUrl": zod.z.string().readonly().optional()
		});
		let _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_0_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_1_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_1_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_1_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_0_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_1_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_1_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_1_strict$schema$value ??= zod.z.string();
		let _winterhuan_dsh_antfarm_antfarmStudio_workflows_parameter_0_strict$schema$value;
		const _winterhuan_dsh_antfarm_antfarmStudio_workflows_parameter_0_strict$schema = () => _winterhuan_dsh_antfarm_antfarmStudio_workflows_parameter_0_strict$schema$value ??= zod.z.string();
		const TYPERT_REMOTE = createTypertRemoteInfo({
			package: "@winterhuan/dsh-antfarm",
			methods: {
				"antfarmStudio/board": {
					service: "antfarmStudio",
					description: "List recent Runs across explicitly authorized root Sessions.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "owners",
						description: "Explicit authorized Session resources.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/board:owners",
							create: _winterhuan_dsh_antfarm_antfarmStudio_board_parameter_0$schema,
							jsonSchema: {
								"type": "array",
								"items": { "type": "string" }
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/board:owners",
							create: _winterhuan_dsh_antfarm_antfarmStudio_board_parameter_0_strict$schema,
							jsonSchema: {
								"type": "array",
								"items": { "type": "string" }
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/board:result",
						create: _winterhuan_dsh_antfarm_antfarmStudio_board_result$schema,
						description: "At most two hundred recent Runs.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"runId": { "type": "string" },
									"number": { "type": "number" },
									"task": { "type": "string" },
									"revision": { "type": "number" },
									"jobId": { "type": "string" },
									"workflowId": { "type": "string" },
									"status": {
										"type": "string",
										"enum": [
											"queued",
											"starting",
											"running",
											"interrupted",
											"blocked",
											"completed",
											"failed",
											"cancelled",
											"legacy",
											"corrupt"
										]
									},
									"workspace": { "type": "string" },
									"branch": { "type": "string" },
									"currentStep": { "type": "string" },
									"ownerSessionId": { "type": "string" },
									"updatedAt": { "type": "number" },
									"workspaceDisposition": {
										"type": "string",
										"enum": [
											"present",
											"retained",
											"cleaned"
										]
									},
									"workspaceReason": { "type": "string" },
									"acceptedStories": { "type": "number" },
									"totalStories": { "type": "number" },
									"reason": { "type": "string" }
								},
								"required": [
									"runId",
									"workflowId",
									"status",
									"workspace",
									"branch",
									"ownerSessionId",
									"updatedAt",
									"workspaceDisposition"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 91,
						"column": 9
					}
				},
				"antfarmStudio/control": {
					service: "antfarmStudio",
					description: "Apply an owner-authorized operation against the expected Run revision.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Original owner and expected Run revision.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmControlRequest",
							create: _winterhuan_dsh_antfarm_antfarmStudio_control_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"runId": { "type": "string" },
									"revision": { "type": "number" },
									"action": {
										"type": "string",
										"enum": ["resume", "cancel"]
									},
									"guidance": { "type": "string" }
								},
								"required": [
									"sessionId",
									"runId",
									"revision",
									"action"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmControlRequest",
							create: _winterhuan_dsh_antfarm_antfarmStudio_control_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"runId": { "type": "string" },
									"revision": { "type": "number" },
									"action": {
										"type": "string",
										"enum": ["resume", "cancel"]
									},
									"guidance": { "type": "string" }
								},
								"required": [
									"sessionId",
									"runId",
									"revision",
									"action"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmRunSummary",
						create: _winterhuan_dsh_antfarm_antfarmStudio_control_result$schema,
						description: "Settled operation projection.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"runId": { "type": "string" },
								"number": { "type": "number" },
								"task": { "type": "string" },
								"revision": { "type": "number" },
								"jobId": { "type": "string" },
								"workflowId": { "type": "string" },
								"status": {
									"type": "string",
									"enum": [
										"queued",
										"starting",
										"running",
										"interrupted",
										"blocked",
										"completed",
										"failed",
										"cancelled",
										"legacy",
										"corrupt"
									]
								},
								"workspace": { "type": "string" },
								"branch": { "type": "string" },
								"currentStep": { "type": "string" },
								"ownerSessionId": { "type": "string" },
								"updatedAt": { "type": "number" },
								"workspaceDisposition": {
									"type": "string",
									"enum": [
										"present",
										"retained",
										"cleaned"
									]
								},
								"workspaceReason": { "type": "string" },
								"acceptedStories": { "type": "number" },
								"totalStories": { "type": "number" },
								"reason": { "type": "string" }
							},
							"required": [
								"runId",
								"workflowId",
								"status",
								"workspace",
								"branch",
								"ownerSessionId",
								"updatedAt",
								"workspaceDisposition"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 70,
						"column": 9
					}
				},
				"antfarmStudio/copyWorkflow": {
					service: "antfarmStudio",
					description: "Create an independent project workflow from a matching source revision.",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "draft",
							description: "Source and expected revision.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/workflow/types#WorkflowDraft",
								create: _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_0$schema,
								jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/workflow/types#WorkflowDraft",
								create: _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_0_strict$schema,
								jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
							}
						},
						{
							name: "newId",
							description: "New project workflow identity.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/copyWorkflow:newId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_1$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/copyWorkflow:newId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_1_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "sessionId",
							description: "Owner.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_2$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_parameter_2_strict$schema,
								jsonSchema: { "type": "string" }
							}
						}
					],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm/workflow/types#WorkflowDraft",
						create: _winterhuan_dsh_antfarm_antfarmStudio_copyWorkflow_result$schema,
						description: "Validated independent copy.",
						jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 229,
						"column": 9
					}
				},
				"antfarmStudio/ensureExecution": {
					service: "antfarmStudio",
					description: "Dispatch safe inactive work through the existing executor.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "sessionId",
						description: "Authorized owner.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/ensureExecution:result",
						create: _winterhuan_dsh_antfarm_antfarmStudio_ensureExecution_result$schema,
						description: "Safely dispatched inactive Run ids.",
						jsonSchema: {
							"type": "array",
							"items": { "type": "string" }
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 215,
						"column": 9
					}
				},
				"antfarmStudio/events": {
					service: "antfarmStudio",
					description: "Read bounded committed events after an exclusive sequence cursor.",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "runId",
							description: "Owned Run.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/events:runId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_0$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/events:runId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_0_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "sessionId",
							description: "Owner.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_1$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_1_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "after",
							description: "Exclusive cursor.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/events:after",
								create: _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_2$schema,
								jsonSchema: { "type": "number" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/events:after",
								create: _winterhuan_dsh_antfarm_antfarmStudio_events_parameter_2_strict$schema,
								jsonSchema: { "type": "number" }
							}
						}
					],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/events:result",
						create: _winterhuan_dsh_antfarm_antfarmStudio_events_result$schema,
						description: "Committed facts.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"seq": { "type": "number" },
									"time": { "type": "number" },
									"type": { "type": "string" },
									"detail": { "type": "string" }
								},
								"required": [
									"seq",
									"time",
									"type",
									"detail"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 179,
						"column": 9
					}
				},
				"antfarmStudio/health": {
					service: "antfarmStudio",
					description: "Inspect Run health under the selected Session’s authority.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "sessionId",
						description: "Authorized owner.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_health_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_health_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmHealthReport",
						create: _winterhuan_dsh_antfarm_antfarmStudio_health_result$schema,
						description: "Diagnosed Run health.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"time": { "type": "number" },
								"enabled": { "type": "boolean" },
								"findings": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"runId": { "type": "string" },
											"kind": {
												"type": "string",
												"enum": [
													"retained",
													"uncertain",
													"inactive",
													"overdue",
													"unreadable"
												]
											},
											"detail": { "type": "string" }
										},
										"required": [
											"runId",
											"kind",
											"detail"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"time",
								"enabled",
								"findings"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 191,
						"column": 9
					}
				},
				"antfarmStudio/healthHistory": {
					service: "antfarmStudio",
					description: "Read bounded health history and current monitoring settings.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "sessionId",
						description: "Authorized owner.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmHealthHistory",
						create: _winterhuan_dsh_antfarm_antfarmStudio_healthHistory_result$schema,
						description: "Health settings and bounded history.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"reports": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"time": { "type": "number" },
											"enabled": { "type": "boolean" },
											"findings": {
												"type": "array",
												"items": {
													"type": "object",
													"properties": {
														"runId": { "type": "string" },
														"kind": {
															"type": "string",
															"enum": [
																"retained",
																"uncertain",
																"inactive",
																"overdue",
																"unreadable"
															]
														},
														"detail": { "type": "string" }
													},
													"required": [
														"runId",
														"kind",
														"detail"
													],
													"additionalProperties": true
												}
											}
										},
										"required": [
											"time",
											"enabled",
											"findings"
										],
										"additionalProperties": true
									}
								},
								"issues24h": { "type": "number" },
								"enabled": { "type": "boolean" },
								"intervalMs": { "type": "number" }
							},
							"required": [
								"reports",
								"issues24h",
								"enabled",
								"intervalMs"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 203,
						"column": 9
					}
				},
				"antfarmStudio/list": {
					service: "antfarmStudio",
					description: "List runs owned by the selected Session.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "sessionId",
						description: "Session whose owned runs are visible.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_list_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_list_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/list:result",
						create: _winterhuan_dsh_antfarm_antfarmStudio_list_result$schema,
						description: "the owner's runs in runtime order.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"runId": { "type": "string" },
									"number": { "type": "number" },
									"task": { "type": "string" },
									"revision": { "type": "number" },
									"jobId": { "type": "string" },
									"workflowId": { "type": "string" },
									"status": {
										"type": "string",
										"enum": [
											"queued",
											"starting",
											"running",
											"interrupted",
											"blocked",
											"completed",
											"failed",
											"cancelled",
											"legacy",
											"corrupt"
										]
									},
									"workspace": { "type": "string" },
									"branch": { "type": "string" },
									"currentStep": { "type": "string" },
									"ownerSessionId": { "type": "string" },
									"updatedAt": { "type": "number" },
									"workspaceDisposition": {
										"type": "string",
										"enum": [
											"present",
											"retained",
											"cleaned"
										]
									},
									"workspaceReason": { "type": "string" },
									"acceptedStories": { "type": "number" },
									"totalStories": { "type": "number" },
									"reason": { "type": "string" }
								},
								"required": [
									"runId",
									"workflowId",
									"status",
									"workspace",
									"branch",
									"ownerSessionId",
									"updatedAt",
									"workspaceDisposition"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 31,
						"column": 9
					}
				},
				"antfarmStudio/page": {
					service: "antfarmStudio",
					description: "Read a bounded page of Runs authorized by explicit Session resources.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "owners",
						description: "Explicit authorized Sessions, at most one hundred per page.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/page:owners",
							create: _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_0$schema,
							jsonSchema: {
								"type": "array",
								"items": { "type": "string" }
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/page:owners",
							create: _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_0_strict$schema,
							jsonSchema: {
								"type": "array",
								"items": { "type": "string" }
							}
						}
					}, {
						name: "offset",
						description: "Previously loaded row count.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/page:offset",
							create: _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_1$schema,
							jsonSchema: { "type": "number" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/page:offset",
							create: _winterhuan_dsh_antfarm_antfarmStudio_page_parameter_1_strict$schema,
							jsonSchema: { "type": "number" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/page:result",
						create: _winterhuan_dsh_antfarm_antfarmStudio_page_result$schema,
						description: "Fifty indexed Run summaries.",
						jsonSchema: {
							"type": "array",
							"items": {
								"type": "object",
								"properties": {
									"runId": { "type": "string" },
									"number": { "type": "number" },
									"task": { "type": "string" },
									"revision": { "type": "number" },
									"jobId": { "type": "string" },
									"workflowId": { "type": "string" },
									"status": {
										"type": "string",
										"enum": [
											"queued",
											"starting",
											"running",
											"interrupted",
											"blocked",
											"completed",
											"failed",
											"cancelled",
											"legacy",
											"corrupt"
										]
									},
									"workspace": { "type": "string" },
									"branch": { "type": "string" },
									"currentStep": { "type": "string" },
									"ownerSessionId": { "type": "string" },
									"updatedAt": { "type": "number" },
									"workspaceDisposition": {
										"type": "string",
										"enum": [
											"present",
											"retained",
											"cleaned"
										]
									},
									"workspaceReason": { "type": "string" },
									"acceptedStories": { "type": "number" },
									"totalStories": { "type": "number" },
									"reason": { "type": "string" }
								},
								"required": [
									"runId",
									"workflowId",
									"status",
									"workspace",
									"branch",
									"ownerSessionId",
									"updatedAt",
									"workspaceDisposition"
								],
								"additionalProperties": true
							}
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 106,
						"column": 9
					}
				},
				"antfarmStudio/removeWorkflow": {
					service: "antfarmStudio",
					description: "Remove a matching writable override after checking active dependencies.",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "id",
							description: "Writable override.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/removeWorkflow:id",
								create: _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_0$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/removeWorkflow:id",
								create: _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_0_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "revision",
							description: "Saved source.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/removeWorkflow:revision",
								create: _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_1$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/removeWorkflow:revision",
								create: _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_1_strict$schema,
								jsonSchema: { "type": "string" }
							}
						},
						{
							name: "scope",
							description: "Destination.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/removeWorkflow:scope",
								create: _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_2$schema,
								jsonSchema: {
									"type": "string",
									"enum": ["project", "profile"]
								}
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/removeWorkflow:scope",
								create: _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_2_strict$schema,
								jsonSchema: {
									"type": "string",
									"enum": ["project", "profile"]
								}
							}
						},
						{
							name: "sessionId",
							description: "Owner.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_3$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_parameter_3_strict$schema,
								jsonSchema: { "type": "string" }
							}
						}
					],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/removeWorkflow:result",
						create: _winterhuan_dsh_antfarm_antfarmStudio_removeWorkflow_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 162,
						"column": 9
					}
				},
				"antfarmStudio/saveWorkflow": {
					service: "antfarmStudio",
					description: "Validate and atomically save a revision-bound workflow copy.",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "draft",
							description: "Validated-copy input.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/workflow/types#WorkflowDraft",
								create: _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_0$schema,
								jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/workflow/types#WorkflowDraft",
								create: _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_0_strict$schema,
								jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
							}
						},
						{
							name: "scope",
							description: "Save location.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/saveWorkflow:scope",
								create: _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_1$schema,
								jsonSchema: {
									"type": "string",
									"enum": ["project", "profile"]
								}
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/saveWorkflow:scope",
								create: _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_1_strict$schema,
								jsonSchema: {
									"type": "string",
									"enum": ["project", "profile"]
								}
							}
						},
						{
							name: "sessionId",
							description: "Owner.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_2$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_parameter_2_strict$schema,
								jsonSchema: { "type": "string" }
							}
						}
					],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm/workflow/types#WorkflowDraft",
						create: _winterhuan_dsh_antfarm_antfarmStudio_saveWorkflow_result$schema,
						description: "Saved revision.",
						jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 145,
						"column": 9
					}
				},
				"antfarmStudio/setWorkflowEnabled": {
					service: "antfarmStudio",
					description: "Change workflow availability after checking revision and active dependencies.",
					invocation: { kind: "direct" },
					parameters: [
						{
							name: "draft",
							description: "Workflow identity and expected source revision.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/workflow/types#WorkflowDraft",
								create: _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_0$schema,
								jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/workflow/types#WorkflowDraft",
								create: _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_0_strict$schema,
								jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
							}
						},
						{
							name: "enabled",
							description: "Install or uninstall.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/setWorkflowEnabled:enabled",
								create: _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_1$schema,
								jsonSchema: { "type": "boolean" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/setWorkflowEnabled:enabled",
								create: _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_1_strict$schema,
								jsonSchema: { "type": "boolean" }
							}
						},
						{
							name: "sessionId",
							description: "Owner.",
							source: "json",
							codec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_2$schema,
								jsonSchema: { "type": "string" }
							},
							strictCodec: {
								mode: "strict",
								typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
								create: _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_parameter_2_strict$schema,
								jsonSchema: { "type": "string" }
							}
						}
					],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/setWorkflowEnabled:result",
						create: _winterhuan_dsh_antfarm_antfarmStudio_setWorkflowEnabled_result$schema,
						jsonSchemaError: "typert tool schema: unsupported void value"
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 244,
						"column": 9
					}
				},
				"antfarmStudio/start": {
					service: "antfarmStudio",
					description: "Admit a workflow using a stable request identity and root Session authority.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "Stable launch identity and selected owner.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmLaunchRequest",
							create: _winterhuan_dsh_antfarm_antfarmStudio_start_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"requestId": { "type": "string" },
									"task": { "type": "string" },
									"workflowId": { "type": "string" },
									"notificationUrl": { "type": "string" }
								},
								"required": [
									"sessionId",
									"requestId",
									"task",
									"workflowId"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmLaunchRequest",
							create: _winterhuan_dsh_antfarm_antfarmStudio_start_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"sessionId": { "type": "string" },
									"requestId": { "type": "string" },
									"task": { "type": "string" },
									"workflowId": { "type": "string" },
									"notificationUrl": { "type": "string" }
								},
								"required": [
									"sessionId",
									"requestId",
									"task",
									"workflowId"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmRunSummary",
						create: _winterhuan_dsh_antfarm_antfarmStudio_start_result$schema,
						description: "Admitted Run projection.",
						jsonSchema: {
							"type": "object",
							"properties": {
								"runId": { "type": "string" },
								"number": { "type": "number" },
								"task": { "type": "string" },
								"revision": { "type": "number" },
								"jobId": { "type": "string" },
								"workflowId": { "type": "string" },
								"status": {
									"type": "string",
									"enum": [
										"queued",
										"starting",
										"running",
										"interrupted",
										"blocked",
										"completed",
										"failed",
										"cancelled",
										"legacy",
										"corrupt"
									]
								},
								"workspace": { "type": "string" },
								"branch": { "type": "string" },
								"currentStep": { "type": "string" },
								"ownerSessionId": { "type": "string" },
								"updatedAt": { "type": "number" },
								"workspaceDisposition": {
									"type": "string",
									"enum": [
										"present",
										"retained",
										"cleaned"
									]
								},
								"workspaceReason": { "type": "string" },
								"acceptedStories": { "type": "number" },
								"totalStories": { "type": "number" },
								"reason": { "type": "string" }
							},
							"required": [
								"runId",
								"workflowId",
								"status",
								"workspace",
								"branch",
								"ownerSessionId",
								"updatedAt",
								"workspaceDisposition"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 56,
						"column": 9
					}
				},
				"antfarmStudio/status": {
					service: "antfarmStudio",
					description: "Inspect a run through its original owner's authority.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "runId",
						description: "run selected from the owner's listing.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/status:runId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/status:runId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}, {
						name: "sessionId",
						description: "Session authorizing the read.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_1$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_status_parameter_1_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmStatus",
						create: _winterhuan_dsh_antfarm_antfarmStudio_status_result$schema,
						description: "durable run details; another owner's run is refused by the runtime.",
						jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 44,
						"column": 9
					}
				},
				"antfarmStudio/workflow": {
					service: "antfarmStudio",
					description: "Read revision-bound editable resources for the selected workflow.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "id",
						description: "Selected workflow.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/workflow:id",
							create: _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/workflow:id",
							create: _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}, {
						name: "sessionId",
						description: "Catalog scope.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_1$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_workflow_parameter_1_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm/workflow/types#WorkflowDraft",
						create: _winterhuan_dsh_antfarm_antfarmStudio_workflow_result$schema,
						description: "Revision-bound editable resources.",
						jsonSchemaError: "typert tool schema: selected dictionaries require string keys and unconstrained JSON values"
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 131,
						"column": 9
					}
				},
				"antfarmStudio/workflows": {
					service: "antfarmStudio",
					description: "Discover workflow choices for the authorized Session.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "sessionId",
						description: "Catalog scope.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_workflows_parameter_0$schema,
							jsonSchema: { "type": "string" }
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "@winterhuan/dsh-antfarm/types#AntfarmSessionId",
							create: _winterhuan_dsh_antfarm_antfarmStudio_workflows_parameter_0_strict$schema,
							jsonSchema: { "type": "string" }
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "@winterhuan/dsh-antfarm#antfarmStudio/workflows:result",
						create: _winterhuan_dsh_antfarm_antfarmStudio_workflows_result$schema,
						description: "Workflow choices.",
						jsonSchema: {
							"type": "array",
							"items": { "type": "string" }
						}
					},
					sourceLocation: {
						"file": "packages/antfarm/src/studio-host/index.ts",
						"line": 118,
						"column": 9
					}
				}
			}
		}, zod.z);
		//#endregion
		//#region node_modules/.pnpm/@deepseek-ai+dsh-brand@0.2.2-rc.1_@deepseek-ai+cordis@4.1.0/node_modules/@deepseek-ai/dsh-brand/lib/index.js
		/**
		* Duplicate-install-safe nominal primitive helpers.
		*
		* A brand makes structurally identical strings or numbers non-interchangeable
		* at the type level: a `SessionId` cannot be passed where a `ToolCallId` is
		* expected, and an event sequence cannot be passed as a log offset. Comparison,
		* logging, and serialization retain the underlying primitive behavior.
		*
		* This package owns no concrete domain value and keeps no runtime identity or mutable
		* state, so independently installed copies produce interchangeable values.
		*
		* @module @deepseek-ai/dsh-brand
		*/
		/**
		* Apply a compile-time string brand without changing the value.
		* @param value - string admitted by the domain that owns the target brand.
		* @returns the same string with the requested compile-time brand.
		*/
		function brandString(value) {
			return value;
		}
		//#endregion
		//#region node_modules/.pnpm/@deepseek-ai+dsh-session@0.2.2-rc.1_@deepseek-ai+cordis@4.1.0_@deepseek-ai+dsh-scope@0._2c1eb9e8f9f716fa5ffcff871cbb2b70/node_modules/@deepseek-ai/dsh-session/lib/types/types.js
		/**
		* Brand a string as a {@link SessionId}.
		* @param id - the raw session id string.
		* @returns the same string with the session-id brand.
		*/
		function SessionId(id) {
			return brandString(id);
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Locale namespace shared by the guide and the run panel. */
		const NS = "antfarmRuns";
		/** English run inspection labels. */
		const en = {
			workflow: "Workflow",
			newRun: "Start a task",
			runs: "Runs",
			projectSession: "Project session",
			boardHelp: "Choose a project session, review the team, then describe the task. Antfarm runs each stage for you.",
			noProjectSession: "Create a session in your project workspace, then return here. Built-in teams: feature development, bug fixes and security audits.",
			filterWorkflow: "Filter runs by workflow",
			advancedConfig: "Advanced configuration",
			agents: "Agents ({count})",
			teamHelp: "Expand an Agent to configure its model and persona. Each attempt uses a fresh session with that Agent’s identity.",
			agentName: "Agent name",
			agentModel: "Model",
			defaultModel: "DSH default model",
			modelHelp: "Use a model name configured in DSH. Leave blank to inherit the workflow model or DSH default.",
			agentTimeout: "Timeout (seconds)",
			defaultTimeout: "Default for this role",
			personaFile: "Persona file",
			persona: "Persona instructions",
			invalidTeamSource: "Agent settings are unavailable for this YAML. Correct it in Advanced configuration.",
			chooseWorkflow: "Choose a workflow",
			task: "Task and constraints",
			startRun: "Start run",
			launchHelp: "Review the selected workflow before starting. Its declared delivery actions are part of this run.",
			source: "Effective source",
			editHelp: "Save a complete override. New runs use it; admitted runs keep their saved definition.",
			saveScope: "Save location",
			projectScope: "Project workflow override",
			profileScope: "User workflow override (Host owner)",
			resource: "Resource",
			workflowSource: "Workflow source editor",
			save: "Validate and save",
			reload: "Reload source",
			restoreInherited: "Remove override",
			unsavedDraft: "Unsaved draft. Save or discard before changing workflow or save location.",
			discardHelp: "Discard this draft and load the latest source?",
			removeHelp: "Remove this writable workflow override and restore the next inherited source. Run evidence stays available.",
			keepEditing: "Keep editing",
			discard: "Discard draft",
			removeOverride: "Remove override",
			catalogError: "Could not load workflows. Refresh to try again.",
			workflowError: "Could not load this workflow. Select it again to retry.",
			operationSuccess: "Antfarm operation accepted",
			operationError: "Operation failed. Your data and draft are preserved.",
			guidance: "Recovery guidance",
			resumeHelp: "Resume uses the saved workflow and keeps completed stories. Inspect interrupted attempts before retrying.",
			resumeRun: "Resume run",
			cancelRun: "Cancel run",
			acceptedProgress: "Completed {done} of {total}",
			output: "Step outputs",
			events: "Event history",
			loadEvents: "Load events",
			moreEvents: "More events",
			steps: "Workflow stages",
			moreRuns: "Load more runs",
			search: "Search task, run id or number",
			allStates: "All states",
			board: "Antfarm workflow board",
			allWorkflows: "All workflows",
			emptyBoard: "No Antfarm runs in the authorized Sessions",
			health: "Run health",
			healthHistory: "Health settings, history and 24-hour issues",
			checkHealth: "Check health",
			ensureExecution: "Ensure execution",
			healthHelp: "Inspect inactive and uncertain work before recovery. Only the existing executor may restart safe work.",
			staleDraft: "Source changed. Your draft is preserved; compare or reload before saving.",
			compareSource: "Compare latest source",
			installWorkflow: "Install workflow",
			uninstallWorkflow: "Uninstall workflow",
			newWorkflowId: "New workflow id",
			copyWorkflow: "Create project copy",
			title: "Antfarm",
			description: "Workflow runs in this session",
			refresh: "Refresh",
			retry: "Retry",
			empty: "No Antfarm runs in this session",
			emptyHelp: "Choose a workflow and describe your task above.",
			loadError: "Could not load runs. Try again.",
			detailError: "Could not load this run. Try again.",
			noWorkspace: "This session has no workspace",
			branch: "Branch",
			workspace: "Workspace",
			step: "Step",
			stories: "Stories",
			retries: "Retries: {count}",
			children: "Child sessions",
			openChild: "Open child session {id}",
			unavailableChild: "Child session is unavailable",
			uncertain: "The previous attempt stopped without a confirmed result. Review its workspace before resuming.",
			retained: "Workspace retained",
			cleaned: "Workspace removed",
			queued: "Queued",
			starting: "Starting",
			running: "Running",
			interrupted: "Interrupted",
			blocked: "Needs attention",
			completed: "Completed",
			failed: "Failed",
			cancelled: "Cancelled",
			legacy: "Older run format",
			corrupt: "Run record unreadable",
			pending: "Pending",
			skipped: "Skipped",
			done: "Done",
			retrying: "Retrying"
		};
		/** Chinese run inspection labels. */
		const zh = {
			workflow: "工作流",
			newRun: "启动任务",
			runs: "运行记录",
			projectSession: "项目会话",
			boardHelp: "选择项目会话，查看团队并填写任务，Antfarm 会依次执行各阶段",
			noProjectSession: "请先在项目工作区新建会话，再回到这里。内置团队：功能开发、缺陷修复、安全审计",
			filterWorkflow: "按工作流筛选运行",
			advancedConfig: "高级配置",
			agents: "Agent 团队（{count}）",
			teamHelp: "展开 Agent 可配置模型与人设。每次尝试使用该 Agent 身份创建全新会话",
			agentName: "Agent 名称",
			agentModel: "模型",
			defaultModel: "DSH 默认模型",
			modelHelp: "填写 DSH 中已配置的模型名称，留空继承工作流模型或 DSH 默认模型",
			agentTimeout: "超时（秒）",
			defaultTimeout: "使用角色默认值",
			personaFile: "人设文件",
			persona: "人设指令",
			invalidTeamSource: "当前 YAML 无法显示 Agent 配置，请在高级配置中修正",
			chooseWorkflow: "选择工作流",
			task: "任务与约束",
			startRun: "启动运行",
			launchHelp: "启动前检查所选工作流，其中声明的交付操作属于本次运行",
			source: "生效来源",
			editHelp: "保存完整覆盖副本，新运行使用新配置，已准入运行保留原定义",
			saveScope: "保存位置",
			projectScope: "项目工作流覆盖",
			profileScope: "用户工作流覆盖（需 Host 所有者）",
			resource: "资源",
			workflowSource: "工作流源码编辑器",
			save: "校验并保存",
			reload: "重新读取来源",
			restoreInherited: "移除覆盖副本",
			unsavedDraft: "有未保存修改，保存或放弃后可切换工作流及保存位置",
			discardHelp: "放弃当前草稿并读取最新来源？",
			removeHelp: "移除可写覆盖副本，恢复下一继承来源，运行证据继续保留",
			keepEditing: "继续编辑",
			discard: "放弃草稿",
			removeOverride: "移除副本",
			catalogError: "无法读取工作流，请刷新重试",
			workflowError: "无法读取此工作流，请重新选择重试",
			operationSuccess: "Antfarm 操作已完成",
			operationError: "操作失败，数据和草稿已保留",
			guidance: "恢复指导",
			resumeHelp: "恢复使用已保存的工作流并保留完成的故事，重试前请检查中断的执行",
			resumeRun: "恢复运行",
			cancelRun: "取消运行",
			acceptedProgress: "已完成 {done} / {total} 项",
			output: "已接受输出",
			events: "事件历史",
			loadEvents: "读取事件",
			moreEvents: "更多事件",
			steps: "工作流阶段",
			moreRuns: "加载更多运行",
			search: "搜索任务、运行标识或编号",
			allStates: "全部状态",
			board: "Antfarm 工作流看板",
			allWorkflows: "全部工作流",
			emptyBoard: "已授权会话中暂无 Antfarm 运行",
			health: "运行健康",
			healthHistory: "健康设置、历史与 24 小时问题",
			checkHealth: "检查健康",
			ensureExecution: "恢复执行注册",
			healthHelp: "恢复前检查不活动或不确定的工作，只有现有执行器能重新启动安全工作",
			staleDraft: "来源已变化，草稿已保留，请比较或重新读取后保存",
			compareSource: "查看最新来源以比较",
			installWorkflow: "安装工作流",
			uninstallWorkflow: "卸载工作流",
			newWorkflowId: "新工作流标识",
			copyWorkflow: "创建项目副本",
			title: "Antfarm",
			description: "当前会话的工作流运行记录",
			refresh: "刷新",
			retry: "重试",
			empty: "当前会话还没有 Antfarm 运行记录",
			emptyHelp: "在上方选择工作流并填写任务",
			loadError: "暂时无法读取运行记录，请重试",
			detailError: "暂时无法读取这次运行，请重试",
			noWorkspace: "这个会话还没有工作区",
			branch: "分支",
			workspace: "工作区",
			step: "步骤",
			stories: "任务",
			retries: "重试次数：{count}",
			children: "子会话",
			openChild: "打开子会话 {id}",
			unavailableChild: "子会话暂不可用",
			uncertain: "上次尝试结束时没有确认结果，请先检查工作区，再决定是否恢复",
			retained: "工作区已保留",
			cleaned: "工作区已移除",
			queued: "排队中",
			starting: "正在启动",
			running: "正在运行",
			interrupted: "已中断",
			blocked: "需要处理",
			completed: "已完成",
			failed: "失败",
			cancelled: "已取消",
			legacy: "旧版运行格式",
			corrupt: "运行记录无法读取",
			pending: "待执行",
			skipped: "已跳过",
			done: "已完成",
			retrying: "正在重试"
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/identity.js
		const ALIAS = Symbol.for("yaml.alias");
		const DOC = Symbol.for("yaml.document");
		const MAP = Symbol.for("yaml.map");
		const PAIR = Symbol.for("yaml.pair");
		const SCALAR$1 = Symbol.for("yaml.scalar");
		const SEQ = Symbol.for("yaml.seq");
		const NODE_TYPE = Symbol.for("yaml.node.type");
		const isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
		const isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
		const isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
		const isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
		const isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR$1;
		const isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
		function isCollection(node) {
			if (node && typeof node === "object") switch (node[NODE_TYPE]) {
				case MAP:
				case SEQ: return true;
			}
			return false;
		}
		function isNode(node) {
			if (node && typeof node === "object") switch (node[NODE_TYPE]) {
				case ALIAS:
				case MAP:
				case SCALAR$1:
				case SEQ: return true;
			}
			return false;
		}
		const hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/visit.js
		const BREAK$1 = Symbol("break visit");
		const SKIP$1 = Symbol("skip children");
		const REMOVE$1 = Symbol("remove node");
		/**
		* Apply a visitor to an AST node or document.
		*
		* Walks through the tree (depth-first) starting from `node`, calling a
		* `visitor` function with three arguments:
		*   - `key`: For sequence values and map `Pair`, the node's index in the
		*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
		*     `null` for the root node.
		*   - `node`: The current node.
		*   - `path`: The ancestry of the current node.
		*
		* The return value of the visitor may be used to control the traversal:
		*   - `undefined` (default): Do nothing and continue
		*   - `visit.SKIP`: Do not visit the children of this node, continue with next
		*     sibling
		*   - `visit.BREAK`: Terminate traversal completely
		*   - `visit.REMOVE`: Remove the current node, then continue with the next one
		*   - `Node`: Replace the current node, then continue by visiting it
		*   - `number`: While iterating the items of a sequence or map, set the index
		*     of the next step. This is useful especially if the index of the current
		*     node has changed.
		*
		* If `visitor` is a single function, it will be called with all values
		* encountered in the tree, including e.g. `null` values. Alternatively,
		* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
		* `Alias` and `Scalar` node. To define the same visitor function for more than
		* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
		* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
		* specific defined one will be used for each node.
		*/
		function visit$1(node, visitor) {
			const visitor_ = initVisitor(visitor);
			if (isDocument(node)) {
				if (visit_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE$1) node.contents = null;
			} else visit_(null, node, visitor_, Object.freeze([]));
		}
		/** Terminate visit traversal completely */
		visit$1.BREAK = BREAK$1;
		/** Do not visit the children of the current node */
		visit$1.SKIP = SKIP$1;
		/** Remove the current node */
		visit$1.REMOVE = REMOVE$1;
		function visit_(key, node, visitor, path) {
			const ctrl = callVisitor(key, node, visitor, path);
			if (isNode(ctrl) || isPair(ctrl)) {
				replaceNode(key, path, ctrl);
				return visit_(key, ctrl, visitor, path);
			}
			if (typeof ctrl !== "symbol") {
				if (isCollection(node)) {
					path = Object.freeze(path.concat(node));
					for (let i = 0; i < node.items.length; ++i) {
						const ci = visit_(i, node.items[i], visitor, path);
						if (typeof ci === "number") i = ci - 1;
						else if (ci === BREAK$1) return BREAK$1;
						else if (ci === REMOVE$1) {
							node.items.splice(i, 1);
							i -= 1;
						}
					}
				} else if (isPair(node)) {
					path = Object.freeze(path.concat(node));
					const ck = visit_("key", node.key, visitor, path);
					if (ck === BREAK$1) return BREAK$1;
					else if (ck === REMOVE$1) node.key = null;
					const cv = visit_("value", node.value, visitor, path);
					if (cv === BREAK$1) return BREAK$1;
					else if (cv === REMOVE$1) node.value = null;
				}
			}
			return ctrl;
		}
		/**
		* Apply an async visitor to an AST node or document.
		*
		* Walks through the tree (depth-first) starting from `node`, calling a
		* `visitor` function with three arguments:
		*   - `key`: For sequence values and map `Pair`, the node's index in the
		*     collection. Within a `Pair`, `'key'` or `'value'`, correspondingly.
		*     `null` for the root node.
		*   - `node`: The current node.
		*   - `path`: The ancestry of the current node.
		*
		* The return value of the visitor may be used to control the traversal:
		*   - `Promise`: Must resolve to one of the following values
		*   - `undefined` (default): Do nothing and continue
		*   - `visit.SKIP`: Do not visit the children of this node, continue with next
		*     sibling
		*   - `visit.BREAK`: Terminate traversal completely
		*   - `visit.REMOVE`: Remove the current node, then continue with the next one
		*   - `Node`: Replace the current node, then continue by visiting it
		*   - `number`: While iterating the items of a sequence or map, set the index
		*     of the next step. This is useful especially if the index of the current
		*     node has changed.
		*
		* If `visitor` is a single function, it will be called with all values
		* encountered in the tree, including e.g. `null` values. Alternatively,
		* separate visitor functions may be defined for each `Map`, `Pair`, `Seq`,
		* `Alias` and `Scalar` node. To define the same visitor function for more than
		* one node type, use the `Collection` (map and seq), `Value` (map, seq & scalar)
		* and `Node` (alias, map, seq & scalar) targets. Of all these, only the most
		* specific defined one will be used for each node.
		*/
		async function visitAsync(node, visitor) {
			const visitor_ = initVisitor(visitor);
			if (isDocument(node)) {
				if (await visitAsync_(null, node.contents, visitor_, Object.freeze([node])) === REMOVE$1) node.contents = null;
			} else await visitAsync_(null, node, visitor_, Object.freeze([]));
		}
		/** Terminate visit traversal completely */
		visitAsync.BREAK = BREAK$1;
		/** Do not visit the children of the current node */
		visitAsync.SKIP = SKIP$1;
		/** Remove the current node */
		visitAsync.REMOVE = REMOVE$1;
		async function visitAsync_(key, node, visitor, path) {
			const ctrl = await callVisitor(key, node, visitor, path);
			if (isNode(ctrl) || isPair(ctrl)) {
				replaceNode(key, path, ctrl);
				return visitAsync_(key, ctrl, visitor, path);
			}
			if (typeof ctrl !== "symbol") {
				if (isCollection(node)) {
					path = Object.freeze(path.concat(node));
					for (let i = 0; i < node.items.length; ++i) {
						const ci = await visitAsync_(i, node.items[i], visitor, path);
						if (typeof ci === "number") i = ci - 1;
						else if (ci === BREAK$1) return BREAK$1;
						else if (ci === REMOVE$1) {
							node.items.splice(i, 1);
							i -= 1;
						}
					}
				} else if (isPair(node)) {
					path = Object.freeze(path.concat(node));
					const ck = await visitAsync_("key", node.key, visitor, path);
					if (ck === BREAK$1) return BREAK$1;
					else if (ck === REMOVE$1) node.key = null;
					const cv = await visitAsync_("value", node.value, visitor, path);
					if (cv === BREAK$1) return BREAK$1;
					else if (cv === REMOVE$1) node.value = null;
				}
			}
			return ctrl;
		}
		function initVisitor(visitor) {
			if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) return Object.assign({
				Alias: visitor.Node,
				Map: visitor.Node,
				Scalar: visitor.Node,
				Seq: visitor.Node
			}, visitor.Value && {
				Map: visitor.Value,
				Scalar: visitor.Value,
				Seq: visitor.Value
			}, visitor.Collection && {
				Map: visitor.Collection,
				Seq: visitor.Collection
			}, visitor);
			return visitor;
		}
		function callVisitor(key, node, visitor, path) {
			if (typeof visitor === "function") return visitor(key, node, path);
			if (isMap(node)) return visitor.Map?.(key, node, path);
			if (isSeq(node)) return visitor.Seq?.(key, node, path);
			if (isPair(node)) return visitor.Pair?.(key, node, path);
			if (isScalar(node)) return visitor.Scalar?.(key, node, path);
			if (isAlias(node)) return visitor.Alias?.(key, node, path);
		}
		function replaceNode(key, path, node) {
			const parent = path[path.length - 1];
			if (isCollection(parent)) parent.items[key] = node;
			else if (isPair(parent)) {
				if (key === "key") parent.key = node;
				else parent.value = node;
			} else if (isDocument(parent)) parent.contents = node;
			else {
				const pt = isAlias(parent) ? "alias" : "scalar";
				throw new Error(`Cannot replace node with ${pt} parent`);
			}
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/doc/directives.js
		const escapeChars = {
			"!": "%21",
			",": "%2C",
			"[": "%5B",
			"]": "%5D",
			"{": "%7B",
			"}": "%7D"
		};
		const escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);
		var Directives = class Directives {
			constructor(yaml, tags) {
				/**
				* The directives-end/doc-start marker `---`. If `null`, a marker may still be
				* included in the document's stringified representation.
				*/
				this.docStart = null;
				/** The doc-end marker `...`.  */
				this.docEnd = false;
				this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
				this.tags = Object.assign({}, Directives.defaultTags, tags);
			}
			clone() {
				const copy = new Directives(this.yaml, this.tags);
				copy.docStart = this.docStart;
				return copy;
			}
			/**
			* During parsing, get a Directives instance for the current document and
			* update the stream state according to the current version's spec.
			*/
			atDocument() {
				const res = new Directives(this.yaml, this.tags);
				switch (this.yaml.version) {
					case "1.1":
						this.atNextDocument = true;
						break;
					case "1.2":
						this.atNextDocument = false;
						this.yaml = {
							explicit: Directives.defaultYaml.explicit,
							version: "1.2"
						};
						this.tags = Object.assign({}, Directives.defaultTags);
				}
				return res;
			}
			/**
			* @param onError - May be called even if the action was successful
			* @returns `true` on success
			*/
			add(line, onError) {
				if (this.atNextDocument) {
					this.yaml = {
						explicit: Directives.defaultYaml.explicit,
						version: "1.1"
					};
					this.tags = Object.assign({}, Directives.defaultTags);
					this.atNextDocument = false;
				}
				const parts = line.trim().split(/[ \t]+/);
				const name = parts.shift();
				switch (name) {
					case "%TAG": {
						if (parts.length !== 2) {
							onError(0, "%TAG directive should contain exactly two parts");
							if (parts.length < 2) return false;
						}
						const [handle, prefix] = parts;
						this.tags[handle] = prefix;
						return true;
					}
					case "%YAML": {
						this.yaml.explicit = true;
						if (parts.length !== 1) {
							onError(0, "%YAML directive should contain exactly one part");
							return false;
						}
						const [version] = parts;
						if (version === "1.1" || version === "1.2") {
							this.yaml.version = version;
							return true;
						} else {
							const isValid = /^\d+\.\d+$/.test(version);
							onError(6, `Unsupported YAML version ${version}`, isValid);
							return false;
						}
					}
					default:
						onError(0, `Unknown directive ${name}`, true);
						return false;
				}
			}
			/**
			* Resolves a tag, matching handles to those defined in %TAG directives.
			*
			* @returns Resolved tag, which may also be the non-specific tag `'!'` or a
			*   `'!local'` tag, or `null` if unresolvable.
			*/
			tagName(source, onError) {
				if (source === "!") return "!";
				if (source[0] !== "!") {
					onError(`Not a valid tag: ${source}`);
					return null;
				}
				if (source[1] === "<") {
					const verbatim = source.slice(2, -1);
					if (verbatim === "!" || verbatim === "!!") {
						onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
						return null;
					}
					if (source[source.length - 1] !== ">") onError("Verbatim tags must end with a >");
					return verbatim;
				}
				const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
				if (!suffix) onError(`The ${source} tag has no suffix`);
				const prefix = this.tags[handle];
				if (prefix) try {
					return prefix + decodeURIComponent(suffix);
				} catch (error) {
					onError(String(error));
					return null;
				}
				if (handle === "!") return source;
				onError(`Could not resolve tag: ${source}`);
				return null;
			}
			/**
			* Given a fully resolved tag, returns its printable string form,
			* taking into account current tag prefixes and defaults.
			*/
			tagString(tag) {
				for (const [handle, prefix] of Object.entries(this.tags)) if (tag.startsWith(prefix)) return handle + escapeTagName(tag.substring(prefix.length));
				return tag[0] === "!" ? tag : `!<${tag}>`;
			}
			toString(doc) {
				const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
				const tagEntries = Object.entries(this.tags);
				let tagNames;
				if (doc && tagEntries.length > 0 && isNode(doc.contents)) {
					const tags = {};
					visit$1(doc.contents, (_key, node) => {
						if (isNode(node) && node.tag) tags[node.tag] = true;
					});
					tagNames = Object.keys(tags);
				} else tagNames = [];
				for (const [handle, prefix] of tagEntries) {
					if (handle === "!!" && prefix === "tag:yaml.org,2002:") continue;
					if (!doc || tagNames.some((tn) => tn.startsWith(prefix))) lines.push(`%TAG ${handle} ${prefix}`);
				}
				return lines.join("\n");
			}
		};
		Directives.defaultYaml = {
			explicit: false,
			version: "1.2"
		};
		Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/doc/anchors.js
		/**
		* Verify that the input string is a valid anchor.
		*
		* Will throw on errors.
		*/
		function anchorIsValid(anchor) {
			if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
				const msg = `Anchor must not contain whitespace or control characters: ${JSON.stringify(anchor)}`;
				throw new Error(msg);
			}
			return true;
		}
		function anchorNames(root) {
			const anchors = /* @__PURE__ */ new Set();
			visit$1(root, { Value(_key, node) {
				if (node.anchor) anchors.add(node.anchor);
			} });
			return anchors;
		}
		/** Find a new anchor name with the given `prefix` and a one-indexed suffix. */
		function findNewAnchor(prefix, exclude) {
			for (let i = 1;; ++i) {
				const name = `${prefix}${i}`;
				if (!exclude.has(name)) return name;
			}
		}
		function createNodeAnchors(doc, prefix) {
			const aliasObjects = [];
			const sourceObjects = /* @__PURE__ */ new Map();
			let prevAnchors = null;
			return {
				onAnchor: (source) => {
					aliasObjects.push(source);
					prevAnchors ?? (prevAnchors = anchorNames(doc));
					const anchor = findNewAnchor(prefix, prevAnchors);
					prevAnchors.add(anchor);
					return anchor;
				},
				/**
				* With circular references, the source node is only resolved after all
				* of its child nodes are. This is why anchors are set only after all of
				* the nodes have been created.
				*/
				setAnchors: () => {
					for (const source of aliasObjects) {
						const ref = sourceObjects.get(source);
						if (typeof ref === "object" && ref.anchor && (isScalar(ref.node) || isCollection(ref.node))) ref.node.anchor = ref.anchor;
						else {
							const error = /* @__PURE__ */ new Error("Failed to resolve repeated object (this should not happen)");
							error.source = source;
							throw error;
						}
					}
				},
				sourceObjects
			};
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/doc/applyReviver.js
		/**
		* Applies the JSON.parse reviver algorithm as defined in the ECMA-262 spec,
		* in section 24.5.1.1 "Runtime Semantics: InternalizeJSONProperty" of the
		* 2021 edition: https://tc39.es/ecma262/#sec-json.parse
		*
		* Includes extensions for handling Map and Set objects.
		*/
		function applyReviver(reviver, obj, key, val) {
			if (val && typeof val === "object") {
				if (Array.isArray(val)) for (let i = 0, len = val.length; i < len; ++i) {
					const v0 = val[i];
					const v1 = applyReviver(reviver, val, String(i), v0);
					if (v1 === void 0) delete val[i];
					else if (v1 !== v0) val[i] = v1;
				}
				else if (val instanceof Map) for (const k of Array.from(val.keys())) {
					const v0 = val.get(k);
					const v1 = applyReviver(reviver, val, k, v0);
					if (v1 === void 0) val.delete(k);
					else if (v1 !== v0) val.set(k, v1);
				}
				else if (val instanceof Set) for (const v0 of Array.from(val)) {
					const v1 = applyReviver(reviver, val, v0, v0);
					if (v1 === void 0) val.delete(v0);
					else if (v1 !== v0) {
						val.delete(v0);
						val.add(v1);
					}
				}
				else for (const [k, v0] of Object.entries(val)) {
					const v1 = applyReviver(reviver, val, k, v0);
					if (v1 === void 0) delete val[k];
					else if (v1 !== v0) val[k] = v1;
				}
			}
			return reviver.call(obj, key, val);
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/toJS.js
		/**
		* Recursively convert any node or its contents to native JavaScript
		*
		* @param value - The input value
		* @param arg - If `value` defines a `toJSON()` method, use this
		*   as its first argument
		* @param ctx - Conversion context, originally set in Document#toJS(). If
		*   `{ keep: true }` is not set, output should be suitable for JSON
		*   stringification.
		*/
		function toJS(value, arg, ctx) {
			if (Array.isArray(value)) return value.map((v, i) => toJS(v, String(i), ctx));
			if (value && typeof value.toJSON === "function") {
				if (!ctx || !hasAnchor(value)) return value.toJSON(arg, ctx);
				const data = {
					aliasCount: 0,
					count: 1,
					res: void 0
				};
				ctx.anchors.set(value, data);
				ctx.onCreate = (res) => {
					data.res = res;
					delete ctx.onCreate;
				};
				const res = value.toJSON(arg, ctx);
				if (ctx.onCreate) ctx.onCreate(res);
				return res;
			}
			if (typeof value === "bigint" && !ctx?.keep) return Number(value);
			return value;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/Node.js
		var NodeBase = class {
			constructor(type) {
				Object.defineProperty(this, NODE_TYPE, { value: type });
			}
			/** Create a copy of this node.  */
			clone() {
				const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
				if (this.range) copy.range = this.range.slice();
				return copy;
			}
			/** A plain JavaScript representation of this node. */
			toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
				if (!isDocument(doc)) throw new TypeError("A document argument is required");
				const ctx = {
					anchors: /* @__PURE__ */ new Map(),
					doc,
					keep: true,
					mapAsMap: mapAsMap === true,
					mapKeyWarned: false,
					maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
				};
				const res = toJS(this, "", ctx);
				if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
				return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/Alias.js
		var Alias = class extends NodeBase {
			constructor(source) {
				super(ALIAS);
				this.source = source;
				Object.defineProperty(this, "tag", { set() {
					throw new Error("Alias nodes cannot have tags");
				} });
			}
			/**
			* Resolve the value of this alias within `doc`, finding the last
			* instance of the `source` anchor before this node.
			*/
			resolve(doc, ctx) {
				if (ctx?.maxAliasCount === 0) throw new ReferenceError("Alias resolution is disabled");
				let nodes;
				if (ctx?.aliasResolveCache) nodes = ctx.aliasResolveCache;
				else {
					nodes = [];
					visit$1(doc, { Node: (_key, node) => {
						if (isAlias(node) || hasAnchor(node)) nodes.push(node);
					} });
					if (ctx) ctx.aliasResolveCache = nodes;
				}
				let found = void 0;
				for (const node of nodes) {
					if (node === this) break;
					if (node.anchor === this.source) found = node;
				}
				return found;
			}
			toJSON(_arg, ctx) {
				if (!ctx) return { source: this.source };
				const { anchors, doc, maxAliasCount } = ctx;
				const source = this.resolve(doc, ctx);
				if (!source) {
					const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
					throw new ReferenceError(msg);
				}
				let data = anchors.get(source);
				if (!data) {
					toJS(source, null, ctx);
					data = anchors.get(source);
				}
				/* istanbul ignore if */
				if (data?.res === void 0) throw new ReferenceError("This should not happen: Alias anchor was not resolved?");
				if (maxAliasCount >= 0) {
					data.count += 1;
					if (data.aliasCount === 0) data.aliasCount = getAliasCount(doc, source, anchors);
					if (data.count * data.aliasCount > maxAliasCount) throw new ReferenceError("Excessive alias count indicates a resource exhaustion attack");
				}
				return data.res;
			}
			toString(ctx, _onComment, _onChompKeep) {
				const src = `*${this.source}`;
				if (ctx) {
					anchorIsValid(this.source);
					if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
						const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
						throw new Error(msg);
					}
					if (ctx.implicitKey) return `${src} `;
				}
				return src;
			}
		};
		function getAliasCount(doc, node, anchors) {
			if (isAlias(node)) {
				const source = node.resolve(doc);
				const anchor = anchors && source && anchors.get(source);
				return anchor ? anchor.count * anchor.aliasCount : 0;
			} else if (isCollection(node)) {
				let count = 0;
				for (const item of node.items) {
					const c = getAliasCount(doc, item, anchors);
					if (c > count) count = c;
				}
				return count;
			} else if (isPair(node)) {
				const kc = getAliasCount(doc, node.key, anchors);
				const vc = getAliasCount(doc, node.value, anchors);
				return Math.max(kc, vc);
			}
			return 1;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/Scalar.js
		const isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";
		var Scalar = class extends NodeBase {
			constructor(value) {
				super(SCALAR$1);
				this.value = value;
			}
			toJSON(arg, ctx) {
				return ctx?.keep ? this.value : toJS(this.value, arg, ctx);
			}
			toString() {
				return String(this.value);
			}
		};
		Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
		Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
		Scalar.PLAIN = "PLAIN";
		Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
		Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/doc/createNode.js
		const defaultTagPrefix = "tag:yaml.org,2002:";
		function findTagObject(value, tagName, tags) {
			if (tagName) {
				const match = tags.filter((t) => t.tag === tagName);
				const tagObj = match.find((t) => !t.format) ?? match[0];
				if (!tagObj) throw new Error(`Tag ${tagName} not found`);
				return tagObj;
			}
			return tags.find((t) => t.identify?.(value) && !t.format);
		}
		function createNode(value, tagName, ctx) {
			if (isDocument(value)) value = value.contents;
			if (isNode(value)) return value;
			if (isPair(value)) {
				const map = ctx.schema[MAP].createNode?.(ctx.schema, null, ctx);
				map.items.push(value);
				return map;
			}
			if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) value = value.valueOf();
			const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
			let ref = void 0;
			if (aliasDuplicateObjects && value && typeof value === "object") {
				ref = sourceObjects.get(value);
				if (ref) {
					ref.anchor ?? (ref.anchor = onAnchor(value));
					return new Alias(ref.anchor);
				} else {
					ref = {
						anchor: null,
						node: null
					};
					sourceObjects.set(value, ref);
				}
			}
			if (tagName?.startsWith("!!")) tagName = defaultTagPrefix + tagName.slice(2);
			let tagObj = findTagObject(value, tagName, schema.tags);
			if (!tagObj) {
				if (value && typeof value.toJSON === "function") value = value.toJSON();
				if (!value || typeof value !== "object") {
					const node = new Scalar(value);
					if (ref) ref.node = node;
					return node;
				}
				tagObj = value instanceof Map ? schema[MAP] : Symbol.iterator in Object(value) ? schema[SEQ] : schema[MAP];
			}
			if (onTagObj) {
				onTagObj(tagObj);
				delete ctx.onTagObj;
			}
			const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar(value);
			if (tagName) node.tag = tagName;
			else if (!tagObj.default) node.tag = tagObj.tag;
			if (ref) ref.node = node;
			return node;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/Collection.js
		function collectionFromPath(schema, path, value) {
			let v = value;
			for (let i = path.length - 1; i >= 0; --i) {
				const k = path[i];
				if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
					const a = [];
					a[k] = v;
					v = a;
				} else v = /* @__PURE__ */ new Map([[k, v]]);
			}
			return createNode(v, void 0, {
				aliasDuplicateObjects: false,
				keepUndefined: false,
				onAnchor: () => {
					throw new Error("This should not happen, please report a bug.");
				},
				schema,
				sourceObjects: /* @__PURE__ */ new Map()
			});
		}
		const isEmptyPath = (path) => path == null || typeof path === "object" && !!path[Symbol.iterator]().next().done;
		var Collection = class extends NodeBase {
			constructor(type, schema) {
				super(type);
				Object.defineProperty(this, "schema", {
					value: schema,
					configurable: true,
					enumerable: false,
					writable: true
				});
			}
			/**
			* Create a copy of this collection.
			*
			* @param schema - If defined, overwrites the original's schema
			*/
			clone(schema) {
				const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
				if (schema) copy.schema = schema;
				copy.items = copy.items.map((it) => isNode(it) || isPair(it) ? it.clone(schema) : it);
				if (this.range) copy.range = this.range.slice();
				return copy;
			}
			/**
			* Adds a value to the collection. For `!!map` and `!!omap` the value must
			* be a Pair instance or a `{ key, value }` object, which may not have a key
			* that already exists in the map.
			*/
			addIn(path, value) {
				if (isEmptyPath(path)) this.add(value);
				else {
					const [key, ...rest] = path;
					const node = this.get(key, true);
					if (isCollection(node)) node.addIn(rest, value);
					else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
					else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
				}
			}
			/**
			* Removes a value from the collection.
			* @returns `true` if the item was found and removed.
			*/
			deleteIn(path) {
				const [key, ...rest] = path;
				if (rest.length === 0) return this.delete(key);
				const node = this.get(key, true);
				if (isCollection(node)) return node.deleteIn(rest);
				else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
			}
			/**
			* Returns item at `key`, or `undefined` if not found. By default unwraps
			* scalar values from their surrounding node; to disable set `keepScalar` to
			* `true` (collections are always returned intact).
			*/
			getIn(path, keepScalar) {
				const [key, ...rest] = path;
				const node = this.get(key, true);
				if (rest.length === 0) return !keepScalar && isScalar(node) ? node.value : node;
				else return isCollection(node) ? node.getIn(rest, keepScalar) : void 0;
			}
			hasAllNullValues(allowScalar) {
				return this.items.every((node) => {
					if (!isPair(node)) return false;
					const n = node.value;
					return n == null || allowScalar && isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
				});
			}
			/**
			* Checks if the collection includes a value with the key `key`.
			*/
			hasIn(path) {
				const [key, ...rest] = path;
				if (rest.length === 0) return this.has(key);
				const node = this.get(key, true);
				return isCollection(node) ? node.hasIn(rest) : false;
			}
			/**
			* Sets a value in this collection. For `!!set`, `value` needs to be a
			* boolean to add/remove the item from the set.
			*/
			setIn(path, value) {
				const [key, ...rest] = path;
				if (rest.length === 0) this.set(key, value);
				else {
					const node = this.get(key, true);
					if (isCollection(node)) node.setIn(rest, value);
					else if (node === void 0 && this.schema) this.set(key, collectionFromPath(this.schema, rest, value));
					else throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
				}
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/stringify/stringifyComment.js
		/**
		* Stringifies a comment.
		*
		* Empty comment lines are left empty,
		* lines consisting of a single space are replaced by `#`,
		* and all other lines are prefixed with a `#`.
		*/
		const stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
		function indentComment(comment, indent) {
			if (/^\n+$/.test(comment)) return comment.substring(1);
			return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
		}
		const lineComment = (str, indent, comment) => str.endsWith("\n") ? indentComment(comment, indent) : comment.includes("\n") ? "\n" + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/stringify/foldFlowLines.js
		const FOLD_FLOW = "flow";
		const FOLD_BLOCK = "block";
		const FOLD_QUOTED = "quoted";
		/**
		* Tries to keep input at up to `lineWidth` characters, splitting only on spaces
		* not followed by newlines or spaces unless `mode` is `'quoted'`. Lines are
		* terminated with `\n` and started with `indent`.
		*/
		function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
			if (!lineWidth || lineWidth < 0) return text;
			if (lineWidth < minContentWidth) minContentWidth = 0;
			const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
			if (text.length <= endStep) return text;
			const folds = [];
			const escapedFolds = {};
			let end = lineWidth - indent.length;
			if (typeof indentAtStart === "number") {
				if (indentAtStart > lineWidth - Math.max(2, minContentWidth)) folds.push(0);
				else end = lineWidth - indentAtStart;
			}
			let split = void 0;
			let prev = void 0;
			let overflow = false;
			let i = -1;
			let escStart = -1;
			let escEnd = -1;
			if (mode === "block") {
				i = consumeMoreIndentedLines(text, i, indent.length);
				if (i !== -1) end = i + endStep;
			}
			for (let ch; ch = text[i += 1];) {
				if (mode === "quoted" && ch === "\\") {
					escStart = i;
					switch (text[i + 1]) {
						case "x":
							i += 3;
							break;
						case "u":
							i += 5;
							break;
						case "U":
							i += 9;
							break;
						default: i += 1;
					}
					escEnd = i;
				}
				if (ch === "\n") {
					if (mode === "block") i = consumeMoreIndentedLines(text, i, indent.length);
					end = i + indent.length + endStep;
					split = void 0;
				} else {
					if (ch === " " && prev && prev !== " " && prev !== "\n" && prev !== "	") {
						const next = text[i + 1];
						if (next && next !== " " && next !== "\n" && next !== "	") split = i;
					}
					if (i >= end) {
						if (split) {
							folds.push(split);
							end = split + endStep;
							split = void 0;
						} else if (mode === "quoted") {
							while (prev === " " || prev === "	") {
								prev = ch;
								ch = text[i += 1];
								overflow = true;
							}
							const j = i > escEnd + 1 ? i - 2 : escStart - 1;
							if (escapedFolds[j]) return text;
							folds.push(j);
							escapedFolds[j] = true;
							end = j + endStep;
							split = void 0;
						} else overflow = true;
					}
				}
				prev = ch;
			}
			if (overflow && onOverflow) onOverflow();
			if (folds.length === 0) return text;
			if (onFold) onFold();
			let res = text.slice(0, folds[0]);
			for (let i = 0; i < folds.length; ++i) {
				const fold = folds[i];
				const end = folds[i + 1] || text.length;
				if (fold === 0) res = `\n${indent}${text.slice(0, end)}`;
				else {
					if (mode === "quoted" && escapedFolds[fold]) res += `${text[fold]}\\`;
					res += `\n${indent}${text.slice(fold + 1, end)}`;
				}
			}
			return res;
		}
		/**
		* Presumes `i + 1` is at the start of a line
		* @returns index of last newline in more-indented block
		*/
		function consumeMoreIndentedLines(text, i, indent) {
			let end = i;
			let start = i + 1;
			let ch = text[start];
			while (ch === " " || ch === "	") if (i < start + indent) ch = text[++i];
			else {
				do
					ch = text[++i];
				while (ch && ch !== "\n");
				end = i;
				start = i + 1;
				ch = text[start];
			}
			return end;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/stringify/stringifyString.js
		const getFoldOptions = (ctx, isBlock) => ({
			indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
			lineWidth: ctx.options.lineWidth,
			minContentWidth: ctx.options.minContentWidth
		});
		const containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
		function lineLengthOverLimit(str, lineWidth, indentLength) {
			if (!lineWidth || lineWidth < 0) return false;
			const limit = lineWidth - indentLength;
			const strLen = str.length;
			if (strLen <= limit) return false;
			for (let i = 0, start = 0; i < strLen; ++i) if (str[i] === "\n") {
				if (i - start > limit) return true;
				start = i + 1;
				if (strLen - start <= limit) return false;
			}
			return true;
		}
		function doubleQuotedString(value, ctx) {
			const json = JSON.stringify(value);
			if (ctx.options.doubleQuotedAsJSON) return json;
			const { implicitKey } = ctx;
			const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
			const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
			let str = "";
			let start = 0;
			for (let i = 0, ch = json[i]; ch; ch = json[++i]) {
				if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
					str += json.slice(start, i) + "\\ ";
					i += 1;
					start = i;
					ch = "\\";
				}
				if (ch === "\\") switch (json[i + 1]) {
					case "u":
						{
							str += json.slice(start, i);
							const code = json.substr(i + 2, 4);
							switch (code) {
								case "0000":
									str += "\\0";
									break;
								case "0007":
									str += "\\a";
									break;
								case "000b":
									str += "\\v";
									break;
								case "001b":
									str += "\\e";
									break;
								case "0085":
									str += "\\N";
									break;
								case "00a0":
									str += "\\_";
									break;
								case "2028":
									str += "\\L";
									break;
								case "2029":
									str += "\\P";
									break;
								default: if (code.substr(0, 2) === "00") str += "\\x" + code.substr(2);
								else str += json.substr(i, 6);
							}
							i += 5;
							start = i + 1;
						}
						break;
					case "n":
						if (implicitKey || json[i + 2] === "\"" || json.length < minMultiLineLength) i += 1;
						else {
							str += json.slice(start, i) + "\n\n";
							while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== "\"") {
								str += "\n";
								i += 2;
							}
							str += indent;
							if (json[i + 2] === " ") str += "\\";
							i += 1;
							start = i + 1;
						}
						break;
					default: i += 1;
				}
			}
			str = start ? str + json.slice(start) : json;
			return implicitKey ? str : foldFlowLines(str, indent, FOLD_QUOTED, getFoldOptions(ctx, false));
		}
		function singleQuotedString(value, ctx) {
			if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes("\n") || /[ \t]\n|\n[ \t]/.test(value)) return doubleQuotedString(value, ctx);
			const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
			const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&\n${indent}`) + "'";
			return ctx.implicitKey ? res : foldFlowLines(res, indent, FOLD_FLOW, getFoldOptions(ctx, false));
		}
		function quotedString(value, ctx) {
			const { singleQuote } = ctx.options;
			let qs;
			if (singleQuote === false) qs = doubleQuotedString;
			else {
				const hasDouble = value.includes("\"");
				const hasSingle = value.includes("'");
				if (hasDouble && !hasSingle) qs = singleQuotedString;
				else if (hasSingle && !hasDouble) qs = doubleQuotedString;
				else qs = singleQuote ? singleQuotedString : doubleQuotedString;
			}
			return qs(value, ctx);
		}
		let blockEndNewlines;
		try {
			blockEndNewlines = /* @__PURE__ */ new RegExp("(^|(?<!\n))\n+(?!\n|$)", "g");
		} catch {
			blockEndNewlines = /\n+(?!\n|$)/g;
		}
		function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
			const { blockQuote, commentString, lineWidth } = ctx.options;
			if (!blockQuote || /\n[\t ]+$/.test(value)) return quotedString(value, ctx);
			const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
			const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.BLOCK_FOLDED ? false : type === Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
			if (!value) return literal ? "|\n" : ">\n";
			let chomp;
			let endStart;
			for (endStart = value.length; endStart > 0; --endStart) {
				const ch = value[endStart - 1];
				if (ch !== "\n" && ch !== "	" && ch !== " ") break;
			}
			let end = value.substring(endStart);
			const endNlPos = end.indexOf("\n");
			if (endNlPos === -1) chomp = "-";
			else if (value === end || endNlPos !== end.length - 1) {
				chomp = "+";
				if (onChompKeep) onChompKeep();
			} else chomp = "";
			if (end) {
				value = value.slice(0, -end.length);
				if (end[end.length - 1] === "\n") end = end.slice(0, -1);
				end = end.replace(blockEndNewlines, `$&${indent}`);
			}
			let startWithSpace = false;
			let startEnd;
			let startNlPos = -1;
			for (startEnd = 0; startEnd < value.length; ++startEnd) {
				const ch = value[startEnd];
				if (ch === " ") startWithSpace = true;
				else if (ch === "\n") startNlPos = startEnd;
				else break;
			}
			let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
			if (start) {
				value = value.substring(start.length);
				start = start.replace(/\n+/g, `$&${indent}`);
			}
			let header = (startWithSpace ? indent ? "2" : "1" : "") + chomp;
			if (comment) {
				header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
				if (onComment) onComment();
			}
			if (!literal) {
				const foldedValue = value.replace(/\n+/g, "\n$&").replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
				let literalFallback = false;
				const foldOptions = getFoldOptions(ctx, true);
				if (blockQuote !== "folded" && type !== Scalar.BLOCK_FOLDED) foldOptions.onOverflow = () => {
					literalFallback = true;
				};
				const body = foldFlowLines(`${start}${foldedValue}${end}`, indent, FOLD_BLOCK, foldOptions);
				if (!literalFallback) return `>${header}\n${indent}${body}`;
			}
			value = value.replace(/\n+/g, `$&${indent}`);
			return `|${header}\n${indent}${start}${value}${end}`;
		}
		function plainString(item, ctx, onComment, onChompKeep) {
			const { type, value } = item;
			const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
			if (implicitKey && value.includes("\n") || inFlow && /[[\]{},]/.test(value)) return quotedString(value, ctx);
			if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) return implicitKey || inFlow || !value.includes("\n") ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
			if (!implicitKey && !inFlow && type !== Scalar.PLAIN && value.includes("\n")) return blockString(item, ctx, onComment, onChompKeep);
			if (containsDocumentMarker(value)) {
				if (indent === "") {
					ctx.forceBlockIndent = true;
					return blockString(item, ctx, onComment, onChompKeep);
				} else if (implicitKey && indent === indentStep) return quotedString(value, ctx);
			}
			const str = value.replace(/\n+/g, `$&\n${indent}`);
			if (actualString) {
				const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
				const { compat, tags } = ctx.doc.schema;
				if (tags.some(test) || compat?.some(test)) return quotedString(value, ctx);
			}
			return implicitKey ? str : foldFlowLines(str, indent, FOLD_FLOW, getFoldOptions(ctx, false));
		}
		function stringifyString(item, ctx, onComment, onChompKeep) {
			const { implicitKey, inFlow } = ctx;
			const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
			let { type } = item;
			if (type !== Scalar.QUOTE_DOUBLE) {
				if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value)) type = Scalar.QUOTE_DOUBLE;
			}
			const _stringify = (_type) => {
				switch (_type) {
					case Scalar.BLOCK_FOLDED:
					case Scalar.BLOCK_LITERAL: return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
					case Scalar.QUOTE_DOUBLE: return doubleQuotedString(ss.value, ctx);
					case Scalar.QUOTE_SINGLE: return singleQuotedString(ss.value, ctx);
					case Scalar.PLAIN: return plainString(ss, ctx, onComment, onChompKeep);
					default: return null;
				}
			};
			let res = _stringify(type);
			if (res === null) {
				const { defaultKeyType, defaultStringType } = ctx.options;
				const t = implicitKey && defaultKeyType || defaultStringType;
				res = _stringify(t);
				if (res === null) throw new Error(`Unsupported default string type ${t}`);
			}
			return res;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/stringify/stringify.js
		function createStringifyContext(doc, options) {
			const opt = Object.assign({
				blockQuote: true,
				commentString: stringifyComment,
				defaultKeyType: null,
				defaultStringType: "PLAIN",
				directives: null,
				doubleQuotedAsJSON: false,
				doubleQuotedMinMultiLineLength: 40,
				falseStr: "false",
				flowCollectionPadding: true,
				indentSeq: true,
				lineWidth: 80,
				minContentWidth: 20,
				nullStr: "null",
				simpleKeys: false,
				singleQuote: null,
				trailingComma: false,
				trueStr: "true",
				verifyAliasOrder: true
			}, doc.schema.toStringOptions, options);
			let inFlow;
			switch (opt.collectionStyle) {
				case "block":
					inFlow = false;
					break;
				case "flow":
					inFlow = true;
					break;
				default: inFlow = null;
			}
			return {
				anchors: /* @__PURE__ */ new Set(),
				doc,
				flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
				indent: "",
				indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
				inFlow,
				options: opt
			};
		}
		function getTagObject(tags, item) {
			if (item.tag) {
				const match = tags.filter((t) => t.tag === item.tag);
				if (match.length > 0) return match.find((t) => t.format === item.format) ?? match[0];
			}
			let tagObj = void 0;
			let obj;
			if (isScalar(item)) {
				obj = item.value;
				let match = tags.filter((t) => t.identify?.(obj));
				if (match.length > 1) {
					const testMatch = match.filter((t) => t.test);
					if (testMatch.length > 0) match = testMatch;
				}
				tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
			} else {
				obj = item;
				tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
			}
			if (!tagObj) {
				const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
				throw new Error(`Tag not resolved for ${name} value`);
			}
			return tagObj;
		}
		function stringifyProps(node, tagObj, { anchors, doc }) {
			if (!doc.directives) return "";
			const props = [];
			const anchor = (isScalar(node) || isCollection(node)) && node.anchor;
			if (anchor && anchorIsValid(anchor)) {
				anchors.add(anchor);
				props.push(`&${anchor}`);
			}
			const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
			if (tag) props.push(doc.directives.tagString(tag));
			return props.join(" ");
		}
		function stringify(item, ctx, onComment, onChompKeep) {
			if (isPair(item)) return item.toString(ctx, onComment, onChompKeep);
			if (isAlias(item)) {
				if (ctx.doc.directives) return item.toString(ctx);
				if (ctx.resolvedAliases?.has(item)) throw new TypeError(`Cannot stringify circular structure without alias nodes`);
				else {
					if (ctx.resolvedAliases) ctx.resolvedAliases.add(item);
					else ctx.resolvedAliases = /* @__PURE__ */ new Set([item]);
					item = item.resolve(ctx.doc);
				}
			}
			let tagObj = void 0;
			const node = isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
			tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
			const props = stringifyProps(node, tagObj, ctx);
			if (props.length > 0) ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
			const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : isScalar(node) ? stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
			if (!props) return str;
			return isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}\n${ctx.indent}${str}`;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/stringify/stringifyPair.js
		function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
			const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
			let keyComment = isNode(key) && key.comment || null;
			if (simpleKeys) {
				if (keyComment) throw new Error("With simple keys, key nodes cannot have comments");
				if (isCollection(key) || !isNode(key) && typeof key === "object") throw new Error("With simple keys, collection cannot be used as a key value");
			}
			let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || isCollection(key) || (isScalar(key) ? key.type === Scalar.BLOCK_FOLDED || key.type === Scalar.BLOCK_LITERAL : typeof key === "object"));
			ctx = Object.assign({}, ctx, {
				allNullValues: false,
				implicitKey: !explicitKey && (simpleKeys || !allNullValues),
				indent: indent + indentStep
			});
			let keyCommentDone = false;
			let chompKeep = false;
			let str = stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
			if (!explicitKey && !ctx.inFlow && str.length > 1024) {
				if (simpleKeys) throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
				explicitKey = true;
			}
			if (ctx.inFlow) {
				if (allNullValues || value == null) {
					if (keyCommentDone && onComment) onComment();
					return str === "" ? "?" : explicitKey ? `? ${str}` : str;
				}
			} else if (allNullValues && !simpleKeys || value == null && explicitKey) {
				str = `? ${str}`;
				if (keyComment && !keyCommentDone) str += lineComment(str, ctx.indent, commentString(keyComment));
				else if (chompKeep && onChompKeep) onChompKeep();
				return str;
			}
			if (keyCommentDone) keyComment = null;
			if (explicitKey) {
				if (keyComment) str += lineComment(str, ctx.indent, commentString(keyComment));
				str = `? ${str}\n${indent}:`;
			} else {
				str = `${str}:`;
				if (keyComment) str += lineComment(str, ctx.indent, commentString(keyComment));
			}
			let vsb, vcb, valueComment;
			if (isNode(value)) {
				vsb = !!value.spaceBefore;
				vcb = value.commentBefore;
				valueComment = value.comment;
			} else {
				vsb = false;
				vcb = null;
				valueComment = null;
				if (value && typeof value === "object") value = doc.createNode(value);
			}
			ctx.implicitKey = false;
			if (!explicitKey && !keyComment && isScalar(value)) ctx.indentAtStart = str.length + 1;
			chompKeep = false;
			if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && isSeq(value) && !value.flow && !value.tag && !value.anchor) ctx.indent = ctx.indent.substring(2);
			let valueCommentDone = false;
			const valueStr = stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
			let ws = " ";
			if (keyComment || vsb || vcb) {
				ws = vsb ? "\n" : "";
				if (vcb) {
					const cs = commentString(vcb);
					ws += `\n${indentComment(cs, ctx.indent)}`;
				}
				if (valueStr === "" && !ctx.inFlow) {
					if (ws === "\n" && valueComment) ws = "\n\n";
				} else ws += `\n${ctx.indent}`;
			} else if (!explicitKey && isCollection(value)) {
				const vs0 = valueStr[0];
				const nl0 = valueStr.indexOf("\n");
				const hasNewline = nl0 !== -1;
				const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
				if (hasNewline || !flow) {
					let hasPropsLine = false;
					if (hasNewline && (vs0 === "&" || vs0 === "!")) {
						let sp0 = valueStr.indexOf(" ");
						if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") sp0 = valueStr.indexOf(" ", sp0 + 1);
						if (sp0 === -1 || nl0 < sp0) hasPropsLine = true;
					}
					if (!hasPropsLine) ws = `\n${ctx.indent}`;
				}
			} else if (valueStr === "" || valueStr[0] === "\n") ws = "";
			str += ws + valueStr;
			if (ctx.inFlow) {
				if (valueCommentDone && onComment) onComment();
			} else if (valueComment && !valueCommentDone) str += lineComment(str, ctx.indent, commentString(valueComment));
			else if (chompKeep && onChompKeep) onChompKeep();
			return str;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/log.js
		function warn(logLevel, warning) {
			if (logLevel === "debug" || logLevel === "warn") console.warn(warning);
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/merge.js
		const MERGE_KEY = "<<";
		const merge$1 = {
			identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
			default: "key",
			tag: "tag:yaml.org,2002:merge",
			test: /^<<$/,
			resolve: () => Object.assign(new Scalar(Symbol(MERGE_KEY)), { addToJSMap: addMergeToJSMap }),
			stringify: () => MERGE_KEY
		};
		const isMergeKey = (ctx, key) => (merge$1.identify(key) || isScalar(key) && (!key.type || key.type === Scalar.PLAIN) && merge$1.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge$1.tag && tag.default);
		function addMergeToJSMap(ctx, map, value) {
			const source = resolveAliasValue(ctx, value);
			if (isSeq(source)) for (const it of source.items) mergeValue(ctx, map, it);
			else if (Array.isArray(source)) for (const it of source) mergeValue(ctx, map, it);
			else mergeValue(ctx, map, source);
		}
		function mergeValue(ctx, map, value) {
			const source = resolveAliasValue(ctx, value);
			if (!isMap(source)) throw new Error("Merge sources must be maps or map aliases");
			const srcMap = source.toJSON(null, ctx, Map);
			for (const [key, value] of srcMap) if (map instanceof Map) {
				if (!map.has(key)) map.set(key, value);
			} else if (map instanceof Set) map.add(key);
			else if (!Object.prototype.hasOwnProperty.call(map, key)) Object.defineProperty(map, key, {
				value,
				writable: true,
				enumerable: true,
				configurable: true
			});
			return map;
		}
		function resolveAliasValue(ctx, value) {
			return ctx && isAlias(value) ? value.resolve(ctx.doc, ctx) : value;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/addPairToJSMap.js
		function addPairToJSMap(ctx, map, { key, value }) {
			if (isNode(key) && key.addToJSMap) key.addToJSMap(ctx, map, value);
			else if (isMergeKey(ctx, key)) addMergeToJSMap(ctx, map, value);
			else {
				const jsKey = toJS(key, "", ctx);
				if (map instanceof Map) map.set(jsKey, toJS(value, jsKey, ctx));
				else if (map instanceof Set) map.add(jsKey);
				else {
					const stringKey = stringifyKey(key, jsKey, ctx);
					const jsValue = toJS(value, stringKey, ctx);
					if (stringKey in map) Object.defineProperty(map, stringKey, {
						value: jsValue,
						writable: true,
						enumerable: true,
						configurable: true
					});
					else map[stringKey] = jsValue;
				}
			}
			return map;
		}
		function stringifyKey(key, jsKey, ctx) {
			if (jsKey === null) return "";
			if (typeof jsKey !== "object") return String(jsKey);
			if (isNode(key) && ctx?.doc) {
				const strCtx = createStringifyContext(ctx.doc, {});
				strCtx.anchors = /* @__PURE__ */ new Set();
				for (const node of ctx.anchors.keys()) strCtx.anchors.add(node.anchor);
				strCtx.inFlow = true;
				strCtx.inStringifyKey = true;
				const strKey = key.toString(strCtx);
				if (!ctx.mapKeyWarned) {
					let jsonStr = JSON.stringify(strKey);
					if (jsonStr.length > 40) jsonStr = jsonStr.substring(0, 36) + "...\"";
					warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
					ctx.mapKeyWarned = true;
				}
				return strKey;
			}
			return JSON.stringify(jsKey);
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/Pair.js
		function createPair(key, value, ctx) {
			return new Pair(createNode(key, void 0, ctx), createNode(value, void 0, ctx));
		}
		var Pair = class Pair {
			constructor(key, value = null) {
				Object.defineProperty(this, NODE_TYPE, { value: PAIR });
				this.key = key;
				this.value = value;
			}
			clone(schema) {
				let { key, value } = this;
				if (isNode(key)) key = key.clone(schema);
				if (isNode(value)) value = value.clone(schema);
				return new Pair(key, value);
			}
			toJSON(_, ctx) {
				return addPairToJSMap(ctx, ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {}, this);
			}
			toString(ctx, onComment, onChompKeep) {
				return ctx?.doc ? stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/stringify/stringifyCollection.js
		function stringifyCollection(collection, ctx, options) {
			return (ctx.inFlow ?? collection.flow ? stringifyFlowCollection : stringifyBlockCollection)(collection, ctx, options);
		}
		function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
			const { indent, options: { commentString } } = ctx;
			const itemCtx = Object.assign({}, ctx, {
				indent: itemIndent,
				type: null
			});
			let chompKeep = false;
			const lines = [];
			for (let i = 0; i < items.length; ++i) {
				const item = items[i];
				let comment = null;
				if (isNode(item)) {
					if (!chompKeep && item.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
					if (item.comment) comment = item.comment;
				} else if (isPair(item)) {
					const ik = isNode(item.key) ? item.key : null;
					if (ik) {
						if (!chompKeep && ik.spaceBefore) lines.push("");
						addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
					}
				}
				chompKeep = false;
				let str = stringify(item, itemCtx, () => comment = null, () => chompKeep = true);
				if (comment) str += lineComment(str, itemIndent, commentString(comment));
				if (chompKeep && comment) chompKeep = false;
				lines.push(blockItemPrefix + str);
			}
			let str;
			if (lines.length === 0) str = flowChars.start + flowChars.end;
			else {
				str = lines[0];
				for (let i = 1; i < lines.length; ++i) {
					const line = lines[i];
					str += line ? `\n${indent}${line}` : "\n";
				}
			}
			if (comment) {
				str += "\n" + indentComment(commentString(comment), indent);
				if (onComment) onComment();
			} else if (chompKeep && onChompKeep) onChompKeep();
			return str;
		}
		function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
			const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
			itemIndent += indentStep;
			const itemCtx = Object.assign({}, ctx, {
				indent: itemIndent,
				inFlow: true,
				type: null
			});
			let reqNewline = false;
			let linesAtValue = 0;
			const lines = [];
			for (let i = 0; i < items.length; ++i) {
				const item = items[i];
				let comment = null;
				if (isNode(item)) {
					if (item.spaceBefore) lines.push("");
					addCommentBefore(ctx, lines, item.commentBefore, false);
					if (item.comment) comment = item.comment;
				} else if (isPair(item)) {
					const ik = isNode(item.key) ? item.key : null;
					if (ik) {
						if (ik.spaceBefore) lines.push("");
						addCommentBefore(ctx, lines, ik.commentBefore, false);
						if (ik.comment) reqNewline = true;
					}
					const iv = isNode(item.value) ? item.value : null;
					if (iv) {
						if (iv.comment) comment = iv.comment;
						if (iv.commentBefore) reqNewline = true;
					} else if (item.value == null && ik?.comment) comment = ik.comment;
				}
				if (comment) reqNewline = true;
				let str = stringify(item, itemCtx, () => comment = null);
				reqNewline || (reqNewline = lines.length > linesAtValue || str.includes("\n"));
				if (i < items.length - 1) str += ",";
				else if (ctx.options.trailingComma) {
					if (ctx.options.lineWidth > 0) reqNewline || (reqNewline = lines.reduce((sum, line) => sum + line.length + 2, 2) + (str.length + 2) > ctx.options.lineWidth);
					if (reqNewline) str += ",";
				}
				if (comment) str += lineComment(str, itemIndent, commentString(comment));
				lines.push(str);
				linesAtValue = lines.length;
			}
			const { start, end } = flowChars;
			if (lines.length === 0) return start + end;
			else {
				if (!reqNewline) {
					const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
					reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
				}
				if (reqNewline) {
					let str = start;
					for (const line of lines) str += line ? `\n${indentStep}${indent}${line}` : "\n";
					return `${str}\n${indent}${end}`;
				} else return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
			}
		}
		function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
			if (comment && chompKeep) comment = comment.replace(/^\n+/, "");
			if (comment) {
				const ic = indentComment(commentString(comment), indent);
				lines.push(ic.trimStart());
			}
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/YAMLMap.js
		function findPair(items, key) {
			const k = isScalar(key) ? key.value : key;
			for (const it of items) if (isPair(it)) {
				if (it.key === key || it.key === k) return it;
				if (isScalar(it.key) && it.key.value === k) return it;
			}
		}
		var YAMLMap = class extends Collection {
			static get tagName() {
				return "tag:yaml.org,2002:map";
			}
			constructor(schema) {
				super(MAP, schema);
				this.items = [];
			}
			/**
			* A generic collection parsing method that can be extended
			* to other node classes that inherit from YAMLMap
			*/
			static from(schema, obj, ctx) {
				const { keepUndefined, replacer } = ctx;
				const map = new this(schema);
				const add = (key, value) => {
					if (typeof replacer === "function") value = replacer.call(obj, key, value);
					else if (Array.isArray(replacer) && !replacer.includes(key)) return;
					if (value !== void 0 || keepUndefined) map.items.push(createPair(key, value, ctx));
				};
				if (obj instanceof Map) for (const [key, value] of obj) add(key, value);
				else if (obj && typeof obj === "object") for (const key of Object.keys(obj)) add(key, obj[key]);
				if (typeof schema.sortMapEntries === "function") map.items.sort(schema.sortMapEntries);
				return map;
			}
			/**
			* Adds a value to the collection.
			*
			* @param overwrite - If not set `true`, using a key that is already in the
			*   collection will throw. Otherwise, overwrites the previous value.
			*/
			add(pair, overwrite) {
				let _pair;
				if (isPair(pair)) _pair = pair;
				else if (!pair || typeof pair !== "object" || !("key" in pair)) _pair = new Pair(pair, pair?.value);
				else _pair = new Pair(pair.key, pair.value);
				const prev = findPair(this.items, _pair.key);
				const sortEntries = this.schema?.sortMapEntries;
				if (prev) {
					if (!overwrite) throw new Error(`Key ${_pair.key} already set`);
					if (isScalar(prev.value) && isScalarValue(_pair.value)) prev.value.value = _pair.value;
					else prev.value = _pair.value;
				} else if (sortEntries) {
					const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
					if (i === -1) this.items.push(_pair);
					else this.items.splice(i, 0, _pair);
				} else this.items.push(_pair);
			}
			delete(key) {
				const it = findPair(this.items, key);
				if (!it) return false;
				return this.items.splice(this.items.indexOf(it), 1).length > 0;
			}
			get(key, keepScalar) {
				const node = findPair(this.items, key)?.value;
				return (!keepScalar && isScalar(node) ? node.value : node) ?? void 0;
			}
			has(key) {
				return !!findPair(this.items, key);
			}
			set(key, value) {
				this.add(new Pair(key, value), true);
			}
			/**
			* @param ctx - Conversion context, originally set in Document#toJS()
			* @param {Class} Type - If set, forces the returned collection type
			* @returns Instance of Type, Map, or Object
			*/
			toJSON(_, ctx, Type) {
				const map = Type ? new Type() : ctx?.mapAsMap ? /* @__PURE__ */ new Map() : {};
				if (ctx?.onCreate) ctx.onCreate(map);
				for (const item of this.items) addPairToJSMap(ctx, map, item);
				return map;
			}
			toString(ctx, onComment, onChompKeep) {
				if (!ctx) return JSON.stringify(this);
				for (const item of this.items) if (!isPair(item)) throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
				if (!ctx.allNullValues && this.hasAllNullValues(false)) ctx = Object.assign({}, ctx, { allNullValues: true });
				return stringifyCollection(this, ctx, {
					blockItemPrefix: "",
					flowChars: {
						start: "{",
						end: "}"
					},
					itemIndent: ctx.indent || "",
					onChompKeep,
					onComment
				});
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/common/map.js
		const map = {
			collection: "map",
			default: true,
			nodeClass: YAMLMap,
			tag: "tag:yaml.org,2002:map",
			resolve(map, onError) {
				if (!isMap(map)) onError("Expected a mapping for this tag");
				return map;
			},
			createNode: (schema, obj, ctx) => YAMLMap.from(schema, obj, ctx)
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/nodes/YAMLSeq.js
		var YAMLSeq = class extends Collection {
			static get tagName() {
				return "tag:yaml.org,2002:seq";
			}
			constructor(schema) {
				super(SEQ, schema);
				this.items = [];
			}
			add(value) {
				this.items.push(value);
			}
			/**
			* Removes a value from the collection.
			*
			* `key` must contain a representation of an integer for this to succeed.
			* It may be wrapped in a `Scalar`.
			*
			* @returns `true` if the item was found and removed.
			*/
			delete(key) {
				const idx = asItemIndex(key);
				if (typeof idx !== "number") return false;
				return this.items.splice(idx, 1).length > 0;
			}
			get(key, keepScalar) {
				const idx = asItemIndex(key);
				if (typeof idx !== "number") return void 0;
				const it = this.items[idx];
				return !keepScalar && isScalar(it) ? it.value : it;
			}
			/**
			* Checks if the collection includes a value with the key `key`.
			*
			* `key` must contain a representation of an integer for this to succeed.
			* It may be wrapped in a `Scalar`.
			*/
			has(key) {
				const idx = asItemIndex(key);
				return typeof idx === "number" && idx < this.items.length;
			}
			/**
			* Sets a value in this collection. For `!!set`, `value` needs to be a
			* boolean to add/remove the item from the set.
			*
			* If `key` does not contain a representation of an integer, this will throw.
			* It may be wrapped in a `Scalar`.
			*/
			set(key, value) {
				const idx = asItemIndex(key);
				if (typeof idx !== "number") throw new Error(`Expected a valid index, not ${key}.`);
				const prev = this.items[idx];
				if (isScalar(prev) && isScalarValue(value)) prev.value = value;
				else this.items[idx] = value;
			}
			toJSON(_, ctx) {
				const seq = [];
				if (ctx?.onCreate) ctx.onCreate(seq);
				let i = 0;
				for (const item of this.items) seq.push(toJS(item, String(i++), ctx));
				return seq;
			}
			toString(ctx, onComment, onChompKeep) {
				if (!ctx) return JSON.stringify(this);
				return stringifyCollection(this, ctx, {
					blockItemPrefix: "- ",
					flowChars: {
						start: "[",
						end: "]"
					},
					itemIndent: (ctx.indent || "") + "  ",
					onChompKeep,
					onComment
				});
			}
			static from(schema, obj, ctx) {
				const { replacer } = ctx;
				const seq = new this(schema);
				if (obj && Symbol.iterator in Object(obj)) {
					let i = 0;
					for (let it of obj) {
						if (typeof replacer === "function") {
							const key = obj instanceof Set ? it : String(i++);
							it = replacer.call(obj, key, it);
						}
						seq.items.push(createNode(it, void 0, ctx));
					}
				}
				return seq;
			}
		};
		function asItemIndex(key) {
			let idx = isScalar(key) ? key.value : key;
			if (idx && typeof idx === "string") idx = Number(idx);
			return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/common/seq.js
		const seq = {
			collection: "seq",
			default: true,
			nodeClass: YAMLSeq,
			tag: "tag:yaml.org,2002:seq",
			resolve(seq, onError) {
				if (!isSeq(seq)) onError("Expected a sequence for this tag");
				return seq;
			},
			createNode: (schema, obj, ctx) => YAMLSeq.from(schema, obj, ctx)
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/common/string.js
		const string = {
			identify: (value) => typeof value === "string",
			default: true,
			tag: "tag:yaml.org,2002:str",
			resolve: (str) => str,
			stringify(item, ctx, onComment, onChompKeep) {
				ctx = Object.assign({ actualString: true }, ctx);
				return stringifyString(item, ctx, onComment, onChompKeep);
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/common/null.js
		const nullTag = {
			identify: (value) => value == null,
			createNode: () => new Scalar(null),
			default: true,
			tag: "tag:yaml.org,2002:null",
			test: /^(?:~|[Nn]ull|NULL)?$/,
			resolve: () => new Scalar(null),
			stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/core/bool.js
		const boolTag = {
			identify: (value) => typeof value === "boolean",
			default: true,
			tag: "tag:yaml.org,2002:bool",
			test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
			resolve: (str) => new Scalar(str[0] === "t" || str[0] === "T"),
			stringify({ source, value }, ctx) {
				if (source && boolTag.test.test(source)) {
					if (value === (source[0] === "t" || source[0] === "T")) return source;
				}
				return value ? ctx.options.trueStr : ctx.options.falseStr;
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/stringify/stringifyNumber.js
		function stringifyNumber({ format, minFractionDigits, tag, value }) {
			if (typeof value === "bigint") return String(value);
			const num = typeof value === "number" ? value : Number(value);
			if (!isFinite(num)) return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
			let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
			if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^-?\d/.test(n) && !n.includes("e")) {
				let i = n.indexOf(".");
				if (i < 0) {
					i = n.length;
					n += ".";
				}
				let d = minFractionDigits - (n.length - i - 1);
				while (d-- > 0) n += "0";
			}
			return n;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/core/float.js
		const floatNaN$1 = {
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
			resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
			stringify: stringifyNumber
		};
		const floatExp$1 = {
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			format: "EXP",
			test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
			resolve: (str) => parseFloat(str),
			stringify(node) {
				const num = Number(node.value);
				return isFinite(num) ? num.toExponential() : stringifyNumber(node);
			}
		};
		const float$1 = {
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
			resolve(str) {
				const node = new Scalar(parseFloat(str));
				const dot = str.indexOf(".");
				if (dot !== -1 && str[str.length - 1] === "0") node.minFractionDigits = str.length - dot - 1;
				return node;
			},
			stringify: stringifyNumber
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/core/int.js
		const intIdentify$2 = (value) => typeof value === "bigint" || Number.isInteger(value);
		const intResolve$1 = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
		function intStringify$1(node, radix, prefix) {
			const { value } = node;
			if (intIdentify$2(value) && value >= 0) return prefix + value.toString(radix);
			return stringifyNumber(node);
		}
		const intOct$1 = {
			identify: (value) => intIdentify$2(value) && value >= 0,
			default: true,
			tag: "tag:yaml.org,2002:int",
			format: "OCT",
			test: /^0o[0-7]+$/,
			resolve: (str, _onError, opt) => intResolve$1(str, 2, 8, opt),
			stringify: (node) => intStringify$1(node, 8, "0o")
		};
		const int$1 = {
			identify: intIdentify$2,
			default: true,
			tag: "tag:yaml.org,2002:int",
			test: /^[-+]?[0-9]+$/,
			resolve: (str, _onError, opt) => intResolve$1(str, 0, 10, opt),
			stringify: stringifyNumber
		};
		const intHex$1 = {
			identify: (value) => intIdentify$2(value) && value >= 0,
			default: true,
			tag: "tag:yaml.org,2002:int",
			format: "HEX",
			test: /^0x[0-9a-fA-F]+$/,
			resolve: (str, _onError, opt) => intResolve$1(str, 2, 16, opt),
			stringify: (node) => intStringify$1(node, 16, "0x")
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/core/schema.js
		const schema$2 = [
			map,
			seq,
			string,
			nullTag,
			boolTag,
			intOct$1,
			int$1,
			intHex$1,
			floatNaN$1,
			floatExp$1,
			float$1
		];
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/json/schema.js
		function intIdentify$1(value) {
			return typeof value === "bigint" || Number.isInteger(value);
		}
		const stringifyJSON = ({ value }) => JSON.stringify(value);
		const jsonScalars = [
			{
				identify: (value) => typeof value === "string",
				default: true,
				tag: "tag:yaml.org,2002:str",
				resolve: (str) => str,
				stringify: stringifyJSON
			},
			{
				identify: (value) => value == null,
				createNode: () => new Scalar(null),
				default: true,
				tag: "tag:yaml.org,2002:null",
				test: /^null$/,
				resolve: () => null,
				stringify: stringifyJSON
			},
			{
				identify: (value) => typeof value === "boolean",
				default: true,
				tag: "tag:yaml.org,2002:bool",
				test: /^true$|^false$/,
				resolve: (str) => str === "true",
				stringify: stringifyJSON
			},
			{
				identify: intIdentify$1,
				default: true,
				tag: "tag:yaml.org,2002:int",
				test: /^-?(?:0|[1-9][0-9]*)$/,
				resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
				stringify: ({ value }) => intIdentify$1(value) ? value.toString() : JSON.stringify(value)
			},
			{
				identify: (value) => typeof value === "number",
				default: true,
				tag: "tag:yaml.org,2002:float",
				test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
				resolve: (str) => parseFloat(str),
				stringify: stringifyJSON
			}
		];
		const schema$1 = [map, seq].concat(jsonScalars, {
			default: true,
			tag: "",
			test: /^/,
			resolve(str, onError) {
				onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
				return str;
			}
		});
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/binary.js
		const binary = {
			identify: (value) => value instanceof Uint8Array,
			default: false,
			tag: "tag:yaml.org,2002:binary",
			/**
			* Returns a Buffer in node and an Uint8Array in browsers
			*
			* To use the resulting buffer as an image, you'll want to do something like:
			*
			*   const blob = new Blob([buffer], { type: 'image/jpeg' })
			*   document.querySelector('#photo').src = URL.createObjectURL(blob)
			*/
			resolve(src, onError) {
				if (typeof atob === "function") {
					const str = atob(src.replace(/[\n\r]/g, ""));
					const buffer = new Uint8Array(str.length);
					for (let i = 0; i < str.length; ++i) buffer[i] = str.charCodeAt(i);
					return buffer;
				} else {
					onError("This environment does not support reading binary tags; either Buffer or atob is required");
					return src;
				}
			},
			stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
				if (!value) return "";
				const buf = value;
				let str;
				if (typeof btoa === "function") {
					let s = "";
					for (let i = 0; i < buf.length; ++i) s += String.fromCharCode(buf[i]);
					str = btoa(s);
				} else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
				type ?? (type = Scalar.BLOCK_LITERAL);
				if (type !== Scalar.QUOTE_DOUBLE) {
					const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
					const n = Math.ceil(str.length / lineWidth);
					const lines = new Array(n);
					for (let i = 0, o = 0; i < n; ++i, o += lineWidth) lines[i] = str.substr(o, lineWidth);
					str = lines.join(type === Scalar.BLOCK_LITERAL ? "\n" : " ");
				}
				return stringifyString({
					comment,
					type,
					value: str
				}, ctx, onComment, onChompKeep);
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/pairs.js
		function resolvePairs(seq, onError) {
			if (isSeq(seq)) for (let i = 0; i < seq.items.length; ++i) {
				let item = seq.items[i];
				if (isPair(item)) continue;
				else if (isMap(item)) {
					if (item.items.length > 1) onError("Each pair must have its own sequence indicator");
					const pair = item.items[0] || new Pair(new Scalar(null));
					if (item.commentBefore) pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}\n${pair.key.commentBefore}` : item.commentBefore;
					if (item.comment) {
						const cn = pair.value ?? pair.key;
						cn.comment = cn.comment ? `${item.comment}\n${cn.comment}` : item.comment;
					}
					item = pair;
				}
				seq.items[i] = isPair(item) ? item : new Pair(item);
			}
			else onError("Expected a sequence for this tag");
			return seq;
		}
		function createPairs(schema, iterable, ctx) {
			const { replacer } = ctx;
			const pairs = new YAMLSeq(schema);
			pairs.tag = "tag:yaml.org,2002:pairs";
			let i = 0;
			if (iterable && Symbol.iterator in Object(iterable)) for (let it of iterable) {
				if (typeof replacer === "function") it = replacer.call(iterable, String(i++), it);
				let key, value;
				if (Array.isArray(it)) {
					if (it.length === 2) {
						key = it[0];
						value = it[1];
					} else throw new TypeError(`Expected [key, value] tuple: ${it}`);
				} else if (it && it instanceof Object) {
					const keys = Object.keys(it);
					if (keys.length === 1) {
						key = keys[0];
						value = it[key];
					} else throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
				} else key = it;
				pairs.items.push(createPair(key, value, ctx));
			}
			return pairs;
		}
		const pairs = {
			collection: "seq",
			default: false,
			tag: "tag:yaml.org,2002:pairs",
			resolve: resolvePairs,
			createNode: createPairs
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/omap.js
		var YAMLOMap = class YAMLOMap extends YAMLSeq {
			constructor() {
				super();
				this.add = YAMLMap.prototype.add.bind(this);
				this.delete = YAMLMap.prototype.delete.bind(this);
				this.get = YAMLMap.prototype.get.bind(this);
				this.has = YAMLMap.prototype.has.bind(this);
				this.set = YAMLMap.prototype.set.bind(this);
				this.tag = YAMLOMap.tag;
			}
			/**
			* If `ctx` is given, the return type is actually `Map<unknown, unknown>`,
			* but TypeScript won't allow widening the signature of a child method.
			*/
			toJSON(_, ctx) {
				if (!ctx) return super.toJSON(_);
				const map = /* @__PURE__ */ new Map();
				if (ctx?.onCreate) ctx.onCreate(map);
				for (const pair of this.items) {
					let key, value;
					if (isPair(pair)) {
						key = toJS(pair.key, "", ctx);
						value = toJS(pair.value, key, ctx);
					} else key = toJS(pair, "", ctx);
					if (map.has(key)) throw new Error("Ordered maps must not include duplicate keys");
					map.set(key, value);
				}
				return map;
			}
			static from(schema, iterable, ctx) {
				const pairs = createPairs(schema, iterable, ctx);
				const omap = new this();
				omap.items = pairs.items;
				return omap;
			}
		};
		YAMLOMap.tag = "tag:yaml.org,2002:omap";
		const omap = {
			collection: "seq",
			identify: (value) => value instanceof Map,
			nodeClass: YAMLOMap,
			default: false,
			tag: "tag:yaml.org,2002:omap",
			resolve(seq, onError) {
				const pairs = resolvePairs(seq, onError);
				const seenKeys = [];
				for (const { key } of pairs.items) if (isScalar(key)) {
					if (seenKeys.includes(key.value)) onError(`Ordered maps must not include duplicate keys: ${key.value}`);
					else seenKeys.push(key.value);
				}
				return Object.assign(new YAMLOMap(), pairs);
			},
			createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/bool.js
		function boolStringify({ value, source }, ctx) {
			if (source && (value ? trueTag : falseTag).test.test(source)) return source;
			return value ? ctx.options.trueStr : ctx.options.falseStr;
		}
		const trueTag = {
			identify: (value) => value === true,
			default: true,
			tag: "tag:yaml.org,2002:bool",
			test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
			resolve: () => new Scalar(true),
			stringify: boolStringify
		};
		const falseTag = {
			identify: (value) => value === false,
			default: true,
			tag: "tag:yaml.org,2002:bool",
			test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
			resolve: () => new Scalar(false),
			stringify: boolStringify
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/float.js
		const floatNaN = {
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
			resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
			stringify: stringifyNumber
		};
		const floatExp = {
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			format: "EXP",
			test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
			resolve: (str) => parseFloat(str.replace(/_/g, "")),
			stringify(node) {
				const num = Number(node.value);
				return isFinite(num) ? num.toExponential() : stringifyNumber(node);
			}
		};
		const float = {
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
			resolve(str) {
				const node = new Scalar(parseFloat(str.replace(/_/g, "")));
				const dot = str.indexOf(".");
				if (dot !== -1) {
					const f = str.substring(dot + 1).replace(/_/g, "");
					if (f[f.length - 1] === "0") node.minFractionDigits = f.length;
				}
				return node;
			},
			stringify: stringifyNumber
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/int.js
		const intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
		function intResolve(str, offset, radix, { intAsBigInt }) {
			const sign = str[0];
			if (sign === "-" || sign === "+") offset += 1;
			str = str.substring(offset).replace(/_/g, "");
			if (intAsBigInt) {
				switch (radix) {
					case 2:
						str = `0b${str}`;
						break;
					case 8:
						str = `0o${str}`;
						break;
					case 16: str = `0x${str}`;
				}
				const n = BigInt(str);
				return sign === "-" ? BigInt(-1) * n : n;
			}
			const n = parseInt(str, radix);
			return sign === "-" ? -1 * n : n;
		}
		function intStringify(node, radix, prefix) {
			const { value } = node;
			if (intIdentify(value)) {
				const str = value.toString(radix);
				return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
			}
			return stringifyNumber(node);
		}
		const intBin = {
			identify: intIdentify,
			default: true,
			tag: "tag:yaml.org,2002:int",
			format: "BIN",
			test: /^[-+]?0b[0-1_]+$/,
			resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
			stringify: (node) => intStringify(node, 2, "0b")
		};
		const intOct = {
			identify: intIdentify,
			default: true,
			tag: "tag:yaml.org,2002:int",
			format: "OCT",
			test: /^[-+]?0[0-7_]+$/,
			resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
			stringify: (node) => intStringify(node, 8, "0")
		};
		const int = {
			identify: intIdentify,
			default: true,
			tag: "tag:yaml.org,2002:int",
			test: /^[-+]?[0-9][0-9_]*$/,
			resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
			stringify: stringifyNumber
		};
		const intHex = {
			identify: intIdentify,
			default: true,
			tag: "tag:yaml.org,2002:int",
			format: "HEX",
			test: /^[-+]?0x[0-9a-fA-F_]+$/,
			resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
			stringify: (node) => intStringify(node, 16, "0x")
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/set.js
		var YAMLSet = class YAMLSet extends YAMLMap {
			constructor(schema) {
				super(schema);
				this.tag = YAMLSet.tag;
			}
			add(key) {
				let pair;
				if (isPair(key)) pair = key;
				else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null) pair = new Pair(key.key, null);
				else pair = new Pair(key, null);
				if (!findPair(this.items, pair.key)) this.items.push(pair);
			}
			/**
			* If `keepPair` is `true`, returns the Pair matching `key`.
			* Otherwise, returns the value of that Pair's key.
			*/
			get(key, keepPair) {
				const pair = findPair(this.items, key);
				return !keepPair && isPair(pair) ? isScalar(pair.key) ? pair.key.value : pair.key : pair;
			}
			set(key, value) {
				if (typeof value !== "boolean") throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
				const prev = findPair(this.items, key);
				if (prev && !value) this.items.splice(this.items.indexOf(prev), 1);
				else if (!prev && value) this.items.push(new Pair(key));
			}
			toJSON(_, ctx) {
				return super.toJSON(_, ctx, Set);
			}
			toString(ctx, onComment, onChompKeep) {
				if (!ctx) return JSON.stringify(this);
				if (this.hasAllNullValues(true)) return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
				else throw new Error("Set items must all have null values");
			}
			static from(schema, iterable, ctx) {
				const { replacer } = ctx;
				const set = new this(schema);
				if (iterable && Symbol.iterator in Object(iterable)) for (let value of iterable) {
					if (typeof replacer === "function") value = replacer.call(iterable, value, value);
					set.items.push(createPair(value, null, ctx));
				}
				return set;
			}
		};
		YAMLSet.tag = "tag:yaml.org,2002:set";
		const set = {
			collection: "map",
			identify: (value) => value instanceof Set,
			nodeClass: YAMLSet,
			default: false,
			tag: "tag:yaml.org,2002:set",
			createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
			resolve(map, onError) {
				if (isMap(map)) {
					if (map.hasAllNullValues(true)) return Object.assign(new YAMLSet(), map);
					else onError("Set items must all have null values");
				} else onError("Expected a mapping for this tag");
				return map;
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/timestamp.js
		/** Internal types handle bigint as number, because TS can't figure it out. */
		function parseSexagesimal(str, asBigInt) {
			const sign = str[0];
			const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
			const num = (n) => asBigInt ? BigInt(n) : Number(n);
			const res = parts.replace(/_/g, "").split(":").reduce((res, p) => res * num(60) + num(p), num(0));
			return sign === "-" ? num(-1) * res : res;
		}
		/**
		* hhhh:mm:ss.sss
		*
		* Internal types handle bigint as number, because TS can't figure it out.
		*/
		function stringifySexagesimal(node) {
			let { value } = node;
			let num = (n) => n;
			if (typeof value === "bigint") num = (n) => BigInt(n);
			else if (isNaN(value) || !isFinite(value)) return stringifyNumber(node);
			let sign = "";
			if (value < 0) {
				sign = "-";
				value *= num(-1);
			}
			const _60 = num(60);
			const parts = [value % _60];
			if (value < 60) parts.unshift(0);
			else {
				value = (value - parts[0]) / _60;
				parts.unshift(value % _60);
				if (value >= 60) {
					value = (value - parts[0]) / _60;
					parts.unshift(value);
				}
			}
			return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
		}
		const intTime = {
			identify: (value) => typeof value === "bigint" || Number.isInteger(value),
			default: true,
			tag: "tag:yaml.org,2002:int",
			format: "TIME",
			test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
			resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
			stringify: stringifySexagesimal
		};
		const floatTime = {
			identify: (value) => typeof value === "number",
			default: true,
			tag: "tag:yaml.org,2002:float",
			format: "TIME",
			test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
			resolve: (str) => parseSexagesimal(str, false),
			stringify: stringifySexagesimal
		};
		const timestamp = {
			identify: (value) => value instanceof Date,
			default: true,
			tag: "tag:yaml.org,2002:timestamp",
			test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),
			resolve(str) {
				const match = str.match(timestamp.test);
				if (!match) throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
				const [, year, month, day, hour, minute, second] = match.map(Number);
				const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
				let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
				const tz = match[8];
				if (tz && tz !== "Z") {
					let d = parseSexagesimal(tz, false);
					if (Math.abs(d) < 30) d *= 60;
					date -= 6e4 * d;
				}
				return new Date(date);
			},
			stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/yaml-1.1/schema.js
		const schema = [
			map,
			seq,
			string,
			nullTag,
			trueTag,
			falseTag,
			intBin,
			intOct,
			int,
			intHex,
			floatNaN,
			floatExp,
			float,
			binary,
			merge$1,
			omap,
			pairs,
			set,
			intTime,
			floatTime,
			timestamp
		];
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/tags.js
		const schemas = /* @__PURE__ */ new Map([
			["core", schema$2],
			["failsafe", [
				map,
				seq,
				string
			]],
			["json", schema$1],
			["yaml11", schema],
			["yaml-1.1", schema]
		]);
		const tagsByName = {
			binary,
			bool: boolTag,
			float: float$1,
			floatExp: floatExp$1,
			floatNaN: floatNaN$1,
			floatTime,
			int: int$1,
			intHex: intHex$1,
			intOct: intOct$1,
			intTime,
			map,
			merge: merge$1,
			null: nullTag,
			omap,
			pairs,
			seq,
			set,
			timestamp
		};
		const coreKnownTags = {
			"tag:yaml.org,2002:binary": binary,
			"tag:yaml.org,2002:merge": merge$1,
			"tag:yaml.org,2002:omap": omap,
			"tag:yaml.org,2002:pairs": pairs,
			"tag:yaml.org,2002:set": set,
			"tag:yaml.org,2002:timestamp": timestamp
		};
		function getTags(customTags, schemaName, addMergeTag) {
			const schemaTags = schemas.get(schemaName);
			if (schemaTags && !customTags) return addMergeTag && !schemaTags.includes(merge$1) ? schemaTags.concat(merge$1) : schemaTags.slice();
			let tags = schemaTags;
			if (!tags) {
				if (Array.isArray(customTags)) tags = [];
				else {
					const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
					throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
				}
			}
			if (Array.isArray(customTags)) for (const tag of customTags) tags = tags.concat(tag);
			else if (typeof customTags === "function") tags = customTags(tags.slice());
			if (addMergeTag) tags = tags.concat(merge$1);
			return tags.reduce((tags, tag) => {
				const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
				if (!tagObj) {
					const tagName = JSON.stringify(tag);
					const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
					throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
				}
				if (!tags.includes(tagObj)) tags.push(tagObj);
				return tags;
			}, []);
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/schema/Schema.js
		const sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
		var Schema$1 = class Schema$1 {
			constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
				this.compat = Array.isArray(compat) ? getTags(compat, "compat") : compat ? getTags(null, compat) : null;
				this.name = typeof schema === "string" && schema || "core";
				this.knownTags = resolveKnownTags ? coreKnownTags : {};
				this.tags = getTags(customTags, this.name, merge);
				this.toStringOptions = toStringDefaults ?? null;
				Object.defineProperty(this, MAP, { value: map });
				Object.defineProperty(this, SCALAR$1, { value: string });
				Object.defineProperty(this, SEQ, { value: seq });
				this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
			}
			clone() {
				const copy = Object.create(Schema$1.prototype, Object.getOwnPropertyDescriptors(this));
				copy.tags = this.tags.slice();
				return copy;
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/stringify/stringifyDocument.js
		function stringifyDocument(doc, options) {
			const lines = [];
			let hasDirectives = options.directives === true;
			if (options.directives !== false && doc.directives) {
				const dir = doc.directives.toString(doc);
				if (dir) {
					lines.push(dir);
					hasDirectives = true;
				} else if (doc.directives.docStart) hasDirectives = true;
			}
			if (hasDirectives) lines.push("---");
			const ctx = createStringifyContext(doc, options);
			const { commentString } = ctx.options;
			if (doc.commentBefore) {
				if (lines.length !== 1) lines.unshift("");
				const cs = commentString(doc.commentBefore);
				lines.unshift(indentComment(cs, ""));
			}
			let chompKeep = false;
			let contentComment = null;
			if (doc.contents) {
				if (isNode(doc.contents)) {
					if (doc.contents.spaceBefore && hasDirectives) lines.push("");
					if (doc.contents.commentBefore) {
						const cs = commentString(doc.contents.commentBefore);
						lines.push(indentComment(cs, ""));
					}
					ctx.forceBlockIndent = !!doc.comment;
					contentComment = doc.contents.comment;
				}
				const onChompKeep = contentComment ? void 0 : () => chompKeep = true;
				let body = stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
				if (contentComment) body += lineComment(body, "", commentString(contentComment));
				if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") lines[lines.length - 1] = `--- ${body}`;
				else lines.push(body);
			} else lines.push(stringify(doc.contents, ctx));
			if (doc.directives?.docEnd) {
				if (doc.comment) {
					const cs = commentString(doc.comment);
					if (cs.includes("\n")) {
						lines.push("...");
						lines.push(indentComment(cs, ""));
					} else lines.push(`... ${cs}`);
				} else lines.push("...");
			} else {
				let dc = doc.comment;
				if (dc && chompKeep) dc = dc.replace(/^\n+/, "");
				if (dc) {
					if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "") lines.push("");
					lines.push(indentComment(commentString(dc), ""));
				}
			}
			return lines.join("\n") + "\n";
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/doc/Document.js
		var Document = class Document {
			constructor(value, replacer, options) {
				/** A comment before this Document */
				this.commentBefore = null;
				/** A comment immediately after this Document */
				this.comment = null;
				/** Errors encountered during parsing. */
				this.errors = [];
				/** Warnings encountered during parsing. */
				this.warnings = [];
				Object.defineProperty(this, NODE_TYPE, { value: DOC });
				let _replacer = null;
				if (typeof replacer === "function" || Array.isArray(replacer)) _replacer = replacer;
				else if (options === void 0 && replacer) {
					options = replacer;
					replacer = void 0;
				}
				const opt = Object.assign({
					intAsBigInt: false,
					keepSourceTokens: false,
					logLevel: "warn",
					prettyErrors: true,
					strict: true,
					stringKeys: false,
					uniqueKeys: true,
					version: "1.2"
				}, options);
				this.options = opt;
				let { version } = opt;
				if (options?._directives) {
					this.directives = options._directives.atDocument();
					if (this.directives.yaml.explicit) version = this.directives.yaml.version;
				} else this.directives = new Directives({ version });
				this.setSchema(version, options);
				this.contents = value === void 0 ? null : this.createNode(value, _replacer, options);
			}
			/**
			* Create a deep copy of this Document and its contents.
			*
			* Custom Node values that inherit from `Object` still refer to their original instances.
			*/
			clone() {
				const copy = Object.create(Document.prototype, { [NODE_TYPE]: { value: DOC } });
				copy.commentBefore = this.commentBefore;
				copy.comment = this.comment;
				copy.errors = this.errors.slice();
				copy.warnings = this.warnings.slice();
				copy.options = Object.assign({}, this.options);
				if (this.directives) copy.directives = this.directives.clone();
				copy.schema = this.schema.clone();
				copy.contents = isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
				if (this.range) copy.range = this.range.slice();
				return copy;
			}
			/** Adds a value to the document. */
			add(value) {
				if (assertCollection(this.contents)) this.contents.add(value);
			}
			/** Adds a value to the document. */
			addIn(path, value) {
				if (assertCollection(this.contents)) this.contents.addIn(path, value);
			}
			/**
			* Create a new `Alias` node, ensuring that the target `node` has the required anchor.
			*
			* If `node` already has an anchor, `name` is ignored.
			* Otherwise, the `node.anchor` value will be set to `name`,
			* or if an anchor with that name is already present in the document,
			* `name` will be used as a prefix for a new unique anchor.
			* If `name` is undefined, the generated anchor will use 'a' as a prefix.
			*/
			createAlias(node, name) {
				if (!node.anchor) {
					const prev = anchorNames(this);
					node.anchor = !name || prev.has(name) ? findNewAnchor(name || "a", prev) : name;
				}
				return new Alias(node.anchor);
			}
			createNode(value, replacer, options) {
				let _replacer = void 0;
				if (typeof replacer === "function") {
					value = replacer.call({ "": value }, "", value);
					_replacer = replacer;
				} else if (Array.isArray(replacer)) {
					const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
					const asStr = replacer.filter(keyToStr).map(String);
					if (asStr.length > 0) replacer = replacer.concat(asStr);
					_replacer = replacer;
				} else if (options === void 0 && replacer) {
					options = replacer;
					replacer = void 0;
				}
				const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
				const { onAnchor, setAnchors, sourceObjects } = createNodeAnchors(this, anchorPrefix || "a");
				const ctx = {
					aliasDuplicateObjects: aliasDuplicateObjects ?? true,
					keepUndefined: keepUndefined ?? false,
					onAnchor,
					onTagObj,
					replacer: _replacer,
					schema: this.schema,
					sourceObjects
				};
				const node = createNode(value, tag, ctx);
				if (flow && isCollection(node)) node.flow = true;
				setAnchors();
				return node;
			}
			/**
			* Convert a key and a value into a `Pair` using the current schema,
			* recursively wrapping all values as `Scalar` or `Collection` nodes.
			*/
			createPair(key, value, options = {}) {
				return new Pair(this.createNode(key, null, options), this.createNode(value, null, options));
			}
			/**
			* Removes a value from the document.
			* @returns `true` if the item was found and removed.
			*/
			delete(key) {
				return assertCollection(this.contents) ? this.contents.delete(key) : false;
			}
			/**
			* Removes a value from the document.
			* @returns `true` if the item was found and removed.
			*/
			deleteIn(path) {
				if (isEmptyPath(path)) {
					if (this.contents == null) return false;
					this.contents = null;
					return true;
				}
				return assertCollection(this.contents) ? this.contents.deleteIn(path) : false;
			}
			/**
			* Returns item at `key`, or `undefined` if not found. By default unwraps
			* scalar values from their surrounding node; to disable set `keepScalar` to
			* `true` (collections are always returned intact).
			*/
			get(key, keepScalar) {
				return isCollection(this.contents) ? this.contents.get(key, keepScalar) : void 0;
			}
			/**
			* Returns item at `path`, or `undefined` if not found. By default unwraps
			* scalar values from their surrounding node; to disable set `keepScalar` to
			* `true` (collections are always returned intact).
			*/
			getIn(path, keepScalar) {
				if (isEmptyPath(path)) return !keepScalar && isScalar(this.contents) ? this.contents.value : this.contents;
				return isCollection(this.contents) ? this.contents.getIn(path, keepScalar) : void 0;
			}
			/**
			* Checks if the document includes a value with the key `key`.
			*/
			has(key) {
				return isCollection(this.contents) ? this.contents.has(key) : false;
			}
			/**
			* Checks if the document includes a value at `path`.
			*/
			hasIn(path) {
				if (isEmptyPath(path)) return this.contents !== void 0;
				return isCollection(this.contents) ? this.contents.hasIn(path) : false;
			}
			/**
			* Sets a value in this document. For `!!set`, `value` needs to be a
			* boolean to add/remove the item from the set.
			*/
			set(key, value) {
				if (this.contents == null) this.contents = collectionFromPath(this.schema, [key], value);
				else if (assertCollection(this.contents)) this.contents.set(key, value);
			}
			/**
			* Sets a value in this document. For `!!set`, `value` needs to be a
			* boolean to add/remove the item from the set.
			*/
			setIn(path, value) {
				if (isEmptyPath(path)) this.contents = value;
				else if (this.contents == null) this.contents = collectionFromPath(this.schema, Array.from(path), value);
				else if (assertCollection(this.contents)) this.contents.setIn(path, value);
			}
			/**
			* Change the YAML version and schema used by the document.
			* A `null` version disables support for directives, explicit tags, anchors, and aliases.
			* It also requires the `schema` option to be given as a `Schema` instance value.
			*
			* Overrides all previously set schema options.
			*/
			setSchema(version, options = {}) {
				if (typeof version === "number") version = String(version);
				let opt;
				switch (version) {
					case "1.1":
						if (this.directives) this.directives.yaml.version = "1.1";
						else this.directives = new Directives({ version: "1.1" });
						opt = {
							resolveKnownTags: false,
							schema: "yaml-1.1"
						};
						break;
					case "1.2":
					case "next":
						if (this.directives) this.directives.yaml.version = version;
						else this.directives = new Directives({ version });
						opt = {
							resolveKnownTags: true,
							schema: "core"
						};
						break;
					case null:
						if (this.directives) delete this.directives;
						opt = null;
						break;
					default: {
						const sv = JSON.stringify(version);
						throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
					}
				}
				if (options.schema instanceof Object) this.schema = options.schema;
				else if (opt) this.schema = new Schema$1(Object.assign(opt, options));
				else throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
			}
			toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
				const ctx = {
					anchors: /* @__PURE__ */ new Map(),
					doc: this,
					keep: !json,
					mapAsMap: mapAsMap === true,
					mapKeyWarned: false,
					maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
				};
				const res = toJS(this.contents, jsonArg ?? "", ctx);
				if (typeof onAnchor === "function") for (const { count, res } of ctx.anchors.values()) onAnchor(res, count);
				return typeof reviver === "function" ? applyReviver(reviver, { "": res }, "", res) : res;
			}
			/**
			* A JSON representation of the document `contents`.
			*
			* @param jsonArg Used by `JSON.stringify` to indicate the array index or
			*   property name.
			*/
			toJSON(jsonArg, onAnchor) {
				return this.toJS({
					json: true,
					jsonArg,
					mapAsMap: false,
					onAnchor
				});
			}
			/** A YAML representation of the document. */
			toString(options = {}) {
				if (this.errors.length > 0) throw new Error("Document with errors cannot be stringified");
				if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
					const s = JSON.stringify(options.indent);
					throw new Error(`"indent" option must be a positive integer, not ${s}`);
				}
				return stringifyDocument(this, options);
			}
		};
		function assertCollection(contents) {
			if (isCollection(contents)) return true;
			throw new Error("Expected a YAML collection as document contents");
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/errors.js
		var YAMLError = class extends Error {
			constructor(name, pos, code, message) {
				super();
				this.name = name;
				this.code = code;
				this.message = message;
				this.pos = pos;
			}
		};
		var YAMLParseError = class extends YAMLError {
			constructor(pos, code, message) {
				super("YAMLParseError", pos, code, message);
			}
		};
		var YAMLWarning = class extends YAMLError {
			constructor(pos, code, message) {
				super("YAMLWarning", pos, code, message);
			}
		};
		const prettifyError = (src, lc) => (error) => {
			if (error.pos[0] === -1) return;
			error.linePos = error.pos.map((pos) => lc.linePos(pos));
			const { line, col } = error.linePos[0];
			error.message += ` at line ${line}, column ${col}`;
			let ci = col - 1;
			let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
			if (ci >= 60 && lineStr.length > 80) {
				const trimStart = Math.min(ci - 39, lineStr.length - 79);
				lineStr = "…" + lineStr.substring(trimStart);
				ci -= trimStart - 1;
			}
			if (lineStr.length > 80) lineStr = lineStr.substring(0, 79) + "…";
			if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
				let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
				if (prev.length > 80) prev = prev.substring(0, 79) + "…\n";
				lineStr = prev + lineStr;
			}
			if (/[^ ]/.test(lineStr)) {
				let count = 1;
				const end = error.linePos[1];
				if (end?.line === line && end.col > col) count = Math.max(1, Math.min(end.col - col, 80 - ci));
				const pointer = " ".repeat(ci) + "^".repeat(count);
				error.message += `:\n\n${lineStr}\n${pointer}\n`;
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/resolve-props.js
		function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
			let spaceBefore = false;
			let atNewline = startOnNewline;
			let hasSpace = startOnNewline;
			let comment = "";
			let commentSep = "";
			let hasNewline = false;
			let reqSpace = false;
			let tab = null;
			let anchor = null;
			let tag = null;
			let newlineAfterProp = null;
			let comma = null;
			let found = null;
			let start = null;
			for (const token of tokens) {
				if (reqSpace) {
					if (token.type !== "space" && token.type !== "newline" && token.type !== "comma") onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
					reqSpace = false;
				}
				if (tab) {
					if (atNewline && token.type !== "comment" && token.type !== "newline") onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
					tab = null;
				}
				switch (token.type) {
					case "space":
						if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("	")) tab = token;
						hasSpace = true;
						break;
					case "comment": {
						if (!hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
						const cb = token.source.substring(1) || " ";
						if (!comment) comment = cb;
						else comment += commentSep + cb;
						commentSep = "";
						atNewline = false;
						break;
					}
					case "newline":
						if (atNewline) {
							if (comment) comment += token.source;
							else if (!found || indicator !== "seq-item-ind") spaceBefore = true;
						} else commentSep += token.source;
						atNewline = true;
						hasNewline = true;
						if (anchor || tag) newlineAfterProp = token;
						hasSpace = true;
						break;
					case "anchor":
						if (anchor) onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
						if (token.source.endsWith(":")) onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
						anchor = token;
						start ?? (start = token.offset);
						atNewline = false;
						hasSpace = false;
						reqSpace = true;
						break;
					case "tag":
						if (tag) onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
						tag = token;
						start ?? (start = token.offset);
						atNewline = false;
						hasSpace = false;
						reqSpace = true;
						break;
					case indicator:
						if (anchor || tag) onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
						if (found) onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
						found = token;
						atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
						hasSpace = false;
						break;
					case "comma": if (flow) {
						if (comma) onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
						comma = token;
						atNewline = false;
						hasSpace = false;
						break;
					}
					default:
						onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
						atNewline = false;
						hasSpace = false;
				}
			}
			const last = tokens[tokens.length - 1];
			const end = last ? last.offset + last.source.length : offset;
			if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
			if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq")) onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
			return {
				comma,
				found,
				spaceBefore,
				comment,
				hasNewline,
				anchor,
				tag,
				newlineAfterProp,
				end,
				start: start ?? end
			};
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/util-contains-newline.js
		function containsNewline(key) {
			if (!key) return null;
			switch (key.type) {
				case "alias":
				case "scalar":
				case "double-quoted-scalar":
				case "single-quoted-scalar":
					if (key.source.includes("\n")) return true;
					if (key.end) {
						for (const st of key.end) if (st.type === "newline") return true;
					}
					return false;
				case "flow-collection":
					for (const it of key.items) {
						for (const st of it.start) if (st.type === "newline") return true;
						if (it.sep) {
							for (const st of it.sep) if (st.type === "newline") return true;
						}
						if (containsNewline(it.key) || containsNewline(it.value)) return true;
					}
					return false;
				default: return true;
			}
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/util-flow-indent-check.js
		function flowIndentCheck(indent, fc, onError) {
			if (fc?.type === "flow-collection") {
				const end = fc.end[0];
				if (end.indent === indent && (end.source === "]" || end.source === "}") && containsNewline(fc)) onError(end, "BAD_INDENT", "Flow end indicator should be more indented than parent", true);
			}
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/util-map-includes.js
		function mapIncludes(ctx, items, search) {
			const { uniqueKeys } = ctx.options;
			if (uniqueKeys === false) return false;
			const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || isScalar(a) && isScalar(b) && a.value === b.value;
			return items.some((pair) => isEqual(pair.key, search));
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/resolve-block-map.js
		const startColMsg = "All mapping items must start at the same column";
		function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
			const map = new ((tag?.nodeClass) ?? YAMLMap)(ctx.schema);
			if (ctx.atRoot) ctx.atRoot = false;
			let offset = bm.offset;
			let commentEnd = null;
			for (const collItem of bm.items) {
				const { start, key, sep, value } = collItem;
				const keyProps = resolveProps(start, {
					indicator: "explicit-key-ind",
					next: key ?? sep?.[0],
					offset,
					onError,
					parentIndent: bm.indent,
					startOnNewline: true
				});
				const implicitKey = !keyProps.found;
				if (implicitKey) {
					if (key) {
						if (key.type === "block-seq") onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
						else if ("indent" in key && key.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
					}
					if (!keyProps.anchor && !keyProps.tag && !sep) {
						commentEnd = keyProps.end;
						if (keyProps.comment) {
							if (map.comment) map.comment += "\n" + keyProps.comment;
							else map.comment = keyProps.comment;
						}
						continue;
					}
					if (keyProps.newlineAfterProp || containsNewline(key)) onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
				} else if (keyProps.found?.indent !== bm.indent) onError(offset, "BAD_INDENT", startColMsg);
				ctx.atKey = true;
				const keyStart = keyProps.end;
				const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
				if (ctx.schema.compat) flowIndentCheck(bm.indent, key, onError);
				ctx.atKey = false;
				if (mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
				const valueProps = resolveProps(sep ?? [], {
					indicator: "map-value-ind",
					next: value,
					offset: keyNode.range[2],
					onError,
					parentIndent: bm.indent,
					startOnNewline: !key || key.type === "block-scalar"
				});
				offset = valueProps.end;
				if (valueProps.found) {
					if (implicitKey) {
						if (value?.type === "block-map" && !valueProps.hasNewline) onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
						if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024) onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
					}
					const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
					if (ctx.schema.compat) flowIndentCheck(bm.indent, value, onError);
					offset = valueNode.range[2];
					const pair = new Pair(keyNode, valueNode);
					if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
					map.items.push(pair);
				} else {
					if (implicitKey) onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
					if (valueProps.comment) {
						if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
						else keyNode.comment = valueProps.comment;
					}
					const pair = new Pair(keyNode);
					if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
					map.items.push(pair);
				}
			}
			if (commentEnd && commentEnd < offset) onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
			map.range = [
				bm.offset,
				offset,
				commentEnd ?? offset
			];
			return map;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/resolve-block-seq.js
		function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
			const seq = new ((tag?.nodeClass) ?? YAMLSeq)(ctx.schema);
			if (ctx.atRoot) ctx.atRoot = false;
			if (ctx.atKey) ctx.atKey = false;
			let offset = bs.offset;
			let commentEnd = null;
			for (const { start, value } of bs.items) {
				const props = resolveProps(start, {
					indicator: "seq-item-ind",
					next: value,
					offset,
					onError,
					parentIndent: bs.indent,
					startOnNewline: true
				});
				if (!props.found) {
					if (props.anchor || props.tag || value) {
						if (value?.type === "block-seq") onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
						else onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
					} else {
						commentEnd = props.end;
						if (props.comment) seq.comment = props.comment;
						continue;
					}
				}
				const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
				if (ctx.schema.compat) flowIndentCheck(bs.indent, value, onError);
				offset = node.range[2];
				seq.items.push(node);
			}
			seq.range = [
				bs.offset,
				offset,
				commentEnd ?? offset
			];
			return seq;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/resolve-end.js
		function resolveEnd(end, offset, reqSpace, onError) {
			let comment = "";
			if (end) {
				let hasSpace = false;
				let sep = "";
				for (const token of end) {
					const { source, type } = token;
					switch (type) {
						case "space":
							hasSpace = true;
							break;
						case "comment": {
							if (reqSpace && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
							const cb = source.substring(1) || " ";
							if (!comment) comment = cb;
							else comment += sep + cb;
							sep = "";
							break;
						}
						case "newline":
							if (comment) sep += source;
							hasSpace = true;
							break;
						default: onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
					}
					offset += source.length;
				}
			}
			return {
				comment,
				offset
			};
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/resolve-flow-collection.js
		const blockMsg = "Block collections are not allowed within flow collections";
		const isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
		function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
			const isMap = fc.start.source === "{";
			const fcName = isMap ? "flow map" : "flow sequence";
			const coll = new ((tag?.nodeClass) ?? (isMap ? YAMLMap : YAMLSeq))(ctx.schema);
			coll.flow = true;
			const atRoot = ctx.atRoot;
			if (atRoot) ctx.atRoot = false;
			if (ctx.atKey) ctx.atKey = false;
			let offset = fc.offset + fc.start.source.length;
			for (let i = 0; i < fc.items.length; ++i) {
				const collItem = fc.items[i];
				const { start, key, sep, value } = collItem;
				const props = resolveProps(start, {
					flow: fcName,
					indicator: "explicit-key-ind",
					next: key ?? sep?.[0],
					offset,
					onError,
					parentIndent: fc.indent,
					startOnNewline: false
				});
				if (!props.found) {
					if (!props.anchor && !props.tag && !sep && !value) {
						if (i === 0 && props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
						else if (i < fc.items.length - 1) onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
						if (props.comment) {
							if (coll.comment) coll.comment += "\n" + props.comment;
							else coll.comment = props.comment;
						}
						offset = props.end;
						continue;
					}
					if (!isMap && ctx.options.strict && containsNewline(key)) onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
				}
				if (i === 0) {
					if (props.comma) onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
				} else {
					if (!props.comma) onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
					if (props.comment) {
						let prevItemComment = "";
						loop: for (const st of start) switch (st.type) {
							case "comma":
							case "space": break;
							case "comment":
								prevItemComment = st.source.substring(1);
								break loop;
							default: break loop;
						}
						if (prevItemComment) {
							let prev = coll.items[coll.items.length - 1];
							if (isPair(prev)) prev = prev.value ?? prev.key;
							if (prev.comment) prev.comment += "\n" + prevItemComment;
							else prev.comment = prevItemComment;
							props.comment = props.comment.substring(prevItemComment.length + 1);
						}
					}
				}
				if (!isMap && !sep && !props.found) {
					const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
					coll.items.push(valueNode);
					offset = valueNode.range[2];
					if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
				} else {
					ctx.atKey = true;
					const keyStart = props.end;
					const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
					if (isBlock(key)) onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
					ctx.atKey = false;
					const valueProps = resolveProps(sep ?? [], {
						flow: fcName,
						indicator: "map-value-ind",
						next: value,
						offset: keyNode.range[2],
						onError,
						parentIndent: fc.indent,
						startOnNewline: false
					});
					if (valueProps.found) {
						if (!isMap && !props.found && ctx.options.strict) {
							if (sep) for (const st of sep) {
								if (st === valueProps.found) break;
								if (st.type === "newline") {
									onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
									break;
								}
							}
							if (props.start < valueProps.found.offset - 1024) onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
						}
					} else if (value) {
						if ("source" in value && value.source?.[0] === ":") onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
						else onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
					}
					const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
					if (valueNode) {
						if (isBlock(value)) onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
					} else if (valueProps.comment) {
						if (keyNode.comment) keyNode.comment += "\n" + valueProps.comment;
						else keyNode.comment = valueProps.comment;
					}
					const pair = new Pair(keyNode, valueNode);
					if (ctx.options.keepSourceTokens) pair.srcToken = collItem;
					if (isMap) {
						const map = coll;
						if (mapIncludes(ctx, map.items, keyNode)) onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
						map.items.push(pair);
					} else {
						const map = new YAMLMap(ctx.schema);
						map.flow = true;
						map.items.push(pair);
						const endRange = (valueNode ?? keyNode).range;
						map.range = [
							keyNode.range[0],
							endRange[1],
							endRange[2]
						];
						coll.items.push(map);
					}
					offset = valueNode ? valueNode.range[2] : valueProps.end;
				}
			}
			const expectedEnd = isMap ? "}" : "]";
			const [ce, ...ee] = fc.end;
			let cePos = offset;
			if (ce?.source === expectedEnd) cePos = ce.offset + ce.source.length;
			else {
				const name = fcName[0].toUpperCase() + fcName.substring(1);
				const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
				onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
				if (ce && ce.source.length !== 1) ee.unshift(ce);
			}
			if (ee.length > 0) {
				const end = resolveEnd(ee, cePos, ctx.options.strict, onError);
				if (end.comment) {
					if (coll.comment) coll.comment += "\n" + end.comment;
					else coll.comment = end.comment;
				}
				coll.range = [
					fc.offset,
					cePos,
					end.offset
				];
			} else coll.range = [
				fc.offset,
				cePos,
				cePos
			];
			return coll;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/compose-collection.js
		function resolveCollection(CN, ctx, token, onError, tagName, tag) {
			const coll = token.type === "block-map" ? resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection(CN, ctx, token, onError, tag);
			const Coll = coll.constructor;
			if (tagName === "!" || tagName === Coll.tagName) {
				coll.tag = Coll.tagName;
				return coll;
			}
			if (tagName) coll.tag = tagName;
			return coll;
		}
		function composeCollection(CN, ctx, token, props, onError) {
			const tagToken = props.tag;
			const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
			if (token.type === "block-seq") {
				const { anchor, newlineAfterProp: nl } = props;
				const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
				if (lastProp && (!nl || nl.offset < lastProp.offset)) onError(lastProp, "MISSING_CHAR", "Missing newline after block sequence props");
			}
			const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
			if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.tagName && expType === "seq") return resolveCollection(CN, ctx, token, onError, tagName);
			let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
			if (!tag) {
				const kt = ctx.schema.knownTags[tagName];
				if (kt?.collection === expType) {
					ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
					tag = kt;
				} else {
					if (kt) onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
					else onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
					return resolveCollection(CN, ctx, token, onError, tagName);
				}
			}
			const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
			const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
			const node = isNode(res) ? res : new Scalar(res);
			node.range = coll.range;
			node.tag = tagName;
			if (tag?.format) node.format = tag.format;
			return node;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/resolve-block-scalar.js
		function resolveBlockScalar(ctx, scalar, onError) {
			const start = scalar.offset;
			const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
			if (!header) return {
				value: "",
				type: null,
				comment: "",
				range: [
					start,
					start,
					start
				]
			};
			const type = header.mode === ">" ? Scalar.BLOCK_FOLDED : Scalar.BLOCK_LITERAL;
			const lines = scalar.source ? splitLines(scalar.source) : [];
			let chompStart = lines.length;
			for (let i = lines.length - 1; i >= 0; --i) {
				const content = lines[i][1];
				if (content === "" || content === "\r") chompStart = i;
				else break;
			}
			if (chompStart === 0) {
				const value = header.chomp === "+" && lines.length > 0 ? "\n".repeat(Math.max(1, lines.length - 1)) : "";
				let end = start + header.length;
				if (scalar.source) end += scalar.source.length;
				return {
					value,
					type,
					comment: header.comment,
					range: [
						start,
						end,
						end
					]
				};
			}
			let trimIndent = scalar.indent + header.indent;
			let offset = scalar.offset + header.length;
			let contentStart = 0;
			for (let i = 0; i < chompStart; ++i) {
				const [indent, content] = lines[i];
				if (content === "" || content === "\r") {
					if (header.indent === 0 && indent.length > trimIndent) trimIndent = indent.length;
				} else {
					if (indent.length < trimIndent) onError(offset + indent.length, "MISSING_CHAR", "Block scalars with more-indented leading empty lines must use an explicit indentation indicator");
					if (header.indent === 0) trimIndent = indent.length;
					contentStart = i;
					if (trimIndent === 0 && !ctx.atRoot) onError(offset, "BAD_INDENT", "Block scalar values in collections must be indented");
					break;
				}
				offset += indent.length + content.length + 1;
			}
			for (let i = lines.length - 1; i >= chompStart; --i) if (lines[i][0].length > trimIndent) chompStart = i + 1;
			let value = "";
			let sep = "";
			let prevMoreIndented = false;
			for (let i = 0; i < contentStart; ++i) value += lines[i][0].slice(trimIndent) + "\n";
			for (let i = contentStart; i < chompStart; ++i) {
				let [indent, content] = lines[i];
				offset += indent.length + content.length + 1;
				const crlf = content[content.length - 1] === "\r";
				if (crlf) content = content.slice(0, -1);
				/* istanbul ignore if already caught in lexer */
				if (content && indent.length < trimIndent) {
					const message = `Block scalar lines must not be less indented than their ${header.indent ? "explicit indentation indicator" : "first line"}`;
					onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
					indent = "";
				}
				if (type === Scalar.BLOCK_LITERAL) {
					value += sep + indent.slice(trimIndent) + content;
					sep = "\n";
				} else if (indent.length > trimIndent || content[0] === "	") {
					if (sep === " ") sep = "\n";
					else if (!prevMoreIndented && sep === "\n") sep = "\n\n";
					value += sep + indent.slice(trimIndent) + content;
					sep = "\n";
					prevMoreIndented = true;
				} else if (content === "") {
					if (sep === "\n") value += "\n";
					else sep = "\n";
				} else {
					value += sep + content;
					sep = " ";
					prevMoreIndented = false;
				}
			}
			switch (header.chomp) {
				case "-": break;
				case "+":
					for (let i = chompStart; i < lines.length; ++i) value += "\n" + lines[i][0].slice(trimIndent);
					if (value[value.length - 1] !== "\n") value += "\n";
					break;
				default: value += "\n";
			}
			const end = start + header.length + scalar.source.length;
			return {
				value,
				type,
				comment: header.comment,
				range: [
					start,
					end,
					end
				]
			};
		}
		function parseBlockScalarHeader({ offset, props }, strict, onError) {
			/* istanbul ignore if should not happen */
			if (props[0].type !== "block-scalar-header") {
				onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
				return null;
			}
			const { source } = props[0];
			const mode = source[0];
			let indent = 0;
			let chomp = "";
			let error = -1;
			for (let i = 1; i < source.length; ++i) {
				const ch = source[i];
				if (!chomp && (ch === "-" || ch === "+")) chomp = ch;
				else {
					const n = Number(ch);
					if (!indent && n) indent = n;
					else if (error === -1) error = offset + i;
				}
			}
			if (error !== -1) onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
			let hasSpace = false;
			let comment = "";
			let length = source.length;
			for (let i = 1; i < props.length; ++i) {
				const token = props[i];
				switch (token.type) {
					case "space": hasSpace = true;
					case "newline":
						length += token.source.length;
						break;
					case "comment":
						if (strict && !hasSpace) onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
						length += token.source.length;
						comment = token.source.substring(1);
						break;
					case "error":
						onError(token, "UNEXPECTED_TOKEN", token.message);
						length += token.source.length;
						break;
					/* istanbul ignore next should not happen */
					default: {
						onError(token, "UNEXPECTED_TOKEN", `Unexpected token in block scalar header: ${token.type}`);
						const ts = token.source;
						if (ts && typeof ts === "string") length += ts.length;
					}
				}
			}
			return {
				mode,
				indent,
				chomp,
				comment,
				length
			};
		}
		/** @returns Array of lines split up as `[indent, content]` */
		function splitLines(source) {
			const split = source.split(/\n( *)/);
			const first = split[0];
			const m = first.match(/^( *)/);
			const lines = [m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first]];
			for (let i = 1; i < split.length; i += 2) lines.push([split[i], split[i + 1]]);
			return lines;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/resolve-flow-scalar.js
		function resolveFlowScalar(scalar, strict, onError) {
			const { offset, type, source, end } = scalar;
			let _type;
			let value;
			const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
			switch (type) {
				case "scalar":
					_type = Scalar.PLAIN;
					value = plainValue(source, _onError);
					break;
				case "single-quoted-scalar":
					_type = Scalar.QUOTE_SINGLE;
					value = singleQuotedValue(source, _onError);
					break;
				case "double-quoted-scalar":
					_type = Scalar.QUOTE_DOUBLE;
					value = doubleQuotedValue(source, _onError);
					break;
				/* istanbul ignore next should not happen */
				default:
					onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
					return {
						value: "",
						type: null,
						comment: "",
						range: [
							offset,
							offset + source.length,
							offset + source.length
						]
					};
			}
			const valueEnd = offset + source.length;
			const re = resolveEnd(end, valueEnd, strict, onError);
			return {
				value,
				type: _type,
				comment: re.comment,
				range: [
					offset,
					valueEnd,
					re.offset
				]
			};
		}
		function plainValue(source, onError) {
			let badChar = "";
			switch (source[0]) {
				/* istanbul ignore next should not happen */
				case "	":
					badChar = "a tab character";
					break;
				case ",":
					badChar = "flow indicator character ,";
					break;
				case "%":
					badChar = "directive indicator character %";
					break;
				case "|":
				case ">":
					badChar = `block scalar indicator ${source[0]}`;
					break;
				case "@":
				case "`": badChar = `reserved character ${source[0]}`;
			}
			if (badChar) onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
			return foldLines(source);
		}
		function singleQuotedValue(source, onError) {
			if (source[source.length - 1] !== "'" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
			return foldLines(source.slice(1, -1)).replace(/''/g, "'");
		}
		function foldLines(source) {
			/**
			* The negative lookbehind here and in the `re` RegExp is to
			* prevent causing a polynomial search time in certain cases.
			*
			* The try-catch is for Safari, which doesn't support this yet:
			* https://caniuse.com/js-regexp-lookbehind
			*/
			let first, line;
			try {
				first = /* @__PURE__ */ new RegExp("(.*?)(?<![ 	])[ 	]*\r?\n", "sy");
				line = /* @__PURE__ */ new RegExp("[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?\n", "sy");
			} catch {
				first = /(.*?)[ \t]*\r?\n/sy;
				line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
			}
			let match = first.exec(source);
			if (!match) return source;
			let res = match[1];
			let sep = " ";
			let pos = first.lastIndex;
			line.lastIndex = pos;
			while (match = line.exec(source)) {
				if (match[1] === "") {
					if (sep === "\n") res += sep;
					else sep = "\n";
				} else {
					res += sep + match[1];
					sep = " ";
				}
				pos = line.lastIndex;
			}
			const last = /[ \t]*(.*)/sy;
			last.lastIndex = pos;
			match = last.exec(source);
			return res + sep + (match?.[1] ?? "");
		}
		function doubleQuotedValue(source, onError) {
			let res = "";
			for (let i = 1; i < source.length - 1; ++i) {
				const ch = source[i];
				if (ch === "\r" && source[i + 1] === "\n") continue;
				if (ch === "\n") {
					const { fold, offset } = foldNewline(source, i);
					res += fold;
					i = offset;
				} else if (ch === "\\") {
					let next = source[++i];
					const cc = escapeCodes[next];
					if (cc) res += cc;
					else if (next === "\n") {
						next = source[i + 1];
						while (next === " " || next === "	") next = source[++i + 1];
					} else if (next === "\r" && source[i + 1] === "\n") {
						next = source[++i + 1];
						while (next === " " || next === "	") next = source[++i + 1];
					} else if (next === "x" || next === "u" || next === "U") {
						const length = next === "x" ? 2 : next === "u" ? 4 : 8;
						res += parseCharCode(source, i + 1, length, onError);
						i += length;
					} else {
						const raw = source.substr(i - 1, 2);
						onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
						res += raw;
					}
				} else if (ch === " " || ch === "	") {
					const wsStart = i;
					let next = source[i + 1];
					while (next === " " || next === "	") next = source[++i + 1];
					if (next !== "\n" && !(next === "\r" && source[i + 2] === "\n")) res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
				} else res += ch;
			}
			if (source[source.length - 1] !== "\"" || source.length === 1) onError(source.length, "MISSING_CHAR", "Missing closing \"quote");
			return res;
		}
		/**
		* Fold a single newline into a space, multiple newlines to N - 1 newlines.
		* Presumes `source[offset] === '\n'`
		*/
		function foldNewline(source, offset) {
			let fold = "";
			let ch = source[offset + 1];
			while (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
				if (ch === "\r" && source[offset + 2] !== "\n") break;
				if (ch === "\n") fold += "\n";
				offset += 1;
				ch = source[offset + 1];
			}
			if (!fold) fold = " ";
			return {
				fold,
				offset
			};
		}
		const escapeCodes = {
			"0": "\0",
			a: "\x07",
			b: "\b",
			e: "\x1B",
			f: "\f",
			n: "\n",
			r: "\r",
			t: "	",
			v: "\v",
			N: "",
			_: "\xA0",
			L: "\u2028",
			P: "\u2029",
			" ": " ",
			"\"": "\"",
			"/": "/",
			"\\": "\\",
			"	": "	"
		};
		function parseCharCode(source, offset, length, onError) {
			const cc = source.substr(offset, length);
			const code = cc.length === length && /^[0-9a-fA-F]+$/.test(cc) ? parseInt(cc, 16) : NaN;
			try {
				return String.fromCodePoint(code);
			} catch {
				const raw = source.substr(offset - 2, length + 2);
				onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
				return raw;
			}
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/compose-scalar.js
		function composeScalar(ctx, token, tagToken, onError) {
			const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar(ctx, token, onError) : resolveFlowScalar(token, ctx.options.strict, onError);
			const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
			let tag;
			if (ctx.options.stringKeys && ctx.atKey) tag = ctx.schema[SCALAR$1];
			else if (tagName) tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
			else if (token.type === "scalar") tag = findScalarTagByTest(ctx, value, token, onError);
			else tag = ctx.schema[SCALAR$1];
			let scalar;
			try {
				const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
				scalar = isScalar(res) ? res : new Scalar(res);
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
				scalar = new Scalar(value);
			}
			scalar.range = range;
			scalar.source = value;
			if (type) scalar.type = type;
			if (tagName) scalar.tag = tagName;
			if (tag.format) scalar.format = tag.format;
			if (comment) scalar.comment = comment;
			return scalar;
		}
		function findScalarTagByName(schema, value, tagName, tagToken, onError) {
			if (tagName === "!") return schema[SCALAR$1];
			const matchWithTest = [];
			for (const tag of schema.tags) if (!tag.collection && tag.tag === tagName) {
				if (tag.default && tag.test) matchWithTest.push(tag);
				else return tag;
			}
			for (const tag of matchWithTest) if (tag.test?.test(value)) return tag;
			const kt = schema.knownTags[tagName];
			if (kt && !kt.collection) {
				schema.tags.push(Object.assign({}, kt, {
					default: false,
					test: void 0
				}));
				return kt;
			}
			onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
			return schema[SCALAR$1];
		}
		function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
			const tag = schema.tags.find((tag) => (tag.default === true || atKey && tag.default === "key") && tag.test?.test(value)) || schema[SCALAR$1];
			if (schema.compat) {
				const compat = schema.compat.find((tag) => tag.default && tag.test?.test(value)) ?? schema[SCALAR$1];
				if (tag.tag !== compat.tag) onError(token, "TAG_RESOLVE_FAILED", `Value may be parsed as either ${directives.tagString(tag.tag)} or ${directives.tagString(compat.tag)}`, true);
			}
			return tag;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/util-empty-scalar-position.js
		function emptyScalarPosition(offset, before, pos) {
			if (before) {
				pos ?? (pos = before.length);
				for (let i = pos - 1; i >= 0; --i) {
					let st = before[i];
					switch (st.type) {
						case "space":
						case "comment":
						case "newline":
							offset -= st.source.length;
							continue;
					}
					st = before[++i];
					while (st?.type === "space") {
						offset += st.source.length;
						st = before[++i];
					}
					break;
				}
			}
			return offset;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/compose-node.js
		const CN = {
			composeNode,
			composeEmptyNode
		};
		function composeNode(ctx, token, props, onError) {
			const atKey = ctx.atKey;
			const { spaceBefore, comment, anchor, tag } = props;
			let node;
			let isSrcToken = true;
			switch (token.type) {
				case "alias":
					node = composeAlias(ctx, token, onError);
					if (anchor || tag) onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
					break;
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar":
				case "block-scalar":
					node = composeScalar(ctx, token, tag, onError);
					if (anchor) node.anchor = anchor.source.substring(1);
					break;
				case "block-map":
				case "block-seq":
				case "flow-collection":
					try {
						node = composeCollection(CN, ctx, token, props, onError);
						if (anchor) node.anchor = anchor.source.substring(1);
					} catch (error) {
						onError(token, "RESOURCE_EXHAUSTION", error instanceof Error ? error.message : String(error));
					}
					break;
				default:
					onError(token, "UNEXPECTED_TOKEN", token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`);
					isSrcToken = false;
			}
			node ?? (node = composeEmptyNode(ctx, token.offset, void 0, null, props, onError));
			if (anchor && node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
			if (atKey && ctx.options.stringKeys && (!isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) onError(tag ?? token, "NON_STRING_KEY", "With stringKeys, all keys must be strings");
			if (spaceBefore) node.spaceBefore = true;
			if (comment) {
				if (token.type === "scalar" && token.source === "") node.comment = comment;
				else node.commentBefore = comment;
			}
			if (ctx.options.keepSourceTokens && isSrcToken) node.srcToken = token;
			return node;
		}
		function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
			const node = composeScalar(ctx, {
				type: "scalar",
				offset: emptyScalarPosition(offset, before, pos),
				indent: -1,
				source: ""
			}, tag, onError);
			if (anchor) {
				node.anchor = anchor.source.substring(1);
				if (node.anchor === "") onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
			}
			if (spaceBefore) node.spaceBefore = true;
			if (comment) {
				node.comment = comment;
				node.range[2] = end;
			}
			return node;
		}
		function composeAlias({ options }, { offset, source, end }, onError) {
			const alias = new Alias(source.substring(1));
			if (alias.source === "") onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
			if (alias.source.endsWith(":")) onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
			const valueEnd = offset + source.length;
			const re = resolveEnd(end, valueEnd, options.strict, onError);
			alias.range = [
				offset,
				valueEnd,
				re.offset
			];
			if (re.comment) alias.comment = re.comment;
			return alias;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/compose-doc.js
		function composeDoc(options, directives, { offset, start, value, end }, onError) {
			const doc = new Document(void 0, Object.assign({ _directives: directives }, options));
			const ctx = {
				atKey: false,
				atRoot: true,
				directives: doc.directives,
				options: doc.options,
				schema: doc.schema
			};
			const props = resolveProps(start, {
				indicator: "doc-start",
				next: value ?? end?.[0],
				offset,
				onError,
				parentIndent: 0,
				startOnNewline: true
			});
			if (props.found) {
				doc.directives.docStart = true;
				if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline) onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
			}
			doc.contents = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
			const contentEnd = doc.contents.range[2];
			const re = resolveEnd(end, contentEnd, false, onError);
			if (re.comment) doc.comment = re.comment;
			doc.range = [
				offset,
				contentEnd,
				re.offset
			];
			return doc;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/compose/composer.js
		function getErrorPos(src) {
			if (typeof src === "number") return [src, src + 1];
			if (Array.isArray(src)) return src.length === 2 ? src : [src[0], src[1]];
			const { offset, source } = src;
			return [offset, offset + (typeof source === "string" ? source.length : 1)];
		}
		function parsePrelude(prelude) {
			let comment = "";
			let atComment = false;
			let afterEmptyLine = false;
			for (let i = 0; i < prelude.length; ++i) {
				const source = prelude[i];
				switch (source[0]) {
					case "#":
						comment += (comment === "" ? "" : afterEmptyLine ? "\n\n" : "\n") + (source.substring(1) || " ");
						atComment = true;
						afterEmptyLine = false;
						break;
					case "%":
						if (prelude[i + 1]?.[0] !== "#") i += 1;
						atComment = false;
						break;
					default:
						if (!atComment) afterEmptyLine = true;
						atComment = false;
				}
			}
			return {
				comment,
				afterEmptyLine
			};
		}
		/**
		* Compose a stream of CST nodes into a stream of YAML Documents.
		*
		* ```ts
		* import { Composer, Parser } from 'yaml'
		*
		* const src: string = ...
		* const tokens = new Parser().parse(src)
		* const docs = new Composer().compose(tokens)
		* ```
		*/
		var Composer = class {
			constructor(options = {}) {
				this.doc = null;
				this.atDirectives = false;
				this.prelude = [];
				this.errors = [];
				this.warnings = [];
				this.onError = (source, code, message, warning) => {
					const pos = getErrorPos(source);
					if (warning) this.warnings.push(new YAMLWarning(pos, code, message));
					else this.errors.push(new YAMLParseError(pos, code, message));
				};
				this.directives = new Directives({ version: options.version || "1.2" });
				this.options = options;
			}
			decorate(doc, afterDoc) {
				const { comment, afterEmptyLine } = parsePrelude(this.prelude);
				if (comment) {
					const dc = doc.contents;
					if (afterDoc) doc.comment = doc.comment ? `${doc.comment}\n${comment}` : comment;
					else if (afterEmptyLine || doc.directives.docStart || !dc) doc.commentBefore = comment;
					else if (isCollection(dc) && !dc.flow && dc.items.length > 0) {
						let it = dc.items[0];
						if (isPair(it)) it = it.key;
						const cb = it.commentBefore;
						it.commentBefore = cb ? `${comment}\n${cb}` : comment;
					} else {
						const cb = dc.commentBefore;
						dc.commentBefore = cb ? `${comment}\n${cb}` : comment;
					}
				}
				if (afterDoc) {
					for (let i = 0; i < this.errors.length; ++i) doc.errors.push(this.errors[i]);
					for (let i = 0; i < this.warnings.length; ++i) doc.warnings.push(this.warnings[i]);
				} else {
					doc.errors = this.errors;
					doc.warnings = this.warnings;
				}
				this.prelude = [];
				this.errors = [];
				this.warnings = [];
			}
			/**
			* Current stream status information.
			*
			* Mostly useful at the end of input for an empty stream.
			*/
			streamInfo() {
				return {
					comment: parsePrelude(this.prelude).comment,
					directives: this.directives,
					errors: this.errors,
					warnings: this.warnings
				};
			}
			/**
			* Compose tokens into documents.
			*
			* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
			* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
			*/
			*compose(tokens, forceDoc = false, endOffset = -1) {
				for (const token of tokens) yield* this.next(token);
				yield* this.end(forceDoc, endOffset);
			}
			/** Advance the composer by one CST token. */
			*next(token) {
				switch (token.type) {
					case "directive":
						this.directives.add(token.source, (offset, message, warning) => {
							const pos = getErrorPos(token);
							pos[0] += offset;
							this.onError(pos, "BAD_DIRECTIVE", message, warning);
						});
						this.prelude.push(token.source);
						this.atDirectives = true;
						break;
					case "document": {
						const doc = composeDoc(this.options, this.directives, token, this.onError);
						if (this.atDirectives && !doc.directives.docStart) this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
						this.decorate(doc, false);
						if (this.doc) yield this.doc;
						this.doc = doc;
						this.atDirectives = false;
						break;
					}
					case "byte-order-mark":
					case "space": break;
					case "comment":
					case "newline":
						this.prelude.push(token.source);
						break;
					case "error": {
						const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
						const error = new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
						if (this.atDirectives || !this.doc) this.errors.push(error);
						else this.doc.errors.push(error);
						break;
					}
					case "doc-end": {
						if (!this.doc) {
							this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", "Unexpected doc-end without preceding document"));
							break;
						}
						this.doc.directives.docEnd = true;
						const end = resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
						this.decorate(this.doc, true);
						if (end.comment) {
							const dc = this.doc.comment;
							this.doc.comment = dc ? `${dc}\n${end.comment}` : end.comment;
						}
						this.doc.range[2] = end.offset;
						break;
					}
					default: this.errors.push(new YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
				}
			}
			/**
			* Call at end of input to yield any remaining document.
			*
			* @param forceDoc - If the stream contains no document, still emit a final document including any comments and directives that would be applied to a subsequent document.
			* @param endOffset - Should be set if `forceDoc` is also set, to set the document range end and to indicate errors correctly.
			*/
			*end(forceDoc = false, endOffset = -1) {
				if (this.doc) {
					this.decorate(this.doc, true);
					yield this.doc;
					this.doc = null;
				} else if (forceDoc) {
					const doc = new Document(void 0, Object.assign({ _directives: this.directives }, this.options));
					if (this.atDirectives) this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
					doc.range = [
						0,
						endOffset,
						endOffset
					];
					this.decorate(doc, false);
					yield doc;
				}
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/parse/cst-visit.js
		const BREAK = Symbol("break visit");
		const SKIP = Symbol("skip children");
		const REMOVE = Symbol("remove item");
		/**
		* Apply a visitor to a CST document or item.
		*
		* Walks through the tree (depth-first) starting from the root, calling a
		* `visitor` function with two arguments when entering each item:
		*   - `item`: The current item, which included the following members:
		*     - `start: SourceToken[]` – Source tokens before the key or value,
		*       possibly including its anchor or tag.
		*     - `key?: Token | null` – Set for pair values. May then be `null`, if
		*       the key before the `:` separator is empty.
		*     - `sep?: SourceToken[]` – Source tokens between the key and the value,
		*       which should include the `:` map value indicator if `value` is set.
		*     - `value?: Token` – The value of a sequence item, or of a map pair.
		*   - `path`: The steps from the root to the current node, as an array of
		*     `['key' | 'value', number]` tuples.
		*
		* The return value of the visitor may be used to control the traversal:
		*   - `undefined` (default): Do nothing and continue
		*   - `visit.SKIP`: Do not visit the children of this token, continue with
		*      next sibling
		*   - `visit.BREAK`: Terminate traversal completely
		*   - `visit.REMOVE`: Remove the current item, then continue with the next one
		*   - `number`: Set the index of the next step. This is useful especially if
		*     the index of the current token has changed.
		*   - `function`: Define the next visitor for this item. After the original
		*     visitor is called on item entry, next visitors are called after handling
		*     a non-empty `key` and when exiting the item.
		*/
		function visit(cst, visitor) {
			if ("type" in cst && cst.type === "document") cst = {
				start: cst.start,
				value: cst.value
			};
			_visit(Object.freeze([]), cst, visitor);
		}
		/** Terminate visit traversal completely */
		visit.BREAK = BREAK;
		/** Do not visit the children of the current item */
		visit.SKIP = SKIP;
		/** Remove the current item */
		visit.REMOVE = REMOVE;
		/** Find the item at `path` from `cst` as the root */
		visit.itemAtPath = (cst, path) => {
			let item = cst;
			for (const [field, index] of path) {
				const tok = item?.[field];
				if (tok && "items" in tok) item = tok.items[index];
				else return void 0;
			}
			return item;
		};
		/**
		* Get the immediate parent collection of the item at `path` from `cst` as the root.
		*
		* Throws an error if the collection is not found, which should never happen if the item itself exists.
		*/
		visit.parentCollection = (cst, path) => {
			const parent = visit.itemAtPath(cst, path.slice(0, -1));
			const field = path[path.length - 1][0];
			const coll = parent?.[field];
			if (coll && "items" in coll) return coll;
			throw new Error("Parent collection not found");
		};
		function _visit(path, item, visitor) {
			let ctrl = visitor(item, path);
			if (typeof ctrl === "symbol") return ctrl;
			for (const field of ["key", "value"]) {
				const token = item[field];
				if (token && "items" in token) {
					for (let i = 0; i < token.items.length; ++i) {
						const ci = _visit(Object.freeze(path.concat([[field, i]])), token.items[i], visitor);
						if (typeof ci === "number") i = ci - 1;
						else if (ci === BREAK) return BREAK;
						else if (ci === REMOVE) {
							token.items.splice(i, 1);
							i -= 1;
						}
					}
					if (typeof ctrl === "function" && field === "key") ctrl = ctrl(item, path);
				}
			}
			return typeof ctrl === "function" ? ctrl(item, path) : ctrl;
		}
		/** Identify the type of a lexer token. May return `null` for unknown tokens. */
		function tokenType(source) {
			switch (source) {
				case "﻿": return "byte-order-mark";
				case "": return "doc-mode";
				case "": return "flow-error-end";
				case "": return "scalar";
				case "---": return "doc-start";
				case "...": return "doc-end";
				case "":
				case "\n":
				case "\r\n": return "newline";
				case "-": return "seq-item-ind";
				case "?": return "explicit-key-ind";
				case ":": return "map-value-ind";
				case "{": return "flow-map-start";
				case "}": return "flow-map-end";
				case "[": return "flow-seq-start";
				case "]": return "flow-seq-end";
				case ",": return "comma";
			}
			switch (source[0]) {
				case " ":
				case "	": return "space";
				case "#": return "comment";
				case "%": return "directive-line";
				case "*": return "alias";
				case "&": return "anchor";
				case "!": return "tag";
				case "'": return "single-quoted-scalar";
				case "\"": return "double-quoted-scalar";
				case "|":
				case ">": return "block-scalar-header";
			}
			return null;
		}
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/parse/lexer.js
		function isEmpty(ch) {
			switch (ch) {
				case void 0:
				case " ":
				case "\n":
				case "\r":
				case "	": return true;
				default: return false;
			}
		}
		const hexDigits = /* @__PURE__ */ new Set("0123456789ABCDEFabcdef");
		const tagChars = /* @__PURE__ */ new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
		const flowIndicatorChars = /* @__PURE__ */ new Set(",[]{}");
		const invalidAnchorChars = /* @__PURE__ */ new Set(" ,[]{}\n\r	");
		const isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);
		/**
		* Splits an input string into lexical tokens, i.e. smaller strings that are
		* easily identifiable by `tokens.tokenType()`.
		*
		* Lexing starts always in a "stream" context. Incomplete input may be buffered
		* until a complete token can be emitted.
		*
		* In addition to slices of the original input, the following control characters
		* may also be emitted:
		*
		* - `\x02` (Start of Text): A document starts with the next token
		* - `\x18` (Cancel): Unexpected end of flow-mode (indicates an error)
		* - `\x1f` (Unit Separator): Next token is a scalar value
		* - `\u{FEFF}` (Byte order mark): Emitted separately outside documents
		*/
		var Lexer = class {
			constructor() {
				/**
				* Flag indicating whether the end of the current buffer marks the end of
				* all input
				*/
				this.atEnd = false;
				/**
				* Explicit indent set in block scalar header, as an offset from the current
				* minimum indent, so e.g. set to 1 from a header `|2+`. Set to -1 if not
				* explicitly set.
				*/
				this.blockScalarIndent = -1;
				/**
				* Block scalars that include a + (keep) chomping indicator in their header
				* include trailing empty lines, which are otherwise excluded from the
				* scalar's contents.
				*/
				this.blockScalarKeep = false;
				/** Current input */
				this.buffer = "";
				/**
				* Flag noting whether the map value indicator : can immediately follow this
				* node within a flow context.
				*/
				this.flowKey = false;
				/** Count of surrounding flow collection levels. */
				this.flowLevel = 0;
				/**
				* Minimum level of indentation required for next lines to be parsed as a
				* part of the current scalar value.
				*/
				this.indentNext = 0;
				/** Indentation level of the current line. */
				this.indentValue = 0;
				/** Position of the next \n character. */
				this.lineEndPos = null;
				/** Stores the state of the lexer if reaching the end of incpomplete input */
				this.next = null;
				/** A pointer to `buffer`; the current position of the lexer. */
				this.pos = 0;
			}
			/**
			* Generate YAML tokens from the `source` string. If `incomplete`,
			* a part of the last line may be left as a buffer for the next call.
			*
			* @returns A generator of lexical tokens
			*/
			*lex(source, incomplete = false) {
				if (source) {
					if (typeof source !== "string") throw TypeError("source is not a string");
					this.buffer = this.buffer ? this.buffer + source : source;
					this.lineEndPos = null;
				}
				this.atEnd = !incomplete;
				let next = this.next ?? "stream";
				while (next && (incomplete || this.hasChars(1))) next = yield* this.parseNext(next);
			}
			atLineEnd() {
				let i = this.pos;
				let ch = this.buffer[i];
				while (ch === " " || ch === "	") ch = this.buffer[++i];
				if (!ch || ch === "#" || ch === "\n") return true;
				if (ch === "\r") return this.buffer[i + 1] === "\n";
				return false;
			}
			charAt(n) {
				return this.buffer[this.pos + n];
			}
			continueScalar(offset) {
				let ch = this.buffer[offset];
				if (this.indentNext > 0) {
					let indent = 0;
					while (ch === " ") ch = this.buffer[++indent + offset];
					if (ch === "\r") {
						const next = this.buffer[indent + offset + 1];
						if (next === "\n" || !next && !this.atEnd) return offset + indent + 1;
					}
					return ch === "\n" || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
				}
				if (ch === "-" || ch === ".") {
					const dt = this.buffer.substr(offset, 3);
					if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3])) return -1;
				}
				return offset;
			}
			getLine() {
				let end = this.lineEndPos;
				if (typeof end !== "number" || end !== -1 && end < this.pos) {
					end = this.buffer.indexOf("\n", this.pos);
					this.lineEndPos = end;
				}
				if (end === -1) return this.atEnd ? this.buffer.substring(this.pos) : null;
				if (this.buffer[end - 1] === "\r") end -= 1;
				return this.buffer.substring(this.pos, end);
			}
			hasChars(n) {
				return this.pos + n <= this.buffer.length;
			}
			setNext(state) {
				this.buffer = this.buffer.substring(this.pos);
				this.pos = 0;
				this.lineEndPos = null;
				this.next = state;
				return null;
			}
			peek(n) {
				return this.buffer.substr(this.pos, n);
			}
			*parseNext(next) {
				switch (next) {
					case "stream": return yield* this.parseStream();
					case "line-start": return yield* this.parseLineStart();
					case "block-start": return yield* this.parseBlockStart();
					case "doc": return yield* this.parseDocument();
					case "flow": return yield* this.parseFlowCollection();
					case "quoted-scalar": return yield* this.parseQuotedScalar();
					case "block-scalar": return yield* this.parseBlockScalar();
					case "plain-scalar": return yield* this.parsePlainScalar();
				}
			}
			*parseStream() {
				let line = this.getLine();
				if (line === null) return this.setNext("stream");
				if (line[0] === "﻿") {
					yield* this.pushCount(1);
					line = line.substring(1);
				}
				if (line[0] === "%") {
					let dirEnd = line.length;
					let cs = line.indexOf("#");
					while (cs !== -1) {
						const ch = line[cs - 1];
						if (ch === " " || ch === "	") {
							dirEnd = cs - 1;
							break;
						} else cs = line.indexOf("#", cs + 1);
					}
					while (true) {
						const ch = line[dirEnd - 1];
						if (ch === " " || ch === "	") dirEnd -= 1;
						else break;
					}
					const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
					yield* this.pushCount(line.length - n);
					this.pushNewline();
					return "stream";
				}
				if (this.atLineEnd()) {
					const sp = yield* this.pushSpaces(true);
					yield* this.pushCount(line.length - sp);
					yield* this.pushNewline();
					return "stream";
				}
				yield "";
				return yield* this.parseLineStart();
			}
			*parseLineStart() {
				const ch = this.charAt(0);
				if (!ch && !this.atEnd) return this.setNext("line-start");
				if (ch === "-" || ch === ".") {
					if (!this.atEnd && !this.hasChars(4)) return this.setNext("line-start");
					const s = this.peek(3);
					if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
						yield* this.pushCount(3);
						this.indentValue = 0;
						this.indentNext = 0;
						return s === "---" ? "doc" : "stream";
					}
				}
				this.indentValue = yield* this.pushSpaces(false);
				if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1))) this.indentNext = this.indentValue;
				return yield* this.parseBlockStart();
			}
			*parseBlockStart() {
				const [ch0, ch1] = this.peek(2);
				if (!ch1 && !this.atEnd) return this.setNext("block-start");
				if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
					const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
					this.indentNext = this.indentValue + 1;
					this.indentValue += n;
					return "block-start";
				}
				return "doc";
			}
			*parseDocument() {
				yield* this.pushSpaces(true);
				const line = this.getLine();
				if (line === null) return this.setNext("doc");
				let n = yield* this.pushIndicators();
				switch (line[n]) {
					case "#": yield* this.pushCount(line.length - n);
					case void 0:
						yield* this.pushNewline();
						return yield* this.parseLineStart();
					case "{":
					case "[":
						yield* this.pushCount(1);
						this.flowKey = false;
						this.flowLevel = 1;
						return "flow";
					case "}":
					case "]":
						yield* this.pushCount(1);
						return "doc";
					case "*":
						yield* this.pushUntil(isNotAnchorChar);
						return "doc";
					case "\"":
					case "'": return yield* this.parseQuotedScalar();
					case "|":
					case ">":
						n += yield* this.parseBlockScalarHeader();
						n += yield* this.pushSpaces(true);
						yield* this.pushCount(line.length - n);
						yield* this.pushNewline();
						return yield* this.parseBlockScalar();
					default: return yield* this.parsePlainScalar();
				}
			}
			*parseFlowCollection() {
				let nl, sp;
				let indent = -1;
				do {
					nl = yield* this.pushNewline();
					if (nl > 0) {
						sp = yield* this.pushSpaces(false);
						this.indentValue = indent = sp;
					} else sp = 0;
					sp += yield* this.pushSpaces(true);
				} while (nl + sp > 0);
				const line = this.getLine();
				if (line === null) return this.setNext("flow");
				if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
					if (!(indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}"))) {
						this.flowLevel = 0;
						yield "";
						return yield* this.parseLineStart();
					}
				}
				let n = 0;
				while (line[n] === ",") {
					n += yield* this.pushCount(1);
					n += yield* this.pushSpaces(true);
					this.flowKey = false;
				}
				n += yield* this.pushIndicators();
				switch (line[n]) {
					case void 0: return "flow";
					case "#":
						yield* this.pushCount(line.length - n);
						return "flow";
					case "{":
					case "[":
						yield* this.pushCount(1);
						this.flowKey = false;
						this.flowLevel += 1;
						return "flow";
					case "}":
					case "]":
						yield* this.pushCount(1);
						this.flowKey = true;
						this.flowLevel -= 1;
						return this.flowLevel ? "flow" : "doc";
					case "*":
						yield* this.pushUntil(isNotAnchorChar);
						return "flow";
					case "\"":
					case "'":
						this.flowKey = true;
						return yield* this.parseQuotedScalar();
					case ":": {
						const next = this.charAt(1);
						if (this.flowKey || isEmpty(next) || next === ",") {
							this.flowKey = false;
							yield* this.pushCount(1);
							yield* this.pushSpaces(true);
							return "flow";
						}
					}
					default:
						this.flowKey = false;
						return yield* this.parsePlainScalar();
				}
			}
			*parseQuotedScalar() {
				const quote = this.charAt(0);
				let end = this.buffer.indexOf(quote, this.pos + 1);
				if (quote === "'") while (end !== -1 && this.buffer[end + 1] === "'") end = this.buffer.indexOf("'", end + 2);
				else while (end !== -1) {
					let n = 0;
					while (this.buffer[end - 1 - n] === "\\") n += 1;
					if (n % 2 === 0) break;
					end = this.buffer.indexOf("\"", end + 1);
				}
				const qb = this.buffer.substring(0, end);
				let nl = qb.indexOf("\n", this.pos);
				if (nl !== -1) {
					while (nl !== -1) {
						const cs = this.continueScalar(nl + 1);
						if (cs === -1) break;
						nl = qb.indexOf("\n", cs);
					}
					if (nl !== -1) end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
				}
				if (end === -1) {
					if (!this.atEnd) return this.setNext("quoted-scalar");
					end = this.buffer.length;
				}
				yield* this.pushToIndex(end + 1, false);
				return this.flowLevel ? "flow" : "doc";
			}
			*parseBlockScalarHeader() {
				this.blockScalarIndent = -1;
				this.blockScalarKeep = false;
				let i = this.pos;
				while (true) {
					const ch = this.buffer[++i];
					if (ch === "+") this.blockScalarKeep = true;
					else if (ch > "0" && ch <= "9") this.blockScalarIndent = Number(ch) - 1;
					else if (ch !== "-") break;
				}
				return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
			}
			*parseBlockScalar() {
				let nl = this.pos - 1;
				let indent = 0;
				let ch;
				loop: for (let i = this.pos; ch = this.buffer[i]; ++i) switch (ch) {
					case " ":
						indent += 1;
						break;
					case "\n":
						nl = i;
						indent = 0;
						break;
					case "\r": {
						const next = this.buffer[i + 1];
						if (!next && !this.atEnd) return this.setNext("block-scalar");
						if (next === "\n") break;
					}
					default: break loop;
				}
				if (!ch && !this.atEnd) return this.setNext("block-scalar");
				if (indent >= this.indentNext) {
					if (this.blockScalarIndent === -1) this.indentNext = indent;
					else this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
					do {
						const cs = this.continueScalar(nl + 1);
						if (cs === -1) break;
						nl = this.buffer.indexOf("\n", cs);
					} while (nl !== -1);
					if (nl === -1) {
						if (!this.atEnd) return this.setNext("block-scalar");
						nl = this.buffer.length;
					}
				}
				let i = nl + 1;
				ch = this.buffer[i];
				while (ch === " ") ch = this.buffer[++i];
				if (ch === "	") {
					while (ch === "	" || ch === " " || ch === "\r" || ch === "\n") ch = this.buffer[++i];
					nl = i - 1;
				} else if (!this.blockScalarKeep) do {
					let i = nl - 1;
					let ch = this.buffer[i];
					if (ch === "\r") ch = this.buffer[--i];
					const lastChar = i;
					while (ch === " ") ch = this.buffer[--i];
					if (ch === "\n" && i >= this.pos && i + 1 + indent > lastChar) nl = i;
					else break;
				} while (true);
				yield "";
				yield* this.pushToIndex(nl + 1, true);
				return yield* this.parseLineStart();
			}
			*parsePlainScalar() {
				const inFlow = this.flowLevel > 0;
				let end = this.pos - 1;
				let i = this.pos - 1;
				let ch;
				while (ch = this.buffer[++i]) if (ch === ":") {
					const next = this.buffer[i + 1];
					if (isEmpty(next) || inFlow && flowIndicatorChars.has(next)) break;
					end = i;
				} else if (isEmpty(ch)) {
					let next = this.buffer[i + 1];
					if (ch === "\r") {
						if (next === "\n") {
							i += 1;
							ch = "\n";
							next = this.buffer[i + 1];
						} else end = i;
					}
					if (next === "#" || inFlow && flowIndicatorChars.has(next)) break;
					if (ch === "\n") {
						const cs = this.continueScalar(i + 1);
						if (cs === -1) break;
						i = Math.max(i, cs - 2);
					}
				} else {
					if (inFlow && flowIndicatorChars.has(ch)) break;
					end = i;
				}
				if (!ch && !this.atEnd) return this.setNext("plain-scalar");
				yield "";
				yield* this.pushToIndex(end + 1, true);
				return inFlow ? "flow" : "doc";
			}
			*pushCount(n) {
				if (n > 0) {
					yield this.buffer.substr(this.pos, n);
					this.pos += n;
					return n;
				}
				return 0;
			}
			*pushToIndex(i, allowEmpty) {
				const s = this.buffer.slice(this.pos, i);
				if (s) {
					yield s;
					this.pos += s.length;
					return s.length;
				} else if (allowEmpty) yield "";
				return 0;
			}
			*pushIndicators() {
				let n = 0;
				loop: while (true) {
					switch (this.charAt(0)) {
						case "!":
							n += yield* this.pushTag();
							n += yield* this.pushSpaces(true);
							continue loop;
						case "&":
							n += yield* this.pushUntil(isNotAnchorChar);
							n += yield* this.pushSpaces(true);
							continue loop;
						case "-":
						case "?":
						case ":": {
							const inFlow = this.flowLevel > 0;
							const ch1 = this.charAt(1);
							if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
								if (!inFlow) this.indentNext = this.indentValue + 1;
								else if (this.flowKey) this.flowKey = false;
								n += yield* this.pushCount(1);
								n += yield* this.pushSpaces(true);
								continue loop;
							}
						}
					}
					break loop;
				}
				return n;
			}
			*pushTag() {
				if (this.charAt(1) === "<") {
					let i = this.pos + 2;
					let ch = this.buffer[i];
					while (!isEmpty(ch) && ch !== ">") ch = this.buffer[++i];
					return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
				} else {
					let i = this.pos + 1;
					let ch = this.buffer[i];
					while (ch) if (tagChars.has(ch)) ch = this.buffer[++i];
					else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) ch = this.buffer[i += 3];
					else break;
					return yield* this.pushToIndex(i, false);
				}
			}
			*pushNewline() {
				const ch = this.buffer[this.pos];
				if (ch === "\n") return yield* this.pushCount(1);
				else if (ch === "\r" && this.charAt(1) === "\n") return yield* this.pushCount(2);
				else return 0;
			}
			*pushSpaces(allowTabs) {
				let i = this.pos - 1;
				let ch;
				do
					ch = this.buffer[++i];
				while (ch === " " || allowTabs && ch === "	");
				const n = i - this.pos;
				if (n > 0) {
					yield this.buffer.substr(this.pos, n);
					this.pos = i;
				}
				return n;
			}
			*pushUntil(test) {
				let i = this.pos;
				let ch = this.buffer[i];
				while (!test(ch)) ch = this.buffer[++i];
				return yield* this.pushToIndex(i, false);
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/parse/line-counter.js
		/**
		* Tracks newlines during parsing in order to provide an efficient API for
		* determining the one-indexed `{ line, col }` position for any offset
		* within the input.
		*/
		var LineCounter = class {
			constructor() {
				this.lineStarts = [];
				/**
				* Should be called in ascending order. Otherwise, call
				* `lineCounter.lineStarts.sort()` before calling `linePos()`.
				*/
				this.addNewLine = (offset) => this.lineStarts.push(offset);
				/**
				* Performs a binary search and returns the 1-indexed { line, col }
				* position of `offset`. If `line === 0`, `addNewLine` has never been
				* called or `offset` is before the first known newline.
				*/
				this.linePos = (offset) => {
					let low = 0;
					let high = this.lineStarts.length;
					while (low < high) {
						const mid = low + high >> 1;
						if (this.lineStarts[mid] < offset) low = mid + 1;
						else high = mid;
					}
					if (this.lineStarts[low] === offset) return {
						line: low + 1,
						col: 1
					};
					if (low === 0) return {
						line: 0,
						col: offset
					};
					const start = this.lineStarts[low - 1];
					return {
						line: low,
						col: offset - start + 1
					};
				};
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/parse/parser.js
		function includesToken(list, type) {
			for (let i = 0; i < list.length; ++i) if (list[i].type === type) return true;
			return false;
		}
		function findNonEmptyIndex(list) {
			for (let i = 0; i < list.length; ++i) switch (list[i].type) {
				case "space":
				case "comment":
				case "newline": break;
				default: return i;
			}
			return -1;
		}
		function isFlowToken(token) {
			switch (token?.type) {
				case "alias":
				case "scalar":
				case "single-quoted-scalar":
				case "double-quoted-scalar":
				case "flow-collection": return true;
				default: return false;
			}
		}
		function getPrevProps(parent) {
			switch (parent.type) {
				case "document": return parent.start;
				case "block-map": {
					const it = parent.items[parent.items.length - 1];
					return it.sep ?? it.start;
				}
				case "block-seq": return parent.items[parent.items.length - 1].start;
				/* istanbul ignore next should not happen */
				default: return [];
			}
		}
		/** Note: May modify input array */
		function getFirstKeyStartProps(prev) {
			if (prev.length === 0) return [];
			let i = prev.length;
			loop: while (--i >= 0) switch (prev[i].type) {
				case "doc-start":
				case "explicit-key-ind":
				case "map-value-ind":
				case "seq-item-ind":
				case "newline": break loop;
			}
			while (prev[++i]?.type === "space");
			return prev.splice(i, prev.length);
		}
		function arrayPushArray(target, source) {
			if (source.length < 1e5) Array.prototype.push.apply(target, source);
			else for (let i = 0; i < source.length; ++i) target.push(source[i]);
		}
		function fixFlowSeqItems(fc) {
			if (fc.start.type === "flow-seq-start") {
				for (const it of fc.items) if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
					if (it.key) it.value = it.key;
					delete it.key;
					if (isFlowToken(it.value)) {
						if (it.value.end) arrayPushArray(it.value.end, it.sep);
						else it.value.end = it.sep;
					} else arrayPushArray(it.start, it.sep);
					delete it.sep;
				}
			}
		}
		/**
		* A YAML concrete syntax tree (CST) parser
		*
		* ```ts
		* const src: string = ...
		* for (const token of new Parser().parse(src)) {
		*   // token: Token
		* }
		* ```
		*
		* To use the parser with a user-provided lexer:
		*
		* ```ts
		* function* parse(source: string, lexer: Lexer) {
		*   const parser = new Parser()
		*   for (const lexeme of lexer.lex(source))
		*     yield* parser.next(lexeme)
		*   yield* parser.end()
		* }
		*
		* const src: string = ...
		* const lexer = new Lexer()
		* for (const token of parse(src, lexer)) {
		*   // token: Token
		* }
		* ```
		*/
		var Parser = class {
			/**
			* @param onNewLine - If defined, called separately with the start position of
			*   each new line (in `parse()`, including the start of input).
			*/
			constructor(onNewLine) {
				/** If true, space and sequence indicators count as indentation */
				this.atNewLine = true;
				/** If true, next token is a scalar value */
				this.atScalar = false;
				/** Current indentation level */
				this.indent = 0;
				/** Current offset since the start of parsing */
				this.offset = 0;
				/** On the same line with a block map key */
				this.onKeyLine = false;
				/** Top indicates the node that's currently being built */
				this.stack = [];
				/** The source of the current token, set in parse() */
				this.source = "";
				/** The type of the current token, set in parse() */
				this.type = "";
				this.lexer = new Lexer();
				this.onNewLine = onNewLine;
			}
			/**
			* Parse `source` as a YAML stream.
			* If `incomplete`, a part of the last line may be left as a buffer for the next call.
			*
			* Errors are not thrown, but yielded as `{ type: 'error', message }` tokens.
			*
			* @returns A generator of tokens representing each directive, document, and other structure.
			*/
			*parse(source, incomplete = false) {
				if (this.onNewLine && this.offset === 0) this.onNewLine(0);
				for (const lexeme of this.lexer.lex(source, incomplete)) yield* this.next(lexeme);
				if (!incomplete) yield* this.end();
			}
			/**
			* Advance the parser by the `source` of one lexical token.
			*/
			*next(source) {
				this.source = source;
				if (this.atScalar) {
					this.atScalar = false;
					yield* this.step();
					this.offset += source.length;
					return;
				}
				const type = tokenType(source);
				if (!type) {
					const message = `Not a YAML token: ${source}`;
					yield* this.pop({
						type: "error",
						offset: this.offset,
						message,
						source
					});
					this.offset += source.length;
				} else if (type === "scalar") {
					this.atNewLine = false;
					this.atScalar = true;
					this.type = "scalar";
				} else {
					this.type = type;
					yield* this.step();
					switch (type) {
						case "newline":
							this.atNewLine = true;
							this.indent = 0;
							if (this.onNewLine) this.onNewLine(this.offset + source.length);
							break;
						case "space":
							if (this.atNewLine && source[0] === " ") this.indent += source.length;
							break;
						case "explicit-key-ind":
						case "map-value-ind":
						case "seq-item-ind":
							if (this.atNewLine) this.indent += source.length;
							break;
						case "doc-mode":
						case "flow-error-end": return;
						default: this.atNewLine = false;
					}
					this.offset += source.length;
				}
			}
			/** Call at end of input to push out any remaining constructions */
			*end() {
				while (this.stack.length > 0) yield* this.pop();
			}
			get sourceToken() {
				return {
					type: this.type,
					offset: this.offset,
					indent: this.indent,
					source: this.source
				};
			}
			*step() {
				const top = this.peek(1);
				if (this.type === "doc-end" && top?.type !== "doc-end") {
					while (this.stack.length > 0) yield* this.pop();
					this.stack.push({
						type: "doc-end",
						offset: this.offset,
						source: this.source
					});
					return;
				}
				if (!top) return yield* this.stream();
				switch (top.type) {
					case "document": return yield* this.document(top);
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": return yield* this.scalar(top);
					case "block-scalar": return yield* this.blockScalar(top);
					case "block-map": return yield* this.blockMap(top);
					case "block-seq": return yield* this.blockSequence(top);
					case "flow-collection": return yield* this.flowCollection(top);
					case "doc-end": return yield* this.documentEnd(top);
				}
				/* istanbul ignore next should not happen */
				yield* this.pop();
			}
			peek(n) {
				return this.stack[this.stack.length - n];
			}
			*pop(error) {
				const token = error ?? this.stack.pop();
				/* istanbul ignore if should not happen */
				if (!token) yield {
					type: "error",
					offset: this.offset,
					source: "",
					message: "Tried to pop an empty stack"
				};
				else if (this.stack.length === 0) yield token;
				else {
					const top = this.peek(1);
					if (token.type === "block-scalar") token.indent = "indent" in top ? top.indent : 0;
					else if (token.type === "flow-collection" && top.type === "document") token.indent = 0;
					if (token.type === "flow-collection") fixFlowSeqItems(token);
					switch (top.type) {
						case "document":
							top.value = token;
							break;
						case "block-scalar":
							top.props.push(token);
							break;
						case "block-map": {
							const it = top.items[top.items.length - 1];
							if (it.value) {
								top.items.push({
									start: [],
									key: token,
									sep: []
								});
								this.onKeyLine = true;
								return;
							} else if (it.sep) it.value = token;
							else {
								Object.assign(it, {
									key: token,
									sep: []
								});
								this.onKeyLine = !it.explicitKey;
								return;
							}
							break;
						}
						case "block-seq": {
							const it = top.items[top.items.length - 1];
							if (it.value) top.items.push({
								start: [],
								value: token
							});
							else it.value = token;
							break;
						}
						case "flow-collection": {
							const it = top.items[top.items.length - 1];
							if (!it || it.value) top.items.push({
								start: [],
								key: token,
								sep: []
							});
							else if (it.sep) it.value = token;
							else Object.assign(it, {
								key: token,
								sep: []
							});
							return;
						}
						/* istanbul ignore next should not happen */
						default:
							yield* this.pop();
							yield* this.pop(token);
					}
					if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
						const last = token.items[token.items.length - 1];
						if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
							if (top.type === "document") top.end = last.start;
							else top.items.push({ start: last.start });
							token.items.splice(-1, 1);
						}
					}
				}
			}
			*stream() {
				switch (this.type) {
					case "directive-line":
						yield {
							type: "directive",
							offset: this.offset,
							source: this.source
						};
						return;
					case "byte-order-mark":
					case "space":
					case "comment":
					case "newline":
						yield this.sourceToken;
						return;
					case "doc-mode":
					case "doc-start": {
						const doc = {
							type: "document",
							offset: this.offset,
							start: []
						};
						if (this.type === "doc-start") doc.start.push(this.sourceToken);
						this.stack.push(doc);
						return;
					}
				}
				yield {
					type: "error",
					offset: this.offset,
					message: `Unexpected ${this.type} token in YAML stream`,
					source: this.source
				};
			}
			*document(doc) {
				if (doc.value) return yield* this.lineEnd(doc);
				switch (this.type) {
					case "doc-start":
						if (findNonEmptyIndex(doc.start) !== -1) {
							yield* this.pop();
							yield* this.step();
						} else doc.start.push(this.sourceToken);
						return;
					case "anchor":
					case "tag":
					case "space":
					case "comment":
					case "newline":
						doc.start.push(this.sourceToken);
						return;
				}
				const bv = this.startBlockValue(doc);
				if (bv) this.stack.push(bv);
				else yield {
					type: "error",
					offset: this.offset,
					message: `Unexpected ${this.type} token in YAML document`,
					source: this.source
				};
			}
			*scalar(scalar) {
				if (this.type === "map-value-ind") {
					const start = getFirstKeyStartProps(getPrevProps(this.peek(2)));
					let sep;
					if (scalar.end) {
						sep = scalar.end;
						sep.push(this.sourceToken);
						delete scalar.end;
					} else sep = [this.sourceToken];
					const map = {
						type: "block-map",
						offset: scalar.offset,
						indent: scalar.indent,
						items: [{
							start,
							key: scalar,
							sep
						}]
					};
					this.onKeyLine = true;
					this.stack[this.stack.length - 1] = map;
				} else yield* this.lineEnd(scalar);
			}
			*blockScalar(scalar) {
				switch (this.type) {
					case "space":
					case "comment":
					case "newline":
						scalar.props.push(this.sourceToken);
						return;
					case "scalar":
						scalar.source = this.source;
						this.atNewLine = true;
						this.indent = 0;
						if (this.onNewLine) {
							let nl = this.source.indexOf("\n") + 1;
							while (nl !== 0) {
								this.onNewLine(this.offset + nl);
								nl = this.source.indexOf("\n", nl) + 1;
							}
						}
						yield* this.pop();
						break;
					/* istanbul ignore next should not happen */
					default:
						yield* this.pop();
						yield* this.step();
				}
			}
			*blockMap(map) {
				const it = map.items[map.items.length - 1];
				switch (this.type) {
					case "newline":
						this.onKeyLine = false;
						if (it.value) {
							const end = "end" in it.value ? it.value.end : void 0;
							if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
							else map.items.push({ start: [this.sourceToken] });
						} else if (it.sep) it.sep.push(this.sourceToken);
						else it.start.push(this.sourceToken);
						return;
					case "space":
					case "comment":
						if (it.value) map.items.push({ start: [this.sourceToken] });
						else if (it.sep) it.sep.push(this.sourceToken);
						else {
							if (this.atIndentedComment(it.start, map.indent)) {
								const end = map.items[map.items.length - 2]?.value?.end;
								if (Array.isArray(end)) {
									arrayPushArray(end, it.start);
									end.push(this.sourceToken);
									map.items.pop();
									return;
								}
							}
							it.start.push(this.sourceToken);
						}
						return;
				}
				if (this.indent >= map.indent) {
					const atMapIndent = !this.onKeyLine && this.indent === map.indent;
					const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
					let start = [];
					if (atNextItem && it.sep && !it.value) {
						const nl = [];
						for (let i = 0; i < it.sep.length; ++i) {
							const st = it.sep[i];
							switch (st.type) {
								case "newline":
									nl.push(i);
									break;
								case "space": break;
								case "comment":
									if (st.indent > map.indent) nl.length = 0;
									break;
								default: nl.length = 0;
							}
						}
						if (nl.length >= 2) start = it.sep.splice(nl[1]);
					}
					switch (this.type) {
						case "anchor":
						case "tag":
							if (atNextItem || it.value) {
								start.push(this.sourceToken);
								map.items.push({ start });
								this.onKeyLine = true;
							} else if (it.sep) it.sep.push(this.sourceToken);
							else it.start.push(this.sourceToken);
							return;
						case "explicit-key-ind":
							if (!it.sep && !it.explicitKey) {
								it.start.push(this.sourceToken);
								it.explicitKey = true;
							} else if (atNextItem || it.value) {
								start.push(this.sourceToken);
								map.items.push({
									start,
									explicitKey: true
								});
							} else this.stack.push({
								type: "block-map",
								offset: this.offset,
								indent: this.indent,
								items: [{
									start: [this.sourceToken],
									explicitKey: true
								}]
							});
							this.onKeyLine = true;
							return;
						case "map-value-ind":
							if (it.explicitKey) {
								if (!it.sep) {
									if (includesToken(it.start, "newline")) Object.assign(it, {
										key: null,
										sep: [this.sourceToken]
									});
									else {
										const start = getFirstKeyStartProps(it.start);
										this.stack.push({
											type: "block-map",
											offset: this.offset,
											indent: this.indent,
											items: [{
												start,
												key: null,
												sep: [this.sourceToken]
											}]
										});
									}
								} else if (it.value) map.items.push({
									start: [],
									key: null,
									sep: [this.sourceToken]
								});
								else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
									type: "block-map",
									offset: this.offset,
									indent: this.indent,
									items: [{
										start,
										key: null,
										sep: [this.sourceToken]
									}]
								});
								else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
									const start = getFirstKeyStartProps(it.start);
									const key = it.key;
									const sep = it.sep;
									sep.push(this.sourceToken);
									delete it.key;
									delete it.sep;
									this.stack.push({
										type: "block-map",
										offset: this.offset,
										indent: this.indent,
										items: [{
											start,
											key,
											sep
										}]
									});
								} else if (start.length > 0) it.sep = it.sep.concat(start, this.sourceToken);
								else it.sep.push(this.sourceToken);
							} else if (!it.sep) Object.assign(it, {
								key: null,
								sep: [this.sourceToken]
							});
							else if (it.value || atNextItem) map.items.push({
								start,
								key: null,
								sep: [this.sourceToken]
							});
							else if (includesToken(it.sep, "map-value-ind")) this.stack.push({
								type: "block-map",
								offset: this.offset,
								indent: this.indent,
								items: [{
									start: [],
									key: null,
									sep: [this.sourceToken]
								}]
							});
							else it.sep.push(this.sourceToken);
							this.onKeyLine = true;
							return;
						case "alias":
						case "scalar":
						case "single-quoted-scalar":
						case "double-quoted-scalar": {
							const fs = this.flowScalar(this.type);
							if (atNextItem || it.value) {
								map.items.push({
									start,
									key: fs,
									sep: []
								});
								this.onKeyLine = true;
							} else if (it.sep) this.stack.push(fs);
							else {
								Object.assign(it, {
									key: fs,
									sep: []
								});
								this.onKeyLine = true;
							}
							return;
						}
						default: {
							const bv = this.startBlockValue(map);
							if (bv) {
								if (bv.type === "block-seq") {
									if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
										yield* this.pop({
											type: "error",
											offset: this.offset,
											message: "Unexpected block-seq-ind on same line with key",
											source: this.source
										});
										return;
									}
								} else if (atMapIndent) map.items.push({ start });
								this.stack.push(bv);
								return;
							}
						}
					}
				}
				yield* this.pop();
				yield* this.step();
			}
			*blockSequence(seq) {
				const it = seq.items[seq.items.length - 1];
				switch (this.type) {
					case "newline":
						if (it.value) {
							const end = "end" in it.value ? it.value.end : void 0;
							if ((Array.isArray(end) ? end[end.length - 1] : void 0)?.type === "comment") end?.push(this.sourceToken);
							else seq.items.push({ start: [this.sourceToken] });
						} else it.start.push(this.sourceToken);
						return;
					case "space":
					case "comment":
						if (it.value) seq.items.push({ start: [this.sourceToken] });
						else {
							if (this.atIndentedComment(it.start, seq.indent)) {
								const end = seq.items[seq.items.length - 2]?.value?.end;
								if (Array.isArray(end)) {
									arrayPushArray(end, it.start);
									end.push(this.sourceToken);
									seq.items.pop();
									return;
								}
							}
							it.start.push(this.sourceToken);
						}
						return;
					case "anchor":
					case "tag":
						if (it.value || this.indent <= seq.indent) break;
						it.start.push(this.sourceToken);
						return;
					case "seq-item-ind":
						if (this.indent !== seq.indent) break;
						if (it.value || includesToken(it.start, "seq-item-ind")) seq.items.push({ start: [this.sourceToken] });
						else it.start.push(this.sourceToken);
						return;
				}
				if (this.indent > seq.indent) {
					const bv = this.startBlockValue(seq);
					if (bv) {
						this.stack.push(bv);
						return;
					}
				}
				yield* this.pop();
				yield* this.step();
			}
			*flowCollection(fc) {
				const it = fc.items[fc.items.length - 1];
				if (this.type === "flow-error-end") {
					let top;
					do {
						yield* this.pop();
						top = this.peek(1);
					} while (top?.type === "flow-collection");
				} else if (fc.end.length === 0) {
					switch (this.type) {
						case "comma":
						case "explicit-key-ind":
							if (!it || it.sep) fc.items.push({ start: [this.sourceToken] });
							else it.start.push(this.sourceToken);
							return;
						case "map-value-ind":
							if (!it || it.value) fc.items.push({
								start: [],
								key: null,
								sep: [this.sourceToken]
							});
							else if (it.sep) it.sep.push(this.sourceToken);
							else Object.assign(it, {
								key: null,
								sep: [this.sourceToken]
							});
							return;
						case "space":
						case "comment":
						case "newline":
						case "anchor":
						case "tag":
							if (!it || it.value) fc.items.push({ start: [this.sourceToken] });
							else if (it.sep) it.sep.push(this.sourceToken);
							else it.start.push(this.sourceToken);
							return;
						case "alias":
						case "scalar":
						case "single-quoted-scalar":
						case "double-quoted-scalar": {
							const fs = this.flowScalar(this.type);
							if (!it || it.value) fc.items.push({
								start: [],
								key: fs,
								sep: []
							});
							else if (it.sep) this.stack.push(fs);
							else Object.assign(it, {
								key: fs,
								sep: []
							});
							return;
						}
						case "flow-map-end":
						case "flow-seq-end":
							fc.end.push(this.sourceToken);
							return;
					}
					const bv = this.startBlockValue(fc);
					/* istanbul ignore else should not happen */
					if (bv) this.stack.push(bv);
					else {
						yield* this.pop();
						yield* this.step();
					}
				} else {
					const parent = this.peek(2);
					if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
						yield* this.pop();
						yield* this.step();
					} else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
						const start = getFirstKeyStartProps(getPrevProps(parent));
						fixFlowSeqItems(fc);
						const sep = fc.end.splice(1, fc.end.length);
						sep.push(this.sourceToken);
						const map = {
							type: "block-map",
							offset: fc.offset,
							indent: fc.indent,
							items: [{
								start,
								key: fc,
								sep
							}]
						};
						this.onKeyLine = true;
						this.stack[this.stack.length - 1] = map;
					} else yield* this.lineEnd(fc);
				}
			}
			flowScalar(type) {
				if (this.onNewLine) {
					let nl = this.source.indexOf("\n") + 1;
					while (nl !== 0) {
						this.onNewLine(this.offset + nl);
						nl = this.source.indexOf("\n", nl) + 1;
					}
				}
				return {
					type,
					offset: this.offset,
					indent: this.indent,
					source: this.source
				};
			}
			startBlockValue(parent) {
				switch (this.type) {
					case "alias":
					case "scalar":
					case "single-quoted-scalar":
					case "double-quoted-scalar": return this.flowScalar(this.type);
					case "block-scalar-header": return {
						type: "block-scalar",
						offset: this.offset,
						indent: this.indent,
						props: [this.sourceToken],
						source: ""
					};
					case "flow-map-start":
					case "flow-seq-start": return {
						type: "flow-collection",
						offset: this.offset,
						indent: this.indent,
						start: this.sourceToken,
						items: [],
						end: []
					};
					case "seq-item-ind": return {
						type: "block-seq",
						offset: this.offset,
						indent: this.indent,
						items: [{ start: [this.sourceToken] }]
					};
					case "explicit-key-ind": {
						this.onKeyLine = true;
						const start = getFirstKeyStartProps(getPrevProps(parent));
						start.push(this.sourceToken);
						return {
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start,
								explicitKey: true
							}]
						};
					}
					case "map-value-ind": {
						this.onKeyLine = true;
						const start = getFirstKeyStartProps(getPrevProps(parent));
						return {
							type: "block-map",
							offset: this.offset,
							indent: this.indent,
							items: [{
								start,
								key: null,
								sep: [this.sourceToken]
							}]
						};
					}
				}
				return null;
			}
			atIndentedComment(start, indent) {
				if (this.type !== "comment") return false;
				if (this.indent <= indent) return false;
				return start.every((st) => st.type === "newline" || st.type === "space");
			}
			*documentEnd(docEnd) {
				if (this.type !== "doc-mode") {
					if (docEnd.end) docEnd.end.push(this.sourceToken);
					else docEnd.end = [this.sourceToken];
					if (this.type === "newline") yield* this.pop();
				}
			}
			*lineEnd(token) {
				switch (this.type) {
					case "comma":
					case "doc-start":
					case "doc-end":
					case "flow-seq-end":
					case "flow-map-end":
					case "map-value-ind":
						yield* this.pop();
						yield* this.step();
						break;
					case "newline": this.onKeyLine = false;
					default:
						if (token.end) token.end.push(this.sourceToken);
						else token.end = [this.sourceToken];
						if (this.type === "newline") yield* this.pop();
				}
			}
		};
		//#endregion
		//#region node_modules/.pnpm/yaml@2.9.0/node_modules/yaml/browser/dist/public-api.js
		function parseOptions(options) {
			const prettyErrors = options.prettyErrors !== false;
			return {
				lineCounter: options.lineCounter || prettyErrors && new LineCounter() || null,
				prettyErrors
			};
		}
		/** Parse an input string into a single YAML.Document */
		function parseDocument(source, options = {}) {
			const { lineCounter, prettyErrors } = parseOptions(options);
			const parser = new Parser(lineCounter?.addNewLine);
			const composer = new Composer(options);
			let doc = null;
			for (const _doc of composer.compose(parser.parse(source), true, source.length)) if (!doc) doc = _doc;
			else if (doc.options.logLevel !== "silent") {
				doc.errors.push(new YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
				break;
			}
			if (prettyErrors && lineCounter) {
				doc.errors.forEach(prettifyError(source, lineCounter));
				doc.warnings.forEach(prettifyError(source, lineCounter));
			}
			return doc;
		}
		//#endregion
		//#region \0dsh-css:/Users/winter/dsh-creative/plugins/dsh-antfarm/src/client/RunsPanel.module.css.mjs
		const css = ".EucCCW_root{min-width:0;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);align-content:start;gap:12px;padding:16px;display:grid}.EucCCW_header{justify-content:space-between;align-items:center;gap:12px;display:flex}.EucCCW_heading{min-width:0}.EucCCW_heading h2,.EucCCW_heading p,.EucCCW_project,.EucCCW_details p,.EucCCW_empty p{margin:0}.EucCCW_heading h2,.EucCCW_details h3{font-size:inherit;font-weight:500}.EucCCW_heading p,.EucCCW_project,.EucCCW_secondary{color:var(--dsw-alias-label-secondary)}.EucCCW_project,.EucCCW_reason,.EucCCW_runId,.EucCCW_details dd{overflow-wrap:anywhere}.EucCCW_project{border-bottom:.5px solid var(--dsw-alias-border-l3);padding-bottom:8px}.EucCCW_run{min-width:0}.EucCCW_runHeader{min-height:32px}.EucCCW_runContent{flex:1;min-width:0}.EucCCW_runLabels{justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.EucCCW_runTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.EucCCW_status{color:var(--dsw-alias-label-secondary);flex:none;align-items:center;gap:4px;display:flex}.EucCCW_details{gap:12px;min-width:0;padding:12px 0;display:grid}.EucCCW_runId{color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-mono)}.EucCCW_details dl{grid-template-columns:auto minmax(0,1fr);gap:6px 12px;margin:0;display:grid}.EucCCW_details dt{color:var(--dsw-alias-label-secondary)}.EucCCW_details dd{margin:0}.EucCCW_details h3{margin:0 0 8px}.EucCCW_stories,.EucCCW_children{min-width:0}.EucCCW_story{border-top:.5px solid var(--dsw-alias-border-l3);grid-template-columns:minmax(0,1fr) auto;gap:6px 8px;padding:8px 0;display:grid}.EucCCW_story p{white-space:pre-wrap;grid-column:1/-1}.EucCCW_reason{white-space:pre-wrap}.EucCCW_children{gap:6px;display:grid}.EucCCW_form{gap:8px;min-width:0;display:grid}.EucCCW_form label{color:var(--dsw-alias-label-secondary);gap:6px;display:grid}.EucCCW_root input,.EucCCW_root select,.EucCCW_root textarea,.EucCCW_board input,.EucCCW_board select,.EucCCW_board textarea{box-sizing:border-box;width:100%;min-width:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-l2);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);font:inherit;padding:8px}.EucCCW_root textarea,.EucCCW_board textarea{resize:vertical;min-height:80px}.EucCCW_root .EucCCW_editor,.EucCCW_board .EucCCW_editor{min-height:240px;font-family:var(--dsw-font-mono)}.EucCCW_actions,.EucCCW_filters{flex-wrap:wrap;gap:8px;display:flex}.EucCCW_filters input{flex:1}.EucCCW_filters select{width:auto;max-width:100%}.EucCCW_output{white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--dsw-font-mono);max-height:320px;margin:8px 0;overflow:auto}.EucCCW_events{margin:8px 0;padding-left:20px}.EucCCW_board{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);align-content:start;gap:16px;padding:24px;display:grid;overflow:auto}.EucCCW_board h1,.EucCCW_board h2,.EucCCW_team h3{font-size:inherit;margin:0;font-weight:500}.EucCCW_launch,.EucCCW_team{gap:12px;min-width:0;display:grid}.EucCCW_launch{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);padding:16px}.EucCCW_launch p,.EucCCW_team p{margin:0}.EucCCW_agents{grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));align-items:start;gap:8px;display:grid}.EucCCW_agent{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);min-width:0;padding:12px}.EucCCW_agent summary{cursor:pointer}.EucCCW_agent summary span+span{overflow-wrap:anywhere;margin-top:4px;display:block}.EucCCW_agent>div{margin-top:12px}.EucCCW_board .EucCCW_header select{width:auto;max-width:60%}.EucCCW_columns{grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:16px;display:grid}.EucCCW_column{align-content:start;gap:12px;min-width:0;display:grid}.EucCCW_card{text-align:start;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-l2);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);font:inherit;overflow-wrap:anywhere;cursor:pointer;gap:8px;padding:12px;display:grid}.EucCCW_card[aria-expanded=true]{border-color:var(--dsw-alias-label-link)}[data-platform=darwin] .EucCCW_board{padding-top:calc(var(--dsh-frame-top-clearance,0px) + 24px)}.EucCCW_form .EucCCW_notice{display:grid}.EucCCW_details details{min-width:0}.EucCCW_root :focus-visible,.EucCCW_board :focus-visible{outline:2px solid var(--dsw-alias-label-link);outline-offset:2px}.EucCCW_child{text-overflow:ellipsis;justify-content:flex-start;min-width:0;overflow:hidden}.EucCCW_notice{color:var(--dsw-alias-label-secondary);justify-content:space-between;align-items:center;gap:8px;display:flex}.EucCCW_empty{color:var(--dsw-alias-label-secondary);gap:8px;padding:24px 0;display:grid}.EucCCW_pending{justify-content:center;padding:16px;display:flex}.EucCCW_skeleton{gap:16px;padding:12px 0;display:grid}.EucCCW_skeleton span{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-skeleton);height:12px;animation:2s cubic-bezier(.36,0,.64,1) infinite EucCCW_antfarm-skeleton}.EucCCW_skeleton span:last-child{width:60%}@keyframes EucCCW_antfarm-skeleton{0%,80%,to{opacity:1}40%{opacity:.6}}@media (prefers-reduced-motion:reduce){.EucCCW_skeleton span{animation:none}}.EucCCW_artifactImage{object-fit:contain;border-radius:var(--dsh-radius-md);width:100%;height:auto}";
		const tagId = "@winterhuan/dsh-antfarm/RunsPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@winterhuan/dsh-antfarm";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var RunsPanel_module_css_default = {
			"actions": "EucCCW_actions",
			"agent": "EucCCW_agent",
			"agents": "EucCCW_agents",
			"antfarm-skeleton": "EucCCW_antfarm-skeleton",
			"artifactImage": "EucCCW_artifactImage",
			"board": "EucCCW_board",
			"card": "EucCCW_card",
			"child": "EucCCW_child",
			"children": "EucCCW_children",
			"column": "EucCCW_column",
			"columns": "EucCCW_columns",
			"details": "EucCCW_details",
			"editor": "EucCCW_editor",
			"empty": "EucCCW_empty",
			"events": "EucCCW_events",
			"filters": "EucCCW_filters",
			"form": "EucCCW_form",
			"header": "EucCCW_header",
			"heading": "EucCCW_heading",
			"launch": "EucCCW_launch",
			"notice": "EucCCW_notice",
			"output": "EucCCW_output",
			"pending": "EucCCW_pending",
			"project": "EucCCW_project",
			"reason": "EucCCW_reason",
			"root": "EucCCW_root",
			"run": "EucCCW_run",
			"runContent": "EucCCW_runContent",
			"runHeader": "EucCCW_runHeader",
			"runId": "EucCCW_runId",
			"runLabels": "EucCCW_runLabels",
			"runTitle": "EucCCW_runTitle",
			"secondary": "EucCCW_secondary",
			"skeleton": "EucCCW_skeleton",
			"status": "EucCCW_status",
			"stories": "EucCCW_stories",
			"story": "EucCCW_story",
			"team": "EucCCW_team"
		};
		//#endregion
		//#region lib/types/client/TeamPanel.js
		/** Agent settings edit the same revision-bound document and persona resources as the source editor. */
		function Persona({ files, draft, pending, change, t }) {
			const [selected, setSelected] = (0, react.useState)("AGENTS.md");
			const file = files.find((file) => file.name === selected) ?? files[0];
			if (file === void 0) return null;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("label", { children: [t("personaFile"), (0, react_jsx_runtime.jsx)("select", {
				value: file.name,
				disabled: pending,
				onChange: (event) => {
					setSelected(event.target.value);
				},
				children: files.map((file) => (0, react_jsx_runtime.jsx)("option", {
					value: file.name,
					children: file.name
				}, file.name))
			})] }), (0, react_jsx_runtime.jsxs)("label", { children: [t("persona"), (0, react_jsx_runtime.jsx)("textarea", {
				className: RunsPanel_module_css_default.editor,
				value: draft.files[file.path] ?? "",
				disabled: pending,
				onChange: (event) => {
					change({
						...draft,
						files: {
							...draft.files,
							[file.path]: event.target.value
						}
					});
				}
			})] })] });
		}
		/** @param props - Current source draft and a gesture-owned update. @returns Team overview and common Agent settings. */
		function TeamPanel({ draft, pending, change, t }) {
			const document = (0, react.useMemo)(() => parseDocument(draft.document), [draft.document]);
			const agents = document.get("agents", true);
			if (document.errors.length > 0 || !isSeq(agents) || agents.items.some((agent) => !isMap(agent))) return (0, react_jsx_runtime.jsx)("p", {
				role: "status",
				children: t("invalidTeamSource")
			});
			const text = (path) => {
				const value = document.getIn(path);
				return typeof value === "string" ? value : "";
			};
			const update = (index, key, value) => {
				const next = parseDocument(draft.document);
				const path = [
					"agents",
					index,
					key
				];
				if (value === void 0 || value === "") next.deleteIn(path);
				else next.setIn(path, value);
				change({
					...draft,
					document: next.toString()
				});
			};
			const steps = document.get("steps", true);
			return (0, react_jsx_runtime.jsxs)("section", {
				className: RunsPanel_module_css_default.team,
				children: [
					(0, react_jsx_runtime.jsx)("h3", { children: text(["name"]) || draft.id }),
					text(["description"]) !== "" && (0, react_jsx_runtime.jsx)("p", {
						className: RunsPanel_module_css_default.secondary,
						children: text(["description"])
					}),
					isSeq(steps) && (0, react_jsx_runtime.jsxs)("p", {
						className: RunsPanel_module_css_default.secondary,
						children: [
							t("steps"),
							": ",
							steps.items.map((_step, index) => text([
								"steps",
								index,
								"id"
							])).join(" → ")
						]
					}),
					(0, react_jsx_runtime.jsx)("h3", { children: t("agents", { count: agents.items.length }) }),
					(0, react_jsx_runtime.jsx)("p", {
						className: RunsPanel_module_css_default.secondary,
						children: t("teamHelp")
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: RunsPanel_module_css_default.agents,
						children: agents.items.map((_agent, index) => {
							const id = text([
								"agents",
								index,
								"id"
							]);
							const role = text([
								"agents",
								index,
								"role"
							]);
							const model = text([
								"agents",
								index,
								"model"
							]);
							const fallback = text(["polling", "model"]);
							const files = document.getIn([
								"agents",
								index,
								"workspace",
								"files"
							], true);
							const resources = isMap(files) ? files.items.flatMap((pair) => {
								const name = isScalar(pair.key) ? pair.key.value : void 0;
								const path = isScalar(pair.value) ? pair.value.value : void 0;
								return typeof name === "string" && typeof path === "string" && Object.hasOwn(draft.files, path) ? [{
									name,
									path
								}] : [];
							}) : [];
							const timeout = document.getIn([
								"agents",
								index,
								"timeoutSeconds"
							]);
							return (0, react_jsx_runtime.jsxs)("details", {
								className: RunsPanel_module_css_default.agent,
								children: [(0, react_jsx_runtime.jsxs)("summary", { children: [(0, react_jsx_runtime.jsx)("span", { children: text([
									"agents",
									index,
									"name"
								]) || id }), (0, react_jsx_runtime.jsxs)("span", {
									className: RunsPanel_module_css_default.secondary,
									children: [
										role,
										" · ",
										(model || fallback) !== "default" && (model || fallback) !== "" ? model || fallback : t("defaultModel")
									]
								})] }), (0, react_jsx_runtime.jsxs)("div", {
									className: RunsPanel_module_css_default.form,
									children: [
										(0, react_jsx_runtime.jsxs)("code", {
											className: RunsPanel_module_css_default.secondary,
											children: [
												draft.id,
												"/",
												id
											]
										}),
										text([
											"agents",
											index,
											"description"
										]) !== "" && (0, react_jsx_runtime.jsx)("p", { children: text([
											"agents",
											index,
											"description"
										]) }),
										(0, react_jsx_runtime.jsxs)("label", { children: [t("agentName"), (0, react_jsx_runtime.jsx)("input", {
											value: text([
												"agents",
												index,
												"name"
											]),
											placeholder: id,
											disabled: pending,
											onChange: (event) => {
												update(index, "name", event.target.value);
											}
										})] }),
										(0, react_jsx_runtime.jsxs)("label", { children: [t("agentModel"), (0, react_jsx_runtime.jsx)("input", {
											value: model,
											placeholder: fallback && fallback !== "default" ? fallback : t("defaultModel"),
											disabled: pending,
											onChange: (event) => {
												update(index, "model", event.target.value);
											}
										})] }),
										(0, react_jsx_runtime.jsx)("p", {
											className: RunsPanel_module_css_default.secondary,
											children: t("modelHelp")
										}),
										(0, react_jsx_runtime.jsxs)("label", { children: [t("agentTimeout"), (0, react_jsx_runtime.jsx)("input", {
											type: "number",
											min: 1,
											max: 2147483,
											step: 1,
											value: typeof timeout === "number" ? timeout : "",
											disabled: pending,
											placeholder: t("defaultTimeout"),
											onChange: (event) => {
												update(index, "timeoutSeconds", event.target.value === "" ? void 0 : Number(event.target.value));
											}
										})] }),
										(0, react_jsx_runtime.jsx)(Persona, {
											files: resources,
											draft,
											pending,
											change,
											t
										})
									]
								})]
							}, id);
						})
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/WorkflowPanel.js
		/** Workflow selection, idempotent launch and revision-bound source editing. */
		/** @param props - Session-scoped operations and localized copy. @returns Launch and configuration forms. */
		function WorkflowPanel({ owner, visible, operations, launched, t }) {
			const initial = operations.readDraft(owner);
			const [catalog, setCatalog] = (0, react.useState)({
				owner,
				ids: []
			});
			const [selected, setSelected] = (0, react.useState)({
				owner,
				id: initial?.id ?? ""
			});
			const [source, setSource] = (0, react.useState)(initial?.source ?? null);
			const [draft, setDraft] = (0, react.useState)(initial?.draft ?? null);
			const [latest, setLatest] = (0, react.useState)(null);
			const [newId, setNewId] = (0, react.useState)("");
			const [file, setFile] = (0, react.useState)(initial?.file ?? "workflow.yml");
			const [task, setTask] = (0, react.useState)(initial?.task ?? "");
			const [scope, setScope] = (0, react.useState)(initial?.scope ?? "project");
			const [pending, setPending] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)("");
			const [reload, setReload] = (0, react.useState)(0);
			const [editor, setEditor] = (0, react.useState)(initial?.editor ?? false);
			const [discard, setDiscard] = (0, react.useState)(false);
			const [request, setRequest] = (0, react.useState)(initial?.request ?? null);
			const ids = catalog.owner === owner ? catalog.ids : [];
			const id = selected.owner === owner && selected.id !== "" ? selected.id : ids.includes("feature-dev") ? "feature-dev" : ids[0] ?? "";
			const dirty = draft !== null && source !== null && (draft.document !== source.document || JSON.stringify(draft.files) !== JSON.stringify(source.files));
			(0, react.useEffect)(() => {
				if (!visible) return;
				const abort = new AbortController();
				operations.workflows(owner, abort.signal).then((ids) => {
					if (!abort.signal.aborted) setCatalog({
						owner,
						ids
					});
				}).catch(() => {
					if (!abort.signal.aborted) setError(t("catalogError"));
				});
				return () => {
					abort.abort();
				};
			}, [
				owner,
				visible,
				operations,
				reload,
				t
			]);
			(0, react.useEffect)(() => {
				if (!visible || id === "") return;
				const abort = new AbortController();
				operations.workflow(id, owner, abort.signal).then((value) => {
					if (abort.signal.aborted) return;
					const retained = operations.readDraft(owner);
					const edited = retained?.source !== null && retained?.source !== void 0 && retained.draft !== null && (retained.source.document !== retained.draft.document || JSON.stringify(retained.source.files) !== JSON.stringify(retained.draft.files));
					setLatest(value);
					if (edited && retained.id === id) {
						if (retained.source?.revision !== value.revision) setError(t("staleDraft"));
						return;
					}
					setSource(value);
					setDraft(value);
					setFile("workflow.yml");
					setError("");
					operations.rememberDraft(owner, {
						id,
						source: value,
						draft: value,
						file: "workflow.yml"
					});
				}).catch(() => {
					if (!abort.signal.aborted) setError(t("workflowError"));
				});
				return () => {
					abort.abort();
				};
			}, [
				id,
				owner,
				visible,
				operations,
				reload,
				t
			]);
			const start = async () => {
				if (pending || task.trim() === "" || id === "" || source?.id !== id) return;
				setPending(true);
				setError("");
				const stable = request?.task === task && request.workflowId === id && request.owner === owner ? request : {
					task,
					workflowId: id,
					owner,
					id: crypto.randomUUID()
				};
				setRequest(stable);
				operations.rememberDraft(owner, { request: stable });
				try {
					const row = await operations.start({
						sessionId: owner,
						requestId: stable.id,
						workflowId: id,
						task
					});
					operations.report(true);
					setTask("");
					operations.rememberDraft(owner, {
						task: "",
						request: null
					});
					setRequest(null);
					launched(row.runId);
				} catch (error) {
					operations.report(false);
					setError(error instanceof Error ? error.message : t("operationError"));
				} finally {
					setPending(false);
				}
			};
			const save = async () => {
				if (draft === null || pending) return;
				setPending(true);
				setError("");
				try {
					const value = await operations.save(draft, scope, owner);
					setSource(value);
					setDraft(value);
					setLatest(value);
					operations.rememberDraft(owner, {
						source: value,
						draft: value
					});
					operations.report(true);
				} catch (error) {
					operations.report(false);
					setError(error instanceof Error ? error.message : t("operationError"));
				} finally {
					setPending(false);
				}
			};
			const remove = async () => {
				if (source === null || dirty || pending) return;
				setPending(true);
				setError("");
				try {
					await operations.remove(source, scope, owner);
					operations.rememberDraft(owner, {
						source: null,
						draft: null
					});
					setReload((value) => value + 1);
					operations.report(true);
				} catch (error) {
					operations.report(false);
					setError(error instanceof Error ? error.message : t("operationError"));
				} finally {
					setPending(false);
				}
			};
			const copy = async () => {
				if (draft === null || pending) return;
				setPending(true);
				setError("");
				try {
					const value = await operations.copy(draft, newId, owner);
					setSelected({
						owner,
						id: value.id
					});
					setSource(value);
					setDraft(value);
					operations.rememberDraft(owner, {
						id: value.id,
						source: value,
						draft: value
					});
					setReload((value) => value + 1);
					operations.report(true);
				} catch (error) {
					operations.report(false);
					setError(error instanceof Error ? error.message : t("operationError"));
				} finally {
					setPending(false);
				}
			};
			const toggle = async () => {
				if (source === null || pending) return;
				setPending(true);
				try {
					await operations.setEnabled(source, source.enabled === false, owner);
					setReload((value) => value + 1);
					operations.report(true);
				} catch (error) {
					operations.report(false);
					setError(error instanceof Error ? error.message : t("operationError"));
				} finally {
					setPending(false);
				}
			};
			return (0, react_jsx_runtime.jsxs)("section", {
				className: RunsPanel_module_css_default.form,
				"aria-busy": pending,
				children: [
					(0, react_jsx_runtime.jsxs)("label", { children: [t("workflow"), (0, react_jsx_runtime.jsxs)("select", {
						value: id,
						disabled: pending || dirty,
						onChange: (event) => {
							setSelected({
								owner,
								id: event.target.value
							});
							setSource(null);
							setDraft(null);
							operations.rememberDraft(owner, {
								id: event.target.value,
								source: null,
								draft: null
							});
						},
						children: [(0, react_jsx_runtime.jsx)("option", {
							value: "",
							children: t("chooseWorkflow")
						}), ids.map((id) => (0, react_jsx_runtime.jsx)("option", {
							value: id,
							children: id
						}, id))]
					})] }),
					draft?.id === id && (0, react_jsx_runtime.jsx)(TeamPanel, {
						draft,
						pending,
						t,
						change: (next) => {
							setDraft(next);
							operations.rememberDraft(owner, { draft: next });
						}
					}),
					(0, react_jsx_runtime.jsxs)("label", { children: [t("task"), (0, react_jsx_runtime.jsx)("textarea", {
						value: task,
						maxLength: 65536,
						disabled: pending,
						onChange: (event) => {
							setTask(event.target.value);
							operations.rememberDraft(owner, { task: event.target.value });
						}
					})] }),
					(0, react_jsx_runtime.jsx)("p", {
						className: RunsPanel_module_css_default.secondary,
						children: t("launchHelp")
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: RunsPanel_module_css_default.actions,
						children: [
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								disabled: pending || id === "" || source?.id !== id || source.enabled === false || task.trim() === "" || dirty,
								onClick: () => {
									start();
								},
								children: t("startRun")
							}),
							dirty && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								disabled: pending,
								onClick: () => {
									save();
								},
								children: t("save")
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								disabled: id === "" || draft === null,
								onClick: () => {
									setEditor(!editor);
									operations.rememberDraft(owner, { editor: !editor });
								},
								children: t("advancedConfig")
							})
						]
					}),
					dirty && (0, react_jsx_runtime.jsx)("p", {
						className: RunsPanel_module_css_default.secondary,
						children: t("unsavedDraft")
					}),
					error !== "" && (0, react_jsx_runtime.jsxs)("div", {
						className: RunsPanel_module_css_default.notice,
						role: "status",
						children: [(0, react_jsx_runtime.jsx)("p", { children: error }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: pending,
							onClick: () => {
								setReload((value) => value + 1);
							},
							children: t("retry")
						})]
					}),
					editor && draft?.id === id && (0, react_jsx_runtime.jsxs)("section", {
						className: RunsPanel_module_css_default.form,
						children: [
							(0, react_jsx_runtime.jsxs)("p", {
								className: RunsPanel_module_css_default.secondary,
								children: [
									t("source"),
									": ",
									(0, react_jsx_runtime.jsx)("code", { children: source?.sourceDirectory })
								]
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: RunsPanel_module_css_default.secondary,
								children: t("editHelp")
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								disabled: pending || dirty,
								onClick: () => {
									toggle();
								},
								children: t(source?.enabled === false ? "installWorkflow" : "uninstallWorkflow")
							}),
							(0, react_jsx_runtime.jsxs)("label", { children: [t("saveScope"), (0, react_jsx_runtime.jsxs)("select", {
								value: scope,
								disabled: pending || dirty,
								onChange: (event) => {
									const next = event.target.value === "profile" ? "profile" : "project";
									setScope(next);
									operations.rememberDraft(owner, { scope: next });
								},
								children: [(0, react_jsx_runtime.jsx)("option", {
									value: "project",
									children: t("projectScope")
								}), (0, react_jsx_runtime.jsx)("option", {
									value: "profile",
									children: t("profileScope")
								})]
							})] }),
							(0, react_jsx_runtime.jsxs)("label", { children: [t("resource"), (0, react_jsx_runtime.jsxs)("select", {
								value: file,
								onChange: (event) => {
									setFile(event.target.value);
									operations.rememberDraft(owner, { file: event.target.value });
								},
								children: [(0, react_jsx_runtime.jsx)("option", {
									value: "workflow.yml",
									children: "workflow.yml"
								}), Object.keys(draft.files).map((path) => (0, react_jsx_runtime.jsx)("option", {
									value: path,
									children: path
								}, path))]
							})] }),
							(0, react_jsx_runtime.jsx)("textarea", {
								className: RunsPanel_module_css_default.editor,
								"aria-label": t("workflowSource"),
								value: file === "workflow.yml" ? draft.document : draft.files[file] ?? "",
								disabled: pending,
								onChange: (event) => {
									const next = file === "workflow.yml" ? {
										...draft,
										document: event.target.value
									} : {
										...draft,
										files: {
											...draft.files,
											[file]: event.target.value
										}
									};
									setDraft(next);
									operations.rememberDraft(owner, { draft: next });
								}
							}),
							latest !== null && latest.revision !== source?.revision && (0, react_jsx_runtime.jsxs)("details", { children: [(0, react_jsx_runtime.jsx)("summary", { children: t("compareSource") }), (0, react_jsx_runtime.jsx)("pre", {
								className: RunsPanel_module_css_default.output,
								children: file === "workflow.yml" ? latest.document : latest.files[file] ?? ""
							})] }),
							(0, react_jsx_runtime.jsxs)("div", {
								className: RunsPanel_module_css_default.actions,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									disabled: pending,
									onClick: () => {
										if (dirty) setDiscard(true);
										else setReload((value) => value + 1);
									},
									children: t("reload")
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									disabled: pending || dirty,
									onClick: () => {
										setDiscard(true);
									},
									children: t("restoreInherited")
								})]
							}),
							(0, react_jsx_runtime.jsxs)("label", { children: [t("newWorkflowId"), (0, react_jsx_runtime.jsx)("input", {
								value: newId,
								disabled: pending,
								onChange: (event) => {
									setNewId(event.target.value);
								}
							})] }),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								disabled: pending || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newId),
								onClick: () => {
									copy();
								},
								children: t("copyWorkflow")
							}),
							discard && (0, react_jsx_runtime.jsxs)("div", {
								className: RunsPanel_module_css_default.notice,
								children: [(0, react_jsx_runtime.jsx)("p", { children: t(dirty ? "discardHelp" : "removeHelp") }), (0, react_jsx_runtime.jsxs)("div", {
									className: RunsPanel_module_css_default.actions,
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "sm",
										onClick: () => {
											setDiscard(false);
										},
										children: t("keepEditing")
									}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "sm",
										disabled: pending,
										onClick: () => {
											setDiscard(false);
											if (dirty) {
												setDraft(source);
												operations.rememberDraft(owner, { draft: source });
												setReload((value) => value + 1);
											} else remove();
										},
										children: t(dirty ? "discard" : "removeOverride")
									})]
								})]
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/RunControls.js
		/** State-specific actions preserve reconciliation guidance until acceptance. */
		/** @param props - Durable state, revision-bound operations and localized copy. @returns Valid lifecycle actions. */
		function RunControls({ owner, detail, operations, refresh, t }) {
			const [pending, setPending] = (0, react.useState)(false);
			const [guidance, setGuidance] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)("");
			const row = detail.summary;
			const resume = [
				"blocked",
				"interrupted",
				"failed"
			].includes(row.status) && row.workspaceDisposition !== "cleaned";
			const cancel = [
				"queued",
				"starting",
				"running",
				"blocked",
				"interrupted"
			].includes(row.status);
			const control = async (action) => {
				if (pending || row.revision === void 0) return;
				setPending(true);
				setError("");
				try {
					await operations.control({
						action,
						sessionId: owner,
						runId: row.runId,
						revision: row.revision,
						...action !== "resume" ? {} : { guidance }
					});
					setGuidance("");
					operations.report(true);
					refresh();
				} catch (error) {
					operations.report(false);
					setError(error instanceof Error ? error.message : t("operationError"));
					refresh();
				} finally {
					setPending(false);
				}
			};
			return (0, react_jsx_runtime.jsxs)("section", {
				className: RunsPanel_module_css_default.form,
				"aria-busy": pending,
				children: [
					resume && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("label", { children: [t("guidance"), (0, react_jsx_runtime.jsx)("textarea", {
						value: guidance,
						disabled: pending,
						onChange: (event) => {
							setGuidance(event.target.value);
						}
					})] }), (0, react_jsx_runtime.jsx)("p", {
						className: RunsPanel_module_css_default.secondary,
						children: t("resumeHelp")
					})] }),
					(0, react_jsx_runtime.jsxs)("div", {
						className: RunsPanel_module_css_default.actions,
						children: [resume && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: pending || row.revision === void 0 || detail.uncertain && guidance.trim() === "",
							onClick: () => {
								control("resume");
							},
							children: t("resumeRun")
						}), cancel && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: pending || row.revision === void 0,
							onClick: () => {
								control("cancel");
							},
							children: t("cancelRun")
						})]
					}),
					error !== "" && (0, react_jsx_runtime.jsx)("p", {
						className: RunsPanel_module_css_default.notice,
						role: "status",
						children: error
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/HealthPanel.js
		/** Manual diagnostics and safe redispatch share the existing Run executor. */
		/** @param props - Authorized owner, native operations and locale. @returns Health disclosure. */
		function HealthPanel({ owner, operations, refresh, t }) {
			const [report, setReport] = (0, react.useState)(null);
			const [pending, setPending] = (0, react.useState)(false);
			const [history, setHistory] = (0, react.useState)(null);
			const [open, setOpen] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!open) return;
				let current = true;
				operations.healthHistory(owner).then((value) => {
					if (current) setHistory(value);
				}).catch(() => {
					if (current) operations.report(false);
				});
				return () => {
					current = false;
				};
			}, [
				open,
				owner,
				operations,
				report
			]);
			const check = async (repair) => {
				if (pending) return;
				setPending(true);
				try {
					if (repair) await operations.ensureExecution(owner);
					setReport(await operations.health(owner));
					refresh();
					operations.report(true);
				} catch {
					operations.report(false);
				} finally {
					setPending(false);
				}
			};
			return (0, react_jsx_runtime.jsxs)("details", {
				onToggle: (event) => {
					setOpen(event.currentTarget.open);
				},
				children: [(0, react_jsx_runtime.jsx)("summary", { children: t("health") }), (0, react_jsx_runtime.jsxs)("section", {
					className: RunsPanel_module_css_default.form,
					"aria-busy": pending,
					children: [
						(0, react_jsx_runtime.jsx)("p", {
							className: RunsPanel_module_css_default.secondary,
							children: t("healthHelp")
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: RunsPanel_module_css_default.actions,
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								disabled: pending,
								onClick: () => {
									check(false);
								},
								children: t("checkHealth")
							}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								disabled: pending,
								onClick: () => {
									check(true);
								},
								children: t("ensureExecution")
							})]
						}),
						report !== null && (0, react_jsx_runtime.jsx)("pre", {
							className: RunsPanel_module_css_default.output,
							children: JSON.stringify(report, null, 2)
						}),
						history !== null && (0, react_jsx_runtime.jsxs)("details", { children: [(0, react_jsx_runtime.jsx)("summary", { children: t("healthHistory") }), (0, react_jsx_runtime.jsx)("pre", {
							className: RunsPanel_module_css_default.output,
							children: JSON.stringify(history, null, 2)
						})] })
					]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/RunsPanel.js
		/** Run controls, accepted evidence and native child-session navigation. */
		function runDot(status) {
			if (status === "starting" || status === "running") return "ongoing";
			if (status === "completed") return "done";
			if (status === "failed" || status === "corrupt") return "error";
			if (status === "blocked" || status === "interrupted" || status === "legacy") return "warning";
			return "idle";
		}
		function Skeleton() {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: RunsPanel_module_css_default.skeleton,
				"aria-hidden": true,
				children: [
					(0, react_jsx_runtime.jsx)("span", {}),
					(0, react_jsx_runtime.jsx)("span", {}),
					(0, react_jsx_runtime.jsx)("span", {})
				]
			});
		}
		/**
		* Render the Session's run list and its selected durable details.
		* @param props - run queries, selected Session workspace, localized copy and child navigation.
		* @returns retained run content with retryable query notices.
		*/
		function RunsPanel({ state, workspace, openChild, owner, visible = true, operations, showLaunch = true, t }) {
			const [search, setSearch] = (0, react.useState)("");
			const [filter, setFilter] = (0, react.useState)("");
			const [events, setEvents] = (0, react.useState)(null);
			const rows = state.rows.filter((row) => (filter === "" || row.status === filter) && `${row.task ?? ""} ${row.runId} ${row.number ?? ""}`.toLowerCase().includes(search.toLowerCase()));
			const loadEvents = async (runId) => {
				if (operations === void 0 || owner === void 0) return;
				const previous = events?.runId === runId ? events.values : [];
				try {
					const page = await operations.events(runId, owner, previous.at(-1)?.seq ?? -1);
					setEvents({
						runId,
						values: [...previous, ...page]
					});
				} catch {
					operations.report(false);
				}
			};
			return (0, react_jsx_runtime.jsxs)("section", {
				className: RunsPanel_module_css_default.root,
				"data-antfarm-runs": true,
				"aria-busy": state.loading || state.detailLoading,
				children: [
					(0, react_jsx_runtime.jsxs)("header", {
						className: RunsPanel_module_css_default.header,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: RunsPanel_module_css_default.heading,
							children: [(0, react_jsx_runtime.jsx)("h2", { children: t("title") }), (0, react_jsx_runtime.jsx)("p", { children: t("description") })]
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							onClick: state.refresh,
							disabled: state.loading,
							children: t("refresh")
						})]
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: RunsPanel_module_css_default.project,
						children: workspace ?? t("noWorkspace")
					}),
					showLaunch && operations !== void 0 && owner !== void 0 && (0, react_jsx_runtime.jsx)(WorkflowPanel, {
						owner,
						visible,
						operations,
						t,
						launched: (runId) => {
							state.select(runId);
							state.refresh();
						}
					}, owner),
					operations !== void 0 && owner !== void 0 && (0, react_jsx_runtime.jsx)(HealthPanel, {
						owner,
						operations,
						refresh: state.refresh,
						t
					}, `health:${owner}`),
					(0, react_jsx_runtime.jsxs)("div", {
						className: RunsPanel_module_css_default.filters,
						children: [(0, react_jsx_runtime.jsx)("input", {
							"aria-label": t("search"),
							placeholder: t("search"),
							value: search,
							onChange: (event) => {
								setSearch(event.target.value);
							}
						}), (0, react_jsx_runtime.jsxs)("select", {
							"aria-label": t("allStates"),
							value: filter,
							onChange: (event) => {
								setFilter(event.target.value);
							},
							children: [(0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t("allStates")
							}), [
								"queued",
								"running",
								"blocked",
								"interrupted",
								"completed",
								"failed",
								"cancelled"
							].map((status) => (0, react_jsx_runtime.jsx)("option", {
								value: status,
								children: t(status)
							}, status))]
						})]
					}),
					state.failed && (0, react_jsx_runtime.jsxs)("div", {
						className: RunsPanel_module_css_default.notice,
						role: "status",
						children: [(0, react_jsx_runtime.jsx)("span", { children: t("loadError") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							onClick: state.refresh,
							children: t("retry")
						})]
					}),
					state.loading && state.rows.length === 0 ? (0, react_jsx_runtime.jsx)(Skeleton, {}) : state.rows.length === 0 && !state.failed ? (0, react_jsx_runtime.jsxs)("div", {
						className: RunsPanel_module_css_default.empty,
						children: [(0, react_jsx_runtime.jsx)("p", { children: t("empty") }), (0, react_jsx_runtime.jsx)("p", { children: t("emptyHelp") })]
					}) : rows.map((row) => {
						const open = state.selectedRunId === row.runId;
						const detail = open ? state.detail : null;
						return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
							className: RunsPanel_module_css_default.run,
							rowClassName: RunsPanel_module_css_default.runHeader,
							contentClassName: RunsPanel_module_css_default.runContent,
							contentLayoutClassName: RunsPanel_module_css_default.runLabels,
							titleClassName: RunsPanel_module_css_default.runTitle,
							icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutlineRegular, {}),
							title: row.task ?? row.workflowId,
							open,
							expandable: true,
							expandOnRowClick: true,
							keepContentWhenOpen: true,
							onToggle: () => {
								state.select(open ? null : row.runId);
							},
							collapsedContent: (0, react_jsx_runtime.jsxs)("span", {
								className: RunsPanel_module_css_default.status,
								"data-status": row.status,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: runDot(row.status) }), (0, react_jsx_runtime.jsx)("span", { children: t(row.status) })]
							}),
							children: (0, react_jsx_runtime.jsxs)("div", {
								className: RunsPanel_module_css_default.details,
								children: [
									(0, react_jsx_runtime.jsx)("code", {
										className: RunsPanel_module_css_default.runId,
										children: row.runId
									}),
									(0, react_jsx_runtime.jsxs)("p", {
										className: RunsPanel_module_css_default.secondary,
										children: [row.number === void 0 ? "" : `#${row.number} · `, row.workflowId]
									}),
									row.totalStories !== void 0 && row.totalStories > 0 && (0, react_jsx_runtime.jsx)("p", { children: t("acceptedProgress", {
										done: row.acceptedStories ?? 0,
										total: row.totalStories
									}) }),
									(0, react_jsx_runtime.jsxs)("dl", { children: [
										(0, react_jsx_runtime.jsx)("dt", { children: t("branch") }),
										(0, react_jsx_runtime.jsx)("dd", { children: row.branch }),
										(0, react_jsx_runtime.jsx)("dt", { children: t("workspace") }),
										(0, react_jsx_runtime.jsx)("dd", { children: row.workspace }),
										row.currentStep !== void 0 && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("step") }), (0, react_jsx_runtime.jsx)("dd", { children: row.currentStep })] })
									] }),
									row.workspaceDisposition !== "present" && (0, react_jsx_runtime.jsx)("p", { children: t(row.workspaceDisposition === "cleaned" ? "cleaned" : "retained") }),
									row.workspaceReason !== void 0 && (0, react_jsx_runtime.jsx)("p", {
										className: RunsPanel_module_css_default.reason,
										children: row.workspaceReason
									}),
									state.detailFailed && (0, react_jsx_runtime.jsxs)("div", {
										className: RunsPanel_module_css_default.notice,
										role: "status",
										children: [(0, react_jsx_runtime.jsx)("span", { children: t("detailError") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											size: "sm",
											onClick: state.refresh,
											children: t("retry")
										})]
									}),
									state.detailLoading && detail === null ? (0, react_jsx_runtime.jsx)("div", {
										className: RunsPanel_module_css_default.pending,
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" })
									}) : detail !== null && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
										detail.uncertain && (0, react_jsx_runtime.jsx)("p", {
											className: RunsPanel_module_css_default.notice,
											children: t("uncertain")
										}),
										operations !== void 0 && owner !== void 0 && (0, react_jsx_runtime.jsx)(RunControls, {
											owner,
											detail,
											operations,
											refresh: state.refresh,
											t
										}, row.runId),
										detail.steps !== void 0 && (0, react_jsx_runtime.jsxs)("section", {
											className: RunsPanel_module_css_default.stories,
											children: [(0, react_jsx_runtime.jsx)("h3", { children: t("steps") }), detail.steps.map((step) => (0, react_jsx_runtime.jsxs)("div", {
												className: RunsPanel_module_css_default.story,
												children: [
													(0, react_jsx_runtime.jsx)("span", { children: step.id }),
													(0, react_jsx_runtime.jsxs)("span", {
														className: RunsPanel_module_css_default.secondary,
														children: [
															step.agent,
															" · ",
															t(step.status === "waiting" ? "pending" : step.status)
														]
													}),
													step.output !== null && (0, react_jsx_runtime.jsxs)("details", { children: [(0, react_jsx_runtime.jsx)("summary", { children: t("output") }), (0, react_jsx_runtime.jsx)("pre", {
														className: RunsPanel_module_css_default.output,
														children: step.output
													})] })
												]
											}, step.id))]
										}),
										detail.stories.length > 0 && (0, react_jsx_runtime.jsxs)("section", {
											className: RunsPanel_module_css_default.stories,
											children: [(0, react_jsx_runtime.jsx)("h3", { children: t("stories") }), detail.stories.map((story) => (0, react_jsx_runtime.jsxs)("div", {
												className: RunsPanel_module_css_default.story,
												children: [
													(0, react_jsx_runtime.jsx)("span", { children: story.title }),
													(0, react_jsx_runtime.jsx)("span", {
														className: RunsPanel_module_css_default.secondary,
														children: t(story.status === "retry" ? "retrying" : story.status)
													}),
													(0, react_jsx_runtime.jsx)("span", {
														className: RunsPanel_module_css_default.secondary,
														children: t("retries", { count: story.retryCount })
													}),
													(story.acceptanceCriteria?.length ?? 0) > 0 && (0, react_jsx_runtime.jsx)("ul", { children: story.acceptanceCriteria.map((criterion) => (0, react_jsx_runtime.jsx)("li", { children: criterion }, criterion)) }),
													story.feedback !== void 0 && (0, react_jsx_runtime.jsx)("p", {
														className: RunsPanel_module_css_default.reason,
														children: story.feedback
													})
												]
											}, story.id))]
										}),
										detail.childSessionIds.length > 0 && (0, react_jsx_runtime.jsxs)("section", {
											className: RunsPanel_module_css_default.children,
											children: [(0, react_jsx_runtime.jsx)("h3", { children: t("children") }), detail.childSessionIds.map((id) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												size: "sm",
												className: RunsPanel_module_css_default.child,
												"aria-label": t("openChild", { id }),
												onClick: () => {
													openChild(id);
												},
												children: id
											}, id))]
										}),
										Object.keys(detail.context).length > 0 && (0, react_jsx_runtime.jsxs)("details", { children: [(0, react_jsx_runtime.jsx)("summary", { children: t("output") }), (0, react_jsx_runtime.jsx)("dl", { children: Object.entries(detail.context).map(([key, value]) => (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: key }), (0, react_jsx_runtime.jsx)("dd", { children: (0, react_jsx_runtime.jsx)("pre", {
											className: RunsPanel_module_css_default.output,
											children: value
										}) })] }, key)) })] }),
										operations !== void 0 && (0, react_jsx_runtime.jsxs)("details", { children: [
											(0, react_jsx_runtime.jsx)("summary", { children: t("events") }),
											(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
												size: "sm",
												onClick: () => {
													loadEvents(row.runId);
												},
												children: t(events?.runId === row.runId ? "moreEvents" : "loadEvents")
											}),
											events?.runId === row.runId && (0, react_jsx_runtime.jsx)("ol", {
												className: RunsPanel_module_css_default.events,
												children: events.values.map((event) => (0, react_jsx_runtime.jsxs)("li", { children: [(0, react_jsx_runtime.jsxs)("span", { children: [
													"#",
													event.seq,
													" ",
													event.type
												] }), (0, react_jsx_runtime.jsx)("pre", {
													className: RunsPanel_module_css_default.output,
													children: event.detail
												})] }, event.seq))
											})
										] })
									] })
								]
							})
						}, row.runId);
					}),
					state.hasMore === true && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						disabled: state.loading,
						onClick: state.loadMore,
						children: t("moreRuns")
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/queries.js
		/** Sidebar query lifetimes: retain settled data and ignore obsolete Session or selection responses. */
		/**
		* Read visible run data, polling through run settlement and its workspace disposition.
		* @param sessionId - Session owning the view.
		* @param visible - whether this tab is in the foreground.
		* @param queries - cancellable list and detail reads.
		* @param refreshIntervalMs - configured active-run polling interval.
		* @returns retained query state and user actions.
		*/
		function useAntfarmRuns(sessionId, visible, queries, refreshIntervalMs) {
			const [listing, setListing] = (0, react.useState)({
				sessionId,
				rows: [],
				loading: true,
				failed: false
			});
			const [selection, setSelection] = (0, react.useState)({
				sessionId,
				runId: null
			});
			const [detail, setDetail] = (0, react.useState)(null);
			const [revision, setRevision] = (0, react.useState)(0);
			const [window, setWindow] = (0, react.useState)({
				sessionId,
				pages: 1
			});
			const [hasMore, setHasMore] = (0, react.useState)(false);
			const pages = window.sessionId === sessionId ? window.pages : 1;
			const refresh = (0, react.useCallback)(() => {
				setRevision((current) => current + 1);
			}, []);
			const rows = listing.sessionId === sessionId ? listing.rows : [];
			const selectedRunId = selection.sessionId === sessionId ? selection.runId : null;
			const currentDetail = detail?.sessionId === sessionId && detail.runId === selectedRunId ? detail : null;
			const reading = listing.loading || currentDetail?.loading === true;
			(0, react.useEffect)(() => {
				if (!visible) return;
				const request = new AbortController();
				setListing((current) => ({
					sessionId,
					rows: current.sessionId === sessionId ? current.rows : [],
					loading: true,
					failed: false
				}));
				const read = async () => {
					if (queries.page === void 0) return queries.list(sessionId, request.signal);
					const batches = await Promise.all(Array.from({ length: pages }, (_, page) => queries.page(sessionId, page * 50, request.signal)));
					if (!request.signal.aborted) setHasMore((batches.at(-1)?.length ?? 0) >= 50);
					return [...new Map(batches.flat().map((row) => [row.runId, row])).values()];
				};
				read().then((value) => {
					if (!request.signal.aborted) setListing({
						sessionId,
						rows: value,
						loading: false,
						failed: false
					});
				}).catch(() => {
					if (!request.signal.aborted) setListing((current) => ({
						...current,
						loading: false,
						failed: true
					}));
				});
				return () => {
					request.abort();
				};
			}, [
				sessionId,
				visible,
				queries,
				revision,
				pages
			]);
			(0, react.useEffect)(() => {
				if (!visible || selectedRunId === null) return;
				const runId = selectedRunId;
				const request = new AbortController();
				setDetail((current) => ({
					sessionId,
					runId,
					value: current?.sessionId === sessionId && current.runId === runId ? current.value : null,
					loading: true,
					failed: false
				}));
				queries.status(runId, sessionId, request.signal).then((value) => {
					if (!request.signal.aborted) setDetail({
						sessionId,
						runId,
						value,
						loading: false,
						failed: false
					});
				}).catch(() => {
					if (!request.signal.aborted) setDetail((current) => current === null ? null : {
						...current,
						loading: false,
						failed: true
					});
				});
				return () => {
					request.abort();
				};
			}, [
				sessionId,
				selectedRunId,
				visible,
				queries,
				revision
			]);
			(0, react.useEffect)(() => {
				if (!visible || reading) return;
				const timer = setTimeout(refresh, refreshIntervalMs);
				return () => {
					clearTimeout(timer);
				};
			}, [
				visible,
				reading,
				refreshIntervalMs,
				refresh
			]);
			return {
				rows,
				loading: listing.sessionId !== sessionId || listing.loading,
				failed: listing.sessionId === sessionId && listing.failed,
				selectedRunId,
				detail: currentDetail?.value ?? null,
				detailLoading: selectedRunId !== null && (currentDetail === null || currentDetail.loading),
				detailFailed: currentDetail?.failed ?? false,
				hasMore,
				loadMore: () => {
					setWindow({
						sessionId,
						pages: pages + 1
					});
				},
				select: (runId) => {
					setSelection({
						sessionId,
						runId
					});
				},
				refresh
			};
		}
		//#endregion
		//#region lib/types/client/notice.js
		/** Operation feedback remains mounted when the initiating sidebar closes. */
		/** @returns Scope-owned feedback source and narrow overlay injection. */
		function createNotices() {
			const source = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			let seq = 0;
			return {
				report: (success) => source.set({
					seq: ++seq,
					success
				}),
				face: {
					hooks: { notice: source },
					dismiss: () => source.set(null)
				}
			};
		}
		/** @param props - Framework-bound notice and locale. @returns Transient banner. */
		function OperationNotice({ useNotice, dismiss, t }) {
			const notice = useNotice((value) => value);
			if (notice === null) return null;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: t(notice.success ? "operationSuccess" : "operationError"),
				...notice.success ? { tone: "success" } : { icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}) },
				onDone: dismiss
			}, notice.seq);
		}
		//#endregion
		//#region lib/types/client/BoardPanel.js
		/** Cross-session workflow stage board over explicitly authorized Host resources. */
		/** @param props - Root Session list hook and scoped Host actions. @returns Workflow stage cards and progressive detail. */
		function BoardPanel({ useSessions, usePanelInfo, useRefreshInterval, queries, operations, openChild, t }) {
			const ownersKey = useSessions((state) => JSON.stringify(state.ids));
			const owners = (0, react.useMemo)(() => JSON.parse(ownersKey).map(SessionId), [ownersKey]);
			const sessionsKey = useSessions((state) => JSON.stringify(state.ids.flatMap((id) => {
				const row = state.byId[id];
				return row?.cwd !== void 0 && row.parentId === void 0 && row.origin !== "subagent" ? [{
					id,
					title: row.displayTitle,
					cwd: row.cwd
				}] : [];
			})));
			const sessions = (0, react.useMemo)(() => JSON.parse(sessionsKey), [sessionsKey]);
			const [target, setTarget] = (0, react.useState)("");
			const session = sessions.find((row) => row.id === target) ?? sessions[0];
			const reader = (0, react.useMemo)(() => queries(owners), [queries, owners]);
			const visible = usePanelInfo((state) => state.activePanelId === "antfarm-board");
			const interval = useRefreshInterval((value) => value);
			const state = useAntfarmRuns(owners[0] ?? SessionId("antfarm-board-empty"), visible, reader, interval);
			const [workflow, setWorkflow] = (0, react.useState)("");
			const rows = state.rows.filter((row) => workflow === "" || row.workflowId === workflow);
			const groups = /* @__PURE__ */ new Map();
			for (const row of rows) {
				const key = `${row.workflowId} · ${row.status === "running" || row.status === "starting" ? row.currentStep ?? row.status : row.status}`;
				groups.set(key, [...groups.get(key) ?? [], row]);
			}
			const selected = state.rows.find((row) => row.runId === state.selectedRunId);
			return (0, react_jsx_runtime.jsxs)("main", {
				className: RunsPanel_module_css_default.board,
				children: [
					(0, react_jsx_runtime.jsxs)("header", {
						className: RunsPanel_module_css_default.header,
						children: [(0, react_jsx_runtime.jsx)("h1", { children: t("board") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: state.loading,
							onClick: state.refresh,
							children: t("refresh")
						})]
					}),
					(0, react_jsx_runtime.jsxs)("section", {
						className: RunsPanel_module_css_default.launch,
						children: [
							(0, react_jsx_runtime.jsx)("h2", { children: t("newRun") }),
							(0, react_jsx_runtime.jsx)("p", {
								className: RunsPanel_module_css_default.secondary,
								children: t("boardHelp")
							}),
							session === void 0 ? (0, react_jsx_runtime.jsx)("p", { children: t("noProjectSession") }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								(0, react_jsx_runtime.jsxs)("label", {
									className: RunsPanel_module_css_default.form,
									children: [t("projectSession"), (0, react_jsx_runtime.jsx)("select", {
										value: session.id,
										onChange: (event) => {
											setTarget(event.target.value);
										},
										children: sessions.map((row) => (0, react_jsx_runtime.jsxs)("option", {
											value: row.id,
											children: [
												row.title,
												" · ",
												row.cwd
											]
										}, row.id))
									})]
								}),
								(0, react_jsx_runtime.jsx)("p", {
									className: RunsPanel_module_css_default.project,
									children: session.cwd
								}),
								(0, react_jsx_runtime.jsx)(WorkflowPanel, {
									owner: SessionId(session.id),
									visible,
									operations,
									t,
									launched: (runId) => {
										setWorkflow("");
										state.select(runId);
										state.refresh();
									}
								}, session.id)
							] })
						]
					}),
					(0, react_jsx_runtime.jsxs)("header", {
						className: RunsPanel_module_css_default.header,
						children: [(0, react_jsx_runtime.jsx)("h2", { children: t("runs") }), (0, react_jsx_runtime.jsxs)("select", {
							"aria-label": t("filterWorkflow"),
							value: workflow,
							onChange: (event) => {
								setWorkflow(event.target.value);
							},
							children: [(0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t("allWorkflows")
							}), [...new Set(state.rows.map((row) => row.workflowId))].map((id) => (0, react_jsx_runtime.jsx)("option", {
								value: id,
								children: id
							}, id))]
						})]
					}),
					state.failed && (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: t("loadError")
					}),
					state.rows.length === 0 && !state.loading && !state.failed && (0, react_jsx_runtime.jsxs)("div", {
						className: RunsPanel_module_css_default.empty,
						children: [(0, react_jsx_runtime.jsx)("p", { children: t("emptyBoard") }), (0, react_jsx_runtime.jsx)("p", { children: t("emptyHelp") })]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: RunsPanel_module_css_default.columns,
						children: [...groups].map(([group, rows]) => (0, react_jsx_runtime.jsxs)("section", {
							className: RunsPanel_module_css_default.column,
							children: [(0, react_jsx_runtime.jsxs)("h2", { children: [
								group,
								" (",
								rows.length,
								")"
							] }), rows.map((row) => (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: RunsPanel_module_css_default.card,
								"aria-expanded": state.selectedRunId === row.runId,
								onClick: () => {
									state.select(row.runId);
								},
								children: [
									(0, react_jsx_runtime.jsx)("span", { children: row.task ?? row.workflowId }),
									(0, react_jsx_runtime.jsxs)("span", {
										className: RunsPanel_module_css_default.secondary,
										children: [
											"#",
											row.number ?? row.runId,
											" · ",
											t(row.status)
										]
									}),
									(row.totalStories ?? 0) > 0 && (0, react_jsx_runtime.jsx)("span", { children: t("acceptedProgress", {
										done: row.acceptedStories ?? 0,
										total: row.totalStories ?? 0
									}) }),
									row.reason !== void 0 && row.reason !== "" && (0, react_jsx_runtime.jsx)("span", {
										className: RunsPanel_module_css_default.reason,
										children: row.reason
									})
								]
							}, row.runId))]
						}, group))
					}),
					state.hasMore === true && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						size: "sm",
						disabled: state.loading,
						onClick: state.loadMore,
						children: t("moreRuns")
					}),
					selected !== void 0 && (0, react_jsx_runtime.jsx)(RunsPanel, {
						state: {
							...state,
							rows: [selected],
							hasMore: false
						},
						workspace: selected.workspace,
						owner: SessionId(selected.ownerSessionId),
						operations,
						showLaunch: false,
						visible,
						t,
						openChild: (child) => {
							openChild(child, selected.ownerSessionId);
						}
					})
				]
			});
		}
		/** @param props - Native sidebar icon size. @returns Existing checklist glyph. */
		function BoardIcon({ size }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutlineRegular, { size });
		}
		//#endregion
		//#region lib/types/client/mount.js
		/** Browser services required before mounting the plugin's own Remote. */
		const inject = [
			"remote",
			"slots",
			"locale",
			"sessions",
			"uiSession",
			"uiWorkspace",
			"sidebarRightTabs"
		];
		const TAB_ID = "dsh-antfarm";
		/**
		* Mount the plugin's own Remote before registering sidebar readers.
		* @param ctx - browser plugin context.
		* @param contribution - generated Antfarm Remote descriptors.
		* @param config - active-run refresh policy.
		* @returns disposer joining UI and Remote withdrawal, including setup rollback.
		*/
		async function mountAntfarm(ctx, contribution, config) {
			const disposeRemote = await ctx.remote.$mount(contribution);
			const ui = ctx.inject(["remote.antfarmStudio"], (current) => {
				registerSidebar(current, config);
			});
			try {
				await ui;
			} catch (error) {
				try {
					await ui.dispose();
				} finally {
					await disposeRemote();
				}
				throw error;
			}
			return async () => {
				try {
					await ui.dispose();
				} finally {
					await disposeRemote();
				}
			};
		}
		function registerSidebar(ctx, config) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "Antfarm: dictionaries");
			const t = ctx.locale.bind(NS);
			const refreshInterval = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(config.refreshIntervalMs.get());
			ctx.on("loader/volatile-update", () => {
				refreshInterval.set(config.refreshIntervalMs.get());
			});
			const notices = createNotices();
			ctx.effect(() => ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "antfarm-notice",
				locale: NS,
				inject: () => notices.face
			}, OperationNotice)), "Antfarm: operation feedback");
			const remote = ctx.remote.antfarmStudio;
			const drafts = /* @__PURE__ */ new Map();
			ctx.effect(() => {
				const protect = (event) => {
					if ([...drafts.values()].some((value) => value.source !== null && value.draft !== null && (value.source.document !== value.draft.document || JSON.stringify(value.source.files) !== JSON.stringify(value.draft.files)))) {
						event.preventDefault();
						event.returnValue = "";
					}
				};
				window.addEventListener("beforeunload", protect);
				return () => {
					window.removeEventListener("beforeunload", protect);
				};
			}, "Antfarm: unsaved source protection");
			const operations = {
				readDraft: (owner) => drafts.get(owner),
				rememberDraft: (owner, patch) => {
					drafts.set(owner, {
						id: "",
						task: "",
						source: null,
						draft: null,
						scope: "project",
						file: "workflow.yml",
						editor: false,
						...drafts.get(owner),
						...patch
					});
				},
				async start(request) {
					const result = await remote.start(request, new AbortController().signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async control(request) {
					const result = await remote.control(request, new AbortController().signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async workflows(owner, signal) {
					const result = await remote.workflows(owner, signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async workflow(id, owner, signal) {
					const result = await remote.workflow(id, owner, signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async save(draft, scope, owner) {
					const result = await remote.saveWorkflow(draft, scope, owner, new AbortController().signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async remove(draft, scope, owner) {
					const result = await remote.removeWorkflow(draft.id, draft.revision, scope, owner, new AbortController().signal);
					if (!result.ok) throw result.error;
				},
				async copy(draft, newId, owner) {
					const result = await remote.copyWorkflow(draft, newId, owner, new AbortController().signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async setEnabled(draft, enabled, owner) {
					const result = await remote.setWorkflowEnabled(draft, enabled, owner, new AbortController().signal);
					if (!result.ok) throw result.error;
				},
				async events(runId, owner, after) {
					const result = await remote.events(runId, owner, after, new AbortController().signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async health(owner) {
					const result = await remote.health(owner, new AbortController().signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async healthHistory(owner) {
					const result = await remote.healthHistory(owner, new AbortController().signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async ensureExecution(owner) {
					const result = await remote.ensureExecution(owner, new AbortController().signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				report: notices.report
			};
			const queries = {
				async page(sessionId, offset, signal) {
					const result = await remote.page([sessionId], offset, signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async list(sessionId, signal) {
					const result = await ctx.remote.antfarmStudio.list(sessionId, signal);
					if (!result.ok) throw result.error;
					return result.value;
				},
				async status(runId, sessionId, signal) {
					const result = await ctx.remote.antfarmStudio.status(runId, sessionId, signal);
					if (!result.ok) throw result.error;
					return result.value;
				}
			};
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id: TAB_ID,
				kind: "antfarm",
				title: () => t("title"),
				guide: [{
					id: "runs",
					order: 25,
					title: () => t("title"),
					description: () => t("description"),
					icon: _deepseek_ai_dsh_client_ui_primitives.IconChecklistOutlineRegular
				}]
			}), "Antfarm: sidebar type");
			const boardQueries = (owners) => {
				const attribution = /* @__PURE__ */ new Map();
				return {
					async page(_view, offset, signal) {
						const chunks = Array.from({ length: Math.ceil(owners.length / 100) }, (_, index) => owners.slice(index * 100, index * 100 + 100));
						const rows = (await Promise.all(chunks.map(async (chunk) => {
							const result = await remote.page(chunk, offset, signal);
							if (!result.ok) throw result.error;
							return result.value;
						}))).flat().sort((a, b) => b.updatedAt - a.updatedAt);
						for (const row of rows) attribution.set(row.runId, SessionId(row.ownerSessionId));
						return rows;
					},
					async list(_view, signal) {
						if (owners.length === 0) return [];
						const result = await remote.board(owners, signal);
						if (!result.ok) throw result.error;
						attribution.clear();
						for (const row of result.value) attribution.set(row.runId, SessionId(row.ownerSessionId));
						return result.value;
					},
					async status(runId, _view, signal) {
						const owner = attribution.get(runId);
						if (owner === void 0) throw new Error("Run is no longer in the authorized board");
						return queries.status(runId, owner, signal);
					}
				};
			};
			ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: "antfarm-board",
				locale: NS,
				inject: () => ({
					hooks: { refreshInterval },
					queries: boardQueries,
					operations,
					openChild: (child, parent) => {
						const address = ctx.sessions.subagentAddress(SessionId(child));
						ctx.uiWorkspace.openSession(address ?? {
							parentSessionId: SessionId(parent),
							childSessionId: SessionId(child),
							mode: "unknown"
						});
					}
				})
			}, BoardPanel)), "Antfarm: workflow board");
			ctx.effect(() => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: "antfarm-board",
				order: 25,
				label: () => t("board"),
				locale: NS
			}, BoardIcon)), "Antfarm: board launcher");
			function Sidebar({ sessionId, useTabInfo, useSessions, useRefreshInterval, t: copy }) {
				const { tab } = useTabInfo();
				const workspace = useSessions((state) => state.byId[sessionId]?.cwd);
				const interval = useRefreshInterval((value) => value);
				const state = useAntfarmRuns(sessionId, tab.visible, queries, interval);
				(0, react.useEffect)(() => tab.actions.bindCommands({ refresh: state.refresh }), [tab.actions, state.refresh]);
				return (0, react_jsx_runtime.jsx)(RunsPanel, {
					state,
					workspace,
					owner: sessionId,
					visible: tab.visible,
					operations,
					t: copy,
					openChild: (rawId) => {
						const childSessionId = SessionId(rawId);
						const address = ctx.sessions.subagentAddress(childSessionId);
						ctx.uiWorkspace.openSession(address ?? {
							parentSessionId: sessionId,
							childSessionId,
							mode: "unknown"
						});
					}
				});
			}
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: TAB_ID,
				locale: NS,
				inject: () => ({ hooks: { refreshInterval } })
			}, Sidebar)), "Antfarm: sidebar body");
		}
		//#endregion
		//#region node_modules/.pnpm/@deepseek-ai+cosmokit@1.9.0/node_modules/@deepseek-ai/cosmokit/lib/index.js
		/** Return true when a value is `null` or `undefined`. */
		function isNullable(value) {
			return value === null || value === void 0;
		}
		/** Return true for non-array object values. */
		function isPlainObject(data) {
			return data && typeof data === "object" && !Array.isArray(data);
		}
		/** Filter object entries and return a new object. */
		function filterKeys(object, filter) {
			return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
		}
		/** Map object values while preserving the original key set. */
		function mapValues(object, transform) {
			return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
		}
		/** Pick selected keys from an object, optionally including `undefined` values. */
		function pick(source, keys, forced) {
			if (!keys) return { ...source };
			const result = {};
			for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
			return result;
		}
		/** Shared config references used by schema validators and plugin runtimes. */
		const write = Symbol.for("cosmokit.volatile.write");
		function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
			if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
			if (value === null || typeof value !== "object") return value;
			if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
			ancestors.add(value);
			try {
				if (Array.isArray(value)) return Object.freeze(value.map((item) => snapshot(item, ancestors)));
				if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("volatile config objects must be plain objects or arrays");
				return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshot(item, ancestors)])));
			} finally {
				ancestors.delete(value);
			}
		}
		/**
		* Create a detached reference containing an immutable copy of the supplied data.
		* @param value - validated config data; class instances and functions are unsupported.
		* @returns a reference whose value is updated only by its owning runtime.
		*/
		function createVolatile(value) {
			let current = snapshot(value);
			return Object.freeze({
				get: () => current,
				[write]: (value) => {
					current = value;
				}
			});
		}
		/**
		* Identify references across ESM/CJS copies of the shared library.
		* @param value - a parsed config value.
		* @returns whether the value implements the shared reference protocol.
		*/
		function isVolatile(value) {
			return typeof value === "object" && value !== null && write in value;
		}
		/** Test values using `instanceof` with a `toStringTag` fallback. */
		function is(type, value) {
			if (arguments.length === 1) return (value) => is(type, value);
			return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
		}
		function isArrayBufferLike(value) {
			return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
		}
		function isArrayBufferSource(value) {
			return isArrayBufferLike(value) || ArrayBuffer.isView(value);
		}
		/** Binary source detection and base64/hex conversion helpers. */
		var Binary;
		(function(Binary) {
			Binary.is = isArrayBufferLike;
			Binary.isSource = isArrayBufferSource;
			function fromSource(source) {
				if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
				else return source;
			}
			Binary.fromSource = fromSource;
			function toBase64(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
				let binary = "";
				const bytes = new Uint8Array(source);
				for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
				return btoa(binary);
			}
			Binary.toBase64 = toBase64;
			function fromBase64(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
				return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
			}
			Binary.fromBase64 = fromBase64;
			function toHex(source) {
				source = fromSource(source);
				if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
				return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
			}
			Binary.toHex = toHex;
			function fromHex(source) {
				if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
				const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
				const buffer = [];
				for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
				return Uint8Array.from(buffer).buffer;
			}
			Binary.fromHex = fromHex;
		})(Binary || (Binary = {}));
		Binary.fromBase64;
		Binary.toBase64;
		Binary.fromHex;
		Binary.toHex;
		/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
		function clone(source, refs = /* @__PURE__ */ new Map()) {
			if (!source || typeof source !== "object") return source;
			if (is("Date", source)) return new Date(source.valueOf());
			if (is("RegExp", source)) return new RegExp(source.source, source.flags);
			if (isArrayBufferLike(source)) return source.slice(0);
			if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
			const cached = refs.get(source);
			if (cached) return cached;
			if (Array.isArray(source)) {
				const result = [];
				refs.set(source, result);
				source.forEach((value, index) => {
					result[index] = Reflect.apply(clone, null, [value, refs]);
				});
				return result;
			}
			const result = Object.create(Object.getPrototypeOf(source));
			refs.set(source, result);
			for (const key of Reflect.ownKeys(source)) {
				const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
				if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
				Reflect.defineProperty(result, key, descriptor);
			}
			return result;
		}
		/**
		* Compare values recursively, treating two volatile references as equal regardless of value.
		* Strict comparison distinguishes null/undefined, treats opaque objects by identity,
		* compares URLs by normalized href, treats array holes as undefined, and considers distinct cyclic structures unequal.
		* @param a - first value.
		* @param b - second value.
		* @param strict - whether to require strict data equality outside volatile references.
		* @returns whether the values compare equal.
		*/
		function deepEqual(a, b, strict) {
			const ancestors = /* @__PURE__ */ new Set();
			function compare(a, b) {
				if (a === b) return true;
				if (isVolatile(a) || isVolatile(b)) return isVolatile(a) && isVolatile(b);
				if (!strict && isNullable(a) && isNullable(b)) return true;
				if (typeof a !== typeof b || typeof a !== "object" || !a || !b) return false;
				if (ancestors.has(a)) return false;
				function check(test, then) {
					return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
				}
				ancestors.add(a);
				try {
					return check(Array.isArray, (a, b) => {
						if (a.length !== b.length) return false;
						for (let index = 0; index < a.length; index++) if (!compare(a[index], b[index])) return false;
						return true;
					}) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("URL"), (a, b) => a.href === b.href) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
						if (a.byteLength !== b.byteLength) return false;
						const viewA = new Uint8Array(a);
						const viewB = new Uint8Array(b);
						for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
						return true;
					}) ?? ((!strict || [a, b].every((value) => Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) && Object.keys({
						...a,
						...b
					}).every((key) => compare(a[key], b[key])));
				} finally {
					ancestors.delete(a);
				}
			}
			return compare(a, b);
		}
		/** Time constants plus parsing and formatting helpers. */
		var Time;
		(function(Time) {
			Time.millisecond = 1;
			Time.second = 1e3;
			Time.minute = Time.second * 60;
			Time.hour = Time.minute * 60;
			Time.day = Time.hour * 24;
			Time.week = Time.day * 7;
			let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
			function setTimezoneOffset(offset) {
				timezoneOffset = offset;
			}
			Time.setTimezoneOffset = setTimezoneOffset;
			function getTimezoneOffset() {
				return timezoneOffset;
			}
			Time.getTimezoneOffset = getTimezoneOffset;
			function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
				if (typeof date === "number") date = new Date(date);
				if (offset === void 0) offset = timezoneOffset;
				return Math.floor((date.valueOf() / Time.minute - offset) / 1440);
			}
			Time.getDateNumber = getDateNumber;
			function fromDateNumber(value, offset) {
				const date = new Date(value * Time.day);
				if (offset === void 0) offset = timezoneOffset;
				return new Date(+date + offset * Time.minute);
			}
			Time.fromDateNumber = fromDateNumber;
			const numeric = /\d+(?:\.\d+)?/.source;
			const timeRegExp = new RegExp(`^${[
				"w(?:eek(?:s)?)?",
				"d(?:ay(?:s)?)?",
				"h(?:our(?:s)?)?",
				"m(?:in(?:ute)?(?:s)?)?",
				"s(?:ec(?:ond)?(?:s)?)?"
			].map((unit) => `(${numeric}${unit})?`).join("")}$`);
			function parseTime(source) {
				const capture = timeRegExp.exec(source);
				if (!capture) return 0;
				return (parseFloat(capture[1]) * Time.week || 0) + (parseFloat(capture[2]) * Time.day || 0) + (parseFloat(capture[3]) * Time.hour || 0) + (parseFloat(capture[4]) * Time.minute || 0) + (parseFloat(capture[5]) * Time.second || 0);
			}
			Time.parseTime = parseTime;
			function parseDate(date) {
				const parsed = parseTime(date);
				if (parsed) date = Date.now() + parsed;
				else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
				else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
				return date ? new Date(date) : /* @__PURE__ */ new Date();
			}
			Time.parseDate = parseDate;
			function format(ms) {
				const abs = Math.abs(ms);
				if (abs >= Time.day - Time.hour / 2) return Math.round(ms / Time.day) + "d";
				else if (abs >= Time.hour - Time.minute / 2) return Math.round(ms / Time.hour) + "h";
				else if (abs >= Time.minute - Time.second / 2) return Math.round(ms / Time.minute) + "m";
				else if (abs >= Time.second) return Math.round(ms / Time.second) + "s";
				return ms + "ms";
			}
			Time.format = format;
			function toDigits(source, length = 2) {
				return source.toString().padStart(length, "0");
			}
			Time.toDigits = toDigits;
			function template(template, time = /* @__PURE__ */ new Date()) {
				return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
			}
			Time.template = template;
		})(Time || (Time = {}));
		//#endregion
		//#region node_modules/.pnpm/@deepseek-ai+schemastery@3.19.0/node_modules/@deepseek-ai/schemastery/lib/index.mjs
		const kSchema = Symbol.for("schemastery");
		const kValidationError = Symbol.for("ValidationError");
		globalThis.__schemastery_index__ ??= 0;
		globalThis.__schemastery_refs__ = void 0;
		var ValidationError = class extends TypeError {
			options;
			name = "ValidationError";
			constructor(message, options) {
				let prefix = "$";
				for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
				else if (typeof segment === "number") prefix += "[" + segment + "]";
				else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
				if (prefix.startsWith(".")) prefix = prefix.slice(1);
				super((prefix === "$" ? "" : `${prefix} `) + message);
				this.options = options;
			}
			static is(error) {
				return !!error?.[kValidationError];
			}
		};
		Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
		const Schema = function(options) {
			const schema = function(data, options = {}) {
				return Schema.resolve(data, schema, options)[0];
			};
			if (options.refs) {
				const refs = mapValues(options.refs, (options) => new Schema(options));
				const getRef = (uid) => refs[uid];
				for (const key in refs) {
					const options = refs[key];
					options.sKey = getRef(options.sKey);
					options.inner = getRef(options.inner);
					options.list = options.list && options.list.map(getRef);
					options.dict = options.dict && mapValues(options.dict, getRef);
				}
				return refs[options.uid];
			}
			Object.assign(schema, options);
			if (typeof schema.callback === "string") try {
				schema.callback = new Function("return " + schema.callback)();
			} catch {}
			Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
			Object.setPrototypeOf(schema, Schema.prototype);
			schema.meta ||= {};
			schema.toString = schema.toString.bind(schema);
			return schema;
		};
		Schema.prototype = Object.create(Function.prototype);
		Schema.prototype[kSchema] = true;
		Object.defineProperty(Schema.prototype, "~standard", { get() {
			return {
				version: 1,
				vendor: "schemastery",
				validate: (value) => {
					try {
						return { value: Schema.resolve(value, this, {})[0] };
					} catch (error) {
						if (ValidationError.is(error)) return { issues: [{
							message: error.message,
							path: error.options.path
						}] };
						throw error;
					}
				}
			};
		} });
		Schema.ValidationError = ValidationError;
		Schema.prototype.toJSON = function toJSON() {
			if (globalThis.__schemastery_refs__) {
				globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
				return this.uid;
			}
			globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
			globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
			const result = {
				uid: this.uid,
				refs: globalThis.__schemastery_refs__
			};
			globalThis.__schemastery_refs__ = void 0;
			return result;
		};
		Schema.prototype.set = function set(key, value) {
			this.dict[key] = value;
			return this;
		};
		Schema.prototype.push = function push(value) {
			this.list.push(value);
			return this;
		};
		function mergeDesc(original, messages) {
			const result = typeof original === "string" ? { "": original } : { ...original };
			for (const locale in messages) {
				const value = messages[locale];
				if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
				else if (typeof value === "string") result[locale] = value;
			}
			return result;
		}
		function getInner(value) {
			return value?.$value ?? value?.$inner;
		}
		function extractKeys(data) {
			return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
		}
		Schema.prototype.i18n = function i18n(messages) {
			const schema = Schema(this);
			const desc = mergeDesc(schema.meta.description, messages);
			if (Object.keys(desc).length) schema.meta.description = desc;
			if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
				return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
			});
			if (schema.list) schema.list = schema.list.map((inner, index) => {
				return inner.i18n(mapValues(messages, (data = {}) => {
					if (Array.isArray(getInner(data))) return getInner(data)[index];
					if (Array.isArray(data)) return data[index];
					return extractKeys(data);
				}));
			});
			if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
				if (getInner(data)) return getInner(data);
				return extractKeys(data);
			}));
			if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
			return schema;
		};
		Schema.prototype.extra = function extra(key, value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		};
		for (const key of [
			"required",
			"disabled",
			"collapse",
			"hidden",
			"loose"
		]) Object.assign(Schema.prototype, { [key](value = true) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		Schema.prototype.deprecated = function deprecated() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "deprecated",
				type: "danger"
			});
			return schema;
		};
		Schema.prototype.experimental = function experimental() {
			const schema = Schema(this);
			schema.meta.badges ||= [];
			schema.meta.badges.push({
				text: "experimental",
				type: "warning"
			});
			return schema;
		};
		Schema.prototype.pattern = function pattern(regexp) {
			const schema = Schema(this);
			const pattern = pick(regexp, ["source", "flags"]);
			schema.meta = {
				...schema.meta,
				pattern
			};
			return schema;
		};
		Schema.prototype.simplify = function simplify(value) {
			if (isVolatile(value)) value = value.get();
			if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
			if (isNullable(value)) return value;
			if (this.type === "object" || this.type === "dict") {
				const result = {};
				for (const key in value) {
					const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
					if (this.type === "dict" || !isNullable(item)) result[key] = item;
				}
				if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
				return result;
			} else if (this.type === "array" || this.type === "tuple") {
				const result = [];
				value.forEach((value, index) => {
					const schema = this.type === "array" ? this.inner : this.list[index];
					const item = schema ? schema.simplify(value) : value;
					result.push(item);
				});
				return result;
			} else if (this.type === "intersect") {
				const result = {};
				for (const item of this.list) Object.assign(result, item.simplify(value));
				return result;
			} else if (this.type === "union") for (const schema of this.list) try {
				Schema.resolve(value, schema, {});
				return schema.simplify(value);
			} catch {}
			return value;
		};
		Schema.prototype.toString = function toString(inline) {
			return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
		};
		Schema.prototype.role = function role(role, extra) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				role,
				extra
			};
			return schema;
		};
		for (const key of [
			"default",
			"link",
			"comment",
			"description",
			"max",
			"min",
			"step"
		]) Object.assign(Schema.prototype, { [key](value) {
			const schema = Schema(this);
			schema.meta = {
				...schema.meta,
				[key]: value
			};
			return schema;
		} });
		Schema.prototype.volatile = function volatile() {
			if (this.meta.volatile) throw new TypeError("volatile schema is already wrapped");
			return this.extra("volatile", true);
		};
		const resolvers = {};
		const checkedVolatile = Symbol("checked-volatile-schema");
		function validateVolatileSchema(schema, path = [], blocked = false, seen = /* @__PURE__ */ new Map()) {
			const states = seen.get(schema) ?? /* @__PURE__ */ new Set();
			if (states.has(blocked)) return;
			states.add(blocked);
			seen.set(schema, states);
			if (schema.meta?.volatile && blocked) throw new ValidationError("volatile fields require a fixed object path without an enclosing volatile field", { path });
			const nested = blocked || !!schema.meta?.volatile;
			if (schema.dict) for (const [key, child] of Object.entries(schema.dict)) validateVolatileSchema(child, [...path, key], nested, seen);
			if (schema.sKey) validateVolatileSchema(schema.sKey, [...path, "<key>"], true, seen);
			if (schema.inner && (schema.type !== "lazy" || schema.inner[kSchema])) validateVolatileSchema(schema.inner, [...path, "*"], true, seen);
			if (schema.list) for (let index = 0; index < schema.list.length; index++) validateVolatileSchema(schema.list[index], [...path, String(index)], true, seen);
		}
		Schema.extend = function extend(type, resolve) {
			resolvers[type] = resolve;
		};
		Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
			if (!schema) return [data];
			if (!options[checkedVolatile]) {
				validateVolatileSchema(schema, options.path);
				options = {
					...options,
					[checkedVolatile]: true
				};
			}
			if (schema.meta?.volatile) {
				const inner = Schema(schema);
				inner.meta = {
					...schema.meta,
					volatile: false
				};
				const [value, adapted] = Schema.resolve(data, inner, options, strict);
				try {
					return [createVolatile(value), adapted];
				} catch (error) {
					throw new ValidationError(error instanceof Error ? error.message : String(error), options);
				}
			}
			if (options.ignore?.(data, schema)) return [data];
			if (isNullable(data) && schema.type !== "lazy") {
				if (schema.meta.required) throw new ValidationError(`missing required value`, options);
				let current = schema;
				let fallback = schema.meta.default;
				while (current?.type === "intersect" && isNullable(fallback)) {
					current = current.list[0];
					fallback = current?.meta.default;
				}
				if (isNullable(fallback)) return [data];
				data = clone(fallback);
			}
			const callback = resolvers[schema.type];
			if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
			try {
				return callback(data, schema, options, strict);
			} catch (error) {
				if (!schema.meta.loose) throw error;
				return [schema.meta.default];
			}
		};
		Schema.from = function from(source) {
			if (isNullable(source)) return Schema.any();
			else if ([
				"string",
				"number",
				"boolean"
			].includes(typeof source)) return Schema.const(source).required();
			else if (source[kSchema]) return source;
			else if (typeof source === "function") switch (source) {
				case String: return Schema.string().required();
				case Number: return Schema.number().required();
				case Boolean: return Schema.boolean().required();
				case Function: return Schema.function().required();
				default: return Schema.is(source).required();
			}
			else throw new TypeError(`cannot infer schema from ${source}`);
		};
		Schema.lazy = function lazy(builder) {
			const toJSON = () => {
				if (!schema.inner[kSchema]) {
					schema.inner = schema.builder();
					schema.inner.meta = {
						...schema.meta,
						...schema.inner.meta
					};
				}
				return schema.inner.toJSON();
			};
			const schema = new Schema({
				type: "lazy",
				builder,
				inner: { toJSON }
			});
			return schema;
		};
		Schema.natural = function natural() {
			return Schema.number().step(1).min(0);
		};
		Schema.percent = function percent() {
			return Schema.number().step(.01).min(0).max(1).role("slider");
		};
		Schema.date = function date() {
			return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
				const date = new Date(value);
				if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
				return date;
			}, true)]);
		};
		Schema.regExp = function regExp(flag = "") {
			return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
				try {
					return new RegExp(value, flag);
				} catch (e) {
					throw new ValidationError(e.message, options);
				}
			}, true)]);
		};
		Schema.arrayBuffer = function arrayBuffer(encoding) {
			return Schema.union([
				Schema.is(ArrayBuffer),
				Schema.is(SharedArrayBuffer),
				Schema.transform(Schema.any(), (value, options) => {
					if (Binary.isSource(value)) return Binary.fromSource(value);
					throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
				}, true),
				...encoding ? [Schema.transform(Schema.string(), (value, options) => {
					try {
						return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
					} catch (e) {
						throw new ValidationError(e.message, options);
					}
				}, true)] : []
			]);
		};
		Schema.extend("lazy", (data, schema, options, strict) => {
			if (!schema.inner[kSchema]) {
				schema.inner = schema.builder();
				schema.inner.meta = {
					...schema.meta,
					...schema.inner.meta
				};
				validateVolatileSchema(schema.inner, options.path, true);
			}
			return Schema.resolve(data, schema.inner, options, strict);
		});
		Schema.extend("any", (data) => {
			return [data];
		});
		Schema.extend("never", (data, _, options) => {
			throw new ValidationError(`expected nullable but got ${data}`, options);
		});
		Schema.extend("const", (data, { value }, options) => {
			if (deepEqual(data, value)) return [value];
			throw new ValidationError(`expected ${value} but got ${data}`, options);
		});
		function checkWithinRange(data, meta, description, options, skipMin = false) {
			const { max = Infinity, min = -Infinity } = meta;
			if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
			if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
		}
		Schema.extend("string", (data, { meta }, options) => {
			if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
			if (meta.pattern) {
				const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
				if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
			}
			checkWithinRange(data.length, meta, "string length", options);
			return [data];
		});
		function decimalShift(data, digits) {
			const str = data.toString();
			if (str.includes("e")) return data * Math.pow(10, digits);
			const index = str.indexOf(".");
			if (index === -1) return data * Math.pow(10, digits);
			const frac = str.slice(index + 1);
			const integer = str.slice(0, index);
			if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
			return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
		}
		function isMultipleOf(data, min, step) {
			step = Math.abs(step);
			if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
			const index = step.toString().indexOf(".");
			const digits = step.toString().slice(index + 1).length;
			return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
		}
		Schema.extend("number", (data, { meta }, options) => {
			if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
			checkWithinRange(data, meta, "number", options);
			const { step } = meta;
			if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
			return [data];
		});
		Schema.extend("boolean", (data, _, options) => {
			if (typeof data === "boolean") return [data];
			throw new ValidationError(`expected boolean but got ${data}`, options);
		});
		Schema.extend("bitset", (data, { bits, meta }, options) => {
			let value = 0, keys = [];
			if (typeof data === "number") {
				value = data;
				for (const key in bits) if (data & bits[key]) keys.push(key);
			} else if (Array.isArray(data)) {
				keys = data;
				for (const key of keys) {
					if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
					if (key in bits) value |= bits[key];
				}
			} else throw new ValidationError(`expected number or array but got ${data}`, options);
			if (value === meta.default) return [value];
			return [value, keys];
		});
		Schema.extend("function", (data, _, options) => {
			if (typeof data === "function") return [data];
			throw new ValidationError(`expected function but got ${data}`, options);
		});
		Schema.extend("is", (data, { constructor }, options) => {
			if (typeof constructor === "function") {
				if (data instanceof constructor) return [data];
				throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
			} else {
				if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
				let prototype = Object.getPrototypeOf(data);
				while (prototype) {
					if (prototype.constructor?.name === constructor) return [data];
					prototype = Object.getPrototypeOf(prototype);
				}
				throw new ValidationError(`expected ${constructor} but got ${data}`, options);
			}
		});
		function property(data, key, schema, options) {
			try {
				const [value, adapted] = Schema.resolve(data[key], schema, {
					...options,
					path: [...options.path || [], key]
				});
				if (adapted !== void 0) data[key] = adapted;
				return value;
			} catch (e) {
				if (!options?.autofix) throw e;
				delete data[key];
				return schema.meta.volatile ? createVolatile(schema.meta.default) : schema.meta.default;
			}
		}
		Schema.extend("array", (data, { inner, meta }, options) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
			return [data.map((_, index) => property(data, index, inner, options))];
		});
		Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in data) {
				let rKey;
				try {
					rKey = Schema.resolve(key, sKey, options)[0];
				} catch (error) {
					if (strict) continue;
					throw error;
				}
				result[rKey] = property(data, key, inner, options);
				data[rKey] = data[key];
				if (key !== rKey) delete data[key];
			}
			return [result];
		});
		Schema.extend("tuple", (data, { list }, options, strict) => {
			if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
			const result = list.map((inner, index) => property(data, index, inner, options));
			if (strict) return [result];
			result.push(...data.slice(list.length));
			return [result];
		});
		function merge(result, data) {
			for (const key in data) {
				if (key in result) continue;
				result[key] = data[key];
			}
		}
		Schema.extend("object", (data, { dict }, options, strict) => {
			if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
			const result = {};
			for (const key in dict) {
				const value = property(data, key, dict[key], options);
				if (!isNullable(value) || key in data) result[key] = value;
			}
			if (!strict) merge(result, data);
			return [result];
		});
		Schema.extend("union", (data, { list, toString }, options, strict) => {
			const messages = [];
			for (const inner of list) try {
				return Schema.resolve(data, inner, options, strict);
			} catch (error) {
				messages.push(error);
			}
			throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		});
		Schema.extend("intersect", (data, { list, toString }, options, strict) => {
			if (!list.length) return [data];
			let result;
			for (const inner of list) {
				const value = Schema.resolve(data, inner, options, true)[0];
				if (isNullable(value)) continue;
				if (isNullable(result)) result = value;
				else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
				else if (typeof value === "object") merge(result ??= {}, value);
				else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			}
			if (!strict && isPlainObject(data)) merge(result, data);
			return [result];
		});
		Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
			const [result, adapted = data] = Schema.resolve(data, inner, options, true);
			if (preserve) return [callback(result)];
			else return [callback(result), callback(adapted)];
		});
		const formatters = {};
		function defineMethod(name, keys, format) {
			formatters[name] = format;
			Object.assign(Schema, { [name](...args) {
				const schema = new Schema({ type: name });
				keys.forEach((key, index) => {
					switch (key) {
						case "sKey":
							schema.sKey = args[index] ?? Schema.string();
							break;
						case "inner":
							schema.inner = Schema.from(args[index]);
							break;
						case "list":
							schema.list = args[index].map(Schema.from);
							break;
						case "dict":
							schema.dict = mapValues(args[index], Schema.from);
							break;
						case "bits":
							schema.bits = {};
							for (const key in args[index]) {
								if (typeof args[index][key] !== "number") continue;
								schema.bits[key] = args[index][key];
							}
							break;
						case "callback": {
							const callback = schema.callback = args[index];
							callback["toJSON"] ||= () => callback.toString();
							break;
						}
						case "constructor": {
							const constructor = schema.constructor = args[index];
							if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
							break;
						}
						default: schema[key] = args[index];
					}
				});
				if (name === "object" || name === "dict") schema.meta.default = {};
				else if (name === "array" || name === "tuple") schema.meta.default = [];
				else if (name === "bitset") schema.meta.default = 0;
				return schema;
			} });
		}
		defineMethod("is", ["constructor"], ({ constructor }) => {
			if (typeof constructor === "function") return constructor.name;
			else return constructor;
		});
		defineMethod("any", [], () => "any");
		defineMethod("never", [], () => "never");
		defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
		defineMethod("string", [], () => "string");
		defineMethod("number", [], () => "number");
		defineMethod("boolean", [], () => "boolean");
		defineMethod("bitset", ["bits"], () => "bitset");
		defineMethod("function", [], () => "function");
		defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
		defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
		defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
		defineMethod("object", ["dict"], ({ dict }) => {
			if (Object.keys(dict).length === 0) return "{}";
			return `{ ${Object.entries(dict).map(([key, inner]) => {
				return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
			}).join(", ")} }`;
		});
		defineMethod("union", ["list"], ({ list }, inline) => {
			const result = list.map(({ toString: format }) => format()).join(" | ");
			return inline ? `(${result})` : result;
		});
		defineMethod("intersect", ["list"], ({ list }) => {
			return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
		});
		defineMethod("transform", [
			"inner",
			"callback",
			"preserve"
		], ({ inner }, isInner) => inner.toString(isInner));
		//#endregion
		//#region lib/types/client/config.js
		/** Refresh cadence shared by the Host bundle anchor and browser entry. */
		/** Browser polling policy while a listed run is active. */
		const Config = Schema.object({ refreshIntervalMs: Schema.natural().min(1).max(2147483647).default(2e3).volatile() });
		//#endregion
		//#region lib/types/client/index.js
		/**
		* @param ctx - browser plugin context.
		* @param config - validated active-run refresh cadence.
		* @returns disposer joining sidebar and Remote withdrawal.
		*/
		async function apply(ctx, config = Config({})) {
			return await mountAntfarm(ctx, TYPERT_REMOTE, config);
		}
		//#endregion
		exports.Config = Config;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map