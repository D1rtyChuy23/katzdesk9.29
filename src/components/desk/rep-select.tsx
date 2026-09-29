import { useQuery } from "@tanstack/react-query";
import { listReps, formatRep, isNoRep, type DeskRep } from "@/lib/ops/reps";
import { SelectField } from "@/components/ui/select-field";
import { Label } from "@/components/ui/input";
import { NoRepFlag } from "./ak-badge";
import { cn } from "@/lib/utils";

function useReps() {
  return useQuery({ queryKey: ["reps"], queryFn: () => listReps() });
}

function activeReps(reps: DeskRep[] | undefined, current?: string | null): DeskRep[] {
  const list = reps ?? [];
  const active = list.filter((r) => r.active);
  const cur = (current ?? "").trim();
  if (cur && !active.some((r) => r.name === cur) && !list.some((r) => r.name === cur && r.active)) {
    const leftover = list.find((r) => r.name === cur);
    if (leftover) return [...active, leftover];
  }
  return active;
}

export function RepSelect({
  name = "producer",
  value,
  defaultValue,
  onChange,
  label = "Rep",
  id,
  className,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  label?: string;
  id?: string;
  className?: string;
}) {
  const q = useReps();
  const current = value ?? defaultValue ?? "";
  const reps = activeReps(q.data?.reps, current);
  const unknown = !!current && isNoRep(current);
  const selected = unknown ? current : current;
  return (
    <div className={className}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <SelectField
        // Remount once the rep list arrives: an uncontrolled select can't pick a default whose option wasn't there yet.
        key={value == null ? `${q.data ? "ready" : "loading"}:${defaultValue ?? ""}` : undefined}
        id={id}
        name={name}
        className={label ? "mt-1" : undefined}
        value={value}
        defaultValue={value == null ? defaultValue ?? "" : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        allowEmpty
        emptyLabel="—"
      >
        {unknown ? <option value={current}>{current} (unknown)</option> : null}
        {reps.map((r) => (
          <option key={r.id} value={r.name}>
            {r.name} ({r.initials})
          </option>
        ))}
      </SelectField>
      <NoRepFlag show={isNoRep(selected)} className="mt-1 block" />
    </div>
  );
}

export function RepFilter({
  value,
  onChange,
  extraNames,
  className,
  includeNone = true,
}: {
  value: string;
  onChange: (v: string) => void;
  extraNames?: (string | null | undefined)[];
  className?: string;
  includeNone?: boolean;
}) {
  const q = useReps();
  const names = new Map<string, string>();
  for (const r of q.data?.reps ?? []) {
    if (r.active) names.set(r.name, `${r.name} (${r.initials})`);
  }
  for (const n of extraNames ?? []) {
    const s = (n ?? "").trim();
    if (s && !names.has(s)) names.set(s, isNoRep(s) ? `${s} (unknown)` : formatRep(s));
  }
  return (
    <SelectField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      allowEmpty
      emptyLabel="All reps"
      className={cn("max-w-xs", className)}
      aria-label="Filter by rep"
    >
      {includeNone ? <option value="__none__">No rep assigned</option> : null}
      {[...names.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, label]) => (
          <option key={name} value={name}>
            {label}
          </option>
        ))}
    </SelectField>
  );
}

export function RepName({ name }: { name: string | null | undefined }) {
  if (!name?.trim()) return <NoRepFlag show />;
  if (isNoRep(name)) {
    return (
      <span>
        {name} <NoRepFlag show className="ml-1" />
      </span>
    );
  }
  return <span>{formatRep(name)}</span>;
}
