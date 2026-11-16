/**
 * A save checks what it is sent (11/16 audit). A server function's TypeScript input type only exists at build time:
 * at run time anything can arrive, from a stale tab or from a script. `checked(schema)` is the function's validator.
 * Input that matches comes back with unknown fields dropped; anything else is refused with one plain sentence, so
 * the handler never sees a number where text belongs.
 *
 *   .validator(checked(z.object({ id: z.number().int().positive() })))
 */
import type { z } from "zod";

/** One sentence for the person (or the log), naming the first field that was wrong. Never the raw zod report. */
export function inputProblem(error: z.ZodError): string {
  const first = error.issues[0];
  const field = first?.path.length ? ` (${first.path.join(".")})` : "";
  if (first?.code === "too_big") return `That's too long${field}.`;
  return `That request couldn't be read${field}. Reload the page and try again.`;
}

export function checked<S extends z.ZodType>(schema: S): (input: z.input<S>) => z.output<S> {
  return (input) => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error(inputProblem(parsed.error));
    return parsed.data;
  };
}
