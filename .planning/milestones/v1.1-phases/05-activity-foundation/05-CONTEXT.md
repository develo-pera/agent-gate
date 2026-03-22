# Phase 5: Activity Foundation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Every MCP tool call and on-chain write is captured as a structured ActivityEvent in a persistent in-memory store. This phase builds the ActivityLog singleton, middleware instrumentation on the hosted MCP server, and the circular event buffer. It does NOT build API endpoints (Phase 6), UI (Phase 8), or sprite animations (Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Event shape
- Full capture: agent ID (name), agent address, tool name, full params, full result, timestamp, duration, and tx hash/status/block_number when applicable
- Single event type with optional tx fields (tx_hash, status, block_number are null for read-only calls)
- Events have a lifecycle status: pending → success/error. Two writes to buffer per event (create on start, update on completion)
- Auto-increment numeric ID per event. Resets on server restart (acceptable — in-memory buffer is ephemeral by design)

### Instrumentation points
- Instrument hosted.ts (real MCP agent calls) and executeOrPrepare (on-chain tx enrichment)
- Bridge.ts playground calls are completely invisible to the activity system — no instrumentation
- Hook into hosted.ts by wrapping server.tool() calls in createMcpServer with a logging layer
- executeOrPrepare enriches the parent tool call event with tx_hash, status, block_number — no separate tx event

### Buffer behavior
- Circular buffer, 500 events max, silent drop of oldest on overflow
- Buffer returns all events; Phase 6 API layer handles per-agent filtering
- Buffer exposes onEvent(callback) listener mechanism for Phase 6 SSE to subscribe to new/updated events
- globalThis pattern for singleton to survive HMR (from STATE.md research notes)

### Agent identity
- Each event stores agentId (name) and agentAddress — no agentType field needed
- Agent identity passed from handleMcpRequest (which already resolves bearer → agent) into createMcpServer, then into the logging wrapper
- Agent fields are required (not optional) — no anonymous/unknown agent support

### Claude's Discretion
- Exact ActivityEvent TypeScript interface field names and types
- Internal buffer data structure (array vs ring buffer implementation)
- How the server.tool() wrapper intercepts and delegates
- Error serialization format in event results

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MCP Server internals
- `packages/mcp-server/src/hosted.ts` — handleMcpRequest, createMcpServer, per-request server lifecycle
- `packages/mcp-server/src/execute-or-prepare.ts` — executeOrPrepare and executeOrPrepareMany, tx execution flow
- `packages/mcp-server/src/context.ts` — AgentGateContext interface (agentAddress, agentType fields)
- `packages/mcp-server/src/registry.ts` — AgentRegistry, RegisteredAgent type, listAgents()

### Dashboard integration
- `packages/app/src/app/api/mcp-agent/route.ts` — hosted MCP HTTP route (where bearer → agent resolution happens)
- `packages/app/src/app/api/mcp/[tool]/route.ts` — bridge tool route (NOT instrumented)

### Architecture
- `.planning/codebase/ARCHITECTURE.md` — Overall system architecture and data flows

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentRegistry.listAgents()` — already returns agent_id, address, type for all registered agents
- `AgentGateContext` — already carries agentAddress and agentType per request
- `RegisteredAgent` type — has address, name, type, createdAt fields
- `ExecuteResult` type — already has tx_hash, status, block_number fields

### Established Patterns
- Tool registration via `registerXTools(server, ctx)` pattern in hosted.ts
- Per-request server lifecycle: createMcpServer → connect transport → handle → close
- Module-level singletons (e.g., `defaultRegistry` in hosted.ts)
- Zod schema validation on all tool inputs

### Integration Points
- `createMcpServer()` in hosted.ts — where tool logging wrapper would be injected
- `executeOrPrepare()` — where tx data enrichment would happen
- `handleMcpRequest()` — where agent identity is resolved and can be passed through
- New ActivityLog singleton needs to be importable by Phase 6 API routes

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

*Phase: 05-activity-foundation*
*Context gathered: 2026-03-22*
