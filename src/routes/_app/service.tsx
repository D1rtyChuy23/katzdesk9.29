import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { JobsPage } from "@/components/desk/jobs-page";
import { parseTicketSearch, withTicketList, type TicketSearch } from "@/lib/ops/search-params";

export const Route = createFileRoute("/_app/service")({
  validateSearch: parseTicketSearch,
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/service" });
  const { open, tab, from } = search;
  return (
    <JobsPage
      kind="service"
      title="Service Tracker"
      lede="Field calls on a 48-hour clock. Active work stays on top; completed history is one toggle away."
      initialOpen={open}
      initialTab={tab}
      from={from}
      search={search}
      onSearch={(patch: Partial<TicketSearch>) =>
        void navigate({ search: (prev) => withTicketList(prev, patch), replace: true, resetScroll: false })
      }
    />
  );
}
