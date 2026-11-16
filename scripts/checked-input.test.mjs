// Saves check what they are sent (11/16 audit, #4). A server function used to take whatever arrived and trust the
// TypeScript type, which only exists at build time: a number where text belongs crashed the function, or worse,
// reached the database. `checked(schema)` refuses anything that doesn't match, with one plain sentence.
//
// This file covers the sign-in, access, password-reset, notification and rep functions (18), and holds a ceiling
// on the unchecked ones still left elsewhere so the number only goes down.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { register } from "node:module";
import { z } from "zod";

await register("./node-resolve-hook.mjs", import.meta.url);
const { checked, inputProblem } = await import("../src/lib/ops/checked-input.ts");
const input = { ...(await import("../src/lib/ops/access-input.ts")) };

const root = new URL("..", import.meta.url).pathname;
const refuses = (fn, value, pattern) => assert.throws(() => fn(value), (e) => e instanceof Error && !(e instanceof z.ZodError) && pattern.test(e.message) && !e.message.includes("{"), `refuses ${JSON.stringify(value)}`);

test("checked() passes matching input through, drops extra fields, and refuses the rest in one plain sentence", () => {
  const check = checked(z.object({ name: z.string().max(5), n: z.number().int().optional() }));
  assert.deepEqual(check({ name: "abc" }), { name: "abc" });
  assert.deepEqual(check({ name: "abc", n: 2, extra: "x" }), { name: "abc", n: 2 });
  refuses(check, { name: 7 }, /couldn.t be read \(name\)/i);
  refuses(check, { name: ["a"] }, /couldn.t be read \(name\)/i);
  refuses(check, { name: "abc", n: "2" }, /couldn.t be read \(n\)/i);
  refuses(check, null, /couldn.t be read/i);
  refuses(check, undefined, /couldn.t be read/i);
  refuses(check, "name", /couldn.t be read/i);
  refuses(check, { name: "abcdef" }, /too long \(name\)/i);
});

test("inputProblem names the first field that was wrong", () => {
  const r = z.object({ a: z.object({ b: z.number() }) }).safeParse({ a: { b: "x" } });
  assert.equal(r.success, false);
  assert.match(inputProblem(r.error), /\(a\.b\)/);
});

// What each screen sends today (login.tsx, username-setup.tsx, access.tsx, notify-bell.tsx, reps-editor.tsx).
const SENT = {
  usernameInput: [{ username: "po.admin" }, { username: "  someone@example.com " }, { username: "" }],
  identityInput: [{ identity: "po.admin" }, { identity: "" }],
  inviteTokenInput: [{ token: "abc123" }, { token: null }, { token: undefined }, {}],
  registerInput: [{ username: "new.person", email: "new@example.com", token: "abc" }, { username: "new.person", email: null, token: null }, { username: "new.person" }],
  approveInput: [{ userId: "u_1", approved: true }, { userId: "u_1", approved: false }],
  canAddInput: [{ userId: "u_1", canAddCustomers: true }],
  roleInput: [{ userId: "u_1", role: "admin" }, { userId: "u_1", role: "sales" }, { userId: "u_1", role: "service" }, { userId: "u_1", role: "warehouse" }, { userId: "u_1", role: null }],
  userIdInput: [{ userId: "u_1" }],
  createInviteInput: [{ email: "a@example.com", username: "a.person", canAddCustomers: true }, { email: "a@example.com" }, { username: "a.person" }, {}],
  idInput: [{ id: 1 }, { id: 98765 }],
  resetTokenInput: [{ token: "f".repeat(64) }, { token: "" }],
  newPasswordInput: [{ token: "f".repeat(64), password: "a made up password" }, { token: "f".repeat(64), password: "" }],
  markReadInput: [{ id: 4 }, { all: true }, {}],
  pingInput: [
    { toUserId: "u_2", usernames: undefined, body: "Follow up: ZZ Test Diner", entityType: "job", entityId: 12, commentId: null },
    { usernames: ["po.admin", "sam"], body: "@po.admin look", entityType: null, entityId: null, commentId: 5 },
    { body: "hi" },
    { body: "hi", toUserId: "" },
  ],
  repActiveInput: [{ id: 3, active: false }],
};
// One wrong-typed value for each: the kind a script sends, never a screen.
const WRONG = {
  usernameInput: [{ username: 5 }, { username: { $ne: "" } }, { username: ["a"] }, {}, { username: "x".repeat(400) }],
  identityInput: [{ identity: null }, { identity: {} }, { identity: "x".repeat(400) }],
  inviteTokenInput: [{ token: 5 }, { token: {} }, { token: "x".repeat(400) }],
  registerInput: [{ username: 1 }, { username: "ok", email: {} }, { username: "ok", token: [] }, { email: "a@example.com" }],
  approveInput: [{ userId: "u_1", approved: "yes" }, { userId: 1, approved: true }, { approved: true }, { userId: "", approved: true }],
  canAddInput: [{ userId: "u_1", canAddCustomers: 1 }, { userId: "u_1" }],
  roleInput: [{ userId: "u_1", role: "owner" }, { userId: "u_1", role: 1 }, { userId: "u_1" }],
  userIdInput: [{ userId: null }, { userId: "" }, { userId: ["u_1"] }, {}],
  createInviteInput: [{ email: 5 }, { username: {} }, { canAddCustomers: "true" }, { email: "x".repeat(400) + "@example.com" }],
  idInput: [{ id: "1" }, { id: 1.5 }, { id: -1 }, { id: 0 }, { id: null }, {}],
  resetTokenInput: [{ token: 5 }, {}, { token: "x".repeat(400) }],
  newPasswordInput: [{ token: "abc" }, { token: "abc", password: 12345678 }, { token: "abc", password: "x".repeat(2000) }],
  markReadInput: [{ id: "4" }, { all: "true" }, { id: 0 }],
  pingInput: [{ body: 5 }, {}, { body: "hi", usernames: "sam" }, { body: "hi", usernames: [1] }, { body: "hi", entityId: "12" }, { body: "hi", toUserId: 7 }, { body: "x".repeat(20_001) }],
  repActiveInput: [{ id: 3, active: "false" }, { id: "3", active: true }, { id: 3 }],
};

test("every sign-in, access, reset, notification and rep input takes what its screen sends", () => {
  assert.deepEqual(Object.keys(SENT).sort(), Object.keys(input).sort(), "one entry per exported input");
  for (const [name, values] of Object.entries(SENT)) {
    for (const v of values) assert.doesNotThrow(() => input[name](v), `${name} takes ${JSON.stringify(v)}`);
  }
});

test("and refuses the wrong kind of value", () => {
  assert.deepEqual(Object.keys(WRONG).sort(), Object.keys(input).sort(), "one entry per exported input");
  for (const [name, values] of Object.entries(WRONG)) {
    for (const v of values) refuses(input[name], v, /couldn.t be read|too long/i);
  }
});

test("a blank optional value stays what it was (null stays null, missing stays missing)", () => {
  assert.deepEqual(input.inviteTokenInput({ token: null }), { token: null });
  assert.deepEqual(input.inviteTokenInput({}), {});
  assert.deepEqual(input.roleInput({ userId: "u_1", role: null }), { userId: "u_1", role: null });
  assert.deepEqual(input.markReadInput({ all: true }), { all: true });
});

// ── The ones still unchecked ────────────────────────────────────────────────────────────────────────────────────────
function sources(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}
/** `.validator((d: Something) => d)`: the input is passed through unchecked. */
const UNCHECKED = /\.validator\(\s*\(d: (?:[^()]|\([^()]*\))*\)\s*=>\s*d\s*,?\s*\)/g;
const unchecked = Object.fromEntries(
  sources(join(root, "src"))
    .map((f) => [f.slice(root.length), (readFileSync(f, "utf8").match(UNCHECKED) ?? []).length])
    .filter(([, n]) => n > 0),
);

test("the unchecked-input pattern is recognised", () => {
  const sample = `.validator((d: { id: number }) => d)\n.validator((d: { a?: string | null; b: Array<{ x: number }> }) => d)\n.validator((d: T) => schema.parse(d))\n.validator(checked(s))`;
  assert.equal((sample.match(UNCHECKED) ?? []).length, 2);
});

test("no save in the sign-in, access, reset, notification or rep files takes unchecked input", () => {
  for (const f of ["src/lib/ops/access.ts", "src/lib/ops/password-reset.ts", "src/lib/ops/notify.ts", "src/lib/ops/reps.ts"]) {
    assert.equal(unchecked[f] ?? 0, 0, `${f} has an unchecked .validator((d) => d)`);
  }
});

test("the unchecked saves left elsewhere only go down", () => {
  // Lower a number when a file is done; a new file or a higher number means a new save skipped the check.
  const CEILING = { "src/lib/ops/api.ts": 41, "src/lib/ops/network-api.ts": 14 };
  for (const [file, n] of Object.entries(unchecked)) {
    assert.ok(file in CEILING, `${file} has ${n} unchecked .validator((d) => d): use checked(schema)`);
    assert.ok(n <= CEILING[file], `${file} went up to ${n} unchecked validators (ceiling ${CEILING[file]})`);
  }
  for (const [file, n] of Object.entries(CEILING)) assert.equal(unchecked[file] ?? 0, n, `${file} is down to ${unchecked[file] ?? 0}: lower its ceiling`);
});
