import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { isEmailSignInPath, throttledEmailSignIn } from "@/lib/ops/sign-in";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        // Password sign-in sent straight here counts against the account, the same as the sign-in form.
        if (!isEmailSignInPath(new URL(request.url).pathname)) return auth.handler(request);
        return throttledEmailSignIn(await getSql(), request, (r) => auth.handler(r));
      },
    },
  },
});
