import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assembleBook, assembleChapter } from "@/lib/pipeline";
import { durationMs, encodeMp3, pcmToWavBlob } from "@/lib/audio";
import { stopPreview } from "@/lib/preview";
import { updateProject } from "@/lib/store";
import type { ProjectState } from "@/lib/types";
import { cn } from "@/lib/utils";

function fmt(ms: number) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ListenStep({ project, onBack }: { project: ProjectState; onBack: () => void }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      stopPreview();
    },
    [],
  );

  const totalMs = Object.values(project.clips).reduce((n, c) => n + c.durationMs, 0);

  const play = async (chapterId: string) => {
    if (playing === chapterId) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    setBusy(chapterId);
    try {
      audioRef.current?.pause();
      const pcm = chapterId === "all" ? await assembleBook(project) : await assembleChapter(project, chapterId);
      if (pcm.length === 0) throw new Error("No audio for that chapter yet.");
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(pcmToWavBlob(pcm));
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("ended", () => setPlaying(null));
      await audio.play();
      setPlaying(chapterId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Playback failed.");
    } finally {
      setBusy(null);
    }
  };

  const download = async (chapterId: string, label: string) => {
    setBusy(`dl-${chapterId}`);
    try {
      const pcm = chapterId === "all" ? await assembleBook(project) : await assembleChapter(project, chapterId);
      if (pcm.length === 0) throw new Error("Nothing to export yet.");
      const blob = await encodeMp3(pcm);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${label.replace(/[^\w\- ]+/g, "").trim() || "narration"}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("MP3 exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl">Your audiobook</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {project.chapters.length} chapters · {fmt(totalMs)} of narration ·{" "}
            {new Set(project.characters.filter((c) => c.voiceId).map((c) => c.voiceId)).size} voices
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              updateProject((p) => ({ ...p, stage: "cast" }));
              onBack();
            }}
          >
            <RotateCcw className="size-4" />
            Adjust cast
          </Button>
          <Button disabled={busy === "dl-all"} onClick={() => void download("all", project.fileName)}>
            {busy === "dl-all" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Download full MP3
          </Button>
        </div>
      </div>

      <div className="hairline overflow-hidden rounded-xl border bg-surface">
        <div className="flex items-center gap-3 border-b bg-surface-raised px-4 py-3">
          <Button size="icon" variant="ghost" onClick={() => void play("all")} disabled={busy === "all"}>
            {busy === "all" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : playing === "all" ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
          <span className="text-sm">Play the whole book</span>
          <span className="ml-auto font-mono text-xs text-muted-foreground">{fmt(totalMs)}</span>
        </div>
        <ul className="divide-y divide-border">
          {project.chapters.map((chapter) => {
            const ms = project.segments
              .filter((s) => s.chapterId === chapter.id)
              .reduce((n, s) => n + (project.clips[s.id]?.durationMs ?? 0), 0);
            return (
              <li
                key={chapter.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-sm",
                  playing === chapter.id && "bg-surface-raised",
                )}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy === chapter.id}
                  onClick={() => void play(chapter.id)}
                >
                  {busy === chapter.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : playing === chapter.id ? (
                    <Pause className="size-4" />
                  ) : (
                    <Play className="size-4" />
                  )}
                </Button>
                <span className="truncate">{chapter.title}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{fmt(ms)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={busy === `dl-${chapter.id}`}
                  onClick={() => void download(chapter.id, chapter.title)}
                  aria-label={`Download ${chapter.title}`}
                >
                  {busy === `dl-${chapter.id}` ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
