#!/usr/bin/env bash
#
# deploy-subnet.sh - Create and deploy the ZeroPrompt Avalanche subnet
#
# Usage:
#   ./scripts/deploy-subnet.sh          # Deploy locally (default)
#   ./scripts/deploy-subnet.sh --local  # Deploy locally
#   ./scripts/deploy-subnet.sh --fuji   # Deploy to Fuji testnet (requires funded P-Chain wallet)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GENESIS_FILE="$PROJECT_DIR/subnet/genesis.json"
DEPLOYMENT_INFO="$PROJECT_DIR/subnet/deployment-info.json"
SUBNET_NAME="zeroprompt"

# Parse arguments
DEPLOY_TARGET="local"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fuji)
      DEPLOY_TARGET="fuji"
      shift
      ;;
    --local)
      DEPLOY_TARGET="local"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--local|--fuji]"
      echo ""
      echo "  --local   Deploy to local avalanche network runner (default)"
      echo "  --fuji    Deploy to Fuji testnet (requires funded P-Chain wallet)"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo ""
echo "========================================================================"
echo "  ZeroPrompt Subnet Deployment"
echo "========================================================================"
echo "  Target:  $DEPLOY_TARGET"
echo "  Genesis: $GENESIS_FILE"
echo ""

# --- 1. Check / install avalanche-cli ---

if ! command -v avalanche &>/dev/null; then
  echo "[1/5] avalanche-cli not found. Installing..."
  curl -sSfL https://raw.githubusercontent.com/ava-labs/avalanche-cli/main/scripts/install.sh | sh -s
  export PATH="$HOME/bin:$PATH"

  if ! command -v avalanche &>/dev/null; then
    echo "ERROR: avalanche-cli installation failed. Please install manually:"
    echo "  https://docs.avax.network/tooling/cli-guides/install-avalanche-cli"
    exit 1
  fi
  echo "  avalanche-cli installed successfully."
else
  echo "[1/5] avalanche-cli found: $(avalanche --version 2>/dev/null || echo 'unknown version')"
fi

# --- 2. Validate genesis file ---

echo "[2/5] Validating genesis file..."
if [[ ! -f "$GENESIS_FILE" ]]; then
  echo "ERROR: Genesis file not found at $GENESIS_FILE"
  exit 1
fi

CHAIN_ID=$(python3 -c "import json; print(json.load(open('$GENESIS_FILE'))['config']['chainId'])" 2>/dev/null || echo "unknown")
echo "  Chain ID: $CHAIN_ID"

# --- 3. Create the subnet ---

echo "[3/5] Creating subnet '$SUBNET_NAME'..."

# Remove existing subnet config if present (avalanche-cli stores state)
if avalanche subnet describe "$SUBNET_NAME" &>/dev/null; then
  echo "  Subnet '$SUBNET_NAME' already exists in CLI config. Removing old config..."
  avalanche subnet delete "$SUBNET_NAME" 2>/dev/null || true
fi

avalanche subnet create "$SUBNET_NAME" \
  --evm \
  --genesis "$GENESIS_FILE" \
  --force

echo "  Subnet created."

# --- 4. Deploy the subnet ---

echo "[4/5] Deploying subnet to '$DEPLOY_TARGET'..."

if [[ "$DEPLOY_TARGET" == "local" ]]; then
  avalanche subnet deploy "$SUBNET_NAME" --local
elif [[ "$DEPLOY_TARGET" == "fuji" ]]; then
  echo ""
  echo "  NOTE: Fuji deployment requires a funded P-Chain wallet."
  echo "  You will be prompted for your private key or ledger."
  echo ""
  avalanche subnet deploy "$SUBNET_NAME" --fuji
fi

# --- 5. Extract deployment info ---

echo "[5/5] Extracting deployment info..."

# Capture the output of subnet describe
DESCRIBE_OUTPUT=$(avalanche subnet describe "$SUBNET_NAME" 2>&1 || true)

# Try to extract the RPC URL and blockchain ID from the describe output
BLOCKCHAIN_ID=$(echo "$DESCRIBE_OUTPUT" | grep -oP 'Blockchain ID[:\s]+\K[a-zA-Z0-9]+' || echo "")
SUBNET_ID=$(echo "$DESCRIBE_OUTPUT" | grep -oP 'Subnet ID[:\s]+\K[a-zA-Z0-9]+' || echo "")

if [[ "$DEPLOY_TARGET" == "local" ]]; then
  RPC_URL="http://127.0.0.1:9650/ext/bc/${BLOCKCHAIN_ID}/rpc"
else
  RPC_URL="https://api.avax-test.network/ext/bc/${BLOCKCHAIN_ID}/rpc"
fi

# Save deployment info
cat > "$DEPLOYMENT_INFO" <<EOF
{
  "subnetId": "$SUBNET_ID",
  "blockchainId": "$BLOCKCHAIN_ID",
  "rpcUrl": "$RPC_URL",
  "chainId": $CHAIN_ID,
  "vmId": "subnetevm",
  "deployTarget": "$DEPLOY_TARGET",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo ""
echo "========================================================================"
echo "  Deployment Complete!"
echo "========================================================================"
echo ""
echo "  Subnet ID:      $SUBNET_ID"
echo "  Blockchain ID:  $BLOCKCHAIN_ID"
echo "  RPC URL:         $RPC_URL"
echo "  Chain ID:        $CHAIN_ID"
echo ""
echo "  Deployment info saved to: subnet/deployment-info.json"
echo ""
echo "  Next steps:"
echo "    1. Deploy contracts:"
echo "       npx hardhat run scripts/deploy-subnet.ts --network zeropromptSubnet"
echo ""
echo "    2. Update configs:"
echo "       npx ts-node scripts/update-subnet-config.ts"
echo ""
echo "========================================================================"
