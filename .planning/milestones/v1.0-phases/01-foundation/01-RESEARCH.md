# Phase 1: Foundation - Research

**Researched:** 2026-03-19
**Domain:** Next.js App Router + RainbowKit wallet connect + MCP HTTP bridge
**Confidence:** HIGH

## Summary

Phase 1 builds the app shell: a Next.js App Router application in the monorepo, dark crypto theme with glassmorphism, RainbowKit wallet connection, demo mode with hardcoded treasury address, sidebar navigation to four placeholder sections, and an HTTP bridge that imports MCP tool handler logic directly into Next.js API routes.

The existing MCP server has 6 tool modules (treasury, lido, delegation, ens, monitor, uniswap) with a shared `AgentGateContext` interface. Tool handlers are tightly coupled to `McpServer.tool()` registration -- they cannot be imported as standalone functions. The bridge must create a thin adapter layer that constructs an `AgentGateContext` (using viem clients) and wraps the tool logic for HTTP consumption. The simplest approach is to extract the core logic from each tool handler into shared functions, or to create a registry that maps tool names to handler functions callable from API routes.

RainbowKit 2.2.10 + wagmi 3.5.0 + viem 2.47.5 is the current stable stack. The MCP server already uses viem ^2.23.0, so viem versions are compatible across the monorepo. RainbowKit requires `@tanstack/react-query >=5.0.0` as a peer dependency.

**Primary recommendation:** Create a `packages/app` Next.js 15 application with App Router, Tailwind CSS v4, shadcn components, and RainbowKit. Build the HTTP bridge as Next.js Route Handlers that import a shared tool registry from `@agentgate/mcp-server`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Uniswap-inspired dark theme: deep navy/charcoal background, soft card borders, modern DeFi aesthetic
- Electric purple/pink accent colors for glows, buttons, active states, and gradient treatments
- Glassmorphism cards: semi-transparent with blur backdrop and subtle border glow
- Narrow icon rail sidebar: slim with icons only, expands on hover to show labels -- maximizes content area
- Forced dark mode globally (no light mode toggle)
- App starts in demo mode by default -- zero-friction, no landing page choice
- Demo mode shows a subtle top banner: "Demo Mode -- viewing [treasury address]" with a "Connect Wallet" button
- Connected wallet state shows ENS name if available, falls back to truncated address (0x1234...abcd) with Base network badge
- Wallet connect via RainbowKit (MetaMask/WalletConnect)
- Connect wallet button always accessible in sidebar
- HTTP bridge: In-process import of MCP tool handler functions into Next.js API routes at `/api/mcp/[tool]`
- API routes return dashboard-friendly JSON
- Browser sends wallet address as parameter; demo mode sends hardcoded treasury address
- Server stays stateless
- 4 sidebar nav items: Treasury, Staking, Delegations, Playground
- AgentGate wordmark at top of sidebar with subtle glow effect
- Placeholder pages show a "Coming soon" glassmorphism card
- Production-ready patterns, not hackathon shortcuts
- Desktop only (1440px target, no mobile needed)

### Claude's Discretion
- Demo mode write behavior (auto dry-run vs disabled buttons -- lean toward auto dry-run for best judge experience)
- API response format (dashboard-friendly JSON shape)
- Default landing page selection
- Loading skeleton design
- Exact spacing, typography, and icon choices
- Error state handling patterns

### Deferred Ideas (OUT OF SCOPE)
- Delegation spending/allowance tracking view -- covered by Phase 2 DELG-01
- Overview/home page with summary stats from all domains -- potential future enhancement
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUN-01 | Next.js app created in `app/` as npm workspace package with Tailwind CSS | Next.js 15 App Router + Tailwind v4 + shadcn. Add `packages/app` to monorepo workspaces |
| FOUN-02 | Dark crypto theme applied globally (forced dark mode, glowing accents, DeFi aesthetic) | CSS variable overrides per UI-SPEC, glassmorphism recipe, shadcn dark theme init |
| FOUN-03 | Wallet connect via RainbowKit -- MetaMask/WalletConnect, address display, Base network badge | RainbowKit 2.2.10 + wagmi 3.5.0 + viem 2.47.5 + @tanstack/react-query 5.x |
| FOUN-04 | Demo mode -- app is fully explorable without connecting wallet (read-only with public RPC) | React context for wallet/demo state, hardcoded treasury address, conditional banner |
| FOUN-05 | HTTP/REST bridge exposing MCP tool handlers for Next.js API routes to call | Next.js Route Handlers importing tool logic, shared AgentGateContext factory |
| FOUN-06 | App shell with sidebar/nav linking to all dashboard sections | Icon rail sidebar with hover expand, Next.js App Router layout with nested routes |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.14 | React framework with App Router | Latest stable, Route Handlers for API bridge |
| react / react-dom | 19.x | UI library | Required by Next.js 15 |
| tailwindcss | 4.2.2 | Utility-first CSS | Standard for shadcn, v4 is current |
| @rainbow-me/rainbowkit | 2.2.10 | Wallet connect modal + UI | Industry standard for EVM wallet connect |
| wagmi | 3.5.0 | React hooks for Ethereum | RainbowKit peer dependency, provides useAccount/useConnect |
| viem | 2.47.5 | TypeScript Ethereum client | Already used by MCP server, wagmi peer dep |
| @tanstack/react-query | 5.91.2 | Async state management | Required peer dep for wagmi + RainbowKit |
| lucide-react | 0.577.0 | Icon library | Specified in UI-SPEC |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn (CLI) | 4.1.0 | Component scaffolding | Init once, install button/avatar/badge/tooltip/separator/skeleton |
| @radix-ui/* | (via shadcn) | Accessible UI primitives | Installed automatically by shadcn add |
| class-variance-authority | (via shadcn) | Component variant styling | Comes with shadcn init |
| clsx + tailwind-merge | (via shadcn) | Conditional class merging | `cn()` utility from shadcn |
| next/font | (built-in) | Font optimization | Load Inter variable font |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RainbowKit | ConnectKit | RainbowKit is specified in CONTEXT.md -- locked decision |
| Tailwind v4 | Tailwind v3 | v4 is current, uses CSS-native config. shadcn supports both |
| Next.js 15 | Next.js 14 | 15 is stable with App Router improvements, no reason to use older |

**Installation:**
```bash
cd packages/app
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
npx shadcn@latest init
npx shadcn@latest add button avatar badge tooltip separator skeleton
npm install @rainbow-me/rainbowkit wagmi viem @tanstack/react-query lucide-react
```

**Version verification:** Versions verified via `npm view [package] version` on 2026-03-19. All are current latest stable releases.

## Architecture Patterns

### Recommended Project Structure
```
packages/app/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout: providers, sidebar, demo banner
│   │   ├── page.tsx             # Redirect to /treasury (default landing)
│   │   ├── treasury/
│   │   │   └── page.tsx         # Placeholder "Coming soon"
│   │   ├── staking/
│   │   │   └── page.tsx         # Placeholder "Coming soon"
│   │   ├── delegations/
│   │   │   └── page.tsx         # Placeholder "Coming soon"
│   │   ├── playground/
│   │   │   └── page.tsx         # Placeholder "Coming soon"
│   │   ├── api/
│   │   │   └── mcp/
│   │   │       └── [tool]/
│   │   │           └── route.ts # Dynamic route handler for MCP bridge
│   │   └── globals.css          # Tailwind + CSS variable overrides
│   ├── components/
│   │   ├── ui/                  # shadcn components (auto-generated)
│   │   ├── sidebar.tsx          # Icon rail sidebar with hover expand
│   │   ├── demo-banner.tsx      # Demo mode top banner
│   │   ├── wallet-display.tsx   # Connected wallet address + badge
│   │   └── placeholder-page.tsx # Reusable "Coming soon" card
│   ├── providers/
│   │   ├── web3-provider.tsx    # WagmiProvider + QueryClientProvider + RainbowKitProvider
│   │   └── app-provider.tsx     # Demo mode context, wallet state
│   ├── lib/
│   │   ├── utils.ts             # cn() utility (shadcn)
│   │   ├── wagmi-config.ts      # wagmi createConfig with Base chain
│   │   ├── mcp-bridge.ts        # Client-side fetch helpers for /api/mcp/[tool]
│   │   └── constants.ts         # Treasury address, chain config
│   └── styles/
│       └── theme.ts             # CSS variable values (if needed outside CSS)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── components.json              # shadcn config
```

### Pattern 1: RainbowKit + wagmi Provider Stack (App Router)
**What:** Client component wrapping the app with Web3 providers
**When to use:** Root layout, must be a client component due to wagmi/RainbowKit hooks

```typescript
// src/providers/web3-provider.tsx
"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi-config";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#8B5CF6",  // matches --primary
            borderRadius: "medium",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

```typescript
// src/lib/wagmi-config.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "AgentGate",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "placeholder",
  chains: [base],
  ssr: true,  // Required for Next.js App Router
});
```

### Pattern 2: MCP HTTP Bridge (Route Handler)
**What:** Dynamic API route that maps tool names to handler functions
**When to use:** `/api/mcp/[tool]` endpoint for dashboard to call MCP tools via HTTP

```typescript
// src/app/api/mcp/[tool]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base, mainnet } from "viem/chains";

// Tool registry - maps tool names to handler functions
// These are extracted/adapted from @agentgate/mcp-server tool modules
const toolRegistry: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> }
) {
  const { tool } = await params;
  const body = await request.json();

  const handler = toolRegistry[tool];
  if (!handler) {
    return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 404 });
  }

  try {
    const result = await handler(body);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

### Pattern 3: Demo Mode Context
**What:** React context that tracks wallet connection state and provides the active address (connected or demo)
**When to use:** Throughout the app to determine which address to query

```typescript
// src/providers/app-provider.tsx
"use client";

import { createContext, useContext } from "react";
import { useAccount } from "wagmi";

const DEMO_TREASURY_ADDRESS = "0x..."; // Hardcoded treasury address

interface AppContextValue {
  isDemo: boolean;
  activeAddress: string;
  treasuryAddress: string;
}

const AppContext = createContext<AppContextValue>({
  isDemo: true,
  activeAddress: DEMO_TREASURY_ADDRESS,
  treasuryAddress: DEMO_TREASURY_ADDRESS,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();

  const value: AppContextValue = {
    isDemo: !isConnected,
    activeAddress: isConnected ? address! : DEMO_TREASURY_ADDRESS,
    treasuryAddress: DEMO_TREASURY_ADDRESS,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);
```

### Pattern 4: Icon Rail Sidebar with Hover Expand
**What:** Fixed sidebar that shows icons only at 56px, expands to 240px on hover
**When to use:** Main navigation component

Key implementation details:
- Use CSS `group` + `group-hover` for expand behavior
- Also support `focus-within` for keyboard accessibility
- `transition-all duration-200` for smooth expand/collapse
- Active route detection via `usePathname()` from `next/navigation`

### Anti-Patterns to Avoid
- **Importing McpServer in API routes:** The MCP server depends on `StdioServerTransport` and the full SDK. API routes should import only the tool logic (viem calls + ABIs), not the MCP framework itself.
- **Using `getDefaultConfig` without `ssr: true`:** Causes hydration mismatches in Next.js App Router. Always set `ssr: true`.
- **Creating QueryClient in render:** `new QueryClient()` must be outside the component body or in a ref/state to avoid creating a new client on every render.
- **Light mode CSS bleeding through:** shadcn generates both light and dark variables. Override `:root` with dark values and set `<html class="dark">` in layout.
- **Server Components importing wagmi hooks:** Wallet hooks (useAccount, useConnect) are client-only. Mark components with "use client" directive.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wallet connection | Custom MetaMask integration | RainbowKit + wagmi | Handles 10+ wallets, chain switching, ENS resolution, connection persistence |
| Component styling | Custom button/badge/tooltip | shadcn components | Accessible, themeable, consistent with design system |
| Dark theme variables | Manual CSS for every component | shadcn dark theme + CSS variable overrides | 6 CSS variables override the entire theme |
| Route-based navigation | Custom router | Next.js App Router | File-system routing, layouts, loading states built in |
| Icon set | SVG sprites or custom icons | lucide-react | Tree-shakeable, consistent style, specified in UI-SPEC |
| Class merging | Template literals for conditional classes | `cn()` from shadcn (clsx + tailwind-merge) | Handles Tailwind class conflicts correctly |

**Key insight:** The UI-SPEC already specifies shadcn with specific components and CSS variable overrides. Follow the spec exactly -- it was designed to minimize custom styling work.

## Common Pitfalls

### Pitfall 1: MCP Server Import Pollution
**What goes wrong:** Importing from `@agentgate/mcp-server` pulls in `@modelcontextprotocol/sdk` and `StdioServerTransport`, which are Node.js-specific and may cause bundling issues in Next.js.
**Why it happens:** Tool files import `McpServer` type and use `server.tool()` registration pattern.
**How to avoid:** Create a shared module (e.g., `packages/mcp-server/src/handlers/`) that exports pure functions with the tool logic. API routes import these functions, not the tool registration files. Alternatively, create a `packages/mcp-server/src/bridge.ts` that re-exports only the handler logic without MCP SDK dependencies.
**Warning signs:** Build errors mentioning `StdioServerTransport`, `readline`, or Node.js stream APIs in the browser bundle.

### Pitfall 2: Wagmi Hydration Mismatch
**What goes wrong:** SSR renders one state (disconnected), client hydrates with different state (connected from localStorage).
**Why it happens:** wagmi persists connection state. Server has no access to this state.
**How to avoid:** Set `ssr: true` in `getDefaultConfig()`. Use `mounted` state pattern: render null/skeleton on server, real content after mount.
**Warning signs:** React hydration warnings in console, flash of incorrect wallet state.

### Pitfall 3: Viem BigInt Serialization
**What goes wrong:** API routes return BigInt values from viem contract reads, which JSON.stringify cannot handle.
**Why it happens:** Solidity uint256 maps to JavaScript BigInt. `JSON.stringify(123n)` throws.
**How to avoid:** Convert BigInt to string before JSON response. The existing MCP tools already use `formatEther()` -- follow that pattern. In the bridge, add a JSON replacer: `JSON.stringify(data, (_, v) => typeof v === "bigint" ? v.toString() : v)`.
**Warning signs:** "TypeError: Do not know how to serialize a BigInt" in API responses.

### Pitfall 4: Environment Variables in Next.js
**What goes wrong:** Server-side env vars (RPC_URL, PRIVATE_KEY) are undefined in API routes, or client-side vars are exposed.
**Why it happens:** Next.js only exposes `NEXT_PUBLIC_*` vars to the client. Server vars need different handling than in a pure Node.js app.
**How to avoid:** Use `NEXT_PUBLIC_` prefix only for WalletConnect project ID. Keep RPC_URL, PRIVATE_KEY, TREASURY_ADDRESS as server-only vars. Access them in Route Handlers via `process.env` (server-side).
**Warning signs:** `undefined` RPC URLs, private keys in browser network tab.

### Pitfall 5: Sidebar Hover vs. Keyboard Accessibility
**What goes wrong:** Sidebar only expands on mouse hover, keyboard users cannot see labels.
**Why it happens:** CSS `:hover` does not trigger on keyboard focus.
**How to avoid:** Add `focus-within` alongside `group-hover`. The UI-SPEC explicitly calls for this: "Sidebar expandable via keyboard focus (not hover-only -- add focus-within trigger)".
**Warning signs:** Tab navigation shows only icons without labels.

### Pitfall 6: RainbowKit CSS Import Order
**What goes wrong:** RainbowKit modal styling is broken or overridden by Tailwind reset.
**Why it happens:** Tailwind's base reset (preflight) can override RainbowKit's styles.
**How to avoid:** Import `@rainbow-me/rainbowkit/styles.css` in the provider component. Ensure it loads after Tailwind base but the RainbowKit modal uses portal rendering which usually avoids conflicts.
**Warning signs:** Unstyled modal, missing borders/shadows in RainbowKit connect dialog.

## Code Examples

### wagmi Config for Base Chain
```typescript
// src/lib/wagmi-config.ts
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "AgentGate",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "demo",
  chains: [base],
  ssr: true,
});
```

### Glassmorphism Card Component
```typescript
// Based on UI-SPEC glassmorphism recipe
function GlassCard({
  children,
  glow = false,
  className,
}: {
  children: React.ReactNode;
  glow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-card/60 backdrop-blur-lg p-8",
        glow && "shadow-[0_0_24px_hsl(270_95%_65%/0.15)]",
        className
      )}
    >
      {children}
    </div>
  );
}
```

### CSS Variable Overrides (globals.css)
```css
/* From UI-SPEC -- override shadcn defaults for dark crypto theme */
:root {
  --background: 222 47% 8%;
  --foreground: 220 15% 90%;
  --card: 222 40% 12%;
  --card-foreground: 220 15% 90%;
  --popover: 222 40% 12%;
  --popover-foreground: 220 15% 90%;
  --primary: 270 95% 65%;
  --primary-foreground: 0 0% 100%;
  --secondary: 222 30% 16%;
  --secondary-foreground: 220 15% 90%;
  --muted: 222 30% 16%;
  --muted-foreground: 222 15% 55%;
  --accent: 222 30% 16%;
  --accent-foreground: 220 15% 90%;
  --destructive: 0 72% 51%;
  --border: 222 30% 18%;
  --input: 222 30% 18%;
  --ring: 270 95% 65%;
  --radius: 0.75rem;

  /* Custom tokens */
  --success: 142 72% 45%;
  --warning: 38 92% 50%;
}
```

### Bridge Tool Registry Pattern
```typescript
// packages/mcp-server/src/bridge.ts
// Export tool handler functions without MCP SDK dependency

import { createPublicClient, http, formatEther, type Address } from "viem";
import { base, mainnet } from "viem/chains";

export interface BridgeContext {
  publicClient: ReturnType<typeof createPublicClient>;
  l1PublicClient: ReturnType<typeof createPublicClient>;
  walletAddress?: string;
  dryRun: boolean;
}

export function createBridgeContext(walletAddress?: string): BridgeContext {
  return {
    publicClient: createPublicClient({
      chain: base,
      transport: http(process.env.RPC_URL || "https://mainnet.base.org"),
    }),
    l1PublicClient: createPublicClient({
      chain: mainnet,
      transport: http(process.env.L1_RPC_URL || "https://eth.llamarpc.com"),
    }),
    walletAddress,
    dryRun: true,  // Dashboard bridge is always read-only or dry-run
  };
}

// Tool handlers are functions: (params, ctx) => Promise<Result>
export type ToolHandler = (
  params: Record<string, unknown>,
  ctx: BridgeContext
) => Promise<Record<string, unknown>>;
```

### Monorepo Package.json for App
```json
{
  "name": "@agentgate/app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  }
}
```

### Root Package.json Update
```json
{
  "scripts": {
    "dev": "cd packages/app && npm run dev",
    "build": "npm run build --workspace=@agentgate/mcp-server && npm run build --workspace=@agentgate/app"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 (JS config) | Tailwind v4 (CSS-native config) | 2025 | Config in CSS, no tailwind.config.js needed with v4 |
| Next.js Pages Router | Next.js App Router | Next.js 13+ (stable 14+) | Layouts, Server Components, Route Handlers |
| ethers.js | viem + wagmi | 2023-2024 | Better TypeScript, tree-shaking, ABI type safety |
| web3-react | RainbowKit + wagmi | 2023 | Better UX, more wallets, easier setup |
| RainbowKit v1 | RainbowKit v2 | 2024 | wagmi v2 support, new theming API |

**Deprecated/outdated:**
- `@rainbow-me/rainbowkit` v1: Incompatible with wagmi v2+
- `wagmi` v1: Uses ethers.js internally. v2+ uses viem
- `tailwind.config.js`: Still works but v4 prefers CSS-native configuration
- `pages/api/` routes: Still works in Next.js 15 but App Router `route.ts` is preferred

## Open Questions

1. **MCP Tool Handler Extraction Strategy**
   - What we know: Tool handlers are registered via `server.tool(name, description, schema, handler)`. The handler functions are closures that capture `ctx` (AgentGateContext) and module-scoped variables (ABIs, addresses).
   - What's unclear: Whether to (a) refactor existing tool files to export standalone handler functions alongside the registration function, or (b) create a separate `bridge.ts` module that re-implements the read-only subset of tool logic.
   - Recommendation: Option (a) -- refactor each tool file to export a `handlers` object alongside `registerXTools`. This keeps logic DRY and ensures the bridge always matches the MCP server behavior. The existing code is well-structured enough that extracting the handler closures into named functions is straightforward.

2. **WalletConnect Project ID**
   - What we know: RainbowKit's `getDefaultConfig` requires a `projectId` for WalletConnect v2.
   - What's unclear: Whether a project ID is already registered for AgentGate.
   - Recommendation: Use a placeholder string for development. Add `NEXT_PUBLIC_WC_PROJECT_ID` to `.env.local`. WalletConnect v2 requires a free project ID from https://cloud.walletconnect.com -- register one before demo.

3. **Treasury Address for Demo Mode**
   - What we know: Demo mode uses a hardcoded treasury address. STATE.md notes "Confirm treasury contract address on Base mainnet has real deposits for demo mode" as a blocker.
   - What's unclear: The actual deployed treasury address.
   - Recommendation: Use `NEXT_PUBLIC_DEMO_TREASURY_ADDRESS` env var with a fallback. Implementation should not block on this -- the address can be set later.

4. **Tailwind v4 vs v3 for shadcn**
   - What we know: Tailwind v4 is latest (CSS-native config). shadcn has v4 support.
   - What's unclear: Whether `create-next-app` scaffolds v4 by default now.
   - Recommendation: Use whatever `create-next-app@latest` scaffolds. If it scaffolds v3, that is fine -- shadcn works with both. The CSS variable override approach in the UI-SPEC works identically in both versions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (recommended for Next.js + TypeScript) |
| Config file | none -- see Wave 0 |
| Quick run command | `cd packages/app && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/app && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-01 | Next.js app builds and starts | smoke | `cd packages/app && npm run build` | n/a (build command) |
| FOUN-02 | Dark theme CSS variables are set | unit | `npx vitest run src/__tests__/theme.test.ts -t "dark theme"` | Wave 0 |
| FOUN-03 | RainbowKit provider renders without error | unit | `npx vitest run src/__tests__/providers.test.tsx` | Wave 0 |
| FOUN-04 | Demo mode context returns correct address | unit | `npx vitest run src/__tests__/demo-mode.test.tsx` | Wave 0 |
| FOUN-05 | MCP bridge route responds to POST | integration | `npx vitest run src/__tests__/api-bridge.test.ts` | Wave 0 |
| FOUN-06 | Sidebar renders 4 nav items | unit | `npx vitest run src/__tests__/sidebar.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/app && npm run build`
- **Per wave merge:** `cd packages/app && npx vitest run`
- **Phase gate:** Full suite green + `npm run dev` starts without errors

### Wave 0 Gaps
- [ ] `packages/app/vitest.config.ts` -- Vitest configuration with jsdom environment
- [ ] `packages/app/src/__tests__/theme.test.ts` -- CSS variable validation
- [ ] `packages/app/src/__tests__/providers.test.tsx` -- Provider tree renders
- [ ] `packages/app/src/__tests__/demo-mode.test.tsx` -- Demo mode context logic
- [ ] `packages/app/src/__tests__/api-bridge.test.ts` -- Bridge route handler tests
- [ ] `packages/app/src/__tests__/sidebar.test.tsx` -- Sidebar navigation rendering
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react`

## Sources

### Primary (HIGH confidence)
- npm registry -- verified versions for all packages (2026-03-19)
- Existing codebase -- `packages/mcp-server/src/` tool files, `AgentGateContext` interface, package.json
- UI-SPEC -- `.planning/phases/01-foundation/01-UI-SPEC.md` design contract

### Secondary (MEDIUM confidence)
- RainbowKit peer dependencies from npm -- wagmi ^2.9.0, viem 2.x, react >=18
- shadcn init process -- based on current CLI behavior

### Tertiary (LOW confidence)
- Tailwind v4 default in create-next-app -- may still scaffold v3, need to verify at execution time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry, peer deps confirmed compatible
- Architecture: HIGH -- patterns based on existing codebase analysis + established Next.js App Router conventions
- Pitfalls: HIGH -- based on known issues with wagmi SSR, BigInt serialization, and MCP SDK bundling
- Bridge strategy: MEDIUM -- the tool handler extraction approach is sound but implementation details depend on how tightly coupled the closure variables are

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable ecosystem, 30-day validity)
