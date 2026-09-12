import { uid } from "./id";
import type { Chapter, Segment } from "./types";

export interface ParseResult {
  segments: Segment[];
  detectedSpeakers: string[];
  spokenCount: number;
  skippedCount: number;
  unknownVoices: string[];
}

export function normalizeText(raw: string): string {
  let t = raw.normalize("NFC");
  t = t.replace(/\*\*/g, ""); // Markdown bold
  t = t.replace(/^\||\|$/g, ""); // Isolated pipes at boundaries
  t = t.replace(/\|/g, "।"); // Replace remaining pipes with Hindi danda
  t = t.replace(/[\u200B-\u200F\uFEFF]/g, ""); // Remove zero-width formatting characters
  t = t.replace(/\s+/g, " "); // Collapse whitespace
  t = t.trim();
  return t;
}

const VOICE_MARKER_RE = /\(\s*voice\s*:\s*([^)]+)\)/gi;
const STANDALONE_DIRECTION_RE = /^\s*\(([^)]+)\)\s*$/;
const INLINE_DIRECTION_RE = /\(([^)]+)\)/g;

export function parseScript(chapters: Chapter[], narrateStageDirections: boolean): ParseResult {
  const segments: Segment[] = [];
  const detectedSpeakers = new Set<string>();
  let activeVoice: string | null = null;
  let order = 0;
  let spokenCount = 0;
  let skippedCount = 0;

  for (const chapter of chapters) {
    for (const rawParagraph of chapter.paragraphs) {
      let paragraph = rawParagraph;
      let paragraphActiveVoice = activeVoice;
      let scriptSpeaker: string | undefined = undefined;

      // Extract and remove voice markers
      const matches = [...paragraph.matchAll(VOICE_MARKER_RE)];
      if (matches.length > 0) {
        for (const match of matches) {
          const voiceName = match[1]?.trim() ?? "";
          if (voiceName) {
            activeVoice = voiceName;
            detectedSpeakers.add(voiceName);
            scriptSpeaker = voiceName;
            paragraphActiveVoice = voiceName;
          }
        }
        paragraph = paragraph.replace(VOICE_MARKER_RE, "").trim();
      }

      // If nothing remains after removing voice markers, skip
      if (!paragraph) continue;

      // Check if it's a standalone stage direction
      const standaloneMatch = paragraph.match(STANDALONE_DIRECTION_RE);
      if (standaloneMatch) {
        const text = standaloneMatch[1]!.trim();
        const cleaned = normalizeText(text);
        if (!cleaned || !/[\p{L}\p{N}]/u.test(cleaned)) continue;

        segments.push({
          id: uid("seg"),
          chapterId: chapter.id,
          order: order++,
          kind: "stage_direction",
          text: cleaned,
          context: rawParagraph.slice(0, 600),
          speakerId: "narrator",
          confidence: 1,
          speak: narrateStageDirections,
        });
        
        if (narrateStageDirections) spokenCount++;
        else skippedCount++;
        
        continue;
      }

      // Not standalone. Strip inline stage directions.
      // E.g. "(मुस्कराकर) यह आपकी कृपा..." -> "यह आपकी कृपा..."
      const cleanedDialogue = normalizeText(paragraph.replace(INLINE_DIRECTION_RE, ""));
      
      if (!cleanedDialogue || !/[\p{L}\p{N}]/u.test(cleanedDialogue)) continue;

      segments.push({
        id: uid("seg"),
        chapterId: chapter.id,
        order: order++,
        kind: "dialogue",
        text: cleanedDialogue,
        context: rawParagraph.slice(0, 600),
        speakerId: paragraphActiveVoice ? null : "narrator", // Will map properly in voices.ts
        confidence: 1,
        speak: true,
        scriptSpeaker: paragraphActiveVoice ?? undefined,
      });
      spokenCount++;
    }
  }

  return {
    segments,
    detectedSpeakers: Array.from(detectedSpeakers),
    spokenCount,
    skippedCount,
    unknownVoices: [], // This will be populated after voice mapping
  };
}
