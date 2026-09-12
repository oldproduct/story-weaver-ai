import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Eye, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { updateProject } from "@/lib/store";
import { parseScript } from "@/lib/parser";
import { buildVoiceMap, findUnknownVoices, voiceLabel } from "@/lib/voices";
import type { ProjectState } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PreviewStep({
  project,
  onDone,
  onBack,
}: {
  project: ProjectState;
  onDone: () => void;
  onBack: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const voiceMap = useMemo(() => buildVoiceMap(project.characters), [project.characters]);

  useEffect(() => {
    // Re-run parseScript when the toggle or cast changes — never on segment updates
    // (which would create an infinite loop since we update segments here).
    const result = parseScript(project.chapters, !!project.narrateStageDirections);
    const unknown = findUnknownVoices(result.detectedSpeakers, voiceMap);
    updateProject((p) => ({
      ...p,
      segments: result.segments,
      voiceMap,
      unknownVoices: unknown,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.narrateStageDirections, project.chapters, voiceMap]);

  const spokenCount = project.segments.filter((s) => s.speak).length;
  const skippedCount = project.segments.filter((s) => !s.speak).length;

  const saveEdit = (id: string) => {
    updateProject((p) => ({
      ...p,
      segments: p.segments.map((s) => (s.id === id ? { ...s, text: editText } : s)),
    }));
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-selected px-2.5 py-0.5 text-[11px] font-medium text-default mb-2">
          <Eye className="size-3 text-strong" />
          Step 5 · Pre-Generation Preview
        </div>
        <h2 className="text-[18px] font-medium text-strong">Review structured script segments</h2>
        <p className="mt-1 max-w-xl text-[13px] text-default">
          This is exactly what the TTS engine will speak. Voice markers are removed, and stage directions are handled based on your settings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">Spoken Segments</span>
          <p className="mt-1 text-[18px] font-medium text-strong">{spokenCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">Skipped Directions</span>
          <p className="mt-1 text-[18px] font-medium text-strong">{skippedCount.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">Unique Speakers</span>
          <p className="mt-1 text-[18px] font-medium text-strong">{project.characters.length}</p>
        </div>
      </div>

      {(project.unknownVoices?.length ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 text-amber-900 shadow-2xs">
          <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <h4 className="text-[13px] font-medium">Unknown Voice Names Detected</h4>
            <p className="mt-1 text-[12px] opacity-90 leading-relaxed">
              The script uses voice names that aren't mapped to any ElevenLabs TTS voice: 
              <strong className="font-medium ml-1">{(project.unknownVoices || []).join(", ")}</strong>.
              <br/>
              They will be spoken by the default narrator. Go back to Cast step to fix them.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Settings className="size-4 text-subtle" />
          <div className="space-y-0.5">
            <Label htmlFor="narrate-stage" className="text-[13px] font-medium text-strong">
              Narrate stage directions
            </Label>
            <p className="text-[12px] text-subtle">
              When on, parenthetical instructions are spoken by the narrator.
            </p>
          </div>
        </div>
        <Checkbox
          id="narrate-stage"
          checked={!!project.narrateStageDirections}
          onCheckedChange={(checked) =>
            updateProject((p) => ({ ...p, narrateStageDirections: !!checked }))
          }
        />
      </div>

      <div className="space-y-2">
        {project.segments.slice(0, 100).map((seg) => {
          const isEditing = editingId === seg.id;
          const assignedVoiceId = seg.scriptSpeaker 
            ? voiceMap[seg.scriptSpeaker.trim().toLowerCase()] 
            : project.characters.find(c => c.id === seg.speakerId)?.voiceId;
          const assignedLabel = voiceLabel(assignedVoiceId || null);

          return (
            <div
              key={seg.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-[13px] shadow-2xs transition-all",
                seg.speak ? "hover:border-default/30" : "opacity-60 bg-bg-selected/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border",
                    seg.speak ? "bg-[#F0FDF4] text-[#15803D] border-[#DCFCE7]" : "bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]"
                  )}>
                    {seg.speak ? "Speak: ON" : "Speak: OFF"}
                  </span>
                  <span className="font-mono text-[11px] text-subtle">
                    {seg.kind === "stage_direction" ? "stage direction" : "dialogue"}
                  </span>
                </div>
                {seg.speak && (
                  <span className="text-[11px] text-subtle font-medium bg-bg-selected px-2 py-0.5 rounded border border-border">
                    {seg.scriptSpeaker ? `${seg.scriptSpeaker} → ` : ""}{assignedLabel}
                  </span>
                )}
              </div>
              
              {isEditing ? (
                <div className="flex gap-2 mt-1">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="h-8 text-[13px]"
                    autoFocus
                  />
                  <Button size="sm" className="h-8 text-[12px]" onClick={() => saveEdit(seg.id)}>Save</Button>
                </div>
              ) : (
                <p 
                  className={cn("text-[13px] leading-relaxed", seg.speak ? "text-strong" : "text-subtle italic")}
                  onClick={() => {
                    setEditingId(seg.id);
                    setEditText(seg.text);
                  }}
                  style={{ cursor: "text" }}
                  title="Click to edit"
                >
                  {seg.text}
                </p>
              )}
            </div>
          );
        })}
        {project.segments.length > 100 && (
           <p className="text-[13px] text-subtle text-center py-4">Showing first 100 segments...</p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="ghost" size="sm" className="h-8 text-[12px]" onClick={onBack}>
          Back
        </Button>
        <Button
          size="sm"
          className="ml-auto h-8 text-[12px] bg-strong text-white hover:bg-strong/90 shadow-xs"
          onClick={() => {
            updateProject((p) => ({ ...p, stage: "generate" }));
            onDone();
          }}
        >
          <Sparkles className="size-3.5 mr-1" />
          Generate Audio
        </Button>
      </div>
    </div>
  );
}
