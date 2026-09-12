import { describe, it, expect } from "vitest";
import { parseScript } from "./parser";
import type { Chapter } from "./types";
import { uid } from "./id";

function makeChapter(text: string): Chapter {
  return {
    id: uid("ch"),
    index: 0,
    title: "Test",
    paragraphs: text.split("\n").map(s => s.trim()).filter(Boolean),
    wordCount: 10,
  };
}

describe("parseScript", () => {
  it("Test 1: Voice markers are commands, not speech", () => {
    const res = parseScript([makeChapter("(voice: Amitabh) भेज दो।")], false);
    expect(res.spokenCount).toBe(1);
    expect(res.segments[0]?.text).toBe("भेज दो।");
    expect(res.segments[0]?.scriptSpeaker).toBe("Amitabh");
    expect(res.segments[0]?.speak).toBe(true);
  });

  it("Test 2: Skip standalone stage directions", () => {
    const res = parseScript([makeChapter("(voice: Varun)\n(चपरासी का उसी दरवाजे से प्रस्थान।)")], false);
    expect(res.spokenCount).toBe(0); // speak: false
    expect(res.skippedCount).toBe(1);
    expect(res.segments[0]?.speak).toBe(false);
  });

  it("Test 3: Remove inline stage directions but preserve dialogue", () => {
    const res = parseScript([makeChapter("(voice: Sanjay)\n(अत्यन्त प्रसन्नता से) यह आपकी कृपा के कारण।")], false);
    expect(res.spokenCount).toBe(1);
    expect(res.segments[0]?.text).toBe("यह आपकी कृपा के कारण।");
    expect(res.segments[0]?.scriptSpeaker).toBe("Sanjay");
  });

  it("Test 4: Handle voice markers and dialogue in the same paragraph", () => {
    const res = parseScript([makeChapter("(voice: Amitabh)\n(कार्ड को देखकर) बिजिटर्स रूम में बैठाओ। मैं अभी मिलूँगा।")], false);
    expect(res.spokenCount).toBe(1);
    expect(res.segments[0]?.text).toBe("बिजिटर्स रूम में बैठाओ। मैं अभी मिलूँगा।");
    expect(res.segments[0]?.scriptSpeaker).toBe("Amitabh");
  });

  it("Test 5: Use deterministic speaker state machine", () => {
    const res = parseScript([makeChapter("(voice: Varun)\n(नोट उठाकर जेब में रखते हुए)\n(voice: Amitabh)\nइच्छा आपकी।")], false);
    expect(res.spokenCount).toBe(1); // Only Amitabh's line is spoken
    
    const dialogue = res.segments.filter(s => s.speak);
    expect(dialogue.length).toBe(1);
    expect(dialogue[0]?.text).toBe("इच्छा आपकी।");
    expect(dialogue[0]?.scriptSpeaker).toBe("Amitabh");
    
    const skipped = res.segments.filter(s => !s.speak);
    expect(skipped.length).toBe(1);
    expect(skipped[0]?.text).toBe("नोट उठाकर जेब में रखते हुए");
  });
});
