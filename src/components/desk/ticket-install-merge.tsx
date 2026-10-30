/**
 * Merge into install (Grok through Chuy, 2026-10-30): on a ticket whose WO is on an install, an Admin merges the ticket
 * into that install after a confirm that names the install kept and what moves. A merged ticket shows where its work
 * went. The Tickets page lists the pairs for an Admin.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatLongDate, todayChicago } from "@/lib/ops/clock";
import {
  mergeTicketIntoInstall,
  previewTicketInstallMerge,
  type InstallMergePreview,
  type TicketInstallMergeResult,
} from "@/lib/ops/ticket-install-merge";
import type { ServiceJob } from "@/lib/ops/types";
import { OpenLink } from "./open-link";
import { useTicketInstallMatches, useTicketInstallPairs } from "./ticket-install-queries";

const LINK = "text-sm font-medium text-primary underline-offset-2 hover:underline";

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const dayOf = (stamp: string | null | undefined) => (stamp ? formatLongDate(todayChicago(new Date(stamp))) : null);

/** A live ticket whose WO is on an install: say so, and offer the merge (Admins). */
export function InstallMergeBanner({ job, pending, onMerge }: { job: ServiceJob; pending: boolean; onMerge: (installId: number) => void }) {
  const matches = useTicketInstallMatches(job);
  const list = job.duplicateOf ? [] : (matches.data ?? []);
  if (!list.length) return null;
  return (
    <div className="space-y-3 border-b border-warning/30 bg-warning/10 px-5 py-3 text-sm" data-testid="ticket-install-merge">
      {list.map((m) => (
        <div key={m.installId}>
          <p className="font-medium">
            {m.wo} is also on install #{m.installId}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {m.customer} · {m.status}
            {m.completedAt ? ` · completed ${formatLongDate(m.completedAt)}` : ""}. If this ticket is that install&apos;s work, merge it: its charges, notes,
            units, part lines and pings go to the install, and the ticket is hidden.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => onMerge(m.installId)} data-testid="ticket-install-merge-open">
              Merge into install #{m.installId}…
            </Button>
            <OpenLink entityType="install" id={m.installId} className={LINK}>
              Open install #{m.installId}
            </OpenLink>
          </div>
        </div>
      ))}
    </div>
  );
}

/** A ticket merged into an install: where its work is now. It has no form, so closing it saves nothing. */
export function MergedIntoInstallBanner({ job }: { job: ServiceJob }) {
  if (!job.mergedInstallId) return null;
  const when = dayOf(job.mergedInstallAt);
  return (
    <div className="border-b border-border bg-muted/40 px-5 py-3 text-sm" data-testid="ticket-merged-into-install">
      <p className="font-medium">This ticket was merged into install #{job.mergedInstallId}.</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {[when ? `On ${when}` : null, job.mergedInstallBy ? `by ${job.mergedInstallBy}` : null].filter(Boolean).join(" ")}
        {when || job.mergedInstallBy ? ". " : ""}
        {job.mergedBilledOn
          ? `Its charges stay billed on ${job.mergedBilledOn} (the install lists them as billed); its Ping notes, units, part lines and pings are on the install, and its text is under the install's notes.`
          : "Its charges, Ping notes, units, part lines and pings are on the install, and its text is under the install's notes."}{" "}
        The ticket is kept as a record and hidden from the lists.
      </p>
      <div className="mt-2">
        <OpenLink entityType="install" id={job.mergedInstallId} className={LINK}>
          Open install #{job.mergedInstallId}
        </OpenLink>
      </div>
    </div>
  );
}

/** What a merged ticket said, read-only. */
export function MergedTicketSummary({ job }: { job: ServiceJob }) {
  const rows = [
    ["WO #", job.wo],
    ["Status when merged", job.status],
    ["Issue", job.issue],
    ["Description of work", job.workDone],
    ["Notes", job.notes],
  ].filter(([, v]) => String(v ?? "").trim());
  return (
    <dl className="grid gap-3 border-b border-border p-5 text-sm sm:grid-cols-2" data-testid="merged-ticket-summary">
      {rows.map(([label, value]) => (
        <div key={label} className={label === "Notes" || label === "Issue" || label === "Description of work" ? "sm:col-span-2" : undefined}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function MoveRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <li className="flex gap-2" data-testid={testId}>
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0">{value}</span>
    </li>
  );
}

function PreviewBody({ p }: { p: InstallMergePreview }) {
  const m = p.moves;
  // Billed on a Sales Order (10/30): the charges stay billed there and never go on the install's invoice.
  const charges = m.billed
    ? `${m.chargeLines ? `${count(m.chargeLines, "line")}, ${money(m.chargeTotal)}. ` : ""}${m.billed.text}`
    : m.chargeLines
      ? `${count(m.chargeLines, "line")}, ${money(m.chargeTotal)}: on the install's invoice, waiting for an Admin to approve${
          m.invoiceTotal !== m.chargeTotal ? ` (the invoice comes to ${money(m.invoiceTotal)})` : ""
        }. They bill with the install now, not in the tickets' billing export.`
      : "None";
  return (
    <div className="mt-4 space-y-4 text-sm">
      <section>
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Kept</h3>
        <p className="mt-1" data-testid="install-merge-kept">
          Install #{p.install.id} · {p.install.customer} · {p.install.status}
          {p.install.completedAt ? ` · completed ${formatLongDate(p.install.completedAt)}` : ""}
        </p>
      </section>
      <section>
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Moves to the install</h3>
        <ul className="mt-1 space-y-1" data-testid="install-merge-moves">
          <MoveRow label="Charges" value={charges} testId="install-merge-charges" />
          {m.invoicePo ? <MoveRow label="P.O." value={`${m.invoicePo}, on the install's invoice`} testId="install-merge-po" /> : null}
          <MoveRow label="Notes" value={m.notes ? count(m.notes, "note") + " from its Ping tab" : "None"} />
          <MoveRow label="Equipment" value={m.units.length ? m.units.join(", ") : "No units pulled onto it"} />
          <MoveRow label="Part lines" value={m.partLines ? count(m.partLines, "WO part line") : "None"} />
          <MoveRow label="Pings" value={m.pings ? `${count(m.pings, "ping")} (they open the install)` : "None"} />
          {m.rebuilds.length ? <MoveRow label="Rebuilds" value={m.rebuilds.join(", ")} /> : null}
          {m.mergedTickets ? <MoveRow label="Tickets" value={`${count(m.mergedTickets, "ticket")} merged into this one before`} /> : null}
        </ul>
      </section>
      <section>
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Added under the install&apos;s notes</h3>
        <pre className="mt-1 rounded-lg border border-border bg-muted/40 p-3 font-sans text-xs whitespace-pre-wrap" data-testid="install-merge-note">
          {p.note}
        </pre>
        <p className="mt-1 text-xs text-muted-foreground">The install&apos;s own notes stay as they are; this goes under them.</p>
      </section>
      <section>
        <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Then the ticket</h3>
        <p className="mt-1">Is marked merged and hidden from Tickets. Nothing is deleted; the ticket keeps:</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
          {p.stays.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>
      {p.warnings.length ? (
        <ul className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs" data-testid="install-merge-warnings">
          {p.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      {p.refusal ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="install-merge-refusal">
          Can&apos;t merge: {p.refusal}
        </p>
      ) : null}
    </div>
  );
}

/** The confirm: read fresh each time it opens, and the merge goes ahead only on what it showed. */
export function InstallMergeDialog({
  job,
  installId,
  onClose,
  onMerged,
}: {
  job: ServiceJob;
  installId: number | null;
  onClose: () => void;
  onMerged: (result: TicketInstallMergeResult) => void;
}) {
  const open = installId != null;
  const preview = useQuery({
    queryKey: ["ticket-install-merge-preview", job.id, installId],
    queryFn: () => previewTicketInstallMerge({ data: { jobId: job.id, installId: installId! } }),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const p = preview.data;
  const merge = useMutation({
    mutationFn: () => mergeTicketIntoInstall({ data: { jobId: job.id, installId: installId!, stamps: p!.stamps } }),
    onSuccess: (r) => {
      toast.success(`Merged into install #${r.installId}${r.billedOn ? ` · its charges stay billed on ${r.billedOn}` : ""}`);
      onMerged(r);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      // Show the ticket and the install as they are now.
      void preview.refetch();
    },
  });
  const label = job.callId + (job.wo ? ` (${job.wo})` : "");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !merge.isPending) onClose();
      }}
    >
      <DialogContent className="sm:max-w-xl" data-testid="install-merge-dialog" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>
          Merge {label} into install #{installId}?
        </DialogTitle>
        <DialogDescription>
          Install #{installId} is kept. The ticket&apos;s work moves onto it and the ticket is hidden; nothing is deleted.
        </DialogDescription>
        {preview.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Reading the ticket and the install…</p>
        ) : preview.isError ? (
          <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="install-merge-refusal">
            {preview.error instanceof Error ? preview.error.message : "Could not read the ticket and the install."}
          </p>
        ) : p ? (
          <PreviewBody p={p} />
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={merge.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => merge.mutate()}
            disabled={!p || !!p.refusal || merge.isPending || preview.isFetching}
            data-testid="install-merge-confirm"
          >
            {merge.isPending ? "Merging…" : `Merge into install #${installId}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The Tickets page's list for an Admin: live tickets whose WO is on an install, and the last merges. */
export function TicketInstallPairsPanel({
  kind,
  onOpenTicket,
  onClose,
}: {
  kind: "service" | "tlc";
  onOpenTicket: (jobId: number) => void;
  onClose: () => void;
}) {
  const q = useTicketInstallPairs(kind, true);
  const pairs = q.data?.pairs ?? [];
  const merged = q.data?.merged ?? [];
  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-4" data-testid="tickets-install-pairs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium">{kind === "tlc" ? "TLC visits" : "Tickets"} whose WO is on an install</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open one to merge it into its install. Its charges, notes, units, part lines and pings move there, and the ticket is hidden.
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {q.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Looking for them…</p>
      ) : !pairs.length ? (
        <p className="mt-3 text-sm text-muted-foreground">None right now.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {pairs.map((p) => (
            <li key={`${p.jobId}-${p.install.installId}`} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid="install-pair">
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {p.wo} · {p.customer || "No customer"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Ticket {p.callId} · {p.status}
                  {p.received ? ` · came in ${formatLongDate(p.received)}` : ""} — install #{p.install.installId} · {p.install.customer} · {p.install.status}
                  {p.install.completedAt ? ` · completed ${formatLongDate(p.install.completedAt)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Button type="button" size="sm" variant="outline" onClick={() => onOpenTicket(p.jobId)}>
                  Open ticket
                </Button>
                <OpenLink entityType="install" id={p.install.installId} className={LINK}>
                  Install #{p.install.installId}
                </OpenLink>
              </div>
            </li>
          ))}
        </ul>
      )}
      {merged.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Merged lately</h3>
          <ul className="mt-1 space-y-1 text-sm" data-testid="install-merges-recent">
            {merged.map((m) => (
              <li key={m.jobId} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <button type="button" className="text-left hover:underline" onClick={() => onOpenTicket(m.jobId)}>
                  {m.callId}
                  {m.wo ? ` (${m.wo})` : ""}
                </button>
                <span className="text-xs text-muted-foreground">
                  into install #{m.installId} · {m.installCustomer}
                  {m.mergedBy ? ` · by ${m.mergedBy}` : ""}
                  {dayOf(m.mergedAt) ? ` · ${dayOf(m.mergedAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
