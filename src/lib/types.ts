export type SegmentKind = "narration" | "dialogue";

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

export type Stage = "upload" | "analyze" | "cast" | "generate" | "listen";

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
}

export const SUPPORTING_ID = "supporting-pool";
