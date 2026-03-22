/**
 * Vercel Cron — Uniswap Pool Rebalancer
 *
 * Compares fork pool prices against live Base mainnet.
 * If drift exceeds threshold, swaps to push the price back.
 *
 * Triggered by Vercel cron (vercel.json) every 5 minutes.
 * Protected by CRON_SECRET to prevent unauthorized invocations.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient, http, parseEther, formatUnits,
  encodePacked, encodeFunctionData, concat, pad, toHex,
  keccak256, encodeAbiParameters, parseAbiParameters,
  type Address, type PublicClient, type Hex,
} from "viem";
import { base } from "viem/chains";

// ── Config ──────────────────────────────────────────────────────────────

const FORK_RPC = process.env.RPC_URL || "https://agentgate-anvil.fly.dev/";
const MAINNET_RPC = "https://mainnet.base.org";
const DRIFT_THRESHOLD_PCT = 2;

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
const PAIRS = [
  { name: "WETH → wstETH", tokenIn: WETH, tokenOut: WSTETH, decimalsIn: 18, decimalsOut: 18, probeAmount: parseEther("0.01") },
  { name: "wstETH → WETH", tokenIn: WSTETH, tokenOut: WETH, decimalsIn: 18, decimalsOut: 18, probeAmount: parseEther("0.01") },
  { name: "WETH → USDC", tokenIn: WETH, tokenOut: USDC, decimalsIn: 18, decimalsOut: 6, probeAmount: parseEther("0.01") },
  { name: "USDC → WETH", tokenIn: USDC, tokenOut: WETH, decimalsIn: 6, decimalsOut: 18, probeAmount: BigInt(10_000000) },
  { name: "USDC → wstETH", tokenIn: USDC, tokenOut: WSTETH, decimalsIn: 6, decimalsOut: 18, probeAmount: BigInt(10_000000) },
];

// ── ABIs ────────────────────────────────────────────────────────────────

const QUOTER_ABI = [{
  name: "quoteExactInputSingle", type: "function", stateMutability: "nonpayable" as const,
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

const ERC20_APPROVE_ABI = [{ name: "approve", type: "function", stateMutability: "nonpayable" as const, inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const PERMIT2_APPROVE_ABI = [{ name: "approve", type: "function", stateMutability: "nonpayable" as const, inputs: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }], outputs: [] }] as const;

const UNIVERSAL_ROUTER_ABI = [{
  name: "execute", type: "function", stateMutability: "payable" as const,
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

async function rpc(method: string, params: unknown[]) {
  const res = await fetch(FORK_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  return res.json();
}

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
      if (out > bestOut) { bestOut = out; bestFee = fee; }
    } catch { /* no liquidity */ }
  }
  return bestOut > 0n ? { amountOut: bestOut, fee: bestFee } : null;
}

async function seedRebalancer() {
  // 1000 ETH
  await rpc("anvil_setBalance", [REBALANCER, "0x3635C9ADC5DEA00000"]);

  // WETH — slot 0
  const wethSlot = keccak256(encodeAbiParameters(parseAbiParameters("address, uint256"), [REBALANCER, 0n]));
  await rpc("anvil_setStorageAt", [WETH, wethSlot, "0x" + (500n * 10n ** 18n).toString(16).padStart(64, "0")]);

  // wstETH — slot 1
  const wstethSlot = keccak256(encodeAbiParameters(parseAbiParameters("address, uint256"), [REBALANCER, 1n]));
  await rpc("anvil_setStorageAt", [WSTETH, wstethSlot, "0x" + (500n * 10n ** 18n).toString(16).padStart(64, "0")]);

  // USDC — slot 9
  const usdcSlot = keccak256(encodeAbiParameters(parseAbiParameters("address, uint256"), [REBALANCER, 9n]));
  await rpc("anvil_setStorageAt", [USDC, usdcSlot, "0x" + (1_000_000n * 10n ** 6n).toString(16).padStart(64, "0")]);
}

async function impersonateSend(to: Address, data: Hex, value: bigint = 0n): Promise<string> {
  await rpc("anvil_impersonateAccount", [REBALANCER]);
  const txResult = await rpc("eth_sendTransaction", [{
    from: REBALANCER, to, data,
    value: "0x" + value.toString(16),
    gas: "0x200000",
  }]);
  await rpc("evm_mine", []);
  await rpc("anvil_stopImpersonatingAccount", [REBALANCER]);
  return txResult.result;
}

async function ensureApprovals(token: Address) {
  const approveData = encodeFunctionData({
    abi: ERC20_APPROVE_ABI, functionName: "approve",
    args: [PERMIT2, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
  });
  await impersonateSend(token, approveData);

  const now = Math.floor(Date.now() / 1000);
  const permit2Data = encodeFunctionData({
    abi: PERMIT2_APPROVE_ABI, functionName: "approve",
    args: [
      token, UNIVERSAL_ROUTER,
      BigInt("0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff") as unknown as bigint,
      (now + 60 * 60 * 24 * 365) as number,
    ],
  });
  await impersonateSend(PERMIT2, permit2Data);
}

async function executeSwap(tokenIn: Address, tokenOut: Address, amountIn: bigint, fee: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  await rpc("evm_setNextBlockTimestamp", [now]);
  await rpc("evm_mine", []);

  const quote = await bestQuote(forkClient as any, tokenIn, tokenOut, amountIn);
  if (!quote) throw new Error("No quote available");
  const amountOutMin = quote.amountOut * 9500n / 10000n;

  const path = encodePacked(["address", "uint24", "address"], [tokenIn, fee, tokenOut]);
  const commands = "0x00" as `0x${string}`;
  const swapInput = concat([
    pad(REBALANCER as `0x${string}`),
    pad(toHex(amountIn)),
    pad(toHex(amountOutMin)),
    pad(toHex(160, { size: 32 })),
    pad(toHex(1, { size: 32 })),
    pad(toHex(BigInt((path.length - 2) / 2), { size: 32 })),
    (path + "0".repeat((64 - ((path.length - 2) % 64)) % 64)) as `0x${string}`,
  ]);

  const routerCalldata = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI, functionName: "execute",
    args: [commands, [swapInput], BigInt(now + 300)],
  });

  return impersonateSend(UNIVERSAL_ROUTER, routerCalldata);
}

// ── Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sets this header automatically for cron invocations)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); console.log(`[rebalancer] ${msg}`); };

  try {
    log("Seeding rebalancer...");
    await seedRebalancer();

    log(`Checking pool prices (threshold: ${DRIFT_THRESHOLD_PCT}%)...`);

    let rebalanced = 0;
    const results: Array<{ pair: string; drift: string; action: string }> = [];

    for (const pair of PAIRS) {
      const [mainnetQuote, forkQuote_] = await Promise.all([
        bestQuote(mainnetClient as any, pair.tokenIn, pair.tokenOut, pair.probeAmount),
        bestQuote(forkClient as any, pair.tokenIn, pair.tokenOut, pair.probeAmount),
      ]);

      if (!mainnetQuote || !forkQuote_) {
        results.push({ pair: pair.name, drift: "N/A", action: "skipped (no liquidity)" });
        continue;
      }

      const driftPct = ((Number(forkQuote_.amountOut) - Number(mainnetQuote.amountOut)) / Number(mainnetQuote.amountOut)) * 100;

      if (Math.abs(driftPct) < DRIFT_THRESHOLD_PCT) {
        results.push({ pair: pair.name, drift: `${driftPct.toFixed(2)}%`, action: "OK" });
        continue;
      }

      // Only act on negative drift (fork gives less output)
      if (driftPct > 0) {
        results.push({ pair: pair.name, drift: `${driftPct.toFixed(2)}%`, action: "opposite direction will fix" });
        continue;
      }

      const swapAmount = pair.probeAmount * 10n * BigInt(Math.min(Math.max(Math.ceil(Math.abs(driftPct) / 2), 1), 20));
      log(`${pair.name}: drifted ${driftPct.toFixed(2)}%, swapping ${formatUnits(swapAmount, pair.decimalsIn)}...`);

      try {
        await ensureApprovals(pair.tokenIn);
        const txHash = await executeSwap(pair.tokenIn, pair.tokenOut, swapAmount, forkQuote_.fee);
        results.push({ pair: pair.name, drift: `${driftPct.toFixed(2)}%`, action: `rebalanced (tx: ${txHash})` });
        rebalanced++;
      } catch (err: any) {
        results.push({ pair: pair.name, drift: `${driftPct.toFixed(2)}%`, action: `failed: ${err.message?.slice(0, 80)}` });
      }
    }

    log(`Done. ${rebalanced} pools rebalanced.`);

    return NextResponse.json({
      status: "ok",
      threshold: `${DRIFT_THRESHOLD_PCT}%`,
      rebalanced,
      results,
      logs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    log(`Error: ${err.message}`);
    return NextResponse.json({ status: "error", error: err.message, logs }, { status: 500 });
  }
}
