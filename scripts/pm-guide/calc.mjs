import { readFileSync } from "node:fs";

const RATES_PATH = new URL("../../pm-guides/rates.json", import.meta.url);

export function loadRates(path = RATES_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Rate after a percent discount, rounded half-up to the cent. */
export function discounted(standardCents, pct) {
  return Math.round((standardCents * (100 - pct)) / 100);
}

function find(list, id, what, machine) {
  const hit = list.find((x) => x.id === id);
  if (!hit) throw new Error(`${machine.id}: unknown ${what} "${id}"`);
  return hit;
}

export function calcConfig(machine, rates, configId, variantId) {
  const config = find(machine.configurations, configId, "configuration", machine);
  const variant = find(config.variants, variantId, "variant", machine);
  for (const partId of variant.addParts ?? []) find(machine.parts, partId, "part", machine);

  const programLabor = discounted(rates.laborRateCents, rates.discountPct);
  const programTrip = discounted(rates.tripRateCents, rates.discountPct);

  const visits = machine.visits.map((visit) => {
    if (typeof visit.hours !== "number" || !(visit.hours > 0)) {
      throw new Error(`${machine.id}: visit "${visit.id}" has no labor hours`);
    }
    const lines = [];
    for (const part of machine.parts) {
      if (!part.visits.includes(visit.id)) continue;
      if (part.optional && !(variant.addParts ?? []).includes(part.id)) continue;
      const qty = config.qtyOverrides?.[part.id] ?? part.qty.base + part.qty.perUnit * config.units;
      if (qty <= 0) continue;
      lines.push({
        partId: part.id,
        name: part.name,
        partNo: part.partNo,
        qty,
        unitCents: part.unitCents,
        extCents: qty * part.unitCents,
      });
    }
    const partsCents = lines.reduce((s, l) => s + l.extCents, 0);
    const laborCents = Math.round(programLabor * visit.hours);
    return {
      id: visit.id,
      label: visit.label,
      month: visit.month,
      hours: visit.hours,
      lines,
      partsCents,
      laborCents,
      tripCents: programTrip,
      totalCents: partsCents + laborCents + programTrip,
      standardLaborCents: Math.round(rates.laborRateCents * visit.hours),
    };
  });

  const sum = (k) => visits.reduce((s, v) => s + v[k], 0);
  const standardLaborCents = sum("standardLaborCents");
  const standardTripCents = rates.tripRateCents * visits.length;
  return {
    configId,
    variantId,
    visits,
    partsCents: sum("partsCents"),
    laborCents: sum("laborCents"),
    tripCents: sum("tripCents"),
    totalCents: sum("totalCents"),
    standardLaborCents,
    standardTripCents,
    savingsCents: standardLaborCents + standardTripCents - sum("laborCents") - sum("tripCents"),
  };
}

/** One optional service visit (e.g. a 6-month PM) priced from a per-configuration PM kit. */
export function calcOptionalVisit(machine, rates, visitId, configId) {
  const visit = find(machine.optionalVisits ?? [], visitId, "optional visit", machine);
  if (typeof visit.hours !== "number" || !(visit.hours > 0)) {
    throw new Error(`${machine.id}: optional visit "${visit.id}" has no labor hours`);
  }
  const kit = visit.kits?.[configId];
  if (!kit) throw new Error(`${machine.id}: optional visit "${visit.id}" has no kit for configuration "${configId}"`);
  const laborCents = Math.round(discounted(rates.laborRateCents, rates.discountPct) * visit.hours);
  const tripCents = discounted(rates.tripRateCents, rates.discountPct);
  return {
    id: visit.id,
    label: visit.label,
    hours: visit.hours,
    kit,
    partsCents: kit.unitCents,
    laborCents,
    tripCents,
    totalCents: kit.unitCents + laborCents + tripCents,
    standardLaborCents: Math.round(rates.laborRateCents * visit.hours),
    standardTripCents: rates.tripRateCents,
  };
}

/** Yearly cost of a service schedule (a mix of the base visit and optional visits) for one configuration. */
export function calcSchedule(machine, rates, scheduleId, configId) {
  const schedule = find(machine.schedules ?? [], scheduleId, "schedule", machine);
  const config = find(machine.configurations, configId, "configuration", machine);
  const base = calcConfig(machine, rates, configId, config.variants[0].id);
  const total = { partsCents: 0, laborCents: 0, tripCents: 0, totalCents: 0, savingsCents: 0, visitCount: 0 };
  for (const { ref, times } of schedule.visits) {
    const v =
      base.visits.find((x) => x.id === ref) ?? calcOptionalVisit(machine, rates, ref, configId);
    total.partsCents += times * v.partsCents;
    total.laborCents += times * v.laborCents;
    total.tripCents += times * v.tripCents;
    total.totalCents += times * v.totalCents;
    total.savingsCents += times * (v.standardLaborCents + (v.standardTripCents ?? rates.tripRateCents) - v.laborCents - v.tripCents);
    total.visitCount += times;
  }
  return { scheduleId, configId, ...total };
}
