import { r as __exportAll } from "../_runtime.mjs";
import { A as boolean, F as object, P as number, R as string } from "../_libs/@better-auth/core+[...].mjs";
import { n as createServerFn } from "../_libs/@tanstack/start-client-core+[...].mjs";
import { r as getSql } from "./popup.server.mjs";
import { i as deskMiddleware } from "./access.mjs";
import { a as catalogModels, c as listedEquipment, n as parseMachinesJson, r as serializeMachines } from "./machines.mjs";
//#region src/lib/ops/warehouse.ts
var BACK_PALLETS = [
	"B",
	"C",
	"D",
	"E",
	"F",
	"G",
	"H",
	"I",
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"Q"
];
var FRONT_PALLETS = [
	"J",
	"K",
	"L",
	"M",
	"N",
	"O",
	"P",
	"Q"
];
var LEVELS = [
	4,
	3,
	2,
	1
];
var LOCATION_SITES = [
	"front-lobby",
	"service-room",
	"production",
	"training",
	"out-of-state",
	"san-antonio",
	"dallas"
];
var SITE_LABEL = {
	"barn-back": "Barn · back rack",
	"barn-front": "Barn · front rack",
	"front-lobby": "Front Lobby",
	"service-room": "Service Room",
	"production": "Production",
	"training": "Training Room",
	"out-of-state": "Out of State",
	"san-antonio": "San Antonio",
	dallas: "Dallas",
	field: "Pulled from the barn",
	sold: "Sold"
};
var SITE_PURPOSE = {
	"front-lobby": "Front Lobby",
	"service-room": "Service bench",
	production: "Production",
	training: "Training",
	"out-of-state": "Out of state",
	"san-antonio": "SA warehouse",
	dallas: "Dallas warehouse"
};
var BARN_EQUIP_CAPACITY = 1056;
function bayFor(site, pallet) {
	if (site === "barn-back" && pallet) {
		if ("BCDE".includes(pallet)) return "catering";
		if ("FG".includes(pallet)) return "dispenser";
	}
	return "general";
}
function palletsFor(site) {
	return site === "barn-front" ? FRONT_PALLETS : BACK_PALLETS;
}
function slotId(pallet, level, line) {
	return line ? `${pallet}-L${level} · ${line}` : `${pallet}-L${level}`;
}
function siteLabel(site) {
	return SITE_LABEL[site] ?? site;
}
function isBarn(site) {
	return site === "barn-back" || site === "barn-front";
}
//#endregion
//#region src/lib/ops/serial-pull.ts
var serial_pull_exports = /* @__PURE__ */ __exportAll({
	applySerialPull: () => applySerialPull,
	ensureSerialNotice: () => ensureSerialNotice,
	serialKey: () => serialKey
});
function serialKey(raw) {
	return (raw ?? "").trim().replace(/[#\s]/g, "").toLowerCase();
}
function voltageFrom(text) {
	if (!text) return "";
	const m = text.match(/\b(\d{2,3}\s*V(?:\s*\/\s*[^\s,;]+)?(?:\s*\/\s*\d{1,3}A)?)\b/i);
	return m ? m[1].replace(/\s+/g, " ") : "";
}
function locationOf(a) {
	if (a.pallet && a.level != null) return slotId(a.pallet, Number(a.level), a.line_no);
	return siteLabel(a.site);
}
function allocatedLabel(a) {
	if (a.sold_to?.trim()) return a.sold_to.trim();
	if (a.status === "sold") return "sold";
	if (a.status === "assigned" || a.install_id || a.job_id) return a.sold_to?.trim() || "another account";
	if (a.status === "deployed" || !isBarn(a.site)) return a.purpose?.trim() || siteLabel(a.site);
	return null;
}
function isAvailable(a) {
	if (a.status === "sold") return false;
	if (a.status === "assigned") return false;
	if (a.install_id || a.job_id) return false;
	if (a.sold_to) return false;
	return a.status === "ready" && isBarn(a.site);
}
function toHit(a) {
	const allocatedTo = isAvailable(a) ? null : allocatedLabel(a);
	return {
		assetId: a.id,
		serial: a.serial ?? "",
		model: a.model,
		location: locationOf(a),
		status: a.status,
		soldTo: a.sold_to,
		installId: a.install_id,
		jobId: a.job_id,
		notes: a.notes,
		powerVoltage: voltageFrom(a.notes) || voltageFrom(a.purpose),
		available: isAvailable(a),
		allocatedTo
	};
}
async function ensureSerialNotice(sql) {
	await sql.query("alter table installs add column if not exists serial_notice text");
	await sql.query("alter table service_jobs add column if not exists serial_notice text");
}
async function readySql() {
	const { ensureSeeded } = await import("./seed.server.mjs");
	await ensureSeeded();
	return getSql();
}
async function deskUsername(sql, userId) {
	return (await sql.query("select username from desk_accounts where user_id = $1", [userId]))[0]?.username || "Teammate";
}
async function logActivity(sql, userId, entityType, entityId, action, detail) {
	const actor = await deskUsername(sql, userId);
	await sql.query(`insert into activity (entity_type, entity_id, actor_name, action, detail)
     values ($1, $2, $3, $4, $5)`, [
		entityType,
		entityId,
		actor,
		action,
		detail ?? null
	]);
}
async function loadBySerial(sql, raw) {
	const key = serialKey(raw);
	if (!key) return null;
	const matches = (await sql.query(`select id, model, serial, status, site, pallet, level, line_no, sold_to, install_id, job_id,
            notes, purpose, origin_site, origin_pallet, origin_level, customer_owned
       from assets
      where serial is not null and btrim(serial) <> ''`)).filter((r) => serialKey(r.serial) === key);
	if (!matches.length) return null;
	return matches.find((a) => isAvailable(a)) ?? matches.find((a) => a.status !== "sold") ?? matches[0] ?? null;
}
function notFoundResult(serial) {
	return {
		serial,
		found: false,
		pulled: false,
		needsConfirm: false,
		alreadyHere: false,
		allocatedTo: null,
		notice: `Serial ${serial} not found in warehouse.`,
		model: null,
		powerVoltage: null,
		location: null,
		assetId: null
	};
}
function pulledNotice(serial, hit, extra) {
	const bits = [
		`Serial ${serial} pulled from warehouse`,
		hit.model,
		hit.location
	];
	if (extra) bits.push(extra);
	return bits.filter(Boolean).join(" · ");
}
async function setInstallNotice(sql, id, notice) {
	await sql.query("update installs set serial_notice = $2, updated_at = now() where id = $1", [id, notice]);
}
async function setJobNotice(sql, id, notice) {
	await sql.query("update service_jobs set serial_notice = $2, updated_at = now() where id = $1", [id, notice]);
}
async function attachAsset(sql, userId, asset, opts) {
	const originSite = asset.origin_site ?? asset.site;
	const originPallet = asset.origin_pallet ?? asset.pallet;
	const originLevel = asset.origin_level ?? asset.level;
	const purpose = opts.installId ? asset.customer_owned ? "Customer-owned / loaner" : "Install" : asset.customer_owned ? "Customer-owned / service loaner" : "Service";
	await sql.query(`update assets set
        status = 'assigned',
        site = 'field',
        pallet = null,
        level = null,
        line_no = null,
        install_id = $2,
        job_id = $3,
        sold_to = $4,
        origin_site = $5,
        origin_pallet = $6,
        origin_level = $7,
        purpose = $8,
        updated_at = now()
      where id = $1`, [
		asset.id,
		opts.installId ?? null,
		opts.jobId ?? null,
		opts.customer,
		originSite,
		originPallet,
		originLevel,
		purpose
	]);
	const detail = `Pulled ${asset.model}${asset.serial ? " · " + asset.serial : ""} from ${locationOf(asset)}.`;
	if (opts.installId) await logActivity(sql, userId, "install", opts.installId, "assigned-asset", detail);
	if (opts.jobId) {
		const kind = (await sql.query("select kind from service_jobs where id = $1", [opts.jobId]))[0]?.kind;
		if (kind) await logActivity(sql, userId, kind, opts.jobId, "assigned-asset", detail);
	}
	await logActivity(sql, userId, "asset", asset.id, "assigned-serial", detail);
}
async function writeInstallSerial(sql, installId, serial, machineIndex, fill) {
	const row = (await sql.query("select equipment, serial, power_voltage, machines from installs where id = $1", [installId]))[0];
	if (!row) return;
	const catalog = catalogModels([row.equipment ?? "", fill.model ?? ""]);
	const names = listedEquipment(row.equipment, catalog);
	let specs = parseMachinesJson(row.machines);
	if (!specs.length) specs = names.length ? names.map((equipment) => ({
		equipment,
		serial: names.length === 1 ? row.serial ?? "" : "",
		powerVoltage: names.length === 1 ? row.power_voltage ?? "" : ""
	})) : [{
		equipment: row.equipment ?? fill.model ?? "",
		serial: row.serial ?? "",
		powerVoltage: row.power_voltage ?? ""
	}];
	let idx = machineIndex ?? specs.findIndex((s) => serialKey(s.serial) === serialKey(serial) || !s.serial.trim());
	if (idx < 0 || idx >= specs.length) idx = 0;
	if (!specs.length) {
		specs = [{
			equipment: fill.model ?? "",
			serial,
			powerVoltage: fill.powerVoltage ?? ""
		}];
		idx = 0;
	}
	const cur = specs[idx] ?? {
		equipment: "",
		serial: "",
		powerVoltage: ""
	};
	specs[idx] = {
		equipment: cur.equipment || fill.model || "",
		serial,
		powerVoltage: cur.powerVoltage || fill.powerVoltage || ""
	};
	const packed = serializeMachines(specs);
	await sql.query(`update installs set equipment = $2, serial = $3, power_voltage = $4, machines = $5, updated_at = now()
      where id = $1`, [
		installId,
		packed.equipment,
		packed.serial,
		packed.powerVoltage,
		packed.machines
	]);
}
var lookupInput = object({ serial: string() });
createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => lookupInput.parse(d)).handler(async ({ data }) => {
	const sql = await readySql();
	await ensureSerialNotice(sql);
	const serial = data.serial.trim();
	if (!serialKey(serial)) return {
		serial,
		hit: null
	};
	const asset = await loadBySerial(sql, serial);
	return {
		serial,
		hit: asset ? toHit(asset) : null
	};
});
var applyInput = object({
	serial: string().min(1),
	installId: number().optional(),
	jobId: number().optional(),
	machineIndex: number().nullable().optional(),
	confirmReuse: boolean().optional()
});
var applySerialPull = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => applyInput.parse(d)).handler(async ({ data, context }) => {
	const sql = await readySql();
	await ensureSerialNotice(sql);
	const serial = data.serial.trim();
	if (!serialKey(serial)) return notFoundResult(serial);
	if (!data.installId && !data.jobId) throw new Error("Pick an install or ticket to attach this serial.");
	const asset = await loadBySerial(sql, serial);
	if (!asset) {
		const result = notFoundResult(serial);
		if (data.installId) {
			await writeInstallSerial(sql, data.installId, serial, data.machineIndex ?? null, {
				model: null,
				powerVoltage: null
			});
			await setInstallNotice(sql, data.installId, result.notice);
			await logActivity(sql, context.userId, "install", data.installId, "serial-miss", result.notice);
		}
		if (data.jobId) {
			const kind = (await sql.query("select kind from service_jobs where id = $1", [data.jobId]))[0]?.kind ?? "service";
			await setJobNotice(sql, data.jobId, result.notice);
			await logActivity(sql, context.userId, kind, data.jobId, "serial-miss", result.notice);
		}
		return result;
	}
	const hit = toHit(asset);
	if (data.installId && asset.install_id === data.installId || data.jobId && asset.job_id === data.jobId) {
		const notice = pulledNotice(serial, hit);
		if (data.installId) {
			await writeInstallSerial(sql, data.installId, asset.serial ?? serial, data.machineIndex ?? null, {
				model: hit.model,
				powerVoltage: hit.powerVoltage || null
			});
			await setInstallNotice(sql, data.installId, notice);
		}
		if (data.jobId) await setJobNotice(sql, data.jobId, notice);
		return {
			serial: asset.serial ?? serial,
			found: true,
			pulled: true,
			needsConfirm: false,
			alreadyHere: true,
			allocatedTo: null,
			notice,
			model: hit.model,
			powerVoltage: hit.powerVoltage || null,
			location: hit.location,
			assetId: hit.assetId
		};
	}
	if (!hit.available && !data.confirmReuse) {
		const who = hit.allocatedTo || "another account";
		const notice = `Serial ${asset.serial ?? serial} is already assigned to ${who}.`;
		return {
			serial: asset.serial ?? serial,
			found: true,
			pulled: false,
			needsConfirm: true,
			alreadyHere: false,
			allocatedTo: who,
			notice,
			model: hit.model,
			powerVoltage: hit.powerVoltage || null,
			location: hit.location,
			assetId: hit.assetId
		};
	}
	let customer = "";
	if (data.installId) {
		const inst = (await sql.query("select customer from installs where id = $1", [data.installId]))[0];
		if (!inst) throw new Error("Install not found");
		customer = inst.customer;
	} else if (data.jobId) {
		const job = (await sql.query("select customer, equipment from service_jobs where id = $1", [data.jobId]))[0];
		if (!job) throw new Error("Ticket not found");
		customer = job.customer ?? "";
		if (!job.equipment && hit.model) await sql.query("update service_jobs set equipment = $2, updated_at = now() where id = $1", [data.jobId, hit.model]);
	}
	const extra = !hit.available && hit.allocatedTo ? `was assigned to ${hit.allocatedTo}` : void 0;
	await attachAsset(sql, context.userId, asset, {
		customer,
		installId: data.installId,
		jobId: data.jobId
	});
	const notice = pulledNotice(asset.serial ?? serial, hit, extra);
	if (data.installId) {
		await writeInstallSerial(sql, data.installId, asset.serial ?? serial, data.machineIndex ?? null, {
			model: hit.model,
			powerVoltage: hit.powerVoltage || null
		});
		await setInstallNotice(sql, data.installId, notice);
	}
	if (data.jobId) await setJobNotice(sql, data.jobId, notice);
	return {
		serial: asset.serial ?? serial,
		found: true,
		pulled: true,
		needsConfirm: false,
		alreadyHere: false,
		allocatedTo: extra ? hit.allocatedTo : null,
		notice,
		model: hit.model,
		powerVoltage: hit.powerVoltage || null,
		location: hit.location,
		assetId: hit.assetId
	};
});
//#endregion
export { BARN_EQUIP_CAPACITY as a, LOCATION_SITES as c, bayFor as d, isBarn as f, slotId as h, BACK_PALLETS as i, SITE_LABEL as l, siteLabel as m, serialKey as n, FRONT_PALLETS as o, palletsFor as p, serial_pull_exports as r, LEVELS as s, applySerialPull as t, SITE_PURPOSE as u };
