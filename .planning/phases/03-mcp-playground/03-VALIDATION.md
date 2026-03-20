---
phase: 3
slug: mcp-playground
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + @testing-library/react + jsdom |
| **Config file** | packages/app/vitest.config.ts |
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
| 03-01-01 | 01 | 1 | PLAY-01 | unit | `cd packages/app && npx vitest run src/__tests__/playground-selector.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PLAY-02 | unit | `cd packages/app && npx vitest run src/__tests__/playground-form.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | PLAY-03 | unit | `cd packages/app && npx vitest run src/__tests__/playground-json.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | PLAY-04 | unit | `cd packages/app && npx vitest run src/__tests__/playground-dryrun.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/playground-selector.test.tsx` — stubs for PLAY-01 (tool listing and filtering)
- [ ] `src/__tests__/playground-form.test.tsx` — stubs for PLAY-02 (dynamic form generation)
- [ ] `src/__tests__/playground-json.test.tsx` — stubs for PLAY-03 (JSON viewer rendering)
- [ ] `src/__tests__/playground-dryrun.test.tsx` — stubs for PLAY-04 (dry-run toggle behavior)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Human/Agent view toggle visual correctness | PLAY-01 | Visual rendering differences between views | Toggle between agent/human view, verify label changes and formatting |
| VS Code dark theme color accuracy | PLAY-03 | Color matching is subjective | Compare JSON highlighting colors against VS Code dark theme reference |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
