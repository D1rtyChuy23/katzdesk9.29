import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { checkUnitFields, OWNERSHIP_VALUES, PART_NUMBER_MAX } from "@/lib/ops/account-equip";
import { addAccountEquipment, editAccountEquipment } from "@/lib/ops/account-equip-edit";
import { listDirectory } from "@/lib/ops/api";

/** What Edit needs of a unit on the list. */
export type EditableUnit = {
  id: number;
  catalogModel: string;
  equipmentName: string;
  serial: string | null;
  partNumber?: string | null;
  ownership: string | null;
  installDate: string | null;
  seen?: string;
};

/**
 * Add equipment, or Edit one unit (Chuy, 11/9). Adding takes the model, serial, Part #, ownership and install date.
 * Edit changes the Part #, ownership and install date; the model and serial are shown, not changed.
 */
export function AccountUnitForm({ customer, unit, onDone }: { customer: string; unit?: EditableUnit | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [partNumber, setPartNumber] = useState(unit?.partNumber ?? "");
  const [ownership, setOwnership] = useState(unit?.ownership ?? "");
  const [installDate, setInstallDate] = useState(unit?.installDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const models = useQuery({
    queryKey: ["directory", "equipment"],
    queryFn: () => listDirectory({ data: { kind: "equipment" } }),
    enabled: !unit,
  });
  const save = useMutation({
    mutationFn: () =>
      unit
        ? editAccountEquipment({ data: { id: unit.id, seen: unit.seen ?? "", partNumber, ownership, installDate } })
        : addAccountEquipment({ data: { customer, model, serial, partNumber, ownership, installDate } }),
    onSuccess: () => {
      toast.success(unit ? "Saved" : "Added to this account");
      void qc.invalidateQueries({ queryKey: ["account-equipment"] });
      void qc.invalidateQueries({ queryKey: ["inspection"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      if (!unit) void qc.invalidateQueries({ queryKey: ["directory", "equipment"] });
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : unit ? "Could not save" : "Could not add"),
  });
  const typed = checkUnitFields({ partNumber, ownership, installDate });
  const problem = "error" in typed ? typed.error : null;
  const submit = () => {
    setError(null);
    if ("error" in typed) return setError(typed.error);
    if (!unit && !model.trim()) return setError("Pick or type the model.");
    save.mutate();
  };
  const id = unit ? `unit-${unit.id}` : "unit-new";
  return (
    <form
      className="rounded-xl border border-border bg-muted/30 p-3"
      data-testid="account-unit-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {unit ? (
        <p className="text-sm font-medium" data-testid="account-unit-fixed">
          {[unit.equipmentName || unit.catalogModel, unit.serial ? `SN ${unit.serial}` : "No serial"].join(" · ")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div data-testid="account-unit-model">
            <ComboField
              label="Model"
              value={model}
              onChange={(v) => {
                setModel(v);
                setError(null);
              }}
              items={models.data ?? []}
              placeholder="Pick or type the model…"
              allowCreate
              disabled={save.isPending}
              noun="model"
              emptyHint="Not on the list: it's added to it."
              menuInFlow
            />
          </div>
          <div>
            <Label htmlFor={`${id}-serial`}>Serial</Label>
            <Input
              id={`${id}-serial`}
              value={serial}
              onChange={(e) => {
                setSerial(e.target.value);
                setError(null);
              }}
              placeholder="Blank if it has none"
              autoComplete="off"
              className="mt-1"
              disabled={save.isPending}
              data-testid="account-unit-serial"
            />
          </div>
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`${id}-part`}>Part #</Label>
          <Input
            id={`${id}-part`}
            value={partNumber}
            maxLength={PART_NUMBER_MAX}
            onChange={(e) => {
              setPartNumber(e.target.value);
              setError(null);
            }}
            placeholder="From the data plate or NetSuite"
            autoComplete="off"
            className="mt-1"
            disabled={save.isPending}
            data-testid="account-unit-part"
          />
        </div>
        <div>
          <Label htmlFor={`${id}-ownership`}>Ownership</Label>
          <SelectField
            id={`${id}-ownership`}
            value={ownership}
            onChange={(e) => {
              setOwnership(e.target.value);
              setError(null);
            }}
            allowEmpty
            className="mt-1"
            disabled={save.isPending}
            data-testid="account-unit-ownership"
          >
            {OWNERSHIP_VALUES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </SelectField>
        </div>
        <div>
          <Label htmlFor={`${id}-installed`}>Install date</Label>
          <Input
            id={`${id}-installed`}
            type="date"
            value={installDate}
            onChange={(e) => {
              setInstallDate(e.target.value);
              setError(null);
            }}
            className="mt-1"
            disabled={save.isPending}
            data-testid="account-unit-install-date"
          />
        </div>
      </div>
      {error || problem ? (
        <p className="mt-2 text-xs text-destructive" data-testid="account-unit-error">
          {error || problem}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="max-sm:h-10" disabled={save.isPending || !!problem || (!unit && !model.trim())} data-testid="account-unit-save">
          {save.isPending ? "Saving…" : unit ? "Save" : "Add equipment"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="max-sm:h-10" disabled={save.isPending} onClick={onDone} data-testid="account-unit-cancel">
          Cancel
        </Button>
      </div>
    </form>
  );
}
