---
phase: 07-sprite-animation-system
verified: 2026-03-22T13:38:00Z
status: gaps_found
score: 7/8 must-haves verified
re_verification: false
gaps:
  - truth: "AgentSprite renders with correct CSS animation class for each status (idle, walk, work)"
    status: partial
    reason: "Test suite reports 1 failure in agent-sprite.test.tsx. The `queryByText('TestBot')` call throws TestingLibraryElementError because the implementation added an always-visible name label (data-testid='sprite-label') below the sprite that was NOT in the original plan. This creates two DOM nodes with 'TestBot' text when the hover card is open — the always-visible label and the hover card. The test uses `queryByText` (single-match) which throws on multiple matches."
    artifacts:
      - path: "packages/app/src/components/sprites/AgentSprite.tsx"
        issue: "Added always-visible sprite-label div (lines 74-82) not specified in plan. This breaks the test at agent-sprite.test.tsx:45 because queryByText('TestBot') finds two elements when hover card is shown."
      - path: "packages/app/src/__tests__/agent-sprite.test.tsx"
        issue: "Test 'shows hover card with agent name on mouseenter' uses queryByText (single-match) but now two elements contain 'TestBot'. Test was written for a component without always-visible label."
    missing:
      - "Fix agent-sprite.test.tsx line 45 to use queryAllByText('TestBot') and assert length > 0, OR remove the always-visible sprite-label from AgentSprite.tsx if it is out of scope for Phase 7"
human_verification:
  - test: "Visual sprite animation rendering"
    expected: "Pixel-art robot sprites appear with correct body colors per agent address, CSS steps(4) frame animation cycles through idle/walk/work rows, sprites are crisp (no anti-aliasing blur)"
    why_human: "CSS animation playback and visual rendering cannot be verified programmatically — requires a browser"
  - test: "Random wandering behavior"
    expected: "Idle sprites walk to a random destination, pause 2-5 seconds, then walk to another. Active sprites stay stationary with work animation. Registered sprites stay stationary with idle animation."
    why_human: "Uses chained setTimeout with random delays — cannot be verified without time-advancing in a real browser session"
  - test: "Direction flip while walking"
    expected: "Sprite image flips horizontally (scaleX(-1)) when moving left, faces right (scaleX(1)) when moving right"
    why_human: "Requires observing live CSS transform transitions in a browser"
  - test: "Hover pause behavior"
    expected: "Hovering over a wandering sprite pauses movement. Mouse leave resumes wandering."
    why_human: "Mouse interaction with animation timing requires manual browser testing"
---

# Phase 7: Sprite Animation System Verification Report

**Phase Goal:** Build sprite animation system with address-derived coloring, walking/idle/work animations, and scene container
**Verified:** 2026-03-22T13:38:00Z
**Status:** gaps_found (1 test failure, 4 items requiring human visual verification)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Different agent addresses produce visually distinct sprite colors | VERIFIED | `addressToSpriteColor` hashes first byte pair mod 8 into 8 distinct HSL hues; 14 tests pass confirming values for 0x00, 0xAB, 0xFF prefixes |
| 2 | AgentSprite renders with correct CSS animation class for each status (idle, walk, work) | PARTIAL | 9/10 AgentSprite tests pass; test "shows hover card with agent name on mouseenter" fails because always-visible sprite-label creates a second "TestBot" node, breaking `queryByText` |
| 3 | Hovering a sprite shows a detail card with agent name, truncated address, status dot, and action text | VERIFIED | `data-testid="hover-card"` present, `shortenAddress` imported, status dot with `data-testid="status-dot"`, actionText rendered — 8 tests directly cover hover behavior |
| 4 | Sprite frames advance via CSS steps(4) only — no JS timers or React state for frame index | VERIFIED | `sprite.css` defines `.anim-idle/.anim-walk/.anim-work` with `steps(4)` — zero JS timers for frame advancement. Frame position is CSS-only. |
| 5 | Agent sprites walk freely across a scene area via random wandering | VERIFIED | `useWander` hook with chained `setTimeout` picks random x/y within scene bounds; 7 SpriteScene tests pass |
| 6 | Sprites face their walking direction (scaleX flip) | VERIFIED | `WanderingSprite` passes `facingLeft={pos.facingLeft}` to `AgentSprite`; `AgentSprite` applies `transform: scaleX(-1)` on `.sprite-viewport` when `facingLeft=true` |
| 7 | Scene is a full-width banner approximately 250px tall | VERIFIED | `SCENE_HEIGHT = 250`, `style={{ minHeight: SCENE_HEIGHT }}` on scene container; test asserts `scene.style.minHeight === "250px"` |
| 8 | Empty state shows message when no agents are provided | VERIFIED | `agents.length === 0` branch renders "No agents registered"; SpriteScene test confirms |

**Score:** 7/8 truths verified (1 partial due to test failure)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/app/src/lib/sprite-utils.ts` | Address-to-color hashing, status-to-animation mapping, action text derivation | VERIFIED | 24 lines, exports all 4 required functions: `addressToSpriteColor`, `statusToAnimation`, `statusToColor`, `statusToActionText` with `HUES` array |
| `packages/app/src/components/sprites/robot-svg.tsx` | Inline SVG robot sprite strip (4 frames x 3 rows) | VERIFIED | 124 lines, `viewBox="0 0 128 96"`, `shapeRendering="crispEdges"`, CSS vars `--sprite-body`/`--sprite-visor`, 12 frames across idle/walk/work rows |
| `packages/app/src/components/sprites/sprite.css` | CSS keyframes for sprite-idle, sprite-walk, sprite-work with steps(4) | VERIFIED | 32 lines, all 3 `@keyframes` present, `.anim-idle/.anim-walk/.anim-work` with `steps(4)`, `.sprite-viewport` with `image-rendering: pixelated` |
| `packages/app/src/components/sprites/AgentSprite.tsx` | Single sprite component with animation and hover card | PARTIAL | 109 lines, substantive implementation, but has unplanned always-visible `sprite-label` causing test failure |
| `packages/app/src/components/sprites/SpriteScene.tsx` | Scene container with random wandering logic for multiple sprites | VERIFIED | 195 lines, `useWander` hook, `WanderingSprite`, `ResizeObserver`, `data-testid="sprite-scene"`, no `overflow: hidden` on scene container |
| `packages/app/src/__tests__/sprite-utils.test.ts` | 14 tests for sprite-utils functions | VERIFIED | 82 lines, 14 tests, all pass |
| `packages/app/src/__tests__/agent-sprite.test.tsx` | 10 tests for AgentSprite rendering and hover behavior | PARTIAL | 74 lines, 10 tests, 9 pass, 1 fails: "shows hover card with agent name on mouseenter" |
| `packages/app/src/__tests__/sprite-scene.test.tsx` | 7 tests for SpriteScene rendering and positioning | VERIFIED | 69 lines, 7 tests, all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AgentSprite.tsx` | `robot-svg.tsx` | `import { RobotSvg } from "./robot-svg"` | WIRED | Line 4 — imports and renders `<RobotSvg className=...>` |
| `AgentSprite.tsx` | `sprite-utils.ts` | `import { addressToSpriteColor, ... } from "@/lib/sprite-utils"` | WIRED | Lines 5-10 — imports all 4 utility functions and uses them in render |
| `AgentSprite.tsx` | `sprite.css` | `import "./sprite.css"` | WIRED | Line 12 — CSS imported, animation classes applied to sprite strip |
| `SpriteScene.tsx` | `AgentSprite.tsx` | `import { AgentSprite } from "./AgentSprite"` | WIRED | Line 4 — imports and renders `<AgentSprite>` per agent in `WanderingSprite` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SPRITE-01 | 07-01 | Pixel-art sprite sheet with at least 2 unique agent character skins | SATISFIED | `addressToSpriteColor` produces 8 distinct hue slots via first-byte hash; `--sprite-body` CSS var applies per-agent color; every agent gets visually distinct color |
| SPRITE-02 | 07-01 | CSS `steps()` sprite animation with idle, walking, and working states per agent | SATISFIED | `sprite.css` defines 3 keyframe animations with `steps(4)` for idle/walk/work rows; `statusToAnimation` maps status to correct class; `isWalking` prop overrides to `anim-walk` during movement |
| SPRITE-03 | 07-02 | Agent sprites walk freely on a scene area on the dashboard page | PARTIALLY SATISFIED | Walking logic fully implemented in `SpriteScene`/`useWander`; scene NOT yet integrated into any dashboard page (deferred to Phase 8 — expected behavior per phase scope) |
| SPRITE-04 | 07-01 | Hovering a sprite reveals agent details card (name, address, current action, status) | SATISFIED | `data-testid="hover-card"` renders on hover with name (16px/600), truncated address (12px/400 mono), status dot (colored), action text (14px/400) |

Note: SPRITE-03 states "on the dashboard page" — integration into the dashboard page is planned for Phase 8. The wandering behavior itself is complete and tested; the dashboard wire-up is out of Phase 7 scope.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `AgentSprite.tsx` | 74-82 | Unplanned always-visible name label (`sprite-label`) added beyond plan spec | Warning | Causes 1 test failure in agent-sprite.test.tsx — `queryByText` finds 2 nodes on hover |

No `return null`, empty implementations, or TODO/FIXME placeholders found in any sprite file.

### Human Verification Required

#### 1. Visual sprite animation rendering

**Test:** Run dev server, navigate to a page with `<SpriteScene>`, observe robot sprite rendering
**Expected:** Pixel-art robots appear as crisp boxy characters with colored bodies; idle animation cycles 4 frames with antenna bob; walk animation shows alternating leg motion; work animation shows arm movement with spark pixels
**Why human:** CSS `steps(4)` animation playback and `image-rendering: pixelated` crispness require a browser

#### 2. Random wandering behavior

**Test:** Render 3 idle agents in SpriteScene; observe over ~10 seconds
**Expected:** Each idle sprite walks to a random position, pauses 2-5 seconds, then walks again; sprites with `status="active"` stay put with work animation; sprites with `status="registered"` stay put with idle animation
**Why human:** Requires real-time observation — vitest uses fake timers and jsdom does not render CSS transitions

#### 3. Direction flip while walking

**Test:** Watch a sprite walk left vs. right
**Expected:** Sprite visually faces left when moving left (scaleX(-1) on viewport), faces right when moving right
**Why human:** CSS transform on walking direction requires browser rendering to verify

#### 4. Hover pause and resume

**Test:** Hover over a wandering sprite, then move mouse away
**Expected:** Sprite freezes in place on hover; detail card appears above sprite; on mouse leave, card disappears and sprite resumes wandering after a pause
**Why human:** Real mouse events with animation timing require manual browser session

### Gaps Summary

**1 gap** blocking full test suite pass:

The `AgentSprite` implementation added an always-visible name label below the sprite (`data-testid="sprite-label"`, lines 74-82) that was NOT specified in the plan. This is a visible enhancement but breaks the existing test at `agent-sprite.test.tsx:45`: when the hover card is shown, both the label and the card contain "TestBot", causing `queryByText("TestBot")` to throw `TestingLibraryElementError: Found multiple elements`. The fix is one of:

- Update `agent-sprite.test.tsx` line 45 to use `queryAllByText("TestBot")` and assert `length >= 1`, which acknowledges the always-visible label as intentional
- Or remove the always-visible label from `AgentSprite.tsx` if it is considered out of scope for Phase 7

The sprite-utils and SpriteScene test suites are fully green (21/21 tests pass). All artifacts are substantive and correctly wired. All key links are present. The implementation quality is high — the gap is purely a test/implementation synchronization issue introduced by the unplanned label.

---

_Verified: 2026-03-22T13:38:00Z_
_Verifier: Claude (gsd-verifier)_
