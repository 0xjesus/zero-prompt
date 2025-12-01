import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Platform,
    useWindowDimensions,
    Image
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    ArrowLeft, ArrowRight, Book, Wallet, MessageSquare, Shield,
    Code, Globe, Brain, Eye, PenTool, HelpCircle, ChevronRight,
    Terminal, Layers, CreditCard, Key, Settings, Users, Sparkles, Rocket
} from 'lucide-react-native';

const ZEROPROMPT_LOGO = require('../assets/logos/zero-prompt-logo.png');

// ============================================================================
// DESIGN SYSTEM
// ============================================================================
const COLORS = {
    neonGreen: '#00FF41',
    neonGreenSoft: 'rgba(0, 255, 65, 0.15)',
    electricBlue: '#00D4FF',
    cyberPurple: '#8B5CF6',
    hotPink: '#E91E63',
    orange: '#FF9800',
    bgPrimary: '#000000',
    bgSecondary: '#0A0A0A',
    bgTertiary: '#111111',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textMuted: '#666666',
};

const FONT_MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// ============================================================================
// DOC SECTIONS
// ============================================================================

type DocSection = {
    id: string;
    title: string;
    icon: any;
    color: string;
    items: {
        title: string;
        description: string;
        content: string[];
    }[];
};

const DOC_SECTIONS: DocSection[] = [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: Rocket,
        color: COLORS.neonGreen,
        items: [
            {
                title: 'Quick Start',
                description: 'Get up and running in under 2 minutes',
                content: [
                    '1. Visit ZeroPrompt and click "Launch App"',
                    '2. Select a model from the model selector (try a FREE model first)',
                    '3. Type your message and hit send',
                    '4. That\'s it! No account required for free models'
                ]
            },
            {
                title: 'Connecting Your Wallet',
                description: 'Access premium models with crypto',
                content: [
                    '1. Click the wallet icon in the top right',
                    '2. Choose MetaMask or Coinbase Wallet',
                    '3. Approve the connection request',
                    '4. Make sure you have AVAX on Avalanche C-Chain',
                    '5. You\'re ready to use premium models!'
                ]
            },
            {
                title: 'Choosing a Model',
                description: 'How to pick the right AI for your task',
                content: [
                    '- Chat Models: General conversation, coding, writing',
                    '- Thinking Models: Complex reasoning, math, analysis',
                    '- Vision Models: Image understanding and analysis',
                    '- Image Gen: Create images from text descriptions',
                    '- Web Search: Real-time information from the internet'
                ]
            }
        ]
    },
    {
        id: 'models',
        title: 'AI Models',
        icon: Brain,
        color: COLORS.cyberPurple,
        items: [
            {
                title: 'Model Categories',
                description: 'Understanding different AI capabilities',
                content: [
                    'CHAT MODELS',
                    '- GPT-4, GPT-4 Turbo: Best for complex tasks',
                    '- Claude 3.5 Sonnet: Great for writing and analysis',
                    '- Gemini Pro: Google\'s flagship model',
                    '- Llama 3.1: Open source powerhouse',
                    '',
                    'THINKING MODELS',
                    '- o1, o3: OpenAI\'s reasoning models',
                    '- DeepSeek R1: Open source reasoning',
                    '- Shows chain of thought before answering',
                    '',
                    'IMAGE GENERATION',
                    '- DALL-E 3: OpenAI\'s image model',
                    '- Stable Diffusion: Various versions',
                    '- Flux: High quality generations'
                ]
            },
            {
                title: 'Model Comparison',
                description: 'Compare multiple models at once',
                content: [
                    '1. Select multiple models using the model picker',
                    '2. Send your message',
                    '3. See all responses side by side',
                    '4. Switch between tab view and grid view',
                    '5. Find the best model for your use case'
                ]
            },
            {
                title: 'Free Models',
                description: 'Models you can use without payment',
                content: [
                    'Free models have $0.00 pricing and require no wallet.',
                    '',
                    'Popular free models include:',
                    '- Llama 3.1 variants',
                    '- Mistral models',
                    '- Various community models',
                    '',
                    'Look for the green "FREE" badge in the model selector.'
                ]
            }
        ]
    },
    {
        id: 'billing',
        title: 'Billing & Payments',
        icon: CreditCard,
        color: COLORS.electricBlue,
        items: [
            {
                title: 'Pay-Per-Query Pricing',
                description: 'Only pay for what you use',
                content: [
                    'ZeroPrompt uses pay-per-query pricing:',
                    '',
                    '- No subscriptions or monthly fees',
                    '- Pay only when you use premium models',
                    '- Transparent per-token pricing',
                    '- Prices shown before you send each message',
                    '',
                    'Pricing is based on:',
                    '- Input tokens (your message)',
                    '- Output tokens (AI response)',
                    '- Model-specific rates'
                ]
            },
            {
                title: 'Adding Funds',
                description: 'How to fund your account',
                content: [
                    '1. Connect your wallet (MetaMask/Coinbase)',
                    '2. Ensure you\'re on Avalanche C-Chain',
                    '3. Your AVAX balance is your credit',
                    '4. We deduct costs in real-time as you use models',
                    '',
                    'Minimum balance: ~$0.01 to start',
                    'No maximum limit'
                ]
            },
            {
                title: 'Understanding Costs',
                description: 'How pricing works',
                content: [
                    'Token-based pricing:',
                    '- 1 token ~ 0.75 words (English)',
                    '- 1000 tokens ~ 750 words',
                    '',
                    'Example costs (approximate):',
                    '- Simple question: $0.001 - $0.01',
                    '- Long conversation: $0.05 - $0.20',
                    '- Image generation: $0.02 - $0.10',
                    '',
                    'Free models = $0.00 always'
                ]
            }
        ]
    },
    {
        id: 'privacy',
        title: 'Privacy & Security',
        icon: Shield,
        color: '#4CAF50',
        items: [
            {
                title: 'Data Privacy',
                description: 'Your data, your control',
                content: [
                    'ZeroPrompt takes privacy seriously:',
                    '',
                    '- No prompt storage: Your messages aren\'t saved',
                    '- No training: Your data never trains AI models',
                    '- Session-only: Conversations exist only in browser',
                    '- No accounts: Use without providing personal info',
                    '',
                    'We only store:',
                    '- Wallet address (for billing)',
                    '- Token usage (for billing)',
                    '- Nothing else'
                ]
            },
            {
                title: 'Web3 Security',
                description: 'How blockchain protects you',
                content: [
                    'Wallet-based authentication:',
                    '- No passwords to hack',
                    '- You control your identity',
                    '- Transparent on-chain billing',
                    '',
                    'We never:',
                    '- Request private keys',
                    '- Ask for seed phrases',
                    '- Auto-approve transactions',
                    '',
                    'Always verify transaction details in your wallet.'
                ]
            }
        ]
    },
    {
        id: 'features',
        title: 'Features',
        icon: Sparkles,
        color: COLORS.hotPink,
        items: [
            {
                title: 'Web Search',
                description: 'Real-time information',
                content: [
                    'Enable web search to get current information:',
                    '',
                    '1. Click the "Web" toggle in the input area',
                    '2. Ask questions about current events',
                    '3. AI will search and cite sources',
                    '',
                    'Great for:',
                    '- News and current events',
                    '- Latest documentation',
                    '- Real-time data'
                ]
            },
            {
                title: 'Image Upload (Vision)',
                description: 'Analyze images with AI',
                content: [
                    'Vision-capable models can analyze images:',
                    '',
                    '1. Select a vision model (GPT-4V, Claude 3, etc.)',
                    '2. Click the image attachment button',
                    '3. Upload your image',
                    '4. Ask questions about it',
                    '',
                    'Use cases:',
                    '- OCR and text extraction',
                    '- Image description',
                    '- Chart/graph analysis',
                    '- Code screenshot debugging'
                ]
            },
            {
                title: 'Image Generation',
                description: 'Create images from text',
                content: [
                    'Generate images with AI:',
                    '',
                    '1. Select an image generation model',
                    '2. Describe what you want to create',
                    '3. Wait for generation (10-30 seconds)',
                    '4. Download or open full size',
                    '',
                    'Tips:',
                    '- Be specific in descriptions',
                    '- Include style references',
                    '- Mention lighting and mood'
                ]
            },
            {
                title: 'Thinking Models',
                description: 'Watch AI reason step by step',
                content: [
                    'Thinking models show their reasoning:',
                    '',
                    '- Expand "Reasoning" to see thought process',
                    '- Better for math and logic problems',
                    '- May take longer to respond',
                    '- Higher accuracy on complex tasks',
                    '',
                    'Models: o1, o3, DeepSeek R1'
                ]
            }
        ]
    },
    {
        id: 'faq',
        title: 'FAQ',
        icon: HelpCircle,
        color: COLORS.orange,
        items: [
            {
                title: 'Do I need a crypto wallet?',
                description: '',
                content: [
                    'No! You can use free models without any wallet.',
                    '',
                    'A wallet is only needed if you want to:',
                    '- Use premium/paid models',
                    '- Access models like GPT-4, Claude 3.5',
                    '',
                    'Supported wallets: MetaMask, Coinbase Wallet'
                ]
            },
            {
                title: 'Which blockchain do you use?',
                description: '',
                content: [
                    'Avalanche C-Chain',
                    '',
                    'Why Avalanche?',
                    '- Fast finality (sub-second)',
                    '- Low transaction fees',
                    '- EVM compatible (works with MetaMask)',
                    '',
                    'Make sure your wallet is on Avalanche network.'
                ]
            },
            {
                title: 'Why are some models free?',
                description: '',
                content: [
                    'Some model providers offer free tiers:',
                    '',
                    '- Open source models (Llama, Mistral)',
                    '- Provider promotional offers',
                    '- Community-hosted models',
                    '',
                    'We pass these savings directly to you.',
                    'No markup on free models.'
                ]
            },
            {
                title: 'Is my data private?',
                description: '',
                content: [
                    'Yes. We don\'t store your conversations.',
                    '',
                    '- Messages exist only in your browser session',
                    '- No server-side logging of prompts',
                    '- No training on your data',
                    '- Clear your browser = conversations gone',
                    '',
                    'We only track usage for billing purposes.'
                ]
            },
            {
                title: 'Can I compare models?',
                description: '',
                content: [
                    'Yes! Multi-model comparison is a key feature:',
                    '',
                    '1. Click the model selector',
                    '2. Check multiple models',
                    '3. Send your message once',
                    '4. See all responses side by side',
                    '',
                    'Great for finding the best model for your needs.'
                ]
            }
        ]
    }
];

// ============================================================================
// COMPONENTS
// ============================================================================

const DocCard = ({
    item,
    onPress
}: {
    item: { title: string; description: string; content: string[] };
    onPress: () => void;
}) => (
    <TouchableOpacity
        onPress={onPress}
        style={{
            backgroundColor: COLORS.bgTertiary,
            borderRadius: 12,
            padding: 20,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)'
        }}
        activeOpacity={0.7}
    >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
                <Text style={{
                    color: COLORS.textPrimary,
                    fontSize: 16,
                    fontWeight: '600',
                    marginBottom: item.description ? 6 : 0
                }}>{item.title}</Text>
                {item.description && (
                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>{item.description}</Text>
                )}
            </View>
            <ChevronRight size={20} color={COLORS.textMuted} />
        </View>
    </TouchableOpacity>
);

const DocContent = ({
    item,
    onBack
}: {
    item: { title: string; description: string; content: string[] };
    onBack: () => void;
}) => (
    <View>
        <TouchableOpacity
            onPress={onBack}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 24
            }}
        >
            <ArrowLeft size={18} color={COLORS.textSecondary} />
            <Text style={{ color: COLORS.textSecondary }}>Back</Text>
        </TouchableOpacity>

        <Text style={{
            color: COLORS.textPrimary,
            fontSize: 28,
            fontWeight: '800',
            marginBottom: 12
        }}>{item.title}</Text>

        {item.description && (
            <Text style={{
                color: COLORS.textSecondary,
                fontSize: 16,
                marginBottom: 32
            }}>{item.description}</Text>
        )}

        <View style={{
            backgroundColor: COLORS.bgTertiary,
            borderRadius: 16,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)'
        }}>
            {item.content.map((line, idx) => (
                <Text
                    key={idx}
                    style={{
                        color: line === '' ? 'transparent' : line.startsWith('-') ? COLORS.textSecondary : COLORS.textPrimary,
                        fontSize: 15,
                        lineHeight: 26,
                        marginBottom: line === '' ? 12 : 4,
                        fontFamily: line.match(/^\d\./) ? FONT_MONO : undefined,
                        fontWeight: line === line.toUpperCase() && line.length > 3 ? '700' : '400'
                    }}
                >
                    {line || ' '}
                </Text>
            ))}
        </View>
    </View>
);

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function DocsPage() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width > 1024;
    const isTablet = width > 768;

    const [activeSection, setActiveSection] = useState<string | null>(null);
    const [activeItem, setActiveItem] = useState<{ title: string; description: string; content: string[] } | null>(null);

    const currentSection = DOC_SECTIONS.find(s => s.id === activeSection);
    const containerPadding = isDesktop ? 80 : isTablet ? 40 : 20;

    return (
        <ScrollView style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
            {/* Header */}
            <View style={{
                paddingHorizontal: containerPadding,
                paddingTop: 20,
                paddingBottom: 40
            }}>
                {/* Navigation */}
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 48
                }}>
                    <TouchableOpacity
                        onPress={() => router.push('/home')}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                    >
                        <ArrowLeft size={20} color={COLORS.textSecondary} />
                        <Text style={{ color: COLORS.textSecondary }}>Back</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/chat/new')}
                        style={{
                            backgroundColor: COLORS.neonGreen,
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            borderRadius: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <Text style={{ color: '#000', fontWeight: '700' }}>Try It Now</Text>
                        <ArrowRight size={16} color="#000" />
                    </TouchableOpacity>
                </View>

                {/* Title */}
                {!activeSection && (
                    <View style={{ alignItems: 'center', marginBottom: 48 }}>
                        <View style={{
                            backgroundColor: COLORS.neonGreenSoft,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            borderRadius: 20,
                            marginBottom: 20
                        }}>
                            <Text style={{
                                color: COLORS.neonGreen,
                                fontSize: 12,
                                fontWeight: '700',
                                letterSpacing: 2,
                                fontFamily: FONT_MONO
                            }}>DOCUMENTATION</Text>
                        </View>

                        <Text style={{
                            color: COLORS.textPrimary,
                            fontSize: isDesktop ? 48 : 36,
                            fontWeight: '900',
                            textAlign: 'center',
                            marginBottom: 16
                        }}>
                            Learn ZeroPrompt
                        </Text>

                        <Text style={{
                            color: COLORS.textSecondary,
                            fontSize: 18,
                            textAlign: 'center',
                            maxWidth: 600
                        }}>
                            Everything you need to know about using ZeroPrompt,
                            from getting started to advanced features.
                        </Text>
                    </View>
                )}
            </View>

            {/* Content */}
            <View style={{
                paddingHorizontal: containerPadding,
                paddingBottom: 80,
                maxWidth: 900,
                alignSelf: 'center',
                width: '100%'
            }}>
                {activeItem ? (
                    <DocContent
                        item={activeItem}
                        onBack={() => setActiveItem(null)}
                    />
                ) : activeSection && currentSection ? (
                    <View>
                        <TouchableOpacity
                            onPress={() => setActiveSection(null)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                marginBottom: 24
                            }}
                        >
                            <ArrowLeft size={18} color={COLORS.textSecondary} />
                            <Text style={{ color: COLORS.textSecondary }}>All Topics</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                            <View style={{
                                width: 48,
                                height: 48,
                                borderRadius: 14,
                                backgroundColor: `${currentSection.color}20`,
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <currentSection.icon size={24} color={currentSection.color} />
                            </View>
                            <Text style={{
                                color: COLORS.textPrimary,
                                fontSize: 28,
                                fontWeight: '800'
                            }}>{currentSection.title}</Text>
                        </View>

                        {currentSection.items.map((item, idx) => (
                            <DocCard
                                key={idx}
                                item={item}
                                onPress={() => setActiveItem(item)}
                            />
                        ))}
                    </View>
                ) : (
                    <View style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 16
                    }}>
                        {DOC_SECTIONS.map(section => (
                            <TouchableOpacity
                                key={section.id}
                                onPress={() => setActiveSection(section.id)}
                                style={{
                                    backgroundColor: COLORS.bgTertiary,
                                    borderRadius: 20,
                                    padding: 28,
                                    width: isDesktop ? 'calc(50% - 8px)' : '100%',
                                    borderWidth: 1,
                                    borderColor: `${section.color}30`
                                }}
                                activeOpacity={0.7}
                            >
                                <View style={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: 16,
                                    backgroundColor: `${section.color}20`,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 20
                                }}>
                                    <section.icon size={28} color={section.color} />
                                </View>

                                <Text style={{
                                    color: COLORS.textPrimary,
                                    fontSize: 20,
                                    fontWeight: '700',
                                    marginBottom: 8
                                }}>{section.title}</Text>

                                <Text style={{
                                    color: COLORS.textMuted,
                                    fontSize: 14
                                }}>
                                    {section.items.length} articles
                                </Text>

                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    marginTop: 16
                                }}>
                                    <Text style={{ color: section.color, fontSize: 14, fontWeight: '600' }}>
                                        Browse
                                    </Text>
                                    <ArrowRight size={14} color={section.color} />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            {/* Footer CTA */}
            <View style={{
                backgroundColor: COLORS.bgSecondary,
                paddingVertical: 60,
                paddingHorizontal: containerPadding,
                alignItems: 'center'
            }}>
                <Text style={{
                    color: COLORS.textPrimary,
                    fontSize: 24,
                    fontWeight: '700',
                    marginBottom: 16,
                    textAlign: 'center'
                }}>
                    Still have questions?
                </Text>
                <Text style={{
                    color: COLORS.textSecondary,
                    fontSize: 16,
                    marginBottom: 32,
                    textAlign: 'center'
                }}>
                    Jump in and try it. The best way to learn is by doing.
                </Text>
                <TouchableOpacity
                    onPress={() => router.push('/chat/new')}
                    style={{
                        backgroundColor: COLORS.neonGreen,
                        paddingHorizontal: 32,
                        paddingVertical: 16,
                        borderRadius: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10
                    }}
                >
                    <Image source={ZEROPROMPT_LOGO} style={{ width: 22, height: 22 }} resizeMode="contain" />
                    <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Start Free</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
