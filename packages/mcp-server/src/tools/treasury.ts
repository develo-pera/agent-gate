import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseEther, formatEther, type Address } from "viem";
import type { AgentGateContext } from "../context.js";
import { executeOrPrepare } from "../execute-or-prepare";

// ── AgentTreasury contract ABI (Chainlink oracle + configurable spender permissions) ──
const TREASURY_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    name: "withdrawYield",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "wstETHAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "withdrawYieldFor",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "recipient", type: "address" },
      { name: "wstETHAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "withdrawAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "authorizeSpender",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "yieldOnly", type: "bool" },
      { name: "maxPerTx", type: "uint256" },
      { name: "windowDuration", type: "uint40" },
      { name: "windowAllowance", type: "uint256" },
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
  {
    name: "setRecipientWhitelist",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "enabled", type: "bool" }],
    outputs: [],
  },
  {
    name: "setAllowedRecipient",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "allowed", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "getVaultStatus",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "depositedPrincipal", type: "uint256" },
      { name: "availableYield", type: "uint256" },
      { name: "totalBalance", type: "uint256" },
      { name: "hasVault", type: "bool" },
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
    name: "getSpenderConfig",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "agent", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [
      { name: "authorized", type: "bool" },
      { name: "yieldOnly", type: "bool" },
      { name: "maxPerTx", type: "uint256" },
      { name: "spentInWindow", type: "uint256" },
      { name: "windowStart", type: "uint40" },
      { name: "windowDuration", type: "uint40" },
      { name: "windowAllowance", type: "uint256" },
    ],
  },
  {
    name: "getCurrentRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "recipientWhitelistEnabled",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowedRecipients",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  // ── Custom errors ────────────────────────────────────────────────
  { name: "NotAuthorized", type: "error", inputs: [] },
  { name: "InsufficientYield", type: "error", inputs: [{ name: "requested", type: "uint256" }, { name: "available", type: "uint256" }] },
  { name: "ExceedsPerTxCap", type: "error", inputs: [{ name: "requested", type: "uint256" }, { name: "cap", type: "uint256" }] },
  { name: "ExceedsWindowAllowance", type: "error", inputs: [{ name: "requested", type: "uint256" }, { name: "remaining", type: "uint256" }] },
  { name: "RecipientNotWhitelisted", type: "error", inputs: [{ name: "recipient", type: "address" }] },
  { name: "ZeroAmount", type: "error", inputs: [] },
  { name: "NoVault", type: "error", inputs: [] },
  { name: "StaleOracle", type: "error", inputs: [] },
] as const;

// ── Human-readable error decoder ──────────────────────────────────
function decodeTreasuryError(e: any): string {
  const msg = e?.shortMessage || e?.message || e?.toString() || "unknown error";
  // Clean up viem verbose errors
  const short = msg.split("\nContract Call:")[0].split("\nDocs:")[0].trim();
  return short.length < 500 ? short : msg.slice(0, 500) + "...";
}

export function registerTreasuryTools(server: McpServer, ctx: AgentGateContext) {
  const TREASURY_ADDR = (process.env.TREASURY_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;

  // ── treasury_deposit ────────────────────────────────────────────────
  server.tool(
    "treasury_deposit",
    "Deposit wstETH into the AgentTreasury. Principal is locked — only yield (tracked via Chainlink oracle) can be spent by authorized agents.",
    {
      amount_wsteth: z.string().describe("Amount of wstETH to deposit (e.g. '0.01')"),
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
              note: "Will deposit wstETH. Principal is locked; only yield accrued via wstETH/stETH exchange rate appreciation can be withdrawn. Rate is read from Chainlink oracle on Base.",
            }, null, 2),
          }],
        };
      }

      try {
        const result = await executeOrPrepare(ctx, {
          address: TREASURY_ADDR,
          abi: TREASURY_ABI as any,
          functionName: "deposit",
          args: [amount],
        }, "treasury_deposit", "Deposit wstETH into the AgentTreasury");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, action: "treasury_deposit", amount_wsteth }, null, 2),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${decodeTreasuryError(e)}` }], isError: true };
      }
    }
  );

  // ── treasury_status ─────────────────────────────────────────────────
  server.tool(
    "treasury_status",
    "Check an agent's vault: deposited principal, available yield (from Chainlink oracle), total balance, and current wstETH/stETH exchange rate.",
    {
      agent_address: z.string().describe("Agent address to check vault status for"),
    },
    async ({ agent_address }) => {
      if (TREASURY_ADDR === "0x0000000000000000000000000000000000000000") {
        return {
          content: [{ type: "text" as const, text: "Error: TREASURY_ADDRESS not configured." }],
          isError: true,
        };
      }

      try {
        const [vaultResult, rateResult] = await Promise.all([
          ctx.publicClient.readContract({
            address: TREASURY_ADDR,
            abi: TREASURY_ABI,
            functionName: "getVaultStatus",
            args: [agent_address as Address],
          }),
          ctx.publicClient.readContract({
            address: TREASURY_ADDR,
            abi: TREASURY_ABI,
            functionName: "getCurrentRate",
          }),
        ]);

        const [depositedPrincipal, availableYield, totalBalance, hasVault] = vaultResult;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              agent: agent_address,
              has_vault: hasVault,
              principal_wsteth: formatEther(depositedPrincipal),
              available_yield_wsteth: formatEther(availableYield),
              total_balance_wsteth: formatEther(totalBalance),
              yield_percentage: depositedPrincipal > 0n
                ? ((Number(availableYield) / Number(depositedPrincipal)) * 100).toFixed(4) + "%"
                : "0%",
              chainlink_rate: formatEther(rateResult),
              rate_meaning: `1 wstETH = ${formatEther(rateResult)} stETH`,
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

  // ── treasury_authorize_spender ──────────────────────────────────────
  server.tool(
    "treasury_authorize_spender",
    "Authorize another agent to spend yield from your vault with configurable limits: per-tx cap, time-window budget, and optional recipient whitelist. " +
    "Supports multi-agent yield budget delegation — parent agent sets different spending tiers for each sub-agent.",
    {
      spender: z.string().describe("Address to authorize as yield spender"),
      yield_only: z.boolean().optional().describe("If true (default), spender can only access yield, never principal"),
      max_per_tx: z.string().optional().describe("Max wstETH per transaction (e.g. '0.001'). 0 or omit = unlimited"),
      window_duration_seconds: z.number().optional().describe("Time window in seconds for spending limit (e.g. 3600 = 1 hour). 0 or omit = no window"),
      window_allowance: z.string().optional().describe("Max wstETH spendable per window (e.g. '0.005'). 0 or omit = unlimited"),
      dry_run: z.boolean().optional(),
    },
    async ({ spender, yield_only, max_per_tx, window_duration_seconds, window_allowance, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const yieldOnly = yield_only ?? true;
      const maxPerTx = max_per_tx ? parseEther(max_per_tx) : 0n;
      const windowDuration = BigInt(window_duration_seconds ?? 0);
      const windowAllow = window_allowance ? parseEther(window_allowance) : 0n;

      if (isDry) {
        const limits: string[] = [];
        if (maxPerTx > 0n) limits.push(`max ${max_per_tx} wstETH per tx`);
        if (windowDuration > 0n && windowAllow > 0n) limits.push(`max ${window_allowance} wstETH per ${windowDuration}s window`);
        if (limits.length === 0) limits.push("unlimited");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "authorize_spender",
              spender,
              yield_only: yieldOnly,
              limits: limits.join(", "),
              note: `Will authorize ${spender} to spend ${yieldOnly ? "yield only" : "full balance"} with limits: ${limits.join(", ")}`,
            }, null, 2),
          }],
        };
      }

      try {
        const result = await executeOrPrepare(ctx, {
          address: TREASURY_ADDR,
          abi: TREASURY_ABI as any,
          functionName: "authorizeSpender",
          args: [spender as Address, yieldOnly, maxPerTx, windowDuration, windowAllow],
        }, "treasury_authorize_spender", "Authorize a spender on your AgentTreasury vault");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              ...result,
              action: "authorize_spender",
              spender,
              yield_only: yieldOnly,
              max_per_tx: max_per_tx || "unlimited",
              window_duration: Number(windowDuration) || "none",
              window_allowance: window_allowance || "unlimited",
            }, null, 2),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${decodeTreasuryError(e)}` }], isError: true };
      }
    }
  );

  // ── treasury_revoke_spender ──────────────────────────────────────────
  server.tool(
    "treasury_revoke_spender",
    "Revoke a spender's authorization to withdraw yield from your vault. Immediately blocks all future withdrawals by this spender.",
    {
      spender: z.string().describe("Address of the spender to revoke"),
      dry_run: z.boolean().optional(),
    },
    async ({ spender, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      if (isDry) {
        return { content: [{ type: "text" as const, text: JSON.stringify({ mode: "dry_run", action: "revoke_spender", spender, note: `Will revoke ${spender}'s authorization.` }, null, 2) }] };
      }
      try {
        const result = await executeOrPrepare(ctx, {
          address: TREASURY_ADDR,
          abi: TREASURY_ABI as any,
          functionName: "revokeSpender",
          args: [spender as Address],
        }, "treasury_revoke_spender", "Revoke a spender's authorization on your AgentTreasury vault");

        return { content: [{ type: "text" as const, text: JSON.stringify({ ...result, action: "revoke_spender", spender, note: `${spender} can no longer withdraw yield from your vault.` }, null, 2) }] };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Revoke failed: ${decodeTreasuryError(e)}` }], isError: true };
      }
    }
  );

  // ── treasury_get_spender_config ─────────────────────────────────────
  server.tool(
    "treasury_get_spender_config",
    "Check a spender's authorization config for a vault: per-tx cap, window budget, spending history.",
    {
      agent_address: z.string().describe("Vault owner's address"),
      spender_address: z.string().describe("Spender address to check"),
    },
    async ({ agent_address, spender_address }) => {
      try {
        const result = await ctx.publicClient.readContract({
          address: TREASURY_ADDR,
          abi: TREASURY_ABI,
          functionName: "getSpenderConfig",
          args: [agent_address as Address, spender_address as Address],
        });

        const [authorized, yieldOnly, maxPerTx, spentInWindow, windowStart, windowDuration, windowAllowance] = result;
        const maxPerTxBig = BigInt(maxPerTx);
        const spentBig = BigInt(spentInWindow);
        const winDurBig = BigInt(windowDuration);
        const winAllowBig = BigInt(windowAllowance);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              agent: agent_address,
              spender: spender_address,
              authorized,
              yield_only: yieldOnly,
              max_per_tx: maxPerTxBig > 0n ? formatEther(maxPerTxBig) + " wstETH" : "unlimited",
              window: winDurBig > 0n ? {
                duration_seconds: Number(windowDuration),
                allowance: formatEther(winAllowBig) + " wstETH",
                spent_in_current_window: formatEther(spentBig) + " wstETH",
                remaining: winAllowBig > spentBig ? formatEther(winAllowBig - spentBig) + " wstETH" : "0 wstETH",
                window_started: new Date(Number(windowStart) * 1000).toISOString(),
              } : "no time window",
              contract: TREASURY_ADDR,
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );

  // ── treasury_withdraw_yield ─────────────────────────────────────────
  server.tool(
    "treasury_withdraw_yield",
    "Withdraw accrued yield from your own vault. Cannot exceed available yield — principal is always protected.",
    {
      recipient: z.string().describe("Address to receive the yield"),
      amount_wsteth: z.string().describe("Amount of wstETH yield to withdraw"),
      dry_run: z.boolean().optional(),
    },
    async ({ recipient, amount_wsteth, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const amount = parseEther(amount_wsteth);

      if (isDry) {
        if (TREASURY_ADDR !== "0x0000000000000000000000000000000000000000") {
          try {
            const account = ctx.agentAddress || recipient;
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
                  available_yield: formatEther(result[1]),
                  principal_protected: formatEther(result[0]),
                  would_succeed: result[1] >= amount,
                  recipient,
                }, null, 2),
              }],
            };
          } catch { /* fallthrough */ }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ mode: "dry_run", action: "treasury_withdraw_yield", requested_amount: amount_wsteth, recipient }, null, 2),
          }],
        };
      }

      try {
        const result = await executeOrPrepare(ctx, {
          address: TREASURY_ADDR,
          abi: TREASURY_ABI as any,
          functionName: "withdrawYield",
          args: [recipient as Address, amount],
        }, "treasury_withdraw_yield", "Withdraw accrued yield from your AgentTreasury vault");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, action: "treasury_withdraw_yield", amount_wsteth, recipient }, null, 2),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Withdrawal failed: ${decodeTreasuryError(e)}` }], isError: true };
      }
    }
  );

  // ── treasury_withdraw_yield_for ─────────────────────────────────────
  server.tool(
    "treasury_withdraw_yield_for",
    "Withdraw yield from another agent's vault as an authorized spender. Subject to per-tx caps, window budgets, and recipient whitelists configured by the vault owner.",
    {
      agent_address: z.string().describe("Vault owner's address"),
      recipient: z.string().describe("Address to receive the yield"),
      amount_wsteth: z.string().describe("Amount of wstETH yield to withdraw"),
      dry_run: z.boolean().optional(),
    },
    async ({ agent_address, recipient, amount_wsteth, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;
      const amount = parseEther(amount_wsteth);

      if (isDry) {
        try {
          const [vaultResult, isAuth, spenderCfg] = await Promise.all([
            ctx.publicClient.readContract({
              address: TREASURY_ADDR,
              abi: TREASURY_ABI,
              functionName: "getVaultStatus",
              args: [agent_address as Address],
            }),
            ctx.publicClient.readContract({
              address: TREASURY_ADDR,
              abi: TREASURY_ABI,
              functionName: "isAuthorizedSpender",
              args: [agent_address as Address, (ctx.agentAddress || recipient) as Address],
            }),
            ctx.publicClient.readContract({
              address: TREASURY_ADDR,
              abi: TREASURY_ABI,
              functionName: "getSpenderConfig",
              args: [agent_address as Address, (ctx.agentAddress || recipient) as Address],
            }),
          ]);

          const withinPerTxCap = spenderCfg[2] === 0n || amount <= spenderCfg[2];

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                mode: "dry_run",
                action: "treasury_withdraw_yield_for",
                agent: agent_address,
                recipient,
                requested_amount: amount_wsteth,
                available_yield: formatEther(vaultResult[1]),
                is_authorized: isAuth,
                within_per_tx_cap: withinPerTxCap,
                would_succeed: isAuth && vaultResult[1] >= amount && withinPerTxCap,
              }, null, 2),
            }],
          };
        } catch { /* fallthrough */ }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ mode: "dry_run", action: "treasury_withdraw_yield_for", agent: agent_address, recipient, requested_amount: amount_wsteth }, null, 2),
          }],
        };
      }

      try {
        const result = await executeOrPrepare(ctx, {
          address: TREASURY_ADDR,
          abi: TREASURY_ABI as any,
          functionName: "withdrawYieldFor",
          args: [agent_address as Address, recipient as Address, amount],
        }, "treasury_withdraw_yield_for", "Withdraw yield from another agent's vault as an authorized spender");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, action: "treasury_withdraw_yield_for", agent: agent_address, recipient, amount_wsteth }, null, 2),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Withdrawal failed: ${decodeTreasuryError(e)}` }], isError: true };
      }
    }
  );

  // ── treasury_set_recipient_whitelist ─────────────────────────────────
  server.tool(
    "treasury_set_recipient_whitelist",
    "Toggle recipient whitelist for your vault. When enabled, authorized spenders can only send yield to pre-approved addresses.",
    {
      enabled: z.boolean().describe("true = only whitelisted recipients allowed, false = any recipient ok"),
      dry_run: z.boolean().optional(),
    },
    async ({ enabled, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;

      if (isDry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "set_recipient_whitelist",
              enabled,
              note: enabled ? "Spenders will only be able to send yield to whitelisted addresses." : "Any recipient will be allowed.",
            }, null, 2),
          }],
        };
      }

      try {
        const result = await executeOrPrepare(ctx, {
          address: TREASURY_ADDR,
          abi: TREASURY_ABI as any,
          functionName: "setRecipientWhitelist",
          args: [enabled],
        }, "treasury_set_recipient_whitelist", "Toggle recipient whitelist for your AgentTreasury vault");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, action: "set_recipient_whitelist", enabled }, null, 2),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${decodeTreasuryError(e)}` }], isError: true };
      }
    }
  );

  // ── treasury_set_allowed_recipient ──────────────────────────────────
  server.tool(
    "treasury_set_allowed_recipient",
    "Add or remove an address from your vault's recipient whitelist. Only effective when recipient whitelist is enabled.",
    {
      recipient: z.string().describe("Address to whitelist or remove"),
      allowed: z.boolean().describe("true = allow, false = remove from whitelist"),
      dry_run: z.boolean().optional(),
    },
    async ({ recipient, allowed, dry_run }) => {
      const isDry = dry_run ?? ctx.dryRun;

      if (isDry) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              mode: "dry_run",
              action: "set_allowed_recipient",
              recipient,
              allowed,
            }, null, 2),
          }],
        };
      }

      try {
        const result = await executeOrPrepare(ctx, {
          address: TREASURY_ADDR,
          abi: TREASURY_ABI as any,
          functionName: "setAllowedRecipient",
          args: [recipient as Address, allowed],
        }, "treasury_set_allowed_recipient", "Add or remove an address from your vault's recipient whitelist");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ ...result, action: "set_allowed_recipient", recipient, allowed }, null, 2),
          }],
        };
      } catch (e: any) {
        return { content: [{ type: "text" as const, text: `Error: ${decodeTreasuryError(e)}` }], isError: true };
      }
    }
  );

  // ── treasury_get_rate ───────────────────────────────────────────────
  server.tool(
    "treasury_get_rate",
    "Get the current wstETH/stETH exchange rate from the Chainlink oracle on Base. This rate determines yield accrual in the treasury.",
    {},
    async () => {
      try {
        const rate = await ctx.publicClient.readContract({
          address: TREASURY_ADDR,
          abi: TREASURY_ABI,
          functionName: "getCurrentRate",
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              chainlink_rate: formatEther(rate),
              meaning: `1 wstETH = ${formatEther(rate)} stETH`,
              oracle: "Chainlink wstETH/stETH on Base (0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061)",
              note: "This rate increases over time as Lido staking yield accrues. Yield in the treasury = (current_rate - deposit_rate) * principal.",
            }, null, 2),
          }],
        };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : "unknown"}` }],
          isError: true,
        };
      }
    }
  );
}
