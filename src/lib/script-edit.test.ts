import { describe, expect, it } from "vitest";
import { cleanForSpeech, hindiNumber } from "./script-clean";
import { combineSegments, editSegmentText, splitSegment } from "./segment-edit";
import { extractStageDirections } from "./segment";
import type { CharacterProfile, Segment } from "./types";

const seg = (id: string, order: number, text: string, chapterId = "c1", speakerId = "narrator"): Segment => ({
  id, chapterId, order, kind: "narration", text, context: "", speakerId, confidence: 0.5,
});
const lines = [seg("a", 0, "पहला।", "c1", "x"), seg("b", 1, "दूसरा।"), seg("c", 2, "तीसरा।"), seg("d", 3, "चौथा।", "c2")];

describe("line editing", () => {
  it("combines neighbours keeping first speaker and order", () => {
    const r = combineSegments(lines, ["a", "b"]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.segments.map((s) => s.text)).toEqual(["पहला। दूसरा।", "तीसरा।", "चौथा।"]);
    expect(r.segments[0]?.speakerId).toBe("x");
    expect(r.segments[0]?.manual).toBe(true);
  });
  it("rejects non-adjacent and cross-chapter combines", () => {
    expect(combineSegments(lines, ["a", "c"]).ok).toBe(false);
    expect(combineSegments(lines, ["c", "d"]).ok).toBe(false);
  });
  it("splits a line into two locked lines", () => {
    const out = splitSegment(lines, "b", 3, "एक दो");
    expect(out.map((s) => s.text).slice(1, 3)).toEqual(["एक", "दो"]);
    expect(out[2]?.speakerId).toBe("narrator");
    expect(out[2]?.manual).toBe(true);
  });
  it("edit locks the line and applies a typed voice tag without speaking it", () => {
    const chars = [{ id: "riya", name: "Riya", aliases: [], isNarrator: false }] as unknown as CharacterProfile[];
    const out = editSegmentText(lines, "b", "(voice: Riya) नमस्ते", chars);
    const b = out.find((s) => s.id === "b");
    expect(b?.text).toBe("नमस्ते");
    expect(b?.speakerId).toBe("riya");
    expect(b?.confidence).toBe(1);
  });
});

describe("speech cleanup", () => {
  const clean = (t: string) => cleanForSpeech(t).text;
  it("expands Hindi abbreviations", () => {
    expect(clean("डॉ. शर्मा आए।")).toBe("डॉक्टर शर्मा आए।");
  });
  it("reads years and money in Hindi", () => {
    expect(clean("सन 1947 में आज़ादी मिली।")).toContain("उन्नीस सौ सैंतालीस");
    expect(clean("कीमत ₹500 थी।")).toContain("पाँच सौ रुपये");
    expect(clean("बीस 50% लोग।")).toContain("पचास प्रतिशत");
    expect(hindiNumber(125000)).toBe("एक लाख पच्चीस हज़ार");
  });
  it("never touches voice tags or chapter headings", () => {
    const out = clean("अध्याय 1\n\n(voice: Riya)\nडॉ. आइए।");
    expect(out.split("\n")[0]).toBe("अध्याय 1");
    expect(out).toContain("(voice: Riya)");
  });
  it("reverting a change keeps the original text", () => {
    const first = cleanForSpeech("डॉ. शर्मा आए।");
    const id = first.changes[0]?.id as string;
    expect(cleanForSpeech("डॉ. शर्मा आए।", new Set([id])).text).toBe("डॉ. शर्मा आए।");
  });
  it("stage directions become an emotion and are not spoken", () => {
    expect(extractStageDirections("[हँसते हुए] अरे वाह!")).toEqual({ text: "अरे वाह!", emotion: "laughing" });
  });
});
