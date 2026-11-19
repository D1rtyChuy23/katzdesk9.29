import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Who a signed-in request is (11/19, equipment history). The desk's sign-in check (deskMiddleware) runs each server
 * function inside this, so every equipment write in the request names its person without each save passing it along:
 * src/lib/db.ts reads it. Server-only (`.server.ts`): Node's request storage must not reach the browser.
 */
export type RequestActor = { actor: string };

type Ref = typeof globalThis & { __katzRequestActor__?: AsyncLocalStorage<RequestActor> };
const ref = globalThis as Ref;
ref.__katzRequestActor__ ??= new AsyncLocalStorage<RequestActor>();

export function withRequestActor<T>(actor: string, run: () => T): T {
  return ref.__katzRequestActor__!.run({ actor }, run);
}
