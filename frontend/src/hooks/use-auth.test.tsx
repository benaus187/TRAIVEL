import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

// The bug this hook was just implicated in: Supabase Auth falls back to its
// project "Site URL" whenever redirectTo isn't in the allow list, so if this
// ever regresses to a hardcoded/stale origin, login silently breaks in
// production exactly the way it did before — these tests pin it to
// `window.location.origin` so a regression fails loudly instead of silently.
const mockAuth = {
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
};

vi.mock("@/lib/supabase", () => ({
  createClient: () => ({ auth: mockAuth }),
}));

import { useAuth } from "@/hooks/use-auth";

// jsdom's pushState/assign enforce same-origin navigation, so switching
// origins between test cases has to go through a direct property stub
// instead of an actual navigation.
function setOrigin(origin: string) {
  Object.defineProperty(window, "location", {
    value: { origin, href: `${origin}/pricing` },
    writable: true,
    configurable: true,
  });
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.getUser.mockResolvedValue({ data: { user: null } });
    mockAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockAuth.signInWithOAuth.mockResolvedValue({});
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
  });

  it("signInWithGoogle redirects to the current origin's /auth/callback", async () => {
    setOrigin("https://traivel.cc");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://traivel.cc/auth/callback" },
    });
  });

  it("follows a different origin too — proves it's derived live, not cached/hardcoded", async () => {
    setOrigin("http://localhost:3000");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "http://localhost:3000/auth/callback" },
    });
  });

  it("signInWithEmail uses the same origin-based redirect for the magic link", async () => {
    setOrigin("https://traivel.cc");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signInWithEmail("a@b.com");
    });

    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: "a@b.com",
      options: { emailRedirectTo: "https://traivel.cc/auth/callback" },
    });
  });

  it("loads the current user on mount", async () => {
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "a@b.com" } },
    });
    const { result } = renderHook(() => useAuth());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user?.id).toBe("u1");
  });
});
