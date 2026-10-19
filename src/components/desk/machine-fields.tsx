import { cn } from "@/lib/utils";
import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertRecipe, deleteRecipe } from "@/lib/ops/api";
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
import { OWNERSHIP_CHOICES, machineGlance, waterNeed } from "@/lib/ops/deal-board";
import type { SerialPullResult } from "@/lib/ops/serial-pull";
import type { Recipe } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "sonner";
import { looksLikePlug, looksLikeVoltage, placePower } from "@/lib/ops/install-form";
import { SerialPullField } from "./serial-notice";
import { UnitPlaceField } from "./unit-place-field";

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
  dealId,
  machineIndex,
  className = "col-span-2 grid min-w-0 gap-1 lg:col-span-1",
}: {
  customer: string;
  model: string;
  installId?: number;
  recipes: Recipe[];
  value: number | null | undefined;
  onPick: (recipeId: number | null) => void;
  /** This deal row does not count as "in use elsewhere" when its recipe is removed. */
  dealId?: number;
  machineIndex?: number;
  className?: string;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const custKey = customer.trim().toLowerCase();
  const modelKey = model.toLowerCase();
  // House templates for this model only; a Linea is never offered a Bunn or Eversys template.
  const house = recipes.filter((r) => !r.customer && r.equipmentModel.toLowerCase() === modelKey).sort(byModelFirst(model));
  const mine = recipes.filter((r) => r.customer?.toLowerCase() === custKey).sort(byModelFirst(model));
  // Before anyone picks, show the recipe this unit already used (account first, then house).
  const fallback = findRecipeFor(recipes, { customer, model, installId: installId ?? null });
  const selectedId = value ?? fallback.linked?.id ?? fallback.house?.id ?? null;
  const selected = recipes.find((r) => r.id === selectedId) ?? null;
  // A recipe picked before this rule stays listed so it is not silently dropped.
  const keep = selected && !house.includes(selected) && !mine.includes(selected) ? selected : null;
  const label = (r: Recipe) =>
    r.equipmentModel.toLowerCase() === modelKey ? recipeLabel(r) : recipeLabel(r, true);
  // Grinders often carry only custom settings (kept in notes), so fall back to the first note line.
  const preview = previewSetting(selected) ?? (selected?.notes?.split("\n")[0]?.slice(0, 72) || null);

  const drop = useMutation({
    mutationFn: (d: { id: number; force: boolean }) =>
      deleteRecipe({
        data: { id: d.id, force: d.force, exceptDealId: dealId ?? null, exceptIndex: machineIndex ?? null },
      }),
    onSuccess: (res, vars) => {
      if (res.needsConfirm && !vars.force) {
        const name = selected ? recipeLabel(selected) : "This recipe";
        if (window.confirm(`${name} is in use elsewhere. Remove it anyway?`)) drop.mutate({ id: vars.id, force: true });
        return;
      }
      if (!res.deleted) return;
      qc.setQueryData<Recipe[]>(["recipes"], (old) => (old ?? []).filter((r) => r.id !== vars.id));
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      if (selectedId === vars.id) onPick(null);
      toast.success("Recipe removed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove that recipe"),
  });

  return (
    <>
    <div className={className}>
      <div className="flex items-end gap-1.5">
        <label className="grid min-w-0 flex-1 gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Recipe
          <SelectField
            aria-label={`Recipe for ${model}`}
            data-testid="machine-recipe"
            value={selectedId ? String(selectedId) : ""}
            disabled={!customer.trim()}
            className="normal-case"
            onChange={(e) => onPick(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">No recipe</option>
            {keep ? <option value={keep.id}>{recipeLabel(keep, true)}</option> : null}
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
          </SelectField>
        </label>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            data-testid="recipe-add"
            disabled={!customer.trim()}
            onClick={() => setAdding(true)}
            className="h-10 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            data-testid="recipe-remove"
            disabled={!selected || drop.isPending}
            onClick={() => selected && drop.mutate({ id: selected.id, force: false })}
            className="h-10 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
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
  onCommit,
  onRemove,
  customer = "",
  recipes = [],
  showRecipe = true,
  recipeInConfig = false,
  where = "install",
  dealId,
  rowLocked,
  rowFooter,
}: {
  /** The recipe column of the install layout. Deals show the recipe on the configuration line instead. */
  showRecipe?: boolean;
  /** Deal rows: the recipe picker sits with Sold, Loan or Lease, plug and water. */
  recipeInConfig?: boolean;
  /** "install" or "deal", for the remove button's label. */
  where?: string;
  /** Deal whose open row should not count as another use when a recipe is removed. */
  dealId?: number;
  /** Take this machine off the install. When given, each block is the one place the machine is listed. */
  onRemove?: (index: number) => void;
  specs: MachineSpec[];
  onChange: (next: MachineSpec[]) => void;
  installId?: number;
  onPulled?: (next: MachineSpec[], result: SerialPullResult) => void;
  /** Save right away when a recipe is picked (existing installs). */
  onRecipe?: (next: MachineSpec[]) => void;
  /** Save right away when Sold, Loan or Lease is chosen (existing installs). Typed fields save with the form. */
  onCommit?: (next: MachineSpec[]) => void;
  customer?: string;
  recipes?: Recipe[];
  /** Deal rows: a machine already on the Board reads as it was sent. From then on it is changed on the Board. */
  rowLocked?: (spec: MachineSpec, index: number) => boolean;
  /** A line under a machine: the deal's Confirm button, or where the machine is on the Board. */
  rowFooter?: (spec: MachineSpec, index: number) => ReactNode;
}) {
  if (!specs.length) return null;

  function patch(index: number, part: Partial<MachineSpec>): MachineSpec[] {
    return specs.map((s, i) => (i === index ? { ...s, ...part } : s));
  }
  const fieldLabel = "grid min-w-0 gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase";

  return (
    <div className="divide-y divide-border" data-testid="machine-rows">
      {specs.map((spec, index) => {
        if (rowLocked?.(spec, index)) {
          return (
            <div key={`${spec.equipment}-${index}`} data-testid="machine-row" data-locked="true" className="py-2">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Model</p>
              <p className="text-sm font-medium">{spec.equipment}</p>
              <p className="mt-0.5 text-xs text-muted-foreground" data-testid="machine-glance">
                {machineGlance(spec) || "No details were set"}
              </p>
              {rowFooter?.(spec, index)}
            </div>
          );
        }
        const need = waterNeed(spec.equipment);
        return (
          <div
            key={`${spec.equipment}-${index}`}
            data-testid="machine-row"
            className={cn(
              "grid grid-cols-2 gap-2 py-2 lg:items-start",
              showRecipe
                ? "lg:grid-cols-[minmax(7rem,1fr)_minmax(6.5rem,0.7fr)_minmax(4.5rem,0.45fr)_minmax(18.5rem,1.2fr)_minmax(9rem,0.9fr)]"
                : // Deal rows: model on one line, then serial, voltage and location side by side.
                  "sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1.1fr)] sm:items-end",
            )}
          >
            <div className={cn("col-span-2 min-w-0", showRecipe ? "lg:col-span-1" : "sm:col-span-3")}>
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Model</p>
              <p className="flex min-w-0 items-center gap-1 text-sm font-medium" title={spec.equipment}>
                {/* Phones: the model name wraps instead of being cut off, and Remove is a 40px target set off from it. */}
                <span className="min-w-0 truncate max-sm:break-words max-sm:whitespace-normal">{spec.equipment}</span>
                {onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove ${spec.equipment} from this ${where}`}
                    title={`Remove from this ${where}`}
                    data-testid="machine-remove"
                    className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground max-sm:ml-1 max-sm:size-10"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </p>
            </div>
            <SerialPullField
              label="Serial"
              compact
              value={spec.serial}
              model={spec.equipment}
              installId={installId}
              machineIndex={index}
              onValue={(serial) => onChange(patch(index, { serial }))}
              onPulled={(result) => {
                if (result.duplicateOnInstall) return;
                const next = patch(index, { serial: result.serial });
                onChange(next);
                onPulled?.(next, result);
              }}
              onUseUnit={(unit) => {
                const next = patch(index, { equipment: unit.model, serial: unit.serial });
                onChange(next);
                onCommit?.(next);
              }}
            />
            <div className="min-w-0">
              <label className="grid gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase" htmlFor={`pwr-${index}`}>
                Voltage
                <Input
                  id={`pwr-${index}`}
                  value={spec.powerVoltage}
                  autoComplete="off"
                  data-testid="machine-voltage"
                  onChange={(e) => {
                    const raw = e.target.value;
                    const placed = placePower(raw, spec.plug ?? "");
                    if (placed.moved === "plug") {
                      toast.message("That reads as a plug, so it went in Plug.");
                      onChange(patch(index, { powerVoltage: "", plug: placed.plug }));
                      return;
                    }
                    onChange(patch(index, { powerVoltage: raw }));
                  }}
                />
                {looksLikePlug(spec.powerVoltage) ? (
                  <span className="text-[11px] font-medium text-warning">This looks like a plug, not voltage.</span>
                ) : null}
              </label>
            </div>
            <div className={showRecipe ? undefined : "col-span-2 sm:col-span-1"}>
              <UnitPlaceField serial={spec.serial} model={spec.equipment} compact />
            </div>
            {showRecipe ? (
              <MachineRecipeSelect
                customer={customer}
                model={spec.equipment}
                installId={installId}
                recipes={recipes}
                value={spec.recipeId}
                dealId={dealId}
                machineIndex={index}
                onPick={(recipeId) => {
                  const next = patch(index, { recipeId });
                  onChange(next);
                  onRecipe?.(next);
                }}
              />
            ) : null}
            {/* One ownership choice, then plug and water. The rep types requirements. Coffee is not a field. */}
            <div className={cn("col-span-full grid grid-cols-2 gap-2", need === "none" ? "sm:grid-cols-2" : "sm:grid-cols-3")} data-testid="machine-config" data-water={need}>
              <label className={fieldLabel}>
                Ownership
                <SelectField
                  aria-label={`Ownership for ${spec.equipment}`}
                  data-testid="machine-ownership"
                  value={spec.ownership === "Sold" || spec.ownership === "Loaned" || spec.ownership === "Leased" ? spec.ownership : ""}
                  allowEmpty
                  emptyLabel="Choose"
                  className="normal-case"
                  onChange={(e) => {
                    const next = patch(index, { ownership: e.target.value });
                    onChange(next);
                    onCommit?.(next);
                  }}
                >
                  {OWNERSHIP_CHOICES.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </SelectField>
              </label>
              <label className={fieldLabel}>
                Plug
                <Input
                  value={spec.plug ?? ""}
                  autoComplete="off"
                  className="normal-case"
                  data-testid="machine-plug"
                  onChange={(e) => {
                    const raw = e.target.value;
                    const placed = placePower(spec.powerVoltage, raw);
                    if (placed.moved === "voltage") {
                      toast.message("That reads as voltage, so it went in Voltage.");
                      onChange(patch(index, { plug: "", powerVoltage: placed.voltage }));
                      return;
                    }
                    onChange(patch(index, { plug: raw }));
                  }}
                />
                {looksLikeVoltage(spec.plug) ? (
                  <span className="text-[11px] font-medium text-warning">This looks like voltage, not a plug.</span>
                ) : null}
              </label>
              {need === "none" ? null : (
                <label className={fieldLabel}>
                  {need === "required" ? "Water" : "Water (If Required)"}
                  <Input value={spec.water ?? ""} autoComplete="off" className="normal-case" data-testid="machine-water" onChange={(e) => onChange(patch(index, { water: e.target.value }))} />
                </label>
              )}
              {recipeInConfig ? (
                <MachineRecipeSelect
                  className="col-span-full grid min-w-0 gap-1"
                  customer={customer}
                  model={spec.equipment}
                  installId={installId}
                  recipes={recipes}
                  value={spec.recipeId}
                  dealId={dealId}
                  machineIndex={index}
                  onPick={(recipeId) => {
                    const next = patch(index, { recipeId });
                    onChange(next);
                    onRecipe?.(next);
                  }}
                />
              ) : null}
            </div>
            {rowFooter ? <div className="col-span-full">{rowFooter(spec, index)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
