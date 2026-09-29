import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { decideStockAction, requestStockAssign, requestStockRemove } from "@/lib/ops/stock-actions";
import { REMOVE_REASONS, isWarehouseStockPlace, removeReasonError } from "@/lib/ops/stock-action-rules";
import { CUSTOMER_SITES } from "@/lib/ops/unit-place-rules";
import { SITE_LABEL } from "@/lib/ops/warehouse";
import type { Asset } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { CustomerCombo } from "./directory-fields";
import { StatusBadge } from "./flag-badge";
import { toast } from "sonner";

export function StockActions({
  asset,
  canStock,
  isAdmin,
}: {
  asset: Asset;
  canStock: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"remove" | "assign" | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [customer, setCustomer] = useState("");
  const [site, setSite] = useState("");
  const [busy, setBusy] = useState(false);
  const house = isWarehouseStockPlace(asset.site);
  const hold = asset.stockHold;
  if (!hold && (!canStock || !house)) return null;
  if (!hold && asset.status !== "ready" && asset.status !== "deployed") return null;

  const serial = asset.serial?.trim() || "";
  const tag = serial || String(asset.id);

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["assets"] });
    await qc.invalidateQueries({ queryKey: ["account-equipment"] });
    await qc.invalidateQueries({ queryKey: ["notifications"] });
    await qc.invalidateQueries({ queryKey: ["unit-place"] });
  }

  async function confirmRemove() {
    const err = removeReasonError(reason, note);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      const res = await requestStockRemove({ data: { id: asset.id, reason, note: note.trim() || null } });
      toast.success(res.pending ? "Pending removal" : "Removed from stock");
      setMode(null);
      setReason("");
      setNote("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAssign() {
    if (!customer.trim()) {
      toast.error("Pick an account.");
      return;
    }
    setBusy(true);
    try {
      const res = await requestStockAssign({
        data: { id: asset.id, customer: customer.trim(), site: site || null },
      });
      toast.success(res.pending ? `Pending customer assign · ${res.customer}` : `Assigned to ${res.customer}`);
      setMode(null);
      setCustomer("");
      setSite("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    try {
      await decideStockAction({ data: { id: asset.id, decision } });
      toast.success(decision === "approve" ? "Approved" : "Rejected — it stays in the slot");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  if (hold === "remove" || hold === "assign") {
    const outbound = hold === "assign";
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="stock-pending">
        <StatusBadge status={outbound ? "Pending outbound" : "Pending removal"} />
        <span className="text-xs text-muted-foreground">
          {outbound
            ? `Waiting to go to ${asset.stockHoldCustomer || "an account"}. Hidden there until approved.`
            : `Waiting to leave${asset.stockHoldReason ? ` · ${asset.stockHoldReason}` : ""}. Still in this slot.`}
        </span>
        {isAdmin ? (
          <>
            <Button type="button" size="sm" disabled={busy} data-testid="stock-approve" onClick={() => void decide("approve")}>
              Approve
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} data-testid="stock-reject" onClick={() => void decide("reject")}>
              Reject
            </Button>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Button
        type="button"
        size="sm"
        variant={mode === "remove" ? "default" : "outline"}
        data-testid={`remove-${tag}`}
        onClick={() => setMode((cur) => (cur === "remove" ? null : "remove"))}
      >
        Remove
      </Button>
      <Button
        type="button"
        size="sm"
        variant={mode === "assign" ? "default" : "outline"}
        data-testid={`assign-${tag}`}
        onClick={() => setMode((cur) => (cur === "assign" ? null : "assign"))}
      >
        Assign to customer
      </Button>
      {mode === "remove" ? (
        <div className="flex w-full flex-wrap items-end gap-2" data-testid="remove-panel">
          <label className="grid gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Reason
            <SelectField
              aria-label="Removal reason"
              data-testid="remove-reason"
              className="min-w-52"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option value="">Choose</option>
              {REMOVE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectField>
          </label>
          <Input
            aria-label="Removal note"
            data-testid="remove-note"
            className="max-w-56"
            value={note}
            placeholder={reason === "Other" ? "Note required" : "Note, optional"}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="button" size="sm" disabled={busy || !!removeReasonError(reason, note)} data-testid="remove-confirm" onClick={() => void confirmRemove()}>
            {busy ? "Saving…" : "Confirm remove"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setMode(null)}>
            Cancel
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            {isAdmin
              ? "This takes it off the rack. The record stays."
              : "It stays in this slot until an admin approves. You can’t approve your own removal."}
          </p>
        </div>
      ) : null}
      {mode === "assign" ? (
        <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]" data-testid="assign-panel">
          <CustomerCombo
            label="Account"
            value={customer}
            onChange={setCustomer}
            placeholder="Search accounts…"
            allowCreate={isAdmin}
          />
          <label className="grid gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Site
            <SelectField
              aria-label="Site"
              data-testid="assign-site"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            >
              <option value="">No site</option>
              {CUSTOMER_SITES.map((s) => (
                <option key={s} value={s}>
                  {SITE_LABEL[s] ?? s}
                </option>
              ))}
            </SelectField>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" size="sm" disabled={busy || !customer.trim()} data-testid="assign-confirm" onClick={() => void confirmAssign()}>
              {busy ? "Saving…" : "Confirm assign"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            {isAdmin
              ? "It leaves the rack and shows on that account. One serial stays one record. Walk-In needs a real café."
              : "It stays in this slot and stays off the account until an admin approves. You can’t approve your own assign."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
