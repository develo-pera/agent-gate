# Requirements: AgentGate Dashboard

**Defined:** 2026-03-19
**Core Value:** A visually impressive, functional demo that proves AgentGate's MCP tools work end-to-end — judges must see real blockchain interactions through a polished UI within a 2-minute video.

## v1 Requirements

Requirements for hackathon submission. Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: Next.js app created in `app/` as npm workspace package with Tailwind CSS
- [ ] **FOUN-02**: Dark crypto theme applied globally (forced dark mode, glowing accents, DeFi aesthetic)
- [ ] **FOUN-03**: Wallet connect via RainbowKit — MetaMask/WalletConnect, address display, Base network badge
- [ ] **FOUN-04**: Demo mode — app is fully explorable without connecting wallet (read-only with public RPC)
- [ ] **FOUN-05**: HTTP/REST bridge exposing MCP tool handlers for Next.js API routes to call
- [ ] **FOUN-06**: App shell with sidebar/nav linking to all dashboard sections

### Treasury

- [ ] **TREA-01**: Vault status display — principal vs yield balances for connected wallet
- [ ] **TREA-02**: Yield vs principal visualization (chart showing vault separation)
- [ ] **TREA-03**: Deposit wstETH form with dry-run simulation toggle
- [ ] **TREA-04**: Withdraw yield form with dry-run simulation toggle
- [ ] **TREA-05**: Chainlink oracle exchange rate display

### MCP Playground

- [ ] **PLAY-01**: Tool selector listing all available MCP tools grouped by domain
- [ ] **PLAY-02**: Dynamic parameter form generated from tool schema
- [ ] **PLAY-03**: JSON request/response viewer showing raw MCP communication
- [ ] **PLAY-04**: Dry-run toggle for safe demonstration of write tools

### Delegation

- [ ] **DELG-01**: Active delegations list showing scope, caveats, and status
- [ ] **DELG-02**: Create delegation form (ERC-7710 with amount caveats)
- [ ] **DELG-03**: Redeem delegation UI with target contract/calldata input

### Staking

- [ ] **STAK-01**: Lido staking APR display with current rate
- [ ] **STAK-02**: wstETH/stETH position balance display for connected wallet
- [ ] **STAK-03**: Vault health report card (aggregated metrics, alerts)

## v2 Requirements

Deferred post-hackathon. Not in current roadmap.

### Polish

- **POLSH-01**: Real-time transaction feedback with BaseScan links
- **POLSH-02**: Animated transitions between pages
- **POLSH-03**: Skeleton loading states on all data cards

### Extended Features

- **EXTND-01**: Uniswap swap execution UI
- **EXTND-02**: ENS dedicated resolution page
- **EXTND-03**: Transaction history from on-chain indexer
- **EXTND-04**: Mobile responsive layout

## Out of Scope

| Feature | Reason |
|---------|--------|
| Swap execution UI | No real Uniswap swap tx ready, too risky for demo |
| ENS dedicated page | Works but not visually impressive for own section — use in playground |
| Mobile responsive | Desktop-only video demo at 1440px |
| User auth / sessions | Stateless app, wallet connection IS the auth |
| Real-time websocket price feeds | Complexity for marginal demo value |
| Multi-chain switcher | Only Base mainnet + L1 reads needed |
| Settings / preferences | No persistent state needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Complete |
| FOUN-02 | Phase 1 | Pending |
| FOUN-03 | Phase 1 | Pending |
| FOUN-04 | Phase 1 | Pending |
| FOUN-05 | Phase 1 | Pending |
| FOUN-06 | Phase 1 | Pending |
| TREA-01 | Phase 2 | Pending |
| TREA-02 | Phase 2 | Pending |
| TREA-03 | Phase 2 | Pending |
| TREA-04 | Phase 2 | Pending |
| TREA-05 | Phase 2 | Pending |
| DELG-01 | Phase 2 | Pending |
| DELG-02 | Phase 2 | Pending |
| DELG-03 | Phase 2 | Pending |
| STAK-01 | Phase 2 | Pending |
| STAK-02 | Phase 2 | Pending |
| STAK-03 | Phase 2 | Pending |
| PLAY-01 | Phase 3 | Pending |
| PLAY-02 | Phase 3 | Pending |
| PLAY-03 | Phase 3 | Pending |
| PLAY-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
