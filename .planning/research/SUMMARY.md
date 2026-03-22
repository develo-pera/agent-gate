# Project Research Summary

**Project:** AgentGate Dashboard — Live Agent Activity Dashboard (v1.1)
**Domain:** Real-time AI agent monitoring with pixel-art visualization
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

AgentGate v1.1 adds a live agent activity dashboard to an existing Next.js 16 + Tailwind v4 + shadcn/ui monorepo. The core innovation is a "command center" page that shows registered AI agents as animated pixel-art sprites whose states react in real time to MCP tool calls. Research confirms this is achievable with zero new npm dependencies — every capability maps to browser built-ins, Node.js core modules, or CSS features already available in the stack.

The recommended approach follows a strict dependency-first build order: instrument the MCP server with an activity logging middleware backed by an in-memory singleton, expose the data via REST and SSE endpoints, then build the React components on top. The pixel-art sprites must use CSS `steps()` animation (not any JS animation library) because sprite sheet stepping requires discrete frame advancement, not smooth interpolation. SSE is the right transport choice over WebSocket because the data flow is unidirectional and SSE works natively with Next.js Route Handlers without custom server infrastructure.

The primary risks are architectural, not technical. Two structural decisions must be made correctly before any other work begins: the activity store must be a module-level singleton (not per-request) to survive across the per-request MCP server lifecycle, and the SSE route handler must return its `Response` immediately (not after awaiting an event loop). Getting either of these wrong results in a dashboard that silently shows nothing — a catastrophic demo failure that is invisible until the demo itself.

## Key Findings

### Recommended Stack

The v1.0 stack (Next.js 16, React 19, TypeScript 5, Tailwind v4, shadcn/ui, wagmi, react-query) is entirely sufficient for v1.1. No new npm packages are needed. The three new capabilities — sprite animation, real-time streaming, and activity logging — all map to built-in APIs.

**Core technologies for v1.1:**
- CSS `steps()` + `background-position`: sprite frame animation — the standard technique for pixel-art; no library does this better
- Browser `EventSource` API: SSE consumption — native auto-reconnect, ~20 lines for a full custom hook
- Next.js `ReadableStream` Route Handler: SSE endpoint — works with `force-dynamic` + `runtime = 'nodejs'`, zero infrastructure
- Node.js `EventEmitter` (`node:events`): in-process pub/sub — connects logging middleware to SSE subscribers at zero latency
- Node.js `crypto.randomUUID()`: event IDs — enables SSE `Last-Event-ID` reconnection
- `tw-animate-css` (already installed): `animate-ping` for active status dots
- `image-rendering: pixelated` CSS: crisp sprite upscaling — prevents anti-aliasing on scaled pixel art

### Expected Features

**Must have (table stakes):**
- Agent cards with pulsing status indicators (active/idle/error) — monitoring dashboards require at-a-glance entity status
- Real-time activity feed showing tool calls with agent, tool name, timestamp, and result status — core promise of a "live" dashboard
- Activity logging middleware in MCP server — without this, there is no data; it is the critical path
- REST endpoints (`/api/agents`, `/api/activity`) — feed initial page load and polling fallback
- Transaction hash display linking to BaseScan — DeFi dashboards must show on-chain evidence
- Agent type badges (first-party vs third-party) — registry already has the `type` field
- Demo mode with seeded activity events — existing app has demo mode; the new page must match

**Should have (differentiators):**
- Animated pixel-art sprites per agent with state-driven animations (idle/active/error) — the visual hook that makes the demo memorable
- Command center layout: agent sprite scene + activity feed sidebar — "war room" feel
- SSE real-time streaming upgrade over polling — events appear instantly without manual refresh
- Live stats counter (total calls, active agents, transactions) — running numbers feel alive

**Defer (v2+):**
- Agent activity sparklines — only valuable with sustained activity; 2-minute demo won't showcase it
- Tool call detail JSON expansion — MCP Playground already covers this; don't duplicate
- CRT/scan-line visual effects — polish layer, only if all core features are done
- Full agent management CRUD UI — registration happens via API; read-only list is sufficient for demo

### Architecture Approach

The v1.1 architecture adds three layers to the existing monorepo without touching any existing tool handlers or page components. An `ActivityLog` singleton module in `packages/mcp-server` serves as the shared event store. Middleware wrappers intercept tool dispatch in `bridge.ts` and `hosted.ts` (the two entry points for MCP calls) and push structured events to the singleton. New Next.js API routes import the singleton via a subpath export (`@agentgate/mcp-server/activity`) and expose it as REST history or SSE stream. The frontend `/agents` page consumes the API with react-query for agent list and a custom `useAgentActivity` hook for SSE events.

**Major components:**
1. `ActivityLog` singleton (`packages/mcp-server/src/activity-log.ts`) — ring buffer (500 events), subscriber set, module-level export; must use `globalThis` pattern to survive Next.js HMR
2. Activity middleware in `bridge.ts` + `hosted.ts` — wraps tool dispatch at the registry level, not inside individual tool files; fire-and-forget to avoid latency
3. SSE Route Handler (`/api/activity/sse/route.ts`) — `ReadableStream` + `force-dynamic` + `runtime = 'nodejs'`; subscribes to `ActivityLog`, returns `Response` immediately
4. `useAgentActivity` hook — `EventSource` with `useEffect` cleanup, hydrates from `/api/activity` on mount, then streams live updates
5. `AgentSprite` component — CSS `steps()` animation via class switching; no `useState` for frame index; `image-rendering: pixelated`; preloaded from `/public/sprites/`
6. `/agents` page — server shell + `AgentsClient` ("use client"); `AgentCardGrid` + `ActivityFeed`; demo mode seeds events when no wallet connected

### Critical Pitfalls

1. **SSE route handler buffering** — if you `await` anything before returning the `Response`, Next.js buffers the entire stream and delivers it as one batch at timeout. Return `new Response(stream)` immediately; start async work inside `ReadableStream.start()` without awaiting. Add `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'`.

2. **Per-request MCP server loses activity state** — `hosted.ts` creates and destroys a new `McpServer` per request. The `ActivityLog` must be a module-level singleton, not attached to the server instance. Use the `globalThis` pattern to also survive HMR.

3. **Sprite animation causes React re-render cascade** — storing frame index in `useState` triggers full re-renders at animation framerate across all agent cards. Use CSS `steps()` animation exclusively; switch animation state by changing CSS class, not JS state.

4. **SSE memory leak from uncleaned connections** — client must call `EventSource.close()` in `useEffect` cleanup; server must listen to `request.signal` (AbortSignal) and remove the subscriber on abort.

5. **Activity logging adds latency to tool calls** — use fire-and-forget: `void logActivity(event).catch(console.error)`. Never `await` any I/O in the tool dispatch path.

## Implications for Roadmap

Based on the dependency graph in ARCHITECTURE.md, the build order is strict. Nothing on the frontend works until the backend singleton and middleware exist.

### Phase 1: Activity Foundation
**Rationale:** Everything else depends on this. The activity log singleton and middleware are the critical path with no predecessors. Must be built and verified before any API endpoints or frontend work begins.
**Delivers:** Working activity capture — every MCP tool call emits a structured `ActivityEvent` stored in the in-memory ring buffer with agent identity, tool name, params, result, timestamp, and txHash.
**Addresses:** Activity logging middleware, shared `ActivityEvent` type definition, agent identity attribution for bridge calls
**Avoids:** Pitfall 4 (per-request state loss — use module-level singleton), Pitfall 3 (logging latency — fire-and-forget), Pitfall 8 (schema mismatch — define shared type first), Pitfall 9 (HMR resets — use `globalThis` pattern)
**Research flag:** Standard patterns — no additional research needed.

### Phase 2: SSE Streaming Endpoint
**Rationale:** REST endpoints reuse the existing bridge pattern and are fast to build; SSE requires careful implementation. Build both so the frontend has all data APIs available. SSE must be correct from the start — buffering bugs are invisible until demo time.
**Delivers:** `/api/agents` (agent list + derived status), `/api/activity` (history), `/api/activity/sse` (real-time stream)
**Uses:** Node.js `ReadableStream`, Next.js Route Handler with `force-dynamic` + `runtime = 'nodejs'`, `@agentgate/mcp-server/activity` subpath export
**Avoids:** Pitfall 1 (SSE buffering — return Response immediately), Pitfall 2 (memory leaks — AbortSignal cleanup), Pitfall 11 (transport confusion — activity SSE at `/api/activity/sse`, completely separate from MCP transport at `/api/mcp-agent`)
**Research flag:** Verify SSE `request.signal` AbortSignal behavior in Next.js 16 with Turbopack. Test with `curl` before building frontend.

### Phase 3: Sprite Assets and Animation System
**Rationale:** Sprite assets are independent of the backend work and can be developed in parallel with Phase 2. Must be complete before page assembly. Asset creation is the only time-uncertain element.
**Delivers:** Sprite sheet PNGs for hackaclaw, merkle, and a generic third-party pool; `AgentSprite` React component with CSS `steps()` idle/active/error state switching.
**Uses:** CSS `steps()` + `background-position`, `image-rendering: pixelated`, Aseprite or Pixelorama for asset creation; sprites served from `/public/sprites/` (not `next/image`)
**Avoids:** Pitfall 5 (React re-render cascade — CSS-only animation), Pitfall 7 (image loading race — preload in layout head), Pitfall 12 (blurry scaling — `pixelated` rendering), Pitfall 14 (timer proliferation — zero JS timers)
**Research flag:** No technical research needed. Budget time for sprite art creation — even simple 4-frame 32x32 sprites take 1-2 hours.

### Phase 4: Agent Dashboard Page
**Rationale:** Assembly phase — all components and APIs exist. Wire them together into the `/agents` page with command center layout, demo mode support, and sidebar nav addition.
**Delivers:** Complete live agent dashboard at `/agents`; agent cards with sprites + status; activity feed timeline; live stats bar; sidebar nav item; demo mode with seeded events; SSE-driven sprite state transitions.
**Implements:** Full component tree: `AgentsPage` → `AgentsClient` → `AgentCardGrid` + `ActivityFeed`; `StatusIndicator`, `AgentStats`, `ActivityRow`, `ToolBadge`, `TxLink`
**Avoids:** Pitfall 6 (reconnection flood — custom hook with ref-guarded EventSource, `retry:` field in SSE), Pitfall 13 (empty demo mode — seed events on init), Pitfall 15 (hydration mismatch — `"use client"` + mounted-state pattern), Pitfall 16 (RPC rate limiting — derive chain data from activity log, not additional RPC calls)
**Research flag:** Standard patterns — follows established page patterns from treasury, staking, and delegation pages.

### Phase Ordering Rationale

- Phase 1 before Phase 2: SSE endpoint requires `ActivityLog.subscribe()` to exist and be populated; REST endpoint requires the ring buffer.
- Phase 1 before Phase 3: `AgentSprite` component needs the `AgentStatus` type defined in Phase 1.
- Phases 2 and 3 can be parallelized — they share no dependencies on each other.
- Phase 4 requires both Phase 2 (data hooks depend on API endpoints) and Phase 3 (page uses sprite component).

### Research Flags

Needs additional attention during planning:
- **Phase 2 (SSE):** Test SSE `request.signal` / AbortSignal in Next.js 16 + Turbopack before building the frontend hook. Document the exact headers needed (`X-Accel-Buffering: no` may be required even in dev).
- **Phase 1 (Agent identity):** Decide how bridge calls attribute agent identity (`wallet_address` from body vs "dashboard-user" fallback) before implementing the middleware — this decision shapes the `ActivityEvent` schema.

Standard patterns (skip research-phase):
- **Phase 1 (Activity Foundation):** EventEmitter singleton + `globalThis` HMR pattern is identical to the Prisma docs recommendation — well understood.
- **Phase 3 (Sprites):** CSS `steps()` sprite animation is a CSS3 standard with multiple authoritative tutorials.
- **Phase 4 (Dashboard Page):** Component assembly follows existing page patterns already proven in the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies required; every technique maps to built-in APIs with multiple 2025-2026 sources confirming the patterns |
| Features | HIGH | Clear table stakes derived from monitoring dashboard conventions; differentiators well-scoped to hackathon constraints |
| Architecture | HIGH | Primary source is the actual codebase; singleton pattern and middleware injection points verified against live code in `hosted.ts` and `bridge.ts` |
| Pitfalls | HIGH | SSE buffering and memory leak pitfalls verified via Next.js GitHub issues (#48427, #53949); per-request server lifecycle directly observed in codebase |

**Overall confidence:** HIGH

### Gaps to Address

- **Sprite asset creation time:** The CSS technique is known but actual pixel art must be created or sourced. Quality depends on artistic skill. Even simple 4-frame 32x32 sprites take 1-2 hours to draw. Plan accordingly or source free assets.
- **Next.js 16 + Turbopack SSE behavior:** The `globalThis` singleton and SSE streaming patterns are well-documented for Next.js 13-15. Verify they behave identically under Next.js 16 with Turbopack during Phase 1-2 implementation before building the full frontend.
- **Bridge call agent identity:** The architecture proposes using `wallet_address` from the request body to attribute bridge calls. This needs a decision before Phase 1 middleware is implemented — it affects the `ActivityEvent` schema.

## Sources

### Primary (HIGH confidence)
- Existing codebase (`packages/mcp-server/src/hosted.ts`, `bridge.ts`, `execute-or-prepare.ts`) — per-request lifecycle, tool dispatch patterns, Upstash singleton model
- [Next.js SSE Discussion #48427](https://github.com/vercel/next.js/discussions/48427) — SSE route handler buffering issues
- [Next.js EventEmitter Leak #53949](https://github.com/vercel/next.js/issues/53949) — MaxListenersExceededWarning with SSE
- [Next.js Route Handlers documentation](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) — streaming response patterns
- [Josh Comeau — Sprites on the Web](https://www.joshwcomeau.com/animation/sprites/) — CSS sprite animation reference
- [Alec Horner — Animating Pixel Sprites with CSS](https://alechorner.com/blog/animating-pixel-sprites-with-css/) — React + CSS steps() integration

### Secondary (MEDIUM confidence)
- [Damian Hodgkiss — Real-Time Updates with SSE in Next.js 15](https://damianhodgkiss.com/tutorials/real-time-updates-sse-nextjs) — SSE configuration patterns
- [Pedro Alonso — Real-Time Notifications with SSE in Next.js](https://www.pedroalonso.net/blog/sse-nextjs-real-time-notifications/) — connection cleanup patterns
- [HackerNoon — Streaming in Next.js 15: WebSockets vs SSE](https://hackernoon.com/streaming-in-nextjs-15-websockets-vs-server-sent-events) — SSE vs WebSocket tradeoffs
- [Smashing Magazine: UX Strategies for Real-Time Dashboards](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/) — monitoring dashboard conventions
- [kirupa.com — Sprite Sheet Animations Using Only CSS](https://www.kirupa.com/html5/sprite_sheet_animations_using_only_css.htm) — steps() deep dive

### Tertiary (LOW confidence)
- [Mission Control](https://github.com/builderz-labs/mission-control) — open-source AI agent orchestration dashboard (feature reference only)
- [FastMCP Middleware](https://gofastmcp.com/servers/middleware) — middleware pattern for MCP logging (pattern reference, not direct dependency)

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
