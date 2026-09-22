import type { Sql } from "@/lib/db";
import { catalogModels, listedEquipment, rewriteEquipmentName, samePiece } from "./equipment";
import { parseMachinesJson, serializeMachines } from "./machines";

/** Every table that stores a customer as a name string (the join key). */
export async function retargetCustomer(sql: Sql, fromRaw: string, toRaw: string): Promise<void> {
  const from = fromRaw.trim();
  const to = toRaw.trim();
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
    if (from && to && from !== to) {
      await sql.query(`update directory_customers set name = $1, updated_at = now() where lower(name) = lower($2)`, [
        to,
        from,
      ]);
      await sql.query(`update service_jobs set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]);
      await sql.query(`update pm_jobs set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]);
      await sql.query(`update installs set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]);
      await sql.query(`update deals set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]);
      await sql.query(`update recipes set customer = $1 where lower(customer) = lower($2)`, [to, from]);
      await sql.query(`update network_accounts set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
      await sql.query(`update customer_providers set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
      await sql.query(`update assets set customer_owned = $1, updated_at = now() where lower(customer_owned) = lower($2)`, [to, from]).catch(() => undefined);
      await sql.query(`update assets set sold_to = $1, updated_at = now() where lower(sold_to) = lower($2)`, [to, from]).catch(() => undefined);
      await sql.query(`update account_equipment set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
    }
    return;
  }

  await sql.query(
    `delete from customer_providers a
     using customer_providers b
     where lower(a.customer) = lower($1)
       and lower(b.customer) = lower($2)
       and a.provider_id = b.provider_id`,
    [from, to],
  ).catch(() => undefined);

  await sql.query(
    `delete from network_accounts a
     using network_accounts b
     where lower(a.customer) = lower($1)
       and lower(b.customer) = lower($2)`,
    [from, to],
  ).catch(() => undefined);

  await sql.query(
    `delete from recipes a
     using recipes b
     where lower(a.customer) = lower($1)
       and lower(b.customer) = lower($2)
       and lower(a.equipment_model) = lower(b.equipment_model)`,
    [from, to],
  ).catch(() => undefined);

  const sets: [string, string][] = [
    ["service_jobs", "customer"],
    ["pm_jobs", "customer"],
    ["installs", "customer"],
    ["deals", "customer"],
    ["recipes", "customer"],
  ];
  for (const [table, col] of sets) {
    await sql.query(
      `update ${table} set ${col} = $1${table === "recipes" ? "" : ", updated_at = now()"} where lower(${col}) = lower($2)`,
      [to, from],
    ).catch(async () => {
      await sql.query(`update ${table} set ${col} = $1 where lower(${col}) = lower($2)`, [to, from]);
    });
  }

  await sql.query(`update customer_providers set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update network_accounts set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update assets set customer_owned = $1, updated_at = now() where lower(coalesce(customer_owned,'')) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update assets set sold_to = $1, updated_at = now() where lower(coalesce(sold_to,'')) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update account_equipment set customer = $1, updated_at = now() where lower(customer) = lower($2)`, [to, from]).catch(() => undefined);
}

export async function renameOrMergeCustomer(
  sql: Sql,
  id: number,
  nextRaw: string,
): Promise<{ id: number; name: string; merged: boolean }> {
  const next = nextRaw.trim();
  if (!next) throw new Error("Customer name is empty");
  const cur = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from directory_customers where id = $1`,
    [id],
  );
  const row = cur[0];
  if (!row) throw new Error("Customer not found");
  if (row.name === next) return { id: row.id, name: row.name, merged: false };

  const other = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from directory_customers where lower(name) = lower($1) and id <> $2 limit 1`,
    [next, id],
  );
  if (other[0]) {
    const keep = other[0];
    await retargetCustomer(sql, row.name, keep.name);
    await sql.query(`update directory_customers set archived = true, updated_at = now() where id = $1`, [id]);
    if (keep.archived) {
      await sql.query(`update directory_customers set archived = false, name = $1, updated_at = now() where id = $2`, [
        keep.name,
        keep.id,
      ]);
    }
    return { id: keep.id, name: keep.name, merged: true };
  }

  await retargetCustomer(sql, row.name, next);
  await sql.query(`update directory_customers set name = $1, archived = false, updated_at = now() where id = $2`, [
    next,
    id,
  ]);
  return { id, name: next, merged: false };
}

export async function retargetEquipment(sql: Sql, fromRaw: string, toRaw: string): Promise<void> {
  const from = fromRaw.trim();
  const to = toRaw.trim();
  if (!from || !to) return;

  const dir = await sql.query<{ name: string }>(
    `select name from directory_equipment where archived = false and coalesce(name,'') <> ''`,
  );
  const catalog = catalogModels([...dir.map((r) => r.name), from, to]);

  const blobs: [string, string][] = [
    ["service_jobs", "equipment"],
    ["pm_jobs", "equipment"],
    ["deals", "equipment"],
    ["installs", "equipment"],
  ];
  for (const [table, col] of blobs) {
    const rows = await sql.query<{ id: number; blob: string }>(
      `select id, ${col} as blob from ${table}
       where ${col} is not null and ${col} <> ''
         and (lower(${col}) = lower($1) or ${col} ilike '%' || $1 || '%')`,
      [from],
    );
    for (const row of rows) {
      const next = rewriteEquipmentName(row.blob, from, to, catalog);
      if (next !== row.blob) {
        await sql.query(`update ${table} set ${col} = $1, updated_at = now() where id = $2`, [next, row.id]).catch(async () => {
          await sql.query(`update ${table} set ${col} = $1 where id = $2`, [next, row.id]);
        });
      }
    }
  }

  await sql.query(`update recipes set equipment_model = $1 where lower(equipment_model) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update assets set model = $1, updated_at = now() where lower(model) = lower($2)`, [to, from]).catch(() => undefined);
  await sql.query(`update account_equipment set catalog_model = $1, updated_at = now() where lower(catalog_model) = lower($2)`, [to, from]).catch(() => undefined);

  const machineRows = await sql.query<{ id: number; machines: string; equipment: string | null }>(
    `select id, machines, equipment from installs where machines is not null and machines <> ''`,
  );
  for (const row of machineRows) {
    const specs = parseMachinesJson(row.machines);
    if (!specs.length) continue;
    let hit = false;
    const next = specs.map((s) => {
      if (!samePiece(s.equipment, from)) return s;
      hit = true;
      return { ...s, equipment: to };
    });
    if (!hit) continue;
    const names = listedEquipment(next.map((s) => s.equipment).join("\n"), catalog);
    const packed = serializeMachines(next.map((s, i) => ({ ...s, equipment: names[i] ?? s.equipment })));
    await sql.query(
      `update installs set machines = $1, equipment = $2, serial = $3, power_voltage = $4, updated_at = now() where id = $5`,
      [packed.machines, packed.equipment, packed.serial, packed.powerVoltage, row.id],
    ).catch(() => undefined);
  }
}

export async function renameOrMergeEquipment(
  sql: Sql,
  id: number,
  nextRaw: string,
): Promise<{ id: number; name: string; merged: boolean }> {
  const next = nextRaw.trim();
  if (!next) throw new Error("Equipment name is empty");
  const cur = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from directory_equipment where id = $1`,
    [id],
  );
  const row = cur[0];
  if (!row) throw new Error("Equipment not found");
  if (row.name === next) return { id: row.id, name: row.name, merged: false };

  const other = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from directory_equipment where lower(name) = lower($1) and id <> $2 limit 1`,
    [next, id],
  );
  if (other[0]) {
    const keep = other[0];
    await retargetEquipment(sql, row.name, keep.name);
    await sql.query(`update directory_equipment set archived = true, updated_at = now() where id = $1`, [id]);
    if (keep.archived) {
      await sql.query(`update directory_equipment set archived = false, name = $1, updated_at = now() where id = $2`, [
        keep.name,
        keep.id,
      ]);
    }
    return { id: keep.id, name: keep.name, merged: true };
  }

  await retargetEquipment(sql, row.name, next);
  await sql.query(`update directory_equipment set name = $1, archived = false, updated_at = now() where id = $2`, [
    next,
    id,
  ]);
  return { id, name: next, merged: false };
}

export async function renameOrMergeProvider(
  sql: Sql,
  id: number,
  nextRaw: string,
): Promise<{ id: number; name: string; merged: boolean }> {
  const next = nextRaw.trim();
  if (!next) throw new Error("Provider name is empty");
  const cur = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from network_providers where id = $1`,
    [id],
  );
  const row = cur[0];
  if (!row) throw new Error("Provider not found");
  if (row.name === next) return { id: row.id, name: row.name, merged: false };

  const other = await sql.query<{ id: number; name: string; archived: boolean }>(
    `select id, name, archived from network_providers where lower(name) = lower($1) and id <> $2 limit 1`,
    [next, id],
  );
  if (other[0]) {
    const keep = other[0];
    await sql.query(
      `delete from customer_providers a
       using customer_providers b
       where a.provider_id = $1 and b.provider_id = $2 and lower(a.customer) = lower(b.customer)`,
      [id, keep.id],
    ).catch(() => undefined);
    await sql.query(`update customer_providers set provider_id = $1, updated_at = now() where provider_id = $2`, [
      keep.id,
      id,
    ]).catch(() => undefined);
    await sql.query(
      `delete from provider_locations a
       using provider_locations b
       where a.provider_id = $1 and b.provider_id = $2
         and a.state = b.state
         and coalesce(lower(a.city),'') = coalesce(lower(b.city),'')
         and coalesce(a.zip,'') = coalesce(b.zip,'')`,
      [id, keep.id],
    ).catch(() => undefined);
    await sql.query(`update provider_locations set provider_id = $1 where provider_id = $2`, [keep.id, id]).catch(() => undefined);
    await sql.query(`update provider_contacts set provider_id = $1 where provider_id = $2`, [keep.id, id]).catch(() => undefined);
    await sql.query(`update provider_addresses set provider_id = $1 where provider_id = $2`, [keep.id, id]).catch(() => undefined);
    await sql.query(`update network_providers set archived = true, updated_at = now() where id = $1`, [id]);
    if (keep.archived) {
      await sql.query(`update network_providers set archived = false, name = $1, updated_at = now() where id = $2`, [
        keep.name,
        keep.id,
      ]);
    }
    return { id: keep.id, name: keep.name, merged: true };
  }

  await sql.query(
    `update network_providers set name = $1, archived = false, last_updated = current_date, updated_at = now() where id = $2`,
    [next, id],
  );
  return { id, name: next, merged: false };
}
