# Phase 6: API and Real-Time Endpoints - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard clients can fetch agent registry data, query activity history, and receive real-time event streams. This phase builds three API endpoints: enhanced GET /api/agents, GET /api/activity, and GET /api/activity/sse. It does NOT build dashboard UI (Phase 8), sprite animations (Phase 7), or demo mode seeding (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Activity query API
- GET /api/activity returns full dump of all events from the 500-event circular buffer — no pagination
- Supports `?agent=<agentId>` query param for per-agent filtering — no other filters
- Events returned newest-first (reverse chronological)
- Full event payload returned raw — no field truncation or stripping of params/result

### SSE event stream
- GET /api/activity/sse streams all event updates — both pending (tool call started) and completion (success/error with result)
- Streams all events (no per-agent filtering) — Phase 8 does client-side filtering if needed
- Supports Last-Event-ID header for reconnection — server replays missed events from buffer on reconnect
- 30-second heartbeat comment (`: heartbeat`) to keep connection alive through proxies
- SSE streams ActivityEvents only — no separate agent-status event type

### Agent status derivation
- Three states: **active** (has any event with status=pending in buffer), **idle** (has completed events but none currently pending), **registered** (in registry but zero activity events ever)
- Status computed server-side and returned in the GET /api/agents response — single source of truth
- Phase 8 infers agent status changes from SSE activity events (pending = active, completion with no remaining pending = idle)

### Existing /api/agents enhancement
- Enhance the existing GET /api/agents route in-place (no new endpoint)
- Add `status` field (active/idle/registered) computed from activity buffer
- Add `lastActivityAt` timestamp field
- Keep existing fields: name, address, type, registration date

### Claude's Discretion
- SSE event naming convention (e.g., `event: activity` or default message type)
- Exact JSON response envelope shape (e.g., `{ events: [...] }` vs `{ data: [...] }`)
- Error response format for invalid query params
- Internal implementation of Last-Event-ID replay logic

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Activity system (Phase 5 output)
- `packages/mcp-server/src/activity-log.ts` — ActivityEvent interface, CircularBuffer, ActivityLog class with getAll(), onEvent(), startEvent(), completeEvent(), enrichEvent(), globalThis singleton
- `packages/mcp-server/src/activity-log.test.ts` — Test suite showing expected behavior and API surface

### Existing API routes
- `packages/app/src/app/api/agents/route.ts` — Current GET /api/agents implementation (to be enhanced)
- `packages/app/src/app/api/mcp-agent/route.ts` — Hosted MCP HTTP route (where agent identity is resolved)
- `packages/app/src/app/api/agents/register/route.ts` — Agent registration endpoint

### Agent registry
- `packages/mcp-server/src/registry.ts` — AgentRegistry, RegisteredAgent type, listAgents()
- `packages/mcp-server/src/hosted.ts` — handleMcpRequest, createMcpServer, per-request server lifecycle

### Architecture
- `.planning/codebase/ARCHITECTURE.md` — Overall system architecture and data flows
- `.planning/codebase/CONVENTIONS.md` — API route patterns, naming, error handling conventions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ActivityLog.getAll()` — returns all events from circular buffer, use for GET /api/activity
- `ActivityLog.onEvent(callback)` — returns unsubscribe function, use for SSE listener registration
- `ActivityLog.buffer.findById()` — can check for pending events per agent for status derivation
- `AgentRegistry.listAgents()` — returns RegisteredAgent[] with name, address, type, createdAt
- `getActivityLog()` / `activityLog` export — globalThis singleton, importable from any Next.js API route

### Established Patterns
- API routes use `NextResponse.json()` for JSON responses
- Imports from mcp-server via `@agentgate/mcp-server/hosted` subpath export
- `UpstashAgentStore` used as backing store for AgentRegistry in API routes
- 2-space indentation, semicolons, trailing commas

### Integration Points
- `packages/app/src/app/api/agents/route.ts` — enhance with activity buffer integration
- New route: `packages/app/src/app/api/activity/route.ts` — REST activity endpoint
- New route: `packages/app/src/app/api/activity/sse/route.ts` — SSE streaming endpoint
- ActivityLog singleton must be accessible from Next.js API routes (same process)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-api-and-real-time-endpoints*
*Context gathered: 2026-03-22*
