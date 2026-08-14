import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useTripBriefForm, DEFAULT_CUSTOM_MIN_STOPS } from "@/hooks/use-trip-brief-form";
import { useCurrencyStore } from "@/stores/currency-store";

function setup() {
  const generate = vi.fn();
  const reset = vi.fn();
  const getAccessToken = vi.fn().mockResolvedValue("tok123");
  const onSubmitStart = vi.fn();
  const onClear = vi.fn();
  const rendered = renderHook(() =>
    useTripBriefForm({ generate, reset, getAccessToken, onSubmitStart, onClear })
  );
  return { ...rendered, generate, reset, getAccessToken, onSubmitStart, onClear };
}

describe("useTripBriefForm", () => {
  beforeEach(() => {
    useCurrencyStore.setState({ currency: "USD", symbol: "$", rate: 1 });
  });

  it("starts with no step valid except an always-true pace/budget gate being false", () => {
    const { result } = setup();
    expect(result.current.stepValidity).toEqual({
      destination: false,
      vibe: false,
      paceAndBudget: false,
    });
  });

  it("marks the destination step valid only after picking a suggestion", () => {
    const { result } = setup();
    act(() => result.current.handleDestChange("Hano"));
    expect(result.current.stepValidity.destination).toBe(false);

    act(() =>
      result.current.selectSuggestion({ name: "Hà Nội", admin1: "", country: "Vietnam" })
    );
    expect(result.current.stepValidity.destination).toBe(true);
    expect(result.current.destInput).toBe("Hà Nội, Vietnam");
  });

  it("toggles preset interests and reflects them in stepValidity.vibe", () => {
    const { result } = setup();
    act(() => result.current.togglePresetInterest("food & drink"));
    expect(result.current.presetSelected).toContain("food & drink");
    expect(result.current.stepValidity.vibe).toBe(true);

    act(() => result.current.togglePresetInterest("food & drink"));
    expect(result.current.presetSelected).not.toContain("food & drink");
    expect(result.current.stepValidity.vibe).toBe(false);
  });

  it("adds and removes custom interests", () => {
    const { result } = setup();
    act(() => result.current.addCustomInterest("scuba diving"));
    expect(result.current.customInterests).toEqual(["scuba diving"]);
    expect(result.current.brief.interests).toContain("scuba diving");

    act(() => result.current.removeCustomInterest("scuba diving"));
    expect(result.current.customInterests).toEqual([]);
    expect(result.current.brief.interests).not.toContain("scuba diving");
  });

  it("defaults min_stops_per_day when switching to custom pace, and clears it when switching away", () => {
    const { result } = setup();
    act(() => result.current.setPace("custom"));
    expect(result.current.brief.pace).toBe("custom");
    expect(result.current.brief.min_stops_per_day).toBe(DEFAULT_CUSTOM_MIN_STOPS);

    act(() => result.current.setMinStopsPerDay(8));
    expect(result.current.brief.min_stops_per_day).toBe(8);

    act(() => result.current.setPace("relaxed"));
    expect(result.current.brief.min_stops_per_day).toBeUndefined();
  });

  it("clamps min_stops_per_day to the 1-12 range", () => {
    const { result } = setup();
    act(() => result.current.setPace("custom"));
    act(() => result.current.setMinStopsPerDay(99));
    expect(result.current.brief.min_stops_per_day).toBe(12);
    act(() => result.current.setMinStopsPerDay(0));
    expect(result.current.brief.min_stops_per_day).toBe(1);
  });

  it("blocks submit with a form error when the destination isn't confirmed", async () => {
    const { result, generate } = setup();
    act(() => result.current.togglePresetInterest("food & drink"));
    act(() => result.current.setBudgetLocal(500));

    await act(async () => result.current.handleSubmit());

    expect(result.current.formError).toBe("Select a destination from the list");
    expect(generate).not.toHaveBeenCalled();
  });

  it("submits a fully valid USD brief with the raw budget", async () => {
    const { result, generate, onSubmitStart } = setup();
    act(() =>
      result.current.selectSuggestion({ name: "Hà Nội", admin1: "", country: "Vietnam" })
    );
    act(() => result.current.togglePresetInterest("food & drink"));
    act(() => result.current.setBudgetLocal(650));

    await act(async () => result.current.handleSubmit());

    expect(result.current.formError).toBeNull();
    expect(onSubmitStart).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
    const [submittedBrief, token] = generate.mock.calls[0];
    expect(submittedBrief.destination).toBe("Hà Nội, Vietnam");
    expect(submittedBrief.budget_usd_total).toBe(650);
    expect(submittedBrief.currency).toBe("USD");
    expect(token).toBe("tok123");
  });

  it("converts a non-USD local budget to USD before submitting", async () => {
    useCurrencyStore.setState({ currency: "VND", symbol: "₫", rate: 25000 });
    const { result, generate } = setup();
    act(() =>
      result.current.selectSuggestion({ name: "Hà Nội", admin1: "", country: "Vietnam" })
    );
    act(() => result.current.togglePresetInterest("food & drink"));
    act(() => result.current.setBudgetLocal(25_000_000));

    await act(async () => result.current.handleSubmit());

    const [submittedBrief] = generate.mock.calls[0];
    expect(submittedBrief.budget_usd_total).toBe(1000);
    expect(submittedBrief.currency).toBe("VND");
  });

  it("rejects submit via TripBriefSchema when no interests are picked", async () => {
    const { result, generate } = setup();
    act(() =>
      result.current.selectSuggestion({ name: "Hà Nội", admin1: "", country: "Vietnam" })
    );
    act(() => result.current.setBudgetLocal(650));

    await act(async () => result.current.handleSubmit());

    expect(result.current.formError).toBe("Pick at least one interest");
    expect(generate).not.toHaveBeenCalled();
  });

  it("resets every field and calls reset()/onClear() on handleClear", async () => {
    const { result, reset, onClear } = setup();
    act(() =>
      result.current.selectSuggestion({ name: "Hà Nội", admin1: "", country: "Vietnam" })
    );
    act(() => result.current.togglePresetInterest("food & drink"));
    act(() => result.current.setBudgetLocal(650));
    act(() => result.current.setPace("custom"));

    act(() => result.current.handleClear());

    expect(reset).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(result.current.destinationConfirmed).toBe(false);
    expect(result.current.destInput).toBe("");
    expect(result.current.budgetLocal).toBe(0);
    expect(result.current.brief.pace).toBe("moderate");
    expect(result.current.brief.min_stops_per_day).toBeUndefined();
  });
});
