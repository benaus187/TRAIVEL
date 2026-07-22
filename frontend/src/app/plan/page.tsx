"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { TripBrief, TripBriefSchema } from "@/lib/schemas/itinerary";
import { useItineraryStream, WeatherDay } from "@/hooks/use-itinerary-stream";
import { useCurrencyStore } from "@/stores/currency-store";
import { useAuth } from "@/hooks/use-auth";
import { ReasonCodeChip } from "@/components/reason-code-chip";
import { StopCard, TransitConnector } from "@/components/stop-card";
import { TrendPanel } from "@/components/trend-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const MapView = dynamic(
  () => import("@/components/map-view").then((m) => m.MapView),
  { ssr: false }
);

const PRESET_INTERESTS = [
  "food & drink",
  "art & culture",
  "nature & outdoors",
  "history",
  "shopping",
  "nightlife",
  "architecture",
  "street food",
];

const PRESET_AVOID = [
  "crowded places",
  "tourist traps",
  "nightlife",
  "street food",
  "steep hills",
  "early mornings",
];

type GeoSuggestion = { name: string; admin1: string; country: string };

export default function PlanPage() {
  const { stops, state, error, tripId, shareSlug, weather, trends, elapsedSeconds, generate, reset, abort } = useItineraryStream();
  const { user, getAccessToken } = useAuth();
  const { currency, symbol, rate } = useCurrencyStore();
  const [brief, setBrief] = useState<Partial<TripBrief>>({
    days: 3,
    budget_usd_total: 0,
    pace: "moderate",
    interests: [],
    avoid: [],
    transport_mode: "public_transport",
    include_accommodation: false,
  });
  const [budgetLocal, setBudgetLocal] = useState(0);
  const [endDate, setEndDate] = useState("");
  const [flightNotes, setFlightNotes] = useState("");
  const [flightOpen, setFlightOpen] = useState(false);

  // Destination autocomplete state
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [destInput, setDestInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Custom interests state
  const [customInput, setCustomInput] = useState("");
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Form error state
  const [formError, setFormError] = useState<string | null>(null);

  // Ref to last submitted brief (for retry)
  const lastSubmittedBriefRef = useRef<TripBrief | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Clear form error when user edits brief
  useEffect(() => {
    setFormError(null);
  }, [brief]);

  // Compute days from start + end date
  useEffect(() => {
    if (brief.start_date && endDate && endDate >= brief.start_date) {
      const diff = Math.round(
        (new Date(endDate).getTime() - new Date(brief.start_date).getTime()) / 86400000
      ) + 1;
      setBrief((p) => ({ ...p, days: Math.min(14, Math.max(1, diff)) }));
    }
  }, [brief.start_date, endDate]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) { setSuggestions([]); return; }
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en`,
        { signal: abortRef.current.signal }
      );
      const data = await res.json();
      const results: GeoSuggestion[] = ((data.results ?? []) as Record<string, string>[]).map((r) => ({
        name: r.name ?? "",
        admin1: r.admin1 ?? "",
        country: r.country ?? "",
      })).filter((r) => r.name);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setSuggestions([]);
    }
  }, []);

  function handleDestChange(value: string) {
    setDestInput(value);
    setBrief((p) => ({ ...p, destination: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 280);
  }

  function selectSuggestion(s: GeoSuggestion) {
    const full = [s.name, s.admin1, s.country].filter(Boolean).join(", ");
    setDestInput(full);
    setBrief((p) => ({ ...p, destination: full }));
    setShowSuggestions(false);
  }

  function togglePresetInterest(interest: string) {
    setBrief((prev) => {
      const list = (prev.interests ?? []).filter((i) => !customInterests.includes(i));
      return {
        ...prev,
        interests: list.includes(interest)
          ? [...list.filter((i) => i !== interest), ...customInterests]
          : [...list, interest, ...customInterests],
      };
    });
  }

  function addCustomInterest(raw: string) {
    const trimmed = raw.trim().replace(/,$/, "").trim();
    if (!trimmed || customInterests.includes(trimmed)) return;
    const next = [...customInterests, trimmed];
    setCustomInterests(next);
    setBrief((p) => ({
      ...p,
      interests: [...(p.interests ?? []), trimmed],
    }));
    setCustomInput("");
  }

  function removeCustomInterest(interest: string) {
    const next = customInterests.filter((i) => i !== interest);
    setCustomInterests(next);
    setBrief((p) => ({
      ...p,
      interests: (p.interests ?? []).filter((i) => i !== interest),
    }));
  }

  function handleCustomKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCustomInterest(customInput);
    }
  }

  function toggleAvoid(item: string) {
    setFormError(null);
    setBrief((prev) => {
      const list = prev.avoid ?? [];
      return {
        ...prev,
        avoid: list.includes(item) ? list.filter((i) => i !== item) : [...list, item],
      };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const budgetUsd = currency === "USD" ? budgetLocal : Math.round(budgetLocal / rate);
    // If no end date set, default days to 3
    const days = (brief.start_date && endDate) ? (brief.days ?? 3) : (brief.days ?? 3);
    const parsed = TripBriefSchema.safeParse({
      ...brief,
      days,
      budget_usd_total: budgetUsd,
      currency,
      flight_notes: flightNotes.trim() || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0].message);
      return;
    }
    setFormError(null);
    lastSubmittedBriefRef.current = parsed.data;
    setActiveDay(1);
    const token = await getAccessToken();
    generate(parsed.data, token);
  }

  const isStreaming = state === "streaming" || state === "verifying";
  const hasResult = stops.length > 0;
  const presetSelected = (brief.interests ?? []).filter((i) => !customInterests.includes(i));

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

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">
      {/* ── Trip Brief Form ── */}
      <aside className="lg:sticky lg:top-8 space-y-6">
        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
            Trip Brief
          </p>
          <h2 className="text-xl font-bold">Where are you going?</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Destination with autocomplete */}
          <Field label="Destination">
            <div ref={wrapperRef} className="relative">
              <input
                type="text"
                placeholder="Tokyo, Sydney, Paris…"
                value={destInput}
                onChange={(e) => handleDestChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {showSuggestions && (
                <ul className="absolute z-10 mt-1 w-full bg-background border border-border rounded-md shadow-md overflow-hidden">
                  {suggestions.map((s, i) => (
                    <li
                      key={i}
                      onMouseDown={() => selectSuggestion(s)}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-muted flex justify-between gap-2"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="text-muted-foreground text-xs truncate">
                        {[s.admin1, s.country].filter(Boolean).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>

          {/* Start date + End date → auto-computes days */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input
                type="date"
                value={brief.start_date ?? ""}
                onChange={(e) =>
                  setBrief((p) => ({ ...p, start_date: e.target.value || undefined }))
                }
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={endDate}
                min={brief.start_date ?? undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </Field>
          </div>
          {brief.days != null && brief.start_date && endDate && (
            <p className="font-mono text-[10px] text-muted-foreground -mt-2">
              {brief.days} day{brief.days > 1 ? "s" : ""}
            </p>
          )}

          {/* Interests */}
          <Field label="Interests">
            <div className="flex flex-wrap gap-2">
              {PRESET_INTERESTS.map((interest) => {
                const active = presetSelected.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => togglePresetInterest(interest)}
                    className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border hover:border-foreground"
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
              {/* Others toggle */}
              <button
                type="button"
                onClick={() => setShowCustomInput((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                  showCustomInput || customInterests.length > 0
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:border-foreground"
                }`}
              >
                others
              </button>
            </div>

            {/* Custom interest input */}
            {showCustomInput && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Type interest, press Enter or comma"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={handleCustomKeyDown}
                  className="w-full border border-border rounded-md px-3 py-2 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {customInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {customInterests.map((ci) => (
                      <span
                        key={ci}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-foreground text-background"
                      >
                        {ci}
                        <button
                          type="button"
                          onClick={() => removeCustomInterest(ci)}
                          className="opacity-60 hover:opacity-100"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          {/* Budget input */}
          <Field label={`Total trip budget (${currency})`}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
                {symbol}
              </span>
              <input
                type="number"
                min={0}
                step={currency === "VND" ? 500000 : currency === "JPY" ? 1000 : 50}
                value={budgetLocal || ""}
                onChange={(e) => setBudgetLocal(Number(e.target.value))}
                placeholder={currency === "VND" ? "e.g. 50000000" : currency === "JPY" ? "e.g. 300000" : "e.g. 2000"}
                className="w-full border border-border rounded-md pl-7 pr-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            {currency !== "USD" && budgetLocal > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                ≈ ${Math.round(budgetLocal / rate).toLocaleString()} USD
              </p>
            )}
          </Field>

          {/* Pace */}
          <Field label="Pace">
            <SelectRow
              options={["relaxed", "moderate", "packed"]}
              value={brief.pace ?? "moderate"}
              onChange={(v) =>
                setBrief((p) => ({ ...p, pace: v as TripBrief["pace"] }))
              }
            />
          </Field>

          {/* Transport mode */}
          <Field label="Getting around">
            <SelectRow
              options={["public_transport", "walking", "any"]}
              labels={["🚇 Public transport", "🚶 Walking", "🔀 Any"]}
              value={brief.transport_mode ?? "public_transport"}
              onChange={(v) =>
                setBrief((p) => ({ ...p, transport_mode: v as TripBrief["transport_mode"] }))
              }
            />
          </Field>

          {/* Accommodation toggle */}
          <Field label="Accommodation">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={brief.include_accommodation ?? false}
                onChange={(e) =>
                  setBrief((p) => ({ ...p, include_accommodation: e.target.checked }))
                }
                className="accent-foreground w-4 h-4"
              />
              <span className="text-xs font-mono text-muted-foreground">
                Include overnight suggestions
              </span>
            </label>
          </Field>

          {/* Flight info */}
          <Field label="Flights (optional)">
            <button
              type="button"
              onClick={() => setFlightOpen((v) => !v)}
              className="text-xs font-mono text-muted-foreground hover:text-foreground border border-border rounded px-2.5 py-1 transition-colors"
            >
              {flightOpen ? "▲ hide" : "▼ add flight info"}
            </button>
            {flightOpen && (
              <textarea
                rows={3}
                placeholder={`e.g. Inbound: VJ123 from Hanoi, departs 06:30 arrives ${brief.destination ?? "destination"} 07:45\nReturn: VJ124 departs ${brief.destination ?? "destination"} 20:00 back to Hanoi`}
                value={flightNotes}
                onChange={(e) => setFlightNotes(e.target.value)}
                className="mt-2 w-full border border-border rounded-md px-3 py-2 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            )}
          </Field>

          {/* Avoid */}
          <Field label="Avoid">
            <div className="flex flex-wrap gap-2">
              {PRESET_AVOID.map((item) => {
                const active = (brief.avoid ?? []).includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleAvoid(item)}
                    className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                      active
                        ? "bg-destructive/10 text-destructive border-destructive/30"
                        : "bg-background text-muted-foreground border-border hover:border-foreground"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </Field>

          {formError && (
            <p className="text-xs text-destructive font-mono">{formError}</p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isStreaming} className="flex-1">
              {isStreaming ? "Generating…" : hasResult ? "Regenerate" : "Generate itinerary"}
            </Button>
            {hasResult && (
              <Button type="button" variant="outline" onClick={reset}>
                Clear
              </Button>
            )}
          </div>
        </form>
      </aside>

      {/* ── Itinerary Output ── */}
      <main className="min-h-[400px]">
        {state === "idle" && (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Fill in the brief and generate your itinerary.
          </div>
        )}

        {state === "error" && (
          <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm space-y-3">
            <p>{error}</p>
            {lastSubmittedBriefRef.current && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const token = await getAccessToken();
                  generate(lastSubmittedBriefRef.current!, token);
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
              <div
                className="h-full rounded-full progress-indeterminate"
                style={{ backgroundColor: "var(--coral)" }}
              />
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
                {brief.destination} · {brief.days} day{(brief.days ?? 1) > 1 ? "s" : ""}
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
                  <span className="font-mono text-xs text-[#1f7a45]">✓ saved</span>
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
                    <div
                      className="h-full rounded-full progress-indeterminate"
                      style={{ backgroundColor: "var(--coral)" }}
                    />
                  ) : (
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        backgroundColor: "var(--coral)",
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
              <p className="font-bold text-base">{brief.destination} · {brief.days} day{(brief.days ?? 1) > 1 ? "s" : ""}</p>
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
          </div>
        )}
      </main>
    </div>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function SelectRow({
  options,
  labels,
  value,
  onChange,
}: {
  options: string[];
  labels?: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt, i) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
            value === opt
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground"
          }`}
        >
          {labels?.[i] ?? opt}
        </button>
      ))}
    </div>
  );
}
