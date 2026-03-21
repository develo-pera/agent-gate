# Agent Registration & Third-Party Access - Research

**Researched:** 2026-03-21
**Domain:** MCP protocol auth, blockchain transaction signing patterns, multi-tenant agent access
**Confidence:** HIGH

## Summary

The AgentGate MCP server currently stores private keys server-side and signs transactions on behalf of first-party agents. This is fundamentally wrong for third-party agents who already have their own wallets. The research confirms that the **unsigned transaction pattern** is the established, industry-standard approach for blockchain MCP servers. Google Cloud, multiple open-source MCP blockchain servers, and the broader Web3 MCP ecosystem all converge on the same architecture: **server prepares transactions, client signs externally**.

The MCP protocol itself has a full OAuth 2.1 authorization spec, but for this use case -- agent-to-server auth where agents are autonomous programs, not browser users -- a simpler Bearer token / API key approach is more appropriate. The MCP spec explicitly supports STDIO credential injection and custom auth for non-browser transports. For HTTP transports, the Bearer token pattern AgentGate already uses is compatible with the spec.

**Primary recommendation:** Implement a dual-mode context system where first-party agents get full `walletClient` access (current behavior) and third-party agents get a `prepareOnly` context that returns unsigned transaction objects instead of executing them. Use `encodeFunctionData` from viem to construct calldata, and return structured `{to, data, value, chainId}` objects the agent can sign with their own wallet.

## Standard Stack

### Core (Already In Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.12.1 | MCP server framework | Official Anthropic SDK |
| viem | ^2.23.0 | Ethereum client, tx encoding | Industry standard, already used |
| zod | ^3.24.0 | Input validation | MCP SDK uses zod natively |

### Supporting (New for Registration)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (Node.js built-in) | N/A | Generate API keys | `crypto.randomBytes(32).toString('hex')` for token generation |
| Vercel KV / Upstash Redis | latest | Store agent registry | Persist agent_id -> {address, api_key_hash, created_at} |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Redis/KV for registry | Environment vars | Env vars don't scale for dynamic registration |
| Bearer API key | Full OAuth 2.1 | OAuth is designed for browser flows; API keys are simpler for agent-to-agent |
| Server-returned unsigned tx | ERC-4337 UserOps | UserOps add bundler dependency; unsigned tx is simpler and universal |

## Architecture Patterns

### Recommended: Dual-Mode Context

The key insight is that `AgentGateContext` needs TWO modes:

```
AgentGateContext
  |
  +-- First-party mode (existing): has walletClient, signs + submits
  |
  +-- Third-party mode (new): NO walletClient, prepares unsigned tx only
```

### Pattern 1: Prepare-Only Context for Third-Party Agents

**What:** Third-party agents get a context with `publicClient` but no `walletClient`. Write tools detect the missing wallet and return unsigned transaction data instead of executing.

**When to use:** Any third-party agent that registered with their own address.

**Example:**
```typescript
// Source: viem docs + mcp-blockchain-server pattern
import { encodeFunctionData, type Address } from "viem";

// In a write tool handler:
async ({ amount_wsteth, dry_run }, ctx: AgentGateContext) => {
  const amount = parseEther(amount_wsteth);

  // Third-party agent: no walletClient -> return unsigned tx
  if (!ctx.walletClient) {
    const calldata = encodeFunctionData({
      abi: TREASURY_ABI,
      functionName: "deposit",
      args: [amount],
    });

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          mode: "unsigned_transaction",
          transaction: {
            to: TREASURY_ADDR,
            data: calldata,
            value: "0",
            chainId: ctx.chain.id,
          },
          instructions: "Sign this transaction with your wallet and submit to the network. Return the tx hash via submit_tx_hash tool.",
          simulation: {
            // Optional: run simulateContract to pre-validate
            estimated_gas: "auto",
          },
        }, null, 2),
      }],
    };
  }

  // First-party agent: sign and submit as before
  const hash = await ctx.walletClient.writeContract({ ... });
  // ...
}
```

### Pattern 2: Agent Self-Registration Flow

**What:** A registration endpoint where agents provide their wallet address (never their key) and receive an API key.

**Example:**
```typescript
// Registration tool (no auth required for this specific tool)
server.tool(
  "register_agent",
  "Register as a third-party agent. Provide your wallet address to get an API key. " +
  "You will be able to use all read tools immediately. Write tools will return unsigned transactions for you to sign.",
  {
    address: z.string().describe("Your wallet address (0x...)"),
    name: z.string().optional().describe("Optional agent name"),
  },
  async ({ address, name }) => {
    // Validate address format
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return { content: [{ type: "text", text: "Invalid address format" }], isError: true };
    }

    // Generate API key
    const apiKey = crypto.randomBytes(32).toString("hex");
    const apiKeyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // Store in KV: agent_id -> { address, apiKeyHash, name, createdAt, type: "third-party" }
    await kv.set(`agent:${apiKeyHash}`, {
      address,
      name: name || `agent-${address.slice(0, 8)}`,
      type: "third-party",
      createdAt: Date.now(),
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          registered: true,
          agent_id: `agent-${address.slice(0, 8)}`,
          address,
          api_key: apiKey,  // Only shown once!
          instructions: [
            "Save this API key securely - it cannot be recovered.",
            "Use it as Bearer token: Authorization: Bearer <api_key>",
            "Read tools work immediately with your address.",
            "Write tools return unsigned transactions for you to sign externally.",
          ],
        }, null, 2),
      }],
    };
  }
);
```

### Pattern 3: Unsigned Transaction Object Schema

**What:** Standardized shape for unsigned transactions returned by all write tools.

```typescript
// Source: Google Cloud MCP + Web3 blog, mcp-blockchain-server pattern
interface UnsignedTransaction {
  to: Address;
  data: `0x${string}`;   // ABI-encoded calldata
  value: string;          // Wei as string
  chainId: number;
  // Optional metadata
  meta?: {
    tool: string;         // Which tool generated this
    description: string;  // Human-readable description
    estimated_gas?: string;
  };
}
```

### Pattern 4: Transaction Hash Submission

**What:** After the agent signs and submits externally, they report the tx hash back for tracking.

```typescript
server.tool(
  "submit_tx_hash",
  "Report a transaction hash after signing and submitting an unsigned transaction externally.",
  {
    tx_hash: z.string().describe("Transaction hash"),
    original_tool: z.string().optional().describe("Which tool generated the unsigned tx"),
  },
  async ({ tx_hash }) => {
    const receipt = await ctx.publicClient.waitForTransactionReceipt({
      hash: tx_hash as `0x${string}`,
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          tx_hash,
          status: receipt.status,
          block_number: receipt.blockNumber.toString(),
          explorer: `https://basescan.org/tx/${tx_hash}`,
        }, null, 2),
      }],
    };
  }
);
```

### Recommended Project Structure Changes

```
packages/mcp-server/src/
  hosted.ts           # Updated: dual-mode context factory
  context.ts          # Updated: AgentGateContext with optional walletClient
  registry.ts         # NEW: agent registration + lookup
  tools/
    register.ts       # NEW: register_agent, submit_tx_hash tools
    treasury.ts       # Updated: unsigned tx fallback when no walletClient
    uniswap.ts        # Updated: unsigned tx fallback
    trading.ts        # Updated: unsigned tx fallback
    delegation.ts     # Updated: unsigned tx fallback
    monitor.ts        # Unchanged: read-only, works with address only
    ens.ts            # Unchanged: read-only
    lido.ts           # Mostly unchanged: read-heavy, write tools are L1 dry-run only
```

### Anti-Patterns to Avoid
- **Generating keys for third-party agents:** Never create/store/derive private keys for agents that already have their own wallets
- **Encrypting and storing keys:** Still storing keys; fundamentally wrong regardless of encryption
- **HD wallet derivation from master seed:** Same problem; agents don't want server-generated keys
- **Requiring agents to send private keys for registration:** Obvious security violation
- **Storing API keys in plaintext:** Always hash API keys before storage; only show plaintext once during registration

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API key generation | Custom random strings | `crypto.randomBytes(32)` | Cryptographic randomness required |
| API key storage | Custom DB schema | Vercel KV / Upstash Redis | Already in Vercel ecosystem, simple KV pattern |
| ABI encoding | Manual hex construction | `viem.encodeFunctionData()` | Handles all ABI types correctly, type-safe |
| Transaction simulation | Custom gas estimation | `publicClient.simulateContract()` | Catches reverts before signing |
| Address validation | Regex only | `viem.isAddress()` + `viem.getAddress()` | Handles checksums, normalization |
| Full OAuth 2.1 server | Custom auth server | Bearer API keys | OAuth is for browser flows; agents are programmatic clients |

**Key insight:** The existing `walletClient.writeContract()` pattern already encodes + signs + submits in one step. For third-party agents, we just need the encoding step (`encodeFunctionData`), which viem provides natively. The refactor is minimal: detect missing `walletClient`, encode calldata, return it instead of submitting.

## Common Pitfalls

### Pitfall 1: Forgetting to Include chainId
**What goes wrong:** Agent signs the transaction for the wrong chain, tx gets replayed on another chain, or fails with "invalid chain id"
**Why it happens:** Developers include `to`, `data`, `value` but forget `chainId`
**How to avoid:** Always include `chainId: ctx.chain.id` in every unsigned transaction response
**Warning signs:** Agent reports "transaction failed" but calldata looks correct

### Pitfall 2: Value Encoding as Number Instead of String
**What goes wrong:** JavaScript loses precision on large BigInt values when serialized as JSON numbers
**Why it happens:** `JSON.stringify` converts BigInt to throw or to lossy number
**How to avoid:** Always serialize `value` as string: `value: amount.toString()`
**Warning signs:** Amounts are slightly wrong (e.g., off by a few wei)

### Pitfall 3: Race Condition on Registration API Keys
**What goes wrong:** Two agents register simultaneously, one's key overwrites the other
**Why it happens:** Using agent address as the KV key without proper isolation
**How to avoid:** Key by API key hash, not by address. Multiple API keys per address is fine
**Warning signs:** Agent gets "unauthorized" after successful registration

### Pitfall 4: Not Simulating Before Returning Unsigned Tx
**What goes wrong:** Agent signs and submits a transaction that will revert, wasting gas
**Why it happens:** Server returns calldata without checking if it would succeed
**How to avoid:** Run `publicClient.simulateContract()` before returning unsigned tx, include `would_revert: true/false`
**Warning signs:** High rate of failed transactions from third-party agents

### Pitfall 5: Stale Nonce in Multi-Tool Sequences
**What goes wrong:** Agent calls multiple write tools rapidly, all return the same nonce, only first succeeds
**Why it happens:** Each tool call checks nonce independently; agent hasn't submitted first tx yet
**How to avoid:** Don't include nonce in unsigned tx response; let the agent's wallet handle nonce management
**Warning signs:** "nonce too low" errors from agents

### Pitfall 6: Breaking who_am_i for Third-Party Agents
**What goes wrong:** `who_am_i` tool currently returns `ctx.walletAccount!.address` which will be undefined
**Why it happens:** Third-party context has no `walletAccount`
**How to avoid:** Store the agent's registered address in context, return that from `who_am_i`
**Warning signs:** Crash on first tool call

## Code Examples

### Example 1: Updated AgentGateContext Type

```typescript
// Source: existing context.ts + research findings
import type { Chain } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";

export interface AgentGateContext {
  publicClient: any;
  l1PublicClient: any;
  walletClient?: any;           // undefined for third-party agents
  walletAccount?: PrivateKeyAccount; // undefined for third-party agents
  agentAddress: `0x${string}`;  // NEW: always present (from key or registration)
  agentType: "first-party" | "third-party"; // NEW: determines behavior
  dryRun: boolean;
  chain: Chain;
  allAddresses?: `0x${string}`[];
}
```

### Example 2: Updated hosted.ts Context Factory

```typescript
function createThirdPartyContext(agentAddress: `0x${string}`): AgentGateContext {
  const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
  const L1_RPC_URL = process.env.L1_RPC_URL || "https://eth.llamarpc.com";

  return {
    publicClient: createPublicClient({
      chain: base,
      transport: http(RPC_URL),
    }),
    l1PublicClient: createPublicClient({
      chain: base,
      transport: http(L1_RPC_URL),
    }),
    // No walletClient, no walletAccount
    agentAddress,
    agentType: "third-party",
    dryRun: false,
    chain: base,
    allAddresses: getAllAgentAddresses(),
  };
}
```

### Example 3: Generic Write Tool Refactor Helper

```typescript
// Source: pattern from mcp-blockchain-server + viem docs
import { encodeFunctionData, type Abi, type Address } from "viem";

/**
 * For write tools: if walletClient exists, execute; otherwise return unsigned tx.
 */
async function executeOrPrepare(
  ctx: AgentGateContext,
  params: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: any[];
    value?: bigint;
    toolName: string;
    description: string;
  }
): Promise<
  | { mode: "executed"; tx_hash: string; status: string }
  | { mode: "unsigned_transaction"; transaction: UnsignedTransaction }
> {
  if (ctx.walletClient) {
    // First-party: sign and submit
    const hash = await ctx.walletClient.writeContract({
      account: ctx.walletAccount!,
      chain: ctx.chain,
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
      value: params.value,
    });
    const receipt = await ctx.publicClient.waitForTransactionReceipt({ hash });
    return { mode: "executed", tx_hash: hash, status: receipt.status };
  }

  // Third-party: return unsigned transaction
  const calldata = encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  });

  // Optionally simulate to catch reverts early
  let wouldRevert = false;
  try {
    await ctx.publicClient.simulateContract({
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
      account: ctx.agentAddress,
      value: params.value,
    });
  } catch {
    wouldRevert = true;
  }

  return {
    mode: "unsigned_transaction",
    transaction: {
      to: params.address,
      data: calldata,
      value: (params.value || 0n).toString(),
      chainId: ctx.chain.id,
      meta: {
        tool: params.toolName,
        description: params.description,
        would_revert: wouldRevert,
      },
    },
  };
}
```

### Example 4: Updated who_am_i Tool

```typescript
server.tool(
  "who_am_i",
  "Returns your agent ID, wallet address, and access mode.",
  {},
  async () => ({
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        agent_id: agentId,
        address: ctx.agentAddress,
        mode: ctx.agentType,
        capabilities: ctx.agentType === "first-party"
          ? "Full: read + write (server signs)"
          : "Hybrid: read + prepare unsigned tx (you sign)",
      }),
    }],
  }),
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store private keys server-side | Unsigned tx pattern (server prepares, client signs) | 2025 standard | Security: keys never leave agent's wallet |
| Custom auth per MCP server | OAuth 2.1 per MCP spec (March 2025+) | MCP spec 2025-03 | Standardized auth, but heavy for agent-to-agent |
| Static agent config in env vars | Dynamic registration with API keys | Common pattern 2025 | Scales to N agents without server redeployment |
| Full tx execution server-side | `encodeFunctionData` + return calldata | viem standard | Zero-custody, agents maintain self-sovereignty |

**Key industry signal:** Google Cloud's December 2025 blog post "Using MCP with Web3" explicitly recommends the unsigned transaction pattern as the secure standard for blockchain-interacting agents. Multiple open-source MCP servers (mcp-blockchain-server, mcp-wallet-signer, viemcp) implement this pattern.

## MCP Protocol Auth: What's Relevant

The MCP spec defines full OAuth 2.1 authorization for HTTP transports. Key points for AgentGate:

1. **MCP servers are OAuth 2.1 Resource Servers** -- they accept Bearer tokens
2. **Auth is OPTIONAL** per the spec -- not all MCP servers need it
3. **For STDIO transport**, the spec says to "retrieve credentials from the environment" (env vars)
4. **Bearer token in every request** -- `Authorization: Bearer <token>` -- this is what AgentGate already does
5. **Dynamic Client Registration** is supported but heavy for this use case

**Recommendation for AgentGate:** Keep the Bearer token approach. It's spec-compatible and simple. Generate API keys during registration, validate on every request by hashing and looking up in KV.

## Agent Registration Data Model

### What to Store (in KV/Redis)

```typescript
interface RegisteredAgent {
  address: `0x${string}`;        // Agent's wallet address (provided at registration)
  name: string;                   // Human-readable name
  type: "first-party" | "third-party";
  createdAt: number;              // Unix timestamp
  lastSeen?: number;              // Last API call timestamp
}

// KV key: `agent:${sha256(apiKey)}` -> RegisteredAgent
// Secondary index: `addr:${address}` -> apiKeyHash (for lookups by address)
```

### What NOT to Store

- Private keys (obviously)
- Seed phrases
- Plaintext API keys (only store hash)
- Session state (MCP is stateless per request)

## Tool Classification

### Read-Only Tools (work immediately for third-party agents)
| Tool | Status |
|------|--------|
| who_am_i | Works (updated to use agentAddress) |
| treasury_status | Works as-is (takes address param) |
| treasury_get_spender_config | Works as-is |
| treasury_get_rate | Works as-is |
| vault_health | Works as-is |
| wallet_balance | Works as-is |
| lido_balance | Works as-is |
| lido_get_apr | Works as-is |
| lido_rewards | Works as-is |
| lido_governance | Works as-is |
| ens_resolve | Works as-is |
| ens_reverse | Works as-is |
| uniswap_quote | Works (uses zero address for swapper) |
| uniswap_tokens | Works as-is |
| aave_position | Works as-is |
| trading_list_recipes | Works as-is |
| delegate_list | Works as-is |

### Write Tools (need unsigned tx fallback)
| Tool | Complexity | Notes |
|------|-----------|-------|
| treasury_deposit | LOW | Single contract call |
| treasury_withdraw_yield | LOW | Single contract call |
| treasury_withdraw_yield_for | LOW | Single contract call |
| treasury_authorize_spender | LOW | Single contract call |
| treasury_revoke_spender | LOW | Single contract call |
| treasury_set_recipient_whitelist | LOW | Single contract call |
| treasury_set_allowed_recipient | LOW | Single contract call |
| uniswap_swap | HIGH | Multi-step: approve + permit2 + quote + swap. Return as ordered list of unsigned txs |
| aave_supply | MEDIUM | Two-step: approve + supply. Return as ordered list |
| aave_withdraw | LOW | Single contract call |
| transfer_token | LOW | Single contract call |
| lido_stake | N/A | Already dry-run only (L1 requirement) |
| lido_wrap | N/A | Already dry-run only (L1 requirement) |
| lido_governance_vote | SPECIAL | EIP-712 signature -- cannot do unsigned tx pattern. Agent must sign locally |
| delegate_create | SPECIAL | Off-chain signature for delegation creation. Agent must sign locally |
| delegate_redeem | MEDIUM | Single sendTransaction to DelegationManager |
| delegate_revoke | MEDIUM | Single sendTransaction to DelegationManager |

### Special Cases: EIP-712 Signing
`lido_governance_vote` and `delegate_create` use `signTypedData` for off-chain signatures. These CANNOT use the unsigned-tx pattern. For third-party agents:
- Return the EIP-712 typed data structure (domain, types, message)
- Agent signs locally with their wallet
- Agent sends back the signature via a new `submit_signature` tool
- Server submits to Snapshot / stores delegation with the provided signature

## Open Questions

1. **Rate limiting for third-party agents**
   - What we know: First-party agents are trusted, third-party are not
   - What's unclear: What rate limits are appropriate? Per-minute? Per-day?
   - Recommendation: Start with generous limits (100 calls/minute), tighten based on usage

2. **Multi-step write tool UX for third-party agents**
   - What we know: uniswap_swap requires 3+ transactions (approve, permit2 approve, swap)
   - What's unclear: Should we return all unsigned txs at once or one-at-a-time?
   - Recommendation: Return ordered list of unsigned transactions with clear dependencies. Agent submits them sequentially.

3. **Agent identity verification at registration**
   - What we know: Anyone can register with any address
   - What's unclear: Should we verify they actually own the address? (Sign-to-prove pattern)
   - Recommendation: For V1, skip verification -- agents are autonomous and address spoofing only hurts the spoofer (they'd get unsigned txs for an address they can't sign for). Add sign-to-prove in V2 if needed.

4. **Migration path for existing first-party agents**
   - What we know: hackaclaw and merkle currently use env var keys
   - What's unclear: Should they also move to KV storage?
   - Recommendation: Keep env var path for first-party agents (it works). KV is for dynamic third-party registration only.

## Sources

### Primary (HIGH confidence)
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) - Full OAuth 2.1 auth spec for MCP
- [viem encodeFunctionData docs](https://viem.sh/docs/contract/encodeFunctionData) - Core function for unsigned tx construction
- [viem simulateContract docs](https://viem.sh/docs/contract/simulateContract) - Pre-validation without signing
- [mcp-blockchain-server](https://github.com/zhangzhongnan928/mcp-blockchain-server) - Reference implementation of prepare-transaction pattern
- [mcp-wallet-signer](https://github.com/nikicat/mcp-wallet-signer) - Non-custodial MCP wallet pattern

### Secondary (MEDIUM confidence)
- [Google Cloud: Using MCP with Web3](https://cloud.google.com/blog/products/identity-security/using-mcp-with-web3-how-to-secure-blockchain-interacting-agents) - Industry recommendation for unsigned tx pattern (Dec 2025)
- [Zero-Custody AI Trading Agent with MCP](https://dev.to/chunky_63ce69ebae9d449f06/how-to-build-a-zero-custody-ai-trading-agent-with-mcp-177n) - Practical implementation guide
- [MCP Security for Multi-Tenant AI Agents](https://prefactor.tech/blog/mcp-security-multi-tenant-ai-agents-explained) - Multi-tenant isolation patterns
- [Stack Overflow: MCP Authentication and Authorization](https://stackoverflow.blog/2026/01/21/is-that-allowed-authentication-and-authorization-in-model-context-protocol/) - Auth patterns overview

### Tertiary (LOW confidence)
- [viem Discussion #688](https://github.com/wevm/viem/discussions/688) - populateTransaction equivalent confirmation

## Metadata

**Confidence breakdown:**
- Unsigned tx pattern: HIGH - multiple independent sources (Google Cloud, mcp-blockchain-server, mcp-wallet-signer, dev.to guide) all converge
- MCP auth spec: HIGH - read directly from official spec at modelcontextprotocol.io
- Registration flow: MEDIUM - synthesized from multi-tenant MCP patterns; no single "blessed" approach exists
- Write tool refactor: HIGH - based on viem's existing `encodeFunctionData` API which is well-documented
- EIP-712 special cases: MEDIUM - extrapolated from existing delegation.ts and lido.ts patterns

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain; MCP spec evolving but core patterns established)
