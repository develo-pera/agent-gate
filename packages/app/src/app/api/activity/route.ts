export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getActivityLog } from "@agentgate/mcp-server/activity-log";

export async function GET(req: NextRequest) {
  const log = getActivityLog();
  const agentFilter = req.nextUrl.searchParams.get("agent");

  let events = log.getAll();

  if (agentFilter) {
    events = events.filter((e) => e.agentId === agentFilter);
  }

  // Newest-first (reverse chronological)
  events.reverse();

  return NextResponse.json({ events });
}
