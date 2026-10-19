import { useQuery } from "@tanstack/react-query";
import { listSpecOutlets } from "@/lib/ops/spec-read-api";
import { outletForModel } from "@/lib/ops/spec-read";

/** Outlet volts and amps from the model's spec sheet. Read-only. A typed value on the job is not changed. */
export function SpecOutletLine({ model }: { model: string | null | undefined }) {
  const data = useQuery({ queryKey: ["spec-outlets"], queryFn: () => listSpecOutlets(), staleTime: 60_000 });
  const name = (model ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] ?? "";
  const hit = name ? outletForModel(name, data.data ?? []) : undefined;
  const text = [hit?.voltage, hit?.amps, hit?.plug].filter(Boolean).join(" · ");
  if (!text) return null;
  return (
    <p className="text-xs text-muted-foreground sm:col-span-2" data-testid="pm-spec-outlet">
      Outlet from the spec sheet: {text}
    </p>
  );
}
