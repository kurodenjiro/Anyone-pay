# Deployment Guide

## Quick Deploy to Vercel

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Anyone Pay - NEAR Intents + x402"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect Next.js
   - Add environment variables:
     - `NEXT_PUBLIC_NEAR_NETWORK=mainnet`
     - `NEXT_PUBLIC_CONTRACT_ID=anyone-pay.near`
     - `NEXT_PUBLIC_INTENTS_CONTRACT=intents.near`
     - `X402_FACILITATOR=x402.near`
   - Deploy!

3. **Your live URL will be:**
   ```
   https://anyone-pay.vercel.app
   ```
   (or your custom domain)

## Relayer (Now Integrated)

The relayer is now part of the Next.js API routes and deploys automatically with Vercel!

**Vercel Cron Jobs:**
- Automatically configured in `vercel.json`
- Checks deposits and executes x402 payments every 5 seconds via `/api/relayer/cronjob-check-deposits`
- No separate deployment needed!

**API Endpoints:**
- `POST /api/relayer/register-deposit` - Register deposit addresses
- `POST /api/relayer/check-deposit` - Check deposit status
- `POST /api/relayer/submit-tx-hash` - Submit transaction hash to speed up swap
- `POST /api/relayer/refund` - Handle refunds
- `GET /api/relayer/cronjob-check-deposits` - Cronjob to check deposits and execute x402 payments
- `GET /api/relayer/test-supabase` - Test Supabase connection (development only)

## Deploy Contract to NEAR

1. **Install NEAR CLI:**
   ```bash
   npm install -g near-cli
   ```

2. **Login:**
   ```bash
   near login
   ```

3. **Build contract:**
   ```bash
   cd contract
   ./build.sh
   ```

4. **Deploy:**
   ```bash
   near deploy --wasmFile target/wasm32-unknown-unknown/release/anyone_pay.wasm --accountId anyone-pay.near
   ```

## One-Click Deploy Buttons

### Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/Anyone-pay)

### Note
The relayer is now integrated into Next.js - no separate Fly.io deployment needed!

