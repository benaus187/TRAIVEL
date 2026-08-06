"use client";

import { useId } from "react";
import { ReasonCodeChip } from "@/components/reason-code-chip";
import { Card, CardContent } from "@/components/ui/card";
import type { Stop } from "@/lib/schemas/itinerary";

function extractPrice(description: string): string | null {
  const match = description.match(
    /([~≈]?(?:\$|€|£|¥|₫|A\$|NZ\$|S\$|฿)[\d,]+(?:[–\-][\d,]+)?(?:\/\w+)?(?:\s*(?:per person|each))?|[\d,]+(?:[–\-][\d,]+)?\s*(?:VND|AUD|NZD|EUR|GBP|JPY|THB|SGD|USD)(?:\/\w+)?|[Ff]ree(?: entry| admission| access)?)/
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
    <div className="flex items-center gap-2 pl-11 py-1">
      <div className="w-px h-5 bg-line shrink-0" />
    </div>
  );

  // Prefer AI-generated transit note over haversine estimate
  if (to.transit_note) {
    return (
      <div className="flex items-center gap-2 pl-11 py-1 no-print-hide">
        <div className="w-px h-5 bg-line shrink-0" />
        <span className="font-mono text-[10px] text-muted-foreground">🚇 {to.transit_note}</span>
      </div>
    );
  }

  if (from.lat == null || from.lon == null || to.lat == null || to.lon == null) return plainLine;
  const km = haversineKm(from.lat, from.lon, to.lat, to.lon);
  if (km > 50) return plainLine;
  return (
    <div className="flex items-center gap-2 pl-11 py-1 no-print-hide">
      <div className="w-px h-5 bg-line shrink-0" />
      <span className="font-mono text-[10px] text-muted-foreground">{transitLabel(km)}</span>
    </div>
  );
}

function VerifiedStamp({ verified }: { verified: boolean }) {
  const ringId = useId();
  const filterId = useId();

  if (!verified) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-3 py-4 text-center">
        <div className="w-14 h-14 rounded-full border border-dashed border-line-strong" />
        <p className="font-mono text-[9px] tracking-wide text-ink-soft leading-relaxed">
          not yet
          <br />
          verified
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-2 px-3 py-4">
      <svg viewBox="0 0 120 120" className="w-20 h-20 -rotate-[9deg]" aria-hidden="true">
        <defs>
          <path id={ringId} d="M 60,60 m -44,0 a 44,44 0 1,1 88,0 a 44,44 0 1,1 -88,0" />
          <filter id={filterId}>
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`} fill="none" stroke="var(--stamp)">
          <circle cx="60" cy="60" r="50" strokeWidth="2" strokeDasharray="3 3" opacity="0.85" />
          <circle cx="60" cy="60" r="38" strokeWidth="2.5" />
          <path d="M42 61 L54 73 L80 47" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <text
          fontFamily="var(--font-mono)"
          fontSize="9"
          fontWeight="700"
          letterSpacing="2.5"
          fill="var(--stamp)"
          filter={`url(#${filterId})`}
        >
          <textPath href={`#${ringId}`} startOffset="2%">
            VERIFIED · GOOGLE PLACES · VERIFIED · GOOGLE PLACES ·
          </textPath>
        </text>
      </svg>
      <p className="font-mono text-[9px] tracking-wide text-ink-soft text-center leading-relaxed">
        <span className="text-foreground font-semibold">Hours &amp; location</span>
        <br />
        cross-checked live
      </p>
    </div>
  );
}

export function StopCard({ stop }: { stop: Stop }) {
  const isAccommodation = stop.name.startsWith("Overnight —");

  if (isAccommodation) {
    return (
      <Card className="shadow-none border-dashed bg-muted/30">
        <CardContent className="py-3 px-5 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base">🌙</span>
            <p className="font-semibold text-sm">{stop.name}</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{stop.description}</p>
          <a
            href={`https://www.booking.com/search.html?ss=${encodeURIComponent(stop.name.replace("Overnight — ", ""))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="no-print inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground border border-border rounded px-2.5 py-1 transition-colors"
          >
            🏨 Search hotels
          </a>
        </CardContent>
      </Card>
    );
  }

  const price = extractPrice(stop.description);
  const isFree = !!price?.match(/^[Ff]ree/);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[96px_1fr_168px] bg-card border border-line-strong shadow-lg overflow-hidden">
      {/* Time block */}
      <div className="flex flex-row md:flex-col items-center justify-center gap-1 md:gap-1.5 bg-navy text-background px-4 py-3 md:py-4 text-center">
        <span className="font-mono font-bold text-2xl tabular-nums">{stop.time}</span>
        <span className="font-mono text-[10px] tracking-[0.18em] opacity-75">DEPART</span>
      </div>

      {/* Body */}
      <div
        className="relative px-5 md:px-6 py-4 md:py-5 border-b-2 md:border-b-0 md:border-r-2 border-dashed border-line
        before:content-[''] before:absolute before:w-[18px] before:h-[18px] before:rounded-full before:bg-background before:border before:border-line-strong before:-right-[9px] before:top-[-9px] max-md:before:hidden
        after:content-[''] after:absolute after:w-[18px] after:h-[18px] after:rounded-full after:bg-background after:border after:border-line-strong after:-right-[9px] after:bottom-[-9px] max-md:after:hidden"
      >
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h3 className="font-sans font-bold uppercase text-lg md:text-xl leading-tight tracking-tight">
            {stop.name}
          </h3>
          {price && (
            <span
              className={`shrink-0 whitespace-nowrap font-mono text-[10px] font-semibold px-2 py-0.5 border rounded-sm ${
                isFree ? "text-stamp border-stamp/40" : "text-gold border-gold/40"
              }`}
            >
              {price}
            </span>
          )}
        </div>

        <p className="text-sm text-ink-soft leading-relaxed mb-3 max-w-[48ch]">{stop.description}</p>

        <div className="flex flex-wrap gap-1.5 no-print">
          {stop.reason_codes.map((code) => (
            <ReasonCodeChip key={code} code={code} />
          ))}
        </div>

        {stop.weather_alternate && (
          <p className="text-xs text-ink-soft font-mono mt-3">☁ alt: {stop.weather_alternate}</p>
        )}

        <div className="flex gap-2 pt-3 flex-wrap no-print">
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
      </div>

      {/* Verify stamp */}
      <div className="flex items-center justify-center border-t-2 md:border-t-0 border-dashed border-line">
        <VerifiedStamp verified={stop.verified} />
      </div>
    </div>
  );
}
