import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { checkUnitFields, OWNERSHIP_VALUES, PART_NUMBER_MAX } from "@/lib/ops/account-equip";
import { addAccountEquipment, editAccountEquipment } from "@/lib/ops/account-equip-edit";
import { getMyAccess } from "@/lib/ops/access";
import { isDeskAdmin } from "@/lib/ops/admin-role";
import { listDirectory } from "@/lib/ops/api";
import { getModelPartNumbers, MODEL_NOT_IN_CATALOG, partNumberHint } from "@/lib/ops/unit-model-change";
import { EquipmentHistoryList } from "./equipment-history-list";

/** What Edit needs of a unit on the list. */
export type EditableUnit = {
  id: number;
  catalogModel: string;
  equipmentName: string;
  serial: string | null;
  partNumber?: string | null;
  ownership: string | null;
  installDate: string | null;
  condition?: string | null;
  seen?: string;
};

/**
 * Add equipment, or Edit one unit (Chuy, 11/9). Adding takes the model, serial, Part #, ownership and install date.
 * Edit changes the Part #, ownership, install date and condition (11/19); an Admin can also fix the serial and change
 * the model to another one on the equipment list (asked first, in a dialog), and the unit's history shows below.
 */
export function AccountUnitForm({ customer, unit, onDone }: { customer: string; unit?: EditableUnit | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [partNumber, setPartNumber] = useState(unit?.partNumber ?? "");
  const [ownership, setOwnership] = useState(unit?.ownership ?? "");
  const [installDate, setInstallDate] = useState(unit?.installDate ?? "");
  const [condition, setCondition] = useState(unit?.condition ?? "");
  const [editSerial, setEditSerial] = useState(unit?.serial ?? "");
  const [editModel, setEditModel] = useState(unit?.catalogModel ?? "");
  const [confirmModel, setConfirmModel] = useState(false);
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess(), enabled: !!unit });
  const admin = isDeskAdmin(me.data);
  // The version Edit opened with: a list refresh while it's open must not let it save over a newer save.
  const [seen] = useState(unit?.seen ?? "");
  const [error, setError] = useState<string | null>(null);
  const models = useQuery({
    queryKey: ["directory", "equipment"],
    queryFn: () => listDirectory({ data: { kind: "equipment" } }),
    enabled: !unit || admin,
  });
  // An Admin's model change: only a model on the equipment list (Edit never adds one).
  const listed = (models.data ?? []).find((m) => m.name.trim().toLowerCase() === editModel.trim().toLowerCase())?.name ?? null;
  const modelChanged = !!unit && admin && editModel.trim() !== "" && editModel.trim().toLowerCase() !== unit.catalogModel.trim().toLowerCase();
  const modelProblem = !modelChanged ? null : !models.data ? "Loading the equipment list…" : !listed ? MODEL_NOT_IN_CATALOG : null;
  const parts = useQuery({
    queryKey: ["model-part-numbers", unit?.catalogModel, listed],
    queryFn: () => getModelPartNumbers({ data: { models: [unit!.catalogModel, listed!] } }),
    enabled: modelChanged && !!listed,
  });
  const partHint = modelChanged && listed && parts.data ? partNumberHint(partNumber, parts.data[unit!.catalogModel] ?? null, parts.data[listed] ?? null) : null;
  const save = useMutation({
    mutationFn: () =>
      unit
        ? editAccountEquipment({
            data: {
              id: unit.id,
              seen,
              partNumber,
              ownership,
              installDate,
              condition,
              ...(admin && editSerial !== (unit.serial ?? "") ? { serial: editSerial } : {}),
              ...(modelChanged && listed ? { model: listed } : {}),
            },
          })
        : addAccountEquipment({ data: { customer, model, serial, partNumber, ownership, installDate } }),
    onSuccess: () => {
      toast.success(unit ? "Saved" : "Added to this account");
      void qc.invalidateQueries({ queryKey: ["account-equipment"] });
      void qc.invalidateQueries({ queryKey: ["inspection"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      if (!unit) void qc.invalidateQueries({ queryKey: ["directory", "equipment"] });
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : unit ? "Could not save" : "Could not add"),
  });
  const typed = checkUnitFields({ partNumber, ownership, installDate }, { keepOwnership: unit?.ownership });
  // An ownership from before today's list stays a choice on its own unit.
  const oldOwnership = unit?.ownership && !(OWNERSHIP_VALUES as readonly string[]).includes(unit.ownership) ? unit.ownership : null;
  const problem = ("error" in typed ? typed.error : null) || modelProblem;
  const submit = () => {
    setError(null);
    if ("error" in typed) return setError(typed.error);
    if (modelProblem) return setError(modelProblem);
    if (!unit && !model.trim()) return setError("Pick or type the model.");
    // A model change is asked first, in the app's own dialog.
    if (modelChanged && listed) return setConfirmModel(true);
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <p className="text-sm font-medium" data-testid="account-unit-fixed">
            {[unit.equipmentName || unit.catalogModel, !admin ? (unit.serial ? `SN ${unit.serial}` : "No serial") : null].filter(Boolean).join(" · ")}
          </p>
          {admin ? (
            <div data-testid="account-unit-model-edit">
              <ComboField
                label="Model (Admin)"
                value={editModel}
                onChange={(v) => {
                  setEditModel(v);
                  setError(null);
                }}
                items={models.data ?? []}
                placeholder="Pick a model on the equipment list…"
                allowCreate={false}
                emptyHint="Not on the equipment list. Add it to the equipment list first."
                disabled={save.isPending}
                noun="model"
                menuInFlow
              />
            </div>
          ) : null}
          {admin ? (
            <div>
              <Label htmlFor={`${id}-serial-edit`}>Serial (Admin)</Label>
              <Input
                id={`${id}-serial-edit`}
                value={editSerial}
                onChange={(e) => {
                  setEditSerial(e.target.value);
                  setError(null);
                }}
                placeholder="Blank if it has none"
                autoComplete="off"
                className="mt-1 uppercase"
                disabled={save.isPending}
                data-testid="account-unit-serial-edit"
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      <div className={`mt-3 grid grid-cols-1 gap-3 ${unit ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
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
            placeholder="Data plate or NetSuite"
            autoComplete="off"
            className="mt-1"
            disabled={save.isPending}
            data-testid="account-unit-part"
          />
          {partHint ? (
            <p className="mt-1 text-xs text-muted-foreground" data-testid="account-unit-part-hint">
              {listed} is usually Part # {partHint}.{" "}
              <button type="button" className="font-medium text-primary" onClick={() => setPartNumber(partHint)}>
                Use it
              </button>
            </p>
          ) : null}
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
            {oldOwnership ? <option value={oldOwnership}>{oldOwnership}</option> : null}
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
        {unit ? (
          <div>
            <Label htmlFor={`${id}-condition`}>Condition</Label>
            <Input
              id={`${id}-condition`}
              value={condition}
              maxLength={40}
              onChange={(e) => {
                setCondition(e.target.value);
                setError(null);
              }}
              placeholder="Good, Fair, Needs work…"
              autoComplete="off"
              className="mt-1"
              disabled={save.isPending}
              data-testid="account-unit-condition"
            />
          </div>
        ) : null}
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
      {unit ? <EquipmentHistoryList unitId={unit.id} /> : null}
      {unit ? (
        <Dialog open={confirmModel} onOpenChange={setConfirmModel}>
          <DialogContent className="p-4" data-testid="account-unit-model-confirm">
            <DialogTitle>Change model?</DialogTitle>
            <DialogDescription className="mt-2 text-sm">
              Change model from {unit.catalogModel} to {listed} for {(admin ? editSerial : unit.serial) ? `SN ${(admin ? editSerial : unit.serial)!.trim().toUpperCase()}` : "this unit (no serial)"}?
            </DialogDescription>
            <p className="mt-2 text-xs text-muted-foreground">
              The unit keeps its serial, history, installs, pre-inspection and PM links. Its row on open installs follows the new model.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmModel(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={save.isPending}
                onClick={() => {
                  setConfirmModel(false);
                  save.mutate();
                }}
                data-testid="account-unit-model-confirm-yes"
              >
                Change Model
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </form>
  );
}
