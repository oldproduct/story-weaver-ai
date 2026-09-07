import { useMemo, useState } from "react";
import { Loader2, ScanSearch, Sparkles, Wand2 } from "lucide-react";
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
import { alternationFill, isSettled, recountCharacters } from "@/lib/pipeline";
import { updateProject } from "@/lib/store";
import { uid } from "@/lib/id";
import { cn } from "@/lib/utils";
import { SUPPORTING_ID, type CharacterProfile, type ProjectState, type Segment } from "@/lib/types";

type Filter = "all" | "uncertain";

const PAGE = 150;
const UNCERTAIN = 0.7;

function confidenceTone(seg: Segment): string {
  if (seg.manual) return "text-sage";
  if (seg.confidence >= UNCERTAIN) return "text-sage";
  if (seg.confidence >= 0.4) return "text-brass";
  return "text-destructive";
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
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl">Review the lines</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Every line with the speaker the AI picked and how sure it was. Fix anything that looks
          wrong — your choices are locked in and never overwritten by auto-detect.
        </p>
      </div>

      <div className="hairline flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-4">
        <span className="text-sm">
          <strong className="font-mono text-brass">{uncertainCount}</strong> uncertain of{" "}
          {ordered.length} lines
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={runFill} disabled={busy}>
            <Wand2 className="size-4" />
            Fill from pattern
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void runRedetect()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />}
            Re-detect uncertain
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "ghost"}
          onClick={() => setFilter("all")}
        >
          All lines
        </Button>
        <Button
          size="sm"
          variant={filter === "uncertain" ? "default" : "ghost"}
          onClick={() => setFilter("uncertain")}
        >
          Low confidence
        </Button>
        <Select value={speakerFilter} onValueChange={setSpeakerFilter}>
          <SelectTrigger className="h-9 w-52">
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
          className="h-9 w-56"
        />
      </div>

      {selected.size > 0 && (
        <div className="hairline sticky top-20 z-10 flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-3">
          <span className="text-sm">{selected.size} selected</span>
          <Select value="" onValueChange={(v) => {
            const ids = [...selected];
            if (v === "__new") addSpeaker(ids);
            else setSpeaker(ids, v);
            setSelected(new Set());
          }}>
            <SelectTrigger className="h-9 w-56">
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
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
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
                <p className="mb-2 mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  {chapterTitle.get(seg.chapterId) ?? "Chapter"}
                </p>
              )}
              <div
                className={cn(
                  "hairline flex flex-wrap items-start gap-3 rounded-lg border bg-surface p-3",
                  !isSettled(seg) && "border-brass/40",
                )}
              >
                <Checkbox
                  className="mt-1"
                  checked={selected.has(seg.id)}
                  onCheckedChange={() => toggle(seg.id)}
                  aria-label="Select line"
                />
                <div className="min-w-[14rem] flex-1">
                  <p className="text-sm leading-relaxed">
                    {seg.kind === "dialogue" ? `“${seg.text}”` : seg.text}
                  </p>
                  <p className={cn("mt-1 font-mono text-[11px]", confidenceTone(seg))}>
                    {seg.manual
                      ? "set by you · 100%"
                      : `${seg.kind} · ${Math.round(seg.confidence * 100)}% sure`}
                  </p>
                </div>
                <Select
                  value={seg.speakerId ?? ""}
                  onValueChange={(v) => (v === "__new" ? addSpeaker([seg.id]) : setSpeaker([seg.id], v))}
                >
                  <SelectTrigger className="h-9 w-52">
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
          <p className="text-sm text-muted-foreground">No lines match this filter.</p>
        )}
        {visible.length > shown.length && (
          <Button variant="secondary" className="w-full" onClick={() => setLimit(limit + PAGE)}>
            Show more ({visible.length - shown.length} left)
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" onClick={onBack}>
          Back to voices
        </Button>
        <Button
          className="ml-auto"
          onClick={() => {
            updateProject((p) => ({ ...p, stage: "generate" }));
            onDone();
          }}
        >
          <Sparkles className="size-4" />
          Generate narration
        </Button>
      </div>
    </div>
  );
}
