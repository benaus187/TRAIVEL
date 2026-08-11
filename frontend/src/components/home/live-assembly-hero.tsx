"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MiniStop, type SampleStop } from "@/components/home/mini-stop";

const STOPS: SampleStop[] = [
  { time: "07:30", name: "Hoàn Kiếm Lake, sunrise walk", codes: ["social momentum", "weather alternate ready"] },
  { time: "09:30", name: "Cà phê trứng at Đinh Café", codes: ["food fit", "budget fit"] },
  { time: "12:00", name: "Train Street, Hẻm 224", codes: ["social momentum", "transport fit"], verified: true },
];

// Total choreographed animation time (last delay + its duration) plus slack.
// Past this point we force the final visible state via React state instead of
// CSS animation-delay/forwards — a backgrounded tab, reduced-motion edge case,
// or anything else that stalls the CSS animation should never leave the
// content permanently invisible.
const SETTLE_MS = 2600;

export function LiveAssemblyHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !("IntersectionObserver" in window)) {
      setSettled(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setPlayKey((k) => k + 1);
        setSettled(false);
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => setSettled(true), SETTLE_MS);
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  return (
    <section className="py-20" ref={sectionRef}>
      <div className="grid grid-cols-1 md:grid-cols-[1.05fr_1fr] gap-10 md:gap-14 items-center">
        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            AI-powered travel planning
          </p>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold leading-[1.13] tracking-tight">
            Your next trip,{" "}
            <span className="italic" style={{ fontFamily: "var(--font-serif)" }}>
              planned by AI.
            </span>
            <br />
            Verified stop by stop.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-md">
            TRAIVEL builds time-blocked itineraries with real place data and live
            weather — then explains exactly why each stop was chosen.
          </p>
          <div className="flex items-center gap-4 pt-6 flex-wrap">
            <Link href="/plan">
              <Button size="lg" className="bg-primary text-primary-foreground hover:opacity-90 font-semibold px-7">
                Plan a trip →
              </Button>
            </Link>
            <span className="font-mono text-xs text-muted-foreground">
              No sign-in required to start
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3" key={playKey}>
          {STOPS.map((stop, i) => (
            <MiniStop
              key={stop.time}
              stop={stop}
              animate={!settled}
              delaySeconds={0.1 + i * 0.75}
              stampDelaySeconds={2.05}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
