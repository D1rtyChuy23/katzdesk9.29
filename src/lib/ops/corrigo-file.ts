/**
 * Browser-only: read a Corrigo export (xlsx or csv) here so the file never goes to the server, whose
 * requests Vercel caps at ~4.5 MB. SheetJS loads on demand to stay out of the main bundle (like pdf-text.ts).
 */
import { parseCorrigoMatrix, stringifyCell, type CorrigoParse } from "./corrigo.ts";

const MAX_CORRIGO_FILE_BYTES = 40 * 1024 * 1024;

type SheetJs = typeof import("xlsx");

function workbookToMatrix(XLSX: SheetJs, wb: import("xlsx").WorkBook): string[][] {
  const name = wb.SheetNames[0];
  const sheet = name ? wb.Sheets[name] : undefined;
  if (!sheet) throw new Error("The file has no sheets.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", blankrows: false });
  return matrix.map((row) => (row ?? []).map(stringifyCell));
}

export function parseCorrigoBytes(XLSX: SheetJs, bytes: ArrayBuffer | Uint8Array): CorrigoParse {
  const wb = XLSX.read(bytes, { type: "array", cellDates: true });
  return parseCorrigoMatrix(workbookToMatrix(XLSX, wb));
}

export async function readCorrigoFile(file: File): Promise<CorrigoParse> {
  if (file.size > MAX_CORRIGO_FILE_BYTES) throw new Error("That file is over 40 MB. Export a shorter date range.");
  let XLSX: SheetJs;
  try {
    XLSX = await import("xlsx");
  } catch {
    throw new Error("KatzDesk was updated. Reload the page, then import again.");
  }
  return parseCorrigoBytes(XLSX, await file.arrayBuffer());
}
