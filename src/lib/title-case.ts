/**
 * Title-case a UI heading: "Equipment by location" → "Equipment By Location", "Pre-inspection" → "Pre-Inspection".
 * Only for fixed headings and labels — never customer names, serials, or text people typed.
 * Keeps words that are already capitalized (PMs, TLC, e'4 model codes) as they are.
 */
export function titleCase(text: string): string {
  return text.replace(/[A-Za-zÀ-ɏ][\wÀ-ɏ'’.]*/g, (word, offset: number, whole: string) => {
    // Eversys model codes (e'4, c'2s, l'2m) and units like "x" in "2x" stay lowercase.
    if (/^[a-z]['’]\d/.test(word)) return word;
    if (/^(vs|w|e\.g|i\.e)\.?$/.test(word)) return word;
    // Keep "a.m." style tokens and words glued to a digit before them ("2x").
    if (offset > 0 && /\d/.test(whole[offset - 1] ?? "")) return word;
    const first = word[0]!;
    if (first !== first.toLowerCase()) return word;
    return first.toUpperCase() + word.slice(1);
  });
}
