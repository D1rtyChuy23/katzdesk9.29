import { t as isWalkIn } from "./customer-key-BKZJDViL.mjs";
import { l as woCanonical, t as customersCompatible, u as woMatchKey } from "./corrigo-D4iGSjgV.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/wo-duplicates-D6UxQU4Y.js
var DUP_COLS = `
  id, kind, call_id, customer, contact, phone, equipment, issue, call_type,
  technician, wo, status, notes, work_done, completed_at, scheduled, received,
  urgency, done, duplicate_of
`;
function mergeNotes(keeper, extra) {
	const a = String(keeper ?? "").trim();
	const b = String(extra ?? "").trim();
	if (!a) return b || null;
	if (!b) return a;
	if (a.includes(b) || b.includes(a)) return a.length >= b.length ? a : b;
	return `${a}\n\n${b}`;
}
function keepFilled(keeper, extra) {
	if (String(keeper ?? "").trim()) return keeper ?? null;
	return String(extra ?? "").trim() ? extra ?? null : keeper ?? null;
}
function preferCustomer(keeper, extra) {
	const k = String(keeper ?? "").trim();
	const e = String(extra ?? "").trim();
	if (!k || isWalkIn(k)) return e || k || null;
	return k;
}
function mergeJobFields(keeper, extra) {
	const woSource = keeper.wo || extra.wo || "";
	return {
		customer: preferCustomer(keeper.customer, extra.customer),
		contact: keepFilled(keeper.contact, extra.contact),
		phone: keepFilled(keeper.phone, extra.phone),
		equipment: keepFilled(keeper.equipment, extra.equipment),
		issue: keepFilled(keeper.issue, extra.issue),
		call_type: keepFilled(keeper.call_type, extra.call_type),
		technician: keepFilled(keeper.technician, extra.technician),
		wo: woCanonical(woSource) || keeper.wo || extra.wo,
		notes: mergeNotes(keeper.notes, extra.notes),
		work_done: keepFilled(keeper.work_done, extra.work_done),
		completed_at: keepFilled(keeper.completed_at, extra.completed_at),
		scheduled: keepFilled(keeper.scheduled, extra.scheduled),
		received: keepFilled(keeper.received, extra.received),
		urgency: keepFilled(keeper.urgency, extra.urgency) || "Normal"
	};
}
async function loadJob(sql, id) {
	return (await sql.query(`select ${DUP_COLS} from service_jobs where id = $1`, [id]))[0] ?? null;
}
async function ultimateKeeper(sql, id) {
	const seen = /* @__PURE__ */ new Set();
	let row = await loadJob(sql, id);
	while (row?.duplicate_of && !seen.has(row.id)) {
		seen.add(row.id);
		row = await loadJob(sql, row.duplicate_of);
	}
	return row;
}
async function retargetThread(sql, keeper, extra) {
	await sql.query(`update comments
        set entity_type = $1, entity_id = $2
      where entity_id = $3 and entity_type in ('service', 'tlc')`, [
		keeper.kind,
		keeper.id,
		extra.id
	]);
	await sql.query(`update activity
        set entity_type = $1, entity_id = $2
      where entity_id = $3 and entity_type in ('service', 'tlc')`, [
		keeper.kind,
		keeper.id,
		extra.id
	]);
	await sql.query(`update desk_notifications
        set entity_type = $1, entity_id = $2
      where entity_id = $3 and entity_type in ('service', 'tlc')`, [
		keeper.kind,
		keeper.id,
		extra.id
	]).catch(() => void 0);
	await sql.query(`update assets set job_id = $1 where job_id = $2`, [keeper.id, extra.id]).catch(() => void 0);
}
/** Fold extra onto keeper. Notes are kept (appended if both have text). */
async function mergeServiceJobs(sql, keeperId, extraId, actor) {
	if (keeperId === extraId) return null;
	const keeper = await ultimateKeeper(sql, keeperId);
	const extra = await loadJob(sql, extraId);
	if (!keeper || !extra) return null;
	if (extra.id === keeper.id) return {
		keeperId: keeper.id,
		extraId
	};
	if (extra.duplicate_of === keeper.id) return {
		keeperId: keeper.id,
		extraId: extra.id
	};
	const next = mergeJobFields(keeper, extra);
	await sql.query(`update service_jobs set
        customer = $2, contact = $3, phone = $4, equipment = $5, issue = $6,
        call_type = $7, technician = $8, wo = $9, notes = $10, work_done = $11,
        completed_at = $12, scheduled = $13, received = $14, urgency = $15,
        updated_at = now()
      where id = $1`, [
		keeper.id,
		next.customer,
		next.contact,
		next.phone,
		next.equipment,
		next.issue,
		next.call_type,
		next.technician,
		next.wo,
		next.notes,
		next.work_done,
		next.completed_at,
		next.scheduled,
		next.received,
		next.urgency
	]);
	await retargetThread(sql, keeper, extra);
	await sql.query(`update service_jobs set duplicate_of = $2, updated_at = now() where id = $1`, [extra.id, keeper.id]);
	await sql.query(`update service_jobs set duplicate_of = $2, updated_at = now()
      where duplicate_of = $1`, [extra.id, keeper.id]);
	await sql.query(`insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ($1, $2, $3, 'merged', $4)`, [
		keeper.kind,
		keeper.id,
		actor,
		`Merged #${extra.id} (${extra.call_id}) into this ticket · ${next.wo || extra.wo || ""}`.trim()
	]);
	return {
		keeperId: keeper.id,
		extraId: extra.id
	};
}
async function tryMergeServiceDuplicate(sql, keeperId, extraId, actor) {
	if (keeperId === extraId) return "skipped";
	const keeper = await ultimateKeeper(sql, keeperId);
	const extra = await loadJob(sql, extraId);
	if (!keeper || !extra || extra.id === keeper.id) return "skipped";
	if (extra.duplicate_of) return extra.duplicate_of === keeper.id ? "merged" : "skipped";
	if (customersCompatible(keeper.customer, extra.customer)) {
		await mergeServiceJobs(sql, keeper.id, extra.id, actor);
		return "merged";
	}
	return "flagged";
}
async function reconcileServiceDuplicates(sql, actor) {
	const rows = await sql.query(`select ${DUP_COLS} from service_jobs
      where coalesce(wo, '') <> '' and duplicate_of is null
      order by id`);
	const groups = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const key = woMatchKey(row.wo ?? "");
		if (!key) continue;
		const list = groups.get(key) ?? [];
		list.push(row);
		groups.set(key, list);
	}
	let merged = 0;
	let flagged = 0;
	for (const list of groups.values()) {
		if (list.length < 2) continue;
		const keeper = [...list].sort((a, b) => a.id - b.id)[0];
		for (const extra of list) {
			if (extra.id === keeper.id) continue;
			const result = await tryMergeServiceDuplicate(sql, keeper.id, extra.id, actor);
			if (result === "merged") merged += 1;
			else if (result === "flagged") flagged += 1;
		}
	}
	return {
		merged,
		flagged
	};
}
//#endregion
export { reconcileServiceDuplicates as n, tryMergeServiceDuplicate as r, mergeServiceJobs as t };
