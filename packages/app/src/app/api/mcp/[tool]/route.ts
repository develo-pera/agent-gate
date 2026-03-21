import { NextRequest, NextResponse } from "next/server";
import {
  createBridgeContext,
  toolRegistry,
} from "@agentgate/mcp-server/bridge";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> },
) {
  const { tool } = await params;
  const body = await request.json();

  const handler = toolRegistry[tool];
  if (!handler) {
    return NextResponse.json(
      { success: false, error: `Unknown tool: ${tool}` },
      { status: 404 },
    );
  }

  try {
    const walletAddress = body.wallet_address || body.agent_address;
    const dryRun = body.dry_run !== false; // default to dry-run unless explicitly false
    const ctx = createBridgeContext(walletAddress, dryRun);
    const result = await handler(body, ctx);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
