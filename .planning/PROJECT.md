# AgentGate Dashboard

## What This Is

A dark-themed, crypto-native dashboard UI for demoing the AgentGate MCP server — an agent-to-agent DeFi infrastructure on Base. The dashboard lives in `app/` as a new package in the existing monorepo, built with Next.js + Tailwind. It showcases treasury vaults, Lido staking, MetaMask delegations, and an interactive MCP tool playground — all targeting multiple bounties at the Synthesis hackathon.

## Core Value

A visually impressive, functional demo that proves AgentGate's MCP tools work end-to-end — judges must see real blockchain interactions through a polished UI within a 2-minute video.

## Requirements

### Validated

- ✓ MCP server with 27 tools across 6 domains (Lido, Treasury, Delegation, ENS, Monitor, Uniswap) — existing
- ✓ AgentTreasury.sol smart contract with principal/yield separation and Chainlink oracle — existing
- ✓ MetaMask Smart Accounts Kit integration with ERC-7710 delegation — existing
- ✓ Dry-run simulation on all write tools — existing
- ✓ Foundry test suite for treasury contract (9 tests passing) — existing

### Active

- [ ] Next.js app in `app/` package within monorepo (npm workspaces)
- [ ] Dark crypto visual theme (Uniswap/Aave inspired, glowing accents)
- [ ] Wallet connect (MetaMask/WalletConnect) + read-only demo mode
- [ ] MCP Playground — interactive tool caller showing request/response JSON
- [ ] Treasury Dashboard — vault status, deposit/withdraw UI, yield vs principal visualization
- [ ] Delegation Viewer — active delegations list, create/redeem flow UI
- [ ] Staking Overview — Lido positions, APR display, vault health report
- [ ] HTTP bridge layer on MCP server for Next.js to call tools via REST
- [ ] Direct viem reads for on-chain state (balances, vault status, positions)

### Out of Scope

- Uniswap swap execution UI — code complete in MCP but no real swap tx yet, too risky for demo
- ENS dedicated page — resolution works but not visually impressive enough for its own section
- Mobile responsive — desktop demo only, recorded for video
- Persistent backend/database — stateless, all state from chain
- Production deployment — local dev server is fine for demo recording
- Smart account creation UI — happens behind the scenes in MCP tools

## Context

**Hackathon:** Synthesis (https://synthesis.md/hack/)
**Deadline:** ~2 days from 2026-03-19
**Bounties targeted:** MetaMask Delegations ($3K/$1.5K/$500), Lido stETH Treasury ($2K/$1K), Lido MCP ($3K/$2K/$1K), Vault Monitor ($1.5K/$750), Uniswap ($2.5K/$1.5K), ENS ($400+), Synthesis Open Track ($25K pool)
**Demo format:** 2-minute recorded video for judging
**Repo structure:** Monorepo with npm workspaces — `packages/mcp-server`, `packages/treasury-contract`, new `app/` for dashboard

**Existing infrastructure:**
- MCP server on stdio transport — needs HTTP bridge for dashboard
- Base mainnet (chainId 8453) primary, L1 Ethereum for Lido reads
- Environment: RPC_URL, L1_RPC_URL, PRIVATE_KEY, TREASURY_ADDRESS, UNISWAP_API_KEY
- All MCP tools have dry_run mode for safe demo
- Treasury contract now includes Chainlink oracle for wstETH/stETH rate

## Constraints

- **Timeline**: ~2 days — scope must be ruthlessly prioritized for demo impact
- **Tech stack**: Next.js, Tailwind CSS, dark theme, same monorepo
- **Chain**: Base mainnet + L1 Ethereum reads (existing RPC setup)
- **Transport**: MCP server needs HTTP/SSE bridge alongside existing stdio
- **Wallet**: Must support both connected wallet and read-only demo mode
- **Demo quality**: Must look polished in a 2-minute video — visual impact matters as much as functionality

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js in `app/` directory | User preference, monorepo structure | — Pending |
| Dark crypto theme | Matches DeFi ecosystem aesthetic, judges expect it | — Pending |
| Both viem direct + HTTP bridge | Viem for fast reads, HTTP bridge for MCP playground tool calls | — Pending |
| Wallet + demo mode | Demo mode lets judges explore without wallet, wallet mode for live tx | — Pending |
| Skip Uniswap/ENS dedicated pages | No real swap tx yet, ENS too simple for own page — focus on treasury + delegations + MCP | — Pending |

---
*Last updated: 2026-03-19 after initialization*
