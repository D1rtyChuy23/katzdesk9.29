import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { listTechs, serviceTechs, techLabel, type DeskTech } from "@/lib/ops/roster";
import { DEFAULT_TECHS, sameTech } from "@/lib/ops/tech-match";
import { SelectField } from "@/components/ui/select-field";

export function useRoster() {
  return useQuery({
    queryKey: ["roster"],
    queryFn: () => listTechs(),
    staleTime: 30_000,
  });
}

/** The names a service call, TLC, PM or install can go to: active, and not on rebuilds only (11/3). */
export function activeTechNames(techs?: DeskTech[] | null): string[] {
  if (techs?.length) return serviceTechs(techs).map((t) => t.name);
  return [...DEFAULT_TECHS];
}

/** Every active tech's name, a rebuild-only one too: a name shown anywhere reads as active, not "(inactive)". */
export function knownTechNames(techs?: DeskTech[] | null): string[] {
  if (techs?.length) return techs.filter((t) => t.active).map((t) => t.name);
  return [...DEFAULT_TECHS];
}

export function TechName({ name }: { name?: string | null }) {
  const roster = useRoster();
  if (!name) return <>{"—"}</>;
  const active = knownTechNames(roster.data?.techs);
  const match = active.find((n) => sameTech(n, name));
  if (match) return <>{match}</>;
  return (
    <>
      {name} <span className="text-xs text-muted-foreground">(inactive)</span>
    </>
  );
}

export function TechSelect({
  name,
  defaultValue,
  value,
  onChange,
  allowEmpty = true,
  className,
  id,
}: {
  name?: string;
  defaultValue?: string | null;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  allowEmpty?: boolean;
  className?: string;
  id?: string;
}) {
  const roster = useRoster();
  const techs = roster.data?.techs ?? [];
  const active = activeTechNames(techs);
  const current = (value ?? defaultValue ?? "") || "";
  const mapped = active.find((n) => sameTech(n, current)) ?? current;
  const extras = current && !active.some((n) => sameTech(n, current)) ? [current] : [];

  return (
    <SelectField
      id={id}
      name={name}
      className={className ?? "mt-1"}
      defaultValue={value == null ? mapped : undefined}
      value={value == null ? undefined : mapped}
      onChange={onChange}
      allowEmpty={allowEmpty}
      emptyLabel="—"
    >
      {extras.map((n) => (
        <option key={`inactive-${n}`} value={n}>
          {techLabel(n, new Set(active))}
        </option>
      ))}
      {active.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </SelectField>
  );
}

export function TechFilter({
  value,
  onChange,
  extraNames,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  extraNames?: (string | null | undefined)[];
  className?: string;
}) {
  const roster = useRoster();
  const techs = roster.data?.techs ?? [];
  const active = activeTechNames(techs);
  const leftover: string[] = [];
  for (const raw of extraNames ?? []) {
    const n = (raw ?? "").trim();
    if (!n) continue;
    if (active.some((a) => sameTech(a, n)) || leftover.some((a) => sameTech(a, n))) continue;
    leftover.push(n);
  }
  return (
    <SelectField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      allowEmpty
      emptyLabel="All techs"
      className={className ?? "w-40 min-w-0"}
      aria-label="Filter by technician"
    >
      {active.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
      {leftover.map((n) => (
        <option key={`in-${n}`} value={n}>
          {n} (inactive)
        </option>
      ))}
    </SelectField>
  );
}
