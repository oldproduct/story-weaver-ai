/**
 * Script control tags like "(voice: Riya)" select which voice speaks a block.
 * They are metadata only and must never reach the speech engine.
 */

export const VOICE_TAG_REGEX = /^\s*\(\s*voice\s*:\s*([^)]+?)\s*\)\s*/i;
/** Same tag, anywhere in the text (used for cleanup and leak checks). */
const TAG_SOURCE = String.raw`\(\s*(?:voice|speaker)\s*:\s*[^)]*\)`;
export const VOICE_TAG_ANYWHERE = () => new RegExp(TAG_SOURCE, "gi");
const TAG_TEST = new RegExp(TAG_SOURCE, "i");

export const FORBIDDEN_METADATA = ["(voice:", "voice:", "speaker:", "(speaker:"];

/** True when a paragraph is nothing but a voice tag. */
export function isVoiceTagOnly(text: string): boolean {
  return stripVoiceTags(text).length === 0 && VOICE_TAG_REGEX.test(text.normalize("NFC"));
}

/** Speaker name from a leading voice tag, or null. */
export function voiceTagName(text: string): string | null {
  const m = VOICE_TAG_REGEX.exec(text.normalize("NFC"));
  const name = m?.[1]?.trim();
  return name ? name : null;
}

/** Remove every voice/speaker tag and collapse whitespace. */
export function stripVoiceTags(text: string): string {
  return text
    .normalize("NFC")
    .replace(VOICE_TAG_ANYWHERE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SpeechBlock {
  speaker: string;
  voiceId: string;
  text: string;
}

export function parseSpeechBlock(
  rawText: string,
  voiceMap: Record<string, string>,
): SpeechBlock | null {
  const normalized = rawText.normalize("NFC");
  const speaker = voiceTagName(normalized);
  if (!speaker) return null;
  const voiceId = voiceMap[speaker.toLowerCase()];
  const text = stripVoiceTags(normalized);
  if (!voiceId || !text) return null;
  return { speaker, voiceId, text };
}

/** Last line of defence before a speech request goes out. */
export function assertSpeakableText(text: string): string {
  const lower = text.toLowerCase();
  if (VOICE_TAG_ANYWHERE.test(text) || FORBIDDEN_METADATA.some((m) => lower.includes(m))) {
    throw new Error("Voice metadata leaked into TTS text");
  }
  return text;
}
