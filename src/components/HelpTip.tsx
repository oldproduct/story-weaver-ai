import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small "?" icon with an arrow tooltip explaining what a control does and what to do. */
export function HelpTip({
  title,
  children,
  side = "top",
  className,
}: {
  title?: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <TooltipPrimitive.Root delayDuration={100}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={title ? `Help: ${title}` : "Help"}
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle text-subtle transition-colors hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          onClick={(e) => e.preventDefault()}
        >
          <HelpCircle className="size-3.5" />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-[260px] rounded-lg bg-primary px-3 py-2 text-[12px] leading-snug text-primary-foreground shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {title && <p className="mb-0.5 font-medium">{title}</p>}
          <div className="opacity-90">{children}</div>
          <TooltipPrimitive.Arrow className="fill-primary" width={12} height={6} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** Short "What to do here" hint shown at the top of each step. */
export function StepHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 inline-flex items-start gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[12px] text-default">
      <span className="font-medium text-strong">What to do here:</span>
      <span>{children}</span>
    </p>
  );
}
