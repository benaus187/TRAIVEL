"use client";

import { useCallback, useState } from "react";
import type { Stop } from "@/lib/schemas/itinerary";
import {
  ChatMessage,
  ChatMessageResponseSchema,
  ChatOperation,
  ChatQuotaExceeded,
  ChatQuotaExceededSchema,
} from "@/lib/schemas/chat";

function applyOperations(stops: Stop[], operations: ChatOperation[]): Stop[] {
  let next = [...stops];
  for (const op of operations) {
    if (op.op === "remove") {
      next = next.filter((s) => s.id !== op.stop_id);
    } else if (op.op === "replace") {
      next = next.map((s) => (s.id === op.stop_id ? op.stop : s));
    } else {
      const afterIdx = op.after_stop_id ? next.findIndex((s) => s.id === op.after_stop_id) : -1;
      if (afterIdx >= 0) {
        next = [...next.slice(0, afterIdx + 1), op.stop, ...next.slice(afterIdx + 1)];
      } else {
        const dayStart = next.findIndex((s) => (s.day ?? 1) === (op.stop.day ?? 1));
        next = dayStart === -1 ? [...next, op.stop] : [...next.slice(0, dayStart), op.stop, ...next.slice(dayStart)];
      }
    }
  }
  return next;
}

// This hook does not own `stops` itself — the caller (plan page / share page)
// already owns that state, so sendMessage takes the caller's setStops and
// applies operations onto it directly.
export function useItineraryChat(itineraryId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<ChatQuotaExceeded | null>(null);

  const sendMessage = useCallback(
    async (
      text: string,
      getAccessToken: () => Promise<string | null>,
      setStops: (updater: (prev: Stop[]) => Stop[]) => void
    ) => {
      if (!itineraryId || !text.trim()) return;
      setSending(true);
      setError(null);
      setQuotaError(null);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", content: text, created_at: new Date().toISOString() },
      ]);
      try {
        const accessToken = await getAccessToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/itinerary/${itineraryId}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ message: text }),
        });
        if (!res.ok) {
          if (res.status === 429) {
            const body = await res.json().catch(() => null);
            const parsed = ChatQuotaExceededSchema.safeParse(body?.detail);
            if (parsed.success) {
              setQuotaError(parsed.data);
              setError(parsed.data.message);
              return;
            }
          }
          throw new Error(`Server error: ${res.status}`);
        }
        const parsed = ChatMessageResponseSchema.safeParse(await res.json());
        if (!parsed.success) throw new Error("Invalid response");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: parsed.data.reply,
            created_at: new Date().toISOString(),
          },
        ]);
        setStops((prev) => applyOperations(prev, parsed.data.operations));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setSending(false);
      }
    },
    [itineraryId]
  );

  return { messages, setMessages, sending, error, quotaError, sendMessage };
}
