import { z } from "zod";
import { StopSchema } from "./itinerary";

export const ChatOperationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), after_stop_id: z.string().nullable(), stop: StopSchema }),
  z.object({ op: z.literal("remove"), stop_id: z.string() }),
  z.object({ op: z.literal("replace"), stop_id: z.string(), stop: StopSchema }),
]);
export type ChatOperation = z.infer<typeof ChatOperationSchema>;

export const ChatMessageResponseSchema = z.object({
  reply: z.string(),
  operations: z.array(ChatOperationSchema),
});

export const ChatQuotaExceededSchema = z.object({
  error: z.literal("chat_quota_exceeded"),
  limit: z.number(),
  used: z.number(),
  reset_at: z.string(),
  message: z.string(),
});
export type ChatQuotaExceeded = z.infer<typeof ChatQuotaExceededSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  created_at: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
