/** Install board: the Tech Request Form. Pure — safe for node --test. */

/** What the rep on the account reads when a tech is assigned to their install. */
export function techRequestPing(tech: string, account: string): string {
  return `${tech.trim()} is assigned to the ${account.trim()} install. You are good to issue the Tech Request Form.`;
}
