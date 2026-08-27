export interface VoiceOption {
  id: string;
  label: string;
  gender: "male" | "female" | "neutral";
  blurb: string;
}

/**
 * Voice catalogue for the narration engine. The engine is pluggable — these ids
 * map to the current TTS provider handled server-side in tts.functions.ts.
 */
export const VOICES: VoiceOption[] = [
  { id: "alloy", label: "Alloy", gender: "neutral", blurb: "Even, unhurried, dependable narrator" },
  { id: "ash", label: "Ash", gender: "male", blurb: "Dry, gravelly, world-weary" },
  { id: "ballad", label: "Ballad", gender: "male", blurb: "Warm storyteller with lift" },
  { id: "coral", label: "Coral", gender: "female", blurb: "Bright, quick, expressive" },
  { id: "echo", label: "Echo", gender: "male", blurb: "Low, measured, grounded" },
  { id: "fable", label: "Fable", gender: "neutral", blurb: "Theatrical, folk-tale cadence" },
  { id: "nova", label: "Nova", gender: "female", blurb: "Clear, modern, confident" },
  { id: "onyx", label: "Onyx", gender: "male", blurb: "Deep, resonant, authoritative" },
  { id: "sage", label: "Sage", gender: "female", blurb: "Calm, thoughtful, older" },
  { id: "shimmer", label: "Shimmer", gender: "female", blurb: "Soft, airy, youthful" },
  { id: "verse", label: "Verse", gender: "male", blurb: "Youthful, restless, earnest" },
];

export function voiceLabel(id: string | null): string {
  if (!id) return "Unassigned";
  return VOICES.find((v) => v.id === id)?.label ?? id;
}

const MALE = VOICES.filter((v) => v.gender === "male").map((v) => v.id);
const FEMALE = VOICES.filter((v) => v.gender === "female").map((v) => v.id);
const NEUTRAL = VOICES.filter((v) => v.gender === "neutral").map((v) => v.id);

/** Pick a distinct voice suggestion for a character, avoiding already-used ids. */
export function suggestVoice(
  gender: "male" | "female" | "unknown",
  used: Set<string>,
): string {
  const pools =
    gender === "male"
      ? [MALE, NEUTRAL, FEMALE]
      : gender === "female"
        ? [FEMALE, NEUTRAL, MALE]
        : [NEUTRAL, FEMALE, MALE];
  for (const pool of pools) {
    const free = pool.find((id) => !used.has(id));
    if (free) return free;
  }
  return "alloy";
}
