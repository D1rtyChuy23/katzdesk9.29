import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { usePrefs } from "./prefs-provider";
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
  const density = usePrefs().prefs.density;
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
      compact: density === "compact",
      board: prefs.layout === "board",
    }),
    [role, prefs, setOn, setLayout, matchMine, density],
  );

  return <MyViewCtx.Provider value={value}>{children}</MyViewCtx.Provider>;
}

export function useMyView() {
  return useContext(MyViewCtx);
}

export function MyViewBar({ className }: { className?: string }) {
  const { role, on, setOn } = useMyView();
  // Row density (List vs Compact) lives in Settings → Density; rebuilds keep their own Board/Timeline switch.
  return (
    <div className={cn("flex items-center", className)}>
      <FilterChip selected={on} onClick={() => setOn(!on)}>
        My View{role ? ` · ${role === "sales" ? "Sales" : "Service"}` : ""}
      </FilterChip>
    </div>
  );
}
