# Feature Landscape

**Domain:** DeFi Dashboard + MCP Playground
**Researched:** 2026-03-19
**Context:** Hackathon demo (2-day build), video judging format

## Table Stakes

Features judges expect in a DeFi dashboard demo. Missing = looks unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Wallet connect button | Every DeFi app has one | Low | RainbowKit handles this in ~10 lines |
| Dark theme | DeFi standard. Light theme looks amateur. | Low | next-themes + shadcn dark mode CSS vars |
| Connected wallet address display | Proves wallet integration works | Low | wagmi useAccount hook |
| Network indicator (Base) | Shows chain awareness | Low | wagmi useChainId, badge component |
| Treasury vault status | Core product — must show vault balances | Medium | viem reads to AgentTreasury contract |
| Balance display with token icons | Judges expect to see ETH/stETH/wstETH | Low | wagmi useBalance + static token icons |
| Loading states / skeletons | Polished feel for video | Low | shadcn Skeleton component |
| Responsive card layout | Dashboard grid pattern | Low | Tailwind grid, shadcn Card |

## Differentiators

Features that make this stand out from generic DeFi dashboards. These win bounties.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| MCP Tool Playground | Unique — no other hackathon project will have an interactive MCP tool caller | High | HTTP bridge + JSON request/response viewer + tool selector |
| Dry-run simulation toggle | Shows safety-first agent design | Low | Toggle that sets dry_run: true on all MCP calls |
| Delegation viewer | MetaMask Smart Accounts bounty specific | Medium | Display active ERC-7710 delegations, create/redeem UI |
| Yield vs principal visualization | Treasury bounty specific | Medium | Recharts chart showing vault separation |
| Lido staking APR display | Lido bounty specific | Low | Read APR from Lido SDK, display as stat card |
| Vault health report | Monitor bounty specific | Medium | Aggregate vault metrics into a health score card |
| Real-time tx feedback | Shows blockchain interactions are real | Medium | Toast notifications on tx confirm, link to BaseScan |
| Demo mode (no wallet) | Judges can explore without connecting wallet | Medium | Read-only mode using public RPC, pre-filled demo data |

## Anti-Features

Features to explicitly NOT build. Time traps for a 2-day hackathon.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Swap execution UI | No real Uniswap swap tx ready. Risky to demo. | Show Uniswap tools in MCP playground only |
| ENS dedicated page | Works but not visually impressive enough for own section | Include ENS resolution as a tool in MCP playground |
| Mobile responsive layout | Desktop-only video demo | Fixed 1440px desktop layout, no breakpoints below md |
| User auth / sessions | Stateless app, no backend | Wallet connection IS the auth |
| Transaction history from indexer | Would need The Graph or similar | Show recent tx from MCP tool responses only |
| Real-time websocket price feeds | Complexity for marginal demo value | Static price reads on page load, manual refresh |
| Multi-chain switcher | Only Base mainnet + L1 reads needed | Hardcode Base, use L1 RPC for Lido reads silently |
| Settings / preferences page | No persistent state | Just the theme toggle in nav |

## Feature Dependencies

```
Wallet Connect --> Demo Mode (need fallback when no wallet)
HTTP Bridge --> MCP Playground (playground calls tools via bridge)
HTTP Bridge --> Treasury Dashboard write operations
viem Direct Reads --> Treasury Dashboard read operations
viem Direct Reads --> Staking Overview
viem Direct Reads --> Delegation Viewer
Wallet Connect --> Any write transaction (deposit, withdraw, delegate)
```

## MVP Recommendation

For a 2-day hackathon, prioritize in this order:

1. **Wallet connect + dark shell** — App layout, nav, RainbowKit, forced dark theme. 2-3 hours.
2. **Treasury dashboard** — Vault status cards with viem reads. Principal vs yield chart. 3-4 hours.
3. **MCP Playground** — HTTP bridge + interactive tool caller. This is the unique differentiator. 4-5 hours.
4. **Delegation viewer** — MetaMask bounty requires visible delegation UI. 2-3 hours.
5. **Staking overview** — Lido APR, positions display. 2-3 hours.
6. **Demo mode polish** — Ensure everything works without wallet connected. 1-2 hours.

**Defer:** Vault health report (nice-to-have), real-time tx feedback (polish), animations beyond basic.

## Sources

- Synthesis hackathon bounty requirements from PROJECT.md
- Standard DeFi dashboard patterns (Uniswap, Aave, Lido dashboards)
