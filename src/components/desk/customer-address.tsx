import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { getCustomerAddress } from "@/lib/ops/api";

/** Google Maps for an address, opened in a new tab. */
function mapLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/**
 * The account's address (from the clean customer list) under the customer on a ticket, PM or install, with a pin
 * that opens it on the map. Follows the customer as it is changed.
 */
export function CustomerAddress({ customer, className }: { customer: string | null | undefined; className?: string }) {
  const name = (customer ?? "").trim();
  const q = useQuery({
    queryKey: ["customer-address", name.toLowerCase()],
    queryFn: () => getCustomerAddress({ data: { name } }),
    enabled: !!name,
    staleTime: 60_000,
  });
  if (!name) return null;
  const address = q.data?.address ?? null;
  return (
    <div className={className ?? "mt-1.5"} data-testid="customer-address">
      {q.isLoading ? (
        <p className="text-xs text-muted-foreground">Looking up the address…</p>
      ) : address ? (
        <a
          href={mapLink(address)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-start gap-1.5 text-sm text-foreground hover:text-primary hover:underline"
          title="Open in Google Maps"
          data-testid="customer-address-map"
        >
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Map" />
          <span>{address}</span>
        </a>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="customer-address-none">
          <MapPin className="size-3.5" aria-hidden />
          No address on this account yet. It fills in when the account is approved on Clean Names.
        </p>
      )}
    </div>
  );
}
