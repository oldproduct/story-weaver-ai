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
  neutral: { stability: 0.5, style: 0.3, speedDelta: 0 },
  whispering: { stability: 0.75, style: 0.15, speedDelta: -0.05 },
  angry: { stability: 0.3, style: 0.7, speedDelta: 0.05 },
  sad: { stability: 0.6, style: 0.45, speedDelta: -0.08 },
  crying: { stability: 0.3, style: 0.65, speedDelta: -0.1 },
  laughing: { stability: 0.35, style: 0.6, speedDelta: 0.03 },
  excited: { stability: 0.35, style: 0.65, speedDelta: 0.07 },
  scared: { stability: 0.3, style: 0.55, speedDelta: 0.06 },
  stern: { stability: 0.7, style: 0.4, speedDelta: -0.03 },
  flirty: { stability: 0.45, style: 0.55, speedDelta: -0.03 },
  sarcastic: { stability: 0.45, style: 0.55, speedDelta: 0 },
};

const LINE_SPEED_DELTA: Record<LineSpeed, number> = { slower: -0.1, normal: 0, faster: 0.1 };

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
  const base = (character?.speed ?? 1) * (globalSpeed || 1);
  const emo = EMOTION_PROFILES[seg.emotion ?? "neutral"]?.speedDelta ?? 0;
  const line = LINE_SPEED_DELTA[seg.speed ?? "normal"] ?? 0;
  return clampSpeed(base + emo + line);
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
