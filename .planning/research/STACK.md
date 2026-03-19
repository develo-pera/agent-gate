# Technology Stack

**Project:** AgentGate Dashboard
**Researched:** 2026-03-19
**Context:** DeFi dashboard + MCP playground for hackathon demo (~2 days), added to existing monorepo with MCP server using viem ^2.23.0

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Next.js | ^15.5 | App framework | Use 15, NOT 16. The monorepo already runs Node tooling and Next.js 15 is battle-tested. Next.js 16 shipped recently (Turbopack default, new caching) but is too fresh for a 2-day hackathon — risk of edge-case bugs with wallet libs. App Router for layouts/server components. | HIGH |
| React | ^19.0 | UI library | Ships with Next.js 15. Required by wagmi 3.x and RainbowKit 2.x. | HIGH |
| TypeScript | ^5.7.0 | Type safety | Already in monorepo. Share types between MCP server and dashboard. | HIGH |

### Wallet Connection

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| wagmi | ^3.5.0 | React hooks for Ethereum | Standard for React + Ethereum. v3 pairs with viem v2 which the MCP server already uses. Hooks for balance reads, tx signing, chain switching. | HIGH |
| viem | ^2.47.0 | Ethereum client | Already a dependency in MCP server (^2.23.0). Wagmi 3.x wraps viem natively. Share the same viem version across monorepo. | HIGH |
| @rainbow-me/rainbowkit | ^2.2.10 | Wallet modal UI | Polished connect modal out of the box — MetaMask, WalletConnect, Coinbase, injected. Dark theme built-in. ConnectKit is lighter but less actively maintained. For a hackathon, RainbowKit's zero-config polish wins. | HIGH |
| @tanstack/react-query | ^5.91.0 | Async state management | Required peer dependency for wagmi 3.x. Also useful for MCP tool call caching in the playground. | HIGH |

### Styling & UI Components

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Tailwind CSS | ^4.2.0 | Utility CSS | v4 is stable with CSS-first config (no tailwind.config.js needed). 5x faster builds. Pairs with shadcn/ui. | HIGH |
| shadcn/ui | latest CLI | Component library | Copy-paste components built on Radix UI + Tailwind. Dark mode via CSS variables. Card, Table, Tabs, Dialog, Sheet — every dashboard primitive. No runtime dependency, full code ownership. | HIGH |
| next-themes | ^0.4.6 | Dark mode toggle | 2 lines to add dark mode. Required by shadcn/ui dark mode pattern. Force dark by default for crypto aesthetic. | HIGH |
| lucide-react | ^0.577.0 | Icons | shadcn/ui's default icon set. Tree-shakeable SVG icons. | HIGH |

### Charts & Visualization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| recharts | ^3.8.0 | Charts | shadcn/ui has built-in Chart components wrapping Recharts. v3 is stable with good performance. Use for vault yield curves, staking APR, balance history. | HIGH |

### Animation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| motion | ^12.37.0 | Micro-animations | Formerly framer-motion. Import from `motion/react`. Use sparingly — glowing card borders, number tickers, page transitions. Makes demo video pop without adding complexity. | MEDIUM |

### MCP Integration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Native fetch | built-in | HTTP bridge calls | The MCP server needs an HTTP/SSE bridge endpoint. Dashboard calls it via fetch. No extra HTTP client library needed — Next.js extends fetch with caching. | HIGH |

### Dev Tooling

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @tanstack/react-query-devtools | ^5.91.0 | Query debugging | See all wagmi/query cache in dev. Remove for prod. | HIGH |
| eslint | ^9.0 | Linting | Next.js ships eslint config. | HIGH |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | Next.js 16 | Too new (weeks old). Wallet libs haven't fully validated against it. Risk not worth it for 2-day hackathon. |
| Wallet UI | RainbowKit | ConnectKit | ConnectKit lighter but less actively maintained. RainbowKit has polished dark theme, wider wallet support, better docs. |
| Wallet UI | RainbowKit | Custom wagmi hooks only | Building a connect modal from scratch wastes hours. RainbowKit gives a production-quality modal in 5 minutes. |
| Charts | Recharts | Tremor | Tremor wraps Recharts anyway. shadcn/ui has native Recharts integration — use the built-in Chart components. |
| Charts | Recharts | D3 directly | Way too much work for a hackathon. Recharts gives declarative React charts. |
| Styling | Tailwind + shadcn | Chakra UI | Chakra has runtime CSS-in-JS overhead. Tailwind + shadcn is zero-runtime, faster, and the 2025/2026 standard. |
| Styling | Tailwind + shadcn | MUI | Heavy bundle, opinionated Material theme fights against crypto aesthetic. |
| Animation | motion | CSS only | CSS animations work for simple cases but motion gives spring physics and layout animations that make a demo video impressive. Worth the 15KB. |
| Animation | motion | GSAP | Overkill for UI micro-animations. motion integrates natively with React component lifecycle. |
| State | React Query + wagmi | Redux/Zustand | wagmi already uses React Query internally. Adding another state layer is unnecessary. All state comes from chain (stateless app). |
| HTTP Client | fetch | axios | Axios adds bundle size for no benefit. Next.js fetch has built-in caching and revalidation. |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| ethers.js | viem is already in the monorepo and wagmi wraps viem natively. Mixing ethers + viem creates confusion and duplicate dependencies. |
| web3.js | Legacy. viem replaced it. |
| styled-components / emotion | Runtime CSS-in-JS is dying. Tailwind is faster, smaller, and the ecosystem standard. |
| Next.js Pages Router | App Router is the standard. RainbowKit and shadcn/ui both document App Router patterns. |
| Prisma / database | Project is stateless — all data from chain. No persistence needed. |
| tRPC | Adds complexity for what is essentially one HTTP endpoint (MCP bridge). Plain fetch is sufficient. |
| Hardhat | Foundry already in use for contracts. Don't introduce a second tool. |

## Installation

```bash
# From monorepo root, create the app workspace
# (assumes npm workspaces with "app" added to package.json workspaces array)

# Core framework
npm install next@^15.5 react@^19 react-dom@^19 --workspace=app

# Wallet connection
npm install wagmi@^3.5.0 viem@^2.47.0 @rainbow-me/rainbowkit@^2.2.10 @tanstack/react-query@^5.91.0 --workspace=app

# UI
npm install tailwindcss@^4.2.0 @tailwindcss/postcss lucide-react@^0.577.0 next-themes@^0.4.6 --workspace=app

# Charts
npm install recharts@^3.8.0 --workspace=app

# Animation (optional but recommended for demo impact)
npm install motion@^12.37.0 --workspace=app

# Dev
npm install -D typescript@^5.7.0 @types/node@^22 @types/react@^19 @types/react-dom@^19 @tanstack/react-query-devtools@^5.91.0 --workspace=app

# shadcn/ui init (run from app/ directory)
cd app && npx shadcn@latest init
# Then add components as needed:
# npx shadcn@latest add card button tabs table dialog sheet badge separator
```

## Dependency Graph

```
Next.js 15
  +-- React 19
  +-- Tailwind CSS 4
  |     +-- shadcn/ui (copy-paste, no runtime dep)
  |           +-- Radix UI (primitives)
  |           +-- lucide-react (icons)
  |           +-- recharts (charts via shadcn Chart)
  +-- wagmi 3
  |     +-- viem 2 (shared with MCP server)
  |     +-- @tanstack/react-query 5
  +-- @rainbow-me/rainbowkit 2
  |     +-- wagmi 3 (peer dep)
  +-- next-themes (dark mode)
  +-- motion (animations)
```

## Version Compatibility Notes

- **viem version alignment**: MCP server uses `^2.23.0`, dashboard will use `^2.47.0`. npm workspaces will hoist to the highest compatible version. Both are within the `^2.x` range so this is safe. Verify no breaking changes in viem 2.23-2.47 range (viem follows semver strictly).
- **React 19 + RainbowKit**: RainbowKit 2.x officially supports React 19 as of v2.2.x.
- **Tailwind v4 + shadcn/ui**: shadcn CLI v4 (March 2026) fully supports Tailwind v4's CSS-first config.
- **wagmi 3 + Next.js 15 App Router**: wagmi 3 works with React Server Components — just mark provider wrappers with `"use client"`.

## Sources

- [Next.js releases](https://github.com/vercel/next.js/releases) — v15.5 stable, v16.1.6 latest
- [wagmi npm](https://www.npmjs.com/package/wagmi) — v3.5.0
- [viem npm](https://www.npmjs.com/package/viem) — v2.47.4
- [RainbowKit npm](https://www.npmjs.com/package/@rainbow-me/rainbowkit) — v2.2.10
- [Tailwind CSS v4.2](https://tailwindcss.com/blog/tailwindcss-v4) — v4.2.1
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next)
- [shadcn/cli v4 changelog (March 2026)](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4)
- [Recharts npm](https://www.npmjs.com/package/recharts) — v3.8.0
- [motion npm](https://www.npmjs.com/package/framer-motion) — v12.37.0
- [next-themes GitHub](https://github.com/pacocoursey/next-themes) — v0.4.6
- [TanStack React Query npm](https://www.npmjs.com/package/@tanstack/react-query) — v5.91.2
- [lucide-react npm](https://www.npmjs.com/package/lucide-react) — v0.577.0
