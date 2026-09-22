import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  addProviderAddress,
  addProviderContact,
  removeProviderAddress,
  removeProviderContact,
} from "@/lib/ops/network-api";
import {
  findDuplicateAddress,
  findDuplicateContact,
  formatAddress,
  formatContact,
  US_STATE_OPTIONS,
  type AddressDraft,
  type ContactDraft,
  type ProviderAddress,
  type ProviderContact,
} from "@/lib/ops/network";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { cn } from "@/lib/utils";

type Person = ProviderContact | (ContactDraft & { id: number });
type Place = ProviderAddress | (AddressDraft & { id: number });

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["provider"] });
  void qc.invalidateQueries({ queryKey: ["network"] });
}

export function PeopleEditor({
  providerId,
  people,
  onDraftChange,
}: {
  providerId: number | null;
  people: Person[];
  onDraftChange?: (next: Person[]) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [hit, setHit] = useState<number | null>(null);

  const addMut = useMutation({
    mutationFn: () =>
      addProviderContact({
        data: { providerId: providerId!, name: name || null, role: null, phone: phone || null, email: email || null },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        setNote(res.message);
        setHit(res.existing.id);
        return;
      }
      setNote(null);
      setHit(null);
      setName("");
      setPhone("");
      setEmail("");
      invalidate(qc);
    },
  });

  const dropMut = useMutation({
    mutationFn: (id: number) => removeProviderContact({ data: { id } }),
    onSuccess: () => invalidate(qc),
  });

  function add() {
    const draft = { name: name.trim() || null, role: null, phone: phone.trim() || null, email: email.trim() || null };
    if (!draft.name && !draft.phone && !draft.email) return;
    if (providerId) {
      addMut.mutate();
      return;
    }
    const dup = findDuplicateContact(people, draft);
    if (dup) {
      setNote(`Already listed — ${formatContact(dup)}.`);
      setHit(dup.id);
      return;
    }
    onDraftChange?.([...people, { id: -Date.now(), ...draft }]);
    setNote(null);
    setHit(null);
    setName("");
    setPhone("");
    setEmail("");
  }

  return (
    <fieldset>
      <legend className="mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Contacts{people.length ? ` · ${people.length}` : ""}
      </legend>
      {people.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {people.map((p) => (
            <li
              key={p.id}
              className={cn(
                "flex items-start gap-2 px-3 py-2 text-sm",
                hit === p.id && "bg-warning/15",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">{p.name || "Unnamed"}</span>
                {p.role ? <span className="text-muted-foreground"> · {p.role}</span> : null}
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {[p.phone, p.email].filter(Boolean).join(" · ") || "No phone or email"}
                </span>
              </span>
              <button
                type="button"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (providerId && p.id > 0) dropMut.mutate(p.id);
                  else onDraftChange?.(people.filter((x) => x.id !== p.id));
                  if (hit === p.id) {
                    setHit(null);
                    setNote(null);
                  }
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? (
        <p className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">{note}</p>
      ) : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]">
        <div>
          <Label htmlFor="ppl-name" className="sr-only">Name</Label>
          <Input
            id="ppl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <div>
          <Label htmlFor="ppl-phone" className="sr-only">Phone</Label>
          <Input
            id="ppl-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <div>
          <Label htmlFor="ppl-email" className="sr-only">Email</Label>
          <Input
            id="ppl-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button type="button" size="sm" disabled={addMut.isPending || (!name && !phone && !email)} onClick={add}>
          Add
        </Button>
      </div>
    </fieldset>
  );
}

export function AddressEditor({
  providerId,
  addresses,
  onDraftChange,
}: {
  providerId: number | null;
  addresses: Place[];
  onDraftChange?: (next: Place[]) => void;
}) {
  const qc = useQueryClient();
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [hit, setHit] = useState<number | null>(null);

  const addMut = useMutation({
    mutationFn: () =>
      addProviderAddress({
        data: {
          providerId: providerId!,
          label: null,
          line1: line1 || null,
          line2: null,
          city: city || null,
          state: state || null,
          zip: zip || null,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        setNote(res.message);
        setHit(res.existing.id);
        return;
      }
      setNote(null);
      setHit(null);
      setLine1("");
      setCity("");
      setState("");
      setZip("");
      invalidate(qc);
    },
  });

  const dropMut = useMutation({
    mutationFn: (id: number) => removeProviderAddress({ data: { id } }),
    onSuccess: () => invalidate(qc),
  });

  function add() {
    const draft = {
      label: null,
      line1: line1.trim() || null,
      line2: null,
      city: city.trim() || null,
      state: state || null,
      zip: zip.trim() || null,
    };
    if (!draft.line1 && !draft.city) return;
    if (providerId) {
      addMut.mutate();
      return;
    }
    const dup = findDuplicateAddress(addresses, draft);
    if (dup) {
      setNote(`Already listed — ${formatAddress(dup)}.`);
      setHit(dup.id);
      return;
    }
    onDraftChange?.([...addresses, { id: -Date.now(), ...draft }]);
    setNote(null);
    setHit(null);
    setLine1("");
    setCity("");
    setState("");
    setZip("");
  }

  return (
    <fieldset>
      <legend className="mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Addresses{addresses.length ? ` · ${addresses.length}` : ""}
      </legend>
      {addresses.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {addresses.map((a) => (
            <li
              key={a.id}
              className={cn(
                "flex items-start gap-2 px-3 py-2 text-sm",
                hit === a.id && "bg-warning/15",
              )}
            >
              <span className="min-w-0 flex-1">{formatAddress(a) || "Incomplete address"}</span>
              <button
                type="button"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  if (providerId && a.id > 0) dropMut.mutate(a.id);
                  else onDraftChange?.(addresses.filter((x) => x.id !== a.id));
                  if (hit === a.id) {
                    setHit(null);
                    setNote(null);
                  }
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? (
        <p className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">{note}</p>
      ) : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-[1.4fr_1fr_5.5rem_6rem_auto]">
        <div>
          <Label htmlFor="addr-line" className="sr-only">Street</Label>
          <Input
            id="addr-line"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="Street"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <div>
          <Label htmlFor="addr-city" className="sr-only">City</Label>
          <Input
            id="addr-city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <div>
          <Label htmlFor="addr-state" className="sr-only">State</Label>
          <SelectField id="addr-state" value={state} onChange={(e) => setState(e.target.value)} allowEmpty emptyLabel="ST">
            {US_STATE_OPTIONS.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code}
              </option>
            ))}
          </SelectField>
        </div>
        <div>
          <Label htmlFor="addr-zip" className="sr-only">ZIP</Label>
          <Input
            id="addr-zip"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="ZIP"
            inputMode="numeric"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </div>
        <Button type="button" size="sm" disabled={addMut.isPending || (!line1 && !city)} onClick={add}>
          Add
        </Button>
      </div>
    </fieldset>
  );
}
