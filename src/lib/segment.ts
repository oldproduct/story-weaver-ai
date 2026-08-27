import { uid } from "./id";
import type { Chapter, Segment } from "./types";

const OPEN = ["\u201c", '"', "\u2018", "\u00ab"];
const CLOSE: Record<string, string> = {
  "\u201c": "\u201d",
  '"': '"',
  "\u2018": "\u2019",
  "\u00ab": "\u00bb",
};

interface Span {
  kind: "narration" | "dialogue";
  text: string;
}

/** Split a paragraph into alternating narration / quoted-dialogue spans. */
export function splitParagraph(paragraph: string): Span[] {
  const spans: Span[] = [];
  let buffer = "";
  let i = 0;
  while (i < paragraph.length) {
    const ch = paragraph[i] ?? "";
    if (OPEN.includes(ch)) {
      const closer = CLOSE[ch] ?? '"';
      let end = paragraph.indexOf(closer, i + 1);
      if (ch === '"' && end === i) end = paragraph.indexOf(closer, i + 2);
      if (end > i) {
        const inner = paragraph.slice(i + 1, end).trim();
        if (inner.length > 1) {
          if (buffer.trim()) spans.push({ kind: "narration", text: buffer.trim() });
          buffer = "";
          spans.push({ kind: "dialogue", text: inner });
          i = end + 1;
          continue;
        }
      }
    }
    buffer += ch;
    i += 1;
  }
  if (buffer.trim()) spans.push({ kind: "narration", text: buffer.trim() });
  return spans;
}

/** Strip leading dialogue-tag fragments that read badly as standalone narration. */
function tidyNarration(text: string): string {
  return text.replace(/^[,;:]\s*/, "").replace(/\s+([,.;:!?])/g, "$1").trim();
}

export function buildSegments(chapters: Chapter[]): Segment[] {
  const segments: Segment[] = [];
  let order = 0;
  for (const chapter of chapters) {
    for (const paragraph of chapter.paragraphs) {
      for (const span of splitParagraph(paragraph)) {
        const text = span.kind === "narration" ? tidyNarration(span.text) : span.text.trim();
        if (!text || !/[A-Za-z0-9]/.test(text)) continue;
        segments.push({
          id: uid("seg"),
          chapterId: chapter.id,
          order: order++,
          kind: span.kind,
          text,
          context: paragraph.slice(0, 600),
          speakerId: span.kind === "narration" ? "narrator" : null,
          confidence: span.kind === "narration" ? 1 : 0,
        });
      }
    }
  }
  return segments;
}

export function estimateMinutes(words: number): number {
  return words / 155;
}
