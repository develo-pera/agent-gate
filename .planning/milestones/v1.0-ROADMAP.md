# Roadmap: AgentGate Dashboard

## Overview

Transform the existing AgentGate MCP server into a demo-ready dashboard for the Synthesis hackathon. Phase 1 stands up the app shell with wallet connect, dark theme, and the HTTP bridge to MCP tools. Phase 2 builds the three dashboard pages (Treasury, Staking, Delegations) using direct viem reads. Phase 3 delivers the MCP Playground -- the highest-ROI feature targeting 3+ bounties. Each phase produces a demo-worthy artifact; the project is presentable after any phase completes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - App shell, dark theme, wallet connect, demo mode, HTTP bridge, and navigation
- [x] **Phase 2: Dashboard Pages** - Treasury vault UI, staking overview, and delegation viewer with direct on-chain reads
- [x] **Phase 3: MCP Playground** - Interactive tool caller with parameter forms, execution, and JSON response viewer
- [x] **Phase 4: Foundation Verification & Config Fix** - Retroactive Phase 1 verification, env var fix, doc cleanup, dead code removal

## Phase Details

### Phase 1: Foundation
**Goal**: User can open the app and see a polished dark-themed shell with wallet connection, demo mode, and working navigation to all sections
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05, FOUN-06
**Success Criteria** (what must be TRUE):
  1. Running `npm run dev` from the monorepo root starts the dashboard at localhost with no errors
  2. The app renders a dark crypto-themed UI with sidebar navigation linking to Treasury, Staking, Delegations, and Playground sections
  3. User can connect a MetaMask wallet via RainbowKit and see their address displayed with a Base network badge
  4. User can browse the entire app in demo mode without connecting a wallet, seeing read-only data from a hardcoded treasury address
  5. The HTTP bridge at `/api/mcp/[tool]` accepts POST requests and returns JSON responses from MCP tool handlers
**Plans**: 3 plans

Plans:
- [x] 01-00-PLAN.md — Install Vitest and create Wave 0 test stub files
- [x] 01-01-PLAN.md — Scaffold Next.js app with dark crypto theme, shadcn, and MCP HTTP bridge
- [x] 01-02-PLAN.md — Wire wallet connect, demo mode, sidebar navigation, and placeholder pages

### Phase 2: Dashboard Pages
**Goal**: User can view treasury vault status, staking positions, and active delegations with real on-chain data across three polished dashboard sections
**Depends on**: Phase 1
**Requirements**: TREA-01, TREA-02, TREA-03, TREA-04, TREA-05, DELG-01, DELG-02, DELG-03, STAK-01, STAK-02, STAK-03
**Success Criteria** (what must be TRUE):
  1. Treasury page displays principal and yield balances separately, with a chart visualizing the vault separation and the Chainlink oracle exchange rate
  2. User can fill out deposit and withdraw forms with a dry-run simulation toggle that previews the outcome before execution
  3. Staking section shows current Lido APR, wstETH/stETH positions for the connected or demo wallet, and a vault health report card with color-coded metrics
  4. Delegation section lists active ERC-7710 delegations with scope and caveats, and provides forms to create and redeem delegations
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Shared infrastructure: shadcn components, ABIs, hooks, bridge stubs, and test scaffolds
- [x] 02-02-PLAN.md — Treasury page: vault overview with donut chart, deposit/withdraw forms
- [x] 02-03-PLAN.md — Staking page: APR hero, position card, vault health report
- [x] 02-04-PLAN.md — Delegations page: card/table views, create/redeem delegation forms

### Phase 3: MCP Playground
**Goal**: User can interactively select, configure, and execute any of the 27 MCP tools and see the raw JSON request/response -- the centerpiece demo feature
**Depends on**: Phase 1
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04
**Success Criteria** (what must be TRUE):
  1. User can browse all available MCP tools organized by domain (Lido, Treasury, Delegation, ENS, Monitor, Uniswap) with a tool selector
  2. Selecting a tool renders a dynamic parameter form generated from the tool's schema, pre-filled with sensible defaults
  3. Executing a tool shows the raw JSON request sent and response received, with syntax highlighting and copy functionality
  4. User can toggle dry-run mode on write tools to safely demonstrate destructive operations without executing real transactions
**Plans**: 3 plans

Plans:
- [x] 03-00-PLAN.md — Wave 0: Create vitest stub files for all 4 playground test requirements
- [x] 03-01-PLAN.md — Tool schema registry and bridge expansion for all 25 visible MCP tools
- [x] 03-02-PLAN.md — Playground UI: three-column layout with tool selector, parameter form, and JSON viewer

### Phase 4: Foundation Verification & Config Fix
**Goal**: Close all audit gaps — retroactively verify Phase 1, fix NEXT_PUBLIC_TREASURY_ADDRESS env var so wagmi reads work, update stale doc checkboxes, and remove dead code
**Depends on**: Phase 3
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04, FOUN-05, FOUN-06
**Gap Closure:** Closes gaps from audit
**Success Criteria** (what must be TRUE):
  1. Phase 1 VERIFICATION.md exists confirming all 6 FOUN-* requirements pass
  2. NEXT_PUBLIC_TREASURY_ADDRESS is set in .env and .env.example, and wagmi hooks resolve the correct treasury address
  3. All FOUN-* checkboxes are checked in REQUIREMENTS.md with Complete status in the traceability table
  4. ROADMAP.md plan checkboxes for Phases 2 and 3 are updated to [x]
  5. Dead code (useDelegationActions, getAvailableTools) is removed
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Env var fix, dead code removal, and Phase 1 VERIFICATION.md
- [x] 04-02-PLAN.md — Doc updates: REQUIREMENTS.md and ROADMAP.md checkboxes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-19 |
| 2. Dashboard Pages | 4/4 | Complete | 2026-03-20 |
| 3. MCP Playground | 3/3 | Complete | 2026-03-20 |
| 4. Foundation Verification & Config Fix | 2/2 | Complete | 2026-03-20 |
