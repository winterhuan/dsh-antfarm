/** Refresh cadence shared by the Host bundle anchor and browser entry. */
import z from '@deepseek-ai/schemastery'

/** Browser polling policy while a listed run is active. */
export const Config = z.object({
  refreshIntervalMs: z.natural().min(1).max(2_147_483_647).default(2000).volatile(),
})

/** Native dynamic polling policy. */
export type Config = ReturnType<typeof Config>
