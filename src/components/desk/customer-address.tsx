import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { getCustomerAddress, listAccountAddresses } from "@/lib/ops/api";
import { cn } from "@/lib/utils";

/** Google Maps for an address, opened in a new tab. */
function mapLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Directions to an address. On a phone this opens the maps app with the route. */
function directionsLink(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** The pin: tap for directions. Clicks stay on the pin, so a row it sits in does not open too. */
function DirectionsPin({ address, size = "md", inRow = false }: { address: string; size?: "sm" | "md"; inRow?: boolean }) {
  const cls = cn("inline-grid shrink-0 cursor-pointer place-items-center rounded-full text-primary hover:bg-primary/10", size === "sm" ? "size-7 -my-1.5" : "size-8 -my-1");
  if (inRow) {
    // A row is often a button already; a link cannot sit inside one, so the pin opens the route itself.
    const go = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      e.stopPropagation();
      e.preventDefault();
      window.open(directionsLink(address), "_blank", "noopener");
    };
    return (
      <span
        role="link"
        tabIndex={0}
        onClick={go}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") go(e);
        }}
        className={cls}
        title="Directions"
        aria-label={`Directions to ${address}`}
        data-testid="address-directions"
      >
        <MapPin className={size === "sm" ? "size-3.5" : "size-4"} />
      </span>
    );
  }
  return (
    <a
      href={directionsLink(address)}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn("inline-grid shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10", size === "sm" ? "size-7 -my-1.5" : "size-8 -my-1")}
      title="Directions"
      aria-label={`Directions to ${address}`}
      data-testid="address-directions"
    >
      <MapPin className={size === "sm" ? "size-3.5" : "size-4"} />
    </a>
  );
}

/**
 * The account's address under the customer on a ticket, PM, install or deal window, with a pin for directions.
 * Follows the customer as it is changed.
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
        <p className="flex items-start gap-1 text-sm text-muted-foreground">
          <DirectionsPin address={address} />
          <a
            href={mapLink(address)}
            target="_blank"
            rel="noreferrer"
            className="min-w-0 hover:text-primary hover:underline"
            title="Open in Google Maps"
            data-testid="customer-address-map"
          >
            {address}
          </a>
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="customer-address-none">
          <MapPin className="size-3.5" aria-hidden />
          No address on this account yet.
        </p>
      )}
    </div>
  );
}

/** Every saved address, loaded once and shared by all the rows on a page. */
export function useAccountAddresses() {
  return useQuery({ queryKey: ["account-addresses"], queryFn: () => listAccountAddresses(), staleTime: 5 * 60_000 });
}

/**
 * The address in small type under an account name on a list row, with the pin for directions. Nothing when the
 * account has no address saved.
 */
export function AddressLine({ customer, className }: { customer: string | null | undefined; className?: string }) {
  const all = useAccountAddresses();
  const address = all.data?.[(customer ?? "").trim().toLowerCase()];
  if (!address) return null;
  return (
    <span className={cn("flex min-w-0 items-start gap-0.5 text-xs text-muted-foreground", className)} data-testid="row-address">
      <DirectionsPin address={address} size="sm" inRow />
      <span className="min-w-0 break-words" title={address}>
        {address}
      </span>
    </span>
  );
}
