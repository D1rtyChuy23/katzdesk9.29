import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addRep, listReps, setRepActive } from "@/lib/ops/reps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function RepsEditor() {
  const qc = useQueryClient();
  const reps = useQuery({ queryKey: ["reps"], queryFn: () => listReps() });
  const [name, setName] = useState("");
  const [initials, setInitials] = useState("");
  const add = useMutation({
    mutationFn: () => addRep({ data: { name, initials } }),
    onSuccess: (next) => {
      setName("");
      setInitials("");
      qc.setQueryData(["reps"], next);
      toast.success(`${name.trim()} is on the rep list`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });
  const toggle = useMutation({
    mutationFn: (p: { id: number; active: boolean; name: string }) =>
      setRepActive({ data: { id: p.id, active: p.active } }),
    onSuccess: (next, p) => {
      qc.setQueryData(["reps"], next);
      toast.success(p.active ? `${p.name} is active` : `${p.name} hidden from the dropdown`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  if (!reps.data?.canEdit) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Sales Reps</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Dropdown-only list. Same lock as the service-tech roster — only you can add or remove names.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {(reps.data.reps ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 py-2">
            <span className={r.active ? "text-sm" : "text-sm text-muted-foreground"}>
              {r.name} ({r.initials})
              {!r.active ? " · hidden" : ""}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: r.id, active: !r.active, name: r.name })}
            >
              {r.active ? "Remove" : "Restore"}
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-48" />
        <Input value={initials} onChange={(e) => setInitials(e.target.value)} placeholder="IN" className="w-20" />
        <Button type="submit" size="sm" disabled={add.isPending || name.trim().length < 2}>
          Add rep
        </Button>
      </form>
    </section>
  );
}
