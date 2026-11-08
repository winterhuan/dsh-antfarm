/** Refresh cadence shared by the Host bundle anchor and browser entry. */
import z from '@deepseek-ai/schemastery';
/** Browser polling policy while a listed run is active. */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    refreshIntervalMs: z<number, number, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    refreshIntervalMs: z<number, number, "volatile-defined">;
}>>, "plain">;
/** Native dynamic polling policy. */
export type Config = ReturnType<typeof Config>;
//# sourceMappingURL=config.d.ts.map