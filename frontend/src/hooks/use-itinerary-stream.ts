"use client";

import { useState, useCallback } from "react";
import { Stop, StopSchema, TripBrief } from "@/lib/schemas/itinerary";

type StreamState = "idle" | "streaming" | "done" | "error";

export function useItineraryStream() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [state, setState] = useState<StreamState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);

  const generate = useCallback(async (brief: TripBrief) => {
    setStops([]);
    setError(null);
    setTripId(null);
    setState("streaming");

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/itinerary/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(brief),
        }
      );

      if (!res.ok || !res.body) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          const event = JSON.parse(raw) as {
            type: string;
            stop?: unknown;
            message?: string;
          };

          if (event.type === "stop" && event.stop) {
            const parsed = StopSchema.safeParse(event.stop);
            if (parsed.success) {
              setStops((prev) => [...prev, parsed.data]);
            }
          } else if (event.type === "done") {
            if (event.trip_id) setTripId(event.trip_id as string);
            setState("done");
          } else if (event.type === "error") {
            throw new Error(event.message ?? "Unknown error");
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStops([]);
    setState("idle");
    setError(null);
    setTripId(null);
  }, []);

  return { stops, state, error, tripId, generate, reset };
}
