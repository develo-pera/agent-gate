# Phase 3: MCP Playground - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Interactive tool caller where users can select, configure, and execute any of the available MCP tools and see raw JSON request/response. This is the centerpiece demo feature — showcases the full breadth of AgentGate's MCP server to judges. No new tool implementations or dashboard page changes.

</domain>

<decisions>
## Implementation Decisions

### Page layout
- Three-column layout: tool selector (left) | parameter form (center) | JSON response (right)
- Column proportions: ~20% tools / ~30% params / ~50% JSON — gives most space to the visual payoff (response)
- Tool selector column is always visible (no collapse) — one-click switching during demo
- Minimal page header: "MCP Playground" title + tool count badge, then straight into columns
- JSON response panel: request JSON stacked on top, response JSON below — natural top-to-bottom flow

### Tool selector
- Collapsible domain groups: Lido, Treasury, Delegation, ENS, Monitor — expand/collapse to show tools
- Hide incomplete/placeholder domains (Uniswap) — avoid awkward moments if judges try non-working tools
- Each tool shows: snake_case name + one-line description (truncated) — scannable
- Search/filter input at top of tool selector column for quick jumping

### Human/Agent view toggle
- Toggle switch in page header (inspired by Synthesis hackathon page's "show agent view" / "translate for humans" toggle)
- Agent view: snake_case tool names ("lido_stake"), raw JSON params, raw JSON response
- Human view: friendly tool names ("Stake ETH (Lido)"), labeled param values ("Amount: 1.0 ETH"), formatted response summary ("Simulated — ~0.87 stETH received")
- Default: agent view (this is a developer/MCP tool playground)

### Parameter forms
- Smart defaults pre-filled: connected wallet address for address fields, "1.0" for amounts, dry_run=true for safe demos
- Global dry-run toggle in page header — applies to all tool executions (matches Phase 1's demo mode auto-dry-run pattern)
- Individual tool dry_run params are hidden from the form — controlled by global toggle

### Schema source
- Claude's Discretion: Prefer reusing MCP server's existing Zod schemas over duplicating definitions — user wants to leverage what exists rather than maintain a static copy. Evaluate whether schemas can be extracted from the server and exposed through the bridge vs. a static tool-schemas config.

### Response display
- Dark code theme syntax highlighting (VS Code-dark style: green strings, blue numbers, purple keys) — fits crypto/dev aesthetic
- Status bar between request and response: status badge (Success/Error/Dry Run), execution time ("142ms"), HTTP status code
- Actions on JSON panels: copy to clipboard, collapse/expand nested nodes, word wrap toggle, download as .json file
- Empty state before first execution: subtle placeholder text "Select a tool and execute to see results"

### Claude's Discretion
- Exact JSON highlighting library choice (react-json-view, prism, or custom)
- Schema extraction approach (bridge endpoint vs static config — lean toward reuse)
- Search filter implementation details
- Human view response formatting per tool
- Exact spacing, typography, and glassmorphism card treatment
- Loading state during tool execution
- Error display for failed tool calls

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP server tools & schemas
- `packages/mcp-server/src/tools/lido.ts` — 6 Lido tools with Zod schemas (stake, wrap, unwrap, APR, balances)
- `packages/mcp-server/src/tools/treasury.ts` — 5+ Treasury tools with Zod schemas (deposit, withdraw, status, rate, spender config)
- `packages/mcp-server/src/tools/delegation.ts` — 5 Delegation tools with Zod schemas (create, redeem, revoke, list)
- `packages/mcp-server/src/tools/ens.ts` — 2 ENS tools (resolve, avatar)
- `packages/mcp-server/src/tools/monitor.ts` — 1 Monitor tool (vault health report)
- `packages/mcp-server/src/index.ts` — Server setup, `server.tool()` registration pattern, AgentGateContext interface

### Bridge infrastructure (from Phase 1)
- `packages/mcp-server/src/bridge.ts` — HTTP bridge: toolRegistry, BridgeContext, createBridgeContext, getAvailableTools(), dry-run stub pattern
- `packages/app/src/app/api/mcp/[tool]/route.ts` — API route for MCP tool calls via bridge
- `packages/app/src/lib/hooks/use-mcp-action.ts` — Existing hook for calling bridge tools from React

### App shell & UI
- `packages/app/src/app/playground/page.tsx` — Current placeholder page to be replaced
- `packages/app/src/components/ui/` — Available shadcn components: card, dialog, input, label, select, sheet, switch, table, tabs, tooltip, button, badge, skeleton, separator
- `packages/app/src/lib/constants.ts` — DEMO_TREASURY_ADDRESS for demo mode default values

### Requirements
- `.planning/REQUIREMENTS.md` — PLAY-01 through PLAY-04 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useMcpAction` hook: Already handles bridge tool calls with loading/error state — extend for playground use
- `toolRegistry` in bridge.ts: Maps tool names to handlers — `getAvailableTools()` returns all tool names
- shadcn `tabs`, `select`, `input`, `switch`, `card`, `badge`: All available for building the three-column UI
- `skeleton.tsx`: Loading shimmer for tool execution state

### Established Patterns
- MCP bridge at `/api/mcp/[tool]` accepts POST with params — playground calls the same endpoint
- All write tools support dry_run via `isDry = dry_run ?? ctx.dryRun` — global toggle maps to this
- Glassmorphism cards with purple accent (#8B5CF6) — consistent with Phase 1/2 styling
- Dark theme forced globally — no light mode considerations

### Integration Points
- Playground page replaces `packages/app/src/app/playground/page.tsx` placeholder
- Bridge `toolRegistry` keys are the tool names used in the selector
- Wallet address from wagmi hooks or DEMO_TREASURY_ADDRESS for smart defaults
- Zod schemas are defined inside `server.tool()` calls in each tool file — need extraction strategy for form generation

</code_context>

<specifics>
## Specific Ideas

- Human/Agent view toggle inspired by the Synthesis hackathon homepage ("show agent view" / "translate for humans") — agent view shows code-like MCP syntax, human view shows friendly labels and formatted results
- Tool selector should feel like browsing an API reference — collapsible domain groups with search
- Response panel is the "visual payoff" — gets the most screen real estate (~50%) and richest interactions (copy, collapse, download)
- Production-ready patterns preferred (carried from Phase 1) — not hackathon shortcuts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-mcp-playground*
*Context gathered: 2026-03-20*
