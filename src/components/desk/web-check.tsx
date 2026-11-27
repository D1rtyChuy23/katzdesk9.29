import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, ExternalLink, Globe, Phone, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { approveAddressSuggestion } from "@/lib/ops/address-report-api";
import { getAccountWebCheck, listWebChecks } from "@/lib/ops/account-web-api";
import { WEB_STATUS_LABEL, WEB_STATUS_ORDER, webCheckLine, type WebCheck, type WebCheckRow, type WebStatus } from "@/lib/ops/account-web";
import { formatPhone, PLACE_CATEGORY, placeAddress, searchUrl, websiteUrl } from "@/lib/ops/places";
import { toCsv } from "@/lib/ops/customer-export";
import { todayChicago } from "@/lib/ops/clock";
import { useFromHere } from "@/lib/ops/search-params";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilterChip } from "./desk-charts";
import { ListToolbar, ToolbarNote, ToolbarSearch } from "./list-toolbar";
import { ShowMoreButton, useShowMore } from "./show-more";

const TONE: Record<WebStatus, "danger" | "warn" | "outline" | "success"> = {
  closed: "danger",
  different: "warn",
  elsewhere: "warn",
  none: "outline",
  nopin: "outline",
  same: "success",
};

/** What the Web Check shows to start: the three that need a look. */
const NEEDS_A_LOOK: readonly WebStatus[] = ["closed", "different", "elsewhere"];

const NETSUITE_NOTE = "NetSuite is where addresses come from: change it there too, or the next NetSuite import may put the old one back.";

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

function saveCsv(name: string, text: string) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const CSV_COLUMNS = ["Account", "Our Address", "Web Check", "Listing", "Listed Address", "Miles From Our Pin", "Phone", "Website"] as const;

/**
 * The Address Report's Web Check (Chuy, 11/27): every account against current business listings. Closed, at another
 * address, or listed somewhere else come first; an Admin can approve a listing's address (it goes through the same
 * Approve as the rest of the report).
 */
export function WebCheckView() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["web-check"], queryFn: () => listWebChecks(), staleTime: 10 * 60_000 });
  const [picked, setPicked] = useState<readonly WebStatus[]>(NEEDS_A_LOOK);
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const all = q.data?.rows ?? [];
    const wanted = new Set(picked);
    const order = (r: WebCheckRow) => WEB_STATUS_ORDER.indexOf(r.check.status);
    return all
      .filter((r) => wanted.has(r.check.status) && (!needle || r.name.toLowerCase().includes(needle) || (r.address ?? "").toLowerCase().includes(needle)))
      .sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name));
  }, [q.data, picked, needle]);
  const paged = useShowMore(rows, `${picked.join(",")}|${needle}`, 50);
  const approve = useMutation({
    mutationFn: (r: WebCheckRow) => approveAddressSuggestion({ data: { accountId: r.id, expectedAddress: r.address, newAddress: r.check.listedAddress! } }),
    onSuccess: (res) => {
      toast.success(res.status === "updated" ? `Address saved on “${res.account.name}”. ${NETSUITE_NOTE}` : `“${res.account.name}” already has that address`);
      for (const key of [["web-check"], ["account-web"], ["address-report"], ["account-geo"], ["customers"], ["customer-address"], ["account-addresses"], ["customer-history"]]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
    onError: (e) => {
      toast.error(errorText(e, "Could not save the address"));
      void qc.invalidateQueries({ queryKey: ["web-check"] });
    },
  });
  const toggle = (s: WebStatus) => setPicked((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  if (q.isError && !q.data) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-card px-4 py-4 text-sm" role="alert">
        <p className="font-medium text-destructive">Could not run the Web Check.</p>
        <p className="mt-1 text-muted-foreground">{errorText(q.error, "Something went wrong.")}</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void q.refetch()}>
          <RotateCcw className="size-3.5" />
          Try Again
        </Button>
      </div>
    );
  }
  if (!q.data) return <p className="mt-6 text-sm text-muted-foreground">Checking every account against the business listings… (a few seconds)</p>;
  const { counts, canEdit, source } = q.data;

  return (
    <div data-testid="web-check">
      <ListToolbar data-testid="web-check-toolbar">
        <ToolbarSearch value={search} onChange={setSearch} placeholder="Search accounts…" label="Search the Web Check" testId="web-check-search" />
        {WEB_STATUS_ORDER.map((s) => (
          <FilterChip key={s} selected={picked.includes(s)} onClick={() => toggle(s)} data-testid={`web-check-${s}`}>
            {WEB_STATUS_LABEL[s]} {counts[s].toLocaleString("en-US")}
          </FilterChip>
        ))}
        <ToolbarNote data-testid="web-check-total">
          {rows.length.toLocaleString("en-US")} {rows.length === 1 ? "account" : "accounts"}
        </ToolbarNote>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 px-2.5"
          disabled={!rows.length}
          onClick={() =>
            saveCsv(
              `KatzDesk-Web-Check-${todayChicago()}.csv`,
              toCsv(
                CSV_COLUMNS,
                rows.map((r) => [
                  r.name,
                  r.address ?? "",
                  WEB_STATUS_LABEL[r.check.status],
                  r.check.place?.name ?? "",
                  r.check.place ? (placeAddress(r.check.place) ?? "") : "",
                  r.check.miles != null ? r.check.miles.toFixed(2) : "",
                  formatPhone(r.check.place?.phone) ?? "",
                  websiteUrl(r.check.place?.website) ?? "",
                ]),
              ),
            )
          }
          data-testid="web-check-download"
        >
          <Download />
          Download List
        </Button>
      </ListToolbar>
      <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
        Each account against the business listings under its name: at its map pin, or within 25 miles. &ldquo;No listing found&rdquo; is not proof
        of anything: the listings cover restaurants, cafés, hotels, offices and the other Prospects types, in Texas only. {NETSUITE_NOTE}
      </p>
      {!canEdit ? <p className="mt-1 text-xs text-muted-foreground">Only an Admin can approve an address.</p> : null}
      <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card" data-testid="web-check-rows">
        {paged.visible.map((r) => (
          <WebCheckItem key={r.id} row={r} canEdit={canEdit} saving={approve.isPending && approve.variables?.id === r.id} locked={approve.isPending} onApprove={() => approve.mutate(r)} />
        ))}
        {!rows.length ? (
          <li className="px-4 py-8 text-sm text-muted-foreground" data-testid="web-check-empty">
            {needle ? "No accounts match that search." : "No accounts with these results."}
          </li>
        ) : null}
        <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} label="accounts" />
      </ul>
      <p className="mt-2 text-[11px] text-muted-foreground">{source}</p>
    </div>
  );
}

function WebCheckItem({ row: r, canEdit, saving, locked, onApprove }: { row: WebCheckRow; canEdit: boolean; saving: boolean; locked: boolean; onApprove: () => void }) {
  const fromHere = useFromHere("/customers");
  const c = r.check;
  const p = c.place;
  const canApprove = canEdit && !!c.listedAddress && (c.status === "different" || c.status === "elsewhere");
  return (
    <li className="grid gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start md:px-4" data-testid="web-check-row" data-status={c.status}>
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link to="/customers" search={{ open: r.id, from: fromHere }} className="min-w-0 font-medium break-words hover:underline max-sm:py-2">
            {r.name}
          </Link>
          <Badge variant={TONE[c.status]} size="tight" data-testid="web-check-status">
            {WEB_STATUS_LABEL[c.status]}
          </Badge>
          {r.approx ? (
            <Badge variant="outline" size="tight">
              ZIP Area Pin
            </Badge>
          ) : null}
        </div>
        <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Our address</dt>
          <dd className="break-words">{r.address ?? <span className="text-warning">No address</span>}</dd>
          {p ? (
            <>
              <dt className="text-muted-foreground">Listing</dt>
              <dd className="break-words" data-testid="web-check-listing">
                <span className="font-medium">{p.name}</span>
                {placeAddress(p) ? ` · ${placeAddress(p)}` : ""}
                {c.status === "elsewhere" && c.miles != null ? ` · ${c.miles < 10 ? c.miles.toFixed(1) : Math.round(c.miles)} mi from our pin` : ""}
                {p.closed ? <span className="text-destructive"> · permanently closed</span> : null}
              </dd>
            </>
          ) : null}
        </dl>
        {p ? <ListingLinks place={p} className="mt-1" /> : null}
      </div>
      {canApprove ? (
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <Button type="button" size="sm" variant="outline" disabled={locked} onClick={onApprove} data-testid="web-check-approve">
            <Check className="size-3.5" />
            {saving ? "Saving…" : "Use Listed Address"}
          </Button>
          <span className="max-w-56 text-[11px] text-muted-foreground sm:text-right">{c.listedAddress}</span>
        </div>
      ) : null}
    </li>
  );
}

function ListingLinks({ place: p, className }: { place: NonNullable<WebCheck["place"]>; className?: string }) {
  const phone = formatPhone(p.phone);
  const site = websiteUrl(p.website);
  const kind = p.kind ?? PLACE_CATEGORY.get(p.category)?.label;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs", className)}>
      {kind ? <span className="text-muted-foreground">{kind}</span> : null}
      {phone ? (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
          <Phone className="size-3" aria-hidden />
          {phone}
        </a>
      ) : null}
      {site ? (
        <a href={site} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-primary underline-offset-4 hover:underline">
          <Globe className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
        </a>
      ) : null}
      <a href={searchUrl(p)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
        <Search className="size-3" aria-hidden />
        Web Search
      </a>
    </div>
  );
}

/**
 * "On the web" for an account card (Map, Customers): the business listing under the account's name and what it says
 * about the address. Anyone can see it; changing the address is on the Address Report.
 */
export function AccountWebInfo({ accountId, className }: { accountId: number; className?: string }) {
  const q = useQuery({ queryKey: ["account-web", accountId], queryFn: () => getAccountWebCheck({ data: { accountId } }), staleTime: 30 * 60_000 });
  const c = q.data;
  if (q.isPending) return <p className={cn("text-xs text-muted-foreground", className)}>On the web: checking…</p>;
  if (!c || c.status === "nopin") return null;
  const needsLook = c.status === "closed" || c.status === "different" || c.status === "elsewhere";
  return (
    <div className={cn("rounded-md bg-muted/60 px-3 py-2 text-xs", className)} data-testid="account-web-info" data-status={c.status}>
      <p className={cn(c.status === "closed" ? "text-destructive" : needsLook ? "text-warning" : "text-muted-foreground")}>
        <span className="font-medium text-foreground">On the web: </span>
        {webCheckLine(c)}
      </p>
      {c.place ? <ListingLinks place={c.place} className="mt-1" /> : null}
      {needsLook ? (
        <Link to="/address-report" search={{ web: true }} className="mt-1 inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
          <ExternalLink className="size-3" aria-hidden />
          Review on the Address Report
        </Link>
      ) : null}
    </div>
  );
}
