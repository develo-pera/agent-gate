/**
 * MCP Tool Bridge — standalone tool handlers callable from HTTP routes.
 *
 * This module re-exports tool logic WITHOUT importing @modelcontextprotocol/sdk.
 * It is designed to be imported by the Next.js API route at /api/mcp/[tool].
 */

import {
  createPublicClient,
  http,
  formatEther,
  parseEther,
  type Address,
} from "viem";
import { base, mainnet } from "viem/chains";

// ── Bridge Context ──────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BridgeContext {
  publicClient: any;
  l1PublicClient: any;
  walletAddress?: string;
  dryRun: boolean;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function createBridgeContext(walletAddress?: string): BridgeContext {
  return {
    publicClient: createPublicClient({
      chain: base,
      transport: http(process.env.RPC_URL || "https://mainnet.base.org"),
    }),
    l1PublicClient: createPublicClient({
      chain: mainnet,
      transport: http(process.env.L1_RPC_URL || "https://eth.llamarpc.com"),
    }),
    walletAddress,
    dryRun: true, // Dashboard bridge is always read-only or dry-run
  };
}

// ── Tool Handler Type ───────────────────────────────────────────────

export type ToolHandler = (
  params: Record<string, unknown>,
  ctx: BridgeContext,
) => Promise<Record<string, unknown>>;

// ── Treasury ABI (inline copy — no imports from tool files) ─────────

const TREASURY_ABI = [
  {
    name: "getVaultStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "depositedPrincipal", type: "uint256" },
      { name: "availableYield", type: "uint256" },
      { name: "totalBalance", type: "uint256" },
      { name: "hasVault", type: "bool" },
    ],
  },
  {
    name: "getCurrentRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getSpenderConfig",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agent", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "authorized", type: "bool" },
      { name: "yieldOnly", type: "bool" },
      { name: "maxPerTx", type: "uint256" },
      { name: "spentInWindow", type: "uint256" },
      { name: "windowStart", type: "uint40" },
      { name: "windowDuration", type: "uint40" },
      { name: "windowAllowance", type: "uint256" },
    ],
  },
  {
    name: "isAuthorizedSpender",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agent", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// ── Treasury Address ────────────────────────────────────────────────

const TREASURY_ADDRESS = (process.env.TREASURY_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as Address;

// ── Read-only Tool Handlers ─────────────────────────────────────────

const treasuryStatus: ToolHandler = async (params, ctx) => {
  const agentAddress = (params.agent_address ||
    ctx.walletAddress ||
    TREASURY_ADDRESS) as Address;

  if (TREASURY_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return { error: "TREASURY_ADDRESS not configured" };
  }

  const [vaultResult, rateResult] = await Promise.all([
    ctx.publicClient.readContract({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: "getVaultStatus",
      args: [agentAddress],
    }),
    ctx.publicClient.readContract({
      address: TREASURY_ADDRESS,
      abi: TREASURY_ABI,
      functionName: "getCurrentRate",
    }),
  ]);

  const [depositedPrincipal, availableYield, totalBalance, hasVault] =
    vaultResult;

  return {
    agent: agentAddress,
    has_vault: hasVault,
    principal_wsteth: formatEther(depositedPrincipal),
    available_yield_wsteth: formatEther(availableYield),
    total_balance_wsteth: formatEther(totalBalance),
    yield_percentage:
      depositedPrincipal > BigInt(0)
        ? (
            (Number(availableYield) / Number(depositedPrincipal)) *
            100
          ).toFixed(4) + "%"
        : "0%",
    chainlink_rate: formatEther(rateResult),
    rate_meaning: `1 wstETH = ${formatEther(rateResult)} stETH`,
    contract: TREASURY_ADDRESS,
    network: "Base",
  };
};

const treasuryGetRate: ToolHandler = async (_params, ctx) => {
  const rate = await ctx.publicClient.readContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getCurrentRate",
  });

  return {
    chainlink_rate: formatEther(rate),
    meaning: `1 wstETH = ${formatEther(rate)} stETH`,
    oracle:
      "Chainlink wstETH/stETH on Base (0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061)",
    note: "This rate increases over time as Lido staking yield accrues. Yield in the treasury = (current_rate - deposit_rate) * principal.",
  };
};

const treasuryGetSpenderConfig: ToolHandler = async (params, ctx) => {
  const agentAddress = params.agent_address as Address;
  const spenderAddress = params.spender_address as Address;

  if (!agentAddress || !spenderAddress) {
    return { error: "agent_address and spender_address are required" };
  }

  const result = await ctx.publicClient.readContract({
    address: TREASURY_ADDRESS,
    abi: TREASURY_ABI,
    functionName: "getSpenderConfig",
    args: [agentAddress, spenderAddress],
  });

  const [
    authorized,
    yieldOnly,
    maxPerTx,
    spentInWindow,
    windowStart,
    windowDuration,
    windowAllowance,
  ] = result;
  const maxPerTxBig = BigInt(maxPerTx);
  const spentBig = BigInt(spentInWindow);
  const winDurBig = BigInt(windowDuration);
  const winAllowBig = BigInt(windowAllowance);

  return {
    agent: agentAddress,
    spender: spenderAddress,
    authorized,
    yield_only: yieldOnly,
    max_per_tx:
      maxPerTxBig > BigInt(0) ? formatEther(maxPerTxBig) + " wstETH" : "unlimited",
    window:
      winDurBig > BigInt(0)
        ? {
            duration_seconds: Number(windowDuration),
            allowance: formatEther(winAllowBig) + " wstETH",
            spent_in_current_window: formatEther(spentBig) + " wstETH",
            remaining:
              winAllowBig > spentBig
                ? formatEther(winAllowBig - spentBig) + " wstETH"
                : "0 wstETH",
            window_started: new Date(
              Number(windowStart) * 1000,
            ).toISOString(),
          }
        : "no time window",
    contract: TREASURY_ADDRESS,
  };
};

// ── Dry-run Stubs for Write Operations ──────────────────────────────

const dryRunStub =
  (action: string): ToolHandler =>
  async (params) => ({
    mode: "dry_run",
    action,
    ...params,
  });

// ── Tool Registry ───────────────────────────────────────────────────

export const toolRegistry: Record<string, ToolHandler> = {
  // Read-only tools (full implementation)
  treasury_status: treasuryStatus,
  treasury_get_rate: treasuryGetRate,
  treasury_get_spender_config: treasuryGetSpenderConfig,

  // Write tools (dry-run stubs — dashboard bridge is read-only)
  treasury_deposit: dryRunStub("treasury_deposit"),
  treasury_withdraw_yield: dryRunStub("treasury_withdraw_yield"),
  treasury_withdraw_yield_for: dryRunStub("treasury_withdraw_yield_for"),
  treasury_authorize_spender: dryRunStub("treasury_authorize_spender"),
  treasury_revoke_spender: dryRunStub("treasury_revoke_spender"),
  treasury_set_recipient_whitelist: dryRunStub(
    "treasury_set_recipient_whitelist",
  ),
  treasury_set_allowed_recipient: dryRunStub("treasury_set_allowed_recipient"),

  // Delegation tools (dry-run stubs)
  delegate_create: dryRunStub("delegate_create"),
  delegate_redeem: dryRunStub("delegate_redeem"),
  delegate_revoke: dryRunStub("delegate_revoke"),
  delegate_list: async (_params, _ctx) => ({
    delegations: [],
    note: "Delegation list retrieved from bridge (demo mode returns empty — client manages session state)",
  }),
};

// ── Utility ─────────────────────────────────────────────────────────

export function getAvailableTools(): string[] {
  return Object.keys(toolRegistry);
}
