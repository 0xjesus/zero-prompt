# ZeroPrompt - Hackathon Submission

## 1. How does your project work under the hood?

### The Problem We Solve

Every developer has asked a friend: *"Hey, can I borrow your API key?"* You want to test GPT-4 or Claude, but you don't want a $20/month subscription for a few prompts. **ZeroPrompt is that friend**—a universal gateway to 300+ AI models where you pay only for what you consume.

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React Native (Expo SDK 51) - Single codebase for Web, iOS, Android |
| **Blockchain** | Avalanche C-Chain |
| **Wallet Integration** | WalletConnect / Reown AppKit |
| **Payment Protocol** | x402 (HTTP 402 Payment Required) |
| **Smart Contracts** | Solidity (ERC-8004 for AI Reputation) |

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Native   │────▶│  ZeroPrompt API │────▶│  AI Providers   │
│  (Web/Mobile)   │     │  (api.0prompt.xyz)    │  (OpenAI, etc)  │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         │                       ▼
         │              ┌─────────────────┐
         └─────────────▶│ Avalanche C-Chain│
                        │ - Billing Vault  │
                        │ - Reputation     │
                        │ - x402 Payments  │
                        └─────────────────┘
```

### Two Payment Modes

1. **Chat Mode (Vault):** Users deposit AVAX into a smart contract. Each AI request deducts the exact cost in real-time. No subscriptions.

2. **x402 Protocol (Developer Mode):** Atomic pay-per-request. Your code sends a request → receives HTTP 402 with price → signs payment → gets response. Supports gasless USDC (EIP-3009) or direct AVAX.

### Key Integrations

- **OpenRouter API:** Access to 300+ AI models (GPT-4, Claude, Mistral, Llama, Flux, etc.)
- **Avalanche C-Chain:** All payments and reputation data on-chain
- **WalletConnect:** Universal wallet connection across all platforms
- **ERC-8004 (Custom):** Decentralized AI model reputation and discovery

### Smart Contracts (Avalanche Mainnet)

| Contract | Address | Purpose |
|----------|---------|---------|
| **Billing Vault** | `0x773c9849F15Ac7484232767536Fe5495B5E231e9` | Holds user AVAX deposits for Chat Mode |
| **Reputation Registry** | `0x3A7e2E328618175bfeb1d1581a79aDf999214c7d` | ERC-8004 for AI model ratings |
| **USDC** | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | Stablecoin for x402 gasless payments |

#### Billing Vault Contract

The Billing Vault is the core of Chat Mode. It's a simple but effective pattern:

```
1. User deposits AVAX → stored in contract mapped to their wallet
2. User sends AI request → backend calculates cost from OpenRouter pricing
3. Backend deducts cost from user's balance (off-chain tracking, on-chain settlement)
4. User can withdraw remaining balance anytime
```

Key functions:
- `deposit()` - Add AVAX to your balance
- `withdraw(amount)` - Withdraw unused credits
- `getBalance(address)` - Check current balance

This removes the friction of per-request transactions while keeping funds non-custodial (users control withdrawals).

#### Reputation Registry (ERC-8004)

Custom standard for decentralized AI model reputation:
- Users rate models after using them (1-5 stars + category tags)
- Ratings stored on-chain, transparent and immutable
- Enables filtering models by community trust scores
- Prevents providers from gaming centralized leaderboards

---

## 2. Project Continuity & Development

### Is this based on a pre-existing idea?

**Yes, but it required a complete rebuild.**

The original concept emerged from a real frustration: fragmented access to AI models. I had previously attempted to solve this by building a token-based system that combined crypto payments with AI access. That approach failed—it was overcomplicated, mixing tokenomics with utility in a way that confused users and added unnecessary friction.

### What changed for this hackathon?

I stripped everything down to the core problem: **"I just want to use AI without managing API keys or subscriptions."**

The rebuild focused on:

1. **Simplicity first:** No token, no staking, no complex DeFi mechanics. Just connect wallet → deposit → use AI.

2. **x402 Protocol:** Implemented the HTTP 402 payment standard for atomic, per-request payments. This is the "developer mode" that enables AI agents to autonomously pay for their own compute.

3. **Cross-platform from day one:** Built with React Native (Expo) to ensure the same experience on web, iOS, and Android.

4. **On-chain reputation (ERC-8004):** With 300+ models, discovery becomes a problem. The reputation system lets users rate models on-chain, creating transparent and unfakeable quality signals.

### Hackathon Contributions

Everything you see was built/rebuilt during the hackathon:
- Complete React Native app (web + mobile)
- x402 payment protocol implementation
- Billing Vault smart contract
- ERC-8004 Reputation Registry
- Firebase App Distribution pipeline for mobile testing
- Production deployment on Avalanche mainnet

The previous failed attempt gave me clarity on what *not* to build. This version solves one thing well: **universal, pay-as-you-go AI access.**
