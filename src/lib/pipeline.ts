import { analyzeChunk } from "./ai.functions";
import { synthesizeClip } from "./tts.functions";
import { base64ToPcm, concatPcm, durationMs, normalize, silence, trimSilence } from "./audio";
import { getClip, putClip } from "./clip-cache";
import { hashKey, uid } from "./id";
import { suggestVoice } from "./voices";
import { SUPPORTING_ID, type CharacterProfile, type ProjectState, type Segment } from "./types";

const CHUNK_SIZE = 24;

/** Guard against a stalled request that never settles. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function normName(s: string): string {
  return s.toLowerCase().replace(/^(the|dr|mr|mrs|ms|miss|lord|lady|sir|captain)\.?\s+/i, "").trim();
}

export interface AnalysisProgress {
  done: number;
  total: number;
  charactersFound: number;
}

interface RosterEntry {
  name: string;
  aliases: string[];
  gender: "male" | "female" | "unknown";
  ageRange: string;
  description: string;
}

export async function runAnalysis(
  project: ProjectState,
  onProgress: (p: AnalysisProgress) => void,
  shouldStop: () => boolean,
): Promise<{ segments: Segment[]; characters: CharacterProfile[] }> {
  const dialogue = project.segments.filter((s) => s.kind === "dialogue");
  const roster = new Map<string, RosterEntry>();
  const assignments = new Map<string, { speaker: string; confidence: number }>();

  const chunks: Segment[][] = [];
  for (let i = 0; i < dialogue.length; i += CHUNK_SIZE) {
    chunks.push(dialogue.slice(i, i + CHUNK_SIZE));
  }

  let done = 0;
  for (const chunk of chunks) {
    if (shouldStop()) break;
    const lines = chunk.map((s, idx) => ({ i: idx, text: s.text, context: s.context }));

    let result: Awaited<ReturnType<typeof analyzeChunk>> | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        result = await withTimeout(
          analyzeChunk({
            data: {
              lines,
              roster: [...roster.values()].slice(0, 40),
              title: project.fileName,
            },
          }),
          90_000,
          "speaker analysis",
        );
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if ((msg.includes("RATE_LIMIT") || msg.includes("TIMEOUT")) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    if (!result) continue;

    for (const c of result.characters) {
      const key = normName(c.name);
      const existing = roster.get(key);
      if (existing) {
        existing.aliases = [...new Set([...existing.aliases, ...c.aliases])];
        if (existing.gender === "unknown") existing.gender = c.gender;
        if (!existing.description) existing.description = c.description;
      } else {
        roster.set(key, { ...c });
      }
      for (const alias of c.aliases) {
        const ak = normName(alias);
        if (ak && ak !== key && !roster.has(ak)) {
          roster.set(ak, roster.get(key)!);
        }
      }
    }

    for (const a of result.assignments) {
      const seg = chunk[a.i];
      if (!seg) continue;
      assignments.set(seg.id, { speaker: a.speaker, confidence: a.confidence });
    }

    done += chunk.length;
    onProgress({
      done,
      total: dialogue.length,
      charactersFound: new Set([...roster.values()].map((r) => r.name)).size,
    });
  }

  // Canonicalize: one profile per distinct roster entry object.
  const canonical = new Map<RosterEntry, CharacterProfile>();
  const byLookup = new Map<string, CharacterProfile>();

  const ensureProfile = (entry: RosterEntry): CharacterProfile => {
    const found = canonical.get(entry);
    if (found) return found;
    const profile: CharacterProfile = {
      id: uid("chr"),
      name: entry.name,
      aliases: entry.aliases.filter((a) => normName(a) !== normName(entry.name)),
      gender: entry.gender,
      ageRange: entry.ageRange,
      description: entry.description,
      isNarrator: false,
      lineCount: 0,
      wordCount: 0,
      firstChapter: Number.MAX_SAFE_INTEGER,
      role: "supporting",
      voiceId: null,
      instructions: "",
    };
    canonical.set(entry, profile);
    byLookup.set(normName(entry.name), profile);
    for (const alias of entry.aliases) byLookup.set(normName(alias), profile);
    return profile;
  };

  for (const entry of new Set(roster.values())) ensureProfile(entry);

  const narrator: CharacterProfile = {
    id: "narrator",
    name: "Narrator",
    aliases: [],
    gender: "unknown",
    ageRange: "adult",
    description: "Reads all prose outside of quoted dialogue.",
    isNarrator: true,
    lineCount: 0,
    wordCount: 0,
    firstChapter: 0,
    role: "narrator",
    voiceId: null,
    instructions: "Read as an audiobook narrator: steady, warm, unhurried.",
  };

  const unknown: CharacterProfile = {
    id: SUPPORTING_ID,
    name: "Unassigned / minor voices",
    aliases: [],
    gender: "unknown",
    ageRange: "adult",
    description: "Pooled voice for one-off and unattributed lines.",
    isNarrator: false,
    lineCount: 0,
    wordCount: 0,
    firstChapter: 0,
    role: "supporting",
    voiceId: null,
    instructions: "",
  };

  const chapterIndex = new Map(project.chapters.map((c) => [c.id, c.index]));

  const segments = project.segments.map((seg) => {
    if (seg.kind === "narration") {
      narrator.lineCount += 1;
      narrator.wordCount += (seg.text.match(/\S+/g) ?? []).length;
      return { ...seg, speakerId: "narrator", confidence: 1 };
    }
    const a = assignments.get(seg.id);
    const profile = a ? byLookup.get(normName(a.speaker)) : undefined;
    const target = profile ?? unknown;
    target.lineCount += 1;
    target.wordCount += (seg.text.match(/\S+/g) ?? []).length;
    const ci = chapterIndex.get(seg.chapterId) ?? 0;
    if (ci < target.firstChapter) target.firstChapter = ci;
    return {
      ...seg,
      speakerId: target.id,
      rawSpeaker: a?.speaker ?? "Unknown",
      confidence: profile ? (a?.confidence ?? 0.5) : 0.2,
    };
  });

  const speakers = [...canonical.values()].filter((c) => c.lineCount > 0);
  speakers.sort((a, b) => b.lineCount - a.lineCount);

  const planned = planVoices(speakers);
  const characters: CharacterProfile[] = [narrator, ...planned];
  if (unknown.lineCount > 0) characters.push(unknown);

  assignSuggestedVoices(characters);
  return { segments, characters };
}

/** Decide the minimum sensible voice set: leads get their own voice, the tail shares one. */
export function planVoices(speakers: CharacterProfile[]): CharacterProfile[] {
  const totalLines = speakers.reduce((n, s) => n + s.lineCount, 0) || 1;
  const maxLeads = 5;
  let leads = 0;
  return speakers.map((s) => {
    const share = s.lineCount / totalLines;
    const isLead = leads < maxLeads && (share >= 0.06 || s.lineCount >= 8);
    if (isLead) leads += 1;
    return { ...s, role: isLead ? "lead" : "supporting" };
  });
}

export function assignSuggestedVoices(characters: CharacterProfile[]): void {
  const used = new Set<string>();
  for (const c of characters) {
    if (c.voiceId) used.add(c.voiceId);
  }
  for (const c of characters) {
    if (c.voiceId) continue;
    if (c.role === "supporting" && !c.isNarrator && c.id !== SUPPORTING_ID) continue;
    c.voiceId = suggestVoice(c.gender, used);
    used.add(c.voiceId);
    if (!c.instructions && !c.isNarrator) {
      c.instructions = c.description
        ? `Voice this character: ${c.description.replace(/\.\s*$/, "")}. Age ${c.ageRange}.`
        : "";
    }
  }
}

export function voiceForSegment(
  segment: Segment,
  characters: CharacterProfile[],
  sharedVoiceId: string | null,
): { voice: string; instructions: string } | null {
  const character = characters.find((c) => c.id === segment.speakerId);
  if (!character) return null;
  if (character.isNarrator || character.role === "lead") {
    return character.voiceId
      ? { voice: character.voiceId, instructions: character.instructions }
      : null;
  }
  const shared = sharedVoiceId ?? characters.find((c) => c.id === SUPPORTING_ID)?.voiceId;
  return shared ? { voice: shared, instructions: "" } : null;
}

export function clipKey(text: string, voice: string, instructions: string): string {
  return hashKey(text, voice, instructions);
}

/** Split overlong segment text so each TTS request stays comfortably in range. */
function splitForTts(text: string, maxChars = 1400): string[] {
  if (text.length <= maxChars) return [text];
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length > maxChars) {
      out.push(cur.trim());
      cur = "";
    }
    if (s.length > maxChars) {
      const words = s.match(/\S+/g) ?? [];
      let piece = "";
      for (const w of words) {
        if (piece.length + w.length + 1 > maxChars) {
          out.push(piece.trim());
          piece = "";
        }
        piece += `${w} `;
      }
      cur += piece;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export interface GenerationProgress {
  done: number;
  total: number;
  cached: number;
  current: string;
}

export interface GenerationPlanItem {
  segmentId: string;
  key: string;
  text: string;
  voice: string;
  instructions: string;
}

export function buildPlan(project: ProjectState): GenerationPlanItem[] {
  const items: GenerationPlanItem[] = [];
  for (const seg of [...project.segments].sort((a, b) => a.order - b.order)) {
    const assignment = voiceForSegment(seg, project.characters, project.sharedVoiceId);
    if (!assignment) continue;
    items.push({
      segmentId: seg.id,
      key: clipKey(seg.text, assignment.voice, assignment.instructions),
      text: seg.text,
      voice: assignment.voice,
      instructions: assignment.instructions,
    });
  }
  return items;
}

export async function missingClips(plan: GenerationPlanItem[]): Promise<GenerationPlanItem[]> {
  const missing: GenerationPlanItem[] = [];
  for (const item of plan) {
    const cached = await getClip(item.key);
    if (!cached) missing.push(item);
  }
  return missing;
}

async function synthOne(item: GenerationPlanItem): Promise<Int16Array> {
  const pieces = splitForTts(item.text);
  const parts: Int16Array[] = [];
  for (const piece of pieces) {
    let audio: string | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await withTimeout(
          synthesizeClip({
            data: { text: piece, voice: item.voice, instructions: item.instructions, speed: 1 },
          }),
          120_000,
          "narration clip",
        );
        audio = res.audio;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if ((msg.includes("RATE_LIMIT") || msg.includes("TIMEOUT")) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    if (!audio) throw new Error("The voice engine returned no audio.");
    parts.push(trimSilence(base64ToPcm(audio)));
    if (pieces.length > 1) parts.push(silence(180));
  }
  return normalize(concatPcm(parts));
}

export async function generateClips(
  plan: GenerationPlanItem[],
  onProgress: (p: GenerationProgress) => void,
  shouldStop: () => boolean,
  concurrency = 3,
): Promise<Record<string, { key: string; durationMs: number }>> {
  const result: Record<string, { key: string; durationMs: number }> = {};
  let done = 0;
  let cached = 0;
  let cursor = 0;

  const worker = async () => {
    while (cursor < plan.length && !shouldStop()) {
      const index = cursor++;
      const item = plan[index];
      if (!item) return;
      let pcm = await getClip(item.key);
      if (pcm) {
        cached += 1;
      } else {
        pcm = await synthOne(item);
        await putClip(item.key, pcm);
      }
      result[item.segmentId] = { key: item.key, durationMs: durationMs(pcm) };
      done += 1;
      onProgress({ done, total: plan.length, cached, current: item.text.slice(0, 70) });
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, plan.length) }, worker));
  return result;
}

const PAUSE_SAME = 180;
const PAUSE_SPEAKER_CHANGE = 380;
const PAUSE_PARAGRAPH = 300;

export async function assembleChapter(
  project: ProjectState,
  chapterId: string,
): Promise<Int16Array> {
  const segs = project.segments
    .filter((s) => s.chapterId === chapterId)
    .sort((a, b) => a.order - b.order);
  const parts: Int16Array[] = [];
  let lastSpeaker: string | null = null;
  for (const seg of segs) {
    const clip = project.clips[seg.id];
    if (!clip) continue;
    const pcm = await getClip(clip.key);
    if (!pcm) continue;
    if (parts.length > 0) {
      const gap =
        seg.speakerId !== lastSpeaker
          ? PAUSE_SPEAKER_CHANGE
          : seg.kind === "narration"
            ? PAUSE_PARAGRAPH
            : PAUSE_SAME;
      parts.push(silence(gap));
    }
    parts.push(pcm);
    lastSpeaker = seg.speakerId;
  }
  return normalize(concatPcm(parts));
}

export async function assembleBook(project: ProjectState): Promise<Int16Array> {
  const parts: Int16Array[] = [];
  for (const chapter of project.chapters) {
    const pcm = await assembleChapter(project, chapter.id);
    if (pcm.length === 0) continue;
    if (parts.length > 0) parts.push(silence(1100));
    parts.push(pcm);
  }
  return concatPcm(parts);
}
