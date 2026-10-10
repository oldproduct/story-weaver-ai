# Better line editing and clearer Review guidance

## Goal
Make Review lines faster for long scripts: open a line in a large writing area while every attributed line remains visible in a sidebar, and clearly explain how voice changes, paragraphs, and document symbols work.

## 1. Large Review editing workspace
- Replace the small in-row text box with a two-pane Review workspace on desktop:
  - **Left sidebar:** a scrollable list of every attributed line in story order, grouped by chapter. Each item shows a short text preview, assigned speaker, and confidence state. The current line is clearly highlighted.
  - **Main editing area:** a large, tall text box for the selected line, with enough room for multi-sentence edits and pasted text.
- Clicking a sidebar line or its pencil icon opens that line in the large editor without losing its place in the story.
- Keep the selected line’s speaker, emotion, speed, Play, move up/down, split, delete, Save, Cancel, and Undo actions beside the large editor.
- Keep copy/paste native. Enter creates a new line inside the text; saving uses the Save button or `Ctrl/Cmd + Enter`, while Escape cancels.
- If the user selects another line with unsaved text, ask whether to save or discard rather than silently losing the edit.
- On smaller screens, stack the line list above the editor so both remain usable without overlap.

## 2. Instructions based on the tester’s exact issue
Above the Review workspace, show a clear section titled **“How the app reads voices, paragraphs and markers”**. Keep it to three numbered points, but include direct examples and the result of each action:

1. **Change voice / choose who speaks**
   - In the uploaded file: `(voice: Riya)` forces the following text to Riya; `Riya: text` marks a script line; quoted or dash-started text is dialogue.
   - On Review lines: choose a speaker from the speaker menu. Typing `(voice: Riya)` at the start of an edited line also changes the speaker, and the marker is never spoken.
   - State that the name must exactly match a speaker shown on the Speakers screen.

2. **Create a paragraph, pause, or chapter**
   - One empty line in the uploaded file creates a paragraph pause.
   - `अध्याय 1` or `Chapter 1` on its own line creates a chapter break.
   - Commas, `।`, `.`, `?`, `!`, and `…` shape pauses inside speech; show each symbol in a compact example row.
   - Clarify that adding a blank line inside one Review edit does not create a chapter; use Split to make separate attributed lines.

3. **Correct the final narration in Review**
   - Edit or paste text in the large editor, assign the speaker, choose emotion/speed, Play to check it, Split or Combine where needed, and use up/down arrows to set final order.
   - Explain that Generate follows the saved text, speaker, and order, while unchanged recordings can still be reused.

The section will use simple English with Hindi examples, matching the original upload-page guidance without duplicating its longer cleanup details.

## 3. Preserve existing behavior
- Keep filtering, search, confidence review, bulk speaker assignment, Combine lines, re-detection, manual locks, line previews, and same-chapter movement.
- Keep all edits persisted through the existing project store.
- Generated narration continues to use the edited line text and saved order; voice tags remain metadata and never reach speech generation.

## Technical details
- Refactor `ReviewStep` into a responsive split layout with a scrollable attributed-lines navigation and a focused editor panel.
- Reuse the existing segment edit helpers and one-step undo instead of changing narration or cache logic.
- Add small focused interaction tests for editor save/cancel safeguards where the existing test setup supports UI tests; retain existing pure-helper tests for split, combine, voice tags, and movement.
- Verify desktop and mobile layouts, long pasted text, switching between lines with unsaved changes, speaker changes via `(voice: Name)`, and final saved ordering.
