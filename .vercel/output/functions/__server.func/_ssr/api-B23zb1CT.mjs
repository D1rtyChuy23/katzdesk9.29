import "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { L as string, N as number, P as object, k as boolean } from "../_libs/@better-auth/core+[...].mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { n as deskMiddleware } from "./access-Cv44_4sH.mjs";
import { n as cn } from "./button-6ZsGYj3J.mjs";
import { i as Trigger, n as Portal, r as Root2, t as Content2 } from "../_libs/@radix-ui/react-popover+[...].mjs";
require_react();
var import_jsx_runtime = require_jsx_runtime();
var Popover = Root2;
var PopoverTrigger = Trigger;
function isInsideCombo(target) {
	return !!target?.closest?.("[data-combo-popover]");
}
function preventIfCombo(event) {
	if (isInsideCombo(event.target)) event.preventDefault();
}
function PopoverContent({ className, align = "start", sideOffset = 4, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content2, {
		align,
		sideOffset,
		"data-combo-popover": "",
		className: cn("z-[80] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
		...props
	}) });
}
var getDashboard = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("3b18cb7c79b3d2a3708e94af1b95e011080a0bb6c37961f6996b2819e381e376"));
var listJobs = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("dd497d0a20bc74fd3516a43287eaf1f59ba8ff78889d055ec0134cb3b8100557"));
var getJob = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("7c7f50c54b853be302ab8dadb93d606276a3163565accc501df10cc4604d24fe"));
var jobPatch = object({
	id: number(),
	contact: string().nullable().optional(),
	phone: string().nullable().optional(),
	received: string().nullable().optional(),
	customer: string().nullable().optional(),
	equipment: string().nullable().optional(),
	issue: string().nullable().optional(),
	callType: string().nullable().optional(),
	phoneResolved: boolean().optional(),
	status: string().optional(),
	technician: string().nullable().optional(),
	wo: string().nullable().optional(),
	scheduled: string().nullable().optional(),
	notes: string().nullable().optional(),
	done: boolean().optional(),
	urgency: string().optional()
});
var updateJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => jobPatch.parse(d)).handler(createSsrRpc("9c7c27f89aa4613cba7b0cc60709986234616c8f59c62126c823a868928946ec"));
var createJob = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("33d624b110f3c458dc2c4420e1a7861c9781d7f6cfc29f1e17303ebbdacf5185"));
var listPms = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("b77061ca68bf02683e5808aff14e21ac7f7f4324c20c77e18ff63950e0f4c940"));
var updatePm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("1ae4b4e6892721617dfc78392d46516266eb655551d1a355b50347de340f48e6"));
var createPm = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("56e061229f5d68c835c12340d4d78410c3592f0cc65d60e8b992d2ee67e6bed5"));
var listModules = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("8dea21981ac1b7bcdcc5dba0c9279774b461bd56790f061f6b87e9fe846b8a1f"));
var updateModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("a78a25b878a8eeb0571581d491679ee6d326c39db15f3f0853db09968b6e53d2"));
var createModule = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("8a73f2c9525ecba2938f9d480d18743e0dd450638e5c52e2aef7b2e574bfafed"));
var listDeals = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("c8fc4fe3d98eafc8771376a0d2ebec3bda02ebe075aeae0672deab4f6afdc960"));
var updateDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("5d3ec062dccd2364f8eadd0069f1e26d01565b58d8975d81fd41d7eb9fb5942a"));
var createDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("39bf7186ae5c8496b5fd07dadc19af7625bf4a0d78ac5dc625fb334957dd2da2"));
var listInstalls = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("e864dd8c9b80dad5f2c776a83f842418fb498cb3e65c666915bc181d9ae09617"));
var updateInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("39b0743581a7bf62de46488cabcf15c68c717461b0afaefa731f4fdda4a5b323"));
var createInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f3d500b4701c16e140b486b0f00720767b652e6dd3e1353b7c2367dbcc44d86a"));
var listComments = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("4635ba032aed43ecf7bcf6ce29de400b651517a7fee7111213c11ac3740d7c53"));
var addComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("6f738980065bf83aabf85ff9c0bb4c1676ebab4840efd9eab8bac748961d6812"));
var resolveComment = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("bd649af093753888caad62829610101a98a97fcfd3ebda7f1134c10f6803a31f"));
var getHandoff = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("f4edefbbe0a28284e851744c3220811add825e959937d13bcb55136bdffafb5c"));
var searchAll = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("bc07a2afcfdda5f33354b75fd397103613496c0ae0a38a79614caec91ba569d1"));
var handoffDeal = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("66d5f7130499f8b38df7162a2bc0d7acafb0c172702bd2241f68b2c76bf81dd5"));
var listAssets = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("a76f381d2caeca51254a208b811ee3a7058d68c1c43e253969f96eca6ae00fb0"));
var createAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("cea062fe70e665c1d6153b5ed394cf90f7ed3f3b8e5ba2a80f14ffc114231996"));
var updateAsset = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("2582de1bfe6e7c6be8f3d00276438723a358e32a85e78329b73b0d7d21e9d1d2"));
var assignAssetToInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("526601698722a8a88c929ec2b2bd22f0d7d0eb21efd3f1ee9090ef220a7ef449"));
var unassignAssetFromInstall = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f3719f92ebca0f7fba68c57e4e6f1cfb9114315855feb08a7202f3310b8897b8"));
var returnAssetToWarehouse = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("8b50c2d8a8f85716a978d9f8629d110029ab352f813c0d0b69c28e2a1151b0f3"));
var markAssetSold = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("96afcaa3f0fed3b3115ee12547f530fd6e737399bfaeee48b5989e79d4732a7f"));
var listRecipes = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("1200b5be72004e85f0bfcee1ed7fc4b89f856bb6c2e04dedd35aa46ed4833b05"));
var listCustomers = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("06fd80b5feb6d5cb8bbb9344a113508ac20a8fed29dbd5fc5c5cdab3f4ce7890"));
var listDirectory = createServerFn({ method: "GET" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("0163adac47649a0570c9a81c5541f36005e39618df4a4497c23d2dc78ffaa868"));
var addDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("f92a32e6bcb066079e1169e5037175021271e828adda251fc4bd6c7eceab34f8"));
var archiveDirectoryEntry = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("bbf684dab4be294977c8a135852746b46c064b5fe849356229cfe61bb158aad2"));
var upsertRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("918e6d7f4bace1f6c78033b9037d1c6c24ab3094b0be582a97b47c01d0246dc3"));
var copyRecipe = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("af2770ffc7230f6441c2c90211140e8767fbb7f8fbe129f5b054493e873c7436"));
//#endregion
export { preventIfCombo as A, updatePm as B, listDirectory as C, listPms as D, listModules as E, updateAsset as F, updateDeal as I, updateInstall as L, returnAssetToWarehouse as M, searchAll as N, listRecipes as O, unassignAssetFromInstall as P, updateJob as R, listDeals as S, listJobs as T, upsertRecipe as V, getJob as _, addDirectoryEntry as a, listComments as b, copyRecipe as c, createInstall as d, createJob as f, getHandoff as g, getDashboard as h, addComment as i, resolveComment as j, markAssetSold as k, createAsset as l, createPm as m, PopoverContent as n, archiveDirectoryEntry as o, createModule as p, PopoverTrigger as r, assignAssetToInstall as s, Popover as t, createDeal as u, handoffDeal as v, listInstalls as w, listCustomers as x, listAssets as y, updateModule as z };
