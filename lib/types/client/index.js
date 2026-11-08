import antfarmRemote from 'dsh-antfarm/remote';
import { mountAntfarm } from "./mount.js";
import { Config } from "./config.js";
export { Config } from "./config.js";
export { inject } from "./mount.js";
/**
 * @param ctx - browser plugin context.
 * @param config - validated active-run refresh cadence.
 * @returns disposer joining sidebar and Remote withdrawal.
 */
export async function apply(ctx, config = Config({})) {
    return await mountAntfarm(ctx, antfarmRemote, config);
}
//# sourceMappingURL=index.js.map