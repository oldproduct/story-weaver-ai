# Line-level speaker review with confidence

## Already done
Narration already uses your ElevenLabs key with the Hindi-capable multilingual voice model — the built-in Lovable voices are no longer used anywhere. Nothing to change there; if any voice sounds off, that is a voice-choice tweak on the Speakers screen, not a provider change.

## What gets added

A new **Review lines** screen between Speakers and Generate.

- Every line of the book is listed in story order, grouped by chapter, showing: the spoken text, the assigned speaker, and a confidence score (a percentage plus a colour: green = certain, amber = inferred, red = guessed).
- A filter row: All lines / Low confidence only / One speaker only, plus a text search.
- Changing a speaker is a dropdown on each line, listing the narrator, every detected character, the shared supporting voice, and "New speaker…" to create one on the spot.
- Multi-select: tick several lines and reassign them all at once (useful for a back-and-forth exchange).
- Any line you set by hand is marked "set by you" at 100% confidence and is never overwritten by a later auto-detect.
- A summary bar at the top: how many lines are uncertain and a "Jump to next uncertain line" button.

**Auto-detect** on the same screen:
- "Re-detect uncertain lines" re-runs the AI on just the low-confidence lines, giving it the surrounding lines and the confirmed speakers around them as context, so it usually resolves them without touching everything else.
- A "fill the gaps" pass that applies the obvious pattern: in an uninterrupted two-person exchange, alternate speakers between confirmed anchors.
- Your manual edits act as anchors for both passes.

**Generation stays cheap**: only lines whose speaker (and therefore voice) actually changed get re-synthesised; every other clip is reused from the local cache.

## Technical notes

- `Segment` gains `manual?: boolean`; stage list gains a `review` stage between `cast` and `generate` (`src/lib/types.ts`, `src/routes/index.tsx`, `src/components/StepRail.tsx`).
- New `src/components/ReviewStep.tsx` — virtualised list so book-length documents stay smooth; edits go through `updateProject` into the existing IndexedDB store.
- `src/lib/ai.functions.ts` gains a `refineLines` server function: takes a batch of uncertain lines plus locked neighbours and the character roster, returns speaker + confidence per line. Same Gemini call shape, same rate-limit handling as the existing analysis pass.
- `src/lib/pipeline.ts`: extract the alternation heuristic as a pure function; character line/word counts recompute after edits so the Speakers screen stays accurate.
- Regeneration is already keyed by text + voice, so unchanged lines hit the clip cache automatically — no extra work beyond rebuilding the plan after edits.
