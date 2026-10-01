import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Product-style picture of a NEMA plug face (black molded body, nickel blades), drawn in SVG
 * from the NEMA chart blade layout — no image files to host, scales crisply, works offline.
 * Locking (twist-lock) faces: L5-15/20/30, L6-20/30, L14-20/30. Straight: 5-15/20, 6-20/30/50.
 */
type Blade =
  | { kind: "arc"; at: number; span?: number; letter?: string; ground?: boolean }
  | { kind: "rect"; x: number; y: number; w: number; h: number; letter?: string; tee?: "h" | "v" }
  | { kind: "pin"; x: number; y: number };

const LOCK: Record<string, Blade[]> = {
  // Angles in degrees, 0 = right, 90 = down. Layout follows the locking-plug column of the NEMA chart.
  "L5-15": [
    { kind: "arc", at: -125, letter: "W" },
    { kind: "arc", at: 125 },
    { kind: "arc", at: 0, ground: true, letter: "G" },
  ],
  "L5-20": [
    { kind: "arc", at: -130, letter: "W" },
    { kind: "arc", at: 140 },
    { kind: "arc", at: 5, ground: true, letter: "G" },
  ],
  "L5-30": [
    { kind: "arc", at: -135, letter: "W" },
    { kind: "arc", at: 135 },
    { kind: "arc", at: 0, ground: true, letter: "G" },
  ],
  "L6-20": [
    { kind: "arc", at: -125, letter: "X" },
    { kind: "arc", at: 105, letter: "Y" },
    { kind: "arc", at: 0, ground: true, letter: "G" },
  ],
  "L6-30": [
    { kind: "arc", at: -90, letter: "X" },
    { kind: "arc", at: 160, letter: "Y" },
    { kind: "arc", at: 20, ground: true, letter: "G" },
  ],
  "L14-20": [
    { kind: "arc", at: -90, span: 34, letter: "X" },
    { kind: "arc", at: 180, span: 34, letter: "W" },
    { kind: "arc", at: 90, span: 34, letter: "Y" },
    { kind: "arc", at: 0, span: 34, ground: true, letter: "G" },
  ],
  "L14-30": [
    { kind: "arc", at: -90, span: 34, letter: "X" },
    { kind: "arc", at: 180, span: 34, letter: "W" },
    { kind: "arc", at: 90, span: 34, letter: "Y" },
    { kind: "arc", at: 0, span: 34, ground: true, letter: "G" },
  ],
};

const STRAIGHT: Record<string, Blade[]> = {
  "5-15": [
    { kind: "pin", x: 0, y: -26 },
    { kind: "rect", x: -17, y: 6, w: 7, h: 26 },
    { kind: "rect", x: 10, y: 6, w: 9, h: 26, letter: "W" },
  ],
  "5-20": [
    { kind: "pin", x: 0, y: -26 },
    { kind: "rect", x: -26, y: 14, w: 26, h: 7, tee: "h" },
    { kind: "rect", x: 10, y: 6, w: 9, h: 26, letter: "W" },
  ],
  "6-20": [
    { kind: "pin", x: 0, y: -26 },
    { kind: "rect", x: -26, y: 14, w: 26, h: 7 },
    { kind: "rect", x: 10, y: 6, w: 7, h: 26 },
  ],
  "6-30": [
    { kind: "pin", x: 0, y: -26 },
    { kind: "rect", x: -32, y: 12, w: 26, h: 7 },
    { kind: "rect", x: 6, y: 12, w: 26, h: 7 },
  ],
  "6-50": [
    { kind: "pin", x: 0, y: -28 },
    { kind: "rect", x: -26, y: -6, w: 8, h: 34 },
    { kind: "rect", x: 18, y: -6, w: 8, h: 34 },
  ],
};

export function hasPlugFace(nema: string | null | undefined): boolean {
  return !!nema && (nema in LOCK || nema in STRAIGHT);
}

function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}

/** A curved locking blade along radius r, spanning `span` degrees around `at`. */
function arcBlade(at: number, span: number, r: number, ground: boolean) {
  const a0 = at - span / 2;
  const a1 = at + span / 2;
  const t = 5.6; // half thickness
  const o0 = polar(r + t, a0);
  const o1 = polar(r + t, a1);
  const i1 = polar(r - t, a1);
  const i0 = polar(r - t, a0);
  let d = `M ${o0.x} ${o0.y} A ${r + t} ${r + t} 0 0 1 ${o1.x} ${o1.y} L ${i1.x} ${i1.y} A ${r - t} ${r - t} 0 0 0 ${i0.x} ${i0.y} Z`;
  if (ground) {
    // Ground blade: bent L tab pointing inward at one end — the part that makes it lock.
    const f0 = polar(r - t, a1);
    const f1 = polar(r - 15, a1);
    const f2 = polar(r - 15, a1 - 11);
    const f3 = polar(r - t, a1 - 11);
    d += ` M ${f0.x} ${f0.y} L ${f1.x} ${f1.y} L ${f2.x} ${f2.y} L ${f3.x} ${f3.y} Z`;
  } else {
    // Hot/neutral blades have a small locking foot on the outside edge.
    const f0 = polar(r + t, a0);
    const f1 = polar(r + t + 6, a0);
    const f2 = polar(r + t + 6, a0 + 9);
    const f3 = polar(r + t, a0 + 9);
    d += ` M ${f0.x} ${f0.y} L ${f1.x} ${f1.y} L ${f2.x} ${f2.y} L ${f3.x} ${f3.y} Z`;
  }
  return d;
}

export function PlugFace({ nema, className, title }: { nema: string; className?: string; title?: string }) {
  const uid = useId().replace(/:/g, "");
  const blades = LOCK[nema] ?? STRAIGHT[nema];
  if (!blades) return null;
  const g = (n: string) => `${n}-${uid}`;
  return (
    <svg viewBox="-110 -105 220 230" role="img" aria-label={title ?? `NEMA ${nema} plug`} className={cn("h-auto w-full", className)}>
      <defs>
        <radialGradient id={g("body")} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#3b3b3d" />
          <stop offset="55%" stopColor="#151516" />
          <stop offset="100%" stopColor="#050505" />
        </radialGradient>
        <linearGradient id={g("side")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c1c1d" />
          <stop offset="100%" stopColor="#000" />
        </linearGradient>
        <radialGradient id={g("face")} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#262628" />
          <stop offset="100%" stopColor="#101011" />
        </radialGradient>
        <linearGradient id={g("metal")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5f5f2" />
          <stop offset="45%" stopColor="#c9c9c4" />
          <stop offset="100%" stopColor="#8d8d88" />
        </linearGradient>
        <linearGradient id={g("brass")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3e3a6" />
          <stop offset="100%" stopColor="#a8873c" />
        </linearGradient>
        <filter id={g("shadow")} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#000" floodOpacity="0.35" />
        </filter>
      </defs>
      {/* Cord + strain relief behind the body */}
      <path d="M 10 70 C 16 96, 30 110, 52 122" stroke="#0b0b0b" strokeWidth="20" fill="none" strokeLinecap="round" />
      <path d="M 10 70 C 16 96, 30 110, 52 122" stroke="#36363a" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.55" />
      <g filter={`url(#${g("shadow")})`}>
        {/* Body depth (cylinder side), then the face */}
        <circle cx="7" cy="9" r="84" fill={`url(#${g("side")})`} />
        <circle cx="0" cy="0" r="84" fill={`url(#${g("body")})`} />
        <circle cx="0" cy="0" r="84" fill="none" stroke="#4a4a4c" strokeWidth="1.5" opacity="0.7" />
        <path d="M -62 -52 A 82 82 0 0 1 40 -72" stroke="#fff" strokeOpacity="0.18" strokeWidth="5" fill="none" strokeLinecap="round" />
        <circle cx="0" cy="0" r="66" fill={`url(#${g("face")})`} stroke="#000" strokeOpacity="0.6" strokeWidth="2" />
        {/* Assembly screws on the face ring */}
        {[-50, 70, 190].map((a) => {
          const p = polar(75, a);
          return (
            <g key={a}>
              <circle cx={p.x} cy={p.y} r="4.2" fill={`url(#${g("brass")})`} stroke="#3a2f12" strokeWidth="0.8" />
              <path d={`M ${p.x - 2.6} ${p.y} L ${p.x + 2.6} ${p.y}`} stroke="#3a2f12" strokeWidth="1.1" />
            </g>
          );
        })}
        {blades.map((b, i) => {
          if (b.kind === "arc") {
            const span = b.span ?? 52;
            const r = 41;
            const label = polar(r - 24, b.at);
            return (
              <g key={i}>
                <path d={arcBlade(b.at, span, r, !!b.ground)} fill={b.ground ? `url(#${g("brass")})` : `url(#${g("metal")})`} stroke="#2b2b2b" strokeWidth="0.8" />
                {b.letter ? (
                  <text x={label.x} y={label.y + 3.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#77777b" fontFamily="Arial, sans-serif">
                    {b.letter}
                  </text>
                ) : null}
              </g>
            );
          }
          if (b.kind === "pin") {
            return (
              <path
                key={i}
                d={`M ${b.x - 6} ${b.y + 4} L ${b.x - 6} ${b.y - 2} A 6 6 0 0 1 ${b.x + 6} ${b.y - 2} L ${b.x + 6} ${b.y + 4} Z`}
                fill={`url(#${g("brass")})`}
                stroke="#3a2f12"
                strokeWidth="0.8"
              />
            );
          }
          return (
            <g key={i}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="1.5" fill={`url(#${g("metal")})`} stroke="#2b2b2b" strokeWidth="0.8" />
              {b.tee === "h" ? <rect x={b.x + b.w - 7} y={b.y - 9} width="7" height={b.h + 18} rx="1.5" fill={`url(#${g("metal")})`} stroke="#2b2b2b" strokeWidth="0.8" /> : null}
            </g>
          );
        })}
        {/* Molded rating text, like the real face */}
        <text x="0" y="58" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#4d4d50" fontFamily="Arial, sans-serif" letterSpacing="1.2">
          {nema}P
        </text>
      </g>
    </svg>
  );
}

/** Picture + label for the Plug section. Nothing for hardwire or non-NEMA text. */
export function PlugPicture({ nema, label, note }: { nema: string; label: string; note?: string | null }) {
  if (!hasPlugFace(nema)) return null;
  return (
    <figure className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5" data-testid="plug-image">
      <div className="w-36 shrink-0 rounded-md bg-gradient-to-b from-white to-neutral-200 p-2 dark:from-neutral-200 dark:to-neutral-400">
        <PlugFace nema={nema} title={label} />
      </div>
      <figcaption className="min-w-0 text-sm">
        <span className="block font-semibold" data-testid="plug-label">
          {label}
        </span>
        {note ? <span className="mt-0.5 block text-xs text-warning">{note}</span> : null}
      </figcaption>
    </figure>
  );
}
