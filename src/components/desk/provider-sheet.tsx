import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { archiveProvider, getProvider, renameProvider, upsertProvider } from "@/lib/ops/network-api";
import { PROVIDER_STATUSES, statusTone, type ProviderDraft } from "@/lib/ops/network";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProviderAccountList } from "./provider-dispatch";
import { LocationsEditor } from "./provider-locations";
import { AddressEditor, PeopleEditor } from "./provider-people";
import { RenameDialog } from "./rename-dialog";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

export function ProviderSheet({
  id,
  creating,
  onClose,
  onCreated,
}: {
  id: number | null;
  creating: boolean;
  onClose: () => void;
  onCreated?: (id: number) => void;
}) {
  const open = creating || id != null;
  const qc = useQueryClient();
  const formRef = useRef<HTMLFormElement>(null);
  const skipToast = useRef(false);
  const row = useQuery({
    queryKey: ["provider", id],
    queryFn: () => getProvider({ data: { id: id! } }),
    enabled: id != null,
  });
  const p = creating ? null : row.data;
  const [draftLocs, setDraftLocs] = useState<{ id: number; state: string; city: string | null; zip: string | null }[]>([]);
  const [draftPeople, setDraftPeople] = useState<{ id: number; name: string | null; role: string | null; phone: string | null; email: string | null }[]>([]);
  const [draftAddresses, setDraftAddresses] = useState<{ id: number; label: string | null; line1: string | null; line2: string | null; city: string | null; state: string | null; zip: string | null }[]>([]);
  const [editingName, setEditingName] = useState(false);
  useEffect(() => {
    if (creating && open) {
      setDraftLocs([]);
      setDraftPeople([]);
      setDraftAddresses([]);
    }
  }, [creating, open]);

  const save = useMutation({
    mutationFn: (d: ProviderDraft) => upsertProvider({ data: d }),
    onSuccess: (saved) => {
      if (!skipToast.current) toast.success(creating ? `Added ${saved.name}` : "Saved");
      skipToast.current = false;
      void qc.invalidateQueries({ queryKey: ["network"] });
      void qc.invalidateQueries({ queryKey: ["provider"] });
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
      if (creating) {
        if (onCreated) onCreated(saved.id);
        else onClose();
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const rename = useMutation({
    mutationFn: (name: string) => renameProvider({ data: { id: id!, name } }),
    onSuccess: (row) => {
      toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
      setEditingName(false);
      void qc.invalidateQueries({ queryKey: ["network"] });
      void qc.invalidateQueries({ queryKey: ["provider"] });
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
      if (row.merged && onCreated) onCreated(row.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename"),
  });
  const remove = useMutation({
    mutationFn: () => archiveProvider({ data: { id: id! } }),
    onSuccess: () => {
      toast.success("Provider removed from the list");
      void qc.invalidateQueries({ queryKey: ["network"] });
      onClose();
    },
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) || "") || null;
    save.mutate({
      id: p?.id,
      name: String(fd.get("name") || ""),
      status: str("status"),
      dispatchPhone: str("dispatchPhone"),
      dispatchEmail: str("dispatchEmail"),
      secondaryPhone: str("secondaryPhone"),
      secondaryEmail: str("secondaryEmail"),
      responseTime: str("responseTime"),
      standardRate: str("standardRate"),
      afterHoursRate: str("afterHoursRate"),
      travelPolicy: str("travelPolicy"),
      equipmentServiced: str("equipmentServiced"),
      pmPricing: str("pmPricing"),
      partsStocking: str("partsStocking"),
      notes: str("notes"),
      locations: creating
        ? draftLocs.map((l) => ({ state: l.state, city: l.city, zip: l.zip }))
        : undefined,
      people: creating
        ? draftPeople.map((p) => ({ name: p.name, role: p.role, phone: p.phone, email: p.email }))
        : undefined,
      addresses: creating
        ? draftAddresses.map((a) => ({
            label: a.label,
            line1: a.line1,
            line2: a.line2,
            city: a.city,
            state: a.state,
            zip: a.zip,
          }))
        : undefined,
    });
  }

  return (
    <>
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          if (!creating) {
            skipToast.current = true;
            formRef.current?.requestSubmit();
          }
          onClose();
        }
      }}
    >
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">3rd-party provider</p>
          <div className="flex items-start justify-between gap-2">
            <SheetTitle>{creating ? "New provider" : p?.name ?? "Provider"}</SheetTitle>
            {!creating && p ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingName(true)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            ) : null}
          </div>
          {p?.status ? (
            <div className="mt-2">
              <Badge variant={statusTone(p.status)}>{p.status}</Badge>
            </div>
          ) : !creating ? (
            <p className="mt-1 text-xs text-warning">Status not confirmed yet.</p>
          ) : null}
        </SheetHeader>
        <SheetBody>
          {id != null && row.isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Loading…</p>
          ) : (
            <form ref={formRef} key={p?.id ?? "new"} className="space-y-5 p-5" onSubmit={onSubmit}>
              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Company
                </legend>
                <div className="sm:col-span-2">
                  <Label htmlFor="name">Provider name</Label>
                  <Input id="name" name="name" className="mt-1" required defaultValue={p?.name ?? ""} />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <SelectField id="status" name="status" className="mt-1" defaultValue={p?.status ?? ""} allowEmpty emptyLabel="Unconfirmed">
                    {PROVIDER_STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </SelectField>
                </div>
              </fieldset>

              <LocationsEditor
                providerId={p?.id ?? null}
                locations={creating ? draftLocs : p?.locations ?? []}
                onDraftChange={creating ? setDraftLocs : undefined}
              />

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Dispatch
                </legend>
                <div>
                  <Label htmlFor="dispatchPhone">Primary phone</Label>
                  <Input id="dispatchPhone" name="dispatchPhone" className="mt-1" defaultValue={p?.dispatchPhone ?? ""} />
                </div>
                <div>
                  <Label htmlFor="dispatchEmail">Primary email</Label>
                  <Input id="dispatchEmail" name="dispatchEmail" className="mt-1" defaultValue={p?.dispatchEmail ?? ""} />
                </div>
                <div>
                  <Label htmlFor="secondaryPhone">Secondary phone</Label>
                  <Input id="secondaryPhone" name="secondaryPhone" className="mt-1" defaultValue={p?.secondaryPhone ?? ""} />
                </div>
                <div>
                  <Label htmlFor="secondaryEmail">Secondary email</Label>
                  <Input id="secondaryEmail" name="secondaryEmail" className="mt-1" defaultValue={p?.secondaryEmail ?? ""} />
                </div>
              </fieldset>

              <PeopleEditor
                providerId={p?.id ?? null}
                people={creating ? draftPeople : p?.people ?? []}
                onDraftChange={creating ? setDraftPeople : undefined}
              />

              <AddressEditor
                providerId={p?.id ?? null}
                addresses={creating ? draftAddresses : p?.addresses ?? []}
                onDraftChange={creating ? setDraftAddresses : undefined}
              />

              <fieldset className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Rates & response
                </legend>
                <div>
                  <Label htmlFor="standardRate">Standard rate</Label>
                  <Input id="standardRate" name="standardRate" className="mt-1" defaultValue={p?.standardRate ?? ""} />
                </div>
                <div>
                  <Label htmlFor="afterHoursRate">After hours</Label>
                  <Input id="afterHoursRate" name="afterHoursRate" className="mt-1" defaultValue={p?.afterHoursRate ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="travelPolicy">Travel policy</Label>
                  <Textarea id="travelPolicy" name="travelPolicy" className="mt-1 min-h-16" defaultValue={p?.travelPolicy ?? ""} />
                </div>
                <div>
                  <Label htmlFor="responseTime">Response time</Label>
                  <Input id="responseTime" name="responseTime" className="mt-1" defaultValue={p?.responseTime ?? ""} />
                </div>
                <div>
                  <Label htmlFor="pmPricing">PM pricing</Label>
                  <Input id="pmPricing" name="pmPricing" className="mt-1" defaultValue={p?.pmPricing ?? ""} />
                </div>
              </fieldset>

              <fieldset className="grid gap-3">
                <legend className="mb-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  Coverage notes
                </legend>
                <div>
                  <Label htmlFor="equipmentServiced">Equipment serviced</Label>
                  <Textarea id="equipmentServiced" name="equipmentServiced" className="mt-1 min-h-16" defaultValue={p?.equipmentServiced ?? ""} />
                </div>
                <div>
                  <Label htmlFor="partsStocking">Parts stocking</Label>
                  <Textarea id="partsStocking" name="partsStocking" className="mt-1 min-h-16" defaultValue={p?.partsStocking ?? ""} />
                </div>
                <div>
                  <Label htmlFor="notes">Key notes</Label>
                  <Textarea id="notes" name="notes" className="mt-1 min-h-20" defaultValue={p?.notes ?? ""} />
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {p ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove “${p.name}” from Out of Network? Assigned accounts will drop this provider.`,
                        )
                      ) {
                        remove.mutate();
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="submit" disabled={save.isPending}>
                  {creating ? "Add provider" : "Save"}
                </Button>
              </div>
            </form>
          )}
          {p ? (
            <div className="border-t border-border p-5">
              <ProviderAccountList providerId={p.id} accounts={p.accounts} />
            </div>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
    <RenameDialog
      open={editingName}
      title="Rename provider"
      noun="provider"
      current={p?.name ?? ""}
      pending={rename.isPending}
      onClose={() => setEditingName(false)}
      onSave={(n) => rename.mutate(n)}
    />
    </>
  );
}
