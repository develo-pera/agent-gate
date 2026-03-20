# Phase 2: Dashboard Pages - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Treasury vault UI, staking overview, and delegation viewer with real on-chain data across three polished dashboard sections. Users can view vault status, staking positions, and active delegations — and perform deposit, withdraw, and delegation actions via the MCP bridge with dry-run simulation. No MCP playground (Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Treasury vault layout
- Donut/ring chart visualization showing principal vs yield proportions
- Chart sits inside a glassmorphism card with numeric balances (principal wstETH, yield wstETH) alongside
- Chainlink oracle exchange rate displayed inside the donut card as a subtle line: "1 wstETH = X stETH (Chainlink)"
- Deposit and withdraw forms presented as side-by-side cards below the vault chart (inline, not tabbed)
- Each form has an amount input and a dry-run toggle switch
- Dry-run simulation shows an inline result card below the form: expected balance change, gas estimate, green/red status badge — stays visible until dismissed

### Staking display
- Hero APR metric at top of page with glow accent (large number, visually prominent)
- Position card below showing wstETH balance, stETH equivalent, and USD value estimate
- Vault health report card with score (0-100, color-coded green/yellow/red) plus 2-3 key metrics: collateral ratio, utilization rate, active alerts

### Delegation viewer
- Default view: stacked glassmorphism cards, one per delegation
- Each card shows: delegate address (truncated), scope/permissions, caveats (amount limits), status badge (Live/Expired)
- Action buttons per card: Redeem, Revoke
- Optional table view toggle (Claude's discretion on toggle mechanism) — user wants both card and table views available
- "Create Delegation" button opens a slide-in drawer/modal with: delegate address input, scope selector dropdown, max amount caveat field, dry-run toggle
- Redeem delegation: similar modal/drawer pattern with target contract and calldata inputs

### Data fetching strategy
- Dashboard pages use wagmi hooks (useReadContract, useBalance) for all read operations — fast, reactive, cached by react-query
- Write operations (deposit, withdraw, create/redeem delegation) go through /api/mcp/[tool] bridge — showcases MCP integration and supports dry-run
- MCP bridge is NOT used for reads on dashboard pages (that's Phase 3 Playground territory)
- Demo mode sends hardcoded treasury address for reads; writes auto-force dry_run=true

### Loading and error states
- Skeleton shimmer placeholders (existing skeleton.tsx component) matching final layout shape while data loads
- Error states show inline within the affected card/section with a retry button — not full-page errors

### Claude's Discretion
- Donut chart library choice (lightweight option preferred — recharts, or pure SVG/CSS)
- Exact card/table view toggle design for delegations
- Form validation patterns and error messages
- Exact spacing, typography, and responsive breakpoints within desktop layout
- USD value display source and formatting
- Whether to add shadcn card/input/form components or build custom

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Treasury contract & tools
- `packages/mcp-server/src/tools/treasury.ts` — Treasury tool handlers, ABI definition, vault read/write patterns, dry_run support
- `packages/treasury-contract/` — Solidity contract with ABI for direct viem reads (principal, yield, oracle rate)

### Delegation tools
- `packages/mcp-server/src/tools/delegation.ts` — ERC-7710 delegation handlers, create/redeem/revoke patterns, caveat structures

### Staking tools
- `packages/mcp-server/src/tools/lido.ts` — Lido staking handlers, APR fetch, wstETH/stETH balance reads, vault health report

### App infrastructure (from Phase 1)
- `packages/app/src/app/api/mcp/[tool]/route.ts` — HTTP bridge route for MCP tool calls
- `packages/app/src/providers/web3-provider.tsx` — Wagmi + RainbowKit + react-query setup
- `packages/app/src/lib/wagmi-config.ts` — Wagmi chain config (Base mainnet)
- `packages/app/src/lib/constants.ts` — DEMO_TREASURY_ADDRESS for demo mode
- `packages/app/src/components/ui/` — Available shadcn components: button, badge, skeleton, tooltip, avatar, separator

### Requirements
- `.planning/REQUIREMENTS.md` — TREA-01 through TREA-05, DELG-01 through DELG-03, STAK-01 through STAK-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `skeleton.tsx` — shadcn skeleton component for loading states across all pages
- `badge.tsx` — Can be used for delegation status badges (Live/Expired) and health score indicators
- `button.tsx` — Styled button for form submissions, retry actions
- `tooltip.tsx` — For truncated addresses and metric explanations
- `placeholder-page.tsx` — Currently used by all 3 pages, will be replaced with real content
- `demo-banner.tsx` — Already handles demo mode visual indicator

### Established Patterns
- Web3Provider wraps the app with Wagmi + react-query — wagmi hooks available in all pages
- MCP bridge at `/api/mcp/[tool]` accepts POST with `wallet_address` param — ready for write operations
- CSS group-hover pattern on sidebar — glassmorphism card styling already established
- Dark theme with purple accent (`#8B5CF6`) — all new components should follow this palette

### Integration Points
- Each page replaces its placeholder (`treasury/page.tsx`, `staking/page.tsx`, `delegations/page.tsx`)
- Wallet address from wagmi hooks or DEMO_TREASURY_ADDRESS constant for demo mode
- Treasury ABI in MCP server tools — needs to be shared or duplicated for wagmi contract reads
- L1 client needed for Lido stETH reads (mainnet) — may need separate wagmi config or direct viem client

</code_context>

<specifics>
## Specific Ideas

- Donut chart for treasury vault — user specifically chose this over stacked bar and side-by-side cards
- Delegation viewer should have BOTH card view (default) and table view — user wants a toggle between them
- Playground page (Phase 3) is where full MCP tool functionality is showcased — dashboard pages use wagmi for reads to keep them fast and reactive
- Production-ready patterns preferred (from Phase 1 context) — not hackathon shortcuts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-dashboard-pages*
*Context gathered: 2026-03-20*
