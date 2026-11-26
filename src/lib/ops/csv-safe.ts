/**
 * Text a spreadsheet would run as a formula when a CSV is opened in Excel, Numbers or Google Sheets: a cell that starts
 * with "=", "+", "@", a tab or a carriage return, or with "-" unless it is a plain number ("-12.5" stays a number;
 * "-2+HYPERLINK(…)" does not). Such a cell gets a leading apostrophe, which keeps it text. Every CSV the desk writes goes
 * through this one rule (11/26: the writers each had their own, and several let "-2+…", a tab or a return through).
 * Pure: safe for node --test and the screens.
 */
export function spreadsheetText(s: string): string {
  if (/^[=+@\t\r]/.test(s)) return `'${s}`;
  if (s.length > 1 && s.startsWith("-") && !/^-\d+(\.\d+)?$/.test(s)) return `'${s}`;
  return s;
}

/** A CSV cell: made safe as above, then quoted when it holds a quote, comma or line break. */
export function safeCsvCell(v: unknown): string {
  const s = spreadsheetText(v == null ? "" : String(v));
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
