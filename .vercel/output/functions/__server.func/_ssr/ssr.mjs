import "../_runtime.mjs";
import { n as getResponse, r as requestHandler } from "./server-Qq6unxOw.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { E as fromJSON, F as resolveManifestCssLink, G as isRedirect, H as isDangerousProtocol, I as waitForReason, J as isNotFound, K as parseRedirect, L as _getRenderedMatches, M as getScriptPreloadAttrs, N as getStylesheetHref, O as toCrossJSONAsync, P as resolveManifestAssetLink, R as executeRewriteInput, U as isPromise, a as isSsrResponse, c as stripSsrResponseBody, i as disposeSsrResponse, k as toCrossJSONStream, m as RouterProvider, n as bindSsrResponseToRequest, o as normalizeSsrResponse, q as rootRouteId, r as defineHandlerCallback, s as replaceSsrResponse, t as renderRouterToStream, z as invariant } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as createServerHistory } from "../_libs/tanstack__history.mjs";
import { a as defaultSerovalDeserializerPlugins, i as createRawStreamRPCPlugin, n as attachRouterServerSsrUtils, o as makeSerovalPlugin, r as getNormalizedURL, s as createSerializationAdapter, t as mergeHeaders } from "../_libs/@tanstack/router-core+[...].mjs";
import { n as require_jsx_runtime } from "../_libs/radix-ui__react-context+react.mjs";
import { AsyncLocalStorage } from "node:async_hooks";
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
	const { tsrStartManifest } = await import("../_tanstack-start-manifest_v-Bce7mtvv.mjs");
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
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"017a676e03a8482a954947e3d04a0c77aa8eeff662ebff5a1803e4c90feffb71": {
		functionName: "createPasswordResetLink_createServerFn_handler",
		importer: () => import("./password-reset-B0yyPoZt.mjs")
	},
	"01a5a11fc715677325945efd317365c2105db9f8ba9b5d8045dcf90b9a0432cf": {
		functionName: "setAccountApproved_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"047cf99859b42ff4cc9bdc01d9166fea108de17835d6e325dd11bb9726bebf45": {
		functionName: "setAssetsPlace_createServerFn_handler",
		importer: () => import("./unit-place-DsOXST-u.mjs")
	},
	"04e238339bdd6284779590313daa1082566359e6814a8ffa69584b040617cd10": {
		functionName: "moveSpecSheet_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"06fd80b5feb6d5cb8bbb9344a113508ac20a8fed29dbd5fc5c5cdab3f4ce7890": {
		functionName: "listCustomers_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"0aa2a8634edcbca3e8e386b99d9ca448fc1a1d0e54845323e6025f5ce6f5300f": {
		functionName: "pullRebuildSerial_createServerFn_handler",
		importer: () => import("./rebuilds-DRxsPIst.mjs")
	},
	"0c92b8356cd8f347c68710f451de25ab912db738351fab72f03b17ec3ccc81f3": {
		functionName: "startLibraryFile_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"0e70cec8a743027415d0460951e6e2bb501309027c1759c4c98cfd78df7764d5": {
		functionName: "listNetwork_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"0eb120547d7147cfacb70cc0bcc4463a916dcf139e3559e0108dacbfad17c4f9": {
		functionName: "moveUnitToBarn_createServerFn_handler",
		importer: () => import("./unit-place-DsOXST-u.mjs")
	},
	"0f1616336d82cdb378bdbca41e5fcf8cd1928d9b9bea529fac33b217f9d4777b": {
		functionName: "assignAssetToService_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"111aeb03d57088e20114c3b91137111583695de7837bf7cd602c0b77a80b8751": {
		functionName: "previewExport_createServerFn_handler",
		importer: () => import("./export-reports-CxVAyFGz.mjs")
	},
	"1192b411cbac542b1a78b65c18f38dc71612d7e014585e7842015736911393dd": {
		functionName: "previewAccountEquipImport_createServerFn_handler",
		importer: () => import("./account-equip-import-BmJ2yoos.mjs")
	},
	"1200b5be72004e85f0bfcee1ed7fc4b89f856bb6c2e04dedd35aa46ed4833b05": {
		functionName: "listRecipes_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"12a794f25eedc091fcc01b69c8afc2fa2556f959485701d3426296bd1de6f841": {
		functionName: "setAccountRole_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"137d5ded2d7aa5bf5f98629cbfee951305bc859007c12a4dcd52b59675374475": {
		functionName: "returnModule_createServerFn_handler",
		importer: () => import("./module-assign-CHWQkLOq.mjs")
	},
	"17e1ebba74c445a1c0bae46dabb84f892f047cc2924e56c1221b2dad8e1a8c7a": {
		functionName: "applySerialPull_createServerFn_handler",
		importer: () => import("./serial-pull-ndE2SH-6.mjs")
	},
	"1ae4b4e6892721617dfc78392d46516266eb655551d1a355b50347de340f48e6": {
		functionName: "updatePm_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"1e76910bf98a3daeaebec03779f138bb00c8e750fd47ea60c7b94abbc3536e90": {
		functionName: "getMyAccess_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"22510d9906f4df09c27dc9de5c9dd27b189534c17db527c136f4a775378514e0": {
		functionName: "coreHoleForModels_createServerFn_handler",
		importer: () => import("./spec-library-CU656o-r.mjs")
	},
	"22e60e6e91a70d2730f3bb1d4f2d60f3934250e9ce92a98218f4897ca3093e4a": {
		functionName: "saveSpecSheet_createServerFn_handler",
		importer: () => import("./spec-library-CU656o-r.mjs")
	},
	"2582de1bfe6e7c6be8f3d00276438723a358e32a85e78329b73b0d7d21e9d1d2": {
		functionName: "updateAsset_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"280698ca3a37048a952a0a60c6de4360d08267057edc403a8ffe38aee977b028": {
		functionName: "listAccountEquipment_createServerFn_handler",
		importer: () => import("./account-equip-import-BmJ2yoos.mjs")
	},
	"2808eee236ac8a01d9b5df827bec7737d82a7b482025f6f1765ce51c74d36ecf": {
		functionName: "assignCustomerProvider_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"2b27f3c2732afa1ab10aff6dc4a21d97370572f26b12f33d9ea9293891c3d5a6": {
		functionName: "listRebuildLinks_createServerFn_handler",
		importer: () => import("./rebuilds-DRxsPIst.mjs")
	},
	"2c4985e96c199268f7f639534cb5e8e31d6b19d43286bf77416413db60ffde26": {
		functionName: "fetchSessionUser_createServerFn_handler",
		importer: () => import("../__root-DqjEpqiF.mjs")
	},
	"30c304b391bc6ebc84ad83642b8d054e5d6ea3da8d0ffb04dd4ff79db94f47ce": {
		functionName: "listLibraryFiles_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"312d37f1589d16ecdcbdf5b204dbcbdc26d40c2ab5050689f9e097526c238a7f": {
		functionName: "setAccountCanAddCustomers_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"318f2417021bd67d7153f1f67032773c35ae5961093958f08328a0f35bfa153e": {
		functionName: "decideModuleReturn_createServerFn_handler",
		importer: () => import("./module-assign-CHWQkLOq.mjs")
	},
	"32a1b02ecd015c716ce62e648f18c5dba877301caaef715def457c76fb7882ad": {
		functionName: "requestStockAssign_createServerFn_handler",
		importer: () => import("./stock-actions-CLmxMcen.mjs")
	},
	"32e8d75725b7de06e4afa66ecda1208726191f2a0ea8c611a35334596e8df6aa": {
		functionName: "deleteLibraryFile_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"33d624b110f3c458dc2c4420e1a7861c9781d7f6cfc29f1e17303ebbdacf5185": {
		functionName: "createJob_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"36a5b8409bc7a33474789e71892092280bbd6e6cffb085fe8a9edc51180d7aee": {
		functionName: "renameLibraryBook_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"382dd0efa33ba73974579c8835f506ae0d04e33a2a6b5c2df3a7598f86087361": {
		functionName: "addProviderAddress_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"385f3e726aaef9adefa16c47f3a60e82af199dfba07c3b4c42b00ed68805f8b3": {
		functionName: "archiveInstall_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"39b0743581a7bf62de46488cabcf15c68c717461b0afaefa731f4fdda4a5b323": {
		functionName: "updateInstall_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"39bf7186ae5c8496b5fd07dadc19af7625bf4a0d78ac5dc625fb334957dd2da2": {
		functionName: "createDeal_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"3a3478acf53044fe7eab5aad067abd8b33c0b8558aad929a0d2b4ee08b583d71": {
		functionName: "renameEquipment_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"3b18cb7c79b3d2a3708e94af1b95e011080a0bb6c37961f6996b2819e381e376": {
		functionName: "getDashboard_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"3d6bd5686c9e2c59523c130a203368a03778b0e5137ce97d8af4fe9986cf09c9": {
		functionName: "unassignAssetFromService_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"3fa4ef685c6d3d148750b135b296ab3ac3416c337f4659f76d71f0268e425439": {
		functionName: "markNotificationRead_createServerFn_handler",
		importer: () => import("./notify-Bi9Udvd-.mjs")
	},
	"423a323a5f7059e99afbe6a138fa5d75c7b349d28d8eb9eb974b9dae76a221ee": {
		functionName: "setAssetPlace_createServerFn_handler",
		importer: () => import("./unit-place-DsOXST-u.mjs")
	},
	"44e26914aa398f4aa37a17dfb87e8a7fb1db5fc93245c5a631ba44a5e8146a05": {
		functionName: "updateRebuild_createServerFn_handler",
		importer: () => import("./rebuilds-DRxsPIst.mjs")
	},
	"459028e7e9941b4f9e5d3cb9f2219c189d90cc6b094ae31d8cfcbce57606b7ed": {
		functionName: "unassignCustomerProvider_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"4635ba032aed43ecf7bcf6ce29de400b651517a7fee7111213c11ac3740d7c53": {
		functionName: "listComments_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"471944d55e1c65b4213049ee898d032a581f48ae35180995f970ee884a74ec4a": {
		functionName: "archiveProvider_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"48eb40870b815944061c950459cff57ae73cf005608d9f5407b0d6c358a44e06": {
		functionName: "addUnitToLocation_createServerFn_handler",
		importer: () => import("./unit-place-DsOXST-u.mjs")
	},
	"4c895f215949f0014777e911ad7244921d2b3ab92bc97a2370befdcb4f0c262a": {
		functionName: "deleteSpecSheet_createServerFn_handler",
		importer: () => import("./spec-library-CU656o-r.mjs")
	},
	"4eb4da6169db850b7984b635fca811e56b64d5fbeac765cd327e779c83c83dec": {
		functionName: "listRebuilds_createServerFn_handler",
		importer: () => import("./rebuilds-DRxsPIst.mjs")
	},
	"4fb622c34d0f8a4c8000a6cacbcea16f8be53607038a90fb258d4781f34aeae0": {
		functionName: "listRosterCandidates_createServerFn_handler",
		importer: () => import("./roster-CS0yptG6.mjs")
	},
	"4fd496bf6f3b83f97ef52b606bd73a533c265292f27c685f1038aa91ca228095": {
		functionName: "assignModule_createServerFn_handler",
		importer: () => import("./module-assign-CHWQkLOq.mjs")
	},
	"50f3a51424d20b683e48516f64c52262e309494e96d5785291293467940eabb2": {
		functionName: "addInspectionPhoto_createServerFn_handler",
		importer: () => import("./inspection-api-DQ61zYnb.mjs")
	},
	"5185381881205a8fef6ae18a40613e887010ff017f2d63e1a073bbc7aeb44afb": {
		functionName: "mergeServiceTickets_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"526601698722a8a88c929ec2b2bd22f0d7d0eb21efd3f1ee9090ef220a7ef449": {
		functionName: "assignAssetToInstall_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"5272252cb350fffbd8b8d56c4ef404ee93249ca615f69b19500c65e08ca968d3": {
		functionName: "renameProvider_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"536e7b9decc803b49351d2954119f89c08eef35743c6f3d4736a487c9fdc519b": {
		functionName: "placeAssetsAtLocation_createServerFn_handler",
		importer: () => import("./unit-place-DsOXST-u.mjs")
	},
	"5597bebbc43b46780ed9ca5b57e6d0f058593df21c38153c1acbab0be9c16df9": {
		functionName: "saveInspectionCoreHole_createServerFn_handler",
		importer: () => import("./inspection-api-DQ61zYnb.mjs")
	},
	"56e061229f5d68c835c12340d4d78410c3592f0cc65d60e8b992d2ee67e6bed5": {
		functionName: "createPm_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"571fac36bc18acec68c60cff2be5821a9a1e35ff8e235b891419be6bf272213f": {
		functionName: "listBarnAvailable_createServerFn_handler",
		importer: () => import("./unit-place-DsOXST-u.mjs")
	},
	"5d3ec062dccd2364f8eadd0069f1e26d01565b58d8975d81fd41d7eb9fb5942a": {
		functionName: "updateDeal_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"5d5dd28faae9fab46aaaf3d96465e9b2b1524240b1cdfcf1959debccb5bceea6": {
		functionName: "grantAllCanAddCustomers_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"60f742086ad3a23d318abdc75ff0ce97e9ed38c49937da158252459edf6faadf": {
		functionName: "appendLibraryChunk_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"63f131a91c65df7c685474b7274437f0a38d7ecc2e8a5fda7460a20345e3664c": {
		functionName: "claimInvite_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"66d5f7130499f8b38df7162a2bc0d7acafb0c172702bd2241f68b2c76bf81dd5": {
		functionName: "handoffDeal_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"683ce4e118843b9882fa4d3ef4aae93e7c9911c090294ea307f851a3f443ba3b": {
		functionName: "getCustomerProviders_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"6957c78daf68c70212899a817926938689d7e458753829416708268b48c06912": {
		functionName: "removeInspectionPhoto_createServerFn_handler",
		importer: () => import("./inspection-api-DQ61zYnb.mjs")
	},
	"6a7975fdb5f66f49fa83d2d5d69689ac2584794af314076f3731b68a6ffe713c": {
		functionName: "listTechs_createServerFn_handler",
		importer: () => import("./roster-CS0yptG6.mjs")
	},
	"6e67d51c0c64562bbed03eea6fbb1e7c689b83ef33496797ea9f1a8a23c70aa9": {
		functionName: "getProvider_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"6f738980065bf83aabf85ff9c0bb4c1676ebab4840efd9eab8bac748961d6812": {
		functionName: "addComment_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"700b799cf439db04647221adfa8f61295144daa74c6da21aec2fae852db466e2": {
		functionName: "lookupSignIn_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"76d7b51b3118ce3c755ac90dd0aa6c2d698a01daf5246936cb2098cdebafa7f2": {
		functionName: "listCustomerRecords_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"7a8456958e7ee0d6d9527aacfe902ec05a25a65ea1e0fefa3fb86f4e03876368": {
		functionName: "addInspectionEquipment_createServerFn_handler",
		importer: () => import("./inspection-api-DQ61zYnb.mjs")
	},
	"7af17eebb642a34c7e1852a14ea49284a565581a9c46d4bdef5396334a5bdc9e": {
		functionName: "setSpecImages_createServerFn_handler",
		importer: () => import("./spec-library-CU656o-r.mjs")
	},
	"7c7f50c54b853be302ab8dadb93d606276a3163565accc501df10cc4604d24fe": {
		functionName: "getJob_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"7d30dfaa7a40d51c27cd0ce998e25cfeded40af2ff16826301ad1363906ce978": {
		functionName: "addProviderLocation_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"7f22f350550d2ff3b78203194b7c195944e4345e647c9bf227847d8e91ac717c": {
		functionName: "registerAccount_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"83cefe8461678b9a0f02a18d7b2aafb95f7e5ee20ca52438886169976cc838f8": {
		functionName: "applyCorrigoImport_createServerFn_handler",
		importer: () => import("./corrigo-import-BnkDaJHf.mjs")
	},
	"8440ebf91ba289568bca2d70bf896fe3d6ac37d423010b493bd201cb52fc8bfd": {
		functionName: "listEversysUnits_createServerFn_handler",
		importer: () => import("./module-assign-CHWQkLOq.mjs")
	},
	"87ac9452e7d2cfc8ff048a7f556a4cb201fe948dfb3c427d26b54fb0668828a5": {
		functionName: "setRepActive_createServerFn_handler",
		importer: () => import("./reps-aLO38X9q.mjs")
	},
	"88be35dcf0a2c1d3551c39b1be50a9cb7a322ff5171e96b8949ba2ed02af4295": {
		functionName: "addEversysUnit_createServerFn_handler",
		importer: () => import("./module-assign-CHWQkLOq.mjs")
	},
	"8a09d9d7b24a86f0c775dbbaf1147644bdfffcbc6057d140eb48ee8ba6dc8a35": {
		functionName: "updateCustomerAccount_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"8a73f2c9525ecba2938f9d480d18743e0dd450638e5c52e2aef7b2e574bfafed": {
		functionName: "createModule_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"8b50c2d8a8f85716a978d9f8629d110029ab352f813c0d0b69c28e2a1151b0f3": {
		functionName: "returnAssetToWarehouse_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"8c8f06038c8723897ebcecc99628566e6111d4f176e232f91206b26908879e6e": {
		functionName: "checkUsername_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"8ccdbb3c70b34b3820d43e3648a9bcd46c879cc300ebf1f76a19b5e9177d592b": {
		functionName: "getSpecImage_createServerFn_handler",
		importer: () => import("./spec-library-CU656o-r.mjs")
	},
	"8dc5f4484e42250633d38357b1e51e8f9a79cf8765bdb03de157067e5e570a90": {
		functionName: "addRep_createServerFn_handler",
		importer: () => import("./reps-aLO38X9q.mjs")
	},
	"8dea21981ac1b7bcdcc5dba0c9279774b461bd56790f061f6b87e9fe846b8a1f": {
		functionName: "listModules_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"918e6d7f4bace1f6c78033b9037d1c6c24ab3094b0be582a97b47c01d0246dc3": {
		functionName: "upsertRecipe_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"91a2ebe1261556f11fcc6a931cb07fb974490d2efb9a57f84f4b4edd6b44fd73": {
		functionName: "removeProviderAddress_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"91cf4a3d18addcef695415dfa07f0323e2ba222a842baa7b1cc9a5e27e896991": {
		functionName: "addTech_createServerFn_handler",
		importer: () => import("./roster-CS0yptG6.mjs")
	},
	"93986fa53442d203e4a12cafc33f34f7bf053f77764431ce3e08439c75080e7c": {
		functionName: "finishLibraryFile_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"96afcaa3f0fed3b3115ee12547f530fd6e737399bfaeee48b5989e79d4732a7f": {
		functionName: "markAssetSold_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"96b964ccada664131e89643fc6b11b1706175dac83156dd8dca0563b06a07e5c": {
		functionName: "listDeskInvites_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"9808091b7d88c9aaa0ea182e021098ea511e2b2129e3f7326d1f45fc088dd90e": {
		functionName: "listEversysModels_createServerFn_handler",
		importer: () => import("./module-assign-CHWQkLOq.mjs")
	},
	"9ab91de92323e50691c871ac4b1abdfc2406ecc69f8898bfc8570b2f3601a8f9": {
		functionName: "setTechActive_createServerFn_handler",
		importer: () => import("./roster-CS0yptG6.mjs")
	},
	"9c292e35364419fb8a3cdeb3000743a246026d456d7c0ed4089a6f7e578a24f6": {
		functionName: "resendInvite_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"9c7c27f89aa4613cba7b0cc60709986234616c8f59c62126c823a868928946ec": {
		functionName: "updateJob_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"9e94e2e91b43a57fed4c1b0f49e909f425a99a2362fe97499cd4a23e47cd989f": {
		functionName: "reviewRackUnit_createServerFn_handler",
		importer: () => import("./rack-stock-D2MExhkv.mjs")
	},
	"a1eea0f261dbf54c8d5b860870221ef0914f3b36ea52c21af2422033a4d82c9a": {
		functionName: "peekPasswordReset_createServerFn_handler",
		importer: () => import("./password-reset-B0yyPoZt.mjs")
	},
	"a25b8ed80544e5f6ef47139dac789bdcbce30de91833be149a93e28a551ace8d": {
		functionName: "applyAccountEquipImport_createServerFn_handler",
		importer: () => import("./account-equip-import-BmJ2yoos.mjs")
	},
	"a2740b848ef9c54b6428a57334fbbd0f61d274e6551140fc955d08887c16be68": {
		functionName: "listTeammates_createServerFn_handler",
		importer: () => import("./notify-Bi9Udvd-.mjs")
	},
	"a2be120d24b496c9ca826bddbada5f554f8e954eb24b11175e7e0eec6edf6dd7": {
		functionName: "lookupSerial_createServerFn_handler",
		importer: () => import("./serial-pull-ndE2SH-6.mjs")
	},
	"a323e74b17415964c1a79e3045d4d2b6b8edab157ec39dd84721e7883b6a73f1": {
		functionName: "addToRackSlot_createServerFn_handler",
		importer: () => import("./rack-stock-D2MExhkv.mjs")
	},
	"a534ea58c5fe888eb5efb486c3893ae8da4fdc6fa69c93aee3dab0efe6f088fa": {
		functionName: "removeProviderContact_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"a604085f737e13d9d322b581973ce524189981a7225ef787326d594c0df45acf": {
		functionName: "revokeInvite_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"a76f381d2caeca51254a208b811ee3a7058d68c1c43e253969f96eca6ae00fb0": {
		functionName: "listAssets_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"a773af33364aab76381bdb9f1f9d43c0da1e5ced63832aff930685d90c1eb96d": {
		functionName: "copyInspectionNa_createServerFn_handler",
		importer: () => import("./inspection-api-DQ61zYnb.mjs")
	},
	"a78a25b878a8eeb0571581d491679ee6d326c39db15f3f0853db09968b6e53d2": {
		functionName: "updateModule_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"a897fd5704cf2d93d3b6df8924c9e538522f63c4c16ebcacabb67b4c3f71411f": {
		functionName: "setShopTest_createServerFn_handler",
		importer: () => import("./rack-stock-D2MExhkv.mjs")
	},
	"a9beaf65084fe0c4d1a91b561db0f7dfe13c0479920eca4f2cac3d82af365079": {
		functionName: "listDeskAccounts_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"aa2f27e21b6668b54a08d0b363a1afedf084a49b1c7d7a195f72b08b68443e3c": {
		functionName: "saveInspectionMeta_createServerFn_handler",
		importer: () => import("./inspection-api-DQ61zYnb.mjs")
	},
	"af2770ffc7230f6441c2c90211140e8767fbb7f8fbe129f5b054493e873c7436": {
		functionName: "copyRecipe_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"b0a96f3bcf56e0746e12be9396d2f1437288961130d2412e9767e869b615c426": {
		functionName: "archiveRebuild_createServerFn_handler",
		importer: () => import("./rebuilds-DRxsPIst.mjs")
	},
	"b77061ca68bf02683e5808aff14e21ac7f7f4324c20c77e18ff63950e0f4c940": {
		functionName: "listPms_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"bbf684dab4be294977c8a135852746b46c064b5fe849356229cfe61bb158aad2": {
		functionName: "archiveDirectoryEntry_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"bc07a2afcfdda5f33354b75fd397103613496c0ae0a38a79614caec91ba569d1": {
		functionName: "searchAll_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"bcbd53d274f00bf8475319f64be83a5f2836af89d7875c42409365ad7d02d632": {
		functionName: "denyAccount_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"bd649af093753888caad62829610101a98a97fcfd3ebda7f1134c10f6803a31f": {
		functionName: "resolveComment_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"be65e2e7f569d7642b6ee04880eb13cfb0d2dd5bb1a1d5bc7aa804dee30b2280": {
		functionName: "getCustomerHistory_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"c02f4706c9c4fc709f0a0203fd50998028247f073559d9aa02e96d8112314336": {
		functionName: "createRebuild_createServerFn_handler",
		importer: () => import("./rebuilds-DRxsPIst.mjs")
	},
	"c13bfcc95ed39debfc612bd0dba5fa7e126c458587511dad745dd410bf38e1a7": {
		functionName: "saveInspectionItem_createServerFn_handler",
		importer: () => import("./inspection-api-DQ61zYnb.mjs")
	},
	"c456a9cfefe23283df58ac4a6dc5cfa41978e3b8e360d899120bd94e5c2beec0": {
		functionName: "sendPing_createServerFn_handler",
		importer: () => import("./notify-Bi9Udvd-.mjs")
	},
	"c4a7418688fc4b7cb7af59b7f9d2eff9d3caace06de75ab3a03f4a37b3217a06": {
		functionName: "downloadExport_createServerFn_handler",
		importer: () => import("./export-reports-CxVAyFGz.mjs")
	},
	"c854c5e5b43313a3bb44ed47820775f74bd7c3c6bd1b5628eec146f2f3de3007": {
		functionName: "lookupUnitPlace_createServerFn_handler",
		importer: () => import("./unit-place-DsOXST-u.mjs")
	},
	"c8fc4fe3d98eafc8771376a0d2ebec3bda02ebe075aeae0672deab4f6afdc960": {
		functionName: "listDeals_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"cb407fb7ef362f72a49afa1c56076478d9a7ed1b36aa226ad00fcb269aa999af": {
		functionName: "previewCorrigoImport_createServerFn_handler",
		importer: () => import("./corrigo-import-BnkDaJHf.mjs")
	},
	"cea062fe70e665c1d6153b5ed394cf90f7ed3f3b8e5ba2a80f14ffc114231996": {
		functionName: "createAsset_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"d0a57fc171437e25225eb204997c8dfd57ffe636970a048a22ff3ac09d0ecf93": {
		functionName: "createInvite_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"d2f0c01fa586ab0280a9d2571d6e36996bd105984cf8317054ca9844291a521a": {
		functionName: "listReps_createServerFn_handler",
		importer: () => import("./reps-aLO38X9q.mjs")
	},
	"d4ab9461d012374d46ecba9be7e158c436bedd8c017539fdd91b43c73ce2b8d7": {
		functionName: "createLibraryBook_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"d4f3a4453af79228779d10db5c4c867e0d5772bb5e93b9b07018aa2b92416401": {
		functionName: "setRosterAdmin_createServerFn_handler",
		importer: () => import("./roster-CS0yptG6.mjs")
	},
	"d542ae756f2e6694dce801180f201b4d169c51d7a4538e3133a8696e2e25728c": {
		functionName: "removeProviderLocation_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"dc40380b82c74cdab678224c0f0313a897ae8fa2b1f75bcfc784e18f54a54492": {
		functionName: "resetPasswordWithToken_createServerFn_handler",
		importer: () => import("./password-reset-B0yyPoZt.mjs")
	},
	"dd497d0a20bc74fd3516a43287eaf1f59ba8ff78889d055ec0134cb3b8100557": {
		functionName: "listJobs_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"ddd97adfd159793caefa8fd7bc9587cd1baf81949be652a5a59f6ba672802db0": {
		functionName: "deleteLibraryBook_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"ded79099149d28ceb2e0ac0581c7618a59799ce73cd3dabba2d833d972fc964c": {
		functionName: "listNotifications_createServerFn_handler",
		importer: () => import("./notify-Bi9Udvd-.mjs")
	},
	"dfcb8584ec64ccdff12a65a3dc61f9d1ebde486ae33eb0006314df8ec7a838d3": {
		functionName: "moveLibraryFile_createServerFn_handler",
		importer: () => import("./library-files-BSuCJgdG.mjs")
	},
	"e05fae23059afc9524cd7006566d3660d6e4e2f8e952866a6a0056267e182f6a": {
		functionName: "peekInvite_createServerFn_handler",
		importer: () => import("./access--HZYvlgN.mjs")
	},
	"e1f6b5e1ee21f932bd78b1ddbf8e596c45e7296aac8591d390fcd0ce141b2d8c": {
		functionName: "setProviderRole_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"e22ae01e87029011ee5e5e0575fd8972f4c4e2713dcb711e0ae981b0d3748276": {
		functionName: "setUnitPlace_createServerFn_handler",
		importer: () => import("./unit-place-DsOXST-u.mjs")
	},
	"e22daf7fa7520295465ba09c97415667123484c7abe24eeb1d68fc4b017933d1": {
		functionName: "requestStockRemove_createServerFn_handler",
		importer: () => import("./stock-actions-CLmxMcen.mjs")
	},
	"e2a9727404575e20d9c96e8c918183b31e00b5f8947c0bdce761f0e91e1fafca": {
		functionName: "listSpecSheets_createServerFn_handler",
		importer: () => import("./spec-library-CU656o-r.mjs")
	},
	"e2b633ecf7be41a2429f12f5a3c5acb729d9ea365fa74fa060240071aaad4282": {
		functionName: "decideStockAction_createServerFn_handler",
		importer: () => import("./stock-actions-CLmxMcen.mjs")
	},
	"e62d56561a7cdcb00f526b0789df917594449c611f745739262dca774fcffed5": {
		functionName: "archiveDeal_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"e864dd8c9b80dad5f2c776a83f842418fb498cb3e65c666915bc181d9ae09617": {
		functionName: "listInstalls_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"eeedbe6b03930fae6ba3c3db70a2afb562a9769026dd2db72fcf16a5dcbf9dac": {
		functionName: "renameCustomer_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"f15851b69a3e7b42b4e445c440d3feb4faef6714c2f17ed71907c717ceb1d406": {
		functionName: "listRebuildOwners_createServerFn_handler",
		importer: () => import("./rebuilds-DRxsPIst.mjs")
	},
	"f2825516656623b695881938cec0b6cf9876e9c7c29a937a8cdcbfa5be64c879": {
		functionName: "addProviderContact_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"f3719f92ebca0f7fba68c57e4e6f1cfb9114315855feb08a7202f3310b8897b8": {
		functionName: "unassignAssetFromInstall_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"f3d500b4701c16e140b486b0f00720767b652e6dd3e1353b7c2367dbcc44d86a": {
		functionName: "createInstall_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"f4edefbbe0a28284e851744c3220811add825e959937d13bcb55136bdffafb5c": {
		functionName: "getHandoff_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"f62afaeae21ab0e89d7d27769b2f5064cb3e75f64a9ea65009068831d0434921": {
		functionName: "upsertProvider_createServerFn_handler",
		importer: () => import("./network-api-Dr6pqTgp.mjs")
	},
	"f818c883ef291f66d478761b3eb1ba6b94f06c954b7e2b79a760dee774ec3b53": {
		functionName: "claimComment_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"f92a32e6bcb066079e1169e5037175021271e828adda251fc4bd6c7eceab34f8": {
		functionName: "addDirectoryEntry_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"fb967f4c4c469ca496f913231e7e98c934eeb1972b1253ec1f9cd9051fd88323": {
		functionName: "extractSpecSheet_createServerFn_handler",
		importer: () => import("./spec-library-CU656o-r.mjs")
	},
	"fba13400f8c6e321ea705395de93864c9cc6795aeb9df4a67cfe7be7204c7886": {
		functionName: "listActivity_createServerFn_handler",
		importer: () => import("./api-BeXSy2FO.mjs")
	},
	"fbb664490aba07096c3380f58854e5e83007e7599d847d5e8f1a7c9ec9053250": {
		functionName: "refreshSpecDefaults_createServerFn_handler",
		importer: () => import("./spec-library-CU656o-r.mjs")
	},
	"fcb138be46c36e675d38a8db2afca32e3042714b5000e9bc32de5c509085767b": {
		functionName: "getInstallInspection_createServerFn_handler",
		importer: () => import("./inspection-api-DQ61zYnb.mjs")
	}
};
async function getServerFnById(id, access) {
	const serverFnInfo = manifest[id];
	if (!serverFnInfo) throw new Error("Server function info not found for " + id);
	const fnModule = serverFnInfo.module ??= await serverFnInfo.importer();
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
/** Largest payload accepted by one framed-protocol record. */
var MAX_FRAME_PAYLOAD_SIZE = 16777216;
/** Largest number of raw streams accepted in one framed response. */
var MAX_FRAMED_STREAMS = 1024;
/** Full Content-Type header value with version parameter */
var TSS_CONTENT_TYPE_FRAMED_VERSIONED = `${TSS_CONTENT_TYPE_FRAMED}; v=1`;
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
/** Start's serialization adapters followed by `routerPlugins`. */
function getSerovalPlugins(routerPlugins) {
	return [...(getStartOptions()?.serializationAdapters)?.map(makeSerovalPlugin) ?? [], ...routerPlugins];
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
var textEncoder$1 = new TextEncoder();
/** Shared empty payload for END frames - avoids allocation per call */
var EMPTY_PAYLOAD = /* @__PURE__ */ new Uint8Array(0);
var MAX_ERROR_MESSAGE_CODE_UNITS = 4096;
/**
* Encodes a single frame with header and payload.
*/
function encodeFrame(type, streamId, payload) {
	if (payload.byteLength > 16777216) throw new RangeError(`Frame payload exceeds ${MAX_FRAME_PAYLOAD_SIZE} bytes`);
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
/** Encodes an error message payload, truncated to a bounded length. */
function encodeErrorPayload(error) {
	const originalMessage = error instanceof Error ? error.message : String(error ?? "Unknown error");
	const message = originalMessage.length > MAX_ERROR_MESSAGE_CODE_UNITS ? `${originalMessage.slice(0, MAX_ERROR_MESSAGE_CODE_UNITS)}…` : originalMessage;
	return textEncoder$1.encode(message);
}
/**
* Creates a multiplexed ReadableStream from serialized response records.
*
* A record's JSON frame is admitted before any raw stream referenced by that
* record starts. Raw streams from admitted records are pumped concurrently.
* The caller bounds the stream count before records reach this function.
*/
function createMultiplexedStream(recordStream, options = {}) {
	let controller;
	let stopped = false;
	let activePumps = 0;
	let wakeDemand;
	let admission;
	const readers = /* @__PURE__ */ new Set();
	const pendingRawStreams = /* @__PURE__ */ new Set();
	const abortOutput = () => errorOutput(options.signal?.reason);
	const wakeAdmission = () => {
		const wake = wakeDemand;
		wakeDemand = void 0;
		wake?.();
	};
	const cancelReader = (reader, reason) => {
		reader.cancel(reason).catch(() => {});
	};
	const cancelStream = (stream, reason) => {
		stream.cancel(reason).catch(() => {});
	};
	const stop = (reason) => {
		if (stopped) return false;
		stopped = [reason];
		options.signal?.removeEventListener("abort", abortOutput);
		wakeAdmission();
		for (const reader of readers) cancelReader(reader, reason);
		for (const stream of pendingRawStreams) cancelStream(stream, reason);
		pendingRawStreams.clear();
		return true;
	};
	const errorOutput = (error) => {
		if (!stop(error)) return;
		try {
			controller.error(error);
		} catch {}
	};
	const waitForDemand = async () => {
		while (!stopped && (controller.desiredSize ?? 0) <= 0) await new Promise((resolve) => {
			wakeDemand = resolve;
		});
		return !stopped;
	};
	const admitFrame = (type, streamId, payload) => {
		if (stopped) return false;
		if (!admission && (controller.desiredSize ?? 0) > 0) {
			controller.enqueue(encodeFrame(type, streamId, payload));
			return true;
		}
		const runAdmission = async () => {
			if (!await waitForDemand()) return false;
			controller.enqueue(encodeFrame(type, streamId, payload));
			return true;
		};
		const result = admission ? admission.then(runAdmission) : runAdmission();
		const clearAdmission = () => {
			if (admission === tail) admission = void 0;
		};
		const tail = result.then(clearAdmission, clearAdmission);
		admission = tail;
		return result;
	};
	const maybeClose = () => {
		if (activePumps !== 0 || !stop()) return;
		try {
			controller.close();
		} catch {}
	};
	const startPump = (pump) => {
		activePumps++;
		pump().then(() => {
			activePumps--;
			maybeClose();
		}, (error) => {
			activePumps--;
			errorOutput(error);
		});
	};
	async function pumpRawStream(streamId, stream) {
		const reader = stream.getReader();
		readers.add(reader);
		try {
			while (!stopped) {
				const { done, value } = await reader.read();
				if (stopped) return;
				if (done) {
					const frameAdmission = admitFrame(2, streamId, EMPTY_PAYLOAD);
					if (frameAdmission !== true) await frameAdmission;
					return;
				}
				if (!(value instanceof Uint8Array)) throw new TypeError("RawStream chunks must be Uint8Array");
				let offset = 0;
				do {
					const frameAdmission = admitFrame(1, streamId, value.byteLength <= 16777216 ? value : value.subarray(offset, offset + MAX_FRAME_PAYLOAD_SIZE));
					if (frameAdmission !== true && (frameAdmission === false || !await frameAdmission)) return;
					offset += MAX_FRAME_PAYLOAD_SIZE;
				} while (offset < value.byteLength);
			}
		} catch (error) {
			if (!stopped) {
				const frameAdmission = admitFrame(3, streamId, encodeErrorPayload(error));
				if (frameAdmission !== true) await frameAdmission;
			}
		} finally {
			readers.delete(reader);
			reader.releaseLock();
		}
	}
	async function pumpRecords() {
		const reader = recordStream.getReader();
		readers.add(reader);
		try {
			while (!stopped) {
				const { done, value } = await reader.read();
				if (stopped) {
					if (!done) for (const registration of value.rawStreams) cancelStream(registration.stream, stopped[0]);
					return;
				}
				if (done) return;
				for (const registration of value.rawStreams) pendingRawStreams.add(registration.stream);
				const frameAdmission = admitFrame(0, 0, value.json);
				if (frameAdmission !== true && (frameAdmission === false || !await frameAdmission)) return;
				for (const registration of value.rawStreams) {
					pendingRawStreams.delete(registration.stream);
					startPump(pumpRawStream.bind(void 0, registration.id, registration.stream));
				}
			}
		} catch (error) {
			if (!stopped) errorOutput(error);
		} finally {
			readers.delete(reader);
			reader.releaseLock();
		}
	}
	return new ReadableStream({
		start(ctrl) {
			controller = ctrl;
			if (options.signal?.aborted) {
				cancelStream(recordStream, options.signal.reason);
				errorOutput(options.signal.reason);
				return;
			}
			options.signal?.addEventListener("abort", abortOutput, { once: true });
			startPump(pumpRecords);
		},
		pull() {
			wakeAdmission();
		},
		cancel(reason) {
			if (stop(reason)) options.onCancel?.(reason);
		}
	});
}
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
			middleware.forEach((item) => {
				if (TSS_SERVER_FUNCTION_FACTORY in item) {
					if (item.options.middleware) newMiddleware.push(...item.options.middleware);
				} else newMiddleware.push(item);
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
						data: opts.data,
						method: opts.method ?? resolvedOptions.method,
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
var serovalPlugins = void 0;
var FORM_DATA_CONTENT_TYPES = ["multipart/form-data", "application/x-www-form-urlencoded"];
var MAX_PAYLOAD_SIZE = 1e6;
var MAX_PENDING_SERIALIZATION_RECORDS = 1024;
var MAX_PENDING_SERIALIZATION_BYTES = 33554432;
var textEncoder = new TextEncoder();
function encodeSerializationRecord(value) {
	return textEncoder.encode(JSON.stringify(value));
}
function exceedsPendingSerializationLimit(record, recordCount, pendingBytes) {
	return recordCount >= MAX_PENDING_SERIALIZATION_RECORDS || pendingBytes + record.byteLength > MAX_PENDING_SERIALIZATION_BYTES;
}
function runSerializationCleanup(dispose) {
	try {
		dispose();
	} catch {}
}
function cancelRawStream(stream, reason) {
	stream.cancel(reason).catch(() => {});
}
var handleServerAction = async ({ request, context, serverFnId }) => {
	const methodUpper = request.method.toUpperCase();
	const url = new URL(request.url);
	const action = await getServerFnById(serverFnId, { origin: "client" });
	if (action.method && methodUpper !== action.method) return new Response(`expected ${action.method} method. Got ${methodUpper}`, {
		status: 405,
		headers: { Allow: action.method }
	});
	const isServerFn = request.headers.get("x-tsr-serverFn") === "true";
	serovalPlugins ??= getSerovalPlugins(defaultSerovalDeserializerPlugins);
	const contentType = request.headers.get("Content-Type");
	try {
		let res;
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
			res = await action(params);
		} else if (methodUpper === "GET") {
			const payloadParam = url.searchParams.get("payload");
			if (payloadParam && payloadParam.length > MAX_PAYLOAD_SIZE) throw new Error("Payload too large");
			const payload = payloadParam ? fromJSON(JSON.parse(payloadParam), { plugins: serovalPlugins }) : void 0;
			res = await action({
				data: payload?.data,
				context: safeObjectMerge(payload?.context, context),
				method: methodUpper
			});
		} else {
			const payload = contentType?.includes("application/json") ? fromJSON(await request.json(), { plugins: serovalPlugins }) : void 0;
			res = await action({
				data: payload?.data,
				context: safeObjectMerge(payload?.context, context),
				method: methodUpper
			});
		}
		const unwrapped = res.error !== void 0 ? res.error : res.result;
		if (isNotFound(res)) res = isNotFoundResponse(res);
		if (!isServerFn && (unwrapped instanceof Response || unwrapped === null || typeof unwrapped !== "object")) return unwrapped;
		if (unwrapped instanceof Response) {
			if (isRedirect(unwrapped)) return unwrapped;
			unwrapped.headers.set(X_TSS_RAW_RESPONSE, "true");
			return unwrapped;
		}
		return serializeResult(res, request.signal, serovalPlugins);
	} catch (error) {
		if (error instanceof Response) return error;
		if (isNotFound(error)) return isNotFoundResponse(error);
		console.error("Server Fn Error!", error);
		const serializedError = JSON.stringify(await toCrossJSONAsync(error, {
			refs: /* @__PURE__ */ new Map(),
			plugins: serovalPlugins
		}));
		const response = getResponse();
		const headers = {
			"Content-Type": "application/json",
			[X_TSS_SERIALIZED]: "true"
		};
		try {
			return new Response(serializedError, {
				status: response.status ?? 500,
				statusText: response.statusText,
				headers
			});
		} catch {
			return new Response(serializedError, {
				status: 500,
				statusText: "",
				headers
			});
		}
	}
};
/**
* Serializes a server-function result. A result that Seroval completes
* synchronously without RawStreams becomes plain JSON; everything else is a
* framed response whose records and raw streams are multiplexed in order.
*/
function serializeResult(res, signal, plugins) {
	const alsResponse = getResponse();
	const initialRecords = [];
	let initialBytes = 0;
	const pendingRawStreams = [];
	let done = false;
	let initialParsed = false;
	let serializationFailure;
	let disposeSerialization;
	let onParse = (value, initial) => {
		if (serializationFailure) return;
		initialParsed ||= initial;
		const record = encodeSerializationRecord(value);
		if (exceedsPendingSerializationLimit(record, initialRecords.length, initialBytes)) {
			serializationFailure = [/* @__PURE__ */ new Error("Server function serialization exceeded its pending output limit")];
			return;
		}
		initialRecords.push(record);
		initialBytes += record.byteLength;
	};
	let onDone = () => {
		if (initialParsed) done = true;
	};
	let onError = (error) => {
		serializationFailure ??= [error];
	};
	const rawStreamPlugin = createRawStreamRPCPlugin((id, stream) => {
		if (serializationFailure) {
			cancelRawStream(stream, serializationFailure[0]);
			return;
		}
		if (id > 1024) {
			const error = /* @__PURE__ */ new Error(`Too many raw streams in framed response (max ${MAX_FRAMED_STREAMS})`);
			cancelRawStream(stream, error);
			onError(error);
			return;
		}
		pendingRawStreams.push({
			id,
			stream
		});
	});
	const dispose = toCrossJSONStream(res, {
		refs: /* @__PURE__ */ new Map(),
		plugins: [rawStreamPlugin, ...plugins],
		onParse(value, initial) {
			onParse(value, initial);
		},
		onDone() {
			onDone();
		},
		onError: (error) => {
			onError(error);
		}
	});
	if (serializationFailure) {
		runSerializationCleanup(dispose);
		for (const registration of pendingRawStreams) cancelRawStream(registration.stream, serializationFailure[0]);
		throw serializationFailure[0];
	}
	if (!done) disposeSerialization = dispose;
	if (done && pendingRawStreams.length === 0 && initialRecords.length === 1) return new Response(initialRecords[0], {
		status: alsResponse.status,
		statusText: alsResponse.statusText,
		headers: {
			"Content-Type": "application/json",
			[X_TSS_SERIALIZED]: "true"
		}
	});
	if (done && initialRecords.length === 1) {
		const json = initialRecords[0];
		if (json.byteLength > 16777216) {
			const error = /* @__PURE__ */ new Error("Server function serialization exceeded its pending output limit");
			for (const registration of pendingRawStreams) cancelRawStream(registration.stream, error);
			throw error;
		}
		const rawStreams = pendingRawStreams.splice(0);
		initialRecords.length = 0;
		return createFramedResponse(new ReadableStream({
			start(controller) {
				controller.enqueue({
					json,
					rawStreams
				});
				controller.close();
			},
			cancel(reason) {
				for (const registration of rawStreams) cancelRawStream(registration.stream, reason);
			}
		}), { signal });
	}
	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();
	const recordAbortController = new AbortController();
	let pendingBytes = 0;
	const pendingRecords = /* @__PURE__ */ new Set();
	const abortRecordStream = (error) => {
		if (serializationFailure) return;
		serializationFailure = [error];
		const disposeCurrentSerialization = disposeSerialization;
		disposeSerialization = void 0;
		for (const registration of pendingRawStreams.splice(0)) cancelRawStream(registration.stream, error);
		for (const record of pendingRecords) for (const registration of record.rawStreams) cancelRawStream(registration.stream, error);
		pendingRecords.clear();
		recordAbortController.abort(error);
		writer.abort(error).catch(() => {});
		if (disposeCurrentSerialization) runSerializationCleanup(disposeCurrentSerialization);
	};
	const writeRecord = (json, rawStreams) => {
		if (serializationFailure) {
			for (const registration of rawStreams) cancelRawStream(registration.stream, serializationFailure[0]);
			return false;
		}
		if (json.byteLength > 16777216 || exceedsPendingSerializationLimit(json, pendingRecords.size, pendingBytes)) {
			const error = /* @__PURE__ */ new Error("Server function serialization exceeded its pending output limit");
			for (const registration of rawStreams) cancelRawStream(registration.stream, error);
			onError(error);
			return false;
		}
		pendingBytes += json.byteLength;
		const record = {
			json,
			rawStreams
		};
		pendingRecords.add(record);
		writer.write(record).then(() => {
			pendingRecords.delete(record);
			pendingBytes -= json.byteLength;
		}, (error) => {
			const stillOwned = pendingRecords.delete(record);
			pendingBytes -= json.byteLength;
			if (stillOwned) for (const registration of rawStreams) cancelRawStream(registration.stream, error);
		});
		return true;
	};
	onParse = (value) => {
		if (serializationFailure) return;
		writeRecord(encodeSerializationRecord(value), pendingRawStreams.splice(0));
	};
	onDone = () => {
		if (serializationFailure) return;
		disposeSerialization = void 0;
		writer.close().catch(() => {});
	};
	onError = (error) => {
		abortRecordStream(error);
	};
	const initialRawStreams = pendingRawStreams.splice(0);
	for (let index = 0; index < initialRecords.length; index++) {
		const isLast = index === initialRecords.length - 1;
		if (!writeRecord(initialRecords[index], isLast ? initialRawStreams : [])) {
			if (!isLast) for (const registration of initialRawStreams) cancelRawStream(registration.stream, serializationFailure[0]);
			initialRecords.length = 0;
			throw serializationFailure[0];
		}
	}
	initialRecords.length = 0;
	if (done) onDone();
	writer.closed.catch((error) => {
		abortRecordStream(error);
	});
	return createFramedResponse(readable, {
		signal: AbortSignal.any([recordAbortController.signal, signal]),
		onCancel: abortRecordStream
	});
	function createFramedResponse(records, options) {
		const multiplexedStream = createMultiplexedStream(records, options);
		try {
			return new Response(multiplexedStream, {
				status: alsResponse.status,
				statusText: alsResponse.statusText,
				headers: {
					"Content-Type": TSS_CONTENT_TYPE_FRAMED_VERSIONED,
					[X_TSS_SERIALIZED]: "true"
				}
			});
		} catch (error) {
			cancelRawStream(multiplexedStream, error);
			throw error;
		}
	}
}
function isNotFoundResponse(error) {
	const { headers, ...rest } = error;
	const response = new Response(JSON.stringify(rest), {
		status: 404,
		headers
	});
	response.headers.set("Content-Type", "application/json");
	return response;
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
			const serverFn = await getServerFnById(functionId, { origin: "client" });
			const result = await serverFn({
				data: opts?.data,
				context: opts?.context,
				method: serverFn.method ?? "GET"
			}, signal);
			if (result.error !== void 0) throw result.error;
			return result.result;
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
		import("./router-Dz9d6qnC.mjs"),
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
function getResponseFromResult(result) {
	return isSsrResponse(result) || result instanceof Response ? result : result?.response;
}
var responseBodySources = /* @__PURE__ */ new WeakMap();
function disposeResponseResult(result, reason) {
	const response = getResponseFromResult(result);
	if (isSsrResponse(response) || response instanceof Response) disposeSsrResponse(response, reason);
}
function hasResponseBody(value) {
	return value instanceof Response && value.body !== null;
}
function inheritsResponseOwnership(ownership, candidate) {
	return hasResponseBody(candidate) && (candidate.body === ownership.response.body || responseBodySources.get(candidate) === ownership.response);
}
function disposeResponseOwnership(ownership, reason) {
	const { response, sourceBody, streamResponse } = ownership;
	streamResponse?.dispose(reason);
	if (!streamResponse || response.body !== sourceBody) response.body.cancel(reason).catch(() => {});
}
function getOwnedResponse(ownership) {
	const { response, sourceBody, streamResponse } = ownership;
	if (!streamResponse) return response;
	if (streamResponse.response === response && response.body === sourceBody) return streamResponse;
	if (response.body === sourceBody) return {
		...streamResponse,
		response
	};
	return {
		...streamResponse,
		response,
		dispose(reason) {
			disposeResponseOwnership(ownership, reason);
		}
	};
}
function createLateResponseDisposer(signal) {
	return (result) => disposeResponseResult(result, signal.reason);
}
/**
* Compose middleware around a terminal response handler. With no middleware
* the terminal runs directly.
*/
async function executeMiddleware(middlewares, terminal, ctx, signal, terminalNext) {
	let index = -1;
	let responseOwnership;
	let settled = false;
	const disposeAbandonedResult = createLateResponseDisposer(signal);
	const setResponse = (response) => {
		const ssrResponse = isSsrResponse(response) ? response : void 0;
		const streamResponse = ssrResponse?.serverSsrCleanup === "stream" ? ssrResponse : void 0;
		const exposed = ssrResponse ? ssrResponse.response : response;
		const current = responseOwnership;
		if (settled) {
			if (exposed !== ctx.response) disposeResponseResult(response, "late middleware response");
			return;
		}
		if (current && current.response === exposed) current.streamResponse ??= streamResponse;
		else if (current && inheritsResponseOwnership(current, exposed)) {
			current.response = exposed;
			current.streamResponse ??= streamResponse;
		} else {
			if (current) disposeResponseOwnership(current, "middleware response replaced");
			if (hasResponseBody(exposed)) responseOwnership = {
				response: exposed,
				sourceBody: exposed.body,
				streamResponse
			};
			else responseOwnership = void 0;
		}
		ctx.response = exposed;
	};
	const reconcileCtxResponse = () => {
		if (ctx.response !== responseOwnership?.response) setResponse(ctx.response);
	};
	let nextPromise;
	function next(nextCtx) {
		const result = runNext(nextCtx);
		nextPromise = result;
		return result;
	}
	async function runNext(nextCtx) {
		signal.throwIfAborted();
		if (nextCtx) {
			if (nextCtx.context) ctx.context = safeObjectMerge(ctx.context, nextCtx.context);
			for (const key of Object.keys(nextCtx)) if (key === "response") setResponse(nextCtx.response);
			else if (key !== "context") ctx[key] = nextCtx[key];
		}
		index++;
		const isTerminal = index === middlewares.length;
		const middleware = index < middlewares.length ? middlewares[index] : isTerminal ? terminal : void 0;
		const middlewareNext = isTerminal && terminalNext ? terminalNext : next;
		if (!middleware) return ctx;
		let result;
		try {
			const pending = middleware({
				...ctx,
				next: middlewareNext
			});
			if (nextPromise && pending === nextPromise) {
				nextPromise = void 0;
				await pending;
				if (signal.aborted) throw signal.reason;
				return ctx;
			} else if (!isPromise(pending)) {
				result = pending;
				signal.throwIfAborted();
			} else result = await waitForReason(pending, signal, disposeAbandonedResult, disposeAbandonedResult);
		} catch (err) {
			reconcileCtxResponse();
			if (signal.aborted) {
				if (result !== void 0) disposeAbandonedResult(result);
				if (err !== signal.reason) disposeAbandonedResult(err);
				throw signal.reason;
			}
			if (err instanceof Response) {
				setResponse(err);
				return ctx;
			}
			throw err;
		}
		if (isTerminal && terminalNext && !result) throwRouteHandlerError();
		reconcileCtxResponse();
		if (result && result !== ctx) {
			const response = getResponseFromResult(result);
			if (response !== void 0 && response !== ctx.response) setResponse(response);
			if (response !== result && result.context && result.context !== ctx.context) ctx.context = safeObjectMerge(ctx.context, result.context);
		}
		return ctx;
	}
	try {
		await runNext();
		const response = ctx.response;
		if (!response) throwRouteHandlerError();
		reconcileCtxResponse();
		if (signal.aborted) throw signal.reason;
		settled = true;
		return responseOwnership ? getOwnedResponse(responseOwnership) : response;
	} catch (err) {
		settled = true;
		if (responseOwnership) disposeResponseOwnership(responseOwnership, signal.aborted ? signal.reason : err);
		throw err;
	}
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
		const signal = request.signal;
		let router;
		let routerPromise;
		let responseOwnsCleanup = false;
		try {
			signal.throwIfAborted();
			const { url, handledProtocolRelativeURL } = getNormalizedURL(request.url);
			const href = url.pathname + url.search + url.hash;
			const origin = url.origin;
			if (handledProtocolRelativeURL) return Response.redirect(url, 308);
			const entries = await waitForReason(getEntries(), signal);
			const isServerFnRequest = !!SERVER_FN_BASE && url.pathname.startsWith(SERVER_FN_BASE);
			const startInstance = entries.startEntry.startInstance;
			let startOptions;
			if (startInstance) {
				const pendingStartOptions = startInstance.getOptions();
				startOptions = isPromise(pendingStartOptions) ? await waitForReason(pendingStartOptions, signal) : pendingStartOptions;
				signal.throwIfAborted();
			} else startOptions = {};
			const { hasPluginAdapters, pluginSerializationAdapters } = entries.pluginAdapters;
			const serializationAdapters = [
				...startOptions.serializationAdapters || [],
				...hasPluginAdapters ? pluginSerializationAdapters : [],
				ServerFunctionSerializationAdapter
			];
			const requestStartOptions = {
				...startOptions,
				requestMiddleware: startInstance ? startOptions.requestMiddleware : isServerFnRequest ? [defaultCsrfMiddleware] : void 0,
				serializationAdapters
			};
			const flattenedRequestMiddlewares = requestStartOptions.requestMiddleware ? flattenMiddlewares(requestStartOptions.requestMiddleware) : [];
			const executedRequestMiddlewares = new Set(flattenedRequestMiddlewares);
			const getRouter = () => {
				routerPromise ??= (async () => {
					signal.throwIfAborted();
					const requestRouter = await waitForReason(entries.routerEntry.getRouter(), signal);
					let isShell = IS_SHELL_ENV;
					if (IS_PRERENDERING && !isShell) isShell = request.headers.get(HEADERS.TSS_SHELL) === "true";
					const history = createServerHistory(href);
					requestRouter.update({
						history,
						isShell,
						isPrerendering: IS_PRERENDERING,
						origin: requestRouter.options.origin ?? origin,
						defaultSsr: requestStartOptions.defaultSsr,
						serializationAdapters: [...requestStartOptions.serializationAdapters, ...requestRouter.options.serializationAdapters || []],
						basepath: ROUTER_BASEPATH
					});
					router = requestRouter;
					return requestRouter;
				})();
				return routerPromise;
			};
			const handlerType = isServerFnRequest ? "serverFn" : "router";
			const startContext = {
				getRouter,
				startOptions: requestStartOptions,
				request,
				executedRequestMiddlewares,
				handlerType
			};
			let terminal;
			if (isServerFnRequest) {
				const serverFnId = url.pathname.slice(SERVER_FN_BASE.length).split("/")[0];
				if (!serverFnId) throw new Error("Invalid server action param for serverFnId");
				terminal = ({ context }) => runWithStartContext({
					...startContext,
					contextAfterGlobalMiddlewares: context
				}, () => handleServerAction({
					request,
					context: requestOpts?.context,
					serverFnId
				}));
			} else {
				const executeRouter = async (serverContext, matchedRoutes) => {
					if (!/(^|,)\s*(\*\/\*|text\/html)/.test(request.headers.get("Accept") || "*/*")) return normalizeSsrResponse(Response.json({ error: "Only HTML requests are supported here" }, { status: 406 }));
					const manifest = await waitForReason(resolveManifestForRequest({
						request,
						requestInlineCss: requestOpts?.inlineCss,
						getBaseManifest: () => getBaseManifest(matchedRoutes)
					}), signal);
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
					await routerInstance.load({ _signal: signal });
					signal.throwIfAborted();
					if (routerInstance._serverResult?.type === "redirect") return normalizeSsrResponse(routerInstance._serverResult.redirect);
					earlyHints?.collectDynamic(_getRenderedMatches(routerInstance.stores.matches.get()));
					const ctx = getStartContext({ throwIfNotFound: false });
					await routerInstance.serverSsr.dehydrate({
						requestAssets: ctx?.requestAssets,
						signal
					});
					signal.throwIfAborted();
					const responseHeaders = getStartResponseHeaders({ router: routerInstance });
					earlyHints?.appendResponseHeaders(responseHeaders);
					signal.throwIfAborted();
					const disposeLate = createLateResponseDisposer(signal);
					return normalizeSsrResponse(await waitForReason(cb({
						request,
						router: routerInstance,
						responseHeaders
					}), signal, disposeLate, disposeLate));
				};
				terminal = ({ context }) => runWithStartContext({
					...startContext,
					contextAfterGlobalMiddlewares: context
				}, () => handleServerRoutes({
					getRouter,
					request,
					url,
					executeRouter,
					context,
					executedRequestMiddlewares
				}));
			}
			const middlewareResponse = await executeMiddleware(flattenedRequestMiddlewares.map((d) => d.options.server), terminal, {
				request,
				pathname: url.pathname,
				handlerType,
				context: createNullProtoObject(requestOpts?.context)
			}, signal);
			let result;
			try {
				result = await handleRedirectResponse(middlewareResponse, getRouter, signal, isServerFnRequest && request.headers.get("x-tsr-serverFn") === "true");
				if (request.method === "HEAD") result = stripSsrResponseBody(result, "HEAD body stripped");
			} catch (error) {
				disposeResponseResult(middlewareResponse, signal.aborted ? signal.reason : error);
				throw error;
			}
			bindSsrResponseToRequest(router, result, signal);
			signal.throwIfAborted();
			responseOwnsCleanup = result.serverSsrCleanup === "stream";
			return result.response;
		} finally {
			if (router?.serverSsr && !responseOwnsCleanup) router.serverSsr.cleanup();
		}
	};
	return requestHandler(startRequestResolver);
}
var relativeRedirectProtocols = /* @__PURE__ */ new Set();
async function handleRedirectResponse(response, getRouter, signal, serializeRedirect) {
	signal.throwIfAborted();
	const ssrResponse = normalizeSsrResponse(response);
	const redirect = ssrResponse.response;
	if (!isRedirect(redirect)) return ssrResponse;
	const opts = redirect.options;
	const href = redirect.headers.get("Location") || opts.href;
	if (!href && opts.to && typeof opts.to === "string" && !opts.to.startsWith("/")) throw new Error(`Server side redirects must use absolute paths via the 'href' or 'to' options. The redirect() method's "to" property accepts an internal path only. Use the "href" property to provide an external URL. Received: ${JSON.stringify(opts)}`);
	if (!href && [
		"params",
		"search",
		"hash"
	].some((d) => typeof opts[d] === "function")) throw new Error(`Server side redirects must use static search, params, and hash values and do not support functional values. Received functional values for: ${Object.keys(opts).filter((d) => typeof opts[d] === "function").map((d) => `"${d}"`).join(", ")}`);
	signal.throwIfAborted();
	if (href && !isDangerousProtocol(href, relativeRedirectProtocols)) {
		opts.href = href;
		redirect.headers.set("Location", href);
	} else {
		const router = await getRouter();
		signal.throwIfAborted();
		router.resolveRedirect(redirect);
	}
	if (serializeRedirect) {
		const redirectOptions = { ...opts };
		delete redirectOptions.headers;
		const responseHeaders = new Headers(redirect.headers);
		responseHeaders.set("content-type", "application/json");
		return replaceSsrResponse(ssrResponse, Response.json({
			...redirectOptions,
			isSerializedRedirect: true
		}, { headers: responseHeaders }), "redirect response replaced");
	}
	return ssrResponse;
}
function withParsedParams(handler, matchedRoutes) {
	if (!matchedRoutes.some((route) => route.options.params?.parse ?? route.options.parseParams)) return handler;
	return (ctx) => {
		const params = Object.assign(Object.create(null), ctx.params);
		for (const route of matchedRoutes) {
			const parse = route.options.params?.parse ?? route.options.parseParams;
			if (parse) Object.assign(params, parse(params));
		}
		return handler({
			...ctx,
			params
		});
	};
}
async function handleServerRoutes({ getRouter, request, url, executeRouter, context, executedRequestMiddlewares }) {
	const router = await getRouter();
	const pathname = executeRewriteInput(router.rewrite, url).pathname;
	const [matchedRoutes, rawParams, foundRoute] = router.getMatchedRoutes(pathname);
	const isExactMatch = foundRoute && rawParams["**"] === void 0;
	const routeMiddlewares = [];
	let terminalHandler = (ctx) => executeRouter(ctx.context, matchedRoutes);
	let terminalNext;
	for (const route of matchedRoutes) {
		const serverMiddleware = route.options.server?.middleware;
		if (serverMiddleware) {
			const flattened = flattenMiddlewares(serverMiddleware);
			for (const m of flattened) if (!executedRequestMiddlewares.has(m)) routeMiddlewares.push(m.options.server);
		}
	}
	const server = foundRoute?.options.server;
	if (server?.handlers && isExactMatch) {
		const handlers = typeof server.handlers === "function" ? server.handlers({ createHandlers: (d) => d }) : server.handlers;
		const requestMethod = request.method.toUpperCase();
		const handler = requestMethod === "HEAD" ? handlers["HEAD"] ?? handlers["GET"] ?? handlers["ANY"] : handlers[requestMethod] ?? handlers["ANY"];
		if (handler) {
			const mayDefer = !!foundRoute.options.component;
			if (typeof handler !== "function") {
				if (handler.middleware?.length) {
					const handlerMiddlewares = flattenMiddlewares(handler.middleware);
					for (const m of handlerMiddlewares) routeMiddlewares.push(m.options.server);
				}
			}
			const routeHandler = typeof handler === "function" ? handler : handler.handler;
			if (routeHandler) {
				const parsedHandler = withParsedParams(routeHandler, matchedRoutes);
				if (!mayDefer) {
					terminalHandler = parsedHandler;
					terminalNext = throwIfMayNotDefer;
				} else routeMiddlewares.push(parsedHandler);
			}
		}
	}
	return normalizeSsrResponse(await executeMiddleware(routeMiddlewares, terminalHandler, {
		request,
		context,
		params: rawParams,
		pathname,
		handlerType: "router"
	}, request.signal, terminalNext));
}
var fetch = createStartHandler(defaultStreamHandler);
function createServerEntry(entry) {
	return { async fetch(...args) {
		return await entry.fetch(...args);
	} };
}
var server_default = createServerEntry({ fetch });
//#endregion
export { createServerEntry, server_default as default, getServerFnById as i, createServerFn as n, TSS_SERVER_FUNCTION as r, createMiddleware as t };
