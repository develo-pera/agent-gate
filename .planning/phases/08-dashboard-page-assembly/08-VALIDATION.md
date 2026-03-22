---
phase: 8
slug: dashboard-page-assembly
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 + @testing-library/react 16.3.2 |
| **Config file** | `packages/app/vitest.config.ts` |
| **Quick run command** | `cd packages/app && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/app && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/app && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/app && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | DASH-01 | unit | `cd packages/app && npx vitest run src/__tests__/live-agents-page.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | DASH-02 | unit | `cd packages/app && npx vitest run src/__tests__/agent-card.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | DASH-03 | unit | `cd packages/app && npx vitest run src/__tests__/activity-feed.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | DASH-04 | unit | `cd packages/app && npx vitest run src/__tests__/use-activity-sse.test.ts -x` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 2 | DASH-05 | unit | `cd packages/app && npx vitest run src/__tests__/agent-card.test.tsx -x` | ❌ W0 | ⬜ pending |
| 08-02-03 | 02 | 2 | DEMO-01 | unit | `cd packages/app && npx vitest run src/__tests__/demo-mode-drip.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/live-agents-page.test.tsx` — stubs for DASH-01 (sidebar nav + page renders)
- [ ] `src/__tests__/agent-card.test.tsx` — stubs for DASH-02, DASH-05 (card rendering + status updates)
- [ ] `src/__tests__/activity-feed.test.tsx` — stubs for DASH-03 (timeline rows)
- [ ] `src/__tests__/use-activity-sse.test.ts` — stubs for DASH-04 (SSE hook)
- [ ] `src/__tests__/demo-mode-drip.test.tsx` — stubs for DEMO-01 (demo drip)

*Existing infrastructure covers test framework — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSS pulse animation on status dot | DASH-02 | Visual animation timing | Inspect agent card dot — green dot should pulse when status is "active" |
| Auto-scroll pause on user scroll | DASH-03 | Scroll position interaction | Scroll down in feed, trigger new events — "N new events" badge should appear |
| Smooth expand/collapse animation | DASH-03 | CSS transition timing | Click activity row — detail panel should animate open smoothly |
| Sprite scene animation | DASH-01 | Canvas/CSS animation | Sprite banner should show animated agents matching registered agents |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
