import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  assignCustomerProvider,
  getCustomerProviders,
  listNetwork,
  setProviderRole,
  unassignCustomerProvider,
} from "@/lib/ops/network-api";
import { roleLabel, statusTone, type ProviderRole } from "@/lib/ops/network";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { CustomerCombo } from "./directory-fields";
import { toast } from "sonner";
import { Mail, Phone } from "lucide-react";

export function ProviderDispatchBlock({
  customer,
  assignable = false,
}: {
  customer: string;
  assignable?: boolean;
}) {
  const name = customer.trim();
  const qc = useQueryClient();
  const links = useQuery({
    queryKey: ["customer-providers", name],
    queryFn: () => getCustomerProviders({ data: { customer: name } }),
    enabled: name.length > 0,
  });
  const drop = useMutation({
    mutationFn: (linkId: number) => unassignCustomerProvider({ data: { linkId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
      void qc.invalidateQueries({ queryKey: ["network"] });
    },
  });
  if (!name) return null;
  const rows = links.data ?? [];
  if (!rows.length && !assignable) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Out of Network dispatch
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rows.length
              ? "Call the primary first. Secondary is backup."
              : "No 3rd-party tech is assigned to this account yet."}
          </p>
        </div>
      </div>
      {rows.length ? (
        <ul className="mt-3 space-y-2">
          {rows.map((l) => (
            <li key={l.linkId}>
              <DispatchCard
                role={l.role}
                name={l.provider.name}
                phone={l.provider.dispatchPhone}
                email={l.provider.dispatchEmail}
                coverage={
                  l.provider.states?.length
                    ? l.provider.states.join(" · ")
                    : l.provider.coverage
                }
                status={l.provider.status}
                onRemove={
                  assignable
                    ? () => drop.mutate(l.linkId)
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      ) : null}
      {assignable ? <AssignProviderForm customer={name} /> : null}
    </section>
  );
}

export function DispatchCard({
  role,
  name,
  phone,
  email,
  coverage,
  status,
  onRemove,
}: {
  role?: string;
  name: string;
  phone: string | null;
  email: string | null;
  coverage?: string | null;
  status?: string | null;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {role ? (
          <Badge variant={role === "primary" ? "ink" : "outline"}>{roleLabel(role)}</Badge>
        ) : null}
        <p className="min-w-0 flex-1 font-medium">{name}</p>
        {status ? <Badge variant={statusTone(status)}>{status}</Badge> : null}
        {onRemove ? (
          <button
            type="button"
            className="h-8 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5 text-sm">
        {phone ? (
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-foreground hover:underline">
            <Phone className="size-3.5 text-muted-foreground" />
            {phone}
          </a>
        ) : (
          <p className="text-xs text-muted-foreground">No dispatch phone on file</p>
        )}
        {email ? (
          <a href={`mailto:${email.split(/\s/)[0]}`} className="inline-flex items-center gap-1.5 break-all hover:underline">
            <Mail className="size-3.5 shrink-0 text-muted-foreground" />
            {email}
          </a>
        ) : null}
        {coverage ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{coverage}</p>
        ) : null}
      </div>
    </div>
  );
}

function AssignProviderForm({ customer }: { customer: string }) {
  const qc = useQueryClient();
  const net = useQuery({ queryKey: ["network"], queryFn: () => listNetwork() });
  const [providerId, setProviderId] = useState("");
  const [role, setRole] = useState<ProviderRole>("additional");
  const add = useMutation({
    mutationFn: () =>
      assignCustomerProvider({
        data: { customer, providerId: Number(providerId), role },
      }),
    onSuccess: (row) => {
      toast.success(`${row.provider.name} is on ${customer}`);
      setProviderId("");
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
      void qc.invalidateQueries({ queryKey: ["network"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign"),
  });
  const providers = net.data?.providers ?? [];
  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (providerId) add.mutate();
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">Add a provider</p>
        <SelectField
          className="mt-1"
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          allowEmpty
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </SelectField>
      </div>
      <SelectField
        className="sm:w-36"
        value={role}
        onChange={(e) => setRole(e.target.value as ProviderRole)}
      >
        <option value="primary">Primary</option>
        <option value="secondary">Secondary</option>
        <option value="additional">Additional</option>
      </SelectField>
      <Button type="submit" size="sm" disabled={!providerId || add.isPending}>
        Add
      </Button>
    </form>
  );
}

export function ProviderAccountList({
  providerId,
  accounts,
}: {
  providerId: number;
  accounts: { customer: string; role: ProviderRole; linkId: number }[];
}) {
  const qc = useQueryClient();
  const [customer, setCustomer] = useState("");
  const [role, setRole] = useState<ProviderRole>("primary");
  const add = useMutation({
    mutationFn: () =>
      assignCustomerProvider({
        data: { customer, providerId, role },
      }),
    onSuccess: () => {
      toast.success("Account assigned");
      setCustomer("");
      void qc.invalidateQueries({ queryKey: ["network"] });
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not assign"),
  });
  const drop = useMutation({
    mutationFn: (linkId: number) => unassignCustomerProvider({ data: { linkId } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["network"] });
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
    },
  });
  const roleMut = useMutation({
    mutationFn: (d: { linkId: number; role: ProviderRole }) => setProviderRole({ data: d }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["network"] });
      void qc.invalidateQueries({ queryKey: ["customer-providers"] });
    },
  });

  return (
    <div>
      <h3 className="font-display text-lg">Assigned Accounts</h3>
      <p className="text-xs text-muted-foreground">Pick from the customer list. Primary is who we call first.</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (customer.trim()) add.mutate();
        }}
      >
        <div className="min-w-0 flex-1">
          <CustomerCombo label="Customer" value={customer} onChange={setCustomer} allowCreate={false} />
        </div>
        <SelectField className="sm:w-36" value={role} onChange={(e) => setRole(e.target.value as ProviderRole)}>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="additional">Additional</option>
        </SelectField>
        <Button type="submit" size="sm" disabled={!customer.trim() || add.isPending}>
          Assign
        </Button>
      </form>
      {accounts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No accounts yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {accounts.map((a) => (
            <li key={a.linkId} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <p className="min-w-0 flex-1 font-medium">{a.customer}</p>
              <SelectField
                className="w-32"
                value={a.role}
                onChange={(e) =>
                  roleMut.mutate({ linkId: a.linkId, role: e.target.value as ProviderRole })
                }
              >
                <option value="primary">Primary</option>
                <option value="secondary">Secondary</option>
                <option value="additional">Additional</option>
              </SelectField>
              <button
                type="button"
                className="h-10 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => drop.mutate(a.linkId)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
