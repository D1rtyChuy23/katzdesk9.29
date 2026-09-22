import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addProviderLocation, removeProviderLocation } from "@/lib/ops/network-api";
import {
  duplicateNote,
  findDuplicateLocation,
  formatLocation,
  groupLocations,
  locationKey,
  normalizeCity,
  splitZips,
  US_STATE_OPTIONS,
  type LocationDraft,
  type ProviderLocation,
} from "@/lib/ops/network";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

type Loc = ProviderLocation | (LocationDraft & { id: number });

export function LocationsEditor({
  providerId,
  locations,
  onDraftChange,
}: {
  providerId: number | null;
  locations: Loc[];
  onDraftChange?: (next: Loc[]) => void;
}) {
  const qc = useQueryClient();
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const addMut = useMutation({
    mutationFn: () =>
      addProviderLocation({
        data: { providerId: providerId!, state, city: city || null, zip: zip || null },
      }),
    onSuccess: (res) => {
      if (res.duplicates.length && !res.added.length) {
        const first = res.duplicates[0]!;
        setNote(first.message);
        setHighlight(locationKey(first.existing.state, first.existing.city, first.existing.zip));
      } else if (res.duplicates.length) {
        setNote(
          `Added ${res.added.length}. ${res.duplicates.map((d) => d.message.replace(/^Already listed — /, "")).join("; ")} already listed.`,
        );
        setHighlight(locationKey(res.duplicates[0]!.existing.state, res.duplicates[0]!.existing.city, res.duplicates[0]!.existing.zip));
        setCity("");
        setZip("");
        void qc.invalidateQueries({ queryKey: ["provider"] });
        void qc.invalidateQueries({ queryKey: ["network"] });
      } else {
        setNote(null);
        setHighlight(null);
        setCity("");
        setZip("");
        void qc.invalidateQueries({ queryKey: ["provider"] });
        void qc.invalidateQueries({ queryKey: ["network"] });
      }
    },
  });

  const dropMut = useMutation({
    mutationFn: (id: number) => removeProviderLocation({ data: { id } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["provider"] });
      void qc.invalidateQueries({ queryKey: ["network"] });
    },
  });

  function addLocal() {
    if (!state) return;
    if (providerId) {
      addMut.mutate();
      return;
    }
    const nextCity = normalizeCity(city);
    const zips = splitZips(zip);
    const parts = zips.length ? zips : [null];
    let dup: Loc | null = null;
    const next = [...locations];
    let added = 0;
    for (const z of parts) {
      const draft = { state, city: nextCity, zip: z };
      const hit = findDuplicateLocation(next, draft);
      if (hit) {
        dup = hit;
        continue;
      }
      next.push({ id: -Date.now() - added, ...draft });
      added += 1;
    }
    onDraftChange?.(next);
    if (dup && !added) {
      setNote(duplicateNote(dup));
      setHighlight(locationKey(dup.state, dup.city ?? null, dup.zip ?? null));
    } else if (dup) {
      setNote(`Added ${added}. ${formatLocation(dup)} already listed.`);
      setHighlight(locationKey(dup.state, dup.city ?? null, dup.zip ?? null));
      setCity("");
      setZip("");
    } else {
      setNote(null);
      setHighlight(null);
      setCity("");
      setZip("");
    }
  }

  const groups = groupLocations(locations);

  return (
    <fieldset>
      <legend className="mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Coverage
      </legend>
      <p className="text-xs text-muted-foreground">
        Add every state, city, and ZIP this company covers. Duplicates stay off the list.
      </p>

      {groups.length ? (
        <div className="mt-3 space-y-3">
          {groups.map((g) => (
            <div key={g.state}>
              <p className="text-xs font-medium tracking-wide text-muted-foreground">{g.state}</p>
              <ul className="mt-1 divide-y divide-border rounded-lg border border-border">
                {g.rows.map((row) => {
                  const key = locationKey(row.state, row.city ?? null, row.zip ?? null);
                  const label = row.city || row.zip
                    ? [row.city, row.zip].filter(Boolean).join(" · ")
                    : "Statewide";
                  return (
                    <li
                      key={row.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-sm",
                        highlight === key && "bg-warning/15",
                      )}
                    >
                      <span className="min-w-0 flex-1">{label}</span>
                      <button
                        type="button"
                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                        aria-label={`Remove ${formatLocation(row)}`}
                        onClick={() => {
                          if (providerId && row.id > 0) dropMut.mutate(row.id);
                          else onDraftChange?.(locations.filter((l) => l.id !== row.id));
                          if (highlight === key) {
                            setHighlight(null);
                            setNote(null);
                          }
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No locations yet.</p>
      )}

      {note ? (
        <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          {note}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-[7rem_1fr_6.5rem_auto]">
        <div>
          <Label htmlFor="loc-state" className="sr-only">State</Label>
          <SelectField
            id="loc-state"
            value={state}
            onChange={(e) => setState(e.target.value)}
            allowEmpty
            emptyLabel="State"
          >
            {US_STATE_OPTIONS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}
              </option>
            ))}
          </SelectField>
        </div>
        <div>
          <Label htmlFor="loc-city" className="sr-only">City</Label>
          <Input
            id="loc-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLocal();
              }
            }}
          />
        </div>
        <div>
          <Label htmlFor="loc-zip" className="sr-only">ZIP</Label>
          <Input
            id="loc-zip"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="ZIP"
            inputMode="numeric"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addLocal();
              }
            }}
          />
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!state || addMut.isPending}
          onClick={() => addLocal()}
        >
          Add
        </Button>
      </div>
    </fieldset>
  );
}
