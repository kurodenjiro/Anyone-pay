#!/bin/bash
set -e

echo "🚀 Deploying Anyone Pay Contract to NEAR Testnet"
echo ""

# Check if contract is built
if [ ! -f "target/wasm32-unknown-unknown/release/anyone_pay.wasm" ]; then
    echo "❌ Contract not built. Building now..."
    cargo build --target wasm32-unknown-unknown --release
fi

# Contract account
ACCOUNT_ID="anyone-pay.testnet"
X402_FACILITATOR="x402.near"
INTENTS_CONTRACT="intents.testnet"

echo "📦 Contract WASM size:"
ls -lh target/wasm32-unknown-unknown/release/anyone_pay.wasm

echo ""
echo "🔐 Make sure you're logged in to NEAR:"
echo "   Run: near login"
echo ""

# Deploy contract
echo "📤 Deploying contract to $ACCOUNT_ID..."
near contract deploy $ACCOUNT_ID \
    use-file target/wasm32-unknown-unknown/release/anyone_pay.wasm \
    with-init-call new \
    json-args "{\"x402_facilitator\":\"$X402_FACILITATOR\",\"intents_contract\":\"$INTENTS_CONTRACT\"}" \
    prepaid-gas "30.0 Tgas" \
    attached-deposit "0 NEAR" \
    network-config testnet \
    sign-with-keychain \
    send

echo ""
echo "✅ Contract deployed!"
echo ""
echo "📋 Contract Details:"
echo "   Account ID: $ACCOUNT_ID"
echo "   Network: testnet"
echo "   X402 Facilitator: $X402_FACILITATOR"
echo "   Intents Contract: $INTENTS_CONTRACT"
echo ""
echo "🧪 Testing contract..."

# Test: Create an intent
INTENT_ID="test-intent-$(date +%s)"
echo "   Creating test intent: $INTENT_ID"
near contract call-function as-transaction $ACCOUNT_ID \
    function create_intent \
    args "{\"intent_id\":\"$INTENT_ID\",\"intent_type\":\"payment\",\"deposit_address\":\"zs1test123\",\"amount\":\"100000000000000000000000\",\"redirect_url\":\"https://test.com\"}" \
    prepaid-gas "30.0 Tgas" \
    attached-deposit "0 NEAR" \
    network-config testnet \
    sign-with-keychain \
    send

# Test: Get intent
echo "   Getting intent: $INTENT_ID"
near contract call-function as-read-only $ACCOUNT_ID \
    function get_intent \
    args "{\"intent_id\":\"$INTENT_ID\"}" \
    network-config testnet \
    network-config testnet

echo ""
echo "✅ Contract tested successfully!"
echo ""
echo "📝 Updating .env.local..."
cd ..
./contract/update-env.sh

