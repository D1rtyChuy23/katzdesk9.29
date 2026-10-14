import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { auth } from "@/lib/auth/server";

const MAX_BYTES = 6_000_000;

/**
 * One researched photo for a part, fetched from where research found it so the browser can give it the standard
 * treatment (crop, light background, centered) before it is saved. Only an address on that part's own research
 * can be fetched: nothing else is reachable through here. Desk sign-in required.
 */
export const Route = createFileRoute("/api/part-photo-source/$id")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
        if (!session?.user) return new Response("Sign in first.", { status: 401 });
        const id = Number(params.id);
        const index = Number(new URL(request.url).searchParams.get("i") ?? "-1");
        if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(index) || index < -1 || index > 50) return new Response("Not found", { status: 404 });
        const sql = await getSql();
        const row = (
          await sql.query<{ image_url: string | null; candidates: unknown }>(
            `select pr.image_url, pr.candidates
               from billing_items b
               join part_photo_research pr
                 on pr.mpn_key in (regexp_replace(upper(coalesce(b.mfr_part, '')), '[^A-Z0-9]+', '', 'g'), regexp_replace(upper(b.sku), '[^A-Z0-9]+', '', 'g'))
              where b.id = $1
              order by (pr.mpn_key = regexp_replace(upper(coalesce(b.mfr_part, '')), '[^A-Z0-9]+', '', 'g')) desc
              limit 1`,
            [id],
          )
        )[0];
        if (!row) return new Response("This part has no researched photo.", { status: 404 });
        const list = (typeof row.candidates === "string" ? JSON.parse(row.candidates) : row.candidates) as { imageUrl?: string }[];
        const url = index === -1 ? row.image_url : list?.[index]?.imageUrl;
        if (!url || !/^https:\/\//.test(url)) return new Response("No photo at that position.", { status: 404 });
        let res: Response;
        try {
          res = await fetch(url, { headers: { Accept: "image/*" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
        } catch {
          return new Response("Could not reach the photo's source.", { status: 502 });
        }
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !/^image\//i.test(type)) return new Response("The source did not return a photo.", { status: 502 });
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length > MAX_BYTES) return new Response("That photo is too large.", { status: 413 });
        return new Response(bytes, {
          headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "X-Source-Url": url },
        });
      },
    },
  },
});
