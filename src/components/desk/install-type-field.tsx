import { useQuery } from "@tanstack/react-query";
import { getInstallTypeGuess } from "@/lib/ops/install-form-api";
import { INSTALL_TYPES, installTypeLabel, type InstallType } from "@/lib/ops/install-form";
import { Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";

/**
 * New account or Update, on the install's Details tab. Saved with the Details form (`installType`). Until one is
 * picked, the blank choice says what the Equipment Request Form shows meanwhile: the account history's suggestion.
 */
export function InstallTypeField({ installId, value }: { installId: number; value: InstallType | null }) {
  const guess = useQuery({
    queryKey: ["install-type-guess", installId],
    queryFn: () => getInstallTypeGuess({ data: { installId } }),
    enabled: !value,
    staleTime: 60_000,
  });
  const suggested = guess.data ? installTypeLabel(guess.data.guess) : "";
  return (
    <div>
      <Label htmlFor={`install-type-${installId}`}>Install type</Label>
      <SelectField
        id={`install-type-${installId}`}
        name="installType"
        className="mt-1"
        defaultValue={value ?? ""}
        allowEmpty
        emptyLabel={suggested ? `Not picked · looks like ${suggested}` : "Not picked"}
        data-testid="install-type"
      >
        {INSTALL_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
