import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listInstalls, listJobs, listPms, listRecipes } from "@/lib/ops/api";
import { catalogModels } from "@/lib/ops/equipment";
import { InstallPlanner } from "@/components/desk/install-planner";
import { PlannerCalendar } from "@/components/desk/planner-calendar";
import { MyViewBar, useMyView } from "@/components/desk/my-view-bar";
import { mineByTechnician } from "@/lib/ops/my-view";
import { Skeleton } from "@/components/ui/separator";

export const Route = createFileRoute("/_app/planner")({
  component: Page,
});

function Page() {
  const { matchMine, filterMine, role } = useMyView();
  const installsQ = useQuery({ queryKey: ["installs"], queryFn: () => listInstalls() });
  const pmsQ = useQuery({ queryKey: ["pms"], queryFn: () => listPms() });
  const servicesQ = useQuery({
    queryKey: ["jobs", "service"],
    queryFn: () => listJobs({ data: { kind: "service" } }),
  });
  const tlcsQ = useQuery({
    queryKey: ["jobs", "tlc"],
    queryFn: () => listJobs({ data: { kind: "tlc" } }),
  });
  const recs = useQuery({ queryKey: ["recipes"], queryFn: () => listRecipes() });

  const installs = useMemo(() => {
    let list = installsQ.data ?? [];
    if (filterMine) list = list.filter((i) => matchMine(i.accountRep, i.technician) || i.aviKatz);
    return list;
  }, [installsQ.data, filterMine, matchMine]);
  const pms = useMemo(
    () => mineByTechnician(pmsQ.data ?? [], { filterMine, role, matchMine }),
    [pmsQ.data, filterMine, matchMine, role],
  );
  const services = useMemo(
    () => mineByTechnician(servicesQ.data ?? [], { filterMine, role, matchMine }),
    [servicesQ.data, filterMine, matchMine, role],
  );
  const tlcs = useMemo(
    () => mineByTechnician(tlcsQ.data ?? [], { filterMine, role, matchMine }),
    [tlcsQ.data, filterMine, matchMine, role],
  );

  const mineRep =
    filterMine && role === "sales"
      ? installs.find((i) => matchMine(i.accountRep))?.accountRep ?? null
      : null;
  const catalog = catalogModels(installs.map((i) => i.equipment ?? ""));
  const loading = installsQ.isLoading || pmsQ.isLoading || servicesQ.isLoading || tlcsQ.isLoading;

  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Planner</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Month calendar of scheduled work, plus the install timeline. Dates here are the same ones on
            the boards and exports.
          </p>
        </div>
        <MyViewBar />
      </header>
      <div className="mt-5 space-y-5">
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <PlannerCalendar installs={installs} pms={pms} services={services} tlcs={tlcs} />
            <InstallPlanner
              installs={installs}
              recipes={recs.data ?? []}
              catalog={catalog}
              myRep={mineRep}
            />
          </>
        )}
      </div>
    </div>
  );
}
