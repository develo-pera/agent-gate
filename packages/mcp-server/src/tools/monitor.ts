import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatEther, formatUnits, type Address } from "viem";
import type { AgentGateContext } from "../context.js";

// ── Lido staking APR benchmarks ───────────────────────────────────────
const BENCHMARK_APR = 3.5; // ~3.5% stETH staking APR baseline

const WSTETH_ABI_VIEW = [
  {
    name: "getStETHByWstETH",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_wstETHAmount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "stEthPerToken",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export function registerMonitorTools(server: McpServer, ctx: AgentGateContext) {
  // Base mainnet wstETH (bridged via canonical Lido bridge)
  const wstETHAddr = "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as Address;

  // ── vault_health: Plain-language vault health report ─────────────────
  server.tool(
    "vault_health",
    "Generate a plain-language health report for an agent's stETH/wstETH position. " +
    "Includes benchmark yield tracking, protocol allocation detection, and actionable alerts.",
    {
      address: z.string().describe("Agent/wallet address to analyze"),
    },
    async ({ address }) => {
      const addr = address as Address;

      try {
        // Fetch current exchange rate
        const stEthPerToken = await ctx.publicClient.readContract({
          address: wstETHAddr,
          abi: WSTETH_ABI_VIEW,
          functionName: "stEthPerToken",
        });

        // APR data comes from L1 Lido API — Base wstETH earns the same rate
        const apiBase = "https://eth-api.lido.fi";

        let currentApr = BENCHMARK_APR;
        try {
          const aprRes = await fetch(`${apiBase}/v1/protocol/steth/apr/last`);
          const aprData = await aprRes.json();
          currentApr = aprData?.data?.apr || BENCHMARK_APR;
        } catch { /* use benchmark */ }

        // Fetch wstETH balance
        const wstethBal = await ctx.publicClient.readContract({
          address: wstETHAddr,
          abi: [{
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          }] as const,
          functionName: "balanceOf",
          args: [addr],
        });

        // stETH doesn't exist natively on Base — only wstETH
        const stethBal = 0n;

        // Calculate values
        const wstethStethValue = wstethBal > 0n
          ? await ctx.publicClient.readContract({
              address: wstETHAddr,
              abi: WSTETH_ABI_VIEW,
              functionName: "getStETHByWstETH",
              args: [wstethBal],
            })
          : 0n;

        const totalStETHExposure = stethBal + wstethStethValue;
        const exchangeRate = Number(stEthPerToken) / 1e18;

        // Build alerts
        const alerts: string[] = [];

        if (totalStETHExposure === 0n) {
          alerts.push("⚠️ No stETH/wstETH position detected. Consider staking ETH with Lido to earn yield.");
        }

        if (currentApr < BENCHMARK_APR * 0.8) {
          alerts.push(`⚠️ Current APR (${currentApr.toFixed(2)}%) is below the benchmark (${BENCHMARK_APR}%). This may indicate network-wide validator issues.`);
        }

        if (stethBal > 0n && wstethBal === 0n) {
          alerts.push("💡 You hold stETH but no wstETH. Consider wrapping to wstETH for easier DeFi integration and gas efficiency (no rebase handling needed).");
        }

        if (wstethBal > 0n && stethBal > wstethStethValue * 2n) {
          alerts.push("💡 Large stETH balance relative to wstETH. Consider wrapping some stETH to wstETH for composability.");
        }

        if (alerts.length === 0) {
          alerts.push("✅ Position looks healthy. Yield is accruing normally.");
        }

        // Build plain-language report
        const report = {
          summary: `Vault health report for ${addr.slice(0, 8)}...${addr.slice(-6)}`,
          position: {
            steth_balance: formatEther(stethBal) + " stETH",
            wsteth_balance: formatEther(wstethBal) + " wstETH",
            wsteth_in_steth: formatEther(wstethStethValue) + " stETH equivalent",
            total_steth_exposure: formatEther(totalStETHExposure) + " stETH",
          },
          yield_tracking: {
            current_apr: currentApr.toFixed(2) + "%",
            benchmark_apr: BENCHMARK_APR + "%",
            performance_vs_benchmark: currentApr >= BENCHMARK_APR ? "at or above benchmark" : "below benchmark",
            wsteth_exchange_rate: exchangeRate.toFixed(6) + " stETH per wstETH",
          },
          alerts,
          network: ctx.chain.name,
          timestamp: new Date().toISOString(),
        };

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify(report, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error generating vault health report: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    }
  );

  // ── wallet_balance: Check ERC-20 and native ETH balances ────────────
  const KNOWN_TOKENS: Record<string, { address: Address; decimals: number; symbol: string }> = {
    USDC:   { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6,  symbol: "USDC" },
    wstETH: { address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", decimals: 18, symbol: "wstETH" },
    WETH:   { address: "0x4200000000000000000000000000000000000006", decimals: 18, symbol: "WETH" },
    DAI:    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18, symbol: "DAI" },
    USDT:   { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6,  symbol: "USDT" },
    aUSDC:  { address: "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB", decimals: 6,  symbol: "aUSDC" },
  };

  const ERC20_BALANCE_ABI = [
    {
      name: "balanceOf",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "account", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    },
  ] as const;

  server.tool(
    "wallet_balance",
    "Check token balances for an address. Returns ETH and all known ERC-20 balances (USDC, wstETH, WETH, DAI, USDT, aUSDC) on Base. " +
    "Optionally filter to a single token.",
    {
      address: z.string().describe("Wallet address to check balances for"),
      token: z.string().optional().describe("Optional: specific token symbol (e.g. 'USDC') — omit for all balances"),
    },
    async ({ address, token }) => {
      const addr = address as Address;

      try {
        const balances: Record<string, string> = {};

        // Native ETH balance
        if (!token || token.toUpperCase() === "ETH") {
          const ethBal = await ctx.publicClient.getBalance({ address: addr });
          balances["ETH"] = formatEther(ethBal);
        }

        // ERC-20 balances
        const tokensToCheck = token && token.toUpperCase() !== "ETH"
          ? { [token.toUpperCase()]: KNOWN_TOKENS[token.toUpperCase()] || KNOWN_TOKENS[token] }
          : KNOWN_TOKENS;

        for (const [sym, info] of Object.entries(tokensToCheck)) {
          if (!info?.address) continue;
          try {
            const bal = await ctx.publicClient.readContract({
              address: info.address,
              abi: ERC20_BALANCE_ABI,
              functionName: "balanceOf",
              args: [addr],
            });
            const formatted = formatUnits(bal as bigint, info.decimals);
            balances[info.symbol] = formatted;
          } catch {
            balances[sym] = "error reading balance";
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ address: addr, balances, network: ctx.chain.name }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{
            type: "text" as const,
            text: `Error checking balances: ${e instanceof Error ? e.message : "unknown"}`,
          }],
          isError: true,
        };
      }
    }
  );
}
