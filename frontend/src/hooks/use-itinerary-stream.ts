"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Stop, StopSchema, TripBrief } from "@/lib/schemas/itinerary";

type StreamState = "idle" | "streaming" | "verifying" | "done" | "error";

export type WeatherDay = {
  date: string;
  condition: string;
  temp_max: number | null;
  precipitation: number | null;
  bad_weather: boolean;
  location?: string;
};

export type TrendItem =
  | {
      source: "google_places";
      name: string;
      rating?: number;
      review_count?: number;
      summary?: string;
    }
  | {
      source: "youtube";
      title: string;
      channel: string;
      view_count: number;
      video_id: string;
    };

export function useItineraryStream() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [state, setState] = useState<StreamState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherDay[] | null>(null);
  const [trends, setTrends] = useState<TrendItem[] | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (state === "streaming" || state === "verifying") {
      const interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [state]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const generate = useCallback(async (brief: TripBrief, accessToken?: string | null) => {
    setStops([]);
    setError(null);
    setTripId(null);
    setShareSlug(null);
    setWeather(null);
    setTrends(null);
    setElapsedSeconds(0);
    setState("streaming");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/itinerary/generate`,
        {
          method: "POST",
          headers,
          body: JSON.stringify(brief),
          signal: controller.signal,
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

          const event = JSON.parse(raw) as Record<string, unknown>;

          if (event.type === "stop" && event.stop) {
            const parsed = StopSchema.safeParse(event.stop);
            if (parsed.success) {
              setStops((prev) => [...prev, parsed.data]);
            }
          } else if (event.type === "verifying") {
            setState("verifying");
          } else if (event.type === "verify") {
            const idx = event.index as number;
            setStops((prev) =>
              prev.map((s, i) =>
                i === idx
                  ? {
                      ...s,
                      verified: event.verified as boolean,
                      place_id: event.place_id as string | null,
                      booking_url: event.booking_url as string | null,
                      lat: event.lat as number | null,
                      lon: event.lon as number | null,
                    }
                  : s
              )
            );
          } else if (event.type === "trends") {
            setTrends(event.trends as TrendItem[]);
          } else if (event.type === "weather") {
            setWeather(event.forecasts as WeatherDay[]);
          } else if (event.type === "done") {
            if (event.trip_id) setTripId(event.trip_id as string);
            if (event.share_slug) setShareSlug(event.share_slug as string);
            setState("done");
          } else if (event.type === "error") {
            throw new Error((event.message as string) ?? "Unknown error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setState("idle");
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStops([]);
    setState("idle");
    setError(null);
    setTripId(null);
    setShareSlug(null);
    setWeather(null);
    setTrends(null);
  }, []);

  return { stops, state, error, tripId, shareSlug, weather, trends, elapsedSeconds, generate, reset, abort };
}
