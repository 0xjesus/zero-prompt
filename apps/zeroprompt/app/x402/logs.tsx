import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl
} from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Zap,
  ExternalLink,
  Filter
} from "lucide-react-native";
import { API_URL } from "../../config/api";

interface X402Payment {
  id: number;
  txHash: string | null;
  fromAddress: string;
  toAddress: string;
  amountUSDC: string;
  priceUSD: string;
  endpoint: string;
  model: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  totalUSDC: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const getStatusStyle = () => {
    switch (status) {
      case 'success':
        return { bg: 'rgba(0, 255, 65, 0.1)', color: '#00FF41', icon: CheckCircle };
      case 'failed':
        return { bg: 'rgba(255, 68, 68, 0.1)', color: '#FF4444', icon: XCircle };
      default:
        return { bg: 'rgba(255, 193, 7, 0.1)', color: '#FFC107', icon: Clock };
    }
  };

  const { bg, color, icon: Icon } = getStatusStyle();

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Icon size={12} color={color} />
      <Text style={[styles.badgeText, { color }]}>{status}</Text>
    </View>
  );
};

const truncateAddress = (address: string) => {
  if (!address) return 'N/A';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const truncateTxHash = (hash: string | null) => {
  if (!hash) return 'N/A';
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function X402LogsScreen() {
  const router = useRouter();
  const { theme: colors } = useTheme();

  const [payments, setPayments] = useState<X402Payment[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');

  const fetchLogs = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);

    try {
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const res = await fetch(`${API_URL}/agent/x402-logs?limit=200${statusParam}`);

      if (!res.ok) {
        throw new Error("Failed to fetch x402 logs");
      }

      const data = await res.json();
      setPayments(data.payments || []);
      setStats(data.stats || null);
    } catch (err: any) {
      console.error("x402 logs fetch error:", err);
      setError(err.message || "Failed to load logs");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchLogs(false);
  };

  const openTxInExplorer = (txHash: string | null) => {
    if (!txHash) return;
    const url = `https://snowtrace.io/tx/${txHash}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    }
  };

  const FilterButton = ({ value, label }: { value: typeof filter; label: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === value && styles.filterButtonActive,
        { borderColor: colors.border }
      ]}
      onPress={() => setFilter(value)}
    >
      <Text style={[
        styles.filterButtonText,
        filter === value && styles.filterButtonTextActive,
        { color: filter === value ? '#000' : colors.textSecondary }
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>x402 Payment Logs</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw size={20} color={isLoading ? colors.textSecondary : colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <DollarSign size={20} color="#00FF41" />
              <Text style={[styles.statValue, { color: colors.text }]}>${stats.totalUSDC}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Revenue</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <CheckCircle size={20} color="#00FF41" />
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.successful}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Successful</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <XCircle size={20} color="#FF4444" />
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.failed}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Failed</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Zap size={20} color="#FFC107" />
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Requests</Text>
            </View>
          </View>
        )}

        {/* Filter Buttons */}
        <View style={styles.filterContainer}>
          <Filter size={16} color={colors.textSecondary} />
          <FilterButton value="all" label="All" />
          <FilterButton value="success" label="Success" />
          <FilterButton value="failed" label="Failed" />
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00FF41" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading payments...
            </Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: 'rgba(255, 68, 68, 0.1)' }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Payments Table */}
        {!isLoading && !error && (
          <View style={[styles.tableContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {/* Table Header */}
            <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableHeaderCell, styles.colStatus, { color: colors.textSecondary }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount, { color: colors.textSecondary }]}>Amount</Text>
              <Text style={[styles.tableHeaderCell, styles.colEndpoint, { color: colors.textSecondary }]}>Endpoint</Text>
              <Text style={[styles.tableHeaderCell, styles.colFrom, { color: colors.textSecondary }]}>From</Text>
              <Text style={[styles.tableHeaderCell, styles.colTx, { color: colors.textSecondary }]}>Tx Hash</Text>
              <Text style={[styles.tableHeaderCell, styles.colDate, { color: colors.textSecondary }]}>Date</Text>
            </View>

            {/* Table Rows */}
            {payments.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                  No payments found
                </Text>
              </View>
            ) : (
              payments.map((payment) => (
                <View key={payment.id} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.tableCell, styles.colStatus]}>
                    <StatusBadge status={payment.status} />
                  </View>
                  <View style={[styles.tableCell, styles.colAmount]}>
                    <Text style={[styles.amountText, { color: colors.text }]}>
                      ${payment.amountUSDC}
                    </Text>
                    <Text style={[styles.priceText, { color: colors.textSecondary }]}>
                      (price: ${payment.priceUSD})
                    </Text>
                  </View>
                  <View style={[styles.tableCell, styles.colEndpoint]}>
                    <Text style={[styles.endpointText, { color: '#00FF41' }]}>
                      {payment.endpoint}
                    </Text>
                    {payment.model && (
                      <Text style={[styles.modelText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {payment.model.split('/')[1] || payment.model}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.tableCell, styles.colFrom]}>
                    <Text style={[styles.addressText, { color: colors.text }]}>
                      {truncateAddress(payment.fromAddress)}
                    </Text>
                  </View>
                  <View style={[styles.tableCell, styles.colTx]}>
                    {payment.txHash ? (
                      <TouchableOpacity
                        style={styles.txLink}
                        onPress={() => openTxInExplorer(payment.txHash)}
                      >
                        <Text style={styles.txText}>{truncateTxHash(payment.txHash)}</Text>
                        <ExternalLink size={12} color="#00FF41" />
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.naText, { color: colors.textSecondary }]}>N/A</Text>
                    )}
                  </View>
                  <View style={[styles.tableCell, styles.colDate]}>
                    <Text style={[styles.dateText, { color: colors.textSecondary }]}>
                      {formatDate(payment.createdAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterButtonActive: {
    backgroundColor: '#00FF41',
    borderColor: '#00FF41',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#000',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 14,
  },
  tableContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tableCell: {
    justifyContent: 'center',
  },
  colStatus: { width: 90 },
  colAmount: { width: 100 },
  colEndpoint: { flex: 1, minWidth: 120 },
  colFrom: { width: 110 },
  colTx: { width: 130 },
  colDate: { width: 100 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceText: {
    fontSize: 11,
  },
  endpointText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  modelText: {
    fontSize: 11,
    marginTop: 2,
  },
  addressText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  txLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txText: {
    fontSize: 12,
    color: '#00FF41',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  naText: {
    fontSize: 12,
  },
  dateText: {
    fontSize: 11,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
  },
});
