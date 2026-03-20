# Phase 4: Foundation Verification & Config Fix - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Close all audit gaps — retroactively verify Phase 1 requirements, fix NEXT_PUBLIC_TREASURY_ADDRESS env var so wagmi reads work, update stale doc checkboxes in REQUIREMENTS.md and ROADMAP.md, and remove dead code (useDelegationActions, getAvailableTools). No new features — purely verification, config fix, and cleanup.

</domain>

<decisions>
## Implementation Decisions

### Verification approach
- Evidence-based VERIFICATION.md matching Phase 2's format (02-VERIFICATION.md)
- Each FOUN-* requirement gets PASS/FAIL with specific evidence (file paths, grep results, test output)
- Live testing: executor runs `npm run dev`, curls API routes, checks build output for automated verification
- Visual/wallet items (dark theme, RainbowKit UI) noted as "requires manual verification" with instructions
- Code audit supplements live testing — verify components exist, imports resolve, routes are defined

### Env var fix
- Set NEXT_PUBLIC_TREASURY_ADDRESS to same value as TREASURY_ADDRESS (0xb1C79423C959b33e7353693D795DA417575A6bf9)
- Add to both .env and .env.example with the real treasury address (not a placeholder)
- .env.example should use the real address so cloners get a working demo immediately

### Dead code removal
- Remove only the 2 named audit targets: useDelegationActions and getAvailableTools
- No broader dead code scan — stays within phase scope
- Also remove any test stubs that reference the removed functions (keep test suite clean)

### Doc updates
- Check all FOUN-* checkboxes in REQUIREMENTS.md and update traceability table to Complete status
- Mark Phase 2 and Phase 3 plan checkboxes as [x] in ROADMAP.md
- Trust prior VERIFICATION.md files (Phase 2 and 3) — no spot-checking needed
- No broader doc cleanup (STATE.md, PROJECT.md decisions table stay as-is for now)

### Claude's Discretion
- Exact wording of verification evidence notes
- Order of operations (verify first vs fix first)
- Whether to batch doc updates into one commit or separate

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit findings
- `.planning/v1.0-MILESTONE-AUDIT.md` — Defines all gaps this phase closes (env var issue, missing verification, stale checkboxes, dead code)

### Phase 1 requirements
- `.planning/REQUIREMENTS.md` — FOUN-01 through FOUN-06 acceptance criteria (currently unchecked)
- `.planning/ROADMAP.md` — Phase 1 success criteria (5 items) and Phase 2/3 plan checkboxes

### Verification reference
- `.planning/phases/02-dashboard-pages/02-VERIFICATION.md` — Format reference for evidence-based verification

### Env var context
- `packages/app/src/lib/contracts/addresses.ts` — Reads `process.env.NEXT_PUBLIC_TREASURY_ADDRESS`
- `.env` — Needs NEXT_PUBLIC_TREASURY_ADDRESS added
- `.env.example` — Needs NEXT_PUBLIC_TREASURY_ADDRESS added

### Dead code targets
- `packages/app/src/lib/hooks/use-delegations.ts` — Contains useDelegationActions (dead code)
- `packages/mcp-server/src/bridge.ts` — Contains getAvailableTools (dead code)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `02-VERIFICATION.md`: Evidence-based verification format to replicate for Phase 1
- `.env.example`: Already has TREASURY_ADDRESS and NEXT_PUBLIC_DEMO_TREASURY_ADDRESS — add NEXT_PUBLIC_TREASURY_ADDRESS alongside

### Established Patterns
- Verification format: requirement table with VERIFIED/FAILED status, evidence column, and integration checks section
- Env vars: NEXT_PUBLIC_ prefix for client-side vars, plain names for server-side (established in Phase 1)

### Integration Points
- `packages/app/src/lib/contracts/addresses.ts:3` — `TREASURY_ADDRESS = process.env.NEXT_PUBLIC_TREASURY_ADDRESS || ...` — this is the broken link the env var fix resolves
- `packages/app/src/lib/hooks/use-treasury.ts` — Imports TREASURY_ADDRESS, used by wagmi hooks for on-chain reads
- REQUIREMENTS.md traceability table rows for FOUN-01 through FOUN-06 currently show "Pending"

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard gap closure following audit recommendations.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-foundation-verification-config-fix*
*Context gathered: 2026-03-20*
