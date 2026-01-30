import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    Platform,
    useWindowDimensions,
    StyleSheet
} from 'react-native';
import {
    X, Search, Brain, PenTool, Globe, Eye, Mic, Sparkles, Check,
    ChevronDown, ChevronRight, Star, Clock, Layers, Tag, Award, ExternalLink, Cpu
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { API_URL } from '../config/api';
import { useMode } from '../context/ModeContext';

// Reputation Tags - LLM Capability Categories (community-driven)
const REPUTATION_TAGS = [
    { id: 'math', label: 'Math', emoji: '🧮', color: '#3B82F6' },
    { id: 'coding', label: 'Coding', emoji: '💻', color: '#10B981' },
    { id: 'reasoning', label: 'Reasoning', emoji: '🧠', color: '#8B5CF6' },
    { id: 'creative', label: 'Creative', emoji: '🎨', color: '#EC4899' },
    { id: 'research', label: 'Research', emoji: '🔬', color: '#06B6D4' },
    { id: 'uncensored', label: 'Uncensored', emoji: '🔓', color: '#EF4444' },
    { id: 'roleplay', label: 'Roleplay', emoji: '🎭', color: '#F97316' },
    { id: 'multilingual', label: 'Multilingual', emoji: '🌍', color: '#14B8A6' },
    { id: 'fast', label: 'Fast', emoji: '⚡', color: '#EAB308' },
    { id: 'accurate', label: 'Accurate', emoji: '🎯', color: '#22C55E' },
];

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
    // ERC-8004 Reputation data
    reputation?: {
        totalRatings: number;
        averageScore: number; // 0-5 scale
    } | null;
};

type Category = 'all' | 'chat' | 'image' | 'reasoning' | 'vision' | 'top-rated';

interface ModelSelectorModalProps {
    visible: boolean;
    onClose: () => void;
    models: Model[];
    selectedModels: Model[];
    onToggleModel: (model: Model) => void;
    theme: any;
}

const ModelLogo = ({ modelId, iconUrl, size = 24, theme }: { modelId?: string; iconUrl?: string; size?: number; theme: any }) => {
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
            style={{ width: size, height: size, borderRadius: size / 3 }}
            onError={() => setImageError(true)}
        />
    );
};

const CapBadge = ({ icon: Icon, color, small }: { icon: any; color: string; small?: boolean }) => (
    <View style={{
        width: small ? 22 : 26,
        height: small ? 22 : 26,
        borderRadius: 6,
        backgroundColor: `${color}20`,
        alignItems: 'center',
        justifyContent: 'center'
    }}>
        <Icon size={small ? 10 : 12} color={color} />
    </View>
);

// ERC-8004 Reputation Display
const ReputationBadge = ({ reputation }: { reputation: Model['reputation'] }) => {
    if (!reputation || reputation.totalRatings === 0) return null;

    const score = reputation.averageScore;
    const color = score >= 4.5 ? '#FFD700' : score >= 4 ? '#FFC107' : score >= 3 ? '#FF9800' : '#9E9E9E';

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: `${color}15`,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
            marginLeft: 6,
        }}>
            <Star size={10} color={color} fill={color} />
            <Text style={{ color, fontSize: 10, fontWeight: '700', marginLeft: 2 }}>
                {score.toFixed(1)}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginLeft: 2 }}>
                ({reputation.totalRatings})
            </Text>
        </View>
    );
};

const ModelCard = ({
    model,
    isSelected,
    onPress,
    theme,
    isFavorite,
    onToggleFavorite
}: {
    model: Model;
    isSelected: boolean;
    onPress: () => void;
    theme: any;
    isFavorite?: boolean;
    onToggleFavorite?: () => void;
}) => {
    const arch = model.architecture || {};
    const id = (model.openrouterId || '').toLowerCase();
    const modelNameLower = (model.name || '').toLowerCase();

    // True thinking models by name pattern
    const isThinking = id.includes('o1') || id.includes('o3') || id.includes('-r1') ||
                       id.includes('thinking') || id.includes('reasoner') ||
                       modelNameLower.includes('thinking') || modelNameLower.includes('reasoner') ||
                       (id.includes('deepseek') && id.includes('r1'));

    const canGenerateImages = Array.isArray(arch.output_modalities) && arch.output_modalities.includes('image');
    const hasVision = Array.isArray(arch.input_modalities) && arch.input_modalities.includes('image') && !canGenerateImages;
    const hasWeb = arch.has_web_search === true;
    const hasAudio = arch.has_audio === true;
    const isFree = (model.publicPricingPrompt || 0) === 0;

    const contextLength = typeof model.contextLength === 'number' ? model.contextLength : 0;
    const contextK = Math.round(contextLength / 1024);

    const openrouterId = model.openrouterId || '';
    const parts = openrouterId.split('/');
    const provider = parts[0] || 'Unknown';

    const modelName = model.name || 'Model';
    const displayName = modelName.includes('/') ? (modelName.split('/').pop() || modelName) : modelName;

    const priceDisplay = typeof model.publicPricingPrompt === 'number'
        ? `$${model.publicPricingPrompt.toFixed(4)}/M`
        : '';

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: isSelected ? 'rgba(0, 255, 65, 0.08)' : 'transparent',
                borderLeftWidth: isSelected ? 3 : 0,
                borderLeftColor: theme.primary,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.04)'
            }}
        >
            <View style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                borderWidth: 2,
                borderColor: isSelected ? theme.primary : 'rgba(255,255,255,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSelected ? theme.primary : 'transparent',
                marginRight: 12
            }}>
                {isSelected && <Check size={12} color="#000" strokeWidth={3} />}
            </View>

            <ModelLogo modelId={openrouterId} iconUrl={model.iconUrl} size={32} theme={theme} />

            <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', flexShrink: 1 }} numberOfLines={1}>
                        {displayName}
                    </Text>
                    <ReputationBadge reputation={model.reputation} />
                    {isFree && (
                        <View style={{ backgroundColor: 'rgba(76, 175, 80, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 }}>
                            <Text style={{ color: '#4CAF50', fontSize: 9, fontWeight: '700' }}>FREE</Text>
                        </View>
                    )}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'capitalize' }}>
                        {provider}
                    </Text>
                    {contextK > 0 && (
                        <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginLeft: 8 }}>
                            {String(contextK)}{'k ctx'}
                        </Text>
                    )}
                    {!isFree && priceDisplay !== '' && (
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginLeft: 8 }}>
                            {priceDisplay}
                        </Text>
                    )}
                </View>
            </View>

            <View style={{ flexDirection: 'row', marginLeft: 8 }}>
                {isThinking && <CapBadge icon={Brain} color="#9C27B0" small />}
                {canGenerateImages && <CapBadge icon={PenTool} color="#E91E63" small />}
                {hasVision && <CapBadge icon={Eye} color="#00BCD4" small />}
                {hasWeb && <CapBadge icon={Globe} color="#4CAF50" small />}
                {hasAudio && <CapBadge icon={Mic} color="#FF9800" small />}
            </View>

            {onToggleFavorite && (
                <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                    style={{ marginLeft: 8, padding: 4 }}
                >
                    <Star
                        size={16}
                        color={isFavorite ? '#FFC107' : 'rgba(255,255,255,0.2)'}
                        fill={isFavorite ? '#FFC107' : 'transparent'}
                    />
                </TouchableOpacity>
            )}
        </TouchableOpacity>
    );
};

const CategorySection = ({
    title,
    icon: Icon,
    color,
    models,
    selectedModels,
    onToggleModel,
    theme,
    favorites,
    onToggleFavorite,
    defaultExpanded = true
}: {
    title: string;
    icon: any;
    color: string;
    models: Model[];
    selectedModels: Model[];
    onToggleModel: (model: Model) => void;
    theme: any;
    favorites: string[];
    onToggleFavorite: (id: string) => void;
    defaultExpanded?: boolean;
}) => {
    const [expanded, setExpanded] = useState(defaultExpanded);

    if (models.length === 0) return null;

    return (
        <View style={{ marginBottom: 8 }}>
            <TouchableOpacity
                onPress={() => setExpanded(!expanded)}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(255,255,255,0.06)'
                }}
            >
                <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: `${color}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12
                }}>
                    <Icon size={14} color={color} />
                </View>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 }}>{title}</Text>
                <View style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                    marginRight: 8
                }}>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' }}>{String(models.length)}</Text>
                </View>
                {expanded ? <ChevronDown size={16} color="rgba(255,255,255,0.4)" /> : <ChevronRight size={16} color="rgba(255,255,255,0.4)" />}
            </TouchableOpacity>

            {expanded && models.map(model => (
                <ModelCard
                    key={model.id}
                    model={model}
                    isSelected={selectedModels.some(m => m.id === model.id)}
                    onPress={() => onToggleModel(model)}
                    theme={theme}
                    isFavorite={favorites.includes(model.openrouterId || '')}
                    onToggleFavorite={() => onToggleFavorite(model.openrouterId || '')}
                />
            ))}
        </View>
    );
};

export default function ModelSelectorModal({
    visible,
    onClose,
    models,
    selectedModels,
    onToggleModel,
    theme
}: ModelSelectorModalProps) {
    const router = useRouter();
    const { width, height } = useWindowDimensions();
    const { mode, isDecentralized, availableOllamaModels, networkHealth } = useMode();
    const isDesktop = width > 768;
    const isMobile = width < 480;
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<Category>('all');
    const [favorites, setFavorites] = useState<string[]>([]);
    const [recentModels, setRecentModels] = useState<string[]>([]);

    // Defer heavy content render for snappier modal open
    const [contentReady, setContentReady] = useState(false);

    useEffect(() => {
        if (visible) {
            // Small delay to let modal animation complete before rendering heavy list
            const timer = setTimeout(() => setContentReady(true), 50);
            return () => clearTimeout(timer);
        } else {
            setContentReady(false);
        }
    }, [visible]);

    // Reputation tag filtering
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [tagModelIds, setTagModelIds] = useState<number[]>([]);
    const [isLoadingTagModels, setIsLoadingTagModels] = useState(false);

    useEffect(() => {
        if (Platform.OS === 'web') {
            try {
                const saved = localStorage.getItem('favoriteModels');
                if (saved) setFavorites(JSON.parse(saved));
                const recent = localStorage.getItem('recentModels');
                if (recent) setRecentModels(JSON.parse(recent));
            } catch (e) {
                console.warn('Failed to load favorites:', e);
            }
        }
    }, []);

    // Fetch models by reputation tag
    useEffect(() => {
        if (!selectedTag) {
            setTagModelIds([]);
            return;
        }

        const fetchTagModels = async () => {
            setIsLoadingTagModels(true);
            try {
                const res = await fetch(`${API_URL}/reputation/models-by-tag/${encodeURIComponent(selectedTag)}`);
                const data = await res.json();
                if (data.models) {
                    setTagModelIds(data.models.map((m: any) => m.id));
                }
            } catch (err) {
                console.warn('Failed to fetch models by tag:', err);
                setTagModelIds([]);
            } finally {
                setIsLoadingTagModels(false);
            }
        };

        fetchTagModels();
    }, [selectedTag]);

    const toggleFavorite = useCallback((modelId: string) => {
        if (!modelId) return;
        setFavorites(prev => {
            const newFavs = prev.includes(modelId)
                ? prev.filter(f => f !== modelId)
                : [...prev, modelId];
            if (Platform.OS === 'web') {
                localStorage.setItem('favoriteModels', JSON.stringify(newFavs));
            }
            return newFavs;
        });
    }, []);

    const handleToggleModel = useCallback((model: Model) => {
        onToggleModel(model);
        if (!model.openrouterId) return;
        setRecentModels(prev => {
            const newRecent = [model.openrouterId, ...prev.filter(r => r !== model.openrouterId)].slice(0, 10);
            if (Platform.OS === 'web') {
                localStorage.setItem('recentModels', JSON.stringify(newRecent));
            }
            return newRecent;
        });
    }, [onToggleModel]);

    const { filteredModels, categories, ollamaModelsList } = useMemo(() => {
        // In decentralized mode, show Ollama models; in centralized, show OpenRouter models
        let filtered = models || [];

        // For decentralized mode, create model objects from available Ollama models
        const ollamaModels: Model[] = isDecentralized ? availableOllamaModels.map((m, idx) => ({
            id: 10000 + idx, // Use high IDs to avoid conflicts
            openrouterId: `ollama/${m.id}`,
            name: `${m.name} (${m.nodeCount} node${m.nodeCount !== 1 ? 's' : ''} | ${m.avgLatencyMs}ms)`,
            contextLength: 8192, // Default for most Ollama models
            publicPricingPrompt: 0, // Free!
            publicPricingCompletion: 0,
            architecture: {
                modality: 'text',
            },
        })) : [];

        // In decentralized mode, use Ollama models
        if (isDecentralized) {
            filtered = ollamaModels;
        }

        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                (m.name || '').toLowerCase().includes(query) ||
                (m.openrouterId || '').toLowerCase().includes(query)
            );
        }

        // Filter by reputation tag (community-driven categories) - only for centralized mode
        if (!isDecentralized && selectedTag && tagModelIds.length > 0) {
            filtered = filtered.filter(m => tagModelIds.includes(m.id));
        }

        // Helper functions for categorization
        const isImageGenerator = (m: Model) => {
            const outputMods = Array.isArray(m.architecture?.output_modalities) ? m.architecture?.output_modalities : [];
            return outputMods.includes('image');
        };

        const isThinkingModel = (m: Model) => {
            const id = (m.openrouterId || '').toLowerCase();
            const name = (m.name || '').toLowerCase();
            // Only true thinking/reasoning models by name pattern
            return id.includes('o1') || id.includes('o3') || id.includes('-r1') ||
                   id.includes('thinking') || id.includes('reasoner') ||
                   name.includes('thinking') || name.includes('reasoner') ||
                   (id.includes('deepseek') && id.includes('r1'));
        };

        const isVisionModel = (m: Model) => {
            const inputMods = Array.isArray(m.architecture?.input_modalities) ? m.architecture?.input_modalities : [];
            const outputMods = Array.isArray(m.architecture?.output_modalities) ? m.architecture?.output_modalities : [];
            return inputMods.includes('image') && !outputMods.includes('image');
        };

        if (activeCategory !== 'all') {
            filtered = filtered.filter(m => {
                switch (activeCategory) {
                    case 'image':
                        return isImageGenerator(m);
                    case 'reasoning':
                        return isThinkingModel(m);
                    case 'vision':
                        return isVisionModel(m);
                    case 'top-rated':
                        // Only models with ratings >= 3.5 and at least 2 ratings
                        return m.reputation && m.reputation.totalRatings >= 2 && m.reputation.averageScore >= 3.5;
                    case 'chat':
                    default:
                        return !isImageGenerator(m) && !isThinkingModel(m) && !isVisionModel(m);
                }
            });

            // Sort by reputation for top-rated category
            if (activeCategory === 'top-rated') {
                filtered = filtered.sort((a, b) => {
                    const aScore = a.reputation?.averageScore || 0;
                    const bScore = b.reputation?.averageScore || 0;
                    if (bScore !== aScore) return bScore - aScore;
                    // Secondary sort by number of ratings
                    const aRatings = a.reputation?.totalRatings || 0;
                    const bRatings = b.reputation?.totalRatings || 0;
                    return bRatings - aRatings;
                });
            }
        }

        const favModels = filtered.filter(m => favorites.includes(m.openrouterId || ''));
        const recentModelsList = recentModels
            .map(id => filtered.find(m => m.openrouterId === id))
            .filter((m): m is Model => m !== undefined);

        const imageModels = filtered.filter(isImageGenerator);
        const reasoningModels = filtered.filter(isThinkingModel);
        const visionModels = filtered.filter(isVisionModel);
        const chatModels = filtered.filter(m => !isImageGenerator(m) && !isThinkingModel(m) && !isVisionModel(m));

        return {
            filteredModels: filtered,
            categories: { favModels, recentModelsList, imageModels, reasoningModels, visionModels, chatModels },
            ollamaModelsList: ollamaModels
        };
    }, [models, searchQuery, activeCategory, favorites, recentModels, selectedTag, tagModelIds, isDecentralized, availableOllamaModels]);

    const categoryFilters: { id: Category; label: string; icon: any; color: string }[] = [
        { id: 'all', label: 'All', icon: Layers, color: theme.primary },
        { id: 'top-rated', label: 'Top Rated', icon: Star, color: '#FFD700' },
        { id: 'chat', label: 'Chat', icon: Sparkles, color: '#00BCD4' },
        { id: 'image', label: 'Image', icon: PenTool, color: '#E91E63' },
        { id: 'reasoning', label: 'Thinking', icon: Brain, color: '#9C27B0' },
        { id: 'vision', label: 'Vision', icon: Eye, color: '#FF9800' },
    ];

    const modalWidth = isDesktop ? Math.min(600, width * 0.8) : width;
    const modalHeight = isMobile ? height * 0.95 : height * 0.85;

    const getButtonText = () => {
        if (selectedModels.length === 0) return 'Select a Model';
        if (selectedModels.length === 1) {
            const name = selectedModels[0]?.name || 'Model';
            const displayName = name.includes('/') ? (name.split('/').pop() || name) : name;
            return `Use ${displayName}`;
        }
        return `Compare ${String(selectedModels.length)} Models`;
    };

    return (
        <Modal
            visible={visible}
            animationType="none"
            transparent
            statusBarTranslucent={Platform.OS === 'android'}
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, isMobile && { justifyContent: 'flex-end' }]}>
                <View style={[
                    styles.modalContainer,
                    {
                        width: modalWidth,
                        maxHeight: modalHeight,
                        height: isMobile ? modalHeight : undefined,
                    },
                    isMobile && {
                        borderRadius: 0,
                        borderTopLeftRadius: 24,
                        borderTopRightRadius: 24,
                        paddingBottom: Platform.OS === 'ios' ? 34 : 20
                    }
                ]}>
                    {/* Mobile Drag Handle */}
                    {isMobile && (
                        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
                            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                        </View>
                    )}

                    {/* Header */}
                    <View style={[styles.header, isMobile && { paddingTop: 8, paddingHorizontal: 16, paddingVertical: 12 }]}>
                        <View style={styles.headerLeft}>
                            {isDecentralized ? (
                                <Cpu size={isMobile ? 18 : 20} color={theme.primary} />
                            ) : (
                                <Sparkles size={isMobile ? 18 : 20} color={theme.primary} />
                            )}
                            <Text style={[styles.headerTitle, isMobile && { fontSize: 16 }]}>
                                {isDecentralized ? 'Ollama Models' : 'Select Models'}
                            </Text>
                            <View style={[styles.countBadge, { backgroundColor: 'rgba(0, 255, 65, 0.15)' }]}>
                                <Text style={[styles.countText, { color: theme.primary }]}>
                                    {String(isDecentralized ? availableOllamaModels.length : models.length)}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeButton, isMobile && { width: 32, height: 32 }]}>
                            <X color="#fff" size={isMobile ? 16 : 18} />
                        </TouchableOpacity>
                    </View>

                    {/* Decentralized Mode Banner */}
                    {isDecentralized && (
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: 'rgba(0, 200, 100, 0.12)',
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            gap: 10,
                            borderBottomWidth: 1,
                            borderBottomColor: 'rgba(255,255,255,0.06)'
                        }}>
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: networkHealth && networkHealth.healthyNodes > 0 ? '#4CAF50' : '#FF5722'
                            }} />
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, flex: 1 }}>
                                Decentralized Mode - {networkHealth?.healthyNodes || 0} nodes online
                            </Text>
                            <View style={{
                                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 8
                            }}>
                                <Text style={{ color: '#4CAF50', fontSize: 10, fontWeight: '700' }}>FREE</Text>
                            </View>
                        </View>
                    )}

                    {/* Search */}
                    <View style={[styles.searchContainer, isMobile && { paddingHorizontal: 12, paddingVertical: 8 }]}>
                        <View style={[styles.searchInputWrapper, isMobile && { paddingHorizontal: 10, paddingVertical: 8 }]}>
                            <Search size={isMobile ? 16 : 18} color="rgba(255,255,255,0.4)" />
                            <TextInput
                                placeholder="Search models..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                style={[styles.searchInput, isMobile && { fontSize: 14 }]}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery !== '' && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <X size={16} color="rgba(255,255,255,0.4)" />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Category Filters */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={[styles.filtersScroll, isMobile && { maxHeight: 44 }]}
                        contentContainerStyle={[styles.filtersContent, isMobile && { paddingHorizontal: 12, paddingVertical: 8 }]}
                    >
                        {categoryFilters.map(cat => {
                            const IconComponent = cat.icon;
                            const isActive = activeCategory === cat.id;
                            return (
                                <TouchableOpacity
                                    key={cat.id}
                                    onPress={() => setActiveCategory(cat.id)}
                                    style={[
                                        styles.filterButton,
                                        {
                                            backgroundColor: isActive ? `${cat.color}20` : 'rgba(255,255,255,0.03)',
                                            borderColor: isActive ? `${cat.color}40` : 'rgba(255,255,255,0.06)'
                                        },
                                        isMobile && { paddingHorizontal: 10, paddingVertical: 6, marginRight: 6 }
                                    ]}
                                >
                                    <IconComponent size={isMobile ? 12 : 14} color={isActive ? cat.color : 'rgba(255,255,255,0.5)'} />
                                    <Text style={[
                                        styles.filterText,
                                        { color: isActive ? cat.color : 'rgba(255,255,255,0.6)', fontWeight: isActive ? '600' : '400' },
                                        isMobile && { fontSize: 11 }
                                    ]}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Reputation Tags - Community-driven categories */}
                    <View style={[styles.tagFiltersContainer, isMobile && { paddingHorizontal: 12, paddingVertical: 8 }]}>
                        <View style={styles.tagFiltersHeader}>
                            <Award size={isMobile ? 12 : 14} color={theme.primary} />
                            <Text style={[styles.tagFiltersLabel, isMobile && { fontSize: 10 }]}>Community Ratings</Text>
                            {!isMobile && (
                                <TouchableOpacity
                                    onPress={() => {
                                        onClose();
                                        router.push('/reputation');
                                    }}
                                    style={styles.reputationLink}
                                >
                                    <Text style={[styles.reputationLinkText, { color: theme.primary }]}>Rate Models</Text>
                                    <ExternalLink size={12} color={theme.primary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={[styles.tagFiltersContent, isMobile && { gap: 4 }]}
                        >
                            {REPUTATION_TAGS.map(tag => {
                                const isActive = selectedTag === tag.id;
                                return (
                                    <TouchableOpacity
                                        key={tag.id}
                                        onPress={() => setSelectedTag(isActive ? null : tag.id)}
                                        style={[
                                            styles.tagFilterButton,
                                            {
                                                backgroundColor: isActive ? `${tag.color}20` : 'rgba(255,255,255,0.03)',
                                                borderColor: isActive ? `${tag.color}60` : 'rgba(255,255,255,0.08)'
                                            },
                                            isMobile && { paddingHorizontal: 8, paddingVertical: 4 }
                                        ]}
                                    >
                                        <Text style={[styles.tagFilterEmoji, isMobile && { fontSize: 10 }]}>{tag.emoji}</Text>
                                        <Text style={[
                                            styles.tagFilterText,
                                            { color: isActive ? tag.color : 'rgba(255,255,255,0.6)' },
                                            isMobile && { fontSize: 10 }
                                        ]}>
                                            {tag.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>

                    {/* Active Tag Filter Banner */}
                    {selectedTag && (
                        <View style={[
                            styles.activeTagBanner,
                            { backgroundColor: `${REPUTATION_TAGS.find(t => t.id === selectedTag)?.color}15` }
                        ]}>
                            <View style={styles.activeTagBannerContent}>
                                <Text style={styles.activeTagBannerEmoji}>
                                    {REPUTATION_TAGS.find(t => t.id === selectedTag)?.emoji}
                                </Text>
                                <View>
                                    <Text style={[
                                        styles.activeTagBannerTitle,
                                        { color: REPUTATION_TAGS.find(t => t.id === selectedTag)?.color }
                                    ]}>
                                        Best for {REPUTATION_TAGS.find(t => t.id === selectedTag)?.label}
                                    </Text>
                                    <Text style={styles.activeTagBannerSubtitle}>
                                        {isLoadingTagModels
                                            ? 'Loading...'
                                            : tagModelIds.length > 0
                                                ? `${tagModelIds.length} model${tagModelIds.length !== 1 ? 's' : ''} recommended by the community`
                                                : 'No models rated yet - be the first!'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setSelectedTag(null)}
                                style={styles.activeTagBannerClose}
                            >
                                <X size={16} color="rgba(255,255,255,0.6)" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Selected Models Strip */}
                    {selectedModels.length > 0 && (
                        <View style={styles.selectedStrip}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {selectedModels.map(model => {
                                    const name = model.name || 'Model';
                                    const displayName = name.includes('/') ? (name.split('/').pop() || name) : name;
                                    return (
                                        <TouchableOpacity
                                            key={model.id}
                                            onPress={() => onToggleModel(model)}
                                            style={styles.selectedChip}
                                        >
                                            <ModelLogo modelId={model.openrouterId} iconUrl={model.iconUrl} size={18} theme={theme} />
                                            <Text style={[styles.selectedChipText, { color: theme.primary }]}>
                                                {displayName}
                                            </Text>
                                            <X size={12} color={theme.primary} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Model List */}
                    <ScrollView style={styles.modelList} showsVerticalScrollIndicator={false}>
                        {!contentReady ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Loading models...</Text>
                            </View>
                        ) : null}

                        {/* Decentralized Mode - Show Ollama Models */}
                        {contentReady && isDecentralized && (
                            <>
                                {ollamaModelsList.length > 0 ? (
                                    <CategorySection
                                        title="Ollama Models"
                                        icon={Cpu}
                                        color="#4CAF50"
                                        models={filteredModels}
                                        selectedModels={selectedModels}
                                        onToggleModel={handleToggleModel}
                                        theme={theme}
                                        favorites={favorites}
                                        onToggleFavorite={toggleFavorite}
                                    />
                                ) : (
                                    <View style={styles.emptyState}>
                                        <Cpu size={40} color="rgba(255,255,255,0.2)" />
                                        <Text style={styles.emptyText}>
                                            {'No Ollama models available\non the network'}
                                        </Text>
                                        <Text style={{ color: 'rgba(255,255,255,0.3)', marginTop: 8, fontSize: 12, textAlign: 'center' }}>
                                            Check back later or switch to Centralized mode
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}

                        {/* Centralized Mode - Show OpenRouter Models */}
                        {contentReady && !isDecentralized && categories.favModels.length > 0 && activeCategory === 'all' && (
                            <CategorySection
                                title="Favorites"
                                icon={Star}
                                color="#FFC107"
                                models={categories.favModels}
                                selectedModels={selectedModels}
                                onToggleModel={handleToggleModel}
                                theme={theme}
                                favorites={favorites}
                                onToggleFavorite={toggleFavorite}
                            />
                        )}

                        {contentReady && !isDecentralized && categories.recentModelsList.length > 0 && activeCategory === 'all' && searchQuery === '' && (
                            <CategorySection
                                title="Recently Used"
                                icon={Clock}
                                color="#00BCD4"
                                models={categories.recentModelsList.slice(0, 5)}
                                selectedModels={selectedModels}
                                onToggleModel={handleToggleModel}
                                theme={theme}
                                favorites={favorites}
                                onToggleFavorite={toggleFavorite}
                                defaultExpanded={false}
                            />
                        )}

                        {contentReady && !isDecentralized && (activeCategory === 'all' || activeCategory === 'image') && categories.imageModels.length > 0 && (
                            <CategorySection
                                title="Image Generation"
                                icon={PenTool}
                                color="#E91E63"
                                models={categories.imageModels}
                                selectedModels={selectedModels}
                                onToggleModel={handleToggleModel}
                                theme={theme}
                                favorites={favorites}
                                onToggleFavorite={toggleFavorite}
                                defaultExpanded={activeCategory === 'image'}
                            />
                        )}

                        {contentReady && !isDecentralized && (activeCategory === 'all' || activeCategory === 'reasoning') && categories.reasoningModels.length > 0 && (
                            <CategorySection
                                title="Thinking Models"
                                icon={Brain}
                                color="#9C27B0"
                                models={categories.reasoningModels}
                                selectedModels={selectedModels}
                                onToggleModel={handleToggleModel}
                                theme={theme}
                                favorites={favorites}
                                onToggleFavorite={toggleFavorite}
                                defaultExpanded={activeCategory === 'reasoning'}
                            />
                        )}

                        {contentReady && !isDecentralized && (activeCategory === 'all' || activeCategory === 'vision') && categories.visionModels.length > 0 && (
                            <CategorySection
                                title="Vision Models"
                                icon={Eye}
                                color="#FF9800"
                                models={categories.visionModels}
                                selectedModels={selectedModels}
                                onToggleModel={handleToggleModel}
                                theme={theme}
                                favorites={favorites}
                                onToggleFavorite={toggleFavorite}
                                defaultExpanded={activeCategory === 'vision'}
                            />
                        )}

                        {contentReady && !isDecentralized && (activeCategory === 'all' || activeCategory === 'chat') && (
                            <CategorySection
                                title="Chat Models"
                                icon={Sparkles}
                                color="#00BCD4"
                                models={categories.chatModels}
                                selectedModels={selectedModels}
                                onToggleModel={handleToggleModel}
                                theme={theme}
                                favorites={favorites}
                                onToggleFavorite={toggleFavorite}
                            />
                        )}

                        {contentReady && !isDecentralized && filteredModels.length === 0 && (
                            <View style={styles.emptyState}>
                                <Search size={40} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyText}>
                                    {'No models found'}
                                </Text>
                            </View>
                        )}

                        <View style={{ height: 100 }} />
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={[styles.confirmButton, { backgroundColor: theme.primary }]}
                        >
                            <Sparkles size={18} color="#000" />
                            <Text style={styles.confirmButtonText}>{getButtonText()}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    modalContainer: {
        backgroundColor: '#0d0d0d',
        borderRadius: 20,
        overflow: 'hidden',
        ...(Platform.OS === 'web' ? { boxShadow: '0 20px 60px rgba(0,0,0,0.6)' } : { elevation: 20 })
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)'
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginLeft: 12
    },
    countBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 12
    },
    countText: {
        fontSize: 12,
        fontWeight: '600'
    },
    closeButton: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10
    },
    searchContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)'
    },
    searchInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 15,
        marginLeft: 10,
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})
    },
    filtersScroll: {
        maxHeight: 50,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)'
    },
    filtersContent: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row'
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8
    },
    filterText: {
        fontSize: 13,
        marginLeft: 6
    },
    // Reputation Tag Filters
    tagFiltersContainer: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)',
        backgroundColor: 'rgba(255,255,255,0.02)'
    },
    tagFiltersHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 6
    },
    tagFiltersLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
        flex: 1
    },
    reputationLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 255, 65, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(0, 255, 65, 0.2)'
    },
    reputationLinkText: {
        fontSize: 11,
        fontWeight: '600'
    },
    tagFiltersContent: {
        flexDirection: 'row',
        gap: 6
    },
    tagFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        borderWidth: 1,
        gap: 4
    },
    tagFilterEmoji: {
        fontSize: 12
    },
    tagFilterText: {
        fontSize: 11,
        fontWeight: '500'
    },
    // Active Tag Banner
    activeTagBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)'
    },
    activeTagBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1
    },
    activeTagBannerEmoji: {
        fontSize: 24
    },
    activeTagBannerTitle: {
        fontSize: 14,
        fontWeight: '700'
    },
    activeTagBannerSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2
    },
    activeTagBannerClose: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)'
    },
    selectedStrip: {
        padding: 12,
        backgroundColor: 'rgba(0, 255, 65, 0.05)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.04)'
    },
    selectedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 255, 65, 0.15)',
        paddingLeft: 6,
        paddingRight: 10,
        paddingVertical: 6,
        borderRadius: 16,
        marginRight: 8
    },
    selectedChipText: {
        fontSize: 12,
        fontWeight: '500',
        marginHorizontal: 6
    },
    modelList: {
        flex: 1
    },
    emptyState: {
        padding: 40,
        alignItems: 'center'
    },
    emptyText: {
        color: 'rgba(255,255,255,0.4)',
        marginTop: 16,
        fontSize: 14
    },
    footer: {
        padding: 16,
        backgroundColor: 'rgba(10, 10, 10, 0.95)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)'
    },
    confirmButton: {
        paddingVertical: 14,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center'
    },
    confirmButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
        marginLeft: 10
    }
});
