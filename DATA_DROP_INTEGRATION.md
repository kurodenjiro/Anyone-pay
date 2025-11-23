# Encrypted Data Drop Integration with NEAR Intents

This document explains how the Encrypted Data Drop mechanism is integrated with NEAR Intents and X402 payments.

## Overview

Instead of storing direct URLs in the database, we use **Encrypted Data Drop** with resource keys (Public Key A / Linkdrop Keys). This provides:

1. **Security**: No direct URLs exposed
2. **Payment Integration**: X402 payment standard integration
3. **Intent-Based**: Users describe desired outcome, Intent Solver handles execution
4. **Automatic Execution**: Solver optimizes and executes transactions

## Architecture

### 1. Service Creation Flow

```
User creates service
  ↓
Generate Key Pair (Public Key A + Private Key A)
  ↓
Store resource_key (Public Key A) in database
  ↓
Store encrypted Private Key A (for Intent Solver)
  ↓
Generate embedding for semantic search
```

### 2. Intent Definition

When a user queries matches a service, we create a NEAR Intent:

```typescript
{
  intentType: 'RetrieveEncryptedData',
  contractId: 'data-drop.testnet',
  resourceKey: 'ed25519:PublicKeyA...',
  action: 'claim_data', // or 'create_account_and_claim_data'
  requiredPayment: {
    amount: '0.1',
    token: 'NEAR' // or 'DATA_TOKEN', 'USDC'
  }
}
```

### 3. X402 Payment Flow

```
User clicks resource key URL (/intent/{resourceKey})
  ↓
GET /api/intent/{resourceKey}
  ↓
Check X402 payment requirement from contract
  ↓
If payment required:
  - Return HTTP 402 with payment details
  - Intent Solver receives X402 response
  - Solver creates token transfer transaction
  - Execute payment
  - Then execute original intent (claim_data)
```

### 4. Intent Solver Role

The Intent Solver (wallet or backend service):

1. **Reads** Private Key A from data drop
2. **Optimizes** transaction (knows it must call `claim_data()`)
3. **Executes** X402 payment if required
4. **Signs** transaction using Private Key A
5. **Submits** to NEAR network
6. **Returns** decrypted data to user

## Database Schema

### payment_services
- `resource_key` (TEXT) - Public Key A (Linkdrop Key)
- `contract_id` (TEXT) - Data Drop Smart Contract address
- `url` (TEXT) - Legacy support, deprecated

### data_drops
- `resource_key` (TEXT, UNIQUE) - Public Key A
- `contract_id` (TEXT) - Smart Contract address
- `encrypted_data` (TEXT) - Encrypted payload
- `required_payment_amount` (TEXT) - Payment amount
- `required_payment_token` (TEXT) - Payment token type
- `intent_type` (TEXT) - 'RetrieveEncryptedData'
- `action` (TEXT) - 'claim_data' or 'create_account_and_claim_data'
- `private_key_encrypted` (TEXT) - Encrypted Private Key A

## API Endpoints

### GET /api/intent/[resourceKey]

Returns the NEAR Intent and X402 payment requirements.

**Response (Payment Required):**
```json
{
  "intent": {
    "intentType": "RetrieveEncryptedData",
    "contractId": "data-drop.testnet",
    "resourceKey": "ed25519:...",
    "action": "claim_data",
    "requiredPayment": {
      "amount": "0.1",
      "token": "NEAR"
    }
  },
  "x402": {
    "required": true,
    "amount": "0.1",
    "token": "NEAR",
    "destination": "data-drop.testnet",
    "message": "Payment required to access encrypted data"
  }
}
```
**Status Code:** 402 Payment Required

### POST /api/intent/[resourceKey]

Executes the intent after payment.

**Request:**
```json
{
  "accountId": "user.testnet",
  "privateKey": "..." // Optional, can use stored private key
}
```

**Response:**
```json
{
  "success": true,
  "data": "decrypted-data-payload",
  "transactionHash": "abc123..."
}
```

## Integration Steps

1. **Create Service**: User creates service → generates data drop → stores resource key
2. **User Query**: "Pay ticket move Kiki deliver series"
3. **Semantic Search**: Matches service → returns resource key
4. **Intent Creation**: Creates NEAR Intent with resource key
5. **X402 Check**: Checks if payment required
6. **Payment Execution**: Intent Solver handles payment
7. **Data Retrieval**: Solver calls `claim_data()` using Private Key A
8. **Data Return**: Decrypted data returned to user

## Security Considerations

1. **Private Key Encryption**: Private Key A should be encrypted before storing
2. **Access Control**: Only Intent Solver should have access to Private Key A
3. **Payment Verification**: Verify payment before executing data retrieval
4. **Resource Key Validation**: Validate resource key format before processing

## Environment Variables

```env
NEXT_PUBLIC_DATA_DROP_CONTRACT=data-drop.testnet
```

## Smart Contract Requirements

The Data Drop Smart Contract should implement:

1. `claim_data(resource_key: PublicKey)` - Claim encrypted data
2. `create_account_and_claim_data(resource_key: PublicKey, account_id: AccountId)` - Create account and claim
3. `check_payment_required(resource_key: PublicKey)` - Check X402 requirement (view method)

## Future Enhancements

- [ ] Encrypt Private Key A before storing
- [ ] Implement actual NEAR Intent Solver
- [ ] Add payment verification on-chain
- [ ] Support multiple payment tokens
- [ ] Add data expiration/revocation

