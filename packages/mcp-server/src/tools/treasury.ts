import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseEther, formatEther, type Address, getContract } from "viem";
import type { AgentGateContext } from "../index.js";

// ── AgentTreasury contract ABI ────────────────────────────────────────
// This matches the Solidity contract in packages/treasury-contract/
const TREASURY_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "wstETHAmount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdrawYield",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "getVaultStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "depositedShares", type: "uint256" },
      { name: "currentValue", type: "uint256" },
      { name: "principalValue", type: "uint256" },
      { name: "availableYield", type: "uint256" },
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
  {
    name: "authorizeSpender",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "yieldOnly", type: "bool" },
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
] as const;

export function registerTreasuryTools(server: McpServer, ctx: AgentGateContext) {
  // Treasury contract address — set via env or use default deployment
  const TREASURY_ADDR = (process.env.TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;

  // ── treasury_deposit: Deposit wstETH into the agent treasury ────────
  server.tool(
    "treasury_deposit",
    "Deposit wstETH into the AgentTreasury. The deposited principal is locked — only yield accrued on top can be spent.",
    {
      amount_wsteth: z.string().describe("Amount of wstETH to deposit (e.g. '1.0')"),
      dry_run: z.boolean().optional(),
    },
    async ({ amount_wsteth, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const amount = parseEther(amount_wsteth);

      if (isDry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "treasury_deposit",
              amount_wsteth,
              contract: TREASURY_ADDR,
              note: "Will deposit wstETH. Principal is locked; only yield above deposit value can be withdrawn.",
            }, null, 2),
          }],
        };
      }

      if (!ctx.walletClient) {
        return { content: [{ type: "text" as const, text: "Error: No wallet configured." }], isError: true };
      }

      const hash = await ctx.walletClient.writeContract({
          account: ctx.walletAccount!,
          chain: ctx.chain,
        address: TREASURY_ADDR,
        abi: TREASURY_ABI,
        functionName: "deposit",
        args: [amount],
      });
      const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            mode: "executed",
            action: "treasury_deposit",
            amount_wsteth,
            tx_hash: hash,
            status: receipt.status,
          }, null, 2),
        }],
      };
    }
  );

  // ── treasury_withdraw_yield: Spend only accrued yield ───────────────
  server.tool(
    "treasury_withdraw_yield",
    "Withdraw accrued stETH yield from the AgentTreasury. Cannot exceed available yield — principal is always protected.",
    {
      recipient: z.string().describe("Address to receive the yield"),
      amount_wsteth: z.string().describe("Amount of wstETH yield to withdraw"),
      dry_run: z.boolean().optional(),
    },
    async ({ recipient, amount_wsteth, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const amount = parseEther(amount_wsteth);

      if (isDry) {
        // Check available yield
        if (TREASURY_ADDR !== "0x0000000000000000000000000000000000000000") {
          try {
            const account = ctx.walletClient?.account?.address || recipient;
            const result = await ctx.publicClient.readContract({
              address: TREASURY_ADDR,
              abi: TREASURY_ABI,
              functionName: "getVaultStatus",
              args: [account as Address],
            });

            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  mode: "dry_run",
                  action: "treasury_withdraw_yield",
                  requested_amount: amount_wsteth,
                  available_yield: formatEther(result[3]),
                  principal_protected: formatEther(result[2]),
                  current_total_value: formatEther(result[1]),
                  would_succeed: result[3] >= amount,
                  recipient,
                }, null, 2),
              }],
            };
          } catch {
            // Contract not deployed yet — return estimate
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "treasury_withdraw_yield",
              requested_amount: amount_wsteth,
              recipient,
              note: "Treasury contract not yet deployed or address not configured.",
            }, null, 2),
          }],
        };
      }

      if (!ctx.walletClient) {
        return { content: [{ type: "text" as const, text: "Error: No wallet configured." }], isError: true };
      }

      const hash = await ctx.walletClient.writeContract({
          account: ctx.walletAccount!,
          chain: ctx.chain,
        address: TREASURY_ADDR,
        abi: TREASURY_ABI,
        functionName: "withdrawYield",
        args: [recipient as Address, amount],
      });
      const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            mode: "executed",
            action: "treasury_withdraw_yield",
            amount_wsteth,
            recipient,
            tx_hash: hash,
            status: receipt.status,
          }, null, 2),
        }],
      };
    }
  );

  // ── treasury_status: Check vault health ─────────────────────────────
  server.tool(
    "treasury_status",
    "Check the AgentTreasury vault status: deposited principal, current value, available yield, and authorized spenders.",
    {
      agent_address: z.string().describe("Agent address to check vault status for"),
    },
    async ({ agent_address }) => {
      if (TREASURY_ADDR === "0x0000000000000000000000000000000000000000") {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              error: "Treasury contract address not configured. Set TREASURY_ADDRESS env var.",
              hint: "Deploy the contract from packages/treasury-contract first.",
            }, null, 2),
          }],
          isError: true,
        };
      }

      try {
        const result = await ctx.publicClient.readContract({
          address: TREASURY_ADDR,
          abi: TREASURY_ABI,
          functionName: "getVaultStatus",
          args: [agent_address as Address],
        });

        const [depositedShares, currentValue, principalValue, availableYield] = result;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              agent: agent_address,
              deposited_shares: depositedShares.toString(),
              current_value_wsteth: formatEther(currentValue),
              principal_locked_wsteth: formatEther(principalValue),
              available_yield_wsteth: formatEther(availableYield),
              yield_percentage: principalValue > 0n
                ? ((Number(availableYield) / Number(principalValue)) * 100).toFixed(4) + "%"
                : "0%",
              contract: TREASURY_ADDR,
              network: ctx.chain.name,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error reading treasury: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── treasury_authorize: Authorize another agent to spend yield ──────
  server.tool(
    "treasury_authorize_spender",
    "Authorize another agent/address to spend yield from your AgentTreasury vault. They can only withdraw accrued yield, never principal.",
    {
      spender: z.string().describe("Address to authorize as yield spender"),
      yield_only: z.boolean().optional().describe("If true (default), spender can only access yield. If false, full access."),
      dry_run: z.boolean().optional(),
    },
    async ({ spender, yield_only, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const yieldOnly = yield_only ?? true;

      if (isDry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "authorize_spender",
              spender,
              yield_only: yieldOnly,
              note: `Will authorize ${spender} to spend ${yieldOnly ? "yield only" : "full balance"} from your vault.`,
            }, null, 2),
          }],
        };
      }

      if (!ctx.walletClient) {
        return { content: [{ type: "text" as const, text: "Error: No wallet configured." }], isError: true };
      }

      const hash = await ctx.walletClient.writeContract({
          account: ctx.walletAccount!,
          chain: ctx.chain,
        address: TREASURY_ADDR,
        abi: TREASURY_ABI,
        functionName: "authorizeSpender",
        args: [spender as Address, yieldOnly],
      });
      const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            mode: "executed",
            action: "authorize_spender",
            spender,
            yield_only: yieldOnly,
            tx_hash: hash,
            status: receipt.status,
          }, null, 2),
        }],
      };
    }
  );
}
