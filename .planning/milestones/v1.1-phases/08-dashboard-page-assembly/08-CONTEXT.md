# Phase 8: Dashboard Page Assembly - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Users see a complete, live command-center dashboard with agent cards, real-time activity feed, animated sprites, and demo mode fallback. This phase assembles the Live Agent Activity page by wiring Phase 5 (ActivityLog), Phase 6 (API + SSE endpoints), and Phase 7 (sprite components) into a single page. It does NOT add new API endpoints, new sprite features, or new MCP tools.

</domain>

<decisions>
## Implementation Decisions

### Page layout
- Stacked vertical sections: sprite scene banner (~250px) on top, agent cards row below, full-width activity feed at bottom
- Consistent with existing page patterns (Treasury, Staking) — simple vertical scroll
- Activity feed has a fixed max height (~400-500px) with its own internal scrollbar — keeps sprite scene and agent cards always visible above the fold
- Page title: "Live Agents" heading with live stat badges (e.g., "3 agents · 47 events · 2 active") for command-center feel
- New events slide in from top with a brief highlight glow animation — draws attention during demo

### Agent cards
- Compact info: agent name, truncated address (reuse AddressDisplay component), status pulsing dot, last action text
- Pulsing colored dot for status: green=active, amber=idle, gray=registered — matches Phase 7 hover card dots
- No mini robot avatar on cards — text-only
- Clickable cards to filter activity feed to that agent; click again (or click "All") to unfilter
- Cards arranged in a responsive row with auto-wrap

### Activity feed
- Timeline rows: each entry shows timestamp | agent name | tool name | status badge (success/pending/error)
- Expandable on click — reveals params + result JSON below the row (great for demo: "click to see the actual MCP call")
- Entries with on-chain transactions show a chain-link icon + truncated tx hash (0x1a2b...3c4d) — visually distinguishes reads from writes
- Auto-scroll to top for new events — unless user has scrolled down, then show a "N new events" clickable badge
- Real-time updates via SSE subscription (Phase 6 endpoint)
- Client-side agent filtering (SSE streams all events, filter in UI when a card is selected)

### Demo mode
- Demo mode is NOT automatic — a "Run Demo" button appears in the empty state when no activity exists
- Uses real registered agent names (Hackaclaw, Merkel, and any others in the registry) rather than generic placeholders
- Realistic sequence of ~10-15 seed events mimicking a real agent workflow (vault health check → deposit → stake sequence)
- Timed drip playback: events appear one by one every 2-3 seconds — shows off real-time animations and slide-in effects
- Subtle "Demo Mode" chip/badge near the page title while demo is running — consistent with existing demo-banner.tsx pattern
- Sprite scene shows agents wandering with status changes matching the drip events

### Claude's Discretion
- Exact stat badge implementation and positioning
- Activity row internal layout and spacing
- Expand/collapse animation for activity detail view
- Demo event timing variation
- SSE hook implementation details
- Empty state illustration/messaging before "Run Demo" is clicked

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 8 requirements
- `.planning/REQUIREMENTS.md` — DASH-01 through DASH-05, DEMO-01 acceptance criteria
- `.planning/ROADMAP.md` §Phase 8 — Success criteria (sidebar nav, agent cards, timeline, real-time updates, demo mode)

### Activity system (Phase 5 output)
- `packages/mcp-server/src/activity-log.ts` — ActivityEvent interface, CircularBuffer, ActivityLog class, onEvent() listener

### API endpoints (Phase 6 output)
- `packages/app/src/app/api/agents/route.ts` — GET /api/agents with status derivation (active/idle/registered)
- `packages/app/src/app/api/activity/route.ts` — GET /api/activity REST endpoint
- `packages/app/src/app/api/activity/sse/route.ts` — GET /api/activity/sse streaming endpoint

### Sprite components (Phase 7 output)
- `packages/app/src/components/sprites/AgentSprite.tsx` — AgentSprite component (agent, status, action, isWalking props)
- `packages/app/src/components/sprites/SpriteScene.tsx` — SpriteScene container (agents: SpriteAgent[] prop)
- `packages/app/src/lib/sprite-utils.ts` — addressToSpriteColor, statusToAnimation, statusToColor utilities

### Existing UI patterns
- `packages/app/src/components/sidebar.tsx` — Sidebar nav items array (add "Live Agents" entry here)
- `packages/app/src/components/shared/address-display.tsx` — Address truncation component (reuse in agent cards)
- `packages/app/src/components/demo-banner.tsx` — Existing demo mode banner pattern
- `packages/app/src/app/treasury/page.tsx` — Reference for page structure pattern (stacked sections with heading)
- `packages/app/src/app/globals.css` — Theme variables (--primary, --success, --warning, --muted-foreground)
- `packages/app/src/components/ui/card.tsx` — Card component for agent cards

### Prior phase context
- `.planning/phases/06-api-and-real-time-endpoints/06-CONTEXT.md` — Agent status derivation (active/idle/registered), SSE streaming decisions
- `.planning/phases/07-sprite-animation-system/07-CONTEXT.md` — Sprite scene layout, status dot colors, hover card behavior

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SpriteScene` component: Accepts `agents: SpriteAgent[]` — wire with real agent data from /api/agents
- `AgentSprite` component: Accepts `status` prop for animation state — wire with SSE-derived status
- `AddressDisplay` component: Truncates addresses with copy — reuse in agent cards
- `Card` component (shadcn/ui): Use for agent cards
- `demo-banner.tsx`: Existing demo mode indicator pattern
- `Sidebar` component: NAV_ITEMS array — add Live Agents entry with Activity/Bot icon
- Theme CSS variables: `--success` (green), `--warning` (amber), `--muted-foreground` (gray) for status dots

### Established Patterns
- Pages are `"use client"` components in `src/app/[section]/page.tsx`
- Page structure: `<div className="flex flex-col gap-8">` with heading + section components
- Sidebar nav: Add to `NAV_ITEMS` array with `{ href, label, icon }` shape
- Data fetching: @tanstack/react-query for REST, custom hooks for SSE
- Tailwind CSS v4 with dark theme as default

### Integration Points
- New page: `packages/app/src/app/agents/page.tsx` (or `/live-agents/`)
- Sidebar: Add nav item to `NAV_ITEMS` in `sidebar.tsx`
- SSE: Subscribe to `/api/activity/sse` for real-time event stream
- REST: Fetch `/api/agents` for agent list, `/api/activity` for initial event load
- Demo mode: Client-side seed data with timed drip, no backend changes needed

</code_context>

<specifics>
## Specific Ideas

- Real registered agents (Hackaclaw, Merkel) should be used in demo mode, not generic placeholders
- Demo drip should tell a coherent story: agent checks vault health, then deposits, then stakes — a realistic DeFi workflow
- The "Run Demo" button in the empty state is a deliberate UX choice — dashboard shouldn't auto-fill with fake data

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-dashboard-page-assembly*
*Context gathered: 2026-03-22*
