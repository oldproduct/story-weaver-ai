import { get, set, del } from "idb-keyval";
import { useSyncExternalStore } from "react";
import type { CharacterProfile, ProjectState, Segment } from "./types";

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
  if (saved) state = saved;
  hydrated = true;
  emit();
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
