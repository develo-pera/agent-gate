---
phase: 06-api-and-real-time-endpoints
plan: 01
subsystem: api
tags: [rest, next-api-routes, activity-log, status-derivation, vitest]

requires:
  - phase: 05-mcp-tool-callback-wiring
    provides: ActivityLog with CircularBuffer and getActivityLog singleton
provides:
  - activity-log subpath export for cross-package imports
  - Enhanced GET /api/agents with status derivation (registered/active/idle)
  - GET /api/activity with newest-first ordering and agent filtering
  - createdAt field in listAgents return type
affects: [06-02-PLAN, 08-dashboard-ui]

tech-stack:
  added: []
  patterns: [vi.hoisted for mock variable hoisting in vitest, deriveStatus pattern for event-based status]

key-files:
  created:
    - packages/app/src/app/api/activity/route.ts
    - packages/app/src/app/api/activity/route.test.ts
    - packages/app/src/app/api/agents/route.test.ts
  modified:
    - packages/mcp-server/package.json
    - packages/mcp-server/src/registry.ts
    - packages/app/src/app/api/agents/route.ts

key-decisions:
  - "Used vi.hoisted() for mock variable declarations to avoid TDZ issues with vitest mock hoisting"

patterns-established:
  - "force-dynamic export on all real-time API routes"
  - "vi.hoisted + class mocks for Next.js route handler testing"
  - "deriveStatus pure function for event-based agent status computation"

requirements-completed: [INFRA-05, INFRA-06]

duration: 4min
completed: 2026-03-22
---

# Phase 06 Plan 01: REST API Endpoints Summary

**Two REST endpoints (GET /api/agents with registered/active/idle status, GET /api/activity with agent filtering) plus activity-log subpath export, all with 9 passing vitest tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-22T10:49:29Z
- **Completed:** 2026-03-22T10:53:33Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Added activity-log subpath export enabling cross-package import of ActivityLog
- Enhanced GET /api/agents to derive agent status (registered/active/idle) from activity events
- Created GET /api/activity endpoint with newest-first ordering and optional agent query filtering
- 9 unit tests covering all status derivation states, filtering, ordering, and response envelopes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add activity-log subpath export and createdAt to listAgents** - `3806662` (feat)
2. **Task 2: Enhanced GET /api/agents with status derivation** - `ec0343e` (test), `a52c3bc` (feat)
3. **Task 3: GET /api/activity REST endpoint** - `00dfe3c` (test), `26d71e9` (feat)

## Files Created/Modified
- `packages/mcp-server/package.json` - Added ./activity-log subpath export
- `packages/mcp-server/src/registry.ts` - Added createdAt to listAgents return
- `packages/app/src/app/api/agents/route.ts` - Enhanced with deriveStatus and activity-log import
- `packages/app/src/app/api/agents/route.test.ts` - 5 tests for agents endpoint
- `packages/app/src/app/api/activity/route.ts` - New activity history endpoint
- `packages/app/src/app/api/activity/route.test.ts` - 4 tests for activity endpoint

## Decisions Made
- Used vi.hoisted() for mock variable declarations to avoid temporal dead zone issues with vitest's mock hoisting behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Vitest mock hoisting caused "Cannot access before initialization" errors when mock variables were declared with const before vi.mock calls. Fixed by using vi.hoisted() to declare mock functions in the hoisted scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- REST data layer ready for Phase 06 Plan 02 (SSE real-time endpoint)
- Both endpoints ready for Phase 08 dashboard UI consumption
- activity-log subpath export available for all Phase 6 routes

## Self-Check: PASSED

All 6 files verified present. All 5 commits verified in git log.

---
*Phase: 06-api-and-real-time-endpoints*
*Completed: 2026-03-22*
