import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { copyRecipe, listCustomers, listDirectory, listRecipes, upsertRecipe } from "@/lib/ops/api";
import { catalogModels } from "@/lib/ops/equipment";
import { parseOpenSearch } from "@/lib/ops/search-params";
import type { Recipe } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecipeForm } from "@/components/desk/recipe-form";
import { SortSelect, useDeskSort } from "@/components/desk/sort-bar";
import { SORT_ALPHA, SORT_DATE, SORT_EQUIP, sortDesk } from "@/lib/ops/sort";
import { cn } from "@/lib/utils";
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
  useEffect(() => {
    if (open != null) setSelected(open);
  }, [open]);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useDeskSort("recipes", "alpha-asc");

  const rows = recs.data ?? [];
  const needle = filter.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = needle
      ? rows.filter((r) =>
          [r.equipmentModel, r.customer ?? "house", r.notes ?? ""].some((v) =>
            v.toLowerCase().includes(needle),
          ),
        )
      : rows;
    return sortDesk(list, sort, {
      date: (r) => r.updatedAt,
      name: (r) => r.customer ?? r.equipmentModel,
      equipment: (r) => r.equipmentModel,
    });
  }, [rows, needle, sort]);
  const current = typeof selected === "number" ? rows.find((r) => r.id === selected) ?? null : null;

  const models = useMemo(
    () => catalogModels([...(directoryEquip.data ?? []).map((e) => e.name), ...rows.map((r) => r.equipmentModel)]),
    [directoryEquip.data, rows],
  );

  const grouped = useMemo(() => groupRecipes(shown), [shown]);

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
        <Button onClick={() => setSelected("new")}>
          <Plus className="size-4" />
          New recipe
        </Button>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside className={cn("rounded-xl border border-border bg-card", selected != null && "hidden lg:block")}>
          <div className="border-b border-border p-3">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter customers or models…"
            />
            <div className="mt-2">
              <SortSelect
                value={sort}
                onChange={setSort}
                options={[...SORT_ALPHA, ...SORT_DATE, ...SORT_EQUIP]}
                className="w-full max-w-none sm:w-full"
              />
            </div>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {grouped.house.length ? (
              <li>
                <p className="px-4 pt-3 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                  House templates
                </p>
                <ul>
                  {grouped.house.map((r) => (
                    <RecipeNavItem
                      key={r.id}
                      recipe={r}
                      active={current?.id === r.id}
                      onClick={() => setSelected(r.id)}
                    />
                  ))}
                </ul>
              </li>
            ) : null}
            {grouped.customers.map(([name, list]) => (
              <li key={name}>
                <p className="px-4 pt-3 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                  {name}
                </p>
                <ul>
                  {list.map((r) => (
                    <RecipeNavItem
                      key={r.id}
                      recipe={r}
                      active={current?.id === r.id}
                      onClick={() => setSelected(r.id)}
                      hideCustomer
                    />
                  ))}
                </ul>
              </li>
            ))}
            {shown.length === 0 ? (
              <li className="px-4 py-6 text-sm text-muted-foreground">No recipes yet.</li>
            ) : null}
          </ul>
        </aside>

        <section className={cn("rounded-xl border border-border bg-card p-5", selected == null && "hidden lg:block")}>
          {selected != null ? (
            <button
              type="button"
              className="mb-4 text-sm text-muted-foreground hover:text-foreground lg:hidden"
              onClick={() => setSelected(null)}
            >
              ← All recipes
            </button>
          ) : null}
          {selected == null ? (
            <p className="text-sm text-muted-foreground">
              Select a customer recipe, a house template, or add a new one. New cards start empty — pick
              the fields you need. House templates can be edited and assigned to a customer from here.
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
    </div>
  );
}

function RecipeNavItem({
  recipe: r,
  active,
  onClick,
  hideCustomer,
}: {
  recipe: Recipe;
  active: boolean;
  onClick: () => void;
  hideCustomer?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn("w-full px-4 py-2.5 text-left text-sm hover:bg-muted/60", active && "bg-muted")}
      >
        <span className="block font-medium">{r.equipmentModel}</span>
        {hideCustomer ? null : (
          <span className="block text-xs text-muted-foreground">
            {r.customer ?? "Shared house recipe"}
          </span>
        )}
      </button>
    </li>
  );
}

function groupRecipes(rows: Recipe[]) {
  const house = rows.filter((r) => !r.customer);
  const byCust = new Map<string, Recipe[]>();
  for (const r of rows) {
    if (!r.customer) continue;
    const list = byCust.get(r.customer) ?? [];
    list.push(r);
    byCust.set(r.customer, list);
  }
  return {
    house,
    customers: [...byCust.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}
