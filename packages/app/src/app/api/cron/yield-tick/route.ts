/**
 * Vercel Cron — Yield Tick (Chainlink Oracle Rate Bump)
 *
 * Simulates real Lido staking yield on the Anvil fork by periodically
 * incrementing the mock Chainlink wstETH/stETH exchange rate.
 *
 * Real Lido APY is ~3.5%. We simulate this by bumping the rate every
 * 5 minutes. But since this is a demo, we use an accelerated rate
 * (~100% APY) so users see meaningful yield within minutes of depositing.
 *
 * The mock oracle stores `answer` in storage slot 0 and returns
 * `block.timestamp` for `updatedAt` (so it never goes stale).
 *
 * Triggered by Vercel cron (vercel.json) every 5 minutes.
 */

import { NextRequest, NextResponse } from "next/server";

const FORK_RPC = process.env.RPC_URL || "https://agentgate-anvil.fly.dev/";
const CHAINLINK_FEED = "0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061";

// ── Yield Rate Config ──────────────────────────────────────────────────
// Real Lido: ~3.5% APY → invisible in demo (rate barely moves per tick)
// Demo mode: ~100% APY → rate doubles in a year, visible yield in minutes
//
// Math: 105120 ticks/year (every 5 min)
//   100% APY: (1 + r)^105120 = 2.0 → r ≈ 6.593 per billion
//   newRate = currentRate * (1_000_000_000 + 6593) / 1_000_000_000
const BUMP_PER_BILLION = 6593n; // ~100% APY

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(FORK_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  return res.json();
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Read current rate from the mock oracle (storage slot 0 = `answer`)
    const storageResult = await rpc("eth_getStorageAt", [CHAINLINK_FEED, "0x0", "latest"]);
    const currentRateHex = storageResult.result as string;
    const currentRate = BigInt(currentRateHex);

    if (currentRate === 0n) {
      return NextResponse.json({
        status: "skipped",
        reason: "Oracle rate is 0 — mock oracle may not be deployed. Run anvil-demo-setup.sh first.",
        timestamp: new Date().toISOString(),
      });
    }

    // Bump the rate using per-billion precision for accurate APY
    const newRate = currentRate * (1_000_000_000n + BUMP_PER_BILLION) / 1_000_000_000n;

    // Write new rate to storage slot 0
    const newRateHex = "0x" + newRate.toString(16).padStart(64, "0");
    await rpc("anvil_setStorageAt", [CHAINLINK_FEED, "0x0000000000000000000000000000000000000000000000000000000000000000", newRateHex]);

    // Also sync the fork timestamp so the oracle's block.timestamp stays fresh
    const now = Math.floor(Date.now() / 1000);
    await rpc("evm_setNextBlockTimestamp", [now]);
    await rpc("evm_mine", []);

    const oldRateFormatted = Number(currentRate) / 1e18;
    const newRateFormatted = Number(newRate) / 1e18;
    const pctChange = ((Number(newRate) - Number(currentRate)) / Number(currentRate)) * 100;

    // Calculate approximate APY from per-tick bump
    // 105120 ticks per year (every 5 min)
    const annualizedAPY = (Math.pow(1 + pctChange / 100, 105120) - 1) * 100;

    console.log(`[yield-tick] Rate bumped: ${oldRateFormatted.toFixed(6)} → ${newRateFormatted.toFixed(6)} (+${pctChange.toFixed(4)}%, ~${annualizedAPY.toFixed(1)}% APY)`);

    return NextResponse.json({
      status: "ok",
      previousRate: oldRateFormatted.toFixed(6),
      newRate: newRateFormatted.toFixed(6),
      bumpPercent: `${pctChange.toFixed(4)}%`,
      approximateAPY: `${annualizedAPY.toFixed(1)}%`,
      ticksPerYear: 105120,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[yield-tick] Error: ${err.message}`);
    return NextResponse.json({ status: "error", error: err.message }, { status: 500 });
  }
}
