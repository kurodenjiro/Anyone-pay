#!/bin/bash
set -e

ACCOUNT_ID="anyone-pay.near"
INTENT_ID="test-intent-$(date +%s)"

echo "🧪 Testing Anyone Pay Contract"
echo ""

# Test 1: Create an intent
echo "1️⃣ Creating test intent: $INTENT_ID"
near contract call-function as-transaction $ACCOUNT_ID \
    function create_intent \
    args "{\"intent_id\":\"$INTENT_ID\",\"intent_type\":\"payment\",\"deposit_address\":\"zs1test123456789\",\"amount\":\"100000000000000000000000\",\"redirect_url\":\"https://test.com\"}" \
    prepaid-gas "30.0 Tgas" \
    attached-deposit "0 NEAR" \
    network-config mainnet \
    sign-with-keychain \
    send

echo ""
echo "✅ Intent created!"
echo ""

# Test 2: Get intent
echo "2️⃣ Getting intent: $INTENT_ID"
near contract call-function as-read-only $ACCOUNT_ID \
    function get_intent \
    args "{\"intent_id\":\"$INTENT_ID\"}" \
    network-config testnet

echo ""
echo "✅ Contract tests completed!"


