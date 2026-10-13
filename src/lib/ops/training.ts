/**
 * The Library — Education And Training. Training material by topic, kept apart from the model books.
 * Pure: no DOM, safe for node --test.
 */
import { MAX_FILE_BYTES, fileExt, mimeFor, sizeText } from "./library-file-rules.ts";

export const TRAINING_TOPICS = [
  { key: "water-specs", label: "Water Specs" },
  { key: "coffee-101", label: "Coffee 101" },
  { key: "barista-101", label: "Barista 101" },
  { key: "latte-art", label: "Latte Art" },
  { key: "cleaning", label: "Importance Of Cleaning" },
] as const;

export type TrainingTopic = (typeof TRAINING_TOPICS)[number]["key"];

export const TRAINING_TITLE = "Education And Training";

export const isTrainingTopic = (v: unknown): v is TrainingTopic => TRAINING_TOPICS.some((t) => t.key === v);

export function topicLabel(key: string | null | undefined): string {
  return TRAINING_TOPICS.find((t) => t.key === key)?.label ?? "";
}

// Training decks are often slides, so PowerPoint is accepted here on top of what a model book takes.
const SLIDES: Record<string, string> = {
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export const TRAINING_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.ppt,.pptx";
export const TRAINING_ALLOWED_TEXT = "PDF, images (PNG, JPG, WebP, GIF), Word (DOC, DOCX) and PowerPoint (PPT, PPTX)";

export function trainingMime(name: string): string | null {
  return mimeFor(name) ?? SLIDES[fileExt(name)] ?? null;
}

/** null when the file is fine, otherwise a sentence to show the person. */
export function trainingFileError(name: string, size: number): string | null {
  const clean = name.trim();
  if (!clean) return "That file has no name.";
  if (!trainingMime(clean)) return `${clean} can't be added. Only ${TRAINING_ALLOWED_TEXT} are accepted.`;
  if (size <= 0) return `${clean} is empty.`;
  if (size > MAX_FILE_BYTES) return `${clean} is too big (${sizeText(size)}). The limit is ${sizeText(MAX_FILE_BYTES)} per file.`;
  return null;
}

/**
 * A training file keeps the name it was dropped with: it is never renamed after a machine. A second file with the
 * same name in the same topic gets " (2)" so neither hides the other.
 */
export function trainingFileName(original: string, taken: string[]): string {
  const clean = original.replace(/\s+/g, " ").trim();
  const have = new Set(taken.map((t) => t.trim().toLowerCase()));
  if (!have.has(clean.toLowerCase())) return clean;
  const ext = fileExt(clean);
  const stem = ext ? clean.slice(0, -(ext.length + 1)) : clean;
  for (let n = 2; n < 500; n++) {
    const next = `${stem} (${n})${ext ? `.${ext}` : ""}`;
    if (!have.has(next.toLowerCase())) return next;
  }
  return clean;
}

export type TrainingFileRef = { topic: string };

/** Files per topic, in topic order, so every topic shows even with nothing in it yet. */
export function countByTopic(files: TrainingFileRef[]): { key: TrainingTopic; label: string; count: number }[] {
  return TRAINING_TOPICS.map((t) => ({ key: t.key, label: t.label, count: files.filter((f) => f.topic === t.key).length }));
}
