import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "@/components/desk/jobs-page";
import { parseTicketSearch } from "@/lib/ops/search-params";

export const Route = createFileRoute("/_app/service")({
  validateSearch: parseTicketSearch,
  component: Page,
});

function Page() {
  const { open, tab } = Route.useSearch();
  return (
    <JobsPage
      kind="service"
      title="Service Tracker"
      lede="Field calls on a 48-hour clock. Active work stays on top; completed history is one toggle away."
      initialOpen={open}
      initialTab={tab}
    />
  );
}
