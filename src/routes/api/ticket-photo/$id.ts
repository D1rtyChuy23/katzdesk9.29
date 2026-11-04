import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";

/**
 * A photo on an install, a service or TLC ticket, or a PM (11/4), for someone signed in who can see that record.
 *   /api/ticket-photo/123               the photo
 *   /api/ticket-photo/123?size=thumb    its preview, for the grids
 *   /api/ticket-photo/123?download=1    saved under its name ("Test Cafe - install - WO-1234 (2).jpg")
 * The checks and the reply are in ticket-photos.ts (ticketPhotoResponse), where the tests run them.
 */
export const Route = createFileRoute("/api/ticket-photo/$id")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { ticketPhotoResponse } = await import("@/lib/ops/ticket-photos");
        return ticketPhotoResponse(
          request,
          {
            session: (headers) => auth.api.getSession({ headers }),
            ready: async () => {
              const { getSql } = await import("@/lib/db");
              const { ensureSeeded } = await import("@/lib/ops/seed.server");
              await ensureSeeded();
              return getSql();
            },
          },
          String(params.id ?? ""),
        );
      },
    },
  },
});
