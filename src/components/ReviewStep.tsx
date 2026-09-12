import { useMemo, useState } from "react";
import { Check, Loader2, ScanSearch, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { refineLines } from "@/lib/ai.functions";
import { alternationFill, assignSuggestedVoices, isSettled, recountCharacters } from "@/lib/pipeline";
import { updateProject } from "@/lib/store";
import { uid } from "@/lib/id";
import { cn } from "@/lib/utils";
import { SUPPORTING_ID, type CharacterProfile, type ProjectState, type Segment } from "@/lib/types";

type Filter = "all" | "uncertain";

const PAGE = 150;
const UNCERTAIN = 0.7;

function confidenceBadge(seg: Segment) {
  if (seg.manual) {
    return (
      <span className="inline-flex items-center rounded bg-[#F0FDF4] px-1.5 py-0.5 text-[10px] font-medium text-[#15803D] border border-[#DCFCE7]">
        Locked by you
      </span>
    );
  }
  if (seg.confidence >= UNCERTAIN) {
    return (
      <span className="inline-flex items-center rounded bg-[#F0FDF4] px-1.5 py-0.5 text-[10px] font-medium text-[#15803D] border border-[#DCFCE7]">
        {Math.round(seg.confidence * 100)}% sure
      </span>
    );
  }
  if (seg.confidence >= 0.4) {
    return (
      <span className="inline-flex items-center rounded bg-[#FFFBEB] px-1.5 py-0.5 text-[10px] font-medium text-[#B45309] border border-[#FEF3C7]">
        {Math.round(seg.confidence * 100)}% uncertain
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded bg-[#FEF2F2] px-1.5 py-0.5 text-[10px] font-medium text-[#B91C1C] border border-[#FEE2E2]">
      {Math.round(seg.confidence * 100)}% check
    </span>
  );
}

function speakerName(id: string | null, characters: CharacterProfile[]): string {
  return characters.find((c) => c.id === id)?.name ?? "Unassigned";
}

export function ReviewStep({
  project,
  onDone,
  onBack,
}: {
  project: ProjectState;
  onDone: () => void;
  onBack: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [speakerFilter, setSpeakerFilter] = useState<string>("any");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const ordered = useMemo(
    () => [...project.segments].sort((a, b) => a.order - b.order),
    [project.segments],
  );
  const chapterTitle = useMemo(
    () => new Map(project.chapters.map((c) => [c.id, c.title])),
    [project.chapters],
  );

  const uncertainCount = ordered.filter((s) => !isSettled(s)).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered.filter((s) => {
      if (filter === "uncertain" && isSettled(s)) return false;
      if (speakerFilter !== "any" && s.speakerId !== speakerFilter) return false;
      if (q && !s.text.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ordered, filter, speakerFilter, query]);

  const shown = visible.slice(0, limit);

  const applySegments = (fn: (segments: Segment[]) => Segment[]) => {
    updateProject((p) => {
      const segments = fn(p.segments);
      return { ...p, segments, characters: recountCharacters(segments, p.characters) };
    });
  };

  const setSpeaker = (ids: string[], speakerId: string) => {
    const idSet = new Set(ids);
    applySegments((segments) =>
      segments.map((s) =>
        idSet.has(s.id) ? { ...s, speakerId, confidence: 1, manual: true } : s,
      ),
    );
  };

  const addSpeaker = (ids: string[]) => {
    const name = window.prompt("Name for the new speaker")?.trim();
    if (!name) return;
    const character: CharacterProfile = {
      id: uid("chr"),
      name,
      aliases: [],
      gender: "unknown",
      ageRange: "adult",
      description: "",
      isNarrator: false,
      lineCount: 0,
      wordCount: 0,
      firstChapter: 0,
      role: "lead",
      voiceId: null,
      instructions: "",
    };
    const idSet = new Set(ids);
    updateProject((p) => {
      const segments = p.segments.map((s) =>
        idSet.has(s.id) ? { ...s, speakerId: character.id, confidence: 1, manual: true } : s,
      );
      const characters = recountCharacters(segments, [...p.characters, character]);
      // A brand-new speaker needs a voice or its lines would be skipped at generation.
      assignSuggestedVoices(characters);
      return { ...p, segments, characters };
    });
    toast.success(`${name} added — pick a voice on the Cast screen.`);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runFill = () => {
    const { segments, filled } = alternationFill(project.segments);
    if (!filled) {
      toast.message("No clear alternating pattern left to fill.");
      return;
    }
    applySegments(() => segments);
    toast.success(`Filled ${filled} line${filled === 1 ? "" : "s"} from the conversation pattern.`);
  };

  const runRedetect = async () => {
    const targets = ordered.filter((s) => !isSettled(s));
    if (targets.length === 0) {
      toast.message("Every line is already settled.");
      return;
    }
    setBusy(true);
    try {
      const cast = project.characters.filter((c) => !c.isNarrator).map((c) => c.name);
      const nameToId = new Map(project.characters.map((c) => [c.name.toLowerCase(), c.id]));
      const indexOf = new Map(ordered.map((s, i) => [s.id, i]));
      const updates = new Map<string, { speakerId: string; confidence: number }>();

      for (let start = 0; start < targets.length; start += 20) {
        const batch = targets.slice(start, start + 20);
        const lines = batch.map((s, i) => {
          const idx = indexOf.get(s.id) ?? 0;
          const before = ordered.slice(0, idx).reverse().find(isSettled);
          const after = ordered.slice(idx + 1).find(isSettled);
          return {
            i,
            text: s.text,
            context: s.context,
            before: before
              ? `${speakerName(before.speakerId, project.characters)}: ${before.text.slice(0, 120)}`
              : "",
            after: after
              ? `${speakerName(after.speakerId, project.characters)}: ${after.text.slice(0, 120)}`
              : "",
            current: speakerName(s.speakerId, project.characters),
          };
        });

        const res = await refineLines({
          data: { lines, cast, title: project.fileName },
        });
        for (const a of res.assignments) {
          const seg = batch[a.i];
          if (!seg) continue;
          const key = a.speaker.toLowerCase();
          const id =
            key === "narrator"
              ? "narrator"
              : key === "unknown"
                ? SUPPORTING_ID
                : nameToId.get(key);
          if (!id) continue;
          updates.set(seg.id, { speakerId: id, confidence: a.confidence });
        }
      }

      if (updates.size === 0) {
        toast.message("The model could not resolve any of the uncertain lines.");
        return;
      }
      applySegments((segments) =>
        segments.map((s) => {
          const u = updates.get(s.id);
          return u && !s.manual ? { ...s, speakerId: u.speakerId, confidence: u.confidence } : s;
        }),
      );
      toast.success(`Re-checked ${updates.size} uncertain line${updates.size === 1 ? "" : "s"}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Re-detection failed.");
    } finally {
      setBusy(false);
    }
  };

  const options = project.characters;

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-selected px-2.5 py-0.5 text-[11px] font-medium text-default mb-2">
          <Check className="size-3 text-strong" />
          Step 4 · Attribution Review
        </div>
        <h2 className="text-[18px] font-medium text-strong">Review & refine speaker lines</h2>
        <p className="mt-1 max-w-xl text-[13px] text-default">
          Every line with its AI-assigned speaker and confidence score. Fix any mismatch — your choices are locked in and never overwritten.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <span className="text-[13px] text-default">
          <strong className="font-mono text-strong">{uncertainCount}</strong> uncertain of{" "}
          {ordered.length} lines
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="h-8 text-[12px]" onClick={runFill} disabled={busy}>
            <Wand2 className="size-3.5" />
            Fill from pattern
          </Button>
          <Button size="sm" variant="secondary" className="h-8 text-[12px]" onClick={() => void runRedetect()} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ScanSearch className="size-3.5" />}
            Re-detect uncertain
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="h-8 text-[12px]"
          variant={filter === "all" ? "default" : "ghost"}
          onClick={() => setFilter("all")}
        >
          All lines
        </Button>
        <Button
          size="sm"
          className="h-8 text-[12px]"
          variant={filter === "uncertain" ? "default" : "ghost"}
          onClick={() => setFilter("uncertain")}
        >
          Low confidence
        </Button>
        <Select value={speakerFilter} onValueChange={setSpeakerFilter}>
          <SelectTrigger className="h-8 w-48 text-[12px]">
            <SelectValue placeholder="Any speaker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any speaker</SelectItem>
            {options.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the text…"
          className="h-8 w-52 text-[12px]"
        />
      </div>

      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-[12px] font-medium text-strong">{selected.size} selected</span>
          <Select value="" onValueChange={(v) => {
            const ids = [...selected];
            if (v === "__new") addSpeaker(ids);
            else setSpeaker(ids, v);
            setSelected(new Set());
          }}>
            <SelectTrigger className="h-8 w-52 text-[12px]">
              <SelectValue placeholder="Assign all to…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value="__new">New speaker…</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" className="h-8 text-[12px]" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {shown.map((seg, i) => {
          const prev = shown[i - 1];
          const newChapter = !prev || prev.chapterId !== seg.chapterId;
          return (
            <div key={seg.id}>
              {newChapter && (
                <p className="mb-2 mt-5 text-[12px] font-medium uppercase tracking-wider text-subtle">
                  {chapterTitle.get(seg.chapterId) ?? "Chapter"}
                </p>
              )}
              <div
                className={cn(
                  "flex flex-wrap items-start gap-3 rounded-lg border border-border bg-card p-3 text-[13px] shadow-2xs transition-all hover:border-default/30",
                  !isSettled(seg) && "border-amber-200/60 bg-amber-50/20",
                )}
              >
                <Checkbox
                  className="mt-1"
                  checked={selected.has(seg.id)}
                  onCheckedChange={() => toggle(seg.id)}
                  aria-label="Select line"
                />
                <div className="min-w-[14rem] flex-1">
                  <p className="text-[13px] leading-relaxed text-strong">
                    {seg.kind === "dialogue" ? `“${seg.text}”` : seg.text}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {confidenceBadge(seg)}
                    <span className="font-mono text-[11px] text-subtle">
                      {seg.kind === "dialogue" ? "dialogue quote" : "narration"}
                    </span>
                  </div>
                </div>
                <Select
                  value={seg.speakerId ?? ""}
                  onValueChange={(v) => (v === "__new" ? addSpeaker([seg.id]) : setSpeaker([seg.id], v))}
                >
                  <SelectTrigger className="h-8 w-48 text-[12px]">
                    <SelectValue placeholder="Choose speaker" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new">New speaker…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <p className="text-[13px] text-subtle">No lines match this filter.</p>
        )}
        {visible.length > shown.length && (
          <Button variant="secondary" size="sm" className="w-full h-8 text-[12px]" onClick={() => setLimit(limit + PAGE)}>
            Show more ({visible.length - shown.length} left)
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={onBack}>
          Back to voices
        </Button>
        <Button
          size="sm"
          className="ml-auto h-8 text-[12px]"
          onClick={() => {
            updateProject((p) => ({ ...p, stage: "preview" }));
            onDone();
          }}
        >
          <Sparkles className="size-3.5" />
          Preview & Generate
        </Button>
      </div>
    </div>
  );
}
