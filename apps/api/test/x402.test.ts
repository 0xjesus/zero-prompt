import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { ethers } from 'ethers';
import * as openrouterService from '../src/services/openrouter';

const app = createApp();

// Mock OpenRouter service to avoid real API calls and credit usage during tests
vi.mock('../src/services/openrouter', () => ({
  chatCompletion: vi.fn()
}));

describe('x402 Agent API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 402 Payment Required when accessing premium route without header', async () => {
    const response = await request(app).get('/agent/premium-data');
    
    expect(response.status).toBe(402);
    expect(response.body.error).toBeDefined();
    expect(response.body.accepts).toBeDefined();
    expect(response.body.accepts[0].network).toBe('avalanche-fuji');
    expect(response.body.accepts[0].maxAmountRequired).toBe("10000");
  });

  it('should return 200 OK and AI response when valid X-PAYMENT header is provided', async () => {
    // Mock the AI response
    (openrouterService.chatCompletion as any).mockResolvedValue("I am a real AI response.");

    // 1. Get the requirements (simulating first failed request)
    // We know the requirements from the previous test/code, so we can skip the network call for speed
    // or just hardcode them for the test construction.
    const requirements = {
        payTo: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // From middleware
        asset: "0x5425890298aed601595a70AB815c96711a31Bc65", // From middleware
        maxAmountRequired: "50000" // From route config for /generate
    };

    // 2. Setup Wallet (Simulated Agent)
    const wallet = ethers.Wallet.createRandom();
    
    // 3. Create Authorization (EIP-3009)
    const now = Math.floor(Date.now() / 1000);
    const authorization = {
      from: ethers.getAddress(wallet.address),
      to: ethers.getAddress(requirements.payTo),
      value: requirements.maxAmountRequired,
      validAfter: now - 60, 
      validBefore: now + 3600, 
      nonce: ethers.hexlify(ethers.randomBytes(32))
    };

    // 4. Sign with EIP-712
    const domain = {
      name: "USD Coin",
      version: "2",
      chainId: 43113, // Fuji
      verifyingContract: ethers.getAddress(requirements.asset)
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
    };

    const signature = await wallet.signTypedData(domain, types, authorization);

    // 5. Construct Payload
    const paymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: "avalanche-fuji",
      payload: {
        authorization,
        signature
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString('base64');

    // 6. Retry Request (POST /generate)
    const successResponse = await request(app)
      .post('/agent/generate')
      .set('X-PAYMENT', base64Payload)
      .send({ prompt: "Hello AI" });

    if (successResponse.status !== 200) {
      console.error("Success Response Error:", successResponse.body);
    }

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.result).toBe("I am a real AI response.");
    expect(openrouterService.chatCompletion).toHaveBeenCalledWith(expect.objectContaining({
        messages: [{ role: 'user', content: 'Hello AI' }]
    }));
    
    // Check Response Header
    expect(successResponse.headers['x-payment-response']).toBeDefined();
  });
});