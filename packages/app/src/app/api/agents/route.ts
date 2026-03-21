import { NextResponse } from "next/server";
import {
  getRegisteredAgentIds,
  resolveAgentInfo,
} from "@agentgate/mcp-server/hosted";

export async function GET() {
  const ids = getRegisteredAgentIds();
  const agents = ids
    .map((id) => resolveAgentInfo(id))
    .filter(Boolean);

  return NextResponse.json({ agents });
}
