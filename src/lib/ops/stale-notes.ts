const norm = (v: string | null | undefined) => String(v ?? "").replace(/\r\n?/g, "\n");

/**
 * The notes a window's save stores when the notes changed on the server after the window loaded them (`base`): a
 * ticket merged into the install adds its text under them (10/30), or another window saved. The window that didn't touch
 * them leaves the server's; one that did keeps its own text, then what the server added after it, when the server only
 * added to the end. Anything else is the window's, as before.
 */
export function notesAfterStaleSave(stored: string | null, base: string | null, sent: string | null): string | null {
  const s = norm(stored);
  const b = norm(base);
  const t = norm(sent);
  if (s === b) return sent;
  if (t === b) return stored;
  if (!s.startsWith(b)) return sent;
  const added = s.slice(b.length).replace(/^\s+/, "");
  if (!added) return sent;
  const own = t.replace(/\s+$/, "");
  return own ? `${own}\n\n${added}` : added;
}
