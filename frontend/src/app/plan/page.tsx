"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { TripBrief, TripBriefSchema } from "@/lib/schemas/itinerary";
import { useItineraryStream, WeatherDay } from "@/hooks/use-itinerary-stream";
import { ReasonCodeChip } from "@/components/reason-code-chip";
import { TrendPanel } from "@/components/trend-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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

type GeoSuggestion = { name: string; admin1: string; country: string };

export default function PlanPage() {
  const { stops, state, error, tripId, weather, trends, generate, reset } = useItineraryStream();
  const [brief, setBrief] = useState<Partial<TripBrief>>({
    days: 2,
    budget_usd_per_day: 100,
    pace: "moderate",
    interests: [],
    avoid: [],
  });

  // Destination autocomplete state
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [destInput, setDestInput] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Custom interests state
  const [customInput, setCustomInput] = useState("");
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [showCustomInput, setShowCustomInput] = useState(false);

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

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en`
      );
      const data = await res.json();
      const results: GeoSuggestion[] = (data.results ?? []).map((r: Record<string, string>) => ({
        name: r.name ?? "",
        admin1: r.admin1 ?? "",
        country: r.country ?? "",
      })).filter((r) => r.name);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch {
      setSuggestions([]);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = TripBriefSchema.safeParse(brief);
    if (!parsed.success) {
      alert(parsed.error.issues[0].message);
      return;
    }
    generate(parsed.data);
  }

  const isStreaming = state === "streaming" || state === "verifying";
  const hasResult = stops.length > 0;
  const presetSelected = (brief.interests ?? []).filter((i) => !customInterests.includes(i));

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

          {/* Days */}
          <Field label="Days">
            <input
              type="number"
              min={1}
              max={14}
              value={brief.days ?? 2}
              onChange={(e) =>
                setBrief((p) => ({ ...p, days: Number(e.target.value) }))
              }
              className="w-24 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          {/* Start date */}
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

          {/* Budget slider */}
          <Field label={`Budget · $${brief.budget_usd_per_day ?? 100} / day`}>
            <input
              type="range"
              min={0}
              max={500}
              step={10}
              value={brief.budget_usd_per_day ?? 100}
              onChange={(e) =>
                setBrief((p) => ({ ...p, budget_usd_per_day: Number(e.target.value) }))
              }
              className="w-full accent-foreground"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-0.5">
              <span>$0</span>
              <span>$250</span>
              <span>$500</span>
            </div>
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
          <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {hasResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                {brief.destination} · {brief.days} day{(brief.days ?? 1) > 1 ? "s" : ""}
              </p>
              {state === "streaming" && (
                <span className="font-mono text-xs text-muted-foreground animate-pulse">
                  generating…
                </span>
              )}
              {state === "verifying" && (
                <span className="font-mono text-xs text-muted-foreground animate-pulse">
                  verifying stops…
                </span>
              )}
              {state === "done" && tripId && (
                <span className="font-mono text-xs text-[#1f7a45]">
                  ✓ saved
                </span>
              )}
            </div>
            <Separator />
            {trends && trends.length > 0 && (
              <TrendPanel trends={trends} destination={brief.destination ?? ""} />
            )}
            {weather && <WeatherBanner forecasts={weather} />}
            {stops.map((stop, i) => (
              <Card key={i} className="shadow-none">
                <CardContent className="py-4 px-5 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="font-mono text-xs text-muted-foreground">
                        {stop.time}
                      </p>
                      <p className="font-semibold text-sm leading-snug">
                        {stop.name}
                      </p>
                    </div>
                    {stop.verified && (
                      <span className="shrink-0 text-[10px] font-mono text-[#1f7a45] border border-[#1f7a45]/30 rounded-full px-2 py-0.5">
                        ✓ verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {stop.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {stop.reason_codes.map((code) => (
                      <ReasonCodeChip key={code} code={code} />
                    ))}
                  </div>
                  {stop.weather_alternate && (
                    <p className="text-xs text-muted-foreground font-mono">
                      ☁ alt: {stop.weather_alternate}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function WeatherBanner({ forecasts }: { forecasts: WeatherDay[] }) {
  const location = forecasts[0]?.location;
  return (
    <div className="space-y-1.5 py-1">
      {location && (
        <p className="font-mono text-[10px] text-muted-foreground">
          weather · {location}
        </p>
      )}
      <div className="flex gap-2 flex-wrap">
        {forecasts.map((day) => (
          <div
            key={day.date}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-mono ${
              day.bad_weather
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-border bg-muted/40 text-muted-foreground"
            }`}
          >
            <span>{day.date.slice(5)}</span>
            <span>{day.condition}</span>
            {day.temp_max !== null && <span>{Math.round(day.temp_max)}°C</span>}
            {day.bad_weather && <span>⚠</span>}
          </div>
        ))}
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
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
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
          {opt}
        </button>
      ))}
    </div>
  );
}
