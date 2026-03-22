"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ActivityEvent } from "@agentgate/mcp-server/activity-log";

export function useActivitySSE(enabled: boolean = true) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const lastEventIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource("/api/activity/sse");

    es.addEventListener("open", () => {
      setIsConnected(true);
    });

    es.addEventListener("activity", (e: MessageEvent) => {
      const event: ActivityEvent = JSON.parse(e.data);
      lastEventIdRef.current = event.id;

      setEvents((prev) => {
        const existingIdx = prev.findIndex((ev) => ev.id === event.id);
        if (existingIdx !== -1) {
          // Update existing event (pending -> success/error transition)
          const updated = [...prev];
          updated[existingIdx] = event;
          return updated;
        }
        // Prepend new event (newest first)
        return [event, ...prev];
      });
    });

    es.addEventListener("error", () => {
      setIsConnected(false);
    });

    return () => {
      es.close();
    };
  }, [enabled]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { events, isConnected, clearEvents };
}
