import { useEffect, useRef, useState } from "react";
import { Brain, CheckCircle2, Loader2, Sparkles, Users } from "lucide-react";
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
      toast.success(`Discovered ${characters.filter((c) => !c.isNarrator).length} speaking characters`);
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
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-selected px-2.5 py-0.5 text-[11px] font-medium text-default mb-2">
          <Sparkles className="size-3 text-strong" />
          Step 2 · AI Speaker Intelligence
        </div>
        <h2 className="text-[18px] font-medium text-strong">Analyzing manuscript & speakers</h2>
        <p className="mt-1 max-w-xl text-[13px] text-default">
          Gemini walks the text in chronological batches, carrying a running cast roster to collapse
          aliases and nicknames while filtering out characters that are merely mentioned.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-bg-selected border border-border text-strong shrink-0">
            {running ? (
              <Loader2 className="size-5 animate-spin text-strong" />
            ) : (
              <Brain className="size-5 text-strong" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-strong">
                {running ? "Analyzing dialogue lines…" : "Analysis finished"}
              </p>
              <span className="font-mono text-[12px] font-medium text-strong">{pct}%</span>
            </div>
            <p className="text-[12px] text-subtle mt-0.5">
              {progress.done} of {progress.total} quoted lines processed
            </p>
          </div>
        </div>

        <Progress value={pct} className="mt-4 h-1.5 bg-[#F1EBE1] [&>div]:bg-[#7052FF]" />

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] border-t border-border/80 pt-3">
          <div className="flex items-center gap-3 text-subtle">
            <span className="flex items-center gap-1.5 text-default">
              <Users className="size-3.5 text-strong" />
              <strong className="text-strong font-medium">{progress.charactersFound}</strong> speakers detected
            </span>
            <span>·</span>
            <span>Batches of 24 lines</span>
          </div>

          <div>
            {running ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[12px] text-subtle hover:text-strong"
                onClick={() => {
                  stopRef.current = true;
                  toast.message("Stopping after current batch…");
                }}
              >
                Pause analysis
              </Button>
            ) : (
              <Button size="sm" variant="secondary" className="h-7 text-[12px]" onClick={() => void start()}>
                Run again
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Intelligence Info Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="size-3.5 text-strong" />
            <h4 className="text-[12px] font-medium text-strong">Alias & Title Consolidation</h4>
          </div>
          <p className="text-[12px] text-default leading-relaxed">
            Names like "Holmes", "Sherlock", and "Mr. Holmes" are mapped to a single voice identity.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="size-3.5 text-strong" />
            <h4 className="text-[12px] font-medium text-strong">Uncertain Line Tagging</h4>
          </div>
          <p className="text-[12px] text-default leading-relaxed">
            Ambiguous dialogue without clear tags is scored with lower confidence for quick review.
          </p>
        </div>
      </div>
    </div>
  );
}
