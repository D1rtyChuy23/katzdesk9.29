import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { isEmailSignInPath, isRefusedAuthPath, throttledEmailSignIn } from "@/lib/ops/sign-in";

const notServed = () => Response.json({ code: "NOT_FOUND", message: "Not found" }, { status: 404 });

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => (isRefusedAuthPath(new URL(request.url).pathname) ? notServed() : auth.handler(request)),
      POST: async ({ request }) => {
        const path = new URL(request.url).pathname;
        if (isRefusedAuthPath(path)) return notServed();
        // Password sign-in sent straight here counts against the account, the same as the sign-in form.
        if (!isEmailSignInPath(path)) return auth.handler(request);
        return throttledEmailSignIn(await getSql(), request, (r) => auth.handler(r));
      },
    },
  },
});
