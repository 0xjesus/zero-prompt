import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    Image,
    Platform,
    useWindowDimensions,
    StyleSheet,
    ActivityIndicator,
    Linking,
    Share as RNShare,
    StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    X, Image as ImageIcon, Download, Share2, ChevronLeft, ChevronRight,
    Calendar, Cpu, MessageSquare, Sparkles, Grid, ExternalLink
} from 'lucide-react-native';
import { API_URL } from '../config/api';

type GalleryImage = {
    id: string;
    url: string;
    model: string;
    prompt: string;
    conversationId: string;
    conversationTitle: string;
    createdAt: string;
    source: 'tool' | 'ai-model';
};

interface ImageGalleryModalProps {
    visible: boolean;
    onClose: () => void;
    theme: any;
    getHeaders: () => any;
    onNavigateToChat: (conversationId: string) => void;
}

const FONT_MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// Utility function to download image
export const downloadImage = async (url: string, filename?: string) => {
    if (Platform.OS === 'web') {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || `zeroprompt-image-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            return true;
        } catch (err) {
            console.error('Download failed:', err);
            window.open(url, '_blank');
            return false;
        }
    } else {
        // On native, open in browser to allow user to save
        try {
            await Linking.openURL(url);
            return true;
        } catch (err) {
            console.error('Failed to open image:', err);
            return false;
        }
    }
};

// Utility function to share image
export const shareImage = async (url: string, prompt?: string) => {
    if (Platform.OS === 'web') {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'ZeroPrompt Generated Image',
                    text: prompt || 'Check out this AI-generated image!',
                    url: url
                });
                return true;
            } catch (err) {
                return false;
            }
        } else {
            try {
                await navigator.clipboard.writeText(url);
                return true;
            } catch {
                return false;
            }
        }
    } else {
        try {
            await RNShare.share({
                message: prompt ? `${prompt}\n\n${url}` : url,
                url: url
            });
            return true;
        } catch (err) {
            return false;
        }
    }
};

export default function ImageGalleryModal({
    visible,
    onClose,
    theme,
    getHeaders,
    onNavigateToChat
}: ImageGalleryModalProps) {
    const { width, height } = useWindowDimensions();
    const isDesktop = width > 768;
    const isMobile = width < 600;
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
    const [imageIndex, setImageIndex] = useState(0);
    const [downloading, setDownloading] = useState(false);

    const loadImages = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/llm/images`, {
                headers: getHeaders()
            });
            if (!res.ok) {
                throw new Error('Failed to load images');
            }
            const data = await res.json();
            setImages(data.images || []);
        } catch (err: any) {
            console.error('Failed to load images:', err);
            setError(err.message || 'Failed to load images');
        } finally {
            setLoading(false);
        }
    }, [getHeaders]);

    useEffect(() => {
        if (visible) {
            loadImages();
        }
    }, [visible, loadImages]);

    const openImageViewer = (image: GalleryImage, index: number) => {
        setSelectedImage(image);
        setImageIndex(index);
    };

    const closeImageViewer = () => {
        setSelectedImage(null);
    };

    const navigatePrev = () => {
        if (imageIndex > 0) {
            const newIndex = imageIndex - 1;
            setImageIndex(newIndex);
            setSelectedImage(images[newIndex]);
        }
    };

    const navigateNext = () => {
        if (imageIndex < images.length - 1) {
            const newIndex = imageIndex + 1;
            setImageIndex(newIndex);
            setSelectedImage(images[newIndex]);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    const getModelName = (modelId: string) => {
        if (!modelId) return 'AI';
        const parts = modelId.split('/');
        const name = parts[parts.length - 1] || modelId;
        // Shorten for mobile
        if (isMobile && name.length > 12) {
            return name.substring(0, 10) + '..';
        }
        return name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getModelColor = (modelId: string) => {
        if (modelId?.includes('dall-e')) return '#10B981';
        if (modelId?.includes('midjourney')) return '#8B5CF6';
        if (modelId?.includes('stable')) return '#F59E0B';
        if (modelId?.includes('flux')) return '#EC4899';
        return '#00FF41';
    };

    const handleDownload = async (image: GalleryImage) => {
        setDownloading(true);
        await downloadImage(image.url);
        setDownloading(false);
    };

    const handleShare = async (image: GalleryImage) => {
        await shareImage(image.url, image.prompt);
    };

    const gridColumns = isMobile ? 2 : isDesktop ? 4 : 3;
    const gridGap = isMobile ? 6 : 12;
    const padding = isMobile ? 8 : 16;
    const imageSize = (width - padding * 2 - (gridColumns - 1) * gridGap) / gridColumns;

    // Full screen modal for mobile
    if (isMobile) {
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
                <SafeAreaView style={styles.mobileContainer}>
                    <StatusBar barStyle="light-content" />

                    {/* Header */}
                    <View style={styles.mobileHeader}>
                        <View style={styles.mobileHeaderLeft}>
                            <Sparkles size={20} color="#00FF41" />
                            <Text style={styles.mobileHeaderTitle}>Gallery</Text>
                            <View style={styles.mobileBadge}>
                                <Text style={styles.mobileBadgeText}>{images.length}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.mobileCloseBtn}>
                            <X color="#fff" size={24} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView
                        style={styles.mobileContent}
                        contentContainerStyle={{ padding }}
                        showsVerticalScrollIndicator={false}
                    >
                        {loading && (
                            <View style={styles.centerState}>
                                <ActivityIndicator size="large" color="#00FF41" />
                                <Text style={styles.stateText}>Loading...</Text>
                            </View>
                        )}

                        {error && (
                            <View style={styles.centerState}>
                                <Text style={styles.errorText}>{error}</Text>
                                <TouchableOpacity onPress={loadImages} style={styles.retryBtn}>
                                    <Text style={styles.retryText}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {!loading && !error && images.length === 0 && (
                            <View style={styles.centerState}>
                                <ImageIcon size={40} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyTitle}>No images yet</Text>
                                <Text style={styles.stateText}>Generate images to see them here</Text>
                            </View>
                        )}

                        {!loading && !error && images.length > 0 && (
                            <View style={[styles.grid, { gap: gridGap }]}>
                                {images.map((image, index) => (
                                    <TouchableOpacity
                                        key={image.id}
                                        style={[styles.mobileCard, { width: imageSize }]}
                                        onPress={() => openImageViewer(image, index)}
                                        activeOpacity={0.8}
                                    >
                                        <Image
                                            source={{ uri: image.url }}
                                            style={[styles.mobileThumb, { width: imageSize, height: imageSize }]}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.mobileCardInfo}>
                                            <Text style={[styles.mobileModelText, { color: getModelColor(image.model) }]} numberOfLines={1}>
                                                {getModelName(image.model)}
                                            </Text>
                                            <Text style={styles.mobileDateText}>{formatDate(image.createdAt)}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                        <View style={{ height: 20 }} />
                    </ScrollView>

                    {/* Mobile Image Viewer */}
                    {selectedImage && (
                        <View style={styles.mobileViewer}>
                            {/* Close bar */}
                            <View style={styles.mobileViewerHeader}>
                                <Text style={styles.mobileViewerCounter}>{imageIndex + 1} / {images.length}</Text>
                                <TouchableOpacity onPress={closeImageViewer} style={styles.mobileViewerClose}>
                                    <X color="#fff" size={24} />
                                </TouchableOpacity>
                            </View>

                            {/* Image */}
                            <View style={styles.mobileImageContainer}>
                                {imageIndex > 0 && (
                                    <TouchableOpacity style={styles.mobileNavLeft} onPress={navigatePrev}>
                                        <ChevronLeft size={32} color="#fff" />
                                    </TouchableOpacity>
                                )}
                                <Image
                                    source={{ uri: selectedImage.url }}
                                    style={styles.mobileFullImage}
                                    resizeMode="contain"
                                />
                                {imageIndex < images.length - 1 && (
                                    <TouchableOpacity style={styles.mobileNavRight} onPress={navigateNext}>
                                        <ChevronRight size={32} color="#fff" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Info & Actions */}
                            <View style={styles.mobileViewerInfo}>
                                <View style={styles.mobileViewerMeta}>
                                    <View style={[styles.mobileModelBadge, { backgroundColor: `${getModelColor(selectedImage.model)}20` }]}>
                                        <Cpu size={12} color={getModelColor(selectedImage.model)} />
                                        <Text style={[styles.mobileModelBadgeText, { color: getModelColor(selectedImage.model) }]}>
                                            {getModelName(selectedImage.model)}
                                        </Text>
                                    </View>
                                    <Text style={styles.mobileViewerDate}>{formatDate(selectedImage.createdAt)}</Text>
                                </View>

                                {selectedImage.prompt && (
                                    <Text style={styles.mobilePrompt} numberOfLines={2}>{selectedImage.prompt}</Text>
                                )}

                                {/* Action Buttons */}
                                <View style={styles.mobileActions}>
                                    <TouchableOpacity
                                        style={styles.mobileActionBtn}
                                        onPress={() => handleShare(selectedImage)}
                                    >
                                        <Share2 size={20} color="#8B5CF6" />
                                        <Text style={[styles.mobileActionText, { color: '#8B5CF6' }]}>Share</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.mobileActionBtn, styles.mobileActionPrimary]}
                                        onPress={() => handleDownload(selectedImage)}
                                        disabled={downloading}
                                    >
                                        {downloading ? (
                                            <ActivityIndicator size="small" color="#000" />
                                        ) : (
                                            <Download size={20} color="#000" />
                                        )}
                                        <Text style={styles.mobileActionTextPrimary}>
                                            {downloading ? 'Saving...' : 'Download'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Go to chat */}
                                {selectedImage.conversationId && (
                                    <TouchableOpacity
                                        style={styles.mobileChatLink}
                                        onPress={() => {
                                            closeImageViewer();
                                            onClose();
                                            onNavigateToChat(selectedImage.conversationId);
                                        }}
                                    >
                                        <MessageSquare size={16} color="#00FF41" />
                                        <Text style={styles.mobileChatLinkText}>View in chat</Text>
                                        <ExternalLink size={14} color="rgba(255,255,255,0.3)" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                </SafeAreaView>
            </Modal>
        );
    }

    // Desktop/Tablet view
    return (
        <Modal visible={visible} animationType="fade" transparent>
            <View style={styles.overlay}>
                <View style={[styles.desktopModal, { width: Math.min(1000, width * 0.9), maxHeight: height * 0.9 }]}>
                    {/* Header */}
                    <View style={styles.desktopHeader}>
                        <View style={styles.desktopHeaderLeft}>
                            <View style={styles.desktopIconWrap}>
                                <Sparkles size={22} color="#00FF41" />
                            </View>
                            <View>
                                <Text style={styles.desktopTitle}>Image Gallery</Text>
                                <Text style={styles.desktopSubtitle}>Your AI creations</Text>
                            </View>
                        </View>
                        <View style={styles.desktopHeaderRight}>
                            <View style={styles.desktopBadge}>
                                <Grid size={14} color="#00FF41" />
                                <Text style={styles.desktopBadgeText}>{images.length}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} style={styles.desktopCloseBtn}>
                                <X color="#fff" size={20} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Content */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
                        {loading && (
                            <View style={styles.centerState}>
                                <ActivityIndicator size="large" color="#00FF41" />
                                <Text style={styles.stateText}>Loading your gallery...</Text>
                            </View>
                        )}

                        {error && (
                            <View style={styles.centerState}>
                                <Text style={styles.errorText}>{error}</Text>
                                <TouchableOpacity onPress={loadImages} style={styles.retryBtn}>
                                    <Text style={styles.retryText}>Try Again</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {!loading && !error && images.length === 0 && (
                            <View style={styles.centerState}>
                                <ImageIcon size={48} color="rgba(255,255,255,0.15)" />
                                <Text style={styles.emptyTitle}>No images yet</Text>
                                <Text style={styles.stateText}>Start generating images with AI models</Text>
                            </View>
                        )}

                        {!loading && !error && images.length > 0 && (
                            <View style={[styles.grid, { gap: gridGap }]}>
                                {images.map((image, index) => (
                                    <TouchableOpacity
                                        key={image.id}
                                        style={[styles.desktopCard, { width: imageSize }]}
                                        onPress={() => openImageViewer(image, index)}
                                        activeOpacity={0.85}
                                    >
                                        <Image
                                            source={{ uri: image.url }}
                                            style={[styles.desktopThumb, { height: imageSize }]}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.desktopCardInfo}>
                                            <View style={[styles.desktopModelBadge, { backgroundColor: `${getModelColor(image.model)}15` }]}>
                                                <Text style={[styles.desktopModelText, { color: getModelColor(image.model) }]} numberOfLines={1}>
                                                    {getModelName(image.model)}
                                                </Text>
                                            </View>
                                            <Text style={styles.desktopDateText}>{formatDate(image.createdAt)}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* Desktop Image Viewer */}
                {selectedImage && (
                    <View style={styles.viewerOverlay}>
                        <TouchableOpacity style={styles.viewerBackdrop} onPress={closeImageViewer} activeOpacity={1} />

                        <View style={styles.desktopViewer}>
                            {/* Top bar */}
                            <View style={styles.desktopViewerHeader}>
                                <Text style={styles.desktopViewerCounter}>{imageIndex + 1} of {images.length}</Text>
                                <View style={styles.desktopViewerActions}>
                                    <TouchableOpacity style={styles.desktopViewerBtn} onPress={() => handleShare(selectedImage)}>
                                        <Share2 size={18} color="#8B5CF6" />
                                        <Text style={[styles.desktopViewerBtnText, { color: '#8B5CF6' }]}>Share</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.desktopViewerBtn, { backgroundColor: 'rgba(0,255,65,0.15)', borderColor: 'rgba(0,255,65,0.3)' }]}
                                        onPress={() => handleDownload(selectedImage)}
                                    >
                                        {downloading ? (
                                            <ActivityIndicator size="small" color="#00FF41" />
                                        ) : (
                                            <Download size={18} color="#00FF41" />
                                        )}
                                        <Text style={[styles.desktopViewerBtnText, { color: '#00FF41' }]}>Download</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.desktopViewerCloseBtn} onPress={closeImageViewer}>
                                        <X size={22} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Image with nav */}
                            <View style={styles.desktopImageWrap}>
                                {imageIndex > 0 && (
                                    <TouchableOpacity style={[styles.desktopNav, { left: 20 }]} onPress={navigatePrev}>
                                        <ChevronLeft size={28} color="#fff" />
                                    </TouchableOpacity>
                                )}
                                <Image
                                    source={{ uri: selectedImage.url }}
                                    style={styles.desktopFullImage}
                                    resizeMode="contain"
                                />
                                {imageIndex < images.length - 1 && (
                                    <TouchableOpacity style={[styles.desktopNav, { right: 20 }]} onPress={navigateNext}>
                                        <ChevronRight size={28} color="#fff" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Info panel */}
                            <View style={styles.desktopInfoPanel}>
                                <View style={styles.desktopInfoHeader}>
                                    <View style={[styles.desktopInfoModelBadge, { backgroundColor: `${getModelColor(selectedImage.model)}15` }]}>
                                        <Cpu size={14} color={getModelColor(selectedImage.model)} />
                                        <Text style={[styles.desktopInfoModelText, { color: getModelColor(selectedImage.model) }]}>
                                            {getModelName(selectedImage.model)}
                                        </Text>
                                    </View>
                                    <View style={styles.desktopInfoDate}>
                                        <Calendar size={12} color="rgba(255,255,255,0.4)" />
                                        <Text style={styles.desktopInfoDateText}>{formatDate(selectedImage.createdAt)}</Text>
                                    </View>
                                </View>

                                {selectedImage.prompt && (
                                    <View style={styles.desktopPromptSection}>
                                        <Text style={styles.desktopPromptLabel}>PROMPT</Text>
                                        <Text style={styles.desktopPromptText}>{selectedImage.prompt}</Text>
                                    </View>
                                )}

                                {selectedImage.conversationId && (
                                    <TouchableOpacity
                                        style={styles.desktopChatLink}
                                        onPress={() => {
                                            closeImageViewer();
                                            onClose();
                                            onNavigateToChat(selectedImage.conversationId);
                                        }}
                                    >
                                        <MessageSquare size={16} color="#00FF41" />
                                        <Text style={styles.desktopChatLinkText}>View in conversation</Text>
                                        <ExternalLink size={14} color="rgba(255,255,255,0.3)" />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    // Mobile styles
    mobileContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a'
    },
    mobileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)'
    },
    mobileHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    mobileHeaderTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        fontFamily: FONT_MONO
    },
    mobileBadge: {
        backgroundColor: 'rgba(0,255,65,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10
    },
    mobileBadgeText: {
        color: '#00FF41',
        fontSize: 12,
        fontWeight: '700',
        fontFamily: FONT_MONO
    },
    mobileCloseBtn: {
        padding: 8
    },
    mobileContent: {
        flex: 1
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap'
    },
    mobileCard: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#111',
        marginBottom: 6
    },
    mobileThumb: {
        backgroundColor: '#1a1a1a'
    },
    mobileCardInfo: {
        padding: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    mobileModelText: {
        fontSize: 10,
        fontWeight: '600',
        fontFamily: FONT_MONO
    },
    mobileDateText: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 9
    },
    // Mobile Viewer
    mobileViewer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000'
    },
    mobileViewerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 12
    },
    mobileViewerCounter: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontFamily: FONT_MONO
    },
    mobileViewerClose: {
        padding: 8
    },
    mobileImageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    mobileFullImage: {
        width: '100%',
        height: '100%'
    },
    mobileNavLeft: {
        position: 'absolute',
        left: 8,
        top: '50%',
        marginTop: -24,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10
    },
    mobileNavRight: {
        position: 'absolute',
        right: 8,
        top: '50%',
        marginTop: -24,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10
    },
    mobileViewerInfo: {
        backgroundColor: '#0a0a0a',
        padding: 16,
        paddingBottom: 32,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20
    },
    mobileViewerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    mobileModelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8
    },
    mobileModelBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        fontFamily: FONT_MONO
    },
    mobileViewerDate: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12
    },
    mobilePrompt: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        lineHeight: 20,
        marginBottom: 16
    },
    mobileActions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16
    },
    mobileActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    mobileActionPrimary: {
        backgroundColor: '#00FF41',
        borderColor: '#00FF41'
    },
    mobileActionText: {
        fontSize: 14,
        fontWeight: '600'
    },
    mobileActionTextPrimary: {
        color: '#000',
        fontSize: 14,
        fontWeight: '700'
    },
    mobileChatLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(0,255,65,0.08)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0,255,65,0.15)'
    },
    mobileChatLinkText: {
        color: '#00FF41',
        fontSize: 13,
        fontWeight: '600',
        flex: 1
    },
    // Shared states
    centerState: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center'
    },
    stateText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 14,
        marginTop: 12,
        textAlign: 'center'
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16
    },
    errorText: {
        color: '#ff4444',
        fontSize: 14,
        marginBottom: 16
    },
    retryBtn: {
        backgroundColor: 'rgba(0,255,65,0.15)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8
    },
    retryText: {
        color: '#00FF41',
        fontWeight: '600'
    },
    // Desktop styles
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    desktopModal: {
        backgroundColor: '#0d0d0d',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        ...(Platform.OS === 'web' ? { boxShadow: '0 25px 80px rgba(0,0,0,0.6)' } : {})
    },
    desktopHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)'
    },
    desktopHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14
    },
    desktopIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: 'rgba(0,255,65,0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    desktopTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        fontFamily: FONT_MONO
    },
    desktopSubtitle: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginTop: 2
    },
    desktopHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    desktopBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,255,65,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16
    },
    desktopBadgeText: {
        color: '#00FF41',
        fontSize: 13,
        fontWeight: '700',
        fontFamily: FONT_MONO
    },
    desktopCloseBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10
    },
    desktopCard: {
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)'
    },
    desktopThumb: {
        width: '100%',
        backgroundColor: '#1a1a1a'
    },
    desktopCardInfo: {
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    desktopModelBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    desktopModelText: {
        fontSize: 11,
        fontWeight: '600',
        fontFamily: FONT_MONO
    },
    desktopDateText: {
        color: 'rgba(255,255,255,0.35)',
        fontSize: 11
    },
    // Desktop Viewer
    viewerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center'
    },
    viewerBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.95)'
    },
    desktopViewer: {
        alignItems: 'center',
        width: '90%',
        maxWidth: 900
    },
    desktopViewerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingVertical: 16
    },
    desktopViewerCounter: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        fontFamily: FONT_MONO
    },
    desktopViewerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    desktopViewerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    desktopViewerBtnText: {
        fontSize: 13,
        fontWeight: '600'
    },
    desktopViewerCloseBtn: {
        width: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        marginLeft: 8
    },
    desktopImageWrap: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
    },
    desktopFullImage: {
        width: '100%',
        height: 450,
        borderRadius: 12
    },
    desktopNav: {
        position: 'absolute',
        top: '50%',
        marginTop: -24,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10
    },
    desktopInfoPanel: {
        backgroundColor: 'rgba(20,20,20,0.95)',
        borderRadius: 14,
        padding: 18,
        marginTop: 16,
        width: '100%',
        maxWidth: 600
    },
    desktopInfoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14
    },
    desktopInfoModelBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8
    },
    desktopInfoModelText: {
        fontSize: 13,
        fontWeight: '600',
        fontFamily: FONT_MONO
    },
    desktopInfoDate: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    desktopInfoDateText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12
    },
    desktopPromptSection: {
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)'
    },
    desktopPromptLabel: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 10,
        fontWeight: '600',
        fontFamily: FONT_MONO,
        letterSpacing: 1,
        marginBottom: 6
    },
    desktopPromptText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        lineHeight: 22
    },
    desktopChatLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)'
    },
    desktopChatLinkText: {
        color: '#00FF41',
        fontSize: 13,
        fontWeight: '600',
        flex: 1
    }
});
