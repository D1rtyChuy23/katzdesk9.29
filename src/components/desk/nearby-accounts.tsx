import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { AccountGeo } from "@/lib/ops/geo-api";
import { milesLabel, nearby } from "@/lib/ops/geo";
import { formatShortDate } from "@/lib/ops/clock";
import { Badge } from "@/components/ui/badge";
import { FilterChip } from "./desk-charts";
import { needsAttention, nameKey, pointOf, useGeoIndex } from "./geo-data";
import { RepName } from "./rep-select";
import { AkBadge, NoRepFlag } from "./ak-badge";
import { ShowMoreButton, useShowMore } from "./show-more";

const RADII = [2, 5, 10] as const;
type Radius = (typeof RADII)[number];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Nearby, in the account window: other accounts close to this one, nearest first, with their open work, so a tech or
 * rep at this stop can see what else is around. Distances are straight-line miles from the saved map pins.
 */
export function NearbyAccounts({ accountId, name }: { accountId: number; name: string }) {
  const navigate = useNavigate();
  const geo = useGeoIndex();
  const [radius, setRadius] = useState<Radius>(5);
  const [workOnly, setWorkOnly] = useState(true);

  const self = geo.byId.get(accountId) ?? geo.byName.get(nameKey(name)) ?? null;
  const origin = pointOf(self);
  const selfId = self?.id ?? accountId;
  const lat = origin?.lat;
  const lng = origin?.lng;

  // Everything inside the radius, then the "with work" cut, so the hidden count can be said plainly.
  const { all, shown } = useMemo(() => {
    if (lat == null || lng == null) return { all: [], shown: [] };
    const rows = nearby({ lat, lng }, geo.accounts, pointOf, radius, { exclude: (a) => a.id === selfId || a.id === accountId, tieKey: (a) => a.name });
    return { all: rows, shown: workOnly ? rows.filter((r) => needsAttention(r.item)) : rows };
  }, [geo.accounts, lat, lng, radius, workOnly, selfId, accountId]);

  const { visible, remaining, showMore } = useShowMore(shown, `${accountId}:${radius}:${workOnly}`, 10);
  const hidden = all.length - shown.length;

  let body: ReactNode;
  if (!geo.data) {
    // No list yet: still loading, or the first load failed. A failed refresh keeps showing the list it already has.
    body = geo.isError ? (
      <p className="mt-3 text-sm text-destructive" data-testid="nearby-error">
        Could not load nearby accounts{geo.error instanceof Error ? `: ${geo.error.message}` : "."}
      </p>
    ) : (
      <p className="mt-3 text-sm text-muted-foreground" data-testid="nearby-loading">
        Finding accounts nearby…
      </p>
    );
  } else if (!origin) {
    body = (
      <p className="mt-3 text-sm text-muted-foreground" data-testid="nearby-no-pin">
        This account has no map pin yet, so nearby accounts can't be found. Import locations on Customers → Import → Locations.
      </p>
    );
  } else {
    body = (
      <>
        {self?.quality === "approx" ? (
          <p className="mt-2 text-xs text-warning" data-testid="nearby-approx">
            This account's pin is a ZIP area (approximate), so these distances are approximate too.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Nearby filters">
          {RADII.map((r) => (
            <FilterChip key={r} selected={radius === r} onClick={() => setRadius(r)} data-testid={`nearby-radius-${r}`}>
              {r} mi
            </FilterChip>
          ))}
          <FilterChip selected={workOnly} onClick={() => setWorkOnly((v) => !v)} data-testid="nearby-work-only">
            With Work Only
          </FilterChip>
        </div>
        {shown.length ? (
          <ul className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border" data-testid="nearby-list">
            {visible.map(({ item, miles }) => (
              <NearbyRow
                key={item.id}
                account={item}
                miles={miles}
                onOpen={() => void navigate({ to: "/customers", search: { open: item.id }, replace: true })}
              />
            ))}
            <ShowMoreButton as="li" remaining={remaining} onClick={showMore} label={remaining === 1 ? "account" : "accounts"} />
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground" data-testid="nearby-empty">
            {workOnly ? `No accounts with work within ${radius} mi` : `No other accounts within ${radius} mi`}
            {radius < 10 ? ". Try a wider radius." : "."}
          </p>
        )}
        {geo.data?.scoped ? (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="nearby-scoped">
            Open work shows only on accounts assigned to you.
          </p>
        ) : null}
        {workOnly && hidden > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="nearby-hidden">
            {plural(hidden, shown.length ? "more account" : "account")} within {radius} mi {hidden === 1 ? "has" : "have"} no open work. Turn off With Work Only to see{" "}
            {hidden === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4" data-testid="nearby-accounts">
      <h2 className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">Nearby</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Accounts close to this one, nearest first. Distances are straight-line.</p>
      {body}
    </section>
  );
}

/** One nearby account: tap anywhere on it to switch the window to that account. */
function NearbyRow({ account: a, miles, onOpen }: { account: AccountGeo; miles: number; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="desk-flat flex min-h-11 w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/60"
        title="Open Account"
        data-testid="nearby-row"
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 font-medium break-words">{a.name}</span>
            <AkBadge on={a.aviKatz} />
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{a.rep ? <RepName name={a.rep} /> : <NoRepFlag show />}</span>
          <WorkBadges account={a} />
        </span>
        <span className="shrink-0 text-right text-sm tabular" data-testid="nearby-miles">
          {milesLabel(miles)}
          {a.quality === "approx" ? (
            <span className="block text-[11px] text-muted-foreground" title="This account's pin is a ZIP area (approximate)">
              approx.
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

/** Open work in a few words: tickets, TLCs, the PM that matters most, installs. Nothing when the account has none. */
function WorkBadges({ account: a }: { account: AccountGeo }) {
  const pm =
    a.pmsPastDue > 0 ? (
      <Badge size="tight" variant="danger">
        PM past due
      </Badge>
    ) : a.pmsDueSoon > 0 ? (
      <Badge size="tight" variant="warn">
        {a.nextPm ? `PM due ${formatShortDate(a.nextPm)}` : "PM due soon"}
      </Badge>
    ) : a.openPms > 0 ? (
      <Badge size="tight">{plural(a.openPms, "open PM")}</Badge>
    ) : null;
  if (!a.openCalls && !a.openTlcs && !pm && !a.openInstalls) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1" data-testid="nearby-work">
      {a.openCalls ? <Badge size="tight">{plural(a.openCalls, "open ticket")}</Badge> : null}
      {a.openTlcs ? <Badge size="tight">{plural(a.openTlcs, "TLC")}</Badge> : null}
      {pm}
      {a.openInstalls ? <Badge size="tight">{plural(a.openInstalls, "install")}</Badge> : null}
    </span>
  );
}
