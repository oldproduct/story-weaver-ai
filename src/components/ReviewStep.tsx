import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Combine, Loader2, Pencil, Play, ScanSearch, Scissors, Sparkles, Trash2, Undo2, Wand2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { combineSegments, deleteSegment, editSegmentText, moveSegment, splitSegment } from "@/lib/segment-edit";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HelpTip, StepHint } from "@/components/HelpTip";
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
import { EMOTIONS, deliveryFor, LINE_SPEEDS, effectiveSpeed, ensureTerminalPunctuation, lineSpeedValue, voiceSettingsFor } from "@/lib/delivery";
import { playSample } from "@/lib/preview";
import { SUPPORTING_ID, type CharacterProfile, type EmotionType, type LineSpeed, type ProjectState, type Segment } from "@/lib/types";

type Filter = "all" | "uncertain";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const ordered = useMemo(
    () => [...project.segments].sort((a, b) => a.order - b.order),
    [project.segments],
  );
  const [activeId, setActiveId] = useState<string | null>(() => ordered[0]?.id ?? null);
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

  const orderIndex = useMemo(() => new Map(ordered.map((s, i) => [s.id, i])), [ordered]);
  const activeSegment = ordered.find((s) => s.id === activeId) ?? visible[0] ?? ordered[0] ?? null;

  const applySegments = (fn: (segments: Segment[]) => Segment[]) => {
    updateProject((p) => {
      const segments = fn(p.segments);
      return { ...p, segments, characters: recountCharacters(segments, p.characters) };
    });
  };

  const [undoSnapshot, setUndoSnapshot] = useState<Segment[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLTextAreaElement>(null);
  const canReorder = !busy && editingId === null && filter === "all" && speakerFilter === "any" && !query.trim();

  /** Text edits keep a one-step undo snapshot. */
  const applyEdit = (next: Segment[]) => {
    setUndoSnapshot(project.segments);
    applySegments(() => next);
  };
  const undo = () => {
    if (!undoSnapshot) return;
    const snap = undoSnapshot;
    setUndoSnapshot(null);
    applySegments(() => snap);
    toast.message("Last change undone.");
  };
  const startEdit = (seg: Segment) => {
    setActiveId(seg.id);
    setEditingId(seg.id);
    setEditText(seg.text);
  };
  const persistEdit = () => {
    if (!editingId) return;
    const current = project.segments.find((s) => s.id === editingId);
    if (current && editText.trim() && editText !== current.text) {
      applyEdit(editSegmentText(project.segments, editingId, editText, project.characters));
    }
  };
  const saveEdit = () => {
    persistEdit();
    setEditingId(null);
  };
  const chooseLine = (seg: Segment) => {
    if (seg.id === activeSegment?.id) return;
    const current = project.segments.find((s) => s.id === editingId);
    const hasUnsaved = Boolean(current && editText.trim() && editText !== current.text);
    if (hasUnsaved) {
      const saveFirst = window.confirm("Save your changes before opening another line? Select Cancel to choose whether to discard them.");
      if (saveFirst) persistEdit();
      else if (!window.confirm("Discard the unsaved changes to this line?")) return;
    }
    setEditingId(null);
    setActiveId(seg.id);
  };
  const splitHere = () => {
    if (!editingId) return;
    const offset = editRef.current?.selectionStart ?? 0;
    const next = splitSegment(project.segments, editingId, offset, editText);
    if (next === project.segments) {
      toast.error("Put the cursor inside the text where you want to cut.");
      return;
    }
    applyEdit(next);
    setEditingId(null);
  };
  const removeLine = (id: string) => {
    const snap = project.segments;
    applyEdit(deleteSegment(project.segments, id));
    if (activeId === id) {
      const index = orderIndex.get(id) ?? 0;
      setActiveId(ordered[index + 1]?.id ?? ordered[index - 1]?.id ?? null);
      setEditingId(null);
    }
    toast("Line deleted", {
      duration: 5000,
      action: { label: "Undo", onClick: () => { setUndoSnapshot(null); applySegments(() => snap); } },
    });
  };
  const combineSelected = () => {
    const res = combineSegments(project.segments, [...selected]);
    if (!res.ok) {
      toast.error(res.reason);
      return;
    }
    applyEdit(res.segments);
    setSelected(new Set());
    toast.success("Lines combined.");
  };
  const moveLine = (id: string, direction: "up" | "down") => {
    if (!canReorder) return;
    const next = moveSegment(project.segments, id, direction);
    if (next !== project.segments) applyEdit(next);
  };

  const setSpeaker = (ids: string[], speakerId: string) => {
    const idSet = new Set(ids);
    applySegments((segments) =>
      segments.map((s) =>
        idSet.has(s.id) ? { ...s, speakerId, confidence: 1, manual: true } : s,
      ),
    );
  };

  const setDelivery = (id: string, fields: { emotion?: EmotionType; speed?: LineSpeed }) =>
    applySegments((segments) => segments.map((s) => (s.id === id ? { ...s, ...fields } : s)));

  const [playingId, setPlayingId] = useState<string | null>(null);
  const playLine = async (seg: Segment) => {
    const character = project.characters.find((c) => c.id === seg.speakerId);
    const voice = character?.voiceId ?? project.sharedVoiceId;
    if (!voice) {
      toast.error("This speaker has no voice yet. Pick one on the Speakers screen.");
      return;
    }
    setPlayingId(seg.id);
    try {
      await playSample(
        ensureTerminalPunctuation(seg.text),
        voice,
        character?.instructions ?? "",
        effectiveSpeed(character, seg, project.globalSpeed ?? 1),
        voiceSettingsFor(seg),
        deliveryFor(seg),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not play this line.");
    } finally {
      setPlayingId(null);
    }
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
        <StepHint>Check low-confidence lines, fix the speaker, emotion or speed where needed, press play to test a line, then click Generate.</StepHint>
      </div>

      <section aria-label="How the app reads voices, paragraphs and markers" className="border-y border-border py-4 text-[12px] leading-relaxed text-default">
        <h3 className="mb-3 text-[14px] font-medium text-strong">How the app reads voices, paragraphs and markers</h3>
        <ol className="grid gap-4 pl-5 md:grid-cols-3">
          <li className="pl-1">
            <strong className="block text-strong">Change voice / choose who speaks</strong>
            Use <code>(voice: Riya)</code>, <code>Riya: text</code>, quotes, or <code>— dialogue</code> in the uploaded file. Here, choose the speaker or type <code>(voice: Riya)</code> while editing. The name must exactly match the Speakers screen; the tag is never spoken.
          </li>
          <li className="pl-1">
            <strong className="block text-strong">Create a pause or chapter</strong>
            One empty line in the uploaded file makes a paragraph pause. <code>अध्याय 1</code> or <code>Chapter 1</code> on its own line makes a chapter. Inside speech, use <code>,</code> short pause · <code>। .</code> full stop · <code>? !</code> emphasis · <code>…</code> longer pause. In this editor, use Split—not a blank line—to make separate attributed lines.
          </li>
          <li className="pl-1">
            <strong className="block text-strong">Correct the final narration</strong>
            Edit or paste the words, assign the speaker, choose emotion and speed, then Play to check. Split, combine, or move lines with ↑ / ↓. Generate follows your saved text, speaker, and order; unchanged recordings can still be reused.
          </li>
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs">
        <span className="text-[13px] text-default">
          <strong className="font-mono text-strong">{uncertainCount}</strong> uncertain of{" "}
          {ordered.length} lines
        </span>
        <HelpTip title="Reading each line">Confidence colours: green = sure (or set by you), yellow = maybe, red = likely wrong. On each line use the play button to hear it, the speaker menu to reassign it, the emotion menu to change how it is acted, and the speed menu (0.75x–1.5x) to change pace.</HelpTip>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" className="h-8 text-[12px]" onClick={runFill} disabled={busy}>
            <Wand2 className="size-3.5" />
            Fill from pattern
          </Button>
          <HelpTip title="Fill from pattern">Fills uncertain lines in two-person conversations by alternating speakers. Never changes lines you set yourself.</HelpTip>
          <Button size="sm" variant="secondary" className="h-8 text-[12px]" onClick={() => void runRedetect()} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ScanSearch className="size-3.5" />}
            Re-detect uncertain
          </Button>
          <HelpTip title="Re-detect uncertain">Asks the AI again about low-confidence lines only. Your manual choices are kept.</HelpTip>
          <Button size="sm" variant="ghost" className="h-8 text-[12px]" onClick={undo} disabled={!undoSnapshot}>
            <Undo2 className="size-3.5" />
            Undo
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
          <Button size="sm" variant="secondary" className="h-8 text-[12px]" onClick={combineSelected} disabled={selected.size < 2}>
            <Combine className="size-3.5" />
            Combine lines
          </Button>
          <HelpTip title="Combine lines">Joins the selected lines into one line. They must sit next to each other in the same chapter. The first line's speaker, emotion and speed are kept.</HelpTip>
          <Button size="sm" variant="ghost" className="h-8 text-[12px]" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="grid min-h-[38rem] overflow-hidden rounded-lg border border-border bg-card shadow-xs lg:grid-cols-[minmax(17rem,0.78fr)_minmax(0,2.22fr)]">
        <aside aria-label="Attributed lines" className="min-w-0 border-b border-border bg-muted/35 lg:border-b-0 lg:border-r">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border px-3 py-2.5">
            <div className="min-w-0">
              <h3 className="truncate text-[12px] font-medium text-strong">Attributed lines</h3>
              <p className="text-[10px] text-subtle">{visible.length} shown in story order</p>
            </div>
            <span className="shrink-0 font-mono text-[10px] text-subtle">{ordered.length} total</span>
          </div>
          <div className="max-h-[24rem] overflow-y-auto lg:max-h-[48rem]">
        {visible.map((seg, i) => {
          const prev = visible[i - 1];
          const newChapter = !prev || prev.chapterId !== seg.chapterId;
          return (
            <div key={seg.id}>
              {newChapter && (
                <p className="border-y border-border bg-bg-selected/60 px-3 py-1.5 text-[10px] font-medium uppercase text-subtle first:border-t-0">
                  {chapterTitle.get(seg.chapterId) ?? "Chapter"}
                </p>
              )}
              <button
                type="button"
                onClick={() => chooseLine(seg)}
                className={cn(
                  "grid w-full grid-cols-[auto_minmax(0,1fr)] gap-2 border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-bg-selected/60",
                  activeSegment?.id === seg.id && "bg-bg-selected",
                )}
              >
                <Checkbox
                  className="mt-0.5"
                  checked={selected.has(seg.id)}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={() => toggle(seg.id)}
                  aria-label="Select line"
                />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-strong">{seg.text}</p>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] text-subtle">
                    <span className="truncate">{speakerName(seg.speakerId, project.characters)}</span>
                    <span className="shrink-0">· {seg.manual ? "set by you" : `${Math.round(seg.confidence * 100)}%`}</span>
                  </div>
                </div>
              </button>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="p-4 text-[12px] text-subtle">No lines match this filter.</p>
        )}
          </div>
        </aside>

        <section aria-label="Selected line editor" className="min-w-0 p-4 sm:p-5">
          {activeSegment ? (() => {
            const seg = activeSegment;
            const index = orderIndex.get(seg.id) ?? -1;
            const above = ordered[index - 1];
            const below = ordered[index + 1];
            const isEditing = editingId === seg.id;
            return (
              <div className="space-y-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium uppercase text-subtle">{chapterTitle.get(seg.chapterId) ?? "Chapter"} · Line {index + 1}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">{confidenceBadge(seg)}{seg.edited && <span className="text-[10px] text-subtle">edited</span>}</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Undo last change" onClick={undo} disabled={!undoSnapshot}><Undo2 className="size-3.5" /></Button>
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <Textarea
                      ref={editRef}
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(); }
                        if (e.key === "Escape") { setEditingId(null); setEditText(seg.text); }
                      }}
                      className="min-h-[22rem] resize-y text-[15px] leading-7"
                      aria-label="Edit line text"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={saveEdit}>Save changes</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditText(seg.text); }}>Cancel</Button>
                      <Button size="sm" variant="secondary" onClick={splitHere}><Scissors className="size-3.5" />Split at cursor</Button>
                      <HelpTip title="Large line editor">Enter makes a new line. Ctrl/Command + Enter saves. Esc cancels. Put the cursor inside the text and choose Split at cursor to create two attributed lines.</HelpTip>
                    </div>
                  </div>
                ) : (
                  <button type="button" onDoubleClick={() => startEdit(seg)} onClick={() => startEdit(seg)} className="min-h-[22rem] w-full border-y border-border py-5 text-left text-[15px] leading-7 text-strong">
                    {seg.text}
                  </button>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <Select value={seg.speakerId ?? ""} onValueChange={(v) => (v === "__new" ? addSpeaker([seg.id]) : setSpeaker([seg.id], v))}>
                    <SelectTrigger className="w-full text-[12px]"><SelectValue placeholder="Choose speaker" /></SelectTrigger>
                    <SelectContent>{options.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}<SelectItem value="__new">New speaker…</SelectItem></SelectContent>
                  </Select>
                  <Select value={seg.emotion ?? "neutral"} onValueChange={(v) => setDelivery(seg.id, { emotion: v as EmotionType })}>
                    <SelectTrigger className="w-full text-[12px] capitalize" aria-label="Emotion"><SelectValue /></SelectTrigger>
                    <SelectContent>{EMOTIONS.map((e) => <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={String(lineSpeedValue(seg.speed))} onValueChange={(v) => setDelivery(seg.id, { speed: Number(v) })}>
                    <SelectTrigger className="w-full text-[12px]" aria-label="Line speed"><SelectValue /></SelectTrigger>
                    <SelectContent>{LINE_SPEEDS.map((v) => <SelectItem key={v} value={String(v)}>{v === 1 ? "1x" : `${v.toFixed(2)}x`}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Button variant="secondary" size="sm" disabled={playingId === seg.id} onClick={() => playLine(seg)}>{playingId === seg.id ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}Play line</Button>
                  {!isEditing && <Button variant="secondary" size="sm" onClick={() => startEdit(seg)}><Pencil className="size-3.5" />Edit text</Button>}
                  <Button variant="ghost" size="icon" aria-label="Move line up" title="Move line up" disabled={!canReorder || above?.chapterId !== seg.chapterId} onClick={() => moveLine(seg.id, "up")}><ArrowUp className="size-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label="Move line down" title="Move line down" disabled={!canReorder || below?.chapterId !== seg.chapterId} onClick={() => moveLine(seg.id, "down")}><ArrowDown className="size-4" /></Button>
                  <Button variant="ghost" size="icon" className="ml-auto" aria-label="Delete line" onClick={() => removeLine(seg.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            );
          })() : <p className="text-[13px] text-subtle">Choose a line from the list.</p>}
        </section>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={onBack}>
          Back to voices
        </Button>
        <Button
          size="sm"
          className="ml-auto h-8 text-[12px]"
          onClick={() => {
            updateProject((p) => ({ ...p, stage: "generate" }));
            onDone();
          }}
        >
          <Sparkles className="size-3.5" />
          Generate narration
        </Button>
      </div>
    </div>
  );
}
