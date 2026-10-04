import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check, ChevronsUpDown, Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/input";
import { toast } from "sonner";
import { AnchoredList } from "@/components/ui/anchored-list";

export type ComboItem = { id: number; name: string };

function rank(q: string, name: string): number {
  const n = String(name ?? "").toLowerCase();
  const s = q.toLowerCase().trim();
  if (!n) return -1;
  if (!s) return 1;
  if (n === s) return 100;
  if (n.startsWith(s)) return 80;
  const idx = n.indexOf(s);
  if (idx >= 0) return 60 - Math.min(idx, 40);
  const tokens = s.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => n.includes(t))) return 45;
  if (tokens.length === 1 && tokens[0]!.length >= 3 && n.includes(tokens[0]!)) return 30;
  return -1;
}

function createdName(result: unknown, fallback: string): string {
  if (typeof result === "string" && result.trim()) return result.trim();
  if (result && typeof result === "object" && "name" in result) {
    const n = (result as { name?: unknown }).name;
    if (typeof n === "string" && n.trim()) return n.trim();
  }
  return fallback;
}

const fieldClass =
  "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-full border border-input bg-background px-3 text-left text-sm focus-within:ring-2 focus-within:ring-ring";

const searchClass =
  "flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-background px-3 text-left text-sm focus-within:ring-2 focus-within:ring-ring";

function useDismiss(open: boolean, onClose: () => void) {
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onClose();
    }
    function onCloseList() {
      onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("desk-close-combo", onCloseList);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("desk-close-combo", onCloseList);
    };
  }, [open, onClose]);
  return { rootRef, menuRef };
}

function Menu({
  anchor,
  menuRef,
  children,
  notFound,
  notFoundText,
}: {
  anchor: RefObject<HTMLDivElement | null>;
  menuRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  notFound: boolean;
  notFoundText: string;
}) {
  return (
    <AnchoredList anchor={anchor} menuRef={menuRef}>
      {notFound ? <p className="px-2 py-1.5 text-xs text-muted-foreground">{notFoundText}</p> : null}
      <ul className="py-1" role="listbox">
        {children}
      </ul>
    </AnchoredList>
  );
}

function ItemTools({
  item,
  noun,
  onRenameItem,
  onRemoveItem,
}: {
  item: ComboItem;
  noun: string;
  onRenameItem?: (item: ComboItem) => void;
  onRemoveItem?: (item: ComboItem) => void;
}) {
  if (!onRenameItem && !onRemoveItem) return null;
  return (
    <span className="flex shrink-0 items-center">
      {onRenameItem ? (
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Rename ${item.name}`}
          title={`Rename this ${noun}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRenameItem(item);
          }}
        >
          <Pencil className="size-3.5" />
        </button>
      ) : null}
      {onRemoveItem ? (
        <button
          type="button"
          className="flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label={`Remove ${item.name} from the list`}
          title="Remove from the master list"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemoveItem(item);
          }}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </span>
  );
}

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
  onRenameItem,
  noun = "name",
  emptyHint = "No matches.",
  menuInFlow,
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
  onRenameItem?: (item: ComboItem) => void;
  noun?: string;
  emptyHint?: string;
  menuInFlow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { rootRef, menuRef } = useDismiss(open, () => {
    setOpen(false);
    setQ("");
  });
  const query = open ? q : "";
  const matches = useMemo(() => {
    const scored = items
      .map((item) => ({ item, score: rank(query, item.name) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    return scored.map((x) => x.item);
  }, [items, query]);
  const needle = query.trim();
  const exact = items.some((i) => String(i.name ?? "").toLowerCase() === needle.toLowerCase());
  const canCreate = allowCreate && needle.length >= 2 && !exact;
  const notFound = needle.length >= 2 && matches.length === 0;

  function pick(next: string) {
    onChange(next);
    setQ("");
    setOpen(false);
  }

  async function create() {
    const next = needle;
    if (!next) return;
    try {
      const made = await onCreate?.(next);
      pick(createdName(made, next));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that name");
    }
  }

  return (
    <div className="min-w-0">
      {label ? <Label>{label}</Label> : null}
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <div ref={rootRef} className={cn("relative min-w-0", label ? "mt-1" : "mt-0")}>
        <div className={cn(fieldClass, disabled && "opacity-50")}>
          <input
            ref={inputRef}
            disabled={disabled}
            value={open ? q : value}
            placeholder={placeholder}
            autoComplete="off"
            aria-label={label || `Search ${noun}`}
            aria-expanded={open}
            aria-autocomplete="list"
            role="combobox"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
            onChange={(e) => {
              setQ(e.target.value);
              if (!open) setOpen(true);
            }}
            // Open on a click or typing, not on focus alone — dialogs auto-focus their first field,
            // and a list that pops open by itself covers the rest of the form.
            onFocus={() => setQ("")}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && !open) setOpen(true);
              if (e.key === "Escape") {
                setOpen(false);
                inputRef.current?.blur();
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (canCreate && !matches[0]) void create();
                else if (matches[0]) pick(matches[0].name);
                else if (canCreate) void create();
              }
            }}
          />
          {value && !open ? (
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange("");
                setQ("");
              }}
            >
              <X className="size-3.5" />
            </button>
          ) : null}
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </div>
        {open ? (
          <Menu
            anchor={rootRef}
            menuRef={menuRef}
            notFound={notFound}
            notFoundText={
              allowCreate ? `This ${noun} isn’t on the list. Use + to add it.` : emptyHint
            }
          >
            {canCreate ? (
              <li>
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium hover:bg-muted"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void create();
                  }}
                >
                  <Plus className="size-3.5 shrink-0" />
                  {needle}
                </button>
              </li>
            ) : null}
            {matches.map((item) => {
              const selected = item.name === value;
              return (
                <li key={`${item.id}-${item.name}`} className="flex min-w-0 items-center">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                      selected && "bg-muted",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(item.name);
                    }}
                  >
                    <Check className={cn("size-3.5 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 truncate">{item.name}</span>
                  </button>
                  <ItemTools
                    item={item}
                    noun={noun}
                    onRenameItem={onRenameItem}
                    onRemoveItem={onRemoveItem}
                  />
                </li>
              );
            })}
            {!matches.length && !canCreate && !notFound ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">{emptyHint}</li>
            ) : null}
          </Menu>
        ) : null}
      </div>
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
  onRenameItem,
  noun = "name",
  menuInFlow,
  hideChips,
}: {
  label?: string;
  name?: string;
  values: string[];
  /** The picked values are already shown elsewhere (one block each): show only the add box. */
  hideChips?: boolean;
  onChange: (next: string[]) => void;
  items: ComboItem[];
  placeholder?: string;
  allowCreate?: boolean;
  onCreate?: (name: string) => unknown | Promise<unknown>;
  onRemoveItem?: (item: ComboItem) => void;
  onRenameItem?: (item: ComboItem) => void;
  noun?: string;
  menuInFlow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { rootRef, menuRef } = useDismiss(open, () => {
    setOpen(false);
    setQ("");
  });
  const query = open ? q : "";
  const matches = useMemo(() => {
    const scored = items
      .map((item) => ({ item, score: rank(query, item.name) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));
    return scored.map((x) => x.item);
  }, [items, query]);
  const needle = query.trim();
  const exact = items.some((i) => String(i.name ?? "").toLowerCase() === needle.toLowerCase());
  const canCreate = allowCreate && needle.length >= 2 && !exact;
  const notFound = needle.length >= 2 && matches.length === 0;

  function add(next: string) {
    const t = next.trim();
    if (!t) return;
    onChange([...values, t]);
    setQ("");
    setOpen(true);
  }

  async function create() {
    const next = needle;
    if (!next) return;
    const existing = matches[0];
    if (existing && rank(next, existing.name) >= 45) {
      add(existing.name);
      return;
    }
    try {
      const made = await onCreate?.(next);
      add(createdName(made, next));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that equipment");
    }
  }

  return (
    <div className="min-w-0">
      {label ? <Label>{label}</Label> : null}
      {name ? <input type="hidden" name={name} value={values.join("\n")} /> : null}
      <div className={cn("min-w-0 space-y-2", label ? "mt-1.5" : "mt-0")}>
        {values.length && !hideChips ? (
          <ul className="flex min-h-8 min-w-0 flex-wrap content-start gap-2" data-equip-chips="">
            {values.map((v, i) => (
              <li
                key={`${v}-${i}`}
                title={v}
                className="flex h-8 max-w-full shrink-0 items-center gap-1 overflow-hidden rounded-full bg-secondary pl-2.5 pr-0.5"
              >
                <span className="min-w-0 truncate text-sm leading-none text-foreground">{v}</span>
                <button
                  type="button"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${v}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(values.filter((_, j) => j !== i));
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div ref={rootRef} className="relative min-w-0">
          <div className={searchClass}>
            <input
              value={open ? q : ""}
              placeholder={values.length ? "Add another…" : placeholder}
              autoComplete="off"
              aria-label={label || `Search ${noun}`}
              aria-expanded={open}
              aria-autocomplete="list"
              role="combobox"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
              onChange={(e) => {
                setQ(e.target.value);
                if (!open) setOpen(true);
              }}
              onClick={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" && !open) setOpen(true);
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (matches[0]) add(matches[0].name);
                  else if (canCreate) void create();
                }
                if (e.key === "Backspace" && !q && values.length) {
                  onChange(values.slice(0, -1));
                }
              }}
            />
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </div>
        {open ? (
          <Menu
            anchor={rootRef}
            menuRef={menuRef}
            notFound={notFound}
            notFoundText={allowCreate ? `This ${noun} isn’t on the list. Use + to add it.` : "No matches."}
          >
            {canCreate ? (
              <li>
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm font-medium hover:bg-muted"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    void create();
                  }}
                >
                  <Plus className="size-3.5 shrink-0" />
                  {needle}
                </button>
              </li>
            ) : null}
            {matches.map((item) => {
              const already = values.filter((v) => v.toLowerCase() === item.name.toLowerCase()).length;
              return (
                <li key={`${item.id}-${item.name}`} className="flex min-w-0 items-center">
                  <button
                    type="button"
                    role="option"
                    aria-selected={already > 0}
                    className={cn(
                      "flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                      already > 0 && "bg-muted",
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(item.name);
                    }}
                  >
                    {already > 0 ? (
                      <Plus className="size-3.5 shrink-0" />
                    ) : (
                      <Check className="size-3.5 shrink-0 opacity-0" />
                    )}
                    <span className="min-w-0 truncate">{item.name}</span>
                    {already > 0 ? (
                      <span className="ml-auto shrink-0 pl-2 text-[11px] text-muted-foreground">add another</span>
                    ) : null}
                  </button>
                  <ItemTools
                    item={item}
                    noun={noun}
                    onRenameItem={onRenameItem}
                    onRemoveItem={onRemoveItem}
                  />
                </li>
              );
            })}
            {!matches.length && !canCreate && !notFound ? (
              <li className="px-2 py-2 text-xs text-muted-foreground">Type to search the full list.</li>
            ) : null}
          </Menu>
        ) : null}
        </div>
      </div>
    </div>
  );
}
