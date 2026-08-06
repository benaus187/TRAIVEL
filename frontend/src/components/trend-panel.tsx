"use client";

import { useState } from "react";
import type { TrendItem } from "@/hooks/use-itinerary-stream";

const COLLAPSED_COUNT = 3;

function formatViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Places gives a 0-5 rating; YouTube gives an unbounded view count — no shared unit.
 * Real-world popular spots almost never fall below ~3.5 stars, so scoring off the full
 * 0-5 range wastes most of the scale and every landmark clusters near 100. Instead,
 * map rating over the ~3.5-5.0 range that actually occurs, blended with a log-scaled
 * review-volume signal (1 review -> ~0, ~100K reviews -> ~100). YouTube views are
 * log-scaled the same way (~1K views -> ~0, ~10M views -> ~100).
 */
function trendScore(item: TrendItem): number {
  if (item.source === "google_places") {
    const ratingPart = item.rating != null ? clamp01((item.rating - 3.5) / 1.5) * 100 : 60;
    const reviewPart = item.review_count ? clamp01(Math.log10(item.review_count + 1) / 5) * 100 : 0;
    return Math.round(ratingPart * 0.65 + reviewPart * 0.35);
  }
  const views = Math.max(item.view_count, 1);
  const scaled = clamp01((Math.log10(views) - 3) / 4) * 100;
  return Math.round(scaled);
}

function rowLabel(item: TrendItem): string {
  return item.source === "youtube" ? item.title : item.name;
}

function rowMeta(item: TrendItem): string | null {
  if (item.source === "youtube") {
    return `${item.channel} · ${formatViewCount(item.view_count)}`;
  }
  const parts = [
    item.rating ? `★ ${item.rating}` : null,
    item.review_count ? `${item.review_count.toLocaleString()} reviews` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

function rowHref(item: TrendItem): string {
  return item.source === "youtube"
    ? `https://youtube.com/watch?v=${item.video_id}`
    : `https://www.google.com/maps/search/${encodeURIComponent(item.name)}`;
}

export function TrendPanel({ trends, destination }: { trends: TrendItem[]; destination: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!trends.length) return null;

  const sources = new Set(trends.map((t) => t.source));
  const sourceLabel = [
    sources.has("google_places") ? "Google Places" : null,
    sources.has("youtube") ? "YouTube" : null,
  ]
    .filter(Boolean)
    .join(" & ");

  const ranked = trends
    .map((item, i) => ({ item, score: trendScore(item), key: i }))
    .sort((a, b) => b.score - a.score);
  const visible = expanded ? ranked : ranked.slice(0, COLLAPSED_COUNT);
  const hiddenCount = ranked.length - visible.length;

  return (
    <div className="py-3 border-t border-border">
      <div className="bg-board-bg text-board-fg shadow-lg px-5 md:px-7 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="font-sans font-bold uppercase text-sm md:text-base tracking-wide leading-snug">
            Departures — Trending in {destination.split(",")[0]}
          </span>
          <span className="shrink-0 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em]">
            <span className="w-1.5 h-1.5 rounded-full bg-stamp animate-pulse" />
            LIVE
          </span>
        </div>

        <div className="divide-y divide-board-fg/10">
          {visible.map(({ item, score, key }, i) => {
            const meta = rowMeta(item);
            return (
              <a
                key={key}
                href={rowHref(item)}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-cols-[22px_1fr_44px] md:grid-cols-[26px_1fr_170px_48px] items-center gap-3 py-2.5 group"
              >
                <span className="font-mono text-xs opacity-60">{String(i + 1).padStart(2, "0")}</span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[12.5px] tracking-wide uppercase group-hover:underline">
                    {rowLabel(item)}
                  </span>
                  {meta && (
                    <span className="block truncate font-mono text-[10px] opacity-60 normal-case tracking-normal mt-0.5">
                      {meta}
                    </span>
                  )}
                </span>
                <span className="hidden md:block h-2 bg-board-fg/10 rounded-sm overflow-hidden">
                  <span
                    className="block h-full bg-[linear-gradient(90deg,var(--vermilion),var(--gold))]"
                    style={{ width: `${score}%` }}
                  />
                </span>
                <span className="font-mono text-[13px] font-bold text-right tabular-nums">{score}</span>
              </a>
            );
          })}
        </div>

        {ranked.length > COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 w-full text-center font-mono text-[10px] tracking-[0.14em] uppercase text-board-fg/70 hover:text-board-fg py-2 border-t border-board-fg/10 transition-colors"
          >
            {expanded ? "Show less ↑" : `Explore all ${ranked.length} → (+${hiddenCount})`}
          </button>
        )}

        <p className="mt-4 pt-3 border-t border-dashed border-board-fg/20 font-mono text-[10px] tracking-wide opacity-70">
          scored by rating &amp; review volume (places) or view count (youtube) via {sourceLabel} · sponsored and
          repeated content filtered out
        </p>
      </div>
    </div>
  );
}
