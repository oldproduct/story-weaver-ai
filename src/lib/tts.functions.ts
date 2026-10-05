import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "./auth.server";
import { assertSpeakableText, stripVoiceTags } from "./voice-tags";

const TAGS = ["[whispers]","[angry]","[sad]","[crying]","[laughs]","[excited]","[nervous]","[serious]","[flirtatious]","[sarcastic]"] as const;

const SynthInput = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().min(1),
  instructions: z.string().max(600).default(""),
  speed: z.number().min(0.7).max(1.2).default(1),
  stability: z.number().min(0).max(1).default(0.5),
  style: z.number().min(0).max(1).default(0.3),
  model: z.enum(["eleven_multilingual_v2", "eleven_v3"]).default("eleven_multilingual_v2"),
  emotionTag: z.enum(TAGS).optional(),
});

/**
 * Synthesize one clip with ElevenLabs (multilingual v2, good Hindi coverage).
 * Returns raw 24kHz mono 16-bit PCM as base64 so the browser can stitch clips,
 * insert pauses, normalize, and encode MP3 locally.
 */
export const synthesizeClip = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SynthInput.parse(input))
  .handler(async ({ data }): Promise<{ audio: string }> => {
    await requireSession();
    const key = process.env["ELEVENLABS_API_KEY"];
    if (!key) throw new Error("The voice engine is not connected for this project.");

    // Control tags such as "(voice: Riya)" are metadata — never speak them.
    const spoken = assertSpeakableText(stripVoiceTags(data.text));
    if (!spoken) throw new Error("Nothing to speak after removing voice metadata.");

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(data.voice)}?output_format=pcm_24000`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data.model === "eleven_v3" ? {
          // Cue is added after the metadata guard; it is a fixed allow-listed tag.
          text: data.emotionTag ? `${data.emotionTag} ${spoken}` : spoken,
          model_id: "eleven_v3",
          // Pin Hindi so the expressive model doesn't drift into another language.
          ...(/[\u0900-\u097F]/.test(spoken) ? { language_code: "hi" } : {}),
          voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true },
        } : {
          text: spoken,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: data.stability,
            similarity_boost: 0.75,
            style: data.style,
            use_speaker_boost: true,
            speed: data.speed,
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429 || res.status === 529) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "0");
        throw new Error(
          `RATE_LIMIT:${Number.isFinite(retryAfter) ? retryAfter : 0}: voice engine is busy, slowing down.`,
        );
      }
      if (res.status === 401 || res.status === 403)
        throw new Error("The ElevenLabs key was rejected — reconnect it and try again.");
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
