import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvite,
  denyAccount,
  getMyAccess,
  grantAllCanAddCustomers,
  listDeskAccounts,
  listDeskInvites,
  revokeInvite,
  setAccountApproved,
  setAccountCanAddCustomers,
  setAccountRole,
  type DeskInvite,
} from "@/lib/ops/access";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, SORT_DATE, sortDesk } from "@/lib/ops/sort";
import { toast } from "sonner";
import { SelectField } from "@/components/ui/select-field";


export const Route = createFileRoute("/_app/access")({
  component: Page,
});

function inviteBody(inv: { email: string | null; username: string | null }, origin: string) {
  const bits = [
    inv.username ? `username ${inv.username}` : null,
    inv.email ? `email ${inv.email}` : null,
  ].filter(Boolean);
  const who = bits.join(" or ") || "the username you were given";
  return `You're invited to Katz Desk.

Open this link and create an account:
${origin}/login

Use ${who}. Invited accounts skip the wait.

If you already use Google or X, sign in with that, pick a username, and you'll be in.`;
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy"),
  );
}

function Page() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const list = useQuery({
    queryKey: ["access", "list"],
    queryFn: () => listDeskAccounts(),
    enabled: !!me.data?.isAdmin,
    refetchInterval: 8000,
  });
  const invites = useQuery({
    queryKey: ["access", "invites"],
    queryFn: () => listDeskInvites(),
    enabled: !!me.data?.isAdmin,
    refetchInterval: 8000,
  });
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [inviteCanAdd, setInviteCanAdd] = useState(true);

  const setApproved = useMutation({
    mutationFn: (d: { userId: string; approved: boolean }) => setAccountApproved({ data: d }),
    onSuccess: (row) => {
      toast.success(row.approved ? `Approved ${row.username}` : `Revoked ${row.username}`);
      void qc.invalidateQueries({ queryKey: ["access"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const setPerm = useMutation({
    mutationFn: (d: { userId: string; canAddCustomers: boolean }) =>
      setAccountCanAddCustomers({ data: d }),
    onSuccess: (row) => {
      toast.success(
        row.canAddCustomers
          ? `${row.username} can add customers`
          : `Removed add-customer permission from ${row.username}`,
      );
      void qc.invalidateQueries({ queryKey: ["access"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const grantAll = useMutation({
    mutationFn: () => grantAllCanAddCustomers(),
    onSuccess: (res) => {
      toast.success(
        res.updated
          ? `Granted add-customer permission to ${res.updated} ${res.updated === 1 ? "person" : "people"}`
          : "Everyone approved can already add customers",
      );
      void qc.invalidateQueries({ queryKey: ["access"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const setRole = useMutation({
    mutationFn: (d: { userId: string; role: "sales" | "service" | null }) => setAccountRole({ data: d }),
    onSuccess: (row) => {
      toast.success(
        row.role ? `${row.username} is ${row.role === "sales" ? "Sales" : "Service"}` : `${row.username} has no role yet`,
      );
      void qc.invalidateQueries({ queryKey: ["access"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set role"),
  });
  const deny = useMutation({
    mutationFn: (userId: string) => denyAccount({ data: { userId } }),
    onSuccess: (row) => {
      toast.success(`Denied ${row.username}`);
      void qc.invalidateQueries({ queryKey: ["access"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const invite = useMutation({
    mutationFn: (d: { email?: string; username?: string; canAddCustomers?: boolean }) =>
      createInvite({ data: d }),
    onSuccess: (res) => {
      if (res.autoApproved.length) {
        toast.success(`Approved ${res.autoApproved.join(", ")}`);
      } else if (res.invite.status === "pending") {
        toast.success("Invite saved. Copy the message and send it to them.");
      }
      setEmail("");
      setUsername("");
      void qc.invalidateQueries({ queryKey: ["access"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not invite"),
  });
  const revoke = useMutation({
    mutationFn: (id: number) => revokeInvite({ data: { id } }),
    onSuccess: () => {
      toast.success("Invite revoked");
      void qc.invalidateQueries({ queryKey: ["access"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [sort, setSort] = useDeskSort("access", "date-desc");
  const signingUp = (list.data ?? []).filter((a) => !a.usernameChosen && !a.denied);
  const pending = (list.data ?? []).filter((a) => !a.approved && !a.denied && a.usernameChosen);
  const denied = (list.data ?? []).filter((a) => a.denied && !a.approved);
  const active = useMemo(
    () =>
      sortDesk(list.data ?? [], sort, {
        date: (a) => a.createdAt,
        name: (a) => a.username,
      }).filter((a) => a.approved && a.usernameChosen),
    [list.data, sort],
  );
  const canAssignRoles = !!me.data?.canAssignRoles;
  const needsRole = active.filter((a) => !a.role);
  const pendingInvites = invites.data ?? [];
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function onInvite(e: FormEvent) {
    e.preventDefault();
    invite.mutate({
      email: email.trim() || undefined,
      username: username.trim() || undefined,
      canAddCustomers: inviteCanAdd,
    });
  }

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
          Save an invite, then send them the login link. They get in as soon as they create an
          account with that email or username — no extra approval click. Grant “add customers” so
          they can put new account names on the list.
          {canAssignRoles
            ? " Assign Sales or Service so My View lands on the right boards. Unassigned people stay flagged until you pick a role."
            : ""}
        </p>

        <div className="mt-3">
          <SortSelect value={sort} onChange={setSort} options={[...SORT_DATE, ...SORT_ALPHA]} />
        </div>
      </header>

      <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Invite people</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Email, username, or both. The desk does not send the email for you — copy the invite
          after saving and send it yourself. If they already signed up, inviting them approves them now.
        </p>
        <form onSubmit={onInvite} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              className="mt-1"
              placeholder="name@katzcoffee.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="invite-username">Username</Label>
            <Input
              id="invite-username"
              autoComplete="off"
              className="mt-1"
              placeholder="optional, e.g. amanda.s"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={invite.isPending} className="h-10">
            {invite.isPending ? "Saving…" : "Save invite"}
          </Button>
        </form>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={inviteCanAdd}
            onChange={(e) => setInviteCanAdd(e.target.checked)}
          />
          <span>
            Allow them to add new customer names
            <span className="mt-0.5 block text-xs text-muted-foreground">
              They still cannot rename or remove accounts. Turn this off if they should only pick
              from the existing list.
            </span>
          </span>
        </label>
      </section>

      <section className="mt-8">
        <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
          Pending invites ({pendingInvites.length})
        </h2>
        <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
          {pendingInvites.map((inv) => (
            <InviteRow
              key={inv.id}
              inv={inv}
              origin={origin}
              onRevoke={() => revoke.mutate(inv.id)}
              revoking={revoke.isPending}
            />
          ))}
          {pendingInvites.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">No pending invites.</li>
          ) : null}
        </ul>
      </section>

      {signingUp.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
            Signing up ({signingUp.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            They reached the desk but haven’t picked a username yet. They’ll show as approved or
            waiting once they finish.
          </p>
          <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
            {signingUp.map((a) => (
              <li
                key={a.userId}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.username}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {a.email ?? "No email"}
                    {a.approved ? " · invited, finishing setup" : " · finishing setup"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!a.approved ? (
                    <Button
                      size="sm"
                      disabled={setApproved.isPending}
                      onClick={() => setApproved.mutate({ userId: a.userId, approved: true })}
                    >
                      Approve
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deny.isPending}
                    onClick={() => deny.mutate(a.userId)}
                  >
                    Deny
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
          Waiting for approval ({pending.length})
        </h2>
        <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
          {pending.map((a) => (
            <li
              key={a.userId}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="font-medium">{a.username}</p>
                <p className="truncate text-sm text-muted-foreground">{a.email ?? "No email"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={setApproved.isPending}
                  onClick={() => setApproved.mutate({ userId: a.userId, approved: true })}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={deny.isPending}
                  onClick={() => deny.mutate(a.userId)}
                >
                  Deny
                </Button>
              </div>
            </li>
          ))}
          {pending.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground">No one is waiting.</li>
          ) : null}
        </ul>
      </section>

      {denied.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
            Denied ({denied.length})
          </h2>
          <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
            {denied.map((a) => (
              <li
                key={a.userId}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
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
          </ul>
        </section>
      ) : null}

      {canAssignRoles && needsRole.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs tracking-wide text-warning uppercase">
            Needs a role ({needsRole.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Existing logins stay unassigned until you pick Sales or Service. Role only changes My View defaults — it does not hide tickets.
          </p>
          <ul className="mt-2 overflow-hidden rounded-xl border border-warning/40 bg-card">
            {needsRole.map((a) => (
              <li
                key={`role-${a.userId}`}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{a.username}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.email ?? "No email"}</p>
                </div>
                <RolePicker
                  value={a.role}
                  disabled={setRole.isPending}
                  onChange={(role) => setRole.mutate({ userId: a.userId, role })}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
            Approved ({active.length})
          </h2>

          {active.some((a) => !a.isAdmin && !a.canAddCustomers) ? (
            <Button
              size="sm"
              variant="outline"
              disabled={grantAll.isPending}
              onClick={() => grantAll.mutate()}
            >
              Allow all to add customers
            </Button>
          ) : null}
        </div>
        <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
          {active.map((a) => (
            <li
              key={a.userId}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {a.username}
                  {a.isAdmin ? (
                    <span className="ml-2 text-xs text-muted-foreground">admin</span>
                  ) : a.canAddCustomers ? (
                    <span className="ml-2 text-xs text-muted-foreground">can add customers</span>
                  ) : null}
                  {canAssignRoles && a.role ? (
                    <span className="ml-2 text-xs text-muted-foreground">{a.role}</span>
                  ) : canAssignRoles && !a.role ? (
                    <span className="ml-2 text-xs text-warning">needs role</span>
                  ) : null}
                </p>
                <p className="truncate text-sm text-muted-foreground">{a.email ?? "No email"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canAssignRoles ? (
                  <RolePicker
                    value={a.role}
                    disabled={setRole.isPending}
                    onChange={(role) => setRole.mutate({ userId: a.userId, role })}
                  />
                ) : null}
                {!a.isAdmin ? (
                  <>
                    <Button
                      size="sm"
                      variant={a.canAddCustomers ? "ink" : "outline"}
                      disabled={setPerm.isPending}
                      onClick={() =>
                        setPerm.mutate({ userId: a.userId, canAddCustomers: !a.canAddCustomers })
                      }
                    >
                      {a.canAddCustomers ? "Can add customers" : "Allow add customers"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={setApproved.isPending}
                      onClick={() => setApproved.mutate({ userId: a.userId, approved: false })}
                    >
                      Revoke
                    </Button>
                  </>
                ) : null}
              </div>

            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: "sales" | "service" | null;
  onChange: (role: "sales" | "service" | null) => void;
  disabled?: boolean;
}) {
  return (
    <SelectField
      className="h-9 w-36"
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "sales" || v === "service" ? v : null);
      }}
      allowEmpty
      emptyLabel="Needs role"
      aria-label="Role"
    >
      <option value="sales">Sales</option>
      <option value="service">Service</option>
    </SelectField>
  );
}

function InviteRow({
  inv,
  origin,
  onRevoke,
  revoking,
}: {
  inv: DeskInvite;
  origin: string;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const body = inviteBody(inv, origin);
  const mailto = inv.email
    ? `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent("You're invited to Katz Desk")}&body=${encodeURIComponent(body)}`
    : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium">{inv.username || inv.email || "Invite"}</p>
        <p className="truncate text-sm text-muted-foreground">
          {[inv.email, inv.username && inv.email ? `@${inv.username}` : null]
            .filter(Boolean)
            .join(" · ") || "No email"}
          {` · from ${inv.invitedBy}`}
          {inv.canAddCustomers ? " · can add customers" : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void copyText(body)}>
          Copy invite
        </Button>
        {mailto ? (
          <Button size="sm" variant="outline" asChild>
            <a href={mailto}>Email them</a>
          </Button>
        ) : null}
        <Button size="sm" variant="outline" disabled={revoking} onClick={onRevoke}>
          Revoke
        </Button>
      </div>
    </li>
  );
}