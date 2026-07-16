"use client";

import { useState } from "react";
import { TripBrief, TripBriefSchema } from "@/lib/schemas/itinerary";
import { useItineraryStream } from "@/hooks/use-itinerary-stream";
import { ReasonCodeChip } from "@/components/reason-code-chip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const INTERESTS = [
  "food & drink",
  "art & culture",
  "nature & outdoors",
  "history",
  "shopping",
  "nightlife",
  "architecture",
  "street food",
];

export default function PlanPage() {
  const { stops, state, error, tripId, generate, reset } = useItineraryStream();
  const [brief, setBrief] = useState<Partial<TripBrief>>({
    days: 2,
    budget: "mid-range",
    pace: "moderate",
    interests: [],
    avoid: [],
  });

  function toggleInterest(interest: string) {
    setBrief((prev) => {
      const list = prev.interests ?? [];
      return {
        ...prev,
        interests: list.includes(interest)
          ? list.filter((i) => i !== interest)
          : [...list, interest],
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = TripBriefSchema.safeParse(brief);
    if (!parsed.success) {
      alert(parsed.error.issues[0].message);
      return;
    }
    generate(parsed.data);
  }

  const isStreaming = state === "streaming";
  const hasResult = stops.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">
      {/* ── Trip Brief Form ── */}
      <aside className="lg:sticky lg:top-8 space-y-6">
        <div>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-1">
            Trip Brief
          </p>
          <h2 className="text-xl font-bold">Where are you going?</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Destination */}
          <Field label="Destination">
            <input
              type="text"
              placeholder="Tokyo, Sydney, Paris…"
              value={brief.destination ?? ""}
              onChange={(e) =>
                setBrief((p) => ({ ...p, destination: e.target.value }))
              }
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          {/* Days */}
          <Field label="Days">
            <input
              type="number"
              min={1}
              max={14}
              value={brief.days ?? 2}
              onChange={(e) =>
                setBrief((p) => ({ ...p, days: Number(e.target.value) }))
              }
              className="w-24 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </Field>

          {/* Interests */}
          <Field label="Interests">
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((interest) => {
                const active = (brief.interests ?? []).includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-3 py-1 rounded-full text-xs font-mono border transition-colors ${
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground border-border hover:border-foreground"
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Budget */}
          <Field label="Budget">
            <SelectRow
              options={["budget", "mid-range", "luxury"]}
              value={brief.budget ?? "mid-range"}
              onChange={(v) =>
                setBrief((p) => ({
                  ...p,
                  budget: v as TripBrief["budget"],
                }))
              }
            />
          </Field>

          {/* Pace */}
          <Field label="Pace">
            <SelectRow
              options={["relaxed", "moderate", "packed"]}
              value={brief.pace ?? "moderate"}
              onChange={(v) =>
                setBrief((p) => ({ ...p, pace: v as TripBrief["pace"] }))
              }
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isStreaming} className="flex-1">
              {isStreaming ? "Generating…" : hasResult ? "Regenerate" : "Generate itinerary"}
            </Button>
            {hasResult && (
              <Button type="button" variant="outline" onClick={reset}>
                Clear
              </Button>
            )}
          </div>
        </form>
      </aside>

      {/* ── Itinerary Output ── */}
      <main className="min-h-[400px]">
        {state === "idle" && (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Fill in the brief and generate your itinerary.
          </div>
        )}

        {state === "error" && (
          <div className="p-4 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {hasResult && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                {brief.destination} · {brief.days} day{(brief.days ?? 1) > 1 ? "s" : ""}
              </p>
              {state === "streaming" && (
                <span className="font-mono text-xs text-muted-foreground animate-pulse">
                  generating…
                </span>
              )}
              {state === "done" && tripId && (
                <span className="font-mono text-xs text-[#1f7a45]">
                  ✓ saved
                </span>
              )}
            </div>
            <Separator />
            {stops.map((stop, i) => (
              <Card key={i} className="shadow-none">
                <CardContent className="py-4 px-5 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <p className="font-mono text-xs text-muted-foreground">
                        {stop.time}
                      </p>
                      <p className="font-semibold text-sm leading-snug">
                        {stop.name}
                      </p>
                    </div>
                    {stop.verified && (
                      <span className="shrink-0 text-[10px] font-mono text-[#1f7a45] border border-[#1f7a45]/30 rounded-full px-2 py-0.5">
                        ✓ verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {stop.description}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {stop.reason_codes.map((code) => (
                      <ReasonCodeChip key={code} code={code} />
                    ))}
                  </div>
                  {stop.weather_alternate && (
                    <p className="text-xs text-muted-foreground font-mono">
                      ☁ alt: {stop.weather_alternate}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function SelectRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1 rounded-md text-xs font-mono border transition-colors ${
            value === opt
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-muted-foreground border-border hover:border-foreground"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
