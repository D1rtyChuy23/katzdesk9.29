import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, Rows3 } from "lucide-react";
import { getMyAccess } from "@/lib/ops/access";
import { namesMatchUser } from "@/lib/ops/lookups";
import {
  defaultLayoutFor,
  MY_VIEW_EVENT,
  readMyView,
  writeMyView,
  type DeskRole,
  type MyViewPrefs,
  type ViewLayout,
} from "@/lib/ops/my-view";
import { useCurrentUser } from "@/lib/auth/use-current-user";

import { cn } from "@/lib/utils";
import { writePrefs, readPrefs } from "@/lib/ops/prefs";
import { FilterChip } from "./desk-charts";

type Ctx = {
  role: DeskRole;
  on: boolean;
  layout: ViewLayout;
  setOn: (v: boolean) => void;
  setLayout: (v: ViewLayout) => void;
  matchMine: (...names: (string | null | undefined)[]) => boolean;
  filterMine: boolean;
  compact: boolean;
  board: boolean;
};

const MyViewCtx = createContext<Ctx>({
  role: null,
  on: true,
  layout: "list",
  setOn: () => undefined,
  setLayout: () => undefined,
  matchMine: () => false,
  filterMine: false,
  compact: false,
  board: false,
});

export function MyViewProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const access = useQuery({
    queryKey: ["access", "me"],
    queryFn: () => getMyAccess(),
    enabled: !!user,
  });

  const [prefs, setPrefs] = useState<MyViewPrefs>(readMyView);
  const role = access.data?.role ?? null;

  useEffect(() => {
    function sync() {
      setPrefs(readMyView());
    }
    window.addEventListener(MY_VIEW_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MY_VIEW_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("katz-desk-my-view-init")) return;
    if (!role) return;
    window.localStorage.setItem("katz-desk-my-view-init", "1");
    setPrefs(writeMyView({ on: true, layout: defaultLayoutFor(role) }));
  }, [role]);

  const setOn = useCallback((on: boolean) => setPrefs(writeMyView({ on })), []);
  const setLayout = useCallback((layout: ViewLayout) => {
    setPrefs(writeMyView({ layout }));
    if (layout === "compact" && readPrefs().density !== "compact") writePrefs({ density: "compact" });
    if (layout !== "compact" && readPrefs().density === "compact") writePrefs({ density: "comfortable" });
  }, []);

  const matchUser = useMemo(
    () => ({
      displayName: user?.displayName ?? null,
      primaryEmail: user?.primaryEmail ?? null,
      username: access.data?.username ?? null,
    }),
    [user, access.data?.username],
  );

  const matchMine = useCallback(
    (...names: (string | null | undefined)[]) => namesMatchUser(matchUser, ...names),
    [matchUser],
  );

  const value = useMemo<Ctx>(
    () => ({
      role,
      on: prefs.on,
      layout: prefs.layout,
      setOn,
      setLayout,
      matchMine,
      filterMine: prefs.on && !!role,
      compact: prefs.layout === "compact",
      board: prefs.layout === "board",
    }),
    [role, prefs, setOn, setLayout, matchMine],
  );

  return <MyViewCtx.Provider value={value}>{children}</MyViewCtx.Provider>;
}

export function useMyView() {
  return useContext(MyViewCtx);
}

export function MyViewBar({ className }: { className?: string }) {
  const { role, on, layout, setOn, setLayout } = useMyView();
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <FilterChip selected={on} onClick={() => setOn(!on)}>
        My View{role ? ` · ${role === "sales" ? "Sales" : "Service"}` : ""}
      </FilterChip>
      <div className="flex overflow-hidden rounded-full border border-border">
        {(
          [
            { id: "list" as const, label: "List", icon: List },
            { id: "board" as const, label: "Board", icon: LayoutGrid },
            { id: "compact" as const, label: "Compact", icon: Rows3 },
          ] as const
        ).map((opt) => {
          const Icon = opt.icon;
          const active = layout === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={active}
              title={opt.label}
              onClick={() => setLayout(opt.id)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 px-2.5 text-xs font-medium",
                active ? "bg-ink text-ink-foreground" : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
