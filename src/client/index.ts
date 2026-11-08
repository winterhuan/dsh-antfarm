/** Browser entry: mount the run-inspection Remote and the Antfarm sidebar. */
import type { Context } from '@deepseek-ai/cordis'
import antfarmRemote from 'dsh-antfarm/remote'
import { mountAntfarm } from './mount.tsx'
import { Config } from './config.ts'

export { Config } from './config.ts'
export { inject } from './mount.tsx'

/**
 * @param ctx - browser plugin context.
 * @param config - validated active-run refresh cadence.
 * @returns disposer joining sidebar and Remote withdrawal.
 */
export async function apply(ctx: Context, config: Config = Config({})): Promise<() => Promise<void>> {
  return await mountAntfarm(ctx, antfarmRemote, config)
}
