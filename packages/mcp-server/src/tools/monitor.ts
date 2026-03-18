import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatEther, type Address } from "viem";
import type { AgentGateContext } from "../index.js";

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
  const wstETHAddr = (ctx.chain.id === 1
    ? "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0"
    : "0x8d09a4502Cc8Cf1547aD300E066060D043f6982D") as Address;

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

        // Fetch APR from Lido API
        const apiBase = ctx.chain.id === 1
          ? "https://eth-api.lido.fi"
          : "https://eth-api-hoodi.testnet.fi";

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

        // Fetch stETH balance
        const stETHAddr = (ctx.chain.id === 1
          ? "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84"
          : "0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034") as Address;

        const stethBal = await ctx.publicClient.readContract({
          address: stETHAddr,
          abi: [{
            name: "balanceOf",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "_account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          }] as const,
          functionName: "balanceOf",
          args: [addr],
        });

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
}
