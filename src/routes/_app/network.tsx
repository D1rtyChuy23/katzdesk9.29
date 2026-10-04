import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveProvider, listNetwork, renameProvider } from "@/lib/ops/network-api";
import { parseOpenSearch, useOpenRecord } from "@/lib/ops/search-params";
import { providerStates, statusTone, type NetworkAccount, type NetworkOverview, type NetworkProvider } from "@/lib/ops/network";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { ProviderSheet } from "@/components/desk/provider-sheet";
import { RenameDialog } from "@/components/desk/rename-dialog";
import { DispatchCard } from "@/components/desk/provider-dispatch";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, sortDesk } from "@/lib/ops/sort";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/network")({
  validateSearch: parseOpenSearch,
  component: Page,
});

type Tab = "providers" | "accounts" | "coverage";

function Page() {
  const navigate = useNavigate();
  const { open } = Route.useSearch();
  const [selected, setSelected] = useOpenRecord(open);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<Tab>("providers");
  const net = useQuery({ queryKey: ["network"], queryFn: () => listNetwork() });
  const d = net.data;

  function openProvider(id: number) {
    setSelected(id);
    setCreating(false);
    void navigate({ to: "/network", search: { open: id }, replace: true });
  }
  function close() {
    setSelected(null);
    setCreating(false);
    void navigate({ to: "/network", search: {}, replace: true });
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Out Of Network</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Third-party techs we dispatch for accounts outside the Katz floor. Add a company with
            rates and notes, then assign customers. Primary is who we call first.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelected(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4" />
          Add provider
        </Button>
      </header>

      {d?.unassigned.length ? (
        <section className="mt-5 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium">
            {d.unassigned.length} {d.unassigned.length === 1 ? "account has" : "accounts have"} no
            primary provider
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {d.unassigned.map((a) => (
              <li key={a.id} className="rounded-full bg-background px-3 py-1 text-sm">
                {a.customer}
                {a.state ? <span className="text-muted-foreground"> · {a.state}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-5 flex h-10 w-fit items-center rounded-full bg-secondary p-1">
        {(
          [
            ["providers", "Providers"],
            ["accounts", "Accounts"],
            ["coverage", "Coverage"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "h-8 rounded-full px-3.5 text-sm font-medium",
              tab === id ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-background/70",
            )}
          >
            {label}
            {id === "providers" && d ? ` (${d.providers.length})` : null}
            {id === "accounts" && d ? ` (${d.accounts.length})` : null}
          </button>
        ))}
      </div>

      {net.isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading the network…</p>
      ) : net.isError ? (
        <p className="mt-6 text-sm text-destructive">
          {net.error instanceof Error ? net.error.message : "Could not load providers."}
        </p>
      ) : d ? (
        <div className="mt-5">
          {tab === "providers" ? (
            <ProvidersPane providers={d.providers} onOpen={openProvider} />
          ) : null}
          {tab === "accounts" ? <AccountsPane accounts={d.accounts} onOpen={openProvider} /> : null}
          {tab === "coverage" ? <CoveragePane byState={d.byState} providers={d.providers} /> : null}
        </div>
      ) : null}

      <ProviderSheet
        id={creating ? null : selected}
        creating={creating}
        onClose={close}
        onCreated={(pid) => {
          setCreating(false);
          openProvider(pid);
        }}
      />
    </div>
  );
}

function ProvidersPane({
  providers,
  onOpen,
}: {
  providers: NetworkProvider[];
  onOpen: (id: number) => void;
}) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (d: { id: number; name: string }) => archiveProvider({ data: { id: d.id } }),
    onSuccess: (_ok, d) => {
      toast.success(`Removed “${d.name}”`);
      void qc.invalidateQueries({ queryKey: ["network"] });
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
      void qc.invalidateQueries({ queryKey: ["provider"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [state, setState] = useState("");
  const [sort, setSort] = useDeskSort("network-providers", "alpha-asc");
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const rename = useMutation({
    mutationFn: (d: { id: number; name: string }) => renameProvider({ data: d }),
    onSuccess: (row) => {
      toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
      setRenaming(null);
      void qc.invalidateQueries({ queryKey: ["network"] });
      void qc.invalidateQueries({ queryKey: ["provider"] });
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename"),
  });
  const states = useMemo(() => {
    const s = new Set<string>();
    for (const p of providers) for (const st of providerStates(p)) s.add(st);
    return [...s].sort();
  }, [providers]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = providers;
    if (status === "unconfirmed") list = list.filter((p) => !p.status);
    else if (status) list = list.filter((p) => p.status === status);
    if (state) list = list.filter((p) => providerStates(p).includes(state));
    if (needle) {
      list = list.filter((p) =>
        [p.name, p.dispatchPhone, p.dispatchEmail, p.coverage, p.contacts]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    return sortDesk(list, sort, { name: (p) => p.name, date: (p) => p.lastUpdated });
  }, [providers, q, status, state, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <div className="relative w-56 shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search providers…" className="h-9 pl-9" aria-label="Search providers" />
        </div>
        <SelectField className="h-9 w-44 shrink-0" value={status} onChange={(e) => setStatus(e.target.value)} allowEmpty emptyLabel="Any status" aria-label="Filter by status">
          <option value="Active">Active</option>
          <option value="Pending Setup">Pending Setup</option>
          <option value="Prospect">Prospect</option>
          <option value="Inactive">Inactive</option>
          <option value="unconfirmed">Unconfirmed</option>
        </SelectField>
        <SelectField className="h-9 w-28 shrink-0" value={state} onChange={(e) => setState(e.target.value)} allowEmpty emptyLabel="State" aria-label="Filter by state">
          {states.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <SortSelect value={sort} onChange={setSort} options={[...SORT_ALPHA]} className="shrink-0" />
      </div>
      <ul className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((p) => (
          <li
            key={p.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onOpen(p.id)}
              className="desk-flat grid min-w-0 gap-1 rounded-md px-2 py-2.5 text-left hover:bg-muted/60 md:grid-cols-[1fr_11rem_7rem] md:items-center"
            >
              <span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{p.name}</span>
                  <Badge variant={statusTone(p.status)}>{p.status || "Unconfirmed"}</Badge>
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[p.dispatchPhone, p.dispatchEmail].filter(Boolean).join(" · ") || "No dispatch contact yet"}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">
                {providerStates(p).join(" · ") || "Coverage TBD"}
              </span>
              <span className="text-xs text-muted-foreground">
                {p.primaryFor} primary
                {p.secondaryFor ? ` · ${p.secondaryFor} backup` : ""}
              </span>
            </button>
            <div className="flex shrink-0 items-center gap-1 pr-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Rename ${p.name}`}
              onClick={() => setRenaming({ id: p.id, name: p.name })}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={remove.isPending}
              aria-label={`Remove ${p.name}`}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove “${p.name}” from Out of Network? Assigned accounts will drop this provider.`,
                  )
                ) {
                  remove.mutate({ id: p.id, name: p.name });
                }
              }}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="mt-4 text-sm text-muted-foreground">No providers match.</p> : null}
      <RenameDialog
        open={!!renaming}
        title="Rename Provider"
        noun="provider"
        current={renaming?.name ?? ""}
        pending={rename.isPending}
        onClose={() => setRenaming(null)}
        onSave={(n) => renaming && rename.mutate({ id: renaming.id, name: n })}
      />
    </div>
  );
}

function AccountsPane({
  accounts,
  onOpen,
}: {
  accounts: NetworkAccount[];
  onOpen: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const [state, setState] = useState("");
  const states = useMemo(
    () => [...new Set(accounts.map((a) => a.state).filter(Boolean) as string[])].sort(),
    [accounts],
  );
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (state && a.state !== state) return false;
      if (!needle) return true;
      return [a.customer, a.city, a.primary?.name, a.secondary?.name, a.region]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [accounts, q, state]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" data-testid="list-toolbar">
        <div className="relative w-56 shrink-0">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search accounts…" className="h-9 pl-9" aria-label="Search accounts" />
        </div>
        <SelectField className="h-9 w-28 shrink-0" value={state} onChange={(e) => setState(e.target.value)} allowEmpty emptyLabel="State" aria-label="Filter by state">
          {states.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
      </div>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map((a) => (
          <li key={a.id} className="px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{a.customer}</p>
                <p className="text-xs text-muted-foreground">
                  {[a.city, a.state, a.zip].filter(Boolean).join(", ") || a.region || "Location TBD"}
                </p>
                {a.equipment ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{a.equipment}</p>
                ) : null}
              </div>
              {!a.primary ? (
                <Badge variant="warn">Needs primary</Badge>
              ) : null}
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {a.primary ? (
                <button type="button" className="text-left" onClick={() => onOpen(a.primary!.id)}>
                  <DispatchCard
                    role="primary"
                    name={a.primary.name}
                    phone={a.primary.dispatchPhone}
                    email={a.primary.dispatchEmail}
                    status={a.primary.status}
                  />
                </button>
              ) : null}
              {a.secondary ? (
                <button type="button" className="text-left" onClick={() => onOpen(a.secondary!.id)}>
                  <DispatchCard
                    role="secondary"
                    name={a.secondary.name}
                    phone={a.secondary.dispatchPhone}
                    email={a.secondary.dispatchEmail}
                    status={a.secondary.status}
                  />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="mt-4 text-sm text-muted-foreground">No accounts match.</p> : null}
    </div>
  );
}

function CoveragePane({
  byState,
  providers,
}: {
  byState: NetworkOverview["byState"];
  providers: NetworkProvider[];
}) {
  const ranked = [...providers].sort((a, b) => b.primaryFor - a.primaryFor || a.name.localeCompare(b.name));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">Coverage By State</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">From the Accounts tab. Yellow means no primary tech.</p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="py-1 font-medium">State</th>
              <th className="py-1 font-medium">Accounts</th>
              <th className="py-1 font-medium">Unassigned</th>
            </tr>
          </thead>
          <tbody>
            {byState.map((s) => (
              <tr key={s.state} className="border-t border-border">
                <td className="py-1.5 font-medium">{s.state}</td>
                <td className="py-1.5 tabular">{s.total}</td>
                <td className={cn("py-1.5 tabular", s.unassigned ? "text-warning" : "text-muted-foreground")}>
                  {s.unassigned}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">Accounts By Provider</h2>
        <ul className="mt-3 divide-y divide-border">
          {ranked
            .filter((p) => p.primaryFor + p.secondaryFor > 0)
            .map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.dispatchPhone, p.dispatchEmail].filter(Boolean).join(" · ") || "No dispatch contact"}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {p.primaryFor} primary
                  {p.secondaryFor ? ` · ${p.secondaryFor} backup` : ""}
                </p>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
