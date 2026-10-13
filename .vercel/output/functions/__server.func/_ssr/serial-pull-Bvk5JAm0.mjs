import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as createServerFn } from "./ssr.mjs";
import { i as createSsrRpc, o as deskMiddleware } from "./access-CeCitFku.mjs";
import { hn as object, mn as number, un as boolean, yn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/serial-pull-Bvk5JAm0.js
var serial_pull_exports = /* @__PURE__ */ __exportAll({
	applySerialPull: () => applySerialPull,
	ensureSerialNotice: () => ensureSerialNotice,
	serialKey: () => serialKey
});
function serialKey(raw) {
	return (raw ?? "").trim().replace(/[#\s]/g, "").toLowerCase();
}
async function ensureSerialNotice(sql) {
	await sql.query("alter table installs add column if not exists serial_notice text");
	await sql.query("alter table service_jobs add column if not exists serial_notice text");
}
var lookupInput = object({ serial: string() });
createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => lookupInput.parse(d)).handler(createSsrRpc("a2be120d24b496c9ca826bddbada5f554f8e954eb24b11175e7e0eec6edf6dd7"));
var applyInput = object({
	serial: string().min(1),
	installId: number().optional(),
	jobId: number().optional(),
	machineIndex: number().nullable().optional(),
	confirmReuse: boolean().optional()
});
var applySerialPull = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => applyInput.parse(d)).handler(createSsrRpc("17e1ebba74c445a1c0bae46dabb84f892f047cc2924e56c1221b2dad8e1a8c7a"));
//#endregion
export { serialKey as n, serial_pull_exports as r, applySerialPull as t };
