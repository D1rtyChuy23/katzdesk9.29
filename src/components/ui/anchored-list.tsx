import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Box = { top: number; left: number; width: number; maxHeight: number };

const LAYER_ID = "desk-float-layer";

function stripHidden(el: HTMLElement) {
  el.removeAttribute("aria-hidden");
  el.removeAttribute("data-aria-hidden");
  el.removeAttribute("inert");
}

/**
 * One persistent layer, promoted with the Popover API so it paints above the
 * banner, the side menu, and every dialog. showPopover is only called on this
 * node — never on a React child, which the browser would reparent and React
 * would then fail to unmount.
 */
function floatLayer(): HTMLElement {
  let el = document.getElementById(LAYER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = LAYER_ID;
    el.setAttribute("data-desk-float-layer", "");
    document.body.appendChild(el);
    const node = el;
    const mo = new MutationObserver(() => stripHidden(node));
    mo.observe(node, { attributes: true, attributeFilter: ["aria-hidden", "data-aria-hidden", "inert"] });
  }
  stripHidden(el);
  if (!el.hasAttribute("popover")) el.setAttribute("popover", "manual");
  if (typeof el.showPopover === "function" && !el.matches(":popover-open")) {
    try {
      el.showPopover();
    } catch {
      /* already showing */
    }
  }
  stripHidden(el);
  return el;
}

function measure(node: HTMLElement): Box {
  const r = node.getBoundingClientRect();
  const width = Math.min(Math.max(r.width, 260), window.innerWidth - 16);
  let left = r.left;
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - 8 - width);
  const gap = 4;
  const below = window.innerHeight - r.bottom - gap - 8;
  const above = r.top - gap - 8;
  const openUp = below < 220 && above > below;
  const room = Math.max(openUp ? above : below, 160);
  const maxHeight = Math.min(Math.round(window.innerHeight * 0.7), room);
  let top = openUp ? r.top - gap - maxHeight : r.bottom + gap;
  if (top < 8) top = 8;
  if (top + maxHeight > window.innerHeight - 8) {
    const fit = Math.max(120, window.innerHeight - 16 - top);
    return { top, left: Math.max(8, left), width, maxHeight: Math.min(maxHeight, fit) };
  }
  return { top, left: Math.max(8, left), width, maxHeight };
}

function placeNode(node: HTMLDivElement, box: Box) {
  node.style.setProperty("position", "absolute", "important");
  node.style.setProperty("top", `${box.top}px`, "important");
  node.style.setProperty("left", `${box.left}px`, "important");
  node.style.setProperty("width", `${box.width}px`, "important");
  node.style.setProperty("max-height", `${box.maxHeight}px`, "important");
  node.style.setProperty("margin", "0", "important");
  node.style.setProperty("right", "auto", "important");
  node.style.setProperty("bottom", "auto", "important");
  node.style.setProperty("z-index", "1", "important");
  node.style.setProperty("pointer-events", "auto", "important");
}

/** Result list painted on top of the page, lined up under its search box. */
export function AnchoredList({
  anchor,
  menuRef,
  children,
  className,
}: {
  anchor: RefObject<HTMLElement | null>;
  menuRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  className?: string;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const localRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const node = anchor.current;
    if (!node) return;
    let last = "";
    function place() {
      const el = anchor.current;
      if (!el) return;
      const next = measure(el);
      const key = `${next.top}|${next.left}|${next.width}|${next.maxHeight}`;
      if (key === last) return;
      last = key;
      setBox(next);
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    // The search box also moves without a scroll or resize: picking a machine adds a chip above it,
    // a row grows, a sheet finishes sliding in. Follow it each frame while the list is open.
    let frame = requestAnimationFrame(function follow() {
      place();
      frame = requestAnimationFrame(follow);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  useLayoutEffect(() => {
    const layer = document.getElementById(LAYER_ID);
    if (layer) stripHidden(layer);
    if (localRef.current && box) placeNode(localRef.current, box);
  });

  if (!box || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={(node) => {
        localRef.current = node;
        if (menuRef && "current" in menuRef) (menuRef as { current: HTMLDivElement | null }).current = node;
        if (node) placeNode(node, box);
      }}
      data-combo-popover=""
      style={{
        position: "absolute",
        top: box.top,
        left: box.left,
        width: box.width,
        maxHeight: box.maxHeight,
        margin: 0,
        zIndex: 1,
        pointerEvents: "auto",
        touchAction: "pan-y",
      }}
      className={cn(
        "overflow-y-auto overscroll-contain rounded-md border border-border bg-popover text-popover-foreground shadow-soft",
        className,
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) return;
        e.preventDefault();
      }}
    >
      {children}
    </div>,
    floatLayer(),
  );
}
