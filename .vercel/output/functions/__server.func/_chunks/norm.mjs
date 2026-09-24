//#region src/lib/ops/norm.ts
/** Person-name compare key: trim, case-fold, drop apostrophes, collapse space. */
function normalizeName(raw) {
	return (raw ?? "").trim().toLowerCase().replace(/['’]/g, "").replace(/\s+/g, " ");
}
//#endregion
export { normalizeName as t };
