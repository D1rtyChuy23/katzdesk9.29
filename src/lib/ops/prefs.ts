export type Appearance = "light" | "dark" | "system";
export type TextSize = "default" | "large";
export type Density = "comfortable" | "compact";
export type Contrast = "standard" | "high";
export type Motion = "full" | "reduced";

export type DeskPrefs = {
  appearance: Appearance;
  text: TextSize;
  density: Density;
  contrast: Contrast;
  motion: Motion;
  resumeLast: boolean;
};

export const PREFS_KEY = "katz-desk-prefs";
export const PREFS_EVENT = "katz-desk-prefs";
export const LAST_PATH_KEY = "katz-desk-last";
export const RESUMED_KEY = "katz-desk-resumed";

export const DEFAULT_PREFS: DeskPrefs = {
  appearance: "system",
  text: "default",
  density: "comfortable",
  contrast: "standard",
  motion: "full",
  resumeLast: false,
};

export function readPrefs(): DeskPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<DeskPrefs>;
    return {
      appearance: parsed.appearance === "light" || parsed.appearance === "dark" ? parsed.appearance : "system",
      text: parsed.text === "large" ? "large" : "default",
      density: parsed.density === "compact" ? "compact" : "comfortable",
      contrast: parsed.contrast === "high" ? "high" : "standard",
      motion: parsed.motion === "reduced" ? "reduced" : "full",
      resumeLast: parsed.resumeLast === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(patch: Partial<DeskPrefs>): DeskPrefs {
  const next = { ...readPrefs(), ...patch };
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(PREFS_EVENT));
  return next;
}

export function resolvedDark(appearance: Appearance): boolean {
  if (appearance === "dark") return true;
  if (appearance === "light") return false;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyPrefs(prefs: DeskPrefs) {
  if (typeof document === "undefined") return;
  const dark = resolvedDark(prefs.appearance);
  const h = document.documentElement;
  h.classList.toggle("dark", dark);
  h.dataset.appearance = prefs.appearance;
  h.dataset.text = prefs.text;
  h.dataset.density = prefs.density;
  h.dataset.contrast = prefs.contrast;
  h.dataset.motion = prefs.motion;
  h.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#120F0C" : "#1A1612");
}
