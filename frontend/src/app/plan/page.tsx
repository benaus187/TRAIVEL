"use client";

import { Suspense, useState, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useMediaQuery } from "@base-ui/react/unstable-use-media-query";
import { useItineraryStream, WeatherDay } from "@/hooks/use-itinerary-stream";
import { useTripBriefForm } from "@/hooks/use-trip-brief-form";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { StopCard, TransitConnector } from "@/components/stop-card";
import { TrendPanel } from "@/components/trend-panel";
import { ChatPanel, ChatUpsell } from "@/components/chat-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const MapView = dynamic(
  () => import("@/components/map-view").then((m) => m.MapView),
  { ssr: false }
);

const TripBriefChapters = dynamic(
  () => import("@/components/plan/trip-brief-chapters").then((m) => m.TripBriefChapters)
);

const TripBriefSwipeDeck = dynamic(
  () => import("@/components/plan/trip-brief-swipe-deck").then((m) => m.TripBriefSwipeDeck),
  { ssr: false }
);

// Only precedent for a breakpoint in this file historically; reused here so
// the form shell switches at the same width the output column already
// collapses to one column at.
const DESKTOP_QUERY = "(min-width: 1024px)";

export default function PlanPage() {
  const { stops, setStops, state, error, quotaError, tripId, itineraryId, shareSlug, weather, trends, elapsedSeconds, generate, reset, abort } = useItineraryStream();
  const { user, getAccessToken } = useAuth();
  const { plan } = usePlan();
  // SSR-safe: renders the desktop shell on the server/first paint, corrects
  // to the real viewport once mounted — avoids a hydration mismatch.
  const isDesktop = useMediaQuery(DESKTOP_QUERY, { defaultMatches: true });

  const hasResult = stops.length > 0;
  const isStreaming = state === "streaming" || state === "verifying";

  // Day pagination
  const totalDays = useMemo(() => {
    const days = stops.map((s) => s.day ?? 1);
    return days.length ? Math.max(...days) : 1;
  }, [stops]);
  const [activeDay, setActiveDay] = useState(1);
  const dayStops = useMemo(
    () => stops.filter((s) => (s.day ?? 1) === activeDay),
    [stops, activeDay]
  );
  const mainRef = useRef<HTMLElement>(null);

  const form = useTripBriefForm({
    generate,
    reset,
    getAccessToken,
    onSubmitStart: () => {
      setActiveDay(1);
      // Generating streams progress into <main>, which sits below the form
      // on mobile (single-column stack) and can be off-screen when the user
      // hits Generate at the bottom of a tall form — bring it into view so
      // the progress bar is immediately visible instead of looking stalled.
      //
      // A single immediate scrollIntoView isn't reliable here: the moment
      // generate() flips state from idle to streaming, <main>'s content
      // swaps (empty prompt -> progress block), and Chrome's scroll
      // anchoring can silently re-adjust scrollTop to compensate for that
      // layout shift mid-animation, cancelling the scroll. Re-assert once
      // after that transition has settled.
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const behavior = reduceMotion ? "auto" : "smooth";
      const scrollToOutput = () => mainRef.current?.scrollIntoView({ behavior, block: "start" });
      scrollToOutput();
      window.setTimeout(scrollToOutput, 150);
    },
    onClear: () => setActiveDay(1),
  });
  const { brief, computedDays, flightNotes, lastSubmittedBrief } = form;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">
      {/* ── Trip Brief Form ── */}
      <aside className="lg:sticky lg:top-8">
        {isDesktop ? (
          <TripBriefChapters form={form} hasResult={hasResult} isStreaming={isStreaming} />
        ) : hasResult ? (
          <div className="rounded-xl border border-line-strong bg-card p-4 space-y-3">
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Trip Brief</p>
            <p className="text-sm font-bold">{brief.destination} · {computedDays} day{(computedDays ?? 1) > 1 ? "s" : ""}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={isStreaming} onClick={() => form.handleSubmit()} className="flex-1 bg-vermilion text-white hover:bg-vermilion/90">
                {isStreaming ? "Generating…" : "Regenerate"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={form.handleClear}>
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <TripBriefSwipeDeck form={form} isStreaming={isStreaming} />
        )}
      </aside>

      {/* ── Itinerary Output ── */}
      <main ref={mainRef} className="min-h-[400px] scroll-mt-8" style={{ overflowAnchor: "none" }}>
        <Suspense fallback={null}>
          <CheckoutSuccessBanner />
        </Suspense>

        {state === "idle" && (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Fill in the brief and generate your itinerary.
          </div>
        )}

        {state === "error" && (
          <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm space-y-3">
            <p>{error}</p>
            {quotaError?.tier === "anonymous" && (
              <a href="/login" className="font-mono text-xs underline">
                Sign in for 5 generations/day
              </a>
            )}
            {quotaError?.tier === "free" && (
              <a href="/pricing" className="font-mono text-xs underline">
                Free plan: 5/day. Upgrade to Premium for unlimited generations →
              </a>
            )}
            {!quotaError && lastSubmittedBrief && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const token = await getAccessToken();
                  generate(lastSubmittedBrief, token);
                }}
                className="text-xs font-mono border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                Retry
              </Button>
            )}
          </div>
        )}

        {/* Progress indicator — shown from first click until first stop arrives */}
        {(state === "streaming" || state === "verifying") && !hasResult && (
          <div className="flex flex-col gap-3 pt-8">
            <p className="font-mono text-xs text-muted-foreground animate-pulse">
              {`Discovering places in ${brief.destination ?? "your destination"}…`}
            </p>
            <div className="h-1 w-full bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full progress-indeterminate bg-vermilion" />
            </div>
            {elapsedSeconds >= 20 && (
              <div className="flex items-center gap-3">
                <p className="font-mono text-xs text-amber-600">Taking longer than usual…</p>
                {elapsedSeconds >= 40 && (
                  <button
                    type="button"
                    onClick={abort}
                    className="font-mono text-xs text-destructive border border-destructive/30 rounded px-2 py-0.5 hover:bg-destructive/10 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {hasResult && (
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                {brief.destination} · {computedDays} day{(computedDays ?? 1) > 1 ? "s" : ""}
              </p>
              {state === "streaming" && (
                <span className="font-mono text-xs text-muted-foreground animate-pulse">
                  {stops.length === 0
                    ? `Discovering places in ${brief.destination ?? "your destination"}…`
                    : `Planning itinerary… ${stops.length} stop${stops.length !== 1 ? "s" : ""} so far`}
                </span>
              )}
              {state === "verifying" && (
                <span className="font-mono text-xs text-muted-foreground animate-pulse">
                  {(() => {
                    const verified = stops.filter((s) => s.verified).length;
                    return `Verifying stop ${verified + 1} of ${stops.length}…`;
                  })()}
                </span>
              )}
              {state === "done" && tripId && (
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-stamp">✓ saved</span>
                  {shareSlug ? (
                    <button
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/trips/${shareSlug}`)}
                      className="font-mono text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
                    >
                      copy share link
                    </button>
                  ) : !user ? (
                    <a href="/login" className="font-mono text-xs text-muted-foreground hover:text-foreground underline">
                      sign in to share
                    </a>
                  ) : null}
                  <button
                    onClick={() => window.print()}
                    className="no-print font-mono text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors"
                  >
                    print / PDF
                  </button>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {(state === "streaming" || state === "verifying") && (
              <div className="space-y-2">
                <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                  {state === "streaming" ? (
                    <div className="h-full rounded-full progress-indeterminate bg-vermilion" />
                  ) : (
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out bg-vermilion"
                      style={{
                        width: `${Math.max(45, 45 + (stops.filter((s) => s.verified).length / Math.max(stops.length, 1)) * 52)}%`,
                      }}
                    />
                  )}
                </div>
                {elapsedSeconds >= 20 && (
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-xs text-amber-600">Taking longer than usual…</p>
                    {elapsedSeconds >= 40 && (
                      <button
                        type="button"
                        onClick={abort}
                        className="font-mono text-xs text-destructive border border-destructive/30 rounded px-2 py-0.5 hover:bg-destructive/10 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Trend + Weather (always visible) */}
            {trends && trends.length > 0 && (
              <TrendPanel trends={trends} destination={brief.destination ?? ""} />
            )}
            {weather && <WeatherBanner forecasts={weather} activeDay={activeDay} />}

            {/* Day tabs — only show when >1 day */}
            {totalDays > 1 && (
              <div className="flex gap-1.5 pt-1">
                {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    onClick={() => setActiveDay(d)}
                    className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
                      d === activeDay
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border hover:border-foreground"
                    }`}
                  >
                    Day {d}
                  </button>
                ))}
              </div>
            )}

            {/* Print-only: trip title + flight info */}
            <div className="print-only mb-4 space-y-1">
              <p className="font-bold text-base">{brief.destination} · {computedDays} day{(computedDays ?? 1) > 1 ? "s" : ""}</p>
              {flightNotes && (
                <p className="font-mono text-xs text-muted-foreground whitespace-pre-line">{flightNotes}</p>
              )}
            </div>

            {/* Map for active day */}
            {state === "done" && (
              <div className="no-print"><MapView stops={dayStops} /></div>
            )}

            {/* Stop cards — all days rendered in DOM; inactive days hidden on screen, all shown during print */}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
              const dStops = stops.filter((s) => (s.day ?? 1) === d);
              const isActive = d === activeDay;
              return (
                <div key={d} className={isActive ? "" : "hidden-day"}>
                  <h3 className="print-only font-mono text-xs uppercase tracking-widest py-1.5 border-b border-border text-muted-foreground mb-2 mt-3">
                    Day {d}
                  </h3>
                  {dStops.map((stop, i) => (
                    <div key={i} className="stop-card-enter">
                      {i > 0 && <TransitConnector from={dStops[i - 1]} to={stop} />}
                      <StopCard stop={stop} />
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Chat editing — only once the itinerary is fully generated and saved */}
            {state === "done" && itineraryId && (
              <div className="no-print pt-2">
                {plan?.plan === "premium" ? (
                  <ChatPanel itineraryId={itineraryId} setStops={setStops} getAccessToken={getAccessToken} />
                ) : (
                  <ChatUpsell />
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function CheckoutSuccessBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("checkout") !== "success") return null;
  return (
    <p className="font-mono text-xs mb-3 text-stamp">
      ✓ You&apos;re now Premium — unlimited generations unlocked.
    </p>
  );
}

function WeatherBanner({ forecasts, activeDay }: { forecasts: WeatherDay[]; activeDay: number }) {
  const location = forecasts[0]?.location;
  return (
    <div className="space-y-1.5 py-1">
      {location && (
        <p className="font-mono text-[10px] text-muted-foreground">
          weather · {location}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {forecasts.map((day, i) => {
          const isActive = i + 1 === activeDay;
          return (
            <div
              key={day.date}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono transition-colors ${
                day.bad_weather
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : isActive
                  ? "border-foreground bg-muted text-foreground"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              <span>{day.date.slice(5)}</span>
              <span>{day.condition}</span>
              {day.temp_max !== null && <span>{Math.round(day.temp_max)}°C</span>}
              {day.bad_weather && <span>⚠</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
