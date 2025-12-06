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
    ChevronDown, ChevronRight, Star, Clock, Layers, Gift
} from 'lucide-react-native';

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

type Category = 'all' | 'chat' | 'image' | 'reasoning' | 'vision' | 'free' | 'top-rated';

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
    const { width, height } = useWindowDimensions();
    const isDesktop = width > 768;
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<Category>('all');
    const [favorites, setFavorites] = useState<string[]>([]);
    const [recentModels, setRecentModels] = useState<string[]>([]);

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

    const { filteredModels, categories } = useMemo(() => {
        let filtered = models || [];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(m =>
                (m.name || '').toLowerCase().includes(query) ||
                (m.openrouterId || '').toLowerCase().includes(query)
            );
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
                    case 'free':
                        return (m.publicPricingPrompt || 0) === 0;
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
            categories: { favModels, recentModelsList, imageModels, reasoningModels, visionModels, chatModels }
        };
    }, [models, searchQuery, activeCategory, favorites, recentModels]);

    const categoryFilters: { id: Category; label: string; icon: any; color: string }[] = [
        { id: 'all', label: 'All', icon: Layers, color: theme.primary },
        { id: 'top-rated', label: 'Top Rated', icon: Star, color: '#FFD700' },
        { id: 'chat', label: 'Chat', icon: Sparkles, color: '#00BCD4' },
        { id: 'image', label: 'Image', icon: PenTool, color: '#E91E63' },
        { id: 'reasoning', label: 'Thinking', icon: Brain, color: '#9C27B0' },
        { id: 'vision', label: 'Vision', icon: Eye, color: '#FF9800' },
        { id: 'free', label: 'Free', icon: Gift, color: '#4CAF50' },
    ];

    const modalWidth = isDesktop ? Math.min(600, width * 0.8) : width;
    const modalHeight = height * 0.85;

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
        <Modal visible={visible} animationType="fade" transparent>
            <View style={styles.overlay}>
                <View style={[
                    styles.modalContainer,
                    {
                        width: modalWidth,
                        maxHeight: modalHeight,
                    }
                ]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Sparkles size={20} color={theme.primary} />
                            <Text style={styles.headerTitle}>Select Models</Text>
                            <View style={[styles.countBadge, { backgroundColor: 'rgba(0, 255, 65, 0.15)' }]}>
                                <Text style={[styles.countText, { color: theme.primary }]}>
                                    {String(models.length)}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X color="#fff" size={18} />
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInputWrapper}>
                            <Search size={18} color="rgba(255,255,255,0.4)" />
                            <TextInput
                                placeholder="Search models..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                                style={styles.searchInput}
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
                        style={styles.filtersScroll}
                        contentContainerStyle={styles.filtersContent}
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
                                        }
                                    ]}
                                >
                                    <IconComponent size={14} color={isActive ? cat.color : 'rgba(255,255,255,0.5)'} />
                                    <Text style={[
                                        styles.filterText,
                                        { color: isActive ? cat.color : 'rgba(255,255,255,0.6)', fontWeight: isActive ? '600' : '400' }
                                    ]}>
                                        {cat.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

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
                        {categories.favModels.length > 0 && activeCategory === 'all' && (
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

                        {categories.recentModelsList.length > 0 && activeCategory === 'all' && searchQuery === '' && (
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

                        {(activeCategory === 'all' || activeCategory === 'image') && categories.imageModels.length > 0 && (
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

                        {(activeCategory === 'all' || activeCategory === 'reasoning') && categories.reasoningModels.length > 0 && (
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

                        {(activeCategory === 'all' || activeCategory === 'vision') && categories.visionModels.length > 0 && (
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

                        {(activeCategory === 'all' || activeCategory === 'chat' || activeCategory === 'free') && (
                            <CategorySection
                                title="Chat Models"
                                icon={Sparkles}
                                color="#00BCD4"
                                models={activeCategory === 'free'
                                    ? categories.chatModels.filter(m => (m.publicPricingPrompt || 0) === 0)
                                    : categories.chatModels
                                }
                                selectedModels={selectedModels}
                                onToggleModel={handleToggleModel}
                                theme={theme}
                                favorites={favorites}
                                onToggleFavorite={toggleFavorite}
                            />
                        )}

                        {filteredModels.length === 0 && (
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
