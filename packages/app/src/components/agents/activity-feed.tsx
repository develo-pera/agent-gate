"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { ActivityEvent } from "@agentgate/mcp-server/activity-log";
import { ActivityRow } from "./activity-row";

interface ActivityFeedProps {
  events: ActivityEvent[];
  newEventIds?: Set<number>;
  emptyMessage?: string;
}

export function ActivityFeed({
  events,
  newEventIds,
  emptyMessage,
}: ActivityFeedProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(events.length);

  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const scrolled = feedRef.current.scrollTop > 48;
    setUserScrolled(scrolled);
    if (!scrolled) {
      setNewCount(0);
    }
  }, []);

  useEffect(() => {
    if (events.length <= prevLengthRef.current) {
      prevLengthRef.current = events.length;
      return;
    }

    const added = events.length - prevLengthRef.current;
    prevLengthRef.current = events.length;

    if (!userScrolled) {
      feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setNewCount((prev) => prev + added);
    }
  }, [events.length, userScrolled]);

  function scrollToTop() {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setUserScrolled(false);
    setNewCount(0);
  }

  if (events.length === 0) {
    return (
      <div className="max-h-[400px] overflow-y-auto rounded-lg bg-card">
        <div className="text-muted-foreground text-sm text-center py-12">
          {emptyMessage || "No activity yet"}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={feedRef}
      onScroll={handleScroll}
      role="log"
      aria-label="Activity timeline"
      className="max-h-[400px] overflow-y-auto rounded-lg bg-card"
    >
      {newCount > 0 && userScrolled && (
        <button
          type="button"
          onClick={scrollToTop}
          role="status"
          aria-live="polite"
          className="sticky top-0 z-10 bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold rounded-full cursor-pointer mx-auto block w-fit my-1"
        >
          {newCount} new events
        </button>
      )}
      {events.map((event) => (
        <ActivityRow
          key={event.id}
          event={event}
          isNew={newEventIds?.has(event.id)}
          isExpanded={expandedId === event.id}
          onToggle={() =>
            setExpandedId(expandedId === event.id ? null : event.id)
          }
        />
      ))}
    </div>
  );
}
