import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FilterChip } from "@/components/desk/desk-charts";
import { CustomerMap } from "@/components/desk/customer-map";
import { TerritoryView } from "@/components/desk/territory-view";

export const Route = createFileRoute("/_app/map")({ component: Page });

type MapTab = "accounts" | "territories";

function Page() {
  const [tab, setTab] = useState<MapTab>("accounts");
  return (
    <div>
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Map</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {tab === "accounts"
            ? "Every account on one map, colored by rep, open work or PMs due. Tap a pin to see the account and get directions."
            : "Each rep's accounts on the map, and the accounts with no rep grouped by area with the nearest rep."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Map view" data-testid="map-tabs">
          <FilterChip selected={tab === "accounts"} onClick={() => setTab("accounts")} data-testid="map-tab-accounts">
            Accounts
          </FilterChip>
          <FilterChip selected={tab === "territories"} onClick={() => setTab("territories")} data-testid="map-tab-territories">
            Territories
          </FilterChip>
          {/* Accounts with no pin or only a ZIP area pin, and the other addresses on file for them. */}
          <Link to="/address-report" className="self-center px-1 text-sm font-medium text-primary underline-offset-4 hover:underline" data-testid="map-address-report">
            Address Report
          </Link>
        </div>
      </header>
      {tab === "accounts" ? <CustomerMap /> : <TerritoryView />}
    </div>
  );
}
