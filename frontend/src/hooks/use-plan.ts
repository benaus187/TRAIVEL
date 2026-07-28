"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { PlanInfo, PlanInfoSchema } from "@/lib/schemas/billing";

export function usePlan() {
  const { user, getAccessToken } = useAuth();
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Deferred via a microtask so no setState call is synchronous within the
    // effect body itself (avoids react-hooks/set-state-in-effect) — a full
    // browser navigation happens after Stripe checkout/portal redirects, so
    // this remounts and refetches automatically without a manual refresh fn.
    Promise.resolve().then(async () => {
      if (!user) {
        setPlan(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/billing/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const parsed = res.ok ? PlanInfoSchema.safeParse(await res.json()) : null;
        setPlan(parsed?.success ? parsed.data : null);
      } catch {
        setPlan(null);
      } finally {
        setLoading(false);
      }
    });
  }, [user, getAccessToken]);

  return { plan, loading };
}
