import { useEffect, useRef, useState } from "react";
import { Database, Loader2, Mic2, RefreshCw, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { buildPlan, generateClips, type GenerationProgress } from "@/lib/pipeline";
import { updateProject } from "@/lib/store";
import type { ProjectState } from "@/lib/types";

export function GenerateStep({
  project,
  onDone,
}: {
  project: ProjectState;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress>({
    done: 0,
    total: project.segments.length,
    cached: 0,
    current: "",
  });
  const stopRef = useRef(false);
  const startedRef = useRef(false);

  const start = async () => {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    try {
      const plan = buildPlan(project);
      const clips = await generateClips(plan, setProgress, () => stopRef.current);
      updateProject((p) => {
        const next = { ...p.clips };
        for (const [segmentId, clip] of Object.entries(clips)) {
          next[segmentId] = { segmentId, key: clip.key, durationMs: clip.durationMs };
        }
        return { ...p, clips: next, stage: "listen" };
      });
      toast.success("Narration ready");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    stopRef.current = false;
    if (startedRef.current) return;
    startedRef.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-selected px-2.5 py-0.5 text-[11px] font-medium text-default mb-2">
          <Volume2 className="size-3 text-strong" />
          Step 5 · Speech Synthesis
        </div>
        <h2 className="text-[18px] font-medium text-strong">Recording the audio cast</h2>
        <p className="mt-1 max-w-xl text-[13px] text-default">
          Each span is rendered with its assigned ElevenLabs voice. Generated clips are indexed and
          cached by text hash, so future cast adjustments only regenerate modified lines.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-bg-selected border border-border text-strong shrink-0">
            {running ? (
              <Loader2 className="size-5 animate-spin text-strong" />
            ) : (
              <Mic2 className="size-5 text-strong" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-medium text-strong">
                {progress.current ? `“${progress.current}…”` : running ? "Synthesizing audio clips…" : "Generation finished"}
              </p>
              <span className="font-mono text-[12px] font-medium text-strong">{pct}%</span>
            </div>
            <p className="text-[12px] text-subtle mt-0.5">
              {progress.done} of {progress.total} narration and dialogue clips rendered
            </p>
          </div>
        </div>

        <Progress value={pct} className="mt-4 h-1.5 bg-[#F1EBE1] [&>div]:bg-[#7052FF]" />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] border-t border-border/80 pt-3">
          <div className="flex items-center gap-2 text-subtle">
            <Database className="size-3.5 text-strong" />
            <span>
              <strong className="text-strong font-medium">{progress.cached}</strong> clips reused from IndexedDB
            </span>
          </div>
          <div>
            {running ? (
              <Button size="sm" variant="ghost" className="h-7 text-[12px] text-subtle hover:text-strong" onClick={() => (stopRef.current = true)}>
                Pause rendering
              </Button>
            ) : (
              <Button size="sm" variant="secondary" className="h-7 text-[12px]" onClick={() => void start()}>
                <RefreshCw className="size-3 mr-1" />
                Resume
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
