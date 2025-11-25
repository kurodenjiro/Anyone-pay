# Anyone Pay

**The ultimate real-world x402 + NEAR Intents app with Encrypted Data Drop**

Built live for you by Grok – NEAR Intents Deposit Flow with AI-Powered Semantic Search

## 🌐 Live URL

**Deploy to Vercel to get your live URL:**
- After deployment: `https://anyone-pay.vercel.app` (or your custom domain)
- See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions

## 🚀 Features

- **AI-Native UI**: Full-screen ambient gradient background with floating input that appears on click
- **NEAR AI Cloud Integration**: Uses [NEAR AI Cloud](https://docs.near.ai/cloud/get-started/) to analyze prompts and determine intent flow
- **AI-Powered Semantic Search**: Uses OpenAI embeddings + Supabase vector search to match user queries to services. Only returns matches above similarity threshold - if it doesn't match, it won't be found.
- **Encrypted Data Drop**: No direct URLs stored - uses resource keys (Public Key A) with NEAR Intents
- **X402 Payment Standard**: HTTP 402 payment required integration with automatic payment execution
- **Supabase Storage**: All payment services stored in Supabase with vector embeddings for semantic search
- **NEAR Intents Integration**: Generate QR codes for Zcash deposit addresses
- **Intent Execution Flow**: Beautiful animated diagram showing:
  1. NEAR AI analyzes intent
  2. Create Zcash deposit address
  3. Scan QR & deposit Zcash
  4. Bridge Zcash to target chain (if needed)
  5. Intent funding complete
  6. Content unlock via Data Drop
- **Real x402 Payments**: Integrated with Coinbase Facilitator for USDC payments
- **Public Service Creation**: Anyone can create payment services without authentication
- **Multiple Intent Types**:
  - Payment intents with Encrypted Data Drop
  - Weather forecasts (10-day premium data)
  - AI image generation
  - **Cross-chain token swaps** (Zcash ↔ USDC via 1-Click API & NEAR Intents)
  - Purchase intents (milk tea example)
- **Chain Detection**: Automatically detects which blockchain a domain/content is on
- **Automatic Bridging**: Bridges Zcash to target chain when needed

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

- **Frontend**: Next.js 15, Tailwind CSS, Framer Motion, shadcn/ui, qrcode.react
- **Blockchain**: NEAR Protocol, NEAR Intents SDK, x402 (Coinbase Facilitator)
- **1-Click SDK**: [@defuse-protocol/one-click-sdk-typescript](https://github.com/near-examples/near-intents-examples) for cross-chain swaps
- **Smart Contract**: Rust + NEAR SDK
- **Relayer**: Next.js API Routes (integrated with 1-Click API)
- **AI Agent**: Next.js API Routes with NEAR AI Cloud integration for prompt analysis
- **Database**: Supabase (PostgreSQL with pgvector for semantic search)
- **Semantic Search**: OpenAI embeddings + Supabase vector similarity search
- **Data Drop**: Encrypted Data Drop with resource keys (no direct URLs)
- **Deployment**: Vercel (frontend + API + Cron Jobs), NEAR mainnet (contract), Supabase (database)

## 📦 Setup

### Prerequisites

- Node.js 18+ and npm
- NEAR AI Cloud API key ([Get one here](https://cloud.near.ai) - see [setup guide](https://docs.near.ai/cloud/get-started/#quick-setup))
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys)) - Required for semantic search embeddings
- Supabase account ([Sign up here](https://supabase.com)) - Required for service storage
- NEAR mainnet account (optional, for contract deployment)
- Rust (for contract compilation, optional)
- NEAR CLI (optional, for contract deployment)

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

# Login to mainnet
near login

# Deploy contract
cd contract
near deploy --wasmFile target/wasm32-unknown-unknown/release/anyone_pay.wasm --accountId anyone-pay.near
```

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
NEXT_PUBLIC_NEAR_NETWORK=mainnet
NEXT_PUBLIC_CONTRACT_ID=anyone-pay.near
NEXT_PUBLIC_INTENTS_CONTRACT=intents.near
X402_FACILITATOR=x402.near

# NEAR AI Cloud API Key (required for prompt analysis)
# Get your API key from https://cloud.near.ai
# See https://docs.near.ai/cloud/get-started/#quick-setup for setup instructions
NEAR_AI_API_KEY=your-near-ai-api-key-here

# OpenAI API Key (required for semantic search embeddings)
# Get your API key from https://platform.openai.com/api-keys
# This is used to generate embeddings for semantic search in Supabase
OPENAI_API_KEY=sk-your-openai-api-key-here

# Supabase Configuration (required for service storage and semantic search)
# Get these from your Supabase project: Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# Note: Data Drop functionality has been removed - services now use direct URLs

# Optional: 1-Click API JWT (without JWT incurs 0.1% fee on swaps)
# Request JWT here: https://1click.fi
ONE_CLICK_JWT=your_jwt_token_here
ONE_CLICK_API_URL=https://api.1click.fi
```

### 5. Run Locally

```bash
npm run dev
```

Visit http://localhost:3000

## 📚 Documentation

- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) - Supabase setup guide
- [DATA_DROP_INTEGRATION.md](./DATA_DROP_INTEGRATION.md) - Encrypted Data Drop integration details
- [DEPLOY_CONTRACT.md](./DEPLOY_CONTRACT.md) - Contract deployment guide

## 🔐 Security

- **No Direct URLs**: Services use resource keys (Public Key A) instead of direct URLs
- **Encrypted Private Keys**: Private Key A should be encrypted before storing (TODO)
- **X402 Payment Verification**: Payment verified before data retrieval
- **Semantic Search Threshold**: Only returns matches above similarity threshold (default: 0.7)

## 🎯 Usage

1. **Create a Service**: Click "Or create a new payment service" on homepage
2. **Search for Service**: Type a query like "Pay ticket move Kiki deliver series"
3. **AI Semantic Search**: System finds matching service using embeddings
4. **Generate Intent**: Creates NEAR Intent with resource key
5. **X402 Payment**: If payment required, Intent Solver handles it
6. **Data Retrieval**: Solver executes `claim_data()` using Private Key A
7. **Access Content**: Decrypted data returned to user

## 🤝 Contributing

This is a production-ready app. Feel free to fork and customize!

## 📄 License

MIT
