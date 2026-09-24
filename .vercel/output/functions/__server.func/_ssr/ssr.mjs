import { r as __exportAll$1 } from "../_runtime.mjs";
import { a as toResponse, i as setCookie, r as H3Event } from "../_libs/@tanstack/react-start+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { A as executeRewriteInput, D as resolveManifestAssetLink, E as getStylesheetHref, F as isRedirect, I as isResolvedRedirect, L as parseRedirect, O as resolveManifestCssLink, R as rootRouteId, T as getScriptPreloadAttrs, a as isSsrResponse, c as stripSsrResponseBody, f as RouterProvider, i as disposeSsrResponseDetached, j as invariant, k as _getRenderedMatches, n as bindSsrResponseToRequest, o as normalizeSsrResponse, r as defineHandlerCallback, s as replaceSsrResponse, t as renderRouterToStream, z as isNotFound } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as createMemoryHistory } from "../_libs/tanstack__history.mjs";
import { a as getOrigin, c as createSerializationAdapter, d as toCrossJSONAsync, f as toCrossJSONStream, i as getNormalizedURL, l as makeSerovalPlugin, n as mergeHeaders, o as defaultSerovalPlugins, r as attachRouterServerSsrUtils, s as createRawStreamRPCPlugin, t as waitForRequest, u as fromJSON } from "../_libs/@tanstack/router-core+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { AsyncLocalStorage } from "node:async_hooks";
//#region node_modules/.nitro/vite/services/ssr/assets/rolldown-runtime-D7D4PA-g.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region node_modules/.nitro/vite/services/ssr/index.js
var ssr_exports = /* @__PURE__ */ __exportAll$1({
	a: () => getServerFnById,
	createServerEntry: () => createServerEntry,
	default: () => server_default,
	i: () => TSS_SERVER_FUNCTION,
	n: () => createMiddleware,
	o: () => getRequest,
	r: () => createServerFn,
	t: () => server_exports
});
require_react();
var import_jsx_runtime = require_jsx_runtime();
function StartServer(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RouterProvider, { router: props.router });
}
var defaultStreamHandler = defineHandlerCallback(({ request, router, responseHeaders }) => renderRouterToStream({
	request,
	router,
	responseHeaders,
	children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StartServer, { router })
}));
var GLOBAL_EVENT_STORAGE_KEY = Symbol.for("tanstack-start:event-storage");
var globalObj$1 = globalThis;
if (!globalObj$1[GLOBAL_EVENT_STORAGE_KEY]) globalObj$1[GLOBAL_EVENT_STORAGE_KEY] = new AsyncLocalStorage();
var eventStorage = globalObj$1[GLOBAL_EVENT_STORAGE_KEY];
function isPromiseLike(value) {
	return typeof value.then === "function";
}
function getSetCookieValues(headers) {
	const headersWithSetCookie = headers;
	if (typeof headersWithSetCookie.getSetCookie === "function") return headersWithSetCookie.getSetCookie();
	const value = headers.get("set-cookie");
	return value ? [value] : [];
}
function mergeEventResponseHeaders(response, event) {
	if (response.ok) return;
	const eventSetCookies = getSetCookieValues(event.res.headers);
	if (eventSetCookies.length === 0) return;
	const responseSetCookies = getSetCookieValues(response.headers);
	response.headers.delete("set-cookie");
	for (const cookie of responseSetCookies) response.headers.append("set-cookie", cookie);
	for (const cookie of eventSetCookies) response.headers.append("set-cookie", cookie);
}
function attachResponseHeaders(value, event) {
	if (isPromiseLike(value)) return value.then((resolved) => {
		if (resolved instanceof Response) mergeEventResponseHeaders(resolved, event);
		return resolved;
	});
	if (value instanceof Response) mergeEventResponseHeaders(value, event);
	return value;
}
function requestHandler(handler) {
	return (request, requestOpts) => {
		let h3Event;
		try {
			h3Event = new H3Event(request);
		} catch (error) {
			if (error instanceof URIError) return new Response(null, {
				status: 400,
				statusText: "Bad Request"
			});
			throw error;
		}
		return toResponse(attachResponseHeaders(eventStorage.run({ h3Event }, () => handler(request, requestOpts)), h3Event), h3Event);
	};
}
function getH3Event() {
	const event = eventStorage.getStore();
	if (!event) throw new Error(`No StartEvent found in AsyncLocalStorage. Make sure you are using the function within the server runtime.`);
	return event.h3Event;
}
function getRequest() {
	return getH3Event().req;
}
/**
* Set a cookie value by name.
* @param name Name of the cookie to set
* @param value Value of the cookie to set
* @param options {CookieSerializeOptions} Options for serializing the cookie
* ```ts
* setCookie('Authorization', '1234567')
* ```
*/
function setCookie$1(name, value, options) {
	setCookie(getH3Event(), name, value, options);
}
function getResponse() {
	return getH3Event().res;
}
var HEADERS = { TSS_SHELL: "X-TSS_SHELL" };
/**
* @description Returns the router manifest data that should be sent to the client.
* This includes only the assets and preloads for the current route and any
* special assets that are needed for the client. It does not include relationships
* between routes or any other data that is not needed for the client.
*
* @param matchedRoutes - In dev mode, the matched routes are used to build
* the dev styles URL for route-scoped CSS collection.
*/
async function getStartManifest(matchedRoutes) {
	const { tsrStartManifest } = await import("../_tanstack-start-manifest_v-i8wM2oN4.mjs");
	const startManifest = tsrStartManifest();
	let routes = startManifest.routes;
	routes[rootRouteId];
	const manifestRoutes = {};
	for (const k in routes) {
		const v = routes[k];
		const result = {};
		if (v.preloads && v.preloads.length > 0) result.preloads = v.preloads;
		if (v.scripts && v.scripts.length > 0) result.scripts = v.scripts;
		if (v.css?.length) result.css = v.css;
		if (result.preloads || result.scripts || result.css) manifestRoutes[k] = result;
	}
	return {
		...startManifest.scriptFormat ? { scriptFormat: startManifest.scriptFormat } : {},
		...startManifest.inlineCss ? { inlineCss: startManifest.inlineCss } : {},
		routes: manifestRoutes
	};
}
var manifest = {
	"0163adac47649a0570c9a81c5541f36005e39618df4a4497c23d2dc78ffaa868": {
		functionName: "listDirectory_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"01a5a11fc715677325945efd317365c2105db9f8ba9b5d8045dcf90b9a0432cf": {
		functionName: "setAccountApproved_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"06fd80b5feb6d5cb8bbb9344a113508ac20a8fed29dbd5fc5c5cdab3f4ce7890": {
		functionName: "listCustomers_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"0aa2a8634edcbca3e8e386b99d9ca448fc1a1d0e54845323e6025f5ce6f5300f": {
		functionName: "pullRebuildSerial_createServerFn_handler",
		importer: () => import("./rebuilds-CttvI6n_.mjs")
	},
	"0e70cec8a743027415d0460951e6e2bb501309027c1759c4c98cfd78df7764d5": {
		functionName: "listNetwork_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"0eb120547d7147cfacb70cc0bcc4463a916dcf139e3559e0108dacbfad17c4f9": {
		functionName: "moveUnitToBarn_createServerFn_handler",
		importer: () => import("./unit-place-BWWPPisV.mjs")
	},
	"0f1616336d82cdb378bdbca41e5fcf8cd1928d9b9bea529fac33b217f9d4777b": {
		functionName: "assignAssetToService_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"111aeb03d57088e20114c3b91137111583695de7837bf7cd602c0b77a80b8751": {
		functionName: "previewExport_createServerFn_handler",
		importer: () => import("./export-reports-CWp7FvKA.mjs")
	},
	"1192b411cbac542b1a78b65c18f38dc71612d7e014585e7842015736911393dd": {
		functionName: "previewAccountEquipImport_createServerFn_handler",
		importer: () => import("./account-equip-import-BN0FfBbb.mjs")
	},
	"1200b5be72004e85f0bfcee1ed7fc4b89f856bb6c2e04dedd35aa46ed4833b05": {
		functionName: "listRecipes_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"12a794f25eedc091fcc01b69c8afc2fa2556f959485701d3426296bd1de6f841": {
		functionName: "setAccountRole_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"17e1ebba74c445a1c0bae46dabb84f892f047cc2924e56c1221b2dad8e1a8c7a": {
		functionName: "applySerialPull_createServerFn_handler",
		importer: () => import("./serial-pull-B4Js7TmH.mjs")
	},
	"1ae4b4e6892721617dfc78392d46516266eb655551d1a355b50347de340f48e6": {
		functionName: "updatePm_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"1e76910bf98a3daeaebec03779f138bb00c8e750fd47ea60c7b94abbc3536e90": {
		functionName: "getMyAccess_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"2582de1bfe6e7c6be8f3d00276438723a358e32a85e78329b73b0d7d21e9d1d2": {
		functionName: "updateAsset_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"280698ca3a37048a952a0a60c6de4360d08267057edc403a8ffe38aee977b028": {
		functionName: "listAccountEquipment_createServerFn_handler",
		importer: () => import("./account-equip-import-BN0FfBbb.mjs")
	},
	"2808eee236ac8a01d9b5df827bec7737d82a7b482025f6f1765ce51c74d36ecf": {
		functionName: "assignCustomerProvider_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"2b27f3c2732afa1ab10aff6dc4a21d97370572f26b12f33d9ea9293891c3d5a6": {
		functionName: "listRebuildLinks_createServerFn_handler",
		importer: () => import("./rebuilds-CttvI6n_.mjs")
	},
	"2c4985e96c199268f7f639534cb5e8e31d6b19d43286bf77416413db60ffde26": {
		functionName: "fetchSessionUser_createServerFn_handler",
		importer: () => import("../__root-Dn0byzeZ.mjs")
	},
	"312d37f1589d16ecdcbdf5b204dbcbdc26d40c2ab5050689f9e097526c238a7f": {
		functionName: "setAccountCanAddCustomers_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"33d624b110f3c458dc2c4420e1a7861c9781d7f6cfc29f1e17303ebbdacf5185": {
		functionName: "createJob_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"382dd0efa33ba73974579c8835f506ae0d04e33a2a6b5c2df3a7598f86087361": {
		functionName: "addProviderAddress_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"385f3e726aaef9adefa16c47f3a60e82af199dfba07c3b4c42b00ed68805f8b3": {
		functionName: "archiveInstall_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"39b0743581a7bf62de46488cabcf15c68c717461b0afaefa731f4fdda4a5b323": {
		functionName: "updateInstall_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"39bf7186ae5c8496b5fd07dadc19af7625bf4a0d78ac5dc625fb334957dd2da2": {
		functionName: "createDeal_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"3a3478acf53044fe7eab5aad067abd8b33c0b8558aad929a0d2b4ee08b583d71": {
		functionName: "renameEquipment_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"3b18cb7c79b3d2a3708e94af1b95e011080a0bb6c37961f6996b2819e381e376": {
		functionName: "getDashboard_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"3d6bd5686c9e2c59523c130a203368a03778b0e5137ce97d8af4fe9986cf09c9": {
		functionName: "unassignAssetFromService_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"3fa4ef685c6d3d148750b135b296ab3ac3416c337f4659f76d71f0268e425439": {
		functionName: "markNotificationRead_createServerFn_handler",
		importer: () => import("./notify-coBGJ0rJ.mjs")
	},
	"423a323a5f7059e99afbe6a138fa5d75c7b349d28d8eb9eb974b9dae76a221ee": {
		functionName: "setAssetPlace_createServerFn_handler",
		importer: () => import("./unit-place-BWWPPisV.mjs")
	},
	"44e26914aa398f4aa37a17dfb87e8a7fb1db5fc93245c5a631ba44a5e8146a05": {
		functionName: "updateRebuild_createServerFn_handler",
		importer: () => import("./rebuilds-CttvI6n_.mjs")
	},
	"459028e7e9941b4f9e5d3cb9f2219c189d90cc6b094ae31d8cfcbce57606b7ed": {
		functionName: "unassignCustomerProvider_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"4635ba032aed43ecf7bcf6ce29de400b651517a7fee7111213c11ac3740d7c53": {
		functionName: "listComments_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"471944d55e1c65b4213049ee898d032a581f48ae35180995f970ee884a74ec4a": {
		functionName: "archiveProvider_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"48eb40870b815944061c950459cff57ae73cf005608d9f5407b0d6c358a44e06": {
		functionName: "addUnitToLocation_createServerFn_handler",
		importer: () => import("./unit-place-BWWPPisV.mjs")
	},
	"4eb4da6169db850b7984b635fca811e56b64d5fbeac765cd327e779c83c83dec": {
		functionName: "listRebuilds_createServerFn_handler",
		importer: () => import("./rebuilds-CttvI6n_.mjs")
	},
	"4fb622c34d0f8a4c8000a6cacbcea16f8be53607038a90fb258d4781f34aeae0": {
		functionName: "listRosterCandidates_createServerFn_handler",
		importer: () => import("./roster-DTWXpHNX.mjs")
	},
	"50f3a51424d20b683e48516f64c52262e309494e96d5785291293467940eabb2": {
		functionName: "addInspectionPhoto_createServerFn_handler",
		importer: () => import("./inspection-api-y-J31j5K.mjs")
	},
	"5185381881205a8fef6ae18a40613e887010ff017f2d63e1a073bbc7aeb44afb": {
		functionName: "mergeServiceTickets_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"526601698722a8a88c929ec2b2bd22f0d7d0eb21efd3f1ee9090ef220a7ef449": {
		functionName: "assignAssetToInstall_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"5272252cb350fffbd8b8d56c4ef404ee93249ca615f69b19500c65e08ca968d3": {
		functionName: "renameProvider_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"536e7b9decc803b49351d2954119f89c08eef35743c6f3d4736a487c9fdc519b": {
		functionName: "placeAssetsAtLocation_createServerFn_handler",
		importer: () => import("./unit-place-BWWPPisV.mjs")
	},
	"5597bebbc43b46780ed9ca5b57e6d0f058593df21c38153c1acbab0be9c16df9": {
		functionName: "saveInspectionCoreHole_createServerFn_handler",
		importer: () => import("./inspection-api-y-J31j5K.mjs")
	},
	"56e061229f5d68c835c12340d4d78410c3592f0cc65d60e8b992d2ee67e6bed5": {
		functionName: "createPm_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"571fac36bc18acec68c60cff2be5821a9a1e35ff8e235b891419be6bf272213f": {
		functionName: "listBarnAvailable_createServerFn_handler",
		importer: () => import("./unit-place-BWWPPisV.mjs")
	},
	"5d3ec062dccd2364f8eadd0069f1e26d01565b58d8975d81fd41d7eb9fb5942a": {
		functionName: "updateDeal_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"5d5dd28faae9fab46aaaf3d96465e9b2b1524240b1cdfcf1959debccb5bceea6": {
		functionName: "grantAllCanAddCustomers_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"63f131a91c65df7c685474b7274437f0a38d7ecc2e8a5fda7460a20345e3664c": {
		functionName: "claimInvite_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"66d5f7130499f8b38df7162a2bc0d7acafb0c172702bd2241f68b2c76bf81dd5": {
		functionName: "handoffDeal_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"683ce4e118843b9882fa4d3ef4aae93e7c9911c090294ea307f851a3f443ba3b": {
		functionName: "getCustomerProviders_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"6957c78daf68c70212899a817926938689d7e458753829416708268b48c06912": {
		functionName: "removeInspectionPhoto_createServerFn_handler",
		importer: () => import("./inspection-api-y-J31j5K.mjs")
	},
	"6a7975fdb5f66f49fa83d2d5d69689ac2584794af314076f3731b68a6ffe713c": {
		functionName: "listTechs_createServerFn_handler",
		importer: () => import("./roster-DTWXpHNX.mjs")
	},
	"6e67d51c0c64562bbed03eea6fbb1e7c689b83ef33496797ea9f1a8a23c70aa9": {
		functionName: "getProvider_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"6f738980065bf83aabf85ff9c0bb4c1676ebab4840efd9eab8bac748961d6812": {
		functionName: "addComment_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"700b799cf439db04647221adfa8f61295144daa74c6da21aec2fae852db466e2": {
		functionName: "lookupSignIn_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"76d7b51b3118ce3c755ac90dd0aa6c2d698a01daf5246936cb2098cdebafa7f2": {
		functionName: "listCustomerRecords_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"7a8456958e7ee0d6d9527aacfe902ec05a25a65ea1e0fefa3fb86f4e03876368": {
		functionName: "addInspectionEquipment_createServerFn_handler",
		importer: () => import("./inspection-api-y-J31j5K.mjs")
	},
	"7c7f50c54b853be302ab8dadb93d606276a3163565accc501df10cc4604d24fe": {
		functionName: "getJob_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"7d30dfaa7a40d51c27cd0ce998e25cfeded40af2ff16826301ad1363906ce978": {
		functionName: "addProviderLocation_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"7f22f350550d2ff3b78203194b7c195944e4345e647c9bf227847d8e91ac717c": {
		functionName: "registerAccount_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"83cefe8461678b9a0f02a18d7b2aafb95f7e5ee20ca52438886169976cc838f8": {
		functionName: "applyCorrigoImport_createServerFn_handler",
		importer: () => import("./corrigo-import-BbMQPXaA.mjs")
	},
	"87ac9452e7d2cfc8ff048a7f556a4cb201fe948dfb3c427d26b54fb0668828a5": {
		functionName: "setRepActive_createServerFn_handler",
		importer: () => import("./reps-DLuQsJZR.mjs")
	},
	"8a09d9d7b24a86f0c775dbbaf1147644bdfffcbc6057d140eb48ee8ba6dc8a35": {
		functionName: "updateCustomerAccount_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"8a73f2c9525ecba2938f9d480d18743e0dd450638e5c52e2aef7b2e574bfafed": {
		functionName: "createModule_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"8b50c2d8a8f85716a978d9f8629d110029ab352f813c0d0b69c28e2a1151b0f3": {
		functionName: "returnAssetToWarehouse_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"8c8f06038c8723897ebcecc99628566e6111d4f176e232f91206b26908879e6e": {
		functionName: "checkUsername_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"8dc5f4484e42250633d38357b1e51e8f9a79cf8765bdb03de157067e5e570a90": {
		functionName: "addRep_createServerFn_handler",
		importer: () => import("./reps-DLuQsJZR.mjs")
	},
	"8dea21981ac1b7bcdcc5dba0c9279774b461bd56790f061f6b87e9fe846b8a1f": {
		functionName: "listModules_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"918e6d7f4bace1f6c78033b9037d1c6c24ab3094b0be582a97b47c01d0246dc3": {
		functionName: "upsertRecipe_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"91a2ebe1261556f11fcc6a931cb07fb974490d2efb9a57f84f4b4edd6b44fd73": {
		functionName: "removeProviderAddress_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"91cf4a3d18addcef695415dfa07f0323e2ba222a842baa7b1cc9a5e27e896991": {
		functionName: "addTech_createServerFn_handler",
		importer: () => import("./roster-DTWXpHNX.mjs")
	},
	"96afcaa3f0fed3b3115ee12547f530fd6e737399bfaeee48b5989e79d4732a7f": {
		functionName: "markAssetSold_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"96b964ccada664131e89643fc6b11b1706175dac83156dd8dca0563b06a07e5c": {
		functionName: "listDeskInvites_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"9ab91de92323e50691c871ac4b1abdfc2406ecc69f8898bfc8570b2f3601a8f9": {
		functionName: "setTechActive_createServerFn_handler",
		importer: () => import("./roster-DTWXpHNX.mjs")
	},
	"9c292e35364419fb8a3cdeb3000743a246026d456d7c0ed4089a6f7e578a24f6": {
		functionName: "resendInvite_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"9c7c27f89aa4613cba7b0cc60709986234616c8f59c62126c823a868928946ec": {
		functionName: "updateJob_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"9e94e2e91b43a57fed4c1b0f49e909f425a99a2362fe97499cd4a23e47cd989f": {
		functionName: "reviewRackUnit_createServerFn_handler",
		importer: () => import("./rack-stock-Bd4tLUT1.mjs")
	},
	"a25b8ed80544e5f6ef47139dac789bdcbce30de91833be149a93e28a551ace8d": {
		functionName: "applyAccountEquipImport_createServerFn_handler",
		importer: () => import("./account-equip-import-BN0FfBbb.mjs")
	},
	"a2740b848ef9c54b6428a57334fbbd0f61d274e6551140fc955d08887c16be68": {
		functionName: "listTeammates_createServerFn_handler",
		importer: () => import("./notify-coBGJ0rJ.mjs")
	},
	"a2be120d24b496c9ca826bddbada5f554f8e954eb24b11175e7e0eec6edf6dd7": {
		functionName: "lookupSerial_createServerFn_handler",
		importer: () => import("./serial-pull-B4Js7TmH.mjs")
	},
	"a323e74b17415964c1a79e3045d4d2b6b8edab157ec39dd84721e7883b6a73f1": {
		functionName: "addToRackSlot_createServerFn_handler",
		importer: () => import("./rack-stock-Bd4tLUT1.mjs")
	},
	"a534ea58c5fe888eb5efb486c3893ae8da4fdc6fa69c93aee3dab0efe6f088fa": {
		functionName: "removeProviderContact_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"a604085f737e13d9d322b581973ce524189981a7225ef787326d594c0df45acf": {
		functionName: "revokeInvite_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"a76f381d2caeca51254a208b811ee3a7058d68c1c43e253969f96eca6ae00fb0": {
		functionName: "listAssets_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"a773af33364aab76381bdb9f1f9d43c0da1e5ced63832aff930685d90c1eb96d": {
		functionName: "copyInspectionNa_createServerFn_handler",
		importer: () => import("./inspection-api-y-J31j5K.mjs")
	},
	"a78a25b878a8eeb0571581d491679ee6d326c39db15f3f0853db09968b6e53d2": {
		functionName: "updateModule_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"a897fd5704cf2d93d3b6df8924c9e538522f63c4c16ebcacabb67b4c3f71411f": {
		functionName: "setShopTest_createServerFn_handler",
		importer: () => import("./rack-stock-Bd4tLUT1.mjs")
	},
	"a9beaf65084fe0c4d1a91b561db0f7dfe13c0479920eca4f2cac3d82af365079": {
		functionName: "listDeskAccounts_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"aa2f27e21b6668b54a08d0b363a1afedf084a49b1c7d7a195f72b08b68443e3c": {
		functionName: "saveInspectionMeta_createServerFn_handler",
		importer: () => import("./inspection-api-y-J31j5K.mjs")
	},
	"af2770ffc7230f6441c2c90211140e8767fbb7f8fbe129f5b054493e873c7436": {
		functionName: "copyRecipe_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"b0a96f3bcf56e0746e12be9396d2f1437288961130d2412e9767e869b615c426": {
		functionName: "archiveRebuild_createServerFn_handler",
		importer: () => import("./rebuilds-CttvI6n_.mjs")
	},
	"b77061ca68bf02683e5808aff14e21ac7f7f4324c20c77e18ff63950e0f4c940": {
		functionName: "listPms_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"bbf684dab4be294977c8a135852746b46c064b5fe849356229cfe61bb158aad2": {
		functionName: "archiveDirectoryEntry_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"bc07a2afcfdda5f33354b75fd397103613496c0ae0a38a79614caec91ba569d1": {
		functionName: "searchAll_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"bcbd53d274f00bf8475319f64be83a5f2836af89d7875c42409365ad7d02d632": {
		functionName: "denyAccount_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"bd649af093753888caad62829610101a98a97fcfd3ebda7f1134c10f6803a31f": {
		functionName: "resolveComment_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"be65e2e7f569d7642b6ee04880eb13cfb0d2dd5bb1a1d5bc7aa804dee30b2280": {
		functionName: "getCustomerHistory_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"c02f4706c9c4fc709f0a0203fd50998028247f073559d9aa02e96d8112314336": {
		functionName: "createRebuild_createServerFn_handler",
		importer: () => import("./rebuilds-CttvI6n_.mjs")
	},
	"c13bfcc95ed39debfc612bd0dba5fa7e126c458587511dad745dd410bf38e1a7": {
		functionName: "saveInspectionItem_createServerFn_handler",
		importer: () => import("./inspection-api-y-J31j5K.mjs")
	},
	"c456a9cfefe23283df58ac4a6dc5cfa41978e3b8e360d899120bd94e5c2beec0": {
		functionName: "sendPing_createServerFn_handler",
		importer: () => import("./notify-coBGJ0rJ.mjs")
	},
	"c4a7418688fc4b7cb7af59b7f9d2eff9d3caace06de75ab3a03f4a37b3217a06": {
		functionName: "downloadExport_createServerFn_handler",
		importer: () => import("./export-reports-CWp7FvKA.mjs")
	},
	"c854c5e5b43313a3bb44ed47820775f74bd7c3c6bd1b5628eec146f2f3de3007": {
		functionName: "lookupUnitPlace_createServerFn_handler",
		importer: () => import("./unit-place-BWWPPisV.mjs")
	},
	"c8fc4fe3d98eafc8771376a0d2ebec3bda02ebe075aeae0672deab4f6afdc960": {
		functionName: "listDeals_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"cb407fb7ef362f72a49afa1c56076478d9a7ed1b36aa226ad00fcb269aa999af": {
		functionName: "previewCorrigoImport_createServerFn_handler",
		importer: () => import("./corrigo-import-BbMQPXaA.mjs")
	},
	"cea062fe70e665c1d6153b5ed394cf90f7ed3f3b8e5ba2a80f14ffc114231996": {
		functionName: "createAsset_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"d0a57fc171437e25225eb204997c8dfd57ffe636970a048a22ff3ac09d0ecf93": {
		functionName: "createInvite_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"d2f0c01fa586ab0280a9d2571d6e36996bd105984cf8317054ca9844291a521a": {
		functionName: "listReps_createServerFn_handler",
		importer: () => import("./reps-DLuQsJZR.mjs")
	},
	"d4f3a4453af79228779d10db5c4c867e0d5772bb5e93b9b07018aa2b92416401": {
		functionName: "setRosterAdmin_createServerFn_handler",
		importer: () => import("./roster-DTWXpHNX.mjs")
	},
	"d542ae756f2e6694dce801180f201b4d169c51d7a4538e3133a8696e2e25728c": {
		functionName: "removeProviderLocation_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"dd497d0a20bc74fd3516a43287eaf1f59ba8ff78889d055ec0134cb3b8100557": {
		functionName: "listJobs_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"ded79099149d28ceb2e0ac0581c7618a59799ce73cd3dabba2d833d972fc964c": {
		functionName: "listNotifications_createServerFn_handler",
		importer: () => import("./notify-coBGJ0rJ.mjs")
	},
	"e05fae23059afc9524cd7006566d3660d6e4e2f8e952866a6a0056267e182f6a": {
		functionName: "peekInvite_createServerFn_handler",
		importer: () => import("./access-B5OlYF-l.mjs")
	},
	"e1f6b5e1ee21f932bd78b1ddbf8e596c45e7296aac8591d390fcd0ce141b2d8c": {
		functionName: "setProviderRole_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"e22ae01e87029011ee5e5e0575fd8972f4c4e2713dcb711e0ae981b0d3748276": {
		functionName: "setUnitPlace_createServerFn_handler",
		importer: () => import("./unit-place-BWWPPisV.mjs")
	},
	"e62d56561a7cdcb00f526b0789df917594449c611f745739262dca774fcffed5": {
		functionName: "archiveDeal_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"e864dd8c9b80dad5f2c776a83f842418fb498cb3e65c666915bc181d9ae09617": {
		functionName: "listInstalls_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"eeedbe6b03930fae6ba3c3db70a2afb562a9769026dd2db72fcf16a5dcbf9dac": {
		functionName: "renameCustomer_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"f15851b69a3e7b42b4e445c440d3feb4faef6714c2f17ed71907c717ceb1d406": {
		functionName: "listRebuildOwners_createServerFn_handler",
		importer: () => import("./rebuilds-CttvI6n_.mjs")
	},
	"f2825516656623b695881938cec0b6cf9876e9c7c29a937a8cdcbfa5be64c879": {
		functionName: "addProviderContact_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"f3719f92ebca0f7fba68c57e4e6f1cfb9114315855feb08a7202f3310b8897b8": {
		functionName: "unassignAssetFromInstall_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"f3d500b4701c16e140b486b0f00720767b652e6dd3e1353b7c2367dbcc44d86a": {
		functionName: "createInstall_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"f4edefbbe0a28284e851744c3220811add825e959937d13bcb55136bdffafb5c": {
		functionName: "getHandoff_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"f62afaeae21ab0e89d7d27769b2f5064cb3e75f64a9ea65009068831d0434921": {
		functionName: "upsertProvider_createServerFn_handler",
		importer: () => import("./network-api-B9zwUQw0.mjs")
	},
	"f818c883ef291f66d478761b3eb1ba6b94f06c954b7e2b79a760dee774ec3b53": {
		functionName: "claimComment_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"f92a32e6bcb066079e1169e5037175021271e828adda251fc4bd6c7eceab34f8": {
		functionName: "addDirectoryEntry_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"fba13400f8c6e321ea705395de93864c9cc6795aeb9df4a67cfe7be7204c7886": {
		functionName: "listActivity_createServerFn_handler",
		importer: () => import("./api-CDNZZgnc.mjs")
	},
	"fcb138be46c36e675d38a8db2afca32e3042714b5000e9bc32de5c509085767b": {
		functionName: "getInstallInspection_createServerFn_handler",
		importer: () => import("./inspection-api-y-J31j5K.mjs")
	}
};
async function getServerFnById(id, access) {
	const serverFnInfo = manifest[id];
	if (!serverFnInfo) throw new Error("Server function info not found for " + id);
	const fnModule = serverFnInfo.module ?? await serverFnInfo.importer();
	if (!fnModule) throw new Error("Server function module not resolved for " + id);
	const action = fnModule[serverFnInfo.functionName];
	if (!action) throw new Error("Server function module export not resolved for serverFn ID: " + id);
	return action;
}
var TSS_FORMDATA_CONTEXT = "__TSS_CONTEXT";
var TSS_SERVER_FUNCTION = Symbol.for("TSS_SERVER_FUNCTION");
var TSS_SERVER_FUNCTION_FACTORY = Symbol.for("TSS_SERVER_FUNCTION_FACTORY");
var X_TSS_SERIALIZED = "x-tss-serialized";
var X_TSS_RAW_RESPONSE = "x-tss-raw";
/** Content-Type for multiplexed framed responses (RawStream support) */
var TSS_CONTENT_TYPE_FRAMED = "application/x-tss-framed";
/**
* Frame types for binary multiplexing protocol.
*/
var FrameType = {
	/** Seroval JSON chunk (NDJSON line) */
	JSON: 0,
	/** Raw stream data chunk */
	CHUNK: 1,
	/** Raw stream end (EOF) */
	END: 2,
	/** Raw stream error */
	ERROR: 3
};
/** Full Content-Type header value with version parameter */
var TSS_CONTENT_TYPE_FRAMED_VERSIONED = `${TSS_CONTENT_TYPE_FRAMED}; v=1`;
function isSafeKey(key) {
	return key !== "__proto__" && key !== "constructor" && key !== "prototype";
}
/**
* Merge target and source into a new null-proto object, filtering dangerous keys.
*/
function safeObjectMerge(target, source) {
	const result = Object.create(null);
	if (target) {
		for (const key of Object.keys(target)) if (isSafeKey(key)) result[key] = target[key];
	}
	if (source && typeof source === "object") {
		for (const key of Object.keys(source)) if (isSafeKey(key)) result[key] = source[key];
	}
	return result;
}
/**
* Create a null-prototype object, optionally copying from source.
*/
function createNullProtoObject(source) {
	if (!source) return Object.create(null);
	const obj = Object.create(null);
	for (const key of Object.keys(source)) if (isSafeKey(key)) obj[key] = source[key];
	return obj;
}
var GLOBAL_STORAGE_KEY = Symbol.for("tanstack-start:start-storage-context");
var globalObj = globalThis;
if (!globalObj[GLOBAL_STORAGE_KEY]) globalObj[GLOBAL_STORAGE_KEY] = new AsyncLocalStorage();
var startStorage = globalObj[GLOBAL_STORAGE_KEY];
async function runWithStartContext(context, fn) {
	return startStorage.run(context, fn);
}
function getStartContext(opts) {
	const context = startStorage.getStore();
	if (!context && opts?.throwIfNotFound !== false) throw new Error(`No Start context found in AsyncLocalStorage. Make sure you are using the function within the server runtime.`);
	return context;
}
var getStartOptions = () => getStartContext().startOptions;
var getStartContextServerOnly = getStartContext;
var createServerFn = (options, __opts) => {
	const resolvedOptions = __opts || options || {};
	if (typeof resolvedOptions.method === "undefined") resolvedOptions.method = "GET";
	const setValidator = (validator) => {
		return createServerFn(void 0, {
			...resolvedOptions,
			validator,
			inputValidator: validator
		});
	};
	const res = {
		options: resolvedOptions,
		middleware: (middleware) => {
			const newMiddleware = [...resolvedOptions.middleware || []];
			middleware.map((m) => {
				if (TSS_SERVER_FUNCTION_FACTORY in m) {
					if (m.options.middleware) newMiddleware.push(...m.options.middleware);
				} else newMiddleware.push(m);
			});
			const res = createServerFn(void 0, {
				...resolvedOptions,
				middleware: newMiddleware
			});
			res[TSS_SERVER_FUNCTION_FACTORY] = true;
			return res;
		},
		validator: setValidator,
		inputValidator: setValidator,
		handler: (...args) => {
			const [extractedFn, serverFn] = args;
			const newOptions = {
				...resolvedOptions,
				extractedFn,
				serverFn
			};
			const resolvedMiddleware = [...newOptions.middleware || [], serverFnBaseToMiddleware(newOptions)];
			extractedFn.method = resolvedOptions.method;
			return Object.assign(async (opts) => {
				const result = await executeMiddleware$1(resolvedMiddleware, "client", {
					...extractedFn,
					...newOptions,
					data: opts?.data,
					headers: opts?.headers,
					signal: opts?.signal,
					fetch: opts?.fetch,
					context: createNullProtoObject()
				});
				const redirect = parseRedirect(result.error);
				if (redirect) throw redirect;
				if (result.error) throw result.error;
				return result.result;
			}, {
				...extractedFn,
				method: resolvedOptions.method,
				__executeServer: async (opts) => {
					const startContext = getStartContextServerOnly();
					const serverContextAfterGlobalMiddlewares = startContext.contextAfterGlobalMiddlewares;
					return await executeMiddleware$1(resolvedMiddleware, "server", {
						...extractedFn,
						...opts,
						serverFnMeta: extractedFn.serverFnMeta,
						context: safeObjectMerge(opts.context, serverContextAfterGlobalMiddlewares),
						request: startContext.request
					}).then((d) => ({
						result: d.result,
						error: d.error,
						context: d.sendContext
					}));
				}
			});
		}
	};
	const fun = (options) => {
		return createServerFn(void 0, {
			...resolvedOptions,
			...options
		});
	};
	return Object.assign(fun, res);
};
async function executeMiddleware$1(middlewares, env, opts) {
	let flattenedMiddlewares = flattenMiddlewares([...getStartOptions()?.functionMiddleware || [], ...middlewares]);
	if (env === "server") {
		const startContext = getStartContextServerOnly({ throwIfNotFound: false });
		if (startContext?.executedRequestMiddlewares) flattenedMiddlewares = flattenedMiddlewares.filter((m) => !startContext.executedRequestMiddlewares.has(m));
	}
	const callNextMiddleware = async (ctx) => {
		const nextMiddleware = flattenedMiddlewares.shift();
		if (!nextMiddleware) return ctx;
		try {
			let validator = "validator" in nextMiddleware.options ? nextMiddleware.options.validator : void 0;
			if (!validator && "inputValidator" in nextMiddleware.options) validator = nextMiddleware.options.inputValidator;
			if (validator && env === "server") ctx.data = await execValidator(validator, ctx.data);
			let middlewareFn = void 0;
			if (env === "client") {
				if ("client" in nextMiddleware.options) middlewareFn = nextMiddleware.options.client;
			} else if ("server" in nextMiddleware.options) middlewareFn = nextMiddleware.options.server;
			if (middlewareFn) {
				const userNext = async (userCtx = {}) => {
					const result = await callNextMiddleware({
						...ctx,
						...userCtx,
						context: safeObjectMerge(ctx.context, userCtx.context),
						sendContext: safeObjectMerge(ctx.sendContext, userCtx.sendContext),
						headers: mergeHeaders(ctx.headers, userCtx.headers),
						_callSiteFetch: ctx._callSiteFetch,
						fetch: ctx._callSiteFetch ?? userCtx.fetch ?? ctx.fetch,
						result: userCtx.result !== void 0 ? userCtx.result : userCtx instanceof Response ? userCtx : ctx.result,
						error: userCtx.error ?? ctx.error
					});
					if (result.error) throw result.error;
					return result;
				};
				const result = await middlewareFn({
					...ctx,
					next: userNext
				});
				if (isRedirect(result)) return {
					...ctx,
					error: result
				};
				if (result instanceof Response) return {
					...ctx,
					result
				};
				if (!result) throw new Error("User middleware returned undefined. You must call next() or return a result in your middlewares.");
				return result;
			}
			return callNextMiddleware(ctx);
		} catch (error) {
			return {
				...ctx,
				error
			};
		}
	};
	return callNextMiddleware({
		...opts,
		headers: opts.headers || {},
		sendContext: opts.sendContext || {},
		context: opts.context || createNullProtoObject(),
		_callSiteFetch: opts.fetch
	});
}
function flattenMiddlewares(middlewares, maxDepth = 100) {
	const seen = /* @__PURE__ */ new Set();
	const flattened = [];
	const recurse = (middleware, depth) => {
		if (depth > maxDepth) throw new Error(`Middleware nesting depth exceeded maximum of ${maxDepth}. Check for circular references.`);
		middleware.forEach((m) => {
			if (m.options.middleware) recurse(m.options.middleware, depth + 1);
			if (!seen.has(m)) {
				seen.add(m);
				flattened.push(m);
			}
		});
	};
	recurse(middlewares, 0);
	return flattened;
}
async function execValidator(validator, input) {
	if (validator == null) return {};
	if ("~standard" in validator) {
		const result = await validator["~standard"].validate(input);
		if (result.issues) throw new Error(JSON.stringify(result.issues, void 0, 2));
		return result.value;
	}
	if ("parse" in validator) return validator.parse(input);
	if (typeof validator === "function") return validator(input);
	throw new Error("Invalid validator type!");
}
function serverFnBaseToMiddleware(options) {
	return {
		"~types": void 0,
		options: {
			inputValidator: options.validator ?? options.inputValidator,
			client: async ({ next, sendContext, fetch, ...ctx }) => {
				const payload = {
					...ctx,
					context: sendContext,
					fetch
				};
				return next(await options.extractedFn?.(payload));
			},
			server: async ({ next, ...ctx }) => {
				const result = await options.serverFn?.(ctx);
				return next({
					...ctx,
					result
				});
			}
		}
	};
}
var createMiddleware = (options, __opts) => {
	const resolvedOptions = {
		type: "request",
		...__opts || options
	};
	const setValidator = (validator) => {
		return createMiddleware({}, Object.assign(resolvedOptions, {
			validator,
			inputValidator: validator
		}));
	};
	return {
		options: resolvedOptions,
		middleware: (middleware) => {
			return createMiddleware({}, Object.assign(resolvedOptions, { middleware }));
		},
		validator: setValidator,
		inputValidator: setValidator,
		client: (client) => {
			return createMiddleware({}, Object.assign(resolvedOptions, { client }));
		},
		server: (server) => {
			return createMiddleware({}, Object.assign(resolvedOptions, { server }));
		}
	};
};
var innerCreateCsrfMiddleware = (opts = {}) => {
	return createMiddleware().server(async (ctx) => {
		const csrfCtx = ctx;
		if (opts.filter && !await opts.filter(csrfCtx)) return ctx.next();
		if (await isCsrfRequestAllowed(opts, csrfCtx)) return ctx.next();
		return getFailureResponse(opts, csrfCtx);
	});
};
var createCsrfMiddleware = innerCreateCsrfMiddleware;
async function isCsrfRequestAllowed(opts, ctx) {
	const result = await getCsrfRequestValidationResult(opts, ctx);
	return result === true || result === void 0 && opts.allowRequestsWithoutOriginCheck === true;
}
async function getCsrfRequestValidationResult(opts, ctx) {
	const fetchSite = ctx.request.headers.get("Sec-Fetch-Site");
	if (fetchSite !== null) return matchValue(opts.secFetchSite ?? "same-origin", fetchSite, ctx);
	const origin = ctx.request.headers.get("Origin");
	if (origin !== null) {
		if (opts.origin) return matchValue(opts.origin, origin, ctx);
		return origin === new URL(ctx.request.url).origin;
	}
	const referer = ctx.request.headers.get("Referer");
	if (referer === null || opts.referer === false) return;
	if (typeof opts.referer === "function") return opts.referer(referer, ctx);
	if (opts.origin) {
		const refererOrigin = getOriginFromUrl(referer);
		return refererOrigin !== void 0 && matchValue(opts.origin, refererOrigin, ctx);
	}
	return isRefererSameOrigin(referer, new URL(ctx.request.url).origin);
}
async function matchValue(matcher, value, ctx) {
	if (typeof matcher === "function") return matcher(value, ctx);
	if (Array.isArray(matcher)) return matcher.includes(value);
	return value === matcher;
}
function getOriginFromUrl(url) {
	try {
		return new URL(url).origin;
	} catch {
		return;
	}
}
function isRefererSameOrigin(referer, requestOrigin) {
	if (referer === requestOrigin) return true;
	if (!referer.startsWith(requestOrigin)) return false;
	if (referer.length === requestOrigin.length) return true;
	const code = referer.charCodeAt(requestOrigin.length);
	return code === 47 || code === 63 || code === 35;
}
async function getFailureResponse(opts, ctx) {
	if (typeof opts.failureResponse === "function") return opts.failureResponse(ctx);
	return opts.failureResponse?.clone() ?? new Response("Forbidden", { status: 403 });
}
function getDefaultSerovalPlugins() {
	return [...(getStartOptions()?.serializationAdapters)?.map(makeSerovalPlugin) ?? [], ...defaultSerovalPlugins];
}
/**
* Binary frame protocol for multiplexing JSON and raw streams over HTTP.
*
* Frame format: [type:1][streamId:4][length:4][payload:length]
* - type: 1 byte - frame type (JSON, CHUNK, END, ERROR)
* - streamId: 4 bytes big-endian uint32 - stream identifier
* - length: 4 bytes big-endian uint32 - payload length
* - payload: variable length bytes
*/
/** Cached TextEncoder for frame encoding */
var textEncoder = new TextEncoder();
/** Shared empty payload for END frames - avoids allocation per call */
var EMPTY_PAYLOAD = /* @__PURE__ */ new Uint8Array(0);
/**
* Encodes a single frame with header and payload.
*/
function encodeFrame(type, streamId, payload) {
	const frame = new Uint8Array(9 + payload.length);
	frame[0] = type;
	frame[1] = streamId >>> 24 & 255;
	frame[2] = streamId >>> 16 & 255;
	frame[3] = streamId >>> 8 & 255;
	frame[4] = streamId & 255;
	frame[5] = payload.length >>> 24 & 255;
	frame[6] = payload.length >>> 16 & 255;
	frame[7] = payload.length >>> 8 & 255;
	frame[8] = payload.length & 255;
	frame.set(payload, 9);
	return frame;
}
/**
* Encodes a JSON frame (type 0, streamId 0).
*/
function encodeJSONFrame(json) {
	return encodeFrame(FrameType.JSON, 0, textEncoder.encode(json));
}
/**
* Encodes a raw stream chunk frame.
*/
function encodeChunkFrame(streamId, chunk) {
	return encodeFrame(FrameType.CHUNK, streamId, chunk);
}
/**
* Encodes a raw stream end frame.
*/
function encodeEndFrame(streamId) {
	return encodeFrame(FrameType.END, streamId, EMPTY_PAYLOAD);
}
/**
* Encodes a raw stream error frame.
*/
function encodeErrorFrame(streamId, error) {
	const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
	return encodeFrame(FrameType.ERROR, streamId, textEncoder.encode(message));
}
/**
* Creates a multiplexed ReadableStream from JSON stream and raw streams.
*
* The JSON stream emits NDJSON lines (from seroval's toCrossJSONStream).
* Raw streams are pumped concurrently, interleaved with JSON frames.
*
* Supports late stream registration for RawStreams discovered after initial
* serialization (e.g., from resolved Promises).
*
* @param jsonStream Stream of JSON strings (each string is one NDJSON line)
* @param rawStreams Map of stream IDs to raw binary streams (known at start)
* @param lateStreamSource Optional stream of late registrations for streams discovered later
*/
function createMultiplexedStream(jsonStream, rawStreams, lateStreamSource) {
	let controller;
	let cancelled = false;
	const readers = [];
	const enqueue = (frame) => {
		if (cancelled) return false;
		try {
			controller.enqueue(frame);
			return true;
		} catch {
			return false;
		}
	};
	const errorOutput = (error) => {
		if (cancelled) return;
		cancelled = true;
		try {
			controller.error(error);
		} catch {}
		for (const reader of readers) reader.cancel().catch(() => {});
	};
	async function pumpRawStream(streamId, stream) {
		const reader = stream.getReader();
		readers.push(reader);
		try {
			while (!cancelled) {
				const { done, value } = await reader.read();
				if (done) {
					enqueue(encodeEndFrame(streamId));
					return;
				}
				if (!enqueue(encodeChunkFrame(streamId, value))) return;
			}
		} catch (error) {
			enqueue(encodeErrorFrame(streamId, error));
		} finally {
			reader.releaseLock();
		}
	}
	async function pumpJSON() {
		const reader = jsonStream.getReader();
		readers.push(reader);
		try {
			while (!cancelled) {
				const { done, value } = await reader.read();
				if (done) return;
				if (!enqueue(encodeJSONFrame(value))) return;
			}
		} catch (error) {
			errorOutput(error);
			throw error;
		} finally {
			reader.releaseLock();
		}
	}
	async function pumpLateStreams() {
		if (!lateStreamSource) return [];
		const lateStreamPumps = [];
		const reader = lateStreamSource.getReader();
		readers.push(reader);
		try {
			while (!cancelled) {
				const { done, value } = await reader.read();
				if (done) break;
				lateStreamPumps.push(pumpRawStream(value.id, value.stream));
			}
		} finally {
			reader.releaseLock();
		}
		return lateStreamPumps;
	}
	return new ReadableStream({
		async start(ctrl) {
			controller = ctrl;
			const pumps = [pumpJSON()];
			for (const [streamId, stream] of rawStreams) pumps.push(pumpRawStream(streamId, stream));
			if (lateStreamSource) pumps.push(pumpLateStreams());
			try {
				const latePumps = (await Promise.all(pumps)).find(Array.isArray);
				if (latePumps && latePumps.length > 0) await Promise.all(latePumps);
				if (!cancelled) try {
					controller.close();
				} catch {}
			} catch {}
		},
		cancel() {
			cancelled = true;
			for (const reader of readers) reader.cancel().catch(() => {});
			readers.length = 0;
		}
	});
}
var serovalPlugins = void 0;
var FORM_DATA_CONTENT_TYPES = ["multipart/form-data", "application/x-www-form-urlencoded"];
var MAX_PAYLOAD_SIZE = 1e6;
var handleServerAction = async ({ request, context, serverFnId }) => {
	const methodUpper = request.method.toUpperCase();
	const url = new URL(request.url);
	const action = await getServerFnById(serverFnId, { origin: "client" });
	if (action.method && methodUpper !== action.method) return new Response(`expected ${action.method} method. Got ${methodUpper}`, {
		status: 405,
		headers: { Allow: action.method }
	});
	const isServerFn = request.headers.get("x-tsr-serverFn") === "true";
	if (!serovalPlugins) serovalPlugins = getDefaultSerovalPlugins();
	const contentType = request.headers.get("Content-Type");
	function parsePayload(payload) {
		return fromJSON(payload, { plugins: serovalPlugins });
	}
	return await (async () => {
		try {
			let res = await (async () => {
				if (FORM_DATA_CONTENT_TYPES.some((type) => contentType && contentType.includes(type))) {
					if (methodUpper === "GET") invariant();
					const formData = await request.formData();
					const serializedContext = formData.get(TSS_FORMDATA_CONTEXT);
					formData.delete(TSS_FORMDATA_CONTEXT);
					const params = {
						context,
						data: formData,
						method: methodUpper
					};
					if (typeof serializedContext === "string") try {
						const deserializedContext = fromJSON(JSON.parse(serializedContext), { plugins: serovalPlugins });
						if (typeof deserializedContext === "object" && deserializedContext) params.context = safeObjectMerge(deserializedContext, context);
					} catch (e) {}
					return await action(params);
				}
				if (methodUpper === "GET") {
					const payloadParam = url.searchParams.get("payload");
					if (payloadParam && payloadParam.length > MAX_PAYLOAD_SIZE) throw new Error("Payload too large");
					const payload = payloadParam ? parsePayload(JSON.parse(payloadParam)) : {};
					payload.context = safeObjectMerge(payload.context, context);
					payload.method = methodUpper;
					return await action(payload);
				}
				let jsonPayload;
				if (contentType?.includes("application/json")) jsonPayload = await request.json();
				const payload = jsonPayload ? parsePayload(jsonPayload) : {};
				payload.context = safeObjectMerge(payload.context, context);
				payload.method = methodUpper;
				return await action(payload);
			})();
			const unwrapped = res.result || res.error;
			if (isNotFound(res)) res = isNotFoundResponse(res);
			if (!isServerFn) return unwrapped;
			if (unwrapped instanceof Response) {
				if (isRedirect(unwrapped)) return unwrapped;
				unwrapped.headers.set(X_TSS_RAW_RESPONSE, "true");
				return unwrapped;
			}
			return serializeResult(res);
			function serializeResult(res) {
				let nonStreamingBody = void 0;
				const alsResponse = getResponse();
				if (res !== void 0) {
					const rawStreams = /* @__PURE__ */ new Map();
					let initialPhase = true;
					let lateStreamWriter;
					let lateStreamReadable = void 0;
					const pendingLateStreams = [];
					const plugins = [createRawStreamRPCPlugin((id, stream) => {
						if (initialPhase) {
							rawStreams.set(id, stream);
							return;
						}
						if (lateStreamWriter) {
							lateStreamWriter.write({
								id,
								stream
							}).catch(() => {});
							return;
						}
						pendingLateStreams.push({
							id,
							stream
						});
					}), ...serovalPlugins || []];
					let done = false;
					const callbacks = {
						onParse: (value) => {
							nonStreamingBody = value;
						},
						onDone: () => {
							done = true;
						},
						onError: (error) => {
							throw error;
						}
					};
					toCrossJSONStream(res, {
						refs: /* @__PURE__ */ new Map(),
						plugins,
						onParse(value) {
							callbacks.onParse(value);
						},
						onDone() {
							callbacks.onDone();
						},
						onError: (error) => {
							callbacks.onError(error);
						}
					});
					initialPhase = false;
					if (done && rawStreams.size === 0) return new Response(nonStreamingBody ? JSON.stringify(nonStreamingBody) : void 0, {
						status: alsResponse.status,
						statusText: alsResponse.statusText,
						headers: {
							"Content-Type": "application/json",
							[X_TSS_SERIALIZED]: "true"
						}
					});
					const { readable, writable } = new TransformStream();
					lateStreamReadable = readable;
					lateStreamWriter = writable.getWriter();
					for (const registration of pendingLateStreams) lateStreamWriter.write(registration).catch(() => {});
					pendingLateStreams.length = 0;
					const multiplexedStream = createMultiplexedStream(new ReadableStream({
						start(controller) {
							callbacks.onParse = (value) => {
								controller.enqueue(JSON.stringify(value) + "\n");
							};
							callbacks.onDone = () => {
								try {
									controller.close();
								} catch {}
								lateStreamWriter?.close().catch(() => {}).finally(() => {
									lateStreamWriter = void 0;
								});
							};
							callbacks.onError = (error) => {
								controller.error(error);
								lateStreamWriter?.abort(error).catch(() => {}).finally(() => {
									lateStreamWriter = void 0;
								});
							};
							if (nonStreamingBody !== void 0) callbacks.onParse(nonStreamingBody);
							if (done) callbacks.onDone();
						},
						cancel() {
							lateStreamWriter?.abort().catch(() => {});
							lateStreamWriter = void 0;
						}
					}), rawStreams, lateStreamReadable);
					return new Response(multiplexedStream, {
						status: alsResponse.status,
						statusText: alsResponse.statusText,
						headers: {
							"Content-Type": TSS_CONTENT_TYPE_FRAMED_VERSIONED,
							[X_TSS_SERIALIZED]: "true"
						}
					});
				}
				return new Response(void 0, {
					status: alsResponse.status,
					statusText: alsResponse.statusText
				});
			}
		} catch (error) {
			if (error instanceof Response) return error;
			if (isNotFound(error)) return isNotFoundResponse(error);
			console.info();
			console.info("Server Fn Error!");
			console.info();
			console.error(error);
			console.info();
			const serializedError = JSON.stringify(await Promise.resolve(toCrossJSONAsync(error, {
				refs: /* @__PURE__ */ new Map(),
				plugins: serovalPlugins
			})));
			const response = getResponse();
			return new Response(serializedError, {
				status: response.status ?? 500,
				statusText: response.statusText,
				headers: {
					"Content-Type": "application/json",
					[X_TSS_SERIALIZED]: "true"
				}
			});
		}
	})();
};
function isNotFoundResponse(error) {
	const { headers, ...rest } = error;
	return new Response(JSON.stringify(rest), {
		status: 404,
		headers: {
			"Content-Type": "application/json",
			...headers || {}
		}
	});
}
var LINK_PARAM_TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
var PRELOAD_AS_VALUES = /* @__PURE__ */ new Set([
	"fetch",
	"font",
	"image",
	"script",
	"style",
	"track"
]);
function buildLinkParam(name, value) {
	if (value === void 0) return name;
	if (LINK_PARAM_TOKEN_RE.test(value)) return `${name}=${value}`;
	return `${name}=${JSON.stringify(value)}`;
}
function serializeEarlyHint(hint) {
	const parts = [`<${hint.href}>`, buildLinkParam("rel", hint.rel)];
	if (hint.as) parts.push(buildLinkParam("as", hint.as));
	if (hint.crossOrigin !== void 0) parts.push(buildLinkParam("crossorigin", hint.crossOrigin || void 0));
	if (hint.type) parts.push(buildLinkParam("type", hint.type));
	if (hint.integrity) parts.push(buildLinkParam("integrity", hint.integrity));
	if (hint.referrerPolicy) parts.push(buildLinkParam("referrerpolicy", hint.referrerPolicy));
	if (hint.fetchPriority) parts.push(buildLinkParam("fetchpriority", hint.fetchPriority));
	return parts.join("; ");
}
function getStringAttr(attrs, name, fallbackName) {
	const value = attrs?.[name] ?? (fallbackName ? attrs?.[fallbackName] : void 0);
	return typeof value === "string" ? value : void 0;
}
function getPreloadAs(attrs) {
	const as = getStringAttr(attrs, "as");
	return as && PRELOAD_AS_VALUES.has(as) ? as : void 0;
}
function addEarlyHintFetchAttrs(hint, attrs) {
	const crossOrigin = getStringAttr(attrs, "crossOrigin", "crossorigin");
	const type = getStringAttr(attrs, "type");
	const integrity = getStringAttr(attrs, "integrity");
	const referrerPolicy = getStringAttr(attrs, "referrerPolicy", "referrerpolicy");
	const fetchPriority = getStringAttr(attrs, "fetchPriority", "fetchpriority");
	if (crossOrigin !== void 0) hint.crossOrigin = crossOrigin;
	if (type) hint.type = type;
	if (integrity) hint.integrity = integrity;
	if (referrerPolicy) hint.referrerPolicy = referrerPolicy;
	if (fetchPriority) hint.fetchPriority = fetchPriority;
}
function linkAttrsToEarlyHint(attrs) {
	const href = getStringAttr(attrs, "href");
	const rel = getStringAttr(attrs, "rel");
	if (!href || !rel) return void 0;
	const relTokens = rel.split(/\s+/);
	let hintRel;
	let hintAs;
	if (relTokens.includes("modulepreload")) {
		hintRel = "modulepreload";
		hintAs = "script";
	} else if (relTokens.includes("stylesheet")) {
		hintRel = "preload";
		hintAs = "style";
	} else if (relTokens.includes("preload")) {
		hintAs = getPreloadAs(attrs);
		if (!hintAs) return void 0;
		hintRel = "preload";
	} else if (relTokens.includes("preconnect")) {
		hintRel = "preconnect";
		hintAs = void 0;
	} else if (relTokens.includes("dns-prefetch")) {
		hintRel = "dns-prefetch";
		hintAs = void 0;
	}
	if (!hintRel) return void 0;
	const hint = {
		href,
		rel: hintRel
	};
	if (hintAs) hint.as = hintAs;
	addEarlyHintFetchAttrs(hint, attrs);
	return hint;
}
function collectStaticHintsFromManifest(manifest, matchedRoutes) {
	const hints = [];
	for (const route of matchedRoutes) {
		const routeManifest = manifest.routes[route.id];
		if (!routeManifest) continue;
		for (const link of routeManifest.preloads ?? []) {
			const attrs = getScriptPreloadAttrs(manifest, link);
			const hint = {
				href: attrs.href,
				rel: attrs.rel,
				as: "script"
			};
			if (attrs.crossOrigin !== void 0) hint.crossOrigin = attrs.crossOrigin;
			hints.push(hint);
		}
		for (const link of routeManifest.css ?? []) {
			const stylesheetHref = getStylesheetHref(link);
			if (manifest.inlineCss?.styles[stylesheetHref] !== void 0) continue;
			const resolvedLink = resolveManifestCssLink(link);
			const hint = {
				href: stylesheetHref,
				rel: "preload",
				as: "style"
			};
			if (resolvedLink.crossOrigin !== void 0) hint.crossOrigin = resolvedLink.crossOrigin;
			hints.push(hint);
		}
	}
	return hints;
}
function collectDynamicHintsFromMatches(matches) {
	const hints = [];
	for (const match of matches) {
		const links = match.links;
		if (!Array.isArray(links)) continue;
		for (const link of links) {
			const hint = linkAttrsToEarlyHint(link);
			if (hint) hints.push(hint);
		}
	}
	return hints;
}
function createEarlyHintsEvent(opts) {
	const nextHints = [];
	const nextLinks = [];
	for (const hint of opts.hints) {
		const link = serializeEarlyHint(hint);
		if (opts.sentLinks.has(link)) continue;
		opts.sentLinks.add(link);
		opts.sentHints.push(hint);
		nextHints.push(hint);
		nextLinks.push(link);
	}
	if (!nextHints.length && opts.phase !== "dynamic") return void 0;
	return {
		phase: opts.phase,
		hints: nextHints,
		links: nextLinks,
		allHints: opts.sentHints.slice(),
		allLinks: Array.from(opts.sentLinks)
	};
}
function createResponseLinkHeaderEntries(opts) {
	for (const hint of opts.hints) {
		const link = serializeEarlyHint(hint);
		if (opts.sentLinks.has(link)) continue;
		opts.sentLinks.add(link);
		opts.entries.push({
			phase: opts.phase,
			hint,
			link
		});
	}
}
function getResponseLinkHeaderEntries(opts) {
	if (!opts.filter) return opts.entries.map((entry) => entry.link);
	try {
		const links = [];
		for (const entry of opts.entries) if (opts.filter(entry)) links.push(entry.link);
		return links;
	} catch (err) {
		console.error("Error filtering response Link headers:", err);
		return [];
	}
}
function notifyEarlyHints(phase, event, onEarlyHints) {
	try {
		const result = onEarlyHints(event);
		if (result) Promise.resolve(result).catch((err) => {
			console.error(`Error sending ${phase} early hints:`, err);
		});
	} catch (err) {
		console.error(`Error sending ${phase} early hints:`, err);
	}
}
function getResponseLinkHeaderFilter(responseLinkHeader) {
	if (typeof responseLinkHeader !== "object") return;
	return responseLinkHeader.filter;
}
function appendResponseLinkHeaders(opts) {
	for (const link of getResponseLinkHeaderEntries(opts)) opts.responseHeaders.append("Link", link);
}
function collectResponseLinkHeaderEntries(opts) {
	for (let index = 0; index < opts.event.hints.length; index++) opts.entries.push({
		phase: opts.phase,
		hint: opts.event.hints[index],
		link: opts.event.links[index]
	});
}
function collectEarlyHintsPhase(opts) {
	const event = opts.onEarlyHints ? createEarlyHintsEvent({
		phase: opts.phase,
		hints: opts.hints,
		sentLinks: opts.sentLinks,
		sentHints: opts.sentHints
	}) : void 0;
	if (event) notifyEarlyHints(opts.phase, event, opts.onEarlyHints);
	if (!opts.responseLinkHeaderEntries) return;
	if (event) {
		collectResponseLinkHeaderEntries({
			phase: opts.phase,
			event,
			entries: opts.responseLinkHeaderEntries
		});
		return;
	}
	createResponseLinkHeaderEntries({
		phase: opts.phase,
		hints: opts.hints,
		sentLinks: opts.sentLinks,
		entries: opts.responseLinkHeaderEntries
	});
}
function createEarlyHintsCollector(opts) {
	if (!opts?.onEarlyHints && !opts?.responseLinkHeader) return;
	const sentLinks = /* @__PURE__ */ new Set();
	const sentHints = opts.onEarlyHints ? new Array() : void 0;
	const responseLinkHeaderEntries = opts.responseLinkHeader ? new Array() : void 0;
	const responseLinkHeaderFilter = getResponseLinkHeaderFilter(opts.responseLinkHeader);
	return {
		collectStatic: ({ manifest, matchedRoutes }) => {
			if (!matchedRoutes?.length) return;
			collectEarlyHintsPhase({
				phase: "static",
				hints: collectStaticHintsFromManifest(manifest, matchedRoutes),
				sentLinks,
				sentHints,
				onEarlyHints: opts.onEarlyHints,
				responseLinkHeaderEntries
			});
		},
		collectDynamic: (matches) => {
			collectEarlyHintsPhase({
				phase: "dynamic",
				hints: collectDynamicHintsFromMatches(matches),
				sentLinks,
				sentHints,
				onEarlyHints: opts.onEarlyHints,
				responseLinkHeaderEntries
			});
		},
		appendResponseHeaders: (headers) => {
			if (!responseLinkHeaderEntries?.length) return;
			appendResponseLinkHeaders({
				responseHeaders: headers,
				entries: responseLinkHeaderEntries,
				filter: responseLinkHeaderFilter
			});
		}
	};
}
function normalizeTransformAssetResult(result) {
	if (typeof result === "string") return { href: result };
	return result;
}
function escapeCssString(value) {
	return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\a ").replace(/\r/g, "\\d ").replace(/\f/g, "\\c ");
}
async function transformInlineCssTemplate(options) {
	const { strings, urls } = options.template;
	if (strings.length !== urls.length + 1) throw new Error(`TanStack Start inlineCss template for ${options.stylesheetHref} is invalid`);
	let css = strings[0];
	for (let index = 0; index < urls.length; index++) {
		const transformed = normalizeTransformAssetResult(await options.transformFn({
			kind: "css-url",
			url: urls[index],
			stylesheetHref: options.stylesheetHref
		}));
		css += escapeCssString(transformed.href) + strings[index + 1];
	}
	return css;
}
async function transformInlineCssStyles(inlineCss, transformFn) {
	const transformedStyles = {};
	const transformedEntries = await Promise.all(Object.entries(inlineCss.styles).map(async ([stylesheetHref, css]) => {
		const template = inlineCss.templates?.[stylesheetHref];
		return [stylesheetHref, template ? await transformInlineCssTemplate({
			stylesheetHref,
			template,
			transformFn
		}) : css];
	}));
	for (const [stylesheetHref, css] of transformedEntries) transformedStyles[stylesheetHref] = css;
	return {
		styles: transformedStyles,
		...inlineCss.templates ? { templates: inlineCss.templates } : {}
	};
}
function resolveTransformAssetsCrossOrigin(config, kind) {
	if (!config) return void 0;
	if (typeof config === "string") return config;
	return config[kind];
}
function isObjectShorthand(transform) {
	return "prefix" in transform;
}
function resolveTransformAssetsConfig(transform) {
	if (typeof transform === "string") {
		const prefix = transform;
		return {
			type: "transform",
			transformFn: ({ url }) => ({ href: `${prefix}${url}` }),
			cache: true
		};
	}
	if (typeof transform === "function") return {
		type: "transform",
		transformFn: transform,
		cache: true
	};
	if (isObjectShorthand(transform)) {
		const { prefix, crossOrigin } = transform;
		return {
			type: "transform",
			transformFn: ({ url, kind }) => {
				const href = `${prefix}${url}`;
				if (kind === "css-url") return { href };
				const co = resolveTransformAssetsCrossOrigin(crossOrigin, kind);
				return co ? {
					href,
					crossOrigin: co
				} : { href };
			},
			cache: true
		};
	}
	if ("createTransform" in transform && transform.createTransform) return {
		type: "createTransform",
		createTransform: transform.createTransform,
		cache: transform.cache !== false
	};
	return {
		type: "transform",
		transformFn: typeof transform.transform === "string" ? (({ url }) => ({ href: `${transform.transform}${url}` })) : transform.transform,
		cache: transform.cache !== false
	};
}
function assignManifestLink(link, next) {
	if (typeof link === "string") return next.crossOrigin ? next : next.href;
	const nextLink = {
		...link,
		href: next.href
	};
	if (next.crossOrigin) nextLink.crossOrigin = next.crossOrigin;
	else delete nextLink.crossOrigin;
	return nextLink;
}
async function transformManifestAssets(source, transformFn, _opts) {
	const manifest = structuredClone(source);
	const inlineCssEnabled = _opts?.inlineCss !== false;
	const scriptTransforms = /* @__PURE__ */ new Map();
	const transformScript = (url) => {
		const cached = scriptTransforms.get(url);
		if (cached) return cached;
		const transformed = Promise.resolve(transformFn({
			url,
			kind: "script"
		})).then(normalizeTransformAssetResult);
		scriptTransforms.set(url, transformed);
		return transformed;
	};
	if (!inlineCssEnabled) delete manifest.inlineCss;
	else if (manifest.inlineCss) manifest.inlineCss = await transformInlineCssStyles(manifest.inlineCss, transformFn);
	for (const route of Object.values(manifest.routes)) {
		if (route.preloads?.length) route.preloads = await Promise.all(route.preloads.map(async (link) => {
			const result = await transformScript(resolveManifestAssetLink(link).href);
			return assignManifestLink(link, {
				href: result.href,
				crossOrigin: result.crossOrigin
			});
		}));
		if (route.css?.length && !manifest.inlineCss) route.css = await Promise.all(route.css.map(async (link) => {
			const result = normalizeTransformAssetResult(await transformFn({
				url: resolveManifestCssLink(link).href,
				kind: "stylesheet"
			}));
			return assignManifestLink(link, {
				href: result.href,
				crossOrigin: result.crossOrigin
			});
		}));
		if (route.scripts?.length) for (const script of route.scripts) {
			const src = script.attrs?.src;
			if (typeof src !== "string") continue;
			const result = await transformScript(src);
			script.attrs = {
				...script.attrs,
				src: result.href
			};
			if (result.crossOrigin) script.attrs.crossOrigin = result.crossOrigin;
			else delete script.attrs.crossOrigin;
		}
	}
	return manifest;
}
/**
* Builds a final ServerManifest without URL transforms. Used when no
* transformAssets option is provided.
*
* Returns a new manifest object so the cached base manifest is never mutated.
*/
function buildManifest(source, opts) {
	return {
		...source.scriptFormat ? { scriptFormat: source.scriptFormat } : {},
		...opts?.inlineCss !== false && source.inlineCss ? { inlineCss: structuredClone(source.inlineCss) } : {},
		routes: { ...source.routes }
	};
}
function getStaticHandlerInlineCssDefault(handlerInlineCss) {
	if (typeof handlerInlineCss === "function") return;
	return handlerInlineCss ?? true;
}
async function resolveInlineCssForRequest(opts) {
	if (opts.requestInlineCss !== void 0) return opts.requestInlineCss;
	if (typeof opts.handlerInlineCss === "function") return await opts.handlerInlineCss({ request: opts.request });
	return opts.handlerInlineCss ?? true;
}
function createCachedBaseManifestLoader(loadBaseManifest) {
	let baseManifestPromise;
	return () => {
		if (!baseManifestPromise) baseManifestPromise = loadBaseManifest().catch((error) => {
			baseManifestPromise = void 0;
			throw error;
		});
		return baseManifestPromise;
	};
}
function createFinalManifestTransformResolver(transformAssets, opts) {
	const transformConfig = transformAssets !== void 0 ? resolveTransformAssetsConfig(transformAssets) : void 0;
	const cache = transformConfig ? transformConfig.cache : true;
	const warmup = !!transformAssets && typeof transformAssets === "object" && "warmup" in transformAssets && transformAssets.warmup === true;
	let cachedCreateTransformPromise;
	const clearCachedCreateTransform = () => {
		cachedCreateTransformPromise = void 0;
	};
	return {
		cache,
		warmup,
		clearCachedCreateTransform,
		getTransformFn: async (ctx) => {
			if (!transformConfig) return void 0;
			if (transformConfig.type !== "createTransform") return transformConfig.transformFn;
			if (!cache || !opts.cacheCreateTransform) return transformConfig.createTransform(ctx);
			if (!cachedCreateTransformPromise) cachedCreateTransformPromise = Promise.resolve(transformConfig.createTransform(ctx)).catch((error) => {
				clearCachedCreateTransform();
				throw error;
			});
			return cachedCreateTransformPromise;
		}
	};
}
function createFinalManifestResolver(opts) {
	const finalManifestCache = /* @__PURE__ */ new Map();
	const transformResolver = createFinalManifestTransformResolver(opts.transformAssets, { cacheCreateTransform: opts.cacheCreateTransform });
	const handlerDefaultInlineCss = getStaticHandlerInlineCssDefault(opts.inlineCss);
	const getRequestManifestOptions = async (requestOpts) => {
		const transformFn = await transformResolver.getTransformFn({
			warmup: false,
			request: requestOpts.request
		});
		const inlineCss = await resolveInlineCssForRequest({
			request: requestOpts.request,
			handlerInlineCss: opts.inlineCss,
			requestInlineCss: requestOpts.requestInlineCss
		});
		return {
			getBaseManifest: requestOpts.getBaseManifest,
			transformFn,
			cache: transformResolver.cache,
			inlineCss
		};
	};
	const resolveRequest = async (requestOpts, cache) => {
		return resolveFinalManifest({
			...await getRequestManifestOptions(requestOpts),
			finalManifestCache: cache
		});
	};
	return {
		warmup: ({ getBaseManifest }) => warmupFinalManifest({
			enabled: transformResolver.warmup,
			handlerDefaultInlineCss,
			cache: transformResolver.cache,
			finalManifestCache,
			getBaseManifest,
			getTransformFn: () => transformResolver.getTransformFn({ warmup: true }),
			onError: transformResolver.clearCachedCreateTransform
		}),
		resolveCached: (requestOpts) => resolveRequest(requestOpts, finalManifestCache),
		resolveUncached: (requestOpts) => resolveRequest(requestOpts, void 0)
	};
}
function getFinalManifestCacheKey(inlineCss) {
	return inlineCss ? "inline-css" : "linked-css";
}
function cacheFinalManifestPromise(cachedFinalManifestPromises, cacheKey, promise) {
	const cachedFinalManifestPromise = promise.catch((error) => {
		if (cachedFinalManifestPromises.get(cacheKey) === cachedFinalManifestPromise) cachedFinalManifestPromises.delete(cacheKey);
		throw error;
	});
	cachedFinalManifestPromises.set(cacheKey, cachedFinalManifestPromise);
	return cachedFinalManifestPromise;
}
function getOrCreateCachedFinalManifestPromise(cachedFinalManifestPromises, cacheKey, computeFinalManifest) {
	const cachedFinalManifestPromise = cachedFinalManifestPromises.get(cacheKey);
	if (cachedFinalManifestPromise) return cachedFinalManifestPromise;
	return cacheFinalManifestPromise(cachedFinalManifestPromises, cacheKey, Promise.resolve().then(computeFinalManifest));
}
async function buildFinalManifest(opts) {
	return opts.transformFn ? await transformManifestAssets(opts.base, opts.transformFn, { inlineCss: opts.inlineCss }) : buildManifest(opts.base, { inlineCss: opts.inlineCss });
}
async function resolveFinalManifest(opts) {
	const computeFinalManifest = async () => {
		return buildFinalManifest({
			base: await opts.getBaseManifest(),
			transformFn: opts.transformFn,
			inlineCss: opts.inlineCss
		});
	};
	if (opts.finalManifestCache && (!opts.transformFn || opts.cache)) return getOrCreateCachedFinalManifestPromise(opts.finalManifestCache, getFinalManifestCacheKey(opts.inlineCss), computeFinalManifest);
	return computeFinalManifest();
}
function warmupFinalManifest(opts) {
	if (!opts.enabled || opts.handlerDefaultInlineCss === void 0 || !opts.cache) return;
	const inlineCss = opts.handlerDefaultInlineCss;
	const warmupPromise = getOrCreateCachedFinalManifestPromise(opts.finalManifestCache, getFinalManifestCacheKey(inlineCss), async () => {
		const [base, transformFn] = await Promise.all([opts.getBaseManifest(), opts.getTransformFn()]);
		return buildFinalManifest({
			base,
			transformFn,
			inlineCss
		});
	});
	if (opts.onError) warmupPromise.catch(opts.onError);
	return warmupPromise;
}
var ServerFunctionSerializationAdapter = createSerializationAdapter({
	key: "$TSS/serverfn",
	test: (v) => {
		if (typeof v !== "function") return false;
		if (!(TSS_SERVER_FUNCTION in v)) return false;
		return !!v[TSS_SERVER_FUNCTION];
	},
	toSerializable: ({ serverFnMeta }) => ({ functionId: serverFnMeta.id }),
	fromSerializable: ({ functionId }) => {
		const fn = async (opts, signal) => {
			return (await (await getServerFnById(functionId, { origin: "client" }))(opts ?? {}, signal)).result;
		};
		return fn;
	}
});
function getStartResponseHeaders(opts) {
	return mergeHeaders({ "Content-Type": "text/html; charset=utf-8" }, ..._getRenderedMatches(opts.router.stores.matches.get()).map((match) => {
		return match.headers;
	}));
}
var entriesPromise;
var defaultCsrfMiddleware = createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" });
var getCachedBaseManifest = createCachedBaseManifestLoader(() => getStartManifest());
var getProdBaseManifest = () => getCachedBaseManifest();
var getBaseManifest = getProdBaseManifest;
var createEarlyHintsForRequest = createEarlyHintsCollector;
async function loadEntries() {
	const [routerEntry, startEntry, pluginAdapters] = await Promise.all([
		import("./router-GWEnk-w1.mjs").then((n) => n.t),
		import("./start-5Z2QO8AU.mjs"),
		import("./empty-plugin-adapters-D9UWiqvJ.mjs")
	]);
	return {
		routerEntry,
		startEntry,
		pluginAdapters
	};
}
function getEntries() {
	if (!entriesPromise) entriesPromise = loadEntries();
	return entriesPromise;
}
var ROUTER_BASEPATH = "/";
var SERVER_FN_BASE = "/_serverFn/";
var IS_PRERENDERING = process.env.TSS_PRERENDERING === "true";
var IS_SHELL_ENV = process.env.TSS_SHELL === "true";
var IS_DEV = false;
var ERR_NO_RESPONSE = IS_DEV ? `It looks like you forgot to return a response from your server route handler. If you want to defer to the app router, make sure to have a component set in this route.` : "Internal Server Error";
var ERR_NO_DEFER = IS_DEV ? `You cannot defer to the app router if there is no component defined on this route.` : "Internal Server Error";
function throwRouteHandlerError() {
	throw new Error(ERR_NO_RESPONSE);
}
function throwIfMayNotDefer() {
	throw new Error(ERR_NO_DEFER);
}
/**
* Check if a value is a special response (Response or Redirect)
*/
function isSpecialResponse(value) {
	return value instanceof Response || isRedirect(value);
}
/**
* Normalize middleware result to context shape
*/
function handleCtxResult(result) {
	if (isSsrResponse(result) || isSpecialResponse(result)) return { response: result };
	return result;
}
function disposeLateResponse(result, signal) {
	const response = handleCtxResult(result)?.response;
	if (isSsrResponse(response) || isSpecialResponse(response)) disposeSsrResponseDetached(response, signal.reason);
}
function isSignalAborted(signal) {
	return signal.aborted;
}
/**
* Execute a middleware chain
*/
async function executeMiddleware(middlewares, ctx, signal) {
	let index = -1;
	let streamResponse;
	let retiredStreamIdentities;
	const isResponseAlias = (candidate, response) => candidate === response || candidate instanceof Response && response.body !== null && candidate.body === response.body;
	const setResponse = (response) => {
		if (isSsrResponse(response)) {
			if (response.serverSsrCleanup === "stream") streamResponse = response;
			ctx.response = response.response;
			return;
		}
		ctx.response = response;
	};
	const disposeStreamResponse = async (reason) => {
		const response = streamResponse;
		if (!response) return;
		streamResponse = void 0;
		retiredStreamIdentities ??= /* @__PURE__ */ new WeakSet();
		retiredStreamIdentities.add(response.response);
		if (response.response.body) retiredStreamIdentities.add(response.response.body);
		const currentResponse = ctx.response;
		if (isResponseAlias(currentResponse, response.response)) ctx.response = void 0;
		await response.dispose(reason);
	};
	const disposeAbandonedResult = (result) => {
		const exposed = handleCtxResult(result)?.response;
		const response = isSsrResponse(exposed) ? exposed.response : exposed;
		if (streamResponse && isResponseAlias(response, streamResponse.response)) {
			disposeStreamResponse(signal.reason).catch(console.error);
			return;
		}
		if (response instanceof Response && retiredStreamIdentities && (retiredStreamIdentities.has(response) || response.body !== null && retiredStreamIdentities.has(response.body))) return;
		disposeLateResponse(result, signal);
	};
	const getFinalResponse = async () => {
		const response = ctx.response;
		if (!response) throwRouteHandlerError();
		if (!streamResponse) return response;
		if (response === streamResponse.response) return streamResponse;
		if (streamResponse.response.body !== null && response.body === streamResponse.response.body) return {
			...streamResponse,
			response
		};
		await disposeStreamResponse("middleware response replaced");
		return response;
	};
	let nextPromise;
	function next(nextCtx) {
		const result = runNext(nextCtx);
		nextPromise = result;
		return result;
	}
	async function runNext(nextCtx) {
		if (signal.aborted) throw signal.reason;
		if (nextCtx) {
			if (nextCtx.context) ctx.context = safeObjectMerge(ctx.context, nextCtx.context);
			for (const key of Object.keys(nextCtx)) if (key === "response") setResponse(nextCtx.response);
			else if (key !== "context") ctx[key] = nextCtx[key];
		}
		index++;
		const middleware = middlewares[index];
		if (!middleware) return ctx;
		let result;
		try {
			const pending = middleware({
				...ctx,
				next
			});
			if (pending === nextPromise) {
				nextPromise = void 0;
				result = await pending;
				if (isSignalAborted(signal)) {
					disposeAbandonedResult(result);
					throw signal.reason;
				}
			} else result = await waitForRequest(pending, signal, disposeAbandonedResult);
		} catch (err) {
			if (isSignalAborted(signal)) throw signal.reason;
			if (isSpecialResponse(err)) {
				setResponse(err);
				return ctx;
			}
			throw err;
		}
		const normalized = handleCtxResult(result);
		if (normalized) {
			if (normalized.response !== void 0) setResponse(normalized.response);
			if (normalized.context) ctx.context = safeObjectMerge(ctx.context, normalized.context);
		}
		return ctx;
	}
	try {
		await runNext();
		const response = await waitForRequest(getFinalResponse(), signal, disposeAbandonedResult);
		if (signal.aborted) {
			disposeAbandonedResult(response);
			throw signal.reason;
		}
		return {
			ctx,
			response
		};
	} catch (err) {
		const disposal = disposeStreamResponse(signal.aborted ? signal.reason : err);
		if (signal.aborted) disposal.catch(console.error);
		else await disposal;
		throw err;
	}
}
/**
* Wrap a route handler as middleware
*/
function handlerToMiddleware(handler, mayDefer = false) {
	if (mayDefer) return handler;
	return async (ctx) => {
		const response = await handler({
			...ctx,
			next: throwIfMayNotDefer
		});
		if (!response) throwRouteHandlerError();
		return response;
	};
}
/**
* Creates the TanStack Start request handler.
*
* @example Backwards-compatible usage (handler callback only):
* ```ts
* export default createStartHandler(defaultStreamHandler)
* ```
*
* @example With CDN URL rewriting:
* ```ts
* export default createStartHandler({
*   handler: defaultStreamHandler,
*   transformAssets: 'https://cdn.example.com',
* })
* ```
*
* @example With per-request URL rewriting:
* ```ts
* export default createStartHandler({
*   handler: defaultStreamHandler,
*   transformAssets: {
*     transform: ({ url }) => {
*       const cdnBase = getRequest().headers.get('x-cdn-base') || ''
*       return { href: `${cdnBase}${url}` }
*     },
*     cache: false,
*   },
* })
* ```
*/
function createStartHandler(cbOrOptions) {
	const handlerOptions = typeof cbOrOptions === "function" ? {} : cbOrOptions;
	const cb = typeof cbOrOptions === "function" ? cbOrOptions : cbOrOptions.handler;
	const finalManifestResolver = createFinalManifestResolver({
		...handlerOptions,
		cacheCreateTransform: true
	});
	const resolveManifestForRequest = finalManifestResolver.resolveCached;
	finalManifestResolver.warmup({ getBaseManifest: () => getBaseManifest(void 0) });
	const startRequestResolver = async (request, requestOpts) => {
		let router = null;
		let responseOwnsCleanup = false;
		try {
			request.signal.throwIfAborted();
			const { url, handledProtocolRelativeURL } = getNormalizedURL(request.url);
			const href = url.pathname + url.search + url.hash;
			const origin = getOrigin(request);
			if (handledProtocolRelativeURL) return Response.redirect(url, 308);
			const entries = await waitForRequest(getEntries(), request.signal);
			const hasStartInstance = !!entries.startEntry.startInstance;
			const startOptions = await waitForRequest(entries.startEntry.startInstance?.getOptions(), request.signal) || {};
			const { hasPluginAdapters, pluginSerializationAdapters } = entries.pluginAdapters;
			const serializationAdapters = [
				...startOptions.serializationAdapters || [],
				...hasPluginAdapters ? pluginSerializationAdapters : [],
				ServerFunctionSerializationAdapter
			];
			const requestStartOptions = {
				...startOptions,
				requestMiddleware: hasStartInstance ? startOptions.requestMiddleware : [defaultCsrfMiddleware],
				serializationAdapters
			};
			const flattenedRequestMiddlewares = requestStartOptions.requestMiddleware ? flattenMiddlewares(requestStartOptions.requestMiddleware) : [];
			const executedRequestMiddlewares = new Set(flattenedRequestMiddlewares);
			const getRouter = async () => {
				if (router) return router;
				router = await waitForRequest(entries.routerEntry.getRouter(), request.signal);
				let isShell = IS_SHELL_ENV;
				if (IS_PRERENDERING && !isShell) isShell = request.headers.get(HEADERS.TSS_SHELL) === "true";
				const history = createMemoryHistory({ initialEntries: [href] });
				router.update({
					history,
					isShell,
					isPrerendering: IS_PRERENDERING,
					origin: router.options.origin ?? origin,
					defaultSsr: requestStartOptions.defaultSsr,
					serializationAdapters: [...requestStartOptions.serializationAdapters, ...router.options.serializationAdapters || []],
					basepath: ROUTER_BASEPATH
				});
				return router;
			};
			if (SERVER_FN_BASE && url.pathname.startsWith(SERVER_FN_BASE)) {
				const serverFnId = url.pathname.slice(SERVER_FN_BASE.length).split("/")[0];
				if (!serverFnId) throw new Error("Invalid server action param for serverFnId");
				const serverFnHandler = async ({ context }) => {
					return runWithStartContext({
						getRouter,
						startOptions: requestStartOptions,
						contextAfterGlobalMiddlewares: context,
						request,
						executedRequestMiddlewares,
						handlerType: "serverFn"
					}, () => handleServerAction({
						request,
						context: requestOpts?.context,
						serverFnId
					}));
				};
				const { response: middlewareResponse } = await executeMiddleware([...flattenedRequestMiddlewares.map((d) => d.options.server), serverFnHandler], {
					request,
					pathname: url.pathname,
					handlerType: "serverFn",
					context: createNullProtoObject(requestOpts?.context)
				}, request.signal);
				const result = await handleRedirectResponse(middlewareResponse, request, getRouter, request.signal);
				bindSsrResponseToRequest(router ?? void 0, result, request.signal);
				request.signal.throwIfAborted();
				responseOwnsCleanup = result.serverSsrCleanup === "stream";
				return result.response;
			}
			const executeRouter = async (serverContext, matchedRoutes) => {
				const acceptParts = (request.headers.get("Accept") || "*/*").split(",");
				if (!["*/*", "text/html"].some((mimeType) => acceptParts.some((part) => part.trim().startsWith(mimeType)))) return normalizeSsrResponse(Response.json({ error: "Only HTML requests are supported here" }, { status: 500 }));
				const manifest = await waitForRequest(resolveManifestForRequest({
					request,
					requestInlineCss: requestOpts?.inlineCss,
					getBaseManifest: () => getBaseManifest(matchedRoutes)
				}), request.signal);
				const earlyHints = createEarlyHintsForRequest({
					onEarlyHints: requestOpts?.onEarlyHints,
					responseLinkHeader: requestOpts?.responseLinkHeader
				});
				earlyHints?.collectStatic({
					manifest,
					matchedRoutes
				});
				const routerInstance = await getRouter();
				attachRouterServerSsrUtils({
					router: routerInstance,
					manifest,
					getRequestAssets: () => getStartContext({ throwIfNotFound: false })?.requestAssets
				});
				routerInstance.options.additionalContext = { serverContext };
				await routerInstance.load({ _signal: request.signal });
				request.signal.throwIfAborted();
				if (routerInstance._serverResult?.type === "redirect") return normalizeSsrResponse(routerInstance._serverResult.redirect);
				earlyHints?.collectDynamic(_getRenderedMatches(routerInstance.stores.matches.get()));
				const ctx = getStartContext({ throwIfNotFound: false });
				await waitForRequest(routerInstance.serverSsr.dehydrate({ requestAssets: ctx?.requestAssets }), request.signal);
				request.signal.throwIfAborted();
				const responseHeaders = getStartResponseHeaders({ router: routerInstance });
				earlyHints?.appendResponseHeaders(responseHeaders);
				request.signal.throwIfAborted();
				return normalizeSsrResponse(await waitForRequest(cb({
					request,
					router: routerInstance,
					responseHeaders
				}), request.signal, (late) => disposeLateResponse(late, request.signal)));
			};
			const requestHandlerMiddleware = async ({ context }) => {
				return runWithStartContext({
					getRouter,
					startOptions: requestStartOptions,
					contextAfterGlobalMiddlewares: context,
					request,
					executedRequestMiddlewares,
					handlerType: "router"
				}, async () => {
					try {
						return await handleServerRoutes({
							getRouter,
							request,
							url,
							executeRouter,
							context,
							executedRequestMiddlewares
						});
					} catch (err) {
						if (err instanceof Response) return err;
						throw err;
					}
				});
			};
			const { response: middlewareResponse } = await executeMiddleware([...flattenedRequestMiddlewares.map((d) => d.options.server), requestHandlerMiddleware], {
				request,
				pathname: url.pathname,
				handlerType: "router",
				context: createNullProtoObject(requestOpts?.context)
			}, request.signal);
			const response = await handleRedirectResponse(middlewareResponse, request, getRouter, request.signal);
			bindSsrResponseToRequest(router ?? void 0, response, request.signal);
			request.signal.throwIfAborted();
			responseOwnsCleanup = response.serverSsrCleanup === "stream";
			return response.response;
		} finally {
			if (router?.serverSsr && !responseOwnsCleanup) router.serverSsr.cleanup();
			router = null;
		}
	};
	return requestHandler(startRequestResolver);
}
async function handleRedirectResponse(response, request, getRouter, signal) {
	signal.throwIfAborted();
	const ssrResponse = normalizeSsrResponse(response);
	if (!isRedirect(ssrResponse.response)) return ssrResponse;
	if (isResolvedRedirect(ssrResponse.response)) {
		if (request.headers.get("x-tsr-serverFn") === "true") return waitForRequest(replaceSsrResponse(ssrResponse, Response.json({
			...ssrResponse.response.options,
			isSerializedRedirect: true
		}, { headers: ssrResponse.response.headers }), "redirect response replaced"), signal);
		return ssrResponse;
	}
	const opts = ssrResponse.response.options;
	if (opts.to && typeof opts.to === "string" && !opts.to.startsWith("/")) throw new Error(`Server side redirects must use absolute paths via the 'href' or 'to' options. The redirect() method's "to" property accepts an internal path only. Use the "href" property to provide an external URL. Received: ${JSON.stringify(opts)}`);
	if ([
		"params",
		"search",
		"hash"
	].some((d) => typeof opts[d] === "function")) throw new Error(`Server side redirects must use static search, params, and hash values and do not support functional values. Received functional values for: ${Object.keys(opts).filter((d) => typeof opts[d] === "function").map((d) => `"${d}"`).join(", ")}`);
	signal.throwIfAborted();
	const router = await waitForRequest(getRouter(), signal);
	signal.throwIfAborted();
	const redirect = router.resolveRedirect(ssrResponse.response);
	if (request.headers.get("x-tsr-serverFn") === "true") return waitForRequest(replaceSsrResponse(ssrResponse, Response.json({
		...ssrResponse.response.options,
		isSerializedRedirect: true
	}, { headers: ssrResponse.response.headers }), "redirect response replaced"), signal);
	return waitForRequest(replaceSsrResponse(ssrResponse, redirect, "redirect response replaced"), signal);
}
async function handleServerRoutes({ getRouter, request, url, executeRouter, context, executedRequestMiddlewares }) {
	const router = await getRouter();
	const pathname = executeRewriteInput(router.rewrite, url).pathname;
	const [matchedRoutes, rawParams, foundRoute] = router.getMatchedRoutes(pathname);
	const isExactMatch = foundRoute && rawParams["**"] === void 0;
	const routeMiddlewares = [];
	for (const route of matchedRoutes) {
		const serverMiddleware = route.options.server?.middleware;
		if (serverMiddleware) {
			const flattened = flattenMiddlewares(serverMiddleware);
			for (const m of flattened) if (!executedRequestMiddlewares.has(m)) routeMiddlewares.push(m.options.server);
		}
	}
	const server = foundRoute?.options.server;
	let isHeadFallback = false;
	if (server?.handlers && isExactMatch) {
		const handlers = typeof server.handlers === "function" ? server.handlers({ createHandlers: (d) => d }) : server.handlers;
		const requestMethod = request.method.toUpperCase();
		const handler = requestMethod === "HEAD" ? handlers["HEAD"] ?? handlers["GET"] ?? handlers["ANY"] : handlers[requestMethod] ?? handlers["ANY"];
		isHeadFallback = requestMethod === "HEAD" && handler !== void 0 && !handlers["HEAD"];
		if (handler) {
			const mayDefer = !!foundRoute.options.component;
			if (typeof handler === "function") routeMiddlewares.push(handlerToMiddleware(handler, mayDefer));
			else {
				if (handler.middleware?.length) {
					const handlerMiddlewares = flattenMiddlewares(handler.middleware);
					for (const m of handlerMiddlewares) routeMiddlewares.push(m.options.server);
				}
				if (handler.handler) routeMiddlewares.push(handlerToMiddleware(handler.handler, mayDefer));
			}
		}
	}
	routeMiddlewares.push(((ctx) => executeRouter(ctx.context, matchedRoutes)));
	const { ctx, response } = await executeMiddleware(routeMiddlewares, {
		request,
		context,
		params: rawParams,
		pathname,
		handlerType: "router"
	}, request.signal);
	if (isHeadFallback) {
		if (!ctx.response) throwRouteHandlerError();
		return waitForRequest(stripSsrResponseBody(await handleRedirectResponse(response, request, getRouter, request.signal), "HEAD body stripped"), request.signal);
	}
	return normalizeSsrResponse(response);
}
var server_exports = /* @__PURE__ */ __exportAll({ setCookie: () => setCookie$1 });
var fetch = createStartHandler(defaultStreamHandler);
function createServerEntry(entry) {
	return { async fetch(...args) {
		return await entry.fetch(...args);
	} };
}
var server_default = createServerEntry({ fetch });
//#endregion
export { getServerFnById as a, __exportAll as c, createServerEntry, server_default as default, TSS_SERVER_FUNCTION as i, createMiddleware as n, getRequest as o, createServerFn as r, ssr_exports as s, server_exports as t };
