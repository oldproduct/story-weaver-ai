import { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildChapters, extractText } from "@/lib/extract";
import { buildSegments, estimateMinutes } from "@/lib/segment";
import { uid } from "@/lib/id";
import { setProject } from "@/lib/store";
import type { Chapter, ProjectState, Segment } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Draft {
  fileName: string;
  chapters: Chapter[];
  segments: Segment[];
}

export function UploadStep({ onReady }: { onReady: () => void }) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const raw = await extractText(file);
      if (raw.replace(/\s/g, "").length < 200) {
        throw new Error("That file has almost no readable text. Scanned PDFs aren't supported yet.");
      }
      const chapters = buildChapters(raw);
      const segments = buildSegments(chapters);
      setDraft({ fileName: file.name, chapters, segments });
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
    };
    setProject(project);
    onReady();
  };

  const words = draft?.chapters.reduce((n, c) => n + c.wordCount, 0) ?? 0;
  const dialogueLines = draft?.segments.filter((s) => s.kind === "dialogue").length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl">Bring in a manuscript</h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          PDF, DOCX, or TXT. Everything is processed in your browser — chapters, paragraphs, and
          quoted dialogue are preserved before any AI touches the text.
        </p>
      </div>

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
          "hairline relative flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-surface/60 p-10 text-center transition-colors",
          dragging && "border-brass bg-surface-raised",
        )}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-brass" />
            Extracting text…
          </div>
        ) : (
          <>
            <UploadCloud className="size-8 text-brass" />
            <p className="mt-4 text-sm">Drop your file here</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF · DOCX · TXT · book-length is fine</p>
            <Button variant="secondary" className="mt-5" onClick={() => inputRef.current?.click()}>
              Choose a file
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

      {draft && (
        <div className="hairline rounded-xl border bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 size-5 text-brass" />
              <div>
                <p className="font-medium">{draft.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {draft.chapters.length} chapters · {words.toLocaleString()} words ·{" "}
                  {dialogueLines.toLocaleString()} quoted lines · ~
                  {Math.round(estimateMinutes(words))} min of narration
                </p>
              </div>
            </div>
            <Button onClick={start}>Analyze speakers</Button>
          </div>

          <ul className="mt-5 max-h-56 divide-y divide-border overflow-y-auto rounded-lg border bg-background/40 text-sm">
            {draft.chapters.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2">
                <span className="truncate pr-4">{c.title}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {c.wordCount.toLocaleString()} w
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
