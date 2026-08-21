import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarClock,
  Coffee,
  Handshake,
  MapPin,
  Menu,
  MessageSquare,
  Package,
  Settings2,
  Truck,
  Users,
  Warehouse,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { SignedIn, SignedOut, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { GlobalSearch } from "./search";
import { NotifyBell } from "./notify-bell";
import { Skeleton } from "@/components/ui/separator";

const NAV = [
  {
    label: "Floor",
    items: [
      { to: "/", label: "Clock", icon: CalendarClock, exact: true },
      { to: "/service", label: "Service", icon: Wrench },
      { to: "/tlc", label: "TLC + Factor", icon: Coffee },
      { to: "/pms", label: "PMs", icon: Settings2 },
    ],
  },
  {
    label: "Sales → service",
    items: [
      { to: "/pipeline", label: "Pipeline", icon: Handshake },
      { to: "/installs", label: "Installs", icon: Truck },
      { to: "/handoff", label: "Handoff", icon: MessageSquare },
    ],
  },
  {
    label: "Shop",
    items: [
      { to: "/warehouse", label: "Warehouse", icon: Warehouse },
      { to: "/locations", label: "Locations", icon: MapPin },
      { to: "/modules", label: "Modules", icon: Package },
      { to: "/recipes", label: "Recipes", icon: BookOpen },
    ],
  },
] as const;

function NavLinks({ onNavigate, isAdmin }: { onNavigate?: () => void; isAdmin?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-6">
      {NAV.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-[11px] font-medium tracking-[0.16em] text-cream/50 uppercase">
            {group.label}
          </p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const exact = "exact" in item && item.exact;
              const active = exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-cream/12 text-cream"
                        : "text-cream/70 hover:bg-cream/8 hover:text-cream",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {isAdmin ? (
        <div>
          <p className="px-3 text-[11px] font-medium tracking-[0.16em] text-cream/50 uppercase">Admin</p>
          <ul className="mt-2 space-y-0.5">
            <li>
              <Link
                to="/access"
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  pathname === "/access" || pathname.startsWith("/access/")
                    ? "bg-cream/12 text-cream"
                    : "text-cream/70 hover:bg-cream/8 hover:text-cream",
                )}
              >
                <Users className="size-4" />
                Access
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
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

export function AppShell({ children, isAdmin }: { children: ReactNode; isAdmin?: boolean }) {
  const { user, isPending } = useCurrentUserState();
  const [open, setOpen] = useState(false);

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
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-60 shrink-0 flex-col bg-ink text-ink-foreground md:flex">
        <div className="px-2 py-5">
          <Brand />
          <p className="mt-1 px-3 text-xs text-cream/45">Service and sales, one clock.</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <NavLinks isAdmin={isAdmin} />
        </div>
        <div className="border-t border-cream/10 p-3">
          <p className="px-1 text-[11px] text-cream/40">Signed in</p>
          <div className="mt-1 text-cream [&_button]:text-cream/70 [&_span]:text-cream">
            <UserButton />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border bg-card/70 px-3 py-2 backdrop-blur md:px-6">
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
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:ml-0">
            <GlobalSearch />
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
        </header>
        <main className="flex-1 px-3 py-5 md:px-8 md:py-7">{children}</main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-64 flex-col bg-ink p-0 text-ink-foreground sm:max-w-64">
          <div className="px-2 py-5">
            <Brand />
          </div>
          <div className="px-2">
            <NavLinks onNavigate={() => setOpen(false)} isAdmin={isAdmin} />
          </div>
          <div className="mt-auto border-t border-cream/10 p-3">
            <p className="px-1 text-[11px] text-cream/40">Signed in</p>
            <div className="mt-1 text-cream [&_button]:text-cream/70 [&_span]:text-cream">
              <UserButton />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
