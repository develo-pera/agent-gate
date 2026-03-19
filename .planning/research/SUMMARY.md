# Project Research Summary

**Project:** AgentGate Dashboard
**Domain:** DeFi Dashboard + MCP Tool Playground (hackathon demo, ~2-day build)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

AgentGate is a Next.js frontend layered on top of an existing MCP server in a monorepo, targeting multiple Synthesis hackathon bounties within a 2-day build window. The stack is unambiguous: Next.js 15, wagmi 3, viem 2, RainbowKit 2, Tailwind 4 + shadcn/ui — the standard 2026 DeFi frontend setup, with all packages fully compatible with the viem 2.x already present in the monorepo. The architectural decision of most consequence is the HTTP bridge: import tool handler functions directly via a thin Next.js REST API route rather than spawning a child process or using full MCP protocol transport. This eliminates the highest-risk implementation path while preserving every visual demo advantage.

The single most important feature is the MCP Playground. No competing hackathon project will have interactive live tool execution with formatted JSON request/response display, and it targets multiple bounties simultaneously (Lido MCP at $3K/$2K/$1K, MetaMask delegation, Synthesis Open Track). Everything else — Treasury dashboard, Staking overview, Delegation viewer — supports the story the Playground tells. The entire project should be designed around a pre-scripted 2-minute demo video; features that cannot fit that script should not be built. The architecture confirms a clean dual data path: direct viem reads for dashboard data (fast, typed, cacheable), MCP bridge calls only for the Playground and write operations.

The primary risk to the demo is reliability under time pressure: live RPC calls failing during video recording, the HTTP bridge becoming a 3-hour time sink, and scope creep producing six half-finished pages instead of three polished ones. Mitigation must be applied from day one — aggressive React Query caching with fallback mock data, a hard 3-hour timebox on bridge work, and a strict 3-page limit enforced before a single component is written. Read-only demo mode with a hardcoded treasury address is not a workaround; it is the primary demo path.

## Key Findings

### Recommended Stack

The full stack is HIGH confidence with verified npm versions. Next.js 15 (explicitly not 16 — too fresh, wallet libs not fully validated against it) with the App Router uses React 19 and TypeScript 5.7. wagmi 3 wraps viem 2 natively, sharing the same version already present in the MCP server package. RainbowKit 2.2 provides a zero-config wallet connect modal with dark theme built-in and confirmed React 19 support. Tailwind CSS 4 uses CSS-first config (no `tailwind.config.js` required), and the shadcn/ui CLI v4 (March 2026) fully supports it — every dashboard primitive (Card, Table, Tabs, Dialog, Badge, Sheet) is available as copy-paste components with no runtime dependency. Recharts 3 via shadcn's Chart components handles visualization with minimal configuration. The `motion` package (formerly framer-motion) adds spring-physics animations that make demo video recordings distinctive.

**Core technologies:**
- **Next.js 15 (App Router):** Framework — stable, battle-tested, wagmi provider wrappers marked "use client", server components for layout/static content
- **wagmi 3 + viem 2:** Ethereum reads and writes — wraps existing monorepo viem natively, no duplicate dependencies, hooks for balance, tx signing, chain state
- **RainbowKit 2.2:** Wallet modal — zero-config, MetaMask + WalletConnect, dark theme built-in, React 19 confirmed
- **@tanstack/react-query 5:** Async state — required wagmi peer dependency, powers `stale-while-revalidate` caching for RPC call protection
- **Tailwind CSS 4 + shadcn/ui:** Styling and components — zero-runtime, CSS variables for dark mode, every dashboard primitive covered
- **Recharts 3:** Charts — integrated via shadcn Chart components, declarative React, minimal config
- **motion 12:** Animations — spring physics for glow borders and number reveals, 15KB, makes demo video pop

**What not to use:** ethers.js (viem already present), web3.js (legacy), styled-components/emotion (runtime CSS-in-JS), Next.js Pages Router, Prisma/database (stateless app), tRPC (one endpoint, plain fetch sufficient), Next.js 16.

### Expected Features

Features are ranked by demo-day impact within the 2-day constraint.

**Must have (table stakes):**
- Dark crypto theme (`#0a0e1a` background, electric blue/green accent) — missing this reads as "generic React app" to judges
- Wallet connect button (RainbowKit) + read-only demo mode with hardcoded treasury address — judges expect live chain data
- Vault status display (principal, yield, total balance) via direct viem reads — three big number cards, the treasury contract is the core innovation
- MCP Playground with live tool execution — centerpiece for 3+ bounties, no competitor will have this
- Transaction feedback (success/error toast with Basescan link) after any write
- Loading/error states with skeleton loaders — blank screens during RPC calls are immediately disqualifying

**Should have (differentiators):**
- Principal vs yield visualization (styled progress bar or donut chart) — makes principal-protection story instantly comprehensible
- Dry-run simulation panel (show estimated outcome before execution) — safety feature and demo differentiator
- Vault health report card (color-coded risk indicators) — low effort, targets Vault Monitor bounty
- Staking APR display with real Lido data — targets Lido stETH Treasury bounty
- Delegation flow visualization (ERC-7710 permission cards) — makes MetaMask bounty story tangible
- Request/response JSON viewer with syntax highlighting and copy button in Playground

**Defer entirely (explicit anti-features for this timeline):**
- Real swap execution UI — Uniswap swap untested on mainnet, execution risk kills demo credibility; show `uniswap_quote` in Playground only
- Mobile responsive layout — every hour on responsive CSS is wasted
- Historical time-series charts — requires indexers (The Graph/Dune), too heavy for 2 days
- WebSocket real-time updates — 15-second polling with manual refresh is sufficient for a demo
- ENS dedicated page — include ENS tools in the Playground only
- Multi-chain switching — hardcode Base, treat L1 as secondary read source
- Governance voting UI — requires LDO tokens on L1, unreliable for demo

**Highest ROI single feature:** MCP Playground. Targets 3+ bounties, no competitor will have it, visually distinctive. Build it above everything except the basic app shell.

### Architecture Approach

The architecture separates into two explicit data paths that never cross. Dashboard pages use direct viem `readContract()` calls against Base mainnet for fast, typed, cacheable data — React Query with `stale-while-revalidate` and a 60-second minimum TTL protects against RPC rate limits. The MCP Playground uses a thin REST bridge (`/api/mcp/[tool]/route.ts`) that imports tool handler functions directly from `packages/mcp-server/src/tools/` — no child process spawning, no MCP protocol negotiation, no JSON-RPC framing. Wallet state lives exclusively in client components (`"use client"`) behind a `WalletModeProvider` context that transparently switches between connected-wallet mode and read-only demo mode.

**Major components:**
1. **Next.js Pages** (Treasury, Staking/Delegations, Playground) — UI rendering, 4-section layout, client-only wallet interactions
2. **Direct viem Hooks** (`useVaultStatus`, `useLidoPositions`, `useDelegations`) — fast on-chain reads, React Query caching, 15-second refetch interval
3. **REST API Bridge** (`/api/mcp/[tool]/route.ts`) — imports tool handler functions from MCP server package, POST endpoint, returns JSON
4. **MCP Client Hook** (`useMcpTool`) — React Query mutation calling the REST bridge, surfaces request/response pairs to Playground UI
5. **Wallet Provider Layer** (wagmi + RainbowKit + WalletModeProvider) — connection state, demo mode fallback, all in "use client" boundaries
6. **Static Tool Registry** (`lib/tool-registry.ts`) — build-time metadata for all 27 tools, powers Playground tool selector and parameter form generation without MCP protocol discovery

**Monorepo change required:** Add `tool-executor.ts` to `packages/mcp-server/src/lib/` exporting tool handler functions callable without the MCP `server` instance. The existing stdio entry point (`index.ts`) remains unchanged.

**Anti-patterns confirmed:** Never spawn MCP stdio as a child process from an API route. Never import `@modelcontextprotocol/sdk/client` in browser components. Never route dashboard display data through the MCP bridge. Never access wallet state in server components.

### Critical Pitfalls

1. **Live RPC failures during demo recording** — Public RPCs rate-limit under simultaneous page loads. Prevention: React Query `stale-while-revalidate` with 60-second minimums, authenticated Alchemy/Infura URLs (free tier gives 10x the limits), pre-warm all pages before recording, implement fallback mock data. Must be addressed in Phase 1 data layer setup — not retroactively.

2. **HTTP bridge becoming a time sink** — Implementing full MCP protocol transport, process spawning, or JSON-RPC framing eats the entire 2-day budget. Hard rule: if writing `child_process.spawn` or pipe handling code, stop immediately and use direct function imports. Timebox: 3 hours maximum. If not working in 3 hours, show pre-recorded tool call/response JSON in the Playground as a convincing fallback.

3. **Scope creep: 6 half-finished pages instead of 3 polished ones** — Script the 2-minute video before writing any code. Build exactly what the script requires. Enforce a strict 3-page limit (Playground, Treasury, Staking/Delegations). The out-of-scope list (Uniswap swap, ENS page, governance voting) is immovable. If building a 4th page, stop and polish the existing 3.

4. **SSE buffering in Next.js App Router destroys Playground feel** — App Router buffers SSE responses (vercel/next.js#48427), delivering all chunks at once after handler completion. Prevention: use POST endpoints returning complete JSON. Fake the streaming experience client-side — show request JSON immediately, pulsing "processing" state, reveal response with typing animation. This is more reliable and looks identical in a video.

5. **Wallet connection complexity displacing core features** — DeFi dashboards "need" wallet connect, but this is a recorded demo. Default to read-only demo mode; use a hardcoded address for all display data. Add RainbowKit with zero customization only if a bounty explicitly requires wallet signing. Avoid writing any `window.ethereum` handling code directly.

## Implications for Roadmap

Research identifies four distinct phases with strict dependency ordering. Phases 2 and 3 can overlap once Phase 1 is complete.

### Phase 1: Foundation (hours 0-8)

**Rationale:** All subsequent features depend on the app shell, data layer, and bridge being operational. Caching and demo-mode fallbacks implemented here prevent catastrophic demo failures in recording. Monorepo workspace configuration must be validated before any feature code. This phase uses exclusively well-documented patterns — no per-phase research needed.

**Delivers:** Working Next.js app with dark theme, navigation, wallet connect + read-only demo mode, viem client config with React Query caching, REST API bridge to MCP tool handlers, and `tool-executor.ts` extraction from MCP server.

**Addresses features:** Dark crypto theme, wallet connect button, read-only demo mode, loading/error states foundation.

**Avoids pitfalls:** Monorepo workspace setup (#6 — validate `npm install` before writing feature code), environment variable leaks (#11 — server-side only for sensitive vars), RPC failure groundwork (#1 — caching pattern established from day one), HTTP bridge timebox (#2 — start the clock in Phase 1), wallet complexity (#5 — default to demo mode), dark theme foundation (#7 — establish design tokens before building pages).

**Parallelizable sub-tasks:**
- Track A: Next.js scaffold, Tailwind 4 + shadcn/ui init, dark theme tokens, nav layout shell
- Track B: `tool-executor.ts` extraction from MCP server, REST API route `/api/mcp/[tool]/route.ts`
- Track C: viem client config (`lib/clients.ts`), wagmi + RainbowKit providers, WalletModeProvider

### Phase 2: Dashboard Pages + Direct Reads (hours 8-16)

**Rationale:** With the data layer operational, build the three dashboard pages using direct viem reads. These are independent of the bridge and validate chain connectivity before the Playground depends on it. Treasury is the core bounty page; Staking and Delegations show breadth.

**Delivers:** Treasury vault status page with principal/yield visualization, Staking overview with Lido APR and position display, Delegation viewer with ERC-7710 permission cards.

**Addresses features:** Vault status display, principal vs yield visualization, Staking APR display, Delegation flow visualization, Vault health report card, transaction feedback toasts.

**Avoids pitfalls:** Chart rabbit hole (#12 — use big numbers and simple bars, not D3), live transaction timing (#8 — dry-run only from the start), scope creep (#3 — 3 pages maximum, no 4th page).

**Uses:** `useVaultStatus`, `useLidoPositions`, `useDelegations` hooks; Recharts via shadcn Chart; React Query with `stale-while-revalidate`.

### Phase 3: MCP Playground (hours 12-18, overlaps Phase 2)

**Rationale:** The Playground is the highest-ROI feature and the centerpiece of the demo video. It depends on the bridge from Phase 1 but can be built in parallel with simpler Phase 2 pages. Keep the UI to 4 elements maximum — tool selector dropdown, pre-filled parameter textarea, Run button, JSON response block.

**Delivers:** Tool selector with 6 domain categories and badge counts, dynamic parameter form from static tool registry, POST execution against REST bridge, JSON response viewer with syntax highlighting and copy, request/response history panel.

**Addresses features:** MCP Playground with live tool execution, tool categorization, request/response JSON viewer, dry-run simulation panel.

**Avoids pitfalls:** Overcomplicating the Playground (#9 — 4 UI elements maximum, pre-populate 3-4 "star" tools), SSE buffering (#4 — POST only, fake streaming animation client-side), bridge time sink (#2 — bridge already established in Phase 1).

**Implements:** MCP Client Hook (`useMcpTool`), Static Tool Registry (`lib/tool-registry.ts`), ToolSelector + ParamForm + ResponseViewer components.

### Phase 4: Polish + Demo Optimization (hours 18-24)

**Rationale:** With all pages functional, convert a working product into an impressive demo video. Animations, loading states, and deposit/withdraw forms with dry-run simulation are purely additive — they cannot break existing functionality. Demo recording setup must be validated before final recording.

**Delivers:** motion animations (glow borders on hero elements, number reveals, page transitions), skeleton loaders on all data-fetching components, deposit/withdraw forms with dry-run simulation and confirmation preview, demo recording setup validated.

**Addresses features:** Deposit/Withdraw UI, spender authorization UI (if time allows), transaction feedback, visual polish.

**Avoids pitfalls:** Video recording setup (#10 — test before final recording, fullscreen at 1920x1080, clean browser profile), scope creep (#3 — reject all new page requests at this stage).

**Uses:** motion library for spring animations; shadcn Skeleton, Dialog, Sheet components.

### Phase Ordering Rationale

- Phase 1 before everything: the viem clients and REST bridge are hard dependencies for every other phase. Monorepo workspace must be validated before feature code.
- Phases 2 and 3 overlap: direct viem reads (Phase 2) are independent of the bridge, but the Playground (Phase 3) requires it. Build Playground in parallel with simpler Phase 2 pages once Phase 1 is complete.
- Dry-run architecture set in Phase 2: deposit/withdraw forms in Phase 4 must assume the dry-run pattern decided in Phase 2; retrofitting is expensive.
- Phase 4 always compresses under time pressure — design Phases 1-3 to be demo-worthy without Phase 4 polish.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Bridge extraction):** The `tool-executor.ts` extraction depends on how tool handlers are currently structured in `packages/mcp-server/src/tools/`. Read the existing tool registration code before estimating the extraction effort. If handlers are tightly coupled to the MCP `server` instance, a wrapper shim is needed.
- **Phase 3 (Tool registry):** The static tool registry must accurately capture all 27 tools' parameter schemas. Consider auto-generating it from the MCP server's existing tool definitions during Phase 1 bridge work to avoid manual errors.

Phases with standard patterns (skip additional research):
- **Phase 1 (App shell):** Next.js 15 + Tailwind 4 + shadcn/ui init is thoroughly documented. RainbowKit + wagmi + Next.js App Router patterns are standard — follow official docs directly.
- **Phase 2 (viem reads):** React Query + viem `readContract` is a known pattern with multiple production examples.
- **Phase 4 (Polish):** motion + Tailwind + shadcn animations are well-documented. No research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified at specific npm versions. wagmi 3 + viem 2 + RainbowKit 2 + React 19 compatibility matrix explicitly confirmed. Tailwind v4 + shadcn/ui CLI v4 compatibility confirmed as of March 2026. |
| Features | HIGH | Derived from existing codebase (27 known tools, known contract interfaces), not speculative market research. Anti-feature list is time-constrained and well-reasoned. |
| Architecture | HIGH | Direct function import approach is proven; full MCP protocol transport identified as higher-risk and reserved as bonus only. Dual data path (viem direct + REST bridge) is architecturally clean with concrete code patterns documented. |
| Pitfalls | HIGH | Most pitfalls grounded in specific GitHub issues (Next.js SSE buffering: vercel/next.js#48427), official viem RPC documentation, and MCP SDK architecture. Phase-specific warnings are actionable and timed. |

**Overall confidence:** HIGH

### Gaps to Address

- **Existing MCP tool handler structure:** Validate that tool handlers in `packages/mcp-server/src/tools/` are separable functions before Phase 1 bridge work. If tightly coupled to the MCP `server` instance, the extraction approach requires a wrapper shim rather than direct re-export.
- **Contract ABIs availability:** Direct viem reads require ABI definitions for the AgentTreasury contract. Confirm ABIs are exported from the `treasury-contract` package or available as JSON before building hooks in Phase 2.
- **Demo address with real data:** Read-only demo mode requires a known treasury contract address on Base mainnet with actual deposits. Confirm this address exists and is funded before Phase 1 completes.
- **Authenticated RPC URLs:** Alchemy or Infura URLs (free tier) for Base and L1 mainnet must be provisioned before Phase 2 data work. Public RPCs are insufficient for demo reliability.
- **WalletConnect Project ID:** Required for RainbowKit if real wallet connect is needed. Register at cloud.walletconnect.com (free tier). Can be skipped if demoing with injected MetaMask only.

## Sources

### Primary (HIGH confidence)
- [Next.js releases](https://github.com/vercel/next.js/releases) — v15.5 stable, v16 excluded for hackathon risk
- [wagmi npm v3.5.0](https://www.npmjs.com/package/wagmi) — wagmi 3 + viem 2 compatibility
- [viem npm v2.47.4](https://www.npmjs.com/package/viem) — version alignment with MCP server package
- [RainbowKit npm v2.2.10](https://www.npmjs.com/package/@rainbow-me/rainbowkit) — React 19 + wagmi 3 confirmed support
- [Tailwind CSS v4.2](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, 5x faster builds
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) — component and dark mode patterns
- [shadcn/ui CLI v4 changelog (March 2026)](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) — Tailwind v4 support confirmed
- [MCP TypeScript SDK - Server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — StreamableHTTPServerTransport patterns
- [MCP Transports specification (2025-03-26)](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — Streamable HTTP replacing SSE
- [Next.js SSE buffering issue - vercel/next.js#48427](https://github.com/vercel/next.js/discussions/48427) — confirmed buffering behavior, POST-only decision

### Secondary (MEDIUM confidence)
- [Vercel mcp-handler](https://github.com/vercel/mcp-handler) — Next.js App Router MCP integration (relatively new library)
- [Wagmi + Viem + Next.js DApp patterns](https://medium.com/@vahdatfardin/building-production-ready-web3-dapps-with-wagmi-viem-and-next-js-cfc5d12f766b) — standard DeFi frontend patterns
- [Next.js + Wagmi + WalletConnect integration](https://docs.berachain.com/build/guides/community/walletconnect-nextjs) — wallet connection patterns
- [MCP stdio to HTTP bridge patterns](https://github.com/sparfenyuk/mcp-proxy) — existing bridge solutions context

### Tertiary (LOW confidence)
- [MIT Sloan: Avoid These Five Pitfalls at Your Next Hackathon](https://sloanreview.mit.edu/article/avoid-these-five-pitfalls-at-your-next-hackathon/) — general hackathon strategy (informed scope pitfall framing)

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
