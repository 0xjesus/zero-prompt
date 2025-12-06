import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
    useWindowDimensions,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    ArrowRight, Check, Wallet, Brain, Sparkles, Globe,
    Shield, Lock, MessageSquare, Eye, Layers, Rocket, Star,
    DollarSign, Image as ImageIcon, Trophy, Home
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { WalletConnectModal } from '../components/WalletConnectionUI';

// ============================================================================
// DESIGN SYSTEM
// ============================================================================
const COLORS = {
    neonGreen: '#00FF41',
    neonGreenSoft: 'rgba(0, 255, 65, 0.15)',
    electricBlue: '#00D4FF',
    cyberPurple: '#8B5CF6',
    bgPrimary: '#000000',
    bgSecondary: '#0A0A0A',
    bgCard: '#111111',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textMuted: '#666666',
};

// ============================================================================
// IMAGES - TODAS LAS QUE TIENES
// ============================================================================
const IMAGES = {
    heroMain: require('../assets/images/hero-main.png'),
    aiPower: require('../assets/images/ai-power.png'),
    web3Fusion: require('../assets/images/web3-fusion.png'),
    infiniteAccess: require('../assets/images/infinite-access.png'),
    gateway: require('../assets/images/gateway.png'),
    dataStorm: require('../assets/images/data-storm.png'),
    freedom: require('../assets/images/freedom.png'),
    evolution: require('../assets/images/evolution.png'),
    neuralCosmos: require('../assets/images/neural-cosmos.png'),
    zeroInfinite: require('../assets/images/zero-infinite.png'),
    bgMatrix: require('../assets/images/bg-matrix.png'),
    bgCircuits: require('../assets/images/bg-circuits.png'),
    orbBlue: require('../assets/images/orb-blue.png'),
    orbPurple: require('../assets/images/orb-purple.png'),
};

// LOGOS DE PARTNERS
const LOGOS = {
    openai: require('../assets/logos/partner-openai.svg'),
    anthropic: require('../assets/logos/partner-anthropic.svg'),
    google: require('../assets/logos/partner-google.svg'),
    meta: require('../assets/logos/partner-meta.svg'),
    avalanche: require('../assets/logos/partner-avalanche.png'),
    zeroprompt: require('../assets/logos/zero-prompt-logo.png'),
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function HomePage() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width > 1024;
    const isTablet = width > 768;
    const containerPadding = isDesktop ? 80 : isTablet ? 40 : 20;

    const { theme } = useTheme();
    const {
        user,
        openWalletModal,
        isConnecting,
        isAuthenticating,
        connectionError,
        migratedChats,
        clearMigratedChats
    } = useAuth();

    const navigateToChat = () => router.push('/');

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}
            showsVerticalScrollIndicator={false}
        >
            {/* ============================================================
                HERO SECTION - hero-main.png
            ============================================================ */}
            <View style={{ minHeight: isDesktop ? 950 : 850, position: 'relative' }}>
                <Image
                    source={IMAGES.heroMain}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0.8,
                    }}
                    resizeMode="cover"
                />
                <View style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    // @ts-ignore
                    background: Platform.OS === 'web'
                        ? 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.95) 100%)'
                        : undefined,
                    backgroundColor: Platform.OS !== 'web' ? 'rgba(0,0,0,0.5)' : undefined,
                }} />

                {/* Navigation */}
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: containerPadding,
                    paddingVertical: 20,
                    position: 'relative',
                    zIndex: 10
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Image
                            source={LOGOS.zeroprompt}
                            style={{ width: 44, height: 44 }}
                            resizeMode="contain"
                        />
                        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>
                            ZeroPrompt
                        </Text>
                    </View>

                    {/* Nav Links */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => router.push('/chat/new')}
                            style={{
                                padding: 10,
                                borderRadius: 10,
                                backgroundColor: 'rgba(255,255,255,0.1)',
                            }}
                        >
                            <MessageSquare size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/x402')}
                            style={{
                                padding: 10,
                                borderRadius: 10,
                                backgroundColor: 'rgba(255,255,255,0.1)',
                            }}
                        >
                            <DollarSign size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/reputation')}
                            style={{
                                padding: 10,
                                borderRadius: 10,
                                backgroundColor: 'rgba(255,255,255,0.1)',
                            }}
                        >
                            <Trophy size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => router.push('/models')}
                            style={{
                                padding: 10,
                                borderRadius: 10,
                                backgroundColor: 'rgba(255,255,255,0.1)',
                            }}
                        >
                            <ImageIcon size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={navigateToChat}
                            style={{
                                backgroundColor: COLORS.neonGreen,
                                paddingHorizontal: 24,
                                paddingVertical: 12,
                                borderRadius: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                marginLeft: 8,
                            }}
                        >
                            <Text style={{ color: '#000', fontWeight: '700' }}>Launch App</Text>
                            <ArrowRight size={18} color="#000" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Hero Content */}
                <View style={{
                    flex: 1,
                    paddingHorizontal: containerPadding,
                    paddingTop: isDesktop ? 140 : 100,
                    alignItems: 'center',
                    position: 'relative',
                    zIndex: 5
                }}>
                    <Text style={{
                        color: '#fff',
                        fontSize: isDesktop ? 80 : isTablet ? 60 : 44,
                        fontWeight: '900',
                        textAlign: 'center',
                        letterSpacing: -3,
                        marginBottom: 28,
                        maxWidth: 900
                    }}>
                        All AI Models.{'\n'}
                        <Text style={{ color: COLORS.neonGreen }}>One Platform.</Text>
                    </Text>

                    <Text style={{
                        color: COLORS.textSecondary,
                        fontSize: isDesktop ? 24 : 18,
                        textAlign: 'center',
                        maxWidth: 650,
                        lineHeight: 36,
                        marginBottom: 48
                    }}>
                        Access 330+ AI models. Pay only for what you use with crypto.
                        No subscriptions. No data harvesting.
                    </Text>

                    <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 16, marginBottom: 48 }}>
                        <TouchableOpacity
                            onPress={navigateToChat}
                            style={{
                                backgroundColor: COLORS.neonGreen,
                                paddingHorizontal: 44,
                                paddingVertical: 20,
                                borderRadius: 14,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 12,
                            }}
                        >
                            <Rocket size={24} color="#000" />
                            <Text style={{ color: '#000', fontWeight: '800', fontSize: 18 }}>
                                Start Free
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push('/models')}
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                paddingHorizontal: 44,
                                paddingVertical: 20,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.2)',
                                alignItems: 'center',
                            }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 18 }}>
                                Browse 330+ Models
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {[
                            { icon: Shield, text: 'No Data Storage' },
                            { icon: Wallet, text: 'Pay with Crypto' },
                            { icon: Lock, text: 'Privacy First' },
                        ].map((item, idx) => (
                            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <item.icon size={18} color={COLORS.neonGreen} />
                                <Text style={{ color: COLORS.textSecondary, fontSize: 15 }}>{item.text}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            </View>

            {/* ============================================================
                PARTNERS LOGOS
            ============================================================ */}
            <View style={{
                paddingVertical: 48,
                paddingHorizontal: containerPadding,
                backgroundColor: COLORS.bgSecondary,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: 'rgba(255,255,255,0.05)'
            }}>
                <Text style={{
                    color: COLORS.textMuted,
                    fontSize: 12,
                    textAlign: 'center',
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    marginBottom: 32
                }}>
                    Powered by
                </Text>
                <View style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: isDesktop ? 56 : 32,
                    flexWrap: 'wrap'
                }}>
                    <Image source={LOGOS.openai} style={{ width: 100, height: 28, opacity: 0.7 }} resizeMode="contain" />
                    <Image source={LOGOS.anthropic} style={{ width: 110, height: 28, opacity: 0.7 }} resizeMode="contain" />
                    <Image source={LOGOS.google} style={{ width: 90, height: 28, opacity: 0.7 }} resizeMode="contain" />
                    <Image source={LOGOS.meta} style={{ width: 90, height: 28, opacity: 0.7 }} resizeMode="contain" />
                    <Image source={LOGOS.avalanche} style={{ width: 110, height: 28, opacity: 0.7 }} resizeMode="contain" />
                </View>
            </View>

            {/* ============================================================
                WHAT IS ZEROPROMPT - ai-power.png
            ============================================================ */}
            <View style={{
                paddingVertical: 100,
                paddingHorizontal: containerPadding,
            }}>
                <View style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: 64,
                    maxWidth: 1200,
                    alignSelf: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{ flex: 1 }}>
                        <Image
                            source={IMAGES.aiPower}
                            style={{
                                width: '100%',
                                height: isDesktop ? 500 : 350,
                                borderRadius: 24,
                            }}
                            resizeMode="cover"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            color: COLORS.neonGreen,
                            fontSize: 14,
                            fontWeight: '700',
                            letterSpacing: 2,
                            marginBottom: 16
                        }}>WHAT IS ZEROPROMPT</Text>
                        <Text style={{
                            color: '#fff',
                            fontSize: isDesktop ? 40 : 30,
                            fontWeight: '800',
                            marginBottom: 24,
                            lineHeight: isDesktop ? 50 : 40
                        }}>
                            One interface to access every AI model
                        </Text>
                        <Text style={{
                            color: COLORS.textSecondary,
                            fontSize: 18,
                            lineHeight: 30,
                            marginBottom: 32
                        }}>
                            Instead of paying $20/month for ChatGPT, $20/month for Claude —
                            access ALL of them through ZeroPrompt. Pay only for what you use.
                        </Text>
                        <View style={{ gap: 16 }}>
                            {[
                                '330+ AI models from OpenAI, Anthropic, Google, Meta',
                                'Pay-per-use with crypto — no subscriptions',
                                'Your data is never stored or used for training',
                            ].map((text, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                                    <Check size={22} color={COLORS.neonGreen} style={{ marginTop: 2 }} />
                                    <Text style={{ color: COLORS.textSecondary, fontSize: 17, flex: 1 }}>{text}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </View>

            {/* ============================================================
                INFINITE ACCESS - infinite-access.png
            ============================================================ */}
            <View style={{ position: 'relative', overflow: 'hidden' }}>
                <Image
                    source={IMAGES.infiniteAccess}
                    style={{
                        width: '100%',
                        height: isDesktop ? 500 : 350,
                    }}
                    resizeMode="cover"
                />
                <View style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    paddingHorizontal: containerPadding,
                }}>
                    <Text style={{
                        color: '#fff',
                        fontSize: isDesktop ? 48 : 32,
                        fontWeight: '900',
                        textAlign: 'center',
                        maxWidth: 700
                    }}>
                        Unlimited Access to AI
                    </Text>
                    <Text style={{
                        color: COLORS.textSecondary,
                        fontSize: 20,
                        textAlign: 'center',
                        marginTop: 16,
                        maxWidth: 500
                    }}>
                        No rate limits. No waiting. Just pure AI power at your fingertips.
                    </Text>
                </View>
            </View>

            {/* ============================================================
                HOW IT WORKS - 3 Steps
            ============================================================ */}
            <View style={{
                paddingVertical: 100,
                paddingHorizontal: containerPadding,
                backgroundColor: COLORS.bgSecondary
            }}>
                <Text style={{
                    color: COLORS.neonGreen,
                    fontSize: 14,
                    fontWeight: '700',
                    letterSpacing: 2,
                    textAlign: 'center',
                    marginBottom: 16
                }}>HOW IT WORKS</Text>
                <Text style={{
                    color: '#fff',
                    fontSize: isDesktop ? 44 : 32,
                    fontWeight: '900',
                    textAlign: 'center',
                    marginBottom: 64
                }}>
                    Start in 3 simple steps
                </Text>

                <View style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: 32,
                    maxWidth: 1100,
                    alignSelf: 'center'
                }}>
                    {[
                        { step: '1', title: 'Choose a Model', desc: 'Browse 330+ AI models. Filter by task. Many are FREE.', icon: Brain },
                        { step: '2', title: 'Connect Wallet', desc: 'Optional. For premium models, connect MetaMask.', icon: Wallet },
                        { step: '3', title: 'Start Chatting', desc: 'Send your message. Pay only for tokens you use.', icon: MessageSquare }
                    ].map((item, idx) => (
                        <View key={idx} style={{
                            flex: 1,
                            backgroundColor: COLORS.bgCard,
                            borderRadius: 24,
                            padding: 36,
                            borderWidth: 1,
                            borderColor: 'rgba(0,255,65,0.15)',
                            alignItems: 'center'
                        }}>
                            <View style={{
                                width: 72, height: 72,
                                borderRadius: 36,
                                backgroundColor: COLORS.neonGreenSoft,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 28
                            }}>
                                <item.icon size={32} color={COLORS.neonGreen} />
                            </View>
                            <Text style={{
                                color: COLORS.neonGreen,
                                fontSize: 14,
                                fontWeight: '700',
                                marginBottom: 10
                            }}>STEP {item.step}</Text>
                            <Text style={{
                                color: '#fff',
                                fontSize: 24,
                                fontWeight: '700',
                                textAlign: 'center',
                                marginBottom: 12
                            }}>{item.title}</Text>
                            <Text style={{
                                color: COLORS.textSecondary,
                                fontSize: 16,
                                textAlign: 'center',
                                lineHeight: 26
                            }}>{item.desc}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* ============================================================
                DATA STORM IMAGE - Full Width
            ============================================================ */}
            <Image
                source={IMAGES.dataStorm}
                style={{
                    width: '100%',
                    height: isDesktop ? 400 : 280,
                }}
                resizeMode="cover"
            />

            {/* ============================================================
                WEB3 / CRYPTO - web3-fusion.png
            ============================================================ */}
            <View style={{
                paddingVertical: 100,
                paddingHorizontal: containerPadding,
            }}>
                <View style={{
                    flexDirection: isDesktop ? 'row-reverse' : 'column',
                    gap: 64,
                    maxWidth: 1200,
                    alignSelf: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{ flex: 1 }}>
                        <Image
                            source={IMAGES.web3Fusion}
                            style={{
                                width: '100%',
                                height: isDesktop ? 500 : 350,
                                borderRadius: 24
                            }}
                            resizeMode="cover"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            color: COLORS.electricBlue,
                            fontSize: 14,
                            fontWeight: '700',
                            letterSpacing: 2,
                            marginBottom: 16
                        }}>WHY CRYPTO</Text>
                        <Text style={{
                            color: '#fff',
                            fontSize: isDesktop ? 40 : 30,
                            fontWeight: '800',
                            marginBottom: 24,
                            lineHeight: isDesktop ? 50 : 40
                        }}>
                            True ownership of your AI interactions
                        </Text>
                        <Text style={{
                            color: COLORS.textSecondary,
                            fontSize: 18,
                            lineHeight: 30,
                            marginBottom: 32
                        }}>
                            Built on Avalanche for fast, cheap transactions.
                            No email required. No personal data collected.
                        </Text>
                        <View style={{ gap: 16 }}>
                            {[
                                { title: 'No subscriptions', desc: 'Pay only for tokens you use' },
                                { title: 'Pseudonymous', desc: 'No email, no personal info needed' },
                                { title: 'Instant settlement', desc: 'Sub-second transactions on Avalanche' },
                            ].map((item, idx) => (
                                <View key={idx} style={{
                                    backgroundColor: COLORS.bgCard,
                                    padding: 20,
                                    borderRadius: 12,
                                    borderLeftWidth: 4,
                                    borderLeftColor: COLORS.electricBlue
                                }}>
                                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 4 }}>
                                        {item.title}
                                    </Text>
                                    <Text style={{ color: COLORS.textSecondary, fontSize: 15 }}>
                                        {item.desc}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </View>

            {/* ============================================================
                EVOLUTION IMAGE - Full Width
            ============================================================ */}
            <View style={{ position: 'relative' }}>
                <Image
                    source={IMAGES.evolution}
                    style={{
                        width: '100%',
                        height: isDesktop ? 450 : 300,
                    }}
                    resizeMode="cover"
                />
                <View style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    paddingHorizontal: containerPadding,
                }}>
                    <Text style={{
                        color: '#fff',
                        fontSize: isDesktop ? 44 : 28,
                        fontWeight: '900',
                        textAlign: 'center'
                    }}>
                        The Evolution of AI Access
                    </Text>
                </View>
            </View>

            {/* ============================================================
                FEATURES GRID
            ============================================================ */}
            <View style={{
                paddingVertical: 100,
                paddingHorizontal: containerPadding,
                backgroundColor: COLORS.bgSecondary
            }}>
                <Text style={{
                    color: COLORS.neonGreen,
                    fontSize: 14,
                    fontWeight: '700',
                    letterSpacing: 2,
                    textAlign: 'center',
                    marginBottom: 16
                }}>FEATURES</Text>
                <Text style={{
                    color: '#fff',
                    fontSize: isDesktop ? 44 : 32,
                    fontWeight: '900',
                    textAlign: 'center',
                    marginBottom: 64
                }}>
                    Everything you need
                </Text>

                <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 24,
                    maxWidth: 1000,
                    alignSelf: 'center',
                    justifyContent: 'center'
                }}>
                    {[
                        { icon: MessageSquare, title: 'Chat', desc: 'Talk to any AI model' },
                        { icon: Layers, title: 'Compare', desc: 'Multiple models side-by-side' },
                        { icon: Brain, title: 'Reasoning', desc: 'o1, DeepSeek R1, and more' },
                        { icon: Eye, title: 'Vision', desc: 'Upload and analyze images' },
                        { icon: Sparkles, title: 'Image Gen', desc: 'Create images with AI' },
                        { icon: Globe, title: 'Web Search', desc: 'Real-time information' },
                    ].map((item, idx) => (
                        <View key={idx} style={{
                            width: isDesktop ? 'calc(33.33% - 16px)' : isTablet ? 'calc(50% - 12px)' : '100%',
                            backgroundColor: COLORS.bgCard,
                            borderRadius: 20,
                            padding: 32,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.06)'
                        }}>
                            <item.icon size={32} color={COLORS.neonGreen} style={{ marginBottom: 20 }} />
                            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
                                {item.title}
                            </Text>
                            <Text style={{ color: COLORS.textSecondary, fontSize: 16 }}>
                                {item.desc}
                            </Text>
                        </View>
                    ))}
                    {/* x402 Protocol Feature Card */}
                    <TouchableOpacity
                        onPress={() => router.push('/x402')}
                        style={{
                            width: isDesktop ? 'calc(33.33% - 16px)' : isTablet ? 'calc(50% - 12px)' : '100%',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)', // Cyber Purple tint
                            borderRadius: 20,
                            padding: 32,
                            borderWidth: 1,
                            borderColor: COLORS.cyberPurple
                        }}
                    >
                        <Layers size={32} color={COLORS.cyberPurple} style={{ marginBottom: 20 }} />
                        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
                            Agent API (x402)
                        </Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 16 }}>
                            Frictionless AI-to-AI payments protocol. Try the interactive demo.
                        </Text>
                    </TouchableOpacity>
                    {/* AI Reputation System Card */}
                    <TouchableOpacity
                        onPress={() => router.push('/reputation')}
                        style={{
                            width: isDesktop ? 'calc(33.33% - 16px)' : isTablet ? 'calc(50% - 12px)' : '100%',
                            backgroundColor: 'rgba(255, 193, 7, 0.1)', // Gold/amber tint
                            borderRadius: 20,
                            padding: 32,
                            borderWidth: 1,
                            borderColor: '#FFC107'
                        }}
                    >
                        <Star size={32} color="#FFC107" style={{ marginBottom: 20 }} />
                        <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
                            AI Reputation (ERC-8004)
                        </Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 16 }}>
                            Decentralized reputation system for AI models. Rate and discover the best models.
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ============================================================
                x402 PROTOCOL SECTION - Agent Economy
            ============================================================ */}
            <View style={{
                paddingVertical: 100,
                paddingHorizontal: containerPadding,
            }}>
                <View style={{
                    maxWidth: 1200,
                    alignSelf: 'center',
                    alignItems: 'center'
                }}>
                    <Text style={{
                        color: COLORS.cyberPurple,
                        fontSize: 14,
                        fontWeight: '700',
                        letterSpacing: 2,
                        textAlign: 'center',
                        marginBottom: 16
                    }}>x402 PROTOCOL</Text>
                    <Text style={{
                        color: '#fff',
                        fontSize: isDesktop ? 44 : 32,
                        fontWeight: '900',
                        textAlign: 'center',
                        marginBottom: 24,
                        maxWidth: 800
                    }}>
                        The Internet's Native Payment Layer for AI Agents
                    </Text>
                    <Text style={{
                        color: COLORS.textSecondary,
                        fontSize: 18,
                        textAlign: 'center',
                        lineHeight: 30,
                        marginBottom: 48,
                        maxWidth: 700
                    }}>
                        HTTP 402 "Payment Required" was defined in 1999 but never implemented.
                        Until now. ZeroPrompt brings machine-to-machine payments to life,
                        enabling AI agents to autonomously pay for services without human intervention.
                    </Text>

                    <View style={{
                        flexDirection: isDesktop ? 'row' : 'column',
                        gap: 24,
                        width: '100%',
                        marginBottom: 48
                    }}>
                        {[
                            {
                                title: 'Instant Micropayments',
                                desc: 'Agents pay per-request with AVAX. No API keys, no monthly bills, no rate limits.',
                                icon: '⚡'
                            },
                            {
                                title: 'Autonomous Transactions',
                                desc: 'AI agents can discover, negotiate, and pay for services programmatically.',
                                icon: '🤖'
                            },
                            {
                                title: 'Real-time Pricing',
                                desc: 'Dynamic quotes based on live AVAX prices and OpenRouter model costs.',
                                icon: '📊'
                            }
                        ].map((item, idx) => (
                            <View key={idx} style={{
                                flex: 1,
                                backgroundColor: 'rgba(139, 92, 246, 0.08)',
                                borderRadius: 20,
                                padding: 28,
                                borderWidth: 1,
                                borderColor: 'rgba(139, 92, 246, 0.2)'
                            }}>
                                <Text style={{ fontSize: 32, marginBottom: 16 }}>{item.icon}</Text>
                                <Text style={{
                                    color: '#fff',
                                    fontSize: 20,
                                    fontWeight: '700',
                                    marginBottom: 10
                                }}>{item.title}</Text>
                                <Text style={{
                                    color: COLORS.textSecondary,
                                    fontSize: 15,
                                    lineHeight: 24
                                }}>{item.desc}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={{
                        backgroundColor: COLORS.bgCard,
                        borderRadius: 16,
                        padding: 24,
                        borderWidth: 1,
                        borderColor: 'rgba(139, 92, 246, 0.3)',
                        marginBottom: 32,
                        maxWidth: 700,
                        width: '100%'
                    }}>
                        <Text style={{
                            color: COLORS.cyberPurple,
                            fontSize: 13,
                            fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
                            marginBottom: 8
                        }}>// How it works</Text>
                        <Text style={{
                            color: COLORS.textSecondary,
                            fontSize: 14,
                            fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
                            lineHeight: 22
                        }}>
                            {`1. Agent sends request → Server returns 402 + payment details\n2. Agent signs AVAX transaction → Sends payment proof\n3. Server verifies on-chain → Returns AI response`}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => router.push('/x402')}
                        style={{
                            backgroundColor: COLORS.cyberPurple,
                            paddingHorizontal: 36,
                            paddingVertical: 18,
                            borderRadius: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12
                        }}
                    >
                        <Layers size={22} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>
                            Try the x402 Demo
                        </Text>
                        <ArrowRight size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ============================================================
                NEURAL COSMOS IMAGE - Full Width
            ============================================================ */}
            <Image
                source={IMAGES.neuralCosmos}
                style={{
                    width: '100%',
                    height: isDesktop ? 400 : 280,
                }}
                resizeMode="cover"
            />

            {/* ============================================================
                FREEDOM SECTION - freedom.png
            ============================================================ */}
            <View style={{
                paddingVertical: 100,
                paddingHorizontal: containerPadding,
            }}>
                <View style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: 64,
                    maxWidth: 1200,
                    alignSelf: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{ flex: 1 }}>
                        <Image
                            source={IMAGES.freedom}
                            style={{
                                width: '100%',
                                height: isDesktop ? 450 : 320,
                                borderRadius: 24
                            }}
                            resizeMode="cover"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            color: COLORS.cyberPurple,
                            fontSize: 14,
                            fontWeight: '700',
                            letterSpacing: 2,
                            marginBottom: 16
                        }}>FREEDOM</Text>
                        <Text style={{
                            color: '#fff',
                            fontSize: isDesktop ? 40 : 30,
                            fontWeight: '800',
                            marginBottom: 24,
                            lineHeight: isDesktop ? 50 : 40
                        }}>
                            Break free from AI subscriptions
                        </Text>
                        <Text style={{
                            color: COLORS.textSecondary,
                            fontSize: 18,
                            lineHeight: 30,
                        }}>
                            No more paying $20/month for each AI service. No more vendor lock-in.
                            With ZeroPrompt, you get access to every model, pay only for what you use,
                            and maintain complete control over your data.
                        </Text>
                    </View>
                </View>
            </View>

            {/* ============================================================
                PRICING
            ============================================================ */}
            <View style={{
                paddingVertical: 100,
                paddingHorizontal: containerPadding,
                backgroundColor: COLORS.bgSecondary
            }}>
                <Text style={{
                    color: COLORS.neonGreen,
                    fontSize: 14,
                    fontWeight: '700',
                    letterSpacing: 2,
                    textAlign: 'center',
                    marginBottom: 16
                }}>PRICING</Text>
                <Text style={{
                    color: '#fff',
                    fontSize: isDesktop ? 44 : 32,
                    fontWeight: '900',
                    textAlign: 'center',
                    marginBottom: 24
                }}>
                    Pay only for what you use
                </Text>
                <Text style={{
                    color: COLORS.textSecondary,
                    fontSize: 18,
                    textAlign: 'center',
                    marginBottom: 64,
                    maxWidth: 600,
                    alignSelf: 'center'
                }}>
                    No subscriptions. No hidden fees. Start free.
                </Text>

                <View style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    gap: 24,
                    maxWidth: 800,
                    alignSelf: 'center'
                }}>
                    {/* Free */}
                    <View style={{
                        flex: 1,
                        backgroundColor: COLORS.bgCard,
                        borderRadius: 24,
                        padding: 40,
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)'
                    }}>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>FREE</Text>
                        <Text style={{ color: '#fff', fontSize: 56, fontWeight: '900', marginBottom: 8 }}>$0</Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 16, marginBottom: 32 }}>No wallet needed</Text>
                        {['50+ free models', 'Basic chat features', 'No account required'].map((f, i) => (
                            <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                <Check size={20} color={COLORS.neonGreen} />
                                <Text style={{ color: COLORS.textSecondary, fontSize: 16 }}>{f}</Text>
                            </View>
                        ))}
                        <TouchableOpacity onPress={navigateToChat} style={{
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            paddingVertical: 18,
                            borderRadius: 12,
                            alignItems: 'center',
                            marginTop: 24
                        }}>
                            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Get Started</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Pro */}
                    <View style={{
                        flex: 1,
                        backgroundColor: COLORS.bgCard,
                        borderRadius: 24,
                        padding: 40,
                        borderWidth: 2,
                        borderColor: COLORS.neonGreen,
                    }}>
                        <View style={{
                            position: 'absolute',
                            top: -14,
                            right: 28,
                            backgroundColor: COLORS.neonGreen,
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                            borderRadius: 12
                        }}>
                            <Text style={{ color: '#000', fontSize: 12, fontWeight: '800' }}>POPULAR</Text>
                        </View>
                        <Text style={{ color: COLORS.neonGreen, fontSize: 14, fontWeight: '600', marginBottom: 12 }}>PAY-AS-YOU-GO</Text>
                        <Text style={{ color: '#fff', fontSize: 56, fontWeight: '900', marginBottom: 8 }}>$0.001</Text>
                        <Text style={{ color: COLORS.textSecondary, fontSize: 16, marginBottom: 32 }}>per 1K tokens</Text>
                        {['All 330+ models', 'GPT-4, Claude, Gemini', 'Image generation', 'Model comparison'].map((f, i) => (
                            <View key={i} style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                                <Check size={20} color={COLORS.neonGreen} />
                                <Text style={{ color: COLORS.textSecondary, fontSize: 16 }}>{f}</Text>
                            </View>
                        ))}
                        <TouchableOpacity
                            onPress={user?.walletAddress ? navigateToChat : openWalletModal}
                            disabled={isConnecting || isAuthenticating}
                            style={{
                                backgroundColor: COLORS.neonGreen,
                                paddingVertical: 18,
                                borderRadius: 12,
                                alignItems: 'center',
                                marginTop: 24,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 10,
                                opacity: isConnecting || isAuthenticating ? 0.7 : 1
                            }}
                        >
                            {isConnecting || isAuthenticating ? (
                                <ActivityIndicator size="small" color="#000" />
                            ) : (
                                <>
                                    <Wallet size={20} color="#000" />
                                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>
                                        {user?.walletAddress ? 'Go to Chat' : 'Connect Wallet'}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* ============================================================
                ZERO TO INFINITE - Brand Image
            ============================================================ */}
            <View style={{
                paddingVertical: 80,
                paddingHorizontal: containerPadding,
                alignItems: 'center'
            }}>
                <Image
                    source={IMAGES.zeroInfinite}
                    style={{
                        width: isDesktop ? 400 : 280,
                        height: isDesktop ? 400 : 280,
                        borderRadius: 24
                    }}
                    resizeMode="contain"
                />
                <Text style={{
                    color: '#fff',
                    fontSize: isDesktop ? 32 : 24,
                    fontWeight: '800',
                    textAlign: 'center',
                    marginTop: 32
                }}>
                    From Zero Cost to Infinite Possibilities
                </Text>
            </View>

            {/* ============================================================
                FINAL CTA - gateway.png background
            ============================================================ */}
            <View style={{
                paddingVertical: 140,
                paddingHorizontal: containerPadding,
                position: 'relative',
                overflow: 'hidden'
            }}>
                <Image
                    source={IMAGES.gateway}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        width: '100%', height: '100%',
                        opacity: 0.6
                    }}
                    resizeMode="cover"
                />
                <View style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)'
                }} />

                <View style={{
                    maxWidth: 700,
                    alignSelf: 'center',
                    alignItems: 'center',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <Text style={{
                        color: '#fff',
                        fontSize: isDesktop ? 52 : 36,
                        fontWeight: '900',
                        textAlign: 'center',
                        marginBottom: 24
                    }}>
                        Ready to start?
                    </Text>
                    <Text style={{
                        color: COLORS.textSecondary,
                        fontSize: 22,
                        textAlign: 'center',
                        marginBottom: 48,
                        lineHeight: 34
                    }}>
                        Access the world's best AI models in seconds.
                    </Text>
                    <TouchableOpacity
                        onPress={navigateToChat}
                        style={{
                            backgroundColor: COLORS.neonGreen,
                            paddingHorizontal: 56,
                            paddingVertical: 22,
                            borderRadius: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 14
                        }}
                    >
                        <Image
                            source={LOGOS.zeroprompt}
                            style={{ width: 28, height: 28 }}
                            resizeMode="contain"
                        />
                        <Text style={{ color: '#000', fontSize: 20, fontWeight: '800' }}>
                            Launch ZeroPrompt
                        </Text>
                        <ArrowRight size={26} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ============================================================
                FOOTER
            ============================================================ */}
            <View style={{
                paddingVertical: 48,
                paddingHorizontal: containerPadding,
                backgroundColor: COLORS.bgSecondary,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255,255,255,0.05)'
            }}>
                <View style={{
                    flexDirection: isDesktop ? 'row' : 'column',
                    justifyContent: 'space-between',
                    alignItems: isDesktop ? 'center' : 'flex-start',
                    gap: 24,
                    maxWidth: 1200,
                    alignSelf: 'center',
                    width: '100%'
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Image
                            source={LOGOS.zeroprompt}
                            style={{ width: 36, height: 36 }}
                            resizeMode="contain"
                        />
                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>ZeroPrompt</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 32 }}>
                        <TouchableOpacity onPress={() => router.push('/docs')}>
                            <Text style={{ color: COLORS.textSecondary }}>Docs</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push('/models')}>
                            <Text style={{ color: COLORS.textSecondary }}>Models</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={{ color: COLORS.textMuted, fontSize: 13 }}>
                        2024 ZeroPrompt. Built on Avalanche.
                    </Text>
                </View>
            </View>

            {/* Wallet Connection Modal */}
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
        </ScrollView>
    );
}
