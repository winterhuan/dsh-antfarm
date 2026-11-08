/** Browser entry: mount the run-inspection Remote and the Antfarm sidebar. */
import type { Context } from '@deepseek-ai/cordis';
import { Config } from './config.ts';
export { Config } from './config.ts';
export { inject } from './mount.tsx';
/**
 * @param ctx - browser plugin context.
 * @param config - validated active-run refresh cadence.
 * @returns disposer joining sidebar and Remote withdrawal.
 */
export declare function apply(ctx: Context, config?: Config): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map