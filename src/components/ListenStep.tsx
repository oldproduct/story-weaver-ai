import { useEffect, useRef, useState } from "react";
import { Download, Headphones, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assembleBook, assembleChapter } from "@/lib/pipeline";
import { encodeMp3, pcmToWavBlob } from "@/lib/audio";
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-selected px-2.5 py-0.5 text-[11px] font-medium text-default mb-2">
            <Headphones className="size-3 text-strong" />
            Step 6 · Mastered Audio & Export
          </div>
          <h2 className="text-[18px] font-medium text-strong">Your multi-voice audiobook</h2>
          <p className="mt-1 text-[13px] text-default">
            {project.chapters.length} chapters · {fmt(totalMs)} of audio ·{" "}
            {new Set(project.characters.filter((c) => c.voiceId).map((c) => c.voiceId)).size} distinct voices
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-8.5 rounded-lg text-[12px]"
            onClick={() => {
              updateProject((p) => ({ ...p, stage: "cast" }));
              onBack();
            }}
          >
            <RotateCcw className="size-3.5 mr-1" />
            Adjust cast
          </Button>
          <Button
            size="sm"
            className="h-8.5 rounded-lg text-[12px] bg-strong text-white hover:bg-strong/90 shadow-xs"
            disabled={busy === "dl-all"}
            onClick={() => void download("all", project.fileName)}
          >
            {busy === "dl-all" ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Download className="size-3.5 mr-1" />}
            Download full MP3
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-3 border-b border-border bg-bg-selected/70 px-4 py-3">
          <Button
            size="icon"
            variant="ghost"
            className="size-7 rounded-lg text-strong hover:bg-card"
            onClick={() => void play("all")}
            disabled={busy === "all"}
          >
            {busy === "all" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : playing === "all" ? (
              <Pause className="size-3.5" />
            ) : (
              <Play className="size-3.5" />
            )}
          </Button>
          <span className="text-[13px] font-medium text-strong">Play entire audiobook</span>
          <span className="ml-auto font-mono text-[11px] text-subtle">{fmt(totalMs)}</span>
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
                  "flex items-center gap-3 px-4 py-2.5 text-[13px] text-default transition-colors hover:bg-bg-selected/30",
                  playing === chapter.id && "bg-bg-selected",
                )}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-lg text-subtle hover:text-strong hover:bg-card"
                  disabled={busy === chapter.id}
                  onClick={() => void play(chapter.id)}
                >
                  {busy === chapter.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : playing === chapter.id ? (
                    <Pause className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                </Button>
                <span className="truncate text-strong font-medium">{chapter.title}</span>
                <span className="ml-auto font-mono text-[11px] text-subtle">{fmt(ms)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-lg text-subtle hover:text-strong hover:bg-card"
                  disabled={busy === `dl-${chapter.id}`}
                  onClick={() => void download(chapter.id, chapter.title)}
                  aria-label={`Download ${chapter.title}`}
                >
                  {busy === `dl-${chapter.id}` ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
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
