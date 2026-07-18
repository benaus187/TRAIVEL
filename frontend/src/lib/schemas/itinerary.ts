import { z } from "zod";

export const REASON_CODES = [
  "social momentum",
  "transport fit",
  "food fit",
  "budget fit",
  "weather alternate ready",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const StopSchema = z.object({
  day: z.number().int().optional(),
  time: z.string(),
  name: z.string(),
  description: z.string(),
  reason_codes: z.array(z.enum(REASON_CODES)),
  place_id: z.string().nullable().optional(),
  verified: z.boolean(),
  weather_alternate: z.string().nullable().optional(),
  booking_url: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
});

export type Stop = z.infer<typeof StopSchema>;

export const TripBriefSchema = z.object({
  destination: z.string().min(2, "Enter a destination"),
  days: z.coerce.number().int().min(1).max(14),
  start_date: z.string().optional(),
  interests: z.array(z.string()).min(1, "Pick at least one interest"),
  budget_usd_per_day: z.coerce.number().int().min(0).max(500),
  pace: z.enum(["relaxed", "moderate", "packed"]),
  avoid: z.array(z.string()),
});

export type TripBrief = z.infer<typeof TripBriefSchema>;
