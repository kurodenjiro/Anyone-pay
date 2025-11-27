#!/bin/bash
set -e

echo "Building data drop contract..."

# Build the contract
cargo build --target wasm32-unknown-unknown --release

echo "✅ Contract built successfully!"
echo "📦 Output: target/wasm32-unknown-unknown/release/data_drop.wasm"

