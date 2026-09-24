import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authClient, signOut } from "@/lib/auth/client";
import { claimInvite, getMyAccess } from "@/lib/ops/access";
import { clearInviteToken, readInviteToken } from "@/lib/ops/invite-client";
import { AppShell } from "@/components/desk/shell";
import { UsernameSetup } from "@/components/desk/username-setup";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  component: DeskLayout,
});

function LoadingClock() {
  return (
    <div className="flex min-h-svh bg-ink text-cream">
      <div className="m-auto px-6 text-center">
        <p className="font-display text-3xl">Katz Desk</p>
        <p className="mt-2 text-sm text-cream/60">Loading the operations clock…</p>
      </div>
    </div>
  );
}

function withTimeout<T>(work: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function AccountProblem({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground">
      <div className="max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6">
        <p className="text-xs tracking-[0.18em] text-cream/50 uppercase">Katz Desk</p>
        <h1 className="mt-3 font-display text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-cream/70">{message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button type="button" className="w-full" onClick={onRetry}>
            Try again
          </Button>
          <Button type="button" className="w-full" variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}

function DeskLayout() {
  const { user, isPending } = useCurrentUserState();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteReady, setInviteReady] = useState(false);
  const [sessionSlow, setSessionSlow] = useState(false);
  const [gateSlow, setGateSlow] = useState(false);
  useEffect(() => {
    setInviteToken(readInviteToken());
    setInviteReady(true);
  }, []);
  // A dropped sign-in check used to leave isPending true forever (the clock
  // never left). Retry once, then show a way out instead of spinning.
  useEffect(() => {
    if (user || !isPending) {
      setSessionSlow(false);
      return;
    }
    const retry = window.setTimeout(() => {
      void authClient.getSession().catch(() => undefined);
    }, 3000);
    const giveUp = window.setTimeout(() => setSessionSlow(true), 8000);
    return () => {
      window.clearTimeout(retry);
      window.clearTimeout(giveUp);
    };
  }, [user, isPending]);
  const claim = useQuery({
    queryKey: ["access", "claim", inviteToken],
    queryFn: async () => {
      const row = await withTimeout(
        claimInvite({ data: { token: inviteToken } }),
        12000,
        "Claiming the invite took too long.",
      );
      if (row.approved) clearInviteToken();
      return row;
    },
    enabled: !!user && inviteReady && !!inviteToken,
    retry: 1,
  });
  const access = useQuery({
    queryKey: ["access", "me"],
    queryFn: () => withTimeout(getMyAccess(), 12000, "Loading your account took too long."),
    enabled: !!user && inviteReady && (!inviteToken || claim.isFetched),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (d && !d.approved && d.usernameChosen) return 3000;
      if (d?.approved) return 12000;
      return false;
    },
    retry: 1,
  });

  const accessEnabled = !!user && inviteReady && (!inviteToken || claim.isFetched);
  const gateBlocked = accessEnabled && !access.data && !claim.data && !access.isError;
  useEffect(() => {
    if (!gateBlocked) {
      setGateSlow(false);
      return;
    }
    const giveUp = window.setTimeout(() => setGateSlow(true), 12000);
    return () => window.clearTimeout(giveUp);
  }, [gateBlocked]);

  if (!user && !isPending) return <RedirectToSignIn />;
  if (!user && sessionSlow) {
    return (
      <AccountProblem
        title="Couldn’t load your account"
        message="The sign-in check didn’t finish. Try again, or sign out and come back in."
        onRetry={() => window.location.reload()}
      />
    );
  }
  if (!user || !inviteReady) return <LoadingClock />;
  if (inviteToken && !claim.isFetched && !claim.isError) return <LoadingClock />;
  if (gateBlocked && !gateSlow) return <LoadingClock />;
  const gate = claim.data?.approved ? { ...access.data, ...claim.data, approved: true, denied: false } : access.data;
  if (gateSlow || access.isError || (inviteToken && claim.isError && !access.data)) {
    const err = access.error ?? claim.error;
    return (
      <AccountProblem
        title="Couldn’t load your account"
        message={err instanceof Error ? err.message : "Loading your account took too long."}
        onRetry={() => {
          setGateSlow(false);
          void access.refetch();
          if (inviteToken) void claim.refetch();
        }}
      />
    );
  }
  if (gate?.needsUsername) {
    return (
      <UsernameSetup
        email={gate.email ?? user.primaryEmail}
        onDone={() => void access.refetch()}
      />
    );
  }
  if (gate?.denied) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground">
        <div className="max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6">
          <p className="text-xs tracking-[0.18em] text-cream/50 uppercase">Katz Desk</p>
          <h1 className="mt-3 font-display text-3xl">Access denied</h1>
          <p className="mt-2 text-sm text-cream/70">
            Signed in as {gate.username}. An admin declined this account. Ask them to send a new
            invite link — opening that link signs you in.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button type="button" className="w-full" onClick={() => void access.refetch()}>
              Check again
            </Button>
            <Button type="button" className="w-full" variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </main>
    );
  }
  if (!gate?.approved) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground">
        <div className="max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6">
          <p className="text-xs tracking-[0.18em] text-cream/50 uppercase">Katz Desk</p>
          <h1 className="mt-3 font-display text-3xl">Waiting for approval</h1>
          <p className="mt-2 text-sm text-cream/70">
            Signed in as {gate?.username ?? "this account"}. Open the invite link from your admin
            while signed in, or ask them to send a new one. Without that link, an admin still needs
            to approve this account.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button type="button" className="w-full" onClick={() => void access.refetch()}>
              Check again
            </Button>
            <Button type="button" className="w-full" variant="secondary" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </main>
    );
  }
  return (
    <AppShell isAdmin={!!gate.isAdmin} role={gate.role}>
      <Outlet />
    </AppShell>
  );
}
