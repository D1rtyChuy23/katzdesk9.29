import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as createServerFn } from "./ssr.mjs";
import { n as flagOn } from "./flag-DVQH6hUb.mjs";
import { i as createSsrRpc, o as deskMiddleware } from "./access-CeCitFku.mjs";
import { r as parseMentions } from "./mentions-Cvlq5S1G.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/notify-CxtUIjWw.js
var notify_CxtUIjWw_exports = /* @__PURE__ */ __exportAll({
	a: () => notifyAdminsModuleReturn,
	c: () => notify_exports,
	i: () => markNotificationRead,
	l: () => sendPing,
	n: () => listNotifications,
	o: () => notifyAdminsRackReview,
	r: () => listTeammates,
	s: () => notifyAdminsStockRequest,
	t: () => deliverPings
});
var notify_exports = /* @__PURE__ */ __exportAll$1({
	deliverPings: () => deliverPings,
	listNotifications: () => listNotifications,
	listTeammates: () => listTeammates,
	markNotificationRead: () => markNotificationRead,
	notifyAdminsModuleReturn: () => notifyAdminsModuleReturn,
	notifyAdminsRackReview: () => notifyAdminsRackReview,
	notifyAdminsStockRequest: () => notifyAdminsStockRequest,
	sendPing: () => sendPing
});
/**
* Resolve every ping to a record that still exists — the record itself, else its account,
* else the board it came from. One query per record type, so the 8-second refresh stays cheap.
*/
async function ensureTable(sql) {
	await sql.query(`
    create table if not exists desk_notifications (
      id            serial primary key,
      user_id       text not null,
      from_user_id  text,
      from_name     text,
      body          text not null,
      entity_type   text,
      entity_id     int,
      comment_id    int,
      read          boolean not null default false,
      created_at    timestamptz not null default now()
    )`);
	await sql.query("alter table desk_notifications add column if not exists comment_id int");
	await sql.query("alter table desk_notifications add column if not exists customer text");
	await sql.query("create index if not exists desk_notifications_inbox_idx on desk_notifications (user_id, read, created_at desc)");
	await sql.query(`
    create unique index if not exists desk_notifications_comment_once_idx
    on desk_notifications (user_id, comment_id)
    where comment_id is not null
  `).catch(() => void 0);
}
async function loadFromName(sql, userId) {
	const me = await sql.query(`select a.username, u.name
     from desk_accounts a
     left join "user" u on u.id = a.user_id
     where a.user_id = $1`, [userId]);
	return me[0]?.username || me[0]?.name || "Teammate";
}
async function resolveCustomer(sql, entityType, entityId) {
	if (!entityType || entityId == null) return null;
	const type = entityType;
	const id = entityId;
	try {
		if (type === "service" || type === "tlc") return (await sql.query("select customer from service_jobs where id = $1", [id]))[0]?.customer ?? null;
		if (type === "pm") return (await sql.query("select customer from pm_jobs where id = $1", [id]))[0]?.customer ?? null;
		if (type === "install") return (await sql.query("select customer from installs where id = $1", [id]))[0]?.customer ?? null;
		if (type === "deal") return (await sql.query("select customer from deals where id = $1", [id]))[0]?.customer ?? null;
		if (type === "rebuild") return (await sql.query("select account from rebuilds where id = $1", [id]))[0]?.account ?? "Katz shop / stock";
		if (type === "handoff") {
			const r = await sql.query("select entity_type, entity_id from comments where id = $1", [id]);
			if (r[0]) return resolveCustomer(sql, r[0].entity_type, r[0].entity_id);
		}
	} catch {
		return null;
	}
	return null;
}
/** Tell every admin that Warehouse put a unit on a rack slot. Admins are not notified about their own adds. */
async function notifyAdminsRackReview(sql, fromUserId, asset) {
	await ensureTable(sql);
	const row = (await sql.query("select is_admin, desk_role, username from desk_accounts where user_id = $1", [fromUserId]))[0];
	if (!row || flagOn(row.is_admin) || row.desk_role !== "warehouse") return;
	const who = row.username || "Warehouse";
	const serial = asset.serial?.trim() ? ` SN ${asset.serial.trim()}` : "";
	const body = `Needs review. ${who} added ${asset.model}${serial} to ${asset.slot}.`;
	const admins = await sql.query("select user_id, is_admin, approved from desk_accounts where user_id <> $1", [fromUserId]);
	for (const admin of admins) {
		if (!flagOn(admin.is_admin) || !flagOn(admin.approved)) continue;
		await sql.query(`insert into desk_notifications (user_id, from_user_id, from_name, body, customer, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, 'asset', $6)`, [
			admin.user_id,
			fromUserId,
			who,
			body,
			asset.slot,
			asset.id
		]);
	}
}
/** Tell every admin that Warehouse asked to bring an assigned Eversys module back to HQ. */
async function notifyAdminsModuleReturn(sql, fromUserId, mod) {
	await ensureTable(sql);
	const who = (await sql.query("select username from desk_accounts where user_id = $1", [fromUserId]))[0]?.username || "Warehouse";
	const body = `Pending module return. ${who} wants ${mod.moduleType ?? "module"} ${mod.moduleId} back at HQ from ${mod.customer || "an account"}.`;
	const admins = await sql.query("select user_id, is_admin, approved from desk_accounts where user_id <> $1", [fromUserId]);
	for (const admin of admins) {
		if (!flagOn(admin.is_admin) || !flagOn(admin.approved)) continue;
		await sql.query(`insert into desk_notifications (user_id, from_user_id, from_name, body, customer, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, 'module', $6)`, [
			admin.user_id,
			fromUserId,
			who,
			body,
			mod.customer,
			mod.id
		]);
	}
}
/** Tell every admin that Warehouse asked to remove a unit or send it to a customer. */
async function notifyAdminsStockRequest(sql, fromUserId, asset) {
	await ensureTable(sql);
	const row = (await sql.query("select is_admin, desk_role, username from desk_accounts where user_id = $1", [fromUserId]))[0];
	if (!row || flagOn(row.is_admin) || row.desk_role !== "warehouse") return;
	const who = row.username || "Warehouse";
	const serial = asset.serial?.trim() ? ` SN ${asset.serial.trim()}` : "";
	const body = asset.kind === "remove" ? `Pending removal. ${who} asked to remove ${asset.model}${serial} from ${asset.slot}. Reason: ${asset.reason || "—"}.` : `Pending customer assign. ${who} wants ${asset.model}${serial} from ${asset.slot} to go to ${asset.customer || "an account"}.`;
	const admins = await sql.query("select user_id, is_admin, approved from desk_accounts where user_id <> $1", [fromUserId]);
	for (const admin of admins) {
		if (!flagOn(admin.is_admin) || !flagOn(admin.approved)) continue;
		await sql.query(`insert into desk_notifications (user_id, from_user_id, from_name, body, customer, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, 'asset', $6)`, [
			admin.user_id,
			fromUserId,
			who,
			body,
			asset.kind === "assign" ? asset.customer ?? asset.slot : asset.slot,
			asset.id
		]);
	}
}
function previewLine(body) {
	return (body.split(/\r?\n/).map((s) => s.trim()).find((s) => s && !/^follow up:/i.test(s)) || body.trim()).slice(0, 160);
}
async function deliverPings(sql, opts) {
	await ensureTable(sql);
	const body = opts.body.trim();
	if (!body) throw new Error("Write a short reminder.");
	const commentId = opts.commentId ?? null;
	if (commentId) {
		const prior = await sql.query("select pinged_at from comments where id = $1", [commentId]);
		if (prior[0]?.pinged_at) return {
			sent: [],
			already: true,
			pingedAt: String(prior[0].pinged_at)
		};
	}
	const destIds = new Set(opts.toUserIds ?? []);
	const names = [...opts.usernames ?? [], ...parseMentions(body)];
	if (names.length) {
		const lowered = [...new Set(names.map((n) => n.toLowerCase()))];
		const placeholders = lowered.map((_, i) => `$${i + 1}`).join(", ");
		const rows = await sql.query(`select user_id, username from desk_accounts
       where approved = true and lower(username) in (${placeholders})`, lowered);
		for (const r of rows) destIds.add(r.user_id);
	}
	destIds.delete(opts.fromUserId);
	if (!destIds.size) throw new Error("Tag a teammate with @username, or pick someone to ping.");
	if (commentId) {
		if ((await sql.query("select user_id from desk_notifications where comment_id = $1", [commentId])).length) {
			const when = await sql.query("select pinged_at from comments where id = $1", [commentId]);
			return {
				sent: [],
				already: true,
				pingedAt: when[0]?.pinged_at ? String(when[0].pinged_at) : null
			};
		}
	}
	const fromName = await loadFromName(sql, opts.fromUserId);
	const customer = await resolveCustomer(sql, opts.entityType, opts.entityId);
	const bodyPreview = previewLine(body);
	const sent = [];
	let pingedAt = null;
	for (const toUserId of destIds) {
		const dest = await sql.query("select username from desk_accounts where user_id = $1 and approved = true", [toUserId]);
		if (!dest[0]) continue;
		const ins = await sql.query(`insert into desk_notifications (user_id, from_user_id, from_name, body, customer, entity_type, entity_id, comment_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning created_at`, [
			toUserId,
			opts.fromUserId,
			fromName,
			bodyPreview.slice(0, 400),
			customer,
			opts.entityType ?? null,
			opts.entityId ?? null,
			commentId
		]);
		pingedAt = ins[0] ? String(ins[0].created_at) : pingedAt;
		sent.push(dest[0].username);
	}
	if (!sent.length) throw new Error("That teammate isn’t on the desk yet.");
	if (commentId) {
		const marked = await sql.query(`update comments
       set pinged_at = coalesce(pinged_at, now()), pinged_by = $2
       where id = $1
       returning pinged_at`, [commentId, fromName]);
		pingedAt = marked[0] ? String(marked[0].pinged_at) : pingedAt;
	}
	return {
		sent,
		already: false,
		pingedAt
	};
}
var listTeammates = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("a2740b848ef9c54b6428a57334fbbd0f61d274e6551140fc955d08887c16be68"));
var listNotifications = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("ded79099149d28ceb2e0ac0581c7618a59799ce73cd3dabba2d833d972fc964c"));
var sendPing = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("c456a9cfefe23283df58ac4a6dc5cfa41978e3b8e360d899120bd94e5c2beec0"));
var markNotificationRead = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("3fa4ef685c6d3d148750b135b296ab3ac3416c337f4659f76d71f0268e425439"));
//#endregion
export { notifyAdminsModuleReturn as a, notify_CxtUIjWw_exports as c, markNotificationRead as i, sendPing as l, listNotifications as n, notifyAdminsRackReview as o, listTeammates as r, notifyAdminsStockRequest as s, deliverPings as t };
