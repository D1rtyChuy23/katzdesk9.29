import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { copyRecipe, getCustomerHistory, listDirectory, listRecipes, renameCustomer, updateCustomerAccount } from "@/lib/ops/api";
import { listAccountEquipment } from "@/lib/ops/account-equip-import";

import { getMyAccess } from "@/lib/ops/access";
import { isOpenCall, isOpenPm } from "@/lib/ops/ticket-status";
import { formatShortDate, money, isOpenInstall } from "@/lib/ops/clock";
import type { ClockFlag } from "@/lib/ops/clock";
import type { Deal, Install, PmJob, Recipe, ServiceJob } from "@/lib/ops/types";
import { ComboField } from "@/components/ui/combo-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/separator";
import { FlagBadge, StatusBadge, UrgencyBadge } from "./flag-badge";
import { InspectionBadge, PreInspectionPanel } from "./pre-inspection-panel";
import { UnitPlaceField } from "./unit-place-field";
import { JobSheet } from "./job-sheet";
import { DealSheet, InstallSheet, PmSheet } from "./entity-sheets";
import { RecipeEditorSheet } from "./recipe-sheet";
import { ProviderDispatchBlock } from "./provider-dispatch";
import { RenameDialog } from "./rename-dialog";
import type { RecipeDraft } from "./recipe-form";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Search } from "lucide-react";
import { previewSetting } from "@/lib/ops/recipe-fields";
import { toast } from "sonner";
import { RepSelect } from "./rep-select";
import { AkBadge } from "./ak-badge";


export type HistoryKind = "service" | "tlc" | "pm" | "install" | "deal" | "recipe";

type HistoryItem = {
  key: string;
  kind: HistoryKind;
  id: number;
  title: string;
  subtitle: string;
  status: string | null;
  date: string | null;
  technician: string | null;
  equipment: string | null;
  flag: ClockFlag | null;
  urgency?: string;
};

const KIND_LABEL: Record<HistoryKind, string> = {
  service: "Service",
  tlc: "TLC",
  pm: "PM",
  install: "Install",
  deal: "Pipeline",
  recipe: "Recipe",
};

const FILTERS: { id: "all" | Exclude<HistoryKind, "recipe">; label: string }[] = [
  { id: "all", label: "All" },
  { id: "service", label: "Service" },
  { id: "tlc", label: "TLC" },
  { id: "pm", label: "PMs" },
  { id: "install", label: "Installs" },
  { id: "deal", label: "Pipeline" },
];

function jobItem(j: ServiceJob): HistoryItem {
  return {
    key: `${j.kind}-${j.id}`,
    kind: j.kind,
    id: j.id,
    title: j.callId,
    subtitle: [j.wo, j.issue].filter(Boolean).join(" · "),
    status: j.status,
    date: j.received ?? j.scheduled,
    technician: j.technician,
    equipment: j.equipment,
    flag: j.flag,
    urgency: j.urgency,
  };
}

function pmItem(p: PmJob): HistoryItem {
  return {
    key: `pm-${p.id}`,
    kind: "pm",
    id: p.id,
    title: p.style || "Preventative maintenance",
    subtitle: p.equipment ?? "",
    status: p.status,
    date: p.projected ?? p.received,
    technician: p.technician,
    equipment: p.equipment,
    flag: p.flag,
  };
}

function installItem(i: Install): HistoryItem {
  return {
    key: `install-${i.id}`,
    kind: "install",
    id: i.id,
    title: i.wo || "Install",
    subtitle: i.equipment ?? "",
    status: i.equipStatus,
    date: i.installDate ?? i.received,
    technician: i.technician,
    equipment: i.equipment,
    flag: i.flag,
  };
}

function dealItem(d: Deal): HistoryItem {
  return {
    key: `deal-${d.id}`,
    kind: "deal",
    id: d.id,
    title: d.equipment || "Deal",
    subtitle: [d.producer, d.amount != null ? money(d.amount) : null].filter(Boolean).join(" · "),
    status: d.completion,
    date: d.dateOfDeal,
    technician: d.producer,
    equipment: d.equipment,
    flag: null,
  };
}

function stamp(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isFinite(t) ? t : 0;
}

export function CustomerHistorySheet({
  customerId,
  onClose,
}: {
  customerId: number | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const history = useQuery({
    queryKey: ["customer-history", customerId],
    queryFn: () => getCustomerHistory({ data: { id: customerId! } }),
    enabled: customerId != null,
  });
  const directoryEquip = useQuery({
    queryKey: ["directory", "equipment"],
    queryFn: () => listDirectory({ data: { kind: "equipment" } }),
    enabled: customerId != null,
  });
  const accountEquip = useQuery({
    queryKey: ["account-equipment", history.data?.name],
    queryFn: () => listAccountEquipment({ data: { customer: history.data!.name } }),
    enabled: !!history.data?.name,
  });
  const houseRecipes = useQuery({
    queryKey: ["recipes"],
    queryFn: () => listRecipes(),
    enabled: customerId != null,
  });
  const [filter, setFilter] = useState<"all" | Exclude<HistoryKind, "recipe">>("all");
  const [q, setQ] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [recipeDraft, setRecipeDraft] = useState<RecipeDraft | null>(null);
  const [inspectId, setInspectId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess(), enabled: customerId != null });

  useEffect(() => {
    setSelectedKey(null);
    setReviewing(false);
    setRecipeDraft(null);
    setFilter("all");
    setQ("");
    setEditing(false);
    setInspectId(null);
  }, [customerId, history.data?.name]);

  const rename = useMutation({
    mutationFn: (n: string) => renameCustomer({ data: { id: customerId!, name: n } }),
    onSuccess: (row) => {
      toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["directory"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["pms"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["network"] });
      if (row.merged || row.id !== customerId) {
        void navigate({ to: "/customers", search: { open: row.id }, replace: true });
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save name"),
  });

  const data = history.data;
  const items = useMemo(() => {
    if (!data) return [];
    const all: HistoryItem[] = [
      ...data.jobs.map(jobItem),
      ...data.pms.map(pmItem),
      ...data.installs.map(installItem),
      ...data.deals.map(dealItem),
    ];
    all.sort((a, b) => stamp(b.date) - stamp(a.date) || b.id - a.id);
    return all;
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<"all" | Exclude<HistoryKind, "recipe">, number> = {
      all: items.length,
      service: 0,
      tlc: 0,
      pm: 0,
      install: 0,
      deal: 0,
    };
    for (const it of items) {
      if (it.kind === "recipe") continue;
      c[it.kind] += 1;
    }
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== "all" && it.kind !== filter) return false;
      if (!needle) return true;
      return [it.title, it.subtitle, it.equipment, it.technician, it.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [items, filter, q]);

  const selected = items.find((it) => it.key === selectedKey) ?? null;
  const selectedJob = selected?.kind === "service" || selected?.kind === "tlc"
    ? data?.jobs.find((j) => j.id === selected.id) ?? null
    : null;
  const selectedPm = selected?.kind === "pm" ? data?.pms.find((p) => p.id === selected.id) ?? null : null;
  const selectedInstall = selected?.kind === "install" ? data?.installs.find((i) => i.id === selected.id) ?? null : null;
  const selectedDeal = selected?.kind === "deal" ? data?.deals.find((d) => d.id === selected.id) ?? null : null;
  const canRename = !!me.data?.isAdmin;
  const pending = useMemo(
    () =>
      items.filter((it) => {
        if (it.kind === "tlc" || it.kind === "service") {
          const j = data?.jobs.find((row) => row.id === it.id);
          return !!j && isOpenCall(j);
        }
        if (it.kind === "pm") {
          const p = data?.pms.find((row) => row.id === it.id);
          return !!p && isOpenPm(p);
        }
        if (it.kind === "install") {
          const i = data?.installs.find((row) => row.id === it.id);
          return !!i && isOpenInstall(i);
        }
        return false;
      }),
    [items, data],
  );
  const pendingTlcs = pending.filter((it) => it.kind === "tlc");
  const pendingPms = pending.filter((it) => it.kind === "pm");
  const pendingFocus = [...pendingTlcs, ...pendingPms];

  return (
    <>
      <Sheet open={customerId != null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Customer</p>
            <div className="flex items-start justify-between gap-2">
              <SheetTitle className="flex items-center gap-2">
                {data?.name ?? "Account"}
                <AkBadge on={data?.aviKatz} />
              </SheetTitle>

              {canRename && data ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              ) : null}
            </div>
          </SheetHeader>
          <SheetBody>
            {history.isLoading ? (
              <div className="p-5">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="mt-3 h-24 w-full" />
              </div>
            ) : data ? (
              <div className="p-5">
                <p className="text-xs text-muted-foreground">
                  {canRename
                    ? "Edit the name to move every call, install, PM, deal, recipe, and network link onto it."
                    : "Ask an admin to rename this account — history follows the new name."}
                </p>

                <AccountMarksForm
                  id={data.id}
                  aviKatz={data.aviKatz}
                  accountRep={data.accountRep}
                />

                <AccountEquipmentList rows={accountEquip.data ?? []} loading={accountEquip.isLoading} />

                <PreInspectionList
                  installs={(data.installs ?? []).filter((i) => isOpenInstall(i))}
                  openId={inspectId}
                  onOpen={(id) => setInspectId((cur) => (cur === id ? null : id))}
                />

                <div className="mt-4">
                  <ProviderDispatchBlock customer={data.name} assignable />
                </div>

                <div className="relative mt-4">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search this account…"
                    className="pl-9"
                    aria-label="Search history"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs",
                        filter === f.id ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {f.label}
                      {counts[f.id] ? ` ${counts[f.id]}` : ""}
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-xs text-muted-foreground">Select a call or record to review.</p>

                <section className="mt-2">
                  <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    Pending TLC & PMs
                  </h2>
                  {pendingFocus.length ? (
                    <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {pendingFocus.map((it) => (
                        <HistoryRow
                          key={`pending-${it.key}`}
                          item={it}
                          onOpen={() => {
                            setSelectedKey(it.key);
                            setReviewing(true);
                          }}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No open TLCs or PMs on this account.</p>
                  )}
                </section>

                <h2 className="mt-5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Account History
                </h2>
                <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {visible.map((it) => (
                    <HistoryRow
                      key={it.key}
                      item={it}
                      onOpen={() => {
                        setSelectedKey(it.key);
                        setReviewing(true);
                      }}
                    />
                  ))}
                </ul>
                {!visible.length ? (
                  <p className="mt-3 text-sm text-muted-foreground">Nothing on this account matches.</p>
                ) : null}

                <CustomerRecipes
                  customer={data.name}
                  recipes={data.recipes}
                  house={houseRecipes.data ?? []}
                  models={(directoryEquip.data ?? []).map((e) => e.name)}
                  onOpen={(d) => setRecipeDraft(d)}
                />
              </div>
            ) : (
              <p className="p-5 text-sm text-muted-foreground">Account not found.</p>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* The customer stays editable here too, so a ticket logged under the wrong name can be moved. */}
      <JobSheet id={reviewing && selectedJob ? selectedJob.id : null} onClose={() => setReviewing(false)} />
      <PmSheet pm={reviewing ? selectedPm : null} onClose={() => setReviewing(false)} />
      <InstallSheet row={reviewing ? selectedInstall : null} onClose={() => setReviewing(false)} />
      <DealSheet deal={reviewing ? selectedDeal : null} onClose={() => setReviewing(false)} />
      <RecipeEditorSheet
        draft={recipeDraft}
        models={(directoryEquip.data ?? []).map((e) => e.name)}
        customers={data ? [data.name] : []}
        onClose={() => setRecipeDraft(null)}
      />
      <RenameDialog
        open={editing}
        title="Rename Customer"
        noun="customer"
        current={data?.name ?? ""}
        pending={rename.isPending}
        onClose={() => setEditing(false)}
        onSave={(n) => rename.mutate(n)}
      />
    </>
  );
}

function PreInspectionList({
  installs,
  openId,
  onOpen,
}: {
  installs: Install[];
  openId: number | null;
  onOpen: (id: number) => void;
}) {
  if (!installs.length) return null;
  return (
    <section className="mt-4" data-testid="account-pre-inspection">
      <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Pre-Inspection
      </h2>
      <ul className="mt-2 space-y-2">
        {installs.map((i) => (
          <li key={i.id} className="overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => onOpen(i.id)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/60"
              aria-expanded={openId === i.id}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{i.wo || i.equipment || "Install"}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatShortDate(i.installDate ?? i.received)}
                  {i.inspection?.failedItems?.length ? ` · ${i.inspection.failedItems.join(", ")}` : ""}
                </span>
              </span>
              <InspectionBadge
                overall={i.inspection?.overall}
                passed={i.inspection?.passedCount}
                total={i.inspection?.machineCount}
              />
            </button>
            {openId === i.id ? <PreInspectionPanel installId={i.id} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function AccountEquipmentList({
  rows,
  loading,
}: {
  rows: {
    catalogModel: string;
    equipmentName: string;
    serial: string | null;
    installDate: string | null;
    ownership: string | null;
  }[];
  loading: boolean;
}) {
  return (
    <section className="mt-4">
      <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Equipment On This Account
      </h2>
      {loading ? (
        <p className="mt-2 text-sm text-muted-foreground">Loading equipment…</p>
      ) : rows.length ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {rows.map((row, i) => (
            <li key={`${row.catalogModel}-${row.serial ?? "none"}-${i}`} className="px-3 py-2.5">
              <p className="font-medium">{row.equipmentName || row.catalogModel}</p>
              <p className="text-xs text-muted-foreground">
                {[
                  row.catalogModel && row.catalogModel !== row.equipmentName ? row.catalogModel : null,
                  row.serial ? `SN ${row.serial}` : null,
                  row.ownership,
                  row.installDate ? `Installed ${formatShortDate(row.installDate)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {row.serial ? (
                <div className="mt-2">
                  <UnitPlaceField serial={row.serial} model={row.equipmentName || row.catalogModel} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No imported equipment on this account yet.</p>
      )}
    </section>
  );
}

function HistoryRow({ item, onOpen }: { item: HistoryItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="desk-flat flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
      >
        <span className="mt-0.5 w-16 shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {KIND_LABEL[item.kind]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{item.title}</span>
          <span className="block text-xs text-muted-foreground">
            {[item.subtitle, formatShortDate(item.date), item.technician].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {item.urgency ? <UrgencyBadge urgency={item.urgency} /> : null}
          <StatusBadge status={item.status} />
          <FlagBadge flag={item.flag} />
        </span>
      </button>
    </li>
  );
}

function CustomerRecipes({
  customer,
  recipes,
  house,
  models,
  onOpen,
}: {
  customer: string;
  recipes: Recipe[];
  house: Recipe[];
  models: string[];
  onOpen: (d: RecipeDraft) => void;
}) {
  const qc = useQueryClient();
  const copy = useMutation({
    mutationFn: (sourceId: number) => copyRecipe({ data: { sourceId, customer } }),
    onSuccess: () => {
      toast.success("Copied onto this account");
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not copy"),
  });
  const [housePick, setHousePick] = useState("");
  const [customerPick, setCustomerPick] = useState("");
  const [shown, setShown] = useState<Recipe | null>(null);
  const templates = house.filter((r) => r.isTemplate || !r.customer);
  const others = house.filter((r) => r.customer && r.customer.toLowerCase() !== customer.toLowerCase());

  function ownLabel(r: Recipe) {
    if (r.name) return `${r.equipmentModel} · ${r.name}`;
    const dup = recipes.filter((x) => x.equipmentModel === r.equipmentModel && !x.name).length > 1;
    return dup ? `${r.equipmentModel} · ${r.id}` : r.equipmentModel;
  }
  function otherLabel(r: Recipe) {
    return `${r.customer} · ${r.equipmentModel}${r.name ? ` · ${r.name}` : ""}`;
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Recipes</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onOpen({
              recipe: null,
              customer,
              equipmentModel: models[0] ?? "",
              installId: null,
              copiedFrom: null,
              lockCustomer: true,
            })
          }
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="account-recipe-pickers">
        <ComboField
          label="House template"
          value={housePick}
          allowCreate={false}
          noun="template"
          placeholder="Search house templates…"
          emptyHint="No house templates"
          menuInFlow
          items={templates.map((r) => ({ id: r.id, name: r.equipmentModel }))}
          disabled={copy.isPending}
          onChange={(name) => {
            setHousePick(name);
            setCustomerPick("");
            setShown(null);
            const hit = templates.find((r) => r.equipmentModel === name);
            if (hit) copy.mutate(hit.id);
          }}
        />
        <ComboField
          label="Customer template"
          value={customerPick}
          allowCreate={false}
          noun="template"
          placeholder={recipes.length ? "Search customer templates…" : "No customer templates"}
          emptyHint="No customer templates"
          menuInFlow
          items={[
            ...recipes.map((r) => ({ id: r.id, name: ownLabel(r) })),
            ...others.map((r) => ({ id: -r.id, name: otherLabel(r) })),
          ]}
          disabled={copy.isPending}
          onChange={(name) => {
            setCustomerPick(name);
            setHousePick("");
            const own = recipes.find((r) => ownLabel(r) === name);
            if (own) {
              setShown(own);
              return;
            }
            const hit = others.find((r) => otherLabel(r) === name);
            if (hit) {
              setShown(null);
              copy.mutate(hit.id);
            }
          }}
        />
      </div>
      {shown ? (
        <div className="mt-3 rounded-xl border border-border bg-card p-4">
          <p className="font-medium">{shown.equipmentModel}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {previewSetting(shown) || shown.notes || "No settings yet"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() =>
              onOpen({
                recipe: shown,
                customer,
                equipmentModel: shown.equipmentModel,
                installId: shown.installId,
                copiedFrom: shown.copiedFrom,
                lockCustomer: true,
              })
            }
          >
            Edit
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {recipes.length
            ? "Pick a template. The settings stay on this account."
            : "No customer templates."}
        </p>
      )}
    </section>
  );
}

function AccountMarksForm({
  id,
  aviKatz,
  accountRep,
}: {
  id: number;
  aviKatz: boolean;
  accountRep: string | null;
}) {
  const qc = useQueryClient();
  // Controlled, so the saved rep always shows — including after a save or reopening the account.
  const [rep, setRep] = useState(accountRep ?? "");
  useEffect(() => {
    setRep(accountRep ?? "");
  }, [id, accountRep]);
  const save = useMutation({
    mutationFn: (d: { aviKatz?: boolean; accountRep?: string | null }) =>
      updateCustomerAccount({ data: { id, ...d } }),
    onSuccess: (_row, vars) => {
      toast.success(
        vars.accountRep !== undefined
          ? vars.accountRep
            ? `${vars.accountRep} saved as the rep on this account`
            : "Rep cleared on this account"
          : "Account updated",
      );
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div>
        <RepSelect
          label="Rep"
          value={rep}
          onChange={(v) => {
            setRep(v);
            save.mutate({ accountRep: v || null });
          }}
        />
        {rep ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Shows on this account's calls, PMs, installs, and deals that don't have their own rep.
          </p>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm sm:mt-7">
        <input
          type="checkbox"
          className="size-4 accent-primary"
          checked={aviKatz}
          onChange={(e) => save.mutate({ aviKatz: e.target.checked })}
        />
        Avi Katz account (AK)
        <AkBadge on={aviKatz} />
      </label>
    </div>
  );
}

