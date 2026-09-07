import { get, set, del } from "idb-keyval";
import { useSyncExternalStore } from "react";
import type { CharacterProfile, ProjectState, Segment } from "./types";
import { VOICES } from "./voices";

const KEY = "audiobook-project";

let state: ProjectState | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function persist() {
  if (state) void set(KEY, state);
  else void del(KEY);
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProject(): ProjectState | null {
  return state;
}

export function isHydrated(): boolean {
  return hydrated;
}

export async function hydrate(): Promise<void> {
  if (hydrated) return;
  const saved = await get<ProjectState>(KEY);
  if (saved) state = migrate(saved);
  hydrated = true;
  emit();
}

/** Older sessions stored voice ids from the previous engine — drop them. */
function migrate(p: ProjectState): ProjectState {
  const valid = new Set(VOICES.map((v) => v.id));
  const characters = p.characters.map((c) =>
    c.voiceId && !valid.has(c.voiceId) ? { ...c, voiceId: null } : c,
  );
  const sharedVoiceId = p.sharedVoiceId && valid.has(p.sharedVoiceId) ? p.sharedVoiceId : null;
  return { ...p, characters, sharedVoiceId };
}


export function setProject(next: ProjectState | null) {
  state = next;
  persist();
  emit();
}

export function updateProject(fn: (p: ProjectState) => ProjectState) {
  if (!state) return;
  state = fn(state);
  persist();
  emit();
}

export function updateSegments(fn: (s: Segment[]) => Segment[]) {
  updateProject((p) => ({ ...p, segments: fn(p.segments) }));
}

export function updateCharacters(fn: (c: CharacterProfile[]) => CharacterProfile[]) {
  updateProject((p) => ({ ...p, characters: fn(p.characters) }));
}

export function useProject(): ProjectState | null {
  return useSyncExternalStore(subscribe, getProject, () => null);
}

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, isHydrated, () => false);
}
