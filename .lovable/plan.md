# Better speaker detection for uploaded files + English-only UI text

## What's wrong today

Speaker detection only looks at text wrapped in quotation marks. Anything else is treated as narration, so:

- Poems and free verse (no quotes at all) produce one voice — the narrator only.
- Script/play files written as `RAM: chalo chalte hain` are read as plain prose, so the character names never become speakers.
- Dialogue written with dashes (`— chalo`) or Hindi/Devanagari quote styles is missed.
- PDFs often come out with a line break after every line instead of blank lines between paragraphs, so poems and scripts collapse into a single block and lose their structure.

Because there is nothing marked as spoken, the analysis step has almost nothing to send to the AI, so no extra characters appear on the Speakers screen.

Separately, two messages on the Speakers screen are in Hindi ("Pehle ek voice chuniye", "Preview ban rahi hai…").

## What will change

1. **Recognise more ways dialogue is written**
   - Script lines: `NAME:` / `NAME —` at the start of a line becomes that character's spoken line, with the name used directly as the speaker.
   - Dash dialogue at the start of a line.
   - Additional quote styles, including Devanagari/typographic single quotes and low quotes.

2. **Handle poems and line-broken files**
   - Keep short consecutive lines as their own units instead of merging them into one paragraph, so a poem keeps its verses and a script keeps one line per line.
   - Treat a run of blank-line-free short lines as a stanza rather than a paragraph.

3. **Fallback when a file has no marked dialogue at all**
   - If almost nothing is detected as spoken, send the text itself to the AI and let it decide which passages belong to distinct voices (speakers, stanzas, or sections) instead of defaulting the whole file to the narrator.
   - The AI prompt is extended to handle poems and scripts, and to still collapse aliases and avoid inventing characters from names that are only mentioned.

4. **Always offer a usable speaker set**
   - After analysis, if fewer than the default number of speaker slots are found, the Speakers screen still shows the slots it has plus the "+" control, rather than a near-empty list.

5. **English-only interface text**
   - Replace the two Hindi toast messages with English. Hindi stays only in spoken audio and the voice preview sample line.

## Technical notes

- `src/lib/segment.ts` — extend `splitParagraph` with script-prefix, dash and extra quote handling; carry an optional detected speaker name on the segment so the AI does not have to guess for script files.
- `src/lib/extract.ts` — stop hard-joining every wrapped line; detect verse/script blocks (many short lines, no terminal punctuation) and keep line boundaries.
- `src/lib/ai.functions.ts` — accept an optional `hint` speaker per line, and add a second prompt mode for unquoted text (poem/script/prose) that returns voice assignments over passages.
- `src/lib/pipeline.ts` — when dialogue segments are near zero, run the fallback mode over narration segments before falling back to narrator-only.
- `src/components/CastStep.tsx` — English toast strings.

No change to voice selection, generation, audio assembly, export, or caching.
