import { createFileRoute } from "@tanstack/react-router";
import { JobsPage } from "@/components/desk/jobs-page";
import { parseOpenSearch } from "@/lib/ops/search-params";

export const Route = createFileRoute("/_app/tlc")({
  validateSearch: parseOpenSearch,
  component: Page,
});

function Page() {
  const { open } = Route.useSearch();
  return (
    <JobsPage
      kind="tlc"
      title="TLC + Factor"
      lede="Contract TLC and Factor visits. Anything still open past two weeks is flagged automatically."
      initialOpen={open}
    />
  );
}
