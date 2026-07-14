import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REASON_CODES = [
  "social momentum",
  "transport fit",
  "food fit",
  "budget fit",
  "weather alternate ready",
] as const;

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-16">
      <Hero />
      <PlaceholderGrid />
    </div>
  );
}

function Hero() {
  return (
    <section className="space-y-4 max-w-2xl">
      <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
        AI-powered travel planning
      </p>
      <h1 className="text-4xl font-bold leading-tight tracking-tight">
        Every stop has a reason.
        <br />
        Every reason has data.
      </h1>
      <p className="text-muted-foreground text-lg leading-relaxed">
        TRAIVEL verifies each stop against real opening hours, live weather, and
        social trend signals — then shows you exactly why it was chosen.
      </p>
      <div className="flex flex-wrap gap-2 pt-2">
        {REASON_CODES.map((code) => (
          <Badge key={code} variant="secondary" className="font-mono text-xs">
            {code}
          </Badge>
        ))}
      </div>
    </section>
  );
}

function PlaceholderGrid() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <PlaceholderCard
        title="Trip Brief"
        description="Destination, dates, interests, budget, pace, and what to avoid."
        phase="Phase 1"
      />
      <PlaceholderCard
        title="AI Itinerary"
        description="Time-blocked stops with reason codes, streamed in real time."
        phase="Phase 1"
      />
      <PlaceholderCard
        title="Trend Signals"
        description="Social momentum scores, sponsored content filtered out."
        phase="Phase 3"
      />
    </section>
  );
}

function PlaceholderCard({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <Card className="border-dashed opacity-60">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="font-mono text-xs text-muted-foreground">
            {phase}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
