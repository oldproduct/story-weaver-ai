import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AudioLines, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepRail } from "@/components/StepRail";
import { UploadStep } from "@/components/UploadStep";
import { AnalyzeStep } from "@/components/AnalyzeStep";
import { CastStep } from "@/components/CastStep";
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

const ORDER: Stage[] = ["upload", "analyze", "cast", "generate", "listen"];

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
    <div className="min-h-screen bg-background text-foreground">
      <header className="hairline sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-2">
            <AudioLines className="size-5 text-brass" />
            <span className="text-lg tracking-tight">Chorus</span>
          </div>
          <div className="ml-auto order-3 w-full sm:order-2 sm:ml-auto sm:w-auto">
            <StepRail stage={stage} onJump={goto} reachable={reachable} />
          </div>
          {project && (
            <Button
              size="sm"
              variant="ghost"
              className="order-2 text-muted-foreground sm:order-3"
              onClick={async () => {
                await clearClips();
                setProject(null);
                setStage("upload");
              }}
            >
              <Trash2 className="size-4" />
              New book
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {!hydrated ? (
          <p className="text-sm text-muted-foreground">Loading your workspace…</p>
        ) : !project || stage === "upload" ? (
          <>
            <section className="mb-12 max-w-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-brass">
                Full-cast narration studio
              </p>
              <h1 className="mt-3 text-5xl leading-[1.05]">
                Every character gets <em className="text-brass">their own voice.</em>
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
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
          <CastStep project={project} onDone={() => setStage("generate")} />
        ) : stage === "generate" ? (
          <GenerateStep project={project} onDone={() => setStage("listen")} />
        ) : (
          <ListenStep project={project} onBack={() => setStage("cast")} />
        )}
      </main>

      <footer className="hairline mx-auto max-w-5xl border-t px-6 py-8 text-xs text-muted-foreground">
        Files, clips and drafts stay in this browser. Nothing is uploaded except the text sent for
        analysis and narration.
      </footer>
    </div>
  );
}
