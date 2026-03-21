#!/usr/bin/env bash
#
# Register an agent with AgentGate.
#
# This script guides you through the challenge-response flow.
# Your private key is NEVER passed as an argument or stored.
# You sign the challenge interactively using `cast wallet sign --interactive`.
#
# Usage:
#   ./scripts/register-agent.sh <address> [agent_name] [server_url]
#
# Requirements: curl, jq, cast (foundry)
#
# Example:
#   ./scripts/register-agent.sh 0x770323A064435C282CD97Cc2C71e668ad89336b9 myagent
#

set -euo pipefail

ADDRESS="${1:?Usage: $0 <address> [agent_name] [server_url]}"
AGENT_NAME="${2:-}"
SERVER_URL="${3:-https://agent-gate-three.vercel.app}"
REGISTER_URL="${SERVER_URL}/api/agents/register"
MCP_URL="${SERVER_URL}/api/mcp-agent"

echo ""
echo "AgentGate Registration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Address:  $ADDRESS"
echo "Server:   $SERVER_URL"
echo ""

# Step 1: Get challenge
echo "Step 1: Requesting challenge..."
CHALLENGE=$(curl -s -X POST "$REGISTER_URL" \
  -H "Content-Type: application/json" \
  -d "{\"address\": \"$ADDRESS\"}")

MESSAGE=$(echo "$CHALLENGE" | jq -r '.message')
if [ "$MESSAGE" = "null" ] || [ -z "$MESSAGE" ]; then
  echo "Error: Failed to get challenge."
  echo "$CHALLENGE" | jq .
  exit 1
fi

echo "Challenge received."
echo ""

# Step 2: Sign interactively (key never appears in shell history)
echo "Step 2: Sign the challenge message."
echo "You will be prompted to enter your private key interactively."
echo "(It will not be displayed or stored.)"
echo ""
echo "Message to sign:"
echo "─────────────────────────────────"
echo "$MESSAGE"
echo "─────────────────────────────────"
echo ""

SIGNATURE=$(cast wallet sign --interactive "$MESSAGE" 2>/dev/null)

if [ -z "$SIGNATURE" ]; then
  echo "Error: Signing failed or was cancelled."
  exit 1
fi

echo "Signed successfully."
echo ""

# Step 3: Register
echo "Step 3: Registering..."
BODY="{\"address\": \"$ADDRESS\", \"signature\": \"$SIGNATURE\""
if [ -n "$AGENT_NAME" ]; then
  BODY="$BODY, \"name\": \"$AGENT_NAME\""
fi
BODY="$BODY}"

RESULT=$(curl -s -X POST "$REGISTER_URL" \
  -H "Content-Type: application/json" \
  -d "$BODY")

API_KEY=$(echo "$RESULT" | jq -r '.api_key')
FUNDED=$(echo "$RESULT" | jq -r '.funded')
AGENT_ID=$(echo "$RESULT" | jq -r '.agent_id')

if [ "$API_KEY" = "null" ] || [ -z "$API_KEY" ]; then
  echo "Error: Registration failed."
  echo "$RESULT" | jq .
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Registration successful!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Agent ID: $AGENT_ID"
echo "Address:  $ADDRESS"
echo "Funded:   $FUNDED"
echo ""
echo "API Key (save this — shown once):"
echo "  $API_KEY"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Connect with Claude Code:"
echo ""
echo "  claude mcp add agentgate \\"
echo "    --transport http \\"
echo "    --url \"$MCP_URL\" \\"
echo "    --header \"Authorization: Bearer $API_KEY\""
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Or add to settings.json:"
echo ""
cat <<EOF
  {
    "mcpServers": {
      "agentgate": {
        "type": "http",
        "url": "$MCP_URL",
        "headers": {
          "Authorization": "Bearer $API_KEY"
        }
      }
    }
  }
EOF
echo ""
