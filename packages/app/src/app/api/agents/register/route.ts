import { NextRequest, NextResponse } from "next/server";
import { AgentRegistry } from "@agentgate/mcp-server/hosted";
import { UpstashAgentStore } from "@/lib/agent-store";

const store = new UpstashAgentStore();
const registry = new AgentRegistry(store);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, signature, name } = body;

    if (!address || typeof address !== "string") {
      return NextResponse.json(
        { error: "Missing required field: address" },
        { status: 400 },
      );
    }

    // Step 1: No signature → return challenge
    if (!signature) {
      const challenge = registry.createChallenge(address);
      return NextResponse.json(challenge, { status: 200 });
    }

    // Step 2: Signature provided → verify and register
    const result = await registry.registerAgent(address, signature, name);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const status = message.includes("Invalid") || message.includes("expired") || message.includes("No pending") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
