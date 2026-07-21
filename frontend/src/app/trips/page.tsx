"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  const { user, loading, supabase, signOut } = useAuth();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fetching, setFetching] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

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

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm font-mono">
        loading…
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
            My Trips
          </p>
          <h1 className="text-xl font-bold">{user.email}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/plan">
            <Button variant="outline" size="sm">+ New trip</Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => signOut().then(() => router.replace("/"))}>
            Sign out
          </Button>
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-3">
          <p className="text-sm">No trips yet.</p>
          <Link href="/plan">
            <Button size="sm">Plan your first trip</Button>
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
                      {trip.days} day{trip.days > 1 ? "s" : ""} ·{" "}
                      {new Date(trip.created_at).toLocaleDateString("en-US", {
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
                          ↗ view
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
                      {copiedSlug === slug ? "✓ copied" : "copy link"}
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
