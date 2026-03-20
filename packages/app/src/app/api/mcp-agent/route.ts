import { NextRequest } from "next/server";
import { handleMcpRequest } from "@agentgate/mcp-server/hosted";

function extractAgentId(request: NextRequest): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

export async function GET(request: NextRequest) {
  const agentId = extractAgentId(request);
  if (!agentId) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization: Bearer <agent_id>" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return handleMcpRequest(request as unknown as Request, agentId);
}

export async function POST(request: NextRequest) {
  const agentId = extractAgentId(request);
  if (!agentId) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization: Bearer <agent_id>" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return handleMcpRequest(request as unknown as Request, agentId);
}

export async function DELETE(request: NextRequest) {
  const agentId = extractAgentId(request);
  if (!agentId) {
    return new Response(
      JSON.stringify({ error: "Missing Authorization: Bearer <agent_id>" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  return handleMcpRequest(request as unknown as Request, agentId);
}
