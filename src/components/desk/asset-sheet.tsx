import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  assignAssetToInstall,
  listInstalls,
  markAssetSold,
  returnAssetToWarehouse,
  updateAsset,
} from "@/lib/ops/api";
import {
  BACK_PALLETS,
  FRONT_PALLETS,
  LEVELS,
  SITE_LABEL,
  bayFor,
} from "@/lib/ops/warehouse";
import type { Asset } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "./flag-badge";
import { Thread } from "./thread";
import { CustomerCombo, EquipmentCombo } from "./directory-fields";
import { toast } from "sonner";

export function AssetSheet({
  asset,
  onClose,
}: {
  asset: Asset | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const installs = useQuery({
    queryKey: ["installs"],
    queryFn: () => listInstalls(),
    enabled: !!asset,
  });
  const [soldTo, setSoldTo] = useState("");
  const [model, setModel] = useState(asset?.model ?? "");
  const [owned, setOwned] = useState(asset?.customerOwned ?? "");
  const [retSite, setRetSite] = useState<"barn-back" | "barn-front">("barn-back");
  const [retPallet, setRetPallet] = useState("H");
  const [retLevel, setRetLevel] = useState(1);
  const [installId, setInstallId] = useState<string>("");

  useEffect(() => {
    setModel(asset?.model ?? "");
    setOwned(asset?.customerOwned ?? "");
    setSoldTo(asset?.soldTo ?? "");
  }, [asset?.id]);

  const save = useMutation({
    mutationFn: (d: Parameters<typeof updateAsset>[0]["data"]) => updateAsset({ data: d }),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const ret = useMutation({
    mutationFn: () =>
      returnAssetToWarehouse({
        data: { id: asset!.id, site: retSite, pallet: retPallet, level: retLevel },
      }),
    onSuccess: () => {
      toast.success("Back on the rack");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not return"),
  });
  const sold = useMutation({
    mutationFn: () => markAssetSold({ data: { id: asset!.id, soldTo } }),
    onSuccess: () => {
      toast.success("Marked sold");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not sell"),
  });
  const assign = useMutation({
    mutationFn: () =>
      assignAssetToInstall({ data: { assetId: asset!.id, installId: Number(installId) } }),
    onSuccess: () => {
      toast.success("Pulled for install — off the warehouse board");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign"),
  });

  const queue = (installs.data ?? []).filter((i) => !i.complete && i.equipStatus !== "Installed");
  const pallets = retSite === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
  const bay = asset ? bayFor(asset.site, asset.pallet) : "general";

  return (
    <Sheet open={!!asset} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {asset ? (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">
                {asset.slotLabel}
                {asset.customerOwned ? ` · owned by ${asset.customerOwned}` : ""}
              </p>
              <SheetTitle>{asset.model}</SheetTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge status={statusLabel(asset.status)} />
                {bay === "catering" ? <StatusBadge status="Catering" /> : null}
                {bay === "dispenser" ? <StatusBadge status="Dispenser" /> : null}
                {asset.missingSerial ? <StatusBadge status="Serial missing" /> : null}
              </div>
            </SheetHeader>
            <form
              key={asset.id}
              className="grid gap-3 border-b border-border p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                save.mutate({
                  id: asset.id,
                  model,
                  serial: String(fd.get("serial") || "") || null,
                  qty: Number(fd.get("qty") || 1),
                  customerOwned: owned || null,
                  purpose: String(fd.get("purpose") || "") || null,
                  notes: String(fd.get("notes") || "") || null,
                });
              }}
            >
              <div className="sm:col-span-2">
                <EquipmentCombo name="model" label="Model" value={model} onChange={setModel} required />
              </div>
              <div>
                <Label htmlFor="serial">Serial</Label>
                <Input id="serial" name="serial" className="mt-1" defaultValue={asset.serial ?? ""} />
              </div>
              <div>
                <Label htmlFor="qty">Qty</Label>
                <Input id="qty" name="qty" type="number" min={1} className="mt-1" defaultValue={String(asset.qty)} />
              </div>
              <div className="sm:col-span-2">
                <CustomerCombo
                  name="customerOwned"
                  label="Customer-owned (if any)"
                  value={owned}
                  onChange={setOwned}
                  placeholder="Search customers…"
                />
              </div>
              <div>
                <Label htmlFor="purpose">Purpose</Label>
                <Input id="purpose" name="purpose" className="mt-1" defaultValue={asset.purpose ?? ""} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" className="mt-1" defaultValue={asset.notes ?? ""} />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
              </div>
            </form>

            {asset.status === "ready" ? (
              <div className="space-y-3 border-b border-border p-5">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Pull for an install</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <SelectField
                    className="flex-1"
                    value={installId}
                    onChange={(e) => setInstallId(e.target.value)}
                    allowEmpty
                    emptyLabel="Choose account"
                  >
                    {queue.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.customer} · {i.equipment ?? "no model"}
                      </option>
                    ))}
                  </SelectField>
                  <Button
                    size="sm"
                    disabled={!installId || assign.isPending}
                    onClick={() => assign.mutate()}
                  >
                    Assign & remove from barn
                  </Button>
                </div>
                {!asset.customerOwned ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <CustomerCombo
                        label=""
                        value={soldTo}
                        onChange={setSoldTo}
                        placeholder="Sold to…"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!soldTo.trim() || sold.isPending}
                      onClick={() => sold.mutate()}
                    >
                      Mark sold
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-warning">Customer-owned — return, don’t sell.</p>
                )}
              </div>
            ) : asset.status !== "sold" ? (
              <div className="space-y-3 border-b border-border p-5">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Return to barn</p>
                <p className="text-sm text-muted-foreground">
                  {asset.status === "assigned"
                    ? `Out on ${asset.soldTo ?? "an install"}. Put it back on a slot to free the account.`
                    : `Currently at ${SITE_LABEL[asset.site] ?? asset.site}.`}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <SelectField
                    value={retSite}
                    onChange={(e) => {
                      const s = e.target.value as "barn-back" | "barn-front";
                      setRetSite(s);
                      setRetPallet(s === "barn-front" ? "J" : "H");
                    }}
                  >
                    <option value="barn-back">Back rack</option>
                    <option value="barn-front">Front rack</option>
                  </SelectField>
                  <SelectField value={retPallet} onChange={(e) => setRetPallet(e.target.value)}>
                    {pallets.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </SelectField>
                  <SelectField
                    value={String(retLevel)}
                    onChange={(e) => setRetLevel(Number(e.target.value))}
                  >
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        L{l}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => ret.mutate()} disabled={ret.isPending}>
                    Return to warehouse
                  </Button>
                  {!asset.customerOwned ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!soldTo.trim() || sold.isPending}
                      onClick={() => sold.mutate()}
                    >
                      Mark sold
                    </Button>
                  ) : null}
                </div>
                {!asset.customerOwned ? (
                  <Input
                    placeholder="Sold to…"
                    value={soldTo}
                    onChange={(e) => setSoldTo(e.target.value)}
                  />
                ) : null}
              </div>
            ) : (
              <p className="border-b border-border px-5 py-4 text-sm text-muted-foreground">
                Sold to {asset.soldTo ?? "—"} {asset.soldAt ? `on ${asset.soldAt}` : ""}.
              </p>
            )}
            <Thread entityType="asset" entityId={asset.id} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function statusLabel(s: string) {
  if (s === "ready") return "Ready";
  if (s === "deployed") return "In use";
  if (s === "assigned") return "On an install";
  if (s === "sold") return "Sold";
  return s;
}
