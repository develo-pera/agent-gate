---
phase: 7
slug: sprite-animation-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + React Testing Library 16.3.2 |
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
| 07-01-01 | 01 | 0 | SPRITE-01 | unit | `cd packages/app && npx vitest run src/__tests__/sprite-utils.test.ts -x` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 0 | SPRITE-02 | unit | `cd packages/app && npx vitest run src/__tests__/agent-sprite.test.tsx -x` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 0 | SPRITE-03 | unit | `cd packages/app && npx vitest run src/__tests__/sprite-scene.test.tsx -x` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 0 | SPRITE-04 | unit | `cd packages/app && npx vitest run src/__tests__/agent-sprite.test.tsx -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/sprite-utils.test.ts` — stubs for SPRITE-01 (color derivation, address hashing)
- [ ] `src/__tests__/agent-sprite.test.tsx` — stubs for SPRITE-02, SPRITE-04 (animation class, hover card)
- [ ] `src/__tests__/sprite-scene.test.tsx` — stubs for SPRITE-03 (scene layout, sprite positioning)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSS steps() animation plays correct frame sequence | SPRITE-02 | jsdom cannot render CSS animations | Open browser, verify sprite frames advance smoothly at ~4fps |
| Pixel art renders without anti-aliasing blur | SPRITE-03 | Visual rendering quality requires real browser | Inspect sprite edges at 3x scale — should be crisp pixel boundaries |
| Sprite movement is smooth CSS transition | SPRITE-03 | CSS transition visual quality | Watch sprites walk between random destinations without teleporting |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
