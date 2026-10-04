import { n as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CN-evIEF.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { n as flagOn } from "./flag-DVQH6hUb.mjs";
import { o as deskMiddleware } from "./access-CeCitFku.mjs";
import { hn as object, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { t as normalizeName } from "./norm-_aMMQVT6.mjs";
import { t as DEFAULT_REPS } from "./rep-match-CXphEIs2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reps-aLO38X9q.js
async function ensureReps(sql) {
	await sql.query(`
    create table if not exists desk_reps (
      id serial primary key,
      name text not null,
      initials text not null,
      active boolean not null default true,
      sort_order int not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`);
	try {
		await sql.query("create unique index if not exists desk_reps_name_lower_uidx on desk_reps (lower(name))");
	} catch {}
	const existing = await sql.query("select name, initials from desk_reps");
	if (!existing.length) {
		let order = 10;
		for (const r of DEFAULT_REPS) {
			await sql.query(`insert into desk_reps (name, initials, active, sort_order) values ($1, $2, true, $3)`, [
				r.name,
				r.initials,
				order
			]);
			order += 10;
		}
		return;
	}
	for (const r of DEFAULT_REPS) if (!existing.find((e) => normalizeName(e.name) === normalizeName(r.name) || normalizeName(e.initials) === normalizeName(r.initials))) {
		const max = await sql.query("select coalesce(max(sort_order), 0)::int as n from desk_reps");
		await sql.query(`insert into desk_reps (name, initials, active, sort_order) values ($1, $2, true, $3)`, [
			r.name,
			r.initials,
			(max[0]?.n ?? 0) + 10
		]);
	}
}
async function loadReps(sql) {
	await ensureReps(sql);
	const rows = await sql.query("select id, name, initials, active, sort_order from desk_reps order by sort_order, id");
	if (!rows.length) return DEFAULT_REPS.map((r, i) => ({
		id: i + 1,
		name: r.name,
		initials: r.initials,
		active: true,
		sortOrder: (i + 1) * 10
	}));
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		initials: r.initials,
		active: flagOn(r.active),
		sortOrder: r.sort_order
	}));
}
var listReps_createServerFn_handler = createServerRpc({
	id: "d2f0c01fa586ab0280a9d2571d6e36996bd105984cf8317054ca9844291a521a",
	name: "listReps",
	filename: "src/lib/ops/reps.ts"
}, (opts) => listReps.__executeServer(opts));
var listReps = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listReps_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const { canUserEditRoster } = await import("./roster-B3a8030i.mjs").then((n) => n.a);
	return {
		reps: await loadReps(sql),
		canEdit: await canUserEditRoster(sql, context.userId)
	};
});
var addRep_createServerFn_handler = createServerRpc({
	id: "8dc5f4484e42250633d38357b1e51e8f9a79cf8765bdb03de157067e5e570a90",
	name: "addRep",
	filename: "src/lib/ops/reps.ts"
}, (opts) => addRep.__executeServer(opts));
var addRep = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	name: string().min(1),
	initials: string().min(1)
}).parse(d)).handler(addRep_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const { requireRosterEditor } = await import("./roster-B3a8030i.mjs").then((n) => n.a);
	await requireRosterEditor(sql, context.userId);
	const name = data.name.trim().replace(/\s+/g, " ");
	const initials = data.initials.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
	if (name.length < 2) throw new Error("Enter a full name.");
	if (initials.length < 2) throw new Error("Enter initials (two letters).");
	const found = await sql.query("select id from desk_reps where lower(name) = $1 or lower(initials) = $2 limit 1", [name, initials]);
	if (found[0]) await sql.query("update desk_reps set active = true, name = $2, initials = $3, updated_at = now() where id = $1", [
		found[0].id,
		name,
		initials
	]);
	else {
		const max = await sql.query("select coalesce(max(sort_order), 0)::int as n from desk_reps");
		await sql.query(`insert into desk_reps (name, initials, active, sort_order) values ($1, $2, true, $3)`, [
			name,
			initials,
			(max[0]?.n ?? 0) + 10
		]);
	}
	return {
		reps: await loadReps(sql),
		canEdit: true
	};
});
var setRepActive_createServerFn_handler = createServerRpc({
	id: "87ac9452e7d2cfc8ff048a7f556a4cb201fe948dfb3c427d26b54fb0668828a5",
	name: "setRepActive",
	filename: "src/lib/ops/reps.ts"
}, (opts) => setRepActive.__executeServer(opts));
var setRepActive = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(setRepActive_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const { requireRosterEditor } = await import("./roster-B3a8030i.mjs").then((n) => n.a);
	await requireRosterEditor(sql, context.userId);
	await sql.query("update desk_reps set active = $2, updated_at = now() where id = $1", [data.id, data.active]);
	return {
		reps: await loadReps(sql),
		canEdit: true
	};
});
//#endregion
export { addRep_createServerFn_handler, listReps_createServerFn_handler, setRepActive_createServerFn_handler };
