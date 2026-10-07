# Edit lines on Review + automatic script cleanup on upload

Two additions, nothing else changes (voices, emotions, pauses, login, credits stay as they are).

## Part 1 — Edit, copy and combine lines on the Review lines screen

What the user can do:
1. **Edit a line's text** — click the pencil icon (or double-click the text), type, press Save (Enter) or Cancel (Esc). Copy/paste works normally inside the edit box.
2. **Combine lines** — tick two or more lines that sit next to each other, click **Combine lines** in the bottom bar. They become one line, text joined with a space, keeping the first line's speaker, emotion and speed (changeable afterwards).
3. **Split a line** — in edit mode, put the cursor where you want to cut and click **Split here**; you get two lines with the same speaker.
4. **Delete a line** — trash icon, so a stray heading or page number is never spoken. Undo toast for 5 seconds.
5. **Undo last change** — one-step undo button for edit/combine/split/delete.

Rules:
- Any edited, combined or split line is marked as set by you (100%, green) so "Re-detect uncertain" never overwrites it.
- Generated audio follows the edits: only the changed lines are recorded again; untouched lines reuse saved audio.
- Combining is only allowed for neighbouring lines in the same chapter (keeps story order correct).
- Voice tags like `(voice: Riya)` typed into an edit are applied as the speaker and removed from spoken text, same as on upload.
- Play button on an edited line plays the new text.

## Part 2 — Automatic script cleanup on upload (with preview)

After the file is read, a **"Clean up for speech"** step runs automatically, and the inspection screen gets a toggle **"Spoken-Hindi cleanup: On"** plus a **"See changes"** panel showing before → after for each fix. The user can turn it off or undo single fixes before clicking Analyze speakers.

Fixes applied (rule-based, instant, no extra cost):
1. **Abbreviations**: डॉ. → डॉक्टर, स्व. → स्वर्गीय, पं. → पंडित, प्रो. → प्रोफेसर, श्री. → श्री, Dr./Mr./Mrs. → spoken form. Stops the voice from pausing at the dot.
2. **Numbers**: Devanagari digits (१२३) and Western digits read correctly; years like 1947 → उन्नीस सौ सैंतालीस; times and ₹ amounts expanded (₹500 → पाँच सौ रुपये).
3. **Symbols**: % → प्रतिशत, & → और, / between words → या; removes *, #, _, bullet marks, page numbers and repeated headers/footers from PDFs.
4. **Punctuation tidy-up**: fixes missing space after । ? !, turns "..." into a proper pause, removes doubled punctuation (।। , !!!), normalises curly/straight quotes so dialogue is detected reliably.
5. **Broken words from PDFs**: rejoins words split across lines and removes stray hyphens/soft hyphens.
6. **Stage directions**: text in square brackets like [हँसते हुए] is not read aloud; it is turned into the line's emotion hint instead.

Never touched: `(voice: Name)`, `Name:` script lines, chapter headings, empty-line paragraph breaks.

Help: the existing "How to mark voices…" guide gets a short section "What cleanup changes automatically", and a "?" tooltip on the toggle.

## Technical details

- `src/lib/types.ts`: add `Segment.edited?: boolean`; reuse `manual: true, confidence: 1` for locking.
- `src/lib/segment-edit.ts` (new, pure functions): `editSegmentText`, `combineSegments(ids)` (validates adjacency + same chapter), `splitSegment(id, offset)`, `deleteSegment`; each returns a new segments array and runs voice-tag extraction via `voice-tags.ts`. `recountCharacters` after each change.
- `src/components/ReviewStep.tsx`: inline textarea editor, checkbox selection already used for bulk assign extended with Combine/Delete, single-level undo stack in component state, persisted via `setProject`.
- Cache: clip key already includes text, so edited lines regenerate and others reuse audio; no cache changes needed.
- `src/lib/script-clean.ts` (new): `cleanForSpeech(raw) -> { text, changes: {before, after, rule}[] }` with ordered rules; Hindi number-to-words helper (0–99 lookup table + hundreds/thousands/lakh/crore).
- `src/components/UploadStep.tsx`: run cleanup between `extractText` and `buildChapters`, keep raw text so toggling off rebuilds chapters; "See changes" list with per-change revert.
- Bracket stage directions map to `Segment.emotion` hints via a small keyword table (हँसते → laughing, फुसफुसा → whispering, गुस्से → angry, रोते → crying).
- Tests: `segment-edit.test.ts` (combine keeps order/speaker, rejects non-adjacent, split, edits lock line, voice tag in edit stripped) and `script-clean.test.ts` (डॉ. → डॉक्टर, 1947 → उन्नीस सौ सैंतालीस, ₹500, %, voice tags and chapter headings untouched).
