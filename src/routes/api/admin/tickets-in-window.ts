import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Tickets In Window as JSON, read-only, for an Admin who is signed in (Grok's billing request, 2026-10-28):
 *   /api/admin/tickets-in-window?from=2026-10-01&to=2026-10-31&dateBy=completed&board=service,pm,install
 * dateBy is received, completed (the default) or invoiced; board is any of service, tlc, pm, install (all when left
 * out). Nothing is written. A scripted request from another site is refused, as the server functions refuse it.
 */
const BOARDS = ["service", "tlc", "pm", "install"] as const;
type Board = (typeof BOARDS)[number];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

/** Same-origin, a direct address-bar visit, or a non-browser client; never another site's script. */
function sameSiteOk(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (!site || site === "same-origin" || site === "none") return true;
  return request.headers.get("sec-fetch-mode") === "navigate" && request.method === "GET";
}

export const Route = createFileRoute("/api/admin/tickets-in-window")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!sameSiteOk(request)) return json({ error: "Cross-site request refused." }, 403);
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.user) return json({ error: "Sign in first." }, 401);
        const { getSql } = await import("@/lib/db");
        const { ensureSeeded } = await import("@/lib/ops/seed.server");
        const { canReviewNames } = await import("@/lib/ops/access");
        const { ticketsInWindowFor } = await import("@/lib/ops/billing-report-api");
        await ensureSeeded();
        const sql = await getSql();
        if (!(await canReviewNames(sql, session.user.id))) return json({ error: "Only an Admin can read this." }, 403);
        const url = new URL(request.url);
        const from = url.searchParams.get("from") ?? "";
        const to = url.searchParams.get("to") ?? "";
        const by = url.searchParams.get("dateBy");
        const dateBy = by === "received" || by === "invoiced" || by === "completed" ? by : "completed";
        const boardParam = url.searchParams.get("board");
        const boards = boardParam
          ? boardParam.split(",").map((b) => b.trim().toLowerCase()).filter((b): b is Board => (BOARDS as readonly string[]).includes(b))
          : [...BOARDS];
        if (!boards.length) return json({ error: `board must be one or more of ${BOARDS.join(", ")}.` }, 400);
        const out = await ticketsInWindowFor(sql, { from, to, dateBy, boards });
        if (out.error) return json({ error: out.error }, 400);
        return json({ from, to, dateBy, boards, count: out.rows.length, rows: out.rows });
      },
    },
  },
});
