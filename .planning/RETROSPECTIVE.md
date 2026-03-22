# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-20
**Phases:** 4 | **Plans:** 12 | **Commits:** 110

### What Was Built
- Dark crypto dashboard with treasury vault, staking, delegation, and MCP playground pages
- HTTP bridge exposing 25 MCP tools via REST routes for frontend consumption
- Interactive MCP Playground with tool selector, dynamic parameter forms, and JSON viewer
- RainbowKit wallet connect with seamless read-only demo mode fallback

### What Worked
- Coarse 3-phase roadmap (Foundation → Dashboard Pages → MCP Playground) kept overhead minimal for a 2-day hackathon
- Phase 2 "shared infrastructure first" plan (02-01) front-loaded ABIs, hooks, and shadcn components — subsequent plans moved fast
- Wave 0 test stubs ensured test structure existed before implementation
- Demo mode via wallet connection state (no toggle) simplified UX and code
- Parallel-capable phases (2 and 3 both depended only on Phase 1) — though executed sequentially due to single developer

### What Was Inefficient
- Phase 1 VERIFICATION.md was missed, requiring Phase 4 as a retroactive gap-closure phase
- Dead code accumulated (WalletDisplay, PlaceholderPage, formatPercent) — scaffolding artifacts not cleaned up as real pages replaced them
- health-report.tsx used treasury vault data instead of staking-specific data — data source mismatch caught by audit but left as tech debt
- `@agentgate/mcp-server` dependency on implicit workspace resolution — would break outside monorepo

### Patterns Established
- MCP form pattern: amount input + dry-run switch + submit + inline DryRunResult component
- Bridge pattern: toolRegistry map with handler functions, HTTP route at `/api/mcp/[tool]`
- Form validation: touched-state pattern (errors shown after blur or submit)
- CSS group-hover for sidebar expand/collapse (no JS state)
- Custom recursive JsonNode component for JSON syntax highlighting

### Key Lessons
1. **Verify as you go:** Missing Phase 1 verification created a full gap-closure phase. Building VERIFICATION.md alongside implementation would have avoided Phase 4 entirely.
2. **Clean scaffolding artifacts immediately:** Placeholder components and unused exports should be removed as soon as real implementations replace them.
3. **Declare cross-package dependencies explicitly:** Implicit workspace resolution works in development but creates hidden coupling.
4. **Coarse granularity works for speed:** 3 phases for a 2-day hackathon was the right call — more phases would have been pure overhead.

### Cost Observations
- Model mix: ~80% opus, ~20% sonnet (research/exploration)
- Sessions: ~8 across 2 days
- Notable: Plans averaged ~5 minutes each — fast execution due to well-scoped coarse phases

---

## Milestone: v1.1 — Live Agent Activity Dashboard

**Shipped:** 2026-03-22
**Phases:** 4 | **Plans:** 8 | **Commits:** 75

### What Was Built
- Activity logging infrastructure — CircularBuffer + ActivityLog singleton capturing all MCP tool calls
- MCP server instrumentation — wrapServerWithLogging with full agent identity flow
- REST + SSE API — agent registry, activity history, real-time event streaming
- Pixel-art sprite animation — inline SVG robots with CSS steps(), wandering scene
- Live Agents dashboard — command-center with agent cards, activity feed, real-time SSE
- Demo mode — 12 seed events dripping a coherent DeFi workflow story

### What Worked
- Zero new npm dependencies — reused existing stack entirely, faster builds
- Inline SVG sprites (no external assets) — deterministic from address, no file management
- CSS-only animation via steps() — no JS timers, no React re-renders for frame advancement
- globalThis singleton pattern for ActivityLog — survives Next.js HMR
- Plans averaged ~4 min each (down from ~30 min in v1.0) — well-understood codebase by now
- SSE with heartbeat + Last-Event-ID reconnection — robust real-time without WebSocket complexity

### What Was Inefficient
- Sprite rendering required multiple fix commits (flip-flop wander, name label clipping, sprite size) — visual components need more upfront specification
- ROADMAP.md plan checkboxes stayed unchecked despite summaries existing — progress table had stale data
- Phase 8 needed auto-fixes during execution (smaller sprites, taller scene, stop demo button) — demo UX details hard to specify without seeing it

### Patterns Established
- Activity middleware pattern: wrapServerWithLogging intercepts all tool callbacks at registration time
- SSE route pattern: ReadableStream with controller.enqueue(), try/catch guard, heartbeat interval
- Sprite utility pattern: addressToSpriteColor for deterministic agent visuals
- useWander hook pattern: random movement with CSS transitions (800ms ease-in-out)
- Demo mode pattern: seed events dripped at intervals with startDemo/stopDemo lifecycle

### Key Lessons
1. **Visual components need iteration:** Sprite rendering, sizing, and scene layout required multiple passes. Budget time for visual polish or specify exact pixel dimensions upfront.
2. **Keep roadmap status in sync:** Plan checkboxes should update as summaries are created, not left stale.
3. **Demo mode is worth the investment:** A coherent seed story (vault_health → deposit → stake) makes the dashboard compelling even without live agents.
4. **Zero-dependency constraint drives creativity:** Inline SVG robots and CSS-only animation emerged from the constraint and ended up being simpler than external assets.

### Cost Observations
- Model mix: ~90% opus (quality profile), ~10% sonnet (research agents)
- Sessions: ~3 across 1 day
- Notable: 8 plans in ~30 total minutes — 7.5x faster than v1.0 per-plan average

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 4 | First milestone — established patterns |
| v1.1 | ~3 | 4 | 7.5x faster per-plan — codebase familiarity + zero-dep constraint |

### Cumulative Quality

| Milestone | Tests | Coverage | Tech Debt Items |
|-----------|-------|----------|-----------------|
| v1.0 | Stubs only | — | 6 (non-blocking) |
| v1.1 | Unit tests for ActivityLog/Buffer | Partial | 6 (carried from v1.0) |

### Top Lessons (Verified Across Milestones)

1. Verify requirements as phases complete — retroactive verification is a full extra phase
2. Clean dead code immediately when scaffolding is replaced
3. Visual components need iteration budget — both v1.0 (theme polish) and v1.1 (sprite fixes) required post-plan adjustments
4. Constraints drive better design — demo mode (v1.0) and zero-dep sprites (v1.1) both produced simpler, more creative solutions
