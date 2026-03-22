---
phase: 6
slug: api-and-real-time-endpoints
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 |
| **Config file** | `packages/app/vitest.config.ts` |
| **Quick run command** | `cd packages/app && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/app && npx vitest run --reporter=verbose && cd ../mcp-server && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/app && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/app && npx vitest run --reporter=verbose && cd ../mcp-server && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | INFRA-04 | unit | `cd packages/app && npx vitest run src/app/api/activity/sse/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | INFRA-05 | unit | `cd packages/app && npx vitest run src/app/api/agents/route.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-03 | 01 | 1 | INFRA-06 | unit | `cd packages/app && npx vitest run src/app/api/activity/route.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/app/src/app/api/activity/route.test.ts` — stubs for INFRA-06 (GET /api/activity)
- [ ] `packages/app/src/app/api/activity/sse/route.test.ts` — stubs for INFRA-04 (SSE streaming)
- [ ] `packages/app/src/app/api/agents/route.test.ts` — stubs for INFRA-05 (GET /api/agents with status)

*Existing vitest infrastructure covers framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SSE client disconnect cleanup | INFRA-04 | Requires browser/network disconnect simulation | Open SSE in browser, close tab, check server logs for no memory leak warnings |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
