/** Session-scoped Antfarm sidebar registration and Remote lifetime. */
import type { Context } from '@deepseek-ai/cordis';
import type { TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { Config } from './config.ts';
/** Browser services required before mounting the plugin's own Remote. */
export declare const inject: string[];
/**
 * Mount the plugin's own Remote before registering sidebar readers.
 * @param ctx - browser plugin context.
 * @param contribution - generated Antfarm Remote descriptors.
 * @param config - active-run refresh policy.
 * @returns disposer joining UI and Remote withdrawal, including setup rollback.
 */
export declare function mountAntfarm(ctx: Context, contribution: TypertRemoteContribution, config: Config): Promise<() => Promise<void>>;
//# sourceMappingURL=mount.d.ts.map