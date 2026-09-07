import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LineSchema = z.object({
  i: z.number(),
  text: z.string(),
  context: z.string(),
  hint: z.string().optional(),
});

const RosterEntry = z.object({
  name: z.string(),
  aliases: z.array(z.string()).default([]),
  gender: z.enum(["male", "female", "unknown"]).default("unknown"),
  ageRange: z.string().default("adult"),
  description: z.string().default(""),
});

const AnalyzeInput = z.object({
  lines: z.array(LineSchema).min(1),
  roster: z.array(RosterEntry).default([]),
  title: z.string().default("Untitled"),
  /** "dialogue" = quoted lines; "passage" = poem / script / prose with no quotes. */
  mode: z.enum(["dialogue", "passage"]).default("dialogue"),
});

export interface AnalyzeResult {
  assignments: Array<{ i: number; speaker: string; confidence: number }>;
  characters: Array<z.infer<typeof RosterEntry>>;
}

const SYSTEM = `You are a dialogue-attribution engine for audiobook production.
You receive numbered quoted lines from a book, each with the surrounding paragraph as context, plus the roster of characters discovered so far.

Your job:
1. For every line, name the character who SPEAKS it. Use the exact canonical name from the roster whenever the speaker is someone already known. Only invent a new name when a genuinely new speaking character appears.
2. Never create a character for a name that is only mentioned, referenced, or talked about. Only actual speakers become characters.
3. Collapse aliases: nicknames, titles, first/last names and epithets for the same person must map to ONE canonical name (list the variants in aliases).
4. If the speaker is genuinely unclear, use "Unknown" and a low confidence.
5. confidence is 0..1: 1.0 for an explicit tag ("said Elena"), ~0.7 for a clear back-and-forth inference, <0.4 when guessing.

Respond with JSON only, no prose, in this exact shape:
{"assignments":[{"i":0,"speaker":"Elena Vance","confidence":0.9}],
 "characters":[{"name":"Elena Vance","aliases":["Elena","Dr. Vance"],"gender":"female","ageRange":"30s","description":"clipped, guarded surgeon"}]}
"characters" must contain every speaker you used in assignments, including ones already in the roster (repeat them unchanged unless you learned something new).
Some lines include a "hint" field taken from a script-style cue in the text (e.g. "RAM: ..."). Trust the hint unless the text clearly contradicts it, but still normalise it to a canonical name.`;

const PASSAGE_SYSTEM = `You are a casting engine for audiobook production working on text that has NO quotation marks: a poem, song, play/script, monologue, or plain prose.
You receive numbered passages (a verse line, a script line, or a paragraph) with context, plus the roster discovered so far.

Your job:
1. For every passage, decide which VOICE should read it. If a character clearly speaks it (a script cue, a first-person voice, a distinct persona, a dialogue exchange without quotes), name that character. Otherwise use "Narrator".
2. In a poem or song, treat clearly distinct voices (speaker vs. addressee, chorus/refrain vs. verses, alternating personas) as separate characters with descriptive names (e.g. "The Chorus", "The Traveller"). If the whole poem is one voice, assign everything to "Narrator" — do not invent characters that are not there.
3. Never create a character for a name that is only mentioned or described. Only voices that actually speak/read.
4. Collapse aliases into ONE canonical name and list the variants in aliases.
5. confidence is 0..1: 1.0 for an explicit script cue, ~0.7 for a clear inference, <0.4 when guessing.

Respond with JSON only, no prose, in this exact shape:
{"assignments":[{"i":0,"speaker":"The Traveller","confidence":0.8}],
 "characters":[{"name":"The Traveller","aliases":[],"gender":"male","ageRange":"adult","description":"weary, searching"}]}
"characters" must contain every speaker you used in assignments except "Narrator", including ones already in the roster.`;

function parseJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("The analysis model returned an unreadable response.");
  }
}

export const analyzeChunk = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const userPrompt = [
      `Book: ${data.title}`,
      `Known roster: ${JSON.stringify(data.roster)}`,
      data.mode === "passage" ? "Passages:" : "Lines:",
      JSON.stringify(data.lines),
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: data.mode === "passage" ? PASSAGE_SYSTEM : SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("RATE_LIMIT: too many requests, slowing down.");
      if (res.status === 402)
        throw new Error("Out of AI credits — add credits in Lovable to continue analysis.");
      throw new Error(`Analysis failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = parseJson(content) as AnalyzeResult;

    return {
      assignments: Array.isArray(parsed.assignments)
        ? parsed.assignments
            .filter((a) => typeof a?.i === "number" && typeof a?.speaker === "string")
            .map((a) => ({
              i: a.i,
              speaker: a.speaker.trim(),
              confidence: Math.max(0, Math.min(1, Number(a.confidence) || 0.5)),
            }))
        : [],
      characters: Array.isArray(parsed.characters)
        ? parsed.characters
            .filter((c) => typeof c?.name === "string" && c.name.trim())
            .map((c) => RosterEntry.parse({ ...c, name: c.name.trim() }))
        : [],
    };
  });
