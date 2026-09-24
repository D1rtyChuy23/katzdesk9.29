import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { copyRecipe, listCustomers, listDirectory, listRecipes, upsertRecipe } from "@/lib/ops/api";
import { catalogModels } from "@/lib/ops/equipment";
import { parseOpenSearch } from "@/lib/ops/search-params";
import type { Recipe } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { ComboField } from "@/components/ui/combo-field";
import { RecipeForm } from "@/components/desk/recipe-form";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/recipes")({
  validateSearch: parseOpenSearch,
  component: Page,
});

function Page() {
  const { open } = Route.useSearch();
  const qc = useQueryClient();
  const recs = useQuery({ queryKey: ["recipes"], queryFn: () => listRecipes() });
  const directoryEquip = useQuery({
    queryKey: ["directory", "equipment"],
    queryFn: () => listDirectory({ data: { kind: "equipment" } }),
  });
  const customers = useQuery({ queryKey: ["customers"], queryFn: () => listCustomers() });
  const [selected, setSelected] = useState<number | "new" | null>(open ?? null);
  const [housePick, setHousePick] = useState("");
  const [customerPick, setCustomerPick] = useState("");
  useEffect(() => {
    if (open != null) setSelected(open);
  }, [open]);

  const rows = recs.data ?? [];
  const current = typeof selected === "number" ? rows.find((r) => r.id === selected) ?? null : null;
  const house = useMemo(() => rows.filter((r) => !r.customer), [rows]);
  const customerRecipes = useMemo(() => rows.filter((r) => !!r.customer), [rows]);

  function houseLabel(r: Recipe) {
    const dup = house.filter((x) => x.equipmentModel === r.equipmentModel).length > 1;
    return dup ? `${r.equipmentModel} · ${r.id}` : r.equipmentModel;
  }
  function customerLabel(r: Recipe) {
    return `${r.customer} · ${r.equipmentModel}`;
  }

  useEffect(() => {
    if (!current) return;
    if (!current.customer) {
      setHousePick(houseLabel(current));
      setCustomerPick("");
    } else {
      setCustomerPick(customerLabel(current));
      setHousePick("");
    }
    // Labels depend on the current row set; re-sync when the selected recipe changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, rows.length]);

  const models = useMemo(
    () => catalogModels([...(directoryEquip.data ?? []).map((e) => e.name), ...rows.map((r) => r.equipmentModel)]),
    [directoryEquip.data, rows],
  );

  const save = useMutation({
    mutationFn: (d: Parameters<typeof upsertRecipe>[0]["data"]) => upsertRecipe({ data: d }),
    onSuccess: (row) => {
      toast.success(row.customer ? `Saved for ${row.customer}` : "House recipe saved");
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setSelected(row.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const copy = useMutation({
    mutationFn: (d: Parameters<typeof copyRecipe>[0]["data"]) => copyRecipe({ data: d }),
    onSuccess: (row) => {
      toast.success(`Copied onto ${row.customer}`);
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      setSelected(row.id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Recipes</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Settings live on a customer + machine. House templates can be edited and assigned to a
            customer. Fields start blank — nothing is filled in automatically.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelected("new");
            setHousePick("");
            setCustomerPick("");
          }}
        >
          <Plus className="size-4" />
          New recipe
        </Button>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2" data-testid="recipe-pickers">
        <ComboField
          label="House template"
          value={housePick}
          allowCreate={false}
          noun="template"
          placeholder="Search house templates…"
          emptyHint="No house templates"
          items={house.map((r) => ({ id: r.id, name: houseLabel(r) }))}
          onChange={(name) => {
            setHousePick(name);
            setCustomerPick("");
            const hit = house.find((r) => houseLabel(r) === name);
            setSelected(hit ? hit.id : null);
          }}
        />
        <ComboField
          label="Customer template"
          value={customerPick}
          allowCreate={false}
          noun="template"
          placeholder={customerRecipes.length ? "Search customer templates…" : "No customer templates"}
          emptyHint="No customer templates"
          items={customerRecipes.map((r) => ({ id: r.id, name: customerLabel(r) }))}
          onChange={(name) => {
            setCustomerPick(name);
            setHousePick("");
            const hit = customerRecipes.find((r) => customerLabel(r) === name);
            setSelected(hit ? hit.id : null);
          }}
        />
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card p-5">
        {selected == null ? (
          <p className="text-sm text-muted-foreground">
            Pick a house template or a customer template. The recipe opens here — no second page.
          </p>
        ) : (
          <RecipeForm
            key={current?.id ?? "new"}
            draft={{
              recipe: current,
              customer: current?.customer ?? null,
              equipmentModel: current?.equipmentModel ?? "",
              installId: current?.installId ?? null,
              copiedFrom: current?.copiedFrom ?? null,
            }}
            models={models}
            customers={customers.data ?? []}
            pending={save.isPending}
            copyPending={copy.isPending}
            onSave={(d) => save.mutate(d)}
            onCopy={(d) => copy.mutate(d)}
          />
        )}
      </section>
    </div>
  );
}
