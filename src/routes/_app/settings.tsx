import { createFileRoute } from "@tanstack/react-router";
import { Check, Contrast, Keyboard, StretchHorizontal, Type, Vibrate } from "lucide-react";
import type { ReactNode } from "react";
import { usePrefs } from "@/components/desk/prefs-provider";
import { AppearanceIcon } from "@/components/desk/theme-toggle";
import { RosterEditor } from "@/components/desk/roster-editor";
import { RepsEditor } from "@/components/desk/reps-editor";

import { cn } from "@/lib/utils";
import type { Appearance } from "@/lib/ops/prefs";

export const Route = createFileRoute("/_app/settings")({
  component: Page,
});

function Page() {
  const { prefs, update } = usePrefs();

  return (
    <div>
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Settings</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Display and ease-of-use for this device. Each person on the team can set their own — it
          stays on this browser.
        </p>
      </header>

      <div className="mt-6 grid gap-4 lg:max-w-2xl">
        <RosterEditor />
        <RepsEditor />


        <Section
          title="Appearance"
          hint="Dark mode is easier in the barn and on night calls. Match device follows the phone or laptop."
        >
          <Segmented
            value={prefs.appearance}
            onChange={(appearance) => update({ appearance })}
            options={[
              { id: "light", label: "Light", icon: <AppearanceIcon value="light" /> },
              { id: "dark", label: "Dark", icon: <AppearanceIcon value="dark" /> },
              { id: "system", label: "Match device", icon: <AppearanceIcon value="system" /> },
            ]}
          />
          <Preview appearance={prefs.appearance} />
        </Section>

        <Section
          title="Text size"
          hint="Large type helps when you’re standing back from a tablet or reading serials."
          icon={<Type className="size-4" />}
        >
          <Segmented
            value={prefs.text}
            onChange={(text) => update({ text })}
            options={[
              { id: "default", label: "Default" },
              { id: "large", label: "Large" },
            ]}
          />
        </Section>

        <Section
          title="Density"
          hint="Comfortable keeps 44px taps for the floor. Compact shows more rows on a laptop."
          icon={<StretchHorizontal className="size-4" />}
        >
          <Segmented
            value={prefs.density}
            onChange={(density) => update({ density })}
            options={[
              { id: "comfortable", label: "Comfortable" },
              { id: "compact", label: "Compact" },
            ]}
          />
        </Section>

        <Section
          title="Contrast"
          hint="High contrast strengthens borders and labels under shop lighting."
          icon={<Contrast className="size-4" />}
        >
          <Segmented
            value={prefs.contrast}
            onChange={(contrast) => update({ contrast })}
            options={[
              { id: "standard", label: "Standard" },
              { id: "high", label: "High" },
            ]}
          />
        </Section>

        <Section
          title="Motion"
          hint="Reduced turns off animation if it feels busy or you’re sensitive to movement."
          icon={<Vibrate className="size-4" />}
        >
          <Segmented
            value={prefs.motion}
            onChange={(motion) => update({ motion })}
            options={[
              { id: "full", label: "Full" },
              { id: "reduced", label: "Reduced" },
            ]}
          />
        </Section>

        <Section
          title="When I sign in"
          hint="Resume opens the last page you were on — useful if you bounce between service and installs."
        >
          <Segmented
            value={prefs.resumeLast ? "resume" : "clock"}
            onChange={(v) => update({ resumeLast: v === "resume" })}
            options={[
              { id: "clock", label: "Always Clock" },
              { id: "resume", label: "Resume last page" },
            ]}
          />
        </Section>

        <Section title="Keyboard" hint="Press ? anywhere on the desk (except while typing)." icon={<Keyboard className="size-4" />}>
          <ul className="divide-y divide-border rounded-xl border border-border">
            <Shortcut keys="⌘K" action="Search accounts, serials, WOs" />
            <Shortcut keys="?" action="Open keyboard shortcuts" />
            <Shortcut keys="Esc" action="Close a sheet or dialog" />
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-2">
        {icon ? <span className="mt-0.5 text-muted-foreground">{icon}</span> : null}
        <div>
          <h2 className="font-display text-lg font-medium tracking-tight">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium",
              on ? "bg-ink text-ink-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted",
            )}
          >
            {on ? <Check className="size-3.5 shrink-0" /> : o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Shortcut({ keys, action }: { keys: string; action: string }) {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-sm">{action}</span>
      <kbd className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs">{keys}</kbd>
    </li>
  );
}

function Preview({ appearance }: { appearance: Appearance }) {
  const { prefs } = usePrefs();
  const dark =
    appearance === "dark" ||
    (appearance === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  return (
    <div
      className={cn(
        "mt-4 overflow-hidden rounded-lg border border-border",
        dark ? "bg-ink text-ink-foreground" : "bg-paper text-foreground",
      )}
    >
      <div className={cn("flex items-center justify-between px-3 py-2 text-xs", dark ? "bg-black/20" : "bg-muted/80")}>
        <span className="font-display text-sm">Katz Desk</span>
        <span className={dark ? "text-cream/60" : "text-muted-foreground"}>
          {prefs.text === "large" ? "Large type" : "Default type"}
          {prefs.density === "compact" ? " · Compact" : ""}
        </span>
      </div>
      <div className="px-3 py-3">
        <p className="text-sm font-medium">Open call · The Gathery</p>
        <p className={cn("mt-0.5 text-xs", dark ? "text-cream/55" : "text-muted-foreground")}>
          Serials and flags stay readable in {dark ? "dark" : "light"} mode.
        </p>
      </div>
    </div>
  );
}
