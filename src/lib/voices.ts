export interface VoiceOption {
  id: string;
  label: string;
  gender: "male" | "female" | "neutral";
  blurb: string;
}

/**
 * ElevenLabs multilingual voices that handle Hindi / Hinglish well.
 * Ids are ElevenLabs voice ids used directly by tts.functions.ts.
 */
export const VOICES: VoiceOption[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "Arjun", gender: "male", blurb: "Warm, steady kathavachak" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Vikram", gender: "male", blurb: "Deep, authoritative" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Rohan", gender: "male", blurb: "Youthful, energetic" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Devendra", gender: "male", blurb: "Calm, mature elder" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Meera", gender: "female", blurb: "Soft, expressive narrator" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Anaya", gender: "female", blurb: "Bright, clear, modern" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Kavita", gender: "female", blurb: "Gentle, storytelling warmth" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Priya", gender: "female", blurb: "Youthful, conversational" },
  { id: "SAz9YHcvj6GT2YYXdXww", label: "Sur", gender: "neutral", blurb: "Even, neutral — good shared voice" },
];

/** Sample line spoken when previewing a voice. */
export const HINDI_SAMPLE =
  "नमस्ते, यह मेरी आवाज़ का नमूना है। कहानी अब शुरू होती है।";

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
  return VOICES[0]!.id;
}
