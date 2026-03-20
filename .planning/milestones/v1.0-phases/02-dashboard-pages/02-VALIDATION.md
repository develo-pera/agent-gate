---
phase: 2
slug: dashboard-pages
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 + @testing-library/react 16.3.2 |
| **Config file** | `packages/app/vitest.config.ts` |
| **Quick run command** | `cd packages/app && npm test` |
| **Full suite command** | `cd packages/app && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/app && npm test`
- **After every plan wave:** Run `cd packages/app && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | TREA-01 | unit | `cd packages/app && npx vitest run src/__tests__/treasury-page.test.tsx -t "vault status"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | TREA-02 | unit | `cd packages/app && npx vitest run src/__tests__/donut-chart.test.tsx` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | TREA-03 | unit | `cd packages/app && npx vitest run src/__tests__/treasury-forms.test.tsx -t "deposit"` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | TREA-04 | unit | `cd packages/app && npx vitest run src/__tests__/treasury-forms.test.tsx -t "withdraw"` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | TREA-05 | unit | `cd packages/app && npx vitest run src/__tests__/treasury-page.test.tsx -t "oracle rate"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | STAK-01 | unit | `cd packages/app && npx vitest run src/__tests__/staking-page.test.tsx -t "apr"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | STAK-02 | unit | `cd packages/app && npx vitest run src/__tests__/staking-page.test.tsx -t "position"` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | STAK-03 | unit | `cd packages/app && npx vitest run src/__tests__/staking-page.test.tsx -t "health"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | DELG-01 | unit | `cd packages/app && npx vitest run src/__tests__/delegations-page.test.tsx -t "list"` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | DELG-02 | unit | `cd packages/app && npx vitest run src/__tests__/delegation-forms.test.tsx -t "create"` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 1 | DELG-03 | unit | `cd packages/app && npx vitest run src/__tests__/delegation-forms.test.tsx -t "redeem"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/treasury-page.test.tsx` — stubs for TREA-01, TREA-05
- [ ] `src/__tests__/donut-chart.test.tsx` — stubs for TREA-02
- [ ] `src/__tests__/treasury-forms.test.tsx` — stubs for TREA-03, TREA-04
- [ ] `src/__tests__/staking-page.test.tsx` — stubs for STAK-01, STAK-02, STAK-03
- [ ] `src/__tests__/delegations-page.test.tsx` — stubs for DELG-01
- [ ] `src/__tests__/delegation-forms.test.tsx` — stubs for DELG-02, DELG-03
- [ ] Test mocks for wagmi hooks (`useReadContract`) and fetch (MCP bridge)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glassmorphism card visual styling | UI-SPEC | CSS visual quality not unit-testable | Inspect cards in browser, verify backdrop-blur and border effects |
| Donut chart proportions visually correct | TREA-02 | SVG rendering proportions require visual check | Compare rendered chart against expected principal/yield split |
| Responsive layout at mobile breakpoint | UI-SPEC | Layout breakpoints need viewport testing | Resize to 640px, verify stacked layout |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
