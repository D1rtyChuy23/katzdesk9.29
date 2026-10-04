import { n as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CN-evIEF.mjs";
import { r as getSql } from "./db-C-3cYBOe.mjs";
import { n as flagOn } from "./flag-DVQH6hUb.mjs";
import { o as deskMiddleware } from "./access-CeCitFku.mjs";
import { hn as object, ln as array, mn as number, un as boolean, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { _ as specSheetSchema, a as compactDraft, d as filterNonUsa, f as isEspresso, h as plugWireError, i as applySpecDefaults, m as parseExtraction, o as coreHoleInfo, s as coreHoleSaveError, u as espressoCoreDefaults } from "./spec-schema-Ba1ui6_6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/spec-library-CU656o-r.js
/**
* The Library — spec sheet queries and server functions.
* Staff drop a manufacturer PDF; the browser extracts its text, the server asks xAI for structured
* JSON, the review screen edits it, and only the structured data is saved. The PDF is never stored.
*/
/** Server-only; XAI_BASE_URL exists only so the import flow can be tested without spending credits. */
var xaiUrl = () => `${(process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, "")}/chat/completions`;
var XAI_MODEL = "grok-4.5";
/** Each import spends the owner's xAI credits. */
var IMPORTS_PER_HOUR = 10;
var MAX_PDF_TEXT = 6e4;
async function ready() {
	const { ensureSeeded } = await import("./seed.server-2-fPCFoA.mjs");
	await ensureSeeded();
	return getSql();
}
async function roleOf(sql, userId) {
	const rows = await sql.query("select is_admin, desk_role, username from desk_accounts where user_id = $1", [userId]);
	const admin = flagOn(rows[0]?.is_admin);
	const sales = rows[0]?.desk_role === "sales";
	return {
		canEdit: admin || sales,
		name: rows[0]?.username || "Teammate"
	};
}
async function requireEditor(sql, userId) {
	const role = await roleOf(sql, userId);
	if (!role.canEdit) throw new Error("Only Admin and Sales can add, edit, or delete spec sheets.");
	return role;
}
/** Everything but the image itself — images load one at a time with getSpecImage. */
var SHEET_COLS = "id, manufacturer, model, category, summary, specs, mfr_notes, created_by, created_at, updated_at, core_hole, core_diameter, (image is not null) as has_image, (dims_image is not null) as has_dims";
var asJson = (v) => typeof v === "string" ? JSON.parse(v) : v;
function mapSheet(row, configs) {
	const parsed = specSheetSchema.safeParse({
		manufacturer: row.manufacturer,
		model: row.model,
		category: row.category,
		summary: row.summary,
		specs: asJson(row.specs) ?? [],
		mfrNotes: asJson(row.mfr_notes) ?? {},
		coreHole: row.core_hole,
		coreDiameter: row.core_diameter,
		configs: configs.filter((c) => c.sheet_id === row.id).sort((a, b) => a.position - b.position).map((c) => ({
			label: c.label,
			requirements: asJson(c.requirements) ?? {}
		}))
	});
	const base = parsed.success ? parsed.data : {
		manufacturer: row.manufacturer,
		model: row.model,
		specs: [],
		mfrNotes: {},
		configs: []
	};
	return {
		...applySpecDefaults(base, "fill"),
		id: row.id,
		hasImage: !!row.has_image,
		hasDims: !!row.has_dims,
		createdBy: row.created_by,
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at)
	};
}
/** Everyone with Desk access can read and copy. */
var listSpecSheets_createServerFn_handler = createServerRpc({
	id: "e2a9727404575e20d9c96e8c918183b31e00b5f8947c0bdce761f0e91e1fafca",
	name: "listSpecSheets",
	filename: "src/lib/ops/spec-library.ts"
}, (opts) => listSpecSheets.__executeServer(opts));
var listSpecSheets = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(listSpecSheets_createServerFn_handler, async ({ context }) => {
	const sql = await ready();
	const sheets = await sql.query(`select ${SHEET_COLS} from spec_sheets order by lower(manufacturer), lower(model)`);
	const configs = sheets.length ? await sql.query("select * from spec_configs where sheet_id = any($1) order by sheet_id, position", [sheets.map((s) => s.id)]) : [];
	const role = await roleOf(sql, context.userId);
	return {
		sheets: sheets.map((s) => mapSheet(s, configs)),
		canEdit: role.canEdit,
		aiReady: !!process.env.XAI_API_KEY
	};
});
var SYSTEM_PROMPT = `You read manufacturer spec sheets for commercial coffee, espresso, tea, water and food-service equipment and return STRICT JSON for a US service company.

Return ONE JSON object and nothing else, exactly this shape (omit or use null for anything not in the sheet; never invent values):
{
  "manufacturer": string,
  "model": string,                      // model family/name without the manufacturer
  "category": string|null,              // e.g. "Espresso Machine", "Grinder", "Brewer", "Water Filtration"
  "summary": string|null,               // one or two plain sentences
  "specs": [{"label": string, "value": string}],   // general specs: boilers, capacity, groups, hoppers, materials…
  "mfrNotes": {
    "usContact": string|null,           // US office/distributor name, phone, address, website only
    "warranty": string|null,            // US warranty terms
    "certifications": [string]          // US listings only: UL, cUL, ETL, NSF, CSA, ENERGY STAR
  },
  "coreHole": "yes"|"no"|null,          // only if the sheet says utility lines pass through a counter hole
  "coreDiameter": string|null,          // counter hole diameter in inches, e.g. 3 inches — only if stated
  "configs": [                          // one per sold configuration (e.g. "2 Group", "3 Group", "Hot water tap")
    {"label": string,
     "requirements": {
       "power": {"voltage": string|null, "wires": string|null /* e.g. "4-wire" (2 hots + neutral + ground) or "3-wire" (2 hots + ground), only if stated */, "amps": string|null, "phase": string|null, "hz": string|null, "plug": string|null, "circuit": string|null},
       "water": {"inlet": string|null, "pressure": string|null, "filtration": string|null, "notes": string|null},
       "drain": {"size": string|null, "notes": string|null},
       "dimensions": {"width": string|null, "depth": string|null, "height": string|null, "weight": string|null, "clearance": string|null},
       "other": [{"label": string, "value": string}]
     }}
  ]
}

Rules:
- Keep manufacturer information, but DROP anything not relevant to the USA: 220-240 V / 230 V / 400 V and 50 Hz ratings, CE/UKCA/RoHS/WEEE marks, Schuko/BS 1363/CEE plugs, BSP/DIN/EN water fittings, and non-US offices or phone numbers.
- Prefer imperial units: inches ("), pounds (lb), psi, °F, gallons. Convert metric when the sheet gives only metric (e.g. 800 mm → 31.5"). Keep at most one decimal.
- Use US electrical terms: voltage like "208-240V" or "120V", amps like "30A", phase "1-phase" or "3-phase", plug as a NEMA type (e.g. "NEMA 6-30P") or "Hardwired".
- If the sheet has a single configuration, return one config labelled "Standard".
- Values are short strings. No markdown, no comments in the JSON.`;
async function callXai(apiKey, messages) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 9e4);
	try {
		const res = await fetch(xaiUrl(), {
			method: "POST",
			signal: ctrl.signal,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: XAI_MODEL,
				messages,
				temperature: 0,
				max_tokens: 4e3,
				response_format: { type: "json_object" }
			})
		});
		if (!res.ok) {
			const detail = await res.text().catch(() => "");
			throw new Error(`xAI API error ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
		}
		return (await res.json()).choices?.[0]?.message?.content ?? "";
	} finally {
		clearTimeout(timer);
	}
}
var extractInput = object({
	text: string().max(61e3),
	fileName: string().max(300).optional()
});
/** Text in, structured draft out. The PDF itself never reaches the server. */
var extractSpecSheet_createServerFn_handler = createServerRpc({
	id: "fb967f4c4c469ca496f913231e7e98c934eeb1972b1253ec1f9cd9051fd88323",
	name: "extractSpecSheet",
	filename: "src/lib/ops/spec-library.ts"
}, (opts) => extractSpecSheet.__executeServer(opts));
var extractSpecSheet = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => extractInput.parse(d)).handler(extractSpecSheet_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	const text = data.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_PDF_TEXT);
	if (text.replace(/\s/g, "").length < 40) return {
		ok: false,
		reason: "no-text",
		message: "This PDF has no readable text (it looks scanned). Fill in the form by hand instead."
	};
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) return {
		ok: false,
		reason: "no-key",
		message: "AI reading isn't available here yet. Fill in the form by hand instead."
	};
	const used = await sql.query("select count(*)::int as n, min(created_at) as oldest from spec_import_log where user_id = $1 and created_at > now() - interval '1 hour'", [context.userId]);
	if ((used[0]?.n ?? 0) >= IMPORTS_PER_HOUR) {
		const oldest = used[0]?.oldest ? new Date(used[0].oldest).getTime() : Date.now();
		return {
			ok: false,
			reason: "rate-limit",
			message: `You've imported ${IMPORTS_PER_HOUR} sheets in the last hour. Try again in about ${Math.max(1, Math.ceil((oldest + 36e5 - Date.now()) / 6e4))} min, or fill the form by hand.`
		};
	}
	await sql.query("insert into spec_import_log (user_id) values ($1)", [context.userId]);
	const messages = [{
		role: "system",
		content: SYSTEM_PROMPT
	}, {
		role: "user",
		content: `Spec sheet${data.fileName ? ` "${data.fileName}"` : ""} text:\n\n${text}`
	}];
	try {
		const first = await callXai(apiKey, messages);
		let parsed = parseExtraction(first);
		let usedRetry = false;
		if (!parsed.ok) {
			usedRetry = true;
			const second = await callXai(apiKey, [
				...messages,
				{
					role: "assistant",
					content: first.slice(0, 8e3)
				},
				{
					role: "user",
					content: `That was not valid for the schema (${parsed.error}). Reply with only the corrected JSON object.`
				}
			]);
			parsed = parseExtraction(second);
		}
		if (!parsed.ok) return {
			ok: false,
			reason: "failed",
			message: `The AI couldn't read this sheet cleanly (${parsed.error}). Fill in the form by hand instead.`
		};
		const filtered = filterNonUsa(parsed.data);
		if (!filtered.draft.configs.length) filtered.draft.configs.push({
			label: "Standard",
			requirements: {}
		});
		return {
			ok: true,
			draft: applySpecDefaults(filtered.draft, "generate"),
			removed: filtered.removed,
			usedRetry
		};
	} catch (e) {
		return {
			ok: false,
			reason: "failed",
			message: `Reading the sheet failed (${e instanceof Error ? e.name === "AbortError" ? "the AI took too long" : e.message : "unknown error"}). Fill in the form by hand instead.`
		};
	}
});
var saveInput = object({
	draft: specSheetSchema,
	/** Editing an existing sheet. */
	id: number().int().positive().nullable().optional(),
	/** The user confirmed replacing the sheet that already has this manufacturer + model. */
	overwrite: boolean().optional()
});
/** Upsert the sheet and replace its configurations in ONE statement (atomic on Neon and PGLite). */
var saveSpecSheet_createServerFn_handler = createServerRpc({
	id: "22e60e6e91a70d2730f3bb1d4f2d60f3934250e9ce92a98218f4897ca3093e4a",
	name: "saveSpecSheet",
	filename: "src/lib/ops/spec-library.ts"
}, (opts) => saveSpecSheet.__executeServer(opts));
var saveSpecSheet = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => saveInput.parse(d)).handler(saveSpecSheet_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	const role = await requireEditor(sql, context.userId);
	const d = applySpecDefaults(compactDraft(data.draft), "fill");
	if (!d.manufacturer) throw new Error("Add the manufacturer.");
	if (!d.model) throw new Error("Add the model.");
	const coreErr = coreHoleSaveError(d);
	if (coreErr) throw new Error(coreErr);
	for (const c of d.configs) {
		const err = plugWireError(c.requirements.power, d);
		if (err) throw new Error(`${c.label}: ${err}`);
	}
	if (!d.configs.length) d.configs.push({
		label: "Standard",
		requirements: {}
	});
	const labels = d.configs.map((c) => c.label.toLowerCase());
	if (new Set(labels).size !== labels.length) throw new Error("Two configurations have the same name. Rename one.");
	const clash = (await sql.query("select id, manufacturer, model from spec_sheets where lower(manufacturer) = lower($1) and lower(model) = lower($2) limit 1", [d.manufacturer, d.model]))[0];
	let targetId = data.id ?? null;
	if (clash && clash.id !== targetId) {
		if (targetId) throw new Error(`${clash.manufacturer} ${clash.model} already has its own page. Open that one instead.`);
		if (!data.overwrite) return {
			ok: false,
			conflict: clash
		};
		targetId = clash.id;
	}
	const params = [
		d.manufacturer,
		d.model,
		d.category ?? null,
		d.summary ?? null,
		JSON.stringify(d.specs),
		JSON.stringify(d.mfrNotes),
		role.name,
		JSON.stringify(d.configs.map((c) => ({
			label: c.label,
			requirements: c.requirements
		}))),
		d.coreHole ?? null,
		d.coreDiameter ?? null,
		d.image === void 0 ? "keep" : d.image === null ? "clear" : "set",
		typeof d.image === "string" ? d.image : null,
		d.dimsImage === void 0 ? "keep" : d.dimsImage === null ? "clear" : "set",
		typeof d.dimsImage === "string" ? d.dimsImage : null
	];
	const configCtes = `
      d as (delete from spec_configs where sheet_id in (select id from s)),
      i as (
        insert into spec_configs (sheet_id, label, position, requirements)
        select s.id, t.c->>'label', (t.ord - 1)::int, coalesce(t.c->'requirements', '{}'::jsonb)
          from s, jsonb_array_elements($8::jsonb) with ordinality as t(c, ord)
        returning id
      )
      select id from s`;
	const id = (targetId ? await sql.query(`with s as (
             update spec_sheets set manufacturer = $1, model = $2, category = $3, summary = $4,
                    specs = $5::jsonb, mfr_notes = $6::jsonb, core_hole = $9, core_diameter = $10,
                    image = case $11::text when 'set' then $12::text when 'clear' then null else image end,
                    dims_image = case $13::text when 'set' then $14::text when 'clear' then null else dims_image end,
                    updated_at = now()
              where id = $15 and $7::text is not null
              returning id
           ), ${configCtes}`, [...params, targetId]) : await sql.query(`with s as (
             insert into spec_sheets (manufacturer, model, category, summary, specs, mfr_notes, created_by, core_hole, core_diameter, image, dims_image)
             values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $9, $10,
                     case when $11::text = 'set' then $12::text end, case when $13::text = 'set' then $14::text end)
             on conflict (manufacturer, model) do update set
               category = excluded.category, summary = excluded.summary, specs = excluded.specs,
               mfr_notes = excluded.mfr_notes, core_hole = excluded.core_hole, core_diameter = excluded.core_diameter,
               image = case $11::text when 'set' then excluded.image when 'clear' then null else spec_sheets.image end,
               dims_image = case $13::text when 'set' then excluded.dims_image when 'clear' then null else spec_sheets.dims_image end,
               updated_at = now()
             returning id
           ), ${configCtes}`, params))[0]?.id;
	if (!id) throw new Error("That spec sheet no longer exists. Refresh and try again.");
	return {
		ok: true,
		id
	};
});
var deleteSpecSheet_createServerFn_handler = createServerRpc({
	id: "4c895f215949f0014777e911ad7244921d2b3ab92bc97a2370befdcb4f0c262a",
	name: "deleteSpecSheet",
	filename: "src/lib/ops/spec-library.ts"
}, (opts) => deleteSpecSheet.__executeServer(opts));
var deleteSpecSheet = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number().int().positive() }).parse(d)).handler(deleteSpecSheet_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	await sql.query("delete from spec_sheets where id = $1", [data.id]);
	return { ok: true };
});
var refreshSpecDefaults_createServerFn_handler = createServerRpc({
	id: "fbb664490aba07096c3380f58854e5e83007e7599d847d5e8f1a7c9ec9053250",
	name: "refreshSpecDefaults",
	filename: "src/lib/ops/spec-library.ts"
}, (opts) => refreshSpecDefaults.__executeServer(opts));
var refreshSpecDefaults = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number().int().positive() }).parse(d)).handler(refreshSpecDefaults_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	const rows = await sql.query("select * from spec_configs where sheet_id = $1 order by position", [data.id]);
	if (!rows.length) throw new Error("That spec sheet has no configurations.");
	const before = rows.map((r) => ({
		label: r.label,
		requirements: specSheetSchema.shape.configs.parse([{
			label: r.label,
			requirements: asJson(r.requirements) ?? {}
		}])[0].requirements
	}));
	const after = applySpecDefaults({
		manufacturer: "",
		model: "",
		specs: [],
		mfrNotes: {},
		configs: before
	}, "generate").configs;
	let changed = 0;
	for (let i = 0; i < rows.length; i++) {
		const next = JSON.stringify(after[i].requirements);
		if (next === JSON.stringify(before[i].requirements)) continue;
		changed++;
		await sql.query("update spec_configs set requirements = $2::jsonb where id = $1", [rows[i].id, next]);
	}
	const sheet = (await sql.query("select manufacturer, model, category, core_hole, core_diameter from spec_sheets where id = $1", [data.id]))[0];
	if (sheet) {
		const core = espressoCoreDefaults({
			manufacturer: sheet.manufacturer,
			model: sheet.model,
			category: sheet.category ?? void 0,
			coreHole: sheet.core_hole === "yes" || sheet.core_hole === "no" ? sheet.core_hole : void 0,
			coreDiameter: sheet.core_diameter ?? void 0
		});
		if ((core.coreHole ?? null) !== sheet.core_hole || (core.coreDiameter ?? null) !== sheet.core_diameter) {
			changed++;
			await sql.query("update spec_sheets set core_hole = $2, core_diameter = $3 where id = $1", [
				data.id,
				core.coreHole ?? null,
				core.coreDiameter ?? null
			]);
		}
	}
	if (changed) await sql.query("update spec_sheets set updated_at = now() where id = $1", [data.id]);
	return {
		ok: true,
		changed
	};
});
var getSpecImage_createServerFn_handler = createServerRpc({
	id: "8ccdbb3c70b34b3820d43e3648a9bcd46c879cc300ebf1f76a19b5e9177d592b",
	name: "getSpecImage",
	filename: "src/lib/ops/spec-library.ts"
}, (opts) => getSpecImage.__executeServer(opts));
var getSpecImage = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ id: number().int().positive() }).parse(d)).handler(getSpecImage_createServerFn_handler, async ({ data }) => {
	const rows = await (await ready()).query("select image, dims_image from spec_sheets where id = $1", [data.id]);
	return {
		image: rows[0]?.image ?? null,
		dimsImage: rows[0]?.dims_image ?? null
	};
});
var norm = (v) => v.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
var coreHoleForModels_createServerFn_handler = createServerRpc({
	id: "22510d9906f4df09c27dc9de5c9dd27b189534c17db527c136f4a775378514e0",
	name: "coreHoleForModels",
	filename: "src/lib/ops/spec-library.ts"
}, (opts) => coreHoleForModels.__executeServer(opts));
var coreHoleForModels = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({ models: array(string().max(300)).max(60) }).parse(d)).handler(coreHoleForModels_createServerFn_handler, async ({ data }) => {
	const sheets = await (await ready()).query("select manufacturer, model, category, core_hole, core_diameter from spec_sheets");
	const out = {};
	for (const unit of data.models) {
		const u = norm(unit);
		const hit = sheets.filter((s) => {
			const model = norm(s.model);
			return !!model && u.includes(model) && (u.includes(norm(s.manufacturer)) || model.length >= 5);
		}).sort((a, b) => b.model.length - a.model.length)[0];
		if (hit) {
			const info = coreHoleInfo({
				manufacturer: hit.manufacturer,
				model: hit.model,
				category: hit.category ?? void 0,
				coreHole: hit.core_hole === "yes" || hit.core_hole === "no" ? hit.core_hole : void 0,
				coreDiameter: hit.core_diameter ?? void 0
			}, true);
			out[unit] = {
				diameter: info.diameter,
				label: info.label,
				source: "spec",
				sheet: `${hit.manufacturer} ${hit.model}`
			};
		} else if (isEspresso({ model: unit })) {
			const info = coreHoleInfo({
				manufacturer: "",
				model: unit,
				category: void 0,
				coreHole: void 0,
				coreDiameter: void 0
			}, true);
			out[unit] = {
				diameter: info.diameter,
				label: info.label,
				source: "espresso",
				sheet: null
			};
		} else out[unit] = {
			diameter: null,
			label: "Counter core hole: diameter needed",
			source: "none",
			sheet: null
		};
	}
	return out;
});
var dataImage = string().max(14e5).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Not an image");
/**
* Replace a saved sheet's pictures after re-reading its PDF (or clearing a wrong one).
* undefined leaves that picture alone, null removes it, a data URL replaces it.
*/
var setSpecImages_createServerFn_handler = createServerRpc({
	id: "7af17eebb642a34c7e1852a14ea49284a565581a9c46d4bdef5396334a5bdc9e",
	name: "setSpecImages",
	filename: "src/lib/ops/spec-library.ts"
}, (opts) => setSpecImages.__executeServer(opts));
var setSpecImages = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => object({
	id: number().int().positive(),
	image: dataImage.nullable().optional(),
	dimsImage: dataImage.nullable().optional()
}).parse(d)).handler(setSpecImages_createServerFn_handler, async ({ data, context }) => {
	const sql = await ready();
	await requireEditor(sql, context.userId);
	const act = (v) => v === void 0 ? "keep" : v === null ? "clear" : "set";
	const rows = await sql.query(`update spec_sheets set
          image = case $2::text when 'set' then $3::text when 'clear' then null else image end,
          dims_image = case $4::text when 'set' then $5::text when 'clear' then null else dims_image end,
          updated_at = now()
        where id = $1
        returning (image is not null) as has_image, (dims_image is not null) as has_dims`, [
		data.id,
		act(data.image),
		data.image ?? null,
		act(data.dimsImage),
		data.dimsImage ?? null
	]);
	if (!rows[0]) throw new Error("That spec sheet no longer exists.");
	return {
		ok: true,
		hasImage: !!rows[0].has_image,
		hasDims: !!rows[0].has_dims
	};
});
//#endregion
export { coreHoleForModels_createServerFn_handler, deleteSpecSheet_createServerFn_handler, extractSpecSheet_createServerFn_handler, getSpecImage_createServerFn_handler, listSpecSheets_createServerFn_handler, refreshSpecDefaults_createServerFn_handler, saveSpecSheet_createServerFn_handler, setSpecImages_createServerFn_handler };
