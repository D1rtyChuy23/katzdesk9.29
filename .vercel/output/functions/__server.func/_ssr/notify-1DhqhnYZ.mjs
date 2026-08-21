import { r as createServerFn } from "./ssr.mjs";
import { t as createSsrRpc } from "./createSsrRpc-B2Izd0c7.mjs";
import { n as deskMiddleware } from "./access-Cv44_4sH.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/notify-1DhqhnYZ.js
var listTeammates = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("a2740b848ef9c54b6428a57334fbbd0f61d274e6551140fc955d08887c16be68"));
var listNotifications = createServerFn({ method: "GET" }).middleware([deskMiddleware]).handler(createSsrRpc("ded79099149d28ceb2e0ac0581c7618a59799ce73cd3dabba2d833d972fc964c"));
var sendPing = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("c456a9cfefe23283df58ac4a6dc5cfa41978e3b8e360d899120bd94e5c2beec0"));
var markNotificationRead = createServerFn({ method: "POST" }).middleware([deskMiddleware]).validator((d) => d).handler(createSsrRpc("3fa4ef685c6d3d148750b135b296ab3ac3416c337f4659f76d71f0268e425439"));
//#endregion
export { sendPing as i, listTeammates as n, markNotificationRead as r, listNotifications as t };
