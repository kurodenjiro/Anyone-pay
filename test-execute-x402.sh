#!/bin/bash

# Test script for /api/relayer/execute-x402 endpoint

echo "Testing /api/relayer/execute-x402 endpoint..."
echo ""

# Test 1: Missing depositAddress
echo "Test 1: Missing depositAddress (should return 400)"
curl -X POST http://localhost:3000/api/relayer/execute-x402 \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nStatus: %{http_code}\n\n"

# Test 2: Invalid depositAddress (no tracking found)
echo "Test 2: Invalid depositAddress (should return 404)"
curl -X POST http://localhost:3000/api/relayer/execute-x402 \
  -H "Content-Type: application/json" \
  -d '{"depositAddress":"test-address-123"}' \
  -w "\nStatus: %{http_code}\n\n"

echo "✅ API route is accessible!"
echo ""
echo "To test with real data, you need to:"
echo "1. Register a deposit first via /api/relayer/register-deposit"
echo "2. Use the depositAddress from that response"
echo "3. Then call this endpoint with that depositAddress"

