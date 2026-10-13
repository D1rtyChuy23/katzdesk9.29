import { calcConfig, discounted } from "./calc.mjs";

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
.page { width: 960px; height: 540px; padding: 34px 44px 44px; position: relative; overflow: hidden; page-break-after: always; background: #fff }
.kicker { font-size: 11px; letter-spacing: .16em; color: var(--accent); font-weight: 700; text-transform: uppercase }
h1 { font-size: 34px; color: var(--brand); margin: 6px 0 4px; line-height: 1.1 }
h2 { font-size: 24px; color: var(--brand); margin: 4px 0 12px }
.sub { color: var(--muted); font-size: 14px; max-width: 700px }
.tiles { display: flex; gap: 12px; margin: 22px 0 18px }
.tile { flex: 1; background: var(--brand); color: #fff; border-radius: 8px; padding: 14px 12px }
.tile b { display: block; font-size: 24px; line-height: 1.1 }
.tile span { font-size: 10px; letter-spacing: .1em; text-transform: uppercase; opacity: .8 }
table { border-collapse: collapse; width: 100%; font-size: 12px }
th { text-align: left; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border-bottom: 2px solid var(--line); padding: 6px 8px }
td { padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap:anywhere }
th.r, td.r { text-align: right; white-space: nowrap }
tr.total td { font-weight: 700; border-top: 2px solid var(--brand); border-bottom: 0; background: var(--soft) }
.cols { display: flex; gap: 28px }
.cols > div { flex: 1; min-width: 0 }
.card { background: var(--soft); border-radius: 8px; padding: 14px 16px }
.card h3 { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--brand); margin-bottom: 8px }
.bar { display: flex; height: 22px; border-radius: 4px; overflow: hidden; margin: 6px 0 4px }
.bar i { display: block; height: 100% }
.legend { font-size: 11px; color: var(--muted); display: flex; gap: 14px; margin-top: 8px }
.legend s { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; text-decoration: none; vertical-align: -1px }
.big { font-size: 28px; font-weight: 700; color: var(--brand) }
.save { color: var(--labor); font-weight: 700; font-size: 13px; margin-top: 8px }
.note { font-size: 12px; color: var(--muted); margin-top: 10px; line-height: 1.5 }
ul.good { margin: 8px 0 0 18px; font-size: 13px; line-height: 1.7 }
.foot { position: absolute; left: 44px; right: 44px; bottom: 14px; display: flex; justify-content: space-between; gap: 20px; font-size: 9.5px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 6px }
`;

function pageShell(machine, n, total, kicker, body) {
  return `<section class="page">
<div class="kicker">${esc(kicker)}</div>
${body}
<div class="foot"><span>${esc(DISCLAIMER)}</span><span>${esc(machine.name)} · Preventive Maintenance Program · ${n}/${total}</span></div>
</section>`;
}

function planMonths(machine) {
  return Math.max(...machine.visits.map((v) => v.month));
}

function intervalText(machine, part) {
  const months = part.visits.map((id) => machine.visits.find((v) => v.id === id).month);
  return machine.visits.length === 1 ? `Every ${months[0]} months` : `Months ${months.join(", ")}`;
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

function bar(r) {
  const t = r.totalCents;
  const w = (c) => ((c / t) * 100).toFixed(1);
  return `<div class="bar"><i style="width:${w(r.partsCents)}%;background:var(--parts)"></i><i style="width:${w(r.laborCents)}%;background:var(--labor)"></i><i style="width:${w(r.tripCents)}%;background:var(--trip)"></i></div>`;
}

export function renderGuideHtml(machine, rates) {
  const pct = rates.discountPct;
  const progLabor = discounted(rates.laborRateCents, pct);
  const progTrip = discounted(rates.tripRateCents, pct);
  const unit = machine.unitLabel;
  const variantIds = [...new Set(machine.configurations.flatMap((c) => c.variants.map((v) => v.id)))];
  const variantLabel = (id) => machine.configurations.flatMap((c) => c.variants).find((v) => v.id === id).label;
  const calc = (c, v) => calcConfig(machine, rates, c.id, v);
  const total = 3 + machine.configurations.length;
  const pages = [];

  // 1. Cover
  const visitRows = machine.visits
    .map(
      (v) =>
        `<tr><td>Month ${v.month}</td><td>${esc(v.label)}</td><td>${esc(v.services ?? "")}</td><td class="r">${v.hours} hrs</td></tr>`,
    )
    .join("");
  pages.push(
    pageShell(
      machine,
      1,
      total,
      "Preventive Maintenance Program",
      `<h1>${esc(machine.name)}</h1>
<p class="sub">${esc(machine.subtitle)} with ${pct}% off PM labor and trip charge for program participants.</p>
<div class="tiles">
<div class="tile"><b>${planMonths(machine)}</b><span>Month plan</span></div>
<div class="tile"><b>${machine.visits.length}</b><span>Scheduled PM visit${machine.visits.length > 1 ? "s" : ""}</span></div>
<div class="tile"><b>${pct}%</b><span>Off PM labor &amp; trip</span></div>
<div class="tile"><b>${$(progLabor)}/hr</b><span>Program labor rate</span></div>
<div class="tile"><b>${$(progTrip)}</b><span>Program trip charge</span></div>
</div>
<table><tr><th>When</th><th>Visit</th><th>Services performed</th><th class="r">Labor</th></tr>${visitRows}</table>
<p class="note">Standard rates: ${$(rates.laborRateCents)}/hr labor and ${$(rates.tripRateCents)} trip. Program rates: ${$(progLabor)}/hr labor and ${$(progTrip)} per visit. The trip charge is included in every total in this guide.</p>`,
    ),
  );

  // 2. Parts table + inspect-only
  const partRows = machine.parts
    .map(
      (p) =>
        `<tr><td>${esc(p.name)}${p.optional ? " <em>(MP models)</em>" : ""}</td><td>${esc(p.partNo)}</td><td>${esc(intervalText(machine, p))}</td><td class="r">${$(p.unitCents)}${p.qty.perUnit ? ` / ${esc(unit)}` : ""}</td></tr>`,
    )
    .join("");
  const inspectRows = (machine.inspectOnly ?? [])
    .map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.partNo)}</td><td class="r">${$(i.unitCents)}</td></tr>`)
    .join("");
  pages.push(
    pageShell(
      machine,
      2,
      total,
      "Parts",
      `<h2>PM Kit Contents</h2>
<div class="cols"><div style="flex:1.7"><table><tr><th>Part</th><th>Part #</th><th>Replaced</th><th class="r">Unit cost</th></tr>${partRows}</table></div>
${
  inspectRows
    ? `<div class="card"><h3>Inspected, not included</h3><table><tr><th>Part</th><th>Part #</th><th class="r">Price</th></tr>${inspectRows}</table><p class="note">Not included in the totals. Quoted only if replacement is needed.</p></div>`
    : ""
}</div>`,
    ),
  );

  // 3. One page per configuration
  machine.configurations.forEach((cfg, i) => {
    const results = cfg.variants.map((v) => ({ v, r: calc(cfg, v.id) }));
    const std = results[0].r;
    const lineRows = [];
    const seen = new Set();
    for (const { v, r } of results) {
      for (const l of aggregate(r)) {
        if (seen.has(l.partId)) continue;
        seen.add(l.partId);
        const tag = results.length > 1 && v !== results[0].v ? ` <em>(${esc(v.label)} only)</em>` : "";
        lineRows.push(
          `<tr><td>${esc(l.name)}${tag}</td><td>${esc(l.partNo)}</td><td>${esc(monthsText(l.months))}</td><td class="r">${l.qty}</td><td class="r">${$(l.unitCents)}</td><td class="r">${$(l.extCents)}</td></tr>`,
        );
      }
    }
    const totals = results
      .map(
        ({ v, r }) =>
          `<div style="margin-bottom:12px"><div class="kicker" style="color:var(--muted)">${esc(v.label)} · ${planMonths(machine)}-month total</div><div class="big">${$(r.totalCents)}</div>${bar(r)}<div class="note" style="margin-top:2px">Parts ${$(r.partsCents)} · Labor ${$(r.laborCents)} · Trip ${$(r.tripCents)}</div></div>`,
      )
      .join("");
    pages.push(
      pageShell(
        machine,
        3 + i,
        total,
        `Configuration ${i + 1} of ${machine.configurations.length}`,
        `<h2>${esc(cfg.label)}</h2>
<div class="cols"><div style="flex:1.6"><table><tr><th>Part</th><th>Part #</th><th>Replaced</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Ext.</th></tr>${lineRows.join("")}</table></div>
<div class="card" style="flex:1">${totals}<div class="legend"><span><s style="background:var(--parts)"></s>Parts</span><span><s style="background:var(--labor)"></s>Labor</span><span><s style="background:var(--trip)"></s>Trip</span></div><div class="save">You save ${$(std.savingsCents)} on labor and trip</div></div></div>`,
      ),
    );
  });

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
<li>At least one PM visit per year is recommended.</li>
<li>Labor and trip are ${pct}% off standard rates and are included in every total.</li>
<li>Parts are list price. Items that are only inspected are quoted if they need replacing.</li>
<li>Installation is not included in PM pricing.</li></ul></div>`,
    ),
  );

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(machine.name)} PM Program</title><style>${CSS}</style></head><body>${pages.join("\n")}</body></html>`;
}

export async function renderGuidePdf(machine, rates, outPath) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(renderGuideHtml(machine, rates), { waitUntil: "load" });
    await page.pdf({ path: outPath, width: "960px", height: "540px", printBackground: true });
  } finally {
    await browser.close();
  }
}
