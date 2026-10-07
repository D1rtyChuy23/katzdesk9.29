import type { ClockFlag } from "./clock";

export type JobKind = "service" | "tlc";

export type JobSibling = {
  id: number;
  callId: string;
  customer: string | null;
  kind: JobKind;
  status: string;
  wo: string | null;
};

export type ServiceJob = {
  id: number;
  kind: JobKind;
  callId: string;
  contact: string | null;
  phone: string | null;
  received: string | null;
  customer: string | null;
  equipment: string | null;
  issue: string | null;
  callType: string | null;
  phoneResolved: boolean;
  status: string;
  technician: string | null;
  /** A second tech on the same ticket; null when there is only one. */
  secondaryTech: string | null;
  wo: string | null;
  scheduled: string | null;
  /** Time of day on the scheduled date, "HH:MM"; null until someone sets one on the day board. */
  scheduledTime: string | null;
  notes: string | null;
  workDone: string | null;
  completedAt: string | null;
  done: boolean;
  updatedAt: string;
  flag: ClockFlag | null;
  ageDays: number | null;
  urgency: string;
  duplicateOf: number | null;
  siblings: JobSibling[];
  serialNotice: string | null;
  aviKatz: boolean;
};


export type PmJob = {
  id: number;
  customer: string;
  received: string | null;
  equipment: string | null;
  style: string | null;
  projected: string | null;
  scheduledTime: string | null;
  partsStatus: string | null;
  status: string;
  technician: string | null;
  notes: string | null;
  wo: string | null;
  workDone: string | null;
  completedAt: string | null;
  done: boolean;
  updatedAt: string;
  flag: ClockFlag | null;
  aviKatz: boolean;
};


export type ModuleRow = {
  id: number;
  moduleId: string;
  platform: string | null;
  moduleType: string | null;
  status: string;
  wo: string | null;
  location: string | null;
  dateIn: string | null;
  dateReady: string | null;
  technician: string | null;
  notes: string | null;
  updatedAt: string;
  /** Account the module is attached to (via an Eversys unit). Null = not assigned. */
  assignedCustomer: string | null;
  assignedUnitId: number | null;
  assignedUnitLabel: string | null;
  assignedAt: string | null;
  /** Warehouse asked to bring it back; an admin has to approve. */
  returnPending: boolean;
  returnBy: string | null;
  returnByName: string | null;
};

export type Deal = {
  id: number;
  customer: string;
  producer: string | null;
  accountType: string | null;
  dateOfDeal: string | null;
  equipment: string | null;
  amount: number | null;
  goodToOrder: boolean;
  ordered: boolean;
  eta: string | null;
  terms: string | null;
  invoice: string | null;
  completion: string | null;
  notes: string | null;
  handedOff: boolean;
  updatedAt: string;
  aviKatz: boolean;
  noRep: boolean;
};


export type Install = {
  id: number;
  /** Sales ticks this once the Tech Request Form has been sent. Never ticked automatically. */
  trfIssued: boolean;
  received: string | null;
  customer: string;
  equipment: string | null;
  equipStatus: string | null;
  installDate: string | null;
  /** Time of day on the install date, "HH:MM"; null until someone sets one on the day board. */
  scheduledTime: string | null;
  technician: string | null;
  wo: string | null;
  reqsReady: string | null;
  notes: string | null;
  workDone: string | null;
  completedAt: string | null;
  accountRep: string | null;
  paymentStatus: string | null;
  serial: string | null;
  powerVoltage: string | null;
  machines: { equipment: string; serial: string; powerVoltage: string; recipeId?: number | null }[];
  serialNotice: string | null;
  complete: boolean;
  dealId: number | null;
  duplicateOf: number | null;
  updatedAt: string;
  flag: ClockFlag | null;
  daysOut: number | null;
  aviKatz: boolean;
  noRep: boolean;
  inspection?: {
    overall: "Not started" | "In progress" | "Failed" | "Passed";
    failedItems: string[];
    photoCount: number;
    overrideReason: string | null;
    machineCount: number;
    passedCount: number;
  };
};


export type Comment = {
  id: number;
  entityType: string;
  entityId: number;
  authorId: string | null;
  authorName: string | null;
  body: string;
  askTeam: string | null;
  resolved: boolean;
  createdAt: string;
  pingedAt: string | null;
  ownerLabel: string;
  canClaim: boolean;
};

export type Activity = {
  id: number;
  entityType: string;
  entityId: number;
  actorName: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
};

export type FlaggedRow = {
  id: number;
  entityType: string;
  customer: string;
  flag: ClockFlag;
  status: string;
  received: string | null;
  scheduled: string | null;
  technician: string | null;
  detail: string | null;
  kind?: string;
};

export type ComingDueRow = {
  daysOut: number;
  source: string;
  kind: "service" | "tlc" | "pm" | "install";
  customer: string;
  equipment: string | null;
  status: string;
  scheduled: string;
  technician: string | null;
  accountRep: string | null;
  detail: string | null;
  wo: string | null;
  entityType: string;
  id: number;
  aviKatz: boolean;
  noRep: boolean;
  inspectionStatus?: string | null;
  failedItems?: string | null;
};

export type ComingDueCounts = {
  overdue: number;
  today: number;
  thisWeek: number;
  later: number;
};


export type Dashboard = {
  today: string;
  weekLabel: string;
  nextWeekLabel: string;
  kpis: {
    svcFlags: number;
    tlcFlags: number;
    pmFlags: number;
    activeCalls: number;
    pmsActive: number;
    comingDue: number;
    installQueue: number;
    installAtRisk: number;
    openAsks: number;
    barnReady: number;
    barnOpen: number;
    modulesReady: number;
    installReady: number;
    rebuildOverdue: number;
    rebuildWaiting: number;
  };
  statusBreakdown: { status: string; service: number; tlc: number }[];
  techLoad: { tech: string; active: number; completed: number }[];
  flagged: { service: FlaggedRow[]; tlc: FlaggedRow[]; pm: FlaggedRow[] };
  comingDue: ComingDueRow[];
  comingDueBuckets: { label: string; day: number; count: number }[];
  comingDueCounts: ComingDueCounts;
  rebuildAlerts: FlaggedRow[];
  recentHandoff: CommentPreview[];

  pendingHandoffs: { dealId: number; customer: string; equipment: string | null; producer: string | null }[];
  barnReadyByModel: { name: string; count: number }[];
  modulesReadyByType: { name: string; count: number }[];
  installReadyByEquip: { name: string; count: number }[];
  installStatus: { name: string; count: number }[];
  pipelineSnap: {
    openCount: number;
    openValue: number;
    goodToOrder: number;
    ordered: number;
    completeCount: number;
    completeValue: number;
  };
};

export type CommentPreview = Comment & {
  customer: string | null;
};

export type SearchHit = {
  entityType: string;
  id: number;
  title: string;
  subtitle: string;
  status: string | null;
};

export type HandoffOwners = {
  technician: string | null;
  producer: string | null;
  accountRep: string | null;
};

export type HandoffFeed = {
  asks: (CommentPreview & { status: string | null } & HandoffOwners)[];
  recent: (CommentPreview & HandoffOwners)[];
  pendingHandoffs: Dashboard["pendingHandoffs"];
};

export type Asset = {
  id: number;
  kind: "equip" | "dispenser" | "module";
  model: string;
  serial: string | null;
  qty: number;
  customerOwned: string | null;
  site: string;
  pallet: string | null;
  level: number | null;
  lineNo: number | null;
  purpose: string | null;
  status: string;
  soldTo: string | null;
  soldAt: string | null;
  installId: number | null;
  jobId: number | null;
  notes: string | null;
  updatedAt: string;
  bay: "catering" | "dispenser" | "general";
  slotLabel: string;
  missingSerial: boolean;
  needsBay: boolean;
  reviewStatus: "pending" | "approved" | "rejected" | null;
  reviewNote: string | null;
  shopTest: "needs-test" | "tested" | null;
  shopTestNote: string | null;
  shopTestBy: string | null;
  shopTestAt: string | null;
  stockHold: "remove" | "assign" | null;
  stockHoldCustomer: string | null;
  stockHoldReason: string | null;
  stockHoldBy: string | null;
};

export type Recipe = {
  id: number;
  /** Optional label so one account can keep several recipes for the same model. */
  name: string | null;
  equipmentModel: string;
  customer: string | null;
  installId: number | null;
  copiedFrom: number | null;
  isTemplate: boolean;
  coffee1: string | null;
  coffee2: string | null;
  coffee3: string | null;
  powder1: string | null;
  powder2: string | null;
  powder3: string | null;
  americano1: string | null;
  americano2: string | null;
  americano3: string | null;
  tea1: string | null;
  tea2: string | null;
  milk: string | null;
  notes: string | null;
  updatedAt: string;
};

export type DirectoryKind = "customer" | "equipment";

export type DirectoryEntry = {
  id: number;
  name: string;
};

export type CustomerRecord = DirectoryEntry & {
  calls: number;
  tlcs: number;
  installs: number;
  pms: number;
  deals: number;
  recipes: number;
  pendingCalls: number;
  pendingTlcs: number;
  pendingPms: number;
  pendingInstalls: number;
  aviKatz: boolean;
  accountRep: string | null;
  noRep: boolean;
};


export type CustomerHistory = {
  id: number;
  name: string;
  aviKatz: boolean;
  accountRep: string | null;
  jobs: ServiceJob[];
  pms: PmJob[];
  installs: Install[];
  deals: Deal[];
  recipes: Recipe[];
};

export type AccountEquipment = {
  id: number;
  customer: string;
  catalogModel: string;
  equipmentName: string;
  serial: string | null;
  serialKey: string | null;
  installDate: string | null;
  electrical: string | null;
  ownership: string | null;
  updatedAt: string;
};

