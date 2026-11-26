import { Link } from "@tanstack/react-router";

/** "Machine history": the Machine page (One Record Per Machine, M3) for a unit or warehouse record that has a machine. */
export function MachineLink({ machineId, className }: { machineId: number | null | undefined; className?: string }) {
  if (!machineId) return null;
  return (
    <Link
      to="/machines/$machineId"
      params={{ machineId: String(machineId) }}
      className={className ?? "text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"}
      data-testid="machine-link"
    >
      Machine history
    </Link>
  );
}
