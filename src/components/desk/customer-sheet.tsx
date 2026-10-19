import { useEffect, useMemo, useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import { SheetTabs } from "./sheet-tabs";
import { listAccountInvoices } from "@/lib/ops/invoice-api";
import { InvoiceWindow } from "@/components/desk/invoice-window";
import type { InvoiceTarget } from "@/lib/ops/invoice";
import { CustomerAddress } from "@/components/desk/customer-address";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { setAccountNumber } from "@/lib/ops/account-numbers-api";
import { copyRecipe, getCustomerHistory, listDirectory, listRecipes, renameCustomer, updateCustomerAccount } from "@/lib/ops/api";

import { getMyAccess } from "@/lib/ops/access";
import { formatShortDate, money, isOpenInstall } from "@/lib/ops/clock";
import type { Install, Recipe } from "@/lib/ops/types";
import { ComboField } from "@/components/ui/combo-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/separator";
import { InspectionBadge, PreInspectionPanel } from "./pre-inspection-panel";
import { JobSheet } from "./job-sheet";
import { DealSheet, InstallSheet, PmSheet } from "./entity-sheets";
import { RecipeEditorSheet } from "./recipe-sheet";
import { ProviderDispatchBlock } from "./provider-dispatch";
import { NearbyAccounts } from "./nearby-accounts";
import { RenameDialog } from "./rename-dialog";
import type { RecipeDraft } from "./recipe-form";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Lock, Pencil, Plus, Search } from "lucide-react";
import { previewSetting } from "@/lib/ops/recipe-fields";
import { toast } from "sonner";
import { RepSelect } from "./rep-select";
import { AkBadge } from "./ak-badge";
import {
  AccountEquipmentList,
  HistoryRow,
  dealItem,
  installItem,
  jobItem,
  pendingSchedules,
  pmItem,
  stamp,
  useAccountEquipment,
  type HistoryItem,
  type HistoryKind,
} from "./account-history";


export type { HistoryKind };

type AccountTab = "details" | "equipment" | "tickets" | "invoices" | "pre-inspection";

/** The account's categories, one per tab, in this order. */
const ACCOUNT_TABS: { id: AccountTab; label: string; short?: string }[] = [
  { id: "details", label: "Details" },
  { id: "equipment", label: "Equipment" },
  { id: "tickets", label: "Tickets" },
  { id: "invoices", label: "Invoices" },
  // "Pre-Insp." on phones under 375px, so five tabs with counts fit across.
  { id: "pre-inspection", label: "Pre-Inspection", short: "Pre-Insp." },
];

const FILTERS: { id: "all" | Exclude<HistoryKind, "recipe">; label: string }[] = [
  { id: "all", label: "All" },
  { id: "service", label: "Service" },
  { id: "tlc", label: "TLC" },
  { id: "pm", label: "PMs" },
  { id: "install", label: "Installs" },
  { id: "deal", label: "Pipeline" },
];

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
  const accountEquip = useAccountEquipment(history.data?.name);
  const houseRecipes = useQuery({
    queryKey: ["recipes"],
    queryFn: () => listRecipes(),
    enabled: customerId != null,
  });
  const [filter, setFilter] = useState<"all" | Exclude<HistoryKind, "recipe">>("all");
  const [q, setQ] = useState("");
  // Each account opens on Details.
  const [tab, setTab] = useState<AccountTab>("details");
  useEffect(() => setTab("details"), [customerId]);
  // Phones: the account whose clamped title was tapped open (another account opens clamped again).
  const [titleOpenFor, setTitleOpenFor] = useState<number | null>(null);
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
      // Pins and addresses are looked up by name: refresh them so lists and the map follow the new name.
      void qc.invalidateQueries({ queryKey: ["account-addresses"] });
      void qc.invalidateQueries({ queryKey: ["customer-address"] });
      void qc.invalidateQueries({ queryKey: ["account-geo"] });
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
  const pendingFocus = useMemo(() => pendingSchedules(data), [data]);
  const openInstalls = (data?.installs ?? []).filter((i) => isOpenInstall(i));
  const tabCount = (t: AccountTab): number | null => {
    if (t === "equipment") return accountEquip.data?.length ?? null;
    if (t === "tickets") return counts.all || null;
    if (t === "pre-inspection") return openInstalls.reduce((n, i) => n + (i.inspection?.machineCount ?? 0), 0) || null;
    return null;
  };

  return (
    <>
      <Sheet open={customerId != null} onOpenChange={(o) => !o && onClose()}>
        <SheetContent className="sm:max-w-2xl">
          <SheetHeader>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">Customer</p>
            <div className="flex items-start justify-between gap-2">
              <SheetTitle className="flex items-center gap-2 max-sm:text-lg">
                {/* Phones: a long name stops at two lines so the tabs stay near the top; tap it to read the whole name. */}
                <span
                  className={titleOpenFor === customerId ? undefined : "max-sm:line-clamp-2"}
                  onClick={() => setTitleOpenFor((cur) => (cur === customerId ? null : customerId))}
                  data-testid="account-title-name"
                >
                  {data?.name ?? "Account"}
                </span>
                <AkBadge on={data?.aviKatz} />
              </SheetTitle>

              {canRename && data && !data.nameLocked ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" />
                  Edit
                </Button>
              ) : null}
            </div>
            {data?.name ? <CustomerAddress customer={data.name} className="mt-0.5" /> : null}
          </SheetHeader>
          <SheetBody>
            {history.isLoading ? (
              <div className="p-5">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="mt-3 h-24 w-full" />
              </div>
            ) : data ? (
              // One tab is one category. Click a tab to open it; nothing is stacked in one long scroll.
              <SheetTabs
                value={tab}
                onValueChange={setTab}
                tabs={ACCOUNT_TABS.map((t) => ({ ...t, count: tabCount(t.id) }))}
                label="Account sections"
                testId="account"
              >

                <Tabs.Content value="details" className="p-5 outline-none" data-testid="account-panel-details">
                  {data.nameLocked ? (
                    <CleanListBlock name={data.name} cleanList={data.cleanList ?? null} />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {canRename
                        ? "Edit the name to move every call, install, PM, deal, recipe, and network link onto it."
                        : "Ask an admin to rename this account — history follows the new name."}
                    </p>
                  )}
                  <AccountNumberField id={data.id} value={data.accountNumber ?? null} canEdit={!!data.canEditAccountNumber} />
                  <AccountMarksForm id={data.id} aviKatz={data.aviKatz} accountRep={data.accountRep} />
                  <AssignedSalesReps reps={data.salesReps ?? []} />
                  {!data.accountRep && data.repFlag ? (
                    <p className="mt-1 text-xs font-medium text-warning" data-testid="rep-flag">
                      Rep left blank: {data.repFlag}.
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <ProviderDispatchBlock customer={data.name} assignable />
                  </div>
                  {/* Recipes are not a tab of their own: the account has the five tabs, and its recipes sit under Details. */}
                  <div className="mt-4" data-testid="account-recipes">
                  <CustomerRecipes
                    customer={data.name}
                    recipes={data.recipes}
                    house={houseRecipes.data ?? []}
                    models={(directoryEquip.data ?? []).map((e) => e.name)}
                    onOpen={(d) => setRecipeDraft(d)}
                  />
                  </div>
                  <div className="mt-6">
                    <NearbyAccounts accountId={data.id} name={data.name} />
                  </div>
                </Tabs.Content>

                <Tabs.Content value="equipment" className="p-5 outline-none" data-testid="account-panel-equipment">
                  <AccountEquipmentList rows={accountEquip.data ?? []} loading={accountEquip.isLoading} />
                </Tabs.Content>

                <Tabs.Content value="tickets" className="p-5 outline-none" data-testid="account-panel-tickets">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this account…" className="pl-9" aria-label="Search history" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {FILTERS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs max-sm:min-h-10 max-sm:px-3.5 max-sm:text-sm",
                          filter === f.id ? "bg-ink text-ink-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {f.label}
                        {counts[f.id] ? ` ${counts[f.id]}` : ""}
                      </button>
                    ))}
                  </div>
                  <section className="mt-4">
                    <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Pending TLC & PMs</h2>
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
                  <h2 className="mt-5 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Account History</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Select a call or record to review.</p>
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
                  {!visible.length ? <p className="mt-3 text-sm text-muted-foreground">Nothing on this account matches.</p> : null}
                </Tabs.Content>

                <Tabs.Content value="invoices" className="p-5 outline-none" data-testid="account-panel-invoices">
                  <AccountInvoices customer={data.name} />
                </Tabs.Content>

                <Tabs.Content value="pre-inspection" className="p-5 outline-none" data-testid="account-panel-pre-inspection">
                  <PreInspectionList
                    installs={(data.installs ?? []).filter((i) => isOpenInstall(i))}
                    openId={inspectId}
                    onOpen={(id) => setInspectId((cur) => (cur === id ? null : id))}
                    alwaysOpen
                  />
                </Tabs.Content>
              </SheetTabs>
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
      {/* The account is already open: a deal here keeps its customer, so no second customer picker. */}
      <DealSheet deal={reviewing ? selectedDeal : null} onClose={() => setReviewing(false)} lockCustomer />
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
  alwaysOpen = false,
}: {
  installs: Install[];
  openId: number | null;
  onOpen: (id: number) => void;
  /** In its own tab the list is open straight away. */
  alwaysOpen?: boolean;
}) {
  // Collapsed until asked for, unless it has its own tab. The count is every unit on the open installs.
  const [open, setShown] = useState(false);
  const shown = alwaysOpen || open;
  if (!installs.length) return alwaysOpen ? <p className="text-sm text-muted-foreground" data-testid="account-pre-inspection-none">No open installs on this account, so nothing to pre-inspect.</p> : null;
  const units = installs.reduce((n, i) => n + (i.inspection?.machineCount ?? 0), 0);
  const passed = installs.reduce((n, i) => n + (i.inspection?.passedCount ?? 0), 0);
  const toggle = () => {
    const next = !shown;
    setShown(next);
    // One install: opening the block shows its units straight away.
    if (next && installs.length === 1 && openId !== installs[0]!.id) onOpen(installs[0]!.id);
  };
  return (
    <section className="mt-4" data-testid="account-pre-inspection" data-open={shown ? "true" : "false"}>
      <button
        type="button"
        onClick={alwaysOpen ? undefined : toggle}
        aria-expanded={shown}
        disabled={alwaysOpen}
        className="desk-flat flex w-full items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-left enabled:hover:bg-muted/60 disabled:cursor-default"
        data-testid="account-pre-inspection-toggle"
      >
        {alwaysOpen ? null : shown ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
        <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Pre-Inspection</span>
        <span className="text-sm font-medium" data-testid="account-pre-inspection-count">
          {units} unit{units === 1 ? "" : "s"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">
          {passed}/{units} passed
        </span>
      </button>
      {shown ? (
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
      ) : null}
    </section>
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

/**
 * Account Number: shown to everyone; an Admin can set or clear it. Kept exactly as typed (leading zeros, dashes).
 * Saving checks it is not already on another customer.
 */
function AccountNumberField({ id, value, canEdit }: { id: number; value: string | null; canEdit: boolean }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [id, value]);
  const save = useMutation({
    mutationFn: () => setAccountNumber({ data: { id, accountNumber: draft.trim() || null } }),
    onSuccess: (r) => {
      toast.success(r.accountNumber ? `Account number ${r.accountNumber} saved` : "Account number cleared");
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["clean-names"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the account number"),
  });
  const changed = (draft.trim() || null) !== (value ?? null);
  return (
    <div className="mt-3 rounded-xl border border-border px-3 py-2.5" data-testid="account-number">
      <Label htmlFor={`acct-${id}`} className="text-xs text-muted-foreground">Account Number</Label>
      {canEdit ? (
        <form
          className="mt-1 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (changed) save.mutate();
          }}
        >
          <Input
            id={`acct-${id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="None yet"
            autoComplete="off"
            className="tabular"
            data-testid="account-number-input"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!changed || save.isPending} data-testid="account-number-save">
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      ) : (
        <p className="mt-0.5 font-medium tabular" data-testid="account-number-value">{value ?? <span className="font-normal text-muted-foreground">None</span>}</p>
      )}
    </div>
  );
}

/** An account approved from the clean customer list: locked name, and for an Admin the list's ID and address. */
function CleanListBlock({ name, cleanList }: { name: string; cleanList: { netsuiteId: string | null; address: string | null } | null }) {
  return (
    <dl className="grid gap-x-4 gap-y-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)]" data-testid="clean-list-block">
      <dt className="text-xs text-muted-foreground">Display Name</dt>
      <dd className="flex items-center gap-1.5 font-medium max-sm:flex-wrap" data-testid="clean-display">
        {name}
        <Lock className="size-3.5 text-primary max-sm:shrink-0" aria-label="Locked" />
        <span className="text-xs font-normal text-muted-foreground">Locked from the clean list</span>
      </dd>
      {cleanList ? (
        <>
          {cleanList.netsuiteId ? (
            <>
              <dt className="text-xs text-muted-foreground">ID</dt>
              <dd className="font-medium tabular" data-testid="clean-account-id">{cleanList.netsuiteId}</dd>
              <dt className="text-xs text-muted-foreground">Address</dt>
              <dd data-testid="clean-account-address">{cleanList.address || <span className="text-warning">No address on the clean list</span>}</dd>
            </>
          ) : (
            <dd className="text-xs text-warning sm:col-span-2" data-testid="clean-account-missing">
              ID and address are not filled yet. Read the clean list again on Clean Names to fill them.
            </dd>
          )}
        </>
      ) : null}
    </dl>
  );
}

function AssignedSalesReps({
  reps,
}: {
  reps: { name: string; role: string | null; pct: number | null; primary: boolean }[];
}) {
  return (
    <section className="mt-4" data-testid="assigned-sales-reps">
      <h3 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Assigned Sales Reps</h3>
      <p className="mt-1 text-xs text-muted-foreground">From NetSuite. Read-only here.</p>
      {reps.length ? (
        <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {reps.map((r) => (
            <li key={`${r.name}-${r.role ?? ""}-${r.pct ?? ""}`} className="flex items-center gap-3 px-3 py-2 text-sm" data-testid="assigned-sales-rep">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{r.name}</span>
                {r.role ? <span className="text-muted-foreground"> · {r.role}</span> : null}
              </span>
              {r.primary ? (
                <Badge variant="outline" size="tight">
                  Primary
                </Badge>
              ) : null}
              {r.pct != null && Number.isFinite(r.pct) ? (
                <span className="tabular text-muted-foreground">{String(r.pct).replace(/\.0+$/, "")}%</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">No sales reps imported for this account yet.</p>
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
            ? `${vars.accountRep} saved as the primary sales rep on this account`
            : "Primary sales rep cleared on this account"
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
          label="Primary Sales Rep"
          value={rep}
          onChange={(v) => {
            setRep(v);
            save.mutate({ accountRep: v || null });
          }}
        />
        {rep ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            The one rep installs, reminders, and the board use when a record doesn’t have its own.
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


/** The account's invoices: approved ones on any record, and tickets with charges not approved yet. Each opens the Invoice window. */
function AccountInvoices({ customer }: { customer: string }) {
  const q = useQuery({ queryKey: ["account-invoices", customer.toLowerCase()], queryFn: () => listAccountInvoices({ data: { customer } }) });
  const [open, setOpen] = useState<{ type: InvoiceTarget; id: number } | null>(null);
  const rows = q.data ?? [];
  return (
    <div data-testid="account-invoices">
      {q.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : rows.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {rows.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <button
                type="button"
                onClick={() => setOpen({ type: r.type, id: r.id })}
                className="desk-flat flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
                data-testid="account-invoice-row"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.status}
                    {r.approvedAt ? ` · ${r.approvedBy ?? "Desk"} · ${formatShortDate(r.approvedAt.slice(0, 10))}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular">{money(r.total)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No invoices on this account yet. Open a ticket, install or other record and choose Invoice.</p>
      )}
      {open ? <InvoiceWindow type={open.type} id={open.id} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
