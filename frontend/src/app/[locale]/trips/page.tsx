"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Trip = {
  id: string;
  destination: string;
  days: number;
  created_at: string;
  itineraries: { id: string; share_slug: string | null; trip_id: string }[];
};

export default function TripsPage() {
  const t = useTranslations("trips");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const { user, loading, supabase, signOut } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fetching, setFetching] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    async function fetchTrips() {
      const { data: tripsData } = await supabase
        .from("trips")
        .select("id, destination, days, created_at")
        .order("created_at", { ascending: false });

      if (!tripsData?.length) { setFetching(false); return; }

      const tripIds = tripsData.map((t) => t.id);
      const { data: itiData } = await supabase
        .from("itineraries")
        .select("id, share_slug, trip_id")
        .in("trip_id", tripIds);

      const merged: Trip[] = tripsData.map((t) => ({
        ...t,
        itineraries: (itiData ?? []).filter((i) => i.trip_id === t.id),
      }));
      setTrips(merged);
      setFetching(false);
    }

    fetchTrips();
  }, [user, supabase]);

  // Two-step inline confirm (same idiom as "copy link" above) instead of a
  // modal — click once to arm, click again within 3s to actually delete.
  // itineraries/stops cascade-delete in Postgres (schema.sql), so a single
  // trips row delete is enough.
  function handleDeleteClick(id: string) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => setConfirmingId(null), 3000);
      return;
    }
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setConfirmingId(null);
    supabase
      .from("trips")
      .delete()
      .eq("id", id)
      .then(() => setTrips((prev) => prev.filter((t) => t.id !== id)));
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm font-mono">
        {tCommon("loadingLower")}
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
            {t("eyebrow")}
          </p>
          <h1 className="text-xl font-bold">{user.email}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/plan">
            <Button variant="outline" size="sm">{t("newTrip")}</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => router.replace("/"))}>
            {tNav("signOut")}
          </Button>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
          <p className="text-sm">{t("empty")}</p>
          <Link href="/plan">
            <Button size="sm">{t("planFirst")}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => {
            const slug = trip.itineraries?.[0]?.share_slug;
            return (
              <Card key={trip.id} className="shadow-none">
                <CardContent className="py-4 px-5 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-sm">{trip.destination}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {tCommon("days", { count: trip.days })} ·{" "}
                      {new Date(trip.created_at).toLocaleDateString(locale, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {slug && (
                      <Link href={`/trips/${slug}`}>
                        <Button variant="outline" size="sm" className="font-mono text-xs">
                          {t("view")}
                        </Button>
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        if (slug) {
                          navigator.clipboard.writeText(`${window.location.origin}/trips/${slug}`);
                          setCopiedSlug(slug);
                          setTimeout(() => setCopiedSlug(null), 2000);
                        }
                      }}
                      disabled={!slug}
                      className="text-xs font-mono text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors px-2"
                    >
                      {copiedSlug === slug ? t("copied") : t("copyLink")}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(trip.id)}
                      className={`text-xs font-mono transition-colors px-2 ${
                        confirmingId === trip.id
                          ? "text-destructive font-semibold"
                          : "text-muted-foreground hover:text-destructive"
                      }`}
                    >
                      {confirmingId === trip.id ? t("confirmDelete") : t("delete")}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
