import { uid } from "./id";
import type { CharacterProfile, Segment } from "./types";
import { stripVoiceTags, voiceTagName } from "./voice-tags";

/** Pure editing helpers for the Review lines screen. Every changed line is locked (manual). */

function sorted(segments: Segment[]): Segment[] {
  return [...segments].sort((a, b) => a.order - b.order);
}

function renumber(segments: Segment[]): Segment[] {
  return segments.map((s, i) => (s.order === i ? s : { ...s, order: i }));
}

function lock(seg: Segment): Segment {
  return { ...seg, manual: true, confidence: 1, edited: true };
}

/** Apply a typed "(voice: Name)" tag: strip it and switch the speaker when the name is known. */
function applyTypedTag(seg: Segment, raw: string, characters: CharacterProfile[]): Segment {
  const name = voiceTagName(raw);
  const text = stripVoiceTags(raw);
  let next: Segment = { ...seg, text };
  if (name) {
    const lower = name.toLowerCase();
    const match = characters.find(
      (c) => c.name.toLowerCase() === lower || c.aliases.some((a) => a.toLowerCase() === lower),
    );
    if (match) {
      next = { ...next, speakerId: match.id, kind: match.isNarrator ? "narration" : "dialogue" };
    }
  }
  return next;
}

export function editSegmentText(
  segments: Segment[],
  id: string,
  rawText: string,
  characters: CharacterProfile[] = [],
): Segment[] {
  const text = stripVoiceTags(rawText);
  if (!text) return segments;
  return segments.map((s) => (s.id === id ? lock(applyTypedTag(s, rawText, characters)) : s));
}

export type CombineResult = { ok: true; segments: Segment[] } | { ok: false; reason: string };

/** Merge lines that sit next to each other in one chapter. Keeps the first line's speaker and delivery. */
export function combineSegments(segments: Segment[], ids: string[]): CombineResult {
  if (ids.length < 2) return { ok: false, reason: "Select at least two lines to combine." };
  const list = sorted(segments);
  const idSet = new Set(ids);
  const positions = list.map((s, i) => (idSet.has(s.id) ? i : -1)).filter((i) => i >= 0);
  if (positions.length !== ids.length) return { ok: false, reason: "Some selected lines no longer exist." };
  for (let k = 1; k < positions.length; k++) {
    if (positions[k] !== (positions[k - 1] ?? 0) + 1) {
      return { ok: false, reason: "Only lines next to each other can be combined." };
    }
  }
  const picked = positions.map((i) => list[i] as Segment);
  const first = picked[0] as Segment;
  if (picked.some((s) => s.chapterId !== first.chapterId)) {
    return { ok: false, reason: "Lines from different chapters can't be combined." };
  }
  const merged = lock({ ...first, text: picked.map((s) => s.text.trim()).join(" ") });
  const out: Segment[] = [];
  list.forEach((s, i) => {
    if (i === positions[0]) out.push(merged);
    else if (!idSet.has(s.id)) out.push(s);
  });
  return { ok: true, segments: renumber(out) };
}

/** Cut one line in two at a character offset. Both halves keep the speaker. */
export function splitSegment(segments: Segment[], id: string, offset: number, textOverride?: string): Segment[] {
  const list = sorted(segments);
  const idx = list.findIndex((s) => s.id === id);
  const seg = list[idx];
  if (!seg) return segments;
  const text = textOverride ?? seg.text;
  const a = text.slice(0, offset).trim();
  const b = text.slice(offset).trim();
  if (!a || !b) return segments;
  const first = lock({ ...seg, text: a });
  const second = lock({ ...seg, id: uid("seg"), text: b });
  list.splice(idx, 1, first, second);
  return renumber(list);
}

export function deleteSegment(segments: Segment[], id: string): Segment[] {
  return renumber(sorted(segments).filter((s) => s.id !== id));
}

/** Move by one real neighbour, never across chapters. Preserve text and delivery for cached audio. */
export function moveSegment(segments: Segment[], id: string, direction: "up" | "down"): Segment[] {
  const list = sorted(segments);
  const index = list.findIndex((s) => s.id === id);
  if (index < 0) return segments;
  const targetIndex = index + (direction === "up" ? -1 : 1);
  const current = list[index];
  const neighbour = list[targetIndex];
  if (!current || !neighbour || current.chapterId !== neighbour.chapterId) return segments;
  list[index] = lock(neighbour);
  list[targetIndex] = lock(current);
  return renumber(list);
}
