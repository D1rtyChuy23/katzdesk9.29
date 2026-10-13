import { calcConfig, calcOptionalVisit, calcSchedule, discounted } from "./calc.mjs";

const DISCLAIMER =
  "Parts pricing is subject to change. Parts costs may be updated at any time, and any price update can affect the final price.";

export function formatMoney(cents) {
  const n = (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${n}`;
}

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const $ = formatMoney;

const CSS = `
@page { size: 960px 540px; margin: 0 }
* { box-sizing: border-box; margin: 0; padding: 0 }
:root { --ink:#16202c; --muted:#5d6b7a; --line:#dde3ea; --brand:#12344d; --accent:#c8553d; --soft:#f3f6f9; --parts:#12344d; --labor:#3d8f87; --trip:#e0a33a }
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: var(--ink); font-variant-numeric: tabular-nums }
.page { width: 960px; height: 540px; padding: 28px 44px 44px; position: relative; overflow: hidden; page-break-after: always; background: #fff }
.kicker { font-size: 11px; letter-spacing: .16em; color: var(--accent); font-weight: 700; text-transform: uppercase }
h1 { font-size: 34px; color: var(--brand); margin: 6px 0 4px; line-height: 1.1 }
h2 { font-size: 24px; color: var(--brand); margin: 4px 0 12px }
.sub { color: var(--muted); font-size: 14px; max-width: 700px }
.tiles { display: flex; gap: 12px; margin: 14px 0 10px }
.tile { flex: 1; background: var(--brand); color: #fff; border-radius: 8px; padding: 9px 12px }
.tile b { display: block; font-size: 24px; line-height: 1.1 }
.tile span { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; opacity: .8 }
table { border-collapse: collapse; width: 100%; font-size: 12px }
th { text-align: left; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border-bottom: 2px solid var(--line); padding: 6px 8px }
td { padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap:anywhere }
th.r, td.r { text-align: right; white-space: nowrap }
td.pn { white-space: nowrap; overflow-wrap: normal }
tr.total td { font-weight: 700; border-top: 2px solid var(--brand); border-bottom: 0; background: var(--soft) }
.cols { display: flex; gap: 20px; align-items: flex-start }
.cols > div { flex: 1; min-width: 0 }
.card { background: var(--soft); border-radius: 8px; padding: 12px 14px }
.card h3 { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--brand); margin-bottom: 8px }
.bar { display: flex; height: 22px; border-radius: 4px; overflow: hidden; margin: 6px 0 4px }
.bar i { display: block; height: 100% }
.legend { font-size: 10px; color: var(--muted); display: flex; gap: 12px; margin: 2px 0 8px }
.legend s { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; text-decoration: none; vertical-align: -1px }
.head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 8px }
.head h2 { margin-bottom: 0 }
.stats { display: flex; gap: 8px }
.stat { border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; min-width: 104px }
.stat span { display: block; font-size: 8.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted) }
.stat b { font-size: 17px; color: var(--ink) }
.stat.dark { background: var(--brand); border-color: var(--brand) }
.stat.dark span { color: #cfd9e3 } .stat.dark b { color: #fff }
.good-n { color: var(--labor) !important; font-weight: 700 }
.mut { color: var(--muted); font-size: 10px; font-weight: 400 }
.badge { font-style: normal; background: var(--labor); color: #fff; border-radius: 10px; padding: 1px 8px; font-size: 10px; margin-left: 6px; letter-spacing: .04em; text-transform: none }
table.tight { font-size: 10.5px } table.tight td { padding: 3px 6px } table.tight th { padding: 4px 6px }
.right { display: flex; flex-direction: column; gap: 10px; flex: 1.1; min-width: 0 }
.right > .card { flex: none }
.card.disc td { padding: 4px 6px } .card.disc table { font-size: 10.5px }
.rec { background: #fdf3e1; border-left: 3px solid var(--trip); padding: 6px 10px; font-size: 11.5px; margin: 0 0 8px; border-radius: 0 4px 4px 0 }
.scheds { display: flex; gap: 10px; margin-bottom: 10px }
.sched { flex: 1; border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; display: flex; flex-direction: column; gap: 2px }
.sched b { font-size: 15px; color: var(--brand) }
.sched.main { background: var(--brand); border-color: var(--brand) } .sched.main b { color: #fff } .sched.main .mut { color: #cfd9e3 }
.badge2 { align-self: flex-start; font-size: 9px; letter-spacing: .06em; text-transform: uppercase; background: var(--trip); color: #16202c; border-radius: 9px; padding: 1px 8px; font-weight: 700 }
th.c { text-align: center; border-bottom: 0; color: var(--brand) }
.cov { display: flex; gap: 14px; margin-top: 10px }
.cov > div { flex: 1; background: var(--soft); border-radius: 8px; padding: 8px 10px }
.cov h4 { font-size: 11px; color: var(--brand); margin-bottom: 3px }
.cov p { font-size: 10px; line-height: 1.4; color: var(--ink) }
.visit-line { font-size: 12px; font-weight: 700; color: var(--brand); margin: 0 0 8px }
ul.work { margin: 0 0 0 16px; font-size: 10.5px; line-height: 1.4 }
.big { font-size: 28px; font-weight: 700; color: var(--brand) }
.save { color: var(--labor); font-weight: 700; font-size: 13px; margin-top: 8px }
.note { font-size: 11px; color: var(--muted); margin-top: 8px; line-height: 1.4 }
ul.good { margin: 8px 0 0 18px; font-size: 13px; line-height: 1.7 }
.foot span:last-child { white-space: nowrap }
.foot { position: absolute; left: 44px; right: 44px; bottom: 14px; display: flex; justify-content: space-between; gap: 20px; font-size: 9px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 6px }
`;

function pageShell(machine, n, total, kicker, body) {
  return `<section class="page">
<div class="kicker">${esc(kicker)}</div>
${body}
<div class="foot"><span>${esc(DISCLAIMER)}</span><span>${esc(machine.name)} · PM Program · ${n}/${total}</span></div>
</section>`;
}

function planMonths(machine) {
  return Math.max(...machine.visits.map((v) => v.month));
}

function intervalText(machine, part) {
  const months = part.visits.map((id) => machine.visits.find((v) => v.id === id).month);
  return machine.visits.length === 1 ? `${months[0]} months` : `Months ${months.join(", ")}`;
}

function aggregate(result) {
  const map = new Map();
  for (const v of result.visits) {
    for (const l of v.lines) {
      const hit = map.get(l.partId) ?? { ...l, qty: 0, extCents: 0, months: [] };
      hit.qty += l.qty;
      hit.extCents += l.extCents;
      hit.months.push(v.month);
      map.set(l.partId, hit);
    }
  }
  return [...map.values()];
}

const monthsText = (months) => (months.length === 1 ? `Month ${months[0]}` : `Months ${months.join(", ")}`);

function niceStep(maxDollars) {
  for (const step of [250, 500, 1000, 2000, 2500, 5000, 10000]) if (maxDollars / step <= 4) return step;
  return 20000;
}

/** Stacked column chart (parts / labor / trip) as inline SVG. */
function chartSvg(columns) {
  const W = 430, H = 196, left = 50, right = 10, top = 24, bottom = 40;
  const plotH = H - top - bottom;
  const maxDollars = Math.max(...columns.map((c) => c.totalCents)) / 100;
  const step = niceStep(maxDollars);
  let topTick = Math.ceil(maxDollars / step) * step;
  if (maxDollars / topTick > 0.85) topTick += step;
  const y = (dollars) => top + plotH * (1 - dollars / topTick);
  const slot = (W - left - right) / columns.length;
  const barW = Math.min(76, slot * 0.5);
  let out = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">`;
  for (let t = 0; t <= topTick; t += step) {
    out += `<line x1="${left}" x2="${W - right}" y1="${y(t)}" y2="${y(t)}" stroke="#dde3ea"/>`;
    out += `<text x="${left - 6}" y="${y(t) + 3.5}" text-anchor="end" font-size="10" fill="#5d6b7a">$${t.toLocaleString("en-US")}</text>`;
  }
  columns.forEach((c, i) => {
    const x = left + slot * i + (slot - barW) / 2;
    let base = y(0);
    for (const [cents, color] of [[c.partsCents, "#12344d"], [c.laborCents, "#3d8f87"], [c.tripCents, "#e0a33a"]]) {
      const h = Math.max(3, (cents / 100 / topTick) * plotH);
      base -= h;
      out += `<rect x="${x.toFixed(1)}" y="${base.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${color}"/>`;
    }
    const cx = (x + barW / 2).toFixed(1);
    out += `<text x="${cx}" y="${(base - 6).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="#16202c">${$(c.totalCents)}</text>`;
    out += `<text x="${cx}" y="${H - 22}" text-anchor="middle" font-size="11" font-weight="700" fill="#16202c">${esc(c.label)}</text>`;
    out += `<text x="${cx}" y="${H - 9}" text-anchor="middle" font-size="10" fill="#5d6b7a">${esc(c.sub)}</text>`;
  });
  return out + "</svg>";
}

export function renderGuideHtml(machine, rates) {
  const pct = rates.discountPct;
  const progLabor = discounted(rates.laborRateCents, pct);
  const progTrip = discounted(rates.tripRateCents, pct);
  const unit = machine.unitLabel;
  const variantIds = [...new Set(machine.configurations.flatMap((c) => c.variants.map((v) => v.id)))];
  const variantLabel = (id) => machine.configurations.flatMap((c) => c.variants).find((v) => v.id === id).label;
  const calc = (c, v) => calcConfig(machine, rates, c.id, v);
  const schedules = machine.schedules ?? [];
  const hasSchedules = schedules.length > 0;
  const total = 3 + machine.configurations.length + (hasSchedules ? 1 : 0);
  const pages = [];

  // 1. Cover
  const visitRows = machine.visits
    .map(
      (v) =>
        `<tr><td>Month ${v.month}</td><td>${esc(v.label)}</td><td>${esc(v.services ?? "")}</td><td class="r">${v.hours} hrs</td></tr>`,
    )
    .join("");
  const workCards = (machine.workPerformed ?? [])
    .map(
      (g, i) =>
        `<div class="card" style="flex:${i === 0 ? 1.6 : 1}"><h3>${esc(g.group)}</h3><ul class="work">${g.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>`,
    )
    .join("");
  const visitSummary = machine.visits.map((v) => `${esc(v.label)} · Month ${v.month} · ${v.hours} hrs program labor`).join("  |  ");
  pages.push(
    pageShell(
      machine,
      1,
      total,
      "Preventive Maintenance Program",
      `<h1>${esc(machine.name)}</h1>
<p class="sub">${esc(machine.subtitle)} · ${pct}% off PM labor and trip.</p>
<div class="tiles">
<div class="tile"><b>${planMonths(machine)}</b><span>Month plan</span></div>
<div class="tile"><b>${machine.visits.length}</b><span>Scheduled PM visit${machine.visits.length > 1 ? "s" : ""}</span></div>
<div class="tile"><b>${pct}%</b><span>Off PM labor &amp; trip</span></div>
<div class="tile"><b>${$(progLabor)}/hr</b><span>Program labor rate</span></div>
<div class="tile"><b>${$(progTrip)}</b><span>Program trip charge</span></div>
</div>
${hasSchedules ? `<p class="rec"><b>12-month PM: highly recommended every year.</b> Add a 6-month visit if your machine sees high volume. See Service Intervals, page ${3 + machine.configurations.length}.</p>` : ""}${
  workCards
    ? `<p class="visit-line">${visitSummary}</p><div class="cols">${workCards}</div>`
    : `<table><tr><th>When</th><th>Visit</th><th>Services performed</th><th class="r">Labor</th></tr>${visitRows}</table>`
}
<p class="note">Standard rates: ${$(rates.laborRateCents)}/hr labor and ${$(rates.tripRateCents)} trip. Program rates: ${$(progLabor)}/hr labor and ${$(progTrip)} per visit. The trip charge is included in every total in this guide.</p>`,
    ),
  );

  // 2. Parts table + inspect-only
  const hasWork = machine.parts.some((p) => p.work);
  const partRows = machine.parts
    .map(
      (p) =>
        `<tr><td>${esc(p.name)}${p.optional ? " <em>(optional)</em>" : ""}</td><td class="pn">${esc(p.partNo)}</td>${hasWork ? `<td>${esc(p.work ?? "")}</td>` : ""}<td>${esc(intervalText(machine, p))}</td><td class="r">${$(p.unitCents)}${p.qty.perUnit ? ` / ${esc(unit)}` : ""}</td></tr>`,
    )
    .join("");
  const inspectRows = (machine.inspectOnly ?? [])
    .map((i) => `<tr><td>${esc(i.name)}</td><td class="pn">${esc(i.partNo)}</td><td class="r">${$(i.unitCents)}</td></tr>`)
    .join("");
  pages.push(
    pageShell(
      machine,
      2,
      total,
      "Parts",
      `<h2>PM Kit Contents</h2>
<div class="cols"><div style="flex:2.1"><table><tr><th>Part</th><th>Part #</th>${hasWork ? "<th>Work performed</th>" : ""}<th>Replaced every</th><th class="r">Unit cost</th></tr>${partRows}</table></div>
${
  inspectRows
    ? `<div class="card"><h3>Inspected, not included</h3><table><tr><th>Part</th><th>Part #</th><th class="r">Price</th></tr>${inspectRows}</table><p class="note">Checked on every visit (the auto-fill probe is also cleaned and tested). Not included in the totals. Replaced and quoted only if a part fails inspection.</p></div>`
    : ""
}</div>`,
    ),
  );

  // 3. One page per configuration
  machine.configurations.forEach((cfg, i) => {
    const results = cfg.variants.map((v) => ({ v, r: calc(cfg, v.id) }));
    const std = results[0].r;
    const multiVisit = machine.visits.length > 1;

    const lineRows = [];
    const seen = new Set();
    for (const { v, r } of results) {
      for (const l of aggregate(r)) {
        if (seen.has(l.partId)) continue;
        seen.add(l.partId);
        const tag = v !== results[0].v && !l.name.includes(v.label) ? ` <em>(${esc(v.label)} only)</em>` : "";
        lineRows.push(
          `<tr><td>${esc(l.name)}${tag}</td><td class="pn">${esc(l.partNo)}</td>${multiVisit ? `<td>${esc(monthsText(l.months))}</td>` : ""}<td class="r">${l.qty}</td><td class="r">${$(l.unitCents)}</td><td class="r">${$(l.extCents)}</td></tr>`,
        );
      }
    }

    // Chart columns: one per variant for a single-visit plan, otherwise one per visit.
    const columns =
      !multiVisit && results.length > 1
        ? results.map(({ v, r }) => ({ ...r, label: v.label, sub: `Month ${r.visits[0].month}` }))
        : std.visits.map((v) => ({ ...v, label: `Month ${v.month}`, sub: v.label }));
    const colRows = columns
      .map(
        (c) =>
          `<tr><td><b>${esc(c.label)}</b> <span class="mut">· ${esc(c.sub)}</span></td><td class="r">${$(c.partsCents)}</td><td class="r">${$(c.laborCents)}</td><td class="r">${$(c.tripCents)}</td><td class="r"><b>${$(c.totalCents)}</b></td></tr>`,
      )
      .join("");

    const hours = std.visits.reduce((n, v) => n + v.hours, 0);
    const nVisits = std.visits.length;
    const tiles = [
      ...results.map(({ v, r }, k) => `<div class="stat${k === 0 ? " dark" : ""}"><span>${esc(v.label)} ${planMonths(machine)}-mo total</span><b>${$(r.totalCents)}</b></div>`),
      ...(results.length === 1 ? [`<div class="stat"><span>Parts</span><b>${$(std.partsCents)}</b></div>`] : []),
      `<div class="stat"><span>Program labor + trip</span><b>${$(std.laborCents + std.tripCents)}</b></div>`,
      `<div class="stat"><span>Labor + trip savings</span><b class="good-n">${$(std.savingsCents)}</b></div>`,
    ].join("");

    const discount = `<div class="card disc"><h3>Labor &amp; trip discount <em class="badge">${pct}% off</em></h3>
<p class="mut" style="margin:-2px 0 4px">Labor ${$(rates.laborRateCents)} → ${$(progLabor)}/hr · Trip ${$(rates.tripRateCents)} → ${$(progTrip)} per visit</p>
<table><tr><th></th><th class="r">Standard</th><th class="r">Program</th><th class="r">You save</th></tr>
<tr><td>Labor · ${hours} hrs</td><td class="r">${$(std.standardLaborCents)}</td><td class="r">${$(std.laborCents)}</td><td class="r good-n">${$(std.standardLaborCents - std.laborCents)}</td></tr>
<tr><td>Trip · ${nVisits} visit${nVisits > 1 ? "s" : ""}</td><td class="r">${$(std.standardTripCents)}</td><td class="r">${$(std.tripCents)}</td><td class="r good-n">${$(std.standardTripCents - std.tripCents)}</td></tr>
<tr class="total"><td>Labor + trip</td><td class="r">${$(std.standardLaborCents + std.standardTripCents)}</td><td class="r">${$(std.laborCents + std.tripCents)}</td><td class="r good-n">${$(std.savingsCents)}</td></tr></table></div>`;

    pages.push(
      pageShell(
        machine,
        3 + i,
        total,
        `Configuration ${i + 1} of ${machine.configurations.length}`,
        `<div class="head"><div><h2>${esc(cfg.label)}</h2><p class="sub">${cfg.units} ${esc(unit)}${cfg.units > 1 ? "s" : ""}${results.some((x) => x.v.label !== "Standard") ? " · " + results.map((x) => esc(x.v.label)).join(" or ") : ""}</p></div><div class="stats">${tiles}</div></div>
<div class="cols"><div class="card"><h3>${multiVisit ? "Cost by contract year" : results.length > 1 ? "Cost by version" : "Annual cost breakdown"}</h3>${chartSvg(columns)}
<div class="legend"><span><s style="background:var(--parts)"></s>Parts</span><span><s style="background:var(--labor)"></s>Program labor</span><span><s style="background:var(--trip)"></s>Program trip</span></div>
<table class="tight"><tr><th></th><th class="r">Parts</th><th class="r">Labor</th><th class="r">Trip</th><th class="r">Total</th></tr>${colRows}</table></div>
<div class="right"><div class="card"><h3>Parts list</h3><table class="tight"><tr><th>Part</th><th>Part #</th>${multiVisit ? "<th>Replaced</th>" : ""}<th class="r">Qty</th><th class="r">Unit</th><th class="r">Ext.</th></tr>${lineRows.join("")}</table></div>${discount}</div></div>`,
      ),
    );
  });

  // 3b. Service intervals
  if (hasSchedules) {
    const cards = schedules
      .map(
        (sc, i) =>
          `<div class="sched${i === 0 ? " main" : ""}"><span class="badge2">${esc(sc.tag)}</span><b>${esc(sc.label)}</b><span class="mut">Visits at month ${esc(sc.months)}</span></div>`,
      )
      .join("");
    const visitsById = Object.fromEntries((machine.optionalVisits ?? []).map((v) => [v.id, v]));
    const optIds = (machine.optionalVisits ?? []).map((v) => v.id);
    const vHead = [...optIds.slice().reverse(), machine.visits[0].id];
    const vLabel = (id) => (id === machine.visits[0].id ? "12-month" : visitsById[id].label.replace(" PM", ""));
    const rows = machine.configurations
      .map((cfg) => {
        const base = calcConfig(machine, rates, cfg.id, cfg.variants[0].id);
        const perVisit = vHead
          .map((id) => {
            const v = id === machine.visits[0].id ? base.visits[0] : calcOptionalVisit(machine, rates, id, cfg.id);
            const kit = id === machine.visits[0].id ? "" : `<div class="mut">kit ${esc(v.kit.partNo)}</div>`;
            return `<td class="r"><b>${$(v.totalCents)}</b>${kit}</td>`;
          })
          .join("");
        const perYear = schedules.map((sc) => `<td class="r"><b>${$(calcSchedule(machine, rates, sc.id, cfg.id).totalCents)}</b></td>`).join("");
        return `<tr><td>${esc(cfg.label)}</td>${perVisit}${perYear}</tr>`;
      })
      .join("");
    const coverage = [
      { title: "12-month PM", text: machine.visits[0].services },
      ...(machine.optionalVisits ?? []).map((v) => ({ title: v.label, text: v.summary })),
    ]
      .map((c) => `<div><h4>${esc(c.title)}</h4><p>${esc(c.text)}</p></div>`)
      .join("");
    const hrs = [...new Set((machine.optionalVisits ?? []).map((v) => v.hours))].join(" / ");
    pages.push(
      pageShell(
        machine,
        3 + machine.configurations.length,
        total,
        "Service intervals",
        `<h2>Recommended Service Intervals</h2>
<div class="scheds">${cards}</div>
<table class="tight"><tr><th></th><th colspan="${vHead.length}" class="c">Cost per visit</th><th colspan="${schedules.length}" class="c">Cost per year</th></tr>
<tr><th>Configuration</th>${vHead.map((id) => `<th class="r">${esc(vLabel(id))}</th>`).join("")}${schedules.map((sc) => `<th class="r">${esc(sc.label)}</th>`).join("")}</tr>${rows}</table>
<div class="cov">${coverage}</div>
<p class="note">Each visit is PM kit + ${hrs} hr${hrs === "1" ? "" : "s"} program labor (${$(progLabor)}/hr) + program trip (${$(progTrip)}), with ${pct}% off labor and trip. The 12-month price includes the full annual parts list.</p>`,
      ),
    );
  }

  // 4. Summary
  const head = variantIds.map((id) => `<th class="r">${esc(variantLabel(id))} total</th>`).join("");
  const sumRows = machine.configurations
    .map((cfg) => {
      const cells = variantIds
        .map((id) => (cfg.variants.some((v) => v.id === id) ? `<td class="r"><b>${$(calc(cfg, id).totalCents)}</b></td>` : `<td class="r">—</td>`))
        .join("");
      const s = calc(cfg, cfg.variants[0].id);
      return `<tr><td>${esc(cfg.label)}</td><td class="r">${$(s.partsCents)}</td><td class="r">${$(s.laborCents)}</td><td class="r">${$(s.tripCents)}</td>${cells}</tr>`;
    })
    .join("");
  pages.push(
    pageShell(
      machine,
      total,
      total,
      "Summary",
      `<h2>${planMonths(machine)}-Month PM Cost by Configuration</h2>
<table><tr><th>Configuration</th><th class="r">Parts</th><th class="r">Labor</th><th class="r">Trip</th>${head}</tr>${sumRows}</table>
<div class="card" style="margin-top:16px"><h3>Good to know</h3><ul class="good">
<li>${hasSchedules ? "A 12-month PM is highly recommended every year. For high-volume locations we recommend 6-month intervals." : "At least one PM visit per year is recommended."}</li>
<li>Labor and trip are ${pct}% off standard rates and are included in every total.</li>
<li>Parts are list price. Items that are only inspected are quoted if they need replacing.</li>
<li>Installation is not included in PM pricing.</li></ul></div>`,
    ),
  );

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(machine.name)} PM Program</title><style>${CSS}</style></head><body>${pages.join("\n")}</body></html>`;
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    // No local node_modules: fall back to a globally installed Playwright.
    const { createRequire } = await import("node:module");
    const { execFileSync } = await import("node:child_process");
    const root = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    return createRequire(`${root}/`)("playwright");
  }
}

export async function renderGuidePdf(machine, rates, outPath) {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(renderGuideHtml(machine, rates), { waitUntil: "load" });
    await page.pdf({ path: outPath, width: "960px", height: "540px", printBackground: true });
  } finally {
    await browser.close();
  }
}
