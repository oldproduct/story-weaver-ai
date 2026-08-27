import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  Merge,
  Play,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { playSample } from "@/lib/preview";
import { assignSuggestedVoices } from "@/lib/pipeline";
import { updateProject } from "@/lib/store";
import { SUPPORTING_ID, type CharacterProfile, type ProjectState } from "@/lib/types";
import { VOICES, voiceLabel } from "@/lib/voices";
import { cn } from "@/lib/utils";

function VoicePicker({
  value,
  onChange,
  onPreview,
}: {
  value: string | null;
  onChange: (v: string) => void;
  onPreview: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select {...(value ? { value } : {})} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-44">
          <SelectValue placeholder="Pick a voice" />
        </SelectTrigger>
        <SelectContent>
          {VOICES.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              <span className="flex flex-col items-start">
                <span>{v.label}</span>
                <span className="text-xs text-muted-foreground">{v.blurb}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="icon" variant="ghost" onClick={onPreview} aria-label="Preview voice">
        <Play className="size-4" />
      </Button>
    </div>
  );
}

export function CastStep({ project, onDone }: { project: ProjectState; onDone: () => void }) {
  const [mergeSource, setMergeSource] = useState<CharacterProfile | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const sampleFor = (id: string) =>
    project.segments.find((s) => s.speakerId === id)?.text ??
    "The night was long, and the road was longer still.";

  const uncertain = useMemo(
    () =>
      project.segments.filter(
        (s) => s.kind === "dialogue" && s.confidence < 0.45,
      ),
    [project.segments],
  );

  const leads = project.characters.filter((c) => c.role === "lead" || c.isNarrator);
  const supporting = project.characters.filter(
    (c) => !c.isNarrator && c.role === "supporting" && c.id !== SUPPORTING_ID,
  );
  const pool = project.characters.find((c) => c.id === SUPPORTING_ID);
  const distinctVoices = new Set(
    [...leads.map((c) => c.voiceId), project.sharedVoiceId ?? pool?.voiceId].filter(Boolean),
  ).size;

  const patch = (id: string, fields: Partial<CharacterProfile>) =>
    updateProject((p) => ({
      ...p,
      characters: p.characters.map((c) => (c.id === id ? { ...c, ...fields } : c)),
    }));

  const setRole = (c: CharacterProfile, role: "lead" | "supporting") => {
    updateProject((p) => {
      const next = p.characters.map((x) =>
        x.id === c.id ? { ...x, role, voiceId: role === "lead" ? x.voiceId : null } : x,
      );
      assignSuggestedVoices(next);
      return { ...p, characters: next };
    });
  };

  const mergeInto = (source: CharacterProfile, targetId: string) => {
    updateProject((p) => {
      const target = p.characters.find((c) => c.id === targetId);
      if (!target) return p;
      const merged: CharacterProfile = {
        ...target,
        aliases: [...new Set([...target.aliases, source.name, ...source.aliases])],
        lineCount: target.lineCount + source.lineCount,
        wordCount: target.wordCount + source.wordCount,
        firstChapter: Math.min(target.firstChapter, source.firstChapter),
      };
      return {
        ...p,
        characters: p.characters
          .filter((c) => c.id !== source.id)
          .map((c) => (c.id === targetId ? merged : c)),
        segments: p.segments.map((s) =>
          s.speakerId === source.id ? { ...s, speakerId: targetId } : s,
        ),
      };
    });
    setMergeSource(null);
    toast.success(`Merged ${source.name}`);
  };

  const splitAlias = (character: CharacterProfile, alias: string) => {
    updateProject((p) => {
      const newChar: CharacterProfile = {
        ...character,
        id: `${character.id}-split-${alias.toLowerCase().replace(/\W+/g, "")}`,
        name: alias,
        aliases: [],
        lineCount: 0,
        wordCount: 0,
        role: "supporting",
        voiceId: null,
      };
      const next = [
        ...p.characters.map((c) =>
          c.id === character.id ? { ...c, aliases: c.aliases.filter((a) => a !== alias) } : c,
        ),
        newChar,
      ];
      assignSuggestedVoices(next);
      return { ...p, characters: next };
    });
    toast.success(`Split "${alias}" into its own character`);
  };

  const reassign = (segmentId: string, speakerId: string) =>
    updateProject((p) => ({
      ...p,
      segments: p.segments.map((s) =>
        s.id === segmentId ? { ...s, speakerId, confidence: 1 } : s,
      ),
    }));

  const preview = (voice: string | null, text: string, instructions: string) => {
    if (!voice) {
      toast.error("Pick a voice first.");
      return;
    }
    toast.promise(playSample(text, voice, instructions), {
      loading: "Rendering preview…",
      success: "Playing",
      error: (e) => (e instanceof Error ? e.message : "Preview failed"),
    });
  };

  const ready = leads.every((c) => c.voiceId) && (!pool || project.sharedVoiceId || pool.voiceId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl">The cast</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {project.characters.filter((c) => !c.isNarrator && c.id !== SUPPORTING_ID).length}{" "}
            speaking characters detected, {leads.length} given their own voice — everyone else
            shares one supporting voice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {uncertain.length > 0 && (
            <Button variant="secondary" onClick={() => setReviewOpen(true)}>
              <AlertTriangle className="size-4" />
              {uncertain.length} to review
            </Button>
          )}
          <Button
            disabled={!ready}
            onClick={() => {
              updateProject((p) => ({ ...p, stage: "generate" }));
              onDone();
            }}
          >
            Generate narration
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="hairline rounded-full border bg-surface px-3 py-1">
          <Users className="mr-1.5 inline size-3.5 text-brass" />
          {distinctVoices} voices in the final mix
        </span>
        <span className="hairline rounded-full border bg-surface px-3 py-1">
          {project.segments.length.toLocaleString()} clips to render
        </span>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm uppercase tracking-widest text-muted-foreground">Own voice</h3>
        {leads.map((c) => (
          <article key={c.id} className="hairline rounded-xl border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                value={c.name}
                onChange={(e) => patch(c.id, { name: e.target.value })}
                className="h-9 w-52 font-medium"
                disabled={c.isNarrator}
              />
              <Badge variant="secondary" className="font-mono text-[11px]">
                {c.lineCount} lines
              </Badge>
              {c.aliases.slice(0, 4).map((a) => (
                <button
                  key={a}
                  onClick={() => splitAlias(c, a)}
                  title="Split into its own character"
                  className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground hover:border-rose hover:text-rose"
                >
                  {a} ×
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <VoicePicker
                  value={c.voiceId}
                  onChange={(v) => patch(c.id, { voiceId: v })}
                  onPreview={() => preview(c.voiceId, sampleFor(c.id), c.instructions)}
                />
                {!c.isNarrator && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Move to shared supporting voice"
                      onClick={() => setRole(c, "supporting")}
                    >
                      <ArrowDownToLine className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Merge into another character"
                      onClick={() => setMergeSource(c)}
                    >
                      <Merge className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {c.description || "No description detected."}
            </p>
            <Input
              value={c.instructions}
              placeholder="Delivery notes for this voice (tone, accent, pacing)…"
              onChange={(e) => patch(c.id, { instructions: e.target.value })}
              className="mt-3 h-8 text-xs"
            />
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm uppercase tracking-widest text-muted-foreground">
            Shared supporting voice
          </h3>
          <VoicePicker
            value={project.sharedVoiceId ?? pool?.voiceId ?? null}
            onChange={(v) => updateProject((p) => ({ ...p, sharedVoiceId: v }))}
            onPreview={() =>
              preview(
                project.sharedVoiceId ?? pool?.voiceId ?? null,
                supporting[0] ? sampleFor(supporting[0].id) : "Right this way, if you please.",
                "",
              )
            }
          />
        </div>
        <div className="hairline flex flex-wrap gap-2 rounded-xl border bg-surface p-4">
          {supporting.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No minor speakers — every character has their own voice.
            </p>
          )}
          {supporting.map((c) => (
            <span
              key={c.id}
              className="group flex items-center gap-2 rounded-full border bg-background/50 px-3 py-1 text-xs"
            >
              {c.name}
              <span className="font-mono text-[10px] text-muted-foreground">{c.lineCount}</span>
              <button
                onClick={() => setRole(c, "lead")}
                title="Promote to its own voice"
                className="text-muted-foreground hover:text-brass"
              >
                <ArrowUpToLine className="size-3" />
              </button>
              <button
                onClick={() => setMergeSource(c)}
                title="Merge into another character"
                className="text-muted-foreground hover:text-brass"
              >
                <Merge className="size-3" />
              </button>
            </span>
          ))}
          {pool && pool.lineCount > 0 && (
            <span className="rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground">
              {pool.lineCount} unattributed lines
            </span>
          )}
        </div>
      </section>

      <Dialog open={Boolean(mergeSource)} onOpenChange={(o) => !o && setMergeSource(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge {mergeSource?.name} into…</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {project.characters
              .filter((c) => c.id !== mergeSource?.id && !c.isNarrator && c.id !== SUPPORTING_ID)
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => mergeSource && mergeInto(mergeSource, c.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  <span>{c.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{c.lineCount}</span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lines that need a human</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
            {uncertain.length === 0 && (
              <p className="text-sm text-muted-foreground">Everything is attributed confidently.</p>
            )}
            {uncertain.map((s) => (
              <div key={s.id} className="rounded-lg border bg-surface p-3">
                <p className="text-sm italic">“{s.text}”</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.context}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Speaker</span>
                  <Select
                    {...(s.speakerId ? { value: s.speakerId } : {})}
                    onValueChange={(v) => reassign(s.id, v)}
                  >
                    <SelectTrigger className="h-8 w-56 text-xs">
                      <SelectValue placeholder="Assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {project.characters.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span
                    className={cn(
                      "ml-auto font-mono text-[11px]",
                      s.confidence < 0.3 ? "text-rose" : "text-muted-foreground",
                    )}
                  >
                    {Math.round(s.confidence * 100)}% · {voiceLabel(
                      project.characters.find((c) => c.id === s.speakerId)?.voiceId ??
                        project.sharedVoiceId,
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
