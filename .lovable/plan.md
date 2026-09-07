# Switch narration to ElevenLabs with Hindi-first voices

## Security note first
The key you pasted is now visible in the chat history. Please rotate it in your ElevenLabs account and use the secure key form I'll open during the build — keys typed in chat are not stored safely and I won't put it in the code.

## What changes for you
- Narration is produced by ElevenLabs instead of the built-in voice engine.
- The voice list becomes Hindi-first: multilingual voices that read Devanagari and Hinglish naturally, each with a short description and a preview button that speaks a Hindi sample line.
- Everything else in the flow stays the same: upload, speaker detection, casting, generation, chapter playback, MP3 export, and re-recording only the clips you change.

## Voice set
Curated ElevenLabs multilingual voices suited to Hindi narration, grouped by male / female / neutral so the automatic casting still picks distinct voices per character:
- Warm male narrator, deep male, youthful male
- Calm female narrator, bright female, older female
- Plus a neutral option for the shared supporting-role voice
Voice previews use a Hindi sample sentence so you can judge pronunciation before casting.

## Technical changes
- Link the ElevenLabs connector so the key lives in the secure store; server code reads `ELEVENLABS_API_KEY`.
- Rewrite `src/lib/tts.functions.ts` to POST to `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=pcm_24000` with `xi-api-key`, model `eleven_multilingual_v2`, and voice settings (stability 0.5, similarity 0.75, speaker boost). Return base64 PCM exactly as today, so `audio.ts`, `clip-cache.ts`, stitching, pauses, normalization and MP3 export are untouched.
- Map the existing `instructions` field onto ElevenLabs' controls: prosody hints are folded into voice settings (character voices get lower stability / higher style), since ElevenLabs has no free-text instruction parameter.
- Add request stitching: pass `previous_text` / `next_text` for adjacent spans of the same speaker so long passages keep consistent prosody.
- Replace the catalogue in `src/lib/voices.ts` with ElevenLabs voice IDs plus a `hindiSample` line used by the preview player; keep the `suggestVoice` gender-pool logic intact.
- `src/lib/preview.ts`: preview uses the Hindi sample when the picked text is empty.
- Error handling: surface ElevenLabs status + body; treat 429 as `RATE_LIMIT` so the existing backoff in `pipeline.ts` keeps working; 401 gives a clear "key needs reconnecting" message.
- Keep clip cache keys as `hash(text, voiceId, instructions)` — switching a character's voice re-records only that character.

## Out of scope
No changes to extraction, speaker analysis, chapter assembly, or the UI layout beyond the new voice names and Hindi preview line.
