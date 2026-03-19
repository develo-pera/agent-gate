# Phase 1: Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

App shell, dark theme, wallet connect, demo mode, HTTP bridge, and navigation. User can open the app and see a polished dark-themed shell with wallet connection, demo mode, and working navigation to all sections. No dashboard page content yet -- just the shell, routing, and bridge infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Visual theme & layout
- Uniswap-inspired dark theme: deep navy/charcoal background, soft card borders, modern DeFi aesthetic
- Electric purple/pink accent colors for glows, buttons, active states, and gradient treatments
- Glassmorphism cards: semi-transparent with blur backdrop and subtle border glow
- Narrow icon rail sidebar: slim with icons only, expands on hover to show labels -- maximizes content area
- Forced dark mode globally (no light mode toggle)

### Wallet & demo mode UX
- App starts in demo mode by default -- zero-friction, no landing page choice
- Demo mode shows a subtle top banner: "Demo Mode -- viewing [treasury address]" with a "Connect Wallet" button
- Connected wallet state shows ENS name if available, falls back to truncated address (0x1234...abcd) with Base network badge
- Wallet connect via RainbowKit (MetaMask/WalletConnect)
- Connect wallet button always accessible in sidebar

### Demo mode write behavior
- Claude's discretion: goal is judges being able to see simulated results
- Preferred direction: auto dry-run in demo mode (write actions work but force dry_run=true so judges see simulated outcomes without connecting)
- Alternative: disable write buttons with "Connect wallet to execute" tooltip
- Key constraint: judges must be able to experience the full app without a wallet

### HTTP bridge
- In-process import of MCP tool handler functions into Next.js API routes at `/api/mcp/[tool]`
- Not a subprocess or separate HTTP server -- tool logic is imported directly (production-ready pattern for a Next.js monorepo)
- API routes return dashboard-friendly JSON (Claude's discretion on exact format)
- Playground page can show raw MCP format separately when needed
- Browser sends wallet address as parameter; demo mode sends hardcoded treasury address
- Server stays stateless

### Navigation structure
- 4 sidebar nav items: Treasury, Staking, Delegations, Playground
- AgentGate wordmark at top of sidebar with subtle glow effect
- Placeholder pages show a "Coming soon" glassmorphism card (centered, section icon, title, subtitle)
- Default landing page: Claude's discretion (likely Treasury as first nav item and core value prop)

### Claude's Discretion
- Demo mode write behavior (auto dry-run vs disabled buttons -- lean toward auto dry-run for best judge experience)
- API response format (dashboard-friendly JSON shape)
- Default landing page selection
- Loading skeleton design
- Exact spacing, typography, and icon choices
- Error state handling patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP server architecture
- `packages/mcp-server/src/index.ts` -- Server setup, AgentGateContext interface, client creation pattern, tool registration
- `packages/mcp-server/src/tools/treasury.ts` -- Tool handler pattern (register function + ABI + ctx usage)
- `packages/mcp-server/src/tools/delegation.ts` -- Delegation tool handlers
- `packages/mcp-server/src/tools/lido.ts` -- Lido/staking tool handlers
- `packages/mcp-server/package.json` -- Existing dependencies (viem, zod, @modelcontextprotocol/sdk)

### Project structure
- `package.json` -- Monorepo workspace config (npm workspaces, `packages/*`)
- `.planning/REQUIREMENTS.md` -- FOUN-01 through FOUN-06 acceptance criteria
- `.planning/ROADMAP.md` -- Phase 1 success criteria

### Treasury contract
- `packages/treasury-contract/` -- Solidity contract with ABI needed for viem reads

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentGateContext` interface (index.ts:47-54): Shared context with publicClient, l1PublicClient, walletClient -- reuse pattern for API routes
- `registerXTools()` functions: Each tool module exports a registration function with `(server, ctx)` signature -- handlers inside can be extracted for API routes
- Treasury ABI (treasury.ts): Already defined inline, can be shared with dashboard viem reads
- viem client creation pattern: publicClient + walletClient setup in index.ts is reusable

### Established Patterns
- Tool modules use `McpServer.tool()` with zod schemas for input validation -- API routes should mirror this validation
- All write tools support `dry_run` parameter -- bridge must pass this through
- L1 client exists separately for Lido/stETH reads (mainnet) vs Base client for everything else

### Integration Points
- New `app/` package needs to be added to monorepo workspaces array in root package.json
- API routes will import from `@agentgate/mcp-server` or directly from source
- Environment variables (RPC_URL, L1_RPC_URL, PRIVATE_KEY, TREASURY_ADDRESS) must flow to Next.js

</code_context>

<specifics>
## Specific Ideas

- User wants production-ready patterns, not hackathon shortcuts -- "prepare this for the real world" and "easily switch" to production
- Judges should be able to fully explore the app without connecting a wallet
- Demo video is at desktop resolution (no mobile needed)

</specifics>

<deferred>
## Deferred Ideas

- Delegation spending/allowance tracking view (user mentioned wanting to see agent spending and allowances) -- covered by Phase 2 DELG-01
- Overview/home page with summary stats from all domains -- potential future enhancement

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-19*
