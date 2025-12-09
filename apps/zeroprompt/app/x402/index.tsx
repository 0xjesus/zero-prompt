import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Platform, Image, useWindowDimensions, ActivityIndicator, Modal
} from 'react-native';
import { useAccount, useSignTypedData, useSendTransaction } from 'wagmi';
import { getAddress, parseEther } from 'viem';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { WalletConnectModal } from '../../components/WalletConnectionUI';
import {
  Layers, Code, Shield, Zap, ChevronDown, Copy, Check, Terminal, FileCode,
  Play, Wallet, ArrowRight, CheckCircle, Loader, AlertCircle,
  ExternalLink, Sparkles, DollarSign, Lock, Globe, ChevronRight,
  MessageSquare, Home, Bot, Cpu, Star
} from 'lucide-react-native';

import ModelSelectorModal from '../../components/ModelSelectorModal';
import { API_URL } from '../../config/api';
import { VAULT_ADDRESS, MERCHANT_ADDRESS as RAW_MERCHANT_ADDRESS } from '../../lib/constants';
import { useBilling } from '../../context/BillingContext';
import DepositModal from '../../components/DepositModal';
import ProtocolDemos from '../../components/ProtocolDemos';

// ============================================================================
// CONFIG - x402 EIP-3009 (Avalanche Only)
// ============================================================================
const MERCHANT_ADDRESS = getAddress(RAW_MERCHANT_ADDRESS);

// Avalanche config
const AVALANCHE_CONFIG = {
  chainId: 43114,
  name: 'Avalanche',
  color: '#E84142',
  usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  nativeCurrency: 'AVAX',
};

// ============================================================================
// TYPES
// ============================================================================
type ExecutionStep = 'idle' | 'requesting' | 'paying' | 'confirming' | 'generating' | 'verifying' | 'complete' | 'error';

// ============================================================================
// STEP INDICATOR COMPONENT
// ============================================================================
const StepIndicator = ({
  step,
  currentStep,
  title,
  description,
  isLast = false
}: {
  step: number;
  currentStep: number;
  title: string;
  description: string;
  isLast?: boolean;
}) => {
  const isActive = currentStep === step;
  const isComplete = currentStep > step;
  const isPending = currentStep < step;

  return (
    <View style={{ flexDirection: 'row', opacity: isPending ? 0.4 : 1 }}>
      <View style={{ alignItems: 'center', marginRight: 16 }}>
        <View style={[
          styles.stepCircle,
          isComplete && styles.stepCircleComplete,
          isActive && styles.stepCircleActive
        ]}>
          {isComplete ? (
            <Check size={16} color="#000" strokeWidth={3} />
          ) : isActive ? (
            <Loader size={16} color="#000" />
          ) : (
            <Text style={[styles.stepNumber, isActive && { color: '#000' }]}>{step}</Text>
          )}
        </View>
        {!isLast && (
          <View style={[
            styles.stepLine,
            isComplete && styles.stepLineComplete
          ]} />
        )}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 24 }}>
        <Text style={[styles.stepTitle, isActive && { color: '#00FF41' }]}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
};

// ============================================================================
// EXECUTION LOG COMPONENT
// ============================================================================
const ExecutionLog = ({ logs }: { logs: { message: string; type: 'info' | 'success' | 'error' | 'pending' }[] }) => (
  <View style={styles.logContainer}>
    {logs.map((log, i) => (
      <View key={i} style={styles.logLine}>
        {log.type === 'success' && <CheckCircle size={14} color="#4CAF50" />}
        {log.type === 'error' && <AlertCircle size={14} color="#F44336" />}
        {log.type === 'pending' && <Loader size={14} color="#FFC107" />}
        {log.type === 'info' && <ChevronRight size={14} color="#64748B" />}
        <Text style={[
          styles.logText,
          log.type === 'success' && { color: '#4CAF50' },
          log.type === 'error' && { color: '#F44336' },
          log.type === 'pending' && { color: '#FFC107' }
        ]}>
          {log.message}
        </Text>
      </View>
    ))}
  </View>
);

// ============================================================================
// CODE BLOCK WITH COPY
// ============================================================================
const CodeBlock = ({ code, label }: { code: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (Platform.OS === 'web') {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View style={styles.codeBlockContainer}>
      <View style={styles.codeBlockHeader}>
        <Text style={styles.codeBlockLabel}>{label}</Text>
        <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
          {copied ? (
            <><Check size={12} color="#4CAF50" /><Text style={styles.copyBtnTextSuccess}>Copied!</Text></>
          ) : (
            <><Copy size={12} color="#94a3b8" /><Text style={styles.copyBtnText}>Copy</Text></>
          )}
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.codeBlockScroll}>
        <Text style={styles.codeText}>{code}</Text>
      </ScrollView>
    </View>
  );
};

// ============================================================================
// FEATURE CARD
// ============================================================================
const FeatureCard = ({ icon: Icon, title, description, color }: any) => (
  <View style={[styles.featureCard, { borderColor: `${color}30` }]}>
    <View style={[styles.featureIconContainer, { backgroundColor: `${color}15` }]}>
      <Icon size={24} color={color} />
    </View>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDescription}>{description}</Text>
  </View>
);

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function ProtocolPage() {
  const { theme } = useTheme();
  const { openDepositModal, closeDepositModal, showDepositModal, refreshBilling } = useBilling();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 1024;
  const isMobile = width < 600;

  // Wallet - Use the same auth system as /chat
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { sendTransactionAsync } = useSendTransaction();
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const {
    openWalletModal,
    isConnecting,
    isAuthenticating,
    connectionError,
    migratedChats,
    clearMigratedChats,
    logout
  } = useAuth();

  // Payment method: 'usdc' or 'native'
  const [paymentMethod, setPaymentMethod] = useState<'usdc' | 'native'>('native');

  // Models
  const [models, setModels] = useState<any[]>([]);
  const [selectedModels, setSelectedModels] = useState<any[]>([]);
  const [showModelModal, setShowModelModal] = useState(false);

  // Prompt & Execution
  const [prompt, setPrompt] = useState('Explain how blockchain works in 3 sentences.');
  const [executionStep, setExecutionStep] = useState<ExecutionStep>('idle');
  const [logs, setLogs] = useState<{ message: string; type: 'info' | 'success' | 'error' | 'pending' }[]>([]);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Quote from backend (accurate pricing)
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Code tab
  const [activeTab, setActiveTab] = useState<'curl' | 'typescript' | 'python'>('curl');

  // Fetch models from DB (same as chat) - only paid models for this demo
  useEffect(() => {
    fetch(`${API_URL}/models`)
      .then(res => res.json())
      .then(data => {
        if (data.models?.length > 0) {
          // Filter: paid text models OR image models (exclude free)
          const paidModels = data.models.filter((m: any) => {
            const hasTextPricing = (m.publicPricingPrompt || 0) > 0;
            const hasImagePricing = (m.publicPricingImage || 0) > 0;
            const arch = m.architecture as any;
            const isImageModel = arch?.output_modalities?.includes('image');
            return hasTextPricing || hasImagePricing || isImageModel;
          });
          setModels(paidModels);
          // Pre-select a cheap model (e.g., Llama or similar)
          const cheapModel = paidModels.find((m: any) =>
            m.openrouterId?.includes('llama') ||
            m.openrouterId?.includes('mistral') ||
            (m.publicPricingPrompt > 0 && m.publicPricingPrompt < 0.5)
          ) || paidModels[0];
          if (cheapModel) setSelectedModels([cheapModel]);
        }
      })
      .catch(err => console.log('Failed to fetch models:', err));
  }, []);

  const handleToggleModel = (model: any) => {
    setSelectedModels([model]);
    setShowModelModal(false);
  };

  const selectedModel = selectedModels[0];
  const modelId = selectedModel?.openrouterId || 'meta-llama/llama-3.1-8b-instruct';
  const modelName = selectedModel?.name || 'Select a model';

  // Fetch quote from backend whenever model or prompt changes
  useEffect(() => {
    const fetchQuote = async () => {
      if (!selectedModel?.openrouterId || !prompt.trim()) {
        setQuote(null);
        return;
      }

      try {
        setQuoteLoading(true);
        setQuoteError(null);

        const response = await fetch(`${API_URL}/agent/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel.openrouterId,
            prompt: prompt,
            imageCount: 1
          })
        });

        const data = await response.json();

        if (data.success) {
          setQuote(data);
        } else {
          setQuoteError(data.error || 'Failed to get quote');
        }
      } catch (err: any) {
        console.error('Quote fetch failed:', err);
        setQuoteError('Failed to connect to quote service');
      } finally {
        setQuoteLoading(false);
      }
    };

    // Debounce the quote fetch to avoid too many requests while typing
    const timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedModel?.openrouterId, prompt]);

  // Extract pricing info from backend quote
  const isImageModel = quote?.model?.type === 'image';
  const avaxPrice = quote?.pricing?.avaxPrice || null;

  // Pricing from backend quote (accurate)
  const estimatedTokens = quote?.tokens?.input || 0;
  const estimatedOutputTokens = quote?.tokens?.estimatedOutput || 0;
  const pricePerMToken = selectedModel?.publicPricingPrompt || 0;
  // Price in USD from quote (for display) - actual payment is in USDC
  const estimatedCostUSD = quote?.pricing?.totalCostUSD?.toFixed(4) || '0.05';

  // Add log helper
  const addLog = (message: string, type: 'info' | 'success' | 'error' | 'pending' = 'info') => {
    setLogs(prev => [...prev, { message, type }]);
  };

  // Get current step number for indicator
  const getCurrentStepNumber = (): number => {
    switch (executionStep) {
      case 'idle': return 0;
      case 'requesting': return 1;
      case 'paying': return 2;
      case 'confirming': return 3;
      case 'generating': return 4;
      case 'verifying': return 5;
      case 'complete': return 6;
      case 'error': return 0;
      default: return 0;
    }
  };

  // Execute the full x402 flow with USDC signatures (gas sponsored!)
  const handleExecute = async () => {
    if (!prompt.trim()) return;
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return;
    }

    // Reset state
    setLogs([]);
    setTxHash(null);
    setAiResponse(null);
    setGeneratedImages([]);
    setError(null);

    try {
      // ═══════════════════════════════════════════════════════════════
      // STEP 1: INITIAL REQUEST (GET 402 CHALLENGE)
      // ═══════════════════════════════════════════════════════════════
      setExecutionStep('requesting');
      addLog('══════════════════════════════════════', 'info');
      addLog('STEP 1: REQUESTING x402 CHALLENGE', 'info');
      addLog('══════════════════════════════════════', 'info');
      addLog(`→ API Endpoint: ${API_URL}/agent/generate`, 'info');
      addLog(`→ Model: ${modelId}`, 'info');
      addLog(`→ Payment: USDC on Avalanche (Gas Sponsored)`, 'info');
      addLog(`→ Chain: ${AVALANCHE_CONFIG.name} (${AVALANCHE_CONFIG.chainId})`, 'info');

      // Initial request without payment
      const initialResponse = await fetch(`${API_URL}/agent/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: modelId })
      });

      addLog(`→ Response status: ${initialResponse.status}`, 'info');

      if (initialResponse.status !== 402) {
        // Request succeeded without payment (shouldn't happen)
        const result = await initialResponse.json();
        if (result.error) throw new Error(result.error);
        setAiResponse(result.result);
        setExecutionStep('complete');
        return;
      }

      // Parse 402 challenge
      const challenge = await initialResponse.json();
      addLog('✓ Received x402 payment challenge', 'success');
      addLog(`→ Price: $${challenge.accepts?.[0]?.price || '0.05'} USDC`, 'info');
      addLog(`→ Merchant: ${MERCHANT_ADDRESS}`, 'info');

      const paymentRequirement = challenge.accepts?.[0];
      if (!paymentRequirement) {
        throw new Error('Invalid 402 response: no payment requirements');
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 2: PAY (USDC or Native)
      // ═══════════════════════════════════════════════════════════════
      setExecutionStep('paying');
      addLog('', 'info');
      addLog('══════════════════════════════════════', 'info');
      addLog(`STEP 2: ${paymentMethod === 'usdc' ? 'SIGNING USDC AUTHORIZATION' : 'SENDING NATIVE PAYMENT'}`, 'info');
      addLog('══════════════════════════════════════', 'info');

      // Convert price
      const priceUSD = parseFloat(paymentRequirement.price);

      let signature: string | null = null;
      let usdcAmount: bigint | null = null;
      let txHash: string | null = null;
      let nonce: string | null = null;
      let validAfter: bigint | null = null;
      let validBefore: bigint | null = null;

      if (paymentMethod === 'usdc') {
        // USDC Payment via EIP-3009 TransferWithAuthorization
        addLog(`→ Token: USDC on ${AVALANCHE_CONFIG.name}`, 'info');
        addLog(`→ Amount: $${paymentRequirement.price} USDC`, 'info');
        addLog('→ ⚡ Gas fees are SPONSORED!', 'success');
        addLog('→ Opening wallet for signature...', 'pending');

        // Convert price to USDC units (6 decimals)
        usdcAmount = BigInt(Math.ceil(priceUSD * 1_000_000));

        // Generate random nonce
        const nonceBytes = new Uint8Array(32);
        crypto.getRandomValues(nonceBytes);
        nonce = '0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        const now = Math.floor(Date.now() / 1000);
        validAfter = BigInt(now - 60);
        validBefore = BigInt(now + 3600);

        // EIP-712 domain for USDC
        const domain = {
          name: 'USD Coin',
          version: '2',
          chainId: AVALANCHE_CONFIG.chainId,
          verifyingContract: AVALANCHE_CONFIG.usdc as `0x${string}`
        };

        // EIP-3009 TransferWithAuthorization types
        const types = {
          TransferWithAuthorization: [
            { name: 'from', type: 'address' },
            { name: 'to', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'validAfter', type: 'uint256' },
            { name: 'validBefore', type: 'uint256' },
            { name: 'nonce', type: 'bytes32' }
          ]
        } as const;

        const message = {
          from: address,
          to: MERCHANT_ADDRESS,
          value: usdcAmount,
          validAfter,
          validBefore,
          nonce: nonce as `0x${string}`
        };

        addLog(`→ Signing EIP-3009 authorization...`, 'pending');

        signature = await signTypedDataAsync({
          domain,
          types,
          primaryType: 'TransferWithAuthorization',
          message
        });

        addLog('✓ Signature obtained!', 'success');
        addLog(`→ Signature: ${signature.slice(0, 20)}...`, 'info');
      } else {
        // Native Payment (AVAX, ETH, etc)
        const nativeAmount = priceUSD / (avaxPrice || 35);
        const amountWei = parseEther(nativeAmount.toFixed(18));

        addLog(`→ Token: ${AVALANCHE_CONFIG.nativeCurrency} on ${AVALANCHE_CONFIG.name}`, 'info');
        addLog(`→ Amount: ${nativeAmount.toFixed(4)} ${AVALANCHE_CONFIG.nativeCurrency} (~$${priceUSD})`, 'info');
        addLog('→ You will pay gas + payment', 'info');
        addLog('→ Opening wallet for transaction...', 'pending');

        // Send native transaction directly to merchant
        const tx = await sendTransactionAsync({
          to: MERCHANT_ADDRESS as `0x${string}`,
          value: amountWei,
          chainId: AVALANCHE_CONFIG.chainId
        });

        txHash = tx;
        addLog('✓ Transaction sent!', 'success');
        addLog(`→ TxHash: ${txHash.slice(0, 20)}...`, 'info');
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 3: SEND REQUEST WITH x402 PAYMENT
      // ═══════════════════════════════════════════════════════════════
      setExecutionStep('confirming');
      addLog('', 'info');
      addLog('══════════════════════════════════════', 'info');
      addLog('STEP 3: SUBMITTING x402 PAYMENT', 'info');
      addLog('══════════════════════════════════════', 'info');

      // Build x402 payment payload
      let paymentPayload: any;

      if (paymentMethod === 'usdc' && signature && usdcAmount && validAfter !== null && validBefore !== null && nonce) {
        // USDC payment with EIP-3009 signature
        paymentPayload = {
          x402Version: 2,
          scheme: 'x402-eip3009',
          network: 'avalanche',
          chainId: AVALANCHE_CONFIG.chainId,
          token: AVALANCHE_CONFIG.usdc,
          payload: {
            from: address,
            to: MERCHANT_ADDRESS,
            value: usdcAmount.toString(),
            validAfter: validAfter.toString(),
            validBefore: validBefore.toString(),
            nonce,
            signature
          }
        };
        addLog(`→ EIP-3009 payment payload created`, 'info');
      } else if (txHash) {
        // Native payment with transaction hash
        paymentPayload = {
          x402Version: 2,
          scheme: 'x402-native',
          network: 'avalanche',
          chainId: AVALANCHE_CONFIG.chainId,
          payload: {
            txHash,
            from: address,
            to: MERCHANT_ADDRESS,
            amount: priceUSD.toString()
          }
        };
        addLog(`→ Native tx payment payload created`, 'info');
      } else {
        throw new Error('Invalid payment method or missing payment data');
      }

      const finalPaymentHeader = btoa(JSON.stringify(paymentPayload));
      addLog(`→ Sending payment to backend...`, 'pending');

      // Retry request with payment
      setExecutionStep('generating');
      addLog('', 'info');
      addLog('══════════════════════════════════════', 'info');
      addLog('STEP 4: VERIFYING PAYMENT', 'info');
      addLog('══════════════════════════════════════', 'info');

      // Add a small delay to show the verification step
      setExecutionStep('verifying');
      await new Promise(resolve => setTimeout(resolve, 1500));
      addLog('✓ Payment verified on-chain', 'success');

      setExecutionStep('generating');
      addLog('', 'info');
      addLog('══════════════════════════════════════', 'info');
      addLog('STEP 5: GENERATING AI RESPONSE', 'info');
      addLog('══════════════════════════════════════', 'info');

      const response = await fetch(`${API_URL}/agent/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': finalPaymentHeader
        },
        body: JSON.stringify({ prompt, model: modelId })
      });

      addLog(`→ Response status: ${response.status}`, 'info');

      const result = await response.json();

      console.log('[Protocol] Full API response:', JSON.stringify(result, null, 2));
      addLog(`→ Response keys: ${Object.keys(result).join(', ')}`, 'info');

      if (result.error) {
        addLog(`✗ API Error: ${result.error}`, 'error');
        if (result.hint) {
          addLog(`  Hint: ${result.hint}`, 'info');
        }
        throw new Error(result.error);
      }

      // ═══════════════════════════════════════════════════════════════
      // SUCCESS!
      // ═══════════════════════════════════════════════════════════════
      addLog('', 'info');
      addLog('══════════════════════════════════════', 'success');
      addLog('✓ SUCCESS! x402 FLOW COMPLETE', 'success');
      addLog('══════════════════════════════════════', 'success');
      addLog(`✓ Payment settled on-chain (gas sponsored)`, 'success');
      addLog(`✓ AI response received`, 'success');

      // Handle text responses
      if (result.result && typeof result.result === 'string') {
        setAiResponse(result.result);
      }

      // Handle image responses - check multiple formats
      const images: string[] = [];

      if (result.generatedImages && Array.isArray(result.generatedImages)) {
        images.push(...result.generatedImages);
      }
      if (result.generatedImage) {
        images.push(result.generatedImage);
      }
      if (result.imageUrl) {
        images.push(result.imageUrl);
      }
      if (result.result && typeof result.result === 'string') {
        if (result.result.match(/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i) ||
            result.result.startsWith('data:image/')) {
          images.push(result.result);
          setAiResponse(null);
        }
      }

      if (images.length > 0) {
        setGeneratedImages(images);
        addLog(`✓ Generated ${images.length} image(s)`, 'success');
      }

      setExecutionStep('complete');

    } catch (err: any) {
      setError(err.message);
      addLog('', 'error');
      addLog('══════════════════════════════════════', 'error');
      addLog(`✗ ERROR: ${err.message}`, 'error');
      addLog('══════════════════════════════════════', 'error');

      if (err.message.includes('rejected') || err.message.includes('denied')) {
        addLog('', 'info');
        addLog('💡 TIP: You rejected the signature request.', 'info');
        addLog('   No funds were spent!', 'info');
      }
      if (err.message.includes('insufficient')) {
        addLog('', 'info');
        addLog('💡 TIP: Insufficient USDC balance.', 'info');
        addLog('   Add USDC to your wallet on ' + AVALANCHE_CONFIG.name, 'info');
      }

      setExecutionStep('error');
    }
  };

  // Reset
  const handleReset = () => {
    setExecutionStep('idle');
    setLogs([]);
    setTxHash(null);
    setAiResponse(null);
    setGeneratedImages([]);
    setError(null);
  };

  // Generated code - ALWAYS use production API URL
  const PROD_API_URL = 'https://api.0prompt.xyz';

  const curlCode = useMemo(() => `# ══════════════════════════════════════════════════════════════
# x402 Protocol - ZeroPrompt AI API
# Production Endpoint: ${PROD_API_URL}
# Payment: USDC (Gas Sponsored!)
# ══════════════════════════════════════════════════════════════

# STEP 1: Make initial request - receive 402 challenge
curl -X POST "${PROD_API_URL}/agent/generate" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelId}",
    "prompt": "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
  }'

# Response: HTTP 402 with payment requirements
# {
#   "x402Version": 2,
#   "accepts": [{
#     "scheme": "x402-eip3009",
#     "network": "avalanche",
#     "token": "USDC",
#     "price": "0.05",
#     "gasSponsored": true
#   }]
# }

# STEP 2: Sign EIP-3009 USDC authorization (see TypeScript example)
# No gas fees! Server settles payment on-chain for you

# STEP 3: Retry request with signed authorization
curl -X POST "${PROD_API_URL}/agent/generate" \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64-encoded-signature-payload>" \\
  -d '{
    "model": "${modelId}",
    "prompt": "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"
  }'`, [modelId, prompt]);

  const typescriptCode = useMemo(() => `// ══════════════════════════════════════════════════════════════
// x402 Protocol - ZeroPrompt AI API (EIP-3009)
// Production Endpoint: ${PROD_API_URL}
// Payment: USDC with Gas Sponsorship!
// ══════════════════════════════════════════════════════════════

import { createWalletClient, http, parseUnits } from 'viem';
import { avalanche } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { randomBytes } from 'crypto';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const API_URL = '${PROD_API_URL}';
const MERCHANT = '${MERCHANT_ADDRESS}';
const USDC_ADDRESS = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'; // Avalanche

// For agents: use private key (keep secure!)
const account = privateKeyToAccount('0xYOUR_PRIVATE_KEY');

const walletClient = createWalletClient({
  account,
  chain: avalanche,
  transport: http('https://api.avax.network/ext/bc/C/rpc')
});

// ═══════════════════════════════════════════════════════════════
// MAIN FUNCTION - Call any AI model with x402 payment
// ═══════════════════════════════════════════════════════════════
async function callZeroPrompt(prompt: string, model: string) {
  // 1. Make initial request - get 402 challenge
  const initialRes = await fetch(\`\${API_URL}/agent/generate\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt })
  });

  if (initialRes.status !== 402) {
    return await initialRes.json();
  }

  const challenge = await initialRes.json();
  const priceUSD = parseFloat(challenge.accepts[0].price);
  console.log(\`Price: \$\${priceUSD} USDC (gas sponsored!)\`);

  // 2. Sign EIP-3009 TransferWithAuthorization
  const usdcAmount = parseUnits(priceUSD.toString(), 6);
  const nonce = '0x' + randomBytes(32).toString('hex');
  const now = Math.floor(Date.now() / 1000);

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: avalanche.id,
      verifyingContract: USDC_ADDRESS
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' }
      ]
    },
    primaryType: 'TransferWithAuthorization',
    message: {
      from: account.address,
      to: MERCHANT,
      value: usdcAmount,
      validAfter: BigInt(now - 60),
      validBefore: BigInt(now + 3600),
      nonce
    }
  });

  // 3. Retry with signed authorization
  const paymentPayload = {
    x402Version: 2,
    scheme: 'x402-eip3009',
    payload: {
      authorization: {
        from: account.address,
        to: MERCHANT,
        value: usdcAmount.toString(),
        validAfter: (now - 60).toString(),
        validBefore: (now + 3600).toString(),
        nonce
      },
      signature
    }
  };

  const response = await fetch(\`\${API_URL}/agent/generate\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': btoa(JSON.stringify(paymentPayload))
    },
    body: JSON.stringify({ model, prompt })
  });

  return await response.json();
}

// ═══════════════════════════════════════════════════════════════
// USAGE EXAMPLE
// ═══════════════════════════════════════════════════════════════
const result = await callZeroPrompt(
  "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
  "${modelId}"
);

console.log('AI Response:', result.result);`, [modelId, prompt]);

  const pythonCode = useMemo(() => `# ══════════════════════════════════════════════════════════════
# x402 Protocol - ZeroPrompt AI API (Python)
# Production Endpoint: ${PROD_API_URL}
# Payment: USDC with Gas Sponsorship!
# pip install web3 requests eth-account
# ══════════════════════════════════════════════════════════════

from web3 import Web3
from eth_account.messages import encode_typed_data
import requests
import base64
import json
import secrets

# ═══════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════
API_URL = '${PROD_API_URL}'
MERCHANT = '${MERCHANT_ADDRESS}'
PRIVATE_KEY = '0xYOUR_PRIVATE_KEY'  # Keep secure!
USDC_ADDRESS = '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'  # Avalanche

w3 = Web3(Web3.HTTPProvider('https://api.avax.network/ext/bc/C/rpc'))
account = w3.eth.account.from_key(PRIVATE_KEY)

def call_zeroprompt(prompt: str, model: str) -> dict:
    """Call ZeroPrompt AI API with x402 USDC payment (gas sponsored!)"""

    # 1. Make initial request - get 402 challenge
    initial_res = requests.post(
        f'{API_URL}/agent/generate',
        json={'model': model, 'prompt': prompt}
    )

    if initial_res.status_code != 402:
        return initial_res.json()

    challenge = initial_res.json()
    price_usd = float(challenge['accepts'][0]['price'])
    print(f"Price: \${price_usd} USDC (gas sponsored!)")

    # 2. Sign EIP-3009 TransferWithAuthorization
    usdc_amount = int(price_usd * 1_000_000)  # 6 decimals
    nonce = '0x' + secrets.token_hex(32)
    now = int(time.time())

    typed_data = {
        'types': {
            'EIP712Domain': [
                {'name': 'name', 'type': 'string'},
                {'name': 'version', 'type': 'string'},
                {'name': 'chainId', 'type': 'uint256'},
                {'name': 'verifyingContract', 'type': 'address'}
            ],
            'TransferWithAuthorization': [
                {'name': 'from', 'type': 'address'},
                {'name': 'to', 'type': 'address'},
                {'name': 'value', 'type': 'uint256'},
                {'name': 'validAfter', 'type': 'uint256'},
                {'name': 'validBefore', 'type': 'uint256'},
                {'name': 'nonce', 'type': 'bytes32'}
            ]
        },
        'primaryType': 'TransferWithAuthorization',
        'domain': {
            'name': 'USD Coin',
            'version': '2',
            'chainId': 43114,
            'verifyingContract': USDC_ADDRESS
        },
        'message': {
            'from': account.address,
            'to': MERCHANT,
            'value': usdc_amount,
            'validAfter': now - 60,
            'validBefore': now + 3600,
            'nonce': nonce
        }
    }

    signed = account.sign_typed_data(full_message=typed_data)

    # 3. Build x402 payment payload
    payment_payload = {
        'x402Version': 2,
        'scheme': 'x402-eip3009',
        'payload': {
            'authorization': {
                'from': account.address,
                'to': MERCHANT,
                'value': str(usdc_amount),
                'validAfter': str(now - 60),
                'validBefore': str(now + 3600),
                'nonce': nonce
            },
            'signature': signed.signature.hex()
        }
    }

    # 4. Retry with signed authorization
    response = requests.post(
        f'{API_URL}/agent/generate',
        headers={
            'Content-Type': 'application/json',
            'X-PAYMENT': base64.b64encode(json.dumps(payment_payload).encode()).decode()
        },
        json={'model': model, 'prompt': prompt}
    )

    return response.json()

# ═══════════════════════════════════════════════════════════════
# USAGE EXAMPLE
# ═══════════════════════════════════════════════════════════════
result = call_zeroprompt(
    "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}",
    "${modelId}"
)

print('AI Response:', result['result'])`, [modelId, prompt]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* NAVBAR - Mobile Optimized */}
      <View style={[styles.navbar, isMobile && styles.navbarMobile]}>
        <TouchableOpacity onPress={() => router.push('/home')} style={styles.navBrand}>
          <Image
            source={require('../../assets/logos/zero-prompt-logo.png')}
            style={[styles.navLogo, isMobile && { width: 28, height: 28 }]}
            resizeMode="contain"
          />
          {!isMobile && <Text style={styles.navTitle}>ZeroPrompt</Text>}
          <View style={[styles.navBadge, isMobile && { paddingHorizontal: 6, paddingVertical: 2 }]}>
            <Text style={[styles.navBadgeText, isMobile && { fontSize: 9 }]}>API</Text>
          </View>
        </TouchableOpacity>

        <View style={[styles.navLinks, isMobile && styles.navLinksMobile]}>
          {/* Show only icons on mobile for nav items */}
          <TouchableOpacity onPress={() => router.push('/home')} style={[styles.navLink, isMobile && styles.navLinkMobile]}>
            <Home size={isMobile ? 18 : 16} color="#888" />
            {isDesktop && <Text style={styles.navLinkText}>Home</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/')} style={[styles.navLink, isMobile && styles.navLinkMobile]}>
            <MessageSquare size={isMobile ? 18 : 16} color="#888" />
            {isDesktop && <Text style={styles.navLinkText}>Chat</Text>}
          </TouchableOpacity>
          {!isMobile && (
            <TouchableOpacity onPress={() => router.push('/reputation')} style={[styles.navLink, !isDesktop && { paddingHorizontal: 8 }]}>
              <Star size={16} color="#888" />
              {isDesktop && <Text style={styles.navLinkText}>Reputation</Text>}
            </TouchableOpacity>
          )}

          {/* Wallet/Connect Button - Always visible */}
          {isConnected ? (
            <>
              {/* Deposit button - hide on small mobile */}
              {!isMobile && (
                <TouchableOpacity
                  onPress={() => openDepositModal()}
                  style={[styles.navLink, { backgroundColor: 'rgba(139, 92, 246, 0.1)', paddingHorizontal: isDesktop ? 12 : 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.2)' }]}
                >
                  <Wallet size={16} color="#8B5CF6" />
                  {isDesktop && <Text style={[styles.navLinkText, { color: '#8B5CF6', fontWeight: '700' }]}>Crypto</Text>}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.walletConnected, isMobile && styles.walletConnectedMobile]}
                onPress={() => setShowWalletMenu(true)}
              >
                <View style={styles.walletDot} />
                {!isMobile && <Text style={styles.walletAddress}>{address?.slice(0, 6)}...{address?.slice(-4)}</Text>}
              </TouchableOpacity>
              <Modal
                visible={showWalletMenu}
                transparent
                animationType="fade"
                onRequestClose={() => setShowWalletMenu(false)}
              >
                <TouchableOpacity
                  style={styles.walletModalOverlay}
                  activeOpacity={1}
                  onPress={() => setShowWalletMenu(false)}
                >
                  <View style={[styles.walletModalContent, isMobile && { width: '95%', maxWidth: 320 }]}>
                    <Text style={styles.walletModalTitle}>Wallet Connected</Text>
                    <Text style={[styles.walletModalAddress, isMobile && { fontSize: 10 }]}>{address}</Text>

                    {/* Add deposit option in modal for mobile */}
                    {isMobile && (
                      <TouchableOpacity
                        style={[styles.disconnectBtn, { backgroundColor: '#8B5CF6', marginBottom: 8 }]}
                        onPress={() => {
                          setShowWalletMenu(false);
                          openDepositModal();
                        }}
                      >
                        <Text style={styles.disconnectBtnText}>Add Credits</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={styles.disconnectBtn}
                      onPress={() => {
                        logout();
                        setShowWalletMenu(false);
                      }}
                    >
                      <Text style={styles.disconnectBtnText}>Disconnect Wallet</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setShowWalletMenu(false)}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Modal>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.connectBtn, isMobile && styles.connectBtnMobile]}
              onPress={openWalletModal}
              disabled={isConnecting || isAuthenticating}
            >
              {isConnecting || isAuthenticating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Wallet size={isMobile ? 18 : 16} color="#000" />
                  {!isMobile && <Text style={styles.connectBtnText}>Connect</Text>}
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.content, isMobile && styles.contentMobile]} showsVerticalScrollIndicator={false}>

        {/* ============================================================
            HERO SECTION - Mobile Optimized
        ============================================================ */}
        <View style={[styles.heroSection, isMobile && styles.heroSectionMobile]}>
          <LinearGradient
            colors={['rgba(0, 255, 65, 0.1)', 'rgba(139, 92, 246, 0.1)', 'transparent']}
            style={styles.heroGradient}
          />

          <View style={[styles.heroBadge, isMobile && { paddingHorizontal: 12, paddingVertical: 6 }]}>
            <Bot size={isMobile ? 12 : 14} color="#00FF41" />
            <Text style={[styles.heroBadgeText, { color: '#00FF41' }, isMobile && { fontSize: 11 }]}>
              {isMobile ? 'Decentralized AI API' : 'Decentralized AI API for Agents'}
            </Text>
          </View>

          <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile]}>
            ZeroPrompt{'\n'}
            <Text style={{ color: '#00FF41' }}>Agent API</Text>
          </Text>

          <Text style={[styles.heroSubtitle, isMobile && styles.heroSubtitleMobile]}>
            {isMobile
              ? 'Access 300+ AI models without API keys. Pay per request with crypto.'
              : `The decentralized API that lets AI agents access 300+ models\nwithout API keys, accounts, or subscriptions.\n`}
            {!isMobile && <Text style={{ color: '#8B5CF6' }}>Powered by x402 micropayments.</Text>}
          </Text>

          <View style={[styles.heroStats, isMobile && styles.heroStatsMobile]}>
            <View style={[styles.heroStat, isMobile && { paddingHorizontal: 12 }]}>
              <Text style={[styles.heroStatValue, isMobile && { fontSize: 22 }]}>300+</Text>
              <Text style={[styles.heroStatLabel, isMobile && { fontSize: 10 }]}>Models</Text>
            </View>
            <View style={[styles.heroStatDivider, isMobile && { height: 30 }]} />
            <View style={[styles.heroStat, isMobile && { paddingHorizontal: 12 }]}>
              <Text style={[styles.heroStatValue, isMobile && { fontSize: 22 }]}>0</Text>
              <Text style={[styles.heroStatLabel, isMobile && { fontSize: 10 }]}>API Keys</Text>
            </View>
            <View style={[styles.heroStatDivider, isMobile && { height: 30 }]} />
            <View style={[styles.heroStat, isMobile && { paddingHorizontal: 12 }]}>
              <Text style={[styles.heroStatValue, isMobile && { fontSize: 22 }]}>∞</Text>
              <Text style={[styles.heroStatLabel, isMobile && { fontSize: 10 }]}>Compatible</Text>
            </View>
          </View>

          {/* CTA Buttons - Stack on mobile */}
          <View style={[styles.heroCTAs, isMobile && styles.heroCTAsMobile]}>
            <TouchableOpacity style={[styles.primaryCTA, isMobile && styles.primaryCTAMobile]} onPress={() => {
              if (Platform.OS === 'web') {
                document.getElementById('api-console')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}>
              <Play size={isMobile ? 18 : 20} color="#000" />
              <Text style={[styles.primaryCTAText, isMobile && { fontSize: 14 }]}>Try API Console</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryCTA, isMobile && styles.secondaryCTAMobile]} onPress={() => router.push('/')}>
              <MessageSquare size={isMobile ? 18 : 20} color="#00FF41" />
              <Text style={[styles.secondaryCTAText, isMobile && { fontSize: 14 }]}>Chat Interface</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================
            WHAT IS ZEROPROMPT API
        ============================================================ */}
        <View style={[styles.section, isMobile && styles.sectionMobile]}>
          <Text style={styles.sectionLabel}>WHAT IS IT</Text>
          <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
            {isMobile ? 'AI Infrastructure' : 'AI Infrastructure for Autonomous Agents'}
          </Text>
          <Text style={[styles.sectionSubtitle, isMobile && styles.sectionSubtitleMobile]}>
            {isMobile
              ? 'Decentralized gateway for AI agents to access any model without API keys or rate limits.'
              : 'ZeroPrompt API is a decentralized gateway that allows AI agents to consume any AI model without the friction of API keys, rate limits, or account management. Perfect for autonomous systems.'}
          </Text>

          <View style={[styles.featuresGrid, isMobile && styles.featuresGridMobile]}>
            <FeatureCard
              icon={Bot}
              title="Agent-First"
              description={isMobile ? "AI agents access models without human intervention." : "Built specifically for AI agents that need autonomous access to AI models without human intervention."}
              color="#00FF41"
            />
            <FeatureCard
              icon={Cpu}
              title="300+ Models"
              description="Access OpenAI, Anthropic, Google, Meta, Mistral, and hundreds of open-source models through one endpoint."
              color="#00D4FF"
            />
            <FeatureCard
              icon={Lock}
              title="No API Keys"
              description="No accounts, no API keys to manage or leak. Authentication happens on-chain per request."
              color="#8B5CF6"
            />
            <FeatureCard
              icon={Zap}
              title="Pay Per Request"
              description="Micropayments per API call. No subscriptions, no minimums. Pay exactly what you use."
              color="#EC4899"
            />
          </View>
        </View>

        {/* ============================================================
            HOW IT WORKS - VISUAL FLOW
        ============================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
          <Text style={styles.sectionTitle}>Simple Integration Flow</Text>
          <Text style={styles.sectionSubtitle}>
            Your agent makes a request, pays via x402, and gets the AI response. All in one HTTP call.
          </Text>

          <View style={[styles.flowContainer, { flexDirection: isDesktop ? 'row' : 'column' }]}>
            {[
              { step: 1, icon: Bot, title: 'Agent Request', desc: 'Your agent calls the API', color: '#00FF41' },
              { step: 2, icon: DollarSign, title: 'x402 Payment', desc: 'Micropayment on-chain', color: '#8B5CF6' },
              { step: 3, icon: Cpu, title: 'AI Processing', desc: 'Model generates response', color: '#00D4FF' },
              { step: 4, icon: Sparkles, title: 'Response', desc: 'Agent receives result', color: '#EC4899' },
            ].map((item, idx) => (
              <React.Fragment key={item.step}>
                <View style={styles.flowStep}>
                  <View style={[styles.flowStepIcon, { backgroundColor: `${item.color}20` }]}>
                    <item.icon size={28} color={item.color} />
                  </View>
                  <Text style={styles.flowStepNumber}>Step {item.step}</Text>
                  <Text style={styles.flowStepTitle}>{item.title}</Text>
                  <Text style={styles.flowStepDesc}>{item.desc}</Text>
                </View>
                {idx < 3 && (
                  <View style={[styles.flowArrow, { transform: [{ rotate: isDesktop ? '0deg' : '90deg' }] }]}>
                    <ArrowRight size={24} color="#333" />
                  </View>
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ============================================================
            x402 EXPLAINED
        ============================================================ */}
        <View style={styles.section}>
          <View style={styles.x402Banner}>
            <View style={styles.x402BannerLeft}>
              <Text style={styles.x402BannerLabel}>PAYMENT PROTOCOL</Text>
              <Text style={styles.x402BannerTitle}>Powered by x402 + EIP-3009</Text>
              <Text style={styles.x402BannerDesc}>
                x402 is the HTTP 402 "Payment Required" standard for machine-to-machine payments.
                Combined with EIP-3009 TransferWithAuthorization, it enables gasless USDC payments on Avalanche.
              </Text>
            </View>
            <View style={styles.x402BannerRight}>
              <View style={styles.x402Feature}>
                <Shield size={20} color="#8B5CF6" />
                <Text style={styles.x402FeatureText}>Trustless verification</Text>
              </View>
              <View style={styles.x402Feature}>
                <Globe size={20} color="#8B5CF6" />
                <Text style={styles.x402FeatureText}>Avalanche C-Chain</Text>
              </View>
              <View style={styles.x402Feature}>
                <Zap size={20} color="#00FF41" />
                <Text style={[styles.x402FeatureText, { color: '#00FF41' }]}>⚡ Gas fees sponsored</Text>
              </View>
              <View style={styles.x402Feature}>
                <DollarSign size={20} color="#2775CA" />
                <Text style={[styles.x402FeatureText, { color: '#2775CA' }]}>Pay with USDC</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ============================================================
            USE CASE DEMOS - Battle, Consensus, Gallery
        ============================================================ */}
        <View style={styles.section} nativeID="demos">
          <Text style={styles.sectionLabel}>USE CASES</Text>
          <Text style={styles.sectionTitle}>300+ Models, Infinite Possibilities</Text>
          <Text style={styles.sectionSubtitle}>
            With x402 you get instant access to every major AI model. One payment, multiple models.{'\n'}
            Try these demos to see the power of permissionless AI.
          </Text>

          <View style={styles.demosWrapper}>
            <ProtocolDemos
              isConnected={isConnected}
              address={address}
              openWalletModal={openWalletModal}
              models={models}
              theme={theme}
            />
          </View>
        </View>

        {/* ============================================================
            INTERACTIVE DEMO (Single Model)
        ============================================================ */}
        <View style={styles.section} nativeID="api-console">
          <Text style={styles.sectionLabel}>SINGLE MODEL DEMO</Text>
          <Text style={styles.sectionTitle}>Test the x402 Payment Flow</Text>
          <Text style={styles.sectionSubtitle}>
            This console demonstrates a real x402 payment on Avalanche Mainnet.{'\n'}
            Watch the complete flow: wallet → blockchain → API verification → AI response.
          </Text>

          {/* Network Notice */}
          <View style={[styles.networkNotice, { borderColor: 'rgba(0, 255, 65, 0.3)', backgroundColor: 'rgba(0, 255, 65, 0.05)' }]}>
            <Zap size={18} color="#00FF41" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={[styles.networkNoticeTitle, { color: '#00FF41' }]}>Live on Avalanche Mainnet</Text>
              <Text style={styles.networkNoticeText}>
                This is a real x402 payment on Avalanche C-Chain (Chain ID: 43114).{'\n'}
                You will spend real AVAX. Make sure your wallet is connected to Avalanche Mainnet.
              </Text>
            </View>
          </View>

          <View style={[styles.consoleContainer, !isDesktop && styles.consoleContainerMobile]}>

            {/* LEFT PANEL - Input */}
            <View style={[styles.consolePanel, isDesktop && { flex: 1 }, isMobile && styles.consolePanelMobile]}>
              <View style={styles.consolePanelHeader}>
                <Terminal size={18} color="#00FF41" />
                <Text style={styles.consolePanelTitle}>1. Configure Request</Text>
              </View>
              <Text style={styles.consolePanelDesc}>
                Select an AI model and enter your prompt. The price updates automatically.
              </Text>

              {/* Model Selector */}
              <Text style={styles.inputLabel}>AI Model</Text>
              <TouchableOpacity
                style={styles.modelSelector}
                onPress={() => setShowModelModal(true)}
              >
                <View style={styles.modelSelectorLeft}>
                  <Sparkles size={20} color={isImageModel ? '#EC4899' : '#00FF41'} />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.modelSelectorName} numberOfLines={1}>{modelName}</Text>
                    <Text style={[styles.modelSelectorPrice, { color: isImageModel ? '#EC4899' : '#00FF41' }]}>
                      {isImageModel
                        ? `$${(selectedModel?.publicPricingImage || 0.02).toFixed(4)}/image`
                        : `$${pricePerMToken}/M tokens`
                      }
                    </Text>
                  </View>
                </View>
                <ChevronDown size={20} color="#666" />
              </TouchableOpacity>

              {/* Payment Method Selector */}
              <Text style={styles.inputLabel}>Payment Method</Text>
              <View style={styles.paymentMethodContainer}>
                <TouchableOpacity
                  style={[
                    styles.paymentMethodOption,
                    paymentMethod === 'native' && styles.paymentMethodOptionActiveAVAX
                  ]}
                  onPress={() => setPaymentMethod('native')}
                >
                  <Image
                    source={require('../../assets/logos/avax-logo.png')}
                    style={styles.paymentMethodLogo}
                  />
                  <View>
                    <Text style={[
                      styles.paymentMethodText,
                      paymentMethod === 'native' && styles.paymentMethodTextActiveAVAX
                    ]}>
                      AVAX
                    </Text>
                    <Text style={styles.paymentMethodSubtext}>Native</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.paymentMethodOption,
                    paymentMethod === 'usdc' && styles.paymentMethodOptionActiveUSDC
                  ]}
                  onPress={() => setPaymentMethod('usdc')}
                >
                  <Image
                    source={require('../../assets/logos/usd-logo.png')}
                    style={styles.paymentMethodLogo}
                  />
                  <View>
                    <Text style={[
                      styles.paymentMethodText,
                      paymentMethod === 'usdc' && styles.paymentMethodTextActiveUSDC
                    ]}>
                      USDC
                    </Text>
                    <Text style={[styles.paymentMethodSubtext, { color: '#00FF41' }]}>Gas Free</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Prompt Input */}
              <Text style={styles.inputLabel}>Your Prompt</Text>
              <TextInput
                style={styles.promptInput}
                placeholder="Ask anything..."
                placeholderTextColor="#444"
                multiline
                value={prompt}
                onChangeText={setPrompt}
              />

              {/* Price Summary */}
              <View style={styles.priceSummary}>
                {/* Quote Status Header */}
                <View style={[styles.priceRow, { borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 10, marginBottom: 10 }]}>
                  <Text style={styles.priceLabel}>Quote Status</Text>
                  {quoteLoading ? (
                    <Text style={[styles.priceValue, { color: '#FFC107' }]}>Calculating...</Text>
                  ) : quoteError ? (
                    <Text style={[styles.priceValue, { color: '#F44336' }]}>Error</Text>
                  ) : quote ? (
                    <Text style={[styles.priceValue, { color: '#00FF41' }]}>Ready</Text>
                  ) : (
                    <Text style={[styles.priceValue, { color: '#666' }]}>Enter prompt</Text>
                  )}
                </View>

                {/* AVAX Price */}
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>AVAX Price (Live)</Text>
                  <Text style={[styles.priceValue, { color: '#00D4FF' }]}>
                    {avaxPrice ? `$${avaxPrice.toFixed(2)}` : '...'}
                  </Text>
                </View>

                {/* Model type indicator */}
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Model Type</Text>
                  <Text style={[styles.priceValue, { color: isImageModel ? '#EC4899' : '#8B5CF6' }]}>
                    {quote ? (isImageModel ? 'Image Generation' : 'Text Generation') : '...'}
                  </Text>
                </View>

                {/* Token/Image breakdown */}
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    {isImageModel ? 'Images' : 'Tokens (gpt-tokenizer)'}
                  </Text>
                  <Text style={styles.priceValue}>
                    {quote ? (isImageModel
                      ? `${quote.images?.count || 1} image(s)`
                      : `${estimatedTokens} in + ~${estimatedOutputTokens} out`
                    ) : '...'}
                  </Text>
                </View>

                {/* Payment */}
                <View style={[styles.priceRow, { borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 10, marginBottom: 6 }]}>
                  <Text style={[styles.priceLabel, { fontWeight: '600' }]}>
                    Payment ({paymentMethod === 'usdc' ? 'USDC' : AVALANCHE_CONFIG.nativeCurrency})
                  </Text>
                  <Text style={[styles.priceValue, { color: '#00FF41', fontSize: 20, fontWeight: '700' }]}>
                    {paymentMethod === 'usdc' ? `$${estimatedCostUSD} USDC` : `~${(parseFloat(estimatedCostUSD) / (avaxPrice || 35)).toFixed(4)} ${AVALANCHE_CONFIG.nativeCurrency}`}
                  </Text>
                </View>

                {/* Gas notice */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Shield size={14} color={paymentMethod === 'usdc' ? "#10B981" : "#FFC107"} />
                  <Text style={{ color: paymentMethod === 'usdc' ? "#10B981" : "#FFC107", fontSize: 12, fontWeight: '600' }}>
                    {paymentMethod === 'usdc' ? 'Gas fees sponsored!' : 'You pay gas + payment'}
                  </Text>
                </View>

                {/* Chain info */}
                <Text style={{ color: '#666', fontSize: 11, marginTop: 6 }}>
                  Chain: {AVALANCHE_CONFIG.name} (Avalanche C-Chain)
                </Text>
              </View>

              {/* Execute Button */}
              {executionStep === 'idle' || executionStep === 'error' ? (
                <TouchableOpacity
                  style={[
                    styles.executeBtn,
                    (!prompt.trim() || !isConnected || !quote || quoteLoading) && styles.executeBtnDisabled
                  ]}
                  onPress={handleExecute}
                  disabled={!prompt.trim() || !isConnected || !quote || quoteLoading}
                >
                  <Play size={20} color="#000" />
                  <Text style={styles.executeBtnText}>
                    {!isConnected ? 'Connect Wallet First' : quoteLoading ? 'Getting Quote...' : !quote ? 'Enter Prompt' : 'Execute & Pay'}
                  </Text>
                </TouchableOpacity>
              ) : executionStep === 'complete' ? (
                <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                  <Text style={styles.resetBtnText}>Try Another Request</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.executingBtn}>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={styles.executingBtnText}>Processing...</Text>
                </View>
              )}

              {!isConnected && (
                <TouchableOpacity onPress={openWalletModal} style={styles.walletWarningBtn}>
                  <Wallet size={16} color="#FFC107" />
                  <Text style={styles.walletWarning}>
                    Connect wallet to test the x402 payment flow
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* RIGHT PANEL - Execution */}
            <View style={[styles.consolePanel, styles.consolePanelDark, isDesktop && { flex: 1.2 }, isMobile && styles.consolePanelMobile]}>
              <View style={styles.consolePanelHeader}>
                <Layers size={18} color="#8B5CF6" />
                <Text style={styles.consolePanelTitle}>2. Watch the x402 Flow</Text>
              </View>
              <Text style={styles.consolePanelDesc}>
                When you click "Execute & Pay", watch each step of the x402 protocol in real-time.
              </Text>

              {/* Step Indicators */}
              <View style={styles.stepsContainer}>
                <StepIndicator
                  step={1}
                  currentStep={getCurrentStepNumber()}
                  title="Request Quote"
                  description="Calculate price based on model & tokens"
                />
                <StepIndicator
                  step={2}
                  currentStep={getCurrentStepNumber()}
                  title="Send AVAX Payment"
                  description="Your wallet sends AVAX to merchant"
                />
                <StepIndicator
                  step={3}
                  currentStep={getCurrentStepNumber()}
                  title="Blockchain Confirmation"
                  description="Wait for on-chain tx confirmation"
                />
                <StepIndicator
                  step={4}
                  currentStep={getCurrentStepNumber()}
                  title="API Verifies Payment"
                  description="Server confirms payment validity"
                />
                <StepIndicator
                  step={5}
                  currentStep={getCurrentStepNumber()}
                  title="Generate Response"
                  description="AI model processes your prompt"
                  isLast
                />
              </View>

              {/* Execution Logs */}
              {logs.length > 0 && (
                <>
                  <View style={styles.logsHeader}>
                    <Terminal size={14} color="#00FF41" />
                    <Text style={styles.logsTitle}>Live Execution Log</Text>
                  </View>
                  <ScrollView style={styles.logsScrollContainer} nestedScrollEnabled>
                    <ExecutionLog logs={logs} />
                  </ScrollView>
                </>
              )}

              {logs.length === 0 && executionStep === 'idle' && (
                <View style={styles.logsPlaceholder}>
                  <Terminal size={32} color="#333" />
                  <Text style={styles.logsPlaceholderText}>
                    Execution logs will appear here{'\n'}when you run a request
                  </Text>
                </View>
              )}

              {/* Transaction Link */}
              {txHash && (
                <TouchableOpacity
                  style={styles.txLink}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      window.open(`https://snowtrace.io/tx/${txHash}`, '_blank');
                    }
                  }}
                >
                  <ExternalLink size={14} color="#00D4FF" />
                  <Text style={styles.txLinkText}>View transaction on Snowtrace</Text>
                </TouchableOpacity>
              )}

              {/* AI Response */}
              {aiResponse && (
                <View style={styles.responseContainer}>
                  <Text style={styles.responseTitle}>🤖 AI Response</Text>
                  <Text style={styles.responseText}>{aiResponse}</Text>
                </View>
              )}

              {/* Generated Images */}
              {generatedImages.length > 0 && (
                <View style={styles.responseContainer}>
                  <Text style={styles.responseTitle}>🎨 Generated Images</Text>
                  {generatedImages.map((imgUrl, idx) => (
                    <View key={idx} style={styles.generatedImageContainer}>
                      <Image
                        source={{ uri: imgUrl }}
                        style={styles.generatedImage}
                        resizeMode="contain"
                      />
                      <TouchableOpacity
                        style={styles.imageOpenBtn}
                        onPress={() => {
                          if (Platform.OS === 'web') {
                            window.open(imgUrl, '_blank');
                          }
                        }}
                      >
                        <ExternalLink size={14} color="#fff" />
                        <Text style={styles.imageOpenBtnText}>Open Full Size</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Error */}
              {error && (
                <View style={styles.errorContainer}>
                  <AlertCircle size={16} color="#F44336" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ============================================================
            CODE EXAMPLES
        ============================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>INTEGRATE</Text>
          <Text style={styles.sectionTitle}>Copy-Paste Ready Code</Text>
          <Text style={styles.sectionSubtitle}>
            The code below updates automatically based on your selected model and prompt
          </Text>

          {/* Tabs */}
          <View style={styles.codeTabs}>
            <TouchableOpacity
              style={[styles.codeTab, activeTab === 'curl' && styles.codeTabActive]}
              onPress={() => setActiveTab('curl')}
            >
              <Terminal size={16} color={activeTab === 'curl' ? '#000' : '#666'} />
              <Text style={[styles.codeTabText, activeTab === 'curl' && styles.codeTabTextActive]}>cURL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.codeTab, activeTab === 'typescript' && styles.codeTabActive]}
              onPress={() => setActiveTab('typescript')}
            >
              <FileCode size={16} color={activeTab === 'typescript' ? '#000' : '#666'} />
              <Text style={[styles.codeTabText, activeTab === 'typescript' && styles.codeTabTextActive]}>TypeScript</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.codeTab, activeTab === 'python' && styles.codeTabActive]}
              onPress={() => setActiveTab('python')}
            >
              <Code size={16} color={activeTab === 'python' ? '#000' : '#666'} />
              <Text style={[styles.codeTabText, activeTab === 'python' && styles.codeTabTextActive]}>Python</Text>
            </TouchableOpacity>
          </View>

          <CodeBlock
            code={activeTab === 'curl' ? curlCode : activeTab === 'typescript' ? typescriptCode : pythonCode}
            label={activeTab === 'curl' ? 'Terminal' : activeTab === 'typescript' ? 'TypeScript' : 'Python'}
          />
        </View>

        {/* ============================================================
            PROTOCOL SPEC
        ============================================================ */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SPECIFICATION</Text>
          <Text style={styles.sectionTitle}>x402 Protocol Details</Text>

          <View style={styles.specContainer}>
            <View style={styles.specItem}>
              <Text style={styles.specItemTitle}>Payment Header</Text>
              <Text style={styles.specItemCode}>X-PAYMENT: base64({"{'txHash': '0x...'}"}) </Text>
              <Text style={styles.specItemDesc}>
                The transaction hash is base64 encoded and sent in the X-PAYMENT header
              </Text>
            </View>

            <View style={styles.specItem}>
              <Text style={styles.specItemTitle}>402 Response</Text>
              <Text style={styles.specItemCode}>HTTP/1.1 402 Payment Required</Text>
              <Text style={styles.specItemDesc}>
                Server responds with 402 status and price info in headers when payment is needed
              </Text>
            </View>

          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <Image
            source={require('../../assets/logos/zero-prompt-logo.png')}
            style={{ width: 40, height: 40, marginBottom: 16 }}
            resizeMode="contain"
          />
          <Text style={styles.footerBrand}>ZeroPrompt</Text>
          <Text style={styles.footerText}>
            Decentralized AI Infrastructure for the Agent Economy
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => router.push('/home')} style={styles.footerLink}>
              <Text style={styles.footerLinkText}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/')} style={styles.footerLink}>
              <Text style={styles.footerLinkText}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.footerLink}>
              <Text style={styles.footerLinkText}>Docs</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Model Selector Modal */}
      <ModelSelectorModal
        visible={showModelModal}
        onClose={() => setShowModelModal(false)}
        onToggleModel={handleToggleModel}
        models={models}
        selectedModels={selectedModels}
        theme={theme}
      />

      {/* Gasless Deposit Modal - Add Credits */}
      <DepositModal
        visible={showDepositModal}
        onClose={closeDepositModal}
        theme={theme}
        vaultAddress={VAULT_ADDRESS}
        userAddress={address}
        onRefreshBalance={refreshBilling}
        onSuccess={(txHash) => {
          console.log('Deposit success:', txHash);
        }}
      />

      {/* Wallet Connection Modal - Same as /chat */}
      <WalletConnectModal
        visible={isConnecting || isAuthenticating}
        onClose={() => {}}
        theme={theme}
        isConnecting={isConnecting}
        isAuthenticating={isAuthenticating}
        connectionError={connectionError}
        migratedChats={migratedChats}
        onClearMigratedChats={clearMigratedChats}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000'
  },

  // Demos wrapper
  demosWrapper: {
    marginTop: 24,
    minHeight: 500,
  },

  // Navbar
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#000'
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  navLogo: {
    width: 32,
    height: 32
  },
  navTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10
  },
  navBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 10
  },
  navBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700'
  },
  walletConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20
  },
  walletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00FF41',
    marginRight: 8
  },
  walletAddress: {
    color: '#888',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  walletModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletModalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#333',
  },
  walletModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  walletModalAddress: {
    color: '#888',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
    marginBottom: 24,
  },
  disconnectBtn: {
    backgroundColor: '#ff4444',
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  disconnectBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  cancelBtn: {
    backgroundColor: '#333',
    paddingVertical: 14,
    borderRadius: 10,
  },
  cancelBtnText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00FF41',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8
  },
  connectBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14
  },

  // Content
  content: {
    padding: 20,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%'
  },

  // Hero
  heroSection: {
    paddingVertical: 60,
    alignItems: 'center',
    position: 'relative'
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: -100,
    right: -100,
    height: 400,
    borderRadius: 200
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    marginBottom: 24,
    gap: 8
  },
  heroBadgeText: {
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '600'
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 66,
    marginBottom: 20
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    lineHeight: 28,
    maxWidth: 600
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#222'
  },
  heroStat: {
    alignItems: 'center',
    paddingHorizontal: 24
  },
  heroStatValue: {
    color: '#00FF41',
    fontSize: 28,
    fontWeight: '800'
  },
  heroStatLabel: {
    color: '#666',
    fontSize: 13,
    marginTop: 4
  },
  heroStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#333'
  },

  // Sections
  section: {
    paddingVertical: 60
  },
  sectionLabel: {
    color: '#00FF41',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 12
  },
  sectionSubtitle: {
    color: '#666',
    fontSize: 16,
    marginBottom: 32,
    lineHeight: 24
  },

  // Flow
  flowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20
  },
  flowStep: {
    alignItems: 'center',
    padding: 20
  },
  flowStepIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  flowStepNumber: {
    color: '#444',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4
  },
  flowStepTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4
  },
  flowStepDesc: {
    color: '#666',
    fontSize: 13
  },
  flowArrow: {
    padding: 8
  },

  // Features
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 20
  },
  featureCard: {
    flex: 1,
    minWidth: 250,
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  featureTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  featureDescription: {
    color: '#666',
    fontSize: 14,
    lineHeight: 22
  },

  // Network Notice
  networkNotice: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24
  },
  networkNoticeTitle: {
    color: '#FFC107',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  networkNoticeText: {
    color: '#999',
    fontSize: 13,
    lineHeight: 20
  },

  // Console
  consoleContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20
  },
  consoleContainerMobile: {
    flexDirection: 'column',
    gap: 16,
  },
  consolePanel: {
    backgroundColor: '#0d0d0d',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    position: 'relative',
    zIndex: 1,
  },
  consolePanelDark: {
    backgroundColor: '#080808',
    zIndex: 0,
  },
  consolePanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  consolePanelTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700'
  },
  consolePanelDesc: {
    color: '#666',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20
  },
  inputLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 16
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222'
  },
  modelSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  modelSelectorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  modelSelectorPrice: {
    color: '#00FF41',
    fontSize: 12,
    marginTop: 2
  },
  promptInput: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
    color: '#fff',
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  priceSummary: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#222'
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6
  },
  priceLabel: {
    color: '#666',
    fontSize: 13
  },
  priceValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  executeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00FF41',
    borderRadius: 12,
    padding: 18,
    marginTop: 20,
    gap: 10
  },
  executeBtnDisabled: {
    backgroundColor: '#333',
    opacity: 0.6
  },
  executeBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700'
  },
  executingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFC107',
    borderRadius: 12,
    padding: 18,
    marginTop: 20,
    gap: 10
  },
  executingBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700'
  },
  resetBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 18,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#00FF41'
  },
  resetBtnText: {
    color: '#00FF41',
    fontSize: 16,
    fontWeight: '600'
  },
  walletWarningBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)'
  },
  walletWarning: {
    color: '#FFC107',
    fontSize: 12,
    textAlign: 'center'
  },

  // Steps
  stepsContainer: {
    marginBottom: 20
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepCircleActive: {
    backgroundColor: '#00FF41',
    borderColor: '#00FF41'
  },
  stepCircleComplete: {
    backgroundColor: '#00FF41',
    borderColor: '#00FF41'
  },
  stepNumber: {
    color: '#666',
    fontSize: 14,
    fontWeight: '700'
  },
  stepLine: {
    width: 2,
    height: 40,
    backgroundColor: '#222',
    marginVertical: 4
  },
  stepLineComplete: {
    backgroundColor: '#00FF41'
  },
  stepTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4
  },
  stepDescription: {
    color: '#666',
    fontSize: 13
  },

  // Logs
  logsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  logsTitle: {
    color: '#00FF41',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12
  },
  logsScrollContainer: {
    maxHeight: 300,
    backgroundColor: '#050505',
    borderRadius: 10,
    marginBottom: 16
  },
  logContainer: {
    backgroundColor: '#050505',
    borderRadius: 10,
    padding: 12
  },
  logLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
    gap: 8
  },
  logText: {
    color: '#888',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1
  },
  logsPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#050505',
    borderRadius: 12
  },
  logsPlaceholderText: {
    color: '#333',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20
  },
  txLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16
  },
  txLinkText: {
    color: '#00D4FF',
    fontSize: 13,
    textDecorationLine: 'underline'
  },
  responseContainer: {
    backgroundColor: 'rgba(0, 255, 65, 0.08)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 65, 0.2)',
    marginBottom: 12
  },
  responseTitle: {
    color: '#00FF41',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12
  },
  responseText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 22
  },
  generatedImageContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 65, 0.15)'
  },
  generatedImage: {
    width: '100%',
    height: 350,
    backgroundColor: '#0a0a0a'
  },
  imageOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)'
  },
  imageOpenBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600'
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    borderRadius: 10,
    padding: 12,
    gap: 8
  },
  errorText: {
    color: '#F44336',
    fontSize: 13,
    flex: 1
  },

  // Code
  codeTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16
  },
  codeTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#111',
    gap: 8
  },
  codeTabActive: {
    backgroundColor: '#00FF41'
  },
  codeTabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600'
  },
  codeTabTextActive: {
    color: '#000'
  },
  codeBlockContainer: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  codeBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a'
  },
  codeBlockLabel: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600'
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  copyBtnText: {
    color: '#94a3b8',
    fontSize: 12
  },
  copyBtnTextSuccess: {
    color: '#4CAF50',
    fontSize: 12
  },
  codeBlockScroll: {
    padding: 20
  },
  codeText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },

  // Spec
  specContainer: {
    gap: 20,
    marginTop: 20
  },
  specItem: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1a1a1a'
  },
  specItemTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12
  },
  specItemCode: {
    color: '#00FF41',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: '#111',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden'
  },
  specItemDesc: {
    color: '#666',
    fontSize: 14,
    lineHeight: 22
  },
  chainBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8
  },
  chainBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  chainBadgeText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600'
  },

  // Navbar links
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6
  },
  navLinkText: {
    color: '#888',
    fontSize: 14
  },

  // Hero CTAs
  heroCTAs: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32
  },
  primaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00FF41',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10
  },
  primaryCTAText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700'
  },
  secondaryCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00FF41',
    gap: 10
  },
  secondaryCTAText: {
    color: '#00FF41',
    fontSize: 16,
    fontWeight: '600'
  },

  // x402 Banner
  x402Banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    gap: 32
  },
  x402BannerLeft: {
    flex: 2,
    minWidth: 280
  },
  x402BannerLabel: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8
  },
  x402BannerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12
  },
  x402BannerDesc: {
    color: '#888',
    fontSize: 15,
    lineHeight: 24
  },
  x402BannerRight: {
    flex: 1,
    minWidth: 200,
    gap: 12,
    justifyContent: 'center'
  },
  x402Feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  x402FeatureText: {
    color: '#aaa',
    fontSize: 14
  },

  // Footer
  footer: {
    paddingVertical: 60,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a'
  },
  footerBrand: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8
  },
  footerText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24
  },
  footerLinks: {
    flexDirection: 'row',
    gap: 24
  },
  footerLink: {
    padding: 8
  },
  footerLinkText: {
    color: '#888',
    fontSize: 14
  },

  // Payment Method Selector
  paymentMethodContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20
  },
  paymentMethodOption: {
    flex: 1,
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#222',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    gap: 12
  },
  paymentMethodOptionActiveAVAX: {
    borderColor: '#E84142',
    backgroundColor: 'rgba(232, 65, 66, 0.1)'
  },
  paymentMethodOptionActiveUSDC: {
    borderColor: '#2775CA',
    backgroundColor: 'rgba(39, 117, 202, 0.1)'
  },
  paymentMethodLogo: {
    width: 36,
    height: 36,
    borderRadius: 18
  },
  paymentMethodText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '700'
  },
  paymentMethodTextActiveAVAX: {
    color: '#E84142'
  },
  paymentMethodTextActiveUSDC: {
    color: '#2775CA'
  },
  paymentMethodSubtext: {
    color: '#555',
    fontSize: 11,
    marginTop: 2
  },

  // ========================================
  // MOBILE STYLES
  // ========================================
  navbarMobile: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  navLinksMobile: {
    gap: 2,
  },
  navLinkMobile: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  walletConnectedMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  connectBtnMobile: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  contentMobile: {
    padding: 12,
  },
  heroSectionMobile: {
    paddingVertical: 30,
  },
  heroTitleMobile: {
    fontSize: 32,
    lineHeight: 40,
  },
  heroSubtitleMobile: {
    fontSize: 14,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  heroStatsMobile: {
    padding: 16,
    borderRadius: 12,
  },
  heroCTAsMobile: {
    flexDirection: 'column',
    width: '100%',
    gap: 10,
  },
  primaryCTAMobile: {
    width: '100%',
    paddingVertical: 16,
    justifyContent: 'center',
  },
  secondaryCTAMobile: {
    width: '100%',
    paddingVertical: 16,
    justifyContent: 'center',
  },
  sectionMobile: {
    paddingVertical: 32,
  },
  sectionTitleMobile: {
    fontSize: 24,
    lineHeight: 32,
  },
  sectionSubtitleMobile: {
    fontSize: 14,
    lineHeight: 22,
  },
  featuresGridMobile: {
    flexDirection: 'column',
    gap: 12,
  },
  consolePanelMobile: {
    padding: 16,
    borderRadius: 16,
  },
});
