# Coding Conventions

**Analysis Date:** 2026-03-19

## Naming Patterns

**Files:**
- TypeScript files: camelCase with `.ts` extension (e.g., `lido.ts`, `monitor.ts`)
- Tool registration files: correspond to feature area (e.g., `tools/lido.ts` handles Lido operations)
- Tool naming: snake_case with `registerXxxTools` function exports (e.g., `registerLidoTools`, `registerEnsTools`)

**Functions:**
- Tool handlers: async functions with camelCase names starting with lowercase (e.g., `async ({ amount_eth, referral, dry_run }) => {...}`)
- Helper functions: camelCase with clear purpose (e.g., `resolveToken`, `uniswapFetch`)
- Register functions: `register[Feature]Tools(server, ctx)` convention

**Variables:**
- Constants from environment: UPPER_SNAKE_CASE (e.g., `RPC_URL`, `PRIVATE_KEY`, `UNISWAP_API_KEY`)
- Runtime constants: UPPER_SNAKE_CASE (e.g., `BENCHMARK_APR`, `TREASURY_ABI`, `LIDO_ABI`)
- Local variables: camelCase (e.g., `isDry`, `totalPooled`, `estimatedSteth`)
- Token/address mappings: UPPER_SNAKE_CASE dictionaries (e.g., `L1_ADDRS`, `BASE_ADDRS`, `WELL_KNOWN_TOKENS`)

**Types:**
- Interfaces: PascalCase prefixed with capital letter (e.g., `AgentGateContext`)
- Zod schemas: lowercase with descriptive names passed to `z.string()`, `z.enum()`, etc.
- Type parameters from viem: imported directly and used as-is (e.g., `Address`, `Chain`, `PrivateKeyAccount`)

## Code Style

**Formatting:**
- No explicit formatter configured (no `.eslintrc`, `.prettierrc`, or `biome.json` in repo root)
- **Observed style** from source:
  - 2-space indentation
  - Semicolons at end of statements
  - Trailing commas in objects/arrays
  - Line length: ~100 characters (hard to enforce without config, but respected in code)

**Linting:**
- No explicit linter configured in dependencies
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json`
- Additional strict settings:
  - `esModuleInterop: true` - allows default imports
  - `forceConsistentCasingInFileNames: true` - prevents case-sensitivity issues
  - `skipLibCheck: true` - ignores type errors in dependencies

**Code organization:**
- Comment headers for logical sections use `// ── Title ────────────────────────────────`
- One tool per `server.tool()` call
- Configuration/constants at top of file
- ABIs/contract addresses after imports, before tool registration

## Import Organization

**Order:**
1. Framework/SDK imports (e.g., `@modelcontextprotocol/sdk`)
2. Third-party libraries (e.g., `viem`, `zod`, `@lidofinance/*`)
3. Internal imports (relative paths starting with `../` or `./`)
4. Type-only imports separated with `import type` syntax

**Example from `src/index.ts`:**
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { base, mainnet } from "viem/chains";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

// Tool imports
import { registerLidoTools } from "./tools/lido.js";
```

**Path Aliases:**
- No alias configuration in `tsconfig.json` — all imports use relative or absolute npm paths
- ESM imports use `.js` extension explicitly (e.g., `./tools/lido.js`)

## Error Handling

**Patterns:**
- Try-catch blocks for API calls and contract interactions:
  ```typescript
  try {
    const res = await fetch(url);
    const data = await res.json();
    // process data
  } catch (e) {
    return {
      content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : "unknown"}` }],
      isError: true,
    };
  }
  ```
- Optional catch blocks (ignore errors) for non-critical operations:
  ```typescript
  try {
    avatar = await ctx.publicClient.getEnsAvatar({ name: normalize(name) });
  } catch { /* optional */ }
  ```
- Zod schema validation for user inputs (parameters) — validation is implicit via schema definitions
- Contract calls: assume successful unless error thrown; no explicit null checks for contract reads
- API errors: check HTTP status with `if (!res.ok)` before JSON parsing

**Error responses:**
- Tools return `{ content: [...], isError: true }` for errors
- Error text includes context (e.g., operation name, chain info)
- Instance check: `e instanceof Error ? e.message : "unknown"` for safe error message extraction

## Logging

**Framework:** console (no external logging library)

**Patterns:**
- Startup/diagnostics: `console.error()` (e.g., server startup messages, dry-run indicators)
- Error messages: logged via return values to tool consumer, not to stdout
- Debug: no debug logging present; relies on dry-run mode for testing

**Example from `src/index.ts`:**
```typescript
console.error("AgentGate MCP server started");
console.error(`  Chain: ${CHAIN.name}`);
console.error(`  Dry run: ${DRY_RUN}`);
console.error(`  Wallet: ${walletClient ? "configured" : "read-only"}`);
```

## Comments

**When to Comment:**
- Section headers using ASCII divider style: `// ── Title ────────────────────────────────`
- Explain "why" for non-obvious decisions (e.g., "L1 client for Lido stETH reads (stETH only exists on L1 Ethereum)")
- Note contract/API limitations (e.g., "APR data comes from L1 Lido API — Base wstETH earns the same rate")
- Docstrings on public contract functions (Solidity) but not on MCP tool handlers (descriptions in `z.string()`)

**JSDoc/TSDoc:**
- Not extensively used in TypeScript source
- Solidity uses NatSpec style (`@title`, `@notice`, `@dev`, `@param`) in contracts
- Tool descriptions embedded in second argument to `server.tool()`:
  ```typescript
  server.tool(
    "lido_stake",
    "Simulate staking ETH with Lido. Reads L1 Ethereum state to estimate stETH received. ...",
    { ... },
    async ({ ... }) => { ... }
  );
  ```

## Function Design

**Size:**
- Tool handlers: typically 20-100 lines
- Helper functions: 5-15 lines (e.g., `resolveToken`, `uniswapFetch`)
- No explicit line-limit convention observed, but functions stay focused on single operation

**Parameters:**
- Tool handlers: destructured object from MCP SDK (e.g., `async ({ amount_eth, referral, dry_run }) => {...}`)
- Helper functions: named parameters with type annotations (e.g., `resolveToken(tokenInput: string, chainId: number)`)
- Context parameter always named `ctx` for consistency

**Return Values:**
- Tools always return `{ content: [...], isError?: boolean }`
- Content is array of `{ type: "text", text: string }` or `{ type: "text", text: JSON.stringify(...) }`
- Helper functions return typed values (e.g., `{ address: string; decimals: number } | null`)
- Async functions explicitly typed with return type or inferred from Promise

## Module Design

**Exports:**
- Single named export per tool registration file: `export function register[Feature]Tools(server, ctx)`
- ABIs/contracts defined as `const` in tool files (not exported), prefixed with feature name
- State maps exported implicitly (e.g., `delegationStore` in `delegation.ts`)

**Barrel Files:**
- No barrel files (index.ts) in `tools/` directory
- All tool imports in `src/index.ts` imported individually from each tool file
- Example:
  ```typescript
  import { registerLidoTools } from "./tools/lido.js";
  import { registerTreasuryTools } from "./tools/treasury.js";
  // ... more imports
  ```

## Dry-Run Pattern

**Consistency:**
- Tool parameter: optional `dry_run: z.boolean().optional()`
- Evaluation: `const isDry = dry_run ?? ctx.dryRun;`
- Response includes `mode: "dry_run"` or `mode: "executed"` JSON field
- Dry-run never modifies state; returns simulated response

---

*Convention analysis: 2026-03-19*
