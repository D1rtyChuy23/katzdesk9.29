import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertRecipe } from "@/lib/ops/api";
import { findRecipeFor, recipeLabel } from "@/lib/ops/equipment";
import {
  CUSTOM_SUGGESTIONS,
  SETTING_FIELDS,
  defaultCustomFor,
  defaultSettingsFor,
  previewSetting,
  type SettingName,
} from "@/lib/ops/recipe-fields";
import { Plus, X } from "lucide-react";
import type { MachineSpec } from "@/lib/ops/machines";
import type { SerialPullResult } from "@/lib/ops/serial-pull";
import type { Recipe } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "sonner";
import { SerialPullField } from "./serial-notice";
import { UnitPlaceField } from "./unit-place-field";

const ADD = "__add__";

function byModelFirst(model: string) {
  const key = model.toLowerCase();
  return (a: Recipe, b: Recipe) =>
    Number(b.equipmentModel.toLowerCase() === key) - Number(a.equipmentModel.toLowerCase() === key) ||
    a.equipmentModel.localeCompare(b.equipmentModel) ||
    Number(!!a.name) - Number(!!b.name) ||
    recipeLabel(a).localeCompare(recipeLabel(b));
}

/**
 * One recipe per unit, picked right on the equipment row: house templates plus this
 * customer's recipes, with "Add recipe" in the same list.
 */
function MachineRecipeSelect({
  customer,
  model,
  installId,
  recipes,
  value,
  onPick,
}: {
  customer: string;
  model: string;
  installId?: number;
  recipes: Recipe[];
  value: number | null | undefined;
  onPick: (recipeId: number | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const custKey = customer.trim().toLowerCase();
  const modelKey = model.toLowerCase();
  const house = recipes.filter((r) => !r.customer).sort(byModelFirst(model));
  const mine = recipes.filter((r) => r.customer?.toLowerCase() === custKey).sort(byModelFirst(model));
  // Before anyone picks, show the recipe this unit already used (account first, then house).
  const fallback = findRecipeFor(recipes, { customer, model, installId: installId ?? null });
  const selectedId = value ?? fallback.linked?.id ?? fallback.house?.id ?? null;
  const selected = recipes.find((r) => r.id === selectedId) ?? null;
  const label = (r: Recipe) =>
    r.equipmentModel.toLowerCase() === modelKey ? recipeLabel(r) : recipeLabel(r, true);
  // Grinders often carry only custom settings (kept in notes), so fall back to the first note line.
  const preview = previewSetting(selected) ?? (selected?.notes?.split("\n")[0]?.slice(0, 72) || null);

  return (
    <>
    <div className="col-span-2 grid min-w-0 gap-1 lg:col-span-1">
      <label className="grid min-w-0 gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Recipe
        <SelectField
          aria-label={`Recipe for ${model}`}
          data-testid="machine-recipe"
          value={adding ? ADD : selectedId ? String(selectedId) : ""}
          disabled={!customer.trim()}
          className="normal-case"
          onChange={(e) => {
            const v = e.target.value;
            if (v === ADD) {
              setAdding(true);
              return;
            }
            setAdding(false);
            onPick(v ? Number(v) : null);
          }}
        >
          <option value="">No recipe</option>
          {mine.length ? (
            <optgroup label={customer}>
              {mine.map((r) => (
                <option key={r.id} value={r.id}>
                  {label(r)}
                </option>
              ))}
            </optgroup>
          ) : null}
          {house.length ? (
            <optgroup label="House templates">
              {house.map((r) => (
                <option key={r.id} value={r.id}>
                  {label(r)}
                </option>
              ))}
            </optgroup>
          ) : null}
          <option value={ADD}>＋ Add recipe…</option>
        </SelectField>
      </label>
      {preview && !adding ? (
        <p className="truncate text-[11px] text-muted-foreground" title={preview}>
          {selected?.customer ? "Account" : "House"} · {preview}
        </p>
      ) : null}
    </div>
      {/* Full row width under the unit, so the form never squeezes into the recipe column. */}
      {adding ? (
        <AddRecipePanel
          customer={customer}
          model={model}
          installId={installId}
          onCancel={() => setAdding(false)}
          onSaved={(r) => {
            setAdding(false);
            onPick(r.id);
          }}
        />
      ) : null}
    </>
  );
}

type CustomRow = { key: number; label: string; value: string };

function AddRecipePanel({
  customer,
  model,
  installId,
  onCancel,
  onSaved,
}: {
  customer: string;
  model: string;
  installId?: number;
  onCancel: () => void;
  onSaved: (r: Recipe) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"customer" | "house">("customer");
  // Only the settings that apply to this machine are shown; the rest sit behind "+ Add setting".
  const [shown, setShown] = useState<SettingName[]>(() => defaultSettingsFor(model));
  const [values, setValues] = useState<Partial<Record<SettingName, string>>>({});
  const [custom, setCustom] = useState<CustomRow[]>(() =>
    defaultCustomFor(model).map((label, i) => ({ key: i, label, value: "" })),
  );
  const [nextKey, setNextKey] = useState(100);
  const [notes, setNotes] = useState("");
  const [picking, setPicking] = useState(false);
  const [customLabel, setCustomLabel] = useState("");

  const standardLeft = SETTING_FIELDS.filter((f) => !shown.includes(f.name));
  const customTaken = new Set(custom.map((c) => c.label.trim().toLowerCase()));
  const suggestionsLeft = CUSTOM_SUGGESTIONS.filter((l) => !customTaken.has(l.toLowerCase()));

  function addCustom(label: string) {
    const clean = label.trim();
    if (!clean) return;
    if (customTaken.has(clean.toLowerCase())) return;
    setCustom((rows) => [...rows, { key: nextKey, label: clean, value: "" }]);
    setNextKey((k) => k + 1);
    setCustomLabel("");
    setPicking(false);
  }

  const save = useMutation({
    mutationFn: () => {
      const settings: Partial<Record<SettingName, string | null>> = {};
      for (const f of SETTING_FIELDS) {
        settings[f.name] = shown.includes(f.name) ? values[f.name]?.trim() || null : null;
      }
      // Custom settings (grind, dose, …) live at the top of notes as "Label: value" lines.
      const customLines = custom
        .filter((c) => c.label.trim() && c.value.trim())
        .map((c) => `${c.label.trim()}: ${c.value.trim()}`);
      const allNotes = [...customLines, notes.trim()].filter(Boolean).join("\n");
      return upsertRecipe({
        data: {
          name: name.trim() || null,
          equipmentModel: model,
          customer: scope === "customer" ? customer : null,
          installId: scope === "customer" ? (installId ?? null) : null,
          ...settings,
          notes: allNotes || null,
        },
      });
    },
    onSuccess: (row) => {
      const saved = row as Recipe;
      // Show it in every unit's dropdown right away, then refresh from the server.
      qc.setQueryData<Recipe[]>(["recipes"], (old) => [...(old ?? []).filter((r) => r.id !== saved.id), saved]);
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      toast.success(scope === "customer" ? `Recipe saved to ${customer}` : "House recipe saved");
      onSaved(saved);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save that recipe"),
  });

  // Plain div, not a <form>: this row can sit inside the install sheet's own form.
  return (
    <div
      className="col-span-full grid gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 sm:grid-cols-2"
      data-testid="add-recipe-panel"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          if (picking) setPicking(false);
          else onCancel();
        }
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT" && !picking) {
          e.preventDefault();
          save.mutate();
        }
      }}
    >
      <p className="text-xs font-medium sm:col-span-2">New recipe · {model}</p>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name, e.g. Morning blend"
        aria-label="Recipe name"
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-1.5 text-xs" role="radiogroup" aria-label="Save to">
        {(
          [
            ["customer", customer],
            ["house", "House template"],
          ] as const
        ).map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={scope === id}
            onClick={() => setScope(id)}
            className={
              scope === id
                ? "max-w-full truncate rounded-full bg-primary px-2.5 py-1 text-primary-foreground"
                : "max-w-full truncate rounded-full border border-border bg-card px-2.5 py-1 text-muted-foreground"
            }
          >
            {id === "customer" ? `Save to ${text}` : text}
          </button>
        ))}
      </div>

      {shown.map((n) => {
        const f = SETTING_FIELDS.find((x) => x.name === n)!;
        return (
          <SettingInput
            key={n}
            label={f.label}
            value={values[n] ?? ""}
            onChange={(v) => setValues((cur) => ({ ...cur, [n]: v }))}
            onRemove={() => setShown((cur) => cur.filter((x) => x !== n))}
          />
        );
      })}
      {custom.map((c) => (
        <SettingInput
          key={c.key}
          label={c.label}
          value={c.value}
          onChange={(v) => setCustom((rows) => rows.map((r) => (r.key === c.key ? { ...r, value: v } : r)))}
          onRemove={() => setCustom((rows) => rows.filter((r) => r.key !== c.key))}
        />
      ))}

      <div className="relative sm:col-span-2">
        <button
          type="button"
          aria-expanded={picking}
          data-testid="add-setting"
          onClick={() => setPicking((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/50 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          <Plus className="size-3.5" />
          Add setting
        </button>
        {!shown.length && !custom.length ? (
          <span className="ml-2 text-xs text-muted-foreground">No settings yet — add the ones this machine uses.</span>
        ) : null}
        {picking ? (
          <div
            className="mt-2 grid gap-2 rounded-lg border border-border bg-card p-2.5 shadow-[var(--shadow-soft)]"
            data-testid="add-setting-menu"
          >
            {standardLeft.length ? (
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Recipe settings</p>
                <div className="flex flex-wrap gap-1.5">
                  {standardLeft.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => {
                        setShown((cur) => SETTING_FIELDS.map((x) => x.name).filter((x) => cur.includes(x) || x === f.name));
                        setPicking(false);
                      }}
                      className="rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-primary/15"
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {suggestionsLeft.length ? (
              <div>
                <p className="mb-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Machine settings</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestionsLeft.map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => addCustom(l)}
                      className="rounded-full bg-secondary px-2.5 py-1 text-xs hover:bg-primary/15"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustom(customLabel);
                  }
                }}
                placeholder="Your own setting, e.g. Hopper 2 blend"
                aria-label="Custom setting name"
                className="h-9"
              />
              <Button type="button" size="sm" variant="outline" disabled={!customLabel.trim()} onClick={() => addCustom(customLabel)}>
                Add
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes"
        aria-label="Recipe notes"
        rows={2}
        className="sm:col-span-2"
      />
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          Save & use
        </Button>
      </div>
    </div>
  );
}

function SettingInput({
  label,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute top-1.5 left-3 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-12 pt-4 pr-9"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        title="Doesn't apply to this machine"
        className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export function MachineFields({
  specs,
  onChange,
  installId,
  onPulled,
  onRecipe,
  customer = "",
  recipes = [],
}: {
  specs: MachineSpec[];
  onChange: (next: MachineSpec[]) => void;
  installId?: number;
  onPulled?: (next: MachineSpec[], result: SerialPullResult) => void;
  /** Save right away when a recipe is picked (existing installs). */
  onRecipe?: (next: MachineSpec[]) => void;
  customer?: string;
  recipes?: Recipe[];
}) {
  if (!specs.length) return null;

  function patch(index: number, part: Partial<MachineSpec>): MachineSpec[] {
    return specs.map((s, i) => (i === index ? { ...s, ...part } : s));
  }

  return (
    <div className="divide-y divide-border" data-testid="machine-rows">
      {specs.map((spec, index) => (
        <div
          key={`${spec.equipment}-${index}`}
          data-testid="machine-row"
          className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(6.5rem,0.8fr)_minmax(5rem,0.6fr)_minmax(14rem,1.25fr)_minmax(10rem,1fr)] lg:items-start"
        >
          <div className="col-span-2 min-w-0 lg:col-span-1">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Model</p>
            <p className="truncate text-sm font-medium" title={spec.equipment}>
              {spec.equipment}
            </p>
          </div>
          <SerialPullField
            label="Serial"
            value={spec.serial}
            installId={installId}
            machineIndex={index}
            onValue={(serial) => onChange(patch(index, { serial }))}
            onPulled={(result) => {
              const next = patch(index, {
                serial: result.serial,
                powerVoltage: spec.powerVoltage || result.powerVoltage || "",
              });
              onChange(next);
              onPulled?.(next, result);
            }}
          />
          <div className="min-w-0">
            <label className="grid gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase" htmlFor={`pwr-${index}`}>
              Voltage
              <Input
                id={`pwr-${index}`}
                value={spec.powerVoltage}
                autoComplete="off"
                placeholder="208V"
                onChange={(e) => onChange(patch(index, { powerVoltage: e.target.value }))}
              />
            </label>
          </div>
          <UnitPlaceField serial={spec.serial} model={spec.equipment} compact />
          <MachineRecipeSelect
            customer={customer}
            model={spec.equipment}
            installId={installId}
            recipes={recipes}
            value={spec.recipeId}
            onPick={(recipeId) => {
              const next = patch(index, { recipeId });
              onChange(next);
              onRecipe?.(next);
            }}
          />
        </div>
      ))}
    </div>
  );
}
