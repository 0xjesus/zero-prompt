# x402 Protocol: Machine-to-Machine Payments for AI
# Protocolo x402: Pagos Máquina-a-Máquina para IA

---

## Table of Contents / Índice

1. [Executive Summary / Resumen Ejecutivo](#1-executive-summary--resumen-ejecutivo)
2. [What is HTTP 402? / ¿Qué es HTTP 402?](#2-what-is-http-402--qué-es-http-402)
3. [The Problem We're Solving / El Problema que Resolvemos](#3-the-problem-were-solving--el-problema-que-resolvemos)
4. [Our x402 Implementation / Nuestra Implementación x402](#4-our-x402-implementation--nuestra-implementación-x402)
5. [Complete Payment Flow / Flujo Completo de Pago](#5-complete-payment-flow--flujo-completo-de-pago)
6. [Technical Architecture / Arquitectura Técnica](#6-technical-architecture--arquitectura-técnica)
7. [Security & Verification / Seguridad y Verificación](#7-security--verification--seguridad-y-verificación)
8. [Value Proposition / Propuesta de Valor](#8-value-proposition--propuesta-de-valor)
9. [Live Demo / Demostración en Vivo](#9-live-demo--demostración-en-vivo)
10. [Future Roadmap / Hoja de Ruta](#10-future-roadmap--hoja-de-ruta)

---

## 1. Executive Summary / Resumen Ejecutivo

### English

**x402** is our implementation of the HTTP 402 "Payment Required" status code—a standard defined in 1999 but never widely implemented until now. We use it to enable **frictionless, per-request micropayments** for AI services on the blockchain.

**Key Innovation**: AI agents can autonomously pay for AI services without API keys, subscriptions, or human intervention.

**How it works in 30 seconds**:
1. Agent requests AI service → Server returns `402 Payment Required` with price
2. Agent sends AVAX payment to merchant address
3. Agent retries request with transaction hash as proof
4. Server verifies payment on-chain → Returns AI response

### Español

**x402** es nuestra implementación del código de estado HTTP 402 "Pago Requerido"—un estándar definido en 1999 pero nunca implementado ampliamente hasta ahora. Lo usamos para habilitar **micropagos sin fricción por solicitud** para servicios de IA en blockchain.

**Innovación Clave**: Los agentes de IA pueden pagar autónomamente por servicios de IA sin claves API, suscripciones ni intervención humana.

**Cómo funciona en 30 segundos**:
1. Agente solicita servicio de IA → Servidor retorna `402 Pago Requerido` con precio
2. Agente envía pago en AVAX a la dirección del comerciante
3. Agente reintenta solicitud con hash de transacción como prueba
4. Servidor verifica pago on-chain → Retorna respuesta de IA

---

## 2. What is HTTP 402? / ¿Qué es HTTP 402?

### English

HTTP 402 is one of the original HTTP status codes defined in RFC 2616 (1999). While codes like 404 (Not Found) and 401 (Unauthorized) became ubiquitous, **402 was reserved "for future use"** with this description:

> *"This code is reserved for future use. The original intention was that this code might be used as part of some form of digital cash or micropayment scheme."*

**25 years later, we're making it real.**

The original vision was that the web would have native payments—you'd pay tiny amounts to access content instead of relying on ads. Cryptocurrency and blockchain finally make this possible:
- **Micropayments**: Pay fractions of a cent per request
- **Programmable**: Agents can pay without human intervention
- **Trustless**: On-chain verification, no payment processor needed

### Español

HTTP 402 es uno de los códigos de estado HTTP originales definidos en RFC 2616 (1999). Mientras códigos como 404 (No Encontrado) y 401 (No Autorizado) se volvieron ubicuos, **402 fue reservado "para uso futuro"** con esta descripción:

> *"Este código está reservado para uso futuro. La intención original era que este código pudiera usarse como parte de algún esquema de dinero digital o micropagos."*

**25 años después, lo estamos haciendo realidad.**

La visión original era que la web tendría pagos nativos—pagarías cantidades mínimas para acceder a contenido en lugar de depender de anuncios. Las criptomonedas y blockchain finalmente lo hacen posible:
- **Micropagos**: Paga fracciones de centavo por solicitud
- **Programable**: Los agentes pueden pagar sin intervención humana
- **Sin confianza**: Verificación on-chain, no se necesita procesador de pagos

---

## 3. The Problem We're Solving / El Problema que Resolvemos

### English

#### The Current AI Payment Landscape is Broken

| Problem | Traditional APIs | Our x402 Solution |
|---------|-----------------|-------------------|
| **API Keys** | Required, can be leaked | None needed |
| **Accounts** | Email, phone, KYC required | Just a wallet address |
| **Billing** | Monthly subscriptions | Pay-per-request |
| **Rate Limits** | Arbitrary throttling | Pay more = use more |
| **Agent Autonomy** | Impossible—needs human setup | Fully autonomous |
| **Micropayments** | Not economically viable | Sub-cent transactions |

#### Why This Matters for AI Agents

Autonomous AI agents are the future. They need to:
- Call external APIs (weather, search, other AI models)
- Pay for services without asking a human
- Operate 24/7 without billing cycles interrupting them

**Without x402**: An agent needs a human to sign up, get API keys, set up billing, and monitor usage.

**With x402**: An agent with a crypto wallet can discover, pay for, and consume any x402-enabled service instantly.

### Español

#### El Panorama Actual de Pagos de IA Está Roto

| Problema | APIs Tradicionales | Nuestra Solución x402 |
|---------|---------------------|----------------------|
| **Claves API** | Requeridas, pueden filtrarse | No se necesitan |
| **Cuentas** | Email, teléfono, KYC requeridos | Solo una dirección de wallet |
| **Facturación** | Suscripciones mensuales | Pago-por-solicitud |
| **Límites de Tasa** | Throttling arbitrario | Paga más = usa más |
| **Autonomía del Agente** | Imposible—necesita configuración humana | Totalmente autónomo |
| **Micropagos** | No es económicamente viable | Transacciones de sub-centavos |

#### Por Qué Esto Importa para Agentes de IA

Los agentes de IA autónomos son el futuro. Necesitan:
- Llamar APIs externas (clima, búsqueda, otros modelos de IA)
- Pagar por servicios sin preguntarle a un humano
- Operar 24/7 sin que los ciclos de facturación los interrumpan

**Sin x402**: Un agente necesita que un humano se registre, obtenga claves API, configure facturación y monitoree uso.

**Con x402**: Un agente con una wallet crypto puede descubrir, pagar y consumir cualquier servicio habilitado con x402 instantáneamente.

---

## 4. Our x402 Implementation / Nuestra Implementación x402

### English

We implement x402 using **native AVAX transfers** on Avalanche C-Chain. Here's why:

#### Why Avalanche?
- **Speed**: Sub-second finality (vs 12s on Ethereum)
- **Cost**: ~$0.01 per transaction (vs $1-50 on Ethereum)
- **EVM Compatible**: Standard Ethereum tooling works
- **Reliable**: 99.99% uptime, battle-tested infrastructure

#### Why Native AVAX (not ERC-20)?
- **Simpler**: No token approval transactions needed
- **Cheaper**: One transaction instead of two
- **Universal**: Every Avalanche wallet has AVAX
- **Faster**: No smart contract call overhead

#### Our Payment Scheme: `native-tx`

```json
{
  "scheme": "native-tx",
  "network": "avalanche",
  "chainId": 43114,
  "asset": "AVAX",
  "payTo": "0x209F0baCA0c23edc57881B26B68FC4148123B039",
  "maxAmountRequired": "50000000000000000"
}
```

This tells the agent:
- Send a **native transaction** (not a token transfer)
- On **Avalanche mainnet** (chain ID 43114)
- Pay in **AVAX**
- To our **merchant address**
- Amount: **0.05 AVAX** (in wei)

### Español

Implementamos x402 usando **transferencias nativas de AVAX** en Avalanche C-Chain. He aquí por qué:

#### ¿Por Qué Avalanche?
- **Velocidad**: Finalidad en menos de un segundo (vs 12s en Ethereum)
- **Costo**: ~$0.01 por transacción (vs $1-50 en Ethereum)
- **Compatible con EVM**: Las herramientas estándar de Ethereum funcionan
- **Confiable**: 99.99% de uptime, infraestructura probada en batalla

#### ¿Por Qué AVAX Nativo (no ERC-20)?
- **Más Simple**: No se necesitan transacciones de aprobación de tokens
- **Más Barato**: Una transacción en lugar de dos
- **Universal**: Toda wallet de Avalanche tiene AVAX
- **Más Rápido**: Sin overhead de llamada a smart contract

#### Nuestro Esquema de Pago: `native-tx`

```json
{
  "scheme": "native-tx",
  "network": "avalanche",
  "chainId": 43114,
  "asset": "AVAX",
  "payTo": "0x209F0baCA0c23edc57881B26B68FC4148123B039",
  "maxAmountRequired": "50000000000000000"
}
```

Esto le dice al agente:
- Envía una **transacción nativa** (no una transferencia de token)
- En **Avalanche mainnet** (chain ID 43114)
- Paga en **AVAX**
- A nuestra **dirección de comerciante**
- Monto: **0.05 AVAX** (en wei)

---

## 5. Complete Payment Flow / Flujo Completo de Pago

### English

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        x402 PAYMENT FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

   AI AGENT                         ZEROPROMPT API                 AVALANCHE
      │                                   │                            │
      │  1. POST /agent/generate          │                            │
      │   {model, prompt}                 │                            │
      │ ─────────────────────────────────>│                            │
      │                                   │                            │
      │  2. 402 Payment Required          │                            │
      │   {price, merchant, chainId}      │                            │
      │ <─────────────────────────────────│                            │
      │                                   │                            │
      │  3. GET /agent/quote (optional)   │                            │
      │ ─────────────────────────────────>│                            │
      │                                   │                            │
      │  4. Quote with exact pricing      │                            │
      │   {tokens, costUSD, costAVAX}     │                            │
      │ <─────────────────────────────────│                            │
      │                                   │                            │
      │  5. Send AVAX Transaction                                      │
      │ ─────────────────────────────────────────────────────────────> │
      │                                                                 │
      │  6. Transaction Hash (0x...)                                   │
      │ <───────────────────────────────────────────────────────────── │
      │                                   │                            │
      │  7. POST /agent/generate          │                            │
      │   + X-PAYMENT: base64({txHash})   │                            │
      │ ─────────────────────────────────>│                            │
      │                                   │  8. Verify on-chain        │
      │                                   │ ───────────────────────────>│
      │                                   │                            │
      │                                   │  9. Confirmation           │
      │                                   │ <───────────────────────────│
      │                                   │                            │
      │  10. 200 OK                       │                            │
      │   {result: "AI response..."}      │                            │
      │ <─────────────────────────────────│                            │
      │                                   │                            │

```

#### Step-by-Step Breakdown:

1. **Initial Request**: Agent sends request without payment
2. **402 Challenge**: Server returns pricing and payment instructions
3. **Quote Request** (optional): Agent gets accurate pricing based on prompt
4. **Quote Response**: Server calculates tokens, fetches live AVAX price
5. **Payment**: Agent signs and sends AVAX to merchant
6. **Transaction Hash**: Blockchain returns confirmation
7. **Retry with Proof**: Agent includes transaction hash in header
8. **On-Chain Verification**: Server checks Avalanche for transaction
9. **Confirmation**: Blockchain confirms recipient, amount, status
10. **Success**: Server returns AI response

### Español

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE PAGO x402                               │
└─────────────────────────────────────────────────────────────────────────┘

   AGENTE IA                        API ZEROPROMPT                 AVALANCHE
      │                                   │                            │
      │  1. POST /agent/generate          │                            │
      │   {model, prompt}                 │                            │
      │ ─────────────────────────────────>│                            │
      │                                   │                            │
      │  2. 402 Pago Requerido            │                            │
      │   {precio, comerciante, chainId}  │                            │
      │ <─────────────────────────────────│                            │
      │                                   │                            │
      │  3. GET /agent/quote (opcional)   │                            │
      │ ─────────────────────────────────>│                            │
      │                                   │                            │
      │  4. Cotización con precio exacto  │                            │
      │   {tokens, costoUSD, costoAVAX}   │                            │
      │ <─────────────────────────────────│                            │
      │                                   │                            │
      │  5. Enviar Transacción AVAX                                    │
      │ ─────────────────────────────────────────────────────────────> │
      │                                                                 │
      │  6. Hash de Transacción (0x...)                                │
      │ <───────────────────────────────────────────────────────────── │
      │                                   │                            │
      │  7. POST /agent/generate          │                            │
      │   + X-PAYMENT: base64({txHash})   │                            │
      │ ─────────────────────────────────>│                            │
      │                                   │  8. Verificar on-chain     │
      │                                   │ ───────────────────────────>│
      │                                   │                            │
      │                                   │  9. Confirmación           │
      │                                   │ <───────────────────────────│
      │                                   │                            │
      │  10. 200 OK                       │                            │
      │   {result: "Respuesta IA..."}     │                            │
      │ <─────────────────────────────────│                            │
      │                                   │                            │

```

#### Desglose Paso a Paso:

1. **Solicitud Inicial**: Agente envía solicitud sin pago
2. **Desafío 402**: Servidor retorna precios e instrucciones de pago
3. **Solicitud de Cotización** (opcional): Agente obtiene precio exacto basado en prompt
4. **Respuesta de Cotización**: Servidor calcula tokens, obtiene precio AVAX en vivo
5. **Pago**: Agente firma y envía AVAX al comerciante
6. **Hash de Transacción**: Blockchain retorna confirmación
7. **Reintento con Prueba**: Agente incluye hash de transacción en header
8. **Verificación On-Chain**: Servidor verifica transacción en Avalanche
9. **Confirmación**: Blockchain confirma destinatario, monto, estado
10. **Éxito**: Servidor retorna respuesta de IA

---

## 6. Technical Architecture / Arquitectura Técnica

### English

#### The X-PAYMENT Header

The payment proof is sent as a base64-encoded JSON in the `X-PAYMENT` header:

```javascript
// Original payload
const payload = { txHash: "0x123abc..." };

// Encoded for header
const header = btoa(JSON.stringify(payload));
// Result: "eyJ0eEhhc2giOiIweDEyM2FiYy4uLiJ9"

// HTTP Request
fetch('/agent/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-PAYMENT': header  // <-- Payment proof here
  },
  body: JSON.stringify({ model: 'gpt-4', prompt: 'Hello' })
});
```

#### The 402 Response Structure

When payment is required, the server returns:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "native-tx",
      "network": "avalanche",
      "chainId": 43114,
      "maxAmountRequired": "50000000000000000",
      "resource": "/agent/generate",
      "description": "Agent LLM/Image Generation Request",
      "payTo": "0x209F0baCA0c23edc57881B26B68FC4148123B039",
      "asset": "AVAX",
      "maxTimeoutSeconds": 600
    }
  ],
  "error": "X-PAYMENT header required",
  "hint": "Send AVAX to merchant address on Avalanche (Chain ID: 43114)"
}
```

#### Quote Service Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      QUOTE SERVICE                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   INPUT                     PROCESSING              OUTPUT   │
│   ─────                     ──────────              ──────   │
│                                                               │
│   • Model ID          ┌─────────────────┐                    │
│   • Prompt      ───>  │ Token Counter   │  ───> Input Tokens │
│                       │ (gpt-tokenizer) │                    │
│                       └─────────────────┘                    │
│                                                               │
│                       ┌─────────────────┐                    │
│   • Model ID    ───>  │ OpenRouter API  │  ───> Price/Token  │
│                       │ (Real-time)     │                    │
│                       └─────────────────┘                    │
│                                                               │
│                       ┌─────────────────┐                    │
│                 ───>  │ CoinGecko API   │  ───> AVAX Price   │
│                       │ (30s cache)     │                    │
│                       └─────────────────┘                    │
│                                                               │
│   CALCULATION:                                                │
│   ─────────────                                               │
│   inputCost  = inputTokens × pricePerInputToken              │
│   outputCost = estimatedOutputTokens × pricePerOutputToken   │
│   totalUSD   = inputCost + outputCost                        │
│   totalAVAX  = totalUSD / avaxPrice                          │
│   payment    = totalAVAX × 1.05 (5% buffer)                  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Español

#### El Header X-PAYMENT

La prueba de pago se envía como un JSON codificado en base64 en el header `X-PAYMENT`:

```javascript
// Payload original
const payload = { txHash: "0x123abc..." };

// Codificado para header
const header = btoa(JSON.stringify(payload));
// Resultado: "eyJ0eEhhc2giOiIweDEyM2FiYy4uLiJ9"

// Solicitud HTTP
fetch('/agent/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-PAYMENT': header  // <-- Prueba de pago aquí
  },
  body: JSON.stringify({ model: 'gpt-4', prompt: 'Hola' })
});
```

#### Estructura de Respuesta 402

Cuando se requiere pago, el servidor retorna:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "native-tx",
      "network": "avalanche",
      "chainId": 43114,
      "maxAmountRequired": "50000000000000000",
      "resource": "/agent/generate",
      "description": "Solicitud de Generación LLM/Imagen del Agente",
      "payTo": "0x209F0baCA0c23edc57881B26B68FC4148123B039",
      "asset": "AVAX",
      "maxTimeoutSeconds": 600
    }
  ],
  "error": "Se requiere header X-PAYMENT",
  "hint": "Envía AVAX a la dirección del comerciante en Avalanche (Chain ID: 43114)"
}
```

#### Arquitectura del Servicio de Cotización

```
┌──────────────────────────────────────────────────────────────┐
│                    SERVICIO DE COTIZACIÓN                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│   ENTRADA                   PROCESAMIENTO           SALIDA   │
│   ───────                   ─────────────           ──────   │
│                                                               │
│   • ID Modelo         ┌─────────────────┐                    │
│   • Prompt      ───>  │ Contador Tokens │  ───> Tokens Entrada│
│                       │ (gpt-tokenizer) │                    │
│                       └─────────────────┘                    │
│                                                               │
│                       ┌─────────────────┐                    │
│   • ID Modelo   ───>  │ API OpenRouter  │  ───> Precio/Token │
│                       │ (Tiempo real)   │                    │
│                       └─────────────────┘                    │
│                                                               │
│                       ┌─────────────────┐                    │
│                 ───>  │ API CoinGecko   │  ───> Precio AVAX  │
│                       │ (cache 30s)     │                    │
│                       └─────────────────┘                    │
│                                                               │
│   CÁLCULO:                                                    │
│   ────────                                                    │
│   costoEntrada = tokensEntrada × precioPorTokenEntrada       │
│   costoSalida  = tokensEstimadosSalida × precioPorTokenSalida│
│   totalUSD     = costoEntrada + costoSalida                  │
│   totalAVAX    = totalUSD / precioAVAX                       │
│   pago         = totalAVAX × 1.05 (5% buffer)                │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Security & Verification / Seguridad y Verificación

### English

Our x402 implementation includes multiple security layers:

#### 1. On-Chain Verification
Every payment is verified directly on the Avalanche blockchain:

```javascript
// We verify:
const tx = await provider.getTransaction(txHash);

// ✓ Transaction exists
if (!tx) throw new Error("Transaction not found");

// ✓ Transaction confirmed (not pending)
const receipt = await provider.getTransactionReceipt(txHash);
if (!receipt || receipt.status !== 1) throw new Error("Transaction failed");

// ✓ Correct recipient
if (tx.to.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
  throw new Error("Wrong recipient");
}

// ✓ Sufficient amount
if (tx.value < requiredAmount) {
  throw new Error("Insufficient payment");
}
```

#### 2. Replay Attack Prevention
Each transaction hash can only be used once:

```javascript
const usedTxHashes = new Set<string>();

// Before processing:
if (usedTxHashes.has(txHash)) {
  throw new Error("Transaction already used for payment");
}

// After successful verification:
usedTxHashes.add(txHash);
```

#### 3. Network Validation
We ensure the transaction is on the correct network:

- **Chain ID Check**: Must be 43114 (Avalanche Mainnet)
- **RPC Verification**: We query Avalanche nodes directly
- **No Testnet Accepted**: Production only

#### 4. Amount Verification
- Payments must meet or exceed the quoted amount
- We use BigInt for precise wei calculations
- 5% buffer protects against price fluctuation

### Español

Nuestra implementación x402 incluye múltiples capas de seguridad:

#### 1. Verificación On-Chain
Cada pago se verifica directamente en la blockchain de Avalanche:

```javascript
// Verificamos:
const tx = await provider.getTransaction(txHash);

// ✓ La transacción existe
if (!tx) throw new Error("Transacción no encontrada");

// ✓ Transacción confirmada (no pendiente)
const receipt = await provider.getTransactionReceipt(txHash);
if (!receipt || receipt.status !== 1) throw new Error("Transacción falló");

// ✓ Destinatario correcto
if (tx.to.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
  throw new Error("Destinatario incorrecto");
}

// ✓ Monto suficiente
if (tx.value < requiredAmount) {
  throw new Error("Pago insuficiente");
}
```

#### 2. Prevención de Ataques de Replay
Cada hash de transacción solo puede usarse una vez:

```javascript
const usedTxHashes = new Set<string>();

// Antes de procesar:
if (usedTxHashes.has(txHash)) {
  throw new Error("Transacción ya usada para pago");
}

// Después de verificación exitosa:
usedTxHashes.add(txHash);
```

#### 3. Validación de Red
Aseguramos que la transacción esté en la red correcta:

- **Verificación de Chain ID**: Debe ser 43114 (Avalanche Mainnet)
- **Verificación RPC**: Consultamos nodos de Avalanche directamente
- **No se Acepta Testnet**: Solo producción

#### 4. Verificación de Monto
- Los pagos deben cumplir o exceder el monto cotizado
- Usamos BigInt para cálculos precisos en wei
- 5% de buffer protege contra fluctuación de precio

---

## 8. Value Proposition / Propuesta de Valor

### English

#### For AI Agent Developers

| Benefit | Description |
|---------|-------------|
| **Zero Setup** | No API key registration, no account creation |
| **Instant Access** | Start using immediately with just a wallet |
| **True Autonomy** | Agents can pay without human intervention |
| **Cost Transparency** | Know exactly what you pay per request |
| **No Rate Limits** | Pay more = use more, simple as that |
| **Model Flexibility** | Access 300+ models through one endpoint |

#### For End Users (via 0prompt.xyz)

| Benefit | Description |
|---------|-------------|
| **Pay-Per-Use** | No $20/month subscriptions |
| **Privacy First** | No email, no phone, just wallet |
| **Model Choice** | GPT-4, Claude, Gemini, all in one place |
| **Cost Savings** | Typical user saves 80-90% vs subscriptions |
| **No Lock-in** | Switch models per conversation |

#### Economic Comparison

```
Traditional API Approach:
─────────────────────────
• ChatGPT Plus: $20/month
• Claude Pro: $20/month
• Midjourney: $10/month
• Total: $50/month = $600/year
• Usage: Maybe 20% of capacity

ZeroPrompt x402 Approach:
─────────────────────────
• Pay per token/image
• Typical cost: $0.001-0.01 per request
• 100 requests/month = ~$1
• Annual cost: ~$12
• Savings: 98%
```

### Español

#### Para Desarrolladores de Agentes IA

| Beneficio | Descripción |
|-----------|-------------|
| **Cero Configuración** | Sin registro de clave API, sin creación de cuenta |
| **Acceso Instantáneo** | Comienza a usar inmediatamente solo con una wallet |
| **Autonomía Real** | Los agentes pueden pagar sin intervención humana |
| **Transparencia de Costos** | Sabe exactamente cuánto paga por solicitud |
| **Sin Límites de Tasa** | Paga más = usa más, así de simple |
| **Flexibilidad de Modelos** | Accede a 300+ modelos a través de un endpoint |

#### Para Usuarios Finales (vía 0prompt.xyz)

| Beneficio | Descripción |
|-----------|-------------|
| **Pago-Por-Uso** | Sin suscripciones de $20/mes |
| **Privacidad Primero** | Sin email, sin teléfono, solo wallet |
| **Elección de Modelo** | GPT-4, Claude, Gemini, todo en un lugar |
| **Ahorro de Costos** | Usuario típico ahorra 80-90% vs suscripciones |
| **Sin Lock-in** | Cambia de modelo por conversación |

#### Comparación Económica

```
Enfoque API Tradicional:
─────────────────────────
• ChatGPT Plus: $20/mes
• Claude Pro: $20/mes
• Midjourney: $10/mes
• Total: $50/mes = $600/año
• Uso: Quizás 20% de capacidad

Enfoque ZeroPrompt x402:
─────────────────────────
• Paga por token/imagen
• Costo típico: $0.001-0.01 por solicitud
• 100 solicitudes/mes = ~$1
• Costo anual: ~$12
• Ahorro: 98%
```

---

## 9. Live Demo / Demostración en Vivo

### English

**Try the interactive x402 demo at: https://0prompt.xyz/protocol**

The demo allows you to:

1. **Select an AI Model** from 300+ options
2. **Write a Prompt** and see real-time pricing
3. **Connect Your Wallet** (MetaMask, Coinbase Wallet, etc.)
4. **Execute the Full Flow**:
   - Watch the 402 challenge
   - Sign the transaction
   - See on-chain verification
   - Receive the AI response

#### Demo Features:
- Real-time AVAX price from CoinGecko
- Accurate token counting with gpt-tokenizer
- Live execution logs showing every step
- Transaction link to Snowtrace explorer
- Works with both text and image generation models

### Español

**Prueba la demo interactiva de x402 en: https://0prompt.xyz/protocol**

La demo te permite:

1. **Seleccionar un Modelo de IA** de más de 300 opciones
2. **Escribir un Prompt** y ver precios en tiempo real
3. **Conectar Tu Wallet** (MetaMask, Coinbase Wallet, etc.)
4. **Ejecutar el Flujo Completo**:
   - Observa el desafío 402
   - Firma la transacción
   - Ve la verificación on-chain
   - Recibe la respuesta de IA

#### Características de la Demo:
- Precio AVAX en tiempo real de CoinGecko
- Conteo preciso de tokens con gpt-tokenizer
- Logs de ejecución en vivo mostrando cada paso
- Enlace de transacción al explorador Snowtrace
- Funciona con modelos de generación de texto e imagen

---

## 10. Future Roadmap / Hoja de Ruta

### English

#### Phase 1: Current (Completed ✓)
- [x] x402 middleware implementation
- [x] Native AVAX payments on Avalanche
- [x] Real-time quote service
- [x] 300+ AI model access
- [x] Interactive demo at 0prompt.xyz/protocol

#### Phase 2: Near-term
- [ ] **Multi-chain Support**: Base, Arbitrum, Polygon
- [ ] **Stablecoin Payments**: USDC, USDT options
- [ ] **Streaming Payments**: Pay as tokens generate
- [ ] **Redis/DB for Replay Protection**: Production-ready persistence

#### Phase 3: Medium-term
- [ ] **Agent SDK**: npm package for easy integration
- [ ] **Service Discovery**: Agents find x402-enabled services
- [ ] **Reputation System**: Track agent payment history
- [ ] **Refund Protocol**: Handle failed AI requests

#### Phase 4: Long-term Vision
- [ ] **x402 Standard Proposal**: Work toward official RFC
- [ ] **Cross-service Payments**: Agents pay multiple providers
- [ ] **Payment Channels**: Ultra-low-cost L2 payments
- [ ] **DAO Governance**: Community-owned infrastructure

### Español

#### Fase 1: Actual (Completada ✓)
- [x] Implementación de middleware x402
- [x] Pagos nativos AVAX en Avalanche
- [x] Servicio de cotización en tiempo real
- [x] Acceso a 300+ modelos de IA
- [x] Demo interactiva en 0prompt.xyz/protocol

#### Fase 2: Corto plazo
- [ ] **Soporte Multi-chain**: Base, Arbitrum, Polygon
- [ ] **Pagos con Stablecoin**: Opciones USDC, USDT
- [ ] **Pagos en Streaming**: Paga mientras los tokens se generan
- [ ] **Redis/DB para Protección de Replay**: Persistencia lista para producción

#### Fase 3: Mediano plazo
- [ ] **SDK de Agente**: Paquete npm para fácil integración
- [ ] **Descubrimiento de Servicios**: Agentes encuentran servicios x402
- [ ] **Sistema de Reputación**: Rastrea historial de pagos del agente
- [ ] **Protocolo de Reembolso**: Maneja solicitudes de IA fallidas

#### Fase 4: Visión a Largo Plazo
- [ ] **Propuesta de Estándar x402**: Trabajar hacia RFC oficial
- [ ] **Pagos Cross-service**: Agentes pagan a múltiples proveedores
- [ ] **Canales de Pago**: Pagos ultra-bajo-costo en L2
- [ ] **Gobernanza DAO**: Infraestructura propiedad de la comunidad

---

## Quick Reference / Referencia Rápida

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/generate` | POST | Generate AI response (requires x402 payment) |
| `/agent/quote` | POST | Get price quote for a request |
| `/agent/avax-price` | GET | Get current AVAX price |
| `/agent/models` | GET | List available models |

### Key Addresses

| Item | Value |
|------|-------|
| Merchant Address | `0x209F0baCA0c23edc57881B26B68FC4148123B039` |
| Network | Avalanche C-Chain |
| Chain ID | 43114 |
| RPC URL | `https://api.avax.network/ext/bc/C/rpc` |

### Contact & Resources

- **Live Demo**: https://0prompt.xyz/protocol
- **Main App**: https://0prompt.xyz
- **Telegram**: @ncriptado

---

*Last Updated: December 2024*
*ZeroPrompt - Decentralized AI Infrastructure for the Agent Economy*
