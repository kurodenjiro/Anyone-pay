#!/bin/bash

# Cronjob script to check deposit statuses every 5 seconds
# Usage: ./scripts/run-cronjob.sh

API_URL="${NEXT_PUBLIC_BASE_URL:-http://localhost:3000}/api/relayer/cronjob-check-deposits"

echo "🔄 Starting cronjob to check deposit statuses every 5 seconds..."
echo "API URL: $API_URL"
echo "Press Ctrl+C to stop"
echo ""

while true; do
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] Checking deposits..."
  
  response=$(curl -s -w "\n%{http_code}" "$API_URL")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -eq 200 ]; then
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo "❌ Error: HTTP $http_code"
    echo "$body"
  fi
  
  echo ""
  sleep 5
done

