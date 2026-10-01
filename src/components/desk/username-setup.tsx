import { useEffect, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { signOut } from "@/lib/auth/client";
import { checkUsername, registerAccount } from "@/lib/ops/access";
import { clearInviteToken, readInviteToken } from "@/lib/ops/invite-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { toast } from "sonner";

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;

export function UsernameSetup({
  email,
  onDone,
}: {
  email: string | null;
  onDone: () => void;
}) {
  const [username, setUsername] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (name: string) =>
      registerAccount({ data: { username: name, email, token: readInviteToken() } }),
    onSuccess: (row) => {
      if (row.approved) clearInviteToken();
      toast.success(
        row.approved ? `Welcome, ${row.username}` : `Username saved as ${row.username}`,
      );
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save username"),
  });

  useEffect(() => {
    const name = username.trim();
    if (!name) {
      setHint(null);
      return;
    }
    if (!USERNAME_RE.test(name)) {
      setHint("3–32 letters, numbers, dots, hyphens, or underscores.");
      return;
    }
    const t = window.setTimeout(() => {
      void checkUsername({ data: { username: name } })
        .then((r) => setHint(r.available ? "Available" : "That username is already taken."))
        .catch(() => setHint(null));
    }, 280);
    return () => window.clearTimeout(t);
  }, [username]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!USERNAME_RE.test(name)) {
      toast.error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
      return;
    }
    save.mutate(name);
  }

  const taken = hint === "That username is already taken.";

  return (
    <main className="flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground">
      <div className="w-full max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6">
        <p className="text-xs tracking-[0.18em] text-cream/50 uppercase">Katz Desk</p>
        <h1 className="mt-3 font-display text-3xl">Choose A Username</h1>
        <p className="mt-2 text-sm leading-relaxed text-cream/70">
          Use the same sign-in you just used — Google, X, or your existing password. You only
          need a username for the desk. No new password.
        </p>
        {email ? (
          <p className="mt-3 truncate text-xs text-cream/45">Signed in as {email}</p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <div>
            <Label htmlFor="setup-username" className="text-cream/60">
              Username
            </Label>
            <Input
              id="setup-username"
              required
              autoComplete="username"
              autoFocus
              className="mt-1 border-cream/15 bg-ink text-cream"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. amanda.s"
            />
            {hint ? (
              <p className={`mt-1.5 text-xs ${taken ? "text-destructive" : "text-cream/50"}`}>{hint}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={save.isPending || taken}>
            {save.isPending ? "Saving…" : "Continue"}
          </Button>
        </form>
        <Button
          type="button"
          className="mt-2 w-full"
          variant="secondary"
          onClick={() => void signOut()}
        >
          Sign out
        </Button>
      </div>
    </main>
  );
}
