import { Input, Label } from "@/components/ui/input";
import type { MachineSpec } from "@/lib/ops/machines";
import type { SerialPullResult } from "@/lib/ops/serial-pull";
import { SerialPullField } from "./serial-notice";

export function MachineFields({
  specs,
  onChange,
  installId,
  onPulled,
}: {
  specs: MachineSpec[];
  onChange: (next: MachineSpec[]) => void;
  installId?: number;
  onPulled?: (next: MachineSpec[], result: SerialPullResult) => void;
}) {
  if (!specs.length) return null;

  function patch(index: number, part: Partial<MachineSpec>): MachineSpec[] {
    return specs.map((s, i) => (i === index ? { ...s, ...part } : s));
  }

  return (
    <div className="space-y-3">
      {specs.map((spec, index) => (
        <fieldset
          key={`${spec.equipment}-${index}`}
          className="rounded-xl border border-border bg-background px-3 py-3"
        >
          <legend className="px-1 text-sm font-medium">{spec.equipment}</legend>
          <p className="text-xs text-muted-foreground">
            Type a warehouse serial to pull the unit onto this account in one step.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <SerialPullField
              label={`Serial number — ${spec.equipment}`}
              value={spec.serial}
              installId={installId}
              machineIndex={index}
              onValue={(serial) => onChange(patch(index, { serial }))}
              onPulled={(result) => {
                const next = patch(index, {
                  serial: result.serial,
                  powerVoltage: spec.powerVoltage || result.powerVoltage || "",
                });
                onChange(next);
                onPulled?.(next, result);
              }}
            />
            <div>
              <Label htmlFor={`pwr-${index}`}>Power / voltage — {spec.equipment}</Label>
              <Input
                id={`pwr-${index}`}
                className="mt-1"
                value={spec.powerVoltage}
                autoComplete="off"
                placeholder="e.g. 208V / 1-phase / 30A"
                onChange={(e) => onChange(patch(index, { powerVoltage: e.target.value }))}
              />
            </div>
          </div>
        </fieldset>
      ))}
    </div>
  );
}
