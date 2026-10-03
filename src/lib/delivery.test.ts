import { describe, expect, it } from "vitest";
import { clampSpeed, effectiveSpeed, ensureTerminalPunctuation, pauseAfter } from "./delivery";

const mid = () => 0.5; // no jitter

describe("speed", () => {
  it("clamps to the supported range", () => {
    expect(clampSpeed(2)).toBe(1.2);
    expect(clampSpeed(0.2)).toBe(0.7);
    expect(effectiveSpeed({ speed: 1.2 }, { speed: 1.5, emotion: "excited" }, 1.2)).toBe(1.2);
    expect(effectiveSpeed({ speed: 0.8 }, { speed: 0.75 }, 0.8)).toBe(0.7);
  });
  it("defaults to normal speed", () => {
    expect(effectiveSpeed(undefined, {}, 1)).toBe(1);
  });
});

describe("pauses", () => {
  it("scales with punctuation", () => {
    expect(pauseAfter("नमस्ते,", { jitter: mid })).toBe(120);
    expect(pauseAfter("वह चला गया।", { jitter: mid })).toBe(300);
    expect(pauseAfter("क्या?", { jitter: mid })).toBe(350);
    expect(pauseAfter("End.", { paragraphEnd: true, jitter: mid })).toBe(600);
  });
  it("keeps dialogue turns under 200ms even with jitter", () => {
    for (const j of [0, 0.5, 0.999]) {
      expect(pauseAfter("हाँ!", { dialogueTurn: true, jitter: () => j })).toBeLessThan(200);
    }
  });
  it("adds a missing full stop", () => {
    expect(ensureTerminalPunctuation("बहुत बढ़िया, टीम")).toBe("बहुत बढ़िया, टीम।");
    expect(ensureTerminalPunctuation("Done")).toBe("Done.");
    expect(ensureTerminalPunctuation("Really?")).toBe("Really?");
  });
});

import { deliveryFor } from "./delivery";
describe("emotion delivery", () => {
  it("neutral stays on v2 with no cue", () => {
    expect(deliveryFor({})).toEqual({ model: "eleven_multilingual_v2", tag: null });
  });
  it("emotions use the expressive model with a cue", () => {
    expect(deliveryFor({ emotion: "whispering" })).toEqual({ model: "eleven_multilingual_v2", tag: null });
    expect(deliveryFor({ emotion: "laughing" }).model).toBe("eleven_multilingual_v2");
  });
});

import { looksLikeBabble } from "./delivery";
describe("babble guard", () => {
  it("flags audio far longer than the text", () => {
    expect(looksLikeBabble("हाँ।", 5000)).toBe(true);
    expect(looksLikeBabble("वृद्ध और तरुण एक चटाई पर बैठते हैं।", 2500)).toBe(false);
  });
});
