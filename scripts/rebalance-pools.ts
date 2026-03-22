#!/usr/bin/env npx tsx
/**
 * Uniswap Pool Rebalancer for Anvil Fork
 *
 * Compares fork pool prices against live Base mainnet prices.
 * If drift exceeds threshold, swaps to push the fork price back.
 *
 * The rebalancer uses a dedicated address seeded with large token balances
 * via anvil_setBalance / storage manipulation.
 *
 * Usage:
 *   npx tsx scripts/rebalance-pools.ts                    # one-shot
 *   npx tsx scripts/rebalance-pools.ts --watch             # continuous (every 5 min)
 *   npx tsx scripts/rebalance-pools.ts --watch --interval 120  # every 2 min
 *   npx tsx scripts/rebalance-pools.ts --threshold 3       # 3% drift threshold (default: 2%)
 */

import {
  createPublicClient, http, parseEther, formatEther, formatUnits,
  encodePacked, encodeFunctionData, concat, pad, toHex, keccak256,
  encodeAbiParameters, parseAbiParameters,
  type Address, type PublicClient, type Hex,
} from "viem";
import { base } from "viem/chains";

// ── Config ──────────────────────────────────────────────────────────────

const FORK_RPC = process.env.RPC_URL || "https://agentgate-anvil.fly.dev/";
const MAINNET_RPC = "https://mainnet.base.org";
const DRIFT_THRESHOLD_PCT = parseFloat(process.argv.find((_, i, a) => a[i - 1] === "--threshold") || "2");
const WATCH_INTERVAL_SEC = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--interval") || "300");
const WATCH_MODE = process.argv.includes("--watch");

// Rebalancer address — a throwaway address we impersonate on the fork
const REBALANCER = "0x00000000000000000000000000000000dEaDbA1A" as Address;

// Contracts
const WETH = "0x4200000000000000000000000000000000000006" as Address;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const WSTETH = "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as Address;
const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as Address;
const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43" as Address;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;

const FEE_TIERS = [100, 500, 3000, 10000] as const;

// Token pairs to monitor
const PAIRS: Array<{
  name: string;
  tokenIn: Address;
  tokenOut: Address;
  decimalsIn: number;
  decimalsOut: number;
  probeAmount: bigint;
}> = [
  {
    name: "WETH → wstETH",
    tokenIn: WETH,
    tokenOut: WSTETH,
    decimalsIn: 18,
    decimalsOut: 18,
    probeAmount: parseEther("0.01"),
  },
  {
    name: "wstETH → WETH",
    tokenIn: WSTETH,
    tokenOut: WETH,
    decimalsIn: 18,
    decimalsOut: 18,
    probeAmount: parseEther("0.01"),
  },
  {
    name: "WETH → USDC",
    tokenIn: WETH,
    tokenOut: USDC,
    decimalsIn: 18,
    decimalsOut: 6,
    probeAmount: parseEther("0.01"),
  },
  {
    name: "USDC → WETH",
    tokenIn: USDC,
    tokenOut: WETH,
    decimalsIn: 6,
    decimalsOut: 18,
    probeAmount: BigInt(10_000000), // 10 USDC
  },
  {
    name: "USDC → wstETH",
    tokenIn: USDC,
    tokenOut: WSTETH,
    decimalsIn: 6,
    decimalsOut: 18,
    probeAmount: BigInt(10_000000), // 10 USDC
  },
];

// ── ABIs ────────────────────────────────────────────────────────────────

const QUOTER_ABI = [{
  name: "quoteExactInputSingle",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [{
    name: "params", type: "tuple",
    components: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "fee", type: "uint24" },
      { name: "sqrtPriceLimitX96", type: "uint160" },
    ],
  }],
  outputs: [
    { name: "amountOut", type: "uint256" },
    { name: "sqrtPriceX96After", type: "uint160" },
    { name: "initializedTicksCrossed", type: "uint32" },
    { name: "gasEstimate", type: "uint256" },
  ],
}] as const;

const ERC20_APPROVE_ABI = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const PERMIT2_APPROVE_ABI = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }], outputs: [] }] as const;

const UNIVERSAL_ROUTER_ABI = [{
  name: "execute", type: "function", stateMutability: "payable",
  inputs: [
    { name: "commands", type: "bytes" },
    { name: "inputs", type: "bytes[]" },
    { name: "deadline", type: "uint256" },
  ],
  outputs: [],
}] as const;

// ── Clients ─────────────────────────────────────────────────────────────

const forkClient = createPublicClient({ chain: base, transport: http(FORK_RPC) });
const mainnetClient = createPublicClient({ chain: base, transport: http(MAINNET_RPC) });

// ── Helpers ─────────────────────────────────────────────────────────────

async function bestQuote(
  client: PublicClient,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
): Promise<{ amountOut: bigint; fee: number } | null> {
  let bestOut = 0n;
  let bestFee = 0;

  for (const fee of FEE_TIERS) {
    try {
      const result = await client.simulateContract({
        address: QUOTER_V2,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      const out = result.result[0] as bigint;
      if (out > bestOut) {
        bestOut = out;
        bestFee = fee;
      }
    } catch { /* no liquidity at this tier */ }
  }

  return bestOut > 0n ? { amountOut: bestOut, fee: bestFee } : null;
}

/** Seed rebalancer with ETH + WETH + USDC + wstETH */
async function seedRebalancer(): Promise<void> {
  const rpc = (method: string, params: unknown[]) =>
    fetch(FORK_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    }).then(r => r.json());

  // 1000 ETH
  await rpc("anvil_setBalance", [REBALANCER, "0x3635C9ADC5DEA00000"]);

  // Deal WETH: deposit 500 ETH by setting balance directly
  // WETH uses slot 0 for balances (mapping(address => uint256))
  const wethSlot = keccak256(encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [REBALANCER, 0n]
  ));
  const wethAmount = "0x" + (500n * 10n ** 18n).toString(16).padStart(64, "0");
  await rpc("anvil_setStorageAt", [WETH, wethSlot, wethAmount]);

  // Deal wstETH: Base wstETH uses slot 1 for balances
  const wstethSlot = keccak256(encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [REBALANCER, 1n]
  ));
  const wstethAmount = "0x" + (500n * 10n ** 18n).toString(16).padStart(64, "0");
  await rpc("anvil_setStorageAt", [WSTETH, wstethSlot, wstethAmount]);

  // Deal USDC: uses slot 9 for balances (proxy ERC-20)
  const usdcSlot = keccak256(encodeAbiParameters(
    parseAbiParameters("address, uint256"),
    [REBALANCER, 9n]
  ));
  const usdcAmount = "0x" + (1_000_000n * 10n ** 6n).toString(16).padStart(64, "0");
  await rpc("anvil_setStorageAt", [USDC, usdcSlot, usdcAmount]);

  console.log("  Seeded rebalancer with 1000 ETH, 500 WETH, 500 wstETH, 1M USDC");
}

/** Impersonate rebalancer and send a transaction */
async function impersonateSend(to: Address, data: Hex, value: bigint = 0n): Promise<string> {
  const rpc = (method: string, params: unknown[]) =>
    fetch(FORK_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    }).then(r => r.json());

  await rpc("anvil_impersonateAccount", [REBALANCER]);

  const txResult = await rpc("eth_sendTransaction", [{
    from: REBALANCER,
    to,
    data,
    value: "0x" + value.toString(16),
    gas: "0x200000",
  }]);

  await rpc("evm_mine", []);
  await rpc("anvil_stopImpersonatingAccount", [REBALANCER]);

  return txResult.result;
}

/** Approve token → Permit2 → Universal Router for the rebalancer */
async function ensureApprovals(token: Address): Promise<void> {
  // Approve Permit2 to spend token
  const approveData = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [PERMIT2, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });
  await impersonateSend(token, approveData);

  // Approve Universal Router on Permit2
  const now = Math.floor(Date.now() / 1000);
  const permit2Data = encodeFunctionData({
    abi: PERMIT2_APPROVE_ABI,
    functionName: "approve",
    args: [
      token,
      UNIVERSAL_ROUTER,
      BigInt("0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff") as unknown as bigint,
      (now + 60 * 60 * 24 * 365) as number,
    ],
  });
  await impersonateSend(PERMIT2, permit2Data);
}

/** Execute a rebalancing swap */
async function executeSwap(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  fee: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const deadline = now + 300;

  // Sync fork timestamp
  const rpc = (method: string, params: unknown[]) =>
    fetch(FORK_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    }).then(r => r.json());
  await rpc("evm_setNextBlockTimestamp", [now]);
  await rpc("evm_mine", []);

  // Get a fresh quote for amountOutMin
  const quote = await bestQuote(forkClient as any, tokenIn, tokenOut, amountIn);
  if (!quote) throw new Error("No quote available after setup");

  const amountOutMin = quote.amountOut * 9500n / 10000n; // 5% slippage for rebalancing

  // Build swap path
  const path = encodePacked(
    ["address", "uint24", "address"],
    [tokenIn, fee, tokenOut],
  );

  // V3_SWAP_EXACT_IN command (0x00)
  const commands = "0x00" as `0x${string}`;
  const swapInput = concat([
    pad(REBALANCER as `0x${string}`),
    pad(toHex(amountIn)),
    pad(toHex(amountOutMin)),
    pad(toHex(160, { size: 32 })),
    pad(toHex(1, { size: 32 })), // payerIsUser = true
    pad(toHex(BigInt((path.length - 2) / 2), { size: 32 })),
    (path + "0".repeat((64 - ((path.length - 2) % 64)) % 64)) as `0x${string}`,
  ]);

  const routerCalldata = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [commands, [swapInput], BigInt(deadline)],
  });

  return impersonateSend(UNIVERSAL_ROUTER, routerCalldata);
}

/** Calculate how much to swap to move the price halfway back */
function calcRebalanceAmount(
  mainnetOut: bigint,
  forkOut: bigint,
  probeAmount: bigint,
  decimalsIn: number,
): bigint {
  // The pool is off — swap enough to push price back
  // Start with a moderate amount: 10x the probe amount
  // This is heuristic — large pools need more, small pools less
  const base = probeAmount * 10n;
  const driftPct = Number(mainnetOut - forkOut) * 100 / Number(mainnetOut);
  // Scale by drift severity
  const multiplier = Math.min(Math.max(Math.abs(driftPct) / 2, 1), 20);
  return BigInt(Math.floor(Number(base) * multiplier));
}

// ── Main ────────────────────────────────────────────────────────────────

async function checkAndRebalance(): Promise<void> {
  const timestamp = new Date().toISOString().slice(0, 19);
  console.log(`\n[${timestamp}] Checking pool prices (threshold: ${DRIFT_THRESHOLD_PCT}%)...`);

  let rebalanced = 0;

  for (const pair of PAIRS) {
    const [mainnetQuote, forkQuote_] = await Promise.all([
      bestQuote(mainnetClient as any, pair.tokenIn, pair.tokenOut, pair.probeAmount),
      bestQuote(forkClient as any, pair.tokenIn, pair.tokenOut, pair.probeAmount),
    ]);

    if (!mainnetQuote || !forkQuote_) {
      console.log(`  ${pair.name}: skipped (no liquidity on ${!mainnetQuote ? "mainnet" : "fork"})`);
      continue;
    }

    const mainnetRate = Number(mainnetQuote.amountOut);
    const forkRate = Number(forkQuote_.amountOut);
    const driftPct = ((forkRate - mainnetRate) / mainnetRate) * 100;

    const forkFormatted = formatUnits(forkQuote_.amountOut, pair.decimalsOut);
    const mainnetFormatted = formatUnits(mainnetQuote.amountOut, pair.decimalsOut);

    if (Math.abs(driftPct) < DRIFT_THRESHOLD_PCT) {
      console.log(`  ${pair.name}: OK (drift ${driftPct.toFixed(2)}%, fork=${forkFormatted}, mainnet=${mainnetFormatted})`);
      continue;
    }

    console.log(`  ${pair.name}: DRIFTED ${driftPct.toFixed(2)}% (fork=${forkFormatted}, mainnet=${mainnetFormatted})`);

    // If fork gives LESS output, the pool is skewed — we need to swap the opposite direction
    // to push the price back. But we're already iterating both directions in PAIRS,
    // so we only act on the direction where fork gives less (negative drift).
    if (driftPct > 0) {
      console.log(`    ↳ Fork gives more than mainnet — opposite direction swap will fix this`);
      continue;
    }

    const swapAmount = calcRebalanceAmount(
      mainnetQuote.amountOut, forkQuote_.amountOut,
      pair.probeAmount, pair.decimalsIn,
    );

    console.log(`    ↳ Rebalancing: swapping ${formatUnits(swapAmount, pair.decimalsIn)} ${pair.name.split(" → ")[0]}...`);

    try {
      await ensureApprovals(pair.tokenIn);
      const txHash = await executeSwap(pair.tokenIn, pair.tokenOut, swapAmount, forkQuote_.fee);
      console.log(`    ↳ Done! tx: ${txHash}`);
      rebalanced++;
    } catch (err: any) {
      console.log(`    ↳ Failed: ${err.message?.slice(0, 100)}`);
    }
  }

  // Re-check after rebalancing
  if (rebalanced > 0) {
    console.log(`\n  Post-rebalance check:`);
    for (const pair of PAIRS) {
      const [mainnetQuote, forkQuote_] = await Promise.all([
        bestQuote(mainnetClient as any, pair.tokenIn, pair.tokenOut, pair.probeAmount),
        bestQuote(forkClient as any, pair.tokenIn, pair.tokenOut, pair.probeAmount),
      ]);
      if (!mainnetQuote || !forkQuote_) continue;
      const driftPct = ((Number(forkQuote_.amountOut) - Number(mainnetQuote.amountOut)) / Number(mainnetQuote.amountOut)) * 100;
      const status = Math.abs(driftPct) < DRIFT_THRESHOLD_PCT ? "OK" : "STILL DRIFTED";
      console.log(`  ${pair.name}: ${status} (${driftPct.toFixed(2)}%)`);
    }
  } else {
    console.log(`\n  All pools within ${DRIFT_THRESHOLD_PCT}% threshold.`);
  }
}

async function main() {
  console.log("═══ Uniswap Pool Rebalancer ═══");
  console.log(`Fork RPC: ${FORK_RPC}`);
  console.log(`Mainnet RPC: ${MAINNET_RPC}`);
  console.log(`Drift threshold: ${DRIFT_THRESHOLD_PCT}%`);
  if (WATCH_MODE) console.log(`Watch interval: ${WATCH_INTERVAL_SEC}s`);

  // Seed rebalancer on first run
  console.log("\nSeeding rebalancer address...");
  await seedRebalancer();

  await checkAndRebalance();

  if (WATCH_MODE) {
    console.log(`\nWatching every ${WATCH_INTERVAL_SEC}s... (Ctrl+C to stop)`);
    setInterval(async () => {
      try {
        // Top up rebalancer tokens periodically
        await seedRebalancer();
        await checkAndRebalance();
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
      }
    }, WATCH_INTERVAL_SEC * 1000);
  }
}

main().catch(console.error);
