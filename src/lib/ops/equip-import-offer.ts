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
};

export function addInsteadOffer(row: OfferRow, draft: { customer: string; catalogModel: string }): { offer: boolean; hint: { on: string; off: string } } {
  const none = { offer: false, hint: { on: "", off: "" } };
  if (!row.serial?.trim() || row.lockedNote || row.foreignAccount || row.action === "skip") return none;
  const same = (a: string | null, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();
  const asPreviewed = same(row.customer, draft.customer) && same(row.catalogModel, draft.catalogModel);
  if (row.fillBlank && asPreviewed) {
    const name = row.fillBlank.name || "the unit with no serial";
    return { offer: true, hint: { on: `Adds it on its own; ${name} stays as it is.`, off: `Otherwise its serial fills ${name}, which has none.` } };
  }
  if (asPreviewed && row.action !== "review") return none;
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
