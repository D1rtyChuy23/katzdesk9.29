import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { opensInline } from "@/lib/ops/library-file-rules";

/**
 * Opens a Library file (manual or parts diagram) for anyone who has the link — that is what lets
 * staff email or text it to a customer. The token is long and random; there is no listing.
 */
export const Route = createFileRoute("/api/library-file/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "");
        if (!/^[a-f0-9]{48}$/.test(token)) return new Response("Not found", { status: 404 });
        const sql = await getSql();
        const rows = await sql.query<{ id: number; name: string; mime: string; size: number }>(
          "select id, name, mime, size from library_files where token = $1 and complete",
          [token],
        );
        const file = rows[0];
        if (!file) return new Response("This file is no longer in The Library.", { status: 404 });
        let seq = 0;
        const body = new ReadableStream<Uint8Array>({
          async pull(controller) {
            const part = await sql.query<{ b64: string }>(
              "select encode(data, 'base64') as b64 from library_file_chunks where file_id = $1 and seq = $2",
              [file.id, seq],
            );
            if (!part[0]) return controller.close();
            controller.enqueue(new Uint8Array(Buffer.from(part[0].b64.replace(/\s/g, ""), "base64")));
            seq += 1;
          },
        });
        const ascii = file.name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "'");
        return new Response(body, {
          headers: {
            "Content-Type": file.mime,
            "Content-Length": String(file.size),
            "Content-Disposition": `${opensInline(file.mime) ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=300",
            "X-Robots-Tag": "noindex",
          },
        });
      },
    },
  },
});
