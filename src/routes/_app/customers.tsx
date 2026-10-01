import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { ShowMoreButton, useShowMore } from "@/components/desk/show-more";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { getMyAccess } from "@/lib/ops/access";
import { addDirectoryEntry, archiveDirectoryEntry, listCustomerRecords, renameCustomer } from "@/lib/ops/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, sortDesk } from "@/lib/ops/sort";
import { CustomerHistorySheet } from "@/components/desk/customer-sheet";
import { RenameDialog } from "@/components/desk/rename-dialog";
import { AccountEquipImportButton } from "@/components/desk/account-equip-import";
import { toast } from "sonner";
import { ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AkBadge, NoRepFlag } from "@/components/desk/ak-badge";
import { RepName } from "@/components/desk/rep-select";
import { useMyView } from "@/components/desk/my-view-bar";


export const Route = createFileRoute("/_app/customers")({
  validateSearch: parseOpenSearch,
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { open } = Route.useSearch();
  const [selected, setSelected] = useOpenRecord(open);
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const list = useQuery({ queryKey: ["customers", "records"], queryFn: () => listCustomerRecords() });
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const { filterMine, matchMine, role } = useMyView();
  const [sort, setSort] = useDeskSort("customers", "alpha-asc");
  const isAdmin = !!me.data?.isAdmin;
  const canAdd = isAdmin || me.data?.canAddCustomers !== false;
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);

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
    mutationFn: (d: { id: number; name: string }) =>
      archiveDirectoryEntry({ data: { kind: "customer", id: d.id } }),
    onSuccess: (_ok, d) => {
      toast.success(`Removed “${d.name}”. Existing calls keep the name.`);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["directory", "customer"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });
  const rename = useMutation({
    mutationFn: (d: { id: number; name: string }) => renameCustomer({ data: d }),
    onSuccess: (row) => {
      toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
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
  const rows = useMemo(() => {
    const raw = list.data ?? [];
    const filtered = needle
      ? raw.filter((c) => c.name.toLowerCase().includes(needle))
      : raw;
    const scoped =
      filterMine && role === "sales"
        ? filtered.filter((c) => c.aviKatz || matchMine(c.accountRep))
        : filtered;
    return sortDesk(scoped, sort, { name: (c) => c.name, date: () => "" });
  }, [list.data, needle, sort, filterMine, matchMine, role]);
  const paged = useShowMore(rows, `${needle}|${sort}|${filterMine}`);


  function onAdd(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    add.mutate(n);
  }

  function openCustomer(id: number) {
    setSelected(id);
    void navigate({ to: "/customers", search: { open: id }, replace: true });
  }

  function closeCustomer() {
    setSelected(null);
    void navigate({ to: "/customers", search: {}, replace: true });
  }

  return (
    <div>
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
        <AccountEquipImportButton
          onImported={(name) => {
            if (!name) return;
            const row = (list.data ?? []).find((c) => c.name.toLowerCase() === name.toLowerCase());
            if (row) openCustomer(row.id);
          }}
        />
      </header>

      <div className="mt-5 flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <div className="relative w-56 shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search customers…"
            className="h-9 pl-9"
            aria-label="Search customers"
          />
        </div>
        <SortSelect value={sort} onChange={setSort} options={[...SORT_ALPHA]} className="shrink-0" />
      </div>

      {canAdd ? (
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

      <p className="mt-4 text-xs text-muted-foreground">
        {list.isLoading
          ? "Loading accounts…"
          : list.isError
            ? "Could not load accounts."
            : `${rows.length} ${rows.length === 1 ? "account" : "accounts"}${needle ? ` matching “${q.trim()}”` : ""}`}
      </p>

      <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
        {paged.visible.map((c) => {
          const pending = pendingLine(c);
          return (
          <li
            key={c.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => openCustomer(c.id)}
              className="desk-lift flex min-w-0 items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {c.name} <AkBadge on={c.aviKatz} className="ml-1 align-middle" />
                </p>
                <p className="truncate text-xs text-muted-foreground">
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
                  <p className="truncate text-xs text-amber-800 dark:text-amber-300">{pending}</p>
                ) : null}
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
            {isAdmin ? (
              <div className="flex shrink-0 items-center gap-1 pr-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label={`Rename ${c.name}`}
                  onClick={() => setRenaming({ id: c.id, name: c.name })}
                >
                  <Pencil className="size-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={remove.isPending}
                  aria-label={`Remove ${c.name}`}
                  onClick={() => {
                    if (window.confirm(`Remove “${c.name}” from the customer list?`)) {
                      remove.mutate({ id: c.id, name: c.name });
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                  <span className="hidden sm:inline">Remove</span>
                </Button>
              </div>
            ) : null}
          </li>
          );
        })}
        <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} label="accounts" />
        {list.isLoading ? (
          <li className="px-4 py-8 text-sm text-muted-foreground">Loading accounts…</li>
        ) : rows.length === 0 ? (
          <li className="px-4 py-8 text-sm text-muted-foreground">
            {needle ? "No customers match that search." : "No customers in the list yet."}
          </li>
        ) : null}
      </ul>

      <CustomerHistorySheet customerId={selected} onClose={closeCustomer} />
      <RenameDialog
        open={!!renaming}
        title="Rename Customer"
        noun="customer"
        current={renaming?.name ?? ""}
        pending={rename.isPending}
        onClose={() => setRenaming(null)}
        onSave={(n) => renaming && rename.mutate({ id: renaming.id, name: n })}
      />
    </div>
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
