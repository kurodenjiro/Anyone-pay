# Deploy Contract Guide

This guide will help you deploy the Anyone Pay contract to NEAR mainnet and update your environment variables.

## Prerequisites

1. **NEAR CLI installed**: `npm install -g near-cli`
2. **Logged in to NEAR**: Run `near login` and complete authentication in browser
3. **Mainnet account**: The contract will be deployed to `anyone-pay.near`

## Step 1: Build the Contract

The contract is already built, but if you need to rebuild:

```bash
cd contract
cargo build --target wasm32-unknown-unknown --release
```

## Step 2: Login to NEAR

```bash
near login
```

This will open a browser window. Complete the authentication process.

## Step 3: Deploy the Contract

```bash
cd contract
./deploy.sh
```

Or manually:

```bash
near contract deploy anyone-pay.near \
    use-file target/wasm32-unknown-unknown/release/anyone_pay.wasm \
    with-init-call new \
    json-args '{"x402_facilitator":"x402.near","intents_contract":"intents.near"}' \
    prepaid-gas "30.0 Tgas" \
    attached-deposit "0 NEAR" \
    network-config mainnet \
    sign-with-keychain \
    send
```

## Step 4: Test the Contract

```bash
cd contract
./test-contract.sh
```

This will:
- Create a test intent
- Retrieve the intent to verify it was stored correctly

## Step 5: Update Environment Variables

After successful deployment, update your `.env.local`:

```bash
cd contract
./update-env.sh
```

Or manually add to `.env.local`:

```env
NEXT_PUBLIC_NEAR_NETWORK=mainnet
NEXT_PUBLIC_CONTRACT_ID=anyone-pay.near
NEXT_PUBLIC_INTENTS_CONTRACT=intents.near
X402_FACILITATOR=x402.near
```

## Verify Deployment

Check the contract on NEAR Explorer:
- Mainnet: https://explorer.near.org/accounts/anyone-pay.near

## Contract Methods

### View Methods
- `get_intent(intent_id: String)` - Get intent by ID

### Change Methods
- `create_intent(intent_id, intent_type, deposit_address, amount, redirect_url)` - Create new intent
- `mark_funded(intent_id)` - Mark intent as funded (relayer only)
- `execute_x402_payment(intent_id, amount, recipient)` - Execute x402 payment
- `verify_deposit(intent_id)` - Verify deposit via NEAR Intents

## Troubleshooting

### "Account not found"
Create the account first:
```bash
near create-account anyone-pay.near --masterAccount YOUR_ACCOUNT.near --initialBalance 10
```

### "Access key not found"
Make sure you're logged in:
```bash
near login
```

### Contract deployment fails
- Check you have enough NEAR in your account
- Verify the WASM file exists: `ls -lh target/wasm32-unknown-unknown/release/anyone_pay.wasm`
- Check network: `near network-config mainnet`


