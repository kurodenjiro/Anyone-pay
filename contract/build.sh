#!/bin/bash
set -e

cargo build --target wasm32-unknown-unknown --release
cp target/wasm32-unknown-unknown/release/anyone_pay.wasm ./res/

