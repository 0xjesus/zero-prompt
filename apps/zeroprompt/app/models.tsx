import React, { useEffect, useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Platform,
    useWindowDimensions,
    ActivityIndicator,
    StyleSheet
} from 'react-native';
import { useRouter } from 'expo-router';
import {
    Search, Brain, PenTool, Globe, Eye, Mic, Sparkles, ArrowRight,
    ArrowLeft, Filter, ChevronDown, X, Layers, Star, Check, ExternalLink, Gift
} from 'lucide-react-native';

const ZEROPROMPT_LOGO = require('../assets/logos/zero-prompt-logo.png');

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// DESIGN SYSTEM
// ============================================================================
const COLORS = {
    neonGreen: '#00FF41',
    neonGreenSoft: 'rgba(0, 255, 65, 0.15)',
    electricBlue: '#00D4FF',
    cyberPurple: '#8B5CF6',
    hotPink: '#E91E63',
    gold: '#FFD700',
    orange: '#FF9800',
    bgPrimary: '#000000',
    bgSecondary: '#0A0A0A',
    bgTertiary: '#111111',
    textPrimary: '#FFFFFF',
    textSecondary: '#A0A0A0',
    textMuted: '#666666',
};

const FONT_MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

type Model = {
    id: number;
    openrouterId: string;
    name: string;
    description?: string;
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

type Category = 'all' | 'chat' | 'image' | 'reasoning' | 'vision' | 'free' | 'audio';

// ============================================================================
// COMPONENTS
// ============================================================================

const ModelLogo = ({ modelId, iconUrl, size = 40 }: { modelId?: string; iconUrl?: string; size?: number }) => {
    const [imageError, setImageError] = useState(false);

    const getProviderIcon = (id: string): string | null => {
        if (!id) return null;
        const provider = id.split('/')[0] || '';
        const providerIcons: Record<string, string> = {
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
        };
        return providerIcons[provider] || null;
    };

    const finalIconUrl = iconUrl || getProviderIcon(modelId || '');

    if (!finalIconUrl || imageError) {
        return (
            <View style={{
                width: size,
                height: size,
                borderRadius: size / 3,
                backgroundColor: COLORS.neonGreenSoft,
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Sparkles size={size * 0.5} color={COLORS.neonGreen} />
            </View>
        );
    }

    return (
        <Image
            source={{ uri: finalIconUrl }}
            style={{ width: size, height: size, borderRadius: size / 3 }}
            onError={() => setImageError(true)}
        />
    );
};

const CapabilityBadge = ({ icon: Icon, label, color }: { icon: any; label: string; color: string }) => (
    <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: `${color}15`,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: `${color}30`
    }}>
        <Icon size={12} color={color} />
        <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
);

const ModelCard = ({ model, onSelect }: { model: Model; onSelect: () => void }) => {
    const arch = model.architecture || {};
    const id = (model.openrouterId || '').toLowerCase();
    const modelName = (model.name || '').toLowerCase();

    // Capabilities
    const isThinking = id.includes('o1') || id.includes('o3') || id.includes('-r1') ||
                       id.includes('thinking') || id.includes('reasoner') ||
                       modelName.includes('thinking') || modelName.includes('reasoner') ||
                       (id.includes('deepseek') && id.includes('r1'));
    const canGenerateImages = Array.isArray(arch.output_modalities) && arch.output_modalities.includes('image');
    const hasVision = Array.isArray(arch.input_modalities) && arch.input_modalities.includes('image') && !canGenerateImages;
    const hasWeb = arch.has_web_search === true;
    const hasAudio = arch.has_audio === true;
    const isFree = (model.publicPricingPrompt || 0) === 0;

    const contextK = model.contextLength ? Math.round(model.contextLength / 1024) : 0;
    const provider = model.openrouterId?.split('/')[0] || 'Unknown';
    const displayName = model.name?.includes('/') ? model.name.split('/').pop() : model.name;

    return (
        <TouchableOpacity
            onPress={onSelect}
            style={{
                backgroundColor: COLORS.bgTertiary,
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.06)',
                marginBottom: 12
            }}
            activeOpacity={0.7}
        >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
                <ModelLogo modelId={model.openrouterId} iconUrl={model.iconUrl} size={48} />

                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{
                            color: COLORS.textPrimary,
                            fontSize: 16,
                            fontWeight: '700',
                            flex: 1
                        }} numberOfLines={1}>
                            {displayName}
                        </Text>
                        {isFree && (
                            <View style={{
                                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6
                            }}>
                                <Text style={{ color: '#4CAF50', fontSize: 10, fontWeight: '800' }}>FREE</Text>
                            </View>
                        )}
                    </View>

                    <Text style={{
                        color: COLORS.textMuted,
                        fontSize: 12,
                        textTransform: 'capitalize',
                        marginBottom: 12
                    }}>
                        {provider} {contextK > 0 && `• ${contextK}K context`}
                    </Text>

                    {/* Capabilities */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {isThinking && <CapabilityBadge icon={Brain} label="Thinking" color={COLORS.cyberPurple} />}
                        {canGenerateImages && <CapabilityBadge icon={PenTool} label="Image Gen" color={COLORS.hotPink} />}
                        {hasVision && <CapabilityBadge icon={Eye} label="Vision" color={COLORS.orange} />}
                        {hasWeb && <CapabilityBadge icon={Globe} label="Web Search" color="#4CAF50" />}
                        {hasAudio && <CapabilityBadge icon={Mic} label="Audio" color={COLORS.electricBlue} />}
                        {!isThinking && !canGenerateImages && !hasVision && !hasWeb && !hasAudio && (
                            <CapabilityBadge icon={Sparkles} label="Chat" color={COLORS.electricBlue} />
                        )}
                    </View>

                    {/* Pricing */}
                    {!isFree && (
                        <View style={{ marginTop: 12, flexDirection: 'row', gap: 16 }}>
                            <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
                                Input: <Text style={{ color: COLORS.textSecondary }}>${(model.publicPricingPrompt || 0).toFixed(4)}/M</Text>
                            </Text>
                            <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>
                                Output: <Text style={{ color: COLORS.textSecondary }}>${(model.publicPricingCompletion || 0).toFixed(4)}/M</Text>
                            </Text>
                        </View>
                    )}
                </View>

                <ArrowRight size={20} color={COLORS.textMuted} />
            </View>
        </TouchableOpacity>
    );
};

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function ModelsPage() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width > 1024;
    const isTablet = width > 768;

    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<Category>('all');

    useEffect(() => {
        fetchModels();
    }, []);

    const fetchModels = async () => {
        try {
            const res = await fetch(`${API_URL}/models`);
            const data = await res.json();
            setModels(data.models || []);
        } catch (err) {
            console.error('Failed to fetch models:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredModels = useMemo(() => {
        let result = models;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(m =>
                (m.name || '').toLowerCase().includes(query) ||
                (m.openrouterId || '').toLowerCase().includes(query)
            );
        }

        // Category filter
        if (activeCategory !== 'all') {
            result = result.filter(m => {
                const arch = m.architecture || {};
                const id = (m.openrouterId || '').toLowerCase();
                const name = (m.name || '').toLowerCase();

                const isImageGen = Array.isArray(arch.output_modalities) && arch.output_modalities.includes('image');
                const isVision = Array.isArray(arch.input_modalities) && arch.input_modalities.includes('image') && !isImageGen;
                const isThinking = id.includes('o1') || id.includes('o3') || id.includes('-r1') ||
                                   id.includes('thinking') || id.includes('reasoner') ||
                                   name.includes('thinking') || name.includes('reasoner') ||
                                   (id.includes('deepseek') && id.includes('r1'));
                const isFree = (m.publicPricingPrompt || 0) === 0;
                const hasAudio = arch.has_audio === true;

                switch (activeCategory) {
                    case 'image': return isImageGen;
                    case 'vision': return isVision;
                    case 'reasoning': return isThinking;
                    case 'free': return isFree;
                    case 'audio': return hasAudio;
                    case 'chat': return !isImageGen && !isThinking && !isVision;
                    default: return true;
                }
            });
        }

        return result;
    }, [models, searchQuery, activeCategory]);

    // Stats
    const stats = useMemo(() => {
        const free = models.filter(m => (m.publicPricingPrompt || 0) === 0).length;
        const imageGen = models.filter(m => {
            const om = m.architecture?.output_modalities;
            return Array.isArray(om) && om.includes('image');
        }).length;
        const vision = models.filter(m => {
            const im = m.architecture?.input_modalities;
            const om = m.architecture?.output_modalities;
            return Array.isArray(im) && im.includes('image') && !(Array.isArray(om) && om.includes('image'));
        }).length;

        return { total: models.length, free, imageGen, vision };
    }, [models]);

    const categories: { id: Category; label: string; icon: any; color: string }[] = [
        { id: 'all', label: 'All Models', icon: Layers, color: COLORS.neonGreen },
        { id: 'chat', label: 'Chat', icon: Sparkles, color: COLORS.electricBlue },
        { id: 'image', label: 'Image Gen', icon: PenTool, color: COLORS.hotPink },
        { id: 'reasoning', label: 'Thinking', icon: Brain, color: COLORS.cyberPurple },
        { id: 'vision', label: 'Vision', icon: Eye, color: COLORS.orange },
        { id: 'free', label: 'Free', icon: Gift, color: '#4CAF50' },
    ];

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
                        <Text style={{ color: '#000', fontWeight: '700' }}>Start Chatting</Text>
                        <ArrowRight size={16} color="#000" />
                    </TouchableOpacity>
                </View>

                {/* Title */}
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
                        }}>MODEL LIBRARY</Text>
                    </View>

                    <Text style={{
                        color: COLORS.textPrimary,
                        fontSize: isDesktop ? 48 : 36,
                        fontWeight: '900',
                        textAlign: 'center',
                        marginBottom: 16
                    }}>
                        {stats.total}+ AI Models
                    </Text>

                    <Text style={{
                        color: COLORS.textSecondary,
                        fontSize: 18,
                        textAlign: 'center',
                        maxWidth: 600
                    }}>
                        Access the world's most powerful AI models through a single interface.
                        From GPT-4 to Claude to open-source alternatives.
                    </Text>
                </View>

                {/* Stats */}
                <View style={{
                    flexDirection: isTablet ? 'row' : 'column',
                    gap: 16,
                    justifyContent: 'center',
                    marginBottom: 48
                }}>
                    {[
                        { value: stats.total, label: 'Total Models', color: COLORS.neonGreen },
                        { value: stats.free, label: 'Free Models', color: '#4CAF50' },
                        { value: stats.imageGen, label: 'Image Generators', color: COLORS.hotPink },
                        { value: stats.vision, label: 'Vision Models', color: COLORS.orange },
                    ].map((stat, idx) => (
                        <View key={idx} style={{
                            backgroundColor: COLORS.bgTertiary,
                            borderRadius: 16,
                            padding: 20,
                            alignItems: 'center',
                            flex: isTablet ? 1 : undefined,
                            borderWidth: 1,
                            borderColor: `${stat.color}30`
                        }}>
                            <Text style={{
                                color: stat.color,
                                fontSize: 32,
                                fontWeight: '900'
                            }}>{stat.value}</Text>
                            <Text style={{ color: COLORS.textSecondary, fontSize: 13 }}>{stat.label}</Text>
                        </View>
                    ))}
                </View>

                {/* Search */}
                <View style={{
                    backgroundColor: COLORS.bgTertiary,
                    borderRadius: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    marginBottom: 24,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.06)'
                }}>
                    <Search size={20} color={COLORS.textMuted} />
                    <TextInput
                        placeholder="Search models by name or provider..."
                        placeholderTextColor={COLORS.textMuted}
                        style={{
                            flex: 1,
                            color: COLORS.textPrimary,
                            fontSize: 15,
                            paddingVertical: 16,
                            paddingHorizontal: 12,
                            // @ts-ignore
                            outlineStyle: 'none'
                        }}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <X size={18} color={COLORS.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Categories */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 32 }}
                    contentContainerStyle={{ gap: 10 }}
                >
                    {categories.map(cat => {
                        const isActive = activeCategory === cat.id;
                        return (
                            <TouchableOpacity
                                key={cat.id}
                                onPress={() => setActiveCategory(cat.id)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    paddingHorizontal: 16,
                                    paddingVertical: 10,
                                    borderRadius: 12,
                                    backgroundColor: isActive ? `${cat.color}20` : 'rgba(255,255,255,0.03)',
                                    borderWidth: 1,
                                    borderColor: isActive ? `${cat.color}40` : 'rgba(255,255,255,0.06)'
                                }}
                            >
                                <cat.icon size={16} color={isActive ? cat.color : COLORS.textMuted} />
                                <Text style={{
                                    color: isActive ? cat.color : COLORS.textSecondary,
                                    fontWeight: isActive ? '600' : '400',
                                    fontSize: 14
                                }}>{cat.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Results count */}
                <Text style={{
                    color: COLORS.textMuted,
                    fontSize: 13,
                    marginBottom: 16
                }}>
                    Showing {filteredModels.length} models
                </Text>
            </View>

            {/* Model List */}
            <View style={{
                paddingHorizontal: containerPadding,
                paddingBottom: 80,
                maxWidth: 900,
                alignSelf: 'center',
                width: '100%'
            }}>
                {loading ? (
                    <View style={{ padding: 60, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color={COLORS.neonGreen} />
                        <Text style={{ color: COLORS.textSecondary, marginTop: 16 }}>Loading models...</Text>
                    </View>
                ) : filteredModels.length === 0 ? (
                    <View style={{ padding: 60, alignItems: 'center' }}>
                        <Search size={48} color={COLORS.textMuted} />
                        <Text style={{ color: COLORS.textSecondary, marginTop: 16, fontSize: 16 }}>
                            No models found
                        </Text>
                        <Text style={{ color: COLORS.textMuted, marginTop: 8 }}>
                            Try adjusting your search or filters
                        </Text>
                    </View>
                ) : (
                    filteredModels.map(model => (
                        <ModelCard
                            key={model.id}
                            model={model}
                            onSelect={() => router.push(`/chat/new?model=${model.openrouterId}`)}
                        />
                    ))
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
                    Ready to try these models?
                </Text>
                <Text style={{
                    color: COLORS.textSecondary,
                    fontSize: 16,
                    marginBottom: 32,
                    textAlign: 'center'
                }}>
                    Start chatting for free. No account required.
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
                    <Text style={{ color: '#000', fontSize: 16, fontWeight: '700' }}>Launch ZeroPrompt</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
