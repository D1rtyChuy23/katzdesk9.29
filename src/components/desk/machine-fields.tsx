import { useMutation, useQueryClient } from "@tanstack/react-query";
import { copyRecipe } from "@/lib/ops/api";
import { findRecipeFor } from "@/lib/ops/equipment";
import { previewSetting } from "@/lib/ops/recipe-fields";
import type { MachineSpec } from "@/lib/ops/machines";
import type { SerialPullResult } from "@/lib/ops/serial-pull";
import type { Recipe } from "@/lib/ops/types";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "sonner";
import { SerialPullField } from "./serial-notice";
import { UnitPlaceField } from "./unit-place-field";

function shortPreview(recipe: Recipe | null): string {
  const line = previewSetting(recipe);
  if (!line) return "";
  return line.length > 28 ? `${line.slice(0, 27)}…` : line;
}

function MachineRecipeSelect({
  customer,
  model,
  installId,
  recipes,
}: {
  customer: string;
  model: string;
  installId?: number;
  recipes: Recipe[];
}) {
  const qc = useQueryClient();
  const { linked, house } = findRecipeFor(recipes, {
    customer,
    model,
    installId: installId ?? null,
  });
  const copy = useMutation({
    mutationFn: (sourceId: number) =>
      copyRecipe({ data: { sourceId, customer, installId: installId ?? null } }),
    onSuccess: () => {
      toast.success("Recipe on this account");
      void qc.invalidateQueries({ queryKey: ["recipes"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not use that recipe"),
  });
  const houseLabel = house ? `House${shortPreview(house) ? ` · ${shortPreview(house)}` : ""}` : "";
  const accountLabel = linked ? `Account${shortPreview(linked) ? ` · ${shortPreview(linked)}` : ""}` : "";
  return (
    <label className="col-span-2 grid min-w-0 gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase lg:col-span-1">
      Recipe
      <SelectField
        aria-label={`Recipe for ${model}`}
        data-testid="machine-recipe"
        value={linked ? `id:${linked.id}` : ""}
        disabled={copy.isPending || !customer.trim()}
        onChange={(e) => {
          const v = e.target.value;
          if (!v.startsWith("house:") || !house || linked) return;
          copy.mutate(house.id);
        }}
      >
        <option value="">Choose</option>
        {house && !linked ? <option value={`house:${house.id}`}>{houseLabel}</option> : null}
        {linked ? <option value={`id:${linked.id}`}>{accountLabel}</option> : null}
      </SelectField>
    </label>
  );
}

export function MachineFields({
  specs,
  onChange,
  installId,
  onPulled,
  customer = "",
  recipes = [],
}: {
  specs: MachineSpec[];
  onChange: (next: MachineSpec[]) => void;
  installId?: number;
  onPulled?: (next: MachineSpec[], result: SerialPullResult) => void;
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
          className="grid grid-cols-1 gap-2 py-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(6.5rem,0.85fr)_minmax(5rem,0.7fr)_minmax(18rem,1.45fr)_minmax(7rem,0.8fr)] lg:items-end"
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
          />
        </div>
      ))}
    </div>
  );
}
