import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Stage } from "@/lib/types";

const STEPS: Array<{ id: Stage; label: string }> = [
  { id: "upload", label: "Upload" },
  { id: "analyze", label: "AI Analyze" },
  { id: "cast", label: "Cast & Voices" },
  { id: "review", label: "Review Lines" },
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
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                active && "bg-[#141414] text-[#F9F6F0] shadow-2xs",
                !active && canJump && "text-[#7D756C] hover:bg-[#EAE3D5] hover:text-[#141414]",
                !canJump && "text-[#7D756C]/40 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full border text-[10px] font-mono",
                  active && "border-[#F9F6F0]/40 text-[#F9F6F0]",
                  done && "bg-[#141414] text-[#F9F6F0] border-[#141414]",
                  !active && !done && "border-[#E5DFD3] text-[#7D756C]",
                )}
              >
                {done ? <Check className="size-2.5" /> : i + 1}
              </span>
              <span>{step.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-3 bg-[#E5DFD3] sm:w-4" />}
          </div>
        );
      })}
    </nav>
  );
}
