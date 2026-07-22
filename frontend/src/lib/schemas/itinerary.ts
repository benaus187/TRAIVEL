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
  day: z.coerce.number().int().min(1).optional(),
  time: z.string(),
  name: z.string(),
  description: z.string(),
  // Filter out unknown reason codes instead of rejecting the whole stop
  reason_codes: z.array(z.string()).transform(
    (codes) => codes.filter((c): c is ReasonCode => (REASON_CODES as readonly string[]).includes(c))
  ),
  place_id: z.string().nullable().optional(),
  verified: z.boolean(),
  weather_alternate: z.string().nullable().optional(),
  booking_url: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lon: z.number().nullable().optional(),
  transit_note: z.string().nullable().optional(),
});

export type Stop = z.infer<typeof StopSchema>;

export const TripBriefSchema = z.object({
  destination: z.string().min(2, "Enter a destination"),
  days: z.coerce.number().int().min(1).max(14),
  start_date: z.string().optional(),
  interests: z.array(z.string()).min(1, "Pick at least one interest"),
  budget_usd_total: z.coerce.number().int().min(0).max(20000),
  currency: z.string().default("USD"),
  pace: z.enum(["relaxed", "moderate", "packed"]),
  avoid: z.array(z.string()),
  transport_mode: z.enum(["public_transport", "walking", "any"]).default("public_transport"),
  include_accommodation: z.boolean().default(false),
  flight_notes: z.string().optional(),
});

export type TripBrief = z.infer<typeof TripBriefSchema>;
