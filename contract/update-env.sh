#!/bin/bash
set -e

# This script parses contract deployment data and updates .env.local
# Run this after deploying the contract

ACCOUNT_ID="anyone-pay.near"
X402_FACILITATOR="x402.near"
INTENTS_CONTRACT="intents.near"
NETWORK="mainnet"

ENV_FILE="../.env.local"

echo "📝 Updating .env.local with contract deployment data..."
echo ""

# Check if .env.local exists, create if not
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env.local..."
    touch "$ENV_FILE"
fi

# Function to update or add env variable
update_env() {
    local key=$1
    local value=$2
    
    if grep -q "^$key=" "$ENV_FILE"; then
        # Update existing value
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^$key=.*|$key=$value|" "$ENV_FILE"
        else
            sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
        fi
        echo "✅ Updated $key=$value"
    else
        # Add new value
        echo "$key=$value" >> "$ENV_FILE"
        echo "✅ Added $key=$value"
    fi
}

# Update environment variables
update_env "NEXT_PUBLIC_NEAR_NETWORK" "$NETWORK"
update_env "NEXT_PUBLIC_CONTRACT_ID" "$ACCOUNT_ID"
update_env "NEXT_PUBLIC_INTENTS_CONTRACT" "$INTENTS_CONTRACT"
update_env "X402_FACILITATOR" "$X402_FACILITATOR"

echo ""
echo "✅ .env.local updated successfully!"
echo ""
echo "📋 Contract Configuration:"
echo "   Network: $NETWORK"
echo "   Contract ID: $ACCOUNT_ID"
echo "   Intents Contract: $INTENTS_CONTRACT"
echo "   X402 Facilitator: $X402_FACILITATOR"


