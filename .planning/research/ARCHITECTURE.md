# Architecture Patterns

**Domain:** DeFi Dashboard + MCP Playground
**Researched:** 2026-03-19

## Recommended Architecture

```
+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|  Next.js App     |---->|  HTTP Bridge      |---->|  MCP Server      |
|  (app/)          |     |  (Express/Hono)   |     |  (stdio)         |
|                  |     |  POST /api/tools  |     |                  |
+--------+---------+     +-------------------+     +------------------+
         |
         |  Direct viem reads
         v
+------------------+
|  Base / L1 RPC   |
|  (public chains) |
+------------------+
```

### Two Data Paths

1. **viem direct reads** — For on-chain state (balances, vault status, positions). Fast, no bridge needed. Use wagmi hooks in React components.
2. **HTTP bridge to MCP** — For MCP tool execution (playground calls, write operations). POST JSON to bridge, bridge spawns MCP tool, returns result.

This separation is critical: don't route simple balance reads through MCP when viem can do it directly. MCP is for agent tool execution.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `app/` (Next.js) | UI rendering, routing, client state | HTTP Bridge, Base/L1 RPC via viem |
| HTTP Bridge | Translate REST to MCP stdio calls | MCP Server process |
| MCP Server | Execute 27 DeFi tools | Base/L1 chains, external APIs |
| Wallet Provider | Manage wallet connection state | Browser wallet extensions |

### Directory Structure

```
app/
  src/
    app/                    # Next.js App Router
      layout.tsx            # Root layout with providers
      page.tsx              # Landing / dashboard home
      treasury/
        page.tsx            # Treasury vault dashboard
      playground/
        page.tsx            # MCP tool playground
      delegations/
        page.tsx            # Delegation viewer
      staking/
        page.tsx            # Lido staking overview
    components/
      ui/                   # shadcn/ui components (auto-generated)
      layout/
        header.tsx          # Nav bar with wallet connect
        sidebar.tsx         # Page navigation
      treasury/
        vault-card.tsx      # Vault status display
        yield-chart.tsx     # Principal vs yield chart
      playground/
        tool-selector.tsx   # MCP tool picker dropdown
        request-editor.tsx  # JSON request input
        response-viewer.tsx # JSON response display
      delegations/
        delegation-list.tsx # Active delegations table
      staking/
        apr-card.tsx        # Lido APR display
      shared/
        stat-card.tsx       # Reusable stat display
        token-icon.tsx      # ETH/stETH/wstETH icons
        demo-badge.tsx      # "Demo Mode" indicator
    lib/
      wagmi-config.ts       # wagmi + RainbowKit configuration
      chains.ts             # Base + L1 chain definitions
      contracts.ts          # Contract addresses and ABIs
      mcp-bridge.ts         # HTTP bridge client (fetch wrapper)
    hooks/
      use-vault-status.ts   # Treasury vault reads
      use-mcp-tool.ts       # MCP tool execution via bridge
      use-demo-mode.ts      # Demo mode state
    providers/
      web3-provider.tsx     # WagmiProvider + QueryClient + RainbowKit
      theme-provider.tsx    # next-themes ThemeProvider
  public/
    tokens/                 # Token icon SVGs
  package.json
  tsconfig.json
  next.config.ts
  postcss.config.mjs
```

## Patterns to Follow

### Pattern 1: Provider Stack (App Router)

All wallet/query/theme providers must be client components wrapping the app.

```typescript
// providers/web3-provider.tsx
"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "@/lib/wagmi-config";

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: "#7c3aed", // purple accent
          borderRadius: "medium",
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### Pattern 2: MCP Bridge Client

Thin fetch wrapper for playground tool calls.

```typescript
// lib/mcp-bridge.ts
const BRIDGE_URL = process.env.NEXT_PUBLIC_MCP_BRIDGE_URL || "http://localhost:3001";

export async function callMcpTool(toolName: string, args: Record<string, unknown>) {
  const res = await fetch(`${BRIDGE_URL}/api/tools/${toolName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`MCP tool error: ${res.statusText}`);
  return res.json();
}
```

### Pattern 3: Demo Mode Fallback

When no wallet is connected, show read-only data from public RPC.

```typescript
// hooks/use-demo-mode.ts
"use client";

import { useAccount } from "wagmi";

export function useDemoMode() {
  const { isConnected } = useAccount();
  return {
    isDemoMode: !isConnected,
    // In demo mode, use a hardcoded treasury address for reads
    treasuryAddress: isConnected ? undefined : DEMO_TREASURY_ADDRESS,
  };
}
```

### Pattern 4: Shared viem Client

Reuse viem's public client for direct chain reads without wallet.

```typescript
// lib/chains.ts
import { createPublicClient, http } from "viem";
import { base, mainnet } from "viem/chains";

export const baseClient = createPublicClient({
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_BASE_RPC_URL),
});

export const l1Client = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_L1_RPC_URL),
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Routing all reads through MCP
**What:** Using MCP bridge for simple balance/state reads
**Why bad:** Adds latency (stdio spawn), unnecessary complexity, MCP is for agent tools
**Instead:** Use wagmi hooks or direct viem reads for on-chain state. Reserve MCP bridge for the playground and write operations.

### Anti-Pattern 2: Server Components for wallet-dependent UI
**What:** Trying to read wallet state in Next.js server components
**Why bad:** Wallet state is client-only (browser extension). Server components can't access it.
**Instead:** Mark any component using wagmi hooks as `"use client"`. Use server components only for static layout shells.

### Anti-Pattern 3: Global state management library
**What:** Adding Redux/Zustand for app state
**Why bad:** This app is stateless. All data comes from chain reads (cached by React Query) or MCP responses. Adding a state layer duplicates what wagmi+react-query already provide.
**Instead:** wagmi hooks for chain state, React Query for MCP bridge calls, React state for UI-only state (selected tool, form inputs).

### Anti-Pattern 4: Building your own wallet connect modal
**What:** Custom modal with MetaMask deeplinks, WalletConnect QR, etc.
**Why bad:** Days of work to handle edge cases (mobile browsers, multiple wallets, chain switching). RainbowKit solves all of this.
**Instead:** Use RainbowKit's ConnectButton. Customize the theme colors, not the modal logic.

## Scalability Considerations

Not relevant for hackathon — but noted for future:

| Concern | Hackathon (now) | Production (later) |
|---------|-----------------|-------------------|
| RPC rate limits | Public RPC fine for demo | Need Alchemy/Infura paid plan |
| MCP bridge concurrency | Single process, sequential | Need queue or worker pool |
| Chain data freshness | Manual refresh / page load | WebSocket subscriptions, polling |
| Error handling | Toast with error message | Retry logic, fallback RPCs |

## Sources

- [wagmi App Router setup](https://wagmi.sh/react/guides/connect-wallet)
- [RainbowKit installation](https://rainbowkit.com/docs/installation)
- [shadcn/ui Next.js setup](https://ui.shadcn.com/docs/installation/next)
- [Next.js App Router patterns](https://nextjs.org/docs/app)
