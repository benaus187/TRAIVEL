"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useItineraryChat } from "@/hooks/use-itinerary-chat";
import type { Stop } from "@/lib/schemas/itinerary";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ChatUpsell() {
  return (
    <div className="border border-dashed border-border rounded-md px-4 py-3 text-center space-y-1">
      <p className="font-mono text-xs text-muted-foreground">💬 Chat to add, remove, or replace stops</p>
      <a href="/pricing" className="font-mono text-xs underline">
        Premium feature — Upgrade to Premium →
      </a>
    </div>
  );
}

export function ChatPanel({
  itineraryId,
  setStops,
  getAccessToken,
}: {
  itineraryId: string;
  setStops: (updater: (prev: Stop[]) => Stop[]) => void;
  getAccessToken: () => Promise<string | null>;
}) {
  const { messages, setMessages, sending, error, quotaError, sendMessage } = useItineraryChat(itineraryId);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("chat_messages")
      .select("id,role,content,created_at")
      .eq("itinerary_id", itineraryId)
      .order("created_at")
      .then(({ data }) => {
        if (data && data.length) setMessages(data as typeof messages);
      });
  }, [itineraryId, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await sendMessage(text, getAccessToken, setStops);
  }

  return (
    <Card className="shadow-none">
      <CardContent className="py-4 px-5 space-y-3">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Chat to refine this itinerary
        </p>

        <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Try &quot;add a coffee stop after breakfast&quot; or &quot;I booked a hotel near District 1, keep
              stops close to it&quot;.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-md px-3 py-1.5 text-sm ${
                  m.role === "user" ? "bg-vermilion text-background" : "bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && <p className="font-mono text-xs text-muted-foreground animate-pulse">Thinking…</p>}
          <div ref={bottomRef} />
        </div>

        {quotaError ? (
          <p className="text-xs text-destructive font-mono">{quotaError.message}</p>
        ) : error ? (
          <p className="text-xs text-destructive font-mono">{error}</p>
        ) : null}

        <div className="flex gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask for a change…"
            className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <Button type="button" size="sm" onClick={handleSend} disabled={sending || !input.trim()}>
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
