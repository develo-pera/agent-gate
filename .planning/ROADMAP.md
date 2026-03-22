# Roadmap: AgentGate Dashboard

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-20)
- 🚧 **v1.1 Live Agent Activity Dashboard** — Phases 5-8 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-20</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-19
- [x] Phase 2: Dashboard Pages (4/4 plans) — completed 2026-03-20
- [x] Phase 3: MCP Playground (3/3 plans) — completed 2026-03-20
- [x] Phase 4: Foundation Verification & Config Fix (2/2 plans) — completed 2026-03-20

Full details: `milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Live Agent Activity Dashboard (In Progress)

**Milestone Goal:** A command-center-style live dashboard showing registered AI agents and their real-time activity — tool calls, transactions, status — with animated pixel-art agent characters, built for maximum hackathon demo impact.

- [ ] **Phase 5: Activity Foundation** - ActivityLog singleton, middleware instrumentation, in-memory event buffer
- [ ] **Phase 6: API and Real-Time Endpoints** - REST agent/activity endpoints and SSE streaming
- [ ] **Phase 7: Sprite Animation System** - Pixel-art sprite sheets and CSS-driven animation components
- [ ] **Phase 8: Dashboard Page Assembly** - Live Agent Activity page with agent cards, activity feed, real-time updates, and demo mode

## Phase Details

### Phase 5: Activity Foundation
**Goal**: Every MCP tool call and on-chain write is captured as a structured ActivityEvent in a persistent in-memory store
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):
  1. When any MCP tool is called via the HTTP bridge, an ActivityEvent with agent identity, tool name, parameters, result, and timestamp is stored in the buffer
  2. When executeOrPrepare performs an on-chain write, the resulting tx hash and status are captured in the ActivityEvent
  3. The in-memory buffer holds the last 500 events and discards oldest when full
  4. Activity data survives across multiple HTTP requests within the same server process (module-level singleton, not per-request)
**Plans**: 2 plans

Plans:
- [ ] 05-01-PLAN.md — ActivityLog module with TDD (CircularBuffer, ActivityLog class, globalThis singleton)
- [ ] 05-02-PLAN.md — Instrument hosted.ts and executeOrPrepare with activity logging

### Phase 6: API and Real-Time Endpoints
**Goal**: Dashboard clients can fetch agent registry data, query activity history, and receive real-time event streams
**Depends on**: Phase 5
**Requirements**: INFRA-04, INFRA-05, INFRA-06
**Success Criteria** (what must be TRUE):
  1. GET /api/agents returns a JSON array of registered agents with name, address, type, and registration date
  2. GET /api/activity returns the activity history from the buffer, filterable by agent
  3. GET /api/activity/sse streams new ActivityEvents to the client in real-time as they occur (SSE text/event-stream)
  4. SSE connection cleans up properly when the client disconnects (no memory leak)
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md — Subpath export, enhanced GET /api/agents with status derivation, GET /api/activity REST endpoint
- [ ] 06-02-PLAN.md — GET /api/activity/sse streaming endpoint with heartbeat and Last-Event-ID

### Phase 7: Sprite Animation System
**Goal**: Pixel-art agent characters animate on screen with state-driven animations, independent of live data
**Depends on**: Phase 5 (needs AgentStatus type definition)
**Requirements**: SPRITE-01, SPRITE-02, SPRITE-03, SPRITE-04
**Success Criteria** (what must be TRUE):
  1. At least 2 visually distinct pixel-art agent character sprite sheets exist in /public/sprites/
  2. AgentSprite component renders a sprite with idle, walking, and working animations using CSS steps() — no JS timers or React state for frame advancement
  3. Sprites move freely across a scene area on the page with crisp pixelated rendering (no anti-aliasing blur)
  4. Hovering over a sprite reveals a details card showing the agent's name, address, current action, and status
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — Sprite utilities, inline SVG robot template, CSS animation keyframes, AgentSprite component with hover card
- [ ] 07-02-PLAN.md — SpriteScene container with random wandering, direction facing, and visual verification

### Phase 8: Dashboard Page Assembly
**Goal**: Users see a complete, live command-center dashboard with agent cards, real-time activity feed, animated sprites, and demo mode fallback
**Depends on**: Phase 6, Phase 7
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DEMO-01
**Success Criteria** (what must be TRUE):
  1. "Live Agents" page is accessible from the sidebar navigation and renders the command-center layout
  2. Each registered agent appears as a card showing name, address, type, and a pulsing active/idle status indicator
  3. A chronological activity timeline displays tool calls and transactions across all agents with agent identity, tool name, timestamp, and result
  4. Activity timeline and agent status indicators update in real-time via SSE without page refresh
  5. In demo mode (no wallet connected), the page shows seeded activity data and animated agents so the dashboard is never empty
**Plans**: TBD

Plans:
- [ ] 08-01: TBD (run /gsd:plan-phase 8 to break down)

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8
Note: Phases 6 and 7 can be parallelized (no mutual dependency), but both must complete before Phase 8.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-19 |
| 2. Dashboard Pages | v1.0 | 4/4 | Complete | 2026-03-20 |
| 3. MCP Playground | v1.0 | 3/3 | Complete | 2026-03-20 |
| 4. Foundation Verification & Config Fix | v1.0 | 2/2 | Complete | 2026-03-20 |
| 5. Activity Foundation | v1.1 | 0/2 | Not started | - |
| 6. API and Real-Time Endpoints | v1.1 | 0/2 | Not started | - |
| 7. Sprite Animation System | v1.1 | 0/2 | Not started | - |
| 8. Dashboard Page Assembly | v1.1 | 0/? | Not started | - |
