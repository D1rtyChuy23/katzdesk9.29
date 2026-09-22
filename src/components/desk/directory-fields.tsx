import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDirectoryEntry,
  archiveDirectoryEntry,
  listDirectory,
  renameCustomer,
  renameEquipment,
  type DirectoryKind,
} from "@/lib/ops/api";
import { getMyAccess } from "@/lib/ops/access";
import { ComboField, MultiComboField, type ComboItem } from "@/components/ui/combo-field";
import { RenameDialog } from "./rename-dialog";
import { toast } from "sonner";

export function useDirectory(kind: DirectoryKind) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const isAdmin = !!me.data?.isAdmin;
  const canAdd = kind === "equipment" || isAdmin || me.data?.canAddCustomers !== false;
  const canManage = kind === "equipment" || isAdmin;
  const list = useQuery({
    queryKey: ["directory", kind],
    queryFn: () => listDirectory({ data: { kind } }),
  });
  const add = useMutation({
    mutationFn: (name: string) => addDirectoryEntry({ data: { kind, name } }),
    onSuccess: (row) => {
      qc.setQueryData<ComboItem[]>(["directory", kind], (old) => {
        const list = old ?? [];
        if (list.some((i) => i.id === row.id || i.name.toLowerCase() === row.name.toLowerCase())) {
          return list.map((i) => (i.id === row.id ? row : i));
        }
        return [...list, row].sort((a, b) => a.name.localeCompare(b.name));
      });
      void qc.invalidateQueries({ queryKey: ["directory", kind] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });
  const archive = useMutation({
    mutationFn: (id: number) => archiveDirectoryEntry({ data: { kind, id } }),
    onSuccess: (_ok, id) => {
      qc.setQueryData<ComboItem[]>(["directory", kind], (old) =>
        (old ?? []).filter((i) => i.id !== id),
      );
      void qc.invalidateQueries({ queryKey: ["directory", kind] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });
  const rename = useMutation({
    mutationFn: (d: { id: number; name: string }) =>
      kind === "customer"
        ? renameCustomer({ data: d })
        : renameEquipment({ data: d }),
    onSuccess: (row) => {
      toast.success(row.merged ? `Merged into “${row.name}”` : `Renamed to “${row.name}”`);
      void qc.invalidateQueries({ queryKey: ["directory"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["jobs"] });
      void qc.invalidateQueries({ queryKey: ["pms"] });
      void qc.invalidateQueries({ queryKey: ["installs"] });
      void qc.invalidateQueries({ queryKey: ["deals"] });
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["assets"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not rename"),
  });
  function removeItem(item: ComboItem) {
    const noun = kind === "customer" ? "customer" : "equipment";
    archive.mutate(item.id, {
      onSuccess: () =>
        toast.success(`Removed “${item.name}” from the ${noun} list. Existing records keep the name.`),
    });
  }
  return {
    items: list.data ?? [],
    add: (name: string) => add.mutateAsync(name).then((row) => row.name),
    removeItem,
    rename: (item: ComboItem, name: string) => rename.mutateAsync({ id: item.id, name }),
    renamePending: rename.isPending,
    canEdit: canAdd,
    canAdd,
    canManage,
    isAdmin,
  };
}

export function CustomerCombo({
  label = "Customer",
  name,
  value,
  onChange,
  required,
  placeholder = "Search customers…",
  allowCreate: allowCreateProp,
  menuInFlow,
}: {
  label?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  allowCreate?: boolean;
  menuInFlow?: boolean;
}) {
  const dir = useDirectory("customer");
  const allowCreate = allowCreateProp ?? dir.canAdd;
  const renameUi = useRename(dir, "customer", (from, to) => {
    if (value.toLowerCase() === from.toLowerCase()) onChange(to);
  });
  return (
    <>
      <ComboField
        label={label}
        name={name}
        value={value}
        onChange={onChange}
        items={dir.items}
        placeholder={placeholder}
        required={required}
        allowCreate={allowCreate}
        onCreate={allowCreate ? dir.add : undefined}
        onRemoveItem={dir.canManage ? dir.removeItem : undefined}
        onRenameItem={dir.canManage ? renameUi.open : undefined}
        noun="customer"
        menuInFlow={menuInFlow}
        emptyHint={
          allowCreate
            ? "No customer matches — use + to add one."
            : "No customer matches. Pick an account already on the list."
        }
      />
      {renameUi.dialog}
    </>
  );
}

export function EquipmentCombo({
  label = "Equipment",
  name,
  value,
  onChange,
  required,
  placeholder = "Search equipment…",
  menuInFlow,
}: {
  label?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  menuInFlow?: boolean;
}) {
  const dir = useDirectory("equipment");
  const renameUi = useRename(dir, "equipment", (from, to) => {
    if (value.toLowerCase() === from.toLowerCase()) onChange(to);
  });
  return (
    <>
      <ComboField
        label={label}
        name={name}
        value={value}
        onChange={(v) => {
          onChange(v);
        }}
        items={dir.items}
        placeholder={placeholder}
        required={required}
        allowCreate
        onCreate={dir.add}
        onRemoveItem={dir.removeItem}
        onRenameItem={renameUi.open}
        noun="equipment"
        menuInFlow={menuInFlow}
        emptyHint="No equipment matches — use + to add a model."
      />
      {renameUi.dialog}
    </>
  );
}

export function EquipmentMultiCombo({
  label = "Equipment",
  name = "equipment",
  values,
  onChange,
  placeholder = "Search equipment…",
  menuInFlow,
}: {
  label?: string;
  name?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  menuInFlow?: boolean;
}) {
  const dir = useDirectory("equipment");
  const renameUi = useRename(dir, "equipment", (from, to) => {
    onChange(values.map((v) => (v.toLowerCase() === from.toLowerCase() ? to : v)));
  });
  return (
    <>
      <MultiComboField
        label={label}
        name={name}
        values={values}
        onChange={(next) => {
          onChange(next);
        }}
        items={dir.items}
        placeholder={placeholder}
        allowCreate
        onCreate={dir.add}
        onRemoveItem={dir.removeItem}
        onRenameItem={renameUi.open}
        noun="equipment"
        menuInFlow={menuInFlow}
      />
      {renameUi.dialog}
    </>
  );
}

function useRename(
  dir: ReturnType<typeof useDirectory>,
  noun: string,
  onMapped?: (from: string, to: string) => void,
) {
  const [item, setItem] = useState<ComboItem | null>(null);
  return {
    open: (next: ComboItem) => setItem(next),
    dialog: (
      <RenameDialog
        open={!!item}
        title={`Rename ${noun}`}
        noun={noun}
        current={item?.name ?? ""}
        pending={dir.renamePending}
        onClose={() => setItem(null)}
        onSave={(name) => {
          if (!item) return;
          const from = item.name;
          void dir.rename(item, name).then((row) => {
            onMapped?.(from, row.name);
            setItem(null);
          });
        }}
      />
    ),
  };
}
