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

export function LiveAssemblyHero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [playKey, setPlayKey] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setPlayKey((k) => k + 1);
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
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
            <MiniStop key={stop.time} stop={stop} enterDelayMs={100 + i * 750} />
          ))}
        </div>
      </div>
    </section>
  );
}
