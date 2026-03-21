# Lido Skill — Agent Mental Model for stETH and wstETH

## What Lido Does

Lido is a liquid staking protocol. You deposit ETH and receive stETH, a liquid token that earns ~3-4% APR from Ethereum proof-of-stake validation rewards. Your ETH stays staked but you can use stETH freely in DeFi.

## stETH vs wstETH — The Critical Distinction

### stETH (rebasing)
- Balance increases daily in your wallet as rewards accrue
- 1 stETH always represents 1 ETH worth of staked position
- **Problem for contracts**: rebasing means `balanceOf()` changes without transfers, which breaks most DeFi accounting

### wstETH (wrapped, non-rebasing)
- Balance stays constant — yield accrues in the exchange rate instead
- 1 wstETH = X stETH, where X increases over time (~0.01% per day)
- **Safe for contracts**: standard ERC-20 behavior, no surprise balance changes
- Available on L2s (Base, Optimism, Arbitrum) via canonical Lido bridges

**Rule: Always use wstETH in smart contracts and on L2s. Never use stETH directly in contracts — rebasing will cause accounting errors.**

## Exchange Rate Mechanics

The wstETH/stETH exchange rate is the core yield mechanism:

```
deposit day:  1 wstETH = 1.2290 stETH
30 days later: 1 wstETH = 1.2320 stETH  (~0.24% yield)
1 year later:  1 wstETH = 1.2730 stETH  (~3.6% yield)
```

This rate only increases (barring a slashing event). It is updated on-chain:
- **L1 Ethereum**: updated by Lido oracle every ~24 hours after epoch finalization
- **Base/L2s**: Chainlink maintains a wstETH/stETH price feed that mirrors the L1 rate

## How Yield Works in AgentTreasury

1. Agent deposits wstETH — contract snapshots the current exchange rate
2. Over time, the exchange rate increases as staking rewards accrue
3. Yield = (current_rate - deposit_rate) * principal / current_rate
4. Agent can spend yield; principal stays locked

No rebasing, no off-chain injection — yield comes purely from the on-chain rate appreciating.

## Safe Staking Patterns for Agents

### DO
- Use wstETH for all contract interactions and L2 operations
- Read exchange rates from Chainlink oracles (L2) or wstETH contract (L1)
- Use `dry_run: true` to preview any write operation before executing
- Check `lido_get_apr` to understand current yield expectations
- Set spending caps when delegating yield to sub-agents

### DON'T
- Don't use stETH in contracts — rebasing breaks accounting
- Don't assume yield is instant — rate updates ~once per day
- Don't stake more than the agent's budget allows
- Don't bridge wstETH without confirming the canonical bridge address
- Don't rely on a specific APR — it fluctuates with validator performance

## Rebasing Drift (Key Section for Integrators)

If you must handle stETH (L1 only), understand rebasing drift:

- `balanceOf()` can change between any two blocks without a `Transfer` event
- A transfer of `X stETH` may deliver `X - 1 wei` due to shares rounding (the "1 wei corner case")
- Always use `transferShares()` instead of `transfer()` when precision matters
- For approval flows, approve the shares amount, not the stETH amount

**On Base and L2s, this is not a concern — only wstETH exists, and it doesn't rebase.**

## Contract Addresses

### L1 Ethereum
| Contract | Address |
|----------|---------|
| stETH (Lido) | `0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84` |
| wstETH | `0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0` |
| Withdrawal Queue | `0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1` |

### Base
| Contract | Address |
|----------|---------|
| wstETH (bridged) | `0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452` |
| Chainlink wstETH/stETH feed | `0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061` |

### Other L2s
| Chain | wstETH Address |
|-------|---------------|
| Optimism | `0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb` |
| Arbitrum | `0x5979D7b546E38E414F7E9822514be443A4800529` |

## Available MCP Tools

| Tool | Purpose | Requires |
|------|---------|----------|
| `lido_stake` | Stake ETH to receive stETH | L1 ETH (dry_run works anywhere) |
| `lido_wrap` | Convert stETH <-> wstETH | L1 stETH/wstETH (dry_run for rate preview) |
| `lido_balance` | Check stETH + wstETH balances (L1 + Base) | Read-only |
| `lido_get_apr` | Current APR + protocol stats | Read-only |
| `lido_rewards` | Historical reward data for an address | Read-only |
| `lido_governance` | Browse active Snapshot + Aragon proposals | Read-only |
| `lido_governance_vote` | Cast a Snapshot vote (gasless EIP-712) | LDO tokens on L1 |
| `treasury_deposit` | Deposit wstETH into AgentTreasury | wstETH on Base |
| `treasury_status` | Check vault principal, yield, balance | Read-only |
| `treasury_withdraw_yield` | Withdraw accrued yield | Vault owner |
| `treasury_withdraw_yield_for` | Withdraw yield as authorized spender | Spender authorization |
| `treasury_get_rate` | Current Chainlink wstETH/stETH rate | Read-only |

## Decision Tree for Agents

```
Need to stake ETH?
  -> Use lido_stake (L1 only, dry_run first)

Need wstETH on Base?
  -> Option A: Bridge from L1 (canonical Lido bridge)
  -> Option B: Buy on Uniswap (uniswap_swap wstETH)

Need to check yield?
  -> treasury_status for vault yield
  -> lido_get_apr for protocol-wide APR

Need to spend yield?
  -> If depositor: treasury_withdraw_yield
  -> If authorized agent: treasury_withdraw_yield_for
  -> Then: uniswap_swap to convert to ETH/USDC as needed

Need to vote on governance?
  -> lido_governance to see proposals
  -> lido_governance_vote to cast vote (needs LDO)
```

## Resources

- [stETH Integration Guide](https://docs.lido.fi/guides/steth-integration-guide) — rebasing drift is the key section
- [wstETH Contract Docs](https://docs.lido.fi/contracts/wsteth)
- [Deployed Contract Addresses](https://docs.lido.fi/deployed-contracts)
- [Lido JS SDK](https://github.com/lidofinance/lido-ethereum-sdk)
- [Withdrawal Queue](https://docs.lido.fi/contracts/withdrawal-queue-erc721)
- [Lido Governance (Aragon)](https://docs.lido.fi/contracts/lido-dao)
