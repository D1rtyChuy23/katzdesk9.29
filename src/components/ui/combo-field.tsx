import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Label } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ComboItem = { id: number; name: string };

function rank(q: string, name: string): number {
  const n = name.toLowerCase();
  const s = q.toLowerCase();
  if (!s) return 1;
  if (n === s) return 100;
  if (n.startsWith(s)) return 80;
  const idx = n.indexOf(s);
  if (idx >= 0) return 60 - Math.min(idx, 40);
  return -1;
}

const pillClass =
  "flex min-h-11 w-full items-center gap-2 rounded-full border border-input bg-background px-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function ComboField({
  label,
  name,
  value,
  onChange,
  items,
  placeholder = "Search…",
  required,
  disabled,
  allowCreate = true,
  onCreate,
  onRemoveItem,
  emptyHint = "No matches.",
}: {
  label?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  items: ComboItem[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  allowCreate?: boolean;
  onCreate?: (name: string) => unknown | Promise<unknown>;
  onRemoveItem?: (item: ComboItem) => void;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = open ? q : "";
  const matches = useMemo(() => {
    const scored = items
      .map((item) => ({ item, score: rank(query, item.name) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    return scored.slice(0, 400).map((x) => x.item);
  }, [items, query]);
  const exact = items.some((i) => i.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = allowCreate && query.trim().length >= 2 && !exact;

  function pick(name: string) {
    onChange(name);
    setQ("");
    setOpen(false);
  }

  async function create() {
    const next = query.trim();
    if (!next) return;
    await onCreate?.(next);
    pick(next);
  }

  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <Popover
        modal={false}
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setQ("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(pillClass, label ? "mt-1" : "mt-0", !value && "text-muted-foreground")}
            aria-label={label}
            title={value || undefined}
          >
            <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
            {value ? (
              <span
                role="button"
                tabIndex={-1}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }}
              >
                <X className="size-3.5" />
              </span>
            ) : null}
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-9"
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (canCreate && !matches[0]) void create();
                else if (matches[0]) pick(matches[0].name);
                else if (canCreate) void create();
              }
            }}
          />
          <ul className="mt-1 max-h-80 overflow-y-auto py-1" role="listbox">
            {matches.map((item) => {
              const selected = item.name === value;
              return (
                <li key={item.id} className="flex items-center">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                      selected && "bg-muted",
                    )}
                    onClick={() => pick(item.name)}
                  >
                    <Check className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 truncate">{item.name}</span>
                  </button>
                  {onRemoveItem ? (
                    <button
                      type="button"
                      className="flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`Remove ${item.name} from the list`}
                      title="Remove from the master list"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemoveItem(item);
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </li>
              );
            })}
            {canCreate ? (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => void create()}
                >
                  <Plus className="size-3.5 shrink-0" />
                  Add “{query.trim()}”
                </button>
              </li>
            ) : null}
            {!matches.length && !canCreate ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">{emptyHint}</li>
            ) : null}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function MultiComboField({
  label,
  name,
  values,
  onChange,
  items,
  placeholder = "Add…",
  allowCreate = true,
  onCreate,
  onRemoveItem,
}: {
  label?: string;
  name?: string;
  values: string[];
  onChange: (next: string[]) => void;
  items: ComboItem[];
  placeholder?: string;
  allowCreate?: boolean;
  onCreate?: (name: string) => unknown | Promise<unknown>;
  onRemoveItem?: (item: ComboItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const query = open ? q : "";
  const matches = useMemo(() => {
    const scored = items
      .map((item) => ({ item, score: rank(query, item.name) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    return scored.slice(0, 400).map((x) => x.item);
  }, [items, query]);
  const exact = items.some((i) => i.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = allowCreate && query.trim().length >= 2 && !exact;

  function add(name: string) {
    const t = name.trim();
    if (!t) return;
    onChange([...values, t]);
    setQ("");
    setOpen(false);
  }

  async function create() {
    const next = query.trim();
    if (!next) return;
    await onCreate?.(next);
    add(next);
  }

  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      {name ? <input type="hidden" name={name} value={values.join("\n")} /> : null}
      <Popover
        modal={false}
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setQ("");
        }}
      >
        <PopoverTrigger asChild>
          <div
            role="combobox"
            aria-label={label}
            tabIndex={0}
            className={cn(pillClass, "flex-wrap py-1", label ? "mt-1" : "mt-0")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            {values.length ? (
              values.map((v, i) => (
                <span
                  key={`${v}-${i}`}
                  className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-secondary pl-2.5"
                >
                  <span className="max-w-[14rem] truncate py-0.5 text-sm text-foreground">{v}</span>
                  <button
                    type="button"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${v}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChange(values.filter((_, j) => j !== i));
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))
            ) : (
              <span className="min-w-0 flex-1 truncate px-1 text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="h-9"
            autoComplete="off"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (matches[0]) add(matches[0].name);
                else if (canCreate) void create();
              }
            }}
          />
          <ul className="mt-1 max-h-80 overflow-y-auto py-1" role="listbox">
            {matches.map((item) => {
              const already = values.filter((v) => v.toLowerCase() === item.name.toLowerCase()).length;
              return (
                <li key={item.id} className="flex items-center">
                  <button
                    type="button"
                    role="option"
                    aria-selected={already > 0}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                      already > 0 && "bg-muted",
                    )}
                    onClick={() => add(item.name)}
                  >
                    {already > 0 ? (
                      <Plus className="size-3.5 shrink-0" />
                    ) : (
                      <Check className="size-3.5 shrink-0 opacity-0" />
                    )}
                    <span className="min-w-0 truncate">{item.name}</span>
                    {already > 0 ? (
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">add another</span>
                    ) : null}
                  </button>
                  {onRemoveItem ? (
                    <button
                      type="button"
                      className="flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label={`Remove ${item.name} from the list`}
                      title="Remove from the master list"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemoveItem(item);
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </li>
              );
            })}
            {canCreate ? (
              <li>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => void create()}
                >
                  <Plus className="size-3.5 shrink-0" />
                  Add “{query.trim()}”
                </button>
              </li>
            ) : null}
            {!matches.length && !canCreate ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">
                No matches — type a name to add one.
              </li>
            ) : null}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
