/** @username tokens in a ping or handoff note. */
export function parseMentions(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const re = /@([a-zA-Z0-9._-]{2,32})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const name = m[1]!.toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    found.push(m[1]!);
  }
  return found;
}

export function mentionFragment(text: string): string | null {
  const m = text.match(/(^|\s)@([a-zA-Z0-9._-]{0,32})$/);
  return m ? m[2]! : null;
}

export function applyMention(text: string, username: string): string {
  if (/(^|\s)@([a-zA-Z0-9._-]{0,32})$/.test(text)) {
    return text.replace(/(^|\s)@([a-zA-Z0-9._-]{0,32})$/, `$1@${username} `);
  }
  const pad = text && !text.endsWith(" ") ? " " : "";
  return `${text}${pad}@${username} `;
}
