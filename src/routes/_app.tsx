import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { getMyAccess } from "@/lib/ops/access";
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

function DeskLayout() {
  const { sessionUser } = Route.useRouteContext();
  const { user, isPending } = useCurrentUserState();
  const access = useQuery({
    queryKey: ["access", "me"],
    queryFn: () => getMyAccess(),
    enabled: !!user,
    refetchInterval: (q) => {
      const d = q.state.data;
      if (d && !d.approved && d.usernameChosen) return 3000;
      if (d?.approved) return 12000;
      return false;
    },
    retry: 1,
  });

  if (isPending && !sessionUser) return <LoadingClock />;
  if (!user && !sessionUser) return <RedirectToSignIn />;
  if (!user) return <LoadingClock />;
  if (access.isPending && !access.data) return <LoadingClock />;
  if (access.isError) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground">
        <div className="max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6">
          <p className="text-xs tracking-[0.18em] text-cream/50 uppercase">Katz Desk</p>
          <h1 className="mt-3 font-display text-3xl">Couldn’t load your account</h1>
          <p className="mt-2 text-sm text-cream/70">
            {access.error instanceof Error ? access.error.message : "Try again in a moment."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button type="button" className="w-full" onClick={() => void access.refetch()}>
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
  if (access.data?.needsUsername) {
    return (
      <UsernameSetup
        email={access.data.email ?? user.primaryEmail}
        onDone={() => void access.refetch()}
      />
    );
  }
  if (access.data?.denied) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground">
        <div className="max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6">
          <p className="text-xs tracking-[0.18em] text-cream/50 uppercase">Katz Desk</p>
          <h1 className="mt-3 font-display text-3xl">Access denied</h1>
          <p className="mt-2 text-sm text-cream/70">
            Signed in as {access.data.username}. An admin declined this account. Ask them to invite
            you again if you should be on the desk.
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
  if (!access.data?.approved) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-ink px-6 text-ink-foreground">
        <div className="max-w-md rounded-xl border border-cream/12 bg-cream/6 p-6">
          <p className="text-xs tracking-[0.18em] text-cream/50 uppercase">Katz Desk</p>
          <h1 className="mt-3 font-display text-3xl">Waiting for approval</h1>
          <p className="mt-2 text-sm text-cream/70">
            Signed in as {access.data?.username ?? "this account"}. An admin still needs to approve this
            account before you can open the desk.
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
    <AppShell isAdmin={access.data.isAdmin}>
      <Outlet />
    </AppShell>
  );
}
