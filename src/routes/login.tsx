import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { checkUsername, claimInvite, getMyAccess, lookupSignIn, peekInvite, registerAccount } from "@/lib/ops/access";
import { clearInviteToken, readInviteToken, rememberInviteToken } from "@/lib/ops/invite-client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MIN_PASSWORD, passwordProblem, peekPasswordReset, resetPasswordWithToken } from "@/lib/ops/password-reset";

export const Route = createFileRoute("/login")({ component: Login });

const PENDING_KEY = "katz-desk-pending";
const LAST_LOGIN_KEY = "katz-desk-last-login";

function readLastLogin(): string {
  try {
    return window.localStorage.getItem(LAST_LOGIN_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLastLogin(v: string) {
  try {
    window.localStorage.setItem(LAST_LOGIN_KEY, v);
  } catch {
    /* private mode */
  }
}

/** Better Auth's wording is terse; say what to do next instead. */
function friendlySignInError(msg: string): string {
  if (/invalid (email or )?password|invalid credentials|incorrect/i.test(msg)) {
    return "That password didn't match. Check Caps Lock and try again, or tap Forgot password below.";
  }
  if (/too many|rate limit/i.test(msg)) return "Too many tries in a row. Wait a minute, then try again.";
  if (/network|failed to fetch|load failed/i.test(msg)) {
    return "Couldn't reach Katz Desk. Check your connection and try again.";
  }
  return msg;
}

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
  const [mode, setMode] = useState<"in" | "up" | "pending" | "reset">("in");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetBad, setResetBad] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  // Set when the account exists but signs in with Google or X, not a password.
  const [socialOnly, setSocialOnly] = useState<string[] | null>(null);
  // Set when nobody has that email yet, so we can offer "create one" in one tap.
  const [noAccount, setNoAccount] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get("reset");
    if (reset) {
      setResetToken(reset);
      setMode("reset");
      void peekPasswordReset({ data: { token: reset } })
        .then((r) => {
          setResetBad(!r.ok);
          setResetFor(r.username);
        })
        .catch(() => setResetBad(true));
      return;
    }
    rememberInviteToken(params.get("invite"));
    if (readInviteToken()) setMode("up");
    else if (readPending()) setMode("pending");
    else {
      const last = readLastLogin();
      if (last) setUsername(last);
    }
  }, []);

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!resetToken) return;
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const done = await resetPasswordWithToken({ data: { token: resetToken, password } });
      window.history.replaceState(null, "", "/login");
      setResetToken(null);
      setUsername(done.username ?? done.email ?? "");
      setPassword("");
      setConfirm("");
      setMode("in");
      setNotice("Password updated. Sign in with your new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isPending || !user || mode === "pending" || mode === "reset") return;
    void (async () => {
      try {
        const token = readInviteToken();
        if (!token && mode === "up") return;
        const access = token
          ? await claimInvite({ data: { token } })
          : await getMyAccess();
        if (access.approved) clearInviteToken();
        if (access.needsUsername) {
          writePending(false);
          void navigate({ to: "/" });
          return;
        }
        if (access.denied) {
          writePending(false);
          void navigate({ to: "/" });
          return;
        }
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSocialOnly(null);
    setNoAccount(null);
    try {
      if (mode === "up") {
        const name = username.trim();
        if (!/^[a-zA-Z0-9._-]{3,32}$/.test(name)) {
          throw new Error("Username must be 3–32 letters, numbers, dots, hyphens, or underscores.");
        }
        const available = await checkUsername({ data: { username: name } });
        if (!available.available) throw new Error("That username is already taken.");
        const mail = email.trim().toLowerCase();
        let signedIn = false;
        const res = await authClient.signUp.email({
          email: mail,
          password,
          name,
        });
        if (res.error) {
          const msg = res.error.message ?? "";
          if (/already|exist|registered/i.test(msg)) {
            const existing = await authClient.signIn.email({ email: mail, password });
            if (existing.error) {
              throw new Error(
                "That email already has an account. Sign in with the password you used before.",
              );
            }
            signedIn = true;
          } else {
            throw new Error(res.error.message);
          }
        }
        await authClient.getSession();
        const access = await registerAccount({
          data: { username: name, email: mail, token: readInviteToken() },
        });
        await router.invalidate();
        if (access.approved) clearInviteToken();
        writePending(!access.approved);
        void navigate({ to: "/" });
        void signedIn;
      } else {
        const identity = username.trim();
        const looked = await lookupSignIn({ data: { username: identity } });
        if (looked.invited) {
          const peek = await peekInvite({ data: { identity } });
          setMode("up");
          if (peek.username) setUsername(peek.username);
          if (peek.email) setEmail(peek.email);
          else if (identity.includes("@")) setEmail(identity);
          setError("You’re invited — create an account with this email to get in.");
          return;
        }
        if (!looked.email) throw new Error("Unknown username");
        const methods = looked.methods ?? [];
        if (methods.length && !methods.includes("password")) {
          // Google/X account with no password: send them to the right button instead of "wrong password".
          setSocialOnly(methods);
          return;
        }
        const res = await authClient.signIn.email({ email: looked.email, password });
        if (res.error) {
          const msg = res.error.message ?? "Sign-in failed";
          throw new Error(friendlySignInError(msg));
        }
        writeLastLogin(identity);
        await authClient.getSession();
        await router.invalidate();
        writePending(!!looked.waiting);
        void navigate({ to: "/" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      if (/waiting for approval/i.test(msg)) {
        writePending(true);
        setMode("pending");
        return;
      }
      if (/denied access/i.test(msg)) {
        setError("This account was denied access. Ask an admin to invite you again.");
        return;
      }
      if (/unknown username/i.test(msg)) {
        const who = username.trim();
        const peek = await peekInvite({ data: { identity: who } }).catch(() => null);
        if (peek?.invited) {
          setMode("up");
          if (peek.username) setUsername(peek.username);
          if (peek.email) setEmail(peek.email);
          setError("You’re invited — create an account to get in.");
          return;
        }
        setNoAccount(who);
        return;
      }
      setError(friendlySignInError(msg));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-svh overflow-hidden bg-gradient-to-br from-ink via-ink to-[#2a2018] text-ink-foreground">
      <span aria-hidden className="katz-cloud -bottom-16 -left-24 w-[34rem] opacity-[0.07]" />
      <span aria-hidden className="katz-cloud katz-cloud-slow -top-12 right-[-6rem] w-[26rem] -scale-x-100 opacity-[0.05]" />
      <div className="relative mx-auto grid min-h-svh max-w-5xl content-center items-center gap-6 px-5 py-8 sm:gap-10 sm:px-6 sm:py-12 lg:grid-cols-2">
        <div>
          <img
            src="/brand/katz-coffee-logo.svg"
            alt="Katz Coffee"
            width={360}
            height={216}
            className="h-auto w-32 drop-shadow-[0_10px_24px_rgb(0_0_0/0.5)] sm:w-60"
          />
          <p className="mt-3 text-xs font-semibold sm:mt-5 tracking-[0.3em] text-katz-gold uppercase">Houston · Service desk</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl leading-[1.05] font-medium tracking-tight">
            Katz <span className="italic text-cream/70">Desk</span>
          </h1>
          <p className="mt-4 hidden max-w-md text-base leading-relaxed text-cream/70 sm:block">
            One desk for sales and service. Past due, coming due, recipes, and the
            handoff between the two teams — without the spreadsheet pile-up.
          </p>
        </div>
        <div className="rounded-xl border border-cream/12 bg-cream/6 p-5 sm:p-6">
          {mode === "reset" ? (
            <>
              <h2 className="font-display text-2xl">Set a new password</h2>
              <p className="mt-1 text-sm text-cream/60">
                {resetBad
                  ? "This reset link has expired or was already used. Ask a desk admin for a new one."
                  : resetFor
                    ? `For ${resetFor}. You'll be signed out of other devices.`
                    : "Choose a new password for your KatzDesk account."}
              </p>
              {resetBad ? (
                <Button
                  type="button"
                  className="mt-5 w-full"
                  onClick={() => {
                    window.history.replaceState(null, "", "/login");
                    setMode("in");
                  }}
                >
                  Back to sign in
                </Button>
              ) : (
                <form onSubmit={onReset} className="mt-5 space-y-3" data-testid="reset-form">
                  <div>
                    <Label htmlFor="new-password" className="text-cream/60">
                      New password
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      required
                      minLength={MIN_PASSWORD}
                      autoComplete="new-password"
                      className="mt-1 border-cream/15 bg-ink text-cream"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password" className="text-cream/60">
                      Type it again
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      required
                      minLength={MIN_PASSWORD}
                      autoComplete="new-password"
                      className="mt-1 border-cream/15 bg-ink text-cream"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" className="w-full" disabled={busy}>
                    Save new password
                  </Button>
                </form>
              )}
            </>
          ) : mode === "pending" ? (
            <>
              <h2 className="font-display text-2xl">Waiting for approval</h2>
              <p className="mt-2 text-sm text-cream/60">
                Your account was created. A desk admin will review it before you can open Katz Desk.
                Stay signed in and tap check again after they approve you.
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    void (async () => {
                      try {
                        await authClient.getSession();
                        const token = readInviteToken();
                        const access = token
                          ? await claimInvite({ data: { token } })
                          : await getMyAccess();
                        if (access.approved) {
                          clearInviteToken();
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
                    void authClient.signOut().catch(() => undefined);
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
                  ? readInviteToken()
                    ? "This invite lets you in. Create a password, or continue with Google or X."
                    : "Use the email you were invited with (or Google / X). Invited people skip the wait."
                  : "Username or the email on your account. Open the invite link if you have one."}
              </p>
              <form onSubmit={onSubmit} className="mt-5 space-y-3">
                <div>
                  <Label htmlFor="username" className="text-cream/60">
                    {mode === "up" ? "Username" : "Username or email"}
                  </Label>
                  <Input
                    id="username"
                    required
                    autoComplete="username"
                    className="mt-1 border-cream/15 bg-ink text-cream"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={mode === "up" ? "e.g. amanda.s" : "username or email"}
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
                      placeholder="The email you were invited with"
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="password" className="text-cream/60">
                    Password
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      required
                      minLength={mode === "up" ? MIN_PASSWORD : undefined}
                      autoComplete={mode === "up" ? "new-password" : "current-password"}
                      className="border-cream/15 bg-ink pr-11 text-cream"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 grid w-11 place-items-center text-cream/60 hover:text-cream"
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                      onClick={() => setShowPw((v) => !v)}
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                {error ? (
                  <p className="text-sm text-destructive" role="alert" data-testid="login-error">
                    {error}
                  </p>
                ) : null}
                {socialOnly ? (
                  <p
                    className="rounded-md border border-katz-gold/40 bg-katz-gold/10 px-3 py-2 text-sm text-cream"
                    role="alert"
                    data-testid="login-social"
                  >
                    This account signs in with{" "}
                    {socialOnly
                      .map((m) => GROK_PROVIDERS.find((p) => p.providerId === m)?.label ?? m)
                      .join(" or ")}
                    , not a password. Tap the button below.
                  </p>
                ) : null}
                {noAccount ? (
                  <div
                    className="rounded-md border border-cream/15 bg-cream/6 px-3 py-2 text-sm text-cream/80"
                    role="alert"
                    data-testid="login-no-account"
                  >
                    <p>No Katz Desk account for “{noAccount}” yet.</p>
                    <button
                      type="button"
                      className="mt-1 font-medium text-katz-gold underline-offset-2 hover:underline"
                      onClick={() => {
                        setMode("up");
                        if (noAccount.includes("@")) {
                          setEmail(noAccount.toLowerCase());
                          setUsername(noAccount.split("@")[0]!.replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase());
                        }
                        setNoAccount(null);
                      }}
                    >
                      Create an account with this {noAccount.includes("@") ? "email" : "name"}
                    </button>
                  </div>
                ) : null}
                {notice && mode === "in" ? <p className="text-sm text-emerald-300">{notice}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {mode === "up" ? "Create account" : "Sign in"}
                </Button>
              </form>
              {mode === "in" ? (
                <div className="mt-3">
                  <button
                    type="button"
                    className="text-sm text-cream/60 underline-offset-2 hover:underline"
                    aria-expanded={showForgot}
                    onClick={() => setShowForgot((v) => !v)}
                  >
                    Forgot password?
                  </button>
                  {showForgot ? (
                    <p className="mt-2 rounded-md border border-cream/12 bg-cream/6 px-3 py-2 text-xs leading-relaxed text-cream/70">
                      Ask a desk admin to send you a reset link (Access → Reset password). Open it, choose a new
                      password, then sign in here. Signed in already? Change it under Settings → Password.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                className="mt-4 text-sm text-cream/60 underline-offset-2 hover:underline"
                onClick={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setError(null);
                  setSocialOnly(null);
                  setNoAccount(null);
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
                        variant={socialOnly?.includes(p.providerId) ? "default" : "secondary"}
                        className="w-full"
                        onClick={() => {
                          const token = readInviteToken();
                          const back = token
                            ? `/login?invite=${encodeURIComponent(token)}`
                            : "/login";
                          void signIn(p.providerId, {
                            callbackURL: token ? `/?invite=${encodeURIComponent(token)}` : "/",
                            errorCallbackURL: back,
                          }).catch((err) =>
                            setError(err instanceof Error ? err.message : "Sign-in failed"),
                          );
                        }}
                      >
                        Continue with {p.label}
                      </Button>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="mt-5 text-xs leading-relaxed text-cream/40">
                Open the invite link from your admin, then create an account or use Google / X.
                That link approves you. Anyone without an invite still waits for approval.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}