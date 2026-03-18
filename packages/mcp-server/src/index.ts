import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from "viem";
import { mainnet, base, holesky, sepolia, arbitrum } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

// Tool imports
import { registerLidoTools } from "./tools/lido.js";
import { registerTreasuryTools } from "./tools/treasury.js";
import { registerDelegationTools } from "./tools/delegation.js";
import { registerEnsTools } from "./tools/ens.js";
import { registerMonitorTools } from "./tools/monitor.js";
import { registerUniswapTools } from "./tools/uniswap.js";

// ── Config ────────────────────────────────────────────────────────────
const CHAIN_MAP = { mainnet, base, holesky, sepolia, arbitrum } as const;
type ChainName = keyof typeof CHAIN_MAP;

const chainName = (process.env.CHAIN || "base") as ChainName;
const CHAIN = CHAIN_MAP[chainName] || base;

const RPC_DEFAULTS: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  8453: "https://mainnet.base.org",
  17000: "https://ethereum-holesky-rpc.publicnode.com",
  11155111: "https://rpc.sepolia.org",
  42161: "https://arb1.arbitrum.io/rpc",
};
const RPC_URL = process.env.RPC_URL || RPC_DEFAULTS[CHAIN.id] || "https://mainnet.base.org";
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const DRY_RUN = process.env.DRY_RUN === "true";

// ── Clients ───────────────────────────────────────────────────────────
const publicClient: PublicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

let walletClient: WalletClient | undefined;
if (PRIVATE_KEY) {
  const account = privateKeyToAccount(PRIVATE_KEY);
  walletClient = createWalletClient({
    account,
    chain: CHAIN,
    transport: http(RPC_URL),
  });
}

// ── Shared context for all tools ──────────────────────────────────────
export interface AgentGateContext {
  publicClient: PublicClient;
  walletClient?: WalletClient;
  dryRun: boolean;
  chain: typeof mainnet | typeof holesky;
}

const ctx: AgentGateContext = {
  publicClient,
  walletClient,
  dryRun: DRY_RUN,
  chain: CHAIN,
};

// ── MCP Server ────────────────────────────────────────────────────────
const server = new McpServer({
  name: "agentgate",
  version: "0.1.0",
  capabilities: {
    tools: {},
    resources: {},
  },
});

// ── Register tool groups ──────────────────────────────────────────────
registerLidoTools(server, ctx);
registerTreasuryTools(server, ctx);
registerDelegationTools(server, ctx);
registerEnsTools(server, ctx);
registerMonitorTools(server, ctx);
registerUniswapTools(server, ctx);

// ── Resources ─────────────────────────────────────────────────────────
server.resource("lido-contracts", "lido://contracts", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(
        {
          network: ctx.chain.name,
          stETH: ctx.chain.id === 1
            ? "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"
            : "0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034",
          wstETH: ctx.chain.id === 1
            ? "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"
            : "0x8d09a4502Cc8Cf1547aD300E066060D043f6982D",
          withdrawalQueue: ctx.chain.id === 1
            ? "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1"
            : "0xc7cc160b58F8Bb0baC94b80847E2CF2800565C50",
          lidoLocator: ctx.chain.id === 1
            ? "0xC1d0b3DE6792Bf6b4b37EccdcC24e45978Cfd2Eb"
            : "0x28FAB2059C713A7F9D8c86Db49f9bb0e96Af1ef8",
        },
        null,
        2
      ),
    },
  ],
}));

server.resource("lido-apr", "lido://apr", async (uri) => {
  try {
    const apiBase = ctx.chain.id === 1
      ? "https://eth-api.lido.fi"
      : "https://eth-api-hoodi.testnet.fi";
    const res = await fetch(`${apiBase}/v1/protocol/steth/apr/last`);
    const data = await res.json();
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (e) {
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: `Error fetching APR: ${e instanceof Error ? e.message : "unknown"}`,
        },
      ],
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AgentGate MCP server started");
  console.error(`  Chain: ${CHAIN.name}`);
  console.error(`  Dry run: ${DRY_RUN}`);
  console.error(`  Wallet: ${walletClient ? "configured" : "read-only"}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
