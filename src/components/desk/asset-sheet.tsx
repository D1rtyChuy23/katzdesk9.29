import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  assignAssetToInstall,
  assignAssetToService,
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
import { isOpenInstall } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "./flag-badge";
import { Thread } from "./thread";
import { CustomerCombo, EquipmentCombo } from "./directory-fields";
import { UnitPlaceField, emptyPlaceDraft, type PlaceDraft } from "./unit-place-field";
import { setAssetPlace } from "@/lib/ops/unit-place";
import { lastMoveLine, placeDraftError, unitPlaceLabel } from "@/lib/ops/unit-place-rules";
import { getMyAccess } from "@/lib/ops/access";
import { reviewRackUnit, setShopTest } from "@/lib/ops/rack-stock";
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
  const [retPallet, setRetPallet] = useState("A");
  const [retLevel, setRetLevel] = useState(1);
  const [installId, setInstallId] = useState<string>("");
  const [serviceCustomer, setServiceCustomer] = useState("");
  const [place, setPlace] = useState<PlaceDraft>(emptyPlaceDraft());
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const warehouseOnly = me.data?.role === "warehouse";
  const canStock = !!me.data?.isAdmin || warehouseOnly;
  const [testNote, setTestNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => {
    setModel(asset?.model ?? "");
    setOwned(asset?.customerOwned ?? "");
    setSoldTo(asset?.soldTo ?? "");
    setInstallId("");
    setServiceCustomer("");
    setPlace(emptyPlaceDraft());
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
      void qc.invalidateQueries({ queryKey: ["jobs"] });
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
      setInstallId("");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign"),
  });
  const assignService = useMutation({
    mutationFn: () =>
      assignAssetToService({ data: { assetId: asset!.id, customer: serviceCustomer } }),
    onSuccess: () => {
      toast.success("Pulled for service — off the warehouse board");
      setServiceCustomer("");
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign"),
  });

  const queue = (installs.data ?? []).filter((i) => isOpenInstall(i));
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
                <StatusBadge status={statusLabel(asset)} />
                {asset.needsBay ? <StatusBadge status="Needs bay" /> : null}
                {bay === "catering" ? <StatusBadge status="Catering" /> : null}
                {bay === "dispenser" ? <StatusBadge status="Dispenser" /> : null}
                {asset.reviewStatus === "pending" ? <StatusBadge status="Pending review" /> : null}
                {asset.shopTest === "tested" ? <StatusBadge status="Tested" /> : null}
                {asset.shopTest === "needs-test" ? <StatusBadge status="Needs test" /> : null}
                {asset.missingSerial ? <StatusBadge status="Serial missing" /> : null}
              </div>
            </SheetHeader>
            <SheetBody>
            {canStock ? (
              <div className="space-y-3 border-b border-border p-5">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Shop test</p>
                <p className="text-sm text-muted-foreground">
                  Shop status only. Tested does not mean installed or left for a job.
                  {asset.shopTest === "tested" && asset.shopTestBy
                    ? ` Marked by ${asset.shopTestBy}${asset.shopTestAt ? ` · ${asset.shopTestAt.slice(0, 16).replace("T", " ")}` : ""}.`
                    : ""}
                </p>
                <Input
                  value={testNote}
                  onChange={(e) => setTestNote(e.target.value)}
                  placeholder="Optional note"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={asset.shopTest === "needs-test" ? "default" : "outline"}
                    onClick={() =>
                      void setShopTest({ data: { id: asset.id, shopTest: "needs-test", note: testNote || null } })
                        .then(() => {
                          toast.success("Needs test");
                          void qc.invalidateQueries({ queryKey: ["assets"] });
                        })
                        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update"))
                    }
                  >
                    Needs test
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={asset.shopTest === "tested" ? "default" : "outline"}
                    onClick={() =>
                      void setShopTest({ data: { id: asset.id, shopTest: "tested", note: testNote || null } })
                        .then(() => {
                          toast.success("Tested");
                          void qc.invalidateQueries({ queryKey: ["assets"] });
                        })
                        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not update"))
                    }
                  >
                    Tested
                  </Button>
                </div>
                {asset.shopTestNote ? <p className="text-xs text-muted-foreground">{asset.shopTestNote}</p> : null}
              </div>
            ) : null}
            {me.data?.isAdmin && asset.reviewStatus === "pending" ? (
              <div className="space-y-3 border-b border-border p-5" data-testid="rack-review">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Needs review</p>
                <p className="text-sm text-muted-foreground">
                  Warehouse put this unit on the rack. Approve it, or reject with a note. Reject does not leave a second copy.
                </p>
                <Input
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Note if you reject"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      void reviewRackUnit({ data: { id: asset.id, decision: "approve" } })
                        .then(() => {
                          toast.success("Approved");
                          void qc.invalidateQueries({ queryKey: ["assets"] });
                        })
                        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not approve"))
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void reviewRackUnit({ data: { id: asset.id, decision: "reject", note: rejectNote } })
                        .then(() => {
                          toast.success("Rejected");
                          setRejectNote("");
                          onClose();
                          void qc.invalidateQueries({ queryKey: ["assets"] });
                        })
                        .catch((e) => toast.error(e instanceof Error ? e.message : "Could not reject"))
                    }
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ) : asset.reviewStatus === "rejected" && asset.reviewNote ? (
              <div className="border-b border-border p-5">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Rejected</p>
                <p className="mt-1 text-sm">{asset.reviewNote}</p>
              </div>
            ) : null}
            <form
              key={asset.id}
              className="grid gap-3 border-b border-border p-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const err = place.site ? placeDraftError(place) : null;
                if (err) {
                  toast.error(err);
                  return;
                }
                save.mutate(
                  {
                    id: asset.id,
                    model,
                    serial: String(fd.get("serial") || "") || null,
                    qty: Number(fd.get("qty") || 1),
                    customerOwned: owned || null,
                    purpose: String(fd.get("purpose") || "") || null,
                    notes: String(fd.get("notes") || "") || null,
                  },
                  {
                    onSuccess: async () => {
                      if (!place.site) return;
                      try {
                        const next = await setAssetPlace({
                          data: {
                            id: asset.id,
                            site: place.site,
                            pallet: place.pallet || null,
                            level: place.level ? Number(place.level) : null,
                            otherLabel: place.otherLabel || null,
                          },
                        });
                        toast.success(next.place ? `Now at ${next.place}` : "Location saved");
                        setPlace(emptyPlaceDraft());
                        void qc.invalidateQueries({ queryKey: ["assets"] });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not set location");
                      }
                    },
                  },
                );
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
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Now:{" "}
                  {unitPlaceLabel({
                    site: asset.site,
                    pallet: asset.pallet,
                    level: asset.level,
                    status: asset.status,
                    soldTo: asset.soldTo,
                    purpose: asset.purpose,
                  })}
                </p>
                {lastMoveLine(asset.notes) ? (
                  <p className="mt-1 text-xs text-muted-foreground">{lastMoveLine(asset.notes)}</p>
                ) : null}
                <div className="mt-2">
                  <UnitPlaceField
                    assetId={asset.id}
                    serial={asset.serial ?? ""}
                    model={asset.model}
                    draft={place}
                    onDraft={setPlace}
                  />
                </div>
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" size="sm" disabled={save.isPending}>Save</Button>
              </div>
            </form>

            {asset.needsBay ? (
              <div className="space-y-3 border-b border-border p-5">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Needs a bay</p>
                <p className="text-sm text-muted-foreground">
                  This unit’s letter is Q or after P. Put it on A–P so it sits on the map. It stays in
                  the warehouse list until you do.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <SelectField
                    value={retSite}
                    onChange={(e) => {
                      const s = e.target.value as "barn-back" | "barn-front";
                      setRetSite(s);
                      setRetPallet(s === "barn-front" ? FRONT_PALLETS[0]! : "A");
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
                <Button
                  size="sm"
                  disabled={save.isPending}
                  onClick={() =>
                    save.mutate({
                      id: asset.id,
                      site: retSite,
                      pallet: retPallet,
                      level: retLevel,
                    })
                  }
                >
                  Put on {retPallet}
                </Button>
              </div>
            ) : null}

            {asset.status === "ready" && !warehouseOnly ? (
              <div className="space-y-5 border-b border-border p-5">
                <div className="space-y-3">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">Pull for install</p>
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
                </div>
                <div className="space-y-3">
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">Pull for service</p>
                  <p className="text-xs text-muted-foreground">
                    Pick an account already on the customer list. The unit leaves the rack.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <CustomerCombo
                        label="Customer"
                        value={serviceCustomer}
                        onChange={setServiceCustomer}
                        allowCreate={false}
                        placeholder="Search accounts…"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={!serviceCustomer.trim() || assignService.isPending}
                      onClick={() => assignService.mutate()}
                    >
                      Assign & remove from barn
                    </Button>
                  </div>
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
                    ? asset.installId
                      ? `Out on ${asset.soldTo ?? "an install"}. Put it back on a slot to free the account.`
                      : `Out on service for ${asset.soldTo ?? "an account"}. Put it back on a slot when it returns.`
                    : `Currently at ${SITE_LABEL[asset.site] ?? asset.site}.`}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <SelectField
                    value={retSite}
                    onChange={(e) => {
                      const s = e.target.value as "barn-back" | "barn-front";
                      setRetSite(s);
                      setRetPallet(s === "barn-front" ? FRONT_PALLETS[0]! : "A");
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
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function statusLabel(asset: { status: string; site?: string; installId: number | null; purpose: string | null }) {
  if (asset.site === "staging") return "Staging";
  if (asset.status === "ready") return "Ready";
  if (asset.status === "deployed") return "In use";
  if (asset.status === "assigned") {
    if (asset.installId) return "On an install";
    if (asset.purpose?.toLowerCase().includes("service")) return "On service";
    return "Pulled";
  }
  if (asset.status === "sold") return "Sold";
  return asset.status;
}
