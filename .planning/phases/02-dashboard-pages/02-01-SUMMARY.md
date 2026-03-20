---
phase: 02-dashboard-pages
plan: 01
subsystem: ui
tags: [shadcn, wagmi, react-hooks, viem, treasury-abi, lido, delegation, donut-chart]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: app shell, sidebar, providers, MCP bridge, wagmi config
provides:
  - 9 shadcn UI components (card, input, label, switch, dialog, sheet, table, tabs, select)
  - Contract ABIs (treasury, lido) and addresses for wagmi reads
  - Format utilities (formatWsteth, formatRate, formatUsd, formatPercent, shortenAddress)
  - Custom hooks (useVaultStatus, useOracleRate, useLidoApr, useWstethBalance, useDelegations, useMcpAction)
  - 6 shared UI components (StatCard, AddressDisplay, DryRunResult, HealthScore, ErrorCard, DonutChart)
  - Lido APR API route at /api/lido/apr
  - Delegation tool stubs in bridge registry
  - Wave 0 test stubs for all Phase 2 pages
affects: [02-02, 02-03, 02-04]

# Tech tracking
tech-stack:
  added: [shadcn/card, shadcn/input, shadcn/label, shadcn/switch, shadcn/dialog, shadcn/sheet, shadcn/table, shadcn/tabs, shadcn/select]
  patterns: [wagmi useReadContract hooks, useMcpAction bridge mutation pattern, SVG donut chart, demo delegation data]

key-files:
  created:
    - packages/app/src/lib/contracts/treasury-abi.ts
    - packages/app/src/lib/contracts/lido-abi.ts
    - packages/app/src/lib/contracts/addresses.ts
    - packages/app/src/lib/format.ts
    - packages/app/src/lib/hooks/use-treasury.ts
    - packages/app/src/lib/hooks/use-staking.ts
    - packages/app/src/lib/hooks/use-delegations.ts
    - packages/app/src/lib/hooks/use-mcp-action.ts
    - packages/app/src/components/shared/stat-card.tsx
    - packages/app/src/components/shared/address-display.tsx
    - packages/app/src/components/shared/dry-run-result.tsx
    - packages/app/src/components/shared/health-score.tsx
    - packages/app/src/components/shared/error-card.tsx
    - packages/app/src/components/shared/donut-chart.tsx
    - packages/app/src/app/api/lido/apr/route.ts
  modified:
    - packages/mcp-server/src/bridge.ts

key-decisions:
  - "Used @tanstack/react-query for Lido APR fetching (already in deps via wagmi)"
  - "Demo delegations stored as constants in use-delegations hook rather than fetching from bridge"
  - "useMcpAction returns result data directly from execute() for caller convenience"

patterns-established:
  - "wagmi hook pattern: useReadContract with ABI from lib/contracts/ and address from lib/contracts/addresses.ts"
  - "MCP bridge pattern: useMcpAction(toolName) -> execute(params, dryRun) for all bridge mutations"
  - "SVG chart pattern: pure SVG donut using stroke-dasharray/stroke-dashoffset on circle elements"
  - "Shared component pattern: components/shared/ for cross-page reusable UI"

requirements-completed: [TREA-01, TREA-02, TREA-05, STAK-01, STAK-02, STAK-03, DELG-01, DELG-02, DELG-03]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 02 Plan 01: Shared Infrastructure Summary

**Shadcn components, contract ABIs, wagmi hooks, shared UI components, bridge delegation stubs, and Wave 0 test stubs for all Phase 2 pages**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T12:05:13Z
- **Completed:** 2026-03-20T12:09:11Z
- **Tasks:** 2
- **Files modified:** 31

## Accomplishments
- Installed 9 shadcn UI components providing form and layout primitives for all dashboard pages
- Created contract ABI, address, and format utility modules for type-safe on-chain reads
- Built 4 custom hooks (treasury, staking, delegations, MCP action) establishing reusable data access patterns
- Created 6 shared UI components (StatCard, AddressDisplay, DryRunResult, HealthScore, ErrorCard, DonutChart)
- Added 4 delegation tool stubs to bridge registry
- Scaffolded 6 test stub files covering all 11 Phase 2 requirement IDs

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn components, create contract ABIs, hooks, and bridge stubs** - `2bb3bba` (feat)
2. **Task 2: Create shared UI components and Wave 0 test stubs** - `9867e06` (feat)

## Files Created/Modified
- `packages/app/src/components/ui/{card,input,label,switch,dialog,sheet,table,tabs,select}.tsx` - Shadcn UI primitives
- `packages/app/src/lib/contracts/treasury-abi.ts` - Treasury ABI for wagmi reads
- `packages/app/src/lib/contracts/lido-abi.ts` - Lido wstETH/stETH ABIs
- `packages/app/src/lib/contracts/addresses.ts` - Contract addresses (Treasury, BASE_WSTETH, L1)
- `packages/app/src/lib/format.ts` - BigInt/number formatting utilities
- `packages/app/src/lib/hooks/use-treasury.ts` - useVaultStatus, useOracleRate hooks
- `packages/app/src/lib/hooks/use-staking.ts` - useLidoApr, useWstethBalance hooks
- `packages/app/src/lib/hooks/use-delegations.ts` - useDelegations with demo data, useDelegationActions
- `packages/app/src/lib/hooks/use-mcp-action.ts` - Generic MCP bridge mutation hook
- `packages/app/src/components/shared/stat-card.tsx` - Metric display with glow effect
- `packages/app/src/components/shared/address-display.tsx` - Truncated address with tooltip and copy
- `packages/app/src/components/shared/dry-run-result.tsx` - Simulation result card (pass/fail)
- `packages/app/src/components/shared/health-score.tsx` - Circular SVG gauge with thresholds
- `packages/app/src/components/shared/error-card.tsx` - Error state with retry button
- `packages/app/src/components/shared/donut-chart.tsx` - SVG donut for vault composition
- `packages/app/src/app/api/lido/apr/route.ts` - Lido APR proxy with 5min cache
- `packages/mcp-server/src/bridge.ts` - Added delegation tool stubs

## Decisions Made
- Used @tanstack/react-query for Lido APR fetching (already available via wagmi dependency)
- Demo delegations stored as constants in the hook rather than fetching from bridge (bridge has no persistent state)
- useMcpAction returns result data directly from execute() for caller convenience

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript error in DryRunResult component**
- **Found during:** Task 2 (shared components)
- **Issue:** `data.demo_note` had type `unknown` which is not assignable to `ReactNode` in JSX
- **Fix:** Changed to `"demo_note" in data && data.demo_note != null` guard before rendering
- **Files modified:** packages/app/src/components/shared/dry-run-result.tsx
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 9867e06 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type narrowing fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All shared infrastructure ready for Treasury (02-02), Staking (02-03), and Delegations (02-04) pages
- Hooks, components, and bridge stubs are importable and type-checked
- Test stubs provide scaffolding for requirement-driven tests in each page plan

## Self-Check: PASSED

All 26 files verified present. Both task commits (2bb3bba, 9867e06) confirmed in git log.

---
*Phase: 02-dashboard-pages*
*Completed: 2026-03-20*
