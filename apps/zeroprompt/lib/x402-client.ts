import { type WalletClient } from 'viem';

export interface X402PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
}

export interface X402Response {
  x402Version: number;
  accepts: X402PaymentRequirement[];
  error: string;
}

/**
 * Handles the x402 negotiation flow.
 * 1. Makes initial request.
 * 2. If 402, parses requirements.
 * 3. Requests signature from user wallet.
 * 4. Retries request with X-PAYMENT header.
 */
export async function fetchWithX402(
  url: string, 
  options: RequestInit, 
  signTypedDataAsync: (args: any) => Promise<string>,
  address: string
): Promise<any> {
  // 1. Initial Request
  console.log(`[x402] Initiating request to ${url}`);
  const initialRes = await fetch(url, options);

  if (initialRes.status !== 402) {
    return initialRes;
  }

  // 2. Parse 402 Challenge
  const challengeData = await initialRes.json() as X402Response;
  console.log("[x402] Challenge received:", challengeData);

  if (!challengeData.accepts || challengeData.accepts.length === 0) {
    throw new Error("Invalid 402 response: No payment acceptance criteria found.");
  }

  // We simply pick the first acceptance criteria for this demo
  // In a robust lib, we might filter by supported networks
  const req = challengeData.accepts[0];

  // 3. Prepare Authorization (EIP-3009)
  // We need to create a random 32-byte nonce. 
  // In browser, crypto.getRandomValues is available.
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = "0x" + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const now = Math.floor(Date.now() / 1000);
  
  const authorization = {
    from: address,
    to: req.payTo,
    value: req.maxAmountRequired,
    validAfter: now - 60, // Valid starting 1 min ago
    validBefore: now + 3600, // Valid for 1 hour
    nonce: nonce
  };

  // 4. Sign with EIP-712
  // Note: Wagmi/Viem expects BigInts for uint256 in the types definition usually, 
  // but for the `message` payload, strings often work if the type def says uint256.
  // Let's align strictly with what we did in tests.
  
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: 43113, // Fuji (Hardcoded for Hackathon/Demo consistency, should match req.network)
    verifyingContract: req.asset as `0x${string}`
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  } as const;

  console.log("[x402] Requesting signature...");
  
  const signature = await signTypedDataAsync({
    domain,
    types,
    primaryType: 'TransferWithAuthorization',
    message: authorization
  });

  console.log("[x402] Signature obtained:", signature);

  // 5. Construct Payment Payload
  const paymentPayload = {
    x402Version: 1,
    scheme: req.scheme,
    network: req.network,
    payload: {
      authorization,
      signature
    }
  };

  // Base64 Encode
  const base64Payload = btoa(JSON.stringify(paymentPayload));

  // 6. Retry Request
  const newHeaders = new Headers(options.headers);
  newHeaders.set('X-PAYMENT', base64Payload);

  console.log("[x402] Retrying with Payment Proof...");
  const finalRes = await fetch(url, {
    ...options,
    headers: newHeaders
  });

  return finalRes;
}
