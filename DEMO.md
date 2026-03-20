# Demo Setup Guide

## Prerequisites

- Tenderly Virtual TestNet (Base mainnet fork) — already created
- App deployed to Vercel (or running locally)

## RPC URLs

| Type | URL |
|------|-----|
| Public (reads) | `https://virtual.base.eu.rpc.tenderly.co/2aabfcea-72f3-41c8-9365-8a81496c8772` |
| Admin (writes) | `https://virtual.base.eu.rpc.tenderly.co/3e45b314-2987-4fc0-b7a0-72be1d824acf` |

## Agent Addresses

| Agent | Address |
|-------|---------|
| Hackaclaw | `0x770323A064435C282CD97Cc2C71e668ad89336b9` |
| Merkle | `0x60EE9a333fCcCFEA9084560Bb8a5e149420b3e3d` |

## Treasury Contract

`0xFd027999609d95Ca3Db8B9F78f388816c3c7A380` (deployed on Tenderly fork)

## 1. Deploy Contract (already done)

```bash
cd packages/treasury-contract
./tenderly-demo-setup.sh <TENDERLY_ADMIN_RPC> <HACKACLAW_KEY> <MERKLE_KEY>
```

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

Replace `https://agent-gate-three.vercel.app` with the actual Vercel deployment URL (or `http://localhost:3001` for local testing).

## 3. Demo Flow (8 steps)

| # | Who | Command | Dashboard |
|---|-----|---------|-----------|
| 1 | Hackaclaw | "check my treasury vault" | Vault: principal + yield visible |
| 2 | Hackaclaw | "what's the current Lido APR?" | Staking page shows APR |
| 3 | Hackaclaw | "authorize Merkle as spender — 0.001/tx, 0.005 daily cap" | Spender config appears |
| 4 | Merkle | "check what I can spend from Hackaclaw's vault" | — |
| 5 | Merkle | "withdraw 0.0005 yield from Hackaclaw's vault" | Yield decreases, principal unchanged |
| 6 | Merkle | "swap 0.0005 wstETH to USDC on Uniswap" | Uniswap works on Tenderly fork |
| 7 | Hackaclaw | "check vault — is my principal intact?" | Updated balances confirm |
| 8 | Hackaclaw | "revoke Merkle's access" | Spender removed |

## Local Testing

To test the MCP endpoint locally before Vercel deploy:

```bash
# Test auth
curl -X POST http://localhost:3001/api/mcp-agent \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer hackaclaw" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"treasury_status","arguments":{"agent_address":"0x770323A064435C282CD97Cc2C71e668ad89336b9"}},"id":1}'
```

## Env Vars for Vercel

```
RPC_URL=https://virtual.base.eu.rpc.tenderly.co/3e45b314-2987-4fc0-b7a0-72be1d824acf
NEXT_PUBLIC_RPC_URL=https://virtual.base.eu.rpc.tenderly.co/2aabfcea-72f3-41c8-9365-8a81496c8772
NEXT_PUBLIC_CHAIN_ID=28061389
TREASURY_ADDRESS=0xFd027999609d95Ca3Db8B9F78f388816c3c7A380
NEXT_PUBLIC_TREASURY_ADDRESS=0xFd027999609d95Ca3Db8B9F78f388816c3c7A380
NEXT_PUBLIC_DEMO_TREASURY_ADDRESS=0x770323A064435C282CD97Cc2C71e668ad89336b9
PRIVATE_KEY=<hackaclaw private key>
MERKLE_KEY=<merkle private key>
UNISWAP_API_KEY=<uniswap api key>
```
