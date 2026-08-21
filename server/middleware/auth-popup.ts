/**
 * Serve GET /auth/popup on the Nitro/production server too.
 *
 * Dev already handles this via the Vite `authPopupPlugin`. The live preview
 * iframe must open a top-level popup for Google/X; if the preview proxy ever
 * routes to the built output instead of `npm run dev`, a missing handler
 * rendered a bare "Not Found" page in that popup. This middleware calls the
 * same server-only handler — never a React route.
 */
interface AuthPopupEvent {
  url: URL;
  req: Request;
}

export default async function authPopupMiddleware(
  event: AuthPopupEvent,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  if (event.url.pathname !== "/auth/popup") return next();

  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const { handleAuthPopupRequest } = await import("../../src/lib/auth/popup.server");
  return handleAuthPopupRequest(new Request(event.url.href, event.req));
}
