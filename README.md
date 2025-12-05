# ZeroPrompt

**Pay-per-request AI. No subscriptions. No API keys. Just USDC.**

ZeroPrompt is an AI platform where you pay only for what you use. Connect your wallet, pick a model, and pay per request with USDC on Avalanche. Gas fees are sponsored—you only pay for the AI.

🌐 **Live Demo:** [0prompt.xyz](https://0prompt.xyz)

---

## The Problem

Using AI today requires:
- Monthly subscriptions you might not fully use
- Managing API keys and rate limits
- Understanding complex pricing tiers
- Trusting centralized platforms with your data

## The Solution

ZeroPrompt flips the model:

| Traditional AI | ZeroPrompt |
|----------------|------------|
| $20/month subscription | Pay per request |
| API keys required | Just connect wallet |
| Single model access | 300+ models |
| You pay gas fees | Gas sponsored |

---

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Connect   │────▶│   Select    │────▶│     Pay     │
│   Wallet    │     │   Model     │     │   & Chat    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │
   Reown AppKit      300+ Models         EIP-3009
   (WalletConnect)   from $0.001        Gasless USDC
```

### Payment Flow (x402 Protocol)

1. **User sends request** → Server returns HTTP 402 with price
2. **User signs payment** → EIP-3009 authorization (no gas needed)
3. **Server verifies & executes** → Transfers USDC, returns AI response

```
POST /agent/generate
│
├─ No X-Payment header? → 402 Payment Required
│                         { price: "0.05", token: "USDC" }
│
└─ Valid X-Payment? → Execute AI request
                      Return response
```

---

## Features

### For Users

- **300+ AI Models** — GPT-4, Claude, Llama, Mistral, Flux, DALL-E, and more
- **Transparent Pricing** — See cost before every request
- **No Commitments** — Pay $0.001 or $1, your choice
- **Gas Sponsored** — Only pay USDC, we cover Avalanche gas

### For Developers

- **x402 Protocol** — Standard HTTP 402 payment flow
- **Simple Integration** — One header, one signature
- **Multi-language SDKs** — cURL, TypeScript, Python examples included

---

## Live Demos

Visit [0prompt.xyz/x402](https://0prompt.xyz/x402) to try:

### Model Battle
Compare 2-4 models side-by-side on the same prompt. See which performs better for your use case.

### AI Consensus
Ask multiple models the same question. A judge model analyzes responses and identifies agreement levels.

### Image Gallery
Generate images with multiple AI art models simultaneously. Compare styles and quality.

---

## Technical Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        Frontend                            │
│  React Native + Expo │ Reown AppKit │ Wagmi/Viem          │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                      x402 Middleware                       │
│  HTTP 402 Challenge │ EIP-3009 Verification │ Gas Sponsor │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                     AI Provider Layer                      │
│           300+ Models │ Text │ Images │ Code              │
└────────────────────────────────────────────────────────────┘
```

### Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native, Expo Router, TypeScript |
| Wallet | Reown AppKit (WalletConnect Protocol) |
| Payments | EIP-3009 TransferWithAuthorization |
| Blockchain | Avalanche C-Chain |
| Backend | Node.js, Express, Prisma |
| Token | USDC (native gasless transfers) |

### Why EIP-3009?

EIP-3009 is USDC's native standard for gasless transfers:

```typescript
// User signs this (no gas required)
TransferWithAuthorization {
  from: userAddress,
  to: merchantAddress,
  value: amount,
  validAfter: timestamp,
  validBefore: timestamp,
  nonce: randomBytes32
}

// Server executes (server pays gas)
usdc.transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s)
```

**Benefits:**
- Users never pay gas
- Works with any EOA wallet
- Native USDC support (no wrapping)
- Simple signature-based authorization

---

## API Reference

### Generate (Text/Image)

```bash
curl -X POST 'https://api.0prompt.xyz/agent/generate' \
  -H 'Content-Type: application/json' \
  -H 'X-Payment: <base64-encoded-eip3009-signature>' \
  -d '{
    "model": "anthropic/claude-3-haiku",
    "prompt": "Explain quantum computing"
  }'
```

### Response (No Payment)

```json
{
  "status": 402,
  "x402Version": 2,
  "accepts": [{
    "scheme": "x402-eip3009",
    "network": "avalanche",
    "token": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    "price": "0.05",
    "gasSponsored": true
  }]
}
```

### Response (With Payment)

```json
{
  "success": true,
  "result": "Quantum computing uses quantum bits (qubits)...",
  "model": "anthropic/claude-3-haiku",
  "usage": { "prompt_tokens": 12, "completion_tokens": 150 }
}
```

---

## Pricing

| Endpoint | Cost | Description |
|----------|------|-------------|
| `/agent/generate` | $0.05 | Single model request |
| `/agent/battle` | $0.10 | Compare up to 4 models |
| `/agent/consensus` | $0.08 | Multi-model voting |
| `/agent/image-gallery` | $0.15 | Generate with 3 image models |

*Prices cover AI inference costs. Gas is always sponsored.*

---

## Running Locally

### Prerequisites

- Node.js 18+
- MySQL database
- Avalanche RPC access

### Setup

```bash
# Clone repository
git clone https://github.com/0xjesus/zero-prompt.git
cd zero-prompt

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your values

# Run database migrations
cd apps/api && npx prisma migrate dev

# Start development servers
npm run dev
```

### Environment Variables

```env
# Required
DATABASE_URL=mysql://...
PRIVATE_KEY=0x...  # Server wallet for gas sponsorship
X402_MERCHANT_ADDRESS=0x...  # Receives USDC payments

# Optional
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
```

---

## Project Structure

```
zero-prompt/
├── apps/
│   ├── api/                 # Express backend
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   │   └── x402.ts  # Payment verification
│   │   │   ├── routes/
│   │   │   │   └── agent.ts # AI endpoints
│   │   │   └── services/
│   │   └── prisma/
│   │
│   └── zeroprompt/          # React Native frontend
│       ├── app/             # Expo Router pages
│       ├── components/
│       └── lib/
│           └── constants.ts # Chain config
│
└── docs/
```

---

## Security

- **Non-custodial** — We never hold your funds
- **Signature-based** — Payments require your explicit signature
- **Time-bounded** — Authorizations expire (validBefore)
- **Replay-protected** — Unique nonce per transaction
- **Open source** — Verify the code yourself

---

## Links

- **Live App:** [0prompt.xyz](https://0prompt.xyz)
- **x402 Demo:** [0prompt.xyz/x402](https://0prompt.xyz/x402)
- **GitHub:** [github.com/0xjesus/zero-prompt](https://github.com/0xjesus/zero-prompt)

---

## License

MIT

---

<p align="center">
  <strong>Pay for AI like you pay for coffee. One request at a time.</strong>
</p>
