import { useEffect, useRef, useState } from "react";
import { Loader2, Mic2, RefreshCw } from "lucide-react";
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
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl">Recording the cast</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Each narration and dialogue span is rendered with its own voice and cached by content, so
          changing one character later only re-records that character's lines.
        </p>
      </div>

      <div className="hairline rounded-xl border bg-surface p-6">
        <div className="flex items-center gap-3">
          {running ? (
            <Loader2 className="size-5 animate-spin text-brass" />
          ) : (
            <Mic2 className="size-5 text-brass" />
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm">
              {progress.current || "Preparing…"}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {progress.done}/{progress.total} clips
              </span>
            </p>
          </div>
          <span className="font-mono text-sm text-brass">{pct}%</span>
        </div>
        <Progress value={pct} className="mt-4" />
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>{progress.cached} clips reused from cache</span>
          {running ? (
            <Button size="sm" variant="ghost" onClick={() => (stopRef.current = true)}>
              Pause
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void start()}>
              <RefreshCw className="size-3.5" />
              Resume
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
