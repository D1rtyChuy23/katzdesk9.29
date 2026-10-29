import { ListFilter, X } from "lucide-react";
import {
  activeFilterCount,
  BOARD_LABEL,
  INVOICE_STATUS_KEYS,
  INVOICE_STATUS_LABEL,
  type BillingFilters,
  type BoardKey,
  type DateBy,
} from "@/lib/ops/billing-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { ToolbarSearch } from "@/components/desk/list-toolbar";
import { cn } from "@/lib/utils";
import { usePausedValue } from "./use-paused-value";

/**
 * The filters the Tickets list and the Invoices page share (Grok's billing request, 2026-10-28). They live in the
 * address bar, so a filtered list can be bookmarked or sent. The billing ones (Sales Order, invoice, invoice status,
 * double bill, mismatch, invoiced date) show where the page has billing to filter by.
 */

/** An input that tells the page what was typed once typing pauses. */
export function PausedInput({
  value,
  onChange,
  delay = 300,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & { value: string; onChange: (v: string) => void; delay?: number }) {
  const [text, setText] = usePausedValue(value, onChange, delay);
  return <Input value={text} onChange={(e) => setText(e.target.value)} {...props} />;
}

/** The toolbar's search box, telling the page once typing pauses. */
export function PausedSearch({
  value,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof ToolbarSearch>, "value" | "onChange"> & { value: string; onChange: (v: string) => void }) {
  const [text, setText] = usePausedValue(value, onChange);
  return <ToolbarSearch value={text} onChange={setText} {...props} />;
}

const FIELD = "h-9 text-sm";

export function BillingFilterButton({
  value,
  open,
  onToggle,
  className,
}: {
  value: BillingFilters;
  open: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const n = activeFilterCount(value);
  return (
    <Button
      type="button"
      variant={n ? "default" : "outline"}
      size="sm"
      className={cn("h-9 shrink-0 rounded-full", className)}
      aria-expanded={open}
      onClick={onToggle}
      data-testid="billing-filters-toggle"
    >
      <ListFilter className="size-4" />
      Filters{n ? ` (${n})` : ""}
    </Button>
  );
}

/** Every filter the panel sets (not the search box): what Clear filters clears. */
export const PANEL_FILTER_KEYS = ["dateBy", "dateFrom", "dateTo", "status", "board", "account", "tech", "so", "invoice", "invStatus", "double", "mismatch"] as const;

/**
 * A change to the filters: only the keys named change (undefined clears one). The page applies it to the address bar
 * as it is then, so two quick changes never undo each other.
 */
export type FilterPatch = Partial<BillingFilters>;

export function BillingFilterPanel({
  value,
  onPatch,
  statuses,
  boards,
  billing,
  extra,
}: {
  value: BillingFilters;
  onPatch: (patch: FilterPatch) => void;
  /** The statuses on the page, for the Status pick-list. */
  statuses: string[];
  /** Offer a Board pick-list with these boards. */
  boards?: BoardKey[];
  /** The page has billing to filter by. */
  billing: boolean;
  /** Anything else the page filters by (a tech pick-list). */
  extra?: React.ReactNode;
}) {
  const set = (patch: FilterPatch) => onPatch(patch);
  const dateFields: { id: DateBy; label: string }[] = [
    { id: "completed", label: "Completed" },
    { id: "received", label: "Received" },
    ...(billing ? [{ id: "invoiced" as const, label: "Invoiced" }] : []),
  ];
  const n = activeFilterCount(value);
  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-3 text-sm" data-testid="billing-filters">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Date</span>
          <span className="flex min-w-0 items-center gap-1.5">
            <SelectField
              className={cn(FIELD, "w-32 shrink-0")}
              value={value.dateBy ?? "completed"}
              onChange={(e) => set({ dateBy: e.target.value === "completed" ? undefined : (e.target.value as DateBy) })}
              aria-label="Which date"
              data-testid="filter-date-by"
            >
              {dateFields.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </SelectField>
          </span>
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">From</span>
          <Input
            type="date"
            className={FIELD}
            value={value.dateFrom ?? ""}
            onChange={(e) => set({ dateFrom: e.target.value || undefined })}
            data-testid="filter-date-from"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">To</span>
          <Input
            type="date"
            className={FIELD}
            value={value.dateTo ?? ""}
            onChange={(e) => set({ dateTo: e.target.value || undefined })}
            data-testid="filter-date-to"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Status</span>
          <SelectField
            className={FIELD}
            value={value.status ?? ""}
            onChange={(e) => set({ status: e.target.value || undefined })}
            allowEmpty
            emptyLabel="Any status"
            data-testid="filter-status"
          >
            {[...new Set([...(value.status ? [value.status] : []), ...statuses])].sort().map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectField>
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Account</span>
          <PausedInput
            className={FIELD}
            value={value.account ?? ""}
            onChange={(v) => set({ account: v.trim() || undefined })}
            placeholder="Any account"
            data-testid="filter-account"
          />
        </label>
        {boards?.length ? (
          <label className="grid gap-1">
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Board</span>
            <SelectField
              className={FIELD}
              value={value.board ?? ""}
              onChange={(e) => set({ board: (e.target.value || undefined) as BoardKey | undefined })}
              allowEmpty
              emptyLabel="Every board"
              data-testid="filter-board"
            >
              {boards.map((b) => (
                <option key={b} value={b}>
                  {BOARD_LABEL[b]}
                </option>
              ))}
            </SelectField>
          </label>
        ) : null}
        {extra}
        {billing ? (
          <>
            <label className="grid gap-1">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Sales Order</span>
              <SelectField
                className={FIELD}
                value={value.so ?? ""}
                onChange={(e) => set({ so: (e.target.value || undefined) as BillingFilters["so"] })}
                allowEmpty
                emptyLabel="Any"
                data-testid="filter-so"
              >
                <option value="yes">Has a Sales Order</option>
                <option value="no">No Sales Order</option>
              </SelectField>
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Invoice</span>
              <SelectField
                className={FIELD}
                value={value.invoice ?? ""}
                onChange={(e) => set({ invoice: (e.target.value || undefined) as BillingFilters["invoice"] })}
                allowEmpty
                emptyLabel="Any"
                data-testid="filter-invoice"
              >
                <option value="yes">Invoiced (not Voided)</option>
                <option value="no">Not invoiced, or only Voided</option>
              </SelectField>
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Invoice status</span>
              <SelectField
                className={FIELD}
                value={value.invStatus ?? ""}
                onChange={(e) => set({ invStatus: (e.target.value || undefined) as BillingFilters["invStatus"] })}
                allowEmpty
                emptyLabel="Any"
                data-testid="filter-inv-status"
              >
                {INVOICE_STATUS_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {INVOICE_STATUS_LABEL[k]}
                  </option>
                ))}
              </SelectField>
            </label>
          </>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {billing ? (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={!!value.double}
                onChange={(e) => set({ double: e.target.checked || undefined })}
                data-testid="filter-double"
              />
              Possible double bill
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={!!value.mismatch}
                onChange={(e) => set({ mismatch: e.target.checked || undefined })}
                data-testid="filter-mismatch"
              />
              Charges don&apos;t match the invoices
            </label>
          </>
        ) : null}
        {n ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => onPatch(Object.fromEntries(PANEL_FILTER_KEYS.map((k) => [k, undefined])) as FilterPatch)}
            data-testid="filter-clear"
          >
            <X className="size-4" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
