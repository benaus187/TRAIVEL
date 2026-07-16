import { ReasonCode } from "@/lib/schemas/itinerary";
import { cn } from "@/lib/utils";

const CHIP_STYLES: Record<ReasonCode, string> = {
  "social momentum": "bg-rose-100 text-rose-700 border-rose-200",
  "transport fit": "bg-blue-100 text-blue-700 border-blue-200",
  "food fit": "bg-amber-100 text-amber-700 border-amber-200",
  "budget fit": "bg-green-100 text-green-700 border-green-200",
  "weather alternate ready": "bg-purple-100 text-purple-700 border-purple-200",
};

export function ReasonCodeChip({ code }: { code: ReasonCode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono font-medium leading-none",
        CHIP_STYLES[code]
      )}
    >
      {code}
    </span>
  );
}
