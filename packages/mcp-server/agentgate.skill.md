# AgentGate — DeFi Infrastructure for AI Agents

Read this file and follow the instructions to connect to AgentGate.

## What AgentGate Is

AgentGate is an MCP server that gives AI agents access to DeFi on Base (L2). You get tools for:

- **Treasury vaults** — deposit wstETH, earn yield, authorize other agents to spend your yield
- **Uniswap** — get quotes and execute swaps
- **Aave** — supply/withdraw USDC for lending interest
- **Delegations** — grant scoped on-chain permissions (ERC-7710) to other agents
- **ENS/Basenames** — resolve .base.eth names to addresses
- **Monitoring** — check balances, vault health, positions

You keep your own private key. AgentGate never asks for it. Write tools return unsigned transactions for you to sign locally.

## Register

Registration proves you own your wallet address. You will need your wallet address and the ability to sign a message with your private key. Your key never leaves your machine.

### Step 1: Get a challenge

```bash
curl -s -X POST https://agent-gate-three.vercel.app/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"address": "YOUR_ADDRESS"}'
```

Response:

```json
{
  "message": "AgentGate Registration\n\nI am registering 0x... with AgentGate.\n\nNonce: abc123",
  "nonce": "abc123"
}
```

### Step 2: Sign the challenge message

Sign the `message` field from Step 1 using your own wallet tooling. The method depends on your setup:

**viem/ethers (Node.js):**
```javascript
const signature = await walletClient.signMessage({ message });
```

**cast (foundry CLI):**
```bash
cast wallet sign --interactive "$MESSAGE"
```
(This prompts for your key interactively — it never appears in shell history.)

**Python (web3.py):**
```python
signature = w3.eth.account.sign_message(encode_defunct(text=message), private_key).signature.hex()
```

**Any method works** — as long as you produce a valid EIP-191 personal_sign signature.

### Step 3: Submit signature and get API key

```bash
curl -s -X POST https://agent-gate-three.vercel.app/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"address": "YOUR_ADDRESS", "signature": "0xYOUR_SIGNATURE", "name": "your-agent-name"}'
```

Response:

```json
{
  "agent_id": "your-agent-name",
  "address": "0x...",
  "api_key": "a1b2c3...",
  "funded": true
}
```

Save the `api_key` immediately. It is shown once and cannot be recovered.

## Connect MCP

After registration, connect to AgentGate as an MCP server using your API key.

### Claude Code

```bash
claude mcp add agentgate \
  --transport http \
  --url "https://agent-gate-three.vercel.app/api/mcp-agent" \
  --header "Authorization: Bearer YOUR_API_KEY"
```

### settings.json (any MCP client)

```json
{
  "mcpServers": {
    "agentgate": {
      "type": "http",
      "url": "https://agent-gate-three.vercel.app/api/mcp-agent",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

## First Steps After Connecting

1. Call `who_am_i` — confirms your address and access mode
2. Call `wallet_balance` — check your ETH balance (you get 1 ETH on registration)
3. Call `treasury_status` with your address — check your vault
4. Call `uniswap_tokens` — see available tokens for trading

## How Write Tools Work

You are a **third-party agent** — AgentGate does not hold your private key.

- **Read tools** (balances, quotes, positions) return data normally
- **Write tools** (deposit, swap, transfer) return **unsigned transactions**: `{to, data, value, chainId}`
- Sign the transaction locally with your own wallet and submit it to Base
- Call `submit_tx_hash` with the transaction hash to verify the receipt

Example flow:

```
1. Call treasury_deposit → get unsigned tx {to, data, value, chainId}
2. Sign and send locally with your wallet
3. Call submit_tx_hash with the tx hash → get receipt confirmation
```

## Available Tools

### Identity
- `who_am_i` — your agent ID, address, and access mode

### Treasury (yield-only vault)
- `treasury_deposit` — deposit wstETH (principal locked, yield spendable)
- `treasury_status` — check vault balances and yield
- `treasury_withdraw_yield` — withdraw your accrued yield
- `treasury_withdraw_yield_for` — withdraw yield as authorized spender
- `treasury_authorize_spender` — grant another agent yield-spending rights
- `treasury_revoke_spender` — revoke spending authorization
- `treasury_get_spender_config` — check spender limits
- `treasury_get_rate` — current wstETH/stETH rate from Chainlink
- `treasury_set_recipient_whitelist` — toggle recipient restrictions
- `treasury_set_allowed_recipient` — manage whitelist

### Trading
- `uniswap_quote` — get a swap quote
- `uniswap_swap` — execute a swap (first-party only; use quote + sign locally for third-party)
- `uniswap_tokens` — list available tokens
- `aave_supply` — deposit USDC to earn lending interest
- `aave_withdraw` — withdraw USDC from Aave
- `aave_position` — check your Aave position
- `transfer_token` — send ERC-20 tokens
- `trading_list_recipes` — multi-step trading strategies

### Delegation (ERC-7710)
- `delegate_create_account` — create a smart account for delegations
- `delegate_create` — grant scoped on-chain permission to another agent
- `delegate_redeem` — execute an action via delegation
- `delegate_list` — list active delegations
- `delegate_revoke` — disable a delegation on-chain

### Monitoring
- `wallet_balance` — ETH and token balances
- `vault_health` — health report for your staking position
- `lido_balance` — wstETH balance on Base
- `lido_get_apr` — current Lido staking APR
- `lido_rewards` — reward history
- `lido_governance` — active governance proposals

### ENS
- `ens_resolve` — name to address
- `ens_reverse` — address to name

### Utility
- `register_challenge` — get a challenge message to sign (step 1 of registration)
- `register_agent` — submit signature to complete registration (step 2)
- `submit_tx_hash` — report a signed transaction for receipt verification

## Network

AgentGate operates on **Base** (chain ID 8453). The demo environment uses an Anvil fork with test funds. You receive 1 ETH on registration.

## Dashboard

View all agent activity at: https://agent-gate-three.vercel.app/treasury
