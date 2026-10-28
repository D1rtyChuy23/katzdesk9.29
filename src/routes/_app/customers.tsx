import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AddressLine } from "@/components/desk/customer-address";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ShowMoreButton, useShowMore } from "@/components/desk/show-more";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { parseOpenSearch, useBackTo, useOpenRecord } from "@/lib/ops/search-params";
import { getMyAccess } from "@/lib/ops/access";
import { addDirectoryEntry, listCustomerRecords, previewCustomerRename, renameCustomer } from "@/lib/ops/api";
import { renameConfirm, renameToast } from "@/lib/ops/customer-rename";
import { listRemovedCustomers, removeCustomers, restoreCustomers, type RemovedCustomer } from "@/lib/ops/customer-remove-api";
import { formatPingTime } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { ListToolbar, ToolbarSearch } from "@/components/desk/list-toolbar";
import { SORT_ACCOUNT_NUMBER, SORT_ALPHA, sortDesk } from "@/lib/ops/sort";
import { AccountNumberImportButton } from "@/components/desk/account-number-import";
import { GeocodeImportButton } from "@/components/desk/geocode-import";
import { CustomerHistorySheet } from "@/components/desk/customer-sheet";
import { RenameDialog } from "@/components/desk/rename-dialog";
import { AccountEquipImportButton } from "@/components/desk/account-equip-import";
import { SalesRepImportButton } from "@/components/desk/sales-rep-import";
import { NetsuiteCustomerImportButton } from "@/components/desk/netsuite-customer-import";
import { CustomerExportMenu } from "@/components/desk/customer-export-menu";
import { PossibleDuplicatesButton } from "@/components/desk/possible-duplicates";
import { RemoveCustomersDialog } from "@/components/desk/customer-remove";
import { FilterChip, ImportMenu } from "@/components/desk/desk-charts";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronRight, Lock, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { AkBadge, NoRepFlag } from "@/components/desk/ak-badge";
import { RepName } from "@/components/desk/rep-select";
import { cn } from "@/lib/utils";
import { useMyView } from "@/components/desk/my-view-bar";
import { notLoadedText } from "@/lib/ops/load-problem";
import type { CustomerRecord } from "@/lib/ops/types";


export const Route = createFileRoute("/_app/customers")({
  validateSearch: parseOpenSearch,
  component: Page,
});

/** Which accounts the list shows: the list itself, the ones flagged for review, or the ones removed from it. */
type View = "all" | "flagged" | "removed";

/** Everything that shows an account by name reads again after a Remove or Restore. */
function refreshAfterRemove(qc: QueryClient) {
  for (const key of [["customers"], ["directory", "customer"], ["customer-history"], ["possible-duplicates"], ["clean-names"]]) {
    void qc.invalidateQueries({ queryKey: key });
  }
}

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { open, from } = Route.useSearch();
  const [selected, setSelected] = useOpenRecord(open);
  const back = useBackTo(from);
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const list = useQuery({ queryKey: ["customers", "records"], queryFn: () => listCustomerRecords() });
  const [q, setQ] = useState("");
  // Accounts NetSuite marks Inactive are hidden until Show Inactive is on. Nothing is deleted.
  const [showInactive, setShowInactive] = useState(false);
  const [view, setView] = useState<View>("all");
  const [name, setName] = useState("");
  const { filterMine, matchMine, role } = useMyView();
  const [sort, setSort] = useDeskSort("customers", "alpha-asc");
  const isAdmin = !!me.data?.isAdmin;
  // The Admin role or a desk admin: imports, account numbers, and (since 2026-10-27) Remove, Restore, the Removed list and
  // Rename / merge, so more than one person can run Customers.
  const isAdminOrRole = isAdmin || me.data?.role === "admin";
  const canAdd = isAdmin || me.data?.canAddCustomers !== false;
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  // Ticked accounts (admins): one Remove, or one Restore under Removed, for all of them.
  const [picked, setPicked] = useState<number[]>([]);
  // The accounts waiting on the Remove confirmation.
  const [confirming, setConfirming] = useState<number[]>([]);
  const removed = useQuery({ queryKey: ["customers", "removed"], queryFn: () => listRemovedCustomers(), enabled: isAdminOrRole });

  const add = useMutation({
    mutationFn: (n: string) => addDirectoryEntry({ data: { kind: "customer", name: n } }),
    onSuccess: (row) => {
      toast.success(`Added ${row.name}`);
      setName("");
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["directory", "customer"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });
  const remove = useMutation({
    mutationFn: (ids: number[]) => removeCustomers({ data: { ids } }),
    onSuccess: (res) => {
      const n = res.removed.length;
      toast.success(
        n === 1
          ? `Removed “${res.removed[0]!.name}”. Removed on Customers can bring it back.`
          : `Removed ${n.toLocaleString("en-US")} accounts. Removed on Customers can bring them back.`,
      );
      const gone = new Set(res.removed.map((r) => r.id));
      // Off the list at once; the list and Removed read again behind it.
      qc.setQueryData<CustomerRecord[]>(["customers", "records"], (old) => old?.filter((c) => !gone.has(c.id)));
      setPicked((cur) => cur.filter((id) => !gone.has(id)));
      setConfirming([]);
      // Removed from inside the account window: the window closes, the account is gone.
      if (selected != null && gone.has(selected)) closeCustomer();
      refreshAfterRemove(qc);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });
  const restore = useMutation({
    mutationFn: (ids: number[]) => restoreCustomers({ data: { ids } }),
    onSuccess: (res) => {
      const n = res.restored.length;
      if (n) {
        toast.success(n === 1 ? `Restored “${res.restored[0]!.name}” to the list` : `Restored ${n.toLocaleString("en-US")} accounts to the list`);
      }
      for (const s of res.skipped.slice(0, 3)) toast.error(`“${s.name}” stays removed: ${s.why}.`);
      if (res.skipped.length > 3) toast.error(`${res.skipped.length - 3} more stay removed for the same reasons.`);
      const back = new Set(res.restored.map((r) => r.id));
      qc.setQueryData<RemovedCustomer[]>(["customers", "removed"], (old) => old?.filter((c) => !back.has(c.id)));
      setPicked((cur) => cur.filter((id) => !back.has(id)));
      refreshAfterRemove(qc);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not restore"),
  });
  const rename = useMutation({
    mutationFn: (d: { id: number; name: string; confirmMerge?: string }) => renameCustomer({ data: d }),
    onSuccess: (row) => {
      toast.success(renameToast(row));
      setRenaming(null);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["directory"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["pms"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["network"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename"),
  });

  const needle = q.trim().toLowerCase();
  const inactiveCount = useMemo(() => (list.data ?? []).filter((c) => c.inactive).length, [list.data]);
  const flaggedCount = useMemo(() => (list.data ?? []).filter((c) => c.removalFlag).length, [list.data]);
  const removedCount = removed.data?.length ?? 0;
  const rows = useMemo(() => {
    // Flagged For Review shows every flagged account, inactive or not, so they can be dealt with together.
    const raw =
      view === "flagged"
        ? (list.data ?? []).filter((c) => c.removalFlag)
        : showInactive
          ? (list.data ?? [])
          : (list.data ?? []).filter((c) => !c.inactive);
    // Search by name or Account Number.
    const filtered = needle
      ? raw.filter((c) => c.name.toLowerCase().includes(needle) || (c.accountNumber ?? "").toLowerCase().includes(needle))
      : raw;
    const scoped =
      filterMine && role === "sales"
        ? filtered.filter((c) => c.aviKatz || matchMine(c.accountRep))
        : filtered;
    if (sort === "acct-asc" || sort === "acct-desc") {
      // Blank account numbers last; numbers compare as numbers when they are numbers ("00042" < "123").
      const dir = sort === "acct-asc" ? 1 : -1;
      return [...scoped].sort((a, b) => {
        const x = a.accountNumber ?? "";
        const y = b.accountNumber ?? "";
        if (!x || !y) return x === y ? a.name.localeCompare(b.name) : x ? -1 : 1;
        return dir * x.localeCompare(y, undefined, { numeric: true, sensitivity: "base" }) || a.name.localeCompare(b.name);
      });
    }
    return sortDesk(scoped, sort, { name: (c) => c.name, date: () => "" });
  }, [list.data, needle, sort, filterMine, matchMine, role, showInactive, view]);
  const removedRows = useMemo(
    () =>
      (removed.data ?? []).filter(
        (c) => !needle || c.name.toLowerCase().includes(needle) || (c.accountNumber ?? "").toLowerCase().includes(needle),
      ),
    [removed.data, needle],
  );
  const shownIds = useMemo(() => (view === "removed" ? removedRows : rows).map((c) => c.id), [view, removedRows, rows]);
  const paged = useShowMore(rows, `${needle}|${sort}|${filterMine}|${showInactive}|${view}`);
  const pagedRemoved = useShowMore(removedRows, `${needle}|removed`);
  const byId = useMemo(() => new Map((list.data ?? []).map((c) => [c.id, c])), [list.data]);
  const confirmAccounts = useMemo(() => confirming.map((id) => byId.get(id)).filter((c): c is CustomerRecord => !!c), [confirming, byId]);

  // A ticked account that left the list (removed, restored, merged elsewhere) is unticked.
  useEffect(() => {
    if (!picked.length) return;
    const here = new Set(view === "removed" ? (removed.data ?? []).map((c) => c.id) : (list.data ?? []).map((c) => c.id));
    if (picked.some((id) => !here.has(id))) setPicked((cur) => cur.filter((id) => here.has(id)));
  }, [list.data, removed.data, view, picked]);

  function switchView(next: View) {
    setPicked([]);
    setView((cur) => (cur === next ? "all" : next));
  }
  function togglePick(id: number) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  // Select All is offered once the list is narrowed (a search, Flagged For Review or Removed), never for the whole list.
  const narrowed = !!needle || view !== "all";
  const allShownPicked = shownIds.length > 0 && shownIds.every((id) => picked.includes(id));

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    add.mutate(n);
  }

  function openCustomer(id: number) {
    setSelected(id);
    void navigate({ to: "/customers", search: { open: id, from }, replace: true });
  }

  function closeCustomer() {
    setSelected(null);
    if (!back()) void navigate({ to: "/customers", search: {}, replace: true });
  }

  const countLine =
    view === "removed"
      ? removed.isLoading
        ? "Loading removed accounts…"
        : `${removedRows.length} removed ${removedRows.length === 1 ? "account" : "accounts"}${needle ? ` matching “${q.trim()}”` : ""}`
      : list.isLoading
        ? "Loading accounts…"
        : list.isError
          ? "Could not load accounts."
          : `${rows.length} ${view === "flagged" ? "flagged " : ""}${rows.length === 1 ? "account" : "accounts"}${needle ? ` matching “${q.trim()}”` : ""}`;

  return (
    <div className={cn(isAdminOrRole && picked.length > 0 && "pb-28")}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Customers</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Search the account list. Open a name to review every call, TLC, PM, install, and record
            on that account — then update the one you pick.
            {canAdd
              ? " Add a new name when the account isn’t on the list yet."
              : " Ask an admin if a name is missing."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2">
          {/* One Import control: a list when there is more than one import, the single button otherwise. */}
          <ImportMenu>
            {isAdminOrRole ? <NetsuiteCustomerImportButton /> : null}
            {isAdminOrRole ? <AccountNumberImportButton /> : null}
            {isAdminOrRole ? <GeocodeImportButton /> : null}
            {isAdminOrRole ? <SalesRepImportButton /> : null}
            <AccountEquipImportButton
              onImported={(name) => {
                if (!name) return;
                const row = (list.data ?? []).find((c) => c.name.toLowerCase() === name.toLowerCase());
                if (row) openCustomer(row.id);
              }}
            />
          </ImportMenu>
          {/* Admin only, and read-only: the whole list as a file, and the accounts an import added that may be repeats. */}
          {isAdminOrRole ? <CustomerExportMenu /> : null}
          {isAdminOrRole ? <PossibleDuplicatesButton onOpenAccount={openCustomer} /> : null}
        </div>
      </header>

      <ListToolbar>
        <ToolbarSearch value={q} onChange={setQ} placeholder={view === "removed" ? "Search removed accounts…" : "Search customers…"} />
        {view !== "removed" ? (
          <SortSelect value={sort} onChange={setSort} options={[...SORT_ALPHA, ...SORT_ACCOUNT_NUMBER]} className="shrink-0 max-sm:w-full" />
        ) : null}
        {inactiveCount && view === "all" ? (
          <FilterChip selected={showInactive} aria-pressed={showInactive} onClick={() => setShowInactive(!showInactive)} className="shrink-0" data-testid="show-inactive">
            Show Inactive {inactiveCount.toLocaleString("en-US")}
          </FilterChip>
        ) : null}
        {flaggedCount || view === "flagged" ? (
          <FilterChip selected={view === "flagged"} aria-pressed={view === "flagged"} onClick={() => switchView("flagged")} className="shrink-0" data-testid="show-flagged">
            Flagged For Review {flaggedCount.toLocaleString("en-US")}
          </FilterChip>
        ) : null}
        {isAdminOrRole && (removedCount || view === "removed") ? (
          <FilterChip selected={view === "removed"} aria-pressed={view === "removed"} onClick={() => switchView("removed")} className="shrink-0" data-testid="show-removed">
            Removed {removedCount.toLocaleString("en-US")}
          </FilterChip>
        ) : null}
      </ListToolbar>

      {canAdd && view !== "removed" ? (
        <form onSubmit={onAdd} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a customer name"
            className="min-w-0 sm:flex-1"
            aria-label="New customer name"
          />
          <Button type="submit" disabled={add.isPending || name.trim().length < 2}>
            <Plus className="size-4" />
            Add customer
          </Button>
        </form>
      ) : null}

      {view === "removed" ? (
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground" data-testid="removed-note">
          Accounts taken off the list with Remove, newest first. Nothing was deleted: Restore puts an account back on the
          list. Accounts removed before Oct 26 aren&rsquo;t listed here; adding the name again brings one back.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-muted-foreground" data-testid="customers-count">
          {countLine}
        </p>
        {isAdminOrRole && narrowed && shownIds.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => setPicked(allShownPicked ? picked.filter((id) => !shownIds.includes(id)) : [...new Set([...picked, ...shownIds])])}
            data-testid="select-all"
          >
            {allShownPicked ? "Unselect All" : `Select All ${shownIds.length.toLocaleString("en-US")}`}
          </Button>
        ) : null}
      </div>

      {view === "removed" ? (
        <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card" data-testid="removed-list">
          {pagedRemoved.visible.map((c) => (
            <RemovedRow
              key={c.id}
              c={c}
              picked={picked.includes(c.id)}
              onPick={() => togglePick(c.id)}
              busy={restore.isPending}
              onRestore={() => restore.mutate([c.id])}
            />
          ))}
          <ShowMoreButton as="li" remaining={pagedRemoved.remaining} onClick={pagedRemoved.showMore} label="accounts" />
          {removed.isLoading ? null : removedRows.length === 0 ? (
            <li className="px-4 py-8 text-sm text-muted-foreground">
              {notLoadedText(removed, "removed accounts") ?? (needle ? "No removed account matches that search." : "Nothing has been removed.")}
            </li>
          ) : null}
        </ul>
      ) : (
      <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
        {paged.visible.map((c) => {
          const pending = pendingLine(c);
          return (
          <li
            key={c.id}
            className={cn("flex items-start border-b border-border px-2 py-1 last:border-b-0", picked.includes(c.id) && "bg-primary/5")}
            data-testid="customer-row"
            data-id={c.id}
          >
            {isAdminOrRole ? <Tick name={c.name} checked={picked.includes(c.id)} onChange={() => togglePick(c.id)} /> : null}
            <div className="grid min-w-0 flex-1 grid-cols-1 items-center sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-2">
            <button
              type="button"
              onClick={() => openCustomer(c.id)}
              className="desk-flat flex min-w-0 items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/60"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium max-sm:break-words sm:truncate">
                  {c.name} <AkBadge on={c.aviKatz} className="ml-1 align-middle" />
                  {c.nameLocked ? (
                    <Lock className="ml-1.5 inline size-3.5 align-middle text-primary" aria-label="Name locked from the clean list" data-testid="name-locked" />
                  ) : null}
                  {c.removalFlag ? (
                    <span className="ml-1.5 align-middle text-xs font-medium text-destructive" data-testid="flagged-review">Flagged For Review</span>
                  ) : null}
                  {c.inactive ? (
                    <Badge size="tight" variant="warn" className="ml-1.5 align-middle" data-testid="customer-inactive">
                      Inactive
                    </Badge>
                  ) : null}
                </p>
                <AddressLine customer={c.name} />
                <p className="text-xs text-muted-foreground sm:truncate">
                  {c.accountRep ? <RepName name={c.accountRep} /> : <NoRepFlag show />}
                  {" · "}
                  {countLabel(c.calls, "call", "calls")}

                  {" · "}
                  {countLabel(c.tlcs, "TLC", "TLCs")}
                  {" · "}
                  {countLabel(c.pms, "PM", "PMs")}
                  {" · "}
                  {countLabel(c.installs, "install", "installs")}
                  {c.deals ? ` · ${countLabel(c.deals, "deal", "deals")}` : ""}
                  {c.recipes ? ` · ${countLabel(c.recipes, "recipe", "recipes")}` : ""}
                </p>
                {pending ? (
                  <p className="text-xs text-amber-800 sm:truncate dark:text-amber-300">{pending}</p>
                ) : null}
              </div>
              <span
                className={cn("w-auto shrink-0 text-right text-sm tabular sm:w-28", !c.accountNumber && "max-sm:hidden")}
                data-testid="customer-account-number"
                title="Account Number"
              >
                {c.accountNumber ? (
                  <>
                    <span className="block text-[10px] tracking-wide text-muted-foreground uppercase">Account #</span>
                    {c.accountNumber}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
            {isAdminOrRole ? (
              <div className="flex shrink-0 items-center gap-1 pr-1 max-sm:justify-end max-sm:gap-2 max-sm:pb-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="max-sm:h-10 max-sm:px-3.5 max-sm:text-sm"
                  aria-label={`Rename ${c.name}`}
                  disabled={c.nameLocked}
                  title={c.nameLocked ? "Locked from the clean list. Unlock it on Clean Names to change it." : undefined}
                  onClick={() => setRenaming({ id: c.id, name: c.name })}
                >
                  <Pencil className="size-3.5" />
                  <span>Edit</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="max-sm:h-10 max-sm:px-3.5 max-sm:text-sm"
                  disabled={remove.isPending}
                  aria-label={`Remove ${c.name}`}
                  data-testid="customer-remove"
                  onClick={() => setConfirming([c.id])}
                >
                  <Trash2 className="size-3.5" />
                  <span>Remove</span>
                </Button>
              </div>
            ) : null}
            </div>
          </li>
          );
        })}
        <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} label="accounts" />
        {list.isLoading ? (
          <li className="px-4 py-8 text-sm text-muted-foreground">Loading accounts…</li>
        ) : rows.length === 0 ? (
          <li className="px-4 py-8 text-sm text-muted-foreground">
            {notLoadedText(list, "accounts") ??
              (needle ? "No customers match that search." : view === "flagged" ? "No account is flagged for review." : "No customers in the list yet.")}
          </li>
        ) : null}
      </ul>
      )}

      {isAdminOrRole && picked.length ? (
        <div
          // Pinned to the bottom of the screen so it's reachable wherever the ticked accounts are.
          className="fixed inset-x-3 bottom-3 z-30 rounded-xl border border-primary/40 bg-card p-3 shadow-[var(--shadow-lift)] md:right-8 md:left-[17rem]"
          data-testid="customers-selection-bar"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium" data-testid="customers-selected">
              {picked.length.toLocaleString("en-US")} {picked.length === 1 ? "account" : "accounts"} selected
            </p>
            <div className="flex gap-2">
              {view === "removed" ? (
                <Button type="button" size="sm" className="max-sm:h-10" disabled={restore.isPending} onClick={() => restore.mutate(picked)} data-testid="selection-restore">
                  <RotateCcw className="size-3.5" />
                  {restore.isPending ? "Restoring…" : "Restore"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="max-sm:h-10"
                  disabled={remove.isPending}
                  onClick={() => setConfirming(picked)}
                  data-testid="selection-remove"
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              )}
              <Button type="button" size="sm" variant="outline" className="max-sm:h-10" onClick={() => setPicked([])} data-testid="selection-clear">
                Clear
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <CustomerHistorySheet
        customerId={selected}
        onClose={closeCustomer}
        onRemove={isAdminOrRole ? (id) => setConfirming([id]) : undefined}
      />
      <RemoveCustomersDialog
        accounts={confirmAccounts}
        pending={remove.isPending}
        onConfirm={() => remove.mutate(confirmAccounts.map((c) => c.id))}
        onClose={() => setConfirming([])}
      />
      <RenameDialog
        open={!!renaming}
        title="Rename Customer"
        noun="customer"
        current={renaming?.name ?? ""}
        pending={rename.isPending}
        onClose={() => setRenaming(null)}
        check={renaming ? (n) => previewCustomerRename({ data: { id: renaming.id, name: n } }).then((plan) => renameConfirm(plan)) : undefined}
        onSave={(n, confirmMerge) => renaming && rename.mutate({ id: renaming.id, name: n, confirmMerge })}
      />
    </div>
  );
}

/** The tick box at the start of a row: a 40px tap target on a phone, around a 20px box. */
function Tick({ name, checked, onChange }: { name: string; checked: boolean; onChange: () => void }) {
  return (
    // In line with the account name (the row's first line), on a phone too, where the row runs taller.
    <label className="flex shrink-0 cursor-pointer items-start self-stretch px-2.5 pt-3 pb-2.5" data-testid="customer-pick">
      <input
        type="checkbox"
        className="size-5 shrink-0 accent-primary"
        aria-label={`Select ${name}`}
        checked={checked}
        onChange={onChange}
      />
    </label>
  );
}

function RemovedRow({
  c,
  picked,
  onPick,
  busy,
  onRestore,
}: {
  c: RemovedCustomer;
  picked: boolean;
  onPick: () => void;
  busy: boolean;
  onRestore: () => void;
}) {
  return (
    <li className={cn("flex items-start border-b border-border px-2 py-1 last:border-b-0", picked && "bg-primary/5")} data-testid="removed-row" data-id={c.id}>
      <Tick name={c.name} checked={picked} onChange={onPick} />
      <div className="min-w-0 flex-1 px-2 py-2.5">
        <p className="font-medium max-sm:break-words sm:truncate">{c.name}</p>
        <p className="text-xs text-muted-foreground">
          {c.removedAt ? `Removed ${formatPingTime(c.removedAt)}${c.removedBy ? ` by ${c.removedBy}` : ""}` : "Removed before Oct 26 (when and by whom weren't recorded)"}
          {" · "}{countLabel(c.history, "record", "records")}
          {c.accountNumber ? ` · Account # ${c.accountNumber}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center self-center pr-1">
        <Button type="button" size="sm" variant="outline" className="max-sm:h-10 max-sm:px-3.5 max-sm:text-sm" disabled={busy} onClick={onRestore} data-testid="customer-restore">
          <RotateCcw className="size-3.5" />
          Restore
        </Button>
      </div>
    </li>
  );
}

function countLabel(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function pendingLine(c: {
  pendingCalls: number;
  pendingTlcs: number;
  pendingPms: number;
  pendingInstalls: number;
}) {
  const bits = [
    c.pendingCalls ? countLabel(c.pendingCalls, "call", "calls") : null,
    c.pendingTlcs ? countLabel(c.pendingTlcs, "TLC", "TLCs") : null,
    c.pendingPms ? countLabel(c.pendingPms, "PM", "PMs") : null,
    c.pendingInstalls ? countLabel(c.pendingInstalls, "install", "installs") : null,
  ].filter(Boolean);
  return bits.length ? `Pending: ${bits.join(" · ")}` : "";
}
