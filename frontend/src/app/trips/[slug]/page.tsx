"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
import { ReasonCodeChip } from "@/components/reason-code-chip";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StopSchema } from "@/lib/schemas/itinerary";
import type { Stop } from "@/lib/schemas/itinerary";
import Link from "next/link";

const MapView = dynamic(
  () => import("@/components/map-view").then((m) => m.MapView),
  { ssr: false }
);

type SharedItinerary = {
  id: string;
  share_slug: string;
  trips: { destination: string; days: number } | null;
  stops: Record<string, unknown>[];
};

export default function SharedTripPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<SharedItinerary | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeDay, setActiveDay] = useState(1);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("itineraries")
      .select("id, share_slug, trips(destination, days), stops(position, day, time, name, description, reason_codes, verified, weather_alternate, booking_url, lat, lon)")
      .eq("share_slug", slug)
      .order("position", { referencedTable: "stops", ascending: true })
      .single()
      .then(({ data, error }) => {
        console.log("[share] data:", data, "error:", error);
        if (error || !data) { setNotFound(true); return; }
        setData(data as unknown as SharedItinerary);
      });
  }, [slug]);

  const stops: Stop[] = useMemo(() => {
    if (!data?.stops) return [];
    return data.stops.flatMap((s) => {
      const parsed = StopSchema.safeParse(s);
      return parsed.success ? [parsed.data] : [];
    });
  }, [data]);

  const totalDays = useMemo(() => {
    const days = stops.map((s) => s.day ?? 1);
    return days.length ? Math.max(...days) : 1;
  }, [stops]);

  const dayStops = useMemo(
    () => stops.filter((s) => (s.day ?? 1) === activeDay),
    [stops, activeDay]
  );

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-muted-foreground text-sm">Trip not found.</p>
        <Link href="/plan" className="text-xs font-mono underline">Plan a new trip</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm font-mono">
        loading…
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
      <div>
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
          Shared itinerary
        </p>
        <h1 className="text-xl font-bold">{data.trips?.destination ?? "Trip"}</h1>
        <p className="font-mono text-xs text-muted-foreground">
          {data.trips?.days ?? totalDays} day{(data.trips?.days ?? totalDays) > 1 ? "s" : ""}
        </p>
      </div>
      <Separator />

      {totalDays > 1 && (
        <div className="flex gap-1.5">
          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
                d === activeDay
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-foreground"
              }`}
            >
              Day {d}
            </button>
          ))}
        </div>
      )}

      <MapView stops={dayStops} />

      <div className="space-y-3">
        {dayStops.map((stop, i) => (
          <Card key={i} className="shadow-none">
            <CardContent className="py-4 px-5 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="font-mono text-xs text-muted-foreground">{stop.time}</p>
                  <p className="font-semibold text-sm leading-snug">{stop.name}</p>
                </div>
                {stop.verified && (
                  <span className="shrink-0 text-[10px] font-mono text-[#1f7a45] border border-[#1f7a45]/30 rounded-full px-2 py-0.5">
                    ✓ verified
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{stop.description}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {stop.reason_codes.map((code) => (
                  <ReasonCodeChip key={code} code={code} />
                ))}
              </div>
              {stop.booking_url && (
                <a
                  href={stop.booking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5 transition-colors w-fit"
                >
                  ↗ map &amp; tickets
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-4 text-center">
        <Link href="/plan" className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
          Plan your own trip with TRAIVEL →
        </Link>
      </div>
    </div>
  );
}
