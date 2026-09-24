import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { r as getSql } from "./db-B30u4tE3.mjs";
import { o as deskMiddleware } from "./access-Bds4AN6g.mjs";
import { r as parseMentions } from "./mentions-Cvlq5S1G.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/notify-coBGJ0rJ.js
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
var listTeammates_createServerFn_handler = createServerRpc({
	id: "a2740b848ef9c54b6428a57334fbbd0f61d274e6551140fc955d08887c16be68",
	name: "listTeammates",
	filename: "src/lib/ops/notify.ts"
}, (opts) => listTeammates.__executeServer(opts));
var listTeammates = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listTeammates_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	return (await sql.query(`select user_id, username, email from desk_accounts
       where approved = true and user_id <> $1
       order by lower(username)`, [context.userId])).map((r) => ({
		userId: r.user_id,
		username: r.username,
		email: r.email
	}));
});
var listNotifications_createServerFn_handler = createServerRpc({
	id: "ded79099149d28ceb2e0ac0581c7618a59799ce73cd3dabba2d833d972fc964c",
	name: "listNotifications",
	filename: "src/lib/ops/notify.ts"
}, (opts) => listNotifications.__executeServer(opts));
var listNotifications = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listNotifications_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	await ensureTable(sql);
	return (await sql.query(`select id, from_name, body, customer, entity_type, entity_id, comment_id, read, created_at
       from desk_notifications
       where user_id = $1
       order by created_at desc
       limit 40`, [context.userId])).map((r) => ({
		id: r.id,
		fromName: r.from_name,
		body: r.body,
		customer: r.customer,
		entityType: r.entity_type,
		entityId: r.entity_id,
		commentId: r.comment_id,
		read: !!r.read,
		createdAt: String(r.created_at)
	}));
});
var sendPing_createServerFn_handler = createServerRpc({
	id: "c456a9cfefe23283df58ac4a6dc5cfa41978e3b8e360d899120bd94e5c2beec0",
	name: "sendPing",
	filename: "src/lib/ops/notify.ts"
}, (opts) => sendPing.__executeServer(opts));
var sendPing = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(sendPing_createServerFn_handler, async ({ context, data }) => {
	return deliverPings(await getSql(), {
		fromUserId: context.userId,
		body: data.body,
		entityType: data.entityType,
		entityId: data.entityId,
		commentId: data.commentId,
		toUserIds: data.toUserId ? [data.toUserId] : [],
		usernames: data.usernames
	});
});
var markNotificationRead_createServerFn_handler = createServerRpc({
	id: "3fa4ef685c6d3d148750b135b296ab3ac3416c337f4659f76d71f0268e425439",
	name: "markNotificationRead",
	filename: "src/lib/ops/notify.ts"
}, (opts) => markNotificationRead.__executeServer(opts));
var markNotificationRead = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(markNotificationRead_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	await ensureTable(sql);
	if (data.all) await sql.query("update desk_notifications set read = true where user_id = $1 and read = false", [context.userId]);
	else if (data.id != null) await sql.query("update desk_notifications set read = true where id = $1 and user_id = $2", [data.id, context.userId]);
	return { ok: true };
});
//#endregion
export { listNotifications_createServerFn_handler, listTeammates_createServerFn_handler, markNotificationRead_createServerFn_handler, sendPing_createServerFn_handler };
