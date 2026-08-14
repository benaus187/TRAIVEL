"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { TripBrief, TripBriefSchema } from "@/lib/schemas/itinerary";
import { useCurrencyStore } from "@/stores/currency-store";

export const PRESET_INTERESTS = [
  "food & drink",
  "art & culture",
  "nature & outdoors",
  "history",
  "shopping",
  "nightlife",
  "architecture",
  "street food",
];

export const PRESET_AVOID = [
  "crowded places",
  "tourist traps",
  "nightlife",
  "street food",
  "steep hills",
  "early mornings",
];

export const PACE_OPTIONS = ["relaxed", "moderate", "packed", "custom"] as const;
export const DEFAULT_CUSTOM_MIN_STOPS = 5;

export type GeoSuggestion = { name: string; admin1: string; country: string };

const INITIAL_BRIEF: Partial<TripBrief> = {
  days: 3,
  budget_usd_total: 0,
  pace: "moderate",
  interests: [],
  avoid: [],
  transport_mode: "public_transport",
  include_accommodation: false,
};

export type UseTripBriefFormParams = {
  generate: (brief: TripBrief, token?: string | null) => void;
  reset: () => void;
  getAccessToken: () => Promise<string | null | undefined>;
  /** Called right before a submit is dispatched (e.g. to reset day pagination in the output panel). */
  onSubmitStart?: () => void;
  /** Called after every field of the form has been reset back to initial values. */
  onClear?: () => void;
};

/**
 * Owns all trip-brief intake state/validation/submit logic, shared by both the
 * desktop "chapters" shell and the mobile "swipe deck" shell so neither
 * reimplements (and risks drifting from) the same rules.
 */
export function useTripBriefForm({
  generate,
  reset,
  getAccessToken,
  onSubmitStart,
  onClear,
}: UseTripBriefFormParams) {
  const { currency, symbol, rate } = useCurrencyStore();

  const [brief, setBrief] = useState<Partial<TripBrief>>(INITIAL_BRIEF);
  const [budgetLocal, setBudgetLocal] = useState(0);
  const [endDate, setEndDate] = useState("");
  const [flightNotes, setFlightNotes] = useState("");

  // Destination autocomplete
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [destInput, setDestInput] = useState("");
  // True only once the user has picked a suggestion from the geocoding
  // dropdown — required at submit so a garbled free-typed destination
  // (e.g. a typo that matches no real place) can't reach generation.
  const [destinationConfirmed, setDestinationConfirmed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Custom interests
  const [customInput, setCustomInput] = useState("");
  const [customInterests, setCustomInterests] = useState<string[]>([]);

  const [formError, setFormError] = useState<string | null>(null);

  // Last submitted brief (for retry) — read during render, so it must be
  // state, not a ref.
  const [lastSubmittedBrief, setLastSubmittedBrief] = useState<TripBrief | null>(null);

  // Clear the form error when the user edits the form again — set directly
  // during render (React's documented pattern for "adjusting state when a
  // prop/state changes") instead of a useEffect.
  const [prevBrief, setPrevBrief] = useState(brief);
  if (brief !== prevBrief) {
    setPrevBrief(brief);
    setFormError(null);
  }

  // Days derived from start + end date when both are set, falling back to
  // brief.days (default 3) otherwise.
  const computedDays = useMemo(() => {
    if (brief.start_date && endDate && endDate >= brief.start_date) {
      const diff = Math.round(
        (new Date(endDate).getTime() - new Date(brief.start_date).getTime()) / 86400000
      ) + 1;
      return Math.min(14, Math.max(1, diff));
    }
    return brief.days;
  }, [brief.start_date, endDate, brief.days]);

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
    setDestinationConfirmed(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 280);
  }

  function selectSuggestion(s: GeoSuggestion) {
    const full = [s.name, s.admin1, s.country].filter(Boolean).join(", ");
    setDestInput(full);
    setBrief((p) => ({ ...p, destination: full }));
    setDestinationConfirmed(true);
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

  function setStartDate(value: string) {
    setBrief((p) => ({ ...p, start_date: value || undefined }));
  }

  function setPace(pace: TripBrief["pace"]) {
    setBrief((p) => ({
      ...p,
      pace,
      // Default to a sensible stepper value on entering Custom, clear it on leaving
      // so a stale count never lingers in the payload for a non-custom pace.
      min_stops_per_day: pace === "custom" ? (p.min_stops_per_day ?? DEFAULT_CUSTOM_MIN_STOPS) : undefined,
    }));
  }

  function setMinStopsPerDay(n: number) {
    setBrief((p) => ({ ...p, min_stops_per_day: Math.max(1, Math.min(12, n)) }));
  }

  function setTransportMode(mode: TripBrief["transport_mode"]) {
    setBrief((p) => ({ ...p, transport_mode: mode }));
  }

  function setIncludeAccommodation(value: boolean) {
    setBrief((p) => ({ ...p, include_accommodation: value }));
  }

  async function handleSubmit(e?: { preventDefault?: () => void }) {
    e?.preventDefault?.();
    if (!destinationConfirmed) {
      setFormError("Select a destination from the list");
      return;
    }
    const budgetUsd = currency === "USD" ? budgetLocal : Math.round(budgetLocal / rate);
    const days = computedDays ?? 3;
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
    setLastSubmittedBrief(parsed.data);
    onSubmitStart?.();
    const token = await getAccessToken();
    generate(parsed.data, token);
  }

  function handleClear() {
    reset();
    setBrief(INITIAL_BRIEF);
    setBudgetLocal(0);
    setEndDate("");
    setFlightNotes("");
    setDestInput("");
    setSuggestions([]);
    setShowSuggestions(false);
    setDestinationConfirmed(false);
    setCustomInput("");
    setCustomInterests([]);
    setFormError(null);
    setLastSubmittedBrief(null);
    onClear?.();
  }

  async function retry() {
    if (!lastSubmittedBrief) return;
    const token = await getAccessToken();
    generate(lastSubmittedBrief, token);
  }

  const presetSelected = useMemo(
    () => (brief.interests ?? []).filter((i) => !customInterests.includes(i)),
    [brief.interests, customInterests]
  );

  // Soft "can I advance" gates for the two multi-step shells — mirror
  // TripBriefSchema's own rules (min 1 interest, a confirmed destination,
  // a non-zero budget) so step-advance UI and the final safeParse can't
  // drift apart. The final safeParse at submit remains the source of truth.
  const stepValidity = {
    destination: destinationConfirmed,
    vibe: (brief.interests ?? []).length >= 1,
    paceAndBudget: budgetLocal > 0,
  };

  return {
    // data
    brief,
    budgetLocal,
    endDate,
    flightNotes,
    destInput,
    destinationConfirmed,
    suggestions,
    showSuggestions,
    customInput,
    customInterests,
    presetSelected,
    formError,
    lastSubmittedBrief,
    computedDays,
    currency,
    symbol,
    rate,
    stepValidity,

    // setters
    setBudgetLocal,
    setEndDate,
    setFlightNotes,
    setShowSuggestions,
    setCustomInput,
    setStartDate,
    setPace,
    setMinStopsPerDay,
    setTransportMode,
    setIncludeAccommodation,

    // actions
    handleDestChange,
    selectSuggestion,
    togglePresetInterest,
    addCustomInterest,
    removeCustomInterest,
    handleCustomKeyDown,
    toggleAvoid,
    handleSubmit,
    handleClear,
    retry,
  };
}

export type TripBriefForm = ReturnType<typeof useTripBriefForm>;
