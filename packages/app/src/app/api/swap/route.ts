/**
 * Swap API — ETH → wstETH swap for human wallets on Anvil fork.
 *
 * POST /api/swap?action=quote  → returns expected output amount
 * POST /api/swap?action=execute → returns unsigned transactions for wallet signing
 *
 * Uses QuoterV2 for fork-aware quoting and Universal Router for execution.
 * Does NOT touch MCP tools or agent flows.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
  encodePacked,
  encodeFunctionData,
  concat,
  pad,
  toHex,
  type Address,
} from "viem";
import { base } from "viem/chains";

// ── Constants ───────────────────────────────────────────────────────

const WETH = "0x4200000000000000000000000000000000000006" as Address;
const WSTETH = "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" as Address;
const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43" as Address;
const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as Address;
const FEE_TIERS = [100, 500, 3000, 10000] as const;

const rpcUrl = process.env.RPC_URL || "https://mainnet.base.org";

// ── ABIs ────────────────────────────────────────────────────────────

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

const UNIVERSAL_ROUTER_ABI = [{
  name: "execute",
  type: "function",
  stateMutability: "payable",
  inputs: [
    { name: "commands", type: "bytes" },
    { name: "inputs", type: "bytes[]" },
    { name: "deadline", type: "uint256" },
  ],
  outputs: [],
}] as const;

// ── Helpers ─────────────────────────────────────────────────────────

function getClient() {
  return createPublicClient({ chain: base, transport: http(rpcUrl) });
}

async function findBestPool(client: ReturnType<typeof getClient>, amountIn: bigint) {
  let bestOut = 0n;
  let bestFee = 0;

  for (const fee of FEE_TIERS) {
    try {
      const result = await client.simulateContract({
        address: QUOTER_V2,
        abi: QUOTER_ABI,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: WETH, tokenOut: WSTETH, amountIn, fee, sqrtPriceLimitX96: 0n }],
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

function buildSwapCalldata(params: {
  fee: number;
  amountIn: bigint;
  amountOutMin: bigint;
  recipient: Address;
  deadline: number;
}): { data: `0x${string}`; value: bigint } {
  const path = encodePacked(
    ["address", "uint24", "address"],
    [WETH, params.fee, WSTETH],
  );

  // Commands: WRAP_ETH (0x0b) + V3_SWAP_EXACT_IN (0x00)
  const commands = "0x0b00" as `0x${string}`;

  const wrapInput = encodePacked(
    ["bytes32", "bytes32"],
    [
      pad("0x0000000000000000000000000000000000000002" as `0x${string}`),
      pad(toHex(params.amountIn)),
    ],
  );

  const swapInput = concat([
    pad(params.recipient as `0x${string}`),
    pad(toHex(params.amountIn)),
    pad(toHex(params.amountOutMin)),
    pad(toHex(160, { size: 32 })),
    pad("0x00" as `0x${string}`), // payerIsUser = false (router pays from wrapped ETH)
    pad(toHex(path.length / 2 - 1, { size: 32 })),
    (path + "0".repeat((64 - ((path.length - 2) % 64)) % 64)) as `0x${string}`,
  ]);

  const routerCalldata = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [commands, [wrapInput, swapInput], BigInt(params.deadline)],
  });

  return { data: routerCalldata, value: params.amountIn };
}

// ── Route Handler ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get("action");
  const body = await request.json();

  try {
    const client = getClient();
    const amountEth = String(body.amount || "0");
    const amountIn = parseEther(amountEth);

    if (amountIn <= 0n) {
      return NextResponse.json({ error: "Amount must be greater than 0" }, { status: 400 });
    }

    // ── Quote ──────────────────────────────────────────────────────
    if (action === "quote") {
      const quote = await findBestPool(client, amountIn);

      if (!quote) {
        return NextResponse.json(
          { error: "No liquidity found for ETH → wstETH on the fork" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        amount_in: amountEth,
        amount_out: formatEther(quote.amountOut),
        fee_tier: quote.fee / 10000 + "%",
        token_in: "ETH",
        token_out: "wstETH",
      });
    }

    // ── Execute (impersonate + send on Anvil fork) ──────────────────
    if (action === "execute") {
      const recipient = body.recipient as Address;
      if (!recipient) {
        return NextResponse.json({ error: "Missing recipient address" }, { status: 400 });
      }

      const slippageBps = body.slippage_bps || 50; // 0.5% default

      // Sync fork timestamp
      const now = Math.floor(Date.now() / 1000);
      try {
        await (client as any).request({ method: "anvil_setNextBlockTimestamp", params: [`0x${now.toString(16)}`] });
        await (client as any).request({ method: "anvil_mine", params: ["0x1", "0x0"] });
      } catch { /* not on anvil */ }

      const quote = await findBestPool(client, amountIn);
      if (!quote) {
        return NextResponse.json(
          { error: "No liquidity found for ETH → wstETH on the fork" },
          { status: 404 },
        );
      }

      const amountOutMin = quote.amountOut * BigInt(10000 - slippageBps) / 10000n;
      const deadline = now + 300;

      const { data, value } = buildSwapCalldata({
        fee: quote.fee,
        amountIn,
        amountOutMin,
        recipient,
        deadline,
      });

      // Impersonate the user's address on Anvil and send directly
      await (client as any).request({ method: "anvil_impersonateAccount", params: [recipient] });
      try {
        const walletClient = createWalletClient({ chain: base, transport: http(rpcUrl) });
        const hash = await walletClient.sendTransaction({
          account: recipient,
          to: UNIVERSAL_ROUTER,
          data,
          value,
        });
        const receipt = await client.waitForTransactionReceipt({ hash });

        return NextResponse.json({
          mode: "executed",
          action: "swap_eth_wsteth",
          tx_hash: hash,
          status: receipt.status,
          block_number: receipt.blockNumber.toString(),
          quote: {
            amount_in: amountEth,
            expected_out: formatEther(quote.amountOut),
            minimum_out: formatEther(amountOutMin),
            fee_tier: quote.fee / 10000 + "%",
            slippage_bps: slippageBps,
          },
        });
      } finally {
        await (client as any).request({ method: "anvil_stopImpersonatingAccount", params: [recipient] });
      }
    }

    return NextResponse.json({ error: "Invalid action. Use ?action=quote or ?action=execute" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Swap failed" },
      { status: 500 },
    );
  }
}
