import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRecipes } from "@/lib/ops/api";
import { catalogModels } from "@/lib/ops/equipment";
import { InstallPlanner } from "@/components/desk/install-planner";
import { PlannerCalendar, usePlannerWork } from "@/components/desk/planner-calendar";
import { CalendarDockButton } from "@/components/desk/pending-calendar";
import { useMyView } from "@/components/desk/my-view-bar";
import { FilterChip } from "@/components/desk/desk-charts";
import { Skeleton } from "@/components/ui/separator";

export const Route = createFileRoute("/_app/planner")({
  // Keep this page in the main app script. A separate planner chunk was 404ing
  // after publish ("Failed to fetch dynamically imported module").
  codeSplitGroupings: [],
  component: Page,
});

function Page() {
  const { matchMine, filterMine, role } = useMyView();
  const work = usePlannerWork();
  const recs = useQuery({ queryKey: ["recipes"], queryFn: () => listRecipes() });
  const installs = work.installs;
  const mineRep =
    filterMine && role === "sales"
      ? installs.find((i) => matchMine(i.accountRep))?.accountRep ?? null
      : null;
  const catalog = useMemo(
    () => catalogModels(installs.map((i) => i.equipment ?? "")),
    [installs],
  );

  const [tab, setTab] = useState<"calendar" | "timeline">("calendar");

  return (
    <div>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Planner</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Month calendar of pending work. Drag a job to another day. Timeline is the second tab.
          </p>
        </div>
        <CalendarDockButton />
      </header>
      <div className="mt-4 flex flex-wrap gap-2" data-testid="planner-tabs">
        <FilterChip selected={tab === "calendar"} onClick={() => setTab("calendar")}>
          Calendar
        </FilterChip>
        <FilterChip selected={tab === "timeline"} onClick={() => setTab("timeline")}>
          Timeline
        </FilterChip>
      </div>
      <div className="mt-4">
        {work.loading ? (
          <Skeleton className="h-64 w-full" />
        ) : tab === "calendar" ? (
          <PlannerCalendar
            installs={work.installs}
            pms={work.pms}
            services={work.services}
            tlcs={work.tlcs}
          />
        ) : (
          <InstallPlanner installs={installs} recipes={recs.data ?? []} catalog={catalog} myRep={mineRep} />
        )}
      </div>
    </div>
  );
}
