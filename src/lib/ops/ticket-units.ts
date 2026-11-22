/**
 * Ticket-to-machine link rules shared by every path that moves a ticket (11/21). No server functions here, so imports
 * and saves can use it.
 */
import type { Sql } from "@/lib/db";

/**
 * A ticket moved off an account drops the machines it named there: the desk's Save, the Corrigo import. A machine that
 * moved to another account itself keeps its tickets, since its history is the machine's.
 */
export async function dropOffAccountTicketUnits(sql: Sql, jobId: number, oldCustomer: string | null): Promise<void> {
  await sql.query(
    `delete from ticket_units t using account_equipment a, service_jobs j
      where t.job_id = $1 and j.id = t.job_id and a.id = t.account_equipment_id
        and lower(btrim(a.customer)) = lower(btrim(coalesce($2::text, '')))
        and lower(btrim(a.customer)) <> lower(btrim(coalesce(j.customer, '')))`,
    [jobId, oldCustomer],
  );
}
