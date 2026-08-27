import { base64ToPcm, pcmToWavBlob } from "./audio";
import { getClip, putClip } from "./clip-cache";
import { hashKey } from "./id";
import { synthesizeClip } from "./tts.functions";

let current: HTMLAudioElement | null = null;

export function stopPreview() {
  if (current) {
    current.pause();
    current = null;
  }
}

export async function playSample(text: string, voice: string, instructions = ""): Promise<void> {
  const trimmed = text.slice(0, 240);
  const key = `preview-${hashKey(trimmed, voice, instructions)}`;
  let pcm = await getClip(key);
  if (!pcm) {
    const res = await synthesizeClip({
      data: { text: trimmed, voice, instructions, speed: 1 },
    });
    pcm = base64ToPcm(res.audio);
    await putClip(key, pcm);
  }
  stopPreview();
  const url = URL.createObjectURL(pcmToWavBlob(pcm));
  const audio = new Audio(url);
  current = audio;
  audio.addEventListener("ended", () => URL.revokeObjectURL(url));
  await audio.play();
}
