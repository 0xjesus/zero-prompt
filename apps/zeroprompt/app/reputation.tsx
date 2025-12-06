/**
 * ERC-8004 AI Model Reputation - HYBRID SYSTEM
 *
 * - Rating (1-5 stars) → On-chain (Avalanche C-Chain)
 * - Comments/Tags → Off-chain (Database, linked to tx hash)
 *
 * Contract: 0x3A7e2E328618175bfeb1d1581a79aDf999214c7d
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image,
  StyleSheet, Platform, useWindowDimensions, ActivityIndicator,
  Modal, TextInput, KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Star, ArrowLeft, Trophy, Users, ExternalLink,
  Home, Cpu, X, Check, Sparkles, Link2, AlertCircle,
  ChevronRight, Info, Zap, Award, TrendingUp, Search,
  MessageSquare, Database, Shield
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config/api';
import {
  fetchModelReputation,
  fetchUserRating,
  fetchTotalRatingsCount,
  submitRating,
  MODEL_REPUTATION_REGISTRY_ADDRESS,
  AVALANCHE_CHAIN_ID,
  OnChainReputation
} from '../lib/reputationContract';
import { ethers } from 'ethers';

const FONT_MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';
const SNOWTRACE_URL = `https://snowtrace.io/address/${MODEL_REPUTATION_REGISTRY_ADDRESS}`;

interface Model {
  id: number;
  openrouterId: string;
  name: string;
  iconUrl?: string;
}

interface Review {
  score: number;
  comment?: string;
  tag1?: string;
  createdAt: string;
  reviewer: string;
}

interface ModelWithReputation extends Model {
  reputation?: OnChainReputation;
  userRating?: number;
  userComment?: string;
  recentReviews?: Review[];
}

// Rating Labels
const RATING_LABELS: Record<number, { label: string; emoji: string; color: string; description: string }> = {
  1: { label: 'Poor', emoji: '😞', color: '#EF4444', description: 'Not recommended' },
  2: { label: 'Fair', emoji: '😐', color: '#F97316', description: 'Below average' },
  3: { label: 'Good', emoji: '🙂', color: '#EAB308', description: 'Meets expectations' },
  4: { label: 'Great', emoji: '😊', color: '#22C55E', description: 'Exceeds expectations' },
  5: { label: 'Excellent', emoji: '🤩', color: '#8B5CF6', description: 'Highly recommended' },
};

// Tag Options
const TAG_OPTIONS = ['Quality', 'Speed', 'Accuracy', 'Value', 'Creativity', 'Reasoning'];

// Stepper Rating Component
const StepperRating = ({
  value,
  onChange,
  disabled = false
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) => {
  return (
    <View style={stepperStyles.container}>
      <View style={stepperStyles.stepsRow}>
        {[1, 2, 3, 4, 5].map((step) => {
          const isActive = value >= step;
          const isCurrent = value === step;
          const config = RATING_LABELS[step];

          return (
            <TouchableOpacity
              key={step}
              style={[
                stepperStyles.step,
                isActive && { backgroundColor: config.color },
                isCurrent && stepperStyles.stepCurrent,
              ]}
              onPress={() => !disabled && onChange(step)}
              disabled={disabled}
            >
              <Text style={[
                stepperStyles.stepNumber,
                isActive && stepperStyles.stepNumberActive
              ]}>
                {step}
              </Text>
              <Star
                size={16}
                color={isActive ? '#fff' : 'rgba(255,255,255,0.3)'}
                fill={isActive ? '#fff' : 'transparent'}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={stepperStyles.connectorRow}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              stepperStyles.connector,
              value > i && { backgroundColor: RATING_LABELS[i + 1].color }
            ]}
          />
        ))}
      </View>

      <View style={stepperStyles.labelsRow}>
        <Text style={stepperStyles.labelLeft}>Poor</Text>
        <Text style={stepperStyles.labelRight}>Excellent</Text>
      </View>

      {value > 0 && (
        <View style={[stepperStyles.selectionBox, { borderColor: RATING_LABELS[value].color }]}>
          <Text style={stepperStyles.selectionEmoji}>{RATING_LABELS[value].emoji}</Text>
          <View>
            <Text style={[stepperStyles.selectionLabel, { color: RATING_LABELS[value].color }]}>
              {RATING_LABELS[value].label}
            </Text>
            <Text style={stepperStyles.selectionDesc}>{RATING_LABELS[value].description}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const stepperStyles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  step: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  stepCurrent: {
    transform: [{ scale: 1.1 }],
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: FONT_MONO,
    marginBottom: 2,
  },
  stepNumberActive: {
    color: '#fff',
  },
  connectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 34,
    marginTop: -24,
    zIndex: -1,
  },
  connector: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 6,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  labelLeft: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  labelRight: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },
  selectionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
  },
  selectionEmoji: {
    fontSize: 28,
  },
  selectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONT_MONO,
  },
  selectionDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
});

// Star Display Component
const StarDisplay = ({ rating, size = 12 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        size={size}
        color="#FFD700"
        fill={rating >= star ? '#FFD700' : 'transparent'}
      />
    ))}
  </View>
);

// How It Works Component
const HowItWorks = ({ onClose }: { onClose: () => void }) => (
  <Modal visible transparent animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={[styles.modalContent, { maxWidth: 450 }]}>
        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <X size={20} color="#888" />
        </TouchableOpacity>

        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View style={styles.howItWorksIcon}>
            <Info size={28} color="#8B5CF6" />
          </View>
          <Text style={styles.modalTitle}>Hybrid Reputation System</Text>
        </View>

        <View style={styles.hybridExplainer}>
          <View style={styles.hybridItem}>
            <View style={[styles.hybridIconWrap, { backgroundColor: 'rgba(0, 255, 65, 0.15)' }]}>
              <Link2 size={18} color="#00FF41" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hybridItemTitle}>Rating (1-5 Stars)</Text>
              <Text style={styles.hybridItemDesc}>Stored on-chain, immutable and verifiable on Avalanche</Text>
            </View>
          </View>
          <View style={styles.hybridItem}>
            <View style={[styles.hybridIconWrap, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Database size={18} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hybridItemTitle}>Comments & Tags</Text>
              <Text style={styles.hybridItemDesc}>Stored off-chain for gas efficiency, linked to your tx</Text>
            </View>
          </View>
        </View>

        <View style={styles.howItWorksSteps}>
          <View style={styles.howItWorksStep}>
            <View style={[styles.howItWorksStepNum, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
              <Text style={[styles.howItWorksStepNumText, { color: '#8B5CF6' }]}>1</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.howItWorksStepTitle}>Select Rating & Add Comment</Text>
              <Text style={styles.howItWorksStepDesc}>
                Choose 1-5 stars and optionally add a review comment
              </Text>
            </View>
          </View>

          <View style={styles.howItWorksStep}>
            <View style={[styles.howItWorksStepNum, { backgroundColor: 'rgba(0, 255, 65, 0.2)' }]}>
              <Text style={[styles.howItWorksStepNumText, { color: '#00FF41' }]}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.howItWorksStepTitle}>Sign Transaction</Text>
              <Text style={styles.howItWorksStepDesc}>
                Confirm in wallet - rating goes on-chain, comment saved to DB
              </Text>
            </View>
          </View>

          <View style={styles.howItWorksStep}>
            <View style={[styles.howItWorksStepNum, { backgroundColor: 'rgba(255, 215, 0, 0.2)' }]}>
              <Text style={[styles.howItWorksStepNumText, { color: '#FFD700' }]}>3</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.howItWorksStepTitle}>Permanent Record</Text>
              <Text style={styles.howItWorksStepDesc}>
                Your rating is forever on blockchain, verifiable by anyone
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.howItWorksCloseBtn} onPress={onClose}>
          <Text style={styles.howItWorksCloseBtnText}>Got It</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// Review Card Component
const ReviewCard = ({ review }: { review: Review }) => {
  const truncatedReviewer = review.reviewer.length > 12
    ? review.reviewer.slice(0, 6) + '...' + review.reviewer.slice(-4)
    : review.reviewer;

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <View style={styles.reviewerAvatar}>
            <Text style={styles.reviewerAvatarText}>
              {review.reviewer.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.reviewerName}>{truncatedReviewer}</Text>
        </View>
        <View style={styles.reviewScore}>
          <StarDisplay rating={review.score} size={10} />
          <Text style={styles.reviewScoreText}>{review.score}</Text>
        </View>
      </View>
      {review.comment && (
        <Text style={styles.reviewComment}>{review.comment}</Text>
      )}
      {review.tag1 && (
        <View style={styles.reviewTags}>
          <View style={styles.reviewTag}>
            <Text style={styles.reviewTagText}>{review.tag1}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

// Model Card Component
const ModelCard = ({
  model,
  rank,
  onRate,
  onViewReviews,
  isLoading
}: {
  model: ModelWithReputation;
  rank: number;
  onRate: () => void;
  onViewReviews: () => void;
  isLoading?: boolean;
}) => {
  const shortName = model.name.split(':').pop()?.trim() || model.name;
  const hasRatings = model.reputation && model.reputation.totalRatings > 0;
  const isTopRated = rank <= 3 && hasRatings;

  return (
    <View style={[
      styles.modelCard,
      isTopRated && styles.modelCardTop,
      model.userRating && styles.modelCardRated
    ]}>
      <TouchableOpacity
        style={styles.modelCardMain}
        onPress={onRate}
        activeOpacity={0.7}
      >
        {hasRatings && (
          <View style={[
            styles.rankBadge,
            rank === 1 && styles.rankBadgeGold,
            rank === 2 && styles.rankBadgeSilver,
            rank === 3 && styles.rankBadgeBronze,
          ]}>
            {rank <= 3 ? (
              <Trophy size={12} color={rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'} />
            ) : (
              <Text style={styles.rankText}>#{rank}</Text>
            )}
          </View>
        )}

        <View style={styles.modelIconContainer}>
          {model.iconUrl ? (
            <Image source={{ uri: model.iconUrl }} style={styles.modelIcon} />
          ) : (
            <View style={styles.modelIconPlaceholder}>
              <Cpu size={20} color="#8B5CF6" />
            </View>
          )}
        </View>

        <View style={styles.modelInfo}>
          <Text style={styles.modelName} numberOfLines={1}>{shortName}</Text>

          {hasRatings ? (
            <View style={styles.ratingInfo}>
              <StarDisplay rating={Math.round(model.reputation!.averageScore)} />
              <Text style={styles.ratingScore}>
                {model.reputation!.averageScore.toFixed(1)}
              </Text>
              <Text style={styles.ratingCount}>
                ({model.reputation!.totalRatings})
              </Text>
            </View>
          ) : (
            <Text style={styles.noRatingsText}>No ratings yet - be the first!</Text>
          )}
        </View>

        <View style={styles.cardAction}>
          {model.userRating ? (
            <View style={styles.yourRatingBadge}>
              <Check size={12} color="#00FF41" />
              <Text style={styles.yourRatingText}>{model.userRating}★</Text>
            </View>
          ) : isLoading ? (
            <ActivityIndicator size="small" color="#8B5CF6" />
          ) : (
            <View style={styles.ratePrompt}>
              <Star size={14} color="#8B5CF6" />
              <ChevronRight size={14} color="#8B5CF6" />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {hasRatings && (
        <TouchableOpacity style={styles.viewReviewsBtn} onPress={onViewReviews}>
          <MessageSquare size={12} color="rgba(255,255,255,0.5)" />
          <Text style={styles.viewReviewsText}>View Reviews</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Reviews Modal
const ReviewsModal = ({
  visible,
  model,
  reviews,
  onClose
}: {
  visible: boolean;
  model: Model | null;
  reviews: Review[];
  onClose: () => void;
}) => {
  if (!model) return null;

  const shortName = model.name.split(':').pop()?.trim() || model.name;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: 450, maxHeight: '80%' }]}>
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <X size={20} color="#888" />
          </TouchableOpacity>

          <View style={styles.reviewsModalHeader}>
            <MessageSquare size={24} color="#8B5CF6" />
            <Text style={styles.modalTitle}>Reviews</Text>
          </View>
          <Text style={styles.reviewsModelName}>{shortName}</Text>

          <ScrollView style={styles.reviewsList} showsVerticalScrollIndicator={false}>
            {reviews.length === 0 ? (
              <View style={styles.noReviews}>
                <MessageSquare size={32} color="rgba(255,255,255,0.2)" />
                <Text style={styles.noReviewsText}>No reviews with comments yet</Text>
              </View>
            ) : (
              reviews.map((review, idx) => (
                <ReviewCard key={idx} review={review} />
              ))
            )}
          </ScrollView>

          <TouchableOpacity style={styles.reviewsCloseBtn} onPress={onClose}>
            <Text style={styles.reviewsCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Rate Modal with Comment
const RateModal = ({
  visible,
  model,
  existingRating,
  existingComment,
  onClose,
  onSubmit,
  isSubmitting
}: {
  visible: boolean;
  model: Model | null;
  existingRating?: number;
  existingComment?: string;
  onClose: () => void;
  onSubmit: (score: number, comment: string, tag: string) => void;
  isSubmitting: boolean;
}) => {
  const [selectedScore, setSelectedScore] = useState(existingRating || 0);
  const [comment, setComment] = useState(existingComment || '');
  const [selectedTag, setSelectedTag] = useState('');

  useEffect(() => {
    setSelectedScore(existingRating || 0);
    setComment(existingComment || '');
    setSelectedTag('');
  }, [existingRating, existingComment, visible]);

  if (!model) return null;

  const shortName = model.name.split(':').pop()?.trim() || model.name;
  const isUpdate = !!existingRating;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.modalOverlay}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={onClose}>
              <X size={20} color="#888" />
            </TouchableOpacity>

            <View style={styles.rateModalHeader}>
              <View style={styles.rateModalIconWrap}>
                {model.iconUrl ? (
                  <Image source={{ uri: model.iconUrl }} style={styles.rateModalIcon} />
                ) : (
                  <Cpu size={24} color="#8B5CF6" />
                )}
              </View>
              <Text style={styles.rateModalTitle}>
                {isUpdate ? 'Update Your Rating' : 'Rate This Model'}
              </Text>
              <Text style={styles.rateModalModelName}>{shortName}</Text>
            </View>

            <StepperRating
              value={selectedScore}
              onChange={setSelectedScore}
              disabled={isSubmitting}
            />

            {/* Comment Input */}
            <View style={styles.commentSection}>
              <View style={styles.commentHeader}>
                <MessageSquare size={14} color="#8B5CF6" />
                <Text style={styles.commentLabel}>Review Comment (Optional)</Text>
              </View>
              <TextInput
                style={styles.commentInput}
                placeholder="Share your experience with this model..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                multiline
                numberOfLines={3}
                maxLength={500}
                value={comment}
                onChangeText={setComment}
                editable={!isSubmitting}
              />
              <Text style={styles.commentCharCount}>{comment.length}/500</Text>
            </View>

            {/* Tags */}
            <View style={styles.tagSection}>
              <Text style={styles.tagLabel}>Highlight (Optional)</Text>
              <View style={styles.tagOptions}>
                {TAG_OPTIONS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagOption,
                      selectedTag === tag && styles.tagOptionSelected
                    ]}
                    onPress={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                    disabled={isSubmitting}
                  >
                    <Text style={[
                      styles.tagOptionText,
                      selectedTag === tag && styles.tagOptionTextSelected
                    ]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Info Boxes */}
            <View style={styles.infoBoxes}>
              <View style={styles.infoBox}>
                <Link2 size={12} color="#00FF41" />
                <Text style={styles.infoBoxText}>Rating stored on-chain</Text>
              </View>
              <View style={styles.infoBox}>
                <Database size={12} color="#8B5CF6" />
                <Text style={styles.infoBoxText}>Comment saved to DB</Text>
              </View>
            </View>

            <View style={styles.gasWarning}>
              <AlertCircle size={14} color="#F59E0B" />
              <Text style={styles.gasWarningText}>
                Gas fee ~0.01 AVAX for on-chain rating
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                selectedScore === 0 && styles.submitBtnDisabled,
                isSubmitting && styles.submitBtnLoading
              ]}
              onPress={() => selectedScore > 0 && onSubmit(selectedScore, comment, selectedTag)}
              disabled={selectedScore === 0 || isSubmitting}
            >
              {isSubmitting ? (
                <View style={styles.submitBtnContent}>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={styles.submitBtnText}>Submitting...</Text>
                </View>
              ) : (
                <View style={styles.submitBtnContent}>
                  <Shield size={18} color="#000" />
                  <Text style={styles.submitBtnText}>
                    {selectedScore === 0
                      ? 'Select a Rating'
                      : isUpdate
                        ? 'Update Rating'
                        : 'Submit Rating'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default function ReputationPage() {
  useTheme();
  const { user, getHeaders } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const [models, setModels] = useState<ModelWithReputation[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOnChainRatings, setTotalOnChainRatings] = useState(0);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [selectedModelRating, setSelectedModelRating] = useState<number | undefined>();
  const [selectedModelComment, setSelectedModelComment] = useState<string | undefined>();
  const [showRateModal, setShowRateModal] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [reviewsModel, setReviewsModel] = useState<Model | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'rated' | 'unrated'>('all');
  const [displayCount, setDisplayCount] = useState(30); // Pagination
  const MODELS_PER_PAGE = 30;

  // Fetch models from API
  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/models`, { headers: getHeaders() });
      const data = await res.json();
      const modelList = data.models || [];
      setModels(modelList);
      return modelList;
    } catch (err) {
      console.error('[Reputation] Failed to fetch models:', err);
      return [];
    }
  }, [getHeaders]);

  // Fetch on-chain reputation for a model
  const fetchOnChainData = useCallback(async (model: Model, userAddress?: string) => {
    try {
      const reputation = await fetchModelReputation(model.id);
      let userRating: number | undefined;

      if (userAddress) {
        const ratingData = await fetchUserRating(model.id, userAddress);
        if (ratingData.exists) {
          userRating = ratingData.score;
        }
      }

      return { reputation, userRating };
    } catch (err) {
      console.error(`[Reputation] Failed to fetch on-chain data for model ${model.id}:`, err);
      return { reputation: undefined, userRating: undefined };
    }
  }, []);

  // Fetch user's comment from API
  const fetchUserComment = useCallback(async (modelId: number) => {
    try {
      const res = await fetch(`${API_URL}/reputation/check/${modelId}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      return data.rating?.comment || '';
    } catch (err) {
      console.error('[Reputation] Failed to fetch user comment:', err);
      return '';
    }
  }, [getHeaders]);

  // Fetch reviews for a model
  const fetchReviews = useCallback(async (openrouterId: string) => {
    try {
      const res = await fetch(`${API_URL}/reputation/model/${encodeURIComponent(openrouterId)}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      return data.recentReviews || [];
    } catch (err) {
      console.error('[Reputation] Failed to fetch reviews:', err);
      return [];
    }
  }, [getHeaders]);

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      const modelList = await fetchModels();

      try {
        const total = await fetchTotalRatingsCount();
        setTotalOnChainRatings(total);
      } catch (err) {
        console.error('[Reputation] Failed to fetch total ratings:', err);
      }

      const userAddress = user?.walletAddress;
      const batchSize = 10;
      const updatedModels = [...modelList];

      for (let i = 0; i < modelList.length; i += batchSize) {
        const batch = modelList.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map((m: Model) => fetchOnChainData(m, userAddress))
        );

        results.forEach((result, idx) => {
          const modelIdx = i + idx;
          updatedModels[modelIdx] = {
            ...updatedModels[modelIdx],
            reputation: result.reputation,
            userRating: result.userRating
          };
        });

        setModels([...updatedModels]);
      }

      setLoading(false);
    };

    loadData();
  }, [fetchModels, fetchOnChainData, user?.walletAddress]);

  // Handle rating submission (hybrid: on-chain + API)
  const handleSubmitRating = async (score: number, comment: string, tag: string) => {
    if (!selectedModel || !user?.walletAddress) {
      if (Platform.OS === 'web') {
        alert('Please connect your wallet to rate models.');
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Submit rating on-chain
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet detected. Please install MetaMask.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== AVALANCHE_CHAIN_ID) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa86a' }],
        });
      }

      const signer = await provider.getSigner();
      const txHash = await submitRating(selectedModel.id, score, signer);

      console.log('[Reputation] On-chain rating submitted, tx:', txHash);

      // 2. Save comment to API (off-chain)
      try {
        await fetch(`${API_URL}/reputation/rate`, {
          method: 'POST',
          headers: {
            ...getHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            modelId: selectedModel.id,
            score,
            comment: comment || null,
            tag1: tag || null,
            txHash
          })
        });
        console.log('[Reputation] Comment saved to API');
      } catch (apiErr) {
        console.warn('[Reputation] Failed to save comment to API:', apiErr);
        // Don't fail the whole operation if API save fails
      }

      // Update local state
      setModels(prev => prev.map(m =>
        m.id === selectedModel.id ? { ...m, userRating: score, userComment: comment } : m
      ));

      setShowRateModal(false);
      setSelectedModel(null);

      // Refresh on-chain data
      const updated = await fetchOnChainData(selectedModel, user.walletAddress);
      setModels(prev => prev.map(m =>
        m.id === selectedModel.id
          ? { ...m, reputation: updated.reputation, userRating: updated.userRating }
          : m
      ));

      if (Platform.OS === 'web') {
        alert(`Success! Your ${score}-star rating has been recorded on-chain.`);
      }
    } catch (err: any) {
      console.error('[Reputation] Failed to submit rating:', err);
      if (Platform.OS === 'web') {
        alert(err.message || 'Failed to submit rating');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle view reviews
  const handleViewReviews = async (model: Model) => {
    setReviewsModel(model);
    const fetchedReviews = await fetchReviews(model.openrouterId);
    setReviews(fetchedReviews);
    setShowReviewsModal(true);
  };

  // Handle open rate modal
  const handleOpenRateModal = async (model: ModelWithReputation) => {
    setSelectedModel(model);
    setSelectedModelRating(model.userRating);

    // Fetch existing comment if user has rated
    if (model.userRating && user) {
      const existingComment = await fetchUserComment(model.id);
      setSelectedModelComment(existingComment);
    } else {
      setSelectedModelComment(undefined);
    }

    setShowRateModal(true);
  };

  // Sort and filter models
  const sortedModels = [...models]
    .filter(m => {
      if (filter === 'rated' && (!m.reputation || m.reputation.totalRatings === 0)) return false;
      if (filter === 'unrated' && m.reputation && m.reputation.totalRatings > 0) return false;
      return true;
    })
    .sort((a, b) => {
      const aRatings = a.reputation?.totalRatings || 0;
      const bRatings = b.reputation?.totalRatings || 0;
      const aScore = a.reputation?.averageScore || 0;
      const bScore = b.reputation?.averageScore || 0;

      if (aRatings > 0 && bRatings > 0) {
        if (bScore !== aScore) return bScore - aScore;
        return bRatings - aRatings;
      }
      if (aRatings > 0) return -1;
      if (bRatings > 0) return 1;
      return a.name.localeCompare(b.name);
    });

  const modelsWithRatings = models.filter(m => m.reputation && m.reputation.totalRatings > 0);
  const userRatedCount = models.filter(m => m.userRating).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['rgba(0, 255, 65, 0.15)', 'rgba(139, 92, 246, 0.1)', 'transparent']}
        style={styles.headerGradient}
      >
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft size={20} color="#fff" />
            </TouchableOpacity>
            <View>
              <View style={styles.headerTitleRow}>
                <Trophy size={22} color="#FFD700" />
                <Text style={styles.headerTitle}>AI Reputation</Text>
              </View>
              <TouchableOpacity
                style={styles.onChainHeaderBadge}
                onPress={() => {
                  if (Platform.OS === 'web') {
                    window.open(SNOWTRACE_URL, '_blank');
                  }
                }}
              >
                <Link2 size={10} color="#00FF41" />
                <Text style={styles.onChainHeaderText}>HYBRID</Text>
                <ExternalLink size={8} color="#00FF41" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => setShowHowItWorks(true)}
              style={styles.helpBtn}
            >
              <Info size={18} color="#8B5CF6" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/home')} style={styles.headerNavBtn}>
              <Home size={18} color="#888" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={[styles.statsSection, isDesktop && styles.statsSectionDesktop]}>
          <View style={styles.statCard}>
            <View style={styles.statIconWrap}>
              <Cpu size={18} color="#8B5CF6" />
            </View>
            <Text style={styles.statValue}>{models.length}</Text>
            <Text style={styles.statLabel}>AI Models</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(0, 255, 65, 0.1)' }]}>
              <Link2 size={18} color="#00FF41" />
            </View>
            <Text style={styles.statValue}>{totalOnChainRatings}</Text>
            <Text style={styles.statLabel}>On-Chain</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(255, 215, 0, 0.1)' }]}>
              <Star size={18} color="#FFD700" />
            </View>
            <Text style={styles.statValue}>{modelsWithRatings.length}</Text>
            <Text style={styles.statLabel}>Rated</Text>
          </View>

          {user && (
            <View style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: 'rgba(34, 197, 94, 0.1)' }]}>
                <Check size={18} color="#22C55E" />
              </View>
              <Text style={styles.statValue}>{userRatedCount}</Text>
              <Text style={styles.statLabel}>Your Votes</Text>
            </View>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterSection}>
          <View style={styles.filterTabs}>
            {(['all', 'rated', 'unrated'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterTab, filter === f && styles.filterTabActive]}
                onPress={() => { setFilter(f); setDisplayCount(MODELS_PER_PAGE); }}
              >
                <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
                  {f === 'all' ? 'All' : f === 'rated' ? 'Top Rated' : 'Unrated'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Models List */}
        <View style={styles.modelsSection}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Loading reputation data...</Text>
              <Text style={styles.loadingSubtext}>Fetching from blockchain & database</Text>
            </View>
          ) : sortedModels.length === 0 ? (
            <View style={styles.emptyState}>
              <Search size={32} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyStateText}>No models found</Text>
            </View>
          ) : (
            <>
              <View style={styles.modelsList}>
                {sortedModels.slice(0, displayCount).map((model) => {
                  const ratedIndex = modelsWithRatings.findIndex(m => m.id === model.id);
                  const rank = ratedIndex >= 0 ? ratedIndex + 1 : 0;

                  return (
                    <ModelCard
                      key={model.id}
                      model={model}
                      rank={rank}
                      onRate={() => handleOpenRateModal(model)}
                      onViewReviews={() => handleViewReviews(model)}
                    />
                  );
                })}
              </View>

            </>
          )}
        </View>

        {/* CTA for non-connected users */}
        {!user && (
          <View style={styles.ctaSection}>
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.15)', 'rgba(0, 255, 65, 0.08)']}
              style={styles.ctaCard}
            >
              <Users size={28} color="#8B5CF6" />
              <Text style={styles.ctaTitle}>Connect Wallet to Vote</Text>
              <Text style={styles.ctaText}>
                Rate AI models with on-chain verification and add your review
              </Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => router.push('/home')}
              >
                <Text style={styles.ctaButtonText}>Connect Wallet</Text>
                <ChevronRight size={16} color="#000" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky Load More Footer */}
      {!loading && sortedModels.length > 0 && (
        <View style={styles.stickyFooter}>
          <View style={styles.stickyFooterContent}>
            <Text style={styles.paginationInfo}>
              {Math.min(displayCount, sortedModels.length)} / {sortedModels.length} models
            </Text>
            {displayCount < sortedModels.length ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={() => setDisplayCount(prev => prev + MODELS_PER_PAGE)}
              >
                <Text style={styles.loadMoreText}>
                  Load {Math.min(MODELS_PER_PAGE, sortedModels.length - displayCount)} More
                </Text>
                <ChevronRight size={16} color="#8B5CF6" />
              </TouchableOpacity>
            ) : (
              <View style={styles.allLoadedBadge}>
                <Check size={14} color="#00FF41" />
                <Text style={styles.allLoadedText}>All Loaded</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Rate Modal */}
      <RateModal
        visible={showRateModal}
        model={selectedModel}
        existingRating={selectedModelRating}
        existingComment={selectedModelComment}
        onClose={() => {
          setShowRateModal(false);
          setSelectedModel(null);
          setSelectedModelRating(undefined);
          setSelectedModelComment(undefined);
        }}
        onSubmit={handleSubmitRating}
        isSubmitting={isSubmitting}
      />

      {/* Reviews Modal */}
      <ReviewsModal
        visible={showReviewsModal}
        model={reviewsModel}
        reviews={reviews}
        onClose={() => {
          setShowReviewsModal(false);
          setReviewsModel(null);
          setReviews([]);
        }}
      />

      {/* How It Works Modal */}
      {showHowItWorks && <HowItWorks onClose={() => setShowHowItWorks(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerDesktop: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    fontFamily: FONT_MONO,
  },
  onChainHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 255, 65, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  onChainHeaderText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00FF41',
    fontFamily: FONT_MONO,
    letterSpacing: 1,
  },
  helpBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },

  // Stats
  statsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  statsSectionDesktop: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  statCard: {
    flex: 1,
    minWidth: 70,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    fontFamily: FONT_MONO,
  },
  statLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    textAlign: 'center',
  },

  // Filters
  filterSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  filterTabText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#8B5CF6',
  },

  // Models
  modelsSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  loadingSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  modelsList: {
    gap: 10,
  },

  // Sticky Footer Pagination
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(10px)' } : {}),
  },
  stickyFooterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  paginationInfo: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: FONT_MONO,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  loadMoreText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '700',
  },
  allLoadedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 255, 65, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  allLoadedText: {
    fontSize: 13,
    color: '#00FF41',
    fontWeight: '600',
  },

  // Model Card
  modelCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  modelCardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  modelCardTop: {
    borderColor: 'rgba(255, 215, 0, 0.2)',
    backgroundColor: 'rgba(255, 215, 0, 0.03)',
  },
  modelCardRated: {
    borderColor: 'rgba(0, 255, 65, 0.15)',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeGold: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  rankBadgeSilver: {
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
  },
  rankBadgeBronze: {
    backgroundColor: 'rgba(205, 127, 50, 0.15)',
  },
  rankText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: FONT_MONO,
  },
  modelIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modelIcon: {
    width: 42,
    height: 42,
  },
  modelIconPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  ratingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  ratingScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFD700',
    fontFamily: FONT_MONO,
  },
  ratingCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  noRatingsText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
    fontStyle: 'italic',
  },
  cardAction: {
    alignItems: 'flex-end',
  },
  yourRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 255, 65, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  yourRatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00FF41',
    fontFamily: FONT_MONO,
  },
  ratePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewReviewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  viewReviewsText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
  },

  // CTA
  ctaSection: {
    marginTop: 24,
    marginHorizontal: 16,
  },
  ctaCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.15)',
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: FONT_MONO,
    marginTop: 12,
  },
  ctaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 280,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00FF41',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#14141F',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
    fontFamily: FONT_MONO,
    textAlign: 'center',
  },

  // Rate Modal
  rateModalHeader: {
    alignItems: 'center',
    marginBottom: 8,
  },
  rateModalIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  rateModalIcon: {
    width: 56,
    height: 56,
  },
  rateModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    fontFamily: FONT_MONO,
  },
  rateModalModelName: {
    fontSize: 13,
    color: '#8B5CF6',
    marginTop: 4,
    fontWeight: '600',
  },

  // Comment Section
  commentSection: {
    marginTop: 16,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  commentLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  commentInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  commentCharCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'right',
    marginTop: 4,
  },

  // Tags
  tagSection: {
    marginTop: 16,
  },
  tagLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    marginBottom: 8,
  },
  tagOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagOptionSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: '#8B5CF6',
  },
  tagOptionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  tagOptionTextSelected: {
    color: '#8B5CF6',
    fontWeight: '600',
  },

  // Info Boxes
  infoBoxes: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  infoBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 10,
    borderRadius: 10,
  },
  infoBoxText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },

  gasWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 16,
  },
  gasWarningText: {
    fontSize: 12,
    color: '#F59E0B',
    flex: 1,
  },
  submitBtn: {
    backgroundColor: '#00FF41',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  submitBtnLoading: {
    backgroundColor: 'rgba(0, 255, 65, 0.5)',
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    fontFamily: FONT_MONO,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },

  // How It Works
  howItWorksIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  hybridExplainer: {
    gap: 12,
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
  },
  hybridItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hybridIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hybridItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  hybridItemDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  howItWorksSteps: {
    gap: 14,
    marginBottom: 20,
  },
  howItWorksStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  howItWorksStepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howItWorksStepNumText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT_MONO,
  },
  howItWorksStepTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  howItWorksStepDesc: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  howItWorksCloseBtn: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  howItWorksCloseBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Reviews Modal
  reviewsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  reviewsModelName: {
    fontSize: 13,
    color: '#8B5CF6',
    textAlign: 'center',
    marginBottom: 16,
  },
  reviewsList: {
    maxHeight: 300,
  },
  noReviews: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noReviewsText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 10,
  },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  reviewerName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: FONT_MONO,
  },
  reviewScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFD700',
    fontFamily: FONT_MONO,
  },
  reviewComment: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
  },
  reviewTags: {
    flexDirection: 'row',
    marginTop: 8,
  },
  reviewTag: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reviewTagText: {
    fontSize: 10,
    color: '#8B5CF6',
  },
  reviewsCloseBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  reviewsCloseBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
});
