import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SynthInput = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().min(1),
  instructions: z.string().max(600).default(""),
  speed: z.number().min(0.5).max(1.5).default(1),
});

/**
 * Synthesize one clip. Returns raw 24kHz mono 16-bit PCM as base64 so the
 * browser can stitch clips, insert pauses, normalize, and encode MP3 locally.
 */
export const synthesizeClip = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SynthInput.parse(input))
  .handler(async ({ data }): Promise<{ audio: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("The voice engine is not configured for this project.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: data.text,
        voice: data.voice,
        ...(data.instructions ? { instructions: data.instructions } : {}),
        speed: data.speed,
        response_format: "pcm",
        stream_format: "audio",
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("RATE_LIMIT: voice engine is busy, slowing down.");
      if (res.status === 402)
        throw new Error("Out of AI credits — add credits in Lovable to keep generating audio.");
      throw new Error(`Narration failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return { audio: btoa(binary) };
  });
