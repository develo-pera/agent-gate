---
phase: 01-foundation
plan: 01
subsystem: ui, api
tags: [nextjs, tailwind-v4, shadcn, viem, mcp-bridge, dark-theme]

# Dependency graph
requires:
  - phase: 01-foundation/01-00
    provides: "Wave 0 scaffold with Vitest, Next.js app skeleton, shadcn components"
provides:
  - "Next.js app package (@agentgate/app) with dark crypto theme"
  - "shadcn UI components (button, avatar, badge, tooltip, separator, skeleton)"
  - "MCP tool bridge (bridge.ts) with treasury read handlers"
  - "HTTP route /api/mcp/[tool] for dashboard-to-MCP communication"
  - ".env.example with dashboard env vars"
affects: [01-02, 01-03, 02-01, 02-02, 03-01]

# Tech tracking
tech-stack:
  added: [next@16.2.0, react@19.2.4, tailwindcss@4, shadcn@4.1.0, lucide-react@0.577.0, tw-animate-css]
  patterns: [dark-theme-css-variables, mcp-bridge-subpath-export, dry-run-stubs]

key-files:
  created:
    - packages/mcp-server/src/bridge.ts
    - packages/app/src/app/api/mcp/[tool]/route.ts
    - packages/app/src/lib/constants.ts
  modified:
    - packages/app/src/app/globals.css
    - packages/app/src/app/layout.tsx
    - packages/app/src/app/page.tsx
    - packages/app/next.config.ts
    - packages/mcp-server/package.json
    - package.json
    - .env.example

key-decisions:
  - "Used @agentgate/mcp-server/bridge subpath export instead of relative path (Turbopack blocks cross-package relative imports)"
  - "Used any-typed publicClient in BridgeContext to avoid cross-package viem type conflicts"
  - "Replaced BigInt literals (0n) with BigInt(0) for ES2017 target compatibility in Next.js"

patterns-established:
  - "Dark crypto theme: all CSS variables in globals.css :root and .dark selectors with identical values (forced dark mode)"
  - "MCP bridge pattern: standalone bridge.ts with toolRegistry, imported via package subpath export"
  - "API route pattern: POST /api/mcp/[tool] with { success, data } or { success: false, error } response shape"

requirements-completed: [FOUN-01, FOUN-02, FOUN-05]

# Metrics
duration: 13min
completed: 2026-03-19
---

# Phase 01 Plan 01: App Scaffold + Dark Theme + MCP Bridge Summary

**Next.js 16 app with Tailwind v4 dark crypto theme (forced dark mode, UI-SPEC CSS variables) and MCP HTTP bridge at /api/mcp/[tool] serving treasury read handlers via standalone bridge.ts**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-19T22:50:30Z
- **Completed:** 2026-03-19T23:04:29Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Dark crypto theme applied with all UI-SPEC CSS variables (--background, --primary, --success, --warning, etc.)
- MCP bridge module exports 3 read-only treasury handlers + 7 dry-run write stubs without MCP SDK dependency
- HTTP route at /api/mcp/[tool] accepts POST requests and returns structured JSON responses
- Root monorepo scripts updated for app dev/build workflow

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js app with Tailwind, shadcn, and dark crypto theme** - `fbc65ad` (feat)
2. **Task 2: Build MCP tool bridge and HTTP route handler** - `d3b660f` (feat)

## Files Created/Modified
- `packages/mcp-server/src/bridge.ts` - Standalone tool bridge with BridgeContext, toolRegistry, treasury handlers
- `packages/app/src/app/api/mcp/[tool]/route.ts` - Dynamic POST route for MCP tool invocation
- `packages/app/src/app/globals.css` - Dark crypto theme CSS variables from UI-SPEC
- `packages/app/src/app/layout.tsx` - Root layout with Inter font, forced dark mode, AgentGate metadata
- `packages/app/src/app/page.tsx` - Minimal placeholder page
- `packages/app/src/lib/constants.ts` - DEMO_TREASURY_ADDRESS and APP_NAME constants
- `packages/app/next.config.ts` - transpilePackages for mcp-server
- `packages/mcp-server/package.json` - Added exports field with bridge subpath
- `package.json` - Updated dev/build scripts for app workspace
- `.env.example` - Added NEXT_PUBLIC_WC_PROJECT_ID and NEXT_PUBLIC_DEMO_TREASURY_ADDRESS

## Decisions Made
- Used `@agentgate/mcp-server/bridge` subpath export instead of relative path because Turbopack blocks cross-package directory traversal (relative imports outside packages/app/ fail with "Module not found")
- Used `any` type for publicClient/l1PublicClient in BridgeContext to avoid incompatible viem types across monorepo packages (mcp-server has viem ^2.23, app gets different resolved version)
- Replaced BigInt literals (`0n`) with `BigInt(0)` since bridge.ts is transpiled through Next.js which targets ES2017

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Turbopack blocks relative imports outside package root**
- **Found during:** Task 2 (bridge route handler)
- **Issue:** The plan specified `../../../../../../packages/mcp-server/src/bridge.js` relative import, but Turbopack refuses to resolve modules outside the app package directory
- **Fix:** Added `exports` field to mcp-server package.json with `"./bridge"` subpath pointing to `src/bridge.ts`, used `@agentgate/mcp-server/bridge` import in the route handler
- **Files modified:** packages/mcp-server/package.json, packages/app/src/app/api/mcp/[tool]/route.ts
- **Verification:** npm run build succeeds
- **Committed in:** d3b660f

**2. [Rule 3 - Blocking] Cross-package viem type incompatibility**
- **Found during:** Task 2 (bridge build)
- **Issue:** PublicClient type from mcp-server's viem (Base chain has "deposit" tx type) was incompatible with app's viem resolution, causing TypeScript error
- **Fix:** Changed BridgeContext interface to use `any` type for publicClient fields
- **Files modified:** packages/mcp-server/src/bridge.ts
- **Verification:** TypeScript check passes
- **Committed in:** d3b660f

**3. [Rule 3 - Blocking] BigInt literals incompatible with ES2017 target**
- **Found during:** Task 2 (bridge build)
- **Issue:** bridge.ts used `0n` BigInt literals but Next.js app tsconfig targets ES2017 which doesn't support them
- **Fix:** Replaced all `0n` with `BigInt(0)`
- **Files modified:** packages/mcp-server/src/bridge.ts
- **Verification:** TypeScript check passes
- **Committed in:** d3b660f

---

**Total deviations:** 3 auto-fixed (3 blocking issues)
**Impact on plan:** All fixes necessary for build to succeed. No scope creep. Bridge functionality unchanged.

## Issues Encountered
- Wave 0 (01-00) had already committed the full Next.js scaffold, dark theme, shadcn components, layout, and constants. Task 1 only needed to add env vars to .env.example and update root package.json scripts. This is not a problem -- it means wave 0 was thorough.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- App builds and runs with `npm run dev`
- Dark crypto theme active with all CSS variables from UI-SPEC
- MCP bridge ready for dashboard pages to call treasury tools
- shadcn components installed for sidebar and UI work in Plan 02
- RainbowKit + wagmi integration ready for Plan 02 (providers)

---
*Phase: 01-foundation*
*Completed: 2026-03-19*
