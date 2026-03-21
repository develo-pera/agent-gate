#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# AgentTreasury Demo Setup — Anvil (Base fork on Fly.io)
#
# Deploys treasury, deposits wstETH, simulates yield, funds agents.
# Adapted from tenderly-demo-setup.sh for Anvil RPC methods.
#
# Usage: ./anvil-demo-setup.sh <ANVIL_RPC> <HACKACLAW_KEY> <MERKLE_KEY>
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

ANVIL_RPC="${1:?Usage: ./anvil-demo-setup.sh <ANVIL_RPC> <HACKACLAW_KEY> <MERKLE_KEY>}"
HACKACLAW_KEY="${2:?Missing HACKACLAW_KEY}"
MERKLE_KEY="${3:?Missing MERKLE_KEY}"

WSTETH="0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452"
CHAINLINK_FEED="0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061"

# Derive addresses
HACKACLAW_ADDR=$(cast wallet address "$HACKACLAW_KEY")
MERKLE_ADDR=$(cast wallet address "$MERKLE_KEY")
echo "Hackaclaw: $HACKACLAW_ADDR"
echo "Merkle:    $MERKLE_ADDR"

# ── Verify Anvil RPC is reachable ──────────────────────────────
echo ""
echo "═══ Verifying Anvil RPC ═══"
CHAIN_ID=$(cast chain-id --rpc-url "$ANVIL_RPC")
echo "Chain ID: $CHAIN_ID"

# Get current Chainlink rate
CURRENT_RATE_RAW=$(cast call "$CHAINLINK_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$ANVIL_RPC")
CURRENT_RATE=$(echo "$CURRENT_RATE_RAW" | sed -n '2p' | awk '{print $1}')
echo "Current Chainlink wstETH/stETH rate: $CURRENT_RATE"

# ── Fund both agents with ETH ────────────────────────────────────
echo ""
echo "═══ Funding agents with ETH ═══"
cast rpc anvil_setBalance "$HACKACLAW_ADDR" "0x56BC75E2D63100000" --rpc-url "$ANVIL_RPC" > /dev/null
cast rpc anvil_setBalance "$MERKLE_ADDR" "0x56BC75E2D63100000" --rpc-url "$ANVIL_RPC" > /dev/null
echo "Funded Hackaclaw + Merkle with 100 ETH each"

# ── Deal wstETH to Hackaclaw ─────────────────────────────────────
echo ""
echo "═══ Dealing wstETH to Hackaclaw ═══"
# Base wstETH (bridged ERC-20) uses storage slot 1 for balances
BALANCE_SLOT=$(cast keccak "$(cast abi-encode 'f(address,uint256)' "$HACKACLAW_ADDR" 1)")
WSTETH_AMOUNT="0x000000000000000000000000000000000000000000000000016345785D8A0000" # 0.1 wstETH
cast rpc anvil_setStorageAt "$WSTETH" "$BALANCE_SLOT" "$WSTETH_AMOUNT" --rpc-url "$ANVIL_RPC" > /dev/null

BALANCE=$(cast call "$WSTETH" "balanceOf(address)(uint256)" "$HACKACLAW_ADDR" --rpc-url "$ANVIL_RPC")
echo "Hackaclaw wstETH balance: $BALANCE"

# ── Deploy AgentTreasury ──────────────────────────────────────────
echo ""
echo "═══ Deploying AgentTreasury ═══"
DEPLOY_OUTPUT=$(forge script scripts/Deploy.s.sol:Deploy \
  --rpc-url "$ANVIL_RPC" \
  --broadcast \
  --private-key "$HACKACLAW_KEY" 2>&1)
TREASURY_ADDR=$(echo "$DEPLOY_OUTPUT" | grep "AgentTreasury deployed at:" | awk '{print $NF}')
echo "Treasury deployed at: $TREASURY_ADDR"

# ── Approve + deposit ────────────────────────────────────────────
echo "Approving wstETH..."
cast send "$WSTETH" "approve(address,uint256)" "$TREASURY_ADDR" "$(cast max-uint)" \
  --rpc-url "$ANVIL_RPC" --private-key "$HACKACLAW_KEY" > /dev/null

DEPOSIT_AMOUNT="50000000000000000" # 0.05 wstETH
echo "Depositing 0.05 wstETH..."
cast send "$TREASURY_ADDR" "deposit(uint256)" "$DEPOSIT_AMOUNT" \
  --rpc-url "$ANVIL_RPC" --private-key "$HACKACLAW_KEY" > /dev/null

echo "Vault status after deposit:"
cast call "$TREASURY_ADDR" "getVaultStatus(address)(uint256,uint256,uint256,bool)" "$HACKACLAW_ADDR" --rpc-url "$ANVIL_RPC"

# ── Simulate ~5% yield via oracle rate bump ──────────────────────
echo ""
echo "═══ Simulating ~5% yield (oracle rate bump) ═══"
# Instead of manipulating per-vault storage (which gets diluted by new
# deposits), we replace the Chainlink oracle with a mock that returns a
# 5% higher rate. This way ALL vaults see yield equally.

CURRENT_RATE=$(cast call "$CHAINLINK_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$ANVIL_RPC" | sed -n '2p' | awk '{print $1}')
BUMPED_RATE=$(python3 -c "print(int($CURRENT_RATE * 1.05))")
echo "Current rate: $CURRENT_RATE → Bumped: $BUMPED_RATE (+5%)"

# Deploy a mock oracle that returns the bumped rate with fresh timestamp
MOCK_SRC='
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
contract MockFeed {
    int256 public answer;
    constructor(int256 _answer) { answer = _answer; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, answer, block.timestamp, block.timestamp, 1);
    }
}
'
# Write, compile, deploy, then etch at the real feed address
MOCK_FILE="/tmp/MockFeed_$$.sol"
echo "$MOCK_SRC" > "$MOCK_FILE"

MOCK_ADDR=$(forge create --json \
  --rpc-url "$ANVIL_RPC" \
  --private-key "$HACKACLAW_KEY" \
  --root "$(pwd)" \
  "$MOCK_FILE:MockFeed" \
  --constructor-args "$BUMPED_RATE" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['deployedTo'])")
echo "Mock oracle deployed at: $MOCK_ADDR"

# Copy the mock's bytecode to the real Chainlink feed address
MOCK_CODE=$(cast code "$MOCK_ADDR" --rpc-url "$ANVIL_RPC")
cast rpc anvil_setCode "$CHAINLINK_FEED" "$MOCK_CODE" --rpc-url "$ANVIL_RPC" > /dev/null

# Copy storage slot 0 (the answer) from mock to feed address
ANSWER_SLOT=$(cast storage "$MOCK_ADDR" 0 --rpc-url "$ANVIL_RPC")
cast rpc anvil_setStorageAt "$CHAINLINK_FEED" "0x0000000000000000000000000000000000000000000000000000000000000000" "$ANSWER_SLOT" --rpc-url "$ANVIL_RPC" > /dev/null

# Verify the feed now returns bumped rate
echo "Verifying oracle rate..."
NEW_RATE=$(cast call "$CHAINLINK_FEED" "latestRoundData()(uint80,int256,uint256,uint256,uint80)" --rpc-url "$ANVIL_RPC" | sed -n '2p' | awk '{print $1}')
echo "Oracle now returns: $NEW_RATE"

# ── Verify vault status ──────────────────────────────────────────
echo ""
echo "═══ Vault status (should show yield > 0) ═══"
cast call "$TREASURY_ADDR" "getVaultStatus(address)(uint256,uint256,uint256,bool)" "$HACKACLAW_ADDR" --rpc-url "$ANVIL_RPC"

# ── Register Basenames ─────────────────────────────────────────
echo ""
echo "═══ Registering Basenames ═══"
REVERSE_REGISTRAR="0x79ea96012eea67a83431f1701b3dff7e37f9e282"
cast send "$REVERSE_REGISTRAR" "setName(string)" "hackaclaw.base.eth" \
  --rpc-url "$ANVIL_RPC" --private-key "$HACKACLAW_KEY" > /dev/null
echo "Registered hackaclaw.base.eth"
cast send "$REVERSE_REGISTRAR" "setName(string)" "merkle.base.eth" \
  --rpc-url "$ANVIL_RPC" --private-key "$MERKLE_KEY" > /dev/null
echo "Registered merkle.base.eth"

echo ""
echo "═══ Ready! ═══"
echo "Treasury:  $TREASURY_ADDR"
echo "Hackaclaw: $HACKACLAW_ADDR"
echo "Merkle:    $MERKLE_ADDR"
echo ""
echo "Set these in your .env:"
echo "  RPC_URL=$ANVIL_RPC"
echo "  TREASURY_ADDRESS=$TREASURY_ADDR"
echo "  NEXT_PUBLIC_TREASURY_ADDRESS=$TREASURY_ADDR"
echo "  PRIVATE_KEY=$HACKACLAW_KEY  # (Hackaclaw)"
echo "  MERKLE_KEY=$MERKLE_KEY"
