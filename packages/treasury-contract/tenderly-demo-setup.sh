#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# AgentTreasury Demo Setup — Tenderly Virtual TestNet (Base fork)
#
# Deploys treasury, deposits wstETH, simulates yield, funds agents.
# Requires a Tenderly Virtual TestNet RPC URL (Base mainnet fork).
#
# Usage: ./tenderly-demo-setup.sh <TENDERLY_RPC> <HACKACLAW_KEY> <MERKLE_KEY>
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

TENDERLY_RPC="${1:?Usage: ./tenderly-demo-setup.sh <TENDERLY_RPC> <HACKACLAW_KEY> <MERKLE_KEY>}"
HACKACLAW_KEY="${2:?Missing HACKACLAW_KEY}"
MERKLE_KEY="${3:?Missing MERKLE_KEY}"

WSTETH="0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452"
CHAINLINK_FEED="0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061"

# Derive addresses
HACKACLAW_ADDR=$(cast wallet address "$HACKACLAW_KEY")
MERKLE_ADDR=$(cast wallet address "$MERKLE_KEY")
echo "Hackaclaw: $HACKACLAW_ADDR"
echo "Merkle:    $MERKLE_ADDR"

# ── Verify Tenderly RPC is reachable ──────────────────────────────
echo ""
echo "═══ Verifying Tenderly RPC ═══"
CHAIN_ID=$(cast chain-id --rpc-url "$TENDERLY_RPC")
echo "Chain ID: $CHAIN_ID"

# Get current Chainlink rate
CURRENT_RATE_RAW=$(cast call "$CHAINLINK_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$TENDERLY_RPC")
CURRENT_RATE=$(echo "$CURRENT_RATE_RAW" | sed -n '2p' | awk '{print $1}')
echo "Current Chainlink wstETH/stETH rate: $CURRENT_RATE"

# ── Fund both agents with ETH ────────────────────────────────────
echo ""
echo "═══ Funding agents with ETH ═══"
cast rpc tenderly_setBalance "$HACKACLAW_ADDR" "0x56BC75E2D63100000" --rpc-url "$TENDERLY_RPC" > /dev/null
cast rpc tenderly_setBalance "$MERKLE_ADDR" "0x56BC75E2D63100000" --rpc-url "$TENDERLY_RPC" > /dev/null
echo "Funded Hackaclaw + Merkle with 100 ETH each"

# ── Deal wstETH to Hackaclaw ─────────────────────────────────────
echo ""
echo "═══ Dealing wstETH to Hackaclaw ═══"
# Base wstETH (bridged ERC-20) uses storage slot 1 for balances
BALANCE_SLOT=$(cast keccak "$(cast abi-encode 'f(address,uint256)' "$HACKACLAW_ADDR" 1)")
WSTETH_AMOUNT="0x000000000000000000000000000000000000000000000000016345785D8A0000" # 0.1 wstETH
cast rpc tenderly_setStorageAt "$WSTETH" "$BALANCE_SLOT" "$WSTETH_AMOUNT" --rpc-url "$TENDERLY_RPC" > /dev/null

BALANCE=$(cast call "$WSTETH" "balanceOf(address)(uint256)" "$HACKACLAW_ADDR" --rpc-url "$TENDERLY_RPC")
echo "Hackaclaw wstETH balance: $BALANCE"

# ── Deploy AgentTreasury ──────────────────────────────────────────
echo ""
echo "═══ Deploying AgentTreasury ═══"
DEPLOY_OUTPUT=$(forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url "$TENDERLY_RPC" \
  --broadcast \
  --private-key "$HACKACLAW_KEY" 2>&1)
TREASURY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "AgentTreasury deployed at:" | awk '{print $NF}')
echo "Treasury deployed at: $TREASURY_ADDR"

# ── Approve + deposit ────────────────────────────────────────────
echo "Approving wstETH..."
cast send "$WSTETH" "approve(address,uint256)" "$TREASURY_ADDR" "$(cast max-uint)" \
  --rpc-url "$TENDERLY_RPC" --private-key "$HACKACLAW_KEY" > /dev/null

DEPOSIT_AMOUNT="50000000000000000" # 0.05 wstETH
echo "Depositing 0.05 wstETH..."
cast send "$TREASURY_ADDR" "deposit(uint256)" "$DEPOSIT_AMOUNT" \
  --rpc-url "$TENDERLY_RPC" --private-key "$HACKACLAW_KEY" > /dev/null

echo "Vault status after deposit:"
cast call "$TREASURY_ADDR" "getVaultStatus(address)(uint256,uint256,uint256,bool)" "$HACKACLAW_ADDR" --rpc-url "$TENDERLY_RPC"

# ── Simulate ~5% yield ────────────────────────────────────────────
echo ""
echo "═══ Simulating ~5% yield ═══"
# vaults mapping is at slot 1 (slot 0 is ReentrancyGuard._status)
VAULT_BASE=$(cast keccak "$(cast abi-encode 'f(address,uint256)' "$HACKACLAW_ADDR" 1)")
STETH_VALUE_SLOT=$(python3 -c "print(hex(int('$VAULT_BASE', 16) + 1))")

CURRENT_PRINCIPAL_STETH=$(cast storage "$TREASURY_ADDR" "$STETH_VALUE_SLOT" --rpc-url "$TENDERLY_RPC")
echo "Current principalStETHValue: $CURRENT_PRINCIPAL_STETH"

LOWER_VALUE=$(python3 -c "v = int('$CURRENT_PRINCIPAL_STETH', 16); print('0x' + hex(int(v * 0.95))[2:].zfill(64))")
echo "Setting principalStETHValue to: $LOWER_VALUE (~5% lower)"
cast rpc tenderly_setStorageAt "$TREASURY_ADDR" "$STETH_VALUE_SLOT" "$LOWER_VALUE" --rpc-url "$TENDERLY_RPC" > /dev/null

# ── Verify ────────────────────────────────────────────────────────
echo ""
echo "═══ Vault status (should show yield > 0) ═══"
cast call "$TREASURY_ADDR" "getVaultStatus(address)(uint256,uint256,uint256,bool)" "$HACKACLAW_ADDR" --rpc-url "$TENDERLY_RPC"

echo ""
echo "═══ Ready! ═══"
echo "Treasury:  $TREASURY_ADDR"
echo "Hackaclaw: $HACKACLAW_ADDR"
echo "Merkle:    $MERKLE_ADDR"
echo ""
echo "Set these in your .env:"
echo "  RPC_URL=$TENDERLY_RPC"
echo "  TREASURY_ADDRESS=$TREASURY_ADDR"
echo "  NEXT_PUBLIC_TREASURY_ADDRESS=$TREASURY_ADDR"
echo "  PRIVATE_KEY=$HACKACLAW_KEY  # (Hackaclaw)"
echo "  MERKLE_KEY=$MERKLE_KEY"
