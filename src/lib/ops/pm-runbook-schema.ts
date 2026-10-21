/**
 * PM runbook — machine definition schema. Mirrors the validation in the standalone builder (build.py):
 * required top-level keys, every condition names a real option and value, every kit has its fields,
 * step ids are unique. Pure: no DOM, no server imports, safe for node --test.
 */
import { z } from "zod";

const when = z.record(z.string(), z.array(z.string()));
const byMap = z.object({ by: z.string(), map: z.record(z.string(), z.number()) });
const byLabel = z.object({ by: z.string(), map: z.record(z.string(), z.string()) });

const modelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  time: z.record(z.string(), z.string()).optional(),
});
const intervalSchema = z.object({ id: z.string().min(1), label: z.string().min(1) });
const optionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  default: z.string().optional(),
  when: when.optional(),
  choices: z.array(z.object({ val: z.string(), label: z.string() })).min(1),
});
const kitSchema = z.object({
  ev: z.string().min(1),
  name: z.string().min(1),
  module: z.string().min(1),
  interval: z.number(),
  qty: z.union([z.number(), byMap]),
  part: z.union([z.string(), byLabel]).optional(),
  when: when.optional(),
  note: z.string().optional(),
});
const stepSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  ref: z.string().optional(),
  when: when.optional(),
});
const stepGroupSchema = z.object({
  module: z.string().min(1),
  when: when.optional(),
  items: z.array(stepSchema),
});
const bannerSchema = z.object({
  when: when.optional(),
  tone: z.enum(["ok", "warn", "bad"]).optional(),
  text: z.string(),
});
const changesSchema = z.object({
  stockNote: z.object({ title: z.string(), text: z.string() }).optional(),
  supersessions: z.array(z.tuple([z.string(), z.string(), z.string()])).optional(),
  contents: z.array(z.string()).optional(),
});
const referenceSchema = z.object({
  title: z.string(),
  text: z.string().optional(),
  list: z.array(z.string()).optional(),
  table: z
    .object({
      head: z.array(z.string()),
      rows: z.array(z.array(z.string())),
      monoCols: z.array(z.number()).optional(),
    })
    .optional(),
});

export const runbookDefinitionSchema = z
  .object({
    id: z.string().min(1),
    manufacturer: z.string().optional(),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    sources: z.string().optional(),
    storageKey: z.string().optional(),
    /** When true, the default PM style ("12 month PM") is used only after the install date and earlier visits. */
    defaultStyleLast: z.boolean().optional(),
    /**
     * Visit numbers instead of months. `by` is an option key; `map` is visits per year for each choice.
     * Interval ids must be 1..n.
     */
    visitsPerYear: z.object({ by: z.string().min(1), map: z.record(z.string(), z.number()) }).optional(),
    models: z.array(modelSchema).min(1),
    intervals: z.array(intervalSchema).min(1),
    options: z.array(optionSchema).default([]),
    banners: z.array(bannerSchema).default([]),
    kits: z.array(kitSchema),
    steps: z.array(stepGroupSchema),
    changes: changesSchema.optional(),
    reference: z.array(referenceSchema).default([]),
  })
  .superRefine((m, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const values: Record<string, Set<string>> = {
      model: new Set(m.models.map((x) => x.id)),
      pm: new Set(m.intervals.map((x) => x.id)),
    };
    for (const o of m.options) values[o.key] = new Set(o.choices.map((c) => c.val));
    const checkWhen = (w: Record<string, string[]> | undefined, where: string) => {
      for (const [k, vals] of Object.entries(w ?? {})) {
        if (!values[k]) {
          fail(`${where}: unknown condition key '${k}'`);
          continue;
        }
        for (const v of vals) if (!values[k].has(v)) fail(`${where}: '${v}' is not a value of '${k}'`);
      }
    };
    const checkBy = (q: unknown, where: string) => {
      if (q && typeof q === "object" && "by" in q) {
        const by = String((q as { by: unknown }).by);
        if (!values[by]) fail(`${where}: by '${by}' is not an option key`);
      }
    };
    for (const k of m.kits) {
      const w = `kit ${k.ev}`;
      checkWhen(k.when, w);
      checkBy(k.qty, w);
      checkBy(k.part, w);
    }
    const ids = new Set<string>();
    for (const g of m.steps) {
      checkWhen(g.when, `step group ${g.module}`);
      for (const s of g.items) {
        if (ids.has(s.id)) fail(`duplicate step id ${s.id}`);
        ids.add(s.id);
        checkWhen(s.when, `step ${s.id}`);
      }
    }
    for (const b of m.banners) checkWhen(b.when, "banner");
    for (const o of m.options) {
      checkWhen(o.when, `option ${o.key}`);
      if (o.default !== undefined && !values[o.key].has(o.default)) {
        fail(`option ${o.key}: default '${o.default}' is not a choice`);
      }
    }
    if (m.visitsPerYear) {
      const opt = m.options.find((o) => o.key === m.visitsPerYear!.by);
      if (!opt) fail(`visitsPerYear: by '${m.visitsPerYear.by}' is not an option key`);
      else {
        for (const key of Object.keys(m.visitsPerYear.map)) {
          if (!opt.choices.some((c) => c.val === key)) fail(`visitsPerYear: '${key}' is not a value of '${m.visitsPerYear.by}'`);
        }
      }
      const n = m.intervals.length;
      const ids = new Set(m.intervals.map((i) => i.id));
      for (let i = 1; i <= n; i++) {
        if (!ids.has(String(i))) {
          fail(`visitsPerYear: interval ids must run 1..${n}`);
          break;
        }
      }
    }
  });

export type RunbookDefinition = z.infer<typeof runbookDefinitionSchema>;
export type RunbookKit = z.infer<typeof kitSchema>;
export type RunbookStepGroup = z.infer<typeof stepGroupSchema>;
export type RunbookOption = z.infer<typeof optionSchema>;

/** The tech's choices for one unit: model, PM interval id, and one value per option key. */
export type RunbookConfig = Record<string, string>;

/** Throws a readable error naming the first problems; use at load time for a bundled definition. */
export function parseRunbookDefinition(raw: unknown): RunbookDefinition {
  const r = runbookDefinitionSchema.safeParse(raw);
  if (r.success) return r.data;
  throw new Error(
    "Runbook definition is invalid: " +
      r.error.issues
        .slice(0, 5)
        .map((i) => i.message)
        .join("; "),
  );
}
