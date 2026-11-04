/**
 * A .zip of files stored as they are (no compression: photos are JPEGs already), for Download all (11/4). The browser
 * builds it from the photos it fetched, so nothing large crosses the site's request limits. Names are UTF-8.
 * Pure: safe for node --test and the screens.
 */

export type ZipEntry = { name: string; data: Uint8Array<ArrayBuffer>; date?: Date };

/** The most a .zip without the ZIP64 extension holds. */
export const ZIP_MAX_ENTRIES = 65_535;
export const ZIP_MAX_BYTES = 0xffff_fffe;

let crcTable: Uint32Array | null = null;

/** CRC-32 (the .zip checksum, polynomial 0xEDB88320). */
export function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) crc = crcTable[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A date as a .zip stores it (MS-DOS time and date, local time; 1980 at the earliest). */
export function dosDateTime(date: Date): { time: number; date: number } {
  const d = Number.isNaN(date.getTime()) || date.getFullYear() < 1980 ? new Date(1980, 0, 1) : date;
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * The .zip of these files, in this order, as pieces: each file's header, the file itself (not copied), and the
 * directory at the end. A Blob made of them is the .zip, so the photos aren't copied into one big buffer first (a phone
 * downloading a big account's photos). Throws when it would need ZIP64 (over 65,535 files or 4 GB).
 */
export function zipParts(entries: ZipEntry[]): Uint8Array<ArrayBuffer>[] {
  if (entries.length > ZIP_MAX_ENTRIES) throw new Error("Too many files for one .zip.");
  const enc = new TextEncoder();
  const names = entries.map((e) => enc.encode(e.name));
  let total = 22;
  for (let i = 0; i < entries.length; i += 1) total += 30 + names[i]!.length + entries[i]!.data.length + 46 + names[i]!.length;
  if (total > ZIP_MAX_BYTES) throw new Error("Too much for one .zip.");
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const central: { offset: number; crc: number; when: { time: number; date: number } }[] = [];
  let offset = 0;
  // UTF-8 names (bit 11), stored (method 0), version 2.0.
  entries.forEach((e, i) => {
    const name = names[i]!;
    const crc = crc32(e.data);
    const when = dosDateTime(e.date ?? new Date());
    const head = new Uint8Array(30 + name.length);
    const v = new DataView(head.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x0800, true);
    v.setUint16(8, 0, true);
    v.setUint16(10, when.time, true);
    v.setUint16(12, when.date, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, e.data.length, true);
    v.setUint32(22, e.data.length, true);
    v.setUint16(26, name.length, true);
    v.setUint16(28, 0, true);
    head.set(name, 30);
    central.push({ offset, crc, when });
    parts.push(head, e.data);
    offset += head.length + e.data.length;
  });
  const dirSize = names.reduce((n, name) => n + 46 + name.length, 0);
  const tail = new Uint8Array(dirSize + 22);
  const view = new DataView(tail.buffer);
  let at = 0;
  const u16 = (val: number) => {
    view.setUint16(at, val, true);
    at += 2;
  };
  const u32 = (val: number) => {
    view.setUint32(at, val >>> 0, true);
    at += 4;
  };
  entries.forEach((e, i) => {
    const name = names[i]!;
    const c = central[i]!;
    u32(0x02014b50);
    u16(20);
    u16(20);
    u16(0x0800);
    u16(0);
    u16(c.when.time);
    u16(c.when.date);
    u32(c.crc);
    u32(e.data.length);
    u32(e.data.length);
    u16(name.length);
    u16(0);
    u16(0);
    u16(0);
    u16(0);
    u32(0);
    u32(c.offset);
    tail.set(name, at);
    at += name.length;
  });
  u32(0x06054b50);
  u16(0);
  u16(0);
  u16(entries.length);
  u16(entries.length);
  u32(dirSize);
  u32(offset);
  u16(0);
  parts.push(tail);
  return parts;
}

/** The same .zip in one piece. */
export function zipStore(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const parts = zipParts(entries);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
