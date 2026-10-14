import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Map as PigeonMap, ZoomControl, type PigeonProps, type Point, type TileComponent } from "pigeon-maps";
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

/** Tile status reported to the map so it can say when the street map could not load. */
type TileReport = (ok: boolean) => void;

/** pigeon's tile image, plus: a tile that fails to load hides itself instead of showing a broken-image icon. */
function tileWithStatus(report: TileReport): TileComponent {
  return function Tile({ tile, tileLoaded }) {
    return (
      <img
        src={tile.url}
        srcSet={tile.srcSet}
        width={tile.width}
        height={tile.height}
        loading="lazy"
        alt=""
        onLoad={() => {
          report(true);
          tileLoaded();
        }}
        onError={(e) => {
          e.currentTarget.style.visibility = "hidden";
          report(false);
          tileLoaded();
        }}
        style={{ position: "absolute", left: tile.left, top: tile.top, willChange: "transform", transformOrigin: "top left", opacity: 1 }}
      />
    );
  };
}

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

/**
 * Draws pins (and an optional route line) as one SVG over the tiles. A child of the pigeon map.
 * Pin positions are worked out once per view (pins, zoom, center, size, selection) relative to the map center; while
 * the map is dragged pigeon only shifts that center, so the whole layer moves with one transform instead of
 * re-placing ~2,600 pins on every frame. Pins do not block dragging or pinching (pigeon's own Marker behaves the
 * same way); a tap still opens the pin, and a mouse drag that happens to end on a pin does not count as a tap.
 */
function PinLayer({
  pins,
  route,
  selectedId,
  onPinClick,
  latLngToPixel,
  mapState,
}: PigeonProps & { pins: readonly MapPin[]; route?: readonly LatLng[]; selectedId?: string | number | null; onPinClick?: (pin: MapPin) => void }) {
  const down = useRef<{ x: number; y: number } | null>(null);
  const zoom = mapState?.zoom ?? 0;
  const cLat = mapState?.center[0] ?? 0;
  const cLng = mapState?.center[1] ?? 0;
  const width = mapState?.width ?? 0;
  const height = mapState?.height ?? 0;
  const layer = useMemo(() => {
    if (!latLngToPixel) return null;
    const origin = latLngToPixel([cLat, cLng]);
    const rel = (p: { lat: number; lng: number }): Point => {
      const xy = latLngToPixel([p.lat, p.lng]);
      return [xy[0] - origin[0], xy[1] - origin[1]];
    };
    // Keep one extra screen on every side, so pins dragged into view are already there until pigeon settles.
    const mx = width;
    const my = height;
    const visible = pins
      .map((p) => ({ p, xy: rel(p) }))
      .filter(({ xy }) => Math.abs(xy[0]) < width / 2 + mx && Math.abs(xy[1]) < height / 2 + my);
    // Selected pin last so it draws on top.
    visible.sort((a, b) => Number(a.p.id === selectedId) - Number(b.p.id === selectedId));
    const line = route && route.length > 1 ? route.map((p) => rel(p).join(",")).join(" ") : null;
    return (
      <>
        {line ? <polyline points={line} fill="none" stroke="var(--color-primary)" strokeWidth={3} strokeOpacity={0.75} strokeLinejoin="round" strokeDasharray="6 5" /> : null}
        {visible.map(({ p, xy }) => {
          const selected = p.id === selectedId;
          const r = (p.size ?? 6) + (selected ? 3 : 0) + (p.label ? 4 : 0);
          return (
            <g
              key={p.id}
              transform={`translate(${xy[0]},${xy[1]})`}
              className={cn("pigeon-click-block", onPinClick && "cursor-pointer")}
              style={{ pointerEvents: onPinClick ? "auto" : "none" }}
              onPointerDown={onPinClick ? (e) => void (down.current = { x: e.clientX, y: e.clientY }) : undefined}
              onClick={
                onPinClick
                  ? (e) => {
                      e.stopPropagation();
                      const d = down.current;
                      down.current = null;
                      if (d && Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) return; // a drag, not a tap
                      onPinClick(p);
                    }
                  : undefined
              }
              data-testid="map-pin"
              data-pin-id={String(p.id)}
            >
              {p.title ? <title>{p.title}</title> : null}
              {/* Larger invisible hit area for fingers. */}
              <circle r={Math.max(r + 4, 10)} fill="transparent" />
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
                <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill={p.hollow ? p.color : "#fff"} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </>
    );
    // latLngToPixel is a new function on every pigeon render; the view it depends on is in zoom / center / size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, route, selectedId, onPinClick, zoom, cLat, cLng, width, height]);
  if (!latLngToPixel || !mapState || !layer) return null;
  const origin = latLngToPixel([cLat, cLng]);
  return (
    <svg width={width} height={height} className="pointer-events-none absolute top-0 left-0" style={{ overflow: "visible" }}>
      <g transform={`translate(${origin[0]},${origin[1]})`}>{layer}</g>
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
  fitTo,
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
  /** Fit to these points instead of every pin when fitKey changes (e.g. one rep's accounts). */
  fitTo?: readonly LatLng[] | null;
  /** Pan to this point (zooming in a little) whenever a new focus object is passed. Keep it in state. */
  focus?: LatLng | null;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<{ center: Point; zoom: number } | null>(null);
  const lastFit = useRef<string | null>(null);
  // Street tiles: once one loads the map is fine; if only failures arrive, say so (pins and routes still work).
  const [tiles, setTiles] = useState<"unknown" | "ok" | "failed">("unknown");
  const tileComponent = useMemo(
    () => tileWithStatus((ok) => setTiles((cur) => (cur === "ok" ? cur : ok ? "ok" : "failed"))),
    [],
  );

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
    setView(fitView(fitTo?.length ? fitTo : points, size.w, size.h));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refit only when the fit key or the box size changes
  }, [key, size]);

  // Each new focus object pans the map, even to the same point again (after the user has panned away). Callers keep
  // focus in state, so it only changes when they ask for a pan.
  useEffect(() => {
    if (!focus || !isPoint(focus)) return;
    setView((v) => ({ center: [focus.lat, focus.lng], zoom: Math.max(v?.zoom ?? 12, 13) }));
  }, [focus]);

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
          tileComponent={tileComponent}
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
          <ZoomControl
            buttonStyle={{
              background: "var(--color-card)",
              color: "var(--color-foreground)",
              border: "1px solid var(--color-border)",
              width: 32,
              height: 32,
            }}
          />
        </PigeonMap>
      ) : null}
      {tiles === "failed" ? (
        <p className="pointer-events-none absolute bottom-2 left-2 z-10 rounded-sm bg-card/90 px-2 py-1 text-xs text-muted-foreground" data-testid="desk-map-tiles-failed">
          The street map could not load. Pins still show.
        </p>
      ) : null}
      {children}
    </div>
  );
}
