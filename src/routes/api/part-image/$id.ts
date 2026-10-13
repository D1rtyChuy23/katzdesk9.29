import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";

/**
 * A part's photo. The address carries a version that changes with the photo, so it can be cached for good;
 * the same image is used on the inventory list, the invoice picker and the invoice line.
 */
export const Route = createFileRoute("/api/part-image/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const id = Number(params.id);
        if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
        const sql = await getSql();
        const rows = await sql.query<{ b64: string; mime: string | null; v: string }>(
          `select encode(image, 'base64') as b64, image_mime as mime, extract(epoch from image_updated_at)::bigint::text as v
             from billing_items where id = $1 and image is not null`,
          [id],
        );
        const row = rows[0];
        if (!row) return new Response("No photo for this part.", { status: 404 });
        const etag = `"part-${id}-${row.v}"`;
        const headers = {
          "Content-Type": row.mime ?? "image/jpeg",
          "Cache-Control": "private, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
          "X-Robots-Tag": "noindex",
          ETag: etag,
        };
        if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
        return new Response(Buffer.from(row.b64.replace(/\s/g, ""), "base64"), { headers });
      },
    },
  },
});
