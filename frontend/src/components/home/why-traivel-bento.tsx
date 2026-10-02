import { useTranslations } from "next-intl";
import { ReasonCodeChip } from "@/components/reason-code-chip";
import type { ReasonCode } from "@/lib/schemas/itinerary";

const TREND_ROWS: { name: string; score: number }[] = [
  { name: "Train Street", score: 94 },
  { name: "Cà Phê Trứng", score: 88 },
  { name: "Hoàn Kiếm Lake", score: 81 },
];

const ALL_CODES: ReasonCode[] = [
  "social momentum",
  "transport fit",
  "food fit",
  "budget fit",
  "weather alternate ready",
];

function MiniStamp() {
  return (
    <svg viewBox="0 0 60 60" width="34" height="34" aria-hidden="true">
      <defs>
        <filter id="bento-stamp-turb">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" />
        </filter>
      </defs>
      <g filter="url(#bento-stamp-turb)" transform="rotate(-10 30 30)" fill="none" stroke="var(--stamp)">
        <circle cx="30" cy="30" r="24" strokeWidth="1.4" strokeDasharray="2 2" opacity="0.85" />
        <circle cx="30" cy="30" r="18" strokeWidth="1.8" />
        <path d="M21 30 L27 36 L39 22" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function WhyTraivelBento() {
  const t = useTranslations("home.bento");
  return (
    <section className="py-14 border-t border-border">
      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-6">
        {t("eyebrow")}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-4">
        <div className="md:row-span-2 bg-card border border-line-strong p-6 flex flex-col gap-3.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("trendSignals.label")}
          </span>
          <h3 className="text-lg font-bold leading-snug">
            {t("trendSignals.title")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("trendSignals.body")}
          </p>
          <div className="mt-auto bg-board-bg text-board-fg px-4 py-3.5">
            <div className="flex items-center justify-between font-sans font-bold uppercase text-[11px] tracking-wide mb-2.5">
              {t("demoHeading")}
              <span className="w-1.5 h-1.5 rounded-full bg-stamp animate-pulse" />
            </div>
            {TREND_ROWS.map((row, i) => (
              <div
                key={row.name}
                className="grid grid-cols-[18px_1fr_40px] items-center gap-2.5 py-1.5 font-mono border-t border-board-fg/10 first:border-t-0"
              >
                <span className="text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-[11px] uppercase tracking-wide truncate">{row.name}</span>
                  <span className="block h-1 bg-board-fg/10 rounded-sm overflow-hidden mt-0.5">
                    <span
                      className="block h-full bg-[linear-gradient(90deg,var(--vermilion),var(--gold))]"
                      style={{ width: `${row.score}%` }}
                    />
                  </span>
                </span>
                <span className="text-xs font-bold text-right tabular-nums">{row.score}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-line-strong p-6 flex flex-col gap-3.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("reasonCodes.label")}
          </span>
          <h3 className="text-lg font-bold leading-snug">
            {t("reasonCodes.title")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("reasonCodes.body")}
          </p>
          <div className="mt-auto flex flex-wrap gap-1.5">
            {ALL_CODES.map((code) => (
              <ReasonCodeChip key={code} code={code} />
            ))}
          </div>
        </div>

        <div className="bg-card border border-line-strong p-6 flex flex-col gap-3.5">
          <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("verification.label")}
          </span>
          <h3 className="text-lg font-bold leading-snug">
            {t("verification.title")}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("verification.body")}
          </p>
          <div className="mt-auto grid grid-cols-[44px_1fr_56px] border border-line-strong bg-background">
            <div className="bg-navy text-background font-mono text-xs flex items-center justify-center">
              09:30
            </div>
            <div className="px-2.5 py-2 text-xs font-bold uppercase border-l-2 border-r-2 border-dashed border-line flex items-center">
              {t("cafeStop")}
            </div>
            <div className="flex items-center justify-center">
              <MiniStamp />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
