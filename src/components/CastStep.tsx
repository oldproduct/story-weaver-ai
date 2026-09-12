import { Mic, Play, Plus, Users, Volume2 } from "lucide-react";
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
import { playSample } from "@/lib/preview";
import { assignSuggestedVoices } from "@/lib/pipeline";
import { updateProject } from "@/lib/store";
import { SUPPORTING_ID, type CharacterProfile, type ProjectState } from "@/lib/types";
import { VOICES } from "@/lib/voices";

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
    <div className="flex items-center gap-1.5">
      <Select {...(value ? { value } : {})} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-44 rounded-lg text-[12px] border-border bg-card shadow-2xs">
          <SelectValue placeholder="Pick a voice" />
        </SelectTrigger>
        <SelectContent>
          {VOICES.map((v) => (
            <SelectItem key={v.id} value={v.id} className="text-[12px]">
              <div className="flex flex-col items-start py-0.5">
                <span className="font-medium text-strong">{v.label}</span>
                <span className="text-[11px] text-subtle">{v.blurb}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="icon"
        variant="ghost"
        className="size-8 rounded-lg text-subtle hover:text-strong hover:bg-bg-selected"
        onClick={onPreview}
        aria-label="Preview voice"
      >
        <Play className="size-3.5" />
      </Button>
    </div>
  );
}

export function CastStep({ project, onDone }: { project: ProjectState; onDone: () => void }) {
  const sampleFor = (id: string) => project.segments.find((s) => s.speakerId === id)?.text ?? "";

  const leads = project.characters.filter((c) => c.role === "lead" || c.isNarrator);
  const supporting = project.characters.filter(
    (c) => !c.isNarrator && c.role === "supporting" && c.id !== SUPPORTING_ID,
  );
  const pool = project.characters.find((c) => c.id === SUPPORTING_ID);
  const nextUp = [...supporting].sort((a, b) => b.lineCount - a.lineCount)[0];

  const patch = (id: string, fields: Partial<CharacterProfile>) =>
    updateProject((p) => ({
      ...p,
      characters: p.characters.map((c) => (c.id === id ? { ...c, ...fields } : c)),
    }));

  const setRole = (id: string, role: "lead" | "supporting") =>
    updateProject((p) => {
      const next = p.characters.map((x) =>
        x.id === id ? { ...x, role, voiceId: role === "lead" ? x.voiceId : null } : x,
      );
      assignSuggestedVoices(next);
      return { ...p, characters: next };
    });

  const preview = (voice: string | null, text: string) => {
    if (!voice) {
      toast.error("Pick a voice first.");
      return;
    }
    toast.promise(playSample(text, voice), {
      loading: "Preparing audio preview…",
      success: "Playing sample",
      error: (e) => (e instanceof Error ? e.message : "Preview failed"),
    });
  };

  const ready = leads.every((c) => c.voiceId) && (!pool || project.sharedVoiceId || pool.voiceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-selected px-2.5 py-0.5 text-[11px] font-medium text-default mb-2">
            <Mic className="size-3 text-strong" />
            Step 3 · Voice Casting
          </div>
          <h2 className="text-[18px] font-medium text-strong">Choose voices for your cast</h2>
          <p className="mt-1 max-w-xl text-[13px] text-default">
            {leads.length} lead speakers get dedicated ElevenLabs voices. Minor supporting roles share
            a pooled voice to keep narration cohesive.
          </p>
        </div>
        <Button
          disabled={!ready}
          size="sm"
          className="h-8.5 rounded-lg px-4 text-[12px] font-medium bg-strong text-white hover:bg-strong/90 shadow-xs"
          onClick={() => {
            updateProject((p) => ({ ...p, stage: "review" }));
            onDone();
          }}
        >
          Review attributed lines
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-[12px] text-subtle">
        <span className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1 shadow-2xs">
          <Users className="mr-1.5 inline size-3.5 text-strong" />
          <strong className="font-medium text-strong mr-1">
            {new Set([...leads.map((c) => c.voiceId), project.sharedVoiceId ?? pool?.voiceId].filter(Boolean)).size}
          </strong>{" "}
          distinct voices in final mix
        </span>
        <span className="inline-flex items-center rounded-lg border border-border bg-card px-2.5 py-1 shadow-2xs">
          <Volume2 className="mr-1.5 inline size-3.5 text-strong" />
          <strong className="font-medium text-strong mr-1">
            {project.segments.length.toLocaleString()}
          </strong>{" "}
          speech clips to synthesize
        </span>
      </div>

      {/* Leads Roster */}
      <section className="space-y-2.5">
        {leads.map((c) => {
          const initials = c.name.slice(0, 2).toUpperCase();
          return (
            <article
              key={c.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs transition-all hover:border-default/30"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-bg-selected border border-border text-[11px] font-mono font-medium text-strong">
                {initials}
              </div>

              <div className="flex flex-1 min-w-48 items-center gap-2">
                <Input
                  value={c.name}
                  onChange={(e) => patch(c.id, { name: e.target.value })}
                  className="h-8 w-48 text-[13px] font-medium border-border rounded-lg bg-card shadow-2xs"
                  disabled={c.isNarrator}
                />
                <Badge
                  variant="secondary"
                  className="font-mono text-[11px] bg-bg-selected text-subtle border-border rounded-md px-2 py-0.5"
                >
                  {c.lineCount} {c.lineCount === 1 ? "line" : "lines"}
                </Badge>
                {c.isNarrator && (
                  <span className="text-[11px] text-subtle">Primary Storyteller</span>
                )}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <VoicePicker
                  value={c.voiceId}
                  onChange={(v) => patch(c.id, { voiceId: v })}
                  onPreview={() => preview(c.voiceId, sampleFor(c.id))}
                />
                {!c.isNarrator && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-[12px] text-subtle hover:text-strong rounded-lg"
                    onClick={() => setRole(c.id, "supporting")}
                  >
                    Demote to pool
                  </Button>
                )}
              </div>
            </article>
          );
        })}

        {nextUp && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full h-8.5 rounded-xl border-dashed border-border text-[12px] text-default hover:text-strong hover:bg-bg-selected"
            onClick={() => setRole(nextUp.id, "lead")}
          >
            <Plus className="size-3.5 mr-1 text-strong" />
            Promote next speaker to lead: <strong className="ml-1 text-strong">{nextUp.name}</strong>{" "}
            ({nextUp.lineCount} lines)
          </Button>
        )}
      </section>

      {/* Shared Supporting Voice Pool */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-medium text-strong">Shared Supporting Voice</h3>
            <span className="rounded bg-bg-selected px-1.5 py-0.2 border border-border text-[10px] font-medium text-subtle">
              Voice Pool
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-default">
            {supporting.length} minor speaking characters
            {pool && pool.lineCount > 0 ? ` · ${pool.lineCount} unattributed lines` : ""}
          </p>
        </div>
        <VoicePicker
          value={project.sharedVoiceId ?? pool?.voiceId ?? null}
          onChange={(v) => updateProject((p) => ({ ...p, sharedVoiceId: v }))}
          onPreview={() =>
            preview(
              project.sharedVoiceId ?? pool?.voiceId ?? null,
              supporting[0] ? sampleFor(supporting[0].id) : "",
            )
          }
        />
      </section>
    </div>
  );
}
