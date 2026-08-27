let counter = 0;

export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Stable non-cryptographic hash used for clip cache keys. */
export function hashKey(...parts: string[]): string {
  const input = parts.join("\u0000");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c + 1, 2246822519) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`;
}
