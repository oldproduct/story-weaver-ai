# Story Weaver AI

Got it. More proper, still short:

The product is an AI multi-voice audiobook/narration generator. A user uploads a PDF, DOCX, or TXT file containing a story, script, book, or other written content. The software first extracts and understands the text, then identifies the narrator, actual speaking characters, repeated aliases, and minor roles. It should intelligently decide how many distinct voices are actually needed, instead of creating a separate voice for every name mentioned.

The core build plan is:

Document Upload & Extraction
Upload PDF/DOCX/TXT, extract clean text, preserve chapters, paragraphs, dialogue, and formatting.

AI Story & Speaker Analysis
Detect narrator, dialogue, speakers, characters, aliases, and uncertain lines. Understand who is actually speaking and how often.

Smart Voice Planning
Recommend the minimum sensible voice set, for example: Narrator + 3 main characters + 1 shared supporting voice.

Voice Review & Selection
Show detected speakers in a clean screen. Let users preview and choose ElevenLabs voices, rename characters, merge duplicates, split incorrect matches, or assign minor roles to shared voices.

Narration Generation
Convert each speaker's dialogue/narration into separate TTS clips using the selected voice, then combine everything in the correct story order.

Audio Processing & Export
Add natural pauses, normalize audio, combine chapter-by-chapter, and export the final narration as MP3.

Efficient Regeneration
If the user changes one character's voice or fixes one dialogue line, regenerate only those affected clips, not the entire book.

Main UX:
Upload → AI Analyze → Review Speakers & Voices → Generate → Listen / Download

The most important feature is the AI speaker intelligence layer, because that is what turns a normal TTS product into a proper multi-character narration system.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b4e53d1d-8d82-4eec-a67e-c8470ae3d73a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
