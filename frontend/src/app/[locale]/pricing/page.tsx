"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/hooks/use-auth";
import { usePlan } from "@/hooks/use-plan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckoutResponseSchema } from "@/lib/schemas/billing";

type Interval = "monthly" | "annual";

export default function PricingPage() {
  const t = useTranslations("pricing");
  const tCommon = useTranslations("common");
  const { user, getAccessToken } = useAuth();
  const { plan, loading: planLoading } = usePlan();
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPremium = plan?.plan === "premium";

  async function handleUpgrade() {
    if (!user) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setError(null);
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
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : t("checkoutError"));
        return;
      }
      const parsed = CheckoutResponseSchema.safeParse(data);
      if (!parsed.success) {
        setError(t("checkoutError"));
        return;
      }
      window.location.href = parsed.data.url;
    } finally {
      setBusy(false);
    }
  }

  async function handleManage() {
    setBusy(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/billing/portal`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.detail === "string" ? data.detail : t("portalError"));
        return;
      }
      const parsed = CheckoutResponseSchema.safeParse(data);
      if (!parsed.success) {
        setError(t("portalError"));
        return;
      }
      window.location.href = parsed.data.url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
      <div className="space-y-1 text-center">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <Suspense fallback={null}>
        <CancelBanner />
      </Suspense>

      {error && (
        <p className="text-center font-mono text-xs text-destructive">{error}</p>
      )}

      {!isPremium && (
        <div className="flex justify-center">
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs font-mono">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-3 py-1 rounded ${interval === "monthly" ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`px-3 py-1 rounded ${interval === "annual" ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {t("annual")}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t("freeTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold">$0</p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>{t("free.feature1")}</li>
              <li>{t("free.feature2")}</li>
              <li>{t("free.feature3")}</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="ring-1 ring-vermilion">
          <CardHeader>
            <CardTitle>{t("premiumTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-2xl font-bold">
              {interval === "monthly" ? "$9.99" : "$79"}
              <span className="text-sm font-normal text-muted-foreground">
                {interval === "monthly" ? t("perMonth") : t("perYear")}
              </span>
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>{t("premium.feature1")}</li>
              <li>{t("premium.feature2")}</li>
              <li>{t("premium.feature3")}</li>
            </ul>
            {/* Render immediately (defaulting to the free-tier action) instead of
                waiting on planLoading — usePlan()'s fetch takes ~1-2s, and hiding
                the button until then reads as the click having done nothing. */}
            <Button
              className="w-full"
              disabled={busy || planLoading}
              onClick={isPremium ? handleManage : handleUpgrade}
            >
              {planLoading || busy ? tCommon("loading") : isPremium ? t("manageSubscription") : t("upgradeToPremium")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CancelBanner() {
  const t = useTranslations("pricing");
  const searchParams = useSearchParams();
  if (searchParams.get("checkout") !== "cancel") return null;
  return (
    <p className="text-center font-mono text-xs text-muted-foreground">
      {t("cancelBanner")}
    </p>
  );
}
