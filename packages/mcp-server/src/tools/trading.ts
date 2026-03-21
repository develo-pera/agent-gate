import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseUnits, formatUnits, formatEther, type Address } from "viem";
import type { AgentGateContext } from "../context.js";

// ── Aave V3 on Base ──────────────────────────────────────────────────
const AAVE_POOL = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as Address;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const aUSDC = "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB" as Address;

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const AAVE_POOL_ABI = [
  {
    name: "supply",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getUserAccountData",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "totalCollateralBase", type: "uint256" },
      { name: "totalDebtBase", type: "uint256" },
      { name: "availableBorrowsBase", type: "uint256" },
      { name: "currentLiquidationThreshold", type: "uint256" },
      { name: "ltv", type: "uint256" },
      { name: "healthFactor", type: "uint256" },
    ],
  },
] as const;

// ── Recipes ──────────────────────────────────────────────────────────
const RECIPES = [
  {
    id: "yield_harvest_lend",
    name: "Yield Harvest & Lend",
    description:
      "Withdraw accrued yield from a vault, swap wstETH to USDC, and supply USDC to Aave V3 to earn lending interest. When ready, withdraw from Aave and transfer profit back to the vault owner for re-deposit (compounding principal).",
    steps: [
      "1. treasury_withdraw_yield_for — withdraw yield from vault owner's vault",
      "2. uniswap_swap — swap wstETH to USDC",
      "3. aave_supply — deposit USDC into Aave V3 (earn ~5% APY)",
      "4. [wait for profit to accrue]",
      "5. aave_withdraw — withdraw USDC + interest from Aave",
      "6. transfer_token — send profit back to vault owner",
      "7. vault owner calls treasury_deposit — compound profit into principal",
    ],
  },
];

export function registerTradingTools(server: McpServer, ctx: AgentGateContext) {

  // ── trading_list_recipes ─────────────────────────────────────────────
  server.tool(
    "trading_list_recipes",
    "List available autonomous trading recipes. Each recipe is a multi-step strategy that an authorized spender can execute with yield from a vault.",
    {},
    async () => ({
      content: [{
        type: "text" as const,
        text: JSON.stringify(RECIPES, null, 2),
      }],
    }),
  );

  // ── aave_supply ──────────────────────────────────────────────────────
  server.tool(
    "aave_supply",
    "Supply USDC to Aave V3 on Base to earn lending interest. Approve + deposit in one call.",
    {
      amount: z.string().describe("Amount of USDC to supply (e.g. '100' for 100 USDC)"),
      dry_run: z.boolean().optional().describe("Simulate without executing"),
    },
    async ({ amount, dry_run }) => {
      try {
        const parsedAmount = parseUnits(amount, 6);
        const agent = ctx.walletAccount!.address;

        if (dry_run) {
          const balance = await ctx.publicClient.readContract({
            address: USDC,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [agent],
          });
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                dry_run: true,
                action: "supply USDC to Aave V3",
                amount: amount + " USDC",
                usdc_balance: formatUnits(balance as bigint, 6) + " USDC",
                sufficient: (balance as bigint) >= parsedAmount,
                aave_pool: AAVE_POOL,
              }, null, 2),
            }],
          };
        }

        // Approve Aave Pool to spend USDC
        const approveTx = await ctx.walletClient.writeContract({
          address: USDC,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [AAVE_POOL, parsedAmount],
        });

        // Supply to Aave
        const supplyTx = await ctx.walletClient.writeContract({
          address: AAVE_POOL,
          abi: AAVE_POOL_ABI,
          functionName: "supply",
          args: [USDC, parsedAmount, agent, 0],
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              action: "Supplied USDC to Aave V3",
              amount: amount + " USDC",
              approve_tx: approveTx,
              supply_tx: supplyTx,
              note: "USDC is now earning lending interest on Aave V3. Use aave_withdraw to retrieve.",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error supplying to Aave: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    },
  );

  // ── aave_withdraw ────────────────────────────────────────────────────
  server.tool(
    "aave_withdraw",
    "Withdraw USDC (plus accrued interest) from Aave V3 on Base.",
    {
      amount: z.string().describe("Amount of USDC to withdraw (e.g. '100', or 'max' for full balance)"),
      dry_run: z.boolean().optional().describe("Simulate without executing"),
    },
    async ({ amount, dry_run }) => {
      try {
        const agent = ctx.walletAccount!.address;

        // Check aUSDC balance (represents supplied amount + interest)
        const aBalance = await ctx.publicClient.readContract({
          address: aUSDC,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [agent],
        }) as bigint;

        const isMax = amount.toLowerCase() === "max";
        const withdrawAmount = isMax
          ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") // type(uint256).max
          : parseUnits(amount, 6);

        if (dry_run) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                dry_run: true,
                action: "withdraw USDC from Aave V3",
                aave_balance: formatUnits(aBalance, 6) + " USDC (including interest)",
                withdraw_amount: isMax ? "max (full balance)" : amount + " USDC",
              }, null, 2),
            }],
          };
        }

        const tx = await ctx.walletClient.writeContract({
          address: AAVE_POOL,
          abi: AAVE_POOL_ABI,
          functionName: "withdraw",
          args: [USDC, withdrawAmount, agent],
        });

        // Check new USDC balance
        const usdcBalance = await ctx.publicClient.readContract({
          address: USDC,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [agent],
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              action: "Withdrew USDC from Aave V3",
              previous_aave_balance: formatUnits(aBalance, 6) + " USDC",
              withdraw_tx: tx,
              usdc_balance_now: formatUnits(usdcBalance as bigint, 6) + " USDC",
              note: "USDC is back in your wallet. Transfer profit to the vault owner for compounding.",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error withdrawing from Aave: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    },
  );

  // ── aave_position ────────────────────────────────────────────────────
  server.tool(
    "aave_position",
    "Check your current Aave V3 lending position — supplied balance and account data.",
    {
      address: z.string().optional().describe("Address to check (defaults to your own)"),
    },
    async ({ address }) => {
      try {
        const target = (address || ctx.walletAccount!.address) as Address;

        const [aBalance, accountData] = await Promise.all([
          ctx.publicClient.readContract({
            address: aUSDC,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [target],
          }),
          ctx.publicClient.readContract({
            address: AAVE_POOL,
            abi: AAVE_POOL_ABI,
            functionName: "getUserAccountData",
            args: [target],
          }),
        ]);

        const [totalCollateral, totalDebt, availableBorrows, , , healthFactor] =
          accountData as [bigint, bigint, bigint, bigint, bigint, bigint];

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              address: target,
              aave_usdc_balance: formatUnits(aBalance as bigint, 6) + " USDC",
              total_collateral_usd: formatEther(totalCollateral) + " USD",
              total_debt_usd: formatEther(totalDebt) + " USD",
              available_borrows_usd: formatEther(availableBorrows) + " USD",
              health_factor: totalDebt > 0n
                ? (Number(healthFactor) / 1e18).toFixed(2)
                : "N/A (no debt)",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error checking Aave position: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    },
  );

  // ── transfer_token ───────────────────────────────────────────────────
  server.tool(
    "transfer_token",
    "Transfer an ERC-20 token to another address. Use this to send profit back to a vault owner for re-deposit.",
    {
      token: z.string().describe("Token symbol (USDC, wstETH) or contract address"),
      to: z.string().describe("Recipient address"),
      amount: z.string().describe("Amount to transfer (human-readable, e.g. '50' for 50 USDC)"),
      dry_run: z.boolean().optional().describe("Simulate without executing"),
    },
    async ({ token, to, amount, dry_run }) => {
      try {
        const TOKEN_MAP: Record<string, { address: Address; decimals: number }> = {
          usdc: { address: USDC, decimals: 6 },
          wsteth: { address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as Address, decimals: 18 },
        };

        const resolved = TOKEN_MAP[token.toLowerCase()] ||
          (token.startsWith("0x") ? { address: token as Address, decimals: 18 } : null);

        if (!resolved) {
          return {
            content: [{
              type: "text" as const,
              text: `Unknown token: ${token}. Use USDC, wstETH, or a contract address.`,
            }],
            isError: true,
          };
        }

        const parsedAmount = parseUnits(amount, resolved.decimals);
        const agent = ctx.walletAccount!.address;

        const balance = await ctx.publicClient.readContract({
          address: resolved.address,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [agent],
        }) as bigint;

        if (dry_run) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                dry_run: true,
                action: `transfer ${amount} ${token} to ${to}`,
                balance: formatUnits(balance, resolved.decimals),
                sufficient: balance >= parsedAmount,
              }, null, 2),
            }],
          };
        }

        const tx = await ctx.walletClient.writeContract({
          address: resolved.address,
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [to as Address, parsedAmount],
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              action: `Transferred ${amount} ${token} to ${to}`,
              tx_hash: tx,
              previous_balance: formatUnits(balance, resolved.decimals),
              transferred: amount,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error transferring token: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    },
  );
}
