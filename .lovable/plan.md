# AI Multi-Voice Audiobook Generator

Upload a manuscript, let AI figure out who actually speaks, pick ElevenLabs voices, and export a narrated MP3.

## Flow

```text
Upload  ->  AI Analyze  ->  Review Speakers & Voices  ->  Generate  ->  Listen / Download
```

## What gets built

### 1. Upload & extraction
- Drag-and-drop PDF, DOCX, or TXT (book-length supported).
- Server-side extraction into clean text, preserving chapter breaks, paragraphs, and quoted dialogue.
- Preview of detected chapters with word counts and an estimated runtime/cost before anything is generated.

### 2. AI speaker intelligence (the core)
- The book is segmented into ordered units: narration blocks and dialogue lines with attribution cues.
- Chunked AI passes over the text (with a running character memory so context survives across a whole book) detect: the narrator, every speaking character, aliases for the same person ("Dr. Vance" / "Elena" / "she"), non-speaking mentioned names, and lines where attribution is uncertain.
- Aliases are merged into one canonical character; mentioned-but-never-speaking names are dropped.
- Each character gets line count, word count, first appearance, a short personality/voice brief (age, gender, tone), and a confidence score.

### 3. Smart voice planning
- Ranks speakers by dialogue volume and recommends the minimum sensible voice set, e.g. Narrator + 3 mains + 1 shared "supporting" voice for everyone under a threshold.
- Suggests a specific ElevenLabs voice per role from the character brief.

### 4. Review screen
- Cast list with sample lines per character; play a voice preview.
- Rename, merge duplicates, split a wrongly merged character, promote/demote to the shared supporting voice, or change any voice assignment.
- A dedicated "needs review" queue for low-confidence lines so the user can reassign the speaker before generating.

### 5. Narration generation
- Each segment is synthesized with its assigned voice through ElevenLabs, using request stitching (previous/next text) so prosody flows naturally.
- Parallel workers with a bounded queue and live per-chapter progress; the job survives page reloads via a shareable job link.

### 6. Audio processing & export
- Natural pauses inserted between speakers, at paragraph breaks, and at chapter boundaries; loudness normalized.
- Chapter-level MP3s plus a full-book MP3, all downloadable, with an in-app player that highlights the current segment.

### 7. Efficient regeneration
- Every clip is cached keyed by (text, voice, settings). Changing one character's voice or editing one line re-synthesizes only the affected clips and re-stitches the touched chapters.
- A cost/clip-count estimate is shown before any regeneration runs.

## Technical notes

- **Backend:** Lovable Cloud is enabled for the database (documents, chapters, segments, characters, voice assignments, clips, jobs) and file storage (uploads, clips, exported MP3s). No login: a browser-held session id owns each project, and jobs get an unguessable link so long book-length renders can be reopened. Row-level policies scope everything to that project token.
- **Voices:** ElevenLabs via the app connector; the API key stays server-side. `eleven_multilingual_v2` for final renders, turbo for previews.
- **Extraction:** server functions handle PDF/DOCX/TXT parsing; long documents are processed chapter by chapter to stay within request limits.
- **Analysis:** Lovable AI with a structured-output schema, run in overlapping chunks with a carried-forward character roster, then a global reconciliation pass that merges aliases across the whole book.
- **Audio assembly:** MP3 clips concatenated with generated silence at the correct boundaries, chapter files built incrementally as clips land.
- **Cost control:** analysis is cheap and runs first; TTS only runs after the user approves the cast, and the estimate is always shown up front.

## Not in this build

User accounts, project history across devices, and non-ElevenLabs voice providers.
