import { useEffect, useRef, useState, useMemo, useCallback, lazy, Suspense } from "react";
import {useRouter, useLocalSearchParams, usePathname} from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  useWindowDimensions,
  Animated,
  Easing,
  StatusBar as RNStatusBar,
  Clipboard,
  Image,
  ScrollView,
  Linking,
  Share,
  Alert
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Markdown from 'react-native-markdown-display';
import { Video, ResizeMode } from "expo-av";

import {
  Terminal, Wallet, Menu, Send, Shield,
  Settings, X, Plus, Cpu, ChevronRight, ChevronDown, ChevronUp,
  MessageSquare, Copy, RefreshCw, Lock, Check, Maximize2, Minimize2,
  Image as ImageIcon, FileText, Box, Search, Globe, Brain, Mic, Layers, Grid, Layout,
  Eye, Sparkles, PenTool, Trash2, CreditCard, DollarSign, ExternalLink, Code, Star, Home, Download, Server
} from 'lucide-react-native';

// ZeroPrompt Logo
const ZEROPROMPT_LOGO = require('../../assets/logos/zero-prompt-logo.png');
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import { useBilling } from "../../context/BillingContext";
import UpsaleModal from "../../components/UpsaleModal";
import DepositModal from "../../components/DepositModal";
import { WalletConnectModal, WalletSidebarSection, MigrationBanner } from "../../components/WalletConnectionUI";
import ModelSelectorModal from "../../components/ModelSelectorModal";
import ImageGalleryModal from "../../components/ImageGalleryModal";
import { VAULT_ADDRESS } from "../../lib/constants";
import { API_URL, SUBNET_API_URL } from "../../config/api";
import { fetchStream } from "../../lib/stream-polyfill";
import { useMode } from "../../context/ModeContext";
import NodeFeedback from "../../components/NodeFeedback";


type Model = {
  id: number;
  openrouterId: string;
  name: string;
  iconUrl?: string;
  contextLength?: number;
  publicPricingPrompt?: number;
  publicPricingCompletion?: number;
  architecture?: {
    modality?: string;
    has_web_search?: boolean;
    is_reasoning?: boolean;
    has_audio?: boolean;
    input_modalities?: string[];
    output_modalities?: string[];
  };
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "comparison";
  content: string;
  reasoning?: string;
  sources?: string[];
  model?: string;
  timestamp: number;
  attachmentUrl?: string;
  attachmentType?: string;
  webSearchType?: 'native' | 'exa' | null;
  billing?: { costUSD: string; inputTokens?: number; outputTokens?: number; nodeAddress?: string; mode?: string };
  generatedImages?: string[];
  responses?: {
      modelId: string;
      modelName: string;
      content: string;
      reasoning: string;
      sources?: string[];
      attachmentUrl?: string;
      attachmentType?: string;
      webSearchType?: 'native' | 'exa' | null;
      billing?: { costUSD: string; inputTokens?: number; outputTokens?: number; nodeAddress?: string; mode?: string };
      generatedImages?: string[];
      status: 'pending' | 'streaming' | 'done' | 'error';
      error?: string;
  }[];
};

const FONT_MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// Custom scrollbar styles for web
const customScrollbarStyle = Platform.OS === 'web' ? {
    // @ts-ignore - web specific
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(0, 255, 65, 0.3) transparent',
} : {};

// Inject global scrollbar styles for web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const styleId = 'zeroprompt-scrollbar-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Custom Scrollbar Styles */
            ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }
            ::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.02);
                border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, rgba(0, 255, 65, 0.4) 0%, rgba(0, 255, 65, 0.2) 100%);
                border-radius: 4px;
                border: 2px solid transparent;
                background-clip: padding-box;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(180deg, rgba(0, 255, 65, 0.6) 0%, rgba(0, 255, 65, 0.4) 100%);
                background-clip: padding-box;
            }
            ::-webkit-scrollbar-corner {
                background: transparent;
            }
            /* Horizontal scrollbar specific */
            ::-webkit-scrollbar:horizontal {
                height: 6px;
            }
            /* Hide scrollbar for specific elements but keep functionality */
            .hide-scrollbar::-webkit-scrollbar {
                display: none;
            }
            .hide-scrollbar {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
        `;
        document.head.appendChild(style);
    }
}

// Model Logo component - displays model icon or fallback
const ModelLogo = ({
    modelId,
    iconUrl,
    size = 24,
    theme
}: {
    modelId?: string;
    iconUrl?: string;
    size?: number;
    theme: any;
}) => {
    // Try to get icon from provided iconUrl or generate from model ID
    const [imageError, setImageError] = useState(false);

    // OpenRouter provides icons at this URL pattern for models
    const getProviderIcon = (id: string) => {
        if (!id) return null;
        const provider = id.split('/')[0];
        // Comprehensive provider icons mapping from OpenRouter
        const providerIcons: Record<string, string> = {
            // Major providers
            'openai': 'https://openrouter.ai/images/icons/OpenAI.svg',
            'anthropic': 'https://openrouter.ai/images/icons/Anthropic.svg',
            'google': 'https://openrouter.ai/images/icons/Google.svg',
            'meta-llama': 'https://openrouter.ai/images/icons/Meta.svg',
            'mistralai': 'https://openrouter.ai/images/icons/Mistral.svg',
            'perplexity': 'https://openrouter.ai/images/icons/Perplexity.svg',
            'cohere': 'https://openrouter.ai/images/icons/Cohere.svg',
            'deepseek': 'https://openrouter.ai/images/icons/DeepSeek.svg',
            'qwen': 'https://openrouter.ai/images/icons/Qwen.svg',
            'x-ai': 'https://openrouter.ai/images/icons/xAI.svg',
            'amazon': 'https://openrouter.ai/images/icons/Amazon.svg',
            // Additional providers
            'ai21': 'https://openrouter.ai/images/icons/AI21.svg',
            'alibaba': 'https://openrouter.ai/images/icons/Alibaba.svg',
            'allenai': 'https://openrouter.ai/images/icons/AllenAI.svg',
            'nvidia': 'https://openrouter.ai/images/icons/NVIDIA.svg',
            'microsoft': 'https://openrouter.ai/images/icons/Microsoft.svg',
            'ibm-granite': 'https://openrouter.ai/images/icons/IBM.svg',
            'inflection': 'https://openrouter.ai/images/icons/Inflection.svg',
            'minimax': 'https://openrouter.ai/images/icons/MiniMax.svg',
            'bytedance': 'https://openrouter.ai/images/icons/ByteDance.svg',
            'baidu': 'https://openrouter.ai/images/icons/Baidu.svg',
            'tencent': 'https://openrouter.ai/images/icons/Tencent.svg',
            'meituan': 'https://openrouter.ai/images/icons/Meituan.svg',
            'liquid': 'https://openrouter.ai/images/icons/Liquid.svg',
            'nousresearch': 'https://openrouter.ai/images/icons/NousResearch.svg',
            'openrouter': 'https://openrouter.ai/images/icons/OpenRouter.svg',
            'moonshotai': 'https://openrouter.ai/images/icons/Moonshot.svg',
            'stepfun-ai': 'https://openrouter.ai/images/icons/StepFun.svg',
            'thudm': 'https://openrouter.ai/images/icons/THUDM.svg',
            // Community/Fine-tune providers (use generic AI icon or fallback)
            'cognitivecomputations': 'https://openrouter.ai/images/icons/CognitiveComputations.svg',
            'eleutherai': 'https://openrouter.ai/images/icons/EleutherAI.svg',
        };
        return providerIcons[provider] || null;
    };

    const finalIconUrl = iconUrl || getProviderIcon(modelId || '');

    if (!finalIconUrl || imageError) {
        // Fallback to Sparkles icon
        return (
            <View style={{
                width: size,
                height: size,
                borderRadius: size / 3,
                backgroundColor: 'rgba(0, 255, 65, 0.15)',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Sparkles size={size * 0.6} color={theme.primary} />
            </View>
        );
    }

    return (
        <Image
            source={{ uri: finalIconUrl }}
            style={{
                width: size,
                height: size,
                borderRadius: size / 4,
                backgroundColor: 'rgba(255,255,255,0.05)'
            }}
            onError={() => setImageError(true)}
        />
    );
};

// Copy button component with feedback
const CopyButton = ({ content, theme, size = 14, label }: { content: string; theme: any; size?: number; label?: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        Clipboard.setString(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <TouchableOpacity
            onPress={handleCopy}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: label ? 6 : 0,
                padding: 6,
                backgroundColor: copied ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255,255,255,0.05)',
                borderRadius: 6
            }}
        >
            {copied ? (
                <Check size={size} color={theme.primary} strokeWidth={3} />
            ) : (
                <Copy size={size} color={theme.secondary} />
            )}
            {label && (
                <Text style={{ color: copied ? theme.primary : theme.secondary, fontSize: 11, fontFamily: FONT_MONO }}>
                    {copied ? 'Copied!' : label}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const ReasoningAccordion = ({ content, theme }: any) => {
    // Start expanded by default when there's content so user immediately sees the thinking
    const [expanded, setExpanded] = useState(true);
    // Ensure content is a valid non-empty string - null, undefined, empty string should all return null
    if (!content || typeof content !== 'string' || content.trim() === '') return null;

    const reasoningMarkdownStyles = {
        body: { color: theme.textMuted, fontFamily: FONT_MONO, fontSize: 12, lineHeight: 18 },
        paragraph: { marginVertical: 4, color: theme.textMuted },
        heading1: { color: '#8B5CF6', fontWeight: '700' as const, fontSize: 16, marginVertical: 8 },
        heading2: { color: '#8B5CF6', fontWeight: '600' as const, fontSize: 14, marginVertical: 6 },
        heading3: { color: '#A78BFA', fontWeight: '600' as const, fontSize: 13, marginVertical: 4 },
        code_inline: { backgroundColor: 'rgba(139, 92, 246, 0.2)', color: '#A78BFA', fontFamily: FONT_MONO, paddingHorizontal: 4, borderRadius: 3 },
        code_block: { backgroundColor: 'rgba(139, 92, 246, 0.15)', padding: 10, borderRadius: 6, fontFamily: FONT_MONO },
        fence: { backgroundColor: 'rgba(139, 92, 246, 0.15)', padding: 10, borderRadius: 6, fontFamily: FONT_MONO },
        list_item: { color: theme.textMuted, marginVertical: 2 },
        bullet_list: { marginVertical: 4 },
        ordered_list: { marginVertical: 4 },
        strong: { color: '#A78BFA', fontWeight: '700' as const },
        em: { color: theme.textMuted, fontStyle: 'italic' as const },
        link: { color: '#8B5CF6' },
        blockquote: { borderLeftWidth: 2, borderLeftColor: '#8B5CF6', paddingLeft: 10, opacity: 0.8 },
    };

    return (
        <View style={{marginBottom: 16, marginTop: 4}}>
            <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: 'rgba(139, 92, 246, 0.15)',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    alignSelf: 'flex-start',
                    borderWidth: 1,
                    borderColor: 'rgba(139, 92, 246, 0.3)'
                }}
            >
                <Brain size={14} color="#8B5CF6" />
                <Text style={{color: '#8B5CF6', fontSize: 11, fontFamily: FONT_MONO, fontWeight: '700', letterSpacing: 1}}>
                    REASONING
                </Text>
                {expanded ? <ChevronUp size={14} color="#8B5CF6"/> : <ChevronDown size={14} color="#8B5CF6"/>}
            </TouchableOpacity>
            {expanded && (
                <View style={{
                    marginTop: 10,
                    padding: 14,
                    borderLeftWidth: 3,
                    borderLeftColor: '#8B5CF6',
                    backgroundColor: 'rgba(139, 92, 246, 0.08)',
                    borderRadius: 4,
                    maxHeight: 300
                }}>
                    <ScrollView style={{ maxHeight: 280 }}>
                        <Markdown style={reasoningMarkdownStyles}>
                            {content}
                        </Markdown>
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

const SourceList = ({ sources, theme, webSearchType }: any) => {
    if (!sources || sources.length === 0) return null;

    // Dedupe sources
    const uniqueSources = [...new Set(sources)];

    // Web search type colors - More vibrant
    const isNative = webSearchType === 'native';
    const searchTypeColor = isNative ? '#00FF41' : '#FF6B00';
    const searchTypeGlow = isNative ? 'rgba(0, 255, 65, 0.4)' : 'rgba(255, 107, 0, 0.4)';
    const searchTypeLabel = isNative ? 'LIVE' : 'CACHED';
    const searchTypeIcon = isNative ? '⚡' : '📦';

    return (
        <View style={{
            marginTop: 20,
            paddingTop: 20,
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 255, 65, 0.15)'
        }}>
            {/* Epic Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
                flexWrap: 'wrap'
            }}>
                {/* Globe Icon with Glow */}
                <View style={{
                    backgroundColor: 'rgba(0, 255, 65, 0.2)',
                    padding: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: 'rgba(0, 255, 65, 0.3)',
                    shadowColor: '#00FF41',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 8
                }}>
                    <Globe size={16} color="#00FF41" />
                </View>
                <Text style={{
                    color: '#00FF41',
                    fontSize: 12,
                    fontFamily: FONT_MONO,
                    fontWeight: '800',
                    letterSpacing: 2,
                    textShadowColor: 'rgba(0, 255, 65, 0.5)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 10
                }}>
                    WEB SOURCES
                </Text>
                {/* Count Badge with Glow */}
                <View style={{
                    backgroundColor: 'rgba(0, 255, 65, 0.25)',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(0, 255, 65, 0.4)'
                }}>
                    <Text style={{
                        color: '#00FF41',
                        fontSize: 11,
                        fontFamily: FONT_MONO,
                        fontWeight: '800'
                    }}>
                        {uniqueSources.length}
                    </Text>
                </View>
                {/* Web Search Type Badge - Epic Style */}
                {webSearchType && (
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: `${searchTypeColor}15`,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: `${searchTypeColor}50`,
                        shadowColor: searchTypeColor,
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8
                    }}>
                        <Text style={{fontSize: 10}}>{searchTypeIcon}</Text>
                        <Text style={{
                            color: searchTypeColor,
                            fontSize: 10,
                            fontFamily: FONT_MONO,
                            fontWeight: '800',
                            letterSpacing: 1
                        }}>
                            {searchTypeLabel}
                        </Text>
                    </View>
                )}
            </View>

            {/* Source Cards - Epic Grid */}
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
                {uniqueSources.map((s: string, i: number) => {
                    let hostname = s;
                    let displayName = s;
                    try {
                        const url = new URL(s);
                        hostname = url.hostname.replace('www.', '');
                        displayName = hostname.split('.')[0];
                        if (displayName.length < 3) displayName = hostname;
                    } catch {}

                    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

                    // Alternate accent colors for variety
                    const accentColors = ['#00FF41', '#8B5CF6', '#06B6D4', '#F59E0B', '#EF4444', '#EC4899'];
                    const accent = accentColors[i % accentColors.length];

                    return (
                        <TouchableOpacity
                            key={i}
                            onPress={() => Linking.openURL(s)}
                            activeOpacity={0.7}
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                paddingLeft: 12,
                                paddingRight: 16,
                                paddingVertical: 12,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: `${accent}30`,
                                borderLeftWidth: 3,
                                borderLeftColor: accent,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 12,
                                minWidth: 180,
                                maxWidth: 260,
                                shadowColor: accent,
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.1,
                                shadowRadius: 8
                            }}
                        >
                            {/* Index Badge with Accent Glow */}
                            <View style={{
                                backgroundColor: `${accent}20`,
                                width: 26,
                                height: 26,
                                borderRadius: 8,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderWidth: 1,
                                borderColor: `${accent}40`
                            }}>
                                <Text style={{
                                    color: accent,
                                    fontSize: 11,
                                    fontFamily: FONT_MONO,
                                    fontWeight: '800'
                                }}>
                                    {i + 1}
                                </Text>
                            </View>

                            {/* Favicon with Ring */}
                            <View style={{
                                padding: 2,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.15)'
                            }}>
                                <Image
                                    source={{ uri: faviconUrl }}
                                    style={{
                                        width: 18,
                                        height: 18,
                                        borderRadius: 4,
                                        backgroundColor: 'rgba(255,255,255,0.1)'
                                    }}
                                />
                            </View>

                            {/* Domain Info */}
                            <View style={{flex: 1}}>
                                <Text
                                    numberOfLines={1}
                                    style={{
                                        color: '#ffffff',
                                        fontSize: 13,
                                        fontFamily: FONT_MONO,
                                        fontWeight: '700',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {displayName}
                                </Text>
                                <Text
                                    numberOfLines={1}
                                    style={{
                                        color: 'rgba(255,255,255,0.5)',
                                        fontSize: 10,
                                        fontFamily: FONT_MONO,
                                        marginTop: 2
                                    }}
                                >
                                    {hostname}
                                </Text>
                            </View>

                            {/* Arrow Icon */}
                            <ExternalLink size={12} color={accent} style={{opacity: 0.7}} />
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

// Global cache for history to persist across route changes
let historyCache: any[] = [];

const Sidebar = ({ isOpen, onClose, isDesktop, theme, user, connectWallet, startNewChat, isConnecting, isAuthenticating, token, guestId, getHeaders, router, currentBalance, logout, onOpenGallery, onOpenDepositModal }: any) => {
  const { width, height } = useWindowDimensions();
  const isMobile = width < 600;
  const sidebarWidth = isDesktop ? 280 : (isMobile ? Math.min(width * 0.85, 320) : 300);
  const slideAnim = useRef(new Animated.Value(isDesktop ? 0 : -sidebarWidth)).current;
  // Initialize from cache to prevent flash on route change
  const [history, setHistory] = useState<any[]>(historyCache);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, title: string} | null>(null);
  const [txHistoryVisible, setTxHistoryVisible] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txTab, setTxTab] = useState<'deposits' | 'usage'>('deposits'); // Tab state for transaction history

  // Debug: Log when transactions state changes
  useEffect(() => {
      console.log("[TxHistory] State updated - transactions count:", transactions.length);
  }, [transactions]);

  useEffect(() => {
    if (isDesktop) { slideAnim.setValue(0); } else {
        Animated.timing(slideAnim, { toValue: isOpen ? 0 : -sidebarWidth - 20, duration: 280, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
    }
  }, [isOpen, isDesktop, sidebarWidth]);

  const loadHistoryRef = useRef(false);

  const loadHistory = useCallback(() => {
      if ((user || guestId) && !loadHistoryRef.current) {
          loadHistoryRef.current = true;
          fetch(`${API_URL}/llm/history`, { headers: getHeaders() })
          .then(r => r.json())
          .then(data => {
              const newConversations = data.conversations || [];
              // Only update if data actually changed (compare IDs)
              setHistory(prev => {
                  const prevIds = prev.map(h => h.id).join(',');
                  const newIds = newConversations.map((h: any) => h.id).join(',');
                  if (prevIds === newIds) return prev;
                  // Update global cache
                  historyCache = newConversations;
                  return newConversations;
              });
          })
          .catch(e => console.error(e))
          .finally(() => { loadHistoryRef.current = false; });
      }
  }, [user, guestId, getHeaders]);

  useEffect(() => {
      if (isOpen) loadHistory();
  }, [isOpen, user, guestId, token, loadHistory]);

  const confirmDelete = (item: {id: string, title: string}) => {
      setItemToDelete(item);
      setDeleteModalVisible(true);
  };

  const executeDelete = async () => {
      if (!itemToDelete) return;
      setDeletingId(itemToDelete.id);
      setDeleteModalVisible(false);
      try {
          await fetch(`${API_URL}/llm/conversations/${itemToDelete.id}`, {
              method: 'DELETE',
              headers: getHeaders()
          });
          setHistory(prev => {
              const filtered = prev.filter(h => h.id !== itemToDelete.id);
              historyCache = filtered; // Update cache on delete
              return filtered;
          });
      } catch (e) {
          console.error("Failed to delete conversation", e);
      }
      setDeletingId(null);
      setItemToDelete(null);
  };

  // Filter conversations by search query
  const filteredHistory = searchQuery
      ? history.filter(h => (h.title || "").toLowerCase().includes(searchQuery.toLowerCase()))
      : history;

  // Load transaction history (deposits + usage)
  const loadTransactions = async () => {
      if (!user) {
          console.log("[TxHistory] No user, skipping load");
          return;
      }
      setLoadingTx(true);
      try {
          // Use address-specific endpoints instead of /billing/me to avoid auth issues
          const walletAddress = user.walletAddress;
          console.log("[TxHistory] Fetching for wallet:", walletAddress);

          // Fetch deposits and usage in parallel
          const [depositsRes, usageRes] = await Promise.all([
              fetch(`${API_URL}/billing/deposits/${walletAddress}`, { headers: getHeaders() }),
              fetch(`${API_URL}/billing/usage/${walletAddress}`, { headers: getHeaders() })
          ]);

          console.log("[TxHistory] Deposits response status:", depositsRes.status);
          console.log("[TxHistory] Usage response status:", usageRes.status);

          // Parse deposits
          let depositsData: any[] = [];
          if (depositsRes.ok) {
              const depositsJson = await depositsRes.json();
              console.log("[TxHistory] Deposits raw:", JSON.stringify(depositsJson, null, 2));
              depositsData = depositsJson.deposits || [];
          } else {
              console.error("[TxHistory] Deposits fetch failed:", depositsRes.status);
          }

          // Parse usage
          let usageData: any[] = [];
          if (usageRes.ok) {
              const usageJson = await usageRes.json();
              console.log("[TxHistory] Usage raw:", JSON.stringify(usageJson, null, 2));
              usageData = usageJson.usage || [];
          } else {
              console.error("[TxHistory] Usage fetch failed:", usageRes.status);
          }

          // Map deposits with full details
          const deposits = depositsData.map((d: any) => ({
              type: 'deposit' as const,
              amountUSD: parseFloat(d.amountUSD || d.creditsUSD || d.amount || 0),
              amountNative: d.amountNative || d.amountAVAX,
              priceAtDeposit: d.priceAtDeposit,
              txHash: d.txId || d.txHash,
              timestamp: d.timestamp,
              createdAt: d.timestamp ? new Date(d.timestamp * 1000).toISOString() : d.createdAt
          }));

          // Map usage with full details
          const usage = usageData.map((u: any) => ({
              type: 'usage' as const,
              amountUSD: parseFloat(u.amountUSD || u.costUSD || 0),
              model: u.model,
              inputTokens: u.inputTokens,
              outputTokens: u.outputTokens,
              requestId: u.requestId,
              timestamp: u.timestamp,
              createdAt: u.timestamp ? new Date(u.timestamp * 1000).toISOString() : u.createdAt
          }));

          // Merge and sort by date (newest first)
          const combined = [...deposits, ...usage].sort((a, b) => {
              const dateA = new Date(a.createdAt || 0).getTime();
              const dateB = new Date(b.createdAt || 0).getTime();
              return dateB - dateA;
          });

          console.log("[TxHistory] Final combined:", combined.length, "transactions");
          console.log("[TxHistory] Deposits:", deposits.length, "Usage:", usage.length);
          setTransactions(combined);
      } catch (e) {
          console.error("[TxHistory] Failed to load:", e);
      }
      setLoadingTx(false);
  };

  const openTxExplorer = (txHash: string) => {
      const url = `https://snowtrace.io/tx/${txHash}`;
      Linking.openURL(url);
  };

  const openTxHistory = () => {
      setTxHistoryVisible(true);
      loadTransactions();
  };

  // Hide sidebar when closed (both mobile and desktop)
  if (!isOpen) return null;

  return (
    <Animated.View style={[styles.sidebar, { backgroundColor: theme.surface, borderColor: theme.border, transform: [{ translateX: slideAnim }], position: isDesktop ? 'relative' : 'absolute', zIndex: 1000, width: sidebarWidth, height: '100%', borderRightWidth: 1, ...(isMobile && !isDesktop && { borderTopRightRadius: 20, borderBottomRightRadius: 20 }) }]}>
      <SafeAreaView style={{flex: 1}}>
        {/* Fixed Header */}
        <View style={styles.sidebarHeader}>
          <View style={styles.brandRow}>
            <Image source={ZEROPROMPT_LOGO} style={{width: isMobile ? 28 : 32, height: isMobile ? 28 : 32}} resizeMode="contain" />
            <Text style={[styles.brandText, { color: theme.text, fontSize: isMobile ? 16 : 18 }]}>ZeroPrompt</Text>
          </View>
          {!isDesktop && (
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={theme.secondary} size={isMobile ? 20 : 24} />
            </TouchableOpacity>
          )}
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={[styles.newChatBtn, { backgroundColor: theme.primary, marginHorizontal: isMobile ? 12 : 16, padding: isMobile ? 10 : 12, marginBottom: isMobile ? 12 : 24 }]} onPress={() => { startNewChat(); if(!isDesktop) onClose(); }}>
              <Plus color={theme.background} size={isMobile ? 18 : 20} />
              <Text style={[styles.newChatText, { color: theme.background, fontSize: isMobile ? 12 : 14 }]}>NEW_OPERATION</Text>
          </TouchableOpacity>

          {/* Navigation Links - Compact horizontal row on mobile */}
          {isMobile ? (
            <View style={{ flexDirection: 'row', paddingHorizontal: 12, marginBottom: 12, gap: 8 }}>
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: 'rgba(0, 255, 65, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0, 255, 65, 0.3)' }}
                onPress={() => { router.push('/home'); onClose(); }}
              >
                <Home color="#00FF41" size={18} />
                <Text style={{ color: '#00FF41', fontSize: 9, fontWeight: '600', fontFamily: FONT_MONO, marginTop: 4 }}>HOME</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: 'rgba(139, 92, 246, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)' }}
                onPress={() => { router.push('/x402'); onClose(); }}
              >
                <Code color="#8B5CF6" size={18} />
                <Text style={{ color: '#8B5CF6', fontSize: 9, fontWeight: '600', fontFamily: FONT_MONO, marginTop: 4 }}>x402</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: 'rgba(255, 193, 7, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255, 193, 7, 0.3)' }}
                onPress={() => { router.push('/reputation'); onClose(); }}
              >
                <Star color="#FFC107" size={18} />
                <Text style={{ color: '#FFC107', fontSize: 9, fontWeight: '600', fontFamily: FONT_MONO, marginTop: 4 }}>RATE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: 'rgba(233, 30, 99, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(233, 30, 99, 0.3)' }}
                onPress={() => { onOpenGallery(); onClose(); }}
              >
                <ImageIcon color="#E91E63" size={18} />
                <Text style={{ color: '#E91E63', fontSize: 9, fontWeight: '600', fontFamily: FONT_MONO, marginTop: 4 }}>IMGS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, alignItems: 'center', paddingVertical: 10, backgroundColor: 'rgba(156, 163, 175, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(156, 163, 175, 0.3)' }}
                onPress={() => { router.push('/settings'); onClose(); }}
              >
                <Settings color="#9CA3AF" size={18} />
                <Text style={{ color: '#9CA3AF', fontSize: 9, fontWeight: '600', fontFamily: FONT_MONO, marginTop: 4 }}>SETTINGS</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ gap: 4, marginBottom: 8 }}>
              {/* Home Link */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(0, 255, 65, 0.1)', borderWidth: 1, borderColor: 'rgba(0, 255, 65, 0.3)', borderRadius: 6 }}
                onPress={() => { router.push('/home'); if(!isDesktop) onClose(); }}
              >
                <Home color="#00FF41" size={14} />
                <Text style={{ color: '#00FF41', fontSize: 10, fontWeight: '600', fontFamily: FONT_MONO, flex: 1 }}>HOME</Text>
                <ChevronRight color="#00FF41" size={12} />
              </TouchableOpacity>

              {/* API x402 Link */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(139, 92, 246, 0.1)', borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)', borderRadius: 6 }}
                onPress={() => { router.push('/x402'); if(!isDesktop) onClose(); }}
              >
                <Code color="#8B5CF6" size={14} />
                <Text style={{ color: '#8B5CF6', fontSize: 10, fontWeight: '600', fontFamily: FONT_MONO, flex: 1 }}>API_x402</Text>
                <ChevronRight color="#8B5CF6" size={12} />
              </TouchableOpacity>

              {/* AI Reputation Link */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(255, 193, 7, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 193, 7, 0.3)', borderRadius: 6 }}
                onPress={() => { router.push('/reputation'); if(!isDesktop) onClose(); }}
              >
                <Star color="#FFC107" size={14} />
                <Text style={{ color: '#FFC107', fontSize: 10, fontWeight: '600', fontFamily: FONT_MONO, flex: 1 }}>AI_REPUTATION</Text>
                <ChevronRight color="#FFC107" size={12} />
              </TouchableOpacity>

              {/* Image Gallery Button */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(233, 30, 99, 0.1)', borderWidth: 1, borderColor: 'rgba(233, 30, 99, 0.3)', borderRadius: 6 }}
                onPress={() => { onOpenGallery(); if(!isDesktop) onClose(); }}
              >
                <ImageIcon color="#E91E63" size={14} />
                <Text style={{ color: '#E91E63', fontSize: 10, fontWeight: '600', fontFamily: FONT_MONO, flex: 1 }}>IMG_GALLERY</Text>
                <ChevronRight color="#E91E63" size={12} />
              </TouchableOpacity>

              {/* Settings Link */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(156, 163, 175, 0.1)', borderWidth: 1, borderColor: 'rgba(156, 163, 175, 0.3)', borderRadius: 6 }}
                onPress={() => { router.push('/settings'); if(!isDesktop) onClose(); }}
              >
                <Settings color="#9CA3AF" size={14} />
                <Text style={{ color: '#9CA3AF', fontSize: 10, fontWeight: '600', fontFamily: FONT_MONO, flex: 1 }}>SETTINGS</Text>
                <ChevronRight color="#9CA3AF" size={12} />
              </TouchableOpacity>
            </View>
          )}

        {/* Conversation Search - Optimized for mobile */}
        <View style={{paddingHorizontal: isMobile ? 12 : 16, marginBottom: isMobile ? 8 : 12}}>
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: isMobile ? 6 : 8,
                backgroundColor: 'rgba(255,255,255,0.03)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.08)',
                borderRadius: 8,
                paddingHorizontal: isMobile ? 8 : 10,
                paddingVertical: isMobile ? 10 : 8
            }}>
                <Search size={isMobile ? 16 : 14} color={theme.secondary} />
                <TextInput
                    placeholder="Search chats..."
                    placeholderTextColor={theme.textMuted}
                    style={{
                        flex: 1,
                        color: theme.text,
                        fontSize: isMobile ? 14 : 12,
                        fontFamily: FONT_MONO,
                        paddingVertical: 0
                    }}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                        <X size={isMobile ? 14 : 12} color={theme.secondary} />
                    </TouchableOpacity>
                )}
            </View>
        </View>

          {/* History Section Header */}
          <View style={[styles.sectionHeader, { marginTop: isMobile ? 8 : 0, paddingHorizontal: isMobile ? 12 : 20 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={isMobile ? 14 : 12} color={theme.primary} />
                  <Text style={[styles.sectionTitle, { color: theme.secondary, fontSize: isMobile ? 12 : 10 }]}>HISTORY_LOGS</Text>
              </View>
              <View style={{
                  backgroundColor: 'rgba(0, 255, 65, 0.15)',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10
              }}>
                  <Text style={{color: theme.primary, fontSize: isMobile ? 11 : 9, fontWeight: '600', fontFamily: FONT_MONO}}>{filteredHistory.length}</Text>
              </View>
          </View>

          {/* History List - flex to fill space */}
          <View style={{ paddingHorizontal: isMobile ? 12 : 16, flex: 1, paddingBottom: 16 }}>
              {filteredHistory.length === 0 ? (
                <View style={{
                    padding: 20,
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.05)',
                    borderStyle: 'dashed'
                }}>
                    <MessageSquare size={20} color={theme.textMuted} style={{ marginBottom: 8 }} />
                    <Text style={{color: theme.secondary, fontSize: 10, fontFamily: FONT_MONO, textAlign: 'center'}}>
                        {searchQuery ? "NO_MATCHES" : "NO_CHATS_YET"}
                    </Text>
                </View>
              ) : (
                filteredHistory.map((item, index) => (
                  <View key={item.id} style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      borderRadius: 6,
                      marginBottom: 1
                  }}>
                      <TouchableOpacity
                          style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 8,
                              paddingHorizontal: 8,
                              paddingVertical: isMobile ? 10 : 8
                          }}
                          onPress={() => { router.push(`/chat/${item.id}`); if(!isDesktop) onClose(); }}
                      >
                          <MessageSquare size={12} color={theme.primary} />
                          <Text style={{color: theme.text, fontSize: isMobile ? 11 : 10, fontFamily: FONT_MONO, flex: 1}} numberOfLines={1}>
                              {item.title || "Untitled"}
                          </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                          onPress={() => confirmDelete({ id: item.id, title: item.title || "Untitled" })}
                          style={{ padding: 6 }}
                          disabled={deletingId === item.id}
                      >
                          {deletingId === item.id ? (
                              <ActivityIndicator size="small" color="#ff4444" />
                          ) : (
                              <Trash2 size={12} color="#ff4444" />
                          )}
                      </TouchableOpacity>
                  </View>
                ))
              )}
          </View>
        </ScrollView>

        {/* STICKY Wallet Section - Always visible at bottom */}
        <View style={{
            paddingHorizontal: isMobile ? 12 : 16,
            paddingBottom: isMobile ? 12 : 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.08)',
            backgroundColor: '#0a0a0a'
        }}>
          <WalletSidebarSection
            user={user}
            theme={theme}
            isConnecting={isConnecting}
            isAuthenticating={isAuthenticating}
            onConnectWallet={connectWallet}
            onLogout={logout}
            currentBalance={currentBalance}
            onAddCredits={() => { onOpenDepositModal(); if(!isDesktop) onClose(); }}
          />
          {/* Transaction History Button */}
          {user && (
            <TouchableOpacity
                onPress={openTxHistory}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 8,
                    paddingVertical: 8,
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(139, 92, 246, 0.3)'
                }}
            >
                <CreditCard size={14} color="#8B5CF6" />
                <Text style={{ color: '#8B5CF6', fontSize: 11, fontWeight: '600', fontFamily: FONT_MONO }}>
                    Transaction History
                </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Delete Confirmation Modal */}
        <Modal
            visible={deleteModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDeleteModalVisible(false)}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.85)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 24
            }}>
                <View style={{
                    backgroundColor: '#1a1a1a',
                    borderRadius: 20,
                    padding: 24,
                    width: '100%',
                    maxWidth: 320,
                    borderWidth: 1,
                    borderColor: 'rgba(255,68,68,0.3)'
                }}>
                    {/* Icon */}
                    <View style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        backgroundColor: 'rgba(255, 68, 68, 0.15)',
                        alignItems: 'center',
                        justifyContent: 'center',
                        alignSelf: 'center',
                        marginBottom: 16
                    }}>
                        <Trash2 size={28} color="#ff4444" />
                    </View>

                    {/* Title */}
                    <Text style={{
                        color: '#fff',
                        fontSize: 18,
                        fontWeight: '700',
                        textAlign: 'center',
                        marginBottom: 8
                    }}>
                        Delete Conversation?
                    </Text>

                    {/* Message */}
                    <Text style={{
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: 14,
                        textAlign: 'center',
                        marginBottom: 8,
                        lineHeight: 20
                    }}>
                        This action cannot be undone. The conversation will be permanently deleted.
                    </Text>

                    {/* Chat title */}
                    <View style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 20
                    }}>
                        <Text style={{
                            color: theme.primary,
                            fontSize: 12,
                            fontFamily: FONT_MONO,
                            textAlign: 'center'
                        }} numberOfLines={2}>
                            "{itemToDelete?.title || 'Untitled'}"
                        </Text>
                    </View>

                    {/* Buttons */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity
                            onPress={() => setDeleteModalVisible(false)}
                            style={{
                                flex: 1,
                                paddingVertical: 14,
                                borderRadius: 12,
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                alignItems: 'center'
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={executeDelete}
                            style={{
                                flex: 1,
                                paddingVertical: 14,
                                borderRadius: 12,
                                backgroundColor: '#ff4444',
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 6
                            }}
                        >
                            <Trash2 size={16} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>

        {/* Transaction History Modal - Detailed View */}
        <Modal
            visible={txHistoryVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setTxHistoryVisible(false)}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.95)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 12
            }}>
                <View style={{
                    backgroundColor: '#0d0d0d',
                    borderRadius: 20,
                    width: '100%',
                    maxWidth: 420,
                    height: height * 0.8,
                    borderWidth: 1,
                    borderColor: 'rgba(139, 92, 246, 0.4)',
                    overflow: 'hidden'
                }}>
                    {/* Header */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(255,255,255,0.08)'
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{
                                width: 40,
                                height: 40,
                                borderRadius: 12,
                                backgroundColor: 'rgba(139, 92, 246, 0.2)',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <CreditCard size={20} color="#8B5CF6" />
                            </View>
                            <View>
                                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
                                    Transaction History
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: FONT_MONO }}>
                                    Deposits & AI Usage
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => setTxHistoryVisible(false)}
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <X size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Balance Card */}
                    <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
                        <View style={{
                            backgroundColor: 'rgba(0, 255, 65, 0.1)',
                            borderRadius: 12,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: 'rgba(0, 255, 65, 0.2)',
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <View>
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontFamily: FONT_MONO, marginBottom: 2 }}>CURRENT BALANCE</Text>
                                <Text style={{ color: theme.primary, fontSize: 24, fontWeight: '800', fontFamily: FONT_MONO }}>
                                    ${(currentBalance || 0).toFixed(4)}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>
                                    {transactions.filter(t => t.type === 'deposit').length} deposits
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9 }}>
                                    {transactions.filter(t => t.type === 'usage').length} API calls
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Tab Buttons */}
                    <View style={{ flexDirection: 'row', padding: 12, gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => setTxTab('deposits')}
                            style={{
                                flex: 1,
                                paddingVertical: 12,
                                borderRadius: 10,
                                backgroundColor: txTab === 'deposits' ? '#00FF41' : 'rgba(255,255,255,0.08)',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: txTab === 'deposits' ? '#00FF41' : 'rgba(255,255,255,0.1)'
                            }}
                        >
                            <Text style={{
                                color: txTab === 'deposits' ? '#000' : '#fff',
                                fontSize: 13,
                                fontWeight: '700'
                            }}>
                                💰 Deposits ({transactions.filter(t => t.type === 'deposit').length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setTxTab('usage')}
                            style={{
                                flex: 1,
                                paddingVertical: 12,
                                borderRadius: 10,
                                backgroundColor: txTab === 'usage' ? '#8B5CF6' : 'rgba(255,255,255,0.08)',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: txTab === 'usage' ? '#8B5CF6' : 'rgba(255,255,255,0.1)'
                            }}
                        >
                            <Text style={{
                                color: txTab === 'usage' ? '#fff' : '#fff',
                                fontSize: 13,
                                fontWeight: '700'
                            }}>
                                🤖 AI Usage ({transactions.filter(t => t.type === 'usage').length})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Transaction List - Filtered by Tab */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingBottom: 16 }}
                        showsVerticalScrollIndicator={true}
                    >
                        {(() => {
                            const filteredTx = transactions.filter(t =>
                                txTab === 'deposits' ? t.type === 'deposit' : t.type === 'usage'
                            );

                            if (loadingTx) {
                                return (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading...</Text>
                                    </View>
                                );
                            }

                            if (filteredTx.length === 0) {
                                return (
                                    <View style={{ padding: 40, alignItems: 'center' }}>
                                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                                            {txTab === 'deposits' ? 'No deposits yet' : 'No AI usage yet'}
                                        </Text>
                                    </View>
                                );
                            }

                            return filteredTx.map((tx: any, idx: number) => (
                                <View key={`tx-${txTab}-${idx}`} style={{
                                    padding: 12,
                                    marginHorizontal: 8,
                                    marginVertical: 4,
                                    backgroundColor: tx.type === 'deposit' ? 'rgba(0,255,65,0.08)' : 'rgba(139,92,246,0.08)',
                                    borderRadius: 10,
                                    borderLeftWidth: 3,
                                    borderLeftColor: tx.type === 'deposit' ? '#00FF41' : '#8B5CF6'
                                }}>
                                    {tx.type === 'deposit' ? (
                                        /* Deposit Item */
                                        <>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <Text style={{ color: '#00FF41', fontSize: 16, fontWeight: '800', fontFamily: FONT_MONO }}>
                                                    +${(tx.amountUSD || 0).toFixed(4)}
                                                </Text>
                                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
                                                    {tx.amountNative ? `${parseFloat(tx.amountNative).toFixed(4)} AVAX` : ''}
                                                </Text>
                                            </View>
                                            {tx.txHash && (
                                                <TouchableOpacity
                                                    onPress={() => openTxExplorer(tx.txHash)}
                                                    style={{
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        backgroundColor: 'rgba(139,92,246,0.15)',
                                                        paddingVertical: 6,
                                                        paddingHorizontal: 10,
                                                        borderRadius: 6,
                                                        alignSelf: 'flex-start',
                                                        marginTop: 4
                                                    }}
                                                >
                                                    <Text style={{ color: '#8B5CF6', fontSize: 11, fontFamily: FONT_MONO }}>
                                                        🔗 {tx.txHash.slice(0, 8)}...{tx.txHash.slice(-6)}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 8, fontFamily: FONT_MONO }}>
                                                {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'No date'}
                                            </Text>
                                        </>
                                    ) : (
                                        /* AI Usage Item */
                                        <>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                                                    {tx.model?.split('/').pop() || 'Unknown Model'}
                                                </Text>
                                                <Text style={{ color: '#ff6b6b', fontSize: 13, fontWeight: '700', fontFamily: FONT_MONO }}>
                                                    -${(tx.amountUSD || 0).toFixed(6)}
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                                                    📥 {tx.inputTokens || 0} tokens
                                                </Text>
                                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
                                                    📤 {tx.outputTokens || 0} tokens
                                                </Text>
                                            </View>
                                            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, marginTop: 6, fontFamily: FONT_MONO }}>
                                                {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'No date'}
                                            </Text>
                                        </>
                                    )}
                                </View>
                            ));
                        })()}
                    </ScrollView>

                    {/* Footer with Add Credits */}
                    <View style={{
                        padding: 14,
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.08)',
                        backgroundColor: 'rgba(0,0,0,0.3)'
                    }}>
                        <TouchableOpacity
                            onPress={() => {
                                setTxHistoryVisible(false);
                                setTimeout(() => {
                                    if (onOpenDepositModal) {
                                        onOpenDepositModal();
                                    }
                                }, 350);
                            }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                paddingVertical: 14,
                                backgroundColor: theme.primary,
                                borderRadius: 12
                            }}
                        >
                            <Wallet size={18} color="#000" />
                            <Text style={{ color: '#000', fontSize: 14, fontWeight: '700' }}>Add Credits</Text>
                        </TouchableOpacity>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textAlign: 'center', marginTop: 8 }}>
                            Powered by Avalanche C-Chain
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
      </SafeAreaView>
    </Animated.View>
  );
};

// Generated Image Card with Download/Share buttons
const GeneratedImageCard = ({ imgUrl, idx, total, theme }: { imgUrl: string, idx: number, total: number, theme: any }) => {
    const [downloading, setDownloading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            if (Platform.OS === 'web') {
                const response = await fetch(imgUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `zeroprompt-image-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(blobUrl);
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 2000);
            } else {
                // On native, open in browser to allow user to save
                await Linking.openURL(imgUrl);
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 2000);
            }
        } catch (err) {
            console.error('Download failed:', err);
            if (Platform.OS === 'web') {
                window.open(imgUrl, '_blank');
            }
        } finally {
            setDownloading(false);
        }
    };

    const handleShare = async () => {
        if (Platform.OS === 'web') {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'ZeroPrompt Generated Image',
                        text: 'Check out this AI-generated image!',
                        url: imgUrl
                    });
                } catch (err) {
                    // User cancelled
                }
            } else {
                await navigator.clipboard.writeText(imgUrl);
                Alert.alert('Copied', 'Image URL copied to clipboard!');
            }
        } else {
            try {
                await Share.share({
                    message: `Check out this AI-generated image!\n\n${imgUrl}`,
                    url: imgUrl
                });
            } catch (err) {
                // User cancelled
            }
        }
    };

    return (
        <View style={{
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#0a0a0a',
            borderWidth: 1,
            borderColor: 'rgba(0, 255, 65, 0.2)',
            // @ts-ignore
            boxShadow: Platform.OS === 'web' ? '0 8px 32px rgba(0, 0, 0, 0.4)' : undefined
        }}>
            <Image
                source={{ uri: imgUrl }}
                style={{
                    width: '100%',
                    height: 400,
                    resizeMode: 'contain',
                    backgroundColor: '#0a0a0a'
                }}
            />
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.05)'
            }}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <PenTool size={14} color={theme.primary} />
                    <Text style={{color: theme.secondary, fontSize: 12, fontFamily: FONT_MONO}}>
                        Generated {total > 1 ? `${idx + 1}/${total}` : 'Image'}
                    </Text>
                </View>
                <View style={{flexDirection: 'row', gap: 8}}>
                    <TouchableOpacity
                        onPress={handleShare}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            backgroundColor: 'rgba(139, 92, 246, 0.15)',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: 'rgba(139, 92, 246, 0.3)'
                        }}
                    >
                        <ExternalLink size={14} color="#8B5CF6" />
                        <Text style={{color: '#8B5CF6', fontSize: 12, fontWeight: '600'}}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleDownload}
                        disabled={downloading}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            backgroundColor: showSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 255, 65, 0.15)',
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: showSuccess ? 'rgba(16, 185, 129, 0.3)' : 'rgba(0, 255, 65, 0.3)',
                            opacity: downloading ? 0.6 : 1
                        }}
                    >
                        {downloading ? (
                            <ActivityIndicator size="small" color="#00FF41" />
                        ) : showSuccess ? (
                            <Check size={14} color="#10B981" />
                        ) : (
                            <Download size={14} color="#00FF41" />
                        )}
                        <Text style={{
                            color: showSuccess ? '#10B981' : '#00FF41',
                            fontSize: 12,
                            fontWeight: '600'
                        }}>
                            {downloading ? 'Saving...' : showSuccess ? 'Saved!' : 'Download'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const ResponseContent = ({ content, reasoning, sources, theme, isLoading, attachmentType, attachmentUrl, webSearchType, generatedImages }: any) => {
    // Epic code block styles
    const markdownStyles = {
        body: {
            color: theme.text,
            fontSize: 15,
            lineHeight: 24,
            fontFamily: 'sans-serif'
        },
        heading1: {
            color: '#fff',
            fontSize: 28,
            fontWeight: '800',
            marginTop: 24,
            marginBottom: 12,
            borderBottomWidth: 2,
            borderBottomColor: 'rgba(0, 255, 65, 0.3)',
            paddingBottom: 8
        },
        heading2: {
            color: '#fff',
            fontSize: 22,
            fontWeight: '700',
            marginTop: 20,
            marginBottom: 10
        },
        heading3: {
            color: '#e0e0e0',
            fontSize: 18,
            fontWeight: '600',
            marginTop: 16,
            marginBottom: 8
        },
        paragraph: {
            marginBottom: 12,
            lineHeight: 26
        },
        code_inline: {
            backgroundColor: 'rgba(0, 255, 65, 0.15)',
            color: '#00FF41',
            fontFamily: FONT_MONO,
            fontSize: 13,
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: 'rgba(0, 255, 65, 0.25)'
        },
        code_block: {
            backgroundColor: '#0a0a0a',
            borderColor: 'rgba(0, 255, 65, 0.2)',
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            marginVertical: 12,
            overflow: 'hidden'
        },
        fence: {
            backgroundColor: '#0a0a0a',
            color: '#e0e0e0',
            fontFamily: FONT_MONO,
            fontSize: 13,
            lineHeight: 22,
            borderRadius: 12,
            padding: 16,
            marginVertical: 12,
            borderWidth: 1,
            borderColor: 'rgba(0, 255, 65, 0.2)'
        },
        blockquote: {
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderLeftWidth: 4,
            borderLeftColor: '#8B5CF6',
            paddingLeft: 16,
            paddingVertical: 8,
            marginVertical: 12,
            borderRadius: 4
        },
        list_item: {
            marginBottom: 6
        },
        bullet_list: {
            marginBottom: 12
        },
        ordered_list: {
            marginBottom: 12
        },
        link: {
            color: '#00FF41',
            textDecorationLine: 'underline'
        },
        strong: {
            fontWeight: '700',
            color: '#fff'
        },
        em: {
            fontStyle: 'italic',
            color: '#e0e0e0'
        },
        hr: {
            backgroundColor: 'rgba(255,255,255,0.1)',
            height: 1,
            marginVertical: 20
        },
        table: {
            borderWidth: 1,
            borderColor: 'rgba(0, 255, 65, 0.2)',
            borderRadius: 8,
            marginVertical: 12
        },
        thead: {
            backgroundColor: 'rgba(0, 255, 65, 0.1)'
        },
        th: {
            padding: 10,
            fontWeight: '600',
            color: '#00FF41'
        },
        td: {
            padding: 10,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.1)'
        }
    };

    // Custom rules for epic rendering
    const markdownRules = {
        image: (node: any) => (
            <View key={node.key} style={{
                marginVertical: 16,
                borderRadius: 16,
                overflow: 'hidden',
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: 'rgba(0, 255, 65, 0.2)',
                shadowColor: '#00FF41',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12
            }}>
                <Image
                    source={{uri: node.attributes.src}}
                    style={{width: '100%', aspectRatio: 1.5}}
                    resizeMode="cover"
                />
                <View style={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6
                }}>
                    <Image source={ZEROPROMPT_LOGO} style={{width: 14, height: 14}} resizeMode="contain" />
                    <Text style={{color: '#00FF41', fontSize: 10, fontFamily: FONT_MONO, fontWeight: '600'}}>AI</Text>
                </View>
            </View>
        ),
        fence: (node: any, children: any, parent: any, styles: any) => {
            const language = node.sourceInfo || 'code';
            const codeContent = node.content || '';

            return (
                <View key={node.key} style={{
                    marginVertical: 16,
                    borderRadius: 16,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: 'rgba(0, 255, 65, 0.25)',
                    shadowColor: '#00FF41',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 16
                }}>
                    {/* Code Header with Language Badge */}
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'rgba(0, 255, 65, 0.08)',
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderBottomColor: 'rgba(0, 255, 65, 0.15)'
                    }}>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                            <Code size={14} color="#00FF41" />
                            <Text style={{
                                color: '#00FF41',
                                fontSize: 11,
                                fontFamily: FONT_MONO,
                                fontWeight: '700',
                                textTransform: 'uppercase',
                                letterSpacing: 1
                            }}>
                                {language}
                            </Text>
                        </View>
                        <CopyButton content={codeContent} theme={theme} size={14} />
                    </View>
                    {/* Code Content */}
                    <View style={{
                        backgroundColor: '#050505',
                        padding: 16,
                        paddingTop: 14
                    }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Text style={{
                                color: '#e0e0e0',
                                fontFamily: FONT_MONO,
                                fontSize: 13,
                                lineHeight: 22
                            }}>
                                {codeContent}
                            </Text>
                        </ScrollView>
                    </View>
                </View>
            );
        },
        code_block: (node: any, children: any, parent: any, styles: any) => {
            const codeContent = node.content || '';

            return (
                <View key={node.key} style={{
                    marginVertical: 12,
                    borderRadius: 12,
                    overflow: 'hidden',
                    backgroundColor: '#050505',
                    borderWidth: 1,
                    borderColor: 'rgba(0, 255, 65, 0.2)'
                }}>
                    <View style={{padding: 14}}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <Text style={{
                                color: '#e0e0e0',
                                fontFamily: FONT_MONO,
                                fontSize: 13,
                                lineHeight: 20
                            }}>
                                {codeContent}
                            </Text>
                        </ScrollView>
                    </View>
                </View>
            );
        }
    };

    return (
        <View>
            <ReasoningAccordion content={reasoning} theme={theme} />

            {(attachmentType === 'video' || attachmentType === 'audio') && attachmentUrl && (
                <View style={{
                    marginVertical: 16,
                    borderRadius: 16,
                    overflow: 'hidden',
                    backgroundColor: '#000',
                    height: 300,
                    borderWidth: 1,
                    borderColor: 'rgba(0, 255, 65, 0.2)'
                }}>
                    <Video
                        style={{width: '100%', height: '100%'}}
                        source={{ uri: attachmentUrl }}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                        isLooping
                    />
                </View>
            )}

            {/* Generated Images from image generation models */}
            {generatedImages && generatedImages.length > 0 && (
                <View style={{
                    marginVertical: 16,
                    gap: 12
                }}>
                    {generatedImages.map((imgUrl: string, idx: number) => (
                        <GeneratedImageCard key={idx} imgUrl={imgUrl} idx={idx} total={generatedImages.length} theme={theme} />
                    ))}
                </View>
            )}

            {content && typeof content === 'string' && content.trim() && content.trim().length > 1 ? (
                <Markdown style={markdownStyles} rules={markdownRules}>{content}</Markdown>
            ) : content && typeof content === 'string' && content.trim().length === 1 ? (
                <Text style={{color: theme.text, fontSize: 15, lineHeight: 24}}>{content}</Text>
            ) : isLoading ? (
                <ActivityIndicator color={theme.secondary} style={{alignSelf: 'flex-start', margin: 10}} />
            ) : (
                <Text style={{color: theme.textMuted, fontStyle: 'italic', fontSize: 12}}>No content generated.</Text>
            )}
            <SourceList sources={sources} theme={theme} webSearchType={webSearchType} />
        </View>
    );
};

const ChatBubble = ({ item, theme, isSidebarOpen, allMessages }: any) => {
    const isUser = item.role === "user";
    const { width } = useWindowDimensions();
    const isDesktop = width > 1024;
    const [activeTab, setActiveTab] = useState(0);
    const [focusedModelIdx, setFocusedModelIdx] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'tabs' | 'grid'>('tabs'); // Toggle between tab view and grid view

    // Find the user message that precedes this comparison
    const userPrompt = useMemo(() => {
        if (!allMessages || item.role !== 'comparison') return null;
        const currentIndex = allMessages.findIndex((m: any) => m.id === item.id);
        if (currentIndex > 0) {
            // Look backwards for the most recent user message
            for (let i = currentIndex - 1; i >= 0; i--) {
                const msg = allMessages[i];
                if (msg.role === 'user') {
                    // User message content could be in 'content' or 'text' field
                    return msg.content || msg.text || null;
                }
            }
        }
        return null;
    }, [allMessages, item]);

    // User Message - Modern right-aligned style with copy button
    if (isUser) {
        return (
            <View style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                alignItems: 'flex-start',
                gap: 8,
                marginBottom: 16,
                paddingHorizontal: isDesktop ? 0 : 4
            }}>
                {/* Copy button - left of message */}
                <View style={{opacity: 0.6, marginTop: 8}}>
                    <CopyButton content={item.content} theme={theme} size={12} />
                </View>
                <View style={{
                    backgroundColor: 'rgba(0, 255, 65, 0.1)',
                    borderRadius: 18,
                    borderBottomRightRadius: 4,
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    maxWidth: isDesktop ? '70%' : '80%'
                }}>
                    {/* Show attached image if present */}
                    {item.attachmentUrl && item.attachmentType === 'image' && (
                        <View style={{
                            marginBottom: 10,
                            borderRadius: 12,
                            overflow: 'hidden'
                        }}>
                            <Image
                                source={{ uri: item.attachmentUrl }}
                                style={{
                                    width: 200,
                                    height: 150,
                                    borderRadius: 12
                                }}
                                resizeMode="cover"
                            />
                        </View>
                    )}
                    <Text style={{
                        color: '#fff',
                        fontSize: 15,
                        lineHeight: 22
                    }}>
                        {item.content}
                    </Text>
                </View>
            </View>
        );
    }

    // Export all responses as formatted text
    const exportAllResponses = useCallback(() => {
        if (!item.responses || item.responses.length === 0) {
            Alert.alert('No responses', 'No responses to export yet.');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let content = `# ZeroPrompt AI Comparison Results\n`;
        content += `Generated: ${new Date().toLocaleString()}\n`;
        content += `Models: ${item.responses.length}\n`;
        content += `\n${'='.repeat(60)}\n\n`;

        // Include the user's prompt/question
        if (userPrompt) {
            content += `## 📝 USER PROMPT\n`;
            content += `-`.repeat(40) + `\n\n`;
            content += userPrompt;
            content += `\n\n${'='.repeat(60)}\n\n`;
        } else {
            content += `## 📝 USER PROMPT\n`;
            content += `-`.repeat(40) + `\n\n`;
            content += `[Prompt not found]\n`;
            content += `\n${'='.repeat(60)}\n\n`;
        }

        content += `## 🤖 AI RESPONSES\n\n`;

        item.responses.forEach((res: any, idx: number) => {
            const modelName = res.modelName?.split('/').pop() || res.modelName || `Model ${idx + 1}`;
            content += `### ${idx + 1}. ${modelName}\n`;
            content += `-`.repeat(40) + `\n\n`;

            if (res.status === 'done' && res.content) {
                content += res.content;
            } else if (res.status === 'streaming') {
                content += `[Still generating...]\n${res.content || ''}`;
            } else if (res.status === 'error') {
                content += `[Error: ${res.error || 'Unknown error'}]`;
            } else {
                content += `[Pending...]`;
            }

            if (res.billing?.costUSD) {
                content += `\n\n💰 Cost: $${parseFloat(res.billing.costUSD).toFixed(6)}`;
            }

            content += `\n\n${'='.repeat(60)}\n\n`;
        });

        content += `\n---\nExported from ZeroPrompt (https://zeroprompt.app)\n`;

        // Copy to clipboard and optionally download/share
        if (Platform.OS === 'web') {
            navigator.clipboard.writeText(content);
            // Also trigger download
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zeroprompt-comparison-${timestamp}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // Mobile: Copy to clipboard and show share sheet
            Clipboard.setString(content);
            Share.share({
                message: content,
                title: 'ZeroPrompt AI Comparison'
            }).catch(() => {
                Alert.alert('Copied!', 'Comparison results copied to clipboard.');
            });
        }
    }, [item.responses, userPrompt]);

    if (item.role === 'comparison' && item.responses) {
        const responses = item.responses;
        const streamingCount = responses.filter((r: any) => r.status === 'streaming').length;
        const completedCount = responses.filter((r: any) => r.status === 'done').length;

        if (isDesktop) {
            return (
                <View style={{marginBottom: 24}}>
                    {/* Header with tabs */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 16,
                        flexWrap: 'wrap',
                        gap: 12
                    }}>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                            <Sparkles size={18} color={theme.primary} />
                            <Text style={{color: '#fff', fontSize: 15, fontWeight: '600'}}>
                                Comparing {responses.length} Models
                            </Text>
                            {streamingCount > 0 && (
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    backgroundColor: 'rgba(255, 193, 7, 0.15)',
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 12
                                }}>
                                    <ActivityIndicator size="small" color="#FFC107" />
                                    <Text style={{color: '#FFC107', fontSize: 11, fontWeight: '600'}}>{streamingCount}</Text>
                                </View>
                            )}
                        </View>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                            <Text style={{color: theme.secondary, fontSize: 12}}>
                                {completedCount}/{responses.length} complete
                            </Text>

                            {/* Export All Button */}
                            <TouchableOpacity
                                onPress={exportAllResponses}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingHorizontal: 12,
                                    paddingVertical: 6,
                                    backgroundColor: 'rgba(139, 92, 246, 0.15)',
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor: 'rgba(139, 92, 246, 0.3)'
                                }}
                            >
                                <FileText size={14} color="#8B5CF6" />
                                <Text style={{color: '#8B5CF6', fontSize: 11, fontWeight: '600', fontFamily: FONT_MONO}}>Export All</Text>
                            </TouchableOpacity>

                            {/* View Mode Toggle */}
                            <View style={{
                                flexDirection: 'row',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                borderRadius: 10,
                                padding: 3,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)'
                            }}>
                                <TouchableOpacity
                                    onPress={() => setViewMode('tabs')}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                        backgroundColor: viewMode === 'tabs' ? 'rgba(0, 255, 65, 0.2)' : 'transparent'
                                    }}
                                >
                                    <Layout size={14} color={viewMode === 'tabs' ? theme.primary : theme.secondary} />
                                    <Text style={{
                                        color: viewMode === 'tabs' ? theme.primary : theme.secondary,
                                        fontSize: 11,
                                        fontWeight: viewMode === 'tabs' ? '600' : '400',
                                        fontFamily: FONT_MONO
                                    }}>Tabs</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setViewMode('grid')}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                        backgroundColor: viewMode === 'grid' ? 'rgba(0, 255, 65, 0.2)' : 'transparent'
                                    }}
                                >
                                    <Grid size={14} color={viewMode === 'grid' ? theme.primary : theme.secondary} />
                                    <Text style={{
                                        color: viewMode === 'grid' ? theme.primary : theme.secondary,
                                        fontSize: 11,
                                        fontWeight: viewMode === 'grid' ? '600' : '400',
                                        fontFamily: FONT_MONO
                                    }}>Grid</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Grid View - All responses side by side - FULL WIDTH */}
                    {viewMode === 'grid' && (
                        // @ts-ignore - web specific CSS values
                        <View style={{
                            // Full width grid that respects viewport
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 16,
                            justifyContent: 'flex-start'
                        }}>
                                {responses.map((res: any, idx: number) => {
                                    const isStreaming = res.status === 'streaming';
                                    const isDone = res.status === 'done';
                                    const hasError = res.status === 'error';

                                    // Cards take full width / number of models, min 400px
                                    // 2 models = 50% each, 3+ models = 33% each (but scrollable)
                                    const cardWidth = responses.length === 2 ? 'calc(50% - 8px)' : responses.length === 3 ? 'calc(33.33% - 11px)' : 'calc(50% - 8px)';

                                    return (
                                        <View
                                            key={idx}
                                            // @ts-ignore - web CSS
                                            style={{
                                                width: cardWidth,
                                                minWidth: 380,
                                                backgroundColor: 'rgba(255,255,255,0.02)',
                                                borderWidth: 1,
                                                borderColor: isStreaming
                                                    ? 'rgba(255, 193, 7, 0.4)'
                                                    : isDone
                                                        ? 'rgba(0, 255, 65, 0.15)'
                                                        : hasError
                                                            ? 'rgba(255, 68, 68, 0.3)'
                                                            : 'rgba(255,255,255,0.08)',
                                                borderRadius: 16,
                                                overflow: 'hidden',
                                                maxHeight: 700,
                                                // @ts-ignore
                                                boxShadow: isStreaming
                                                    ? '0 0 20px rgba(255, 193, 7, 0.15)'
                                                    : isDone
                                                        ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                                                        : '0 4px 16px rgba(0, 0, 0, 0.2)',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            {/* Card Header */}
                                            <View style={{
                                                flexDirection: 'row',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: 12,
                                                backgroundColor: 'rgba(0,0,0,0.2)',
                                                borderBottomWidth: 1,
                                                borderBottomColor: 'rgba(255,255,255,0.05)'
                                            }}>
                                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1}}>
                                                    {/* Model Logo with status badge */}
                                                    <View style={{position: 'relative'}}>
                                                        <ModelLogo modelId={res.modelName} size={28} theme={theme} />
                                                        {/* Status badge */}
                                                        <View style={{
                                                            position: 'absolute',
                                                            bottom: -2,
                                                            right: -2,
                                                            width: 14,
                                                            height: 14,
                                                            borderRadius: 7,
                                                            backgroundColor: isDone
                                                                ? 'rgba(0, 255, 65, 0.9)'
                                                                : isStreaming
                                                                    ? 'rgba(255, 193, 7, 0.9)'
                                                                    : hasError
                                                                        ? 'rgba(255, 68, 68, 0.9)'
                                                                        : 'rgba(100,100,100,0.9)',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderWidth: 2,
                                                            borderColor: 'rgba(0,0,0,0.5)'
                                                        }}>
                                                            {isStreaming ? (
                                                                <ActivityIndicator size={8} color="#000" />
                                                            ) : isDone ? (
                                                                <Check size={8} color="#000" strokeWidth={3} />
                                                            ) : hasError ? (
                                                                <X size={8} color="#fff" strokeWidth={3} />
                                                            ) : (
                                                                <Text style={{color: '#fff', fontSize: 7, fontWeight: 'bold'}}>{idx + 1}</Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                    <Text style={{
                                                        color: '#fff',
                                                        fontWeight: '600',
                                                        fontSize: 13,
                                                        flex: 1
                                                    }} numberOfLines={1}>
                                                        {res.modelName?.split('/').pop() || res.modelName || 'Model'}
                                                    </Text>
                                                    {/* Cost Badge */}
                                                    {res.billing?.costUSD && res.status === 'done' && (
                                                        <View style={{
                                                            backgroundColor: 'rgba(0, 255, 65, 0.15)',
                                                            paddingHorizontal: 6,
                                                            paddingVertical: 2,
                                                            borderRadius: 4,
                                                            flexDirection: 'row',
                                                            alignItems: 'center',
                                                            gap: 3
                                                        }}>
                                                            <DollarSign size={10} color={theme.primary} />
                                                            <Text style={{color: theme.primary, fontSize: 10, fontWeight: '600', fontFamily: FONT_MONO}}>
                                                                {parseFloat(res.billing.costUSD).toFixed(6)}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                                                    {res.content && (
                                                        <CopyButton content={res.content} theme={theme} size={12} />
                                                    )}
                                                    <TouchableOpacity
                                                        onPress={() => setFocusedModelIdx(idx)}
                                                        style={{padding: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6}}
                                                    >
                                                        <Maximize2 size={12} color={theme.secondary} />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            {/* Card Content */}
                                            <ScrollView style={{padding: 14, maxHeight: 520}}>
                                                <ResponseContent
                                                    content={res.content}
                                                    reasoning={res.reasoning}
                                                    sources={res.sources}
                                                    theme={theme}
                                                    isLoading={isStreaming && !res.content && !res.reasoning}
                                                    attachmentUrl={res.attachmentUrl}
                                                    attachmentType={res.attachmentType}
                                                    webSearchType={res.webSearchType}
                                                    generatedImages={res.generatedImages}
                                                />
                                            </ScrollView>
                                        </View>
                                    );
                                })}
                        </View>
                    )}

                    {/* Vertical Tab Interface */}
                    {viewMode === 'tabs' && (
                    <View style={{flexDirection: 'row', gap: 16}}>
                        {/* Model Tabs - Vertical */}
                        <View style={{width: 200, gap: 8}}>
                            {responses.map((res: any, idx: number) => {
                                const isActive = activeTab === idx;
                                const isStreaming = res.status === 'streaming';
                                const isDone = res.status === 'done';
                                const hasError = res.status === 'error';

                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => setActiveTab(idx)}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: 12,
                                            borderRadius: 12,
                                            backgroundColor: isActive ? 'rgba(0, 255, 65, 0.1)' : 'rgba(255,255,255,0.02)',
                                            borderWidth: 1,
                                            borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.06)',
                                            borderLeftWidth: isActive ? 3 : 1
                                        }}
                                    >
                                        {/* Model Logo with status badge */}
                                        <View style={{position: 'relative'}}>
                                            <ModelLogo modelId={res.modelName} size={26} theme={theme} />
                                            {/* Status badge */}
                                            <View style={{
                                                position: 'absolute',
                                                bottom: -2,
                                                right: -2,
                                                width: 12,
                                                height: 12,
                                                borderRadius: 6,
                                                backgroundColor: isDone
                                                    ? 'rgba(0, 255, 65, 0.9)'
                                                    : isStreaming
                                                        ? 'rgba(255, 193, 7, 0.9)'
                                                        : hasError
                                                            ? 'rgba(255, 68, 68, 0.9)'
                                                            : 'rgba(100,100,100,0.9)',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderWidth: 2,
                                                borderColor: isActive ? 'rgba(0, 255, 65, 0.3)' : 'rgba(0,0,0,0.5)'
                                            }}>
                                                {isStreaming ? (
                                                    <ActivityIndicator size={6} color="#000" />
                                                ) : isDone ? (
                                                    <Check size={6} color="#000" strokeWidth={3} />
                                                ) : hasError ? (
                                                    <X size={6} color="#fff" strokeWidth={3} />
                                                ) : null}
                                            </View>
                                        </View>
                                        <Text
                                            style={{
                                                flex: 1,
                                                color: isActive ? '#fff' : theme.secondary,
                                                fontSize: 13,
                                                fontWeight: isActive ? '600' : '400'
                                            }}
                                            numberOfLines={1}
                                        >
                                            {res.modelName?.split('/').pop() || res.modelName || 'Model'}
                                        </Text>
                                        {/* Cost Badge in Tab */}
                                        {res.billing?.costUSD && res.status === 'done' && (
                                            <View style={{
                                                backgroundColor: 'rgba(0, 255, 65, 0.15)',
                                                paddingHorizontal: 5,
                                                paddingVertical: 2,
                                                borderRadius: 4
                                            }}>
                                                <Text style={{color: theme.primary, fontSize: 9, fontWeight: '600', fontFamily: FONT_MONO}}>
                                                    ${parseFloat(res.billing.costUSD).toFixed(6)}
                                                </Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Content Area */}
                        <View style={{
                            flex: 1,
                            backgroundColor: 'rgba(255,255,255,0.02)',
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden'
                        }}>
                            {responses[activeTab] && (
                                <>
                                    {/* Content Header */}
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: 14,
                                        borderBottomWidth: 1,
                                        borderBottomColor: 'rgba(255,255,255,0.06)',
                                        backgroundColor: 'rgba(0,0,0,0.2)'
                                    }}>
                                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                            <ModelLogo modelId={responses[activeTab].modelName} size={24} theme={theme} />
                                            <Text style={{color: '#fff', fontSize: 14, fontWeight: '600'}}>
                                                {responses[activeTab]?.modelName?.split('/').pop() || 'Model'}
                                            </Text>
                                            {/* Cost Badge in Content Header */}
                                            {responses[activeTab].billing?.costUSD && responses[activeTab].status === 'done' && (
                                                <View style={{
                                                    backgroundColor: 'rgba(0, 255, 65, 0.15)',
                                                    paddingHorizontal: 8,
                                                    paddingVertical: 3,
                                                    borderRadius: 4,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}>
                                                    <DollarSign size={12} color={theme.primary} />
                                                    <Text style={{color: theme.primary, fontSize: 11, fontWeight: '600', fontFamily: FONT_MONO}}>
                                                        {parseFloat(responses[activeTab].billing.costUSD).toFixed(6)}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                            {responses[activeTab].content && (
                                                <CopyButton content={responses[activeTab].content} theme={theme} size={14} />
                                            )}
                                            <TouchableOpacity
                                                onPress={() => setFocusedModelIdx(activeTab)}
                                                style={{padding: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6}}
                                            >
                                                <Maximize2 size={14} color={theme.secondary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    {/* Content Body */}
                                    <ScrollView style={{padding: 16, maxHeight: 500}}>
                                        <ResponseContent
                                            content={responses[activeTab].content}
                                            reasoning={responses[activeTab].reasoning}
                                            sources={responses[activeTab].sources}
                                            theme={theme}
                                            isLoading={responses[activeTab].status === 'streaming' && !responses[activeTab].content && !responses[activeTab].reasoning}
                                            attachmentUrl={responses[activeTab].attachmentUrl}
                                            attachmentType={responses[activeTab].attachmentType}
                                            webSearchType={responses[activeTab].webSearchType}
                                            generatedImages={responses[activeTab].generatedImages}
                                        />
                                    </ScrollView>
                                </>
                            )}
                        </View>
                    </View>
                    )}

                    {/* Fullscreen Modal - Epic Expanded View */}
                    <Modal visible={focusedModelIdx !== null} transparent animationType="fade">
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContent, {
                                backgroundColor: '#050505',
                                borderColor: 'rgba(0, 255, 65, 0.3)',
                                width: '98%',
                                height: '96%',
                                borderWidth: 2,
                                borderRadius: 24,
                                overflow: 'hidden',
                                shadowColor: '#00FF41',
                                shadowOffset: { width: 0, height: 0 },
                                shadowOpacity: 0.2,
                                shadowRadius: 30
                            }]}>
                                {focusedModelIdx !== null && responses[focusedModelIdx] && (
                                    <>
                                        {/* Epic Header */}
                                        <View style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 24,
                                            backgroundColor: 'rgba(0, 255, 65, 0.06)',
                                            borderBottomWidth: 1,
                                            borderBottomColor: 'rgba(0, 255, 65, 0.15)'
                                        }}>
                                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1}}>
                                                <View style={{
                                                    padding: 4,
                                                    borderRadius: 14,
                                                    borderWidth: 2,
                                                    borderColor: 'rgba(0, 255, 65, 0.3)'
                                                }}>
                                                    <ModelLogo modelId={responses[focusedModelIdx].modelName} size={36} theme={theme} />
                                                </View>
                                                <View>
                                                    <Text style={{color: '#fff', fontSize: 20, fontWeight: '800'}}>
                                                        {responses[focusedModelIdx]?.modelName?.split('/').pop() || 'Model'}
                                                    </Text>
                                                    <Text style={{color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: FONT_MONO, marginTop: 2}}>
                                                        FULL RESPONSE VIEW
                                                    </Text>
                                                </View>
                                                {/* Cost Badge in Fullscreen Modal */}
                                                {responses[focusedModelIdx].billing?.costUSD && responses[focusedModelIdx].status === 'done' && (
                                                    <View style={{
                                                        backgroundColor: 'rgba(0, 255, 65, 0.15)',
                                                        paddingHorizontal: 14,
                                                        paddingVertical: 6,
                                                        borderRadius: 10,
                                                        flexDirection: 'row',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        marginLeft: 12,
                                                        borderWidth: 1,
                                                        borderColor: 'rgba(0, 255, 65, 0.25)'
                                                    }}>
                                                        <DollarSign size={16} color="#00FF41" />
                                                        <Text style={{color: '#00FF41', fontSize: 14, fontWeight: '700', fontFamily: FONT_MONO}}>
                                                            {parseFloat(responses[focusedModelIdx].billing.costUSD).toFixed(6)}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                                                {responses[focusedModelIdx].content && (
                                                    <CopyButton content={responses[focusedModelIdx].content} theme={theme} size={18} />
                                                )}
                                                <TouchableOpacity
                                                    onPress={() => setFocusedModelIdx(null)}
                                                    style={{
                                                        padding: 12,
                                                        backgroundColor: 'rgba(255,0,0,0.1)',
                                                        borderRadius: 12,
                                                        borderWidth: 1,
                                                        borderColor: 'rgba(255,0,0,0.2)'
                                                    }}
                                                >
                                                    <X color="#ff4444" size={22} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <ScrollView
                                            contentContainerStyle={{padding: 32, paddingBottom: 80}}
                                            style={{flex: 1, backgroundColor: '#050505'}}
                                        >
                                            <ResponseContent
                                                content={responses[focusedModelIdx].content}
                                                reasoning={responses[focusedModelIdx].reasoning}
                                                sources={responses[focusedModelIdx].sources}
                                                theme={theme}
                                                attachmentUrl={responses[focusedModelIdx].attachmentUrl}
                                                attachmentType={responses[focusedModelIdx].attachmentType}
                                                webSearchType={responses[focusedModelIdx].webSearchType}
                                                generatedImages={responses[focusedModelIdx].generatedImages}
                                            />
                                        </ScrollView>
                                    </>
                                )}
                            </View>
                        </View>
                    </Modal>
                </View>
            );
        } else {
            // Mobile - Tab interface (unchanged but simplified)
            const activeRes = responses[activeTab];
            const isActiveStreaming = activeRes?.status === 'streaming';

            return (
                <View style={{marginBottom: 20}}>
                    {/* Model Pills */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 12}}>
                        <View style={{flexDirection: 'row', gap: 8, paddingVertical: 4}}>
                            {responses.map((res: any, idx: number) => {
                                const isActive = activeTab === idx;
                                const isStreaming = res.status === 'streaming';
                                const isDone = res.status === 'done';

                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => setActiveTab(idx)}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                            borderRadius: 20,
                                            backgroundColor: isActive ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255,255,255,0.05)',
                                            borderWidth: 1,
                                            borderColor: isActive ? theme.primary : 'rgba(255,255,255,0.1)'
                                        }}
                                    >
                                        <View style={{position: 'relative'}}>
                                            <ModelLogo modelId={res.modelName} size={20} theme={theme} />
                                            {/* Small status dot */}
                                            <View style={{
                                                position: 'absolute',
                                                bottom: -1,
                                                right: -1,
                                                width: 8,
                                                height: 8,
                                                borderRadius: 4,
                                                backgroundColor: isDone ? 'rgba(0, 255, 65, 0.9)' : isStreaming ? 'rgba(255, 193, 7, 0.9)' : 'rgba(100,100,100,0.9)',
                                                borderWidth: 1,
                                                borderColor: 'rgba(0,0,0,0.3)'
                                            }} />
                                        </View>
                                        <Text style={{
                                            color: isActive ? theme.primary : theme.secondary,
                                            fontSize: 12,
                                            fontWeight: isActive ? '600' : '400'
                                        }}>
                                            {(res.modelName?.split('/').pop() || 'Model').substring(0, 12)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>

                    {/* Content */}
                    <View style={{
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden'
                    }}>
                        {/* Mobile Content Header - Simplified */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: 'rgba(255,255,255,0.06)',
                            backgroundColor: 'rgba(0,0,0,0.15)'
                        }}>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0}}>
                                <ModelLogo modelId={activeRes?.modelName} size={20} theme={theme} />
                                <Text style={{color: theme.secondary, fontSize: 11, fontFamily: FONT_MONO, flex: 1}} numberOfLines={1}>
                                    {activeRes?.modelName?.split('/').pop() || 'Model'}
                                </Text>
                            </View>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0}}>
                                {/* Cost Badge */}
                                {activeRes?.billing?.costUSD && activeRes?.status === 'done' && (
                                    <View style={{
                                        backgroundColor: 'rgba(0, 255, 65, 0.15)',
                                        paddingHorizontal: 5,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 2
                                    }}>
                                        <DollarSign size={9} color={theme.primary} />
                                        <Text style={{color: theme.primary, fontSize: 9, fontWeight: '600', fontFamily: FONT_MONO}}>
                                            {parseFloat(activeRes.billing.costUSD).toFixed(4)}
                                        </Text>
                                    </View>
                                )}
                                {/* Export Button - Compact */}
                                <TouchableOpacity
                                    onPress={exportAllResponses}
                                    style={{
                                        padding: 6,
                                        backgroundColor: 'rgba(139, 92, 246, 0.15)',
                                        borderRadius: 6,
                                    }}
                                >
                                    <Download size={14} color="#8B5CF6" />
                                </TouchableOpacity>
                                {/* Copy Button */}
                                {activeRes?.content && (
                                    <CopyButton content={activeRes.content} theme={theme} size={14} />
                                )}
                            </View>
                        </View>
                        <View style={{padding: 14}}>
                            <ResponseContent
                                content={activeRes?.content}
                                reasoning={activeRes?.reasoning}
                                sources={activeRes?.sources}
                                theme={theme}
                                isLoading={isActiveStreaming && !activeRes?.content && !activeRes?.reasoning}
                                attachmentUrl={activeRes?.attachmentUrl}
                                attachmentType={activeRes?.attachmentType}
                                webSearchType={activeRes?.webSearchType}
                                generatedImages={activeRes?.generatedImages}
                            />
                        </View>
                    </View>
                </View>
            );
        }
    }

    // Regular AI response - Modern left-aligned style
    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            marginBottom: 20,
            gap: 12
        }}>
            {/* AI Avatar with Model Logo */}
            <View style={{marginTop: 2}}>
                <ModelLogo modelId={item.model} size={32} theme={theme} />
            </View>

            {/* Message Content */}
            <View style={{flex: 1}}>
                {/* Model Name + Actions */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6
                }}>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                        <Text style={{
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: '600'
                        }}>
                            {item.model?.split('/').pop() || "ZeroPrompt"}
                        </Text>
                        <Text style={{
                            color: 'rgba(255,255,255,0.3)',
                            fontSize: 11
                        }}>
                            {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </Text>
                        {/* Cost Badge for regular AI messages */}
                        {item.billing?.costUSD && (
                            <View style={{
                                backgroundColor: 'rgba(0, 255, 65, 0.15)',
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 4,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3
                            }}>
                                <DollarSign size={10} color={theme.primary} />
                                <Text style={{color: theme.primary, fontSize: 10, fontWeight: '600', fontFamily: FONT_MONO}}>
                                    {parseFloat(item.billing.costUSD).toFixed(6)}
                                </Text>
                            </View>
                        )}
                    </View>
                    {/* Copy button */}
                    {item.content && (
                        <CopyButton content={item.content} theme={theme} size={14} />
                    )}
                </View>

                {/* Response Content */}
                <ResponseContent
                    content={item.content}
                    reasoning={item.reasoning}
                    sources={item.sources}
                    theme={theme}
                    attachmentUrl={item.attachmentUrl}
                    attachmentType={item.attachmentType}
                    webSearchType={item.webSearchType}
                    generatedImages={item.generatedImages}
                />
                {/* Node Feedback for decentralized responses */}
                {item.billing?.nodeAddress != null && item.billing?.mode === 'decentralized' && (
                    <NodeFeedback operatorAddress={item.billing.nodeAddress} theme={theme} />
                )}
            </View>
        </View>
    );
};

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme, setThemeId } = useTheme();
  const {
    user, token, guestId, getHeaders,
    isConnecting, isAuthenticating, isWaitingForConnection, connectionError,
    migratedChats, clearMigratedChats,
    openWalletModal, connectWallet, refreshUser, logout,
    nativeProvider
  } = useAuth();
  const {
    currentBalance, currencySymbol, nativePrice,
    showUpsaleModal, showDepositModal, requiredCredits, isDepositing,
    openUpsaleModal, closeUpsaleModal, openDepositModal, closeDepositModal, executeDeposit,
    checkAndPromptCredits, refreshBilling
  } = useBilling();
  const { isDecentralized, subnetApiUrl, selectedNodeAddress } = useMode();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width > 1024;
  const isMobile = width < 600;
  
  const [models, setModels] = useState<Model[]>([]);
  const [filteredModels, setFilteredModels] = useState<Model[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<'all' | 'image' | 'free' | 'reasoning' | 'web'>('all');
  const [selectedModels, setSelectedModels] = useState<Model[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(isDesktop);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ uri: string; base64?: string; name?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // All models support web search via OpenRouter's plugins API
  const isWebCapable = selectedModels.length > 0;

  // Check if any selected model supports vision (image input)
  const hasVisionModel = selectedModels.some(m =>
    m.architecture?.input_modalities?.includes('image') ||
    m.openrouterId?.includes('gpt-4') || // GPT-4 variants often support vision
    m.openrouterId?.includes('claude-3') || // Claude 3 supports vision
    m.openrouterId?.includes('gemini') // Gemini supports vision
  );

  // Handle file selection for vision models - uploads through backend to avoid CORS
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(() => {
    if (Platform.OS === 'web') {
      // Create hidden file input if it doesn't exist
      if (!fileInputRef.current) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.onchange = async (e: any) => {
          const file = e.target.files?.[0];
          if (!file) return;

          setIsUploading(true);

          try {
            // Upload file through backend (avoids CORS issues with S3/Spaces)
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'vision-uploads');

            const uploadRes = await fetch(`${API_URL}/storage/upload`, {
              method: 'POST',
              body: formData
            });

            if (!uploadRes.ok) throw new Error('Failed to upload file');
            const { publicUrl } = await uploadRes.json();

            // Set the public URL as the attached image
            setAttachedImage({
              uri: publicUrl,
              base64: publicUrl, // Use URL instead of base64 data
              name: file.name
            });
          } catch (err) {
            console.error('Upload failed:', err);
            alert('Failed to upload image. Please try again.');
          } finally {
            setIsUploading(false);
          }
        };
        document.body.appendChild(input);
        fileInputRef.current = input;
      }
      fileInputRef.current.click();
    }
  }, []);

  // Clear attached image
  const clearAttachedImage = useCallback(() => {
    setAttachedImage(null);
  }, []);

  // Persistence
  useEffect(() => {
      if (Platform.OS === 'web') {
          try {
              if (selectedModels.length > 0) {
                  localStorage.setItem('selectedModels', JSON.stringify(selectedModels));
              }
          } catch(e) {}
      }
  }, [selectedModels]);

  useEffect(() => { setSidebarOpen(isDesktop); }, [isDesktop]);
  useEffect(() => {
    fetch(`${API_URL}/models`)
      .then((r) => r.json()).then((data) => {
        const loadedModels = data.models || [];
        setModels(loadedModels);
        setFilteredModels(loadedModels);
        
        // Load saved models
        if (Platform.OS === 'web') {
            try {
                const saved = localStorage.getItem('selectedModels');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const valid = parsed.filter(p => loadedModels.some((m: Model) => m.id === p.id));
                        if (valid.length > 0) {
                            setSelectedModels(valid);
                            return; // Skip default selection
                        }
                    }
                }
            } catch(e) {}
        }

        if (loadedModels.length > 0) setSelectedModels([loadedModels[0]]);
      }).catch((err) => console.error("Failed to load models:", err));
  }, []);

  useEffect(() => {
      if (params.id && (user || guestId)) {
          const id = params.id as string;
          if (id === 'new') {
              setConversationId(null);
              setMessages([]);
          } else if (id !== conversationId) {
              setConversationId(id);
              fetch(`${API_URL}/llm/history/${id}`, { headers: getHeaders() })
                .then(r => r.json())
                .then(data => { 
                    if (data.conversation?.messages) {
                        const flatMessages = data.conversation.messages;
                        const groupedMessages: ChatMessage[] = [];
                        
                        let currentGroup: ChatMessage | null = null;

                        flatMessages.forEach((msg: any) => {
                            if (msg.role === 'user') {
                                groupedMessages.push({ ...msg });
                                currentGroup = null; // Reset group on new user input
                            } else if (msg.role === 'assistant') {
                                // If it's an assistant message
                                // Check if the *previous* message in our grouped list was a user message 
                                // OR if we already have a comparison group active.
                                
                                const lastGrouped = groupedMessages[groupedMessages.length - 1];
                                
                                if (lastGrouped && lastGrouped.role === 'comparison') {
                                    // Add to existing comparison group
                                    lastGrouped.responses?.push({
                                        modelId: msg.model || 'unknown',
                                        modelName: msg.model || 'AI',
                                        content: msg.content,
                                        reasoning: msg.metadata?.reasoning || '',
                                        sources: msg.metadata?.sources || [],
                                        generatedImages: msg.metadata?.generatedImages || [],
                                        status: 'done',
                                        attachmentUrl: msg.attachmentUrl,
                                        attachmentType: msg.attachmentType
                                    });
                                } else if (lastGrouped && lastGrouped.role === 'user') {
                                    // Start a NEW comparison group
                                    const newGroup: ChatMessage = {
                                        id: msg.id + '_group',
                                        role: 'comparison',
                                        content: '',
                                        timestamp: msg.timestamp,
                                        responses: [{
                                            modelId: msg.model || 'unknown',
                                            modelName: msg.model || 'AI',
                                            content: msg.content,
                                            reasoning: msg.metadata?.reasoning || '',
                                            sources: msg.metadata?.sources || [],
                                            generatedImages: msg.metadata?.generatedImages || [],
                                            status: 'done',
                                            attachmentUrl: msg.attachmentUrl,
                                            attachmentType: msg.attachmentType
                                        }]
                                    };
                                    groupedMessages.push(newGroup);
                                } else {
                                    // Orphan assistant message (shouldn't happen often, but fallback to standard display)
                                    // Or if it follows another assistant message but we decided not to group?
                                    // Actually, if we have Ass A then Ass B, and Ass A wasn't grouped (why?),
                                    // Logic above:
                                    // 1. User -> Push User.
                                    // 2. Ass A -> Prev is User. Create Group [A]. Push Group.
                                    // 3. Ass B -> Prev is Group [A]. Add B to Group.
                                    // This logic covers it!
                                    // What if history starts with Assistant? (e.g. "Hello how can I help?")
                                    groupedMessages.push({
                                        ...msg,
                                        generatedImages: msg.metadata?.generatedImages || []
                                    });
                                }
                            } else {
                                groupedMessages.push({
                                    ...msg,
                                    generatedImages: msg.metadata?.generatedImages || []
                                });
                            }
                        });
                        setMessages(groupedMessages);
                    }
                })
                .catch(e => console.error(e));
          }
      }
  }, [params.id, user, guestId]);

  useEffect(() => { if (conversationId && params.id !== conversationId) router.setParams({ id: conversationId }); }, [conversationId]);

  useEffect(() => {
      let res = models;
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          res = res.filter(m => m.name.toLowerCase().includes(q) || m.openrouterId.toLowerCase().includes(q));
      }
      // Image Gen = can OUTPUT images (not just understand them)
      if (activeFilter === 'image') res = res.filter(m => m.architecture?.output_modalities?.includes('image'));
      else if (activeFilter === 'free') res = res.filter(m => (m.publicPricingPrompt || 0) === 0);
      else if (activeFilter === 'reasoning') res = res.filter(m => m.architecture?.is_reasoning);
      else if (activeFilter === 'web') res = res.filter(m => m.architecture?.has_web_search);
      setFilteredModels(res);
  }, [searchQuery, activeFilter, models]);

  // Auto-scroll removed - it was annoying during streaming
  // Users can scroll manually to see new content

  const toggleModelSelection = useCallback((model: Model) => {
      setSelectedModels(prev => {
          const isSelected = prev.find(m => m.id === model.id);
          if (isSelected) {
              // Keep at least one model selected
              if (prev.length > 1) {
                  return prev.filter(m => m.id !== model.id);
              }
              return prev;
          } else {
              return [...prev, model];
          }
      });
  }, []);

  // Memoize sorted models list for the selector - selected first, then unselected
  // This prevents recreating the array on every render which causes jumpy behavior
  const sortedModelsForSelector = useMemo(() => {
      const selectedIds = new Set(selectedModels.map(m => m.id));
      const selected = filteredModels.filter(m => selectedIds.has(m.id));
      const unselected = filteredModels.filter(m => !selectedIds.has(m.id));
      return [...selected, ...unselected];
  }, [filteredModels, selectedModels]);

  // Memoize the keyExtractor to prevent recreation
  const modelKeyExtractor = useCallback((m: Model) => m.id.toString(), []);

  const startNewChat = () => { 
      setMessages([]); 
      setInput(""); 
      setConversationId(null); 
      router.push('/chat/new'); 
  };
  
  const handleKeyPress = (e: any) => { if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); sendMessage(); } };

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    if (selectedModels.length === 0) return;

    // In decentralized mode, skip credit check (free)
    if (!isDecentralized) {
      // Estimate cost based on selected models (rough estimate: $0.001 per model per request)
      const estimatedCost = selectedModels.length * 0.002; // Conservative estimate

      // Check if user has enough credits
      if (!checkAndPromptCredits(estimatedCost)) {
        return; // Upsale modal will be shown
      }
    }

    let activeConvId = conversationId;

    // Initialize conversation if new (skip for decentralized - no server-side tracking)
    if (!activeConvId && !isDecentralized) {
        try {
            const res = await fetch(`${API_URL}/llm/conversations`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ title: input.trim().substring(0, 50) })
            });
            const data = await res.json();
            if (data.id) {
                activeConvId = data.id;
                setConversationId(activeConvId);
                router.setParams({ id: activeConvId });
            }
        } catch (e) {
            console.error("Failed to init conversation", e);
        }
    }

    // Build user message content - can be string or array with image
    const userContent = attachedImage?.base64
      ? [
          { type: 'text', text: input.trim() },
          { type: 'image_url', image_url: { url: attachedImage.base64 } }
        ]
      : input.trim();

    const userMsg: ChatMessage = {
      id: Date.now().toString() + "_u",
      role: "user",
      content: typeof userContent === 'string' ? userContent : input.trim(), // Display text only in UI
      timestamp: Date.now(),
      // Store image for display if present
      attachmentUrl: attachedImage?.uri,
      attachmentType: attachedImage ? 'image' : undefined
    };
    const comparisonId = Date.now().toString() + "_c";
    const comparisonMsg: ChatMessage = {
        id: comparisonId, role: 'comparison', content: '', timestamp: Date.now(),
        responses: selectedModels.map(m => ({ modelId: m.openrouterId, modelName: m.name, content: '', reasoning: '', status: 'pending' }))
    };
    setMessages([...messages, userMsg, comparisonMsg]);

    // Clear input and attached image
    const imageToSend = attachedImage?.base64; // Capture before clearing
    setInput("");
    setAttachedImage(null);
    setStreaming(true);

    // Build payload with proper content format for vision
    const payload = [...messages, { ...userMsg, content: userContent }]
      .filter(m => m.role !== 'comparison')
      .map(m => ({
        role: m.role,
        content: m.content,
        // Include image in the last user message if present
        ...(m.id === userMsg.id && imageToSend ? {} : {}) // Content already includes image
      }));

    const promises = selectedModels.map(model => streamModelResponse(model, payload, comparisonId, activeConvId));
    await Promise.all(promises);
    setStreaming(false); refreshUser();
  };

  const streamModelResponse = async (model: Model, payload: any[], comparisonId: string, overrideConversationId: string | null) => {
      updateResponse(comparisonId, model.openrouterId, { status: 'streaming' });
      try {
          const isNative = Platform.OS === 'android' || Platform.OS === 'ios';
          
          // Always use local backend - it handles decentralized routing internally
          const endpoint = `${API_URL}/llm/chat/stream`;

          // Shared stream processor
          let currentContent = ""; let currentReasoning = ""; let currentSources: string[] = [];
          let currentAttachmentUrl: string | undefined = undefined;
          let currentAttachmentType: string | undefined = undefined;
          let currentWebSearchType: 'native' | 'exa' | null = null;
          let generatedImages: string[] = [];
          let buffer = ""; // Buffer for incomplete chunks

          const processChunk = (chunk: string) => {
              buffer += chunk;
              const lines = buffer.split("\n\n");
              // Keep the last line if it might be incomplete (doesn't end with \n\n)
              // However, split separates by the delimiter. If the stream ended in the middle of a chunk, 
              // the last element is the incomplete part.
              // We need to check if the chunk ended with \n\n. 
              // Easier approach for SSE: split, process complete ones, put remainder back in buffer.
              
              buffer = lines.pop() || ""; // The last element is potentially incomplete

              for (const line of lines) {
                  const cleanLine = line.replace("data: ", "").trim();
                  if (!cleanLine || cleanLine === "[DONE]") continue;
                  try {
                      const parsed = JSON.parse(cleanLine);
                      if (parsed.conversationId && parsed.conversationId !== conversationId) {
                          setConversationId(parsed.conversationId);
                          router.setParams({ id: parsed.conversationId });
                      }
                      if (parsed.webSearchType) {
                          currentWebSearchType = parsed.webSearchType;
                          updateResponse(comparisonId, model.openrouterId, { webSearchType: currentWebSearchType });
                      }
                      if (parsed.reasoning) currentReasoning += parsed.reasoning;
                      if (parsed.sources) {
                          currentSources = [...currentSources, ...parsed.sources];
                          updateResponse(comparisonId, model.openrouterId, { sources: currentSources });
                      }
                      if (parsed.attachmentUrl) {
                          currentAttachmentUrl = parsed.attachmentUrl;
                          currentAttachmentType = parsed.attachmentType;
                          updateResponse(comparisonId, model.openrouterId, { attachmentUrl: currentAttachmentUrl, attachmentType: currentAttachmentType });
                      }
                      if (parsed.generatedImage) {
                          generatedImages.push(parsed.generatedImage);
                          updateResponse(comparisonId, model.openrouterId, { generatedImages: [...generatedImages] });
                      }
                      if (parsed.billing) {
                          updateResponse(comparisonId, model.openrouterId, { billing: parsed.billing });
                          refreshBilling();
                      }

                      const delta = parsed.choices?.[0]?.delta?.content || "";
                      if (delta) currentContent += delta;

                      if (delta || parsed.reasoning || parsed.attachmentUrl) {
                          updateResponse(comparisonId, model.openrouterId, {
                              content: currentContent,
                              reasoning: currentReasoning,
                              ...(currentAttachmentUrl && { attachmentUrl: currentAttachmentUrl }),
                              ...(currentAttachmentType && { attachmentType: currentAttachmentType })
                          });
                      }
                  } catch (e) {}
              }
          };

          // Build request body - add mode flag for decentralized routing
          const requestBody = isDecentralized
            ? JSON.stringify({
                messages: payload,
                model: model.openrouterId,
                mode: 'decentralized',
                ...(selectedNodeAddress != null ? { preferredNode: selectedNodeAddress } : {}),
              })
            : JSON.stringify({
                messages: payload,
                model: model.openrouterId,
                conversationId: overrideConversationId || conversationId,
                webSearch: webSearchEnabled,
              });
          const requestHeaders = getHeaders();

          if (isNative) {
              await fetchStream(endpoint, {
                  method: "POST",
                  headers: requestHeaders,
                  body: requestBody,
              }, (chunk) => {
                  processChunk(chunk);
              });
          } else {
              // Web implementation
              const res = await fetch(endpoint, {
                  method: "POST",
                  headers: requestHeaders,
                  body: requestBody,
              });
              
              const reader = res.body?.getReader();
              const decoder = new TextDecoder();
              if (!reader) throw new Error("No reader");

              while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                processChunk(chunk);
              }
          }
          updateResponse(comparisonId, model.openrouterId, { status: 'done' });
      } catch (err) {
          console.error('Stream error:', err);
          updateResponse(comparisonId, model.openrouterId, { status: 'error', error: 'Connection Failed' });
      }
  };

  // Throttled update system to prevent UI blocking during streaming
  const pendingUpdates = useRef<Map<string, { msgId: string; modelId: string; updates: any }>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const UPDATE_INTERVAL = 80; // Update UI at most every 80ms

  const flushUpdates = useCallback(() => {
      if (pendingUpdates.current.size === 0) return;

      const updates = new Map(pendingUpdates.current);
      pendingUpdates.current.clear();

      setMessages(prev => {
          let newMessages = [...prev];
          updates.forEach(({ msgId, modelId, updates: upd }) => {
              const idx = newMessages.findIndex(m => m.id === msgId);
              if (idx === -1) return;
              const msg = { ...newMessages[idx] };
              if (msg.responses) {
                  msg.responses = msg.responses.map(r =>
                      r.modelId === modelId ? { ...r, ...upd } : r
                  );
              }
              newMessages[idx] = msg;
          });
          return newMessages;
      });

      lastUpdateTime.current = Date.now();
  }, []);

  const updateResponse = useCallback((msgId: string, modelId: string, updates: any) => {
      const key = `${msgId}-${modelId}`;
      const existing = pendingUpdates.current.get(key);

      // Merge updates
      pendingUpdates.current.set(key, {
          msgId,
          modelId,
          updates: existing ? { ...existing.updates, ...updates } : updates
      });

      // For status changes (done/error), flush immediately
      if (updates.status === 'done' || updates.status === 'error') {
          if (updateTimeoutRef.current) {
              clearTimeout(updateTimeoutRef.current);
              updateTimeoutRef.current = null;
          }
          flushUpdates();
          return;
      }

      // Throttle content updates
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime.current;

      if (timeSinceLastUpdate >= UPDATE_INTERVAL) {
          // Enough time passed, update now
          if (updateTimeoutRef.current) {
              clearTimeout(updateTimeoutRef.current);
              updateTimeoutRef.current = null;
          }
          flushUpdates();
      } else if (!updateTimeoutRef.current) {
          // Schedule update for later
          updateTimeoutRef.current = setTimeout(() => {
              updateTimeoutRef.current = null;
              flushUpdates();
          }, UPDATE_INTERVAL - timeSinceLastUpdate);
      }
  }, [flushUpdates]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <RNStatusBar barStyle="light-content" />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} isDesktop={isDesktop} theme={theme} user={user} guestId={guestId} token={token} getHeaders={getHeaders} connectWallet={openWalletModal} startNewChat={startNewChat} isConnecting={isConnecting} isAuthenticating={isAuthenticating} router={router} currentBalance={currentBalance} logout={logout} onOpenGallery={() => setShowImageGallery(true)} onOpenDepositModal={openDepositModal} />

      {/* Overlay when sidebar is open on mobile (blocks content behind) */}
      {isSidebarOpen && !isDesktop && (
          <TouchableOpacity
              activeOpacity={1}
              onPress={() => setSidebarOpen(false)}
              style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  zIndex: 500
              }}
          />
      )}

      <View style={{flex: 1, flexDirection: 'column', overflow: 'hidden', backgroundColor: '#000'}}>
        {/* Modern Top Bar - with safe area padding for Android */}
        <View style={{
            paddingTop: Platform.OS === 'android' ? insets.top : 0,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.06)',
            backgroundColor: 'rgba(0,0,0,0.95)'
        }}>
          <View style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
          }}>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, flexShrink: 1}}>
                <TouchableOpacity
                    onPress={() => setSidebarOpen(!isSidebarOpen)}
                    style={{padding: 8, marginLeft: -8, flexDirection: 'row', alignItems: 'center', gap: 8}}
                >
                    <Image source={ZEROPROMPT_LOGO} style={{width: 28, height: 28}} resizeMode="contain" />
                    <Menu color={theme.text} size={20} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        paddingHorizontal: isMobile ? 10 : 14,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                        flex: 1,
                        flexShrink: 1,
                        maxWidth: isMobile ? 180 : 280
                    }}
                    onPress={() => setShowModelSelector(true)}
                >
                    {selectedModels.length === 1 ? (
                        <ModelLogo modelId={selectedModels[0]?.openrouterId} iconUrl={selectedModels[0]?.iconUrl} size={isMobile ? 18 : 20} theme={theme} />
                    ) : (
                        <Layers size={16} color={theme.primary} />
                    )}
                    <Text style={{color: '#fff', fontSize: isMobile ? 12 : 14, fontWeight: '600', flex: 1}} numberOfLines={1} ellipsizeMode="tail">
                        {selectedModels.length > 1 ? `${selectedModels.length} Models` : selectedModels[0]?.name?.split('/').pop() || "Select Model"}
                    </Text>
                    <ChevronDown color={theme.secondary} size={16} />
                </TouchableOpacity>
             </View>
             <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0}}>
                <TouchableOpacity
                    onPress={() => router.push('/settings')}
                    style={{ padding: 8 }}
                >
                    <Settings size={20} color={theme.textSecondary || 'rgba(255,255,255,0.5)'} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={startNewChat}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                        backgroundColor: 'rgba(0, 255, 65, 0.1)',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 8
                    }}
                >
                    <Plus size={16} color={theme.primary} />
                    <Text style={{color: theme.primary, fontSize: 13, fontWeight: '600'}}>New</Text>
                </TouchableOpacity>
             </View>
          </View>
        </View>

        {/* Chat Container - Centered like ChatGPT */}
        <View style={{flex: 1, alignItems: 'center'}}>
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                style={{width: '100%'}}
                contentContainerStyle={{
                    paddingVertical: isMobile ? 16 : 24,
                    paddingHorizontal: isMobile ? 10 : 16,
                    maxWidth: isDesktop ? 900 : '100%',
                    alignSelf: 'center',
                    width: '100%'
                }}
                renderItem={({ item }) => <ChatBubble item={item} theme={theme} isSidebarOpen={isSidebarOpen} allMessages={messages} />}
                ListEmptyComponent={
                    <View style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingTop: isDesktop ? 120 : (isMobile ? 40 : 80),
                        paddingHorizontal: isMobile ? 20 : 32
                    }}>
                        <View style={{
                            width: isMobile ? 60 : 80,
                            height: isMobile ? 60 : 80,
                            borderRadius: isMobile ? 16 : 20,
                            backgroundColor: 'rgba(0, 255, 65, 0.1)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: isMobile ? 16 : 24
                        }}>
                            <Sparkles size={isMobile ? 30 : 40} color={theme.primary} />
                        </View>
                        <Text style={{
                            color: '#fff',
                            fontSize: isMobile ? 20 : 26,
                            fontWeight: 'bold',
                            marginBottom: isMobile ? 8 : 12,
                            textAlign: 'center'
                        }}>
                            How can I help you?
                        </Text>
                        <Text style={{
                            color: theme.secondary,
                            fontSize: isMobile ? 13 : 15,
                            textAlign: 'center',
                            lineHeight: isMobile ? 20 : 22,
                            maxWidth: 400
                        }}>
                            Ask me anything. I can help with coding, writing, analysis, and more.
                        </Text>

                        {/* Quick Actions - Hide detailed text on mobile */}
                        <View style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                            gap: isMobile ? 8 : 10,
                            marginTop: isMobile ? 24 : 32
                        }}>
                            {[
                                {icon: Globe, text: isMobile ? 'Web' : 'Search the web', action: () => setWebSearchEnabled(true)},
                                {icon: Brain, text: isMobile ? 'Explain' : 'Explain a concept'},
                                {icon: FileText, text: isMobile ? 'Write' : 'Write content'},
                            ].map((item, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={item.action}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: isMobile ? 6 : 8,
                                        backgroundColor: 'rgba(255,255,255,0.03)',
                                        borderWidth: 1,
                                        borderColor: 'rgba(255,255,255,0.08)',
                                        paddingHorizontal: isMobile ? 12 : 16,
                                        paddingVertical: isMobile ? 10 : 12,
                                        borderRadius: 12
                                    }}
                                >
                                    <item.icon size={isMobile ? 14 : 16} color={theme.secondary} />
                                    <Text style={{color: theme.secondary, fontSize: isMobile ? 12 : 13}}>{item.text}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                }
            />
        </View>

        {/* Epic Input Area - Clean, minimal, no border on focus */}
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={{
                paddingHorizontal: isDesktop ? 24 : 16,
                paddingTop: 16,
                paddingBottom: 24,
                alignItems: 'center',
                backgroundColor: 'transparent'
            }}>
                <View style={{
                    width: '100%',
                    maxWidth: isDesktop ? 800 : '100%',
                    backgroundColor: 'rgba(30, 30, 30, 0.95)',
                    borderRadius: 28,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    // @ts-ignore - web shadow
                    boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)'
                }}>
                    {/* Attached Image Preview */}
                    {attachedImage && (
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 12,
                            paddingTop: 12,
                            paddingBottom: 8,
                            gap: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: 'rgba(255,255,255,0.04)'
                        }}>
                            <View style={{
                                position: 'relative',
                                borderRadius: 12,
                                overflow: 'hidden',
                                borderWidth: 1,
                                borderColor: 'rgba(0, 255, 65, 0.3)'
                            }}>
                                <Image
                                    source={{ uri: attachedImage.uri }}
                                    style={{ width: 60, height: 60, borderRadius: 11 }}
                                    resizeMode="cover"
                                />
                                <TouchableOpacity
                                    onPress={clearAttachedImage}
                                    style={{
                                        position: 'absolute',
                                        top: -6,
                                        right: -6,
                                        width: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        backgroundColor: '#ef4444',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 2,
                                        borderColor: '#1e1e1e'
                                    }}
                                >
                                    <X size={10} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>
                                    Image attached
                                </Text>
                                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                                    {attachedImage.name || 'Ready to send with your message'}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Top row - Input */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        paddingHorizontal: 16,
                        paddingTop: attachedImage ? 10 : 14,
                        paddingBottom: 14,
                        gap: 12
                    }}>
                        <TextInput
                            style={{
                                flex: 1,
                                color: theme.text,
                                fontSize: 16,
                                lineHeight: 24,
                                minHeight: 28,
                                maxHeight: 200,
                                paddingVertical: 0,
                                fontFamily: Platform.OS === 'web' ? 'system-ui, -apple-system, sans-serif' : undefined,
                                // @ts-ignore - remove outline on web
                                outlineStyle: 'none',
                                outlineWidth: 0
                            }}
                            placeholder="Ask anything..."
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            multiline
                            value={input}
                            onChangeText={setInput}
                            onKeyPress={(e: any) => {
                                // Shift+Enter = new line, Enter = send
                                if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter') {
                                    if (e.nativeEvent.shiftKey) {
                                        // Allow default behavior (new line)
                                        return;
                                    }
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            blurOnSubmit={false}
                        />

                        {/* Send Button */}
                        <TouchableOpacity
                            onPress={sendMessage}
                            disabled={!input.trim() || streaming}
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: input.trim() && !streaming ? theme.primary : 'rgba(255,255,255,0.06)',
                                alignItems: 'center',
                                justifyContent: 'center',
                                // @ts-ignore
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {streaming ? (
                                <ActivityIndicator color="#000" size={16} />
                            ) : (
                                <Send size={16} color={input.trim() ? '#000' : 'rgba(255,255,255,0.3)'} />
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Bottom row - Actions */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 12,
                        paddingBottom: 10,
                        paddingTop: 2,
                        gap: 4,
                        borderTopWidth: 1,
                        borderTopColor: 'rgba(255,255,255,0.04)'
                    }}>
                        {/* Web Search Toggle */}
                        <TouchableOpacity
                            onPress={() => setWebSearchEnabled(!webSearchEnabled)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 16,
                                backgroundColor: webSearchEnabled ? 'rgba(0, 255, 65, 0.12)' : 'transparent'
                            }}
                        >
                            <Globe size={16} color={webSearchEnabled ? theme.primary : 'rgba(255,255,255,0.4)'} />
                            <Text style={{
                                color: webSearchEnabled ? theme.primary : 'rgba(255,255,255,0.4)',
                                fontSize: 13,
                                fontWeight: webSearchEnabled ? '600' : '400'
                            }}>Search</Text>
                        </TouchableOpacity>

                        {/* Attach Image Button - Only show if vision model selected */}
                        {hasVisionModel && (
                            <TouchableOpacity
                                onPress={handleFileSelect}
                                disabled={isUploading}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 16,
                                    backgroundColor: attachedImage ? 'rgba(0, 255, 65, 0.12)' : 'transparent',
                                    opacity: isUploading ? 0.5 : 1
                                }}
                            >
                                {isUploading ? (
                                    <ActivityIndicator size="small" color={theme.primary} />
                                ) : (
                                    <ImageIcon size={16} color={attachedImage ? theme.primary : 'rgba(255,255,255,0.4)'} />
                                )}
                                <Text style={{
                                    color: attachedImage ? theme.primary : 'rgba(255,255,255,0.4)',
                                    fontSize: 13,
                                    fontWeight: attachedImage ? '600' : '400'
                                }}>{isUploading ? 'Uploading...' : 'Image'}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Model Selector Quick Button */}
                        <TouchableOpacity
                            onPress={() => setShowModelSelector(true)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: isMobile ? 8 : 12,
                                paddingVertical: 8,
                                borderRadius: 16,
                                backgroundColor: 'transparent',
                                maxWidth: isMobile ? 140 : 200
                            }}
                        >
                            {selectedModels.length === 1 ? (
                                <ModelLogo modelId={selectedModels[0]?.openrouterId} iconUrl={selectedModels[0]?.iconUrl} size={16} theme={theme} />
                            ) : (
                                <Layers size={16} color="rgba(255,255,255,0.4)" />
                            )}
                            <Text style={{
                                color: 'rgba(255,255,255,0.5)',
                                fontSize: isMobile ? 11 : 13,
                                flex: 1
                            }} numberOfLines={1} ellipsizeMode="tail">
                                {selectedModels.length > 1 ? `${selectedModels.length} models` : selectedModels[0]?.name?.split('/').pop() || 'Select'}
                            </Text>
                            <ChevronDown size={14} color="rgba(255,255,255,0.3)" />
                        </TouchableOpacity>

                        {/* Decentralized mode badge */}
                        {isDecentralized && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3,
                                backgroundColor: 'rgba(76, 175, 80, 0.15)',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 8,
                            }}>
                                <Cpu size={12} color="#4CAF50" />
                                <Text style={{ color: '#4CAF50', fontSize: 10, fontWeight: '700' }}>FREE</Text>
                            </View>
                        )}

                        {/* Pinned node indicator */}
                        {isDecentralized && selectedNodeAddress !== null && (
                            <TouchableOpacity
                                onPress={() => router.push('/network')}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4,
                                    backgroundColor: 'rgba(33, 150, 243, 0.2)',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                }}
                            >
                                <Server size={11} color="#2196F3" />
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{selectedNodeAddress?.slice(0, 6)}...{selectedNodeAddress?.slice(-4)}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Spacer */}
                        <View style={{flex: 1}} />

                        {/* Hint */}
                        <Text style={{
                            color: 'rgba(255,255,255,0.2)',
                            fontSize: 11,
                            marginRight: 8
                        }}>
                            Shift+Enter for new line
                        </Text>
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
      </View>

      {/* Model Selector Modal - New Design */}
      <ModelSelectorModal
          visible={showModelSelector}
          onClose={() => setShowModelSelector(false)}
          models={models}
          selectedModels={selectedModels}
          onToggleModel={toggleModelSelection}
          theme={theme}
      />

      {/* Image Gallery Modal */}
      <ImageGalleryModal
          visible={showImageGallery}
          onClose={() => setShowImageGallery(false)}
          theme={theme}
          getHeaders={getHeaders}
          onNavigateToChat={(id) => router.push(`/chat/${id}`)}
      />

      {/* Upsale Modal (Legacy) */}
      <UpsaleModal
        visible={showUpsaleModal}
        onClose={closeUpsaleModal}
        onConnectWallet={openWalletModal}
        onDeposit={executeDeposit}
        theme={theme}
        isWalletConnected={!!user?.walletAddress}
        currentBalance={(currentBalance || 0).toFixed(6)}
        nativePrice={nativePrice}
        currencySymbol={currencySymbol}
        isDepositing={isDepositing}
        requiredAmount={requiredCredits || undefined}
      />

      {/* Gasless Deposit Modal (Gas Sponsored!) */}
      <DepositModal
        visible={showDepositModal}
        onClose={closeDepositModal}
        theme={theme}
        vaultAddress={VAULT_ADDRESS}
        userAddress={user?.walletAddress}
        requiredAmount={requiredCredits || undefined}
        onRefreshBalance={refreshBilling}
        onSuccess={(txHash) => {
          console.log('[DepositModal] Success:', txHash);
        }}
        // Native wallet data
        walletAddress={user?.walletAddress}
        isWalletConnected={!!user?.walletAddress}
        onConnectWallet={openWalletModal}
        nativeProvider={nativeProvider}
        connectionError={connectionError}
        isWaitingForConnection={isWaitingForConnection}
      />

      {/* Wallet Connection Modal - Shows during wallet connection/signing */}
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

      {/* Migration Success Banner */}
      {migratedChats !== null && migratedChats > 0 && (
        <MigrationBanner
          count={migratedChats}
          theme={theme}
          onDismiss={clearMigratedChats}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row' },
  sidebar: { paddingVertical: 20 },
  sidebarHeader: { paddingHorizontal: 20, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontWeight: '900', fontSize: 18, letterSpacing: 1, fontFamily: FONT_MONO },
  closeBtn: { padding: 4 },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, padding: 12, borderRadius: 8, gap: 8, marginBottom: 24 },
  newChatText: { fontWeight: 'bold', fontSize: 14, fontFamily: FONT_MONO },
  sectionHeader: { paddingHorizontal: 20, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1, fontFamily: FONT_MONO },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  userCard: { padding: 16, borderTopWidth: 1 },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  walletIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  walletTitle: { fontWeight: 'bold', fontSize: 14, fontFamily: FONT_MONO },
  walletSub: { fontSize: 10, fontFamily: FONT_MONO },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00ff41', position: 'absolute', top: 0, right: 0 },
  limitBar: { height: 4, borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  limitProgress: { height: '100%' },
  topBar: { height: 60, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  modelButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  modelBtnText: { fontSize: 14, fontWeight: '600', fontFamily: FONT_MONO },
  topBarRight: { flexDirection: 'row', alignItems: 'center' },
  chatList: { padding: 20, paddingBottom: 40 },
  msgRow: { flexDirection: 'row', marginBottom: 24, gap: 12, width: '100%' },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAi: { justifyContent: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginTop: 4 },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: 16 },
  msgText: { fontSize: 16, lineHeight: 24, fontFamily: 'sans-serif' },
  aiMetaRow: { flexDirection: 'row', gap: 8, marginBottom: 4, alignItems: 'center' },
  modelBadge: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', fontFamily: FONT_MONO },
  aiActions: { flexDirection: 'row', gap: 12, marginTop: 8, opacity: 0.6 },
  actionIcon: { padding: 4 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 80, paddingHorizontal: 32 },
  logoPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 24 },
  emptyTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
  emptySub: { textAlign: 'center', lineHeight: 20 },
  quickPrompts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 32 },
  promptChip: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  inputArea: { padding: 16, borderTopWidth: 1 },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderRadius: 12, padding: 8, gap: 8 },
  attachBtn: { padding: 10 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, fontSize: 16, paddingTop: 10, paddingBottom: 10 },
  sendBtn: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxWidth: 400, borderWidth: 1, borderRadius: 16, padding: 20, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  modelCard: { padding: 16, borderWidth: 1, borderRadius: 12 },
  modelCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  modelName: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: 'bold', fontFamily: FONT_MONO },
  priceRow: { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8, marginTop: 4 }
});