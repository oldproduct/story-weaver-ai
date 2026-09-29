# Make emotions actually audible

## Why nothing changes today
Emotions are saved and sent, but the only thing they change is two fine-tuning numbers (steadiness and expressiveness) on the current voice model. That model doesn't act out emotions from those numbers, and after the last fix toned them down to stop the robotic sound, the difference is almost zero. So "Laughing" and "Neutral" sound the same.

## The fix
Switch emotional lines to ElevenLabs' newer expressive model (Eleven v3). It supports Hindi and performs cues written in square brackets, like `[whispers]`, `[angry]`, `[laughs]`, `[crying]`. Your text doesn't change. Only the request sent to the voice gets a hidden cue in front.

| Emotion | Cue sent to the voice |
|---|---|
| Whispering | [whispers] |
| Angry | [angry] |
| Sad | [sad] |
| Crying | [crying] |
| Laughing | [laughs] |
| Excited | [excited] |
| Scared | [nervous] |
| Stern | [serious] |
| Flirty | [flirtatious] |
| Sarcastic | [sarcastic] |
| Neutral | no cue, stays on the current model |

- Neutral lines keep today's model and keep their saved audio, so nothing already recorded is lost.
- The play button on each line on Review lines uses the same rule, so you hear the emotion before generating.
- Changing a line's emotion re-records only that line.

## Trade-offs to know
- The expressive model gives more "creative" results: the same line can sound slightly different each time.
- The expressive model ignores the speed setting. For emotional lines, the app will speed the audio up or slow it down after recording, which slightly changes pitch at extremes. Neutral lines keep true speed control.
- The same voice can sound a little different between neutral and emotional lines because they use two models.

## Technical details
- `delivery.ts`: add `EMOTION_TAGS: Record<EmotionType, string | null>` and `deliveryFor(seg)` returning `{ model: "eleven_v3" | "eleven_multilingual_v2", tag }`.
- `tts.functions.ts`: accept optional `model` (enum of the two) and `emotionTag` (enum of the allowed tags only). After `assertSpeakableText(stripVoiceTags(text))`, prefix the tag server-side. For v3, send `stability` snapped to 0 / 0.5 / 1 (v3 only accepts these; use 0.5) and omit `speed`/`style`. The voice-tag leak guard stays unchanged and runs before the tag is added.
- `pipeline.ts` `buildPlan`/`synthOne`: pass model + tag; cache key includes the model and tag. Neutral key unchanged. For v3 clips with speed != 1, resample the PCM by the speed factor in `audio.ts` (new `changeRate(pcm, factor)`) before fades.
- `preview.ts` + ReviewStep `playLine`: pass the same model/tag and apply the same resample.
- Verify: one live ElevenLabs call per model with a Hindi line (neutral vs `[whispers]`/`[angry]`), confirm 200 + non-empty PCM. If v3 returns 404 or access denied for this key, stop and report it rather than falling back silently.
- Tests: tag mapping, neutral stays on v2 with an unchanged cache key, voice tags still never reach the voice.
