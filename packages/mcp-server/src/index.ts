import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { base, mainnet } from "viem/chains";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

// Tool imports
import { registerLidoTools } from "./tools/lido.js";
import { registerTreasuryTools } from "./tools/treasury.js";
import { registerDelegationTools } from "./tools/delegation.js";
import { registerEnsTools } from "./tools/ens.js";
import { registerMonitorTools } from "./tools/monitor.js";
import { registerUniswapTools } from "./tools/uniswap.js";

// ── Config (Base mainnet only) ───────────────────────────────────────
const CHAIN = base;
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const L1_RPC_URL = process.env.L1_RPC_URL || "https://eth.llamarpc.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
const DRY_RUN = process.env.DRY_RUN === "true";

// ── Clients ───────────────────────────────────────────────────────────
const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

// L1 client for Lido stETH reads (stETH only exists on L1 Ethereum)
const l1PublicClient = createPublicClient({
  chain: mainnet,
  transport: http(L1_RPC_URL),
});

let walletClient: ReturnType<typeof createWalletClient> | undefined;
let walletAccount: PrivateKeyAccount | undefined;
if (PRIVATE_KEY) {
  walletAccount = privateKeyToAccount(PRIVATE_KEY);
  walletClient = createWalletClient({
    account: walletAccount,
    chain: CHAIN,
    transport: http(RPC_URL),
  });
}

// ── Shared context for all tools ──────────────────────────────────────
export interface AgentGateContext {
  publicClient: any;
  l1PublicClient: any;
  walletClient?: any;
  walletAccount?: PrivateKeyAccount;
  dryRun: boolean;
  chain: Chain;
}

const ctx: AgentGateContext = {
  publicClient,
  l1PublicClient,
  walletClient,
  walletAccount,
  dryRun: DRY_RUN,
  chain: CHAIN,
};

// ── MCP Server ────────────────────────────────────────────────────────
const server = new McpServer({
  name: "agentgate",
  version: "0.1.0",

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
          base: {
            wstETH: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452",
            note: "Only wstETH is available on Base (bridged via canonical Lido bridge)",
          },
          l1_ethereum: {
            stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
            wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
            withdrawalQueue: "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1",
            note: "L1 contracts used for stETH reads, APR data, and protocol stats",
          },
        },
        null,
        2
      ),
    },
  ],
}));

server.resource("lido-apr", "lido://apr", async (uri) => {
  try {
    // APR data comes from L1 — Base wstETH earns the same rate
    const res = await fetch("https://eth-api.lido.fi/v1/protocol/steth/apr/last");
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
