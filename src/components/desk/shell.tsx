import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarClock,
  CalendarRange,
  Coffee,
  Globe,
  Hammer,
  Handshake,
  MapPin,
  Menu,
  MessageSquare,
  Package,
  Settings2,
  SlidersHorizontal,
  Store,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LAST_PATH_KEY, RESUMED_KEY, readPrefs } from "@/lib/ops/prefs";
import type { DeskRole } from "@/lib/ops/access";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { GlobalSearch } from "./search";
import { NotifyBell } from "./notify-bell";
import { ThemeToggle } from "./theme-toggle";
import { ShortcutsDialog } from "./shortcuts";
import { Skeleton } from "@/components/ui/separator";
import { MyViewBar } from "./my-view-bar";
import { CalendarDock, PendingCalendarPop } from "./pending-calendar";


type DeskTo =
  | "/"
  | "/service"
  | "/planner"
  | "/tlc"
  | "/pms"
  | "/handoff"
  | "/installs"
  | "/recipes"
  | "/pipeline"
  | "/warehouse"
  | "/rebuilds"
  | "/locations"
  | "/modules"
  | "/customers"
  | "/network"
  | "/settings"
  | "/access";

type NavItem = {
  to: DeskTo;
  label: string;
  icon: typeof CalendarClock;
  exact?: boolean;
};

const NAV: { label: string; items: NavItem[] }[] = [
  {
    label: "Work",
    items: [
      { to: "/", label: "Coming due", icon: CalendarClock, exact: true },
      { to: "/planner", label: "Planner", icon: CalendarRange },
      { to: "/service", label: "Tickets", icon: Wrench },
      { to: "/tlc", label: "TLC + Factor", icon: Coffee },
      { to: "/pms", label: "PMs", icon: Settings2 },
      { to: "/handoff", label: "Handoff", icon: MessageSquare },
    ],
  },
  {
    label: "Installs",
    items: [
      { to: "/installs", label: "Board", icon: Truck },
      { to: "/recipes", label: "Recipes", icon: BookOpen },
      { to: "/pipeline", label: "Pipeline", icon: Handshake },
    ],
  },
  {
    label: "Shop",
    items: [
      { to: "/warehouse", label: "Warehouse", icon: Warehouse },
      { to: "/rebuilds", label: "Rebuilds", icon: Hammer },
      { to: "/locations", label: "Locations", icon: MapPin },
      { to: "/modules", label: "Modules", icon: Package },
    ],
  },
  {
    label: "Accounts",
    items: [
      { to: "/customers", label: "Customers", icon: Store },
      { to: "/network", label: "Out of Network", icon: Globe },
    ],
  },
  {
    label: "Admin",
    items: [{ to: "/settings", label: "Settings", icon: SlidersHorizontal }],
  },
];

function itemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavItemLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = itemActive(pathname, item);
  const Icon = item.icon;
  return (
    <li>
      <Link
        to={item.to}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
          active ? "bg-cream/12 text-cream" : "text-cream/70 hover:bg-cream/8 hover:text-cream",
        )}
      >
        <Icon className="size-4" />
        {item.label}
      </Link>
    </li>
  );
}

function NavGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: (typeof NAV)[number];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <p className="px-3 text-[11px] font-medium tracking-[0.16em] text-cream/50 uppercase">{group.label}</p>
      <ul className="mt-2 space-y-0.5">
        {group.items.map((item) => (
          <NavItemLink key={item.to} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </ul>
    </div>
  );
}

const WAREHOUSE_OK = ["/warehouse", "/locations"];

function navForRole(role: DeskRole | null | undefined, isAdmin?: boolean) {
  if (role !== "warehouse") return NAV;
  return [
    {
      label: "Shop",
      items: NAV.find((g) => g.label === "Shop")!.items.filter((item) => item.to === "/warehouse" || item.to === "/locations"),
    },
  ];
}

function NavLinks({
  onNavigate,
  isAdmin,
  role,
}: {
  onNavigate?: () => void;
  isAdmin?: boolean;
  role?: DeskRole | null;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const groups = navForRole(role, isAdmin);
  return (
    <nav className="flex flex-col gap-5" data-testid="side-nav">
      {groups.map((group) => (
        <NavGroup
          key={group.label}
          group={
            group.label === "Admin" && isAdmin && role !== "warehouse"
              ? { ...group, items: [...group.items, { to: "/access", label: "Access", icon: Users }] }
              : group
          }
          pathname={pathname}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-baseline gap-2 px-3">
      <span className="font-display text-2xl font-medium tracking-tight text-cream">Katz</span>
      <span className="font-display text-2xl font-medium tracking-tight text-cream/60 italic">Desk</span>
    </Link>
  );
}

export function AppShell({
  children,
  isAdmin,
  role = null,
}: {
  children: ReactNode;
  isAdmin?: boolean;
  role?: DeskRole;
}) {
  const { user, isPending } = useCurrentUserState();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(RESUMED_KEY)) return;
    sessionStorage.setItem(RESUMED_KEY, "1");
    if (!readPrefs().resumeLast) {
      if (role === "warehouse") {
        router.history.push("/warehouse");
        return;
      }
      if (role === "sales" && (pathname === "/" || pathname === "")) {
        router.history.push("/customers");
      }
      return;
    }
    const last = window.localStorage.getItem(LAST_PATH_KEY);
    if (last && last !== pathname && last !== "/login") {
      router.history.push(last);
    }
  }, [user, pathname, router, role]);

  useEffect(() => {
    if (!user || role !== "warehouse") return;
    const allowed = WAREHOUSE_OK.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!allowed) router.history.push("/warehouse");
  }, [user, role, pathname, router]);

  useEffect(() => {
    if (!user) return;
    if (pathname === "/login") return;
    window.localStorage.setItem(LAST_PATH_KEY, pathname);
  }, [user, pathname]);

  if (isPending) {
    return (
      <div className="flex min-h-svh">
        <aside className="hidden w-60 shrink-0 bg-ink md:block" />
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-6 h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <CalendarDock>
    <div className="flex min-h-svh bg-background">
      <a
        href="#desk-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-3 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <aside className="hidden w-60 shrink-0 flex-col bg-ink text-ink-foreground md:flex">
        <div className="px-2 py-5">
          <Brand />
          <p className="mt-1 px-3 text-xs text-cream/45">Service and sales, one clock.</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <NavLinks isAdmin={isAdmin} role={role} />
        </div>
        <div className="border-t border-cream/10 p-3">
          <p className="px-1 text-[11px] text-cream/40">Signed in</p>
          <div className="mt-1 text-cream [&_button]:text-cream/70 [&_span]:text-cream">
            <UserButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="relative flex min-h-[4.75rem] flex-wrap items-center gap-2 overflow-hidden border-b border-border bg-cover bg-center px-3 py-3 md:px-6"
          style={{ backgroundImage: "url(/desk-header.jpg)" }}
        >
          <div className="absolute inset-0 bg-background/55" />
          <div className="relative z-10 flex w-full flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
          <div className="md:hidden">
            <span className="font-display text-lg">Katz Desk</span>
          </div>
          <div className="ml-auto flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 md:ml-0">
            {role === "warehouse" ? null : <MyViewBar />}
            {role === "warehouse" ? null : <GlobalSearch />}
            <ThemeToggle />
            <NotifyBell />
            <div className="hidden sm:block md:hidden">
              <SignedIn>
                <UserButton />
              </SignedIn>
              <SignedOut>
                <Link to="/login" className="text-sm">
                  Sign in
                </Link>
              </SignedOut>
            </div>
          </div>
          </div>
        </header>
        <main id="desk-main" className="min-w-0 flex-1 overflow-x-hidden px-3 py-5 md:px-8 md:py-7">
          {children}
        </main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-64 flex-col overflow-hidden bg-ink p-0 text-ink-foreground sm:max-w-64">
          <div className="shrink-0 px-2 py-5">
            <Brand />
          </div>
          <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto px-2">
            <NavLinks onNavigate={() => setOpen(false)} isAdmin={isAdmin} role={role} />
          </div>
          <div className="shrink-0 border-t border-cream/10 p-3">
            <p className="px-1 text-[11px] text-cream/40">Signed in</p>
            <div className="mt-1 text-cream [&_button]:text-cream/70 [&_span]:text-cream">
              <UserButton />
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <ShortcutsDialog />
    </div>
    {role === "warehouse" ? null : <PendingCalendarPop />}
    </CalendarDock>
  );
}
