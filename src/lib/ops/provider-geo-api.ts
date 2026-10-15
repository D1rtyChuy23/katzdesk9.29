import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { deskMiddleware } from "@/lib/ops/access";
import { formatAddress } from "@/lib/ops/network";
import { isPoint, type PinQuality } from "@/lib/ops/geo";

async function ready() {
  const { ensureSeeded } = await import("./seed.server");
  await ensureSeeded();
  return getSql();
}

/** Query key for the service provider pins on the Map page. Invalidate it after a provider import. */
export const PROVIDER_GEO_KEY = ["provider-geo"] as const;

/** At most this many provider pins (one per pinned address). */
export const MAX_PROVIDER_PINS = 2000;

/** One pinned address of an Out of Network service provider, for the Map page. */
export type ProviderGeo = {
  /** The address row (one provider can have more than one location). */
  addressId: number;
  providerId: number;
  name: string;
  status: string | null;
  dispatchPhone: string | null;
  dispatchEmail: string | null;
  website: string | null;
  coverage: string | null;
  /** The address as one line ("1407 Tulip Ln · Odessa, TX 79761"), without its label. */
  address: string;
  /** True for the provider's main address (labelled Main by the provider import). */
  main: boolean;
  lat: number;
  lng: number;
  /** exact / close: the street address was found. approx: only the ZIP code's center (never a driving target). */
  quality: PinQuality | null;
  geocodeAddress: string | null;
};

export type ProviderGeoData = { providers: ProviderGeo[]; truncated: boolean };

type Row = {
  address_id: number;
  provider_id: number;
  name: string;
  status: string | null;
  dispatch_phone: string | null;
  dispatch_email: string | null;
  website: string | null;
  coverage: string | null;
  label: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: unknown;
  longitude: unknown;
  geocode_match: string | null;
  geocode_address: string | null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const quality = (v: string | null): PinQuality | null => (v === "exact" || v === "close" || v === "approx" ? v : null);

const input = z.object({}).strict().optional();

/**
 * Service providers on the map: every provider on the Out of Network list (not archived, not marked Inactive) with a
 * pinned address, one entry per pinned address, the main address first. Bounded to MAX_PROVIDER_PINS.
 */
export const listProviderGeo = createServerFn({ method: "GET" })
  .middleware([deskMiddleware])
  .validator((d: z.input<typeof input>) => input.parse(d))
  .handler(async (): Promise<ProviderGeoData> => {
    const sql = await ready();
    const rows = await sql.query<Row>(
      `select a.id as address_id, p.id as provider_id, p.name, p.status, p.dispatch_phone, p.dispatch_email, p.website,
              p.coverage, a.label, a.line1, a.line2, a.city, a.state, a.zip, a.latitude, a.longitude, a.geocode_match,
              a.geocode_address
         from provider_addresses a
         join network_providers p on p.id = a.provider_id
        where p.archived = false
          and coalesce(p.status, '') <> 'Inactive'
          and a.latitude is not null and a.longitude is not null
        order by lower(p.name), p.id, (lower(coalesce(a.label, '')) = 'main') desc, a.id
        limit $1::int`,
      [MAX_PROVIDER_PINS + 1],
    );
    const providers: ProviderGeo[] = [];
    for (const r of rows.slice(0, MAX_PROVIDER_PINS)) {
      const lat = num(r.latitude);
      const lng = num(r.longitude);
      if (!isPoint({ lat, lng })) continue;
      providers.push({
        addressId: Number(r.address_id),
        providerId: Number(r.provider_id),
        name: String(r.name),
        status: r.status,
        dispatchPhone: r.dispatch_phone,
        dispatchEmail: r.dispatch_email,
        website: r.website,
        coverage: r.coverage,
        address: formatAddress({ line1: r.line1, line2: r.line2, city: r.city, state: r.state, zip: r.zip }),
        main: String(r.label ?? "").trim().toLowerCase() === "main",
        lat: lat!,
        lng: lng!,
        quality: quality(r.geocode_match),
        geocodeAddress: r.geocode_address,
      });
    }
    return { providers, truncated: rows.length > MAX_PROVIDER_PINS };
  });
