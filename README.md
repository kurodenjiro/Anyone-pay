# Anyone Pay

**The ultimate real-world x402 + NEAR Intents app**

Built live for you by Grok – NEAR Intents Deposit Flow

## 🌐 Live URL

**Deploy to Vercel to get your live URL:**
- After deployment: `https://anyone-pay.vercel.app` (or your custom domain)
- See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions

## 🚀 Features

- **AI-Native UI**: Full-screen ambient gradient background with floating input that appears on click
- **NEAR Intents Integration**: Generate QR codes for deposit addresses using NEAR Intents SDK
- **Intent Execution Flow**: Beautiful animated diagram showing deposit → funding → swap → x402 payment → content unlock
- **Real x402 Payments**: Integrated with Coinbase Facilitator for USDC payments
- **Multiple Intent Types**:
  - Weather forecasts (10-day premium data)
  - AI image generation
  - **Cross-chain token swaps** (NEAR ↔ USDC via 1-Click API & NEAR Intents)
  - Purchase intents (milk tea example)
- **Real NEAR Intents Integration**: Uses [1-Click SDK](https://github.com/near-examples/near-intents-examples) for actual deposit addresses and swap execution

## 🏗️ Architecture

```
├── app/                  # Next.js 15 App Router
│   └── api/              # API routes
│       ├── parse-intent/ # Intent parsing
│       └── relayer/      # Relayer endpoints (register, check, poll, get-tokens)
├── components/           # React components (FloatingInput, IntentsQR, IntentFlowDiagram)
├── contract/             # Rust smart contract (NEAR SDK)
└── lib/                  # Utilities (intent parser, NEAR connection, 1-Click SDK, deposit tracking)
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, Tailwind CSS, Framer Motion, shadcn/ui, qrcode.react
- **Blockchain**: NEAR Protocol, NEAR Intents SDK, x402 (Coinbase Facilitator)
- **1-Click SDK**: [@defuse-protocol/one-click-sdk-typescript](https://github.com/near-examples/near-intents-examples) for cross-chain swaps
- **Smart Contract**: Rust + NEAR SDK
- **Relayer**: Next.js API Routes (integrated with 1-Click API)
- **AI Agent**: Next.js API Routes (integrated)
- **Deployment**: Vercel (frontend + API + Cron Jobs), NEAR testnet (contract)

## 📦 Setup

### Prerequisites

- Node.js 20+
- Rust (for contract compilation)
- NEAR CLI

### 1. Install Dependencies

```bash
# Frontend (includes API routes)
npm install

# Contract
cd contract
cargo build --target wasm32-unknown-unknown --release
```

### 2. NEAR Setup

```bash
# Install NEAR CLI
npm install -g near-cli

# Login to testnet
near login

# Deploy contract
cd contract
near deploy --wasmFile target/wasm32-unknown-unknown/release/anyone_pay.wasm --accountId anyone-pay.testnet
```

### 3. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_CONTRACT_ID=anyone-pay.testnet
NEXT_PUBLIC_INTENTS_CONTRACT=intents.testnet
X402_FACILITATOR=x402.near

# Optional: 1-Click API JWT (without JWT incurs 0.1% fee on swaps)
# Request JWT here: https://1click.fi
ONE_CLICK_JWT=your_jwt_token_here
ONE_CLICK_API_URL=https://api.1click.fi
```

### 4. Run Locally

```bash
# Frontend
npm run dev
```

## 🎯 Usage

1. **Click anywhere** on the screen to reveal the floating input
2. **Type your request** (e.g., "10-day weather forecast for Tokyo" or "Swap 2 NEAR to USDC")
3. **Press Enter** to submit
4. **Scan QR code** or copy deposit address to send NEAR
5. **Watch the flow** as your intent executes:
   - Deposit to NEAR Intents Address (real address from 1-Click API for swaps)
   - Intent Funding
   - Cross-Chain Swap (if needed, via 1-Click API)
   - x402 Payment (USDC)
   - Content Unlock
6. **Automatic redirect** to premium content with access token

## 🔄 Intent Flow

```
User Query
    ↓
Next.js API Routes (parse intent)
    ↓
Generate NEAR Intents Deposit Address
    ↓
  - For swaps: Get real deposit address from 1-Click API
  - For others: Generate mock address
    ↓
Display QR Code + Flow Diagram
    ↓
User Deposits NEAR (via wallet scan/transfer)
    ↓
Relayer Polls for Deposit Confirmation
    ↓
  - Check swap status via 1-Click API (if swap intent)
  - Or check NEAR Intents contract
    ↓
Mark Intent as Funded (contract)
    ↓
Execute x402 Payment (USDC via Coinbase Facilitator)
    ↓
Generate Access Token
    ↓
Redirect to Premium Content URL
```

## 🧪 Testnet Features

- Auto-faucet: 10 NEAR on first wallet connect (testnet only)
- Real 1-Click API integration for cross-chain swaps
- Testnet contract deployment ready

## 📝 Example Queries

- `"10-day weather forecast for Tokyo"`
- `"Generate an image of a cyberpunk dragon"`
- `"Swap 2 NEAR to USDC"` - **Uses real 1-Click API for cross-chain swap**
- `"Buy me a large milk tea"`

## 🚢 Deployment

### Frontend (Vercel)

```bash
vercel --prod
```

### Relayer (Integrated)

The relayer is now part of Next.js API routes and deploys automatically with Vercel. No separate deployment needed!

### Contract (NEAR)

```bash
cd contract
near deploy --wasmFile target/wasm32-unknown-unknown/release/anyone_pay.wasm --accountId anyone-pay.testnet
```

## 📚 API Endpoints

### Intent Parsing
- `POST /api/parse-intent` - Parse user queries into structured intents

### Relayer
- `POST /api/relayer/register-deposit` - Register deposit addresses (uses 1-Click API for swaps)
- `POST /api/relayer/check-deposit` - Check deposit status (uses 1-Click API for swap status)
- `GET /api/relayer/poll-deposits` - Poll for confirmations (called by Vercel Cron)
- `GET /api/relayer/access-token/[intentId]` - Generate access tokens
- `GET /api/relayer/get-tokens` - Get available tokens from 1-Click API
- `GET /api/relayer/health` - Health check

## 🔗 Resources

- [NEAR Intents Examples](https://github.com/near-examples/near-intents-examples) - Educational examples we integrated
- [1-Click API Docs](https://1click.fi)
- [1-Click TypeScript SDK](https://github.com/near-examples/near-intents-examples)
- [NEAR Intents Explorer](https://explorer.near-intents.org)
- [NEAR Protocol Documentation](https://docs.near.org)

## 📄 License

MIT

## 🙏 Credits

Built with NEAR Protocol, x402, NEAR Intents SDK, and [1-Click API](https://github.com/near-examples/near-intents-examples).

---

**Live at: https://anyone-pay.vercel.app**
