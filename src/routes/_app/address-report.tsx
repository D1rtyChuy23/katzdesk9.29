import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useFromHere } from "@/lib/ops/search-params";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Lock, RotateCcw, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  approveAddressSuggestion,
  listAddressReport,
  restoreAddressReportRow,
  skipAddressReportRow,
  type AddressReportRow,
} from "@/lib/ops/address-report-api";
import { DEFAULT_PAGE_SIZE, MAX_ACCOUNT_ID, MAX_PAGE_NUMBER, MAX_SEARCH_LENGTH, pageCount, type AddressSuggestion } from "@/lib/ops/address-report";
import { formatPingTime } from "@/lib/ops/clock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/desk/desk-charts";
import { ListToolbar, ToolbarNote, ToolbarSearch } from "@/components/desk/list-toolbar";

const toNumber = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);
const toBoolean = (v: unknown) => (v === "true" || v === "1" || v === 1 ? true : v === "false" || v === "0" || v === 0 ? false : v);

/** ?account=<id> shows just that account (even if skipped); ?skipped=true shows the skipped rows; ?page=<n> from 1. */
const searchSchema = z.object({
  account: z.preprocess(toNumber, z.number().int().positive().max(MAX_ACCOUNT_ID)).optional().catch(undefined),
  skipped: z.preprocess(toBoolean, z.boolean()).optional().catch(undefined),
  // Same caps as the server: anything else falls back to the whole report, or the first page.
  page: z.preprocess(toNumber, z.number().int().min(1).max(MAX_PAGE_NUMBER)).optional().catch(undefined),
});

export type AddressReportSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/_app/address-report")({
  validateSearch: (s: Record<string, unknown>): AddressReportSearch => searchSchema.parse(s),
  component: Page,
});

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate({ from: Route.fullPath });
  const { account, skipped = false, page = 1 } = Route.useSearch();
  const [q, setQ] = useState("");
  const [needle, setNeedle] = useState("");
  // Search on the server a moment after typing stops, from the first page.
  useEffect(() => {
    const t = setTimeout(() => setNeedle(q.trim().slice(0, MAX_SEARCH_LENGTH).trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const go = (next: AddressReportSearch) => void navigate({ search: next, replace: true });
  useEffect(() => {
    if (needle && page !== 1) go({ skipped: skipped || undefined });
    // Only a new search goes back to page 1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needle]);

  const report = useQuery({
    queryKey: ["address-report", { account: account ?? null, skipped, page, search: needle }],
    queryFn: () =>
      listAddressReport({
        data: { page, pageSize: DEFAULT_PAGE_SIZE, account, skipped: skipped || undefined, search: account ? undefined : needle || undefined },
      }),
    placeholderData: keepPreviousData,
  });
  const data = report.data;
  const pages = data ? pageCount(data.total, data.pageSize) : 1;
  // The last row of the last page was approved or skipped: step back to the page that still exists.
  useEffect(() => {
    if (data && !report.isPlaceholderData && !account && page > pages) go({ skipped: skipped || undefined, page: pages > 1 ? pages : undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, report.isPlaceholderData, page, pages]);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["address-report"] });
  }

  const approve = useMutation({
    mutationFn: (d: { row: AddressReportRow; suggestion: AddressSuggestion }) =>
      approveAddressSuggestion({ data: { accountId: d.row.id, expectedAddress: d.row.address, newAddress: d.suggestion.address } }),
    onSuccess: (res) => {
      toast.success(res.status === "updated" ? `Address saved on “${res.account.name}”` : `“${res.account.name}” already has that address`);
      refresh();
      // The address shows on lists, ticket windows, the account window and the map.
      void qc.invalidateQueries({ queryKey: ["account-addresses"] });
      void qc.invalidateQueries({ queryKey: ["customer-address"] });
      void qc.invalidateQueries({ queryKey: ["account-geo"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => {
      toast.error(errorText(e, "Could not save the address"));
      refresh();
    },
  });
  const skip = useMutation({
    mutationFn: (row: AddressReportRow) => skipAddressReportRow({ data: { accountId: row.id } }),
    onSuccess: (_res, row) => {
      toast.success(`Skipped “${row.name}”. It is under Skipped until you bring it back.`);
      refresh();
    },
    onError: (e) => toast.error(errorText(e, "Could not skip")),
  });
  const restore = useMutation({
    mutationFn: (row: AddressReportRow) => restoreAddressReportRow({ data: { accountId: row.id } }),
    onSuccess: (_res, row) => {
      toast.success(`“${row.name}” is back on the report`);
      refresh();
    },
    onError: (e) => toast.error(errorText(e, "Could not bring it back")),
  });
  const busyId = approve.isPending ? approve.variables?.row.id : skip.isPending ? skip.variables?.id : restore.isPending ? restore.variables?.id : null;
  const savingAddress = approve.isPending ? approve.variables?.suggestion.address : null;

  const one = account ? data?.rows[0] : undefined;

  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Address Report</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Accounts the map cannot place: no pin, or only a ZIP area pin. Each one shows its address and any other address
            KatzDesk has on file for it. Approve one to save it on the account, or skip the account. Nothing changes until
            you approve. Accounts with a possible address are listed first.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/map">Map</Link>
          </Button>
        </div>
      </header>

      {account ? (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" data-testid="address-account-note">
          <p className="text-muted-foreground">
            {report.isLoading
              ? "Loading the account…"
              : !one
                ? "That account is not on the customer list."
                : one.status === "skipped"
                  ? "Showing one account. It is skipped, so it stays off the report until you bring it back."
                  : one.status === "approved"
                    ? "Showing one account. An approved address is saved on it, so it stays off the report unless its address changes."
                    : one.hasStreetPin
                      ? "Showing one account. It has a street pin, so it is not on the report."
                      : "Showing one account from the report."}
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/address-report" search={{}} data-testid="address-whole-report">
              Whole Report
            </Link>
          </Button>
        </div>
      ) : (
        <ListToolbar data-testid="address-toolbar">
          <ToolbarSearch value={q} onChange={setQ} placeholder="Search accounts…" label="Search the address report" testId="address-search" />
          <FilterChip selected={!skipped} onClick={() => go({})} data-testid="address-view-open">
            Open {data ? data.counts.open.toLocaleString("en-US") : ""}
          </FilterChip>
          <FilterChip selected={skipped} onClick={() => go({ skipped: true })} data-testid="address-view-skipped">
            Skipped {data ? data.counts.skipped.toLocaleString("en-US") : ""}
          </FilterChip>
          {data ? (
            <ToolbarNote data-testid="address-total">
              {data.total.toLocaleString("en-US")} {data.total === 1 ? "account" : "accounts"}
              {needle ? ` matching “${needle}”` : ""}
            </ToolbarNote>
          ) : null}
        </ListToolbar>
      )}

      {data && !data.canEdit ? <p className="mt-3 text-xs text-muted-foreground">Only an Admin can approve or skip addresses.</p> : null}
      {report.isError && !data ? (
        <div className="mt-4 rounded-xl border border-border bg-card px-4 py-4 text-sm" role="alert">
          <p className="font-medium text-destructive">Could not load the address report.</p>
          <p className="mt-1 text-muted-foreground">{errorText(report.error, "Something went wrong.")}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void report.refetch()}>
            <RotateCcw className="size-3.5" />
            Try Again
          </Button>
        </div>
      ) : null}

      {report.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Loading the report…</p> : null}

      {data && (data.rows.length || !account) ? (
        <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card" data-testid="address-rows" aria-busy={report.isFetching}>
          {data.rows.map((row) => (
            <ReportRow
              key={row.id}
              row={row}
              canEdit={data.canEdit}
              saving={busyId === row.id ? savingAddress ?? null : null}
              locked={busyId != null}
              onApprove={(suggestion) => approve.mutate({ row, suggestion })}
              onSkip={() => skip.mutate(row)}
              onRestore={() => restore.mutate(row)}
            />
          ))}
          {!data.rows.length ? (
            <li className="px-4 py-8 text-sm text-muted-foreground" data-testid="address-empty">
              {needle
                ? "No accounts match that search."
                : skipped
                  ? "No skipped accounts. Skip one on Open to leave it off the report."
                  : "Nothing to review: every active account has a street pin, an approved address or a skip."}
            </li>
          ) : null}
        </ul>
      ) : null}

      {data && !account && data.total > data.pageSize ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2" data-testid="address-pager">
          <p className="text-xs text-muted-foreground" data-testid="address-page">
            Page {Math.min(page, pages)} of {pages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                go({ skipped: skipped || undefined, page: page - 1 > 1 ? page - 1 : undefined });
                window.scrollTo({ top: 0 });
              }}
              data-testid="address-prev"
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pages}
              onClick={() => {
                go({ skipped: skipped || undefined, page: page + 1 });
                window.scrollTo({ top: 0 });
              }}
              data-testid="address-next"
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ReportRow({
  row,
  canEdit,
  saving,
  locked,
  onApprove,
  onSkip,
  onRestore,
}: {
  row: AddressReportRow;
  canEdit: boolean;
  /** The suggestion being approved on this row right now. */
  saving: string | null;
  /** Another save is running: hold every button until it finishes. */
  locked: boolean;
  onApprove: (s: AddressSuggestion) => void;
  onSkip: () => void;
  onRestore: () => void;
}) {
  const fromReport = useFromHere("/customers");
  const pin = row.hasStreetPin ? "Street Pin" : row.pinQuality === "approx" ? "ZIP Area Pin" : "No Pin";
  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)] gap-2 border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start md:px-4"
      data-testid="address-row"
      data-id={row.id}
      data-status={row.status}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link to="/customers" search={{ open: row.id, from: fromReport }} className="min-w-0 font-medium break-words hover:underline max-sm:py-2" data-testid="address-name">
            {row.name}
          </Link>
          {row.nameLocked ? <Lock className="size-3.5 shrink-0 text-primary" aria-label="Name locked from the clean list" /> : null}
          {row.accountNumber ? (
            <span className="rounded-full border border-border px-2 text-[11px] text-muted-foreground tabular">Account # {row.accountNumber}</span>
          ) : null}
          <Badge variant={row.hasStreetPin ? "success" : row.pinQuality === "approx" ? "warn" : "outline"} size="tight" data-testid="address-pin">
            {pin}
          </Badge>
          {row.status === "skipped" ? (
            <Badge variant="outline" size="tight" data-testid="address-status">
              Skipped
            </Badge>
          ) : row.status === "approved" ? (
            <Badge variant="success" size="tight" data-testid="address-status">
              Approved
            </Badge>
          ) : null}
        </div>
        <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Address</dt>
          <dd className="break-words" data-testid="address-current">
            {row.address ?? <span className="font-medium text-warning">No address</span>}
          </dd>
          {row.geocodeAddress ? (
            <>
              <dt className="text-muted-foreground">Geocoder</dt>
              <dd className="break-words text-muted-foreground">{row.geocodeAddress}</dd>
            </>
          ) : null}
        </dl>
        {row.reviewedAt ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.status === "skipped" ? "Skipped" : "Approved"}
            {row.reviewedBy ? ` by ${row.reviewedBy}` : ""} · {formatPingTime(row.reviewedAt)}
          </p>
        ) : null}
        {row.suggestions.length ? (
          <ul className="mt-2 grid gap-1.5" aria-label={`Possible addresses for ${row.name}`}>
            {row.suggestions.map((s) => (
              <li
                key={s.address}
                className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                data-testid="address-suggestion"
              >
                <div className="min-w-0">
                  <p className="text-sm break-words" data-testid="address-suggestion-text">
                    {s.address}
                  </p>
                  <p className="text-[11px] text-muted-foreground" data-testid="address-suggestion-source">
                    {s.source}
                  </p>
                </div>
                {canEdit ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 self-start sm:self-auto"
                    disabled={locked}
                    onClick={() => onApprove(s)}
                    data-testid="address-approve"
                  >
                    <Check className="size-3.5" />
                    {saving === s.address ? "Saving…" : "Approve"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="address-no-suggestion">
            No other address on file. Fix the address in NetSuite and import the locations again, or skip this account.
          </p>
        )}
      </div>
      {/* An approved address that still stands keeps the account off the report: nothing to skip. */}
      {canEdit && row.status !== "approved" ? (
        <div className="flex flex-wrap gap-1.5 sm:justify-end">
          {row.status === "skipped" ? (
            <Button type="button" size="sm" variant="outline" disabled={locked} onClick={onRestore} data-testid="address-restore">
              <Undo2 className="size-3.5" />
              Bring Back
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={locked} onClick={onSkip} data-testid="address-skip">
              Skip
            </Button>
          )}
        </div>
      ) : null}
    </li>
  );
}
