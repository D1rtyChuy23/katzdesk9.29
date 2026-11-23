/**
 * When the Equipment import's preview offers "Add as new unit instead" (Chuy, 11/23), and what its hint says. Pure:
 * the screen uses it, and the server decides for itself (it adds the row only where it still finds a serial-less unit
 * to fill). Offered on any row with a serial whose match the preview couldn't settle: one that fills a blank unit, one
 * that needed review (no model or account yet), or one whose account or model has been changed on the screen.
 */
export type OfferRow = {
  serial: string | null;
  customer: string | null;
  catalogModel: string | null;
  action: "add" | "update" | "review" | "skip";
  lockedNote?: string | null;
  foreignAccount?: string | null;
  fillBlank?: { id: number; name: string } | null;
  /** A serial-less unit an earlier row of the file fills; this row would fill it if that row doesn't (11/23). */
  fillBlankIf?: { id: number; name: string } | null;
  /** The earlier row of the file whose added unit this row joins (11/23). */
  foldsInto?: string | null;
};

/** The row's account and model as the preview matched them (not changed on the screen). */
export function asPreviewed(row: { customer: string | null; catalogModel: string | null }, draft: { customer: string; catalogModel: string }): boolean {
  const same = (a: string | null, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
  return same(row.customer, draft.customer) && same(row.catalogModel, draft.catalogModel);
}

/**
 * `earlierRowGoes`: for a row that joins an earlier row's unit, whether that row is ticked on the screen (11/23, found
 * live after #188). Unticked, nothing is filled, so the hint says the row is added on its own. Text only: whether the
 * box is offered, and what the save does, don't change.
 */
export function addInsteadOffer(
  row: OfferRow,
  draft: { customer: string; catalogModel: string },
  opts: { earlierRowGoes?: boolean } = {},
): { offer: boolean; hint: { on: string; off: string } } {
  const none = { offer: false, hint: { on: "", off: "" } };
  if (!row.serial?.trim() || row.lockedNote || row.foreignAccount || row.action === "skip") return none;
  const previewed = asPreviewed(row, draft);
  if (row.fillBlank && previewed && row.foldsInto && opts.earlierRowGoes === false) {
    const alone = "The earlier row isn't imported, so this row is added on its own.";
    return { offer: true, hint: { on: alone, off: alone } };
  }
  if (row.fillBlank && previewed) {
    const name = row.fillBlank.name || "the unit with no serial";
    return { offer: true, hint: { on: `Adds it on its own; ${name} stays as it is.`, off: `Otherwise its serial fills ${name}, which has none.` } };
  }
  if (row.fillBlankIf && previewed && row.action === "add") {
    const name = row.fillBlankIf.name || "the unit with no serial";
    return { offer: true, hint: { on: `Adds it on its own, whatever the earlier row does; ${name} stays as it is.`, off: `If the earlier row doesn't take ${name}, this row's serial fills it.` } };
  }
  if (previewed && row.action !== "review") return none;
  const model = draft.catalogModel.trim() || "this model";
  const account = draft.customer.trim() || "the account";
  return {
    offer: true,
    hint: {
      on: `Adds it on its own, even if ${account} has a ${model} with no serial.`,
      off: `If ${account} has a ${model} with no serial, its serial fills that unit.`,
    },
  };
}
