import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { r as getSql } from "./db-CoHNpeUg.mjs";
import { n as deskMiddleware } from "./access-Cv44_4sH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/notify-0fPVk0IN.js
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
      read          boolean not null default false,
      created_at    timestamptz not null default now()
    )`);
	await sql.query("create index if not exists desk_notifications_inbox_idx on desk_notifications (user_id, read, created_at desc)");
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
	return (await sql.query(`select id, from_name, body, entity_type, entity_id, read, created_at
       from desk_notifications
       where user_id = $1
       order by created_at desc
       limit 40`, [context.userId])).map((r) => ({
		id: r.id,
		fromName: r.from_name,
		body: r.body,
		entityType: r.entity_type,
		entityId: r.entity_id,
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
	const body = data.body.trim();
	if (!body) throw new Error("Write a short reminder.");
	if (data.toUserId === context.userId) throw new Error("You can’t ping yourself.");
	const sql = await getSql();
	await ensureTable(sql);
	if (!(await sql.query("select user_id, username from desk_accounts where user_id = $1 and approved = true", [data.toUserId]))[0]) throw new Error("That teammate isn’t on the desk yet.");
	const me = await sql.query(`select a.username, u.name
       from desk_accounts a
       left join "user" u on u.id = a.user_id
       where a.user_id = $1`, [context.userId]);
	const fromName = me[0]?.username || me[0]?.name || "Teammate";
	await sql.query(`insert into desk_notifications (user_id, from_user_id, from_name, body, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, $6)`, [
		data.toUserId,
		context.userId,
		fromName,
		body.slice(0, 400),
		data.entityType ?? null,
		data.entityId ?? null
	]);
	return { ok: true };
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
