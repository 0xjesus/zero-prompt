# ZeroPrompt: Complete Technical & Business Guide
# ZeroPrompt: Guía Completa Técnica y de Negocio

---

# TABLE OF CONTENTS / ÍNDICE

## Part 1: Project Overview / Visión General del Proyecto
1. [What is ZeroPrompt?](#1-what-is-zeroprompt--qué-es-zeroprompt)
2. [The Problems We Solve](#2-the-problems-we-solve--los-problemas-que-resolvemos)
3. [Our Solution Architecture](#3-our-solution-architecture--nuestra-arquitectura-de-solución)

## Part 2: Smart Contracts / Contratos Inteligentes
4. [ZeroPromptBilling Contract](#4-zeropromptbilling-contract--contrato-zeropromptbilling)
5. [Smart Contract Security](#5-smart-contract-security--seguridad-del-smart-contract)
6. [Chainlink Price Feeds](#6-chainlink-price-feeds--oráculos-de-precio-chainlink)

## Part 3: Payment Systems / Sistemas de Pago
7. [Human Users: Credit System](#7-human-users-credit-system--usuarios-humanos-sistema-de-créditos)
8. [AI Agents: x402 Protocol](#8-ai-agents-x402-protocol--agentes-ia-protocolo-x402)
9. [Payment Flow Comparison](#9-payment-flow-comparison--comparación-de-flujos-de-pago)

## Part 4: Technical Implementation / Implementación Técnica
10. [Backend Architecture](#10-backend-architecture--arquitectura-del-backend)
11. [Frontend Architecture](#11-frontend-architecture--arquitectura-del-frontend)
12. [Quote & Pricing System](#12-quote--pricing-system--sistema-de-cotización-y-precios)

## Part 5: Business & Value / Negocio y Valor
13. [Value Proposition](#13-value-proposition--propuesta-de-valor)
14. [Economic Model](#14-economic-model--modelo-económico)
15. [Competitive Advantages](#15-competitive-advantages--ventajas-competitivas)

## Part 6: Demo & Future / Demo y Futuro
16. [Live Demo Guide](#16-live-demo-guide--guía-de-demo-en-vivo)
17. [Roadmap](#17-roadmap--hoja-de-ruta)

---

# PART 1: PROJECT OVERVIEW
# PARTE 1: VISIÓN GENERAL DEL PROYECTO

---

## 1. What is ZeroPrompt? / ¿Qué es ZeroPrompt?

### English

**ZeroPrompt** is a decentralized AI gateway that provides:

1. **For Human Users**: Access to 300+ AI models with pay-per-use billing via blockchain credits
2. **For AI Agents**: Autonomous machine-to-machine payments via the x402 protocol

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ZEROPROMPT PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────────┐              ┌──────────────┐           ┌─────────────┐│
│    │   HUMANS     │              │  AI AGENTS   │           │   300+ AI   ││
│    │              │              │              │           │   MODELS    ││
│    │  - Web App   │              │  - Bots      │           │             ││
│    │  - Mobile    │              │  - Scripts   │           │  - GPT-4    ││
│    │  - API       │              │  - Services  │           │  - Claude   ││
│    └──────┬───────┘              └──────┬───────┘           │  - Gemini   ││
│           │                             │                   │  - DALL-E   ││
│           │ Credit System               │ x402 Protocol     │  - Llama    ││
│           │ (Smart Contract)            │ (Per-request)     │  - Flux     ││
│           │                             │                   │  - etc...   ││
│           ▼                             ▼                   └─────────────┘│
│    ┌─────────────────────────────────────────────┐                        │
│    │            ZEROPROMPT GATEWAY               │                        │
│    │                                             │                        │
│    │  • Wallet Authentication                    │                        │
│    │  • On-chain Credit Management               │                        │
│    │  • x402 Payment Verification                │                        │
│    │  • Multi-model Routing                      │                        │
│    │  • Real-time Pricing                        │                        │
│    └─────────────────────────────────────────────┘                        │
│                           │                                               │
│                           ▼                                               │
│    ┌─────────────────────────────────────────────┐                        │
│    │         AVALANCHE C-CHAIN                   │                        │
│    │                                             │                        │
│    │  • ZeroPromptBilling Smart Contract         │                        │
│    │  • Chainlink Price Feeds (AVAX/USD)         │                        │
│    │  • Sub-second Finality                      │                        │
│    │  • ~$0.01 Transaction Fees                  │                        │
│    └─────────────────────────────────────────────┘                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

**ZeroPrompt** es un gateway de IA descentralizado que proporciona:

1. **Para Usuarios Humanos**: Acceso a más de 300 modelos de IA con facturación de pago-por-uso vía créditos en blockchain
2. **Para Agentes de IA**: Pagos autónomos máquina-a-máquina vía el protocolo x402

**Características Clave:**
- Sin suscripciones mensuales - paga solo por lo que usas
- Sin KYC - solo conecta tu wallet
- Sin lock-in de proveedor - accede a GPT-4, Claude, Gemini, DALL-E y más
- Precios en tiempo real - basados en precio actual de AVAX y costos del modelo
- Código abierto y verificable en blockchain

---

## 2. The Problems We Solve / Los Problemas que Resolvemos

### English

#### Problem 1: The AI Subscription Trap

| Traditional AI Services | ZeroPrompt |
|------------------------|------------|
| $20-30/month per service | Pay-per-token (often <$1/month) |
| Locked into one provider | Access 300+ models |
| Unused allocation wasted | Only pay for actual usage |
| Email/phone/KYC required | Just a wallet address |
| Data used for training | No data retention |
| Rate limits even when paying | Pay more = use more |

**Real Example:**
- ChatGPT Plus: $20/month = $240/year
- Typical user sends ~100 messages/month
- Actual cost at our rates: ~$0.50/month = $6/year
- **Savings: 97.5%**

#### Problem 2: AI Agents Can't Pay Autonomously

Current situation:
1. Developer creates AI agent
2. Agent needs to call external AI API
3. ❌ Agent cannot sign up for API keys
4. ❌ Agent cannot provide payment method
5. ❌ Agent cannot manage billing
6. Result: Human must do everything manually

With ZeroPrompt x402:
1. Developer creates AI agent with crypto wallet
2. Agent needs to call AI API
3. ✅ Agent sends request, receives 402 + price
4. ✅ Agent autonomously sends AVAX payment
5. ✅ Agent receives AI response
6. Result: Fully autonomous operation

### Español

#### Problema 1: La Trampa de Suscripciones de IA

| Servicios IA Tradicionales | ZeroPrompt |
|---------------------------|------------|
| $20-30/mes por servicio | Pago-por-token (frecuentemente <$1/mes) |
| Encerrado en un proveedor | Acceso a 300+ modelos |
| Asignación no usada se desperdicia | Solo paga por uso real |
| Email/teléfono/KYC requerido | Solo una dirección de wallet |
| Datos usados para entrenamiento | Sin retención de datos |
| Límites de tasa aún pagando | Paga más = usa más |

#### Problema 2: Los Agentes de IA No Pueden Pagar Autónomamente

Situación actual:
1. Desarrollador crea agente de IA
2. Agente necesita llamar API externa de IA
3. ❌ Agente no puede registrarse para claves API
4. ❌ Agente no puede proporcionar método de pago
5. ❌ Agente no puede gestionar facturación
6. Resultado: Humano debe hacer todo manualmente

Con ZeroPrompt x402:
1. Desarrollador crea agente de IA con wallet crypto
2. Agente necesita llamar API de IA
3. ✅ Agente envía solicitud, recibe 402 + precio
4. ✅ Agente autónomamente envía pago AVAX
5. ✅ Agente recibe respuesta de IA
6. Resultado: Operación completamente autónoma

---

## 3. Our Solution Architecture / Nuestra Arquitectura de Solución

### English

ZeroPrompt has **two parallel payment systems** optimized for different use cases:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ZEROPROMPT DUAL PAYMENT SYSTEM                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────┐  ┌─────────────────────────────────┐ │
│   │     CREDIT SYSTEM (Humans)      │  │    x402 PROTOCOL (Agents)       │ │
│   ├─────────────────────────────────┤  ├─────────────────────────────────┤ │
│   │                                 │  │                                 │ │
│   │  WHO: Web/Mobile Users          │  │  WHO: AI Agents, Bots, Scripts  │ │
│   │                                 │  │                                 │ │
│   │  HOW IT WORKS:                  │  │  HOW IT WORKS:                  │ │
│   │  1. Connect wallet              │  │  1. Send request (no auth)      │ │
│   │  2. Deposit AVAX → Get credits  │  │  2. Receive 402 + price         │ │
│   │  3. Use AI models               │  │  3. Send AVAX payment           │ │
│   │  4. Credits deducted on-chain   │  │  4. Retry with tx proof         │ │
│   │                                 │  │  5. Receive AI response         │ │
│   │  BENEFITS:                      │  │                                 │ │
│   │  • Pre-funded account           │  │  BENEFITS:                      │ │
│   │  • Instant AI responses         │  │  • No account needed            │ │
│   │  • Track usage history          │  │  • Pay-per-request              │ │
│   │  • Free credits for new users   │  │  • Fully autonomous             │ │
│   │                                 │  │  • Machine-readable pricing     │ │
│   │  SMART CONTRACT:                │  │                                 │ │
│   │  ZeroPromptBilling.sol          │  │  VERIFICATION:                  │ │
│   │  • Chainlink price feeds        │  │  Native AVAX transfer           │ │
│   │  • On-chain credit tracking     │  │  • On-chain verification        │ │
│   │  • Usage history records        │  │  • Replay attack prevention     │ │
│   │                                 │  │                                 │ │
│   └─────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

ZeroPrompt tiene **dos sistemas de pago paralelos** optimizados para diferentes casos de uso:

| Aspecto | Sistema de Créditos (Humanos) | Protocolo x402 (Agentes) |
|---------|------------------------------|--------------------------|
| **Usuario** | Personas vía web/móvil | Agentes IA, bots, scripts |
| **Autenticación** | Firma de wallet | Ninguna necesaria |
| **Flujo de Pago** | Depositar → Usar → Deducir | Por-solicitud |
| **Donde vive el saldo** | Smart contract | No hay saldo (pago directo) |
| **Velocidad** | Instantáneo (pre-fondeo) | ~2 segundos (verificación tx) |
| **Ideal para** | Uso interactivo frecuente | Pagos autónomos programáticos |

---

# PART 2: SMART CONTRACTS
# PARTE 2: CONTRATOS INTELIGENTES

---

## 4. ZeroPromptBilling Contract / Contrato ZeroPromptBilling

### English

The `ZeroPromptBilling.sol` smart contract is the backbone of our credit system. It handles:

1. **User Registration & Credits**
2. **AVAX Deposits with USD Conversion**
3. **Usage Recording & Billing**
4. **Operator System for Backend**

#### Contract Address (Avalanche Mainnet)
```
Network: Avalanche C-Chain
Chain ID: 43114
Contract: [Deployed Address]
```

#### Core Data Structures

```solidity
struct UserAccount {
    uint256 creditsUSD;          // Credits in USD (18 decimals)
    uint256 totalDeposited;      // Total AVAX deposited (wei)
    uint256 totalUsedUSD;        // Total USD spent
    uint256 depositCount;        // Number of deposits
    uint256 lastDepositTime;     // Last deposit timestamp
    uint256 lastUsageTime;       // Last usage timestamp
    bool isActive;               // Account status
}

struct Deposit {
    address user;
    uint256 amountNative;        // AVAX amount (wei)
    uint256 amountUSD;           // USD value at deposit time
    uint256 priceAtDeposit;      // AVAX/USD price used
    uint256 timestamp;
    bytes32 txId;                // Tracking ID
}

struct UsageRecord {
    address user;
    uint256 amountUSD;           // Cost in USD
    string model;                // AI model used
    uint256 inputTokens;
    uint256 outputTokens;
    uint256 timestamp;
    bytes32 requestId;           // Tracking ID
}
```

#### Key Functions

```solidity
// USER FUNCTIONS
function deposit() external payable;
// - Converts AVAX to USD credits using Chainlink price
// - Auto-registers new users with free credits
// - Emits CreditsDeposited event

function getBalance(address user) external view returns (uint256);
// - Returns user's current USD credit balance

// OPERATOR FUNCTIONS (Backend only)
function recordUsage(
    address user,
    uint256 amountUSD,
    string model,
    uint256 inputTokens,
    uint256 outputTokens,
    bytes32 requestId
) external;
// - Deducts credits after AI usage
// - Only callable by authorized operators

function refundCredits(address user, uint256 amountUSD, string reason) external;
// - Refunds credits if AI request fails

// PRICE FUNCTIONS
function getNativeTokenPrice() public view returns (uint256);
// - Gets AVAX/USD price from Chainlink (8 decimals)

function calculateCredits(uint256 amountNative) external view returns (uint256);
// - Calculates how many USD credits for given AVAX amount
```

### Español

El contrato inteligente `ZeroPromptBilling.sol` es la columna vertebral de nuestro sistema de créditos. Maneja:

1. **Registro de Usuarios y Créditos**
2. **Depósitos AVAX con Conversión a USD**
3. **Registro de Uso y Facturación**
4. **Sistema de Operadores para Backend**

#### Flujo de Depósito

```
Usuario                    Smart Contract                 Chainlink
   │                            │                            │
   │  1. Envía AVAX             │                            │
   │ ──────────────────────────>│                            │
   │                            │  2. Consulta precio        │
   │                            │ ──────────────────────────>│
   │                            │                            │
   │                            │  3. Retorna AVAX/USD       │
   │                            │ <──────────────────────────│
   │                            │                            │
   │                            │  4. Calcula:               │
   │                            │     creditsUSD = AVAX ×    │
   │                            │                  precio    │
   │                            │                            │
   │  5. Créditos acreditados   │                            │
   │ <──────────────────────────│                            │
   │                            │                            │
   │  6. Evento emitido:        │                            │
   │     CreditsDeposited       │                            │
```

---

## 5. Smart Contract Security / Seguridad del Smart Contract

### English

Our contract implements multiple security patterns:

#### 1. OpenZeppelin Standards
```solidity
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
```

- **Ownable**: Only owner can modify critical parameters
- **ReentrancyGuard**: Prevents reentrancy attacks on deposit/withdraw
- **Pausable**: Emergency circuit breaker

#### 2. Operator System
```solidity
mapping(address => bool) public operators;

modifier onlyOperator() {
    require(operators[msg.sender] || msg.sender == owner(), "Not an operator");
    _;
}
```

Only authorized backend servers can:
- Record usage (deduct credits)
- Refund credits
- Grant free credits

Regular users can only:
- Deposit funds
- Read their balance

#### 3. Price Feed Validation
```solidity
function getNativeTokenPrice() public view returns (uint256) {
    (
        uint80 roundId,
        int256 price,
        ,
        uint256 updatedAt,
        uint80 answeredInRound
    ) = priceFeed.latestRoundData();

    require(price > 0, "Invalid price");
    require(answeredInRound >= roundId, "Stale price");
    require(block.timestamp - updatedAt <= PRICE_STALENESS_THRESHOLD, "Price too old");

    return uint256(price);
}
```

Protections:
- **Positive price check**: Rejects invalid/negative prices
- **Round validation**: Ensures data is from current round
- **Staleness check**: Price must be < 1 hour old

#### 4. Minimum Deposit
```solidity
uint256 public minDepositUSD = 1e18; // $1 USD minimum

require(amountUSD >= minDepositUSD, "Below minimum deposit");
```

Prevents spam/dust attacks.

### Español

#### Características de Seguridad

| Protección | Descripción | Importancia |
|------------|-------------|-------------|
| **ReentrancyGuard** | Previene ataques de reentrada | Crítica |
| **Pausable** | Interruptor de emergencia | Alta |
| **Ownable** | Control de acceso admin | Alta |
| **Sistema Operador** | Solo backend puede deducir créditos | Crítica |
| **Validación de Precio** | Verifica datos de Chainlink | Alta |
| **Depósito Mínimo** | Previene spam | Media |
| **Verificación de Stale** | Rechaza precios obsoletos | Alta |

---

## 6. Chainlink Price Feeds / Oráculos de Precio Chainlink

### English

We use Chainlink's decentralized oracle network for accurate AVAX/USD pricing.

#### Why Chainlink?
- **Decentralized**: Multiple node operators, no single point of failure
- **Proven**: Secures billions in DeFi
- **Accurate**: Aggregates prices from multiple exchanges
- **Fast**: Updates frequently based on deviation thresholds

#### Avalanche Mainnet Price Feed
```
AVAX/USD Price Feed: 0x0A77230d17318075983913bC2145DB16C7366156
Decimals: 8
Heartbeat: 120 seconds
Deviation Threshold: 0.5%
```

#### How We Use It

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHAINLINK PRICE FLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Multiple Exchanges           Chainlink Oracle Network         │
│   ─────────────────           ────────────────────────         │
│   • Binance                   • 31+ Independent Nodes           │
│   • Coinbase           ───>   • Aggregation Contract            │
│   • Kraken                    • Median Price Selection          │
│   • etc.                      • Deviation-triggered Updates     │
│                                                                 │
│                                        │                        │
│                                        ▼                        │
│                               ┌─────────────────┐               │
│                               │ AggregatorV3    │               │
│                               │ Interface       │               │
│                               │                 │               │
│                               │ latestRoundData │               │
│                               │ returns:        │               │
│                               │ • price (8 dec) │               │
│                               │ • timestamp     │               │
│                               │ • roundId       │               │
│                               └────────┬────────┘               │
│                                        │                        │
│                                        ▼                        │
│                         ┌──────────────────────────┐            │
│                         │   ZeroPromptBilling      │            │
│                         │                          │            │
│                         │   getNativeTokenPrice()  │            │
│                         │   • Validates freshness  │            │
│                         │   • Returns uint256      │            │
│                         └──────────────────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Price Calculation Example

```
User deposits: 1 AVAX
Chainlink price: $25.50 (stored as 2550000000 with 8 decimals)

Calculation:
creditsUSD = (1 AVAX * 2550000000) / 10^8
creditsUSD = 25.50 USD (stored as 25.5 * 10^18 with 18 decimals)

User receives: $25.50 in credits
```

### Español

#### ¿Por Qué Chainlink?

| Característica | Beneficio |
|----------------|-----------|
| **Descentralizado** | Sin punto único de falla |
| **Probado** | Asegura miles de millones en DeFi |
| **Preciso** | Agrega precios de múltiples exchanges |
| **Rápido** | Actualizaciones basadas en umbral de desviación |

#### Proceso de Precio

1. Múltiples exchanges reportan precios a nodos Chainlink
2. 31+ nodos independientes agregan datos
3. Contrato de agregación selecciona precio mediano
4. Nuestro contrato consulta `latestRoundData()`
5. Validamos frescura (< 1 hora) y validez
6. Usamos precio para convertir AVAX → USD

---

# PART 3: PAYMENT SYSTEMS
# PARTE 3: SISTEMAS DE PAGO

---

## 7. Human Users: Credit System / Usuarios Humanos: Sistema de Créditos

### English

The credit system is designed for interactive human users who want:
- **Pre-funded balance** for instant AI responses
- **Usage tracking** and history
- **Familiar deposit experience** (like adding funds to an account)

#### Complete User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HUMAN USER CREDIT JOURNEY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: CONNECT WALLET                                                     │
│  ─────────────────────                                                      │
│  User visits 0prompt.xyz                                                    │
│        │                                                                    │
│        ▼                                                                    │
│  Click "Connect Wallet" ──> MetaMask/Coinbase Wallet popup                 │
│        │                                                                    │
│        ▼                                                                    │
│  Sign authentication message (FREE - not a transaction)                     │
│        │                                                                    │
│        ▼                                                                    │
│  Backend verifies signature, creates session                                │
│        │                                                                    │
│        ▼                                                                    │
│  User sees: "Welcome! You have $0.50 free credits"                         │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STEP 2: DEPOSIT CREDITS                                                    │
│  ───────────────────────                                                    │
│  User clicks "Add Credits"                                                  │
│        │                                                                    │
│        ▼                                                                    │
│  Enters amount: "$10 worth of AVAX"                                         │
│        │                                                                    │
│        ▼                                                                    │
│  System calculates: $10 ÷ $25.50/AVAX = 0.392 AVAX                         │
│        │                                                                    │
│        ▼                                                                    │
│  User confirms transaction in wallet                                        │
│        │                                                                    │
│        ▼                                                                    │
│  Smart contract:                                                            │
│    • Receives 0.392 AVAX                                                    │
│    • Queries Chainlink for current price                                    │
│    • Calculates: 0.392 × $25.50 = $10.00                                   │
│    • Credits user account with $10.00                                       │
│    • Emits CreditsDeposited event                                          │
│        │                                                                    │
│        ▼                                                                    │
│  User sees: "Balance: $10.50" (includes $0.50 free)                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STEP 3: USE AI MODELS                                                      │
│  ─────────────────────                                                      │
│  User selects GPT-4, types prompt                                          │
│        │                                                                    │
│        ▼                                                                    │
│  Backend calculates cost: ~$0.003 for this request                         │
│        │                                                                    │
│        ▼                                                                    │
│  Backend verifies: user.creditsUSD >= $0.003 ✓                             │
│        │                                                                    │
│        ▼                                                                    │
│  AI request sent to provider (OpenRouter/OpenAI/etc)                        │
│        │                                                                    │
│        ▼                                                                    │
│  Response streams to user in real-time                                      │
│        │                                                                    │
│        ▼                                                                    │
│  Backend calls smart contract: recordUsage()                                │
│    • Deducts $0.003 from user balance                                       │
│    • Records: model, tokens, timestamp                                      │
│    • Emits CreditsUsed event                                               │
│        │                                                                    │
│        ▼                                                                    │
│  User sees: "Balance: $10.497"                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

#### Beneficios del Sistema de Créditos

| Beneficio | Descripción |
|-----------|-------------|
| **Respuestas Instantáneas** | Sin espera de confirmación de pago por solicitud |
| **Créditos Gratis** | $0.50 para nuevos usuarios para probar |
| **Historial On-chain** | Todos los depósitos y usos registrados en blockchain |
| **Protección de Precio** | Créditos en USD, inmunes a volatilidad de AVAX después del depósito |
| **Reembolsos** | Si un request falla, los créditos se restauran |

---

## 8. AI Agents: x402 Protocol / Agentes IA: Protocolo x402

### English

The x402 protocol implements HTTP 402 "Payment Required" for machine-to-machine payments.

#### What is HTTP 402?

HTTP 402 was defined in RFC 2616 (1999) as "reserved for future use" with this description:
> "This code might be used as part of some form of digital cash or micropayment scheme."

**25 years later, we're making it real.**

#### How x402 Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         x402 PROTOCOL FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AI AGENT                        ZEROPROMPT API                 AVALANCHE  │
│      │                                   │                            │     │
│      │  1. POST /agent/generate          │                            │     │
│      │     {model: "gpt-4",              │                            │     │
│      │      prompt: "Hello"}             │                            │     │
│      │ ─────────────────────────────────>│                            │     │
│      │                                   │                            │     │
│      │  2. HTTP 402 Payment Required     │                            │     │
│      │     {                             │                            │     │
│      │       "x402Version": 1,           │                            │     │
│      │       "accepts": [{               │                            │     │
│      │         "scheme": "native-tx",    │                            │     │
│      │         "network": "avalanche",   │                            │     │
│      │         "chainId": 43114,         │                            │     │
│      │         "asset": "AVAX",          │                            │     │
│      │         "payTo": "0x209F...",     │                            │     │
│      │         "maxAmountRequired":      │                            │     │
│      │           "50000000000000000"     │                            │     │
│      │       }]                          │                            │     │
│      │     }                             │                            │     │
│      │ <─────────────────────────────────│                            │     │
│      │                                   │                            │     │
│      │  3. Parse 402 response            │                            │     │
│      │     Agent understands:            │                            │     │
│      │     - Need to pay 0.05 AVAX       │                            │     │
│      │     - To address 0x209F...        │                            │     │
│      │     - On Avalanche (43114)        │                            │     │
│      │                                   │                            │     │
│      │  4. Send AVAX Transaction                                      │     │
│      │ ─────────────────────────────────────────────────────────────>│     │
│      │                                                                │     │
│      │  5. Receive Transaction Hash                                   │     │
│      │     "0xabc123..."                                              │     │
│      │ <─────────────────────────────────────────────────────────────│     │
│      │                                   │                            │     │
│      │  6. POST /agent/generate          │                            │     │
│      │     {model: "gpt-4",              │                            │     │
│      │      prompt: "Hello"}             │                            │     │
│      │     Headers:                      │                            │     │
│      │       X-PAYMENT: base64(          │                            │     │
│      │         {"txHash":"0xabc123..."}) │                            │     │
│      │ ─────────────────────────────────>│                            │     │
│      │                                   │  7. Verify on-chain        │     │
│      │                                   │ ───────────────────────────>│     │
│      │                                   │                            │     │
│      │                                   │  8. Verification checks:   │     │
│      │                                   │     ✓ Tx exists            │     │
│      │                                   │     ✓ Tx confirmed         │     │
│      │                                   │     ✓ Correct recipient    │     │
│      │                                   │     ✓ Sufficient amount    │     │
│      │                                   │     ✓ Not already used     │     │
│      │                                   │ <───────────────────────────│     │
│      │                                   │                            │     │
│      │  9. HTTP 200 OK                   │                            │     │
│      │     {                             │                            │     │
│      │       "result": "Hello! How       │                            │     │
│      │         can I help you today?",   │                            │     │
│      │       "model": "gpt-4",           │                            │     │
│      │       "usage": {...}              │                            │     │
│      │     }                             │                            │     │
│      │ <─────────────────────────────────│                            │     │
│      │                                   │                            │     │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### x402 Security Measures

```javascript
// 1. Transaction exists
const tx = await provider.getTransaction(txHash);
if (!tx) throw new Error("Transaction not found");

// 2. Transaction confirmed
const receipt = await provider.getTransactionReceipt(txHash);
if (!receipt || receipt.status !== 1) throw new Error("Transaction failed");

// 3. Correct recipient
if (tx.to.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
    throw new Error("Invalid recipient");
}

// 4. Sufficient amount
if (tx.value < requiredAmount) {
    throw new Error("Insufficient payment");
}

// 5. Replay attack prevention
if (usedTxHashes.has(txHash)) {
    throw new Error("Transaction already used");
}
usedTxHashes.add(txHash);
```

### Español

#### ¿Por Qué x402 para Agentes?

| Problema | Solución x402 |
|----------|---------------|
| Agentes no pueden tener cuentas API | No se necesita cuenta |
| Agentes no tienen tarjeta de crédito | Pagan con crypto |
| Agentes no pueden gestionar suscripciones | Pago-por-solicitud |
| Precios son opacos | 402 incluye precio exacto |
| No hay estándar para pagos M2M | x402 es el estándar |

#### Código Ejemplo para Agente

```python
import requests
import base64
from web3 import Web3

def call_zeroprompt_api(prompt, model="gpt-4"):
    # Step 1: Make initial request (will get 402)
    response = requests.post(
        "https://api.0prompt.xyz/agent/generate",
        json={"model": model, "prompt": prompt}
    )

    if response.status_code == 402:
        # Step 2: Parse payment requirements
        payment_info = response.json()["accepts"][0]
        amount_wei = int(payment_info["maxAmountRequired"])
        pay_to = payment_info["payTo"]

        # Step 3: Send AVAX payment
        tx_hash = send_avax_payment(pay_to, amount_wei)

        # Step 4: Retry with payment proof
        payment_header = base64.b64encode(
            json.dumps({"txHash": tx_hash}).encode()
        ).decode()

        response = requests.post(
            "https://api.0prompt.xyz/agent/generate",
            json={"model": model, "prompt": prompt},
            headers={"X-PAYMENT": payment_header}
        )

    return response.json()
```

---

## 9. Payment Flow Comparison / Comparación de Flujos de Pago

### English

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CREDIT SYSTEM vs x402 COMPARISON                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ASPECT              │ CREDIT SYSTEM         │ x402 PROTOCOL               │
│  ────────────────────┼───────────────────────┼─────────────────────────────│
│                      │                       │                             │
│  Target User         │ Humans (web/mobile)   │ AI Agents, Bots, Scripts    │
│                      │                       │                             │
│  Authentication      │ Wallet signature      │ None required               │
│                      │                       │                             │
│  Account Required    │ Yes (on-chain)        │ No                          │
│                      │                       │                             │
│  Payment Timing      │ Pre-fund, then use    │ Pay per request             │
│                      │                       │                             │
│  Speed per Request   │ Instant               │ ~2 seconds (verification)   │
│                      │                       │                             │
│  Balance Location    │ Smart contract        │ None (direct payment)       │
│                      │                       │                             │
│  Tx per Request      │ 0 (backend records)   │ 1 (user pays directly)      │
│                      │                       │                             │
│  Gas Cost per Use    │ 0 (operator pays)     │ ~$0.01 (user pays)          │
│                      │                       │                             │
│  Usage History       │ On-chain records      │ Transaction history only    │
│                      │                       │                             │
│  Free Credits        │ Yes ($0.50)           │ No                          │
│                      │                       │                             │
│  Refunds             │ Yes (operator can)    │ No (pre-verified payment)   │
│                      │                       │                             │
│  Best For            │ Interactive chat      │ Automated workflows         │
│                      │ Frequent usage        │ Occasional requests         │
│                      │ Human UX              │ Machine UX                  │
│                      │                       │                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

#### ¿Cuándo Usar Cada Sistema?

**Usa Sistema de Créditos cuando:**
- Eres una persona usando la interfaz web/móvil
- Envías muchos mensajes al día
- Quieres respuestas instantáneas sin esperar verificación
- Quieres trackear tu historial de uso detallado
- Quieres créditos gratis para empezar

**Usa x402 cuando:**
- Estás construyendo un agente/bot de IA
- Tu sistema necesita pagar autónomamente
- No quieres gestionar cuentas/sesiones
- Tienes uso esporádico (no vale la pena pre-fondear)
- Necesitas pagos completamente programáticos

---

# PART 4: TECHNICAL IMPLEMENTATION
# PARTE 4: IMPLEMENTACIÓN TÉCNICA

---

## 10. Backend Architecture / Arquitectura del Backend

### English

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────────────┐                            │
│                         │    Express.js API   │                            │
│                         │    (Node.js)        │                            │
│                         └──────────┬──────────┘                            │
│                                    │                                       │
│           ┌────────────────────────┼────────────────────────┐              │
│           │                        │                        │              │
│           ▼                        ▼                        ▼              │
│  ┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐    │
│  │  /wallet/*      │    │   /agent/*          │    │   /llm/*        │    │
│  │  Routes         │    │   Routes            │    │   Routes        │    │
│  ├─────────────────┤    ├─────────────────────┤    ├─────────────────┤    │
│  │ POST /nonce     │    │ POST /generate      │    │ POST /chat      │    │
│  │ POST /verify    │    │ POST /quote         │    │ GET /models     │    │
│  │ GET  /me        │    │ GET  /models        │    │ GET /balance    │    │
│  │ POST /logout    │    │ GET  /avax-price    │    │ POST /stream    │    │
│  └────────┬────────┘    └────────┬────────────┘    └────────┬────────┘    │
│           │                      │                          │              │
│           │                      │                          │              │
│           ▼                      ▼                          ▼              │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         SERVICES LAYER                              │  │
│  ├─────────────────┬──────────────────┬───────────────┬───────────────┤  │
│  │ AuthService     │ BillingService   │ QuoteService  │ OpenRouter    │  │
│  │                 │                  │               │ Service       │  │
│  │ • Nonce gen     │ • Contract calls │ • Token count │ • Model list  │  │
│  │ • Sig verify    │ • Balance check  │ • Price fetch │ • Chat API    │  │
│  │ • Session mgmt  │ • Usage record   │ • AVAX price  │ • Image gen   │  │
│  └────────┬────────┴────────┬─────────┴───────┬───────┴───────────────┘  │
│           │                 │                 │                          │
│           ▼                 ▼                 ▼                          │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      EXTERNAL SERVICES                              │  │
│  ├─────────────────┬──────────────────┬───────────────┬───────────────┤  │
│  │ MySQL Database  │ Avalanche RPC    │ CoinGecko API │ OpenRouter    │  │
│  │                 │                  │               │ API           │  │
│  │ • Users         │ • Contract calls │ • AVAX price  │ • 300+ models │  │
│  │ • Sessions      │ • Tx verify      │ • 30s cache   │ • Real-time   │  │
│  │ • Conversations │ • Events         │               │   pricing     │  │
│  └─────────────────┴──────────────────┴───────────────┴───────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Key Files

| File | Purpose |
|------|---------|
| `src/routes/agent.ts` | x402 endpoints for AI agents |
| `src/routes/llm.ts` | LLM endpoints for human users |
| `src/routes/billing.ts` | Deposit/credit management |
| `src/routes/wallet.ts` | Authentication |
| `src/middleware/x402.ts` | x402 payment verification middleware |
| `src/services/billing.ts` | Smart contract interaction |
| `src/services/quote.ts` | Real-time pricing calculation |
| `src/services/openrouter.ts` | AI model API calls |

### Español

#### Middleware x402

```typescript
// src/middleware/x402.ts
export const x402 = (options: X402Options) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers['x-payment'];

    // NO PAYMENT → Return 402 Challenge
    if (!paymentHeader) {
      return res.status(402).json({
        x402Version: 1,
        accepts: [{
          scheme: "native-tx",
          network: "avalanche",
          chainId: 43114,
          maxAmountRequired: options.price,
          payTo: MERCHANT_ADDRESS,
          asset: "AVAX"
        }]
      });
    }

    // HAS PAYMENT → Verify on-chain
    try {
      const { txHash } = JSON.parse(
        Buffer.from(paymentHeader, 'base64').toString()
      );

      // Verify transaction...
      const tx = await provider.getTransaction(txHash);
      // ... validation checks ...

      next(); // Payment valid, proceed to handler

    } catch (error) {
      return res.status(402).json({
        error: `Payment verification failed: ${error.message}`
      });
    }
  };
};
```

---

## 11. Frontend Architecture / Arquitectura del Frontend

### English

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FRONTEND ARCHITECTURE                                 │
│                       React Native + Expo                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                           APP LAYOUT                                  │ │
│  │                          (_layout.tsx)                                │ │
│  │  • ThemeProvider (dark/light mode)                                    │ │
│  │  • Web3Provider (wagmi + Reown AppKit)                               │ │
│  │  • AuthProvider (session management)                                  │ │
│  │  • BillingProvider (credit balance)                                   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                    │                                       │
│         ┌──────────────────────────┼──────────────────────────┐           │
│         │                          │                          │           │
│         ▼                          ▼                          ▼           │
│  ┌─────────────────┐    ┌─────────────────────┐    ┌─────────────────┐   │
│  │   /home         │    │   /chat/[id]        │    │   /protocol     │   │
│  │   (home.tsx)    │    │   ([id].tsx)        │    │   (protocol.tsx)│   │
│  ├─────────────────┤    ├─────────────────────┤    ├─────────────────┤   │
│  │ Landing page    │    │ Main chat interface │    │ x402 demo page  │   │
│  │ • Features      │    │ • Model selector    │    │ • Live flow     │   │
│  │ • Pricing       │    │ • Chat history      │    │ • Console logs  │   │
│  │ • CTAs          │    │ • Streaming resp    │    │ • Transaction   │   │
│  │                 │    │ • Multi-model mode  │    │   details       │   │
│  └─────────────────┘    │ • Wallet sidebar    │    │ • Quote system  │   │
│                         │ • Credit balance    │    └─────────────────┘   │
│                         └─────────────────────┘                           │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                          PROVIDERS                                    │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                       │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │ │
│  │  │  AuthContext    │  │  ThemeContext   │  │  BillingContext     │  │ │
│  │  ├─────────────────┤  ├─────────────────┤  ├─────────────────────┤  │ │
│  │  │ • user          │  │ • theme         │  │ • balance           │  │ │
│  │  │ • token         │  │ • toggleTheme   │  │ • refreshBalance    │  │ │
│  │  │ • guestId       │  │ • colors        │  │ • depositHistory    │  │ │
│  │  │ • isConnecting  │  └─────────────────┘  └─────────────────────┘  │ │
│  │  │ • openWalletModal│                                               │ │
│  │  │ • logout        │                                                │ │
│  │  └─────────────────┘                                                │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                       WEB3 INTEGRATION                                │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                       │ │
│  │  Wagmi Hooks:                      Reown AppKit:                     │ │
│  │  • useAccount() - wallet address   • Connect modal                   │ │
│  │  • useBalance() - AVAX balance     • WalletConnect                   │ │
│  │  • useSendTransaction() - send tx  • Coinbase Wallet                 │ │
│  │  • useSignMessage() - auth         • MetaMask                        │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

#### Tecnologías Frontend

| Tecnología | Propósito |
|------------|-----------|
| **React Native** | Framework UI cross-platform |
| **Expo** | Build y deployment simplificado |
| **Wagmi** | React hooks para Ethereum/Avalanche |
| **Reown AppKit** | Modal de conexión de wallet |
| **Viem** | Utilidades de bajo nivel para blockchain |

---

## 12. Quote & Pricing System / Sistema de Cotización y Precios

### English

The quote system provides **accurate, real-time pricing** before payment.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUOTE SYSTEM FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUT                                                                      │
│  ─────                                                                      │
│  {                                                                          │
│    "model": "openai/gpt-4",                                                │
│    "prompt": "Explain quantum computing in simple terms",                   │
│    "maxOutputTokens": 500 (optional)                                       │
│  }                                                                          │
│                                                                             │
│                              │                                              │
│                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      QUOTE SERVICE                                    │ │
│  │                                                                       │ │
│  │   STEP 1: Count Input Tokens                                         │ │
│  │   ────────────────────────                                           │ │
│  │   Using gpt-tokenizer library:                                       │ │
│  │   "Explain quantum computing in simple terms" → 7 tokens             │ │
│  │                                                                       │ │
│  │   STEP 2: Estimate Output Tokens                                     │ │
│  │   ───────────────────────────                                        │ │
│  │   If maxOutputTokens provided: use that                              │ │
│  │   Otherwise: estimate = min(max(input × 2, 150), 4000)               │ │
│  │   For 7 input tokens: max(14, 150) = 150 estimated output            │ │
│  │                                                                       │ │
│  │   STEP 3: Get Model Pricing (OpenRouter API)                         │ │
│  │   ─────────────────────────────────────────                          │ │
│  │   GET https://openrouter.ai/api/v1/models                            │ │
│  │   Find "openai/gpt-4":                                               │ │
│  │     • prompt: $0.00003/token (input)                                 │ │
│  │     • completion: $0.00006/token (output)                            │ │
│  │   (5 minute cache to avoid rate limits)                              │ │
│  │                                                                       │ │
│  │   STEP 4: Get AVAX Price (CoinGecko API)                             │ │
│  │   ─────────────────────────────────────                              │ │
│  │   GET https://api.coingecko.com/.../avalanche-2                      │ │
│  │   Current price: $25.50                                              │ │
│  │   (30 second cache)                                                  │ │
│  │                                                                       │ │
│  │   STEP 5: Calculate Costs                                            │ │
│  │   ───────────────────────                                            │ │
│  │   inputCost  = 7 tokens × $0.00003    = $0.00021                     │ │
│  │   outputCost = 150 tokens × $0.00006  = $0.00900                     │ │
│  │   totalUSD   = $0.00021 + $0.00900    = $0.00921                     │ │
│  │   totalAVAX  = $0.00921 ÷ $25.50      = 0.000361 AVAX               │ │
│  │   withBuffer = 0.000361 × 1.05        = 0.000379 AVAX (5% buffer)   │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                              │                                              │
│                              ▼                                              │
│  OUTPUT                                                                     │
│  ──────                                                                     │
│  {                                                                          │
│    "success": true,                                                        │
│    "model": {                                                              │
│      "id": "openai/gpt-4",                                                 │
│      "name": "GPT-4",                                                      │
│      "type": "text"                                                        │
│    },                                                                       │
│    "tokens": {                                                             │
│      "input": 7,                                                           │
│      "estimatedOutput": 150,                                               │
│      "total": 157                                                          │
│    },                                                                       │
│    "pricing": {                                                            │
│      "inputCostUSD": 0.00021,                                              │
│      "outputCostUSD": 0.00900,                                             │
│      "totalCostUSD": 0.00921,                                              │
│      "avaxPrice": 25.50,                                                   │
│      "totalCostAVAX": 0.000361                                             │
│    },                                                                       │
│    "payment": {                                                            │
│      "recommendedAVAX": 0.000379,                                          │
│      "currency": "AVAX",                                                   │
│      "network": "Avalanche C-Chain",                                       │
│      "chainId": 43114                                                      │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

#### Fuentes de Datos de Precio

| Dato | Fuente | Cache | Actualización |
|------|--------|-------|---------------|
| **Precio AVAX** | CoinGecko API | 30 segundos | Cada request después de expirar |
| **Precios de Modelos** | OpenRouter API | 5 minutos | Cada request después de expirar |
| **Conteo de Tokens** | gpt-tokenizer | N/A | Calculado por request |

#### ¿Por Qué el Buffer del 5%?

El buffer protege contra:
1. **Fluctuación de precio** entre cotización y pago (~2-5 segundos)
2. **Variación de output** - el modelo podría generar más tokens
3. **Costos de gas** - asegura que la transacción sea procesada

---

# PART 5: BUSINESS & VALUE
# PARTE 5: NEGOCIO Y VALOR

---

## 13. Value Proposition / Propuesta de Valor

### English

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ZEROPROMPT VALUE PROPOSITION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FOR HUMAN USERS                                                           │
│  ═══════════════                                                           │
│                                                                             │
│  ┌─────────────┬───────────────────────────────────────────────────────┐  │
│  │ BENEFIT     │ DESCRIPTION                                           │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ Cost Savings│ 80-97% cheaper than subscriptions                     │  │
│  │             │ $6/year vs $240/year for typical user                 │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ No Lock-in  │ Access 300+ models from one interface                 │  │
│  │             │ Switch models per conversation                        │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ Privacy     │ No email, no phone, no KYC                           │  │
│  │             │ Just a wallet address                                 │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ Transparency│ All transactions visible on blockchain               │  │
│  │             │ Verify every charge                                   │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ No Waste    │ Pay only for tokens used                             │  │
│  │             │ No unused subscription allocation                     │  │
│  └─────────────┴───────────────────────────────────────────────────────┘  │
│                                                                             │
│  FOR AI AGENT DEVELOPERS                                                   │
│  ═══════════════════════                                                   │
│                                                                             │
│  ┌─────────────┬───────────────────────────────────────────────────────┐  │
│  │ BENEFIT     │ DESCRIPTION                                           │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ Zero Setup  │ No API key registration needed                       │  │
│  │             │ No account creation                                   │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ Autonomy    │ Agents pay without human intervention                │  │
│  │             │ 24/7 operation                                        │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ Standard    │ x402 provides machine-readable pricing               │  │
│  │ Protocol    │ Agents can discover and pay programmatically         │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ No Rate     │ No arbitrary throttling                              │  │
│  │ Limits      │ Pay more = use more                                  │  │
│  ├─────────────┼───────────────────────────────────────────────────────┤  │
│  │ Multi-Model │ Same endpoint for all models                         │  │
│  │             │ Easy to switch or compare                            │  │
│  └─────────────┴───────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

#### Resumen de Propuesta de Valor

**Para Humanos**: "Accede a cualquier modelo de IA, paga solo por lo que usas, mantén tu privacidad."

**Para Agentes**: "Protocolo de pago estándar para la economía autónoma de agentes."

---

## 14. Economic Model / Modelo Económico

### English

#### Revenue Streams

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ECONOMIC MODEL                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REVENUE STREAMS                                                           │
│  ═══════════════                                                           │
│                                                                             │
│  1. MARKUP ON AI USAGE                                                     │
│     ─────────────────                                                      │
│     Model provider charges: $0.00003/token                                 │
│     We charge user: $0.000033/token (+10% markup)                          │
│     Our margin: $0.000003/token                                            │
│                                                                             │
│     At 1M tokens/day = $3/day = ~$90/month revenue                        │
│     At 100M tokens/day = $300/day = ~$9,000/month revenue                 │
│                                                                             │
│  2. PLATFORM FEE (Optional)                                                │
│     ────────────────────────                                               │
│     Contract supports 0-100% platformFeePercent                            │
│     Currently set to 0% (no fee on deposits)                               │
│     Can enable for sustainability                                          │
│                                                                             │
│  3. x402 TRANSACTION FEES                                                  │
│     ─────────────────────                                                  │
│     Fixed premium per x402 request                                         │
│     Currently: 0.05 AVAX (~$1.25)                                          │
│     Covers: verification overhead + profit margin                          │
│                                                                             │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  COST STRUCTURE                                                            │
│  ══════════════                                                            │
│                                                                             │
│  1. AI Provider Costs (passed through to user)                             │
│     • OpenRouter API fees                                                  │
│     • Per-token charges from underlying models                             │
│                                                                             │
│  2. Infrastructure Costs                                                   │
│     • Server hosting (~$50-200/month)                                      │
│     • Database (~$20-50/month)                                             │
│     • RPC provider (free tier or ~$100/month)                              │
│                                                                             │
│  3. Gas Costs (Operator)                                                   │
│     • Recording usage on-chain                                             │
│     • Currently batched to minimize costs                                  │
│     • ~$0.01 per recordUsage() call                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Cost Comparison Example

```
TRADITIONAL USER (ChatGPT Plus):
────────────────────────────────
Monthly cost: $20
Typical usage: 100 messages (~50,000 tokens)
Cost per token: $0.0004
Unused allocation: ~80% (paying for 4M tokens, using 50K)

ZEROPROMPT USER:
────────────────
100 messages × ~500 tokens = 50,000 tokens
At $0.00003/token = $1.50/month
Savings: 92.5%
```

### Español

#### Comparación de Costos Mensuales

| Servicio | Costo Mensual | Uso Típico | Costo Real |
|----------|---------------|------------|------------|
| ChatGPT Plus | $20 | 100 msgs | $20 (fijo) |
| Claude Pro | $20 | 100 msgs | $20 (fijo) |
| Midjourney | $10 | 50 imgs | $10 (fijo) |
| **Total Tradicional** | **$50** | - | **$50** |
| | | | |
| **ZeroPrompt** | Pago-por-uso | 100 msgs + 50 imgs | **~$3** |
| | | | |
| **Ahorro** | | | **94%** |

---

## 15. Competitive Advantages / Ventajas Competitivas

### English

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPETITIVE LANDSCAPE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COMPETITOR        │ WEAKNESS                 │ ZEROPROMPT ADVANTAGE        │
│  ──────────────────┼──────────────────────────┼─────────────────────────────│
│                    │                          │                             │
│  ChatGPT           │ Single provider          │ 300+ models                 │
│                    │ $20/mo subscription      │ Pay-per-use (<$5/mo)        │
│                    │ No agent support         │ x402 protocol               │
│                    │ Data used for training   │ No data retention           │
│                    │                          │                             │
│  ──────────────────┼──────────────────────────┼─────────────────────────────│
│                    │                          │                             │
│  Claude            │ Single provider          │ 300+ models                 │
│                    │ $20/mo subscription      │ Pay-per-use                 │
│                    │ No image generation      │ Text + Image models         │
│                    │ Rate limits              │ No arbitrary limits         │
│                    │                          │                             │
│  ──────────────────┼──────────────────────────┼─────────────────────────────│
│                    │                          │                             │
│  OpenRouter        │ Traditional API keys     │ Wallet-based auth           │
│  (similar model)   │ Credit card required     │ Crypto payments             │
│                    │ No agent protocol        │ x402 for agents             │
│                    │ Centralized billing      │ On-chain transparency       │
│                    │                          │                             │
│  ──────────────────┼──────────────────────────┼─────────────────────────────│
│                    │                          │                             │
│  Direct API        │ Complex setup            │ One interface               │
│  Access            │ Multiple accounts        │ One wallet                  │
│                    │ Multiple billing         │ One credit system           │
│                    │ No price comparison      │ Side-by-side comparison     │
│                    │                          │                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

#### Nuestras Ventajas Únicas

1. **x402 Protocol** - Somos los primeros en implementar HTTP 402 para pagos de IA
2. **Dual Payment System** - Créditos para humanos, x402 para agentes
3. **On-chain Transparency** - Cada transacción verificable en blockchain
4. **True Multi-model** - No estamos atados a un proveedor
5. **Privacy-first** - Sin KYC, sin datos personales

---

# PART 6: DEMO & FUTURE
# PARTE 6: DEMO Y FUTURO

---

## 16. Live Demo Guide / Guía de Demo en Vivo

### English

#### Demo URL: https://0prompt.xyz/protocol

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEMO WALKTHROUGH                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: OPEN THE DEMO                                                     │
│  ─────────────────────                                                     │
│  Navigate to: https://0prompt.xyz/protocol                                 │
│  You'll see the x402 Protocol interactive demo page                        │
│                                                                             │
│  STEP 2: SELECT A MODEL                                                    │
│  ──────────────────────                                                    │
│  Click "Select Models" button                                              │
│  Choose from 300+ available models:                                        │
│  • Text: GPT-4, Claude, Gemini, Llama                                      │
│  • Image: DALL-E 3, Stable Diffusion, Flux                                 │
│                                                                             │
│  STEP 3: ENTER A PROMPT                                                    │
│  ──────────────────────                                                    │
│  Type your prompt in the text area                                         │
│  Watch the real-time quote update:                                         │
│  • Token count                                                             │
│  • USD cost                                                                │
│  • AVAX amount                                                             │
│  • Current AVAX price                                                      │
│                                                                             │
│  STEP 4: CONNECT WALLET                                                    │
│  ─────────────────────                                                     │
│  Click "Connect" button                                                    │
│  Select your wallet (MetaMask, Coinbase, etc.)                             │
│  Make sure you're on Avalanche C-Chain (43114)                             │
│                                                                             │
│  STEP 5: EXECUTE THE FLOW                                                  │
│  ────────────────────────                                                  │
│  Click "Execute x402 Flow" button                                          │
│  Watch the console output show each step:                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ [15:30:01] Initiating x402 flow...                                  │  │
│  │ [15:30:01] Step 1: Sending initial request (expecting 402)...       │  │
│  │ [15:30:02] ✓ Received 402 Payment Required                          │  │
│  │ [15:30:02] Payment details:                                         │  │
│  │            - Amount: 0.05 AVAX                                      │  │
│  │            - To: 0x209F0baCA0c23edc57881B26B68FC4148123B039         │  │
│  │            - Chain: Avalanche (43114)                               │  │
│  │ [15:30:02] Step 2: Sending AVAX payment...                          │  │
│  │ [15:30:03] ✓ Transaction sent: 0xabc123...                          │  │
│  │ [15:30:05] ✓ Transaction confirmed!                                 │  │
│  │ [15:30:05] Step 3: Retrying with payment proof...                   │  │
│  │ [15:30:06] ✓ Success! AI response received                          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  STEP 6: VIEW RESULTS                                                      │
│  ────────────────────                                                      │
│  The AI response appears in the right panel                                │
│  For image models, the generated image is displayed                        │
│  Transaction link to Snowtrace explorer is shown                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

#### Puntos Clave para Demostrar

1. **Cotización en Tiempo Real** - El precio cambia según el modelo y prompt
2. **Transparencia** - Puedes ver exactamente cuánto pagarás antes de pagar
3. **Verificación On-chain** - La transacción es verificada en Avalanche
4. **Sin Cuenta** - No se necesita registro, solo conectar wallet
5. **Rapidez** - Todo el flujo toma ~5 segundos

---

## 17. Roadmap / Hoja de Ruta

### English

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ROADMAP                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: CURRENT (COMPLETED ✓)                                            │
│  ══════════════════════════════                                            │
│  [✓] ZeroPromptBilling smart contract deployed                             │
│  [✓] Chainlink price feed integration                                      │
│  [✓] x402 middleware implementation                                        │
│  [✓] Quote service with real-time pricing                                  │
│  [✓] 300+ AI model access via OpenRouter                                   │
│  [✓] Web interface with wallet authentication                              │
│  [✓] Interactive x402 demo at 0prompt.xyz/protocol                         │
│  [✓] Text and image generation support                                     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PHASE 2: NEAR-TERM                                                        │
│  ═════════════════════                                                     │
│  [ ] Multi-chain deployment (Base, Arbitrum, Polygon)                      │
│  [ ] Stablecoin payment options (USDC, USDT)                               │
│  [ ] Redis/PostgreSQL for production replay protection                     │
│  [ ] Streaming payments (pay as tokens generate)                           │
│  [ ] Mobile app optimization                                               │
│  [ ] Usage analytics dashboard                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PHASE 3: MEDIUM-TERM                                                      │
│  ════════════════════                                                      │
│  [ ] Agent SDK (npm package)                                               │
│  [ ] Service discovery protocol                                            │
│  [ ] Reputation/credit scoring for agents                                  │
│  [ ] Refund protocol for failed requests                                   │
│  [ ] Team/organization accounts                                            │
│  [ ] API key generation for developers                                     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PHASE 4: LONG-TERM VISION                                                 │
│  ════════════════════════                                                  │
│  [ ] x402 standard proposal (work toward RFC)                              │
│  [ ] Cross-service agent payments                                          │
│  [ ] Payment channels for ultra-low-cost L2                                │
│  [ ] DAO governance for platform decisions                                 │
│  [ ] Partner integrations (other AI services)                              │
│  [ ] White-label solution for enterprises                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Español

#### Prioridades Inmediatas

1. **Multi-chain** - Desplegar en más redes para alcanzar más usuarios
2. **Stablecoins** - Ofrecer pagos en USDC para usuarios que prefieren estabilidad
3. **SDK de Agente** - Facilitar la integración para desarrolladores
4. **Producción** - Mejorar infraestructura para escala

---

# APPENDIX: QUICK REFERENCE
# APÉNDICE: REFERENCIA RÁPIDA

## Contract Addresses / Direcciones de Contratos

| Network | Contract | Address |
|---------|----------|---------|
| Avalanche C-Chain | ZeroPromptBilling | [Deployed] |
| Avalanche C-Chain | x402 Merchant | `0x209F0baCA0c23edc57881B26B68FC4148123B039` |
| Avalanche C-Chain | AVAX/USD Feed | `0x0A77230d17318075983913bC2145DB16C7366156` |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/generate` | POST | AI generation (x402) |
| `/agent/quote` | POST | Get price quote |
| `/agent/models` | GET | List available models |
| `/agent/avax-price` | GET | Current AVAX price |
| `/wallet/nonce` | POST | Get auth nonce |
| `/wallet/verify` | POST | Verify signature |
| `/llm/chat` | POST | Chat (credit system) |

## Key Links / Enlaces Clave

- **Live Demo**: https://0prompt.xyz/protocol
- **Main App**: https://0prompt.xyz
- **Snowtrace**: https://snowtrace.io
- **Chainlink Feeds**: https://data.chain.link

---

*Document Version: 1.0*
*Last Updated: December 2024*
*ZeroPrompt - Decentralized AI Infrastructure for the Agent Economy*
