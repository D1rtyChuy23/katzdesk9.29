import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { JobsPage } from "@/components/desk/jobs-page";
import { parseTicketSearch, withTicketList, type TicketSearch } from "@/lib/ops/search-params";

export const Route = createFileRoute("/_app/tlc")({
  validateSearch: parseTicketSearch,
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tlc" });
  const { open, tab, from } = search;
  return (
    <JobsPage
      kind="tlc"
      title="TLC + Factor"
      lede="Contract TLC and Factor visits. Anything still open past two weeks is flagged automatically."
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
