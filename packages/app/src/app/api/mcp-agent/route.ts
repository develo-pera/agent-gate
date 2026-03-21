import { NextRequest } from "next/server";
import { handleMcpRequest, AgentRegistry } from "@agentgate/mcp-server/hosted";
import { UpstashAgentStore } from "@/lib/agent-store";

const store = new UpstashAgentStore();
const registry = new AgentRegistry(store);

function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

async function handle(request: NextRequest) {
  const bearerToken = extractBearerToken(request);
  if (!bearerToken) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization: Bearer <token>" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  try {
    return await handleMcpRequest(request as unknown as Request, bearerToken, registry);
  } catch (e) {
    console.error("MCP handler error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
