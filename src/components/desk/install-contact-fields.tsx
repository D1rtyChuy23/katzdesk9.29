import { useQuery } from "@tanstack/react-query";
import { getInstallInspection } from "@/lib/ops/inspection-api";
import { CONTACT_PHONE_MAX, SITE_CONTACT_MAX } from "@/lib/ops/install-form";
import { Input, Label } from "@/components/ui/input";

/**
 * Site contact and contact phone, on the install's Details tab. Saved with the Details form (`siteContact`,
 * `contactPhone`) and printed on the Equipment Request Form. Until a site contact is typed here, the field shows the
 * pre-inspection's in grey, and the form prints that one. The Pre-Inspection tab keeps its own: who the inspector met.
 */
export function InstallContactFields({
  installId,
  siteContact,
  contactPhone,
}: {
  installId: number;
  siteContact: string | null;
  contactPhone: string | null;
}) {
  // The same query the Pre-Inspection tab reads, so the window asks for it once.
  const inspection = useQuery({
    queryKey: ["inspection", installId],
    queryFn: () => getInstallInspection({ data: { installId } }),
  });
  const fromInspection = inspection.data?.siteContact?.trim() || "";
  return (
    <>
      <div>
        <Label htmlFor={`install-site-contact-${installId}`}>Site contact</Label>
        <Input
          id={`install-site-contact-${installId}`}
          name="siteContact"
          className="mt-1"
          defaultValue={siteContact ?? ""}
          placeholder={fromInspection ? `${fromInspection} · from the pre-inspection` : "Who to ask for on site"}
          maxLength={SITE_CONTACT_MAX}
          autoComplete="off"
          data-testid="install-site-contact"
        />
      </div>
      <div>
        <Label htmlFor={`install-contact-phone-${installId}`}>Contact phone</Label>
        <Input
          id={`install-contact-phone-${installId}`}
          name="contactPhone"
          type="tel"
          inputMode="tel"
          className="mt-1"
          defaultValue={contactPhone ?? ""}
          placeholder="Their phone"
          maxLength={CONTACT_PHONE_MAX}
          autoComplete="off"
          data-testid="install-contact-phone"
        />
      </div>
    </>
  );
}
