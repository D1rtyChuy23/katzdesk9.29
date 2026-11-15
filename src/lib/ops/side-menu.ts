/**
 * The side menu (Chuy, 11/14): pages grouped by the work they do, in the order the work flows, and each cleanup tool
 * beside the data it fixes (Address Report and Clean Names under Accounts, Equipment Mismatches under Assets, Runbook
 * Readiness under Service). Coming Due and the Planner sit on their own at the top. Every page keeps its address.
 *
 * Who sees what: the owner sees everything; the Admin role all but Access; a sales rep sees Service's lists for
 * awareness, not the planner, the rebuild bench, runbooks or outside techs; the Warehouse role sees only its pages.
 * Pure data and one function, so the menu for each role is tested without a browser.
 */
import type { DeskRole } from "@/lib/ops/access";

export type MenuTo =
  | "/"
  | "/planner"
  | "/customers"
  | "/map"
  | "/address-report"
  | "/recipes"
  | "/customer-names"
  | "/pipeline"
  | "/installs"
  | "/handoff"
  | "/service"
  | "/pms"
  | "/tlc"
  | "/runbook-readiness"
  | "/network"
  | "/assets"
  | "/unit-mismatches"
  | "/warehouse"
  | "/locations"
  | "/modules"
  | "/rebuilds"
  | "/parts"
  | "/library"
  | "/invoices"
  | "/analytics"
  | "/settings"
  | "/access";

export type MenuItem = {
  to: MenuTo;
  label: string;
  exact?: boolean;
  /** The Admin role or the owner. */
  admin?: boolean;
  /** The owner only. */
  owner?: boolean;
  /** Not for a sales rep (unless they are the owner). */
  noSales?: boolean;
};

export type MenuGroup = { label: string; items: MenuItem[] };

export const SIDE_MENU: MenuGroup[] = [
  {
    label: "",
    items: [
      { to: "/", label: "Coming Due", exact: true },
      // The dispatch board for every kind of job, not just tickets.
      { to: "/planner", label: "Planner", noSales: true },
    ],
  },
  {
    label: "Accounts",
    items: [
      { to: "/customers", label: "Customers" },
      { to: "/map", label: "Map" },
      // Accounts the map can't place: fixing the address puts them on the Map and the route planner.
      { to: "/address-report", label: "Address Report" },
      { to: "/recipes", label: "Recipes" },
      { to: "/customer-names", label: "Clean Names", admin: true },
    ],
  },
  {
    label: "Sales & Installs",
    items: [
      { to: "/pipeline", label: "Pipeline" },
      { to: "/installs", label: "Install Board" },
      { to: "/handoff", label: "Handoff" },
    ],
  },
  {
    label: "Service",
    items: [
      { to: "/service", label: "Tickets" },
      { to: "/pms", label: "PMs" },
      { to: "/tlc", label: "TLC + Factor" },
      { to: "/runbook-readiness", label: "Runbook Readiness", noSales: true },
      // The outside techs we dispatch for accounts beyond the Katz floor.
      { to: "/network", label: "Out Of Network", noSales: true },
    ],
  },
  {
    // Every machine at a customer and in the barn, where it is, and the ones whose records don't agree.
    label: "Assets",
    items: [
      { to: "/assets", label: "Equipment" },
      { to: "/unit-mismatches", label: "Equipment Mismatches" },
      { to: "/warehouse", label: "Barn Warehouse" },
      { to: "/locations", label: "Locations" },
      { to: "/modules", label: "Modules" },
    ],
  },
  {
    label: "Shop",
    items: [
      { to: "/rebuilds", label: "Rebuilds", noSales: true },
      // The NetSuite item list: parts, filters, service, equipment and dispensers (11/14).
      { to: "/parts", label: "Item Catalog" },
      { to: "/library", label: "The Library" },
    ],
  },
  {
    label: "Billing & Reports",
    items: [
      // NetSuite invoices, Tickets In Window and Location Check (10/28).
      { to: "/invoices", label: "Invoices", admin: true },
      { to: "/analytics", label: "Analytics" },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/settings", label: "Settings" },
      { to: "/access", label: "Access", owner: true },
    ],
  },
];

/**
 * The Warehouse role's pages (10/29): the barn, its machines and their places, refurbs and their invoices for Katz
 * Coffee Service Dept., and parts look-up, photos and Get Later. The shell also keeps that role on these pages.
 */
export const WAREHOUSE_PAGES: readonly MenuTo[] = ["/assets", "/warehouse", "/locations", "/modules", "/rebuilds", "/parts", "/library"];

/** The menu for a role. `isAdmin` is the owner. A group left with no pages is dropped. */
export function menuFor(role: DeskRole | null | undefined, isAdmin?: boolean): MenuGroup[] {
  const owner = !!isAdmin;
  const admin = owner || role === "admin";
  const sees = (item: MenuItem): boolean => {
    if (role === "warehouse") return WAREHOUSE_PAGES.includes(item.to);
    if (item.owner && !owner) return false;
    if (item.admin && !admin) return false;
    if (item.noSales && role === "sales" && !owner) return false;
    return true;
  };
  return SIDE_MENU.map((g) => ({ ...g, items: g.items.filter(sees) })).filter((g) => g.items.length);
}
