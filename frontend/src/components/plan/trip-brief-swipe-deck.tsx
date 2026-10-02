"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
  PACE_EMOJI,
  TRANSPORT_EMOJI,
} from "./trip-brief-widgets";

const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_DURATION = 300;

export function TripBriefSwipeDeck({
  form,
  isStreaming,
}: {
  form: TripBriefForm;
  isStreaming: boolean;
}) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const screenTitles = [
    t("swipeDeck.screens.whereWhen"),
    t("swipeDeck.screens.vibeCheck"),
    t("swipeDeck.screens.setThePace"),
    t("swipeDeck.screens.budget"),
    t("swipeDeck.screens.extras"),
    t("swipeDeck.screens.review"),
  ];
  const [index, setIndex] = useState(0);
  const screenRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isFirstRender = useRef(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; t: number } | null>(null);
  const total = screenTitles.length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        form.setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [form]);

  // Move focus to the newly-active screen's first control so keyboard/screen
  // reader users aren't stranded on a now-hidden element. Skipped on mount so
  // landing on /plan doesn't yank focus into the destination field unasked.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const el = screenRefs.current[index];
    const focusable = el?.querySelector<HTMLElement>(
      'input, textarea, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus({ preventScroll: true });
  }, [index]);

  function canAdvanceFrom(i: number): boolean {
    if (i === 0) return form.stepValidity.destination;
    if (i === 1) return form.stepValidity.vibe;
    if (i === 3) return form.stepValidity.paceAndBudget;
    return true;
  }

  function goNext() {
    if (!canAdvanceFrom(index)) return;
    setIndex((i) => Math.min(total - 1, i + 1));
  }
  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, t: Date.now() };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dt = Date.now() - start.t;
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || dt > SWIPE_MAX_DURATION) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  const nudge = !canAdvanceFrom(index)
    ? index === 0
      ? t("swipeDeck.nudgeDestination")
      : index === 1
      ? t("swipeDeck.nudgeInterest")
      : t("swipeDeck.nudgeBudget")
    : null;

  return (
    <div className="space-y-3">
      <div
        role="progressbar"
        aria-label={t("swipeDeck.progressAriaLabel")}
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        className="flex gap-1.5"
      >
        {screenTitles.map((title, i) => (
          <div key={title} className="h-1 flex-1 rounded-full bg-paper-recess overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full bg-vermilion transition-[width] duration-300 ease-out motion-reduce:transition-none",
                i <= index ? "w-full" : "w-0"
              )}
            />
          </div>
        ))}
      </div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center">
        {index + 1} / {total} · {screenTitles[index]}
      </p>

      <form onSubmit={form.handleSubmit}>
        <div
          className="relative overflow-hidden rounded-2xl border border-line-strong bg-card shadow-lg min-h-[520px]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
        <fieldset className="relative h-full touch-pan-y">
          {/* Edge tap-zones — secondary navigation affordance alongside the bottom nav bar */}
          <button
            type="button"
            aria-label={t("swipeDeck.prevAria")}
            onClick={goPrev}
            disabled={index === 0}
            className="absolute inset-y-0 left-0 z-10 w-10 disabled:opacity-0"
          />
          <button
            type="button"
            aria-label={t("swipeDeck.nextAria")}
            onClick={goNext}
            disabled={!canAdvanceFrom(index) || index === total - 1}
            className="absolute inset-y-0 right-0 z-10 w-10 disabled:opacity-0"
          />

          {screenTitles.map((_, i) => {
            const isActive = i === index;
            return (
              <div
                key={i}
                ref={(el) => { screenRefs.current[i] = el; }}
                aria-hidden={!isActive}
                inert={!isActive}
                className={cn(
                  "absolute inset-0 flex flex-col px-6 py-6 transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-none",
                  isActive
                    ? "opacity-100 translate-x-0"
                    : i < index
                    ? "opacity-0 -translate-x-4 pointer-events-none"
                    : "opacity-0 translate-x-4 pointer-events-none"
                )}
              >
                {i === 0 && <ScreenBasics form={form} wrapperRef={wrapperRef} />}
                {i === 1 && <ScreenVibe form={form} />}
                {i === 2 && <ScreenPace form={form} />}
                {i === 3 && <ScreenBudget form={form} />}
                {i === 4 && <ScreenExtras form={form} />}
                {i === 5 && <ScreenReview form={form} />}
              </div>
            );
          })}
        </fieldset>
        </div>

        {form.formError && (
          <p className="text-xs text-destructive font-mono text-center mt-3">{form.formError}</p>
        )}
        {nudge && !form.formError && (
          <p className="text-xs text-muted-foreground font-mono text-center mt-3">{nudge}</p>
        )}

        <div className="flex items-center gap-2 mt-3">
          <Button type="button" variant="outline" onClick={goPrev} disabled={index === 0} className="flex-1">
            {t("swipeDeck.back")}
          </Button>
          {index < total - 1 ? (
            <Button type="button" onClick={goNext} disabled={!canAdvanceFrom(index)} className="flex-1 bg-vermilion text-white hover:bg-vermilion/90">
              {index === 4 ? t("swipeDeck.next") : t("swipeDeck.continue")}
            </Button>
          ) : (
            <Button type="submit" disabled={isStreaming} className="flex-1 bg-vermilion text-white hover:bg-vermilion/90">
              {isStreaming ? tCommon("generating") : t("generateItinerary")}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function ScreenBasics({ form, wrapperRef }: { form: TripBriefForm; wrapperRef: React.RefObject<HTMLDivElement | null> }) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={t("swipeDeck.basics.title")} sub={t("swipeDeck.basics.subtitle")} />
      <div ref={wrapperRef} className="relative">
        <input
          type="text"
          placeholder={tCommon("destinationPlaceholder")}
          value={form.destInput}
          onChange={(e) => form.handleDestChange(e.target.value)}
          onFocus={() => form.suggestions.length > 0 && form.setShowSuggestions(true)}
          className="w-full border border-border rounded-lg px-3 py-3 text-base bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {form.showSuggestions && (
          <ul className="absolute z-20 mt-1 w-full bg-background border border-border rounded-lg shadow-md overflow-hidden">
            {form.suggestions.map((s, i) => (
              <li
                key={i}
                onMouseDown={() => form.selectSuggestion(s)}
                className="px-3 py-2.5 text-sm cursor-pointer hover:bg-muted flex justify-between gap-2"
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
      <div className="grid grid-cols-2 gap-2.5">
        <input
          type="date"
          value={form.brief.start_date ?? ""}
          onChange={(e) => form.setStartDate(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <input
          type="date"
          value={form.endDate}
          min={form.brief.start_date ?? undefined}
          onChange={(e) => form.setEndDate(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {form.computedDays != null && form.brief.start_date && form.endDate && (
        <p className="font-mono text-[10px] text-muted-foreground -mt-2">
          {tCommon("days", { count: form.computedDays })}
        </p>
      )}
    </div>
  );
}

function ScreenVibe({ form }: { form: TripBriefForm }) {
  const t = useTranslations("plan");
  const tInterests = useTranslations("tripBrief.interests");
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={t("swipeDeck.vibe.title")} sub={t("swipeDeck.vibe.subtitle")} />
      <div className="grid grid-cols-2 gap-2">
        {PRESET_INTERESTS.map((interest) => {
          const active = form.presetSelected.includes(interest);
          return (
            <TapCard key={interest} selected={active} onClick={() => form.togglePresetInterest(interest)} className="text-left">
              <span className="mr-1.5">{INTEREST_ICONS[interest]}</span>
              {tInterests(interest)}
            </TapCard>
          );
        })}
      </div>
      <div className="space-y-2">
        <input
          type="text"
          placeholder={t("swipeDeck.customInterestPlaceholder")}
          value={form.customInput}
          onChange={(e) => form.setCustomInput(e.target.value)}
          onKeyDown={form.handleCustomKeyDown}
          className="w-full border border-border rounded-lg px-3 py-2 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {form.customInterests.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.customInterests.map((ci) => (
              <span key={ci} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-foreground text-background">
                {ci}
                <button type="button" onClick={() => form.removeCustomInterest(ci)} className="opacity-60 hover:opacity-100">×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScreenPace({ form }: { form: TripBriefForm }) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const tPace = useTranslations("tripBrief.pace");
  const tTransport = useTranslations("tripBrief.transport");
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={t("swipeDeck.pace.title")} sub={t("swipeDeck.pace.subtitle")} />
      <div className="flex flex-col gap-2">
        {PACE_OPTIONS.map((p) => (
          <TapCard key={p} selected={form.brief.pace === p} onClick={() => form.setPace(p)} className="flex items-center gap-3 text-left px-4 py-3">
            <span className="text-xl">{PACE_EMOJI[p]}</span>
            <span>
              <span className="block font-bold text-[13px]">{tPace(`${p}.label`)}</span>
              <span className="block text-[11px] text-muted-foreground">{tPace(`${p}.desc`)}</span>
            </span>
          </TapCard>
        ))}
      </div>
      {form.brief.pace === "custom" && (
        <Stepper label={tCommon("minStopsPerDay")} value={form.brief.min_stops_per_day ?? 5} onChange={form.setMinStopsPerDay} />
      )}
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{t("chapters.gettingAround")}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(TRANSPORT_EMOJI) as TripBrief["transport_mode"][]).map((mode) => (
          <TapCard
            key={mode}
            selected={(form.brief.transport_mode ?? "public_transport") === mode}
            onClick={() => form.setTransportMode(mode)}
            className="text-center px-1"
          >
            <span className="block text-base leading-none mb-1">{TRANSPORT_EMOJI[mode]}</span>
            {tTransport(mode)}
          </TapCard>
        ))}
      </div>
    </div>
  );
}

function ScreenBudget({ form }: { form: TripBriefForm }) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={t("swipeDeck.budget.title")} sub={t("swipeDeck.budget.subtitle")} />
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground font-mono">
          {form.symbol}
        </span>
        <input
          type="number"
          min={0}
          step={form.currency === "VND" ? 500000 : form.currency === "JPY" ? 1000 : 50}
          value={form.budgetLocal || ""}
          onChange={(e) => form.setBudgetLocal(Number(e.target.value))}
          placeholder={`${tCommon("eg")} ${form.currency === "VND" ? "50000000" : form.currency === "JPY" ? "300000" : "2000"}`}
          className="w-full border border-border rounded-lg pl-9 pr-3 py-3 text-xl font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {form.currency !== "USD" && form.budgetLocal > 0 && (
        <p className="font-mono text-xs text-muted-foreground">
          {t("chapters.approxUsd", { amount: Math.round(form.budgetLocal / form.rate).toLocaleString() })}
        </p>
      )}
      {form.computedDays && form.budgetLocal > 0 && (
        <p className="font-mono text-xs text-muted-foreground">
          {t("swipeDeck.perDaySummary", {
            symbol: form.symbol,
            perDay: Math.round(form.budgetLocal / form.computedDays).toLocaleString(),
            days: form.computedDays,
          })}
        </p>
      )}
    </div>
  );
}

function ScreenExtras({ form }: { form: TripBriefForm }) {
  const t = useTranslations("plan");
  const tAvoid = useTranslations("tripBrief.avoid");
  return (
    <div className="flex flex-col gap-4">
      <ScreenHeading title={t("swipeDeck.extras.title")} sub={t("swipeDeck.extras.subtitle")} />
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.brief.include_accommodation ?? false}
          onChange={(e) => form.setIncludeAccommodation(e.target.checked)}
          className="accent-foreground w-4 h-4"
        />
        <span className="text-xs font-mono text-muted-foreground">{t("extras.includeAccommodation")}</span>
      </label>
      <textarea
        rows={2}
        placeholder={t("extras.flightPlaceholder")}
        value={form.flightNotes}
        onChange={(e) => form.setFlightNotes(e.target.value)}
        className="w-full border border-border rounded-lg px-3 py-2 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
      />
      <div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{t("extras.avoidLabel")}</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_AVOID.map((item) => (
            <Chip key={item} tone="destructive" selected={(form.brief.avoid ?? []).includes(item)} onClick={() => form.toggleAvoid(item)}>
              {AVOID_ICONS[item]} {tAvoid(item)}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenReview({ form }: { form: TripBriefForm }) {
  const t = useTranslations("plan");
  const tCommon = useTranslations("common");
  const tPace = useTranslations("tripBrief.pace");
  const rows: [string, string][] = [
    [t("review.destination"), form.destInput || "—"],
    [t("review.dates"), form.computedDays ? tCommon("days", { count: form.computedDays }) : "—"],
    [t("review.interests"), form.presetSelected.concat(form.customInterests).join(", ") || "—"],
    [t("review.budget"), form.budgetLocal ? `${form.symbol}${form.budgetLocal.toLocaleString()}` : "—"],
    [
      t("review.pace"),
      form.brief.pace === "custom"
        ? t("review.customPaceMin", { n: form.brief.min_stops_per_day ?? 5 })
        : (tPace(`${form.brief.pace ?? "moderate"}.label`) || "—"),
    ],
    [t("review.avoid"), (form.brief.avoid ?? []).join(", ") || tCommon("none")],
  ];
  return (
    <div className="flex flex-col gap-4 text-center">
      <div
        className="mx-auto flex size-16 items-center justify-center rounded-full border-[3px] border-stamp text-stamp text-3xl -rotate-6 motion-safe:animate-[d3pop_.5s_cubic-bezier(.34,1.56,.64,1)]"
      >
        ✓
      </div>
      <ScreenHeading title={t("swipeDeck.review.title")} sub={t("swipeDeck.review.subtitle")} />
      <div className="rounded-lg border border-line overflow-hidden text-left">
        {rows.map(([k, v], i) => (
          <div key={k} className={cn("flex justify-between gap-2 px-3.5 py-2 text-xs", i % 2 === 0 && "bg-background")}>
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span>
            <span className="font-semibold text-right">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScreenHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h3 className="text-xl font-bold leading-tight">
        {title}
      </h3>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}
