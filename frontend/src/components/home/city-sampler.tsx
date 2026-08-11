"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MiniStop, type SampleStop } from "@/components/home/mini-stop";
import { cn } from "@/lib/utils";

const CITIES: { id: string; label: string; stop: SampleStop }[] = [
  {
    id: "hanoi",
    label: "Hà Nội",
    stop: { time: "12:00", name: "Train Street, Hẻm 224", codes: ["social momentum", "transport fit"], verified: true },
  },
  {
    id: "lisbon",
    label: "Lisbon",
    stop: { time: "19:30", name: "Miradouro da Graça, sunset", codes: ["social momentum", "weather alternate ready"], verified: true },
  },
  {
    id: "bangkok",
    label: "Bangkok",
    stop: { time: "08:00", name: "Chatuchak Market, early entry", codes: ["budget fit", "food fit"], verified: true },
  },
  {
    id: "kyoto",
    label: "Kyoto",
    stop: { time: "06:30", name: "Fushimi Inari, before the crowds", codes: ["weather alternate ready", "transport fit"], verified: true },
  },
];

export function CitySampler() {
  const [activeId, setActiveId] = useState(CITIES[0].id);
  const active = CITIES.find((c) => c.id === activeId) ?? CITIES[0];

  return (
    <section className="py-14 border-t border-border text-center">
      <div className="max-w-md mx-auto">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          See it work for your trip
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-snug">
          Pick a city. Watch a real stop land.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Same verification, same reason codes as above — try it on a destination of your
          choice before you commit to a full itinerary.
        </p>
      </div>

      <div className="flex justify-center gap-2 mt-7 flex-wrap">
        {CITIES.map((city) => (
          <button
            key={city.id}
            type="button"
            aria-pressed={city.id === activeId}
            onClick={() => setActiveId(city.id)}
            className={cn(
              "font-mono text-xs tracking-wide px-4 py-2 rounded-full border transition-colors",
              city.id === activeId
                ? "bg-vermilion border-vermilion text-white"
                : "bg-card border-line-strong text-foreground hover:bg-muted"
            )}
          >
            {city.label}
          </button>
        ))}
      </div>

      <div className="mt-7 max-w-sm mx-auto text-left" key={activeId}>
        <MiniStop stop={active.stop} enterDelayMs={0} />
      </div>

      <div className="pt-7">
        <Link href="/plan">
          <Button size="lg" className="bg-primary text-primary-foreground hover:opacity-90 font-semibold px-7">
            Plan your own trip →
          </Button>
        </Link>
      </div>
      <p className="mt-3 font-mono text-xs text-muted-foreground">No sign-in required to try it</p>
    </section>
  );
}
