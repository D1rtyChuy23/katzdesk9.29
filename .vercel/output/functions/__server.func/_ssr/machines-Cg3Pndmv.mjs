import { a as listedEquipment, i as joinEquipment } from "./equipment-BqmdRYT6.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/machines-Cg3Pndmv.js
function parseMachinesJson(raw) {
	if (!raw?.trim()) return [];
	try {
		const v = JSON.parse(raw);
		if (!Array.isArray(v)) return [];
		const out = [];
		for (const row of v) {
			if (!row || typeof row !== "object") continue;
			const rec = row;
			const equipment = String(rec.equipment ?? "").trim();
			if (!equipment) continue;
			out.push({
				equipment,
				serial: String(rec.serial ?? "").trim(),
				powerVoltage: String(rec.powerVoltage ?? "").trim()
			});
		}
		return out;
	} catch {
		return [];
	}
}
function takeSpec(pool, equipment) {
	const key = equipment.toLowerCase();
	const idx = pool.findIndex((s) => s.equipment.toLowerCase() === key);
	if (idx < 0) return void 0;
	return pool.splice(idx, 1)[0];
}
function mergeMachineSpecs(names, previous = [], legacy) {
	const fromJson = parseMachinesJson(legacy?.machines);
	const prev = [...previous];
	const json = [...fromJson];
	const specs = names.map((equipment) => {
		const hit = takeSpec(prev, equipment) ?? takeSpec(json, equipment);
		return {
			equipment,
			serial: hit?.serial ?? "",
			powerVoltage: hit?.powerVoltage ?? ""
		};
	});
	if (!(fromJson.length > 0) && specs.length === 1) {
		const only = specs[0];
		if (!only.serial && legacy?.serial && !legacy.serial.trim().startsWith("[")) only.serial = legacy.serial.trim();
		if (!only.powerVoltage && legacy?.powerVoltage && !legacy.powerVoltage.trim().startsWith("[")) only.powerVoltage = legacy.powerVoltage.trim();
	}
	return specs;
}
function serializeMachines(specs) {
	const clean = specs.map((s) => ({
		equipment: s.equipment.trim(),
		serial: s.serial.trim(),
		powerVoltage: s.powerVoltage.trim()
	})).filter((s) => s.equipment);
	if (!clean.length) return {
		equipment: null,
		machines: null,
		serial: null,
		powerVoltage: null
	};
	const serials = clean.map((s) => s.serial).filter(Boolean);
	const powers = clean.map((s) => s.powerVoltage).filter(Boolean);
	return {
		equipment: joinEquipment(clean.map((s) => s.equipment)),
		machines: JSON.stringify(clean),
		serial: serials.length ? serials.join(" · ") : null,
		powerVoltage: powers.length ? powers.join(" · ") : null
	};
}
function specsFromInstall(equipment, serial, powerVoltage, machines, catalog = []) {
	const fromJson = parseMachinesJson(machines);
	if (fromJson.length) return fromJson;
	return mergeMachineSpecs(listedEquipment(equipment, catalog), [], {
		serial,
		powerVoltage
	});
}
//#endregion
export { serializeMachines as n, specsFromInstall as r, mergeMachineSpecs as t };
