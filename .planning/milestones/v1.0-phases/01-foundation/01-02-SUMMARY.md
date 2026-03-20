---
phase: 01-foundation
plan: 02
subsystem: ui, providers
tags: [rainbowkit, wagmi, sidebar, demo-mode, wallet-connect]

# Dependency graph
requires:
  - phase: 01-foundation/01-01
    provides: "Next.js app with dark crypto theme, shadcn components, MCP bridge"
provides:
  - "Web3 provider stack (wagmi + RainbowKit + react-query)"
  - "App context with demo mode and active address tracking"
  - "Sidebar navigation with icon rail + hover expand"
  - "Demo banner with treasury address display"
  - "Wallet display with ENS/address + Base badge"
  - "4 placeholder pages (Treasury, Staking, Delegations, Playground)"
affects: [02-01, 02-02, 02-03, 03-01, 03-02]

# Tech tracking
tech-stack:
  added: [@rainbow-me/rainbowkit@2.2.10, wagmi@2.19.5, viem, @tanstack/react-query, lucide-react]
  patterns: [provider-composition, context-based-demo-mode, icon-rail-sidebar]

key-files:
  created:
    - packages/app/src/lib/wagmi-config.ts
    - packages/app/src/providers/web3-provider.tsx
    - packages/app/src/providers/app-provider.tsx
    - packages/app/src/components/sidebar.tsx
    - packages/app/src/components/demo-banner.tsx
    - packages/app/src/components/wallet-display.tsx
    - packages/app/src/components/placeholder-page.tsx
    - packages/app/src/app/treasury/page.tsx
    - packages/app/src/app/staking/page.tsx
    - packages/app/src/app/delegations/page.tsx
    - packages/app/src/app/playground/page.tsx
  modified:
    - packages/app/src/app/layout.tsx
    - packages/app/src/app/page.tsx
    - packages/app/package.json

key-decisions:
  - "Used ConnectButton.Custom from RainbowKit for custom wallet UI in both banner and sidebar"
  - "Demo mode determined by wallet connection state — no manual toggle"
  - "Sidebar uses CSS group-hover for expand/collapse instead of JS state"

patterns-established:
  - "Provider stack order: Web3Provider > AppProvider > layout children"
  - "Demo mode context: isDemo + activeAddress + treasuryAddress"
  - "Sidebar icon rail: w-14 collapsed, w-60 expanded via group-hover with 200ms transition"
  - "PlaceholderPage reusable component for section stubs"

requirements-completed: [FOUN-03, FOUN-04, FOUN-06]

# Metrics
duration: ~15min (estimated - crash interrupted tracking)
completed: 2026-03-19
---

# Phase 01 Plan 02: Wallet Connect, Demo Mode, Sidebar & Pages Summary

**Wired up the complete app shell: RainbowKit wallet connect with dark theme, demo mode context with sticky banner, icon rail sidebar with 4 nav items, and glassmorphism placeholder pages for all sections.**

## Performance

- **Duration:** ~15 min (estimated)
- **Started:** 2026-03-19T23:06:00Z
- **Completed:** 2026-03-19T23:21:00Z (approx — session crashed before summary)
- **Tasks:** 3 code tasks + 1 human verification (skipped due to crash)
- **Files created:** 11
- **Files modified:** 2

## Accomplishments
- wagmi config for Base chain with RainbowKit dark theme (accent purple #8B5CF6)
- Web3Provider wraps WagmiProvider + RainbowKitProvider + QueryClientProvider
- AppProvider tracks wallet connection, provides isDemo/activeAddress context
- Demo banner shows "Demo Mode — viewing 0x0000...0000" with connect CTA, hides when connected
- WalletDisplay shows connect button (demo) or address + Base badge (connected)
- Icon rail sidebar (56px → 240px on hover) with Treasury, Staking, Delegations, Playground nav
- Active route detection with accent left border highlight
- AgentGate wordmark with purple glow at sidebar top
- 4 placeholder pages with glassmorphism cards
- Root "/" redirects to /treasury

## Task Commits

1. **Task 1: Create wagmi config and Web3 provider stack** — `1edca54`
2. **Task 2: Create app provider, demo banner, and wallet display** — `6fb6f17`
3. **Task 3: Build sidebar, placeholder pages, and wire layout** — `8316709`

Post-execution fixes:
- `97b9d83` — fix(dev): use webpack mode with 2GB heap for low-memory servers
- `fd7154b` — revert(dev): restore default Turbopack dev script

## Files Created/Modified
- `packages/app/src/lib/wagmi-config.ts` — wagmi config with Base chain, RainbowKit getDefaultConfig
- `packages/app/src/providers/web3-provider.tsx` — Client-side provider stack with dark theme
- `packages/app/src/providers/app-provider.tsx` — Demo mode context, useApp hook
- `packages/app/src/components/sidebar.tsx` — Icon rail nav with hover expand, active states
- `packages/app/src/components/demo-banner.tsx` — Sticky demo banner with role="status"
- `packages/app/src/components/wallet-display.tsx` — Address display with ENS + Base badge
- `packages/app/src/components/placeholder-page.tsx` — Reusable glassmorphism card stub
- `packages/app/src/app/treasury/page.tsx` — Treasury placeholder
- `packages/app/src/app/staking/page.tsx` — Staking placeholder
- `packages/app/src/app/delegations/page.tsx` — Delegations placeholder
- `packages/app/src/app/playground/page.tsx` — Playground placeholder
- `packages/app/src/app/layout.tsx` — Wired providers, sidebar, demo banner, main content
- `packages/app/src/app/page.tsx` — Redirect to /treasury

## Issues Encountered
- Server crashed during post-execution phase check, preventing summary write and state update
- Summary reconstructed from git history and code review

## Next Phase Readiness
- Complete app shell with working navigation, wallet connect, and demo mode
- All provider contexts available for Phase 2 dashboard pages
- Placeholder pages ready to be replaced with real content
- Build passes cleanly

---
*Phase: 01-foundation*
*Completed: 2026-03-19*
