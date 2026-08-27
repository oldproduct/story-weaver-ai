import { get, set, del, keys } from "idb-keyval";

const PREFIX = "clip:";

export async function getClip(key: string): Promise<Int16Array | null> {
  const buf = await get<ArrayBuffer>(PREFIX + key);
  return buf ? new Int16Array(buf) : null;
}

export async function putClip(key: string, pcm: Int16Array): Promise<void> {
  await set(PREFIX + key, pcm.slice().buffer);
}

export async function dropClip(key: string): Promise<void> {
  await del(PREFIX + key);
}

export async function clipCount(): Promise<number> {
  const all = await keys();
  return all.filter((k) => typeof k === "string" && k.startsWith(PREFIX)).length;
}

export async function clearClips(): Promise<void> {
  const all = await keys();
  await Promise.all(
    all
      .filter((k) => typeof k === "string" && k.startsWith(PREFIX))
      .map((k) => del(k as string)),
  );
}
