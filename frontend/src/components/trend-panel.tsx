"use client";

import type { TrendItem } from "@/hooks/use-itinerary-stream";

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

export function TrendPanel({ trends, destination }: { trends: TrendItem[]; destination: string }) {
  if (!trends.length) return null;

  const sources = new Set(trends.map((t) => t.source));
  const sourceLabel = [
    sources.has("google_places") ? "Google Places" : null,
    sources.has("youtube") ? "YouTube" : null,
  ]
    .filter(Boolean)
    .join(" & ");

  return (
    <div className="space-y-3 py-3 border-t border-border">
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
        popular in {destination.split(",")[0]} · via {sourceLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        {trends.map((t, i) =>
          t.source === "youtube" ? (
            <a
              key={i}
              href={`https://youtube.com/watch?v=${t.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-0.5 px-3 py-2 rounded-md border border-border bg-muted/30 text-xs max-w-[200px] hover:bg-muted/50 transition-colors"
            >
              <span className="font-medium leading-snug line-clamp-2">{t.title}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {t.channel} · {formatViewCount(t.view_count)}
              </span>
            </a>
          ) : (
            <div
              key={i}
              className="flex flex-col gap-0.5 px-3 py-2 rounded-md border border-border bg-muted/30 text-xs max-w-[200px]"
            >
              <span className="font-medium leading-snug">{t.name}</span>
              {(t.rating || t.review_count) && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t.rating ? `★ ${t.rating}` : ""}
                  {t.review_count ? ` · ${t.review_count.toLocaleString()} reviews` : ""}
                </span>
              )}
              {t.summary && (
                <span className="text-[10px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
                  {t.summary}
                </span>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
