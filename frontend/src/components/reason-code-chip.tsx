import { ReasonCode } from "@/lib/schemas/itinerary";
import { cn } from "@/lib/utils";

const CHIP_STYLES: Record<ReasonCode, string> = {
  "social momentum":
    "bg-[color-mix(in_oklch,var(--vermilion)_14%,var(--paper-card))] text-vermilion border-vermilion/30",
  "transport fit":
    "bg-[color-mix(in_oklch,var(--navy)_14%,var(--paper-card))] text-navy border-navy/30",
  "food fit":
    "bg-[color-mix(in_oklch,var(--gold)_16%,var(--paper-card))] text-gold border-gold/30",
  "budget fit":
    "bg-[color-mix(in_oklch,var(--stamp)_14%,var(--paper-card))] text-stamp border-stamp/30",
  "weather alternate ready": "bg-border/60 text-ink-soft border-border",
};

export function ReasonCodeChip({ code }: { code: ReasonCode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] font-mono font-medium leading-none",
        CHIP_STYLES[code]
      )}
    >
      {code}
    </span>
  );
}
