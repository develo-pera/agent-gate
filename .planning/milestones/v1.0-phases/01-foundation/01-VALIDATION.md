---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Next.js + TypeScript) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `cd packages/app && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/app && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/app && npm run build`
- **After every plan wave:** Run `cd packages/app && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | FOUN-01 | smoke | `cd packages/app && npm run build` | n/a (build) | ⬜ pending |
| 01-01-02 | 01 | 1 | FOUN-02 | unit | `npx vitest run src/__tests__/theme.test.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | FOUN-06 | unit | `npx vitest run src/__tests__/sidebar.test.tsx` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | FOUN-03 | unit | `npx vitest run src/__tests__/providers.test.tsx` | ❌ W0 | ⬜ pending |
| 01-02-03 | 02 | 2 | FOUN-04 | unit | `npx vitest run src/__tests__/demo-mode.test.tsx` | ❌ W0 | ⬜ pending |
| 01-02-04 | 02 | 2 | FOUN-05 | integration | `npx vitest run src/__tests__/api-bridge.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/app/vitest.config.ts` — Vitest configuration with jsdom environment
- [ ] `packages/app/src/__tests__/theme.test.ts` — CSS variable validation
- [ ] `packages/app/src/__tests__/providers.test.tsx` — Provider tree renders
- [ ] `packages/app/src/__tests__/demo-mode.test.tsx` — Demo mode context logic
- [ ] `packages/app/src/__tests__/api-bridge.test.ts` — Bridge route handler tests
- [ ] `packages/app/src/__tests__/sidebar.test.tsx` — Sidebar navigation rendering
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Glassmorphism visual effect | FOUN-02 | Visual rendering quality | Inspect cards for blur backdrop, border glow, semi-transparency |
| Dark theme aesthetic | FOUN-02 | Subjective design match | Compare rendered UI against UI-SPEC mockups |
| RainbowKit modal UX | FOUN-03 | Wallet interaction flow | Click Connect, verify MetaMask prompt, verify address display |
| Demo banner visibility | FOUN-04 | Visual layout | Verify top banner shows "Demo Mode" text with connect button |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
