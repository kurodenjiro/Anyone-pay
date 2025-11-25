# Setup Instructions

## Quick Start

### 1. Fix npm Permissions (if needed)

If you encounter npm permission errors, run:

```bash
sudo chown -R $(whoami) ~/.npm
```

Or use a different npm cache location:

```bash
npm config set cache ~/.npm-cache
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:

```env
# NEAR Configuration
NEXT_PUBLIC_NEAR_NETWORK=mainnet
NEXT_PUBLIC_CONTRACT_ID=anyone-pay.near
NEXT_PUBLIC_INTENTS_CONTRACT=intents.near
X402_FACILITATOR=x402.near

# Optional: 1-Click API JWT (without JWT incurs 0.1% fee on swaps)
ONE_CLICK_JWT=your_jwt_token_here
ONE_CLICK_API_URL=https://api.1click.fi
```

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Optional: Deploy Smart Contract

If you want to deploy the smart contract:

```bash
# Install NEAR CLI
npm install -g near-cli

# Login to mainnet
near login

# Build contract
cd contract
cargo build --target wasm32-unknown-unknown --release

# Deploy
near deploy --wasmFile target/wasm32-unknown-unknown/release/anyone_pay.wasm --accountId anyone-pay.near
```

## Troubleshooting

### npm Permission Errors

If you still have permission issues:

1. **Option 1**: Fix ownership
   ```bash
   sudo chown -R $(whoami) ~/.npm
   ```

2. **Option 2**: Use different cache
   ```bash
   npm config set cache ~/.npm-cache
   ```

3. **Option 3**: Use npx with --yes flag
   ```bash
   npm install --legacy-peer-deps
   ```

### Missing Dependencies

If some packages fail to install:

```bash
npm install --legacy-peer-deps
```

### TypeScript Errors

These should resolve after `npm install`. If not:

```bash
npm run build
```

This will show any actual TypeScript errors.

