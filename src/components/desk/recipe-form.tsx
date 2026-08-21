import { useState } from "react";
import { copyRecipe, upsertRecipe } from "@/lib/ops/api";
import {
  DEFAULT_SETTING_NAMES,
  SETTING_FIELDS,
  filledSettingNames,
  type SettingName,
} from "@/lib/ops/recipe-fields";
import type { Recipe } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { CustomerCombo, EquipmentCombo } from "./directory-fields";

export type RecipeDraft = {
  recipe: Recipe | null;
  customer: string | null;
  equipmentModel: string;
  installId: number | null;
  copiedFrom: number | null;
  lockCustomer?: boolean;
  lockEquipment?: boolean;
  /** Prefill settings when creating from a house/other recipe. */
  source?: Recipe | null;
};

export function RecipeForm({
  draft,
  models: _models,
  customers: _customers,
  pending,
  copyPending,
  onSave,
  onCopy,
}: {
  draft: RecipeDraft;
  models: string[];
  customers: string[];
  pending: boolean;
  copyPending?: boolean;
  onSave: (d: Parameters<typeof upsertRecipe>[0]["data"]) => void;
  onCopy?: (d: Parameters<typeof copyRecipe>[0]["data"]) => void;
}) {
  const recipe = draft.recipe;
  const settingsSrc = recipe ?? null;
  const [modelPick, setModelPick] = useState(recipe?.equipmentModel || draft.equipmentModel || "");
  const [customerPick, setCustomerPick] = useState(
    recipe ? (recipe.customer ?? "") : draft.customer ? draft.customer : "",
  );
  const [visible, setVisible] = useState<Set<SettingName>>(
    () => new Set(recipe ? filledSettingNames(recipe) : DEFAULT_SETTING_NAMES),
  );
  const [copyTo, setCopyTo] = useState("");
  const isHouse = !!recipe && !recipe.customer;

  const hidden = SETTING_FIELDS.filter((f) => !visible.has(f.name));
  const shown = SETTING_FIELDS.filter((f) => visible.has(f.name));
  const sourceName = draft.source
    ? draft.source.customer
      ? `${draft.source.customer} · ${draft.source.equipmentModel}`
      : `House · ${draft.source.equipmentModel}`
    : recipe?.copiedFrom
      ? "another recipe"
      : null;

  function hide(name: SettingName) {
    setVisible((prev) => {
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
  }

  function show(name: SettingName) {
    setVisible((prev) => new Set(prev).add(name));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const model = String(fd.get("equipmentModel") || "").trim();
        if (!model) return;
        const customerRaw = isHouse ? "" : String(fd.get("customer") || "").trim();
        const customer = customerRaw ? customerRaw : null;
        const val = (name: SettingName) =>
          visible.has(name) ? String(fd.get(name) || "") || null : null;
        onSave({
          id: recipe?.id,
          equipmentModel: model,
          customer,
          installId: draft.installId,
          copiedFrom: draft.copiedFrom || recipe?.copiedFrom || null,
          coffee1: val("coffee1"),
          coffee2: val("coffee2"),
          coffee3: val("coffee3"),
          powder1: val("powder1"),
          powder2: val("powder2"),
          powder3: val("powder3"),
          americano1: val("americano1"),
          americano2: val("americano2"),
          americano3: val("americano3"),
          tea1: val("tea1"),
          tea2: val("tea2"),
          milk: val("milk"),
          notes: String(fd.get("notes") || "") || null,
        });
      }}
    >
      {sourceName && !recipe ? (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Settings start blank. Fill them in for this account — nothing is copied automatically.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          {isHouse ? (
            <>
              <Label>Customer</Label>
              <p className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                House template
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Saving updates this shared template. Assign it to a customer below — that creates a
                copy and leaves the template in place.
              </p>
            </>
          ) : draft.lockCustomer ? (
            <>
              <Label>Customer</Label>
              <p className="mt-1 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {draft.customer || "House template"}
              </p>
              <input type="hidden" name="customer" value={draft.customer ?? ""} />
            </>
          ) : (
            <>
              <CustomerCombo
                name="customer"
                value={customerPick}
                onChange={setCustomerPick}
                placeholder="Search customers — blank is a house template"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave blank for a house template shared by every account.
              </p>
            </>
          )}
        </div>

        <div>
          <EquipmentCombo
            name="equipmentModel"
            value={modelPick}
            onChange={setModelPick}
            required
            placeholder="Search the full equipment list…"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Scroll the list or type a model to add it.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((f) => (
          <div
            key={f.name}
            className={cn("relative rounded-lg border border-border p-3 pt-2", f.name === "milk" && "sm:col-span-2")}
          >
            <div className="flex items-center justify-between gap-2 pr-10">
              <Label htmlFor={f.name}>{f.label}</Label>
            </div>
            <button
              type="button"
              onClick={() => hide(f.name)}
              className="absolute top-1 right-1 flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`Remove ${f.label}`}
              title={`Remove ${f.label}`}
            >
              <X className="size-4" />
            </button>
            <Textarea
              id={f.name}
              name={f.name}
              className="mt-1 min-h-20"
              defaultValue={(settingsSrc?.[f.name] as string | null) ?? ""}
              placeholder="Dose, yield, time, temp…"
            />
          </div>
        ))}
      </div>

      {hidden.length ? (
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Add a setting</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {hidden.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => show(f.name)}
                className="inline-flex h-9 items-center gap-1 rounded-full border border-border bg-card px-3 text-sm hover:bg-muted"
              >
                <Plus className="size-3.5" />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" className="mt-1" defaultValue={settingsSrc?.notes ?? ""} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !modelPick}>
          {recipe ? "Save recipe" : draft.customer ? `Save for ${draft.customer}` : "Create recipe"}
        </Button>
      </div>

      {recipe && onCopy ? (
        <div className="rounded-lg border border-border p-3">
          <p className="text-sm font-medium">{isHouse ? "Assign to a customer" : "Reuse for another customer"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isHouse
              ? "Keeps this house template. Creates a customer recipe with the same settings — fill those in here first."
              : "Copies these settings onto a new account. Shared with techs and sales."}
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <CustomerCombo
                label=""
                value={copyTo}
                onChange={setCopyTo}
                placeholder="Pick a customer…"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!copyTo || copyPending}
              onClick={() => onCopy({ sourceId: recipe.id, customer: copyTo })}
            >
              {isHouse ? "Assign" : "Copy recipe"}
            </Button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
