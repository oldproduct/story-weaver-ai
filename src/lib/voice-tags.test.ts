import { describe, expect, it } from "vitest";
import {
  assertSpeakableText,
  parseSpeechBlock,
  stripVoiceTags,
  voiceTagName,
} from "./voice-tags";
import { buildSegments } from "./segment";
import { PAUSE_PARAGRAPH, PAUSE_SAME, PAUSE_SPEAKER_CHANGE } from "./pipeline";
import type { Chapter } from "./types";

const voiceMap = {
  riya: "riya_voice_id",
  aman: "aman_voice_id",
  rohan: "rohan_voice_id",
};

const SCRIPT = `(voice: Riya)
अमन, क्या हमारा प्रोजेक्ट तैयार है?

(voice: Aman)
हाँ, बस आखिरी टेस्ट बाकी है।

(voice: Rohan)
टेस्ट सफल! अब हम इसे स्कूल में दिखा सकते हैं।

(voice: Riya)
बहुत बढ़िया, टीम!`;

describe("voice tag parsing", () => {
  it("extracts speaker, voice id and clean text", () => {
    const parsed = parseSpeechBlock(
      "(voice: Riya)\nअमन, क्या हमारा प्रोजेक्ट तैयार है?",
      voiceMap,
    );
    expect(parsed).toEqual({
      speaker: "Riya",
      voiceId: "riya_voice_id",
      text: "अमन, क्या हमारा प्रोजेक्ट तैयार है?",
    });
  });

  it("accepts loose spacing and casing", () => {
    expect(voiceTagName("(  VOICE : Aman )  हाँ")).toBe("Aman");
    expect(stripVoiceTags("( voice:Rohan )  टेस्ट सफल!")).toBe("टेस्ट सफल!");
  });

  it("never leaves metadata in spoken text", () => {
    for (const line of SCRIPT.split(/\n\s*\n/)) {
      const clean = stripVoiceTags(line);
      expect(clean).not.toMatch(/voice/i);
      expect(clean).not.toMatch(/[()]/);
      expect(clean).not.toContain(":");
      expect(() => assertSpeakableText(clean)).not.toThrow();
    }
  });

  it("throws when metadata would reach the speech engine", () => {
    expect(() => assertSpeakableText("(voice: Riya) नमस्ते")).toThrow(
      /leaked/,
    );
    expect(() => assertSpeakableText("speaker: Aman")).toThrow(/leaked/);
  });
});

describe("segmenting a tagged script", () => {
  const chapter: Chapter = {
    id: "ch1",
    index: 0,
    title: "Scene",
    paragraphs: SCRIPT.split(/\n\s*\n/).flatMap((b) => b.split("\n")),
    wordCount: 0,
  };
  const segments = buildSegments([chapter]);

  it("creates one dialogue line per tagged block with the right speaker hint", () => {
    expect(segments.map((s) => s.hint)).toEqual(["Riya", "Aman", "Rohan", "Riya"]);
    expect(segments.every((s) => s.kind === "dialogue")).toBe(true);
  });

  it("keeps only the spoken sentence", () => {
    expect(segments.map((s) => s.text)).toEqual([
      "अमन, क्या हमारा प्रोजेक्ट तैयार है?",
      "हाँ, बस आखिरी टेस्ट बाकी है।",
      "टेस्ट सफल! अब हम इसे स्कूल में दिखा सकते हैं।",
      "बहुत बढ़िया, टीम!",
    ]);
  });
});

describe("conversational gaps", () => {
  it("stays under 200ms between turns", () => {
    for (const gap of [PAUSE_SAME, PAUSE_SPEAKER_CHANGE, PAUSE_PARAGRAPH]) {
      expect(gap).toBeGreaterThanOrEqual(100);
      expect(gap).toBeLessThan(200);
    }
  });
});
