# Anyone Pay

**Private cross-chain x402 payments for merchants. Powered by AI, NEAR Intents & Chain Signatures.**

A production-ready payment platform that enables private, cross-chain payments with AI-powered intent recognition and automatic payment execution.

## 🌐 Live URL

**Deploy to Vercel to get your live URL:**
- After deployment: `https://anyone-pay.vercel.app` (or your custom domain)
- See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions

## 🚀 Features

- **Privacy-First Payments**: Zcash shielded transactions (zk-SNARKs) hide amounts, sender, and recipient
- **Cross-Chain Interoperability**: Automatic bridging from Zcash to Base/Solana via 1-Click API
- **AI-Powered Intent Recognition**: Natural language processing to understand payment intents
- **Semantic Service Matching**: AI-powered search matches user queries to services (e.g., "Pay onlyfan" → OnlyFans)
- **NEAR Chain Signatures**: MPC-based key management for cross-chain transaction signing
- **x402 Payment Protocol**: HTTP 402 standard with automatic payment verification and execution
- **One-Click Service Creation**: Merchants can create payment services without technical knowledge
- **QR Code Payments**: Simple QR code scanning for Zcash deposits
- **Automatic Payment Execution**: Server-side cronjobs handle payment verification and execution
- **Real-Time Status Tracking**: Polling system tracks deposit and payment status
- **URL-Based State Persistence**: Bookmarkable deposit links restore full payment state

## 🏗️ Architecture

```
├── app/                  # Next.js 15 App Router
│   ├── api/              # API routes
│   │   ├── parse-intent/ # Intent parsing with NEAR AI
│   │   ├── services/    # Service management (CRUD)
│   │   ├── intent/      # Intent execution with X402
│   │   └── relayer/      # Relayer endpoints
│   └── intent/          # Intent execution page
├── components/           # React components
├── contract/             # Rust smart contract (NEAR SDK)
├── lib/                  # Utilities
│   ├── dataDrop.ts      # Encrypted Data Drop management
│   ├── serviceRegistry.ts # Service registry with semantic search
│   ├── nearAI.ts        # NEAR AI Cloud integration
│   └── supabase.ts      # Supabase client
└── supabase-setup.sql   # Database schema
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, Tailwind CSS, Framer Motion, qrcode.react
- **Blockchain**: 
  - NEAR Protocol (Chain Signatures for MPC signing)
  - Ethereum/Base (x402 payments via USDC)
  - Zcash (private deposits)
- **Cross-Chain**: 1-Click API for Zcash ↔ USDC swaps
- **Chain Signatures**: NEAR MPC contract for Ethereum transaction signing
- **AI**: OpenAI for embeddings, NEAR AI Cloud for intent analysis
- **Database**: Supabase (PostgreSQL with pgvector for semantic search)
- **Payment Protocol**: HTTP 402 (x402) standard
- **Libraries**: 
  - `ethers` v5.7.2 (Ethereum interactions)
  - `chainsig.js` (EVM chain adapter)
  - `near-api-js` (NEAR interactions)
  - `viem` (Ethereum public client)
- **Deployment**: Vercel (frontend + API + Cron Jobs), NEAR mainnet, Supabase

## 📦 Setup

### Prerequisites

- Node.js 18+ and npm
- **NEAR Account**: Mainnet account with Chain Signature access (for x402 payments)
- **OpenAI API Key**: Required for semantic search embeddings ([Get one here](https://platform.openai.com/api-keys))
- **Supabase Account**: Required for service storage and deposit tracking ([Sign up here](https://supabase.com))
- **NEAR AI Cloud API Key**: Optional, for advanced intent analysis ([Get one here](https://cloud.near.ai))

### 1. Install Dependencies

```bash
# Frontend (includes API routes)
npm install

# Contract
cd contract
cargo build --target wasm32-unknown-unknown --release
```

### 2. NEAR Chain Signatures Setup

Anyone Pay uses NEAR Chain Signatures (MPC) for signing Ethereum transactions. You need:

- A NEAR account with access to the Chain Signature MPC contract
- The account's private key for signing MPC requests

The system uses the MPC contract to sign Ethereum transactions without exposing private keys.

### 3. Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Run the SQL setup script:
   - Go to SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase-setup.sql`
   - Click Run to execute
3. Get your Supabase credentials:
   - Go to Settings > API
   - Copy your Project URL and anon key

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions.

### 4. Environment Variables

Create `.env.local`:

```env
# NEAR Configuration
NEXT_PUBLIC_NEAR_NETWORK=mainnet
NEAR_PROXY_ACCOUNT_ID=your-near-account.near
NEAR_PROXY_CONTRACT_ID=v1.signer
NEAR_PROXY_PRIVATE_KEY=ed25519:your-private-key-here

# OpenAI API Key (required for semantic search embeddings)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Supabase Configuration (required for service storage and deposit tracking)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# 1-Click API (for cross-chain swaps)
ONE_CLICK_API_URL=https://api.1click.fi
ONE_CLICK_JWT=your_jwt_token_here  # Optional: reduces swap fees

# NEAR AI Cloud (optional, for advanced intent analysis)
NEAR_AI_API_KEY=your-near-ai-api-key-here
```

### 5. Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

## 📚 Documentation

- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Supabase setup guide
- [SUPABASE_ENV_VARS.md](./SUPABASE_ENV_VARS.md) - Supabase environment variables
- [DEPLOY_CONTRACT.md](./DEPLOY_CONTRACT.md) - Contract deployment guide

## 🔐 Security

- **Private Payments**: Zcash shielded transactions hide all transaction details
- **MPC Key Management**: NEAR Chain Signatures use Multi-Party Computation - no single point of key failure
- **x402 Payment Verification**: Server-side verification ensures payment before content delivery
- **Semantic Search Threshold**: Only returns matches above similarity threshold (default: 0.6)
- **No KYC Required**: Small transactions don't require identity verification

## 🎯 Usage

### For Merchants

1. **Create a Service**: Click "Create a new payment service" on homepage
2. **Enter Details**: Service name, amount, currency, receiving address, and redirect URL
3. **Share Link**: Customers can find your service via natural language search

### For Customers

1. **Search**: Type what you want to pay for (e.g., "Pay onlyfan")
2. **AI Matching**: System finds matching service using semantic search
3. **Scan QR Code**: Deposit Zcash to the generated address
4. **Automatic Processing**: System bridges Zcash to USDC and executes x402 payment
5. **Access Content**: Redirected to premium content after payment verification

## 🤝 Contributing

This is a production-ready app. Feel free to fork and customize!

## 📄 License

MIT
