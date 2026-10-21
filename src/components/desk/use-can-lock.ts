import { useQuery } from "@tanstack/react-query";
import { getMyAccess } from "@/lib/ops/access";

/** Whether this person may lock and unlock equipment (the desk owner). */
export function useCanLock(): boolean {
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  return !!me.data?.canLockEquipment;
}
