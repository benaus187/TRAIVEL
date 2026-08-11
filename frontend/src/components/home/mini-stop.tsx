import { ReasonCodeChip } from "@/components/reason-code-chip";
import type { ReasonCode } from "@/lib/schemas/itinerary";
import { cn } from "@/lib/utils";

export type SampleStop = {
  time: string;
  name: string;
  codes: ReasonCode[];
  verified?: boolean;
};

export function MiniStop({
  stop,
  className,
  animate,
  delaySeconds,
  stampDelaySeconds,
}: {
  stop: SampleStop;
  className?: string;
  /** Play the assemble-in animation (motion-safe only, no-op otherwise). */
  animate?: boolean;
  delaySeconds?: number;
  stampDelaySeconds?: number;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[64px_1fr] bg-card border border-line-strong shadow-lg overflow-hidden",
        animate &&
          "motion-safe:opacity-0 motion-safe:translate-y-2.5 motion-safe:[animation:assemble-row_0.55s_ease-out_forwards]",
        className
      )}
      style={animate && delaySeconds != null ? { animationDelay: `${delaySeconds}s` } : undefined}
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
                animate
                  ? "motion-safe:opacity-0 motion-safe:scale-[0.6] motion-safe:-rotate-[14deg] motion-safe:[animation:stamp-pop_0.5s_cubic-bezier(.2,1.6,.4,1)_forwards]"
                  : "opacity-100"
              )}
              style={animate && stampDelaySeconds != null ? { animationDelay: `${stampDelaySeconds}s` } : undefined}
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
