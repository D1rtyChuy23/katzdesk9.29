/**
 * The Library — spec sheet queries and server functions.
 * Staff drop a manufacturer PDF; the browser extracts its text, the server asks xAI for structured
 * JSON, the review screen edits it, and only the structured data is saved. The PDF is never stored.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql, type Sql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { flagOn } from "@/lib/ops/flag";
import { filterNonUsa, type RemovedItem } from "@/lib/ops/spec-filter";
import { applySpecDefaults } from "@/lib/ops/spec-defaults";
import {
  compactDraft,
  parseExtraction,
  specSheetSchema,
  type SavedSpecSheet,
  type SpecSheetDraft,
} from "@/lib/ops/spec-schema";

export {
  specSheetSchema,
  parseExtraction,
  emptyDraft,
  type SavedSpecSheet,
  type SpecSheetDraft,
  type SpecConfig,
  type Requirements,
} from "@/lib/ops/spec-schema";

/** Server-only; XAI_BASE_URL exists only so the import flow can be tested without spending credits. */
const xaiUrl = () => `${(process.env.XAI_BASE_URL || "https://api.x.ai/v1").replace(/\/$/, "")}/chat/completions`;
const XAI_MODEL = "grok-4.5";
/** Each import spends the owner's xAI credits. */
export const IMPORTS_PER_HOUR = 10;
/** Enough for a long multi-page sheet; keeps the prompt (and cost) bounded. */
export const MAX_PDF_TEXT = 60_000;

async function ready(): Promise<Sql> {
  const { ensureSeeded } = await import("@/lib/ops/seed.server");
  await ensureSeeded();
  return getSql();
}

async function roleOf(sql: Sql, userId: string) {
  const rows = await sql.query<{ is_admin: boolean; desk_role: string | null; username: string | null }>(
    "select is_admin, desk_role, username from desk_accounts where user_id = $1",
    [userId],
  );
  const admin = flagOn(rows[0]?.is_admin);
  const sales = rows[0]?.desk_role === "sales";
  return { canEdit: admin || sales, name: rows[0]?.username || "Teammate" };
}

async function requireEditor(sql: Sql, userId: string) {
  const role = await roleOf(sql, userId);
  if (!role.canEdit) throw new Error("Only Admin and Sales can add, edit, or delete spec sheets.");
  return role;
}

type SheetRow = {
  id: number;
  manufacturer: string;
  model: string;
  category: string | null;
  summary: string | null;
  specs: unknown;
  mfr_notes: unknown;
  created_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};
type ConfigRow = { id: number; sheet_id: number; label: string; position: number; requirements: unknown };

const asJson = (v: unknown) => (typeof v === "string" ? JSON.parse(v) : v);

function mapSheet(row: SheetRow, configs: ConfigRow[]): SavedSpecSheet {
  // Saved rows went through the schema on the way in; parse again so old/hand-edited rows can't crash the page.
  const parsed = specSheetSchema.safeParse({
    manufacturer: row.manufacturer,
    model: row.model,
    category: row.category,
    summary: row.summary,
    specs: asJson(row.specs) ?? [],
    mfrNotes: asJson(row.mfr_notes) ?? {},
    configs: configs
      .filter((c) => c.sheet_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((c) => ({ label: c.label, requirements: asJson(c.requirements) ?? {} })),
  });
  const base: SpecSheetDraft = parsed.success
    ? parsed.data
    : { manufacturer: row.manufacturer, model: row.model, specs: [], mfrNotes: {}, configs: [] };
  return {
    // Older sheets: fill a blank inlet / plug / breaker for display (Refresh writes them).
    ...applySpecDefaults(base, "fill"),
    id: row.id,
    createdBy: row.created_by,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Everyone with Desk access can read and copy. */
export const listSpecSheets = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .handler(async ({ context }): Promise<{ sheets: SavedSpecSheet[]; canEdit: boolean; aiReady: boolean }> => {
    const sql = await ready();
    const sheets = await sql.query<SheetRow>("select * from spec_sheets order by lower(manufacturer), lower(model)");
    const configs = sheets.length
      ? await sql.query<ConfigRow>("select * from spec_configs where sheet_id = any($1) order by sheet_id, position", [
          sheets.map((s) => s.id),
        ])
      : [];
    const role = await roleOf(sql, context.userId);
    return {
      sheets: sheets.map((s) => mapSheet(s, configs)),
      canEdit: role.canEdit,
      aiReady: !!process.env.XAI_API_KEY,
    };
  });

// ---------------- AI extraction ----------------

const SYSTEM_PROMPT = `You read manufacturer spec sheets for commercial coffee, espresso, tea, water and food-service equipment and return STRICT JSON for a US service company.

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
  "configs": [                          // one per sold configuration (e.g. "2 Group", "3 Group", "Hot water tap")
    {"label": string,
     "requirements": {
       "power": {"voltage": string|null, "amps": string|null, "phase": string|null, "hz": string|null, "plug": string|null, "circuit": string|null},
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

type ExtractResult =
  | { ok: true; draft: SpecSheetDraft; removed: RemovedItem[]; usedRetry: boolean }
  | { ok: false; reason: "no-key" | "no-text" | "rate-limit" | "failed"; message: string };

async function callXai(apiKey: string, messages: { role: string; content: string }[]): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(xaiUrl(), {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: XAI_MODEL,
        messages,
        temperature: 0,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`xAI API error ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

const extractInput = z.object({
  text: z.string().max(MAX_PDF_TEXT + 1000),
  fileName: z.string().max(300).optional(),
});

/** Text in, structured draft out. The PDF itself never reaches the server. */
export const extractSpecSheet = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof extractInput>) => extractInput.parse(d))
  .handler(async ({ data, context }): Promise<ExtractResult> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const text = data.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_PDF_TEXT);
    if (text.replace(/\s/g, "").length < 40) {
      return {
        ok: false,
        reason: "no-text",
        message: "This PDF has no readable text (it looks scanned). Fill in the form by hand instead.",
      };
    }
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, reason: "no-key", message: "AI reading isn't available here yet. Fill in the form by hand instead." };
    }
    const used = await sql.query<{ n: number; oldest: string | Date | null }>(
      "select count(*)::int as n, min(created_at) as oldest from spec_import_log where user_id = $1 and created_at > now() - interval '1 hour'",
      [context.userId],
    );
    if ((used[0]?.n ?? 0) >= IMPORTS_PER_HOUR) {
      const oldest = used[0]?.oldest ? new Date(used[0].oldest).getTime() : Date.now();
      const mins = Math.max(1, Math.ceil((oldest + 3_600_000 - Date.now()) / 60_000));
      return {
        ok: false,
        reason: "rate-limit",
        message: `You've imported ${IMPORTS_PER_HOUR} sheets in the last hour. Try again in about ${mins} min, or fill the form by hand.`,
      };
    }
    await sql.query("insert into spec_import_log (user_id) values ($1)", [context.userId]);

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Spec sheet${data.fileName ? ` "${data.fileName}"` : ""} text:\n\n${text}`,
      },
    ];
    try {
      const first = await callXai(apiKey, messages);
      let parsed = parseExtraction(first);
      let usedRetry = false;
      if (!parsed.ok) {
        // One retry, telling the model exactly what was wrong.
        usedRetry = true;
        const second = await callXai(apiKey, [
          ...messages,
          { role: "assistant", content: first.slice(0, 8000) },
          { role: "user", content: `That was not valid for the schema (${parsed.error}). Reply with only the corrected JSON object.` },
        ]);
        parsed = parseExtraction(second);
      }
      if (!parsed.ok) {
        return { ok: false, reason: "failed", message: `The AI couldn't read this sheet cleanly (${parsed.error}). Fill in the form by hand instead.` };
      }
      const filtered = filterNonUsa(parsed.data);
      if (!filtered.draft.configs.length) filtered.draft.configs.push({ label: "Standard", requirements: {} });
      // Katz defaults: 3/8" compression valve inlet, plug + breaker from the electrical configuration.
      const draft = applySpecDefaults(filtered.draft, "generate");
      return { ok: true, draft, removed: filtered.removed, usedRetry };
    } catch (e) {
      const msg = e instanceof Error ? (e.name === "AbortError" ? "the AI took too long" : e.message) : "unknown error";
      return { ok: false, reason: "failed", message: `Reading the sheet failed (${msg}). Fill in the form by hand instead.` };
    }
  });

// ---------------- save / delete ----------------

const saveInput = z.object({
  draft: specSheetSchema,
  /** Editing an existing sheet. */
  id: z.number().int().positive().nullable().optional(),
  /** The user confirmed replacing the sheet that already has this manufacturer + model. */
  overwrite: z.boolean().optional(),
});

type SaveResult = { ok: true; id: number } | { ok: false; conflict: { id: number; manufacturer: string; model: string } };

/** Upsert the sheet and replace its configurations in ONE statement (atomic on Neon and PGLite). */
export const saveSpecSheet = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof saveInput>) => saveInput.parse(d))
  .handler(async ({ data, context }): Promise<SaveResult> => {
    const sql = await ready();
    const role = await requireEditor(sql, context.userId);
    // Fill (never overwrite) so a deliberate edit to the plug or inlet sticks.
    const d = applySpecDefaults(compactDraft(data.draft), "fill");
    if (!d.manufacturer) throw new Error("Add the manufacturer.");
    if (!d.model) throw new Error("Add the model.");
    if (!d.configs.length) d.configs.push({ label: "Standard", requirements: {} });
    const labels = d.configs.map((c) => c.label.toLowerCase());
    if (new Set(labels).size !== labels.length) throw new Error("Two configurations have the same name. Rename one.");

    const same = await sql.query<{ id: number; manufacturer: string; model: string }>(
      "select id, manufacturer, model from spec_sheets where lower(manufacturer) = lower($1) and lower(model) = lower($2) limit 1",
      [d.manufacturer, d.model],
    );
    const clash = same[0];
    let targetId: number | null = data.id ?? null;
    if (clash && clash.id !== targetId) {
      if (targetId) throw new Error(`${clash.manufacturer} ${clash.model} already has its own page. Open that one instead.`);
      if (!data.overwrite) return { ok: false, conflict: clash };
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
      JSON.stringify(d.configs.map((c) => ({ label: c.label, requirements: c.requirements }))),
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
    const rows = targetId
      ? await sql.query<{ id: number }>(
          `with s as (
             update spec_sheets set manufacturer = $1, model = $2, category = $3, summary = $4,
                    specs = $5::jsonb, mfr_notes = $6::jsonb, updated_at = now()
              where id = $9 and $7::text is not null
              returning id
           ), ${configCtes}`,
          [...params, targetId],
        )
      : await sql.query<{ id: number }>(
          `with s as (
             insert into spec_sheets (manufacturer, model, category, summary, specs, mfr_notes, created_by)
             values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
             on conflict (manufacturer, model) do update set
               category = excluded.category, summary = excluded.summary, specs = excluded.specs,
               mfr_notes = excluded.mfr_notes, updated_at = now()
             returning id
           ), ${configCtes}`,
          params,
        );
    const id = rows[0]?.id;
    if (!id) throw new Error("That spec sheet no longer exists. Refresh and try again.");
    return { ok: true, id };
  });

export const deleteSpecSheet = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    await sql.query("delete from spec_sheets where id = $1", [data.id]);
    return { ok: true };
  });

/** Re-apply the Katz defaults to a saved sheet: inlet, plug and breaker from the electrical. */
export const refreshSpecDefaults = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int().positive() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; changed: number }> => {
    const sql = await ready();
    await requireEditor(sql, context.userId);
    const rows = await sql.query<ConfigRow>("select * from spec_configs where sheet_id = $1 order by position", [data.id]);
    if (!rows.length) throw new Error("That spec sheet has no configurations.");
    const before = rows.map((r) => ({ label: r.label, requirements: specSheetSchema.shape.configs.parse([{ label: r.label, requirements: asJson(r.requirements) ?? {} }])[0]!.requirements }));
    const after = applySpecDefaults(
      { manufacturer: "", model: "", specs: [], mfrNotes: {}, configs: before },
      "generate",
    ).configs;
    let changed = 0;
    for (let i = 0; i < rows.length; i++) {
      const next = JSON.stringify(after[i]!.requirements);
      if (next === JSON.stringify(before[i]!.requirements)) continue;
      changed++;
      await sql.query("update spec_configs set requirements = $2::jsonb where id = $1", [rows[i]!.id, next]);
    }
    if (changed) await sql.query("update spec_sheets set updated_at = now() where id = $1", [data.id]);
    return { ok: true, changed };
  });
