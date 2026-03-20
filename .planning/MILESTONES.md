# Milestones

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
