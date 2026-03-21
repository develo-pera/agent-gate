/**
 * MCP Tool Bridge — standalone tool handlers callable from HTTP routes.
 *
 * This module re-exports tool logic WITHOUT importing @modelcontextprotocol/sdk.
 * It is designed to be imported by the Next.js API route at /api/mcp/[tool].
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  encodeFunctionData,
  type Address,
} from "viem";
import { base, mainnet } from "viem/chains";
import { normalize } from "viem/ens";

// ── Bridge Context ──────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface BridgeContext {
  publicClient: any;
  l1PublicClient: any;
  walletAddress?: string;
  dryRun: boolean;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function createBridgeContext(walletAddress?: string, dryRun = true): BridgeContext {
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
    dryRun,
  };
}

// ── Tool Handler Type ───────────────────────────────────────────────

export type ToolHandler = (
  params: Record<string, unknown>,
  ctx: BridgeContext,
) => Promise<Record<string, unknown>>;

// ── ERC20 ABI (for balance checks) ──────────────────────────────────

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const STETH_ADDRESS =
  "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" as Address;
const BASE_WSTETH_ADDRESS =
  "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as Address;

// ── Treasury ABI (inline copy — no imports from tool files) ─────────

const TREASURY_ABI = [
  // ── Write functions ─────────────────────────────────────────────
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdrawYield",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "wstETHAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "withdrawYieldFor",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "recipient", type: "address" },
      { name: "wstETHAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "authorizeSpender",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "yieldOnly", type: "bool" },
      { name: "maxPerTx", type: "uint256" },
      { name: "windowDuration", type: "uint40" },
      { name: "windowAllowance", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "revokeSpender",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }],
    outputs: [],
  },
  {
    name: "setRecipientWhitelist",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "enabled", type: "bool" }],
    outputs: [],
  },
  {
    name: "setAllowedRecipient",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  // ── Read functions ──────────────────────────────────────────────
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

// ── Anvil Impersonation Helper ──────────────────────────────────────
// Executes a transaction on the Anvil fork by impersonating the user's
// address. Avoids MetaMask RPC mismatch (MetaMask uses real Base RPC,
// not the fork). Safe because this is a test environment.

const rpcUrl = process.env.RPC_URL || "https://mainnet.base.org";

async function impersonateAndSend(
  ctx: BridgeContext,
  to: Address,
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[],
  tool: string,
) {
  const sender = ctx.walletAddress as Address;
  const data = encodeFunctionData({ abi: abi as any, functionName, args });

  await (ctx.publicClient as any).request({ method: "anvil_impersonateAccount", params: [sender] });
  try {
    const walletClient = createWalletClient({ chain: base, transport: http(rpcUrl) });
    const hash = await walletClient.sendTransaction({
      account: sender,
      to,
      data,
    });
    const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
    return {
      mode: "executed" as const,
      action: tool,
      tx_hash: hash,
      status: receipt.status,
      block_number: receipt.blockNumber.toString(),
    };
  } finally {
    await (ctx.publicClient as any).request({ method: "anvil_stopImpersonatingAccount", params: [sender] });
  }
}

// ── Treasury Write Handlers (dry-run or impersonate+execute) ────────

const treasuryDeposit: ToolHandler = async (params, ctx) => {
  if (ctx.dryRun) return { mode: "dry_run", action: "treasury_deposit", ...params };
  const amount = parseEther(String(params.amount || params.amount_wsteth || "0"));
  return impersonateAndSend(ctx, TREASURY_ADDRESS, TREASURY_ABI, "deposit", [amount], "treasury_deposit");
};

const treasuryWithdrawYield: ToolHandler = async (params, ctx) => {
  if (ctx.dryRun) return { mode: "dry_run", action: "treasury_withdraw_yield", ...params };
  const recipient = (params.recipient || ctx.walletAddress) as Address;
  const amount = parseEther(String(params.amount || params.amount_wsteth || "0"));
  return impersonateAndSend(ctx, TREASURY_ADDRESS, TREASURY_ABI, "withdrawYield", [recipient, amount], "treasury_withdraw_yield");
};

const treasuryWithdrawYieldFor: ToolHandler = async (params, ctx) => {
  if (ctx.dryRun) return { mode: "dry_run", action: "treasury_withdraw_yield_for", ...params };
  const agent = params.agent_address as Address;
  const recipient = (params.recipient || ctx.walletAddress) as Address;
  const amount = parseEther(String(params.amount || params.amount_wsteth || "0"));
  return impersonateAndSend(ctx, TREASURY_ADDRESS, TREASURY_ABI, "withdrawYieldFor", [agent, recipient, amount], "treasury_withdraw_yield_for");
};

const treasuryAuthorizeSpender: ToolHandler = async (params, ctx) => {
  if (ctx.dryRun) return { mode: "dry_run", action: "treasury_authorize_spender", ...params };
  const spender = params.spender as Address;
  const yieldOnly = params.yield_only ?? true;
  const maxPerTx = params.max_per_tx ? parseEther(String(params.max_per_tx)) : 0n;
  const windowDuration = BigInt(Number(params.window_duration_seconds) || 0);
  const windowAllowance = params.window_allowance ? parseEther(String(params.window_allowance)) : 0n;
  return impersonateAndSend(ctx, TREASURY_ADDRESS, TREASURY_ABI, "authorizeSpender", [spender, yieldOnly, maxPerTx, windowDuration, windowAllowance], "treasury_authorize_spender");
};

const treasuryRevokeSpender: ToolHandler = async (params, ctx) => {
  if (ctx.dryRun) return { mode: "dry_run", action: "treasury_revoke_spender", ...params };
  const spender = params.spender as Address;
  return impersonateAndSend(ctx, TREASURY_ADDRESS, TREASURY_ABI, "revokeSpender", [spender], "treasury_revoke_spender");
};

const treasurySetRecipientWhitelist: ToolHandler = async (params, ctx) => {
  if (ctx.dryRun) return { mode: "dry_run", action: "treasury_set_recipient_whitelist", ...params };
  const enabled = Boolean(params.enabled);
  return impersonateAndSend(ctx, TREASURY_ADDRESS, TREASURY_ABI, "setRecipientWhitelist", [enabled], "treasury_set_recipient_whitelist");
};

const treasurySetAllowedRecipient: ToolHandler = async (params, ctx) => {
  if (ctx.dryRun) return { mode: "dry_run", action: "treasury_set_allowed_recipient", ...params };
  const recipient = params.recipient as Address;
  const allowed = Boolean(params.allowed);
  return impersonateAndSend(ctx, TREASURY_ADDRESS, TREASURY_ABI, "setAllowedRecipient", [recipient, allowed], "treasury_set_allowed_recipient");
};

// ── Tool Registry ───────────────────────────────────────────────────

export const toolRegistry: Record<string, ToolHandler> = {
  // Read-only tools (full implementation)
  treasury_status: treasuryStatus,
  treasury_get_rate: treasuryGetRate,
  treasury_get_spender_config: treasuryGetSpenderConfig,

  // Treasury write tools (dry-run or unsigned tx for wallet signing)
  treasury_deposit: treasuryDeposit,
  treasury_withdraw_yield: treasuryWithdrawYield,
  treasury_withdraw_yield_for: treasuryWithdrawYieldFor,
  treasury_authorize_spender: treasuryAuthorizeSpender,
  treasury_revoke_spender: treasuryRevokeSpender,
  treasury_set_recipient_whitelist: treasurySetRecipientWhitelist,
  treasury_set_allowed_recipient: treasurySetAllowedRecipient,

  // Delegation tools (dry-run stubs — no dashboard write support yet)
  delegate_create: dryRunStub("delegate_create"),
  delegate_create_account: dryRunStub("delegate_create_account"),
  delegate_redeem: dryRunStub("delegate_redeem"),
  delegate_revoke: dryRunStub("delegate_revoke"),
  delegate_list: async (_params, _ctx) => ({
    delegations: [],
    note: "Delegation list retrieved from bridge (demo mode returns empty — client manages session state)",
  }),

  // ── Lido read-only tools (real implementations) ──────────────────

  lido_get_apr: async (_params, _ctx) => {
    try {
      const res = await fetch(
        "https://eth-api.lido.fi/v1/protocol/steth/apr/last",
      );
      const data = await res.json();
      return { apr: data, source: "Lido API", network: "Ethereum L1" };
    } catch (e) {
      return {
        error: `Failed to fetch APR: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  },

  lido_balance: async (params, ctx) => {
    const address = params.address as Address;
    try {
      const [l1Steth, baseWsteth] = await Promise.all([
        ctx.l1PublicClient.readContract({
          address: STETH_ADDRESS,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
        ctx.publicClient.readContract({
          address: BASE_WSTETH_ADDRESS,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [address],
        }),
      ]);
      return {
        address,
        l1_steth: formatEther(l1Steth),
        base_wsteth: formatEther(baseWsteth),
      };
    } catch (e) {
      return {
        error: `Failed to fetch balances: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  },

  lido_rewards: async (params, _ctx) => {
    try {
      const address = params.address as string;
      const limit = (params.limit as number) || 10;
      const res = await fetch(
        `https://eth-api.lido.fi/v1/protocol/steth/rewards?address=${address}&limit=${limit}&onlyRewards=true`,
      );
      const data = await res.json();
      return data;
    } catch (e) {
      return {
        error: `Failed to fetch rewards: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  },

  lido_governance: async (params, _ctx) => {
    try {
      const state = (params.state as string) || "active";
      const limit = (params.limit as number) || 5;
      const query = {
        query: `{
          proposals(
            first: ${limit},
            skip: 0,
            where: {
              space_in: ["lido-snapshot.eth"]
              ${state !== "all" ? `, state: "${state}"` : ""}
            },
            orderBy: "created",
            orderDirection: desc
          ) {
            id title state start end scores scores_total votes link
          }
        }`,
      };
      const res = await fetch("https://hub.snapshot.org/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(query),
      });
      const data = await res.json();
      return { proposals: data?.data?.proposals || [] };
    } catch (e) {
      return {
        error: `Failed to fetch governance: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  },

  // ── Lido write tools (dry-run stubs) ─────────────────────────────

  lido_stake: dryRunStub("lido_stake"),
  lido_wrap: dryRunStub("lido_wrap"),
  lido_governance_vote: dryRunStub("lido_governance_vote"),

  // ── ENS tools (real implementations using L1 client) ─────────────

  ens_resolve: async (params, ctx) => {
    try {
      const name = params.name as string;
      const address = await ctx.l1PublicClient.getEnsAddress({
        name: normalize(name),
      });
      return { name, address: address || null, resolved: !!address };
    } catch (e) {
      return {
        error: `Failed to resolve ENS: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  },

  ens_reverse: async (params, ctx) => {
    try {
      const address = params.address as Address;
      const name = await ctx.l1PublicClient.getEnsName({ address });
      return { address, ens_name: name || null, has_ens: !!name };
    } catch (e) {
      return {
        error: `Failed to reverse-resolve: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  },

  // ── Monitor tool (real implementation) ───────────────────────────

  vault_health: async (params, ctx) => {
    try {
      const address = params.address as Address;
      const wstethBalance = await ctx.publicClient.readContract({
        address: BASE_WSTETH_ADDRESS,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [address],
      });

      let currentApr = 0;
      try {
        const aprRes = await fetch(
          "https://eth-api.lido.fi/v1/protocol/steth/apr/last",
        );
        const aprData = await aprRes.json();
        currentApr = aprData?.data?.apr || 0;
      } catch {
        /* APR fetch optional */
      }

      const balNum = Number(formatEther(wstethBalance));
      const healthStatus =
        balNum === 0
          ? "no_position"
          : currentApr > 0
            ? "healthy"
            : "warning";

      const alerts: string[] = [];
      if (balNum === 0) alerts.push("No wstETH position detected");
      if (currentApr === 0 && balNum > 0) alerts.push("APR data unavailable");
      if (healthStatus === "healthy") alerts.push("Position healthy, yield accruing normally");

      return {
        address,
        wsteth_balance: formatEther(wstethBalance),
        current_apr: currentApr,
        health_status: healthStatus,
        alerts,
      };
    } catch (e) {
      return {
        error: `Failed to generate health report: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  },
};
