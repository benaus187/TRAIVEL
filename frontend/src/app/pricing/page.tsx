"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Interval = "monthly" | "annual";

export default function PricingPage() {
  const { user, getAccessToken } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [busy, setBusy] = useState(false);

  const isPremium = plan?.plan === "premium";

  async function handleUpgrade() {
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setBusy(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/billing/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ interval }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }

  async function handleManage() {
    setBusy(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/billing/portal`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <div className="space-y-1 text-center">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Pricing
        </p>
        <h1 className="text-2xl font-bold">Free to plan. Premium to plan without limits.</h1>
      </div>

      <Suspense fallback={null}>
        <CancelBanner />
      </Suspense>

      {!isPremium && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs font-mono">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-3 py-1 rounded ${interval === "monthly" ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`px-3 py-1 rounded ${interval === "annual" ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              Annual
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold">$0</p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>5 itinerary generations / day</li>
              <li>Full verification (places + weather)</li>
              <li>Trend signals, map view, share links</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="ring-1" style={{ boxShadow: "0 0 0 1px var(--coral)" }}>
          <CardHeader>
            <CardTitle>Premium</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold">
              {interval === "monthly" ? "$9.99" : "$79"}
              <span className="text-sm font-normal text-muted-foreground">
                /{interval === "monthly" ? "month" : "year"}
              </span>
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>Unlimited itinerary generations</li>
              <li>Everything in Free</li>
              <li>Priority support</li>
            </ul>
            {!planLoading && (
              isPremium ? (
                <Button className="w-full" disabled={busy} onClick={handleManage}>
                  {busy ? "Loading…" : "Manage subscription"}
                </Button>
              ) : (
                <Button className="w-full" disabled={busy} onClick={handleUpgrade}>
                  {busy ? "Loading…" : "Upgrade to Premium"}
                </Button>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CancelBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("checkout") !== "cancel") return null;
  return (
    <p className="text-center font-mono text-xs text-muted-foreground">
      Checkout canceled — no charge was made.
    </p>
  );
}
