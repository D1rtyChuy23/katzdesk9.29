import { useQuery } from "@tanstack/react-query";
import { listRebuildOwners } from "@/lib/ops/rebuilds";
import { SelectField } from "@/components/ui/select-field";
import { Label } from "@/components/ui/input";

export function OwnerSelect({
  value,
  onChange,
  label = "Owner",
  id,
  name,
  allowEmpty = true,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  id?: string;
  name?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const q = useQuery({ queryKey: ["rebuild-owners"], queryFn: () => listRebuildOwners() });
  const names = q.data ?? [];
  const current = value.trim();
  const extra = current && !names.some((n) => n.toLowerCase() === current.toLowerCase()) ? [current] : [];
  return (
    <div className={className}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <SelectField
        id={id}
        name={name}
        className={label ? "mt-1" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        allowEmpty={allowEmpty}
        emptyLabel="—"
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
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <OwnerSelect
      label=""
      value={value}
      onChange={onChange}
      allowEmpty
      className={className}
    />
  );
}
