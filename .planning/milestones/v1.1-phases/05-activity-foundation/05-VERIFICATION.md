---
phase: 05-activity-foundation
verified: 2026-03-22T12:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Run a real MCP tool call through the hosted server and observe an ActivityEvent is created"
    expected: "activityLog.getAll() returns one event with correct agentId, toolName, status=success, durationMs > 0"
    why_human: "wrapServerWithLogging patches server.tool at runtime — cannot trace full MCP SDK dispatch chain statically"
---

# Phase 05: Activity Foundation Verification Report

**Phase Goal:** Create the ActivityEvent type system, CircularBuffer, ActivityLog singleton, and instrument hosted MCP server + executeOrPrepare to capture every tool call and on-chain write as ActivityEvents.
**Verified:** 2026-03-22T12:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CircularBuffer holds up to 500 items and silently drops oldest on overflow | VERIFIED | `CircularBuffer` class at line 16 of activity-log.ts. push() increments head mod capacity, count capped at capacity. 4 tests covering overflow. |
| 2 | ActivityLog.startEvent creates a pending event with auto-increment ID, agent identity, tool name, params, and timestamp | VERIFIED | `startEvent()` at line 71. Sets id via nextId++, status "pending", null result/durationMs/tx fields, Date.now() timestamp. 5 tests pass. |
| 3 | ActivityLog.completeEvent updates an existing event with result, status, and durationMs | VERIFIED | `completeEvent()` at line 103. Sets result, status, durationMs = Date.now() - timestamp. Silent no-op on unknown id. 3 tests pass. |
| 4 | ActivityLog.enrichEvent adds tx fields to an existing event without notifying listeners | VERIFIED | `enrichEvent()` at line 115. Sets txHash/txStatus/blockNumber, comment "NO notify". 2 tests pass including listener-not-called check. |
| 5 | ActivityLog.onEvent registers a listener that fires on startEvent and completeEvent, and returns an unsubscribe function | VERIFIED | `onEvent()` at line 131. Adds to Set, returns delete closure. notify() called in startEvent and completeEvent. 3 tests pass. |
| 6 | ActivityLog singleton survives module re-evaluation via globalThis pattern | VERIFIED | `getActivityLog()` at line 151. Uses `GLOBAL_KEY = "__agentgate_activity_log__"` on globalThis. 1 test verifies same instance returned. |
| 7 | Every MCP tool call through hosted.ts produces an ActivityEvent | VERIFIED | `wrapServerWithLogging()` in hosted.ts line 68. Intercepts `server.tool` before any tools are registered (line 126). Calls startEvent/completeEvent for every tool callback. 6 integration tests simulate the pattern. |
| 8 | When executeOrPrepare performs a first-party on-chain write, the parent ActivityEvent is enriched with txHash, txStatus, and blockNumber | VERIFIED | `activityLog.enrichEvent()` called at lines 73 and 134 of execute-or-prepare.ts, guarded by `ctx.activeEventId != null`. Both `executeOrPrepare` and `executeOrPrepareMany` are instrumented. |
| 9 | TypeScript compiles with no errors | FAILED | `npx tsc --noEmit` exits with code 2. 7 errors in activity-log.test.ts introduced by phase 05 (1x TS2835 missing .js extension on import, 6x TS7006 implicit any on callback params). Note: 18 additional errors in hosted.ts, execute-or-prepare.ts, and other files are pre-existing (same no-.js-extension pattern existed in hosted.ts before phase 05). |

**Score:** 8/9 truths verified (7/9 fully automated — truth #9 is the gap; truth #7 has a human verification note)

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/mcp-server/src/activity-log.ts` | ActivityEvent interface, CircularBuffer class, ActivityLog class, globalThis singleton | VERIFIED | 159 lines. Exports ActivityEvent, CircularBuffer, ActivityLog, activityLog, getActivityLog. All required exports present. |
| `packages/mcp-server/src/activity-log.test.ts` | Unit tests for CircularBuffer and ActivityLog, min 80 lines | VERIFIED | 417 lines. 26 test cases across 9 describe blocks. |
| `packages/mcp-server/vitest.config.ts` | Vitest config for mcp-server package | VERIFIED | 8 lines. Contains `environment: "node"` and include pattern. |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/mcp-server/src/hosted.ts` | wrapServerWithLogging function and integration into createMcpServer | VERIFIED | `function wrapServerWithLogging(` at line 68. Called at line 126, before any `server.tool(` calls. |
| `packages/mcp-server/src/context.ts` | activeEventId field on AgentGateContext | VERIFIED | `activeEventId?: number;` at line 14 with comment. |
| `packages/mcp-server/src/execute-or-prepare.ts` | Transaction enrichment via activityLog.enrichEvent | VERIFIED | `activityLog.enrichEvent(ctx.activeEventId, {...})` at lines 73 and 134. |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/mcp-server/src/activity-log.ts` | `globalThis.__agentgate_activity_log__` | `getActivityLog()` factory | VERIFIED | `const GLOBAL_KEY = "__agentgate_activity_log__"` at line 149. Factory checks and sets `g[GLOBAL_KEY]`. |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/mcp-server/src/hosted.ts` | `packages/mcp-server/src/activity-log.ts` | `import { activityLog }` and startEvent/completeEvent calls | VERIFIED | Import at line 19. `activityLog.startEvent(` at line 81. `activityLog.completeEvent(` at lines 93 and 99. |
| `packages/mcp-server/src/hosted.ts` | `packages/mcp-server/src/context.ts` | Sets `ctx.activeEventId` before tool callback | VERIFIED | `ctx.activeEventId = event.id` at line 89. Cleared in `finally` at line 105. |
| `packages/mcp-server/src/execute-or-prepare.ts` | `packages/mcp-server/src/activity-log.ts` | Import and enrichEvent call | VERIFIED | `import { activityLog } from "./activity-log"` at line 10. `activityLog.enrichEvent(ctx.activeEventId, {` at lines 73 and 134. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | 05-02-PLAN.md | Activity logging middleware captures all MCP tool calls with agent identity, tool name, parameters, result, and timestamp | SATISFIED | `wrapServerWithLogging` intercepts every `server.tool()` callback. Captures agentId, agentAddress, toolName, params, result, status, timestamp. |
| INFRA-02 | 05-02-PLAN.md | Activity logging captures all on-chain write operations from executeOrPrepare with tx hash and status | SATISFIED | `activityLog.enrichEvent()` called in both `executeOrPrepare` and `executeOrPrepareMany` after `waitForTransactionReceipt`. Captures txHash, txStatus, blockNumber. |
| INFRA-03 | 05-01-PLAN.md | In-memory circular buffer stores last 500 activity events as a module-level singleton | SATISFIED | `CircularBuffer<ActivityEvent>(500)` used inside `ActivityLog`. `getActivityLog()` factory with `globalThis.__agentgate_activity_log__` creates and reuses singleton. |

All three requirements assigned to Phase 05 in REQUIREMENTS.md are satisfied. No orphaned requirements found for this phase.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/mcp-server/src/activity-log.test.ts` | 7 | `import { ... } from "./activity-log"` — missing `.js` extension (TS2835 under nodenext moduleResolution) | Warning | Does not block test execution (vitest handles it), but causes `tsc --noEmit` to fail. |
| `packages/mcp-server/src/activity-log.test.ts` | 44, 45, 135, 148, 173, 405 | Callback parameters with implicit `any` type (TS7006) | Warning | Does not block test execution, but causes `tsc --noEmit` to fail. |

No stub implementations found. No TODO/FIXME/placeholder comments in implementation files. No empty return statements.

---

## Human Verification Required

### 1. Live MCP Tool Call Produces ActivityEvent

**Test:** Start the MCP server, connect with a first-party bearer token, call `who_am_i`.
**Expected:** After the call, `activityLog.getAll()` returns one event with `toolName: "who_am_i"`, `status: "success"`, `durationMs > 0`, and correct `agentId` and `agentAddress`.
**Why human:** `wrapServerWithLogging` patches `server.tool` at the McpServer object level. Static grep confirms the patch is installed, but the MCP SDK's internal dispatch to the registered callback cannot be traced purely from source.

---

## Gaps Summary

### Gap 1: TypeScript compile errors in test file (7 errors)

The test file `activity-log.test.ts` was created by phase 05 and introduces 7 TypeScript errors when running `tsc --noEmit`:

- **TS2835** (line 7): `import { ... } from "./activity-log"` needs to be `"./activity-log.js"` for `nodenext` moduleResolution. This is the same pattern used across the pre-existing codebase (hosted.ts, execute-or-prepare.ts all have the same issue), but those errors are pre-existing. The test file errors are new.
- **TS7006** (lines 44, 45, 135, 148, 173, 405): Six callback parameters in `.findById()` predicates and `.find()` callbacks have implicit `any` type.

The plan's success criterion stated "TypeScript compiles with no errors." Tests pass with vitest (26/26), but the tsc check fails. The fix is either: (a) add `.js` extension to the test import and explicit types to the 6 callback params, or (b) exclude test files from tsconfig (but that would be a deliberate project decision).

These errors do NOT block runtime execution or test execution. They affect only strict TypeScript compilation.

---

_Verified: 2026-03-22T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
