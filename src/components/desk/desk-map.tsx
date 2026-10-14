import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Map as PigeonMap, ZoomControl, type PigeonProps, type Point } from "pigeon-maps";
import { cn } from "@/lib/utils";
import { isPoint, type LatLng } from "@/lib/ops/geo";

/**
 * Street tiles from OpenStreetMap (free, attribution required: it is shown in the corner). To switch to another tile
 * provider, change this one function. Tiles load in the viewer's browser; pins and routes still draw if they fail.
 */
export function tileUrl(x: number, y: number, z: number, dpr?: number): string {
  void dpr;
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export type MapPin = {
  id: string | number;
  lat: number;
  lng: number;
  /** Fill color (hex). */
  color: string;
  /** Hollow ring instead of a filled dot: used for approximate (ZIP area) pins. */
  hollow?: boolean;
  /** Radius in px (default 6). */
  size?: number;
  /** Number drawn inside the dot (route stops). */
  label?: string;
  /** Native tooltip. */
  title?: string;
};

const HOUSTON: Point = [29.76, -95.37];

/** Web Mercator: the zoom that fits a lat/lng box into width × height pixels (with padding), capped. */
export function fitView(points: readonly LatLng[], width: number, height: number, opts: { pad?: number; maxZoom?: number } = {}): { center: Point; zoom: number } {
  const pts = points.filter(isPoint);
  if (!pts.length || width <= 0 || height <= 0) return { center: HOUSTON, zoom: 9 };
  const maxZoom = opts.maxZoom ?? 15;
  const pad = opts.pad ?? 40;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const center: Point = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
  if (pts.length === 1 || (maxLat - minLat < 1e-6 && maxLng - minLng < 1e-6)) return { center: [pts[0]!.lat, pts[0]!.lng], zoom: Math.min(maxZoom, 14) };
  const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const w = Math.max(1, width - pad * 2);
  const h = Math.max(1, height - pad * 2);
  const zLng = Math.log2((w * 360) / (256 * Math.max(1e-9, maxLng - minLng)));
  const zLat = Math.log2((h * 2 * Math.PI) / (256 * Math.max(1e-9, mercY(maxLat) - mercY(minLat))));
  const zoom = Math.max(3, Math.min(maxZoom, Math.floor(Math.min(zLng, zLat) * 4) / 4));
  return { center, zoom };
}

/** Draws pins (and an optional route line) as one SVG over the tiles. A child of the pigeon map. */
function PinLayer({
  pins,
  route,
  selectedId,
  onPinClick,
  latLngToPixel,
  mapState,
}: PigeonProps & { pins: readonly MapPin[]; route?: readonly LatLng[]; selectedId?: string | number | null; onPinClick?: (pin: MapPin) => void }) {
  if (!latLngToPixel || !mapState) return null;
  const { width, height } = mapState;
  const px = (p: { lat: number; lng: number }) => latLngToPixel([p.lat, p.lng]);
  const margin = 24;
  const visible = pins
    .map((p) => ({ p, xy: px(p) }))
    .filter(({ xy }) => xy[0] > -margin && xy[1] > -margin && xy[0] < width + margin && xy[1] < height + margin);
  // Selected pin last so it draws on top.
  visible.sort((a, b) => Number(a.p.id === selectedId) - Number(b.p.id === selectedId));
  const line = route && route.length > 1 ? route.map((p) => px(p).join(",")).join(" ") : null;
  return (
    <svg width={width} height={height} className="pointer-events-none absolute top-0 left-0" style={{ overflow: "visible" }} aria-hidden={false}>
      {line ? <polyline points={line} fill="none" stroke="var(--color-primary)" strokeWidth={3} strokeOpacity={0.75} strokeLinejoin="round" strokeDasharray="6 5" /> : null}
      {visible.map(({ p, xy }) => {
        const selected = p.id === selectedId;
        const r = (p.size ?? 6) + (selected ? 3 : 0) + (p.label ? 4 : 0);
        return (
          <g
            key={p.id}
            transform={`translate(${xy[0]},${xy[1]})`}
            className={cn("pigeon-click-block pigeon-drag-block", onPinClick && "cursor-pointer")}
            style={{ pointerEvents: onPinClick ? "auto" : "none" }}
            onClick={onPinClick ? (e) => (e.stopPropagation(), onPinClick(p)) : undefined}
            data-testid="map-pin"
            data-pin-id={String(p.id)}
          >
            {p.title ? <title>{p.title}</title> : null}
            {/* Larger invisible hit area for fingers. */}
            <circle r={Math.max(r + 6, 12)} fill="transparent" />
            {selected ? <circle r={r + 5} fill="none" stroke={p.color} strokeWidth={2} strokeOpacity={0.5} /> : null}
            <circle
              r={r}
              fill={p.hollow ? "var(--color-card)" : p.color}
              fillOpacity={p.hollow ? 0.85 : 0.92}
              stroke={p.hollow ? p.color : "var(--color-card)"}
              strokeWidth={p.hollow ? 2.5 : 1.5}
              strokeDasharray={p.hollow ? "3 2" : undefined}
            />
            {p.label ? (
              <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>
                {p.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/**
 * The desk's map: OpenStreetMap tiles, pins drawn as one layer, an optional route line, zoom buttons, and a view that
 * fits the pins. `fitKey` refits when it changes (e.g. a new filter); panning and zooming are otherwise left alone.
 * Dark mode dims the tiles so pins stay readable.
 */
export function DeskMap({
  pins,
  route,
  selectedId,
  onPinClick,
  fitKey,
  focus,
  className,
  children,
  label = "Map",
}: {
  pins: readonly MapPin[];
  route?: readonly LatLng[];
  selectedId?: string | number | null;
  onPinClick?: (pin: MapPin) => void;
  fitKey?: string;
  /** Pan to this point (zooming in a little) when it changes. */
  focus?: LatLng | null;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<{ center: Point; zoom: number } | null>(null);
  const lastFit = useRef<string | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => (s && Math.abs(s.w - r.width) < 1 && Math.abs(s.h - r.height) < 1 ? s : { w: Math.round(r.width), h: Math.round(r.height) }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => [...pins.map((p) => ({ lat: p.lat, lng: p.lng })), ...(route ?? [])], [pins, route]);
  const key = fitKey ?? String(pins.length);
  useEffect(() => {
    if (!size) return;
    if (lastFit.current === key && view) return;
    lastFit.current = key;
    setView(fitView(points, size.w, size.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the fit key or the box size changes
  }, [key, size]);

  useEffect(() => {
    if (!focus || !isPoint(focus)) return;
    setView((v) => ({ center: [focus.lat, focus.lng], zoom: Math.max(v?.zoom ?? 12, 13) }));
  }, [focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={box}
      className={cn("desk-map relative isolate overflow-hidden rounded-lg border border-border bg-muted", className)}
      role="region"
      aria-label={label}
      data-testid="desk-map"
    >
      {size && view ? (
        <PigeonMap
          width={size.w}
          height={size.h}
          center={view.center}
          zoom={view.zoom}
          provider={tileUrl}
          dprs={[1, 2]}
          minZoom={3}
          maxZoom={18}
          onBoundsChanged={({ center, zoom }) => setView({ center, zoom })}
          attribution={
            <span className="text-[10px]">
              ©{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                OpenStreetMap
              </a>
            </span>
          }
          attributionPrefix={false}
          twoFingerDrag={false}
          metaWheelZoom={false}
        >
          <PinLayer pins={pins} route={route} selectedId={selectedId} onPinClick={onPinClick} />
          <ZoomControl />
        </PigeonMap>
      ) : null}
      {children}
    </div>
  );
}
