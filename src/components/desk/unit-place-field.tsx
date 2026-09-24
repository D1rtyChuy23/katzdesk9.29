import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lookupUnitPlace, setAssetPlace, setUnitPlace } from "@/lib/ops/unit-place";
import { BACK_PALLETS, LEVELS } from "@/lib/ops/warehouse";
import { PLACE_CHOICES, placeDraftError } from "@/lib/ops/unit-place-rules";
import { serialKey } from "@/lib/ops/account-equip";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type PlaceDraft = { site: string; pallet: string; level: string; otherLabel: string };

export const emptyPlaceDraft = (): PlaceDraft => ({ site: "", pallet: "", level: "", otherLabel: "" });

export function PlacePicker({
  value,
  onChange,
  testId = "unit-place",
}: {
  value: PlaceDraft;
  onChange: (next: PlaceDraft) => void;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="flex flex-wrap items-end gap-2">
      <SelectField
        aria-label="Location"
        className="min-w-40"
        value={value.site}
        onChange={(e) => onChange({ site: e.target.value, pallet: "", level: "", otherLabel: "" })}
      >
        <option value="">Location</option>
        {PLACE_CHOICES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </SelectField>
      {value.site === "barn" ? (
        <>
        <SelectField
          aria-label="Barn bay"
          data-testid="unit-place-bay"
          className="w-24"
          value={value.pallet}
          onChange={(e) => onChange({ ...value, pallet: e.target.value })}
        >
          <option value="">Bay</option>
          {BACK_PALLETS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectField>
        <SelectField
          aria-label="Barn level"
          data-testid="unit-place-level"
          className="w-28"
          value={value.level}
          onChange={(e) => onChange({ ...value, level: e.target.value })}
        >
          <option value="">Level</option>
          {LEVELS.map((level) => (
            <option key={level} value={String(level)}>
              L{level}
              {level === 4 ? " top" : level === 1 ? " floor" : ""}
            </option>
          ))}
        </SelectField>
        </>
      ) : null}
      {value.site === "other" ? (
        <Input
          aria-label="Other location"
          data-testid="unit-place-other"
          className="max-w-48"
          value={value.otherLabel}
          placeholder="showroom, parts cage…"
          onChange={(e) => onChange({ ...value, otherLabel: e.target.value })}
        />
      ) : null}
    </div>
  );
}

export function UnitPlaceField({
  serial,
  model,
  assetId,
  draft,
  onDraft,
}: {
  serial?: string;
  model?: string | null;
  assetId?: number;
  draft?: PlaceDraft;
  onDraft?: (next: PlaceDraft) => void;
}) {
  const qc = useQueryClient();
  const key = serialKey(serial ?? "");
  const lookup = useQuery({
    queryKey: ["unit-place", key],
    queryFn: () => lookupUnitPlace({ data: { serial: serial ?? "" } }),
    enabled: !!key,
  });
  const [local, setLocal] = useState<PlaceDraft>(emptyPlaceDraft());
  const value = draft ?? local;
  function setValue(next: PlaceDraft) {
    if (onDraft) onDraft(next);
    else setLocal(next);
  }
  const save = useMutation({
    mutationFn: () => {
      const err = placeDraftError(value);
      if (err) throw new Error(err);
      if (assetId) {
        return setAssetPlace({
          data: {
            id: assetId,
            site: value.site,
            pallet: value.pallet || null,
            level: value.level ? Number(value.level) : null,
            otherLabel: value.otherLabel || null,
          },
        });
      }
      return setUnitPlace({
        data: {
          serial: serial ?? "",
          model: model ?? null,
          site: value.site,
          pallet: value.site === "barn" ? value.pallet : null,
          level: value.site === "barn" && value.level ? Number(value.level) : null,
          otherLabel: value.site === "other" ? value.otherLabel : null,
        },
      });
    },
    onSuccess: (place) => {
      toast.success(place.place ? `Place set · ${place.place}` : "Place set");
      setValue(emptyPlaceDraft());
      void qc.invalidateQueries({ queryKey: ["unit-place"] });
      void qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not set location"),
  });
  const bound = !!onDraft;

  return (
    <div>
      <Label>Location</Label>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="unit-place-current">
        {assetId && !key
          ? "Set where this unit sits"
          : key
            ? lookup.data?.place
              ? `Now: ${lookup.data.place}`
              : lookup.isLoading
                ? "Checking…"
                : "Not in the barn or on a location yet"
            : "Enter a serial to set one location for this unit"}
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <PlacePicker value={value} onChange={setValue} />
        {bound ? null : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!!placeDraftError(value) || (!key && !assetId) || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Set location"}
          </Button>
        )}
      </div>
    </div>
  );
}
