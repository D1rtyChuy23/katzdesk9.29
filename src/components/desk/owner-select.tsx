import { useQuery } from "@tanstack/react-query";
import { listRebuildOwners } from "@/lib/ops/rebuilds";
import { sameTech } from "@/lib/ops/tech-match";
import { SelectField } from "@/components/ui/select-field";
import { Label } from "@/components/ui/input";

export function OwnerSelect({
  value,
  onChange,
  label = "Owner",
  id,
  name,
  allowEmpty = true,
  emptyLabel = "—",
  className,
  testId = "rebuild-owner",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  id?: string;
  name?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  testId?: string;
}) {
  const q = useQuery({ queryKey: ["rebuild-owners"], queryFn: () => listRebuildOwners() });
  const names = q.data ?? [];
  const current = value.trim();
  const rosterHit = current ? names.find((n) => sameTech(n, current)) : undefined;
  const extra = current && !rosterHit ? [current] : [];
  const shown = rosterHit ?? current;
  return (
    <div className={className}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <SelectField
        id={id}
        name={name}
        data-testid={testId}
        className={label ? "mt-1" : undefined}
        value={shown}
        onChange={(e) => onChange(e.target.value)}
        allowEmpty={allowEmpty}
        emptyLabel={emptyLabel}
      >
        {extra.map((n) => (
          <option key={`extra-${n}`} value={n}>
            {n}
          </option>
        ))}
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

export function OwnerFilter({
  value,
  onChange,
  className,
  emptyLabel = "All techs",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  emptyLabel?: string;
}) {
  return (
    <OwnerSelect
      label=""
      value={value}
      onChange={onChange}
      allowEmpty
      emptyLabel={emptyLabel}
      className={className}
      testId="rebuild-owner-filter"
    />
  );
}
