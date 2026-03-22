---
phase: 5
slug: activity-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `packages/mcp-server/vitest.config.ts`) |
| **Config file** | `packages/mcp-server/vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `cd packages/mcp-server && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/mcp-server && npx vitest run --reporter=verbose && cd ../app && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/mcp-server && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/mcp-server && npx vitest run --reporter=verbose && cd ../app && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | INFRA-01, INFRA-02, INFRA-03 | setup | `cd packages/mcp-server && npx vitest run` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | INFRA-03 | unit | `cd packages/mcp-server && npx vitest run src/activity-log.test.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 1 | INFRA-01 | unit | `cd packages/mcp-server && npx vitest run src/activity-log.test.ts` | ❌ W0 | ⬜ pending |
| 05-04-01 | 04 | 2 | INFRA-02 | unit | `cd packages/mcp-server && npx vitest run src/activity-log.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/mcp-server/vitest.config.ts` — vitest config for mcp-server package
- [ ] `packages/mcp-server/src/activity-log.test.ts` — unit test stubs for CircularBuffer, ActivityLog, event lifecycle
- [ ] Framework install: `cd packages/mcp-server && npm install -D vitest`

*Existing app package infrastructure covers frontend tests; mcp-server needs its own test setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Activity data survives across multiple HTTP requests | INFRA-03 | Requires running server with multiple sequential requests | 1. Start server, 2. Make 2+ MCP tool calls via HTTP, 3. Query activity buffer, 4. Verify both events present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
