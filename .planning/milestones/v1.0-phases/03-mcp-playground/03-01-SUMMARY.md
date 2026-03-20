---
phase: 03-mcp-playground
plan: 01
subsystem: ui, api
tags: [mcp, tool-schemas, bridge, viem, ens, lido, treasury, delegation]

requires:
  - phase: 03-00
    provides: "Wave 0 stub tests and playground page skeleton"
provides:
  - "Static tool schema registry (TOOL_SCHEMAS) with 25 tool definitions"
  - "Complete bridge toolRegistry with 25 handlers (read-only real, write dry-run)"
  - "getToolsByDomain() helper for domain-grouped rendering"
affects: [03-02, playground-ui, tool-selector, dynamic-form]

tech-stack:
  added: []
  patterns: ["Schema-driven form generation via ToolParam metadata", "Bridge pattern: real read handlers + dryRunStub for writes"]

key-files:
  created:
    - packages/app/src/lib/tool-schemas.ts
  modified:
    - packages/mcp-server/src/bridge.ts

key-decisions:
  - "Bridge has 25 handlers (not 28) since no Uniswap tools exist in codebase"
  - "ENS resolution uses L1 client with normalize() from viem/ens"
  - "vault_health uses Base wstETH balance + Lido APR API for health status"

patterns-established:
  - "ToolSchema pattern: name/humanName/domain/params/hasWriteEffect for UI generation"
  - "isAddress/isAmount flags on params for smart defaults in playground forms"

requirements-completed: [PLAY-01, PLAY-04]

duration: 4min
completed: 2026-03-20
---

# Phase 03 Plan 01: Tool Schema Registry and Bridge Expansion Summary

**Static schema registry defining all 25 MCP tools with parameter metadata, plus complete bridge with real Lido/ENS/Monitor read handlers and dry-run write stubs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T13:29:31Z
- **Completed:** 2026-03-20T13:33:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created tool-schemas.ts with 25 tool definitions across 5 domains (Lido 7, Treasury 10, Delegation 5, ENS 2, Monitor 1)
- Expanded bridge.ts from 14 to 25 handlers with real implementations for read-only tools
- Achieved perfect tool name parity between schema registry and bridge toolRegistry

## Task Commits

Each task was committed atomically:

1. **Task 1: Create static tool schema registry** - `673f8da` (feat)
2. **Task 2: Expand bridge toolRegistry with missing tool handlers** - `47088c8` (feat)

## Files Created/Modified
- `packages/app/src/lib/tool-schemas.ts` - Static schema registry with types, 25 tool definitions, DOMAIN_ORDER, getToolsByDomain()
- `packages/mcp-server/src/bridge.ts` - Expanded with 12 new handlers: lido_get_apr, lido_balance, lido_rewards, lido_governance (real), lido_stake/wrap/governance_vote (stubs), delegate_create_account (stub), ens_resolve/reverse (real L1), vault_health (real)

## Decisions Made
- Bridge has 25 total handlers (not 28 as plan suggested) because no Uniswap tools exist in the codebase -- the plan's "3 Uniswap-excluded" assumed they existed but they were never implemented
- ENS tools use `ctx.l1PublicClient` since ENS resolution requires Ethereum L1
- vault_health computes health_status as "healthy"/"warning"/"no_position" based on balance and APR availability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adjusted tool count expectation from 28 to 25**
- **Found during:** Task 2 (bridge expansion)
- **Issue:** Plan stated 28 total handlers (25 visible + 3 Uniswap) but no Uniswap tools exist anywhere in the codebase
- **Fix:** Implemented all 25 visible tools without attempting to create non-existent Uniswap handlers
- **Files modified:** packages/mcp-server/src/bridge.ts
- **Verification:** Tool name parity check confirmed 25:25 match between schema and bridge

---

**Total deviations:** 1 auto-fixed (1 bug in plan specification)
**Impact on plan:** Corrected an inaccurate count assumption. All 25 visible tools are fully covered.

## Issues Encountered
- vitest `-x` flag not supported in v4.1.0 (used in plan verify commands) -- ran without flag, tests pass
- TypeScript `--noEmit` on bridge.ts shows errors in `node_modules/ox/` (pre-existing dep issue) -- bridge.ts itself has zero errors

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema registry ready for playground UI tool selector and dynamic form generation
- Bridge ready for /api/mcp/[tool] route to invoke any of 25 tools
- Wave 0 test stubs still passing (no regressions)

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 03-mcp-playground*
*Completed: 2026-03-20*
