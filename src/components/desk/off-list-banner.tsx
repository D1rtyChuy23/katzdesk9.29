import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  addInspectionUnitToList,
  getInstallInspection,
  linkInspectionUnit,
  removeInspectionEquipment,
  type InspectionView,
} from "@/lib/ops/inspection-api";
import { Button } from "@/components/ui/button";

const sn = (serial: string | null | undefined) => (serial?.trim() ? `SN ${serial.trim()}` : "No serial");

// A review row: the machine, then its buttons beside it when both fit and on the line below when not. The name column
// starts at 14rem, so on a phone the buttons move under it instead of squeezing the name to a letter a line.
const ROW = "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-3 py-2";
const NAME = "min-w-0 grow basis-56";
const ACTIONS = "flex max-w-full flex-wrap gap-2";
// A label longer than the card ("Same machine as La Marzocco Linea PB 3 Group AV · SN PB001708") wraps inside it.
const ACTION = "h-auto min-h-8 py-1.5 text-balance whitespace-normal";

/**
 * The Equipment tab's review of what the two tabs and the account don't agree on. A unit only the Pre-inspection has
 * is added to this list, taken off the pre-inspection, or linked to the machine it is; a unit on the account that is
 * likely a machine here with no serial or a short one ("L") is linked to it. Someone chooses each one; nothing is added
 * or linked on its own. Reads the same pre-inspection the tab beside it does.
 */
export function OffListBanner({ installId }: { installId: number }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["inspection", installId],
    queryFn: () => getInstallInspection({ data: { installId } }),
  });
  const done = (view: InspectionView, message: string) => {
    qc.setQueryData(["inspection", installId], view);
    void qc.invalidateQueries({ queryKey: ["installs"] });
    void qc.invalidateQueries({ queryKey: ["unit-mismatches"] });
    void qc.invalidateQueries({ queryKey: ["account-equipment"] });
    toast.success(message);
  };
  const fail = (fallback: string) => (e: unknown) => toast.error(e instanceof Error ? e.message : fallback);
  const add = useMutation({
    mutationFn: (equipmentId: number) => addInspectionUnitToList({ data: { installId, equipmentId } }),
    onSuccess: (view) => done(view, "Added to the equipment list"),
    onError: fail("Could not add it to the equipment list"),
  });
  const drop = useMutation({
    mutationFn: (equipmentId: number) => removeInspectionEquipment({ data: { installId, equipmentId } }),
    onSuccess: (view) => done(view, `${view.removed} removed from the pre-inspection`),
    onError: fail("Could not remove it"),
  });
  const link = useMutation({
    mutationFn: (d: { fromEquipmentId: number; toEquipmentId: number }) => linkInspectionUnit({ data: { installId, ...d } }),
    onSuccess: (view) => done(view, "Linked: one machine now, with its checks and photos"),
    onError: fail("Could not link them"),
  });
  const machines = q.data?.machines ?? [];
  const off = machines.filter((m) => !m.onList);
  const onAccount = q.data?.accountMatches ?? [];
  if (!off.length && !onAccount.length) return null;
  const busy = add.isPending || drop.isPending || link.isPending;
  const unitOf = (id: number) => machines.find((m) => m.equipmentId === id);
  const askLink = (from: { equipmentId: number; name: string; serial: string | null }, to: { equipmentId: number; name: string; serial: string }) => {
    const ok = window.confirm(
      `Make ${from.name} (${sn(from.serial)}) and ${to.name} (${sn(to.serial)}) one machine? It keeps ${sn(to.serial)}, with this visit's checks and photos.`,
    );
    if (ok) link.mutate({ fromEquipmentId: from.equipmentId, toEquipmentId: to.equipmentId });
  };
  return (
    <section aria-label="Machines to review" className="border-b border-border bg-warning/5 px-4 py-3" data-testid="off-list-banner">
      {off.length ? (
        <>
          <p className="text-sm font-medium">On the Pre-inspection only</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {off.length === 1 ? "This machine is" : "These machines are"} on this install's pre-inspection but not on its equipment list. Add each
            one here, take it off the pre-inspection, or link it to the machine it is, so both tabs list the same machines.
          </p>
          <ul className="mt-2 grid gap-2">
            {off.map((m) => {
              const label = `${m.name}${m.serial ? ` · SN ${m.serial}` : ""}`;
              return (
                <li key={m.equipmentId} className={ROW} data-testid={`off-list-row-${m.equipmentId}`}>
                  <span className={NAME}>
                    <span className="block text-sm font-medium break-words">{m.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[sn(m.serial), m.electrical || null, `Pre-inspection ${m.overall.toLowerCase()}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <div className={ACTIONS}>
                    {m.sameAs.map((c) => (
                      <Button
                        key={c.equipmentId}
                        type="button"
                        size="sm"
                        variant="outline"
                        className={ACTION}
                        disabled={m.locked || busy}
                        onClick={() => askLink(m, c)}
                        data-testid={`off-list-same-${m.equipmentId}-${c.equipmentId}`}
                      >
                        Same machine as {c.name} · {sn(c.serial)}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      className={ACTION}
                      disabled={m.locked || busy}
                      onClick={() => add.mutate(m.equipmentId)}
                      data-testid={`off-list-add-${m.equipmentId}`}
                    >
                      Add to this list
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={ACTION}
                      disabled={m.locked || busy}
                      onClick={() => {
                        if (!window.confirm(`Take ${label} off the pre-inspection? Its checks and photos for this visit go with it.`)) return;
                        drop.mutate(m.equipmentId);
                      }}
                      data-testid={`off-list-remove-${m.equipmentId}`}
                    >
                      Remove from pre-inspection
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {onAccount.length ? (
        <div className={off.length ? "mt-3" : undefined} data-testid="account-matches">
          <p className="text-sm font-medium">On this account, not on this install</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The account already has {onAccount.length === 1 ? "this machine" : "these machines"} with a serial, the same model as a machine
            here with no serial or a short one. If it is that machine, link them: one unit is left, with the account's serial and this
            visit's checks and photos.
          </p>
          <ul className="mt-2 grid gap-2">
            {onAccount.map((a) => (
              <li key={a.equipmentId} className={ROW} data-testid={`account-match-${a.equipmentId}`}>
                <span className={NAME}>
                  <span className="block text-sm font-medium break-words">{a.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[sn(a.serial), a.records > 1 ? `${a.records} records on the account` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <div className={ACTIONS}>
                  {a.forUnits.map((id) => {
                    const unit = unitOf(id);
                    if (!unit) return null;
                    return (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        className={ACTION}
                        disabled={unit.locked || busy}
                        onClick={() => askLink(unit, a)}
                        data-testid={`account-link-${a.equipmentId}-${id}`}
                      >
                        It's the {unit.name} here ({sn(unit.serial)})
                      </Button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
