# Roadmap: AgentGate Dashboard

## Overview

Transform the existing AgentGate MCP server into a demo-ready dashboard for the Synthesis hackathon. Phase 1 stands up the app shell with wallet connect, dark theme, and the HTTP bridge to MCP tools. Phase 2 builds the three dashboard pages (Treasury, Staking, Delegations) using direct viem reads. Phase 3 delivers the MCP Playground -- the highest-ROI feature targeting 3+ bounties. Each phase produces a demo-worthy artifact; the project is presentable after any phase completes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - App shell, dark theme, wallet connect, demo mode, HTTP bridge, and navigation
- [ ] **Phase 2: Dashboard Pages** - Treasury vault UI, staking overview, and delegation viewer with direct on-chain reads
- [ ] **Phase 3: MCP Playground** - Interactive tool caller with parameter forms, execution, and JSON response viewer

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
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Dashboard Pages
**Goal**: User can view treasury vault status, staking positions, and active delegations with real on-chain data across three polished dashboard sections
**Depends on**: Phase 1
**Requirements**: TREA-01, TREA-02, TREA-03, TREA-04, TREA-05, DELG-01, DELG-02, DELG-03, STAK-01, STAK-02, STAK-03
**Success Criteria** (what must be TRUE):
  1. Treasury page displays principal and yield balances separately, with a chart visualizing the vault separation and the Chainlink oracle exchange rate
  2. User can fill out deposit and withdraw forms with a dry-run simulation toggle that previews the outcome before execution
  3. Staking section shows current Lido APR, wstETH/stETH positions for the connected or demo wallet, and a vault health report card with color-coded metrics
  4. Delegation section lists active ERC-7710 delegations with scope and caveats, and provides forms to create and redeem delegations
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: MCP Playground
**Goal**: User can interactively select, configure, and execute any of the 27 MCP tools and see the raw JSON request/response -- the centerpiece demo feature
**Depends on**: Phase 1
**Requirements**: PLAY-01, PLAY-02, PLAY-03, PLAY-04
**Success Criteria** (what must be TRUE):
  1. User can browse all available MCP tools organized by domain (Lido, Treasury, Delegation, ENS, Monitor, Uniswap) with a tool selector
  2. Selecting a tool renders a dynamic parameter form generated from the tool's schema, pre-filled with sensible defaults
  3. Executing a tool shows the raw JSON request sent and response received, with syntax highlighting and copy functionality
  4. User can toggle dry-run mode on write tools to safely demonstrate destructive operations without executing real transactions
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Dashboard Pages | 0/3 | Not started | - |
| 3. MCP Playground | 0/2 | Not started | - |
