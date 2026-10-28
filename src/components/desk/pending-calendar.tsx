import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PlannerCalendar, usePlannerWork } from "./planner-calendar";

type Frame = { x: number; y: number; w: number; h: number };

/** A phone, upright or on its side: the window fills the screen instead of floating. */
const SMALL_SCREEN = "(max-width: 639px), (max-height: 499px)";

/**
 * On a small screen the window takes the screen's width and height (inside a small margin) and isn't dragged or
 * resized: a floating 460 px window ran off a phone's screen, past the reach of a swipe or a pinch (Chuy, 10/27).
 */
function useSmallScreen(): boolean {
  const [small, setSmall] = useState(() => typeof window !== "undefined" && window.matchMedia(SMALL_SCREEN).matches);
  useEffect(() => {
    const mq = window.matchMedia(SMALL_SCREEN);
    const sync = () => setSmall(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return small;
}

type Dock = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const DockCtx = createContext<Dock>({ open: false, setOpen: () => undefined });

export function useCalendarDock() {
  return useContext(DockCtx);
}

function frameKey(userId: string) {
  return `katz-desk-cal-frame:${userId}`;
}

function defaultFrame(): Frame {
  if (typeof window === "undefined") return { x: 24, y: 88, w: 460, h: 560 };
  const w = Math.min(460, window.innerWidth - 16);
  const h = Math.min(620, Math.max(420, window.innerHeight - 140));
  return fitFrame({
    x: Math.max(12, window.innerWidth - w - 20),
    y: 84,
    w,
    h,
  });
}

/**
 * Keep a window's size within the screen, and enough of it on the screen to grab: a frame saved on a bigger screen
 * (or before the browser was made smaller) is brought back in.
 */
function fitFrame(f: Frame): Frame {
  const maxW = window.innerWidth - 16;
  const maxH = window.innerHeight - 16;
  const w = clamp(f.w, Math.min(340, maxW), maxW);
  const h = clamp(f.h, Math.min(380, maxH), maxH);
  return {
    x: clamp(f.x, 8 - w + 120, window.innerWidth - 80),
    y: clamp(f.y, 8, window.innerHeight - 48),
    w,
    h,
  };
}

function readFrame(userId: string): Frame {
  try {
    const raw = window.localStorage.getItem(frameKey(userId));
    if (!raw) return defaultFrame();
    const parsed = JSON.parse(raw) as Partial<Frame>;
    const base = defaultFrame();
    return fitFrame({
      x: Number(parsed.x),
      y: Number(parsed.y),
      w: Number(parsed.w) || base.w,
      h: Number(parsed.h) || base.h,
    });
  } catch {
    return defaultFrame();
  }
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function CalendarDock({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <DockCtx.Provider value={{ open, setOpen }}>{children}</DockCtx.Provider>;
}

export function CalendarDockButton({ className }: { className?: string }) {
  const { open, setOpen } = useCalendarDock();
  return (
    <Button
      type="button"
      variant={open ? "default" : "outline"}
      size="sm"
      className={className}
      aria-pressed={open}
      aria-label="Pending calendar"
      data-testid="pending-calendar-toggle"
      onClick={() => setOpen(!open)}
    >
      Pending calendar
    </Button>
  );
}

export function PendingCalendarPop() {
  const { open, setOpen } = useCalendarDock();
  const { user } = useCurrentUserState();
  const userId = user?.id ?? "desk";
  const [frame, setFrame] = useState<Frame>(() =>
    typeof window === "undefined" ? { x: 24, y: 88, w: 460, h: 560 } : readFrame(userId),
  );
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const small = useSmallScreen();

  useEffect(() => {
    if (!open) return;
    setFrame(readFrame(userId));
  }, [open, userId]);

  // A browser window made smaller doesn't leave the calendar off its edge.
  useEffect(() => {
    if (!open) return;
    const refit = () => setFrame((f) => fitFrame(f));
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, [open]);

  function persist(next: Frame) {
    frameRef.current = next;
    setFrame(next);
    try {
      window.localStorage.setItem(frameKey(userId), JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
  }

  function dragFrame(e: React.PointerEvent, mode: "move" | "resize") {
    if (mode === "move" && (e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const orig = frameRef.current;
    function move(ev: PointerEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (mode === "move") {
        const next = {
          ...orig,
          x: clamp(orig.x + dx, 8 - orig.w + 120, window.innerWidth - 80),
          y: clamp(orig.y + dy, 8, window.innerHeight - 48),
        };
        frameRef.current = next;
        setFrame(next);
      } else {
        const next = {
          ...orig,
          w: clamp(orig.w + dx, 340, window.innerWidth - 16),
          h: clamp(orig.h + dy, 380, window.innerHeight - 16),
        };
        frameRef.current = next;
        setFrame(next);
      }
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      persist(frameRef.current);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed z-40 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft",
        small && "inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] bottom-[max(0.5rem,env(safe-area-inset-bottom))]",
      )}
      style={small ? undefined : { left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
      data-testid="pending-calendar-window"
      data-layout={small ? "screen" : "window"}
      role="dialog"
      aria-label="Pending calendar"
    >
      <div
        className={cn(
          "flex items-center gap-2 border-b border-border bg-card px-3 py-2",
          !small && "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={small ? undefined : (e) => dragFrame(e, "move")}
      >
        <p className="min-w-0 flex-1 truncate text-sm font-medium">Pending calendar</p>
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close calendar"
          data-testid="pending-calendar-close"
          onClick={() => setOpen(false)}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-auto overscroll-contain", small ? "p-1" : "p-2")} data-testid="pending-calendar-body">
        <PopBody />
      </div>
      {small ? null : (
        <button
          type="button"
          aria-label="Resize calendar"
          className="absolute right-1 bottom-1 size-4 cursor-nwse-resize rounded-sm border border-border bg-muted"
          onPointerDown={(e) => dragFrame(e, "resize")}
        />
      )}
    </div>
  );
}

function PopBody() {
  const work = usePlannerWork();
  if (work.loading) return <Skeleton className="h-64 w-full" />;
  return (
    <PlannerCalendar
      variant="pop"
      installs={work.installs}
      pms={work.pms}
      services={work.services}
      tlcs={work.tlcs}
    />
  );
}
