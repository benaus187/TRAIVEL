const STATS: { value: string; label: string }[] = [
  { value: "100%", label: "of stops verified against Google Places + live weather" },
  { value: "5", label: "typed reason codes explaining every stop, no black box" },
  { value: "0", label: "static databases — trend data is pulled live, not cached from 2023" },
];

export function TrustLine() {
  return (
    <section className="py-14 border-t border-border">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
        {STATS.map((stat) => (
          <div key={stat.label}>
            <span className="font-mono text-4xl md:text-5xl font-bold text-vermilion tabular-nums">
              {stat.value}
            </span>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-[24ch] mx-auto">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
