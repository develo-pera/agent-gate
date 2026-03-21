# Demo Setup Guide

## Live Dashboard

**[https://agent-gate-three.vercel.app/treasury](https://agent-gate-three.vercel.app/treasury)**

## Prerequisites

- Anvil fork on Fly.io (Base mainnet fork) — self-hosted, no block limits
- App deployed to Vercel (or running locally)

## RPC URL

| Type | URL |
|------|-----|
| Anvil (reads + writes) | `https://agentgate-anvil.fly.dev/` |

## Agent Addresses

| Agent | Address | Basename |
|-------|---------|----------|
| Hackaclaw | `0x770323A064435C282CD97Cc2C71e668ad89336b9` | hackaclaw.base.eth |
| Merkle | `0x60EE9a333fCcCFEA9084560Bb8a5e149420b3e3d` | merkle.base.eth |

## Treasury Contract

`0xFd027999609d95Ca3Db8B9F78f388816c3c7A380` (deployed on Anvil fork)

## 1. Deploy Contract & Setup

```bash
cd packages/treasury-contract
./anvil-demo-setup.sh https://agentgate-anvil.fly.dev/ <HACKACLAW_KEY> <MERKLE_KEY>
```

This deploys `AgentTreasury`, funds agents with ETH, deals wstETH, deposits 0.05 wstETH, simulates ~5% yield via mock Chainlink oracle, and registers basenames.

## 2. Connect Agents to Hosted MCP Server

Each agent machine runs one command to connect Claude Code to the hosted MCP server:

**Hackaclaw's machine:**
```bash
claude mcp add --transport http agentgate https://agent-gate-three.vercel.app/api/mcp-agent \
  --header "Authorization: Bearer hackaclaw"
```

**Merkle's machine:**
```bash
claude mcp add --transport http agentgate https://agent-gate-three.vercel.app/api/mcp-agent \
  --header "Authorization: Bearer merkle"
```

## 3. Demo Flow (18 steps)

### Phase 1 — Identity
| # | Who | Command | Dashboard |
|---|-----|---------|-----------|
| 1 | Both | "who am I?" | Agent connects, basename + USDC balance shown |

### Phase 2 — Vault
| # | Who | Command | Dashboard |
|---|-----|---------|-----------|
| 2 | Hackaclaw | "check my treasury vault" | Vault: principal + yield visible |
| 3 | Hackaclaw | "deposit 0.01 wstETH" | Principal increases |
| 4 | Hackaclaw | "check vault status" | Verify principal increased |

### Phase 3 — Delegation
| # | Who | Command | Dashboard |
|---|-----|---------|-----------|
| 5 | Hackaclaw | "authorize merkle.base.eth as spender — 0.001/tx, 0.005 daily cap" | Spender config appears |
| 6 | Merkle | "check what I can spend from Hackaclaw's vault" | Delegation visible |

### Phase 4 — Autonomous Trading (Merkle)
| # | Who | Command | Dashboard |
|---|-----|---------|-----------|
| 7 | Merkle | "list available trading recipes" | Recipes page |
| 8 | Merkle | "withdraw yield from Hackaclaw's vault" | Yield decreases, principal unchanged |
| 9 | Hackaclaw | "check vault status" | Verify yield decreased |
| 10 | Merkle | "swap wstETH to USDC on Uniswap" | Swap toast notification |
| 11 | Merkle | "supply USDC to Aave V3" | Aave supply toast |
| 12 | Merkle | "check my Aave position" | Open position card appears |
| 13 | Merkle | "withdraw from Aave" | USDC + profit withdrawn |
| 14 | Merkle | "transfer USDC profit to Hackaclaw" | Transfer toast |

### Phase 5 — Compounding (Hackaclaw)
| # | Who | Command | Dashboard |
|---|-----|---------|-----------|
| 15 | Hackaclaw | "swap all USDC to wstETH" | Swap toast |
| 16 | Hackaclaw | "deposit wstETH into vault" | Principal grows (compounding) |
| 17 | Hackaclaw | "check vault status" | Principal higher than before |

### Phase 6 — Monitoring
| # | Who | Command | Dashboard |
|---|-----|---------|-----------|
| 18 | Either | "check vault health" | Full health report |

## Resetting the Fork

To start fresh (destroys all on-chain state):

```bash
# Destroy old machine + volume
fly machine list -a agentgate-anvil
fly machine destroy <MACHINE_ID> -a agentgate-anvil --force
fly volumes list -a agentgate-anvil
fly volumes destroy <VOLUME_ID> -a agentgate-anvil -y

# Create fresh volume and redeploy
fly volumes create anvil_data -a agentgate-anvil --region ams --size 1 -y
cd infra/anvil && fly deploy

# Re-run setup
cd packages/treasury-contract
./anvil-demo-setup.sh https://agentgate-anvil.fly.dev/ <HACKACLAW_KEY> <MERKLE_KEY>
```

Then update `TREASURY_ADDRESS` and `NEXT_PUBLIC_TREASURY_ADDRESS` in `.env` files and Vercel env vars.

## Env Vars for Vercel

```
RPC_URL=https://agentgate-anvil.fly.dev/
NEXT_PUBLIC_RPC_URL=https://agentgate-anvil.fly.dev/
NEXT_PUBLIC_CHAIN_ID=8453
TREASURY_ADDRESS=0xFd027999609d95Ca3Db8B9F78f388816c3c7A380
NEXT_PUBLIC_TREASURY_ADDRESS=0xFd027999609d95Ca3Db8B9F78f388816c3c7A380
NEXT_PUBLIC_DEMO_TREASURY_ADDRESS=0x770323A064435C282CD97Cc2C71e668ad89336b9
PRIVATE_KEY=<hackaclaw private key>
MERKLE_KEY=<merkle private key>
UNISWAP_API_KEY=<uniswap api key>
L1_RPC_URL=<ethereum mainnet RPC>
```
