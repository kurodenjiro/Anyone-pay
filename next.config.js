/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_NEAR_NETWORK: process.env.NEXT_PUBLIC_NEAR_NETWORK || 'testnet',
    NEXT_PUBLIC_CONTRACT_ID: process.env.NEXT_PUBLIC_CONTRACT_ID || 'anyone-pay.testnet',
    NEXT_PUBLIC_INTENTS_CONTRACT: process.env.NEXT_PUBLIC_INTENTS_CONTRACT || 'intents.testnet',
    X402_FACILITATOR: process.env.X402_FACILITATOR || 'x402.near',
  },
}

module.exports = nextConfig

