# Speed control, emotions and natural pauses

Everything below is added on top of what exists. Upload, analysis, review lines, caching, MP3 export and the voice-tag fix stay exactly as they are.

## 1. Speed control (new)
- **Per speaker speed**: on the Speakers screen each speaker row gets a small speed slider (0.7x slow to 1.2x fast, default 1.0x) with a label like "Normal", "Slow", "Fast". The preview button plays at the chosen speed.
- **Overall speed**: one "Overall pace" slider on the Generate screen that scales every speaker together (e.g. make the whole book 10% slower). Final speed is clamped to the 0.7x-1.2x range ElevenLabs supports.
- **Per line override (optional)**: on the Review lines screen, each line gets a tiny speed menu (Slower / Normal / Faster) for special moments.
- Changing speed only re-creates the clips it affects; everything else reuses the saved audio.

## 2. Emotions per line
- Each line can carry an emotion: neutral, whispering, angry, sad, crying, laughing, excited, scared, stern, flirty, sarcastic.
- The AI suggests an emotion during analysis; you can change it on the Review lines screen (dropdown next to the speaker).
- Each emotion maps to voice settings (steadiness, expressiveness) and a small speed nudge, e.g. scared slightly faster, sad slightly slower, whispering softer and steadier.

## 3. Natural full stops and cadence (less "AI" sound)
- Pauses scale with punctuation: short breath after commas (~120 ms), longer after full stops / Hindi purna viram "।" (~300 ms), longer after "?" and "!" (~350 ms), paragraph end ~600 ms, chapter end ~1.5 s.
- Dialogue turn gaps stay under 200 ms (the existing tested rule) unless the script asks for a pause.
- Long sentences are split at natural punctuation so the voice takes breaths instead of rushing.
- Small random variation (plus or minus 15%) on pauses so the rhythm does not feel mechanical.
- Missing end punctuation is added before sending text, so lines do not end on a flat, cut-off tone.

## Technical details
- `types.ts`: `CharacterProfile.speed?: number` (default 1), `ProjectState.globalSpeed?: number`, `Segment.speed?: "slower" | "normal" | "faster"`, `Segment.emotion?: EmotionType`. All optional, so saved projects keep working.
- New `src/lib/delivery.ts`: `EMOTION_PROFILES` (stability, style, speed delta), `effectiveSpeed(char, seg, global)` clamped to 0.7-1.2, `pauseAfter(text, next)` punctuation rules with jitter, `ensureTerminalPunctuation`, `splitLongSentence`.
- `tts.functions.ts`: accept optional `stability` and `style` alongside existing `speed`; defaults unchanged.
- `pipeline.ts`: build each request with effective speed + emotion settings; clip cache key includes speed and emotion so only changed lines regenerate; replace fixed narration gaps with `pauseAfter`, keeping the under-200 ms dialogue rule.
- `ai.functions.ts`: analysis output adds optional `emotion` per line (falls back to neutral).
- UI: speed slider in `CastStep.tsx`, overall pace in `GenerateStep.tsx`, emotion + speed menus in `ReviewStep.tsx`; `preview.ts` passes speed.
- Tests in `voice-tags.test.ts` / new `delivery.test.ts`: speed clamping, pause lengths per punctuation, dialogue gaps still under 200 ms, voice tags still never sent.
