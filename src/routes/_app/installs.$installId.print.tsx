import { createFileRoute } from "@tanstack/react-router";
import { InstallFormPage } from "@/components/desk/install-form-page";

export const Route = createFileRoute("/_app/installs/$installId/print")({
  component: Page,
});

function Page() {
  const { installId } = Route.useParams();
  const id = Number(installId);
  if (!Number.isFinite(id) || id <= 0) return <p className="p-6 text-sm">That install is not on the board.</p>;
  return <InstallFormPage installId={id} />;
}
