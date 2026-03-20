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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~8 | 4 | First milestone — established patterns |

### Cumulative Quality

| Milestone | Tests | Coverage | Tech Debt Items |
|-----------|-------|----------|-----------------|
| v1.0 | Stubs only | — | 6 (non-blocking) |

### Top Lessons (Verified Across Milestones)

1. Verify requirements as phases complete — retroactive verification is a full extra phase
2. Clean dead code immediately when scaffolding is replaced
