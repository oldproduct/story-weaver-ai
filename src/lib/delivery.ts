import type { CharacterProfile, EmotionType, LineSpeed, Segment } from "./types";

export const MIN_SPEED = 0.7;
export const MAX_SPEED = 1.2;

export const EMOTIONS: EmotionType[] = [
  "neutral",
  "whispering",
  "angry",
  "sad",
  "crying",
  "laughing",
  "excited",
  "scared",
  "stern",
  "flirty",
  "sarcastic",
];

export const EMOTION_PROFILES: Record<
  EmotionType,
  { stability: number; style: number; speedDelta: number }
> = {
  neutral: { stability: 0.55, style: 0.15, speedDelta: 0 },
  whispering: { stability: 0.65, style: 0.1, speedDelta: -0.04 },
  angry: { stability: 0.45, style: 0.35, speedDelta: 0.04 },
  sad: { stability: 0.6, style: 0.25, speedDelta: -0.05 },
  crying: { stability: 0.45, style: 0.35, speedDelta: -0.06 },
  laughing: { stability: 0.45, style: 0.3, speedDelta: 0.02 },
  excited: { stability: 0.45, style: 0.35, speedDelta: 0.04 },
  scared: { stability: 0.45, style: 0.3, speedDelta: 0.04 },
  stern: { stability: 0.65, style: 0.25, speedDelta: -0.02 },
  flirty: { stability: 0.55, style: 0.3, speedDelta: -0.02 },
  sarcastic: { stability: 0.55, style: 0.3, speedDelta: 0 },
};

const LEGACY_LINE_SPEED: Record<string, number> = { slower: 0.9, normal: 1, faster: 1.1 };
export const LINE_SPEEDS = [0.75, 0.8, 1, 1.25, 1.5];
export function lineSpeedValue(v: LineSpeed | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return LEGACY_LINE_SPEED[v ?? "normal"] ?? 1;
}

export function clampSpeed(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.round(Math.max(MIN_SPEED, Math.min(MAX_SPEED, n)) * 100) / 100;
}

export function speedLabel(n: number): string {
  if (n <= 0.85) return "Slow";
  if (n < 0.97) return "Relaxed";
  if (n <= 1.03) return "Normal";
  if (n < 1.12) return "Brisk";
  return "Fast";
}

/** Speaker speed × overall pace, nudged by emotion and per-line override, clamped. */
export function effectiveSpeed(
  character: Pick<CharacterProfile, "speed"> | undefined,
  seg: Pick<Segment, "speed" | "emotion">,
  globalSpeed = 1,
): number {
  const base = (character?.speed ?? 1) * (globalSpeed || 1) * lineSpeedValue(seg.speed);
  const emo = EMOTION_PROFILES[seg.emotion ?? "neutral"]?.speedDelta ?? 0;
  return clampSpeed(base + emo);
}

export const EMOTION_TAGS: Record<EmotionType, string | null> = {
  neutral: null,
  whispering: "[whispers]",
  angry: "[angry]",
  sad: "[sad]",
  crying: "[crying]",
  laughing: "[laughs]",
  excited: "[excited]",
  scared: "[nervous]",
  stern: "[serious]",
  flirty: "[flirtatious]",
  sarcastic: "[sarcastic]",
};
export const ALLOWED_TAGS = Object.values(EMOTION_TAGS).filter((t): t is string => !!t);
export type TtsModel = "eleven_v3" | "eleven_multilingual_v2";

/** Emotional lines go to the expressive model with a bracket cue; neutral stays on v2. */
export function deliveryFor(seg: Pick<Segment, "emotion">): { model: TtsModel; tag: string | null } {
  const tag = EMOTION_TAGS[seg.emotion ?? "neutral"] ?? null;
  return tag ? { model: "eleven_v3", tag } : { model: "eleven_multilingual_v2", tag: null };
}

export function voiceSettingsFor(seg: Pick<Segment, "emotion">) {
  const p = EMOTION_PROFILES[seg.emotion ?? "neutral"] ?? EMOTION_PROFILES.neutral;
  return { stability: p.stability, style: p.style };
}

/** Add an ending mark so the voice lands the sentence instead of trailing off. */
export function ensureTerminalPunctuation(text: string): string {
  const t = text.trim();
  if (!t) return t;
  if (/[.!?।॥…"'”’»)\]]$/u.test(t)) return t;
  const devanagari = /[\u0900-\u097F]/.test(t);
  return t + (devanagari ? "।" : ".");
}

/** Pause after a clip, based on how its text ends. Dialogue turns stay < 200ms. */
export function pauseAfter(
  text: string,
  opts: { dialogueTurn?: boolean; paragraphEnd?: boolean; jitter?: () => number } = {},
): number {
  const rand = opts.jitter ?? Math.random;
  const vary = (ms: number) => Math.round(ms * (0.85 + rand() * 0.3));
  if (opts.dialogueTurn) return Math.min(190, vary(150));
  const t = text.trim();
  let base = 300;
  if (/[?!]["'”’»)]*$/u.test(t)) base = 350;
  else if (/[,;:—–-]["'”’»)]*$/u.test(t)) base = 120;
  else if (/(\.\.\.|…)["'”’»)]*$/u.test(t)) base = 450;
  if (opts.paragraphEnd) base = Math.max(base, 600);
  return vary(base);
}

export const CHAPTER_PAUSE = 1500;
