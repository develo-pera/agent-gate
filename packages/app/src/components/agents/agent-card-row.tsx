"use client";

import { AgentCard } from "./agent-card";

interface AgentCardRowProps {
  agents: Array<{
    agent_id: string;
    name: string;
    address: string;
    status: "active" | "idle" | "registered";
    lastAction?: string;
  }>;
  selectedAgent: string | null;
  onSelect: (agentId: string | null) => void;
}

export function AgentCardRow({
  agents,
  selectedAgent,
  onSelect,
}: AgentCardRowProps) {
  return (
    <div className="flex flex-wrap gap-4">
      {agents.map((agent) => (
        <AgentCard
          key={agent.agent_id}
          agent={agent}
          isSelected={agent.agent_id === selectedAgent}
          onClick={() =>
            onSelect(agent.agent_id === selectedAgent ? null : agent.agent_id)
          }
        />
      ))}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`min-w-[80px] rounded-xl border px-4 py-3 text-sm font-semibold cursor-pointer transition-colors ${
          selectedAgent === null
            ? "bg-primary/10 text-primary border-primary/30"
            : "border-border text-muted-foreground hover:bg-muted/50"
        }`}
      >
        All
      </button>
    </div>
  );
}
