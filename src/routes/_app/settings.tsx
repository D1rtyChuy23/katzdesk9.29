import { createFileRoute } from "@tanstack/react-router";
import { Check, Contrast, KeyRound, Keyboard, StretchHorizontal, Type, Vibrate } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import { passwordProblem } from "@/lib/ops/password-reset";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
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
        <PasswordSection />
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
          title="Text Size"
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
          title="When I Sign In"
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

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(next);
    if (problem) return setError(problem);
    if (next !== again) return setError("The two new passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const res = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (res.error) {
        const msg = res.error.message ?? "";
        throw new Error(
          /invalid|incorrect|password/i.test(msg) && !/credential/i.test(msg)
            ? "Your current password isn't right."
            : /credential|not found/i.test(msg)
              ? "You sign in with Google or X, so there's no password to change. Ask an admin for a reset link to add one."
              : msg || "Could not change the password",
        );
      }
      setCurrent("");
      setNext("");
      setAgain("");
      toast.success("Password changed. Other devices were signed out.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title="Password"
      hint="Change the password you use with your username. Forgot it? An admin can send you a reset link from Access."
      icon={<KeyRound className="size-4" />}
    >
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-3" data-testid="change-password">
        <div>
          <Label htmlFor="pw-current">Current</Label>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pw-new">New</Label>
          <Input
            id="pw-new"
            type="password"
            autoComplete="new-password"
            required
            className="mt-1"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="pw-again">New, again</Label>
          <Input
            id="pw-again"
            type="password"
            autoComplete="new-password"
            required
            className="mt-1"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </div>
        {error ? <p className="text-sm text-destructive sm:col-span-3">{error}</p> : null}
        <div className="sm:col-span-3">
          <Button type="submit" disabled={busy}>
            Change password
          </Button>
        </div>
      </form>
    </Section>
  );
}
