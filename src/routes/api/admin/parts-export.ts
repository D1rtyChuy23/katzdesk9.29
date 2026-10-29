import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * Parts → Export CSV (Grok's request through Chuy, 2026-10-29): every part on the Parts page, the hidden ones too, as a
 * UTF-8 CSV named kd-parts-YYYY-MM-DD.csv, for an Admin who is signed in. Read only: GET is the only handler, and
 * nothing is written.
 *   /api/admin/parts-export                                   the whole list
 *   /api/admin/parts-export?filtered=1&class=Equipment&q=…     only that class and search (the hidden ones in it too)
 * The checks (another site's script, the sign-in, the Admin) and the streamed file are in parts-export-api.ts
 * (partsExportResponse), where the tests run them.
 */
export const Route = createFileRoute("/api/admin/parts-export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { partsExportResponse } = await import("@/lib/ops/parts-export-api");
        return partsExportResponse(request, {
          session: (headers) => auth.api.getSession({ headers }),
          ready: async () => {
            const { getSql } = await import("@/lib/db");
            const { ensureSeeded } = await import("@/lib/ops/seed.server");
            await ensureSeeded();
            return getSql();
          },
          publicUrl: process.env.BETTER_AUTH_URL,
        });
      },
    },
  },
});
