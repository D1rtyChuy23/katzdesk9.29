import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { getMyAccess } from "@/lib/ops/access";

/** For a sales rep on a Service page: the list holds only the accounts assigned to them, for awareness. */
export function SalesScopeNote() {
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  if (!me.data || me.data.isAdmin || me.data.role !== "sales") return null;
  return (
    <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground" data-testid="sales-scope-note">
      <Eye className="size-3.5 shrink-0" />
      Showing only the accounts assigned to you, for awareness. Service techs work the full list.
    </p>
  );
}
