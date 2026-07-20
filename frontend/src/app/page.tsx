import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReasonCodeChip } from "@/components/reason-code-chip";

export default function Home() {
  return (
    <div className="max-w-3xl mx-auto px-6">
      <Hero />
      <HowItWorks />
      <Differentiators />
      <BottomCTA />
    </div>
  );
}

function Hero() {
  return (
    <section className="py-20 space-y-7">
      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
        AI-powered travel planning
      </p>
      <h1 className="text-5xl font-bold leading-[1.1] tracking-tight">
        Your next trip,{" "}
        <span className="italic" style={{ fontFamily: "var(--font-serif)" }}>
          planned by AI.
        </span>
        <br />
        Verified stop by stop.
      </h1>
      <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
        TRAIVEL builds time-blocked itineraries with real place data and live
        weather — then explains exactly why each stop was chosen.
      </p>
      <div className="flex flex-wrap gap-2">
        <ReasonCodeChip code="social momentum" />
        <ReasonCodeChip code="transport fit" />
        <ReasonCodeChip code="food fit" />
        <ReasonCodeChip code="budget fit" />
        <ReasonCodeChip code="weather alternate ready" />
      </div>
      <div className="flex items-center gap-4 pt-2">
        <Link href="/plan">
          <Button size="lg" className="bg-primary text-primary-foreground hover:opacity-90 font-semibold px-7">
            Plan a trip →
          </Button>
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          No sign-in required to start
        </span>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Fill in your brief",
      body: "Destination, dates, interests, budget, pace, and anything to avoid.",
    },
    {
      n: "02",
      title: "AI builds your itinerary",
      body: "Claude plans time-blocked stops around your preferences and the day's weather.",
    },
    {
      n: "03",
      title: "Every stop verified",
      body: "Each place is cross-checked against Google Places and live weather data — in real time.",
    },
  ];

  return (
    <section className="py-14 border-t border-border space-y-8">
      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
        How it works
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((s) => (
          <div key={s.n} className="space-y-3">
            <span
              className="font-mono text-3xl font-bold"
              style={{ color: "var(--coral)" }}
            >
              {s.n}
            </span>
            <h3 className="font-semibold text-base leading-snug">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Differentiators() {
  const items = [
    {
      tag: "Trend signals",
      headline: "Places people are actually visiting right now",
      body: "Pulled from Google Places ranked by popularity — not a static database from 2023.",
    },
    {
      tag: "Reason codes",
      headline: "Every stop comes with a typed explanation",
      body: "Social momentum · transport fit · food fit · budget fit · weather alternate ready. No more black-box AI suggestions.",
    },
    {
      tag: "Verification built-in",
      headline: "Not a post-process. Part of the generation.",
      body: "Place data and weather are fed to the AI before it writes your itinerary — not checked afterwards.",
    },
  ];

  return (
    <section className="py-14 border-t border-border space-y-8">
      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
        Why TRAIVEL
      </p>
      <div className="space-y-6">
        {items.map((item) => (
          <div
            key={item.tag}
            className="flex flex-col md:flex-row gap-4 md:gap-10 py-5 border-b border-border last:border-0"
          >
            <div className="md:w-36 shrink-0">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wide">
                {item.tag}
              </span>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-semibold text-base leading-snug">
                {item.headline}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BottomCTA() {
  return (
    <section className="py-16 border-t border-border text-center space-y-5">
      <h2 className="text-2xl font-bold">
        Unlike ChatGPT,{" "}
        <span className="italic" style={{ fontFamily: "var(--font-serif)" }}>
          TRAIVEL shows its work.
        </span>
      </h2>
      <p className="text-muted-foreground text-sm max-w-md mx-auto">
        Every stop verified. Every reason explained. Real data, not hallucinations.
      </p>
      <Link href="/plan">
        <Button size="lg" className="bg-primary text-primary-foreground hover:opacity-90 font-semibold px-7 mt-2">
          Start planning →
        </Button>
      </Link>
    </section>
  );
}
