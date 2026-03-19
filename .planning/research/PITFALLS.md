# Domain Pitfalls

**Domain:** DeFi Dashboard + MCP Playground (Hackathon)
**Researched:** 2026-03-19

## Critical Pitfalls

Mistakes that waste hours or cause demo failures.

### Pitfall 1: Hydration Mismatch with Wallet State
**What goes wrong:** Next.js server-renders a component, then client hydration sees different wallet state (connected vs disconnected), causing React hydration errors and broken UI.
**Why it happens:** Wallet state only exists client-side (browser extension). Server always renders "disconnected" state.
**Consequences:** White screen or React error overlay during demo.
**Prevention:** Mark ALL components that use wagmi hooks (`useAccount`, `useBalance`, etc.) with `"use client"`. Use `mounted` state pattern:
```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return <Skeleton />;
```
**Detection:** React hydration warning in console during dev.

### Pitfall 2: MCP Stdio vs HTTP Bridge Gap
**What goes wrong:** MCP server works perfectly via stdio (Claude Desktop, CLI) but the HTTP bridge has different error handling, missing env vars, or serialization issues.
**Why it happens:** MCP SDK's stdio transport handles things that raw HTTP doesn't — like streaming progress, error codes, and tool result formatting.
**Consequences:** Playground shows cryptic errors or hangs.
**Prevention:** Build the HTTP bridge as a thin adapter that spawns the MCP server process or imports tool handlers directly. Test every tool through the bridge, not just via MCP inspector.
**Detection:** Tool works in MCP inspector but fails in playground UI.

### Pitfall 3: RPC Rate Limiting During Demo
**What goes wrong:** Public Base RPC or L1 RPC rate-limits requests during live demo, causing timeouts and "loading forever" states.
**Why it happens:** Public RPCs have strict rate limits. Multiple components all reading chain state simultaneously on page load.
**Consequences:** Dashboard shows perpetual loading spinners during the 2-minute video.
**Prevention:**
1. Use stale-while-revalidate caching in React Query (set staleTime to 30-60 seconds).
2. Batch reads where possible (multicall).
3. Pre-warm the cache before recording the demo video.
4. Have a fallback: hardcoded demo data if RPC fails.
**Detection:** Intermittent loading failures in dev, especially after page refresh.

### Pitfall 4: Wrong Chain Configuration
**What goes wrong:** Wallet connects but is on Ethereum mainnet or a testnet. Transactions fail silently or read wrong contract addresses.
**Why it happens:** Base (chain 8453) isn't the default in most wallets. RainbowKit needs explicit chain config.
**Consequences:** Contract reads return zero values. Transactions fail with unhelpful errors.
**Prevention:** Configure wagmi with Base as the only supported chain. Use RainbowKit's chain switching prompt. Validate chainId before any write operation.
**Detection:** Balance reads return 0 or contract calls revert.

## Moderate Pitfalls

### Pitfall 5: Tailwind v4 Config Confusion
**What goes wrong:** Following Tailwind v3 tutorials (tailwind.config.js, @tailwind directives) when v4 uses CSS-first config.
**Prevention:** Use `@import "tailwindcss"` in CSS file. No tailwind.config.js. Use `@theme` for custom values. Follow the shadcn CLI v4 init — it sets this up correctly.

### Pitfall 6: shadcn/ui Import Path Issues in Monorepo
**What goes wrong:** shadcn components import from `@/components/ui/...` but monorepo path aliases don't resolve correctly.
**Prevention:** Ensure `tsconfig.json` in `app/` has correct `paths` mapping: `"@/*": ["./src/*"]`. The shadcn init wizard configures this but verify it works with the monorepo workspace setup.

### Pitfall 7: Environment Variables Not Reaching Client
**What goes wrong:** RPC URLs and bridge URLs are undefined in browser because they lack the `NEXT_PUBLIC_` prefix.
**Prevention:** Client-accessible env vars MUST be prefixed with `NEXT_PUBLIC_`. Keep `PRIVATE_KEY` server-only (never expose). Create `.env.local`:
```
NEXT_PUBLIC_BASE_RPC_URL=...
NEXT_PUBLIC_L1_RPC_URL=...
NEXT_PUBLIC_MCP_BRIDGE_URL=http://localhost:3001
# Never NEXT_PUBLIC_ for secrets:
PRIVATE_KEY=...
```

### Pitfall 8: RainbowKit WalletConnect Project ID
**What goes wrong:** Wallet connection modal shows but WalletConnect option fails with "invalid project ID" error.
**Prevention:** Get a free project ID from cloud.walletconnect.com. Set as `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. For hackathon, MetaMask injected connector works without it, so deprioritize WalletConnect if short on time.

### Pitfall 9: React Query Cache Conflicts
**What goes wrong:** wagmi's internal React Query keys conflict with custom query keys for MCP bridge calls, causing stale or wrong data.
**Prevention:** Use a single QueryClient instance shared between wagmi and custom queries. Don't create separate QueryClient instances. Use distinct query key prefixes for MCP calls (e.g., `["mcp", toolName, ...args]`).

## Minor Pitfalls

### Pitfall 10: Token Amount Formatting
**What goes wrong:** Displaying raw BigInt values (like `1000000000000000000` instead of `1.0 ETH`). Or wrong decimal places for different tokens.
**Prevention:** Use viem's `formatEther()` and `formatUnits()` consistently. stETH = 18 decimals, wstETH = 18 decimals, USDC = 6 decimals.

### Pitfall 11: Motion Bundle Size
**What goes wrong:** Importing all of motion when only using 2-3 animation features.
**Prevention:** Import specific features: `import { motion } from "motion/react"`. The library is tree-shakeable but be intentional.

### Pitfall 12: Dark Mode Flash on Load
**What goes wrong:** Brief white flash before dark theme applies, visible in demo video.
**Prevention:** next-themes handles this with a script injection. Set `defaultTheme="dark"` and `forcedTheme="dark"` in ThemeProvider. Since this is a crypto app, just force dark — no toggle needed.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Project setup + shell | Monorepo path resolution (#6) | Verify tsconfig paths after shadcn init |
| Wallet integration | Hydration mismatch (#1), Wrong chain (#4) | "use client" on all wallet components, force Base chain |
| Treasury dashboard | RPC rate limits (#3), Token formatting (#10) | React Query staleTime, viem formatEther |
| MCP Playground | Bridge gap (#2), Env vars (#7) | Test every tool through HTTP bridge early |
| Delegations | Bridge gap (#2) | Delegation tools are MCP-only, bridge must work |
| Demo polish | Dark flash (#12), Loading states (#3) | Force dark theme, pre-warm cache |

## Sources

- Common Next.js + wagmi issues from GitHub Discussions
- RainbowKit known issues and migration guide
- Tailwind CSS v4 upgrade guide
- shadcn/ui monorepo setup patterns
