import { useRef, useState } from "react";
import {
  FileText,
  Loader2,
  UploadCloud,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildChapters, extractText } from "@/lib/extract";
import { buildSegments, estimateMinutes, hasVoiceMarkers } from "@/lib/segment";
import { uid } from "@/lib/id";
import { setProject } from "@/lib/store";
import type { Chapter, ProjectState, Segment } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Draft {
  fileName: string;
  chapters: Chapter[];
  segments: Segment[];
  isScript: boolean;
  spokenCount: number;
  skippedCount: number;
}

export function UploadStep({ onReady }: { onReady: (stage?: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processText = (fileName: string, raw: string) => {
    if (raw.replace(/\s/g, "").length < 60) {
      throw new Error("That file has almost no readable text. Scanned PDFs aren't supported yet.");
    }
    const chapters = buildChapters(raw);
    const isScript = hasVoiceMarkers(chapters);
    const segments = buildSegments(chapters);
    const spokenCount = segments.filter(s => s.speak).length;
    const skippedCount = segments.filter(s => !s.speak).length;
    setDraft({ fileName, chapters, segments, isScript, spokenCount, skippedCount });
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const raw = await extractText(file);
      processText(file.name, raw);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  };

  const start = () => {
    if (!draft) return;
    const project: ProjectState = {
      id: uid("proj"),
      fileName: draft.fileName,
      stage: "analyze",
      chapters: draft.chapters,
      segments: draft.segments,
      characters: [],
      sharedVoiceId: null,
      clips: {},
      createdAt: Date.now(),
      narrateStageDirections: false,
      voiceMap: {},
      unknownVoices: [],
    };
    
    if (draft.isScript) {
      // In script mode, we extract character rosters directly from voice markers
      const speakerNames = new Set<string>();
      for (const s of draft.segments) {
        if (s.scriptSpeaker) speakerNames.add(s.scriptSpeaker);
      }
      
      const characters = Array.from(speakerNames).map((name) => ({
        id: uid("chr"),
        name,
        aliases: [],
        gender: "unknown" as const,
        ageRange: "adult",
        description: "Imported from script marker",
        isNarrator: false,
        lineCount: draft.segments.filter(s => s.scriptSpeaker === name).length,
        wordCount: draft.segments.filter(s => s.scriptSpeaker === name).reduce((acc, s) => acc + (s.text.match(/\S+/g) ?? []).length, 0),
        firstChapter: 0,
        role: "lead" as const,
        voiceId: null,
        instructions: "",
      }));
      
      project.characters = characters;
      project.stage = "cast";
      setProject(project);
      onReady("cast");
    } else {
      setProject(project);
      onReady("analyze");
    }
  };

  const words = draft?.chapters.reduce((n, c) => n + c.wordCount, 0) ?? 0;
  const dialogueLines = draft?.segments.filter((s) => s.kind === "dialogue").length ?? 0;
  const narrationLines = draft?.segments.filter((s) => s.kind === "narration").length ?? 0;

  return (
    <div className="space-y-6">
      {!draft ? (
        /* Minimalist Hero Upload Dropzone */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={cn(
            "relative flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-card p-10 text-center transition-all duration-200",
            dragging
              ? "border-strong bg-bg-selected shadow-md scale-[1.005]"
              : "border-border hover:border-default/30 hover:bg-bg-selected/30 shadow-xs",
          )}
        >
          {busy ? (
            <div className="flex flex-col items-center gap-3 py-6 text-default">
              <div className="flex size-11 items-center justify-center rounded-xl bg-bg-selected border border-border">
                <Loader2 className="size-5 animate-spin text-strong" />
              </div>
              <p className="text-[13px] font-medium text-strong">Extracting manuscript text…</p>
              <p className="text-[12px] text-subtle">Detecting chapters, paragraphs, and dialogue quotes</p>
            </div>
          ) : (
            <>
              <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-bg-selected text-strong shadow-2xs mb-4">
                <UploadCloud className="size-6 text-strong" />
              </div>
              <h3 className="text-[16px] font-medium text-strong">Upload your manuscript</h3>
              <p className="mt-1 max-w-sm text-[13px] text-default">
                Drag and drop your file here, or click to browse from your device
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-medium text-subtle">
                <span className="rounded bg-bg-selected px-2 py-0.5 border border-border">PDF</span>
                <span className="rounded bg-bg-selected px-2 py-0.5 border border-border">DOCX</span>
                <span className="rounded bg-bg-selected px-2 py-0.5 border border-border">TXT</span>
                <span className="rounded bg-bg-selected px-2 py-0.5 border border-border">Markdown</span>
                <span className="text-subtle/70 ml-1">· Book-length supported</span>
              </div>

              <Button
                variant="default"
                size="sm"
                className="mt-5 h-8.5 rounded-lg px-4 text-[12px] font-medium shadow-xs"
                onClick={() => inputRef.current?.click()}
              >
                Choose file from device
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        /* Manuscript Inspection Screen */
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-bg-selected border border-border text-strong shrink-0">
                <FileText className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-medium text-strong">{draft.fileName}</h3>
                  <span className="rounded bg-bg-selected px-1.5 py-0.5 text-[11px] font-medium text-subtle border border-border">
                    Ready for AI
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-subtle">
                  {draft.isScript 
                    ? "Script format detected. Voice markers and stage directions parsed."
                    : "Manuscript parsed successfully with chapters and quoted speech separated."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-[12px] text-subtle hover:text-strong"
                onClick={() => setDraft(null)}
              >
                Change file
              </Button>
              <Button
                size="sm"
                className="h-8.5 rounded-lg px-4 text-[12px] font-medium bg-strong text-white hover:bg-strong/90 shadow-xs"
                onClick={start}
              >
                {draft.isScript ? "Proceed to cast voices" : "Analyze speakers"}
                <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">Chapters</span>
              <p className="mt-1 text-[18px] font-medium text-strong">{draft.chapters.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">Total Words</span>
              <p className="mt-1 text-[18px] font-medium text-strong">{words.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">
                {draft.isScript ? "Spoken Lines" : "Quoted Lines"}
              </span>
              <p className="mt-1 text-[18px] font-medium text-strong">
                {draft.isScript ? draft.spokenCount.toLocaleString() : dialogueLines.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">
                {draft.isScript ? "Skipped Directions" : "Est. Narration"}
              </span>
              <p className="mt-1 text-[18px] font-medium text-strong">
                {draft.isScript ? draft.skippedCount.toLocaleString() : `~${Math.round(estimateMinutes(words))} min`}
              </p>
            </div>
          </div>

          {/* Chapter Breakdown Drawer */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="flex items-center justify-between border-b border-border bg-bg-selected/60 px-4 py-2.5">
              <span className="text-[12px] font-medium text-strong">Detected Chapters & Length</span>
              <span className="text-[11px] text-subtle font-mono">{narrationLines} narration · {dialogueLines} dialogue</span>
            </div>
            <ul className="max-h-60 divide-y divide-border overflow-y-auto text-[12px]">
              {draft.chapters.map((c, i) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-bg-selected/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-4.5 items-center justify-center rounded-full bg-bg-selected text-[10px] font-mono text-subtle border border-border">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-strong">{c.title}</span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-subtle">
                    {c.wordCount.toLocaleString()} words
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
