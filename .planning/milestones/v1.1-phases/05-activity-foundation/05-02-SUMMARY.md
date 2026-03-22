---
phase: 05-activity-foundation
plan: 02
subsystem: infra
tags: [mcp-instrumentation, activity-logging, event-enrichment, vitest]

# Dependency graph
requires:
  - phase: 05-activity-foundation plan 01
    provides: ActivityLog class with startEvent/completeEvent/enrichEvent lifecycle
provides:
  - wrapServerWithLogging function intercepting all MCP tool callbacks with activity events
  - activeEventId field on AgentGateContext for threading event IDs to executeOrPrepare
  - Transaction enrichment in executeOrPrepare and executeOrPrepareMany
  - Integration tests verifying instrumentation patterns
affects: [phase 06 SSE API, phase 08 dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [tool-callback-wrapping, context-threaded-event-id, tx-enrichment-guard]

key-files:
  created: []
  modified:
    - packages/mcp-server/src/hosted.ts
    - packages/mcp-server/src/context.ts
    - packages/mcp-server/src/execute-or-prepare.ts
    - packages/mcp-server/src/activity-log.test.ts

key-decisions:
  - "Cast originalTool as any to handle McpServer.tool() overload spread -- TypeScript cannot infer tuple type from rest args"
  - "Enrichment guarded by ctx.activeEventId != null so bridge/playground paths never trigger it"

patterns-established:
  - "Tool callback wrapping: save original server.tool, replace with logging wrapper, delegate to original"
  - "Context-threaded event ID: set ctx.activeEventId before callback, clear in finally block"
  - "Enrichment guard: always check ctx.activeEventId != null before calling activityLog.enrichEvent"

requirements-completed: [INFRA-01, INFRA-02]

# Metrics
duration: 4min
completed: 2026-03-22
---

# Phase 05 Plan 02: MCP Instrumentation Summary

**Tool callback wrapping in hosted.ts with tx enrichment in executeOrPrepare -- every hosted tool call produces ActivityEvents, first-party writes get txHash/blockNumber**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T23:49:09Z
- **Completed:** 2026-03-21T23:53:09Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- wrapServerWithLogging intercepts every server.tool() callback to create/complete ActivityEvents
- Agent identity (agentId, agentAddress) flows from handleMcpRequest through createMcpServer into the wrapper
- executeOrPrepare and executeOrPrepareMany enrich parent event with txHash, txStatus, blockNumber
- ctx.activeEventId threading ensures enrichment only fires during active tool callbacks
- 6 new integration tests (26 total) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add activeEventId and instrument hosted.ts** - `f0af221` (feat)
2. **Task 2: Instrument executeOrPrepare with tx enrichment** - `5d7c3c7` (feat)
3. **Task 3: Integration tests for instrumentation** - `27fde67` (test)

## Files Created/Modified
- `packages/mcp-server/src/context.ts` - Added activeEventId optional field to AgentGateContext
- `packages/mcp-server/src/hosted.ts` - Added activityLog import, wrapServerWithLogging function, integration into createMcpServer
- `packages/mcp-server/src/execute-or-prepare.ts` - Added activityLog import, enrichment calls in both executeOrPrepare and executeOrPrepareMany
- `packages/mcp-server/src/activity-log.test.ts` - Added 6 integration tests for wrapping pattern and enrichment lifecycle

## Decisions Made
- Cast originalTool as `any` to work around TypeScript's inability to spread args into McpServer.tool() overloads
- Enrichment guard uses `!= null` (not `!== undefined`) to handle both undefined and potential 0 edge case

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript spread error in wrapServerWithLogging**
- **Found during:** Task 1 (hosted.ts instrumentation)
- **Issue:** `originalTool(name, ...rest)` caused TS2556 because McpServer.tool() has specific overloads, not a rest parameter
- **Fix:** Cast originalTool as `any` before calling with spread
- **Files modified:** packages/mcp-server/src/hosted.ts
- **Verification:** `npx tsc --noEmit` produces no new errors
- **Committed in:** f0af221 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor type cast needed for TypeScript compatibility. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All MCP tool calls through hosted.ts now produce ActivityEvents
- executeOrPrepare enriches events with tx data for first-party agents
- Bridge/playground paths remain untouched (no activity events)
- Ready for Phase 06 SSE route to stream events to dashboard
- No blockers

---
*Phase: 05-activity-foundation*
*Completed: 2026-03-22*

## Self-Check: PASSED
