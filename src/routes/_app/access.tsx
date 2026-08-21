import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyAccess, listDeskAccounts, setAccountApproved } from "@/lib/ops/access";
import { Button } from "@/components/ui/button";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, SORT_DATE, sortDesk } from "@/lib/ops/sort";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/access")({
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const list = useQuery({
    queryKey: ["access", "list"],
    queryFn: () => listDeskAccounts(),
    enabled: !!me.data?.isAdmin,
  });
  const setApproved = useMutation({
    mutationFn: (d: { userId: string; approved: boolean }) => setAccountApproved({ data: d }),
    onSuccess: (row) => {
      toast.success(row.approved ? `Approved ${row.username}` : `Revoked ${row.username}`);
      void qc.invalidateQueries({ queryKey: ["access"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const [sort, setSort] = useDeskSort("access", "date-desc");
  const pending = (list.data ?? []).filter((a) => !a.approved);
  const active = useMemo(
    () =>
      sortDesk(list.data ?? [], sort, {
        date: (a) => a.createdAt,
        name: (a) => a.username,
      }).filter((a) => a.approved),
    [list.data, sort],
  );

  if (me.data && !me.data.isAdmin) {
    return (
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Access</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only an admin can review new accounts.</p>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Access</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          New username accounts wait here until you approve them. They cannot open the desk until then.
        </p>
        <div className="mt-3">
          <SortSelect value={sort} onChange={setSort} options={[...SORT_DATE, ...SORT_ALPHA]} />
        </div>
      </header>

      <section className="mt-6">
        <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Waiting ({pending.length})</h2>
        <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
          {pending.map((a) => (
            <li key={a.userId} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="font-medium">{a.username}</p>
                <p className="truncate text-sm text-muted-foreground">{a.email ?? "No email"}</p>
              </div>
              <Button
                size="sm"
                disabled={setApproved.isPending}
                onClick={() => setApproved.mutate({ userId: a.userId, approved: true })}
              >
                Approve
              </Button>
            </li>
          ))}
          {pending.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">No one is waiting.</li>
          ) : null}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Approved ({active.length})</h2>
        <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
          {active.map((a) => (
            <li key={a.userId} className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
              <div className="min-w-0">
                <p className="font-medium">
                  {a.username}
                  {a.isAdmin ? <span className="ml-2 text-xs text-muted-foreground">admin</span> : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">{a.email ?? "No email"}</p>
              </div>
              {!a.isAdmin ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setApproved.isPending}
                  onClick={() => setApproved.mutate({ userId: a.userId, approved: false })}
                >
                  Revoke
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
