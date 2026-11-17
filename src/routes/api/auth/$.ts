import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";
import { serveAuth } from "@/lib/ops/sign-in";

// What is served here, and how, is serveAuth's (lib/ops/sign-in.ts): the tests run it against the real Better Auth.
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => serveAuth(getSql, request, (r) => auth.handler(r)),
      POST: ({ request }) => serveAuth(getSql, request, (r) => auth.handler(r)),
    },
  },
});
