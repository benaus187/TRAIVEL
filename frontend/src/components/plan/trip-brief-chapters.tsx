"use client";

import { useEffect, useRef, useState } from "react";
import type { TripBrief } from "@/lib/schemas/itinerary";
import type { TripBriefForm } from "@/hooks/use-trip-brief-form";
import { PRESET_INTERESTS, PRESET_AVOID, PACE_OPTIONS } from "@/hooks/use-trip-brief-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TapCard,
  Chip,
  Stepper,
  INTEREST_ICONS,
  AVOID_ICONS,
  PACE_META,
  TRANSPORT_META,
} from "./trip-brief-widgets";

type Chapter = { key: string; label: string; done: boolean };

export function TripBriefChapters({
  form,
  hasResult,
  isStreaming,
}: {
  form: TripBriefForm;
  hasResult: boolean;
  isStreaming: boolean;
}) {
  const [extrasOpen, setExtrasOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        form.setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [form]);

  // Extras is optional and deliberately excluded from the tracked rail below
  // — it never becomes "done" in a meaningful sense, so it shouldn't earn a
  // checkmark just for existing.
  const chapters: Chapter[] = [
    { key: "basics", label: "Trip basics", done: form.stepValidity.destination },
    { key: "vibe", label: "Vibe check", done: form.stepValidity.vibe },
    { key: "pace", label: "Set the pace", done: form.stepValidity.paceAndBudget },
  ];
  const firstUndone = chapters.findIndex((c) => !c.done);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
          Trip Brief
        </p>
        <h2 className="text-xl font-bold">Where are you going?</h2>
      </div>

      <form onSubmit={form.handleSubmit} className="flex gap-3">
        {/* Progress rail */}
        <div className="flex flex-col items-center pt-1.5 shrink-0" aria-hidden="true">
          {chapters.map((c, i) => (
            <div key={c.key} className="flex flex-col items-center">
              <div
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border-2 font-mono text-[10px] transition-colors",
                  c.done
                    ? "border-stamp bg-stamp text-white"
                    : i === firstUndone
                    ? "border-vermilion text-vermilion shadow-[0_0_0_4px_color-mix(in_oklch,var(--vermilion)_15%,transparent)]"
                    : "border-line-strong text-muted-foreground"
                )}
              >
                {c.done ? "✓" : i + 1}
              </div>
              {i < chapters.length - 1 && (
                <div
                  className={cn(
                    "my-0.5 w-px flex-1 min-h-[28px] transition-colors",
                    c.done ? "bg-stamp" : "bg-line"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          {hasResult && (
            <p className="font-mono text-[10px] text-muted-foreground -mb-1">
              Clear to edit and plan a new trip.
            </p>
          )}

          {/* Locking the brief once a result exists prevents edits here from
              silently rewriting the itinerary already shown — only Clear or
              Regenerate are available past this point. */}
          <fieldset disabled={hasResult} className="space-y-4">
            {/* Chapter 1 — Trip basics */}
            <ChapterCard num={1} title="Trip basics" done={form.stepValidity.destination} muted={false}>
              <div ref={wrapperRef} className="relative">
                <input
                  type="text"
                  placeholder="Tokyo, Sydney, Paris…"
                  value={form.destInput}
                  onChange={(e) => form.handleDestChange(e.target.value)}
                  onFocus={() => form.suggestions.length > 0 && form.setShowSuggestions(true)}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {form.showSuggestions && (
                  <ul className="absolute z-10 mt-1 w-full bg-background border border-border rounded-lg shadow-md overflow-hidden">
                    {form.suggestions.map((s, i) => (
                      <li
                        key={i}
                        onMouseDown={() => form.selectSuggestion(s)}
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
              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <input
                  type="date"
                  value={form.brief.start_date ?? ""}
                  onChange={(e) => form.setStartDate(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="date"
                  value={form.endDate}
                  min={form.brief.start_date ?? undefined}
                  onChange={(e) => form.setEndDate(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              {form.computedDays != null && form.brief.start_date && form.endDate && (
                <p className="font-mono text-[10px] text-muted-foreground mt-1.5">
                  {form.computedDays} day{form.computedDays > 1 ? "s" : ""}
                </p>
              )}
            </ChapterCard>

            {/* Chapter 2 — Vibe check */}
            <ChapterCard num={2} title="Vibe check" done={form.stepValidity.vibe} muted={!form.stepValidity.destination}>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_INTERESTS.map((interest) => (
                  <Chip
                    key={interest}
                    selected={form.presetSelected.includes(interest)}
                    onClick={() => form.togglePresetInterest(interest)}
                  >
                    {INTEREST_ICONS[interest]} {interest}
                  </Chip>
                ))}
                <Chip
                  selected={form.customInterests.length > 0}
                  onClick={() => {
                    const el = document.getElementById("chapters-custom-interest");
                    el?.focus();
                  }}
                >
                  ＋ add your own
                </Chip>
              </div>
              <div className="mt-2.5 space-y-2">
                <input
                  id="chapters-custom-interest"
                  type="text"
                  placeholder="Type interest, press Enter or comma"
                  value={form.customInput}
                  onChange={(e) => form.setCustomInput(e.target.value)}
                  onKeyDown={form.handleCustomKeyDown}
                  className="w-full border border-border rounded-lg px-3 py-2 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
                {form.customInterests.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.customInterests.map((ci) => (
                      <span
                        key={ci}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-foreground text-background"
                      >
                        {ci}
                        <button
                          type="button"
                          onClick={() => form.removeCustomInterest(ci)}
                          className="opacity-60 hover:opacity-100"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </ChapterCard>

            {/* Chapter 3 — Set the pace */}
            <ChapterCard num={3} title="Set the pace" done={form.stepValidity.paceAndBudget} muted={!form.stepValidity.vibe}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total budget ({form.currency})
                </span>
                {form.currency !== "USD" && form.budgetLocal > 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ≈ ${Math.round(form.budgetLocal / form.rate).toLocaleString()} USD
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
                  {form.symbol}
                </span>
                <input
                  type="number"
                  min={0}
                  step={form.currency === "VND" ? 500000 : form.currency === "JPY" ? 1000 : 50}
                  value={form.budgetLocal || ""}
                  onChange={(e) => form.setBudgetLocal(Number(e.target.value))}
                  placeholder={form.currency === "VND" ? "e.g. 50000000" : form.currency === "JPY" ? "e.g. 300000" : "e.g. 2000"}
                  className="w-full border border-border rounded-lg pl-7 pr-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-4 mb-1.5">Pace</p>
              <div className="grid grid-cols-4 gap-1.5">
                {PACE_OPTIONS.map((p) => (
                  <TapCard key={p} selected={form.brief.pace === p} onClick={() => form.setPace(p)} className="text-center px-2">
                    <span className="block text-base leading-none mb-1">{PACE_META[p].emoji}</span>
                    {PACE_META[p].label}
                  </TapCard>
                ))}
              </div>
              {form.brief.pace === "custom" && (
                <div className="mt-2">
                  <Stepper
                    label="Minimum stops / day"
                    value={form.brief.min_stops_per_day ?? 5}
                    onChange={form.setMinStopsPerDay}
                  />
                </div>
              )}

              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-4 mb-1.5">Getting around</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(TRANSPORT_META) as TripBrief["transport_mode"][]).map((mode) => (
                  <TapCard
                    key={mode}
                    selected={(form.brief.transport_mode ?? "public_transport") === mode}
                    onClick={() => form.setTransportMode(mode)}
                    className="text-center px-1"
                  >
                    <span className="block text-base leading-none mb-1">{TRANSPORT_META[mode].emoji}</span>
                    {TRANSPORT_META[mode].label}
                  </TapCard>
                ))}
              </div>
            </ChapterCard>

            {/* Chapter 4 — Extras (optional, collapsible) */}
            <div className="rounded-xl border border-line-strong bg-card p-4">
              <button
                type="button"
                onClick={() => setExtrasOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-bold">
                  Extras <span className="font-normal text-muted-foreground text-xs">(optional)</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">{extrasOpen ? "−" : "＋"}</span>
              </button>
              {extrasOpen && (
                <div className="mt-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.brief.include_accommodation ?? false}
                      onChange={(e) => form.setIncludeAccommodation(e.target.checked)}
                      className="accent-foreground w-4 h-4"
                    />
                    <span className="text-xs font-mono text-muted-foreground">
                      Include overnight suggestions
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Flight info (optional) — arrival/departure times"
                    value={form.flightNotes}
                    onChange={(e) => form.setFlightNotes(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Avoid</p>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_AVOID.map((item) => (
                        <Chip
                          key={item}
                          tone="destructive"
                          selected={(form.brief.avoid ?? []).includes(item)}
                          onClick={() => form.toggleAvoid(item)}
                        >
                          {AVOID_ICONS[item]} {item}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          {form.formError && (
            <p className="text-xs text-destructive font-mono">{form.formError}</p>
          )}

          {/* Sticky CTA */}
          <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl bg-foreground px-4 py-3 text-background shadow-lg">
            <span className="font-mono text-[11px] text-background/70">
              {chapters.filter((c) => c.done).length} of {chapters.length} chapters done
            </span>
            <div className="flex gap-2">
              {hasResult && (
                <Button type="button" variant="outline" size="sm" onClick={form.handleClear} className="bg-transparent border-background/30 text-background hover:bg-background/10">
                  Clear
                </Button>
              )}
              <Button type="submit" size="sm" disabled={isStreaming} className="bg-vermilion text-white hover:bg-vermilion/90">
                {isStreaming ? "Generating…" : hasResult ? "Regenerate" : "Generate itinerary →"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function ChapterCard({
  num,
  title,
  done,
  muted,
  children,
}: {
  num: number;
  title: string;
  done: boolean;
  muted: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-[opacity] duration-200 motion-reduce:transition-none",
        done ? "border-line-strong bg-card" : "border-line-strong bg-card",
        muted && !done && "opacity-50"
      )}
    >
      <div className="flex items-baseline gap-2 mb-3">
        <span className="font-mono text-[10px] text-vermilion">CH.{num}</span>
        <h3 className="text-sm font-bold">{title}</h3>
        {done && <span className="ml-auto text-stamp text-xs">✓</span>}
      </div>
      {children}
    </div>
  );
}
