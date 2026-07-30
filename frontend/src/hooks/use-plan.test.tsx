import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const mockUseAuth = vi.fn();
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockUseAuth(),
}));

import { usePlan } from "@/hooks/use-plan";

describe("usePlan", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:8000");
  });

  it("returns a null plan without fetching when signed out", async () => {
    mockUseAuth.mockReturnValue({ user: null, getAccessToken: vi.fn() });
    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plan).toBeNull();
  });

  it("fetches /api/billing/me with the bearer token when signed in", async () => {
    const getAccessToken = vi.fn().mockResolvedValue("tok123");
    mockUseAuth.mockReturnValue({ user: { id: "u1" }, getAccessToken });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan: "premium", subscription_status: "active" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/billing/me", {
      headers: { Authorization: "Bearer tok123" },
    });
    expect(result.current.plan).toEqual({ plan: "premium", subscription_status: "active" });
  });

  it("falls back to a null plan when the response fails Zod validation", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      getAccessToken: vi.fn().mockResolvedValue("tok"),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ plan: "not-a-real-plan" }) })
    );

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plan).toBeNull();
  });

  it("falls back to a null plan on a network error rather than throwing", async () => {
    mockUseAuth.mockReturnValue({
      user: { id: "u1" },
      getAccessToken: vi.fn().mockResolvedValue("tok"),
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.plan).toBeNull();
  });
});
