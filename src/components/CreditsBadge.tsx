import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Coins } from "lucide-react";
import { getCredits } from "@/lib/credits.functions";
import { onCreditsChanged } from "@/lib/credits-events";
import { cn } from "@/lib/utils";

export function CreditsBadge() {
  const fetchCredits = useServerFn(getCredits);
  const q = useQuery({
    queryKey: ["elevenlabs-credits"],
    queryFn: () => fetchCredits(),
    refetchInterval: 30_000,
    staleTime: 5_000,
  });

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = onCreditsChanged(() => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        void q.refetch();
      }, 1500);
    });
    return () => {
      off();
      if (t) clearTimeout(t);
    };
  }, [q]);

  const d = q.data;
  if (!d) {
    return (
      <span className="text-[11px] text-subtle">{q.isError ? "Credits unavailable" : "Credits…"}</span>
    );
  }
  if (!d.ok) return <span className="text-[11px] text-subtle">Credits unavailable</span>;

  const left = Math.max(0, d.limit - d.used);
  const pct = d.limit ? left / d.limit : 0;
  const tone = pct < 0.05 ? "bg-destructive" : pct < 0.2 ? "bg-amber-500" : "bg-emerald-500";
  const reset = d.resetAt ? new Date(d.resetAt * 1000).toLocaleDateString() : "unknown";

  return (
    <TooltipPrimitive.Root delayDuration={100}>
      <TooltipPrimitive.Trigger asChild>
        <div className="flex min-w-[130px] cursor-default flex-col gap-1 rounded-md border border-border px-2 py-1">
          <div className="flex items-center gap-1.5 text-[11px] text-default">
            <Coins className="size-3 text-subtle" />
            <span className="font-medium text-strong">{left.toLocaleString()}</span>
            <span className="text-subtle">/ {d.limit.toLocaleString()} left</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full", tone)} style={{ width: `${Math.round(pct * 100)}%` }} />
          </div>
        </div>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="bottom"
          sideOffset={6}
          className="z-50 max-w-[260px] rounded-lg bg-primary px-3 py-2 text-[12px] leading-snug text-primary-foreground shadow-md"
        >
          <p className="font-medium">ElevenLabs credits (live)</p>
          <p className="opacity-90">
            Each spoken character uses one credit. {d.used.toLocaleString()} used this period
            {d.tier ? ` on the ${d.tier} plan` : ""}. Resets on {reset}. Updates every 30 seconds and
            after each recording.
          </p>
          <TooltipPrimitive.Arrow className="fill-primary" width={12} height={6} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
