import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  addTech,
  listRosterCandidates,
  listTechs,
  setRosterAdmin,
  setTechActive,
} from "@/lib/ops/roster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { toast } from "sonner";

export function RosterEditor() {
  const qc = useQueryClient();
  const roster = useQuery({ queryKey: ["roster"], queryFn: () => listTechs() });
  const candidates = useQuery({
    queryKey: ["roster-candidates"],
    queryFn: () => listRosterCandidates(),
    enabled: !!roster.data?.canEdit && !roster.data?.ownerLocked,
  });
  const [name, setName] = useState("");

  const add = useMutation({
    mutationFn: () => addTech({ data: { name } }),
    onSuccess: (next) => {
      setName("");
      qc.setQueryData(["roster"], next);
      toast.success(`${name.trim()} is on the roster`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });
  const toggle = useMutation({
    mutationFn: (p: { id: number; active: boolean; name: string }) =>
      setTechActive({ data: { id: p.id, active: p.active } }),
    onSuccess: (next, p) => {
      qc.setQueryData(["roster"], next);
      toast.success(p.active ? `${p.name} is active` : `${p.name} removed from assign lists`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });
  const admin = useMutation({
    mutationFn: (userId: string) => setRosterAdmin({ data: { userId } }),
    onSuccess: (next) => {
      qc.setQueryData(["roster"], next);
      toast.success("Roster admin updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change admin"),
  });

  if (!roster.data?.canEdit) return null;
  const techs = roster.data.techs;
  const active = techs.filter((t) => t.active);
  const inactive = techs.filter((t) => !t.active);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-medium tracking-tight">Service tech roster</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Only you can add or remove names. Tickets keep their current tech until you reassign them.
        Inactive names stay on history as “(inactive)” — they are not in assign lists.
        {roster.data.ownerLocked
          ? " This lock stays on the desk owner account."
          : roster.data.rosterAdminUsername
            ? ` Roster admin: ${roster.data.rosterAdminUsername}.`
            : ""}
      </p>

      <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
        {active.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm font-medium">{t.name}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: t.id, active: false, name: t.name })}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          add.mutate();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add a technician…"
          className="max-w-xs"
          aria-label="New technician name"
        />
        <Button type="submit" disabled={add.isPending || !name.trim()}>
          Add
        </Button>
      </form>

      {inactive.length ? (
        <div className="mt-5">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Inactive</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Still shows on tickets already assigned. Not in assign lists.
          </p>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
            {inactive.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm text-muted-foreground">{t.name} (inactive)</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: t.id, active: true, name: t.name })}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!roster.data.ownerLocked && (candidates.data?.length ?? 0) > 0 ? (
        <div className="mt-5">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Roster admin</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Exactly one person can edit tech names. Other users cannot change this.
          </p>
          <SelectField
            className="mt-2 max-w-xs"
            value={
              candidates.data?.find((c) => c.username === roster.data?.rosterAdminUsername)?.userId ??
              ""
            }
            onChange={(e) => {
              if (e.target.value) admin.mutate(e.target.value);
            }}
            aria-label="Roster admin"
          >
            {(candidates.data ?? []).map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.username}
              </option>
            ))}
          </SelectField>
        </div>
      ) : null}
    </section>
  );
}
