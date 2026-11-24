// Test data with serials already shared (Chuy, 11/23): migration 0137 refuses a new duplicate serial, but the desk
// still has to handle ones from before it (Merge, Link, the duplicate list). Fixtures that set those up turn the check
// off for their own inserts, then on again, so the flow under test runs with it.
const TRIGGERS = [
  ["account_equipment", "account_equipment_serial_guard"],
  ["assets", "assets_serial_guard"],
];

/** `db` is a PGlite (exec) or the tests' sql wrapper (query). */
const run = (db, text) => (typeof db.exec === "function" ? db.exec(text) : db.query(text));

export async function allowDuplicates(db) {
  for (const [table, trigger] of TRIGGERS) await run(db, `alter table ${table} disable trigger ${trigger}`);
}

export async function guardSerials(db) {
  for (const [table, trigger] of TRIGGERS) await run(db, `alter table ${table} enable trigger ${trigger}`);
}

/** Run `fn` with the check off, then turn it on again. */
export async function withDuplicates(db, fn) {
  await allowDuplicates(db);
  try {
    return await fn();
  } finally {
    await guardSerials(db);
  }
}
