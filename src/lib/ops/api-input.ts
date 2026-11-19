/**
 * What the saves and reads in api.ts accept (11/16 audit, #4): tickets, PMs, Eversys modules, deals, installs,
 * comments, search, warehouse units, the customer and equipment lists, and recipes.
 *
 * Each shape is the TypeScript type the function already had, now checked when the request arrives. The lengths are
 * ceilings against junk, far above anything real; the handlers still trim, tidy and check what they always did.
 * Optional text also takes null: the handlers already treat a missing value and null alike, and a stale tab may send
 * either. Machine rows keep every field they arrive with (a row's unit id, plug, water and so on), because the
 * machine code reads and writes more of them than any one screen sets.
 */
import { z } from "zod";
import { checked } from "./checked-input";

const rowId = z.number().int().positive();
/** A one-line field: a name, a phone, a WO number, a status. */
const line = z.string().max(2_000);
/** A free-text field: notes, an issue, work done, a typed equipment list. */
const prose = z.string().max(200_000);
/** A plain number from a form (an amount, a quantity, a rack level). Not NaN. */
const num = z.number().finite();

/** One machine row (src/lib/ops/machines.ts MachineSpec). Fields it doesn't name are kept as they came. */
export const machineRow = z.looseObject({
  equipment: line.nullish(),
  serial: line.nullish(),
  powerVoltage: line.nullish(),
  // Any number, as parseMachinesJson reads it: a stored odd value must not stop the row being saved again.
  recipeId: z.number().nullish(),
  ownership: line.nullish(),
  plug: line.nullish(),
  water: line.nullish(),
  coffee: line.nullish(),
  uid: line.nullish(),
  confirmedAt: line.nullish(),
  boardId: z.number().int().nullish(),
  unitId: z.number().int().nullish(),
});
const machines = z.array(machineRow).max(500);
/** An install's list: rows, the stored JSON text, or null for none. */
const machineList = z.union([machines, prose]).nullish();

const kindOfTicket = z.enum(["service", "tlc"]);
const directoryKind = z.enum(["customer", "equipment"]);

// ── Tickets ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const listJobsInput = checked(z.object({ kind: kindOfTicket }));
export const idInput = checked(z.object({ id: rowId }));
export const newTicketInput = checked(
  z.object({
    kind: kindOfTicket,
    customer: line,
    issue: prose.nullish(),
    equipment: prose.nullish(),
    contact: line.nullish(),
    phone: line.nullish(),
    received: line.nullish(),
    callType: line.nullish(),
    technician: line.nullish(),
    urgency: line.nullish(),
  }),
);

// ── PMs and Eversys modules ─────────────────────────────────────────────────────────────────────────────────────
export const updatePmInput = checked(
  z.object({
    id: rowId,
    customer: line.nullish(),
    equipment: prose.nullish(),
    style: line.nullish(),
    projected: line.nullish(),
    partsStatus: line.nullish(),
    status: line.nullish(),
    technician: line.nullish(),
    notes: prose.nullish(),
    workDone: prose.nullish(),
    completedAt: line.nullish(),
    done: z.boolean().optional(),
    wo: line.nullish(),
    po: line.nullish(),
    vendorPo: line.nullish(),
  }),
);
export const createPmInput = checked(z.object({ customer: line, equipment: prose.nullish(), style: line.nullish() }));
export const updateModuleInput = checked(
  z.object({
    id: rowId,
    status: line.nullish(),
    wo: line.nullish(),
    location: line.nullish(),
    dateIn: line.nullish(),
    dateReady: line.nullish(),
    technician: line.nullish(),
    notes: prose.nullish(),
    platform: line.nullish(),
    moduleType: line.nullish(),
  }),
);
export const createModuleInput = checked(z.object({ moduleId: line, platform: line.nullish(), moduleType: line.nullish() }));

// ── Deals ───────────────────────────────────────────────────────────────────────────────────────────────────────
export const confirmDealMachinesInput = checked(
  z.object({
    dealId: rowId,
    machines,
    indexes: z.array(z.number().int().min(0)).max(500),
    project: z.discriminatedUnion("mode", [z.object({ mode: z.literal("new") }), z.object({ mode: z.literal("continue"), installId: rowId })]),
  }),
);
export const updateDealInput = checked(
  z.object({
    id: rowId,
    customer: line.nullish(),
    producer: line.nullish(),
    accountType: line.nullish(),
    equipment: prose.nullish(),
    machines: machines.nullish(),
    amount: num.nullish(),
    goodToOrder: z.boolean().optional(),
    ordered: z.boolean().optional(),
    eta: line.nullish(),
    terms: line.nullish(),
    invoice: line.nullish(),
    completion: line.nullish(),
    notes: prose.nullish(),
    aviKatz: z.boolean().optional(),
    releaseUids: z.array(line).max(500).optional(),
    po: line.nullish(),
    vendorPo: line.nullish(),
  }),
);
export const createDealInput = checked(
  z.object({ customer: line, producer: line.nullish(), equipment: prose.nullish(), machines: machines.nullish(), amount: num.nullish() }),
);
export const dealIdInput = checked(z.object({ dealId: rowId }));

// ── Installs ────────────────────────────────────────────────────────────────────────────────────────────────────
export const updateInstallInput = checked(
  z.object({
    id: rowId,
    customer: line.nullish(),
    equipment: prose.nullish(),
    equipStatus: line.nullish(),
    installDate: line.nullish(),
    technician: line.nullish(),
    wo: line.nullish(),
    reqsReady: line.nullish(),
    notes: prose.nullish(),
    accountRep: line.nullish(),
    paymentStatus: line.nullish(),
    serial: prose.nullish(),
    powerVoltage: prose.nullish(),
    machines: machineList,
    complete: z.boolean().optional(),
    workDone: prose.nullish(),
    completedAt: line.nullish(),
    duplicateOf: rowId.nullish(),
    aviKatz: z.boolean().optional(),
    trfIssued: z.boolean().optional(),
    installType: line.nullish(),
    siteContact: line.nullish(),
    contactPhone: line.nullish(),
    machinesBase: machineList,
    notesBase: prose.nullish(),
    po: line.nullish(),
    vendorPo: line.nullish(),
  }),
);
export const createInstallInput = checked(
  z.object({
    customer: line,
    equipment: prose.nullish(),
    technician: line.nullish(),
    serial: prose.nullish(),
    powerVoltage: prose.nullish(),
    machines: machineList,
  }),
);

// ── Comments, history and search ────────────────────────────────────────────────────────────────────────────────
const entity = { entityType: line, entityId: rowId };
export const entityInput = checked(z.object(entity));
export const addCommentInput = checked(z.object({ ...entity, body: prose, askTeam: line.nullish(), authorName: line.nullish() }));
export const resolveCommentInput = checked(z.object({ id: rowId, resolved: z.boolean() }));
export const searchInput = checked(z.object({ q: line }));

// ── Warehouse units ─────────────────────────────────────────────────────────────────────────────────────────────
export const createAssetInput = checked(
  z.object({
    kind: z.enum(["equip", "dispenser", "module"]).optional(),
    model: line,
    serial: line.nullish(),
    qty: num.optional(),
    customerOwned: line.nullish(),
    site: line,
    pallet: line.nullish(),
    level: num.nullish(),
    purpose: line.nullish(),
    notes: prose.nullish(),
  }),
);
export const updateAssetInput = checked(
  z.object({
    id: rowId,
    model: line.optional(),
    serial: line.nullish(),
    qty: num.optional(),
    customerOwned: line.nullish(),
    purpose: line.nullish(),
    notes: prose.nullish(),
    pallet: line.nullish(),
    level: num.nullish(),
    site: line.optional(),
  }),
);
export const assetInstallInput = checked(z.object({ assetId: rowId, installId: rowId }));
export const assetServiceInput = checked(z.object({ assetId: rowId, customer: line, jobId: rowId.nullish() }));
export const assetIdInput = checked(z.object({ assetId: rowId }));
export const returnAssetInput = checked(z.object({ id: rowId, site: z.enum(["barn-back", "barn-front"]), pallet: line, level: num }));
export const markSoldInput = checked(z.object({ id: rowId, soldTo: line }));

// ── Customers and equipment ─────────────────────────────────────────────────────────────────────────────────────
export const directoryKindInput = checked(z.object({ kind: directoryKind }));
export const nameInput = checked(z.object({ name: line }));
export const customerAccountInput = checked(z.object({ id: rowId, aviKatz: z.boolean().optional(), accountRep: line.nullish() }));
export const addDirectoryInput = checked(z.object({ kind: directoryKind, name: line, confirmSerialLike: z.boolean().nullish() }));
export const archiveDirectoryInput = checked(z.object({ kind: directoryKind, id: rowId }));
export const renameInput = checked(z.object({ id: rowId, name: line }));
export const renameCustomerInput = checked(z.object({ id: rowId, name: line, confirmMerge: line.nullish() }));

// ── Recipes ─────────────────────────────────────────────────────────────────────────────────────────────────────
export const recipeInput = checked(
  z.object({
    id: rowId.optional(),
    name: line.nullish(),
    equipmentModel: line,
    customer: line.nullish(),
    installId: rowId.nullish(),
    copiedFrom: rowId.nullish(),
    coffee1: prose.nullish(),
    coffee2: prose.nullish(),
    coffee3: prose.nullish(),
    powder1: prose.nullish(),
    powder2: prose.nullish(),
    powder3: prose.nullish(),
    americano1: prose.nullish(),
    americano2: prose.nullish(),
    americano3: prose.nullish(),
    tea1: prose.nullish(),
    tea2: prose.nullish(),
    milk: prose.nullish(),
    notes: prose.nullish(),
  }),
);
export const copyRecipeInput = checked(z.object({ sourceId: rowId, customer: line, installId: rowId.nullish() }));
export const deleteRecipeInput = checked(
  z.object({ id: rowId, force: z.boolean().optional(), exceptDealId: rowId.nullish(), exceptIndex: z.number().int().min(0).nullish() }),
);
