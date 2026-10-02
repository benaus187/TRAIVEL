"use client";

import { useTranslations } from "next-intl";

export function TrustLine() {
  const t = useTranslations("home.trustLine");
  const stats: { value: string; label: string }[] = [
    { value: "100%", label: t("stat1") },
    { value: "5", label: t("stat2") },
    { value: "0", label: t("stat3") },
  ];
  return (
    <section className="py-14 border-t border-border">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
        {stats.map((stat) => (
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
