"use client";

type TrendItem = {
  text: string;
  score: number;
  upvotes: number;
  comments: number;
  source: "reddit" | "wikipedia" | "hackernews";
};

export function TrendPanel({ trends, destination }: { trends: TrendItem[]; destination: string }) {
  if (!trends.length) return null;

  const maxScore = Math.max(...trends.map((t) => t.score), 1);

  return (
    <div className="space-y-3 py-3 border-t border-border">
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
        trending · {destination.split(",")[0]}
      </p>
      <div className="space-y-3">
        {trends.map((t, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 rounded-full bg-foreground/80 shrink-0 transition-all"
                style={{ width: `${Math.max(8, (t.score / maxScore) * 100)}%` }}
              />
              <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                {t.score.toFixed(0)} pts
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{t.text}</p>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground/60">
              <span className="uppercase tracking-wider">{t.source}</span>
              {(t.source === "reddit" || t.source === "hackernews") && (
                <>
                  <span>▲ {t.upvotes.toLocaleString()}</span>
                  <span>💬 {t.comments.toLocaleString()}</span>
                </>
              )}
              {t.source === "wikipedia" && (
                <span>👁 {t.upvotes.toLocaleString()} avg views/day</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="font-mono text-[9px] text-muted-foreground/50 leading-relaxed">
        Sponsored and repeated content filtered out · scored by recency × engagement
      </p>
    </div>
  );
}
