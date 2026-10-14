import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { getCustomerAddress, listAccountAddresses, type CustomerLocation } from "@/lib/ops/api";
import { canDriveTo, directionsUrl, isPoint, placeUrl, type LatLng, type PinQuality } from "@/lib/ops/geo";
import { cn } from "@/lib/utils";

/** An account's saved map pin and how good it is (exact / close: the street was found; approx: ZIP area only). */
export type PinTarget = { point: LatLng | null; quality: PinQuality | null };

/** Short words in a street address that stay upper case: compass points and road types like FM 1960 or US 59. */
const KEEP_UPPER = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "FM", "US", "SH", "CR", "RR", "PO"]);

function addressWord(w: string): string {
  if (KEEP_UPPER.has(w)) return w;
  // "WESTHEIMER" → "Westheimer", "HWY-6" → "Hwy-6", "1ST" → "1st", "MCKINNEY" → "McKinney".
  return w
    .toLowerCase()
    .replace(/(^|[^a-z0-9'])([a-z])/g, (_, pre: string, c: string) => pre + c.toUpperCase())
    .replace(/^Mc([a-z])/, (_, c: string) => `Mc${c.toUpperCase()}`);
}

/**
 * The geocoder's matched address the way people write it: "4444 WESTHEIMER RD, HOUSTON, TX, 77027" becomes
 * "4444 Westheimer Rd, Houston, TX 77027". An address that is already mixed case is left as it is.
 */
function pinAddressLabel(raw: string | null | undefined): string | null {
  const parts = String(raw ?? "")
    .split(",")
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const joined = parts.join(", ");
  if (joined !== joined.toUpperCase()) return joined;
  // State and ZIP stay as they are: "TX, 77027" → "TX 77027"; a lone "TX" or "TX 77027" is kept too.
  let tail: string | null = null;
  const last = parts[parts.length - 1]!;
  const state = parts[parts.length - 2];
  if (parts.length >= 3 && /^\d{5}(-\d{4})?$/.test(last) && state && /^[A-Z]{2}$/.test(state)) {
    tail = `${state} ${last}`;
    parts.splice(-2, 2);
  } else if (parts.length >= 2 && /^[A-Z]{2}( \d{5}(-\d{4})?)?$/.test(last)) {
    tail = last;
    parts.splice(-1, 1);
  }
  const head = parts.map((p) => p.split(" ").map(addressWord).join(" "));
  return [...head, ...(tail ? [tail] : [])].join(", ");
}

/** True when the pin is a real street match, so directions go to the pin itself. */
const drivable = (pin: PinTarget | null | undefined): boolean => !!pin && isPoint(pin.point) && canDriveTo(pin.quality);

/**
 * The pin: tap for directions. Goes to the saved map pin when it is an exact or close street match, otherwise to the
 * typed address; nothing when neither exists. Clicks stay on the pin, so a row it sits in does not open too.
 */
function DirectionsPin({
  pin,
  address,
  size = "md",
  inRow = false,
}: {
  pin?: PinTarget | null;
  address?: string | null;
  size?: "sm" | "md";
  inRow?: boolean;
}) {
  const url = directionsUrl({ point: pin?.point, quality: pin?.quality, address });
  if (!url) return null;
  const shown = address?.trim();
  const label = shown ? `Directions to ${shown}` : "Directions to this account's pin";
  const title = drivable(pin) ? "Directions to the map pin" : "Directions";
  const cls = cn("inline-grid shrink-0 place-items-center rounded-full text-primary hover:bg-primary/10", size === "sm" ? "size-7 -my-1.5" : "size-8 -my-1");
  const icon = <MapPin className={size === "sm" ? "size-3.5" : "size-4"} />;
  if (inRow) {
    // A row is often a button already; a link cannot sit inside one, so the pin opens the route itself.
    const go = (e: { stopPropagation: () => void; preventDefault: () => void }) => {
      e.stopPropagation();
      e.preventDefault();
      window.open(url, "_blank", "noopener");
    };
    return (
      <span
        role="link"
        tabIndex={0}
        onClick={go}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") go(e);
        }}
        className={cn(cls, "cursor-pointer")}
        title={title}
        aria-label={label}
        data-testid="address-directions"
      >
        {icon}
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={cls} title={title} aria-label={label} data-testid="address-directions">
      {icon}
    </a>
  );
}

/**
 * The account's address under the customer on a ticket, PM, install or deal window, with a pin for directions.
 * Follows the customer as it is changed. When the account has no typed address but its map pin is a street match,
 * the address the geocoder matched is shown instead, marked as coming from the pin.
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
  const location = q.data?.location ?? null;
  const pin: PinTarget | null = location ? { point: { lat: location.latitude, lng: location.longitude }, quality: location.match } : null;
  const typed = q.data?.address?.trim() || null;
  const fromPin = !typed && drivable(pin) ? pinAddressLabel(location?.matchedAddress) : null;
  const shown = typed ?? fromPin;
  return (
    <div className={className ?? "mt-1.5"} data-testid="customer-address">
      {q.isLoading ? (
        <p className="text-xs text-muted-foreground">Looking up the address…</p>
      ) : shown ? (
        <p className="flex items-start gap-1 text-sm text-muted-foreground">
          <DirectionsPin pin={pin} address={shown} />
          <span className="min-w-0">
            <a
              href={(fromPin ? placeUrl({ point: pin?.point, quality: pin?.quality }) : placeUrl({ address: shown })) ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary hover:underline"
              title="Open in Google Maps"
              data-testid="customer-address-map"
            >
              {shown}
            </a>
            {fromPin ? (
              <span className="ml-1 text-xs whitespace-nowrap text-muted-foreground" data-testid="customer-address-from-pin">
                (from map pin)
              </span>
            ) : null}
          </span>
        </p>
      ) : drivable(pin) ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid="customer-address-none">
          <DirectionsPin pin={pin} />
          No address typed on this account. Directions use the map pin.
        </p>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="customer-address-none">
          <MapPin className="size-3.5" aria-hidden />
          No address on this account yet.
        </p>
      )}
      {location ? <LocationLine location={location} /> : null}
    </div>
  );
}

/** The saved map pin from the geocoded customer list: opens Google Maps at the pin. */
function LocationLine({ location }: { location: CustomerLocation }) {
  const point = { lat: location.latitude, lng: location.longitude };
  if (!isPoint(point)) return null;
  const { match } = location;
  const label = match === "approx" ? "ZIP area pin (approximate)" : match === "close" ? "Map pin (close match, check it)" : "Map pin";
  const href = placeUrl({ point, quality: match });
  return (
    <p className="mt-0.5 pl-9 text-xs text-muted-foreground" data-testid="customer-location">
      <a
        href={href ?? undefined}
        target="_blank"
        rel="noreferrer"
        className={cn("hover:text-primary hover:underline", match === "close" && "text-warning")}
        title={
          match === "approx"
            ? "Only the ZIP code was found, so this pin is the middle of the ZIP area. Directions use the typed address."
            : location.matchedAddress
              ? `Geocoded as ${location.matchedAddress}`
              : "Open the pin in Google Maps"
        }
        data-testid="customer-location-map"
      >
        {label}: {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
      </a>
    </p>
  );
}

/** Every saved address and map pin, loaded once and shared by all the rows on a page. Keyed by lower-case name. */
export function useAccountAddresses() {
  return useQuery({ queryKey: ["account-addresses"], queryFn: () => listAccountAddresses(), staleTime: 5 * 60_000 });
}

/**
 * The address in small type under an account name on a list row, with the pin for directions (to the exact map pin
 * when it is a street match). With no typed address, the geocoder's matched address stands in when the pin is a
 * street match. Nothing when the account has neither an address nor a pin good enough to drive to.
 */
export function AddressLine({ customer, className }: { customer: string | null | undefined; className?: string }) {
  const all = useAccountAddresses();
  const entry = all.data?.[(customer ?? "").trim().toLowerCase()];
  if (!entry) return null;
  const pin: PinTarget = {
    point: entry.latitude != null && entry.longitude != null ? { lat: entry.latitude, lng: entry.longitude } : null,
    quality: entry.match,
  };
  const typed = entry.address?.trim() || null;
  const fromPin = !typed && drivable(pin) ? pinAddressLabel(entry.geocodeAddress) : null;
  const text = typed ?? fromPin ?? (drivable(pin) ? "Map pin" : null);
  if (!text) return null;
  return (
    <span className={cn("flex min-w-0 items-start gap-0.5 text-xs text-muted-foreground", className)} data-testid="row-address">
      <DirectionsPin pin={pin} address={typed ?? fromPin} size="sm" inRow />
      <span className="min-w-0 break-words" title={typed ? text : `${text} (from map pin)`}>
        {text}
      </span>
    </span>
  );
}
