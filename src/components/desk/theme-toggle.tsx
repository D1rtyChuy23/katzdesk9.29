import { Monitor, Moon, Sun } from "lucide-react";
import { usePrefs } from "./prefs-provider";
import { resolvedDark } from "@/lib/ops/prefs";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { prefs, update } = usePrefs();
  const dark = resolvedDark(prefs.appearance);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      onClick={() => update({ appearance: dark ? "light" : "dark" })}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function AppearanceIcon({ value }: { value: "light" | "dark" | "system" }) {
  if (value === "dark") return <Moon className="size-4" />;
  if (value === "light") return <Sun className="size-4" />;
  return <Monitor className="size-4" />;
}
