import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchAll } from "@/lib/ops/api";
import { pathFor } from "./open-link";

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const delayed = useDebounced(q, 180);
  const results = useQuery({
    queryKey: ["search", delayed],
    queryFn: () => searchAll({ data: { q: delayed } }),
    enabled: delayed.trim().length >= 2,
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        document.getElementById("desk-search")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = results.data ?? [];

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        id="desk-search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 180)}
        placeholder="Search accounts, serials, WO…"
        className="h-10 w-full rounded-md border border-border bg-background pr-12 pl-9 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded-sm border border-border px-1.5 text-[10px] text-muted-foreground sm:block">
        ⌘K
      </kbd>
      {open && delayed.trim().length >= 2 ? (
        <div className="absolute top-[calc(100%+6px)] z-40 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-soft">
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">No matches</p>
          ) : (
            <ul>
              {hits.map((h) => (
                <li key={`${h.entityType}-${h.id}`}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const to = pathFor(h.entityType);
                      if (to === "/") {
                        void navigate({ to: "/" });
                      } else {
                        void navigate({ to, search: { open: h.id } });
                      }
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    <span>
                      <span className="block font-medium">{h.title}</span>
                      <span className="text-xs text-muted-foreground">{h.subtitle}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground uppercase">
                      {h.entityType}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
