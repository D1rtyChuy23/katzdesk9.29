import { useMemo, useState } from "react";
import { BookMarked, Search } from "lucide-react";
import type { SavedSpecSheet } from "@/lib/ops/spec-schema";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

/** Searchable cards with manufacturer and category filters. */
export function SpecLibraryList({
  sheets,
  selectedId,
  onOpen,
}: {
  sheets: SavedSpecSheet[];
  selectedId: number | null;
  onOpen: (id: number) => void;
}) {
  const [q, setQ] = useState("");
  const [mfr, setMfr] = useState("");
  const [cat, setCat] = useState("");
  const manufacturers = useMemo(() => [...new Set(sheets.map((s) => s.manufacturer))].sort((a, b) => a.localeCompare(b)), [sheets]);
  const categories = useMemo(
    () => [...new Set(sheets.map((s) => s.category).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [sheets],
  );
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sheets.filter((s) => {
      if (mfr && s.manufacturer !== mfr) return false;
      if (cat && s.category !== cat) return false;
      if (!needle) return true;
      const hay = [s.manufacturer, s.model, s.category, s.summary, ...s.configs.map((c) => c.label), ...s.specs.map((x) => `${x.label} ${x.value}`)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [sheets, q, mfr, cat]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" data-testid="library-toolbar">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search machines, models, specs…" className="h-9 pl-9" aria-label="Search The Library" />
        </label>
        <SelectField value={mfr} onChange={(e) => setMfr(e.target.value)} allowEmpty emptyLabel="All Manufacturers" className="h-9 w-auto" aria-label="Filter by manufacturer">
          {manufacturers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SelectField>
        <SelectField value={cat} onChange={(e) => setCat(e.target.value)} allowEmpty emptyLabel="All Categories" className="h-9 w-auto" aria-label="Filter by category">
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>
      </div>
      {shown.length ? (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="library-cards">
          {shown.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                aria-current={selectedId === s.id ? "true" : undefined}
                className={cn(
                  "desk-lift h-full w-full rounded-xl border bg-card p-4 text-left transition-colors",
                  selectedId === s.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                )}
                data-testid={`spec-card-${s.id}`}
              >
                <p className="text-[11px] font-semibold tracking-[0.16em] text-copper uppercase">{s.manufacturer}</p>
                <p className="mt-0.5 font-display text-xl leading-tight font-medium">{s.model}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[s.category, `${s.configs.length} configuration${s.configs.length === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                </p>
                {s.summary ? <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.summary}</p> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-card/60 px-6 py-10 text-center">
          <BookMarked className="mx-auto size-6 text-copper" />
          <p className="mt-2 text-sm text-muted-foreground">
            {sheets.length ? "No spec sheets match these filters." : "No spec sheets yet. Admin and Sales can import one from a manufacturer PDF."}
          </p>
        </div>
      )}
    </div>
  );
}
