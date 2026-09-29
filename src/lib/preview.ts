import { base64ToPcm, changeRate, pcmToWavBlob } from "./audio";
import { getClip, putClip } from "./clip-cache";
import { hashKey } from "./id";
import { synthesizeClip } from "./tts.functions";
import { HINDI_SAMPLE } from "./voices";

let current: HTMLAudioElement | null = null;

export function stopPreview() {
  if (current) {
    current.pause();
    current = null;
  }
}

export async function playSample(text: string, voice: string, instructions = "", speed = 1, settings?: { stability: number; style: number }, delivery?: { model: "eleven_v3" | "eleven_multilingual_v2"; tag: string | null }): Promise<void> {
  const v3 = delivery?.model === "eleven_v3";
  const trimmed = (text.trim() || HINDI_SAMPLE).slice(0, 240);
  const key = `preview-${hashKey(trimmed, voice, instructions, ...(speed === 1 ? [] : [String(speed)]), ...(settings ? [String(settings.stability), String(settings.style)] : []), ...(v3 ? ["v3", delivery?.tag ?? ""] : []))}`;
  let pcm = await getClip(key);
  if (!pcm) {
    const res = await synthesizeClip({
      data: { text: trimmed, voice, instructions, speed, ...(settings ?? {}), ...(v3 ? { model: "eleven_v3" as const, ...(delivery?.tag ? { emotionTag: delivery.tag as never } : {}) } : {}) },
    });
    pcm = base64ToPcm(res.audio);
    if (v3) pcm = changeRate(pcm, speed);
    await putClip(key, pcm);
  }
  stopPreview();
  const url = URL.createObjectURL(pcmToWavBlob(pcm));
  const audio = new Audio(url);
  current = audio;
  audio.addEventListener("ended", () => URL.revokeObjectURL(url));
  await audio.play();
}
