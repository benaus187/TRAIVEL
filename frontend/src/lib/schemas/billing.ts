import { z } from "zod";

export const PlanInfoSchema = z.object({
  plan: z.enum(["free", "premium"]),
  subscription_status: z.string().nullable(),
});

export type PlanInfo = z.infer<typeof PlanInfoSchema>;

export const CheckoutResponseSchema = z.object({ url: z.string() });
