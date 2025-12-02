import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
  Image as RNImage
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  Sparkles,
  Image,
  Eye,
  Brain,
  Globe,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Clock,
  CheckCircle
} from "lucide-react-native";

const ZEROPROMPT_LOGO = require('../assets/logos/zero-prompt-logo.png');
import { API_URL } from "../config/api";

interface ModelStats {
  totalActive: number;
  totalInactive: number;
  newToday: number;
  newThisWeek: number;
  categories: {
    imageGenerators: number;
    visionModels: number;
    reasoningModels: number;
    webSearchModels: number;
  };
}

interface Model {
  id: number;
  openrouterId: string;
  name: string;
  description?: string;
  contextLength?: number;
  pricingPrompt?: number;
  pricingCompletion?: number;
  publicPricingPrompt?: number;
  publicPricingCompletion?: number;
  architecture?: any;
  isActive: boolean;
  displayPriority?: number;
  createdAt: string;
  lastSeenAt?: string;
}

export default function AdminModelsScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();
  const { getHeaders } = useAuth();

  const [stats, setStats] = useState<ModelStats | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [newModels, setNewModels] = useState<Model[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [expandedModel, setExpandedModel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/models/admin/stats`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [getHeaders]);

  // Fetch new models (last 7 days)
  const fetchNewModels = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/models/new?days=7`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setNewModels(data.models);
      }
    } catch (err) {
      console.error("Failed to fetch new models:", err);
    }
  }, [getHeaders]);

  // Fetch models list
  const fetchModels = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...(searchQuery && { search: searchQuery }),
        ...(showNewOnly && { new: "true" }),
        ...(showInactive && { inactive: "true" })
      });

      const res = await fetch(`${API_URL}/models/admin/all?${params}`, {
        headers: getHeaders()
      });

      if (res.ok) {
        const data = await res.json();
        setModels(data.models);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error("Failed to fetch models:", err);
      setError("Failed to load models");
    }
  }, [getHeaders, page, searchQuery, showNewOnly, showInactive]);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setIsLoading(true);
      await Promise.all([fetchStats(), fetchNewModels(), fetchModels()]);
      setIsLoading(false);
    };
    loadAll();
  }, [fetchStats, fetchNewModels, fetchModels]);

  // Reload models when filters change
  useEffect(() => {
    if (!isLoading) {
      fetchModels();
    }
  }, [page, searchQuery, showNewOnly, showInactive]);

  // Run sync
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/models/sync`, {
        method: "POST",
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error("Sync failed");
      }

      const data = await res.json();
      setSyncResult(data.synced);

      // Refresh all data
      await Promise.all([fetchStats(), fetchNewModels(), fetchModels()]);
    } catch (err: any) {
      setError(err.message || "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const formatPrice = (price?: number) => {
    if (!price) return "-";
    return `$${(price * 1000000).toFixed(4)}/1M`;
  };

  const getModelBadges = (model: Model) => {
    const badges: { icon: any; color: string; label: string }[] = [];
    const arch = model.architecture || {};

    if (arch.output_modalities?.includes("image")) {
      badges.push({ icon: Image, color: colors.primary, label: "Imagen" });
    }
    if (arch.input_modalities?.includes("image")) {
      badges.push({ icon: Eye, color: colors.success, label: "Vision" });
    }
    if (arch.is_reasoning) {
      badges.push({ icon: Brain, color: colors.warning, label: "Razonamiento" });
    }
    if (arch.has_web_search) {
      badges.push({ icon: Globe, color: colors.info || "#3b82f6", label: "Web" });
    }

    return badges;
  };

  const isNewModel = (model: Model) => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(model.createdAt).getTime() > weekAgo;
  };

  const styles = createStyles(colors);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Admin Modelos</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Admin Modelos</Text>
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.buttonDisabled]}
          onPress={handleSync}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <RefreshCw size={18} color={colors.background} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* NEW MODELS ALERT - Super llamativo */}
        {newModels.length > 0 && (
          <View style={styles.newModelsAlert}>
            <View style={styles.alertHeader}>
              <View style={styles.alertIconContainer}>
                <Sparkles size={28} color="#fff" />
              </View>
              <View style={styles.alertTextContainer}>
                <Text style={styles.alertTitle}>
                  {newModels.length} MODELO{newModels.length > 1 ? "S" : ""} NUEVO{newModels.length > 1 ? "S" : ""}
                </Text>
                <Text style={styles.alertSubtitle}>
                  Agregados en los ultimos 7 dias
                </Text>
              </View>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={() => setShowNewOnly(!showNewOnly)}
              >
                <Text style={styles.alertButtonText}>
                  {showNewOnly ? "Ver Todos" : "Filtrar"}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.newModelsList}
            >
              {newModels.slice(0, 10).map((model) => (
                <View key={model.id} style={styles.newModelCard}>
                  <Text style={styles.newModelName} numberOfLines={1}>
                    {model.name}
                  </Text>
                  <Text style={styles.newModelId} numberOfLines={1}>
                    {model.openrouterId?.split('/').pop() || model.openrouterId}
                  </Text>
                  <View style={styles.newModelBadges}>
                    {getModelBadges(model).map((badge, i) => (
                      <View
                        key={i}
                        style={[styles.newModelBadge, { backgroundColor: badge.color + "30" }]}
                      >
                        <badge.icon size={10} color={badge.color} />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Sync Result */}
        {syncResult && (
          <View style={styles.syncResultCard}>
            <View style={styles.syncResultHeader}>
              <RNImage source={ZEROPROMPT_LOGO} style={{width: 22, height: 22}} resizeMode="contain" />
              <Text style={styles.syncResultTitle}>Sincronizacion Completada</Text>
            </View>
            <View style={styles.syncResultStats}>
              <View style={styles.syncResultStat}>
                <Text style={styles.syncResultNumber}>{syncResult.upserted}</Text>
                <Text style={styles.syncResultLabel}>Actualizados</Text>
              </View>
              <View style={styles.syncResultStat}>
                <Text style={[styles.syncResultNumber, { color: colors.success }]}>
                  {syncResult.newModels || 0}
                </Text>
                <Text style={styles.syncResultLabel}>Nuevos</Text>
              </View>
              <View style={styles.syncResultStat}>
                <Text style={[styles.syncResultNumber, { color: colors.error }]}>
                  {syncResult.deactivated}
                </Text>
                <Text style={styles.syncResultLabel}>Desactivados</Text>
              </View>
            </View>
            {syncResult.newModelIds?.length > 0 && (
              <View style={styles.newModelIdsList}>
                <Text style={styles.newModelIdsTitle}>Nuevos modelos:</Text>
                {syncResult.newModelIds.map((id: string) => (
                  <Text key={id} style={styles.newModelIdItem}>
                    {id}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Stats Grid */}
        {stats && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalActive}</Text>
              <Text style={styles.statLabel}>Activos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: colors.success }]}>
                {stats.newThisWeek}
              </Text>
              <Text style={styles.statLabel}>Esta Semana</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>
                {stats.categories.imageGenerators}
              </Text>
              <Text style={styles.statLabel}>Generadores</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, { color: colors.warning }]}>
                {stats.categories.reasoningModels}
              </Text>
              <Text style={styles.statLabel}>Razonamiento</Text>
            </View>
          </View>
        )}

        {/* Category Breakdown */}
        {stats && (
          <View style={styles.categoriesCard}>
            <Text style={styles.categoriesTitle}>Categorias</Text>
            <View style={styles.categoryRow}>
              <View style={styles.categoryItem}>
                <Image size={18} color={colors.primary} />
                <Text style={styles.categoryLabel}>Generadores de Imagen</Text>
                <Text style={styles.categoryCount}>{stats.categories.imageGenerators}</Text>
              </View>
              <View style={styles.categoryItem}>
                <Eye size={18} color={colors.success} />
                <Text style={styles.categoryLabel}>Modelos Vision</Text>
                <Text style={styles.categoryCount}>{stats.categories.visionModels}</Text>
              </View>
              <View style={styles.categoryItem}>
                <Brain size={18} color={colors.warning} />
                <Text style={styles.categoryLabel}>Razonamiento</Text>
                <Text style={styles.categoryCount}>{stats.categories.reasoningModels}</Text>
              </View>
              <View style={styles.categoryItem}>
                <Globe size={18} color={colors.info || "#3b82f6"} />
                <Text style={styles.categoryLabel}>Busqueda Web</Text>
                <Text style={styles.categoryCount}>{stats.categories.webSearchModels}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Search & Filters */}
        <View style={styles.filtersContainer}>
          <View style={styles.searchContainer}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar modelos..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterButtons}>
            <TouchableOpacity
              style={[styles.filterButton, showNewOnly && styles.filterButtonActive]}
              onPress={() => setShowNewOnly(!showNewOnly)}
            >
              <Sparkles size={14} color={showNewOnly ? "#fff" : colors.text} />
              <Text style={[styles.filterButtonText, showNewOnly && styles.filterButtonTextActive]}>
                Nuevos
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterButton, showInactive && styles.filterButtonActive]}
              onPress={() => setShowInactive(!showInactive)}
            >
              <X size={14} color={showInactive ? "#fff" : colors.text} />
              <Text style={[styles.filterButtonText, showInactive && styles.filterButtonTextActive]}>
                Inactivos
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Models List */}
        <View style={styles.modelsList}>
          {models.map((model) => (
            <TouchableOpacity
              key={model.id}
              style={[
                styles.modelCard,
                !model.isActive && styles.modelCardInactive,
                isNewModel(model) && styles.modelCardNew
              ]}
              onPress={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
              activeOpacity={0.7}
            >
              <View style={styles.modelHeader}>
                <View style={styles.modelInfo}>
                  {isNewModel(model) && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NUEVO</Text>
                    </View>
                  )}
                  <Text style={styles.modelName} numberOfLines={1}>
                    {model.name}
                  </Text>
                  <Text style={styles.modelId} numberOfLines={1}>
                    {model.openrouterId?.split('/').pop() || model.openrouterId}
                  </Text>
                </View>
                <View style={styles.modelActions}>
                  {!model.isActive && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveBadgeText}>INACTIVO</Text>
                    </View>
                  )}
                  {expandedModel === model.id ? (
                    <ChevronUp size={20} color={colors.textSecondary} />
                  ) : (
                    <ChevronDown size={20} color={colors.textSecondary} />
                  )}
                </View>
              </View>

              {/* Badges Row */}
              <View style={styles.badgesRow}>
                {getModelBadges(model).map((badge, i) => (
                  <View
                    key={i}
                    style={[styles.badge, { backgroundColor: badge.color + "20" }]}
                  >
                    <badge.icon size={12} color={badge.color} />
                    <Text style={[styles.badgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Expanded Details */}
              {expandedModel === model.id && (
                <View style={styles.expandedDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Contexto:</Text>
                    <Text style={styles.detailValue}>
                      {model.contextLength?.toLocaleString() || "-"} tokens
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Precio Prompt:</Text>
                    <Text style={styles.detailValue}>
                      {formatPrice(model.pricingPrompt)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Precio Completion:</Text>
                    <Text style={styles.detailValue}>
                      {formatPrice(model.pricingCompletion)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Precio Publico Prompt:</Text>
                    <Text style={styles.detailValue}>
                      {formatPrice(model.publicPricingPrompt)}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Agregado:</Text>
                    <Text style={styles.detailValue}>
                      {formatDate(model.createdAt)}
                    </Text>
                  </View>
                  {model.lastSeenAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Ultima sync:</Text>
                      <Text style={styles.detailValue}>
                        {formatDate(model.lastSeenAt)}
                      </Text>
                    </View>
                  )}
                  {model.description && (
                    <View style={styles.descriptionContainer}>
                      <Text style={styles.descriptionText}>{model.description}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Pagination */}
        {totalPages > 1 && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
              onPress={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <Text style={styles.pageButtonText}>Anterior</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>
              {page} / {totalPages}
            </Text>
            <TouchableOpacity
              style={[styles.pageButton, page === totalPages && styles.pageButtonDisabled]}
              onPress={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              <Text style={styles.pageButtonText}>Siguiente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorContainer}>
            <AlertCircle size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "web" ? 20 : 50,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    backButton: {
      padding: 8
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text
    },
    syncButton: {
      backgroundColor: colors.primary,
      padding: 10,
      borderRadius: 10
    },
    buttonDisabled: {
      opacity: 0.5
    },
    content: {
      flex: 1,
      padding: 16
    },
    centerContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center"
    },
    loadingText: {
      marginTop: 16,
      color: colors.textSecondary
    },

    // New Models Alert - Super llamativo
    newModelsAlert: {
      backgroundColor: "#7c3aed",
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#7c3aed",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8
    },
    alertHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 12
    },
    alertIconContainer: {
      backgroundColor: "rgba(255,255,255,0.2)",
      padding: 10,
      borderRadius: 12
    },
    alertTextContainer: {
      flex: 1,
      marginLeft: 12
    },
    alertTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.5
    },
    alertSubtitle: {
      fontSize: 13,
      color: "rgba(255,255,255,0.8)",
      marginTop: 2
    },
    alertButton: {
      backgroundColor: "rgba(255,255,255,0.2)",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8
    },
    alertButtonText: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 13
    },
    newModelsList: {
      marginTop: 8
    },
    newModelCard: {
      backgroundColor: "rgba(255,255,255,0.15)",
      borderRadius: 10,
      padding: 12,
      marginRight: 10,
      minWidth: 160
    },
    newModelName: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 14,
      marginBottom: 4
    },
    newModelId: {
      color: "rgba(255,255,255,0.7)",
      fontSize: 11,
      marginBottom: 6
    },
    newModelBadges: {
      flexDirection: "row",
      gap: 4
    },
    newModelBadge: {
      padding: 4,
      borderRadius: 4
    },

    // Sync Result
    syncResultCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.success + "40"
    },
    syncResultHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12
    },
    syncResultTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.success
    },
    syncResultStats: {
      flexDirection: "row",
      justifyContent: "space-around"
    },
    syncResultStat: {
      alignItems: "center"
    },
    syncResultNumber: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text
    },
    syncResultLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4
    },
    newModelIdsList: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    newModelIdsTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8
    },
    newModelIdItem: {
      fontSize: 12,
      color: colors.success,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
      marginBottom: 4
    },

    // Stats Grid
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      marginBottom: 16
    },
    statCard: {
      flex: 1,
      minWidth: 70,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border
    },
    statNumber: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text
    },
    statLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4
    },

    // Categories Card
    categoriesCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border
    },
    categoriesTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12
    },
    categoryRow: {
      gap: 10
    },
    categoryItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border
    },
    categoryLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      marginLeft: 10
    },
    categoryCount: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text
    },

    // Filters
    filtersContainer: {
      marginBottom: 16
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border
    },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      fontSize: 15,
      color: colors.text
    },
    filterButtons: {
      flexDirection: "row",
      gap: 10
    },
    filterButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary
    },
    filterButtonText: {
      fontSize: 13,
      color: colors.text
    },
    filterButtonTextActive: {
      color: "#fff"
    },

    // Models List
    modelsList: {
      gap: 10
    },
    modelCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border
    },
    modelCardInactive: {
      opacity: 0.6,
      borderColor: colors.error + "40"
    },
    modelCardNew: {
      borderColor: "#7c3aed",
      borderWidth: 2
    },
    modelHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start"
    },
    modelInfo: {
      flex: 1
    },
    newBadge: {
      backgroundColor: "#7c3aed",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      alignSelf: "flex-start",
      marginBottom: 6
    },
    newBadgeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "700"
    },
    modelName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4
    },
    modelId: {
      fontSize: 12,
      color: colors.textSecondary,
      fontFamily: Platform.OS === "web" ? "monospace" : undefined
    },
    modelActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    inactiveBadge: {
      backgroundColor: colors.error + "20",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4
    },
    inactiveBadgeText: {
      color: colors.error,
      fontSize: 10,
      fontWeight: "600"
    },
    badgesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 10
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "500"
    },
    expandedDetails: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6
    },
    detailLabel: {
      fontSize: 13,
      color: colors.textSecondary
    },
    detailValue: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "500"
    },
    descriptionContainer: {
      marginTop: 8,
      padding: 10,
      backgroundColor: colors.background,
      borderRadius: 8
    },
    descriptionText: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18
    },

    // Pagination
    pagination: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 16,
      marginTop: 16
    },
    pageButton: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border
    },
    pageButtonDisabled: {
      opacity: 0.4
    },
    pageButtonText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "500"
    },
    pageInfo: {
      fontSize: 14,
      color: colors.textSecondary
    },

    // Error
    errorContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.error + "20",
      padding: 12,
      borderRadius: 8,
      marginTop: 16
    },
    errorText: {
      color: colors.error,
      fontSize: 14
    }
  });
