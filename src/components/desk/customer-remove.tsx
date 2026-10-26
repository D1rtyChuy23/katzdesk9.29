import type { CustomerRecord } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Calls, TLCs, PMs and installs on the account that aren't done yet. */
const openWorkOf = (c: CustomerRecord) => c.pendingCalls + c.pendingTlcs + c.pendingPms + c.pendingInstalls;
/** Every call, TLC, PM, install and deal under the name. */
const recordsOf = (c: CustomerRecord) => c.calls + c.tlcs + c.pms + c.installs + c.deals;

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/**
 * The one confirmation for Remove, from a row, the selection or the account window: what comes off the list, which
 * accounts still have open work, and that nothing is deleted.
 */
export function RemoveCustomersDialog({
  accounts,
  pending,
  onConfirm,
  onClose,
}: {
  accounts: CustomerRecord[];
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const n = accounts.length;
  const busy = accounts.filter((c) => openWorkOf(c) > 0);
  const one = n === 1 ? accounts[0]! : null;
  return (
    <Dialog open={n > 0} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent data-testid="remove-customers">
        <DialogTitle>{one ? `Remove “${one.name}”?` : `Remove ${plural(n, "account", "accounts")}?`}</DialogTitle>
        <DialogDescription>
          {one ? "It comes" : "They come"} off the Customers list and out of the pickers. Nothing is deleted: calls, PMs,
          installs and deals keep the name, and Removed on Customers can bring {one ? "it" : "them"} back.
        </DialogDescription>
        {busy.length ? (
          <p className="mt-3 rounded-md border border-warning/50 bg-warning/10 px-3 py-2 text-sm" data-testid="remove-open-work">
            {one ? "It has open work" : `${plural(busy.length, "has", "have")} open work`}
            {one ? "" : `: ${busy.slice(0, 5).map((c) => c.name).join(", ")}${busy.length > 5 ? ` and ${busy.length - 5} more` : ""}`}. Removing
            doesn&rsquo;t close {busy.length === 1 ? "it" : "them"}.
          </p>
        ) : null}
        {one ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {one.accountNumber ? `Account # ${one.accountNumber} · ` : "No Account Number · "}
            {plural(recordsOf(one), "record", "records")}
          </p>
        ) : (
          <ul className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-border text-sm" data-testid="remove-list">
            {accounts.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-1.5 last:border-b-0">
                <span className="min-w-0 break-words">{c.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground tabular">
                  {c.accountNumber ? `# ${c.accountNumber} · ` : ""}
                  {plural(recordsOf(c), "record", "records")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending} data-testid="remove-confirm">
            {pending ? "Removing…" : one ? "Remove Account" : `Remove ${plural(n, "Account", "Accounts")}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
