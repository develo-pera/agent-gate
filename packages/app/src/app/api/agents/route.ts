export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { AgentRegistry } from "@agentgate/mcp-server/hosted";
import { getActivityLog } from "@agentgate/mcp-server/activity-log";
import type { ActivityEvent } from "@agentgate/mcp-server/activity-log";
import { UpstashAgentStore } from "@/lib/agent-store";

const store = new UpstashAgentStore();
const registry = new AgentRegistry(store);

function deriveStatus(
  agentId: string,
  events: ActivityEvent[],
): { status: "active" | "idle" | "registered"; lastActivityAt: number | null } {
  const agentEvents = events.filter((e) => e.agentId === agentId);
  if (agentEvents.length === 0) {
    return { status: "registered", lastActivityAt: null };
  }
  const hasPending = agentEvents.some((e) => e.status === "pending");
  const lastActivityAt = Math.max(...agentEvents.map((e) => e.timestamp));
  return {
    status: hasPending ? "active" : "idle",
    lastActivityAt,
  };
}

export async function GET() {
  const agents = await registry.listAgents();
  const events = getActivityLog().getAll();

  const enriched = agents.map((agent) => ({
    ...agent,
    ...deriveStatus(agent.agent_id, events),
  }));

  return NextResponse.json({ agents: enriched });
}
