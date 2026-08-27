import { useEffect, useRef, useState } from "react";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { runAnalysis, type AnalysisProgress } from "@/lib/pipeline";
import { updateProject } from "@/lib/store";
import type { ProjectState } from "@/lib/types";

export function AnalyzeStep({
  project,
  onDone,
}: {
  project: ProjectState;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<AnalysisProgress>({
    done: 0,
    total: project.segments.filter((s) => s.kind === "dialogue").length,
    charactersFound: 0,
  });
  const stopRef = useRef(false);
  const startedRef = useRef(false);

  const start = async () => {
    if (running) return;
    stopRef.current = false;
    setRunning(true);
    try {
      const { segments, characters } = await runAnalysis(
        project,
        setProgress,
        () => stopRef.current,
      );
      updateProject((p) => ({ ...p, segments, characters, stage: "cast" }));
      toast.success(`Found ${characters.filter((c) => !c.isNarrator).length} speaking characters`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed.");
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
        <h2 className="text-3xl">Reading the story</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          The speaker-intelligence pass walks the book in order, carrying a running cast list so
          aliases, nicknames and titles collapse into one person — and names that never actually
          speak never become voices.
        </p>
      </div>

      <div className="hairline rounded-xl border bg-surface p-6">
        <div className="flex items-center gap-3">
          {running ? (
            <Loader2 className="size-5 animate-spin text-brass" />
          ) : (
            <Brain className="size-5 text-brass" />
          )}
          <div className="flex-1">
            <p className="text-sm">
              {running ? "Attributing dialogue…" : "Analysis idle"}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {progress.done}/{progress.total} lines
              </span>
            </p>
          </div>
          <span className="font-mono text-sm text-brass">{pct}%</span>
        </div>
        <Progress value={pct} className="mt-4" />
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-brass" />
            {progress.charactersFound} candidate speakers so far
          </span>
          {running ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                stopRef.current = true;
                toast.message("Stopping after the current batch…");
              }}
            >
              Stop
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void start()}>
              Run again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
