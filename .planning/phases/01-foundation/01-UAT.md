---
status: complete
phase: 01-foundation
source: [01-00-SUMMARY.md, 01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-03-20T00:00:00Z
updated: 2026-03-20T11:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run `npm run dev` from repo root. Server boots without errors, no crash or missing module. Opening http://localhost:3000 in browser loads the app.
result: pass

### 2. Dark Crypto Theme
expected: App loads with dark background (near-black), light text, and purple accent colors. No white/light theme flash.
result: issue
reported: "it's completely white actually"
severity: major

### 3. Demo Banner Visible
expected: Without a wallet connected, a sticky banner appears at top showing "Demo Mode" with the demo treasury address and a connect wallet CTA.
result: issue
reported: "I don't see it"
severity: major

### 4. Sidebar Icon Rail
expected: Left sidebar shows as a narrow icon rail (~56px). Hovering over it expands to ~240px showing labels next to icons. Moving mouse away collapses it back. Transition is smooth (~200ms).
result: pass

### 5. Sidebar Navigation
expected: Sidebar shows 4 items: Treasury, Staking, Delegations, Playground. Clicking each navigates to that page. The active page has a highlighted/accent left border on its sidebar item.
result: pass

### 6. Root Redirect
expected: Navigating to http://localhost:3000/ redirects to /treasury.
result: pass

### 7. Placeholder Pages
expected: Each of the 4 pages (Treasury, Staking, Delegations, Playground) shows a glassmorphism-style card with the section name. Pages are distinct stubs, not blank.
result: pass

### 8. MCP Bridge API
expected: Running `curl -X POST http://localhost:3000/api/mcp/get_treasury_balance -H "Content-Type: application/json" -d '{}'` returns a JSON response with `{ success: true, data: ... }` or a structured error — not a 404 or crash.
result: issue
reported: "fail — returns {success:false, error:'Unknown tool: get_treasury_balance'}"
severity: major

### 9. Vitest Runs Clean
expected: Running `cd packages/app && npx vitest run` exits with code 0. All test stubs are discovered (14 todo tests across 6 files).
result: pass

## Summary

total: 9
passed: 6
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "App loads with dark background (near-black), light text, and purple accent colors. No white/light theme flash."
  status: failed
  reason: "User reported: it's completely white actually"
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "Without a wallet connected, a sticky banner appears at top showing Demo Mode with the demo treasury address and a connect wallet CTA."
  status: failed
  reason: "User reported: I don't see it"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "MCP bridge API at /api/mcp/[tool] returns structured JSON for treasury tools"
  status: failed
  reason: "User reported: returns {success:false, error:'Unknown tool: get_treasury_balance'}"
  severity: major
  test: 8
  artifacts: []
  missing: []
