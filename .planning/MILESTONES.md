# Milestones

## v1.1 Live Agent Activity Dashboard (Shipped: 2026-03-22)

**Delivered:** A command-center-style live dashboard showing registered AI agents and their real-time activity with animated pixel-art characters — built for maximum hackathon demo impact.

**Phases:** 4 | **Plans:** 8 | **Commits:** 75 | **LOC:** ~10,000 TypeScript (added)
**Files:** 79 modified | **Timeline:** 1 day (2026-03-22)
**Git range:** `feat(05)` → `feat(08)`

**Key accomplishments:**

1. Activity logging infrastructure — CircularBuffer + ActivityLog singleton capturing all MCP tool calls with agent identity
2. MCP server instrumentation — wrapServerWithLogging intercepts every tool callback with full agent identity flow
3. REST + SSE API endpoints — agent registry with status derivation, activity history, real-time SSE streaming with heartbeat
4. Pixel-art sprite animation system — inline SVG robots with CSS steps() animation, wandering scene with direction facing
5. Live Agents dashboard page — command-center layout with agent cards, activity feed, real-time SSE updates
6. Demo mode — 12 seed events dripping a coherent DeFi workflow story for instant visual impact without live agents

**Archives:** `milestones/v1.1-ROADMAP.md`, `milestones/v1.1-REQUIREMENTS.md`

---

## v1.0 MVP (Shipped: 2026-03-20)

**Delivered:** A dark-themed crypto dashboard demoing AgentGate's MCP tools end-to-end — treasury vaults, staking, delegations, and an interactive MCP playground — built for the Synthesis hackathon.

**Phases:** 4 | **Plans:** 12 | **Commits:** 110 | **LOC:** 5,105 TypeScript
**Files:** 96 created | **Timeline:** 2 days (2026-03-19 → 2026-03-20)
**Git range:** `feat(01-00)` → `docs(04-02)`

**Key accomplishments:**

1. Next.js app shell with dark crypto theme, RainbowKit wallet connect, and read-only demo mode
2. Treasury dashboard with vault status, deposit/withdraw forms, donut chart, and Chainlink oracle rate
3. Staking overview with Lido APR display, wstETH/stETH positions, and vault health report
4. Delegation viewer with card/table views, create/redeem ERC-7710 delegation forms
5. MCP Playground — interactive tool caller with 25-tool selector, dynamic parameter forms, and JSON viewer
6. HTTP bridge exposing all MCP tool handlers via REST API routes

**Known Tech Debt (6 items, non-blocking):**

- Dead code: WalletDisplay, PlaceholderPage, formatPercent, treasuryAddress context field
- Data source mismatch: health-report.tsx uses useVaultStatus instead of staking-specific data
- Undeclared dependency: @agentgate/mcp-server not in app/package.json (implicit workspace resolution)

**Archives:** `milestones/v1.0-ROADMAP.md`, `milestones/v1.0-REQUIREMENTS.md`, `milestones/v1.0-MILESTONE-AUDIT.md`

---
