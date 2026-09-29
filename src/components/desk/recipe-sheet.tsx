import { useMutation, useQueryClient } from "@tanstack/react-query";
import { copyRecipe, upsertRecipe } from "@/lib/ops/api";
import { previewSetting } from "@/lib/ops/recipe-fields";
import { findRecipeFor, shortEquipLabel, type EquipPiece } from "@/lib/ops/equipment";
import type { Recipe } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BookOpen, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { RecipeForm, type RecipeDraft } from "./recipe-form";

export function RecipeEditorSheet({
  draft,
  models,
  customers,
  onClose,
}: {
  draft: RecipeDraft | null;
  models: string[];
  customers: string[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (d: Parameters<typeof upsertRecipe>[0]["data"]) => upsertRecipe({ data: d }),
    onSuccess: (row) => {
      toast.success(row.customer ? `Saved for ${row.customer}` : "House recipe saved");
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const copy = useMutation({
    mutationFn: (d: Parameters<typeof copyRecipe>[0]["data"]) => copyRecipe({ data: d }),
    onSuccess: (row) => {
      toast.success(`Copied onto ${row.customer}`);
      void qc.invalidateQueries({ queryKey: ["recipes"] });
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customer-history"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const title = draft?.recipe
    ? draft.recipe.customer
      ? `${draft.recipe.customer}`
      : "House template"
    : draft?.customer
      ? draft.customer
      : "New recipe";

  return (
    <Sheet open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {draft ? (
          <>
            <SheetHeader>
              <p className="text-xs tracking-wide text-muted-foreground uppercase">Recipe</p>
              <SheetTitle>{title}</SheetTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {draft.equipmentModel || draft.recipe?.equipmentModel || "Pick equipment"}
              </p>
            </SheetHeader>
            <SheetBody className="p-5">
              <RecipeForm
                key={`${draft.recipe?.id ?? "new"}-${draft.equipmentModel}-${draft.customer}`}
                draft={draft}
                models={models}
                customers={customers}
                pending={save.isPending}
                copyPending={copy.isPending}
                onSave={(d) => save.mutate(d)}
                onCopy={draft.recipe ? (d) => copy.mutate(d) : undefined}
              />
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function RecipeChip({
  piece,
  customer,
  installId,
  recipes,
  onOpen,
  onRemove,
}: {
  piece: EquipPiece;
  customer: string;
  installId: number;
  recipes: Recipe[];
  onOpen: (draft: RecipeDraft) => void;
  onRemove?: () => void;
}) {
  const { linked, house } = findRecipeFor(recipes, {
    customer,
    model: piece.model,
    installId,
  });
  const preview = previewSetting(linked ?? house ?? undefined);
  let tone: "saved" | "house" | "empty" = "empty";
  if (linked) tone = "saved";
  else if (house) tone = "house";

  return (
    <div
      className={cn(
        "inline-flex h-8 max-w-[16rem] items-center rounded-full border",
        tone === "saved" && "border-primary/30 bg-primary/8",
        tone === "house" && "border-border bg-card",
        tone === "empty" && "border-border bg-background",
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen({
            recipe: linked,
            customer,
            equipmentModel: piece.model,
            installId,
            copiedFrom: linked?.copiedFrom ?? house?.id ?? null,
            lockCustomer: true,
            lockEquipment: false,
            source: null,
          });
        }}
        className="inline-flex min-w-0 flex-1 items-center gap-1 px-2.5 text-left"
        title={preview ?? piece.label}
      >
        <span className="min-w-0 truncate text-xs font-medium text-foreground">{shortEquipLabel(piece.label, 28)}</span>
        {tone === "empty" ? null : (
          <BookOpen className="size-3 shrink-0 text-muted-foreground" aria-label={tone === "saved" ? "Account recipe" : "House recipe"} />
        )}
      </button>
      {onRemove ? (
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-r-full text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Remove ${piece.label}`}
          title="Remove this equipment from the install"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function InstallRecipeList({
  customer,
  installId,
  pieces,
  recipes,
  onOpen,
}: {
  customer: string;
  installId: number;
  pieces: EquipPiece[];
  recipes: Recipe[];
  onOpen: (draft: RecipeDraft) => void;
}) {
  if (pieces.length === 0) {
    return (
      <div className="border-b border-border px-5 py-4">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">Recipes</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Add equipment on this install and a recipe slot will show up for each machine.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() =>
            onOpen({
              recipe: null,
              customer,
              equipmentModel: "",
              installId,
              copiedFrom: null,
              lockCustomer: true,
            })
          }
        >
          <Plus className="size-3.5" />
          Add recipe for {customer}
        </Button>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-5 py-4">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">Recipes by machine</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Linked to {customer}. Shared with techs and sales. Use a house recipe or start a new one.
      </p>
      <ul className="mt-3 space-y-2">
        {pieces.map((p, idx) => {
          const { linked, house } = findRecipeFor(recipes, {
            customer,
            model: p.model,
            installId,
          });
          const preview = previewSetting(linked ?? house ?? undefined);
          return (
            <li
              key={`${p.model}-${idx}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.model}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {linked ? "Saved for this account" : house ? "House recipe available" : "No recipe yet"}
                  {preview ? ` · ${preview}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={linked ? "secondary" : "outline"}
                onClick={() =>
                  onOpen({
                    recipe: linked,
                    customer,
                    equipmentModel: p.model,
                    installId,
                    copiedFrom: linked?.copiedFrom ?? house?.id ?? null,
                    lockCustomer: true,
                    lockEquipment: false,
                    source: null,
                  })
                }
              >
                {linked ? "Edit" : "Add recipe"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
