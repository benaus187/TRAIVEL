"use client";

import { useEffect, useState } from "react";
import { ReasonCodeChip } from "@/components/reason-code-chip";
import type { ReasonCode } from "@/lib/schemas/itinerary";
import { cn } from "@/lib/utils";

export type SampleStop = {
  time: string;
  name: string;
  codes: ReasonCode[];
  verified?: boolean;
};

// The verified stamp lands as its own beat after the card has already
// slid into place, not simultaneously with it.
const STAMP_EXTRA_DELAY_MS = 450;

export function MiniStop({
  stop,
  className,
  enterDelayMs,
}: {
  stop: SampleStop;
  className?: string;
  /** If set, the card mounts hidden and transitions to visible after this delay — used to stagger a sequence. Omit for an already-visible card. */
  enterDelayMs?: number;
}) {
  const [revealed, setRevealed] = useState(enterDelayMs == null);
  const [stampRevealed, setStampRevealed] = useState(enterDelayMs == null);

  useEffect(() => {
    if (enterDelayMs == null) return;
    const timer = setTimeout(() => setRevealed(true), enterDelayMs);
    return () => clearTimeout(timer);
  }, [enterDelayMs]);

  useEffect(() => {
    if (enterDelayMs == null || !stop.verified) return;
    const timer = setTimeout(() => setStampRevealed(true), enterDelayMs + STAMP_EXTRA_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enterDelayMs, stop.verified]);

  return (
    <div
      className={cn(
        "grid grid-cols-[64px_1fr] bg-card border border-line-strong shadow-lg overflow-hidden",
        "transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none",
        revealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2.5",
        className
      )}
    >
      <div className="flex flex-col items-center justify-center gap-0.5 bg-navy text-background px-1.5 py-2.5">
        <span className="font-mono font-bold text-base tabular-nums">{stop.time}</span>
        <span className="font-mono text-[8px] tracking-[0.16em] opacity-75">DEPART</span>
      </div>
      <div className="flex flex-col gap-1.5 px-3.5 py-2.5 border-l-2 border-dashed border-line min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[13px] font-bold uppercase tracking-tight truncate">{stop.name}</h4>
          {stop.verified && (
            <span
              className={cn(
                "shrink-0 inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-stamp",
                "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
                stampRevealed ? "opacity-100 scale-100 -rotate-[11deg]" : "opacity-0 scale-[0.6] -rotate-[14deg]"
              )}
            >
              ✓ verified
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {stop.codes.map((code) => (
            <ReasonCodeChip key={code} code={code} />
          ))}
        </div>
      </div>
    </div>
  );
}
