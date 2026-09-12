import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AudioLines, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepRail } from "@/components/StepRail";
import { UploadStep } from "@/components/UploadStep";
import { AnalyzeStep } from "@/components/AnalyzeStep";
import { CastStep } from "@/components/CastStep";
import { ReviewStep } from "@/components/ReviewStep";
import { GenerateStep } from "@/components/GenerateStep";
import { ListenStep } from "@/components/ListenStep";
import { hydrate, setProject, updateProject, useHydrated, useProject } from "@/lib/store";
import { clearClips } from "@/lib/clip-cache";
import type { Stage } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chorus — AI Multi-Voice Audiobook Generator" },
      {
        name: "description",
        content:
          "Upload a PDF, DOCX or TXT and get a full-cast audiobook: AI detects the narrator and real speaking characters, you pick voices, then export MP3.",
      },
      { property: "og:title", content: "Chorus — AI Multi-Voice Audiobook Generator" },
      {
        property: "og:description",
        content:
          "Upload a manuscript, let AI cast the narrator and characters, choose voices, and export a full-cast MP3 audiobook.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

const ORDER: Stage[] = ["upload", "analyze", "cast", "review", "generate", "listen"];

function Studio() {
  const hydrated = useHydrated();
  const project = useProject();
  const [stage, setStage] = useState<Stage>("upload");

  useEffect(() => {
    void hydrate();
  }, []);

  useEffect(() => {
    if (project) setStage(project.stage);
  }, [project?.id, project?.stage]);

  const reachable: Stage[] = project
    ? ORDER.slice(0, ORDER.indexOf(project.stage) + 1)
    : ["upload"];

  const goto = (next: Stage) => {
    setStage(next);
    if (project) updateProject((p) => ({ ...p, stage: next }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[#141414] text-[#F9F6F0] shadow-xs">
              <AudioLines className="size-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] font-medium tracking-tight text-[#141414]">Chorus</span>
              <span className="hidden rounded bg-[#F1EBE1] px-1.5 py-0.5 text-[10px] font-medium text-[#7D756C] border border-border sm:inline-block">
                Studio
              </span>
            </div>
          </div>
          <div className="order-3 w-full sm:order-2 sm:w-auto">
            <StepRail stage={stage} onJump={goto} reachable={reachable} />
          </div>
          {project ? (
            <Button
              size="sm"
              variant="ghost"
              className="order-2 h-7 rounded-md px-2.5 text-[12px] text-default hover:bg-bg-selected hover:text-strong sm:order-3"
              onClick={async () => {
                await clearClips();
                setProject(null);
                setStage("upload");
              }}
            >
              <Trash2 className="size-3.5 text-subtle" />
              New book
            </Button>
          ) : (
            <div className="order-2 hidden sm:order-3 sm:block w-20" />
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {!hydrated ? (
          <div className="flex items-center justify-center py-20 text-[13px] text-subtle">
            Loading your workspace…
          </div>
        ) : !project || stage === "upload" ? (
          <>
            <section className="mb-8 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[#F1EBE1] px-2.5 py-0.5 text-[11px] font-medium text-[#4D4740] mb-3.5">
                <span className="size-1.5 rounded-full bg-[#7052FF]" />
                Full-Cast Audio Production
              </div>
              <h1 className="text-[24px] font-medium leading-snug tracking-tight text-[#141414]">
                Every character gets <span className="text-subtle font-normal">their own voice.</span>
              </h1>
              <p className="mt-2.5 text-[13px] leading-relaxed text-default">
                Chorus reads your manuscript the way a casting director would: it separates
                narration from dialogue, works out who is actually speaking, folds nicknames back
                into one person, and recommends the smallest set of voices that still sounds like a
                full cast.
              </p>
            </section>
            <UploadStep onReady={() => setStage("analyze")} />
          </>
        ) : stage === "analyze" ? (
          <AnalyzeStep project={project} onDone={() => setStage("cast")} />
        ) : stage === "cast" ? (
          <CastStep project={project} onDone={() => setStage("review")} />
        ) : stage === "review" ? (
          <ReviewStep
            project={project}
            onDone={() => setStage("generate")}
            onBack={() => setStage("cast")}
          />
        ) : stage === "generate" ? (
          <GenerateStep project={project} onDone={() => setStage("listen")} />
        ) : (
          <ListenStep project={project} onBack={() => setStage("cast")} />
        )}
      </main>

      <footer className="mt-auto border-t border-border bg-background/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5 text-[12px] text-subtle">
          <span>Files, clips and drafts stay in your browser.</span>
          <span className="text-[11px] text-subtle/80">ElevenLabs Multilingual & Gemini Intelligence</span>
        </div>
      </footer>
    </div>
  );
}
