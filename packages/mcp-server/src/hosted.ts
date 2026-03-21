/**
 * Hosted MCP Server — creates a per-request MCP server for HTTP transport.
 *
 * Used by the Next.js API route to serve MCP over HTTP with Bearer auth.
 * Each agent (hackaclaw, merkle) maps to a private key via env vars.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import type { AgentGateContext } from "./context";

import { registerLidoTools } from "./tools/lido";
import { registerTreasuryTools } from "./tools/treasury";
import { registerDelegationTools } from "./tools/delegation";
import { registerEnsTools } from "./tools/ens";
import { registerMonitorTools } from "./tools/monitor";
import { registerUniswapTools } from "./tools/uniswap";

// ── Agent key mapping ────────────────────────────────────────────────

interface AgentKeyMap {
  [agentId: string]: string; // agentId → env var name
}

const AGENT_KEY_MAP: AgentKeyMap = {
  hackaclaw: "PRIVATE_KEY",
  merkle: "MERKLE_KEY",
};

export function resolveAgentKey(agentId: string): `0x${string}` | null {
  const envVar = AGENT_KEY_MAP[agentId.toLowerCase()];
  if (!envVar) return null;
  const key = process.env[envVar];
  if (!key) return null;
  return key as `0x${string}`;
}

// ── Context factory ──────────────────────────────────────────────────

function createContext(privateKey: `0x${string}`): AgentGateContext {
  const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
  const L1_RPC_URL = process.env.L1_RPC_URL || "https://eth.llamarpc.com";

  const account = privateKeyToAccount(privateKey);

  return {
    publicClient: createPublicClient({
      chain: base,
      transport: http(RPC_URL),
    }),
    l1PublicClient: createPublicClient({
      chain: base, // L1 reads not critical for demo, keep on same RPC
      transport: http(L1_RPC_URL),
    }),
    walletClient: createWalletClient({
      account,
      chain: base,
      transport: http(RPC_URL),
    }),
    walletAccount: account,
    dryRun: false,
    chain: base,
  };
}

// ── Server factory ───────────────────────────────────────────────────

function createMcpServer(ctx: AgentGateContext, agentId: string): McpServer {
  const server = new McpServer({
    name: "agentgate",
    version: "0.1.0",
    instructions: `You are connected to AgentGate — an agent-to-agent DeFi infrastructure on Base.

IMPORTANT: Always call who_am_i FIRST before any other tool. It returns your agent ID and wallet address. Use that address whenever a tool asks for an agent_address or address parameter.

Your wallet address is server-side — you cannot find it locally. You MUST call who_am_i to discover it.

Available tool domains:
- Treasury: deposit wstETH, check vault status, authorize/revoke spenders, withdraw yield
- Lido: stake ETH, wrap stETH, check APR, balances, rewards, governance
- Delegation: create/redeem/revoke ERC-7710 delegations
- Uniswap: quote, swap, list tokens
- ENS: resolve names, reverse-resolve addresses
- Monitor: vault health reports`,
  });

  // Identity tool — lets the agent discover its own address
  server.tool(
    "who_am_i",
    "Returns the authenticated agent's ID and wallet address. Call this first if you need your own address.",
    {},
    async () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          agent_id: agentId,
          address: ctx.walletAccount!.address,
        }),
      }],
    }),
  );

  registerLidoTools(server, ctx);
  registerTreasuryTools(server, ctx);
  registerDelegationTools(server, ctx);
  registerEnsTools(server, ctx);
  registerMonitorTools(server, ctx);
  registerUniswapTools(server, ctx);

  return server;
}

// ── Request handler ──────────────────────────────────────────────────

export async function handleMcpRequest(
  request: Request,
  agentId: string,
): Promise<Response> {
  const privateKey = resolveAgentKey(agentId);
  if (!privateKey) {
    return new Response(
      JSON.stringify({ error: `Unknown agent: ${agentId}` }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const ctx = createContext(privateKey);
  const server = createMcpServer(ctx, agentId);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await server.close();
  }
}
