import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseUnits, formatUnits, type Address } from "viem";
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

// ── Helper: resolve token symbol or address ───────────────────────────
function resolveToken(
  tokenInput: string,
  chainId: number
): { address: string; decimals: number } | null {
  // Check if it's a well-known symbol (case-insensitive)
  const match = Object.keys(WELL_KNOWN_TOKENS).find(
    (k) => k.toLowerCase() === tokenInput.toLowerCase()
  );
  if (match && WELL_KNOWN_TOKENS[match]?.[chainId]) {
    return WELL_KNOWN_TOKENS[match][chainId];
  }
  // If it's an address, assume 18 decimals (caller can override)
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
      const amountRaw = parseUnits(amount, inDecimals).toString();

      if (!UNISWAP_API_KEY) {
        // Dry run / no API key — return simulated quote
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
                amount_in_raw: amountRaw,
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
          amount: amountRaw,
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
    "Execute a token swap on Uniswap via the Trading API. Gets a quote and submits the transaction. " +
    "Returns the transaction hash as proof of execution (required for the bounty).",
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

      const amountRaw = parseUnits(amount, tokenInResolved.decimals).toString();

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
              steps: [
                "1. Call /quote to get optimal route and expected output",
                "2. If permit2 signature required, sign the permit",
                "3. Call /swap to get the transaction calldata",
                "4. Submit transaction via wallet",
                "5. Return tx hash as proof of execution",
              ],
            }, null, 2),
          }],
        };
      }

      if (!UNISWAP_API_KEY) {
        return { content: [{ type: "text" as const, text: "Error: No UNISWAP_API_KEY configured." }], isError: true };
      }

      try {
        const swapper = ctx.agentAddress;
        const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address;
        const UNIVERSAL_ROUTER = "0x6fF5693b99212Da76ad316178A184AB56D299b43" as Address;
        const isNativeIn = tokenInResolved.address === "0x0000000000000000000000000000000000000000";

        const ERC20_APPROVE_ABI = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] }] as const;
        const ERC20_ALLOWANCE_ABI = [{ name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] }] as const;
        const PERMIT2_APPROVE_ABI = [{ name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "spender", type: "address" }, { name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }], outputs: [] }] as const;
        const PERMIT2_ALLOWANCE_ABI = [{ name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "user", type: "address" }, { name: "token", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "amount", type: "uint160" }, { name: "expiration", type: "uint48" }, { name: "nonce", type: "uint48" }] }] as const;

        // Build list of unsigned txs (for third-party) or execute directly (first-party)
        const unsignedTxs: Array<{ to: Address; data: `0x${string}`; value: string; chainId: number; meta: { tool: string; description: string } }> = [];

        // Step 0a: Check ERC-20 approval for Permit2
        if (!isNativeIn) {
          const allowance = await ctx.publicClient.readContract({
            address: tokenInResolved.address as Address,
            abi: ERC20_ALLOWANCE_ABI,
            functionName: "allowance",
            args: [swapper, PERMIT2],
          });
          if (allowance < BigInt(amountRaw)) {
            if (ctx.walletClient) {
              const approveTx = await ctx.walletClient.writeContract({
                account: ctx.walletAccount!,
                chain: ctx.chain,
                address: tokenInResolved.address as Address,
                abi: ERC20_APPROVE_ABI,
                functionName: "approve",
                args: [PERMIT2, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
              });
              await ctx.publicClient.waitForTransactionReceipt({ hash: approveTx });
            } else {
              const { encodeFunctionData } = await import("viem");
              unsignedTxs.push({
                to: tokenInResolved.address as Address,
                data: encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [PERMIT2, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")] }),
                value: "0",
                chainId: ctx.chain.id,
                meta: { tool: "uniswap_swap", description: `Approve Permit2 to spend ${token_in}` },
              });
            }
          }

          // Step 0b: Check Permit2 allowance for Universal Router
          const permit2Allowance = await ctx.publicClient.readContract({
            address: PERMIT2,
            abi: PERMIT2_ALLOWANCE_ABI,
            functionName: "allowance",
            args: [swapper, tokenInResolved.address as Address, UNIVERSAL_ROUTER],
          });
          const [p2Amount, p2Expiration] = permit2Allowance as [bigint, number, number];
          const now = Math.floor(Date.now() / 1000);
          if (p2Amount < BigInt(amountRaw) || p2Expiration < now + 60) {
            const p2Args = [
              tokenInResolved.address as Address,
              UNIVERSAL_ROUTER,
              BigInt("0x00000000000000000000000000000000ffffffffffffffffffffffffffffffff") as unknown as bigint,
              BigInt(now + 60 * 60 * 24 * 365) as unknown as bigint,
            ] as const;
            if (ctx.walletClient) {
              const p2ApproveTx = await ctx.walletClient.writeContract({
                account: ctx.walletAccount!,
                chain: ctx.chain,
                address: PERMIT2,
                abi: PERMIT2_APPROVE_ABI,
                functionName: "approve",
                args: p2Args,
              });
              await ctx.publicClient.waitForTransactionReceipt({ hash: p2ApproveTx });
            } else {
              const { encodeFunctionData } = await import("viem");
              unsignedTxs.push({
                to: PERMIT2,
                data: encodeFunctionData({ abi: PERMIT2_APPROVE_ABI, functionName: "approve", args: p2Args }),
                value: "0",
                chainId: ctx.chain.id,
                meta: { tool: "uniswap_swap", description: `Approve Universal Router on Permit2 for ${token_in}` },
              });
            }
          }
        }

        // Step 1: Get quote
        const quoteResponse = await uniswapFetch("/quote", {
          type: "EXACT_INPUT",
          tokenInChainId: chainId,
          tokenOutChainId: chainId,
          tokenIn: tokenInResolved.address,
          tokenOut: tokenOutResolved.address,
          amount: amountRaw,
          swapper,
          slippageTolerance: slippage / 100,
          configs: [{ routingType: "CLASSIC", protocols: ["V3", "V2"] }],
        });

        const quoteId = quoteResponse.quote?.quoteId;
        if (!quoteId) {
          return {
            content: [{ type: "text" as const, text: `Error: No quoteId returned. Response: ${JSON.stringify(quoteResponse)}` }],
            isError: true,
          };
        }

        // Step 2: Get swap calldata (without permit data)
        const { permitData: _pd, ...cleanQuote } = quoteResponse;
        const swapBody: Record<string, unknown> = {
          ...cleanQuote,
          simulateTransaction: false,
        };

        const swapResponse = await uniswapFetch("/swap", swapBody);

        const tx = swapResponse.swap;
        if (!tx) {
          return {
            content: [{ type: "text" as const, text: `Error: No swap tx data returned. Response: ${JSON.stringify(swapResponse)}` }],
            isError: true,
          };
        }

        // Step 3: Execute or return unsigned
        if (ctx.walletClient) {
          const hash = await ctx.walletClient.sendTransaction({
            account: ctx.walletAccount!,
            chain: ctx.chain,
            to: tx.to as Address,
            data: tx.data as `0x${string}`,
            value: tx.value ? BigInt(tx.value) : 0n,
          });

          const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                mode: "executed",
                action: "uniswap_swap",
                token_in: { symbol: token_in, address: tokenInResolved.address },
                token_out: { symbol: token_out, address: tokenOutResolved.address },
                amount_in: amount,
                tx_hash: hash,
                block_number: receipt.blockNumber.toString(),
                status: receipt.status,
                chain_id: chainId,
                explorer: `https://basescan.org/tx/${hash}`,
              }, null, 2),
            }],
          };
        }

        // Third-party: add the swap tx to the list
        unsignedTxs.push({
          to: tx.to as Address,
          data: tx.data as `0x${string}`,
          value: tx.value ? BigInt(tx.value).toString() : "0",
          chainId: ctx.chain.id,
          meta: { tool: "uniswap_swap", description: `Swap ${amount} ${token_in} → ${token_out}` },
        });

        const amountOut = quoteResponse.quote?.amountOut
          ? formatUnits(BigInt(quoteResponse.quote.amountOut), tokenOutResolved.decimals)
          : "unknown";

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "unsigned_transaction",
              action: "uniswap_swap",
              token_in: { symbol: token_in, address: tokenInResolved.address },
              token_out: { symbol: token_out, address: tokenOutResolved.address },
              amount_in: amount,
              expected_out: amountOut,
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
