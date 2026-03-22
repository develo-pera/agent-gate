"use client";

import { Card } from "@/components/ui/card";
import { AddressDisplay } from "@/components/shared/address-display";
import { statusToColor } from "@/lib/sprite-utils";
import { cn } from "@/lib/utils";

export interface AgentCardProps {
  agent: {
    agent_id: string;
    name: string;
    address: string;
    type?: string;
    status: "active" | "idle" | "registered";
    lastAction?: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

export function AgentCard({ agent, isSelected, onClick }: AgentCardProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-full px-3 py-2 gap-0.5 cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected && "ring-1 ring-primary/50"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            agent.status === "active" && "animate-pulse"
          )}
          style={{ backgroundColor: statusToColor(agent.status) }}
          aria-label={`Status: ${agent.status}`}
        />
        <span className="text-sm font-semibold flex-1 truncate">
          {agent.name}
        </span>
      </div>
      <AddressDisplay
        address={agent.address}
        className="text-xs font-mono text-muted-foreground text-left leading-tight"
      />
      <p className="text-xs text-muted-foreground leading-tight">
        {agent.lastAction ? `Last: ${agent.lastAction}` : "\u00A0"}
      </p>
    </Card>
  );
}
