import { useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  FileDown,
  FileText,
  Loader2,
  UploadCloud,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { HelpTip, StepHint } from "@/components/HelpTip";
import { buildChapters, extractText } from "@/lib/extract";
import { buildSegments, countMarkers, estimateMinutes } from "@/lib/segment";
import { uid } from "@/lib/id";
import { setProject } from "@/lib/store";
import type { Chapter, ProjectState, Segment } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Draft {
  fileName: string;
  chapters: Chapter[];
  segments: Segment[];
}

const SAMPLE_FILE_NAME = "sample-formatted-story.txt";
const SAMPLE_FILE_TEXT = `अध्याय एक

सूरज ढल रहा था। गाँव की मिट्टी की सड़क पर धूल उड़ रही थी। मीरा तेज़ कदमों से चल रही थी।

(voice: Meera)
तुम यहीं हो? मैं तुम्हें बहुत देर से ढूँढ रही थी।

रोहन: हाँ मीरा, मुझे तुमसे कुछ ज़रूरी बात कहनी थी।

"पहले बात करो, मैं सुन रही हूँ।" मीरा ने धीरे से कहा।

— चलो, पहले घर चलते हैं। रास्ते में सब बता दूँगा।

अध्याय दो

अगली सुबह गाँव में सन्नाटा था। किसी को नहीं पता था कि रात को असल में हुआ क्या था।
`;

const cueClass = "rounded bg-bg-selected px-1 py-0.5 font-mono text-[11px] text-strong";

/** Collapsible guide explaining every marker a prepared document can use. */
function FormatGuide() {
  const [open, setOpen] = useState(false);

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_FILE_TEXT], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = SAMPLE_FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-card shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-bg-selected/40"
      >
        <span className="flex items-center gap-2 text-[13px] font-medium text-strong">
          <BookOpen className="size-4 shrink-0 text-subtle" />
          How to mark voices, paragraphs &amp; chapters in your file
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-subtle transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4 text-[12px] leading-relaxed text-default">
          <div>
            <p className="font-medium text-strong">1. How does it know when to pause?</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                Leave one <span className="font-medium text-strong">empty line</span> between paragraphs → a natural ~0.6 second pause.
              </li>
              <li>
                Write a chapter heading on its own line, like{" "}
                <code className={cueClass}>अध्याय 1</code> or <code className={cueClass}>Chapter 1</code> → a new chapter with a 1.5 second silence.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-strong">2. How does it know who is speaking?</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                Quotes: <code className={cueClass}>"तुम कहाँ जा रहे हो?"</code> is dialogue — everything outside quotes is read by the narrator.
              </li>
              <li>
                Script style: <code className={cueClass}>रोहन: नमस्ते!</code> — the name before the colon becomes that character's speaker.
              </li>
              <li>
                Dash style: <code className={cueClass}>— चलो चलते हैं</code> at the start of a line is also dialogue.
              </li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-strong">3. How do I force a specific voice?</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                Write <code className={cueClass}>(voice: Riya)</code> on its own line (or at the start of a line) → that text is spoken by the speaker named Riya.
              </li>
              <li>The name must match a speaker on the Speakers screen — spelling matters.</li>
            </ul>
          </div>
          <p className="rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-subtle">
            Everything else is detected automatically by AI — these markers are only needed when you want to be extra sure.
          </p>
          <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-[12px]" onClick={downloadSample}>
            <FileDown className="mr-1.5 size-3.5" />
            Download a sample formatted file
          </Button>
        </div>
      )}
    </div>
  );
}

export function UploadStep({ onReady }: { onReady: () => void }) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processText = (fileName: string, raw: string) => {
    if (raw.replace(/\s/g, "").length < 60) {
      throw new Error("That file has almost no readable text. Scanned PDFs aren't supported yet.");
    }
    const chapters = buildChapters(raw);
    const segments = buildSegments(chapters);
    setDraft({ fileName, chapters, segments });
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
    };
    setProject(project);
    onReady();
  };

  const words = draft?.chapters.reduce((n, c) => n + c.wordCount, 0) ?? 0;
  const dialogueLines = draft?.segments.filter((s) => s.kind === "dialogue").length ?? 0;
  const narrationLines = draft?.segments.filter((s) => s.kind === "narration").length ?? 0;
  const markers = countMarkers(draft?.chapters ?? []);

  return (
    <div className="space-y-6">
      {!draft ? (
        <>
        {/* Minimalist Hero Upload Dropzone */}
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
              <div className="mt-2"><HelpTip title="Upload your file">Pick a PDF, DOCX, TXT or Markdown file. Text stays in your browser. Next you can check it and start the speaker analysis.</HelpTip></div>
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
        <FormatGuide />
      </>
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
                  Manuscript parsed successfully with chapters and quoted speech separated.
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
                Analyze speakers
                <ArrowRight className="size-3.5 ml-1.5" />
              </Button>
              <HelpTip title="Analyze speakers">AI reads the whole text, finds the narrator and each speaking character, and guesses an emotion for every line. Click it, then wait for it to finish.</HelpTip>
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
              <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">Quoted Lines</span>
              <p className="mt-1 text-[18px] font-medium text-strong">{dialogueLines.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">Est. Narration</span>
              <p className="mt-1 text-[18px] font-medium text-strong">~{Math.round(estimateMinutes(words))} min</p>
            </div>
          </div>

          {/* Chapter Breakdown Drawer */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="flex items-center justify-between border-b border-border bg-bg-selected/60 px-4 py-2.5">
              <span className="text-[12px] font-medium text-strong">Detected Chapters & Length</span>
              <span className="flex items-center gap-1.5 text-[11px] text-subtle font-mono">
                {narrationLines} narration · {dialogueLines} dialogue · {markers.voiceTags} voice tags · {markers.scriptLines} script lines
              </span>
              <HelpTip title="Markers found">
                Voice tags are counted from (voice: Name) lines and script lines from NAME: lines in your file. If a count looks wrong, check the spelling — the name in a (voice: …) tag must match a speaker on the Speakers screen.
              </HelpTip>
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
