export const SAMPLE_RATE = 24000;

export function base64ToPcm(b64: string): Int16Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const usable = bytes.length - (bytes.length % 2);
  return new Int16Array(bytes.buffer.slice(0, usable));
}

export function silence(ms: number): Int16Array {
  return new Int16Array(Math.round((SAMPLE_RATE * ms) / 1000));
}

export function concatPcm(parts: Int16Array[]): Int16Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function durationMs(pcm: Int16Array): number {
  return Math.round((pcm.length / SAMPLE_RATE) * 1000);
}

/** Peak-normalize toward a target ceiling, with a gentle gain cap. */
export function normalize(pcm: Int16Array, targetPeak = 0.89): Int16Array {
  let peak = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.abs(pcm[i] ?? 0);
    if (v > peak) peak = v;
  }
  if (peak === 0) return pcm;
  const gain = Math.min((targetPeak * 32767) / peak, 4);
  if (Math.abs(gain - 1) < 0.02) return pcm;
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round((pcm[i] ?? 0) * gain)));
  }
  return out;
}

/** Trim near-silent lead-in/out so joins between clips feel tight. */
export function trimSilence(pcm: Int16Array, threshold = 220): Int16Array {
  let start = 0;
  let end = pcm.length;
  while (start < end && Math.abs(pcm[start] ?? 0) < threshold) start++;
  while (end > start && Math.abs(pcm[end - 1] ?? 0) < threshold) end--;
  const pad = Math.round(SAMPLE_RATE * 0.02);
  return pcm.subarray(Math.max(0, start - pad), Math.min(pcm.length, end + pad));
}

export async function encodeMp3(pcm: Int16Array, kbps = 96): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(1, SAMPLE_RATE, kbps);
  const chunks: Uint8Array[] = [];
  const BLOCK = 1152 * 20;
  for (let i = 0; i < pcm.length; i += BLOCK) {
    const buf = encoder.encodeBuffer(pcm.subarray(i, i + BLOCK) as Int16Array);
    if (buf.length > 0) chunks.push(new Uint8Array(buf));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));
  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}

export function pcmToWavBlob(pcm: Int16Array): Blob {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const dataSize = pcm.length * 2;
  const write = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, dataSize, true);
  return new Blob([header, pcm.buffer.slice(0) as ArrayBuffer], { type: "audio/wav" });
}
