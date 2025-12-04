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
    ActivityIndicator
} from 'react-native';
import {
    X, Image as ImageIcon, ExternalLink, ChevronLeft, ChevronRight, Calendar, Cpu, MessageSquare
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

export default function ImageGalleryModal({
    visible,
    onClose,
    theme,
    getHeaders,
    onNavigateToChat
}: ImageGalleryModalProps) {
    const { width, height } = useWindowDimensions();
    const isDesktop = width > 768;
    const [images, setImages] = useState<GalleryImage[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
    const [imageIndex, setImageIndex] = useState(0);

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
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getModelName = (modelId: string) => {
        if (!modelId) return 'Unknown';
        const parts = modelId.split('/');
        return parts[parts.length - 1] || modelId;
    };

    const modalWidth = isDesktop ? Math.min(900, width * 0.9) : width;
    const modalHeight = height * 0.9;

    const gridColumns = isDesktop ? 4 : 2;
    const imageSize = (modalWidth - 48 - (gridColumns - 1) * 12) / gridColumns;

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
                            <ImageIcon size={20} color={theme.primary} />
                            <Text style={styles.headerTitle}>Image Gallery</Text>
                            <View style={[styles.countBadge, { backgroundColor: 'rgba(0, 255, 65, 0.15)' }]}>
                                <Text style={[styles.countText, { color: theme.primary }]}>
                                    {images.length}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X color="#fff" size={18} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {loading && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={theme.primary} />
                                <Text style={styles.loadingText}>Loading images...</Text>
                            </View>
                        )}

                        {error && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                                <TouchableOpacity onPress={loadImages} style={styles.retryButton}>
                                    <Text style={styles.retryText}>Retry</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {!loading && !error && images.length === 0 && (
                            <View style={styles.emptyState}>
                                <ImageIcon size={48} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyTitle}>No images yet</Text>
                                <Text style={styles.emptyText}>
                                    Images you generate will appear here
                                </Text>
                            </View>
                        )}

                        {!loading && !error && images.length > 0 && (
                            <View style={styles.grid}>
                                {images.map((image, index) => (
                                    <TouchableOpacity
                                        key={image.id}
                                        style={[
                                            styles.imageCard,
                                            { width: imageSize, height: imageSize }
                                        ]}
                                        onPress={() => openImageViewer(image, index)}
                                        activeOpacity={0.8}
                                    >
                                        <Image
                                            source={{ uri: image.url }}
                                            style={styles.thumbnail}
                                            resizeMode="cover"
                                        />
                                        <View style={styles.imageOverlay}>
                                            <Text style={styles.imageModel} numberOfLines={1}>
                                                {getModelName(image.model)}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <View style={{ height: 40 }} />
                    </ScrollView>
                </View>

                {/* Full Image Viewer */}
                {selectedImage && (
                    <View style={styles.viewerOverlay}>
                        <TouchableOpacity
                            style={styles.viewerBackdrop}
                            onPress={closeImageViewer}
                            activeOpacity={1}
                        />
                        <View style={[styles.viewerContainer, { maxWidth: isDesktop ? width * 0.8 : width - 32 }]}>
                            {/* Navigation buttons */}
                            {imageIndex > 0 && (
                                <TouchableOpacity
                                    style={[styles.navButton, styles.navButtonLeft]}
                                    onPress={navigatePrev}
                                >
                                    <ChevronLeft size={32} color="#fff" />
                                </TouchableOpacity>
                            )}
                            {imageIndex < images.length - 1 && (
                                <TouchableOpacity
                                    style={[styles.navButton, styles.navButtonRight]}
                                    onPress={navigateNext}
                                >
                                    <ChevronRight size={32} color="#fff" />
                                </TouchableOpacity>
                            )}

                            {/* Close button */}
                            <TouchableOpacity
                                style={styles.viewerCloseButton}
                                onPress={closeImageViewer}
                            >
                                <X size={24} color="#fff" />
                            </TouchableOpacity>

                            {/* Image */}
                            <Image
                                source={{ uri: selectedImage.url }}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />

                            {/* Info panel */}
                            <View style={styles.infoPanel}>
                                <View style={styles.infoRow}>
                                    <Cpu size={14} color={theme.primary} />
                                    <Text style={styles.infoLabel}>Model:</Text>
                                    <Text style={styles.infoValue}>{getModelName(selectedImage.model)}</Text>
                                </View>

                                <View style={styles.infoRow}>
                                    <Calendar size={14} color={theme.secondary} />
                                    <Text style={styles.infoLabel}>Created:</Text>
                                    <Text style={styles.infoValue}>{formatDate(selectedImage.createdAt)}</Text>
                                </View>

                                {selectedImage.prompt && (
                                    <View style={styles.promptContainer}>
                                        <Text style={styles.promptLabel}>Prompt:</Text>
                                        <Text style={styles.promptText} numberOfLines={3}>
                                            {selectedImage.prompt}
                                        </Text>
                                    </View>
                                )}

                                <TouchableOpacity
                                    style={styles.chatLink}
                                    onPress={() => {
                                        closeImageViewer();
                                        onClose();
                                        onNavigateToChat(selectedImage.conversationId);
                                    }}
                                >
                                    <MessageSquare size={14} color={theme.primary} />
                                    <Text style={[styles.chatLinkText, { color: theme.primary }]}>
                                        View in conversation
                                    </Text>
                                    <ExternalLink size={12} color={theme.primary} />
                                </TouchableOpacity>
                            </View>

                            {/* Counter */}
                            <Text style={styles.imageCounter}>
                                {imageIndex + 1} / {images.length}
                            </Text>
                        </View>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
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
    content: {
        flex: 1,
        padding: 16
    },
    loadingContainer: {
        padding: 60,
        alignItems: 'center',
        justifyContent: 'center'
    },
    loadingText: {
        color: 'rgba(255,255,255,0.5)',
        marginTop: 16,
        fontSize: 14
    },
    errorContainer: {
        padding: 40,
        alignItems: 'center'
    },
    errorText: {
        color: '#ff4444',
        fontSize: 14,
        marginBottom: 16
    },
    retryButton: {
        backgroundColor: 'rgba(0, 255, 65, 0.15)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8
    },
    retryText: {
        color: '#00FF41',
        fontWeight: '600'
    },
    emptyState: {
        padding: 60,
        alignItems: 'center'
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20
    },
    emptyText: {
        color: 'rgba(255,255,255,0.5)',
        marginTop: 8,
        fontSize: 14,
        textAlign: 'center'
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    imageCard: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)'
    },
    thumbnail: {
        width: '100%',
        height: '100%'
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 8,
        paddingVertical: 6
    },
    imageModel: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '500'
    },
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
    viewerContainer: {
        alignItems: 'center',
        width: '100%'
    },
    viewerCloseButton: {
        position: 'absolute',
        top: 16,
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10
    },
    navButton: {
        position: 'absolute',
        top: '50%',
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        marginTop: -24
    },
    navButtonLeft: {
        left: 16
    },
    navButtonRight: {
        right: 16
    },
    fullImage: {
        width: '90%',
        height: '60%',
        maxHeight: 500,
        borderRadius: 12
    },
    infoPanel: {
        backgroundColor: 'rgba(20,20,20,0.95)',
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
        width: '90%',
        maxWidth: 500
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    infoLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12
    },
    infoValue: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500'
    },
    promptContainer: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)'
    },
    promptLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        marginBottom: 4
    },
    promptText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        lineHeight: 18
    },
    chatLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)'
    },
    chatLinkText: {
        fontSize: 12,
        fontWeight: '500',
        flex: 1
    },
    imageCounter: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 12
    }
});
