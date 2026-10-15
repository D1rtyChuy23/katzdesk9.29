import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
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
  /** Dot (default) or diamond: diamonds mark Out of Network service providers on the customer map. */
  shape?: "circle" | "diamond";
};

/** A diamond around 0,0 with the same area as a dot of radius r. */
const diamondPath = (r: number) => {
  const d = Math.round(r * 1.25 * 100) / 100;
  return `M0 ${-d}L${d} 0L0 ${d}L${-d} 0Z`;
};

/** [lat, lng], or [x, y] in pixels. */
type Point = [number, number];
type View = { center: Point; zoom: number };

const HOUSTON: Point = [29.76, -95.37];
const TILE = 256;
const MIN_ZOOM = 3;
const MAX_ZOOM = 18;
/** Web Mercator stops here (the world is a square of tiles). */
const MAX_LAT = 85.0511287798066;
const ANIMATION_MS = 300;
const DOUBLE_TAP_MS = 300;
/** A press that moves less than this is a tap (it can open a pin); more is a drag. */
const DRAG_START_PX = 3;
/** The finger left on the screen after a pinch does not fling the map this soon after the other one lifts. */
const PINCH_RELEASE_FLING_MS = 300;
/** Pins are placed this far around the view (in screens, each way from its center) so a pan or zoom-out finds them. */
const PIN_MARGIN = 1.5;
/** A pin's drawn radius at most (selected, labeled), so one just outside the view still shows its edge. */
const PIN_REACH_PX = 20;
/** Wheel distance for one zoom level. */
const WHEEL_PX_PER_ZOOM = 150;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clampZoom = (z: number) => clamp(z, MIN_ZOOM, MAX_ZOOM);

// Web Mercator in world pixels: at zoom z the whole world is 256 × 2^z pixels square.
function lngToX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * TILE * 2 ** zoom;
}
function latToY(lat: number, zoom: number): number {
  const r = (clamp(lat, -MAX_LAT, MAX_LAT) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** zoom;
}
function xToLng(x: number, zoom: number): number {
  return (x / (TILE * 2 ** zoom)) * 360 - 180;
}
function yToLat(y: number, zoom: number): number {
  return (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * y) / (TILE * 2 ** zoom))) * 180) / Math.PI;
}
function clampCenter([lat, lng]: Point): Point {
  return [clamp(lat, -MAX_LAT, MAX_LAT), clamp(lng, -180, 180)];
}
/** The lat/lng under a pixel of a width × height map showing `view`. */
function pixelToLatLng([px, py]: Point, view: View, width: number, height: number): Point {
  const z = view.zoom;
  return clampCenter([yToLat(latToY(view.center[0], z) + py - height / 2, z), xToLng(lngToX(view.center[1], z) + px - width / 2, z)]);
}
/** The center that puts `latLng` under pixel `at` at this zoom (zooming "around" a point). */
function centerKeeping(latLng: Point, [px, py]: Point, zoom: number, width: number, height: number): Point {
  return clampCenter([yToLat(latToY(latLng[0], zoom) - (py - height / 2), zoom), xToLng(lngToX(latLng[1], zoom) - (px - width / 2), zoom)]);
}
function sameView(a: View, b: View): boolean {
  return a === b || (Math.abs(a.zoom - b.zoom) < 1e-6 && Math.abs(a.center[0] - b.center[0]) < 1e-9 && Math.abs(a.center[1] - b.center[1]) < 1e-9);
}
/** How many screens apart two views are (averaged over both zooms); far moves jump instead of animating. */
function screensApart(a: View, b: View, width: number, height: number): number {
  const gap = (z: number) => [Math.abs(lngToX(a.center[1], z) - lngToX(b.center[1], z)), Math.abs(latToY(a.center[0], z) - latToY(b.center[0], z))];
  const [x1, y1] = gap(a.zoom);
  const [x2, y2] = gap(b.zoom);
  return Math.hypot((x1! + x2!) / 2 / Math.max(1, width), (y1! + y2!) / 2 / Math.max(1, height));
}
/** Whether a width × height map showing `view` reaches past the pins placed around `around` (PIN_MARGIN screens). */
function outsidePins(view: View, around: View, width: number, height: number): boolean {
  const k = 2 ** (view.zoom - around.zoom);
  const dx = Math.abs(lngToX(view.center[1], around.zoom) - lngToX(around.center[1], around.zoom));
  const dy = Math.abs(latToY(view.center[0], around.zoom) - latToY(around.center[0], around.zoom));
  return dx + (width / 2 + PIN_REACH_PX) / k > width * PIN_MARGIN || dy + (height / 2 + PIN_REACH_PX) / k > height * PIN_MARGIN;
}
function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
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

/** One zoom level's block of tiles. Tiles load at the nearest whole zoom and are scaled to fractional zooms. */
type Level = { z: number; minX: number; maxX: number; minY: number; maxY: number };

/** The tiles that cover a width × height map showing `view`. */
function levelFor(view: View, width: number, height: number): Level {
  const z = Math.round(view.zoom);
  const s = 2 ** (view.zoom - z);
  const cx = lngToX(view.center[1], z);
  const cy = latToY(view.center[0], z);
  const hw = width / 2 / s;
  const hh = height / 2 / s;
  return { z, minX: Math.floor((cx - hw) / TILE), maxX: Math.floor((cx + hw) / TILE), minY: Math.floor((cy - hh) / TILE), maxY: Math.floor((cy + hh) / TILE) };
}

/** A level's tiles. x can run past the world's edge (it wraps around the globe); rows outside the world are skipped. */
function tilesOf(level: Level): { key: string; x: number; y: number }[] {
  const n = 2 ** level.z;
  const out: { key: string; x: number; y: number }[] = [];
  for (let x = level.minX; x <= level.maxX; x++) {
    for (let y = Math.max(0, level.minY); y <= Math.min(n - 1, level.maxY); y++) out.push({ key: `${level.z}/${x}/${y}`, x, y });
  }
  return out;
}

/**
 * Draws one level's tiles for the current view: a block of 256 px images, moved and scaled as one piece. A tile that
 * fails to load hides itself (no broken-image icon) and reports it.
 */
function TileGrid({ level, view, width, height, onDone }: { level: Level; view: View; width: number; height: number; onDone: (key: string, ok: boolean) => void }) {
  const n = 2 ** level.z;
  const s = 2 ** (view.zoom - level.z);
  let tx = width / 2 + s * (level.minX * TILE - lngToX(view.center[1], level.z));
  let ty = height / 2 + s * (level.minY * TILE - latToY(view.center[0], level.z));
  if (s === 1) {
    // Whole pixels keep unscaled tiles sharp.
    tx = Math.round(tx);
    ty = Math.round(ty);
  }
  return (
    <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${tx}px, ${ty}px)${s === 1 ? "" : ` scale(${s})`}`, transformOrigin: "0 0", willChange: "transform" }}>
      {tilesOf(level).map(({ key, x, y }) => (
        <img
          key={key}
          src={tileUrl(((x % n) + n) % n, y, level.z)}
          width={TILE}
          height={TILE}
          loading="lazy"
          draggable={false}
          alt=""
          data-tile={key}
          onLoad={() => onDone(key, true)}
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
            onDone(key, false);
          }}
          style={{ position: "absolute", left: (x - level.minX) * TILE, top: (y - level.minY) * TILE, width: TILE, height: TILE, maxWidth: "none" }}
        />
      ))}
    </div>
  );
}

const zoomButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 2,
  boxShadow: "0 1px 4px -1px rgba(0,0,0,.3)",
  background: "var(--color-card)",
  lineHeight: "26px",
  fontSize: 20,
  fontWeight: 700,
  color: "var(--color-foreground)",
  marginBottom: 1,
  border: "1px solid var(--color-border)",
  display: "block",
};

type Drag = {
  kind: "drag";
  id: number;
  start: Point;
  from: View;
  moved: boolean;
  samples: { t: number; at: Point }[];
  /** Set while the zoom from a pinch or double tap is still animating: its anchor pixel, which then moves with the finger. */
  follow: Point | null;
  /** No fling on release before this time (just after a pinch). */
  noFlingUntil: number;
};
type Pinch = { kind: "pinch"; startMid: Point; startDist: number; startZoom: number; anchor: Point; mid: Point; zoom: number };
type Gesture = Drag | Pinch;
type Animation = { from: View; to: View; around: { latLng: Point; at: Point } | null; start: number; ms: number };

/**
 * The slippy map itself: tiles, the pin layer, zoom buttons and attribution, with mouse, touch and wheel handling.
 * `view` is where the map should be; moving there animates (or jumps when far). Every pan or zoom by the viewer
 * reports the new view through `onViewChange` when it comes to rest.
 *
 * Drawing is split so a drag stays cheap: `cam` (what is on screen) changes every frame, while pin positions are worked
 * out once for `base` relative to its center, keeping pins within PIN_MARGIN screens of it. During a drag or zoom the
 * whole pin layer moves with one transform (scaled for zooms, with each pin scaled back so dots keep their size), so
 * ~2,600 pins are not re-placed on every frame. They are placed again when the map comes to rest, and mid-gesture only
 * when the view reaches past that margin (a pan of more than a screen, or zooming out more than about 1.5 levels).
 */
function MapSurface({
  width,
  height,
  view,
  onViewChange,
  onTiles,
  pins,
  route,
  selectedId,
  onPinClick,
}: {
  width: number;
  height: number;
  view: View;
  onViewChange: (v: View) => void;
  onTiles: (ok: boolean) => void;
  pins: readonly MapPin[];
  route?: readonly LatLng[];
  selectedId?: string | number | null;
  onPinClick?: (pin: MapPin) => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState(view);
  const [base, setBase] = useState(view);
  // Older zoom levels stay drawn under the newest one until its tiles have loaded, so zooming does not flash blank.
  const [oldLevels, setOldLevels] = useState<Level[]>([]);
  const live = useRef(view); // the camera right now (ahead of `cam` between frames)
  const shown = useRef(view); // the camera last handed to React
  const placed = useRef(view); // mirrors `base`
  const settled = useRef(view); // the view last reported through onViewChange
  const latest = useRef({ width, height, onViewChange, onTiles, onPinClick });
  useEffect(() => {
    latest.current = { width, height, onViewChange, onTiles, onPinClick };
  });

  // The gesture and animation engine. It only touches refs and state setters, so it is made once.
  const engine = useMemo(() => {
    let frame: number | null = null;
    let animFrame: number | null = null;
    let anim: Animation | null = null;
    const pointers = new Map<number, Point>();
    let gesture: Gesture | null = null;
    let lastTap: { t: number; at: Point } | null = null;
    let rect: DOMRect | null = null;
    let pending = new Set<string>(); // newest level's tiles still loading
    let pinDown: Point | null = null;
    // Views this map reported itself. The owner hands each one back as `view`; that echo is not a request to move.
    const reported = new WeakSet<View>();
    let watching = false; // window listens for pointer releases while any pointer is down

    /** Tiles drawn right now that have finished (loaded or failed). Unmounted tiles do not count: a new <img> must load. */
    function finishedTiles(): Set<string> {
      const out = new Set<string>();
      surface.current?.querySelectorAll<HTMLImageElement>("img[data-tile]").forEach((img) => {
        if (img.complete && img.dataset.tile) out.add(img.dataset.tile);
      });
      return out;
    }

    function flush() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      const next = live.current;
      const prev = shown.current;
      if (next === prev) return;
      const { width: w, height: h } = latest.current;
      if (Math.round(next.zoom) !== Math.round(prev.zoom)) {
        const now = levelFor(next, w, h);
        const finished = finishedTiles();
        pending = new Set(tilesOf(now).map((t) => t.key).filter((k) => !finished.has(k)));
        if (pending.size) {
          const before = levelFor(prev, w, h);
          setOldLevels((old) => [...old.filter((l) => l.z !== now.z && l.z !== before.z && Math.abs(l.z - now.z) <= 4).slice(-2), before]);
        } else setOldLevels((old) => (old.length ? [] : old));
      } else if (pending.size) {
        // Tiles that left the view (e.g. later in a zoom animation) will never finish; stop waiting for them.
        const inView = new Set(tilesOf(levelFor(next, w, h)).map((t) => t.key));
        for (const k of pending) if (!inView.has(k)) pending.delete(k);
        if (!pending.size) setOldLevels((old) => (old.length ? [] : old));
      }
      // Once the view reaches past the pins placed around `base` (a long pan, or zooming out), place them again now.
      // During an animation, place them for where it ends if that covers this frame too (a zoom-out always does), so
      // they are not placed once more on arrival.
      if (outsidePins(next, placed.current, w, h)) {
        const to = anim?.to;
        const around = to && !outsidePins(next, to, w, h) ? to : next;
        placed.current = around;
        setBase(around);
      }
      shown.current = next;
      setCam(next);
    }
    function show(v: View) {
      live.current = v;
      if (frame === null) frame = requestAnimationFrame(flush);
    }
    /** The map came to rest: place the pins for this view and tell the owner. */
    function settle() {
      flush();
      const v = live.current;
      if (!sameView(v, placed.current)) {
        placed.current = v;
        setBase(v);
      }
      if (sameView(v, settled.current)) return;
      settled.current = v;
      reported.add(v);
      latest.current.onViewChange(v);
    }

    function stopAnimation() {
      if (animFrame !== null) cancelAnimationFrame(animFrame);
      animFrame = null;
      anim = null;
    }
    function step(now: number) {
      const a = anim;
      if (!a) return;
      const t = Math.min(1, Math.max(0, now - a.start) / a.ms);
      if (t >= 1) {
        anim = null;
        animFrame = null;
        live.current = a.to;
        const g = gesture;
        const at = g?.kind === "drag" ? pointers.get(g.id) : undefined;
        if (g?.kind === "drag" && at) {
          // A finger is still down after a pinch or double tap: it pans on from here, and the map rests when it lifts.
          g.from = a.to;
          g.start = at;
          g.follow = null;
          flush();
          return;
        }
        settle();
        return;
      }
      const e = t * (2 - t); // ease out
      const zoom = a.from.zoom + (a.to.zoom - a.from.zoom) * e;
      const { width: w, height: h } = latest.current;
      const center: Point = a.around
        ? centerKeeping(a.around.latLng, a.around.at, zoom, w, h)
        : [a.from.center[0] + (a.to.center[0] - a.from.center[0]) * e, a.from.center[1] + (a.to.center[1] - a.from.center[1]) * e];
      live.current = { center, zoom };
      flush();
      animFrame = requestAnimationFrame(step);
    }
    function animateTo(to: View, around: Animation["around"], ms = ANIMATION_MS) {
      stopAnimation();
      if (reducedMotion()) {
        live.current = to;
        settle();
        return;
      }
      anim = { from: live.current, to, around, start: performance.now(), ms: Math.max(1, ms) };
      animFrame = requestAnimationFrame(step);
    }
    /** Zoom to `zoom`, keeping the place under pixel `at` where it is. */
    function zoomAround(at: Point, zoom: number) {
      const { width: w, height: h } = latest.current;
      const latLng = pixelToLatLng(at, live.current, w, h);
      animateTo({ center: centerKeeping(latLng, at, zoom, w, h), zoom }, { latLng, at });
    }
    function zoomBy(delta: number) {
      const target = anim?.to ?? live.current;
      animateTo({ center: target.center, zoom: clampZoom(target.zoom + delta) }, null);
    }
    /** The owner asked for a new view (fit to pins, focus on a pin). */
    function goTo(v: View) {
      // A view the map reported comes back from the owner a frame or more later; by then a new zoom may have started.
      if (reported.has(v) || sameView(anim?.to ?? live.current, v)) return;
      pointers.clear();
      watchRelease(false);
      gesture = null;
      const { width: w, height: h } = latest.current;
      if (screensApart(live.current, v, w, h) <= 5) animateTo(v, null);
      else {
        stopAnimation();
        live.current = v;
        settle();
      }
    }

    const local = (e: { clientX: number; clientY: number }): Point => {
      const r = rect ?? surface.current?.getBoundingClientRect();
      return r ? [e.clientX - r.left, e.clientY - r.top] : [0, 0];
    };
    const capture = (id: number) => {
      try {
        surface.current?.setPointerCapture(id);
      } catch {
        // The pointer is already gone.
      }
    };
    function startPinch() {
      const [a, b] = [...pointers.values()] as [Point, Point];
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const { width: w, height: h } = latest.current;
      gesture = {
        kind: "pinch",
        startMid: mid,
        startDist: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])),
        startZoom: live.current.zoom,
        anchor: pixelToLatLng(mid, live.current, w, h),
        mid,
        zoom: live.current.zoom,
      };
      lastTap = null;
    }
    /** One finger (or the mouse) panning from `at`. If a zoom animation is running, the finger moves its anchor. */
    function dragFrom(id: number, at: Point, noFlingUntil = 0): Drag {
      const now = performance.now();
      return { kind: "drag", id, start: at, from: live.current, moved: false, samples: [{ t: now, at }], follow: anim?.around?.at ?? null, noFlingUntil };
    }
    /**
     * A press always ends, even when it is released outside the map or over an overlay on it (the map only captures
     * the pointer once a drag starts, so a plain tap still reaches a pin).
     */
    function onWindowRelease(e: PointerEvent) {
      release(e.pointerId, e.type === "pointerup");
    }
    function watchRelease(on: boolean) {
      if (on === watching || typeof window === "undefined") return;
      watching = on;
      for (const type of ["pointerup", "pointercancel"] as const) {
        if (on) window.addEventListener(type, onWindowRelease);
        else window.removeEventListener(type, onWindowRelease);
      }
    }
    /** A fast drag keeps gliding when released (unless the pointer stopped first). */
    function fling(g: Drag): boolean {
      if (reducedMotion()) return false;
      const now = performance.now();
      const first = g.samples[0];
      const last = g.samples[g.samples.length - 1];
      if (!first || !last || now - last.t > 50 || last.t - first.t < 8) return false;
      const dt = last.t - first.t;
      let dx = ((last.at[0] - first.at[0]) / dt) * 120;
      let dy = ((last.at[1] - first.at[1]) / dt) * 120;
      let dist = Math.hypot(dx, dy);
      if (dist <= 40) return false;
      const { width: w, height: h } = latest.current;
      const diagonal = Math.hypot(w, h);
      if (dist > diagonal) {
        dx *= diagonal / dist;
        dy *= diagonal / dist;
        dist = diagonal;
      }
      const v = live.current;
      const center = clampCenter([yToLat(latToY(v.center[0], v.zoom) - dy, v.zoom), xToLng(lngToX(v.center[1], v.zoom) - dx, v.zoom)]);
      animateTo({ center, zoom: v.zoom }, null, (1500 * dist) / diagonal);
      return true;
    }
    function release(id: number, canFling: boolean) {
      if (!pointers.delete(id)) return;
      const g = gesture;
      const left = pointers.size;
      if (!left) watchRelease(false);
      if (g?.kind === "pinch") {
        if (left >= 2) {
          startPinch(); // a third finger lifted: carry on with the other two
          return;
        }
        // Snap to a whole zoom level (sharp tiles) around the pinch center.
        const snap = Math.abs(g.zoom - g.startZoom) >= 0.05;
        if (snap) zoomAround(g.mid, clampZoom(g.zoom > g.startZoom ? Math.ceil(g.zoom) : Math.floor(g.zoom)));
        const rest = [...pointers.entries()][0];
        // The finger still down keeps panning the map.
        gesture = rest ? dragFrom(rest[0], rest[1], performance.now() + PINCH_RELEASE_FLING_MS) : null;
        if (!snap && !left) settle();
        return;
      }
      if (left) return;
      gesture = null;
      rect = null;
      // No fling while a zoom is still animating (after a pinch or double tap): it finishes and rests on its own.
      if (g?.kind === "drag" && g.moved && canFling && !anim && performance.now() >= g.noFlingUntil && fling(g)) return;
      if (!anim) settle();
    }

    return {
      goTo,
      zoomBy,
      dispose() {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        stopAnimation();
        pointers.clear();
        gesture = null;
        watchRelease(false);
      },
      onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const target = e.target as Element;
        if (target.closest("button, a")) return;
        if (e.pointerType === "mouse") {
          e.preventDefault(); // no text selection while dragging
          pointers.clear(); // a mouse has one pointer; drop any that never reported its release
        }
        if (!pointers.size) rect = surface.current?.getBoundingClientRect() ?? null;
        const at = local(e);
        pointers.set(e.pointerId, at);
        watchRelease(true);
        stopAnimation(); // a zoom or glide in progress stops where it is
        if (pointers.size === 1) {
          const now = performance.now();
          const prev = lastTap;
          if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(at[0] - prev.at[0], at[1] - prev.at[1]) < 30 && !target.closest("[data-pin-id]")) {
            lastTap = null;
            zoomAround(at, clampZoom(live.current.zoom + 1));
            gesture = dragFrom(e.pointerId, at); // the finger can pan while it zooms
            return;
          }
          lastTap = { t: now, at };
          gesture = dragFrom(e.pointerId, at);
        } else if (pointers.size === 2) {
          startPinch();
          for (const id of pointers.keys()) capture(id);
        }
      },
      onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
        if (!pointers.has(e.pointerId)) return;
        if (e.pointerType === "mouse" && e.buttons === 0) {
          // The button came up where no release reached us (e.g. outside the preview frame): the press is over.
          release(e.pointerId, false);
          return;
        }
        const at = local(e);
        pointers.set(e.pointerId, at);
        const g = gesture;
        if (g?.kind === "drag" && g.id === e.pointerId) {
          const dx = at[0] - g.start[0];
          const dy = at[1] - g.start[1];
          if (!g.moved) {
            if (Math.abs(dx) + Math.abs(dy) < DRAG_START_PX) return;
            // Capture only once it is a drag, so a plain tap still reaches the pin under it as a click.
            g.moved = true;
            lastTap = null;
            capture(e.pointerId);
          }
          const now = performance.now();
          g.samples.push({ t: now, at });
          while (g.samples.length > 2 && now - g.samples[0]!.t > 100) g.samples.shift();
          if (g.follow) {
            if (anim?.around) {
              // The zoom from a pinch or double tap is still animating: carry its anchor with the finger (step() draws it).
              const { width: w, height: h } = latest.current;
              const around = { latLng: anim.around.latLng, at: [g.follow[0] + dx, g.follow[1] + dy] as Point };
              anim.around = around;
              anim.to = { center: centerKeeping(around.latLng, around.at, anim.to.zoom, w, h), zoom: anim.to.zoom };
              return;
            }
            // That zoom was stopped some other way: pan on from where the map is now.
            g.from = live.current;
            g.start = at;
            g.follow = null;
            return;
          }
          const z = g.from.zoom;
          show({ center: clampCenter([yToLat(latToY(g.from.center[0], z) - dy, z), xToLng(lngToX(g.from.center[1], z) - dx, z)]), zoom: z });
        } else if (g?.kind === "pinch" && pointers.size >= 2) {
          const [a, b] = [...pointers.values()] as [Point, Point];
          const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
          const zoom = clampZoom(g.startZoom + Math.log2(Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1])) / g.startDist));
          g.mid = mid;
          g.zoom = zoom;
          const { width: w, height: h } = latest.current;
          show({ center: centerKeeping(g.anchor, mid, zoom, w, h), zoom });
        }
      },
      onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
        release(e.pointerId, e.type === "pointerup");
      },
      onLostPointerCapture(e: ReactPointerEvent<HTMLDivElement>) {
        // Only the map's own capture: a tile or pin losing its implicit touch capture is normal.
        if (e.target === e.currentTarget) release(e.pointerId, false);
      },
      onWheel(e: WheelEvent) {
        e.preventDefault(); // zoom the map, not scroll the page
        if (pointers.size) return;
        const r = surface.current?.getBoundingClientRect();
        if (!r) return;
        const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
        const diff = (-e.deltaY * unit) / WHEEL_PX_PER_ZOOM;
        const z = live.current.zoom;
        if (!diff || (z <= MIN_ZOOM && diff < 0) || (z >= MAX_ZOOM && diff > 0)) return;
        // Each wheel turn lands on a whole zoom level (sharp tiles), around the cursor.
        zoomAround([e.clientX - r.left, e.clientY - r.top], clampZoom(diff < 0 ? Math.floor(z + diff) : Math.ceil(z + diff)));
      },
      onTileDone(key: string, ok: boolean) {
        latest.current.onTiles(ok);
        if (pending.delete(key) && !pending.size) setOldLevels((old) => (old.length ? [] : old));
      },
      onPinPointerDown(e: ReactPointerEvent<SVGGElement>) {
        pinDown = [e.clientX, e.clientY];
      },
      onPinClick(e: ReactMouseEvent<SVGGElement>, pin: MapPin) {
        e.stopPropagation();
        const d = pinDown;
        pinDown = null;
        if (d && Math.abs(e.clientX - d[0]) + Math.abs(e.clientY - d[1]) > 4) return; // a drag, not a tap
        latest.current.onPinClick?.(pin);
      },
    };
  }, []);

  useEffect(() => () => engine.dispose(), [engine]);
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    el.addEventListener("wheel", engine.onWheel, { passive: false });
    return () => el.removeEventListener("wheel", engine.onWheel);
  }, [engine]);
  useEffect(() => {
    engine.goTo(view);
  }, [engine, view]);

  // Pins and the route, placed for `base` relative to its center. Selected pin last so it draws on top.
  const clickable = !!onPinClick;
  const layer = useMemo(() => {
    const z = base.zoom;
    const bx = lngToX(base.center[1], z);
    const by = latToY(base.center[0], z);
    const rel = (p: { lat: number; lng: number }): Point => [lngToX(p.lng, z) - bx, latToY(p.lat, z) - by];
    // Keep one extra screen on every side, so pins dragged into view are already there (flush() places them again
    // before the view gets past this).
    const visible = pins.map((p) => ({ p, xy: rel(p) })).filter(({ xy }) => Math.abs(xy[0]) < width * PIN_MARGIN && Math.abs(xy[1]) < height * PIN_MARGIN);
    visible.sort((a, b) => Number(a.p.id === selectedId) - Number(b.p.id === selectedId));
    const line = route && route.length > 1 ? route.map((p) => rel(p).join(",")).join(" ") : null;
    return (
      <>
        {line ? (
          <polyline points={line} fill="none" stroke="var(--color-primary)" strokeWidth={3} strokeOpacity={0.75} strokeLinejoin="round" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        ) : null}
        {visible.map(({ p, xy }) => {
          const selected = p.id === selectedId;
          const r = (p.size ?? 6) + (selected ? 3 : 0) + (p.label ? 4 : 0);
          return (
            <g
              key={p.id}
              transform={`translate(${xy[0]},${xy[1]})`}
              className={cn(clickable && "cursor-pointer")}
              style={{ pointerEvents: clickable ? "auto" : "none" }}
              onPointerDown={clickable ? engine.onPinPointerDown : undefined}
              onClick={clickable ? (e) => engine.onPinClick(e, p) : undefined}
              data-testid="map-pin"
              data-pin-id={String(p.id)}
            >
              {p.title ? <title>{p.title}</title> : null}
              {/* Scaled back while the map zooms, so dots keep their size. */}
              <g style={{ transform: "scale(var(--pin-k, 1))" }}>
                {/* Larger invisible hit area for fingers. */}
                <circle r={Math.max(r + 4, 10)} fill="transparent" />
                {p.shape === "diamond" ? (
                  <>
                    {selected ? <path d={diamondPath(r + 5)} fill="none" stroke={p.color} strokeWidth={2} strokeOpacity={0.5} strokeLinejoin="round" /> : null}
                    <path
                      d={diamondPath(r)}
                      fill={p.hollow ? "var(--color-card)" : p.color}
                      fillOpacity={p.hollow ? 0.85 : 0.95}
                      stroke={p.hollow ? p.color : "var(--color-card)"}
                      strokeWidth={p.hollow ? 2.5 : 1.5}
                      strokeDasharray={p.hollow ? "3 2" : undefined}
                      strokeLinejoin="round"
                      data-pin-shape="diamond"
                    />
                  </>
                ) : (
                  <>
                    {selected ? <circle r={r + 5} fill="none" stroke={p.color} strokeWidth={2} strokeOpacity={0.5} /> : null}
                    <circle
                      r={r}
                      fill={p.hollow ? "var(--color-card)" : p.color}
                      fillOpacity={p.hollow ? 0.85 : 0.92}
                      stroke={p.hollow ? p.color : "var(--color-card)"}
                      strokeWidth={p.hollow ? 2.5 : 1.5}
                      strokeDasharray={p.hollow ? "3 2" : undefined}
                    />
                  </>
                )}
                {p.label ? (
                  <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill={p.hollow ? p.color : "#fff"} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {p.label}
                  </text>
                ) : null}
              </g>
            </g>
          );
        })}
      </>
    );
  }, [pins, route, selectedId, clickable, base, width, height, engine]);

  // Where `base`'s center is on screen now, and how much the view has zoomed since.
  const k = 2 ** (cam.zoom - base.zoom);
  const ox = width / 2 + k * (lngToX(base.center[1], base.zoom) - lngToX(cam.center[1], base.zoom));
  const oy = height / 2 + k * (latToY(base.center[0], base.zoom) - latToY(cam.center[0], base.zoom));
  const level = levelFor(cam, width, height);

  return (
    <div
      ref={surface}
      className="absolute inset-0 touch-none select-none"
      onPointerDown={engine.onPointerDown}
      onPointerMove={engine.onPointerMove}
      onPointerUp={engine.onPointerUp}
      onPointerCancel={engine.onPointerUp}
      onLostPointerCapture={engine.onLostPointerCapture}
      data-testid="desk-map-surface"
    >
      <div className="desk-map-tiles absolute inset-0">
        {/* One keyed list, newest level last (on top): a level moving between "current" and "older" keeps its loaded images. */}
        {[...oldLevels.filter((l) => l.z !== level.z && Math.abs(l.z - level.z) <= 4), level].map((l) => (
          <TileGrid key={l.z} level={l} view={cam} width={width} height={height} onDone={engine.onTileDone} />
        ))}
      </div>
      <svg width={width} height={height} className="pointer-events-none absolute top-0 left-0" style={{ overflow: "visible", "--pin-k": 1 / k } as CSSProperties}>
        <g transform={k === 1 ? `translate(${ox},${oy})` : `translate(${ox},${oy}) scale(${k})`}>{layer}</g>
      </svg>
      <div className="absolute top-2.5 left-2.5">
        <button type="button" aria-label="Zoom in" style={zoomButtonStyle} onClick={() => engine.zoomBy(1)}>
          +
        </button>
        <button type="button" aria-label="Zoom out" style={zoomButtonStyle} onClick={() => engine.zoomBy(-1)}>
          –
        </button>
      </div>
      <div className="absolute right-0 bottom-0 bg-card/70 px-[5px] py-[2px] text-foreground" style={{ fontSize: 11, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
        <span className="text-[10px]">
          ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            OpenStreetMap
          </a>
        </span>
      </div>
    </div>
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
  fitToOnly,
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
  /** Fit to fitTo only: when it is empty the map shows the default view instead of fitting every pin. */
  fitToOnly?: boolean;
  /** Pan to this point (zooming in a little) whenever a new focus object is passed. Keep it in state. */
  focus?: LatLng | null;
  className?: string;
  children?: ReactNode;
  label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const lastFit = useRef<string | null>(null);
  // Street tiles: once one loads the map is fine; if only failures arrive, say so (pins and routes still work).
  const [tiles, setTiles] = useState<"unknown" | "ok" | "failed">("unknown");
  const onTiles = useCallback((ok: boolean) => setTiles((cur) => (cur === "ok" ? cur : ok ? "ok" : "failed")), []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      // Inside the border, and unaffected by transforms (e.g. a sheet sliding in). A hidden map waits until it shows.
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
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
    setView(fitView(fitTo?.length || fitToOnly ? fitTo ?? [] : points, size.w, size.h));
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
        <MapSurface
          width={size.w}
          height={size.h}
          view={view}
          onViewChange={setView}
          onTiles={onTiles}
          pins={pins}
          route={route}
          selectedId={selectedId}
          onPinClick={onPinClick}
        />
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
