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
			chooseWorkflow: "Choose a workflow",
			task: "Task and constraints",
			startRun: "Start run",
			launchHelp: "Review the selected workflow before starting. Its declared delivery actions are part of this run.",
			editWorkflow: "Configure workflow",
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
			chooseWorkflow: "选择工作流",
			task: "任务与约束",
			startRun: "启动运行",
			launchHelp: "启动前检查所选工作流，其中声明的交付操作属于本次运行",
			editWorkflow: "配置工作流",
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
		//#region \0dsh-css:/Users/winter/dsh-creative/plugins/dsh-antfarm/src/client/RunsPanel.module.css.mjs
		const css = ".EucCCW_root{min-width:0;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);align-content:start;gap:12px;padding:16px;display:grid}.EucCCW_header{justify-content:space-between;align-items:center;gap:12px;display:flex}.EucCCW_heading{min-width:0}.EucCCW_heading h2,.EucCCW_heading p,.EucCCW_project,.EucCCW_details p,.EucCCW_empty p{margin:0}.EucCCW_heading h2,.EucCCW_details h3{font-size:inherit;font-weight:500}.EucCCW_heading p,.EucCCW_project,.EucCCW_secondary{color:var(--dsw-alias-label-secondary)}.EucCCW_project,.EucCCW_reason,.EucCCW_runId,.EucCCW_details dd{overflow-wrap:anywhere}.EucCCW_project{border-bottom:.5px solid var(--dsw-alias-border-l3);padding-bottom:8px}.EucCCW_run{min-width:0}.EucCCW_runHeader{min-height:32px}.EucCCW_runContent{flex:1;min-width:0}.EucCCW_runLabels{justify-content:space-between;align-items:center;gap:8px;width:100%;display:flex}.EucCCW_runTitle{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.EucCCW_status{color:var(--dsw-alias-label-secondary);flex:none;align-items:center;gap:4px;display:flex}.EucCCW_details{gap:12px;min-width:0;padding:12px 0;display:grid}.EucCCW_runId{color:var(--dsw-alias-label-secondary);font-family:var(--dsw-font-mono)}.EucCCW_details dl{grid-template-columns:auto minmax(0,1fr);gap:6px 12px;margin:0;display:grid}.EucCCW_details dt{color:var(--dsw-alias-label-secondary)}.EucCCW_details dd{margin:0}.EucCCW_details h3{margin:0 0 8px}.EucCCW_stories,.EucCCW_children{min-width:0}.EucCCW_story{border-top:.5px solid var(--dsw-alias-border-l3);grid-template-columns:minmax(0,1fr) auto;gap:6px 8px;padding:8px 0;display:grid}.EucCCW_story p{white-space:pre-wrap;grid-column:1/-1}.EucCCW_reason{white-space:pre-wrap}.EucCCW_children{gap:6px;display:grid}.EucCCW_form{gap:8px;min-width:0;display:grid}.EucCCW_form label{color:var(--dsw-alias-label-secondary);gap:6px;display:grid}.EucCCW_root input,.EucCCW_root select,.EucCCW_root textarea{box-sizing:border-box;width:100%;min-width:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-l2);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);font:inherit;padding:8px}.EucCCW_root textarea{resize:vertical;min-height:80px}.EucCCW_root .EucCCW_editor{min-height:240px;font-family:var(--dsw-font-mono)}.EucCCW_actions,.EucCCW_filters{flex-wrap:wrap;gap:8px;display:flex}.EucCCW_filters input{flex:1}.EucCCW_filters select{width:auto;max-width:100%}.EucCCW_output{white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--dsw-font-mono);max-height:320px;margin:8px 0;overflow:auto}.EucCCW_events{margin:8px 0;padding-left:20px}.EucCCW_board{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);align-content:start;gap:16px;padding:24px;display:grid;overflow:auto}.EucCCW_board h1,.EucCCW_column h2{font-size:inherit;margin:0;font-weight:500}.EucCCW_board select{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-l2);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);padding:8px}.EucCCW_columns{grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:16px;display:grid}.EucCCW_column{align-content:start;gap:12px;min-width:0;display:grid}.EucCCW_card{text-align:start;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-l2);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);font:inherit;overflow-wrap:anywhere;cursor:pointer;gap:8px;padding:12px;display:grid}.EucCCW_card[aria-expanded=true]{border-color:var(--dsw-alias-label-link)}[data-platform=darwin] .EucCCW_board{padding-top:calc(var(--dsh-frame-top-clearance,0px) + 24px)}.EucCCW_form .EucCCW_notice{display:grid}.EucCCW_details details{min-width:0}.EucCCW_root :focus-visible{outline:2px solid var(--dsw-alias-label-link);outline-offset:2px}.EucCCW_child{text-overflow:ellipsis;justify-content:flex-start;min-width:0;overflow:hidden}.EucCCW_notice{color:var(--dsw-alias-label-secondary);justify-content:space-between;align-items:center;gap:8px;display:flex}.EucCCW_empty{color:var(--dsw-alias-label-secondary);gap:8px;padding:24px 0;display:grid}.EucCCW_pending{justify-content:center;padding:16px;display:flex}.EucCCW_skeleton{gap:16px;padding:12px 0;display:grid}.EucCCW_skeleton span{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-skeleton);height:12px;animation:2s cubic-bezier(.36,0,.64,1) infinite EucCCW_antfarm-skeleton}.EucCCW_skeleton span:last-child{width:60%}@keyframes EucCCW_antfarm-skeleton{0%,80%,to{opacity:1}40%{opacity:.6}}@media (prefers-reduced-motion:reduce){.EucCCW_skeleton span{animation:none}}.EucCCW_artifactImage{object-fit:contain;border-radius:var(--dsh-radius-md);width:100%;height:auto}";
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
			"story": "EucCCW_story"
		};
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
			const id = selected.owner === owner ? selected.id : "";
			const ids = catalog.owner === owner ? catalog.ids : [];
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
					if (edited) {
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
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: pending || id === "" || source?.id !== id || source.enabled === false || task.trim() === "" || dirty,
							onClick: () => {
								start();
							},
							children: t("startRun")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							disabled: id === "" || draft === null,
							onClick: () => {
								setEditor(!editor);
								operations.rememberDraft(owner, { editor: !editor });
							},
							children: t("editWorkflow")
						})]
					}),
					error !== "" && (0, react_jsx_runtime.jsx)("p", {
						className: RunsPanel_module_css_default.notice,
						role: "status",
						children: error
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
								children: [
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "sm",
										disabled: pending || !dirty,
										onClick: () => {
											save();
										},
										children: t("save")
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "sm",
										disabled: pending,
										onClick: () => {
											if (dirty) setDiscard(true);
											else setReload((value) => value + 1);
										},
										children: t("reload")
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "sm",
										disabled: pending || dirty,
										onClick: () => {
											setDiscard(true);
										},
										children: t("restoreInherited")
									})
								]
							}),
							dirty && (0, react_jsx_runtime.jsx)("p", {
								className: RunsPanel_module_css_default.secondary,
								children: t("unsavedDraft")
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
					(0, react_jsx_runtime.jsxs)("label", { children: [t("workflow"), (0, react_jsx_runtime.jsxs)("select", {
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
					})] }),
					state.failed && (0, react_jsx_runtime.jsx)("p", {
						role: "status",
						children: t("loadError")
					}),
					state.rows.length === 0 && !state.loading && (0, react_jsx_runtime.jsx)("p", { children: t("emptyBoard") }),
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