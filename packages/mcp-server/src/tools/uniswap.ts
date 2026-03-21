import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseUnits, formatUnits, encodePacked, encodeFunctionData, concat, pad, toHex, type Address } from "viem";
import type { AgentGateContext } from "../context.js";

// ── Uniswap Trading API ───────────────────────────────────────────────
// Docs: https://api-docs.uniswap.org/
// Requires a Developer Platform API key from https://app.uniswap.org/developers
const UNISWAP_API_BASE = "https://trade-api.gateway.uniswap.org/v1";
const UNISWAP_API_KEY = process.env.UNISWAP_API_KEY || "";

// Base mainnet token addresses
const WELL_KNOWN_TOKENS: Record<string, Record<number, { address: string; decimals: number }>> = {
  ETH:    { 8453: { address: "0x0000000000000000000000000000000000000000", decimals: 18 } },
  WETH:   { 8453: { address: "0x4200000000000000000000000000000000000006", decimals: 18 } },
  USDC:   { 8453: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 } },
  DAI:    { 8453: { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 } },
  wstETH: { 8453: { address: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", decimals: 18 } },
  cbETH:  { 8453: { address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18 } },
};

const WETH_ADDR = "0x4200000000000000000000000000000000000006" as Address;
const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43" as Address;
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
const QUOTER_V2 = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as Address;
const FEE_TIERS = [100, 500, 3000, 10000] as const;

// ── ABIs ──────────────────────────────────────────────────────────────

const ERC20_APPROVE_ABI = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
const ERC20_ALLOWANCE_ABI = [{ name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const;
const PERMIT2_APPROVE_ABI = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }], outputs: [] }] as const;
const PERMIT2_ALLOWANCE_ABI = [{ name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "token", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }, { name: "nonce", type: "uint48" }] }] as const;

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

// ── Helper: resolve token symbol or address ───────────────────────────
function resolveToken(
  tokenInput: string,
  chainId: number
): { address: string; decimals: number } | null {
  const match = Object.keys(WELL_KNOWN_TOKENS).find(
    (k) => k.toLowerCase() === tokenInput.toLowerCase()
  );
  if (match && WELL_KNOWN_TOKENS[match]?.[chainId]) {
    return WELL_KNOWN_TOKENS[match][chainId];
  }
  if (tokenInput.startsWith("0x") && tokenInput.length === 42) {
    return { address: tokenInput, decimals: 18 };
  }
  return null;
}

// ── Helper: call Uniswap API ──────────────────────────────────────────
async function uniswapFetch(endpoint: string, body: object) {
  const res = await fetch(`${UNISWAP_API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": UNISWAP_API_KEY,
      "x-universal-router-version": "2.0",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Uniswap API ${res.status}: ${errText}`);
  }

  return res.json();
}

// ── Helper: detect Anvil fork ─────────────────────────────────────────
async function isAnvilFork(publicClient: any): Promise<boolean> {
  try {
    await publicClient.request({ method: "anvil_nodeInfo", params: [] });
    return true;
  } catch {
    return false;
  }
}

// ── Helper: find best pool + quote on fork via QuoterV2 ───────────────
async function forkQuote(
  publicClient: any,
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
): Promise<{ amountOut: bigint; fee: number } | null> {
  let bestOut = 0n;
  let bestFee = 0;

  for (const fee of FEE_TIERS) {
    try {
      const result = await publicClient.simulateContract({
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
    } catch { /* pool doesn't exist or has no liquidity at this fee tier */ }
  }

  return bestOut > 0n ? { amountOut: bestOut, fee: bestFee } : null;
}

// ── Helper: build Universal Router calldata for a V3 swap ─────────────
function buildSwapCalldata(params: {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  amountIn: bigint;
  amountOutMin: bigint;
  recipient: Address;
  isNativeIn: boolean;
  deadline: number;
}): { data: `0x${string}`; value: bigint } {
  // V3 swap path: tokenIn (20 bytes) + fee (3 bytes) + tokenOut (20 bytes)
  const actualTokenIn = params.isNativeIn ? WETH_ADDR : params.tokenIn;
  const path = encodePacked(
    ["address", "uint24", "address"],
    [actualTokenIn, params.fee, params.tokenOut],
  );

  if (params.isNativeIn) {
    // Commands: WRAP_ETH (0x0b) + V3_SWAP_EXACT_IN (0x00)
    const commands = "0x0b00" as `0x${string}`;

    // WRAP_ETH input: abi.encode(address recipient, uint256 amountMin)
    const wrapInput = encodePacked(
      ["bytes32", "bytes32"],
      [
        pad(("0x0000000000000000000000000000000000000002") as `0x${string}`), // ADDRESS_THIS (router holds WETH)
        pad(toHex(params.amountIn)),
      ],
    );

    // V3_SWAP_EXACT_IN input: abi.encode(address recipient, uint256 amountIn, uint256 amountOutMinimum, bytes path, bool payerIsUser)
    // For WRAP_ETH flow, payerIsUser = false (router pays from wrapped ETH)
    const swapInput = concat([
      pad(params.recipient as `0x${string}`),
      pad(toHex(params.amountIn)),
      pad(toHex(params.amountOutMin)),
      pad(toHex(160, { size: 32 })), // offset to path (5 * 32 = 160)
      pad("0x00" as `0x${string}`), // payerIsUser = false
      pad(toHex(path.length / 2 - 1, { size: 32 })), // path length in bytes
      // pad path to 32 bytes
      (path + "0".repeat(64 - (path.length - 2))) as `0x${string}`,
    ]);

    const routerCalldata = encodeFunctionData({
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: "execute",
      args: [commands, [wrapInput, swapInput], BigInt(params.deadline)],
    });

    return { data: routerCalldata, value: params.amountIn };
  }

  // ERC20 input: just V3_SWAP_EXACT_IN (0x00)
  const commands = "0x00" as `0x${string}`;

  const swapInput = concat([
    pad(params.recipient as `0x${string}`),
    pad(toHex(params.amountIn)),
    pad(toHex(params.amountOutMin)),
    pad(toHex(160, { size: 32 })), // offset to path
    pad(toHex(1, { size: 32 })), // payerIsUser = true
    pad(toHex(path.length / 2 - 1, { size: 32 })),
    (path + "0".repeat(64 - (path.length - 2))) as `0x${string}`,
  ]);

  const routerCalldata = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: "execute",
    args: [commands, [swapInput], BigInt(params.deadline)],
  });

  return { data: routerCalldata, value: 0n };
}

// ── Register Uniswap tools ────────────────────────────────────────────
export function registerUniswapTools(server: McpServer, ctx: AgentGateContext) {

  // ── uniswap_quote: Get a swap quote ─────────────────────────────────
  server.tool(
    "uniswap_quote",
    "Get a swap quote from Uniswap. Returns the expected output amount, route, and gas estimate. " +
    "Supports token symbols (WETH, USDC, stETH, wstETH, DAI, USDT) or contract addresses.",
    {
      token_in: z.string().describe("Input token — symbol (e.g. 'wstETH') or contract address"),
      token_out: z.string().describe("Output token — symbol (e.g. 'USDC') or contract address"),
      amount: z.string().describe("Amount of input token to swap (human-readable, e.g. '1.5')"),
      token_in_decimals: z.number().optional().describe("Decimals for token_in (auto-detected for known tokens)"),
      token_out_decimals: z.number().optional().describe("Decimals for token_out (auto-detected for known tokens)"),
      slippage_bps: z.number().optional().describe("Slippage tolerance in basis points (default: 50 = 0.5%)"),
    },
    async ({ token_in, token_out, amount, token_in_decimals, token_out_decimals, slippage_bps }) => {
      const chainId = ctx.chain.id;
      const slippage = slippage_bps || 50;

      const tokenInResolved = resolveToken(token_in, chainId);
      const tokenOutResolved = resolveToken(token_out, chainId);

      if (!tokenInResolved) {
        return {
          content: [{ type: "text" as const, text: `Error: Cannot resolve token_in "${token_in}" on chain ${chainId}. Provide a contract address or use a known symbol.` }],
          isError: true,
        };
      }
      if (!tokenOutResolved) {
        return {
          content: [{ type: "text" as const, text: `Error: Cannot resolve token_out "${token_out}" on chain ${chainId}. Provide a contract address or use a known symbol.` }],
          isError: true,
        };
      }

      const inDecimals = token_in_decimals || tokenInResolved.decimals;
      const outDecimals = token_out_decimals || tokenOutResolved.decimals;
      const amountRaw = parseUnits(amount, inDecimals);

      // On Anvil fork: quote against the fork's pool state directly
      const isFork = await isAnvilFork(ctx.publicClient);
      if (isFork) {
        const actualIn = tokenInResolved.address === "0x0000000000000000000000000000000000000000"
          ? WETH_ADDR : tokenInResolved.address as Address;
        const quote = await forkQuote(ctx.publicClient, actualIn, tokenOutResolved.address as Address, amountRaw);

        if (!quote) {
          return {
            content: [{ type: "text" as const, text: `Error: No liquidity found on fork for ${token_in} → ${token_out} across any fee tier.` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "fork_quote",
              token_in: { symbol: token_in, address: tokenInResolved.address },
              token_out: { symbol: token_out, address: tokenOutResolved.address },
              amount_in: amount,
              amount_out: formatUnits(quote.amountOut, outDecimals),
              fee_tier: quote.fee / 10000 + "%",
              slippage_bps: slippage,
              chain_id: chainId,
              note: "Quoted against fork's pool state via QuoterV2 contract.",
            }, null, 2),
          }],
        };
      }

      if (!UNISWAP_API_KEY) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "simulated",
              note: "No UNISWAP_API_KEY configured. Set it in env to get real quotes.",
              request: {
                token_in: { symbol: token_in, address: tokenInResolved.address, decimals: inDecimals },
                token_out: { symbol: token_out, address: tokenOutResolved.address, decimals: outDecimals },
                amount_in: amount,
                amount_in_raw: amountRaw.toString(),
                chain_id: chainId,
                slippage_bps: slippage,
              },
              api_endpoint: `${UNISWAP_API_BASE}/quote`,
              how_to_get_key: "Sign up at https://app.uniswap.org/developers",
            }, null, 2),
          }],
        };
      }

      try {
        const swapper = ctx.agentAddress;

        const quoteResponse = await uniswapFetch("/quote", {
          type: "EXACT_INPUT",
          tokenInChainId: chainId,
          tokenOutChainId: chainId,
          tokenIn: tokenInResolved.address,
          tokenOut: tokenOutResolved.address,
          amount: amountRaw.toString(),
          swapper,
          slippageTolerance: slippage / 100,
          configs: [{ routingType: "CLASSIC", protocols: ["V3", "V2"] }],
        });

        const amountOut = quoteResponse.quote?.amountOut
          ? formatUnits(BigInt(quoteResponse.quote.amountOut), outDecimals)
          : "unknown";

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "live_quote",
              token_in: { symbol: token_in, address: tokenInResolved.address },
              token_out: { symbol: token_out, address: tokenOutResolved.address },
              amount_in: amount,
              amount_out: amountOut,
              gas_estimate: quoteResponse.quote?.gasEstimate || "unknown",
              route: quoteResponse.quote?.route || [],
              slippage_bps: slippage,
              chain_id: chainId,
              quote_id: quoteResponse.quote?.quoteId,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Uniswap quote error: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── uniswap_swap: Execute a swap ────────────────────────────────────
  server.tool(
    "uniswap_swap",
    "Execute a token swap on Uniswap. On Anvil forks, quotes and routes directly against fork pool state. " +
    "On mainnet, uses the Uniswap Trading API. Returns transaction hash or unsigned transactions for third-party agents.",
    {
      token_in: z.string().describe("Input token — symbol or contract address"),
      token_out: z.string().describe("Output token — symbol or contract address"),
      amount: z.string().describe("Amount of input token to swap"),
      slippage_bps: z.number().optional().describe("Slippage tolerance in basis points (default: 50)"),
      dry_run: z.boolean().optional(),
    },
    async ({ token_in, token_out, amount, slippage_bps, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const chainId = ctx.chain.id;
      const slippage = slippage_bps || 50;

      const tokenInResolved = resolveToken(token_in, chainId);
      const tokenOutResolved = resolveToken(token_out, chainId);

      if (!tokenInResolved || !tokenOutResolved) {
        return {
          content: [{ type: "text" as const, text: "Error: Cannot resolve one or both tokens." }],
          isError: true,
        };
      }

      const amountIn = parseUnits(amount, tokenInResolved.decimals);
      const isNativeIn = tokenInResolved.address === "0x0000000000000000000000000000000000000000";

      if (isDry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "uniswap_swap",
              token_in: { symbol: token_in, address: tokenInResolved.address },
              token_out: { symbol: token_out, address: tokenOutResolved.address },
              amount_in: amount,
              slippage_bps: slippage,
              chain_id: chainId,
            }, null, 2),
          }],
        };
      }

      const swapper = ctx.agentAddress;
      const isFork = await isAnvilFork(ctx.publicClient);

      try {
        // ── Fork path: quote + route against fork's pool state ──────
        if (isFork) {
          // Sync timestamp
          const now = Math.floor(Date.now() / 1000);
          try {
            await (ctx.publicClient as any).request({ method: "anvil_setNextBlockTimestamp", params: [`0x${now.toString(16)}`] });
            await (ctx.publicClient as any).request({ method: "anvil_mine", params: ["0x1", "0x0"] });
          } catch { /* ignore */ }

          const actualIn = isNativeIn ? WETH_ADDR : tokenInResolved.address as Address;
          const quote = await forkQuote(ctx.publicClient, actualIn, tokenOutResolved.address as Address, amountIn);

          if (!quote) {
            return {
              content: [{ type: "text" as const, text: `Error: No liquidity on fork for ${token_in} → ${token_out} across fee tiers [${FEE_TIERS.join(", ")}].` }],
              isError: true,
            };
          }

          const amountOutMin = quote.amountOut * BigInt(10000 - slippage) / 10000n;
          const deadline = now + 300; // 5 minutes

          // Handle ERC20 approvals
          const unsignedTxs: Array<{ to: Address; data: `0x${string}`; value: string; chainId: number; meta: { tool: string; description: string } }> = [];

          if (!isNativeIn) {
            const allowance = await ctx.publicClient.readContract({
              address: tokenInResolved.address as Address,
              abi: ERC20_ALLOWANCE_ABI,
              functionName: "allowance",
              args: [swapper, PERMIT2],
            });
            if (allowance < amountIn) {
              if (ctx.walletClient) {
                const tx = await ctx.walletClient.writeContract({
                  account: ctx.walletAccount!, chain: ctx.chain,
                  address: tokenInResolved.address as Address, abi: ERC20_APPROVE_ABI,
                  functionName: "approve",
                  args: [PERMIT2, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
                });
                await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
              } else {
                unsignedTxs.push({
                  to: tokenInResolved.address as Address,
                  data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [PERMIT2, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")] }),
                  value: "0", chainId, meta: { tool: "uniswap_swap", description: `Approve Permit2 to spend ${token_in}` },
                });
              }
            }

            const permit2Allowance = await ctx.publicClient.readContract({
              address: PERMIT2, abi: PERMIT2_ALLOWANCE_ABI, functionName: "allowance",
              args: [swapper, tokenInResolved.address as Address, UNIVERSAL_ROUTER],
            });
            const [p2Amount, p2Expiration] = permit2Allowance as [bigint, number, number];
            if (p2Amount < amountIn || p2Expiration < now + 60) {
              const p2Args = [
                tokenInResolved.address as Address, UNIVERSAL_ROUTER,
                BigInt("0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff") as unknown as bigint,
                (now + 60 * 60 * 24 * 365) as number,
              ] as const;
              if (ctx.walletClient) {
                const tx = await ctx.walletClient.writeContract({
                  account: ctx.walletAccount!, chain: ctx.chain,
                  address: PERMIT2, abi: PERMIT2_APPROVE_ABI, functionName: "approve", args: p2Args,
                });
                await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
              } else {
                unsignedTxs.push({
                  to: PERMIT2,
                  data: encodeFunctionData({ abi: PERMIT2_APPROVE_ABI, functionName: "approve", args: p2Args }),
                  value: "0", chainId, meta: { tool: "uniswap_swap", description: `Approve Universal Router on Permit2 for ${token_in}` },
                });
              }
            }
          }

          // Build Universal Router calldata
          const { data: routerCalldata, value: txValue } = buildSwapCalldata({
            tokenIn: tokenInResolved.address as Address,
            tokenOut: tokenOutResolved.address as Address,
            fee: quote.fee,
            amountIn,
            amountOutMin,
            recipient: swapper,
            isNativeIn,
            deadline,
          });

          if (ctx.walletClient) {
            const hash = await ctx.walletClient.sendTransaction({
              account: ctx.walletAccount!, chain: ctx.chain,
              to: UNIVERSAL_ROUTER, data: routerCalldata, value: txValue,
            });
            const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

            return {
              content: [{
                type: "text" as const,
                text: JSON.stringify({
                  mode: "executed",
                  action: "uniswap_swap",
                  method: "fork_direct",
                  token_in: { symbol: token_in, address: tokenInResolved.address },
                  token_out: { symbol: token_out, address: tokenOutResolved.address },
                  amount_in: amount,
                  expected_out: formatUnits(quote.amountOut, tokenOutResolved.decimals),
                  fee_tier: quote.fee / 10000 + "%",
                  tx_hash: hash,
                  block_number: receipt.blockNumber.toString(),
                  status: receipt.status,
                  chain_id: chainId,
                  explorer: `https://basescan.org/tx/${hash}`,
                }, null, 2),
              }],
            };
          }

          // Third-party: return unsigned txs
          unsignedTxs.push({
            to: UNIVERSAL_ROUTER, data: routerCalldata,
            value: txValue.toString(), chainId,
            meta: { tool: "uniswap_swap", description: `Swap ${amount} ${token_in} → ${token_out} (${quote.fee / 10000}% pool)` },
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                mode: "unsigned_transaction",
                action: "uniswap_swap",
                method: "fork_direct",
                token_in: { symbol: token_in, address: tokenInResolved.address },
                token_out: { symbol: token_out, address: tokenOutResolved.address },
                amount_in: amount,
                expected_out: formatUnits(quote.amountOut, tokenOutResolved.decimals),
                fee_tier: quote.fee / 10000 + "%",
                transactions: unsignedTxs,
                instructions: "Sign and submit these transactions in order. Each must confirm before sending the next.",
              }, null, 2),
            }],
          };
        }

        // ── Mainnet path: use Uniswap Trading API ───────────────────
        if (!UNISWAP_API_KEY) {
          return { content: [{ type: "text" as const, text: "Error: No UNISWAP_API_KEY configured." }], isError: true };
        }

        const unsignedTxs: Array<{ to: Address; data: `0x${string}`; value: string; chainId: number; meta: { tool: string; description: string } }> = [];

        // Approvals for ERC20 input
        if (!isNativeIn) {
          const allowance = await ctx.publicClient.readContract({
            address: tokenInResolved.address as Address, abi: ERC20_ALLOWANCE_ABI,
            functionName: "allowance", args: [swapper, PERMIT2],
          });
          if (allowance < amountIn) {
            if (ctx.walletClient) {
              const tx = await ctx.walletClient.writeContract({
                account: ctx.walletAccount!, chain: ctx.chain,
                address: tokenInResolved.address as Address, abi: ERC20_APPROVE_ABI,
                functionName: "approve",
                args: [PERMIT2, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
              });
              await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
            } else {
              unsignedTxs.push({
                to: tokenInResolved.address as Address,
                data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [PERMIT2, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")] }),
                value: "0", chainId, meta: { tool: "uniswap_swap", description: `Approve Permit2 to spend ${token_in}` },
              });
            }
          }

          const permit2Allowance = await ctx.publicClient.readContract({
            address: PERMIT2, abi: PERMIT2_ALLOWANCE_ABI, functionName: "allowance",
            args: [swapper, tokenInResolved.address as Address, UNIVERSAL_ROUTER],
          });
          const [p2Amount, p2Expiration] = permit2Allowance as [bigint, number, number];
          const now = Math.floor(Date.now() / 1000);
          if (p2Amount < amountIn || p2Expiration < now + 60) {
            const p2Args = [
              tokenInResolved.address as Address, UNIVERSAL_ROUTER,
              BigInt("0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff") as unknown as bigint,
              (now + 60 * 60 * 24 * 365) as number,
            ] as const;
            if (ctx.walletClient) {
              const tx = await ctx.walletClient.writeContract({
                account: ctx.walletAccount!, chain: ctx.chain,
                address: PERMIT2, abi: PERMIT2_APPROVE_ABI, functionName: "approve", args: p2Args,
              });
              await ctx.publicClient.waitForTransactionReceipt({ hash: tx });
            } else {
              unsignedTxs.push({
                to: PERMIT2,
                data: encodeFunctionData({ abi: PERMIT2_APPROVE_ABI, functionName: "approve", args: p2Args }),
                value: "0", chainId, meta: { tool: "uniswap_swap", description: `Approve Universal Router on Permit2 for ${token_in}` },
              });
            }
          }
        }

        // Quote + swap via API
        const quoteResponse = await uniswapFetch("/quote", {
          type: "EXACT_INPUT",
          tokenInChainId: chainId, tokenOutChainId: chainId,
          tokenIn: tokenInResolved.address, tokenOut: tokenOutResolved.address,
          amount: amountIn.toString(), swapper,
          slippageTolerance: slippage / 100,
          configs: [{ routingType: "CLASSIC", protocols: ["V3", "V2"] }],
        });

        const quoteId = quoteResponse.quote?.quoteId;
        if (!quoteId) {
          return { content: [{ type: "text" as const, text: `Error: No quoteId returned. Response: ${JSON.stringify(quoteResponse)}` }], isError: true };
        }

        const { permitData: _pd, ...cleanQuote } = quoteResponse;
        const swapResponse = await uniswapFetch("/swap", { ...cleanQuote, simulateTransaction: false });

        const tx = swapResponse.swap;
        if (!tx) {
          return { content: [{ type: "text" as const, text: `Error: No swap tx data returned. Response: ${JSON.stringify(swapResponse)}` }], isError: true };
        }

        if (ctx.walletClient) {
          const hash = await ctx.walletClient.sendTransaction({
            account: ctx.walletAccount!, chain: ctx.chain,
            to: tx.to as Address, data: tx.data as `0x${string}`,
            value: tx.value ? BigInt(tx.value) : 0n,
          });
          const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                mode: "executed", action: "uniswap_swap", method: "trading_api",
                token_in: { symbol: token_in, address: tokenInResolved.address },
                token_out: { symbol: token_out, address: tokenOutResolved.address },
                amount_in: amount, tx_hash: hash,
                block_number: receipt.blockNumber.toString(),
                status: receipt.status, chain_id: chainId,
                explorer: `https://basescan.org/tx/${hash}`,
              }, null, 2),
            }],
          };
        }

        // Third-party: return unsigned
        unsignedTxs.push({
          to: tx.to as Address, data: tx.data as `0x${string}`,
          value: tx.value ? BigInt(tx.value).toString() : "0", chainId,
          meta: { tool: "uniswap_swap", description: `Swap ${amount} ${token_in} → ${token_out}` },
        });

        const amountOut = quoteResponse.quote?.amountOut
          ? formatUnits(BigInt(quoteResponse.quote.amountOut), tokenOutResolved.decimals) : "unknown";

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "unsigned_transaction", action: "uniswap_swap", method: "trading_api",
              token_in: { symbol: token_in, address: tokenInResolved.address },
              token_out: { symbol: token_out, address: tokenOutResolved.address },
              amount_in: amount, expected_out: amountOut,
              transactions: unsignedTxs,
              instructions: "Sign and submit these transactions in order. Each must confirm before sending the next.",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Uniswap swap error: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── uniswap_tokens: List common tokens for a chain ──────────────────
  server.tool(
    "uniswap_tokens",
    "List well-known tokens available for Uniswap swaps on the current chain, with their addresses and decimals.",
    {},
    async () => {
      const chainId = ctx.chain.id;
      const tokens: Record<string, { address: string; decimals: number }> = {};

      for (const [symbol, chains] of Object.entries(WELL_KNOWN_TOKENS)) {
        if (chains[chainId]) {
          tokens[symbol] = chains[chainId];
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            chain_id: chainId,
            chain_name: ctx.chain.name,
            tokens,
            note: "You can also pass any ERC-20 contract address directly to uniswap_quote/uniswap_swap.",
          }, null, 2),
        }],
      };
    }
  );
}
