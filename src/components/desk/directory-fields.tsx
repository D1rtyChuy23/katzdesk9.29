import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDirectoryEntry,
  archiveDirectoryEntry,
  listDirectory,
  type DirectoryKind,
} from "@/lib/ops/api";
import { ComboField, MultiComboField, type ComboItem } from "@/components/ui/combo-field";
import { toast } from "sonner";

export function useDirectory(kind: DirectoryKind) {
  const qc = useQueryClient();
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
  };
}

export function CustomerCombo({
  label = "Customer",
  name,
  value,
  onChange,
  required,
  placeholder = "Search customers…",
}: {
  label?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const dir = useDirectory("customer");
  return (
    <ComboField
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      items={dir.items}
      placeholder={placeholder}
      required={required}
      allowCreate
      onCreate={dir.add}
      onRemoveItem={dir.removeItem}
      emptyHint="No customer matches — type a name to add one."
    />
  );
}

export function EquipmentCombo({
  label = "Equipment",
  name,
  value,
  onChange,
  required,
  placeholder = "Search equipment…",
}: {
  label?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  const dir = useDirectory("equipment");
  return (
    <ComboField
      label={label}
      name={name}
      value={value}
      onChange={onChange}
      items={dir.items}
      placeholder={placeholder}
      required={required}
      allowCreate
      onCreate={dir.add}
      onRemoveItem={dir.removeItem}
      emptyHint="No equipment matches — type a model to add one."
    />
  );
}

export function EquipmentMultiCombo({
  label = "Equipment",
  name = "equipment",
  values,
  onChange,
  placeholder = "Search equipment…",
}: {
  label?: string;
  name?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const dir = useDirectory("equipment");
  return (
    <MultiComboField
      label={label}
      name={name}
      values={values}
      onChange={onChange}
      items={dir.items}
      placeholder={placeholder}
      allowCreate
      onCreate={dir.add}
      onRemoveItem={dir.removeItem}
    />
  );
}
