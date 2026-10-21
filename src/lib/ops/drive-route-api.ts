/**
 * Ask OSRM for drive times and a road line. The answer is not stored.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { deskMiddleware } from "@/lib/ops/access";
import { parseOsrmRoute, parseOsrmTable } from "@/lib/ops/drive-route";

const point = z.object({ lat: z.number(), lng: z.number() });
const pointsIn = z.object({ points: z.array(point).min(2).max(25) });

const OSRM = "https://router.project-osrm.org";

function coordPath(points: { lat: number; lng: number }[]): string {
  return points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(";");
}

async function osrm(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json", "User-Agent": "KatzDesk/1.0 (route planner; results are not stored)" },
  });
  if (!res.ok) throw new Error(`Driving route unavailable (${res.status})`);
  return res.json();
}

export const driveTable = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof pointsIn>) => pointsIn.parse(d))
  .handler(async ({ data }) => {
    const body = await osrm(`${OSRM}/table/v1/driving/${coordPath(data.points)}?annotations=duration,distance`);
    const table = parseOsrmTable(body, data.points.length);
    if (!table) throw new Error("Driving route unavailable");
    return table;
  });

export const driveLine = createServerFn({ method: "POST" })
  .middleware([deskMiddleware])
  .validator((d: z.infer<typeof pointsIn>) => pointsIn.parse(d))
  .handler(async ({ data }) => {
    const body = await osrm(`${OSRM}/route/v1/driving/${coordPath(data.points)}?overview=full&geometries=geojson&steps=false`);
    const line = parseOsrmRoute(body);
    if (!line) throw new Error("Driving route unavailable");
    return { line };
  });
