"use client";

type PopularPlace = {
  name: string;
  rating?: number;
  review_count?: number;
  summary?: string;
};

export function TrendPanel({ trends, destination }: { trends: PopularPlace[]; destination: string }) {
  if (!trends.length) return null;

  return (
    <div className="space-y-3 py-3 border-t border-border">
      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
        popular in {destination.split(",")[0]} · via Google Places
      </p>
      <div className="flex flex-wrap gap-2">
        {trends.map((p, i) => (
          <div
            key={i}
            className="flex flex-col gap-0.5 px-3 py-2 rounded-md border border-border bg-muted/30 text-xs max-w-[200px]"
          >
            <span className="font-medium leading-snug">{p.name}</span>
            {(p.rating || p.review_count) && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {p.rating ? `★ ${p.rating}` : ""}
                {p.review_count ? ` · ${p.review_count.toLocaleString()} reviews` : ""}
              </span>
            )}
            {p.summary && (
              <span className="text-[10px] text-muted-foreground/70 line-clamp-2 leading-relaxed">
                {p.summary}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
