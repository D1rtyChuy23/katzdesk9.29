import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FilterChip } from "@/components/desk/desk-charts";
import { CustomerMap } from "@/components/desk/customer-map";
import { TerritoryView } from "@/components/desk/territory-view";

type MapSearch = { account?: number; tab?: "territories" };

export const Route = createFileRoute("/_app/map")({
  validateSearch: (s: Record<string, unknown>): MapSearch => {
    const raw = s.account;
    const n = typeof raw === "number" ? raw : typeof raw === "string" && raw ? Number(raw) : NaN;
    return { ...(Number.isFinite(n) && n > 0 ? { account: n } : {}), ...(s.tab === "territories" ? { tab: "territories" } : {}) };
  },
  component: Page,
});

type MapTab = "accounts" | "territories";

function Page() {
  const { account, tab: tabParam } = Route.useSearch();
  const navigate = useNavigate();
  // The tab and picked account live in the address, so closing an account opened from here comes back to both.
  const tab: MapTab = tabParam ?? "accounts";
  const go = (next: { account?: number | null; tab?: MapTab }) => {
    const t = next.tab ?? tab;
    const id = "account" in next ? next.account : account;
    void navigate({ to: "/map", search: { ...(id ? { account: id } : {}), ...(t === "territories" ? { tab: t } : {}) }, replace: true, resetScroll: false });
  };
  const setTab = (t: MapTab) => go({ tab: t, account: null });
  return (
    <div>
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Map</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {tab === "accounts"
            ? "Every account and service provider on one map, colored by rep, open work, PMs due or type. Tap a pin to see the details and get directions."
            : "Each rep's accounts on the map, and the accounts with no rep grouped by area with the nearest rep."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Map view" data-testid="map-tabs">
          <FilterChip selected={tab === "accounts"} onClick={() => setTab("accounts")} data-testid="map-tab-accounts">
            Accounts
          </FilterChip>
          <FilterChip selected={tab === "territories"} onClick={() => setTab("territories")} data-testid="map-tab-territories">
            Territories
          </FilterChip>
          <Link to="/address-report" className="self-center px-1 text-sm font-medium text-primary underline-offset-4 hover:underline max-sm:py-2" data-testid="map-address-report">
            Address Report
          </Link>
        </div>
      </header>
      {tab === "accounts" ? (
        <CustomerMap
          accountId={account ?? null}
          onSelectAccount={(id) => go({ account: id })}
        />
      ) : (
        <TerritoryView
          accountId={account ?? null}
          onSelectAccount={(id) => go({ account: id })}
        />
      )}
    </div>
  );
}
