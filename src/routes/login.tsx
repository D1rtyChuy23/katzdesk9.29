import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { checkUsername, getMyAccess, lookupSignIn, registerAccount } from "@/lib/ops/access";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export const Route = createFileRoute("/login")({ component: Login });

const PENDING_KEY = "katz-desk-pending";

function readPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

function writePending(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.sessionStorage.setItem(PENDING_KEY, "1");
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up" | "pending">("in");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (readPending()) setMode("pending");
  }, []);

  useEffect(() => {
    if (isPending || !user || mode === "pending" || mode === "up") return;
    void (async () => {
      try {
        const access = await getMyAccess();
        if (!access.approved) {
          writePending(true);
          setMode("pending");
          return;
        }
        writePending(false);
        void navigate({ to: "/" });
      } catch {
        // Stay on login if the session is not ready.
      }
    })();
  }, [isPending, user, navigate, mode]);

  async function dropSession() {
    try {
      await authClient.signOut();
    } catch {
      /* already signed out */
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const name = username.trim();
        if (!/^[a-zA-Z0-9._-]{3,32}$/.test(name)) {
          throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
        }
        const available = await checkUsername({ data: { username: name } });
        if (!available.available) throw new Error("That username is already taken.");
        const res = await authClient.signUp.email({
          email: email.trim(),
          password,
          name,
        });
        if (res.error) throw new Error(res.error.message);
        await authClient.getSession();
        const access = await registerAccount({ data: { username: name, email: email.trim() } });
        await router.invalidate();
        if (!access.approved) {
          writePending(true);
          await dropSession();
          setMode("pending");
          return;
        }
        writePending(false);
        void navigate({ to: "/" });
      } else {
        const looked = await lookupSignIn({ data: { username: username.trim() } });
        const res = await authClient.signIn.email({ email: looked.email, password });
        if (res.error) throw new Error(res.error.message);
        await authClient.getSession();
        await router.invalidate();
        writePending(false);
        void navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      if (/waiting for approval/i.test(msg)) {
        writePending(true);
        setMode("pending");
        return;
      }
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-svh bg-ink text-ink-foreground">
      <div className="mx-auto grid min-h-svh max-w-5xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
        <div>
          <p className="text-xs tracking-[0.22em] text-cream/50 uppercase">Katz Coffee · Houston</p>
          <h1 className="mt-4 font-display text-5xl leading-[1.05] font-medium tracking-tight">
            Katz <span className="italic text-cream/70">Desk</span>
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-cream/70">
            One desk for sales and service. Past due, coming due, recipes, and the
            handoff between the two teams — without the spreadsheet pile-up.
          </p>
        </div>
        <div className="rounded-xl border border-cream/12 bg-cream/6 p-6">
          {mode === "pending" ? (
            <>
              <h2 className="font-display text-2xl">Waiting for approval</h2>
              <p className="mt-2 text-sm text-cream/60">
                Your account was created. A desk admin will review it before you can open Katz Desk.
                Sign in with your username after you’re approved.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    void (async () => {
                      try {
                        await authClient.getSession();
                        const access = await getMyAccess();
                        if (access.approved) {
                          writePending(false);
                          void navigate({ to: "/" });
                        }
                      } catch {
                        /* still waiting or signed out */
                      }
                    })();
                  }}
                >
                  Check again
                </Button>
                <Button
                  type="button"
                  className="w-full"
                  variant="secondary"
                  onClick={() => {
                    writePending(false);
                    setMode("in");
                    setPassword("");
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl">{mode === "up" ? "Create an account" : "Sign in"}</h2>
              <p className="mt-1 text-sm text-cream/60">
                {mode === "up"
                  ? "Pick a username and any email. New accounts wait for an admin to approve them."
                  : "Sign in with your username. New accounts need approval before they can open the desk."}
              </p>
              <form onSubmit={onSubmit} className="mt-5 space-y-3">
                <div>
                  <Label htmlFor="username" className="text-cream/60">
                    Username
                  </Label>
                  <Input
                    id="username"
                    required
                    autoComplete="username"
                    className="mt-1 border-cream/15 bg-ink text-cream"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. amanda.s"
                  />
                </div>
                {mode === "up" ? (
                  <div>
                    <Label htmlFor="email" className="text-cream/60">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      className="mt-1 border-cream/15 bg-ink text-cream"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Any email you use"
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="password" className="text-cream/60">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                    className="mt-1 border-cream/15 bg-ink text-cream"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "up" ? "Create account" : "Sign in"}
                </Button>
              </form>
              <button
                type="button"
                className="mt-4 text-sm text-cream/60 underline-offset-2 hover:underline"
                onClick={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setError(null);
                }}
              >
                {mode === "in" ? "Need an account? Create one" : "Already have an account? Sign in"}
              </button>
              {authEnabled ? (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs text-cream/40">
                    <span className="h-px flex-1 bg-cream/15" />
                    or
                    <span className="h-px flex-1 bg-cream/15" />
                  </div>
                  <div className="space-y-2">
                    {GROK_PROVIDERS.map((p) => (
                      <Button
                        key={p.providerId}
                        type="button"
                        variant="secondary"
                        className="w-full"
                        onClick={() =>
                          void signIn(p.providerId, { callbackURL: "/", errorCallbackURL: "/login" }).catch(
                            (err) => setError(err instanceof Error ? err.message : "Sign-in failed"),
                          )
                        }
                      >
                        Continue with {p.label}
                      </Button>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="mt-5 text-xs leading-relaxed text-cream/40">
                Google and X still work if you already use them. New username accounts wait for approval.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
