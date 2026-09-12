export type SegmentKind = "narration" | "dialogue" | "stage_direction";

export interface Segment {
  id: string;
  chapterId: string;
  order: number;
  kind: SegmentKind;
  /** Text to be spoken. */
  text: string;
  /** Raw surrounding paragraph, used as context for the AI. */
  context: string;
  /** Canonical character id once analysis has run. */
  speakerId: string | null;
  confidence: number;
  /** Raw speaker name returned by the AI, before alias merging. */
  rawSpeaker?: string;
  /** Speaker name detected from the text itself (script format "NAME: line"). */
  hint?: string;
  /** True when the user set this speaker by hand — auto-detect must not overwrite it. */
  manual?: boolean;
  /** Whether this segment should be synthesized by TTS. */
  speak?: boolean;
  /** The raw voice marker name found in the document (e.g. "Amitabh"). */
  scriptSpeaker?: string;
}

export interface Chapter {
  id: string;
  index: number;
  title: string;
  paragraphs: string[];
  wordCount: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
  aliases: string[];
  gender: "male" | "female" | "unknown";
  ageRange: string;
  description: string;
  isNarrator: boolean;
  lineCount: number;
  wordCount: number;
  firstChapter: number;
  /** "lead" gets its own voice, "supporting" shares a pooled voice. */
  role: "narrator" | "lead" | "supporting";
  voiceId: string | null;
  instructions: string;
}

export interface ClipRef {
  segmentId: string;
  /** Cache key derived from text + voice + instructions. */
  key: string;
  durationMs: number;
}

export type Stage = "upload" | "analyze" | "cast" | "review" | "preview" | "generate" | "listen";

export interface ProjectState {
  id: string;
  fileName: string;
  stage: Stage;
  chapters: Chapter[];
  segments: Segment[];
  characters: CharacterProfile[];
  sharedVoiceId: string | null;
  clips: Record<string, ClipRef>;
  createdAt: number;
  /** Whether to narrate stage directions using the narrator voice. */
  narrateStageDirections?: boolean;
  /** Map of lowercase speaker name to ElevenLabs voice ID (used in script mode). */
  voiceMap?: Record<string, string>;
  /** List of voice names found in the script that have no mapping. */
  unknownVoices?: string[];
}

export const SUPPORTING_ID = "supporting-pool";
