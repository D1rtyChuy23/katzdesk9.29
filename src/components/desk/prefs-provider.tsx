import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyPrefs,
  DEFAULT_PREFS,
  PREFS_EVENT,
  readPrefs,
  writePrefs,
  type DeskPrefs,
} from "@/lib/ops/prefs";

type PrefsCtx = {
  prefs: DeskPrefs;
  update: (patch: Partial<DeskPrefs>) => void;
};

const Ctx = createContext<PrefsCtx>({
  prefs: DEFAULT_PREFS,
  update: () => undefined,
});

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DeskPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    const next = readPrefs();
    setPrefs(next);
    applyPrefs(next);
    function sync() {
      const p = readPrefs();
      setPrefs(p);
      applyPrefs(p);
    }
    window.addEventListener(PREFS_EVENT, sync);
    window.addEventListener("storage", sync);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => {
      window.removeEventListener(PREFS_EVENT, sync);
      window.removeEventListener("storage", sync);
      mq.removeEventListener("change", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<DeskPrefs>) => {
    const next = writePrefs(patch);
    applyPrefs(next);
    setPrefs(next);
  }, []);

  const value = useMemo(() => ({ prefs, update }), [prefs, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  return useContext(Ctx);
}
