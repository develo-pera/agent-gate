# AgentGate Dashboard

## What This Is

A dark-themed, crypto-native dashboard UI for demoing the AgentGate MCP server — an agent-to-agent DeFi infrastructure on Base. The dashboard lives in `packages/app/` as a package in the existing monorepo, built with Next.js + Tailwind. It showcases treasury vaults, Lido staking, MetaMask delegations, and an interactive MCP tool playground — all targeting multiple bounties at the Synthesis hackathon.

## Core Value

A visually impressive, functional demo that proves AgentGate's MCP tools work end-to-end — judges must see real blockchain interactions through a polished UI within a 2-minute video.

## Requirements

### Validated

- ✓ MCP server with 27 tools across 6 domains (Lido, Treasury, Delegation, ENS, Monitor, Uniswap) — existing
- ✓ AgentTreasury.sol smart contract with principal/yield separation and Chainlink oracle — existing
- ✓ MetaMask Smart Accounts Kit integration with ERC-7710 delegation — existing
- ✓ Dry-run simulation on all write tools — existing
- ✓ Foundry test suite for treasury contract (9 tests passing) — existing
- ✓ Next.js app in `packages/app/` package within monorepo (npm workspaces) — v1.0
- ✓ Dark crypto visual theme (Uniswap-inspired, hot-pink accents) — v1.0
- ✓ Wallet connect (MetaMask/WalletConnect) + read-only demo mode — v1.0
- ✓ Direct viem reads for on-chain state (balances, vault status, positions) — v1.0
- ✓ HTTP bridge exposing MCP tool handlers via REST API routes — v1.0
- ✓ Treasury Dashboard — vault status, deposit/withdraw UI, donut chart, Chainlink oracle rate — v1.0
- ✓ Delegation Viewer — card/table views, create/redeem flow with dry-run support — v1.0
- ✓ Staking Overview — Lido APR display, wstETH/stETH positions, vault health report — v1.0
- ✓ MCP Playground — interactive tool caller with 25-tool selector, dynamic parameter forms, JSON viewer — v1.0
- ✓ Tool schema registry covering all domains with 25 bridge handlers — v1.0
- ✓ NEXT_PUBLIC_TREASURY_ADDRESS env var for wagmi reads — v1.0
- ✓ Phase 1 retroactive verification with evidence for all FOUN-* requirements — v1.0

### Active

- (none — planning next milestone)

### Out of Scope

- Uniswap swap execution UI — code complete in MCP but no real swap tx yet, too risky for demo
- ENS dedicated page — resolution works but not visually impressive enough for its own section
- Mobile responsive — desktop demo only, recorded for video
- Persistent backend/database — stateless, all state from chain
- Production deployment — local dev server is fine for demo recording
- Smart account creation UI — happens behind the scenes in MCP tools

## Context

**Shipped v1.0** with 5,105 LOC TypeScript across 96 files in 2 days.
**Tech stack:** Next.js 15, Tailwind CSS v4, shadcn/ui, wagmi, viem, RainbowKit, @tanstack/react-query
**Hackathon:** Synthesis (https://synthesis.md/hack/)
**Demo format:** 2-minute recorded video for judging
**Repo structure:** Monorepo with npm workspaces — `packages/mcp-server`, `packages/treasury-contract`, `packages/app/`

**Known tech debt (6 items):** Dead code (WalletDisplay, PlaceholderPage, formatPercent, treasuryAddress context field), data source mismatch in health-report, undeclared workspace dependency.

## Constraints

- **Tech stack**: Next.js, Tailwind CSS, dark theme, same monorepo
- **Chain**: Base mainnet + L1 Ethereum reads (existing RPC setup)
- **Transport**: MCP server needs HTTP/SSE bridge alongside existing stdio
- **Wallet**: Must support both connected wallet and read-only demo mode
- **Demo quality**: Must look polished in a 2-minute video — visual impact matters as much as functionality

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js in `packages/app/` directory | User preference, monorepo structure | ✓ Good |
| Dark crypto theme → Uniswap rebrand | Matches DeFi ecosystem aesthetic, judges expect it | ✓ Good |
| Both viem direct + HTTP bridge | Viem for fast reads, HTTP bridge for MCP playground tool calls | ✓ Good |
| Wallet + demo mode | Demo mode lets judges explore without wallet, wallet mode for live tx | ✓ Good |
| Skip Uniswap/ENS dedicated pages | No real swap tx yet, ENS too simple for own page — focus on treasury + delegations + MCP | ✓ Good |
| Coarse 3-phase roadmap (+ 1 gap-closure) | Hackathon timeline demanded minimal overhead | ✓ Good |
| Demo mode via wallet connection state | No manual toggle needed, simplifies UX | ✓ Good |
| @agentgate/mcp-server/bridge subpath export | Turbopack blocks relative imports outside package root | ⚠️ Revisit (undeclared dep) |
| any-typed publicClient in BridgeContext | Avoids cross-package viem type conflicts | ⚠️ Revisit |
| Demo delegations as constants in hook | Bridge has no persistent state | ✓ Good |

---
*Last updated: 2026-03-20 after v1.0 milestone*
