# Data Drop Contract

A NEAR smart contract for managing encrypted data drops with Chain Signatures support.

## Overview

This contract allows users to:
- Create data drops with encrypted content
- Generate limited access keys for claiming drops
- Store IPFS CIDs for off-chain data
- Claim drops using Chain Signatures

## Structure

Based on [x-drop contract](https://github.com/kurodenjiro/x-drop) but simplified:
- Removed Bitcoin transaction creation
- Simplified drop structure
- Added IPFS CID storage
- Maintained access key pattern for secure claiming

## Building

```bash
./build.sh
```

## Deploying

```bash
# Deploy to mainnet
./deploy.sh mainnet data-drop.near

# Deploy to testnet
./deploy.sh testnet data-drop.testnet
```

## Contract Methods

### Owner Methods

- `add_drop(target, amount, funder, path, data_cid)` - Create a new data drop
- `remove_drop(drop_id)` - Remove a drop and all associated keys
- `add_drop_key(drop_id, key)` - Add an access key to a drop
- `remove_key(key)` - Remove a key from a drop

### Claim Methods

- `claim(receiver, change)` - Claim a data drop (can only be called by access key)

### View Methods

- `get_drops()` - Get all drop IDs
- `get_keys(drop_id)` - Get keys for a specific drop
- `get_drop(drop_id)` - Get drop details
- `store_data_cid(data_id, cid)` - Store IPFS CID
- `get_data_cid(data_id)` - Get IPFS CID

## Usage Example

```bash
# Add a drop
near call data-drop.near add_drop \
  '{"target": 1, "amount": "1000000000000000000", "funder": "funder.near", "path": "m/44'\''/60'\''/0'\''/0/0", "data_cid": "QmXXX..."}' \
  --accountId owner.near

# Add access key
near call data-drop.near add_drop_key \
  '{"drop_id": 1, "key": "ed25519:XXX"}' \
  --accountId owner.near

# Claim drop (using access key)
near call data-drop.near claim \
  '{"receiver": "receiver.near", "change": 0}' \
  --accountId data-drop.near \
  --useAccountId data-drop.near
```

