import { parseScript } from "./parser";
import { uid } from "./id";
import type { Chapter, Segment } from "./types";

const OPEN = ["\u201c", '"', "\u2018", "\u00ab", "\u201a", "\u201e"];
const CLOSE: Record<string, string> = {
  "\u201c": "\u201d",
  '"': '"',
  "\u2018": "\u2019",
  "\u00ab": "\u00bb",
  "\u201a": "\u2018",
  "\u201e": "\u201c",
};

interface Span {
  kind: "narration" | "dialogue";
  text: string;
  hint?: string;
}

/** "RAM:", "MRS. RAO —", "मीरा:" at the start of a line marks a script speech. */
const SCRIPT_RE =
  /^\s*([\p{Lu}\p{Lo}][\p{L}\p{M}\p{N}.'\- ]{0,38}?)\s*(?::|\u2014|\u2013|--)\s+(\S[\s\S]*)$/u;
/** A line that opens with a dash is spoken dialogue in many books. */
const DASH_RE = /^\s*(?:\u2014|\u2013|-{1,2})\s+(\S[\s\S]*)$/;

function scriptSpan(paragraph: string): Span[] | null {
  const m = SCRIPT_RE.exec(paragraph.trim());
  if (!m) return null;
  const name = (m[1] ?? "").trim();
  const body = (m[2] ?? "").trim();
  if (!name || !body) return null;
  // Reject sentence-like prefixes ("He said: ...") — real cues are short.
  const words = name.split(/\s+/);
  if (words.length > 4 || name.length > 40) return null;
  // "He said: ..." is prose, not a cue — every word of a cue starts capitalised.
  if (words.some((w) => /^\p{Ll}/u.test(w))) return null;
  return [{ kind: "dialogue", text: body, hint: name }];
}

/** Split a paragraph into alternating narration / quoted-dialogue spans. */
export function splitParagraph(paragraph: string): Span[] {
  const script = scriptSpan(paragraph);
  if (script) return script;
  const dash = DASH_RE.exec(paragraph.trim());
  if (dash?.[1] && !/["\u201c\u2018]/.test(paragraph)) {
    return [{ kind: "dialogue", text: dash[1].trim() }];
  }
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

export function hasVoiceMarkers(chapters: Chapter[]): boolean {
  for (const c of chapters) {
    for (const p of c.paragraphs) {
      if (/\(\s*voice\s*:\s*([^)]+)\)/i.test(p)) return true;
    }
  }
  return false;
}

export function buildSegments(chapters: Chapter[]): Segment[] {
  if (hasVoiceMarkers(chapters)) {
    return parseScript(chapters, false).segments;
  }

  const segments: Segment[] = [];
  let order = 0;
  for (const chapter of chapters) {
    for (const paragraph of chapter.paragraphs) {
      for (const span of splitParagraph(paragraph)) {
        const text = span.kind === "narration" ? tidyNarration(span.text) : span.text.trim();
        if (!text || !/[\p{L}\p{N}]/u.test(text)) continue;
        segments.push({
          id: uid("seg"),
          chapterId: chapter.id,
          order: order++,
          kind: span.kind,
          text,
          context: paragraph.slice(0, 600),
          speakerId: span.kind === "narration" ? "narrator" : null,
          confidence: span.kind === "narration" ? 1 : 0,
          ...(span.hint ? { hint: span.hint } : {}),
          speak: true,
        });
      }
    }
  }
  return segments;
}

export function estimateMinutes(words: number): number {
  return words / 155;
}
