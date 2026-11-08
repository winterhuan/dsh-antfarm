//#region lib/types/invariant.js
/** Runtime invariant manifest for the dsh-antfarm bundle. */
const invariant = {
	name: "dsh-antfarm",
	reason: "The runtime service and tool consumer are mounted as separate bundle rows; their live relationship is validated by the real-composition smoke test."
};
//#endregion
export { invariant as default, invariant };
