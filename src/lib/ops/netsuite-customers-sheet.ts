/**
 * Reading a NetSuite customer export (CSV, XLSX or XLS) into cells, every cell as text. Server-only (it loads xlsx).
 *
 * IDs stay text: a CSV is read without converting values, so "00123" keeps its zeros; in a sheet, a number cell gives
 * the digits Excel shows ("00123" with a zero-padded format), and a whole number never comes back as "1.2E+11".
 */
import * as XLSX from "xlsx";

/** A sheet cell as the text the person sees, with whole numbers written out in full. */
function cellText(cell: XLSX.CellObject | undefined): string {
  if (!cell || cell.v == null) return "";
  if (cell.t === "n" && typeof cell.v === "number") {
    const shown = cell.w != null ? String(cell.w) : "";
    if (shown && !/e[+-]?\d+$/i.test(shown)) return shown;
    if (Number.isInteger(cell.v)) return BigInt(cell.v).toString();
    return shown || String(cell.v);
  }
  if (cell.t === "b") return cell.v ? "TRUE" : "FALSE";
  return String(cell.w ?? cell.v);
}

/** The file's first sheet as rows of text cells. A CSV is read as UTF-8, so names like "Café" stay as written. */
export function matrixFromBase64(base64: string): string[][] {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length) throw new Error("The file is empty.");
  // XLSX files are zip archives ("PK"); old XLS files start D0 CF 11 E0. Anything else is read as CSV text.
  const isSheet = (bytes[0] === 0x50 && bytes[1] === 0x4b) || (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0);
  const wb = isSheet
    ? XLSX.read(bytes, { type: "buffer", cellText: true, cellDates: false })
    : XLSX.read(bytes.toString("utf8").replace(/^\uFEFF/, ""), { type: "string", raw: true, cellText: true });
  const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
  if (!sheet || !sheet["!ref"]) throw new Error("The file is empty.");
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const out: string[][] = [];
  // From row 1 even when the sheet's data starts lower, so a line number is the row Excel shows.
  for (let r = 0; r <= range.e.r; r++) {
    const row: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) row.push(cellText(sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined));
    out.push(row);
  }
  return out;
}
