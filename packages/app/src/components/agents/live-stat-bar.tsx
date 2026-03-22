"use client";

import { Badge } from "@/components/ui/badge";

interface LiveStatBarProps {
  agentCount: number;
  eventCount: number;
  activeCount: number;
}

export function LiveStatBar({
  agentCount,
  eventCount,
  activeCount,
}: LiveStatBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className="text-xs font-semibold">
        {agentCount} agents
      </Badge>
      <Badge variant="secondary" className="text-xs font-semibold">
        {eventCount} events
      </Badge>
      <Badge variant="secondary" className="text-xs font-semibold">
        {activeCount > 0 ? (
          <span style={{ color: "var(--success)" }}>{activeCount}</span>
        ) : (
          activeCount
        )}{" "}
        active
      </Badge>
    </div>
  );
}
