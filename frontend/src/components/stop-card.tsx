"use client";

import { ReasonCodeChip } from "@/components/reason-code-chip";
import { Card, CardContent } from "@/components/ui/card";
import type { Stop } from "@/lib/schemas/itinerary";

function extractPrice(description: string): string | null {
  const match = description.match(
    /([~≈]?\$[\d,]+(?:[–\-][\d,]+)?(?:\/\w+)?(?:\s*(?:per person|each))?|[Ff]ree(?: entry| admission| access)?)/
  );
  return match ? match[0] : null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function transitLabel(km: number): string {
  if (km < 0.8) {
    const min = Math.max(1, Math.round((km / 5) * 60));
    return `~${min} min walk · ${(km * 1000).toFixed(0)} m`;
  }
  const min = Math.max(1, Math.round((km / 25) * 60));
  return `~${min} min drive · ${km.toFixed(1)} km`;
}

export function TransitConnector({ from, to }: { from: Stop; to: Stop }) {
  const plainLine = (
    <div className="flex items-center gap-2 pl-5 py-1">
      <div className="w-px h-5 bg-border shrink-0 ml-[1px]" />
    </div>
  );
  if (from.lat == null || from.lon == null || to.lat == null || to.lon == null) return plainLine;
  const km = haversineKm(from.lat, from.lon, to.lat, to.lon);
  if (km > 50) return plainLine;
  return (
    <div className="flex items-center gap-2 pl-[18px] py-1">
      <div className="w-px h-5 bg-border shrink-0" />
      <span className="font-mono text-[10px] text-muted-foreground">{transitLabel(km)}</span>
    </div>
  );
}

export function StopCard({ stop }: { stop: Stop }) {
  const price = extractPrice(stop.description);
  const isFree = !!price?.match(/^[Ff]ree/);

  return (
    <Card className="shadow-none">
      <CardContent className="py-4 px-5 space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="font-mono text-xs" style={{ color: "var(--coral)" }}>{stop.time}</p>
            <p className="font-semibold text-sm leading-snug">{stop.name}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {price && (
              <span
                className={`text-[10px] font-mono font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${
                  isFree
                    ? "bg-[#1f7a45]/10 text-[#1f7a45]"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {price}
              </span>
            )}
            {stop.verified && (
              <span className="text-[10px] font-mono text-[#1f7a45] border border-[#1f7a45]/30 rounded-full px-2 py-0.5">
                ✓ verified
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {stop.description}
        </p>

        {/* Reason codes */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {stop.reason_codes.map((code) => (
            <ReasonCodeChip key={code} code={code} />
          ))}
        </div>

        {/* Weather alternate */}
        {stop.weather_alternate && (
          <p className="text-xs text-muted-foreground font-mono">
            ☁ alt: {stop.weather_alternate}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1 flex-wrap">
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent(stop.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded px-2.5 py-1 transition-colors"
          >
            ↗ View on map
          </a>
          <a
            href={`https://www.getyourguide.com/s/?q=${encodeURIComponent(stop.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded px-2.5 py-1 transition-colors"
          >
            🎟 Book tickets
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
