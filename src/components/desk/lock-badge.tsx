import { useMutation } from "@tanstack/react-query";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setEquipmentLock } from "@/lib/ops/equipment-lock";
import { useCanLock } from "./use-can-lock";

/** "Locked" with who locked it on hover. Nothing when the unit is not locked. */
export function LockBadge({ lockedBy, className }: { lockedBy: string | null | undefined; className?: string }) {
  if (!lockedBy) return null;
  return (
    <Badge size="tight" variant="warn" title={`Locked by ${lockedBy}`} data-testid="lock-badge" className={className}>
      <Lock className="mr-1 size-3" />
      Locked
    </Badge>
  );
}

/** The owner's Lock / Unlock button. Nobody else sees it. */
export function LockToggle({
  kind,
  id,
  locked,
  onDone,
}: {
  kind: "unit" | "asset";
  id: number;
  locked: boolean;
  onDone?: () => void;
}) {
  const canLock = useCanLock();
  const toggle = useMutation({
    mutationFn: () => setEquipmentLock({ data: { kind, id, locked: !locked } }),
    onSuccess: () => {
      toast.success(locked ? "Unlocked" : "Locked");
      onDone?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change the lock"),
  });
  if (!canLock) return null;
  return (
    <Button type="button" size="sm" variant="outline" disabled={toggle.isPending} data-testid="lock-toggle" onClick={() => toggle.mutate()}>
      {locked ? <LockOpen className="mr-1 size-3.5" /> : <Lock className="mr-1 size-3.5" />}
      {locked ? "Unlock" : "Lock"}
    </Button>
  );
}
