var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
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
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { installModelSelection } from '@deepseek-ai/dsh-agent';
/** Native handles are owned only when Antfarm itself resumed them. */
export class RunOwnerResolver {
    ctx;
    pending = new Map();
    owned = new Map();
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
        if (live !== undefined)
            return this.root(live, id);
        let pending = this.pending.get(id);
        if (pending === undefined) {
            pending = this.restore(id).finally(() => { this.pending.delete(id); });
            this.pending.set(id, pending);
        }
        const agent = await pending;
        this.allowed(id);
        return this.root(agent, id);
    }
    allowed(id) {
        if (this.closing)
            throw new Error('antfarm owner resolver is closing');
        if (this.ctx.get('workspaceRegistry')?.archivedSessionIds.includes(id))
            throw new Error('restore the archived owning session before resuming antfarm');
    }
    root(agent, id) {
        if (agent.id !== id || this.ctx.agents.get(id) !== agent)
            throw new Error('antfarm owner changed while resolving execution authority');
        if (agent.session.header.origin === 'subagent')
            throw new Error('antfarm requires a root owning session');
        return agent;
    }
    async restore(id) {
        const env_1 = { stack: [], error: void 0, hasError: false };
        try {
            const controller = this.ctx.get('sessionController');
            if (controller !== undefined) {
                const result = await controller.resolveAgent(id);
                if ('error' in result)
                    throw result.error;
                return result.agent;
            }
            const query = this.ctx.get('sessionQuery');
            if (query === undefined)
                throw new Error('cold antfarm owner recovery requires native Session query or Session controller');
            const observation = __addDisposableResource(env_1, await query.observeSession(id), false);
            this.allowed(id);
            if (observation.header.origin === 'subagent')
                throw new Error('antfarm cannot resume a subagent as its owner');
            const preset = observation.projections?.values.agentPreset;
            if (preset !== null && preset !== undefined && (typeof preset !== 'string' || preset === ''))
                throw new Error('persisted antfarm owner has an invalid native Agent preset');
            const handle = await this.ctx.agents.resume({
                resumeSessionId: id,
                setup: async (agentCtx) => {
                    installModelSelection(agentCtx);
                    // Native headless roots inherit their profile and have no selected preset.
                    if (typeof preset === 'string')
                        await this.ctx.agentPresets.mount(agentCtx, preset);
                },
            });
            this.owned.set(id, handle);
            if (this.closing) {
                await handle.dispose();
                this.owned.delete(id);
                throw new Error('antfarm owner recovery was disposed');
            }
            return handle.agent;
        }
        catch (e_1) {
            env_1.error = e_1;
            env_1.hasError = true;
        }
        finally {
            __disposeResources(env_1);
        }
    }
    /** Wait for in-flight restores, then dispose only handles created by this resolver. */
    async dispose() {
        this.closing = true;
        await Promise.allSettled(this.pending.values());
        await Promise.all([...this.owned.values()].map(handle => handle.dispose()));
        this.owned.clear();
    }
}
//# sourceMappingURL=owner.js.map