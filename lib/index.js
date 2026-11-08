import z from "@deepseek-ai/schemastery";
//#region lib/types/client/config.js
/** Refresh cadence shared by the Host bundle anchor and browser entry. */
/** Browser polling policy while a listed run is active. */
const Config = z.object({ refreshIntervalMs: z.natural().min(1).max(2147483647).default(2e3).volatile() });
//#endregion
//#region lib/types/index.js
/** Bundle root; runtime contributions are mounted through subpath rows. */
const name = "dsh-antfarm-bundle";
/** Root bundle entry contributes no runtime behavior. */
function apply() {}
//#endregion
export { Config, apply, name };
