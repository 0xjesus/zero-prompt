import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, ActivityIndicator, Image, Platform, useWindowDimensions
} from 'react-native';
import { useSignTypedData, useSendTransaction } from 'wagmi';
import { getAddress, parseEther } from 'viem';
import Markdown from 'react-native-markdown-display';
import {
  Swords, Brain, ImageIcon, CheckCircle, XCircle,
  Users, Trophy, AlertCircle, Plus, Copy, Terminal, ChevronDown, ChevronUp, Download, Share2
} from 'lucide-react-native';
import { API_URL } from '../config/api';
import { MERCHANT_ADDRESS as RAW_MERCHANT_ADDRESS } from '../lib/constants';
import ModelSelectorModal from './ModelSelectorModal';

// Breakpoint for desktop layout
const DESKTOP_BREAKPOINT = 768;

const MERCHANT_ADDRESS = getAddress(RAW_MERCHANT_ADDRESS);

// Markdown styles for AI responses
const markdownStyles = {
  body: { color: '#E5E5E5', fontSize: 14, lineHeight: 22 },
  paragraph: { marginVertical: 4 },
  heading1: { color: '#FFF', fontWeight: '700' as const, fontSize: 18, marginVertical: 8 },
  heading2: { color: '#FFF', fontWeight: '600' as const, fontSize: 16, marginVertical: 6 },
  heading3: { color: '#CCC', fontWeight: '600' as const, fontSize: 14, marginVertical: 4 },
  code_inline: { backgroundColor: '#1a1a1a', color: '#F59E0B', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  code_block: { backgroundColor: '#0a0a0a', padding: 12, borderRadius: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12 },
  fence: { backgroundColor: '#0a0a0a', padding: 12, borderRadius: 8, marginVertical: 8 },
  blockquote: { backgroundColor: '#1a1a1a', borderLeftWidth: 3, borderLeftColor: '#F59E0B', paddingLeft: 12, paddingVertical: 4, marginVertical: 8 },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { marginVertical: 2 },
  strong: { color: '#FFF', fontWeight: '700' as const },
  em: { color: '#CCC', fontStyle: 'italic' as const },
  link: { color: '#60A5FA' },
};

// Thinking content parser and renderer
interface ParsedContent {
  thinking: string | null;
  response: string;
}

const parseThinkingContent = (content: string): ParsedContent => {
  if (!content) return { thinking: null, response: '' };

  // Pattern 1: <thinking>...</thinking>
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/i);

  // Pattern 2: <think>...</think>
  const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);

  // Pattern 3: **Thinking:** or **Reasoning:** blocks
  const reasoningMatch = content.match(/\*\*(?:Thinking|Reasoning|Internal):\*\*\s*([\s\S]*?)(?=\n\n\*\*(?:Response|Answer|Output):\*\*|$)/i);

  let thinking: string | null = null;
  let response = content;

  if (thinkingMatch) {
    thinking = thinkingMatch[1].trim();
    response = content.replace(/<thinking>[\s\S]*?<\/thinking>/i, '').trim();
  } else if (thinkMatch) {
    thinking = thinkMatch[1].trim();
    response = content.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  } else if (reasoningMatch) {
    thinking = reasoningMatch[1].trim();
    response = content.replace(/\*\*(?:Thinking|Reasoning|Internal):\*\*\s*[\s\S]*?(?=\n\n\*\*(?:Response|Answer|Output):\*\*|$)/i, '').trim();
    // Remove the **Response:** label if present
    response = response.replace(/^\*\*(?:Response|Answer|Output):\*\*\s*/i, '').trim();
  }

  return { thinking, response };
};

// Collapsible Thinking Block Component
const ThinkingBlock = ({ content }: { content: string }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={thinkingStyles.container}>
      <TouchableOpacity
        style={thinkingStyles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={thinkingStyles.headerLeft}>
          <Brain size={14} color="#8B5CF6" />
          <Text style={thinkingStyles.headerText}>Model Reasoning</Text>
        </View>
        {expanded ? (
          <ChevronUp size={16} color="#8B5CF6" />
        ) : (
          <ChevronDown size={16} color="#8B5CF6" />
        )}
      </TouchableOpacity>
      {expanded && (
        <View style={thinkingStyles.content}>
          <Text style={thinkingStyles.text}>{content}</Text>
        </View>
      )}
    </View>
  );
};

const thinkingStyles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF640',
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#8B5CF610',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#8B5CF620',
  },
  text: {
    color: '#A78BFA',
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

// Response Content Component (handles thinking + response)
const ResponseContent = ({ content }: { content: string }) => {
  const { thinking, response } = parseThinkingContent(content);

  return (
    <View>
      {thinking && <ThinkingBlock content={thinking} />}
      <Markdown style={markdownStyles}>{response || 'No response'}</Markdown>
    </View>
  );
};

// CURL Command Component
const CurlCommand = ({ endpoint, body, price }: { endpoint: string; body: any; price: string }) => {
  const [copied, setCopied] = useState(false);

  const curlCmd = `curl -X POST '${API_URL}${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Payment: <EIP3009_SIGNED_PAYLOAD>' \\
  -d '${JSON.stringify(body)}'`;

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(curlCmd);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={curlStyles.container}>
      <View style={curlStyles.header}>
        <View style={curlStyles.headerLeft}>
          <Terminal size={14} color="#F59E0B" />
          <Text style={curlStyles.headerTitle}>API Request</Text>
        </View>
        <TouchableOpacity style={curlStyles.copyBtn} onPress={handleCopy}>
          {copied ? <CheckCircle size={14} color="#10B981" /> : <Copy size={14} color="#888" />}
          <Text style={curlStyles.copyText}>{copied ? 'Copied!' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Text style={curlStyles.code}>{curlCmd}</Text>
      </ScrollView>
      <Text style={curlStyles.priceNote}>💰 Price: ${price} USDC • Gas Sponsored</Text>
    </View>
  );
};

const curlStyles = StyleSheet.create({
  container: { backgroundColor: '#0a0a0a', borderRadius: 8, borderWidth: 1, borderColor: '#333', marginTop: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#111' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { color: '#888', fontSize: 11 },
  code: { color: '#10B981', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', padding: 12, minWidth: '100%' },
  priceNote: { color: '#666', fontSize: 10, padding: 8, borderTopWidth: 1, borderTopColor: '#222', backgroundColor: '#0f0f0f' },
});

// Export Button Component - Export results as JSON/Markdown
const ExportButton = ({
  data,
  filename,
  type = 'battle'
}: {
  data: any;
  filename: string;
  type?: 'battle' | 'consensus' | 'gallery';
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const formatAsMarkdown = () => {
    let md = `# ZeroPrompt ${type.charAt(0).toUpperCase() + type.slice(1)} Results\n\n`;
    md += `**Date:** ${new Date().toISOString()}\n\n`;

    if (type === 'battle' && data.results) {
      md += `## Prompt\n${data.prompt || 'N/A'}\n\n`;
      md += `## Model Responses\n\n`;
      data.results.forEach((r: any, i: number) => {
        md += `### ${i + 1}. ${r.model}\n`;
        md += `**Latency:** ${r.latency}ms\n\n`;
        md += `${r.response || 'No response'}\n\n---\n\n`;
      });
    } else if (type === 'consensus' && data) {
      md += `## Question\n${data.prompt || 'N/A'}\n\n`;
      md += `## Model Opinions\n\n`;
      data.opinions?.forEach((o: any, i: number) => {
        md += `### ${i + 1}. ${o.model}\n${o.opinion || 'No opinion'}\n\n`;
      });
      if (data.judgment) {
        md += `## Judge Analysis\n**Judge:** ${data.judgeModel || 'N/A'}\n\n${data.judgment}\n`;
      }
    } else if (type === 'gallery' && data.images) {
      md += `## Prompt\n${data.prompt || 'N/A'}\n\n`;
      md += `## Generated Images\n\n`;
      data.images.forEach((img: any, i: number) => {
        md += `### ${i + 1}. ${img.model}\n`;
        md += `![Image](${img.url})\n\n`;
      });
    }
    return md;
  };

  const handleExport = (format: 'json' | 'markdown') => {
    const content = format === 'json'
      ? JSON.stringify(data, null, 2)
      : formatAsMarkdown();

    const mimeType = format === 'json' ? 'application/json' : 'text/markdown';
    const ext = format === 'json' ? 'json' : 'md';

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    setShowMenu(false);
  };

  const handleShare = async () => {
    const text = formatAsMarkdown();
    if (Platform.OS === 'web' && navigator.share) {
      try {
        await navigator.share({ title: `ZeroPrompt ${type} Results`, text });
      } catch (e) {
        // User cancelled or share failed
      }
    } else if (Platform.OS === 'web') {
      navigator.clipboard.writeText(text);
    }
    setShowMenu(false);
  };

  return (
    <View style={exportStyles.container}>
      <TouchableOpacity
        style={exportStyles.button}
        onPress={() => setShowMenu(!showMenu)}
      >
        <Download size={14} color="#00FF41" />
        <Text style={exportStyles.buttonText}>Export</Text>
      </TouchableOpacity>

      {showMenu && (
        <View style={exportStyles.menu}>
          <TouchableOpacity style={exportStyles.menuItem} onPress={() => handleExport('json')}>
            <Text style={exportStyles.menuItemText}>Download JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity style={exportStyles.menuItem} onPress={() => handleExport('markdown')}>
            <Text style={exportStyles.menuItemText}>Download Markdown</Text>
          </TouchableOpacity>
          <TouchableOpacity style={exportStyles.menuItem} onPress={handleShare}>
            <Share2 size={12} color="#888" />
            <Text style={exportStyles.menuItemText}>Share</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const exportStyles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 9999,
    ...Platform.select({
      web: { zIndex: 9999 } as any,
    }),
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 255, 65, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 65, 0.3)',
  },
  buttonText: { color: '#00FF41', fontSize: 12, fontWeight: '600' },
  menu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    minWidth: 160,
    zIndex: 99999,
    elevation: 999,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
        zIndex: 99999,
      } as any,
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  menuItemText: { color: '#fff', fontSize: 13 },
});

// Avalanche config
const AVALANCHE_CONFIG = {
  chainId: 43114,
  usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' as `0x${string}`,
};

type DemoTab = 'battle' | 'consensus' | 'gallery';

interface Model {
  id: number;
  openrouterId: string;
  name: string;
  publicPricingPrompt?: number;
  publicPricingCompletion?: number;
  publicPricingImage?: number;
  contextLength?: number;
  architecture?: any;
}

interface DemoProps {
  isConnected: boolean;
  address?: `0x${string}`;
  openWalletModal: () => void;
  models: Model[];
  theme: any;
}

// ============================================================================
// PAYMENT METHOD SELECTOR COMPONENT
// ============================================================================
type PaymentMethod = 'USDC' | 'AVAX';

const PaymentMethodSelector = ({
  selected,
  onSelect,
  avaxPrice,
  usdPrice
}: {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  avaxPrice?: string;
  usdPrice?: string;
}) => (
  <View style={paymentStyles.container}>
    <Text style={paymentStyles.label}>Select payment method:</Text>
    <View style={paymentStyles.buttons}>
      {/* USDC Option */}
      <TouchableOpacity
        style={[paymentStyles.button, selected === 'USDC' && paymentStyles.buttonActiveUSDC]}
        onPress={() => onSelect('USDC')}
      >
        <Image
          source={require('../assets/logos/usd-logo.png')}
          style={paymentStyles.tokenLogo}
        />
        <Text style={[paymentStyles.tokenName, selected === 'USDC' && paymentStyles.tokenNameActiveUSDC]}>
          USDC
        </Text>
        <Text style={[paymentStyles.tokenPrice, selected === 'USDC' && paymentStyles.tokenPriceActive]}>
          ${usdPrice || '0.00'}
        </Text>
        <View style={[paymentStyles.badge, paymentStyles.badgeGreen]}>
          <Text style={paymentStyles.badgeText}>GAS FREE</Text>
        </View>
      </TouchableOpacity>

      {/* AVAX Option */}
      <TouchableOpacity
        style={[paymentStyles.button, selected === 'AVAX' && paymentStyles.buttonActiveAVAX]}
        onPress={() => onSelect('AVAX')}
      >
        <Image
          source={require('../assets/logos/avax-logo.png')}
          style={paymentStyles.tokenLogo}
        />
        <Text style={[paymentStyles.tokenName, selected === 'AVAX' && paymentStyles.tokenNameActiveAVAX]}>
          AVAX
        </Text>
        <Text style={[paymentStyles.tokenPrice, selected === 'AVAX' && paymentStyles.tokenPriceActive]}>
          ~{avaxPrice || '0.00'} AVAX
        </Text>
        <View style={[paymentStyles.badge, paymentStyles.badgeRed]}>
          <Text style={paymentStyles.badgeText}>NATIVE</Text>
        </View>
      </TouchableOpacity>
    </View>
  </View>
);

const paymentStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { color: '#888', fontSize: 12, marginBottom: 10 },
  buttons: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
  },
  buttonActiveUSDC: {
    borderColor: '#2775CA',
    backgroundColor: '#2775CA15',
  },
  buttonActiveAVAX: {
    borderColor: '#E84142',
    backgroundColor: '#E8414215',
  },
  tokenLogo: {
    width: 32,
    height: 32,
    marginBottom: 6,
    borderRadius: 16,
  },
  tokenName: {
    color: '#666',
    fontSize: 16,
    fontWeight: '700',
  },
  tokenNameActiveUSDC: { color: '#2775CA' },
  tokenNameActiveAVAX: { color: '#E84142' },
  tokenPrice: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  tokenPriceActive: { color: '#FFF' },
  badge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeGreen: { backgroundColor: '#00FF4130' },
  badgeRed: { backgroundColor: '#E8414230' },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

// ============================================================================
// MODEL BATTLE COMPONENT
// ============================================================================
const ModelBattle = ({ isConnected, address, openWalletModal, models, theme }: DemoProps) => {
  const { signTypedDataAsync } = useSignTypedData();
  const { sendTransactionAsync } = useSendTransaction();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [prompt, setPrompt] = useState('Explain quantum computing in simple terms.');
  const [selectedModels, setSelectedModels] = useState<Model[]>([]);
  const [showModelModal, setShowModelModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('USDC');

  // Dynamic quote state
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Filter to only text models for battle
  const textModels = models.filter(m => {
    const arch = m.architecture;
    return !arch?.output_modalities?.includes('image') && (m.publicPricingPrompt ?? 0) > 0;
  });

  // Fetch quote when models or prompt change
  useEffect(() => {
    const fetchQuote = async () => {
      if (selectedModels.length < 2 || !prompt.trim()) {
        setQuote(null);
        return;
      }

      try {
        setQuoteLoading(true);
        const response = await fetch(`${API_URL}/agent/quote/battle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            models: selectedModels.map(m => m.openrouterId),
            prompt
          })
        });
        const data = await response.json();
        if (data.success) {
          setQuote(data);
        }
      } catch (err) {
        console.error('Quote fetch failed:', err);
      } finally {
        setQuoteLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedModels, prompt]);

  const handleToggleModel = (model: Model) => {
    const isSelected = selectedModels.some(m => m.openrouterId === model.openrouterId);
    if (isSelected) {
      setSelectedModels(selectedModels.filter(m => m.openrouterId !== model.openrouterId));
    } else if (selectedModels.length < 4) {
      setSelectedModels([...selectedModels, model]);
    }
  };

  const executeBattle = async () => {
    if (!isConnected || !address) {
      openWalletModal();
      return;
    }

    if (selectedModels.length < 2) {
      setError('Select at least 2 models for battle');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const modelIds = selectedModels.map(m => m.openrouterId);

      // First request to get 402 challenge
      const initialRes = await fetch(`${API_URL}/agent/battle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, models: modelIds })
      });

      if (initialRes.status !== 402) {
        throw new Error('Unexpected response');
      }

      const challenge = await initialRes.json();

      // Get prices from challenge
      const usdcOption = challenge.accepts.find((a: any) => a.scheme === 'x402-eip3009');
      const avaxOption = challenge.accepts.find((a: any) => a.scheme === 'x402-native');

      let paymentPayload: any;

      if (paymentMethod === 'AVAX' && avaxOption) {
        // AVAX Payment - Send native transaction
        const avaxAmount = parseEther(avaxOption.price);

        const txHash = await sendTransactionAsync({
          to: MERCHANT_ADDRESS,
          value: avaxAmount,
        });

        paymentPayload = {
          x402Version: 2,
          scheme: 'x402-native',
          network: 'avalanche',
          chainId: AVALANCHE_CONFIG.chainId,
          payload: {
            txHash,
            from: address,
          }
        };
      } else {
        // USDC Payment - Sign EIP-3009 authorization
        const priceUSD = parseFloat(usdcOption.price);
        const usdcAmount = BigInt(Math.ceil(priceUSD * 1_000_000));
        const nonceBytes = new Uint8Array(32);
        crypto.getRandomValues(nonceBytes);
        const nonce = '0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        const now = Math.floor(Date.now() / 1000);
        const validAfter = BigInt(now - 60);
        const validBefore = BigInt(now + 3600);

        const domain = {
          name: 'USD Coin',
          version: '2',
          chainId: AVALANCHE_CONFIG.chainId,
          verifyingContract: AVALANCHE_CONFIG.usdc
        };

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
          from: address as `0x${string}`,
          to: MERCHANT_ADDRESS,
          value: usdcAmount,
          validAfter,
          validBefore,
          nonce: nonce as `0x${string}`
        };

        const signature = await signTypedDataAsync({
          domain,
          types,
          primaryType: 'TransferWithAuthorization',
          message
        });

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
      }

      const paymentHeader = btoa(JSON.stringify(paymentPayload));

      // Execute with payment
      const response = await fetch(`${API_URL}/agent/battle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': paymentHeader
        },
        body: JSON.stringify({ prompt, models: modelIds })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Battle failed');
      }

      const data = await response.json();
      setResults(data);

    } catch (err: any) {
      setError(err.message || 'Battle failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.demoContainer}>
      <View style={styles.demoHeader}>
        <Swords size={24} color="#F59E0B" />
        <Text style={styles.demoTitle}>Model Battle Arena</Text>
      </View>
      <Text style={styles.demoSubtitle}>
        Compare multiple AI models side-by-side. One payment, all responses.
      </Text>

      {/* Model Selection - Opens Modal */}
      <Text style={styles.inputLabel}>Select Models (2-4)</Text>
      <TouchableOpacity
        style={styles.modelSelector}
        onPress={() => setShowModelModal(true)}
      >
        <View style={styles.modelSelectorLeft}>
          <Swords size={20} color="#F59E0B" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            {selectedModels.length > 0 ? (
              <Text style={styles.modelSelectorName} numberOfLines={1}>
                {selectedModels.map(m => m.name.split('/').pop()?.split(' ')[0]).join(' vs ')}
              </Text>
            ) : (
              <Text style={[styles.modelSelectorName, { color: '#666' }]}>
                Tap to select models...
              </Text>
            )}
            <Text style={styles.modelSelectorPrice}>
              {selectedModels.length}/4 models • {textModels.length} available
            </Text>
          </View>
        </View>
        <Plus size={20} color="#F59E0B" />
      </TouchableOpacity>

      {/* Selected Models Chips */}
      {selectedModels.length > 0 && (
        <View style={styles.selectedChips}>
          {selectedModels.map((model) => (
            <View key={model.openrouterId} style={[styles.modelChip, { borderColor: '#F59E0B' }]}>
              <Text style={styles.modelChipText}>{model.name}</Text>
              <TouchableOpacity onPress={() => handleToggleModel(model)}>
                <XCircle size={14} color="#F59E0B" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Prompt Input */}
      <Text style={styles.inputLabel}>Battle Prompt</Text>
      <TextInput
        style={styles.promptInput}
        placeholder="Enter your prompt..."
        placeholderTextColor="#666"
        multiline
        value={prompt}
        onChangeText={setPrompt}
      />

      {/* Payment Method Selector with Dynamic Pricing */}
      <PaymentMethodSelector
        selected={paymentMethod}
        onSelect={setPaymentMethod}
        avaxPrice={quote?.payment?.recommendedAVAX}
        usdPrice={quote?.payment?.recommendedUSDC || (quoteLoading ? '...' : '0.00')}
      />

      {/* Quote Loading Indicator */}
      {quoteLoading && (
        <View style={styles.quoteLoading}>
          <ActivityIndicator size="small" color="#F59E0B" />
          <Text style={styles.quoteLoadingText}>Calculating price...</Text>
        </View>
      )}

      {/* Execute Button */}
      <TouchableOpacity
        style={[styles.executeBtn, (loading || selectedModels.length < 2 || !quote) && styles.executeBtnDisabled]}
        onPress={executeBattle}
        disabled={loading || selectedModels.length < 2 || !quote}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <>
            <Swords size={20} color="#000" />
            <Text style={styles.executeBtnText}>
              {!isConnected ? 'Connect Wallet' : selectedModels.length < 2 ? 'Select 2+ Models' : !quote ? 'Getting Quote...' : `Battle ${selectedModels.length} Models`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {results && (
        <View style={styles.resultsContainer}>
          {/* Header */}
          <View style={styles.resultsHeader}>
            <View style={styles.resultsHeaderLeft}>
              <Trophy size={20} color="#F59E0B" />
              <Text style={styles.resultsTitle}>Battle Results</Text>
              <View style={styles.latencyBadge}>
                <Text style={styles.latencyText}>{results.totalLatency}ms</Text>
              </View>
            </View>
            <ExportButton
              data={{ ...results, prompt }}
              filename={`zeroprompt-battle-${Date.now()}`}
              type="battle"
            />
          </View>

          {/* Comparison Grid */}
          <Text style={styles.comparisonLabel}>SIDE-BY-SIDE COMPARISON</Text>
          <View style={[styles.comparisonGrid, isDesktop && styles.comparisonGridDesktop]}>
            {results.results?.map((result: any, index: number) => (
              <View key={index} style={[styles.comparisonCard, isDesktop && styles.comparisonCardDesktop, { borderColor: index === 0 ? '#F59E0B' : index === 1 ? '#8B5CF6' : index === 2 ? '#10B981' : '#EC4899' }]}>
                <View style={styles.comparisonHeader}>
                  <View style={[styles.modelBadgeSmall, { backgroundColor: index === 0 ? '#F59E0B20' : index === 1 ? '#8B5CF620' : index === 2 ? '#10B98120' : '#EC489920' }]}>
                    <Text style={[styles.modelBadgeText, { color: index === 0 ? '#F59E0B' : index === 1 ? '#8B5CF6' : index === 2 ? '#10B981' : '#EC4899' }]}>
                      {result.model.split('/')[1]}
                    </Text>
                  </View>
                  <Text style={styles.modelLatency}>{result.latency}ms</Text>
                </View>
                <ScrollView style={[styles.responseScroll, isDesktop && styles.responseScrollDesktop]} nestedScrollEnabled>
                  <ResponseContent content={result.response || ''} />
                </ScrollView>
              </View>
            ))}
          </View>

          {/* CURL Command */}
          <CurlCommand
            endpoint="/agent/battle"
            body={{ prompt, models: selectedModels.map(m => m.openrouterId) }}
            price="0.10"
          />
        </View>
      )}

      {/* Model Selector Modal - Same as /chat */}
      <ModelSelectorModal
        visible={showModelModal}
        onClose={() => setShowModelModal(false)}
        onToggleModel={handleToggleModel}
        models={textModels}
        selectedModels={selectedModels}
        theme={theme}
      />
    </View>
  );
};

// ============================================================================
// AI CONSENSUS COMPONENT
// ============================================================================
const AIConsensus = ({ isConnected, address, openWalletModal, models, theme }: DemoProps) => {
  const { signTypedDataAsync } = useSignTypedData();
  const { sendTransactionAsync } = useSendTransaction();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [prompt, setPrompt] = useState('Is artificial general intelligence (AGI) possible within the next 10 years?');
  const [selectedModels, setSelectedModels] = useState<Model[]>([]);
  const [judgeModel, setJudgeModel] = useState<Model | null>(null);
  const [showModelModal, setShowModelModal] = useState(false);
  const [showJudgeModal, setShowJudgeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('USDC');

  // Dynamic quote state
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Filter to only text models for consensus
  const textModels = models.filter(m => {
    const arch = m.architecture;
    return !arch?.output_modalities?.includes('image') && (m.publicPricingPrompt ?? 0) > 0;
  });

  // Fetch quote when models, judge, or prompt change
  useEffect(() => {
    const fetchQuote = async () => {
      if (selectedModels.length < 2 || !judgeModel || !prompt.trim()) {
        setQuote(null);
        return;
      }

      try {
        setQuoteLoading(true);
        const response = await fetch(`${API_URL}/agent/quote/consensus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            models: selectedModels.map(m => m.openrouterId),
            judge: judgeModel.openrouterId,
            prompt
          })
        });
        const data = await response.json();
        if (data.success) {
          setQuote(data);
        }
      } catch (err) {
        console.error('Quote fetch failed:', err);
      } finally {
        setQuoteLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedModels, judgeModel, prompt]);

  const handleToggleModel = (model: Model) => {
    const isSelected = selectedModels.some(m => m.openrouterId === model.openrouterId);
    if (isSelected) {
      setSelectedModels(selectedModels.filter(m => m.openrouterId !== model.openrouterId));
    } else if (selectedModels.length < 5) {
      setSelectedModels([...selectedModels, model]);
    }
  };

  const handleSelectJudge = (model: Model) => {
    setJudgeModel(model);
    setShowJudgeModal(false);
  };

  const executeConsensus = async () => {
    if (!isConnected || !address) {
      openWalletModal();
      return;
    }

    if (selectedModels.length < 2) {
      setError('Select at least 2 models for consensus');
      return;
    }

    if (!judgeModel) {
      setError('Select a judge model to analyze the responses');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const modelIds = selectedModels.map(m => m.openrouterId);
      const requestBody = { prompt, models: modelIds, judge: judgeModel.openrouterId };

      // First request to get 402 challenge
      const initialRes = await fetch(`${API_URL}/agent/consensus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (initialRes.status !== 402) {
        throw new Error('Unexpected response');
      }

      const challenge = await initialRes.json();
      const usdcOption = challenge.accepts.find((a: any) => a.scheme === 'x402-eip3009');
      const avaxOption = challenge.accepts.find((a: any) => a.scheme === 'x402-native');

      let paymentPayload: any;

      if (paymentMethod === 'AVAX' && avaxOption) {
        const avaxAmount = parseEther(avaxOption.price);
        const txHash = await sendTransactionAsync({
          to: MERCHANT_ADDRESS,
          value: avaxAmount,
        });
        paymentPayload = {
          x402Version: 2,
          scheme: 'x402-native',
          network: 'avalanche',
          chainId: AVALANCHE_CONFIG.chainId,
          payload: { txHash, from: address }
        };
      } else {
        const priceUSD = parseFloat(usdcOption.price);
        const usdcAmount = BigInt(Math.ceil(priceUSD * 1_000_000));
        const nonceBytes = new Uint8Array(32);
        crypto.getRandomValues(nonceBytes);
        const nonce = '0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        const now = Math.floor(Date.now() / 1000);
        const validAfter = BigInt(now - 60);
        const validBefore = BigInt(now + 3600);

        const signature = await signTypedDataAsync({
          domain: {
            name: 'USD Coin',
            version: '2',
            chainId: AVALANCHE_CONFIG.chainId,
            verifyingContract: AVALANCHE_CONFIG.usdc
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
          } as const,
          primaryType: 'TransferWithAuthorization',
          message: {
            from: address as `0x${string}`,
            to: MERCHANT_ADDRESS,
            value: usdcAmount,
            validAfter,
            validBefore,
            nonce: nonce as `0x${string}`
          }
        });

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
      }

      const response = await fetch(`${API_URL}/agent/consensus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': btoa(JSON.stringify(paymentPayload))
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Consensus failed');
      }

      const data = await response.json();
      setResults(data);

    } catch (err: any) {
      setError(err.message || 'Consensus failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.demoContainer}>
      <View style={styles.demoHeader}>
        <Brain size={24} color="#8B5CF6" />
        <Text style={styles.demoTitle}>AI Consensus</Text>
      </View>
      <Text style={styles.demoSubtitle}>
        Multiple AI models answer your question. See where they agree and disagree.
      </Text>

      {/* Model Selection - Opens Modal */}
      <Text style={styles.inputLabel}>Select Models (2-5)</Text>
      <TouchableOpacity
        style={styles.modelSelector}
        onPress={() => setShowModelModal(true)}
      >
        <View style={styles.modelSelectorLeft}>
          <Brain size={20} color="#8B5CF6" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            {selectedModels.length > 0 ? (
              <Text style={styles.modelSelectorName} numberOfLines={1}>
                {selectedModels.map(m => m.name.split('/').pop()?.split(' ')[0]).join(', ')}
              </Text>
            ) : (
              <Text style={[styles.modelSelectorName, { color: '#666' }]}>
                Tap to select models...
              </Text>
            )}
            <Text style={styles.modelSelectorPrice}>
              {selectedModels.length}/5 models • {textModels.length} available
            </Text>
          </View>
        </View>
        <Plus size={20} color="#8B5CF6" />
      </TouchableOpacity>

      {/* Selected Models Chips */}
      {selectedModels.length > 0 && (
        <View style={styles.selectedChips}>
          {selectedModels.map((model) => (
            <View key={model.openrouterId} style={[styles.modelChip, { borderColor: '#8B5CF6' }]}>
              <Text style={styles.modelChipText}>{model.name}</Text>
              <TouchableOpacity onPress={() => handleToggleModel(model)}>
                <XCircle size={14} color="#8B5CF6" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Judge Model Selector */}
      <Text style={styles.inputLabel}>Select Judge Model (analyzes responses)</Text>
      <TouchableOpacity
        style={[styles.modelSelector, { borderColor: judgeModel ? '#10B981' : '#333' }]}
        onPress={() => setShowJudgeModal(true)}
      >
        <View style={styles.modelSelectorLeft}>
          <Trophy size={20} color="#10B981" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            {judgeModel ? (
              <Text style={styles.modelSelectorName} numberOfLines={1}>
                {judgeModel.name}
              </Text>
            ) : (
              <Text style={[styles.modelSelectorName, { color: '#666' }]}>
                Tap to select judge...
              </Text>
            )}
            <Text style={styles.modelSelectorPrice}>
              {judgeModel ? 'Will analyze and summarize all responses' : 'Choose who gives the verdict'}
            </Text>
          </View>
        </View>
        {judgeModel ? (
          <TouchableOpacity onPress={() => setJudgeModel(null)}>
            <XCircle size={20} color="#10B981" />
          </TouchableOpacity>
        ) : (
          <Plus size={20} color="#10B981" />
        )}
      </TouchableOpacity>

      {/* Prompt Input */}
      <Text style={styles.inputLabel}>Your Question</Text>
      <TextInput
        style={styles.promptInput}
        placeholder="Ask a question for consensus..."
        placeholderTextColor="#666"
        multiline
        value={prompt}
        onChangeText={setPrompt}
      />

      {/* Payment Method Selector with Dynamic Pricing */}
      <PaymentMethodSelector
        selected={paymentMethod}
        onSelect={setPaymentMethod}
        avaxPrice={quote?.payment?.recommendedAVAX}
        usdPrice={quote?.payment?.recommendedUSDC || (quoteLoading ? '...' : '0.00')}
      />

      {/* Quote Loading Indicator */}
      {quoteLoading && (
        <View style={styles.quoteLoading}>
          <ActivityIndicator size="small" color="#8B5CF6" />
          <Text style={styles.quoteLoadingText}>Calculating price...</Text>
        </View>
      )}

      {/* Execute Button */}
      <TouchableOpacity
        style={[styles.executeBtn, { backgroundColor: '#8B5CF6' }, (loading || selectedModels.length < 2 || !judgeModel || !quote) && styles.executeBtnDisabled]}
        onPress={executeConsensus}
        disabled={loading || selectedModels.length < 2 || !judgeModel || !quote}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <Users size={20} color="#FFF" />
            <Text style={[styles.executeBtnText, { color: '#FFF' }]}>
              {!isConnected ? 'Connect Wallet' : selectedModels.length < 2 ? 'Select 2+ Models' : !judgeModel ? 'Select Judge' : !quote ? 'Getting Quote...' : 'Get Consensus'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {results && (
        <View style={styles.resultsContainer}>
          {/* Export Button */}
          <View style={styles.resultsHeaderRight}>
            <ExportButton
              data={{ ...results, prompt, judgeModel: judgeModel?.openrouterId }}
              filename={`zeroprompt-consensus-${Date.now()}`}
              type="consensus"
            />
          </View>

          {/* Consensus Analysis */}
          {results.consensus && (
            <View style={[styles.consensusBox, { borderColor: '#10B981' }]}>
              <View style={styles.consensusHeader}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={styles.consensusTitle}>AI Consensus</Text>
              </View>
              {results.judgeModel && (
                <View style={styles.judgeBadge}>
                  <Trophy size={12} color="#10B981" />
                  <Text style={styles.judgeBadgeText}>Judged by {results.judgeModel.split('/')[1]}</Text>
                </View>
              )}
              <Markdown style={markdownStyles}>{results.consensus}</Markdown>
            </View>
          )}

          {/* Individual Responses - Comparison Grid */}
          <Text style={styles.comparisonLabel}>INDIVIDUAL PERSPECTIVES</Text>
          <View style={[styles.comparisonGrid, isDesktop && styles.comparisonGridDesktop]}>
            {results.responses?.map((result: any, index: number) => (
              <View key={index} style={[styles.comparisonCard, isDesktop && styles.comparisonCardDesktop, { borderColor: index === 0 ? '#8B5CF6' : index === 1 ? '#F59E0B' : index === 2 ? '#EC4899' : '#10B981' }]}>
                <View style={styles.comparisonHeader}>
                  <View style={[styles.modelBadgeSmall, { backgroundColor: index === 0 ? '#8B5CF620' : index === 1 ? '#F59E0B20' : index === 2 ? '#EC489920' : '#10B98120' }]}>
                    <Text style={[styles.modelBadgeText, { color: index === 0 ? '#8B5CF6' : index === 1 ? '#F59E0B' : index === 2 ? '#EC4899' : '#10B981' }]}>
                      {result.model.split('/')[1]}
                    </Text>
                  </View>
                </View>
                <ScrollView style={[styles.responseScroll, isDesktop && styles.responseScrollDesktop]} nestedScrollEnabled>
                  <ResponseContent content={result.response || ''} />
                </ScrollView>
              </View>
            ))}
          </View>

          {/* CURL Command */}
          <CurlCommand
            endpoint="/agent/consensus"
            body={{ prompt, models: selectedModels.map(m => m.openrouterId), judge: judgeModel?.openrouterId }}
            price="0.08"
          />
        </View>
      )}

      {/* Model Selector Modal - Same as /chat */}
      <ModelSelectorModal
        visible={showModelModal}
        onClose={() => setShowModelModal(false)}
        onToggleModel={handleToggleModel}
        models={textModels}
        selectedModels={selectedModels}
        theme={theme}
      />

      {/* Judge Model Selector Modal */}
      <ModelSelectorModal
        visible={showJudgeModal}
        onClose={() => setShowJudgeModal(false)}
        onToggleModel={handleSelectJudge}
        models={textModels}
        selectedModels={judgeModel ? [judgeModel] : []}
        theme={theme}
      />
    </View>
  );
};

// ============================================================================
// IMAGE GALLERY COMPONENT
// ============================================================================
const ImageGallery = ({ isConnected, address, openWalletModal, models, theme }: DemoProps) => {
  const { signTypedDataAsync } = useSignTypedData();
  const { sendTransactionAsync } = useSendTransaction();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const [prompt, setPrompt] = useState('A futuristic city with flying cars and neon lights, cyberpunk style');
  const [selectedModels, setSelectedModels] = useState<Model[]>([]);
  const [showModelModal, setShowModelModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('USDC');

  // Dynamic quote state
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Fetch quote when models or prompt change
  useEffect(() => {
    const fetchQuote = async () => {
      if (selectedModels.length < 1 || !prompt.trim()) {
        setQuote(null);
        return;
      }

      try {
        setQuoteLoading(true);
        const response = await fetch(`${API_URL}/agent/quote/gallery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            models: selectedModels.map(m => m.openrouterId),
            prompt
          })
        });
        const data = await response.json();
        if (data.success) {
          setQuote(data);
        }
      } catch (err) {
        console.error('Quote fetch failed:', err);
      } finally {
        setQuoteLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedModels, prompt]);

  // Filter to only image generation models
  const imageModels = models.filter(m => {
    const arch = m.architecture;
    const modality = arch?.modality || '';
    const lowerName = m.name.toLowerCase();
    const lowerId = m.openrouterId.toLowerCase();

    return modality.includes('->image') ||
      arch?.output_modalities?.includes('image') ||
      lowerId.includes('dall-e') ||
      lowerId.includes('flux') ||
      lowerId.includes('stable-diffusion') ||
      lowerId.includes('sdxl') ||
      lowerId.includes('imagen') ||
      lowerId.includes('midjourney') ||
      lowerId.includes('ideogram') ||
      lowerId.includes('recraft') ||
      lowerName.includes('image');
  });

  const handleToggleModel = (model: Model) => {
    const isSelected = selectedModels.some(m => m.openrouterId === model.openrouterId);
    if (isSelected) {
      setSelectedModels(selectedModels.filter(m => m.openrouterId !== model.openrouterId));
    } else if (selectedModels.length < 4) {
      setSelectedModels([...selectedModels, model]);
    }
  };

  const executeGallery = async () => {
    if (!isConnected || !address) {
      openWalletModal();
      return;
    }

    if (selectedModels.length < 1) {
      setError('Select at least 1 image model');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const modelIds = selectedModels.map(m => m.openrouterId);

      // First request to get 402 challenge
      const initialRes = await fetch(`${API_URL}/agent/image-gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, models: modelIds })
      });

      if (initialRes.status !== 402) {
        throw new Error('Unexpected response');
      }

      const challenge = await initialRes.json();
      const usdcOption = challenge.accepts.find((a: any) => a.scheme === 'x402-eip3009');
      const avaxOption = challenge.accepts.find((a: any) => a.scheme === 'x402-native');

      let paymentPayload: any;

      if (paymentMethod === 'AVAX' && avaxOption) {
        const avaxAmount = parseEther(avaxOption.price);
        const txHash = await sendTransactionAsync({
          to: MERCHANT_ADDRESS,
          value: avaxAmount,
        });
        paymentPayload = {
          x402Version: 2,
          scheme: 'x402-native',
          network: 'avalanche',
          chainId: AVALANCHE_CONFIG.chainId,
          payload: { txHash, from: address }
        };
      } else {
        const priceUSD = parseFloat(usdcOption.price);
        const usdcAmount = BigInt(Math.ceil(priceUSD * 1_000_000));
        const nonceBytes = new Uint8Array(32);
        crypto.getRandomValues(nonceBytes);
        const nonce = '0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');

        const now = Math.floor(Date.now() / 1000);
        const validAfter = BigInt(now - 60);
        const validBefore = BigInt(now + 3600);

        const signature = await signTypedDataAsync({
          domain: {
            name: 'USD Coin',
            version: '2',
            chainId: AVALANCHE_CONFIG.chainId,
            verifyingContract: AVALANCHE_CONFIG.usdc
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
          } as const,
          primaryType: 'TransferWithAuthorization',
          message: {
            from: address as `0x${string}`,
            to: MERCHANT_ADDRESS,
            value: usdcAmount,
            validAfter,
            validBefore,
            nonce: nonce as `0x${string}`
          }
        });

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
      }

      const response = await fetch(`${API_URL}/agent/image-gallery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payment': btoa(JSON.stringify(paymentPayload))
        },
        body: JSON.stringify({ prompt, models: modelIds })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Gallery failed');
      }

      const data = await response.json();
      setResults(data);

    } catch (err: any) {
      setError(err.message || 'Gallery failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.demoContainer}>
      <View style={styles.demoHeader}>
        <ImageIcon size={24} color="#EC4899" />
        <Text style={styles.demoTitle}>Image Gallery</Text>
      </View>
      <Text style={styles.demoSubtitle}>
        Generate images with multiple AI art models simultaneously.
      </Text>

      {/* Model Selection - Opens Modal */}
      <Text style={styles.inputLabel}>Select Image Models (1-4)</Text>
      <TouchableOpacity
        style={styles.modelSelector}
        onPress={() => setShowModelModal(true)}
      >
        <View style={styles.modelSelectorLeft}>
          <ImageIcon size={20} color="#EC4899" />
          <View style={{ marginLeft: 12, flex: 1 }}>
            {selectedModels.length > 0 ? (
              <Text style={styles.modelSelectorName} numberOfLines={1}>
                {selectedModels.map(m => m.name.split('/').pop()?.split(' ')[0]).join(', ')}
              </Text>
            ) : (
              <Text style={[styles.modelSelectorName, { color: '#666' }]}>
                Tap to select image models...
              </Text>
            )}
            <Text style={styles.modelSelectorPrice}>
              {selectedModels.length}/4 models • {imageModels.length} available
            </Text>
          </View>
        </View>
        <Plus size={20} color="#EC4899" />
      </TouchableOpacity>

      {/* Selected Models Chips */}
      {selectedModels.length > 0 && (
        <View style={styles.selectedChips}>
          {selectedModels.map((model) => (
            <View key={model.openrouterId} style={[styles.modelChip, { borderColor: '#EC4899' }]}>
              <Text style={styles.modelChipText}>{model.name}</Text>
              <TouchableOpacity onPress={() => handleToggleModel(model)}>
                <XCircle size={14} color="#EC4899" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Prompt Input */}
      <Text style={styles.inputLabel}>Image Prompt</Text>
      <TextInput
        style={styles.promptInput}
        placeholder="Describe the image you want..."
        placeholderTextColor="#666"
        multiline
        value={prompt}
        onChangeText={setPrompt}
      />

      {/* Payment Method Selector with Dynamic Pricing */}
      <PaymentMethodSelector
        selected={paymentMethod}
        onSelect={setPaymentMethod}
        avaxPrice={quote?.payment?.recommendedAVAX}
        usdPrice={quote?.payment?.recommendedUSDC || (quoteLoading ? '...' : '0.00')}
      />

      {/* Quote Loading Indicator */}
      {quoteLoading && (
        <View style={styles.quoteLoading}>
          <ActivityIndicator size="small" color="#EC4899" />
          <Text style={styles.quoteLoadingText}>Calculating price...</Text>
        </View>
      )}

      {/* Execute Button */}
      <TouchableOpacity
        style={[styles.executeBtn, { backgroundColor: '#EC4899' }, (loading || selectedModels.length < 1 || !quote) && styles.executeBtnDisabled]}
        onPress={executeGallery}
        disabled={loading || selectedModels.length < 1 || !quote}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <>
            <ImageIcon size={20} color="#FFF" />
            <Text style={[styles.executeBtnText, { color: '#FFF' }]}>
              {!isConnected ? 'Connect Wallet' : selectedModels.length < 1 ? 'Select Models' : !quote ? 'Getting Quote...' : `Generate ${selectedModels.length} Image${selectedModels.length !== 1 ? 's' : ''}`}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Results */}
      {results && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <View style={styles.resultsHeaderLeft}>
              <ImageIcon size={20} color="#EC4899" />
              <Text style={styles.resultsTitle}>Generated Images</Text>
              <View style={styles.latencyBadge}>
                <Text style={styles.latencyText}>{results.totalLatency}ms</Text>
              </View>
            </View>
            <ExportButton
              data={{ ...results, prompt }}
              filename={`zeroprompt-gallery-${Date.now()}`}
              type="gallery"
            />
          </View>

          <Text style={styles.comparisonLabel}>MULTI-MODEL COMPARISON</Text>
          <View style={[styles.imageGridResults, isDesktop && styles.imageGridDesktop]}>
            {results.images?.map((img: any, index: number) => (
              <View key={index} style={[styles.imageCard, isDesktop && styles.imageCardDesktop, { borderColor: index === 0 ? '#EC4899' : index === 1 ? '#8B5CF6' : index === 2 ? '#F59E0B' : '#10B981' }]}>
                <View style={[styles.imageModelHeader, { backgroundColor: index === 0 ? '#EC489920' : index === 1 ? '#8B5CF620' : index === 2 ? '#F59E0B20' : '#10B98120' }]}>
                  <Text style={[styles.imageModelName, { color: index === 0 ? '#EC4899' : index === 1 ? '#8B5CF6' : index === 2 ? '#F59E0B' : '#10B981' }]}>{img.modelName}</Text>
                  {img.latency > 0 && <Text style={styles.imageLatency}>{img.latency}ms</Text>}
                </View>
                {img.imageUrl ? (
                  <Image
                    source={{ uri: img.imageUrl }}
                    style={styles.generatedImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <XCircle size={24} color="#EF4444" />
                    <Text style={styles.imageError}>{img.error || 'Failed'}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* CURL Command */}
          <CurlCommand
            endpoint="/agent/image-gallery"
            body={{ prompt, models: selectedModels.map(m => m.openrouterId) }}
            price="0.15"
          />
        </View>
      )}

      {/* Model Selector Modal - Same as /chat */}
      <ModelSelectorModal
        visible={showModelModal}
        onClose={() => setShowModelModal(false)}
        onToggleModel={handleToggleModel}
        models={imageModels}
        selectedModels={selectedModels}
        theme={theme}
      />
    </View>
  );
};

// ============================================================================
// MAIN EXPORT - TABBED DEMOS
// ============================================================================
export default function ProtocolDemos({ isConnected, address, openWalletModal, models, theme }: DemoProps) {
  const [activeTab, setActiveTab] = useState<DemoTab>('battle');

  return (
    <View style={styles.container}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'battle' && styles.tabActive]}
          onPress={() => setActiveTab('battle')}
        >
          <Swords size={18} color={activeTab === 'battle' ? '#F59E0B' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'battle' && styles.tabTextActive]}>
            Battle
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'consensus' && styles.tabActive]}
          onPress={() => setActiveTab('consensus')}
        >
          <Brain size={18} color={activeTab === 'consensus' ? '#8B5CF6' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'consensus' && styles.tabTextActive]}>
            Consensus
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'gallery' && styles.tabActive]}
          onPress={() => setActiveTab('gallery')}
        >
          <ImageIcon size={18} color={activeTab === 'gallery' ? '#EC4899' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'gallery' && styles.tabTextActive]}>
            Gallery
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'battle' && (
          <ModelBattle
            isConnected={isConnected}
            address={address}
            openWalletModal={openWalletModal}
            models={models}
            theme={theme}
          />
        )}
        {activeTab === 'consensus' && (
          <AIConsensus
            isConnected={isConnected}
            address={address}
            openWalletModal={openWalletModal}
            models={models}
            theme={theme}
          />
        )}
        {activeTab === 'gallery' && (
          <ImageGallery
            isConnected={isConnected}
            address={address}
            openWalletModal={openWalletModal}
            models={models}
            theme={theme}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#1a1a1a',
  },
  tabText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
  },
  tabContent: {
    flex: 1,
  },
  demoContainer: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  demoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  demoSubtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
  },
  inputLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  searchInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 10,
    color: '#FFF',
    fontSize: 14,
    marginBottom: 12,
  },
  modelGrid: {
    maxHeight: 200,
    marginBottom: 16,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  modelGridInner: {
    padding: 8,
    gap: 8,
  },
  inlineModelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
  },
  inlineModelCardSelected: {
    borderColor: '#F59E0B',
    backgroundColor: '#F59E0B10',
  },
  inlineModelInfo: {
    flex: 1,
  },
  inlineModelName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  inlineModelProvider: {
    color: '#666',
    fontSize: 11,
    marginTop: 2,
  },
  modelSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  modelSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modelSelectorName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modelSelectorPrice: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  selectedChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  modelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  modelChipText: {
    color: '#CCC',
    fontSize: 12,
    fontWeight: '500',
  },
  promptInput: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  priceBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f1a0f',
    borderWidth: 1,
    borderColor: '#1a3a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  priceLabel: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '700',
  },
  priceHint: {
    color: '#22C55E',
    fontSize: 12,
  },
  executeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  executeBtnDisabled: {
    opacity: 0.5,
  },
  executeBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0f0f',
    borderWidth: 1,
    borderColor: '#3a1a1a',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  resultsContainer: {
    marginTop: 20,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    zIndex: 9999,
    position: 'relative',
  },
  resultsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 200,
  },
  resultsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 12,
    zIndex: 9999,
  },
  resultsTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  latencyBadge: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  latencyText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  comparisonLabel: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  comparisonGrid: {
    gap: 12,
  },
  comparisonCard: {
    backgroundColor: '#0a0a0a',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  comparisonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modelBadgeSmall: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  modelLatency: {
    color: '#666',
    fontSize: 11,
  },
  responseScroll: {
    maxHeight: 200,
    padding: 12,
  },
  imageModelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
  },
  resultCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultModelName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultLatency: {
    color: '#666',
    fontSize: 12,
  },
  resultText: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
  },
  consensusModels: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modelBadge: {
    backgroundColor: '#8B5CF620',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  modelBadgeText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
  },
  consensusBox: {
    backgroundColor: '#0f1a0f',
    borderWidth: 1,
    borderColor: '#1a3a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  consensusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  consensusTitle: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '600',
  },
  judgeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B98120',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 4,
  },
  judgeBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  consensusText: {
    color: '#CCC',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  imageGridResults: {
    gap: 12,
  },
  imageCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
  imageModelName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    padding: 12,
    paddingBottom: 8,
  },
  generatedImage: {
    width: '100%',
    height: 250,
  },
  imagePlaceholder: {
    width: '100%',
    height: 150,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imageError: {
    color: '#EF4444',
    fontSize: 12,
  },
  imageLatency: {
    color: '#666',
    fontSize: 11,
    padding: 8,
    textAlign: 'right',
  },
  // Desktop responsive styles
  comparisonGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  comparisonCardDesktop: {
    flex: 1,
    minWidth: 300,
    maxWidth: '49%',
  },
  responseScrollDesktop: {
    maxHeight: 350,
  },
  imageGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  imageCardDesktop: {
    flex: 1,
    minWidth: 250,
    maxWidth: '49%',
  },
  // Quote loading indicator
  quoteLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 12,
  },
  quoteLoadingText: {
    color: '#888',
    fontSize: 12,
  },
});
