import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Stage } from "@/lib/types";

const STEPS: Array<{ id: Stage; label: string }> = [
  { id: "upload", label: "Upload" },
  { id: "analyze", label: "AI Analyze" },
  { id: "cast", label: "Cast & Voices" },
  { id: "generate", label: "Generate" },
  { id: "listen", label: "Listen" },
];

export function StepRail({
  stage,
  onJump,
  reachable,
}: {
  stage: Stage;
  onJump: (s: Stage) => void;
  reachable: Stage[];
}) {
  const currentIndex = STEPS.findIndex((s) => s.id === stage);
  return (
    <nav aria-label="Progress" className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const canJump = reachable.includes(step.id);
        return (
          <div key={step.id} className="flex items-center">
            <button
              type="button"
              disabled={!canJump}
              onClick={() => canJump && onJump(step.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs tracking-wide transition-colors",
                active && "bg-brass text-brass-foreground font-medium",
                !active && canJump && "text-foreground/80 hover:bg-secondary",
                !canJump && "text-muted-foreground/50 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px]",
                  active ? "border-brass-foreground/40" : "border-border",
                  done && "bg-sage/20 border-sage/40",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              {step.label}
            </button>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-border sm:w-6" />}
          </div>
        );
      })}
    </nav>
  );
}
