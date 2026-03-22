"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { SpriteScene } from "@/components/sprites/SpriteScene";
import { AgentCardRow } from "@/components/agents/agent-card-row";
import { ActivityFeed } from "@/components/agents/activity-feed";
import { LiveStatBar } from "@/components/agents/live-stat-bar";
import { DemoModeButton } from "@/components/agents/demo-mode-button";
import { Badge } from "@/components/ui/badge";
import { useAgents } from "@/lib/hooks/use-agents";
import { useActivitySSE } from "@/lib/hooks/use-activity-sse";
import { useDemoMode } from "@/lib/hooks/use-demo-mode";
import type { ActivityEvent } from "@agentgate/mcp-server/activity-log";

export default function LiveAgentsPage() {
  const [filterAgent, setFilterAgent] = useState<string | null>(null);

  const { agents, isLoading } = useAgents();
  const { events: sseEvents, isConnected } = useActivitySSE();
  const { demoEvents, isRunning: isDemoRunning, startDemo, stopDemo } = useDemoMode(agents ?? []);

  // Merge SSE events and demo events, deduplicating by id
  const allEvents = useMemo(() => {
    const merged = [...sseEvents, ...demoEvents];
    const seen = new Map<number, ActivityEvent>();
    for (const event of merged) {
      const existing = seen.get(event.id);
      if (!existing || (existing.status === "pending" && event.status !== "pending")) {
        seen.set(event.id, event);
      }
    }
    return Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [sseEvents, demoEvents]);

  // Track new event IDs for glow effect
  const prevCountRef = useRef(0);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (allEvents.length > prevCountRef.current) {
      const newOnes = allEvents.slice(0, allEvents.length - prevCountRef.current).map(e => e.id);
      setNewIds(new Set(newOnes));
      const timer = setTimeout(() => setNewIds(new Set()), 2000);
      prevCountRef.current = allEvents.length;
      return () => clearTimeout(timer);
    }
  }, [allEvents]);

  // Derive agent statuses from merged events (client-side)
  const enrichedAgents = useMemo(() => {
    if (!agents) return [];
    return agents.map((agent) => {
      const agentEvents = allEvents.filter((e) => e.agentId === agent.agent_id);
      const hasActivity = agentEvents.length > 0;
      const hasPending = agentEvents.some((e) => e.status === "pending");
      const lastEvent = agentEvents[0];
      return {
        ...agent,
        status: hasPending ? "active" as const : hasActivity ? "idle" as const : "registered" as const,
        lastAction: lastEvent?.toolName,
      };
    });
  }, [agents, allEvents]);

  // Filter events by selected agent
  const filteredEvents = useMemo(() => {
    if (!filterAgent) return allEvents;
    return allEvents.filter((e) => e.agentId === filterAgent);
  }, [allEvents, filterAgent]);

  // Stat counts
  const agentCount = enrichedAgents.length;
  const eventCount = allEvents.length;
  const activeCount = enrichedAgents.filter((a) => a.status === "active").length;

  // Map to SpriteScene agent shape
  const spriteAgents = useMemo(() =>
    enrichedAgents.map((a) => ({
      name: a.name,
      address: a.address,
      status: a.status,
      action: a.lastAction,
    })),
    [enrichedAgents]
  );

  const hasEvents = allEvents.length > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Header row */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">Live Agents</h1>
        <LiveStatBar agentCount={agentCount} eventCount={eventCount} activeCount={activeCount} />
        {isDemoRunning && (
          <Badge
            variant="secondary"
            className="animate-in fade-in duration-150 cursor-pointer hover:bg-destructive/20"
            onClick={stopDemo}
          >
            Demo Mode &times;
          </Badge>
        )}
      </div>

      {/* Sprite scene banner */}
      <SpriteScene agents={spriteAgents} className="rounded-lg bg-secondary" />

      {/* Agent cards row */}
      {enrichedAgents.length > 0 && (
        <AgentCardRow
          agents={enrichedAgents}
          selectedAgent={filterAgent}
          onSelect={setFilterAgent}
        />
      )}

      {/* Activity feed or empty state */}
      {!hasEvents && !isDemoRunning ? (
        <DemoModeButton onStart={startDemo} isRunning={isDemoRunning} hasEvents={hasEvents} />
      ) : (
        <ActivityFeed
          events={filteredEvents}
          newEventIds={newIds}
          emptyMessage={filterAgent ? "No events from this agent yet." : undefined}
        />
      )}
    </div>
  );
}
