/**
 * Hosted MCP Server — creates a per-request MCP server for HTTP transport.
 *
 * Supports two agent types:
 *  - First-party (hackaclaw, merkle): server holds private key, signs + submits txs
 *  - Third-party (registered): server NEVER touches their key, returns unsigned txs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import type { AgentGateContext } from "./context";
import { AgentRegistry, InMemoryStore } from "./registry";
import type { RegisteredAgent } from "./registry";

import { registerLidoTools } from "./tools/lido";
import { registerTreasuryTools } from "./tools/treasury";
import { registerDelegationTools } from "./tools/delegation";
import { registerEnsTools } from "./tools/ens";
import { registerMonitorTools } from "./tools/monitor";
import { registerUniswapTools } from "./tools/uniswap";
import { registerTradingTools } from "./tools/trading";

// ── Default registry (in-memory, for local dev / stdio) ─────────────

const defaultRegistry = new AgentRegistry(new InMemoryStore());

// ── Context factories ───────────────────────────────────────────────

function createFirstPartyContext(privateKey: `0x${string}`): AgentGateContext {
  const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
  const L1_RPC_URL = process.env.L1_RPC_URL || "https://eth.llamarpc.com";
  const account = privateKeyToAccount(privateKey);

  return {
    publicClient: createPublicClient({ chain: base, transport: http(RPC_URL) }),
    l1PublicClient: createPublicClient({ chain: base, transport: http(L1_RPC_URL) }),
    walletClient: createWalletClient({ account, chain: base, transport: http(RPC_URL) }),
    walletAccount: account,
    agentAddress: account.address,
    agentType: "first-party",
    dryRun: false,
    chain: base,
  };
}

function createThirdPartyContext(agentAddress: `0x${string}`): AgentGateContext {
  const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
  const L1_RPC_URL = process.env.L1_RPC_URL || "https://eth.llamarpc.com";

  return {
    publicClient: createPublicClient({ chain: base, transport: http(RPC_URL) }),
    l1PublicClient: createPublicClient({ chain: base, transport: http(L1_RPC_URL) }),
    // No walletClient, no walletAccount — agent signs externally
    agentAddress,
    agentType: "third-party",
    dryRun: false,
    chain: base,
  };
}

// ── Server factory ───────────────────────────────────────────────────

function createMcpServer(
  ctx: AgentGateContext,
  agentId: string,
  registry: AgentRegistry,
): McpServer {
  const server = new McpServer({
    name: "agentgate",
    version: "0.1.0",
  });

  // Identity tool
  server.tool(
    "who_am_i",
    "IMPORTANT: Call this FIRST before any other tool. Returns your agent ID, wallet address, and access mode. Use the returned address whenever a tool asks for agent_address or address.",
    {},
    async () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          agent_id: agentId,
          address: ctx.agentAddress,
          mode: ctx.agentType,
          capabilities: ctx.agentType === "first-party"
            ? "Full: read + write (server signs)"
            : "Hybrid: read + unsigned tx (you sign externally)",
        }),
      }],
    }),
  );

  // Step 1: Get a challenge message to sign (proves address ownership)
  server.tool(
    "register_challenge",
    "Step 1 of registration: Get a challenge message to sign with your wallet. " +
    "Sign the returned message with your private key, then call register_agent with the signature.",
    {
      address: z.string().describe("Your Ethereum wallet address (0x...)"),
    },
    async ({ address }) => {
      try {
        const { message, nonce } = registry.createChallenge(address);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              message,
              nonce,
              instructions: [
                "Sign the 'message' field with your wallet's private key.",
                "Then call register_agent with your address and the signature.",
                "The challenge expires in 5 minutes.",
              ],
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: ${e instanceof Error ? e.message : "Challenge failed"}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Step 2: Verify signature and complete registration
  server.tool(
    "register_agent",
    "Step 2 of registration: Submit your signed challenge to prove address ownership and get an API key. " +
    "Call register_challenge first to get the message to sign. " +
    "The server NEVER stores private keys. Returns an API key for MCP access.",
    {
      address: z.string().describe("Your Ethereum wallet address (0x...)"),
      signature: z.string().describe("Signature of the challenge message (0x...)"),
      name: z.string().optional().describe("Optional human-readable name for the agent"),
    },
    async ({ address, signature, name }) => {
      try {
        const result = await registry.registerAgent(address, signature, name);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              instructions: [
                "Save the api_key securely — it cannot be recovered.",
                `Use 'Authorization: Bearer ${result.api_key}' to authenticate MCP requests.`,
                "Read tools work immediately with your address.",
                "Write tools return unsigned transactions for you to sign externally.",
              ],
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error: ${e instanceof Error ? e.message : "Registration failed"}`,
          }],
          isError: true,
        };
      }
    },
  );

  // Submit tx hash — third-party agents report back after signing externally
  server.tool(
    "submit_tx_hash",
    "Report a transaction hash after signing and submitting an unsigned transaction externally. " +
    "Returns the transaction receipt with status and block number.",
    {
      tx_hash: z.string().describe("Transaction hash (0x...)"),
    },
    async ({ tx_hash }) => {
      try {
        const receipt = await ctx.publicClient.waitForTransactionReceipt({
          hash: tx_hash as `0x${string}`,
        });
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              tx_hash,
              status: receipt.status,
              block_number: receipt.blockNumber.toString(),
              gas_used: receipt.gasUsed.toString(),
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error waiting for receipt: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    },
  );

  registerLidoTools(server, ctx);
  registerTreasuryTools(server, ctx);
  registerDelegationTools(server, ctx);
  registerEnsTools(server, ctx);
  registerMonitorTools(server, ctx);
  registerUniswapTools(server, ctx);
  registerTradingTools(server, ctx);

  return server;
}

// ── Request handler ──────────────────────────────────────────────────

export async function handleMcpRequest(
  request: Request,
  bearerToken: string,
  registry?: AgentRegistry,
): Promise<Response> {
  const reg = registry ?? defaultRegistry;
  const agent = await reg.resolveBearer(bearerToken);

  if (!agent) {
    return new Response(
      JSON.stringify({ error: "Unknown or invalid bearer token" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  let ctx: AgentGateContext;
  if (agent.type === "first-party") {
    const privateKey = reg.resolveFirstPartyKey(agent.name);
    if (!privateKey) {
      return new Response(
        JSON.stringify({ error: `Missing env var for agent: ${agent.name}` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    ctx = createFirstPartyContext(privateKey);
  } else {
    ctx = createThirdPartyContext(agent.address);
  }

  const server = createMcpServer(ctx, agent.name, reg);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
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

// Re-export for external use
export { AgentRegistry, InMemoryStore } from "./registry";
export type { AgentStore, RegisteredAgent } from "./registry";
