# In-app document marker guide ("How to prepare your file")

The tester asked: *when a file is uploaded, what tells the software to change voice or start a new paragraph, and how do we mark that while preparing the document?* The answer already exists in the code — the app reads these markers:

| What you want | What to write in the file | Result in the audio |
|---|---|---|
| New paragraph / breathing pause | Leave one **empty line** | ~600 ms pause |
| Chapter break | `अध्याय 1`, `Chapter 1`, `भाग 2`, or a short ALL-CAPS line on its own line | New chapter + 1.5 s silence |
| Force a specific voice | `(voice: Riya)` before or inside the line | That line is spoken by the speaker named Riya |
| Script-style dialogue | `रोहन: नमस्ते!` (NAME colon at line start) | Named as that character's spoken line |
| Story dialogue | `"तुम कहाँ जा रहे हो?"` in quotes | Treated as dialogue, narrator reads the rest |
| Dash dialogue | `— चलो चलते हैं` at line start | Treated as dialogue |

Today this knowledge lives only in chat explanations. The plan puts it inside the app so any user (and the tester) can see it while uploading.

## What gets built

### 1. "How to prepare your document" guide on the Upload step
- A collapsible panel below the upload dropzone: **"How to mark voices, paragraphs & chapters"** with a chevron to expand/collapse (collapsed by default to keep the screen minimal).
- Expanded, it shows the simple table above with Hindi examples, written in plain English, grouped as three questions the tester asked:
  1. **How does it know when to pause?** → empty line = paragraph pause (~0.6 s), chapter heading = 1.5 s.
  2. **How does it know who is speaking?** → quotes, `NAME:` lines, dash lines, and the `(voice: Name)` tag.
  3. **How do I force a voice?** → write `(voice: Speaker name)` exactly as the speaker is named on the Speakers screen.
- A one-line note: "Everything else is detected automatically by AI — markers are only needed to be extra sure."

### 2. Downloadable sample file
- A **"Download a sample formatted file"** button inside the guide. It downloads a small ready-made Hindi TXT (a few paragraphs, one chapter heading, one `(voice: …)` line, script-style lines, quoted dialogue) so the tester can upload it and see every marker in action end to end.

### 3. Marker echo on the inspection screen
- After a file is parsed, the existing stats row (`n narration · n dialogue`) gains a tiny **"3 voice tags found"**-style counter showing how many `(voice: …)` markers and `NAME:` lines were detected — so the preparer gets immediate confirmation their markers were seen.
- If a `(voice: Name)` tag names a speaker the analysis never found, the Speakers screen already allows adding that speaker; the counter text will hint: "re-check spelling of names in (voice: …) tags".

## What stays unchanged
- No change to segmentation rules, pause timings, TTS, caching, analysis prompts, or the generate flow — this is a documentation + detection-count addition only.
- English-only UI text; Hindi appears only inside the example snippets.

## Files touched
- `src/components/UploadStep.tsx` — guide panel, sample-file download button, marker counters on the inspection screen.
- `src/lib/voice-tags.ts` (or a small helper) — count `(voice: …)` tags and `NAME:` lines in a chapter list for the counters.
- A small inline constant for the sample file text (no new dependency).
