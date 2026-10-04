import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lookupUnitPlace, setAssetPlace, setUnitPlace } from "@/lib/ops/unit-place";
import { LEVELS, palletsFor, rackBayError } from "@/lib/ops/warehouse";
import { Lock } from "lucide-react";
import { PLACE_CHOICES, isRackPlace, placeDraftError, placeMove } from "@/lib/ops/unit-place-rules";
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
  compact = false,
}: {
  value: PlaceDraft;
  onChange: (next: PlaceDraft) => void;
  testId?: string;
  compact?: boolean;
}) {
  const rack = isRackPlace(value.site);
  const rackClass = compact ? "w-[6.5rem] px-2" : "min-w-40";
  // On a one-line machine row the picker sits under "Location"; each list names itself (Choose / Bay / Level).
  const caption = compact ? "sr-only" : undefined;
  const labelClass = "grid gap-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase";
  return (
    <div data-testid={testId} className={compact ? "flex flex-wrap items-end gap-1 lg:flex-nowrap" : "flex flex-wrap items-end gap-2"}>
      <label className={labelClass}>
        <span className={caption}>Rack</span>
        <SelectField
          aria-label="Rack"
          data-testid={`${testId}-rack`}
          className={rackClass}
          value={value.site}
          onChange={(e) => {
            const site = e.target.value;
            const nextRack = isRackPlace(site);
            const keepSlot = rack && nextRack;
            onChange({
              site,
              // The Front rack only has bays I–P: a Back rack bay A–H doesn't carry over.
              pallet: keepSlot && !rackBayError(site, value.pallet) ? value.pallet : "",
              level: keepSlot ? value.level : "",
              otherLabel: "",
            });
          }}
        >
          <option value="">Choose</option>
          {PLACE_CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </SelectField>
      </label>
      {rack ? (
        <>
          <label className={labelClass}>
            <span className={caption}>Bay</span>
            <SelectField
              aria-label="Bay"
              data-testid={`${testId}-bay`}
              className={compact ? "w-[3.25rem] px-1.5" : "w-24"}
              value={value.pallet}
              onChange={(e) => onChange({ ...value, pallet: e.target.value })}
            >
              <option value="">Bay</option>
              {palletsFor(value.site).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </SelectField>
          </label>
          <label className={labelClass}>
            <span className={caption}>Level</span>
            <SelectField
              aria-label="Level"
              data-testid={`${testId}-level`}
              className={compact ? "w-[4.5rem] px-1.5" : "w-28"}
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
          </label>
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
  compact = false,
  status,
  placeLabel,
}: {
  /** Known status and place of the unit, when the caller already has the record. */
  status?: string | null;
  placeLabel?: string | null;
  serial?: string;
  model?: string | null;
  assetId?: number;
  draft?: PlaceDraft;
  onDraft?: (next: PlaceDraft) => void;
  compact?: boolean;
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
          pallet: value.site === "barn-front" || value.site === "barn-back" ? value.pallet : null,
          level: (value.site === "barn-front" || value.site === "barn-back") && value.level ? Number(value.level) : null,
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
  // Assigned to an account or sold: it is an asset at that site or customer, so the place is locked.
  const unitStatus = status ?? (lookup.data?.found ? lookup.data.status : null);
  if (unitStatus && placeMove({ status: unitStatus }) === "blocked") {
    const where = placeLabel ?? lookup.data?.place ?? "an account";
    return (
      <div className={compact ? "col-span-2 min-w-0 lg:col-span-1" : undefined} data-testid="unit-place-locked">
        {compact ? <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Location</p> : <Label>Location</Label>}
        <p className="mt-1 flex items-start gap-1.5 text-sm font-medium">
          <Lock className="mt-0.5 size-3.5 shrink-0 text-copper" aria-hidden="true" />
          <span className="min-w-0 break-words">{where}</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Locked. {unitStatus === "sold" ? "Sold" : "Assigned"} — an asset at that site or customer. Return it to the barn to move it.
        </p>
      </div>
    );
  }
  if (compact) {
    return (
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Location</p>
        <div className="mt-1 flex flex-wrap items-end gap-2">
          <PlacePicker value={value} onChange={setValue} compact />
          {bound ? null : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!!placeDraftError(value) || (!key && !assetId) || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Set"}
            </Button>
          )}
        </div>
      </div>
    );
  }

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
