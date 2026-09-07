# Minimal Hindi narration with ElevenLabs

Keep it simple: upload a file, let the AI read it, pick a handful of voices, and ElevenLabs does the rest.

## Security note first
The key you pasted is now in the chat history — please rotate it in your ElevenLabs account. During the build I'll open a secure form for the new key; it never goes into the code.

## The flow (4 screens, nothing more)
1. **Upload** — drop a PDF, DOCX or TXT. Text is extracted and shown briefly.
2. **Analyze** — the AI reads it and lists the narrator plus the characters who actually speak.
3. **Speakers** — a compact list of 5 slots by default (Narrator + 4 characters), each with a Hindi voice dropdown and a play button for a Hindi sample. A "+" button adds another speaker slot; extra characters can be pointed at a shared voice.
4. **Listen / Download** — narration is generated and playable, with an MP3 download.

Dropped from the current build to keep it basic: merge/split character tools, alias editing, low-confidence review panel, per-character instruction boxes, and chapter-by-chapter playback controls. Chapters still keep the audio in the right order internally.

## Voices
Hindi-first list of ElevenLabs multilingual voices (a few male, a few female, one neutral for shared/minor roles), each with a short label and a Hindi preview line so pronunciation is easy to judge before choosing.

## Technical changes
- Link the ElevenLabs connector; server code reads `ELEVENLABS_API_KEY`.
- Rewrite `src/lib/tts.functions.ts` to call `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=pcm_24000` with the `xi-api-key` header, model `eleven_multilingual_v2`, and fixed voice settings (stability 0.5, similarity 0.75, speaker boost on). It returns base64 PCM exactly as today, so `audio.ts`, `clip-cache.ts`, stitching, pauses, normalization and MP3 export stay untouched.
- Replace the catalogue in `src/lib/voices.ts` with ElevenLabs voice IDs plus a `hindiSample` string; keep the gender-pool `suggestVoice` logic.
- Drop the free-text `instructions` from the TTS payload (ElevenLabs has no such parameter); keep the field in the clip-cache key so changing a voice re-records only that speaker.
- Simplify `src/components/CastStep.tsx` to the slot list + "+" button; remove merge/split/alias/confidence UI. Collapse `GenerateStep` progress into the Listen screen so generation is one automatic step.
- `src/lib/preview.ts` plays the Hindi sample when no text is selected.
- Errors surface ElevenLabs status and body; 429 keeps mapping to `RATE_LIMIT` for the existing backoff, 401 gives a clear "reconnect your key" message.

## Out of scope
No changes to extraction or chapter assembly logic, no accounts, no backend database.
