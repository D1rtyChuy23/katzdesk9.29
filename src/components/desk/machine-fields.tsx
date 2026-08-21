import { Input, Label } from "@/components/ui/input";
import type { MachineSpec } from "@/lib/ops/machines";

export function MachineFields({
  specs,
  onChange,
}: {
  specs: MachineSpec[];
  onChange: (next: MachineSpec[]) => void;
}) {
  if (!specs.length) return null;
  return (
    <div className="space-y-3">
      {specs.map((spec, index) => (
        <fieldset
          key={`${spec.equipment}-${index}`}
          className="rounded-xl border border-border bg-background px-3 py-3"
        >
          <legend className="px-1 text-sm font-medium">{spec.equipment}</legend>
          <p className="text-xs text-muted-foreground">
            Serial and power for this machine only — not shared with the others on this install.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`sn-${index}`}>Serial number — {spec.equipment}</Label>
              <Input
                id={`sn-${index}`}
                className="mt-1"
                value={spec.serial}
                autoComplete="off"
                placeholder="Type the serial"
                onChange={(e) => {
                  const next = specs.map((s, i) => (i === index ? { ...s, serial: e.target.value } : s));
                  onChange(next);
                }}
              />
            </div>
            <div>
              <Label htmlFor={`pwr-${index}`}>Power / voltage — {spec.equipment}</Label>
              <Input
                id={`pwr-${index}`}
                className="mt-1"
                value={spec.powerVoltage}
                autoComplete="off"
                placeholder="e.g. 208V / 1-phase / 30A"
                onChange={(e) => {
                  const next = specs.map((s, i) =>
                    i === index ? { ...s, powerVoltage: e.target.value } : s,
                  );
                  onChange(next);
                }}
              />
            </div>
          </div>
        </fieldset>
      ))}
    </div>
  );
}
