# AgentGate — Demo Script

## Setup

**Screen layout:** Split-screen with Hackaclaw's Claude Code (left), Merkle's Claude Code (right), and the AgentGate dashboard (browser, center or overlay).

**Dashboard URL:** https://agent-gate-three.vercel.app

---

## Intro (30 seconds)

> "This is AgentGate — agent-to-agent DeFi infrastructure on Base.
>
> Two AI agents, Hackaclaw and Merkle, each running Claude Code on separate machines, connected to a shared MCP server hosted on Vercel.
>
> Hackaclaw owns a wstETH treasury vault. He delegates yield-spending access to Merkle. Merkle then autonomously executes a trading strategy — harvesting yield, swapping to USDC, lending on Aave V3, and returning the profit for compounding.
>
> Everything happens on-chain. Every action is visible on the live dashboard. Let's walk through it."

---

## Phase 1 — Identity (15 seconds)

**Hackaclaw (left):**
> "Who am I?"

*Dashboard: shows hackaclaw.base.eth connected*

**Merkle (right):**
> "Who am I?"

*Dashboard: shows merkle.base.eth connected*

> "Both agents discover their identity from the MCP server — their wallet addresses are server-side, never exposed locally."

---

## Phase 2 — Treasury (20 seconds)

**Hackaclaw:**
> "Check my treasury vault status"

*Dashboard: vault overview shows principal + yield*

**Hackaclaw:**
> "Deposit 0.01 wstETH into my vault"

*Dashboard: toast — "hackaclaw.base.eth deposited 0.01 wstETH". Vault balance updates.*

> "Hackaclaw's vault holds wstETH. Principal is locked — only yield from Lido staking rewards can be spent."

---

## Phase 3 — Delegation (20 seconds)

**Hackaclaw:**
> "Authorize merkle.base.eth as a yield spender with 0.001 wstETH per transaction and 0.005 daily cap"

*Dashboard: toast — "hackaclaw.base.eth authorized merkle.base.eth". Delegation card appears.*

**Merkle:**
> "Check what spending access I have on hackaclaw.base.eth's vault"

*Dashboard: delegation tab shows "Received" badge with caps and access level.*

> "Merkle now has scoped access to Hackaclaw's yield — per-transaction and daily limits, yield only, principal untouched. All enforced on-chain."

---

## Phase 4 — Autonomous Trading (60 seconds)

> "Now Merkle executes an autonomous trading strategy with the delegated yield."

**Merkle:**
> "List available trading recipes"

*Shows "Yield Harvest & Lend" recipe with all steps.*

**Merkle:**
> "Withdraw 0.0005 wstETH yield from hackaclaw.base.eth's vault"

*Dashboard: toast — "0.0005 wstETH from hackaclaw.base.eth to merkle.base.eth". Vault yield decreases.*

**Merkle:**
> "Swap 0.0005 wstETH to USDC on Uniswap"

*Dashboard: toasts — "merkle.base.eth sent 0.0005 wstETH", "merkle.base.eth received X USDC". USDC balance appears next to agent name.*

**Merkle:**
> "Supply all my USDC to Aave V3"

*Dashboard: toast — "merkle.base.eth supplied X USDC to Aave V3". Aave position card appears on treasury page.*

**Merkle:**
> "Check my Aave lending position"

*Shows aUSDC balance, collateral, health factor.*

**Merkle:**
> "Withdraw max USDC from Aave"

*Dashboard: toast — "merkle.base.eth withdrew X USDC from Aave V3". Aave position card disappears.*

**Merkle:**
> "Transfer all my USDC to hackaclaw.base.eth"

*Dashboard: toast — USDC transfer. Merkle's USDC balance goes to 0, Hackaclaw's increases.*

> "Merkle just executed the full recipe autonomously — harvest yield, swap, lend on Aave, withdraw, and send profit back. No human intervention after the initial delegation."

---

## Phase 5 — Compounding (20 seconds)

**Hackaclaw:**
> "Swap all my USDC to wstETH on Uniswap"

*Dashboard: swap toasts.*

**Hackaclaw:**
> "Deposit all my wstETH into my vault"

*Dashboard: toast — deposit. Vault principal increases.*

> "Hackaclaw takes the profit, converts back to wstETH, and re-deposits. Principal grows. This is the compounding loop — yield earns more yield."

---

## Phase 6 — Verification (15 seconds)

**Hackaclaw:**
> "Check my treasury vault status — has my principal increased?"

*Dashboard: vault shows higher principal than before.*

> "Principal is higher than what was originally deposited. The autonomous trading loop worked — yield was harvested, put to work on Aave, and compounded back."

---

## Closing (15 seconds)

> "AgentGate — 33 MCP tools, Aave V3 lending, Uniswap swaps, scoped delegations, and a live dashboard. Two AI agents collaborating on DeFi, completely autonomously.
>
> Built for Lido, Uniswap, MetaMask Delegations, and the Autonomous Trading Agent bounties.
>
> Thanks for watching."

---

## Total runtime: ~3 minutes
