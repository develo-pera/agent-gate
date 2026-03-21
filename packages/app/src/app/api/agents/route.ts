import { NextResponse } from "next/server";
import { AgentRegistry } from "@agentgate/mcp-server/hosted";
import { UpstashAgentStore } from "@/lib/agent-store";

const store = new UpstashAgentStore();
const registry = new AgentRegistry(store);

export async function GET() {
  const agents = await registry.listAgents();
  return NextResponse.json({ agents });
}
