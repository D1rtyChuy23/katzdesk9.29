import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/separator";
import { PlannerCalendar, usePlannerWork } from "./planner-calendar";

type Frame = { x: number; y: number; w: number; h: number };

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
  const w = 460;
  const h = Math.min(620, Math.max(420, window.innerHeight - 140));
  return {
    x: Math.max(12, window.innerWidth - w - 20),
    y: 84,
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
    const w = clamp(Number(parsed.w) || base.w, 340, Math.max(360, window.innerWidth - 16));
    const h = clamp(Number(parsed.h) || base.h, 380, Math.max(400, window.innerHeight - 16));
    const x = clamp(Number(parsed.x), 8 - w + 120, window.innerWidth - 80);
    const y = clamp(Number(parsed.y), 8, window.innerHeight - 48);
    return { x, y, w, h };
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

  useEffect(() => {
    if (!open) return;
    setFrame(readFrame(userId));
  }, [open, userId]);

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
      className="fixed z-40 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-soft"
      style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }}
      data-testid="pending-calendar-window"
      role="dialog"
      aria-label="Pending calendar"
    >
      <div
        className="flex cursor-grab items-center gap-2 border-b border-border bg-card px-3 py-2 active:cursor-grabbing"
        onPointerDown={(e) => dragFrame(e, "move")}
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
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <PopBody />
      </div>
      <button
        type="button"
        aria-label="Resize calendar"
        className="absolute right-1 bottom-1 size-4 cursor-nwse-resize rounded-sm border border-border bg-muted"
        onPointerDown={(e) => dragFrame(e, "resize")}
      />
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
