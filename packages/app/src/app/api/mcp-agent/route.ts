import { NextRequest } from "next/server";
import { handleMcpRequest } from "@agentgate/mcp-server/hosted";

function extractAgentId(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

async function handle(request: NextRequest) {
  const agentId = extractAgentId(request);
  if (!agentId) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization: Bearer <agent_id>" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  try {
    return await handleMcpRequest(request as unknown as Request, agentId);
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
