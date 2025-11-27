#!/bin/bash
set -e

NETWORK=${1:-mainnet}
CONTRACT_ID=${2:-data-drop.near}

echo "Deploying data drop contract to $NETWORK..."
echo "Contract ID: $CONTRACT_ID"

# Build the contract first
./build.sh

# Deploy the contract
near contract deploy $CONTRACT_ID \
    use-file target/wasm32-unknown-unknown/release/data_drop.wasm \
    with-init-call new \
    json-args "{\"owner_id\":\"$CONTRACT_ID\"}" \
    prepaid-gas "30.0 Tgas" \
    attached-deposit "0 NEAR" \
    network-config $NETWORK \
    sign-with-keychain \
    send

echo "✅ Contract deployed successfully!"
echo "🔗 Explorer: https://explorer.$NETWORK.near.org/accounts/$CONTRACT_ID"

