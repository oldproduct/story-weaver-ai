import { Play, Plus, Users } from "lucide-react";
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
    <div className="flex items-center gap-2">
      <Select {...(value ? { value } : {})} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-48">
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
      loading: "Preparing preview…",
      success: "Playing",
      error: (e) => (e instanceof Error ? e.message : "Preview failed"),
    });
  };

  const ready = leads.every((c) => c.voiceId) && (!pool || project.sharedVoiceId || pool.voiceId);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl">Choose the voices</h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {leads.length} speakers have their own Hindi voice. Add more with the + button; everyone
            else shares one supporting voice.
          </p>
        </div>
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

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="hairline rounded-full border bg-surface px-3 py-1">
          <Users className="mr-1.5 inline size-3.5 text-brass" />
          {new Set([...leads.map((c) => c.voiceId), project.sharedVoiceId ?? pool?.voiceId].filter(Boolean)).size}{" "}
          voices in the final mix
        </span>
        <span className="hairline rounded-full border bg-surface px-3 py-1">
          {project.segments.length.toLocaleString()} clips to render
        </span>
      </div>

      <section className="space-y-3">
        {leads.map((c) => (
          <article
            key={c.id}
            className="hairline flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-4"
          >
            <Input
              value={c.name}
              onChange={(e) => patch(c.id, { name: e.target.value })}
              className="h-9 w-52 font-medium"
              disabled={c.isNarrator}
            />
            <Badge variant="secondary" className="font-mono text-[11px]">
              {c.lineCount} lines
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              <VoicePicker
                value={c.voiceId}
                onChange={(v) => patch(c.id, { voiceId: v })}
                onPreview={() => preview(c.voiceId, sampleFor(c.id))}
              />
              {!c.isNarrator && (
                <Button size="sm" variant="ghost" onClick={() => setRole(c.id, "supporting")}>
                  Remove
                </Button>
              )}
            </div>
          </article>
        ))}

        {nextUp && (
          <Button variant="secondary" className="w-full" onClick={() => setRole(nextUp.id, "lead")}>
            <Plus className="size-4" />
            Add a speaker — {nextUp.name} ({nextUp.lineCount} lines)
          </Button>
        )}
      </section>

      <section className="hairline flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface p-4">
        <div>
          <h3 className="text-sm uppercase tracking-widest text-muted-foreground">
            Shared supporting voice
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {supporting.length} minor characters
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
