import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Clipboard,
} from "react-native";
import { useRouter } from "expo-router";
import { ethers } from "ethers";
import {
  SUBNET_CHAIN_ID,
  SUBNET_RPC,
  ZEROP_TOKEN_ADDRESS,
  OPERATOR_REGISTRY_ADDRESS,
  SUBNET_REWARDS_ADDRESS,
  OPERATOR_REGISTRY_ABI,
  SUBNET_REWARDS_ABI,
  getSubnetProvider,
} from "../lib/subnetContracts";
import {
  ArrowLeft,
  Activity,
  Copy,
  RefreshCw,
  Layers,
  ArrowRightLeft,
  CheckCircle,
  XCircle,
  Cpu,
  Zap,
  Box,
  ChevronRight,
} from "lucide-react-native";

const MONO = Platform.OS === "ios" ? "Menlo" : "monospace";
const GREEN = "#00FF41";
const DIM = "rgba(255,255,255,0.35)";
const CARD_BG = "rgba(255,255,255,0.04)";
const CARD_BORDER = "rgba(255,255,255,0.08)";

type Tab = "overview" | "blocks" | "txns";

interface BlockInfo {
  number: number;
  hash: string;
  timestamp: number;
  txCount: number;
  gasUsed: string;
  miner: string;
}

interface TxInfo {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  blockNumber: number;
  timestamp: number;
  status: boolean;
  methodId: string;
}

interface SubnetStats {
  blockNumber: number;
  gasPrice: string;
  connected: boolean;
  epoch: number;
  minStake: string;
  operatorCount: number;
  rewardsPool: string;
}

// ── Helpers ──────────────────────────────────────────────────────

const truncAddr = (s: string) => s ? `${s.slice(0, 6)}...${s.slice(-4)}` : "—";
const truncHash = (s: string) => s ? `${s.slice(0, 10)}...${s.slice(-6)}` : "—";

const timeAgo = (ts: number) => {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const fmtZerop = (wei: string) => {
  try {
    const v = parseFloat(ethers.formatEther(wei));
    if (v === 0) return "0";
    if (v < 0.001) return "< 0.001";
    if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return v.toFixed(4);
  } catch {
    return "0";
  }
};

const fmtGwei = (wei: string) => {
  try {
    return parseFloat(ethers.formatUnits(wei, "gwei")).toFixed(1);
  } catch {
    return "0";
  }
};

const KNOWN_CONTRACTS: Record<string, string> = {
  [ZEROP_TOKEN_ADDRESS.toLowerCase()]: "WZEROP",
  [OPERATOR_REGISTRY_ADDRESS.toLowerCase()]: "Registry",
  [SUBNET_REWARDS_ADDRESS.toLowerCase()]: "Rewards",
};

const labelAddr = (addr: string | null) => {
  if (!addr) return "Contract Create";
  const name = KNOWN_CONTRACTS[addr.toLowerCase()];
  return name ? name : truncAddr(addr);
};

const copyText = (text: string) => {
  if (Platform.OS === "web") {
    try { navigator.clipboard.writeText(text); } catch {}
  } else {
    Clipboard.setString(text);
  }
};

// ── Component ────────────────────────────────────────────────────

export default function ExplorerScreen() {
  const router = useRouter();
  const providerRef = useRef<ethers.JsonRpcProvider | null>(null);

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [stats, setStats] = useState<SubnetStats | null>(null);
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [txs, setTxs] = useState<TxInfo[]>([]);

  const getProvider = useCallback(() => {
    if (!providerRef.current) {
      providerRef.current = getSubnetProvider();
    }
    return providerRef.current;
  }, []);

  // ── Fetch all data ──
  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const provider = getProvider();

      // 1. Basic chain info
      const [blockNum, feeData] = await Promise.all([
        provider.getBlockNumber(),
        provider.getFeeData(),
      ]);

      // 2. Contract stats (safe calls)
      let epoch = 0, minStake = "0", operatorCount = 0, rewardsPool = "0";
      try {
        const registry = new ethers.Contract(OPERATOR_REGISTRY_ADDRESS, OPERATOR_REGISTRY_ABI, provider);
        const rewards = new ethers.Contract(SUBNET_REWARDS_ADDRESS, SUBNET_REWARDS_ABI, provider);

        const [epochResult, minStakeResult, opCountResult, globalStats] = await Promise.all([
          rewards.currentEpoch().catch(() => 0n),
          registry.MIN_STAKE_AMOUNT().catch(() => 0n),
          registry.getActiveOperatorCount().catch(() => 0n),
          rewards.getGlobalEpochStats().catch(() => null),
        ]);
        epoch = Number(epochResult);
        minStake = minStakeResult.toString();
        operatorCount = Number(opCountResult);
        if (globalStats) {
          rewardsPool = globalStats[1]?.toString() || "0";
        }
      } catch (e) {
        console.warn("[Explorer] contract stats error:", e);
      }

      setStats({
        blockNumber: blockNum,
        gasPrice: feeData.gasPrice?.toString() || "0",
        connected: true,
        epoch,
        minStake,
        operatorCount,
        rewardsPool,
      });

      // 3. Fetch blocks
      const fetchedBlocks: BlockInfo[] = [];
      const numBlocks = Math.min(blockNum + 1, 15);
      for (let i = 0; i < numBlocks; i++) {
        const n = blockNum - i;
        if (n < 0) break;
        try {
          const block = await provider.getBlock(n);
          if (block) {
            fetchedBlocks.push({
              number: block.number,
              hash: block.hash || "",
              timestamp: block.timestamp,
              txCount: block.transactions.length,
              gasUsed: block.gasUsed.toString(),
              miner: block.miner,
            });
          }
        } catch {
          // skip
        }
      }
      setBlocks(fetchedBlocks);

      // 4. Fetch transactions from recent blocks
      const fetchedTxs: TxInfo[] = [];
      for (const blk of fetchedBlocks.slice(0, 10)) {
        if (fetchedTxs.length >= 20) break;
        try {
          const fullBlock = await provider.getBlock(blk.number, true);
          if (!fullBlock) continue;
          for (const txHash of fullBlock.transactions) {
            if (fetchedTxs.length >= 20) break;
            try {
              const [tx, receipt] = await Promise.all([
                provider.getTransaction(txHash as string),
                provider.getTransactionReceipt(txHash as string),
              ]);
              if (tx) {
                fetchedTxs.push({
                  hash: tx.hash,
                  from: tx.from,
                  to: tx.to,
                  value: tx.value.toString(),
                  blockNumber: blk.number,
                  timestamp: blk.timestamp,
                  status: receipt?.status === 1,
                  methodId: tx.data?.slice(0, 10) || "0x",
                });
              }
            } catch {
              // skip individual tx
            }
          }
        } catch {
          // skip block
        }
      }
      setTxs(fetchedTxs);
    } catch (e: any) {
      console.error("[Explorer] fetchAll error:", e);
      setError(e?.message || "Failed to connect to subnet RPC");
      setStats(null);
    }
  }, [getProvider]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Reset provider to force fresh connection
    providerRef.current = null;
    await fetchAll();
    setRefreshing(false);
  };

  // ── Render helpers ──

  const StatBox = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <View style={s.statBox}>
      <Text style={[s.statValue, accent && { color: GREEN }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );

  const CopyRow = ({ label, value, full }: { label: string; value: string; full?: string }) => (
    <TouchableOpacity style={s.copyRow} onPress={() => copyText(full || value)} activeOpacity={0.7}>
      <Text style={s.copyRowLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" }}>
        <Text style={s.copyRowValue} numberOfLines={1}>{value}</Text>
        <Copy size={11} color={DIM} />
      </View>
    </TouchableOpacity>
  );

  // ── Tab: Overview ──
  const renderOverview = () => (
    <>
      {/* Connection Status */}
      <View style={s.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <View style={[s.dot, { backgroundColor: stats?.connected ? GREEN : "#F44336" }]} />
          <Text style={s.cardTitle}>ZeroPrompt Subnet</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>L1</Text>
          </View>
        </View>

        <View style={s.statsGrid}>
          <StatBox label="Block Height" value={stats?.blockNumber?.toLocaleString() || "—"} accent />
          <StatBox label="Gas Price" value={`${fmtGwei(stats?.gasPrice || "0")} gwei`} />
          <StatBox label="Chain ID" value={String(SUBNET_CHAIN_ID)} />
          <StatBox label="Epoch" value={String(stats?.epoch || 0)} />
        </View>
      </View>

      {/* Protocol Stats */}
      <View style={s.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Zap size={14} color={GREEN} />
          <Text style={s.cardTitle}>Protocol</Text>
        </View>
        <View style={s.statsGrid}>
          <StatBox label="Operators" value={String(stats?.operatorCount || 0)} accent />
          <StatBox label="Min Stake" value={`${fmtZerop(stats?.minStake || "0")} ZEROP`} />
          <StatBox label="Rewards Pool" value={`${fmtZerop(stats?.rewardsPool || "0")} ZEROP`} />
          <StatBox label="Current Epoch" value={String(stats?.epoch || 0)} />
        </View>
      </View>

      {/* Contracts */}
      <View style={s.card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Cpu size={14} color="#2196F3" />
          <Text style={s.cardTitle}>Deployed Contracts</Text>
        </View>
        <CopyRow label="WZEROP Token" value={truncAddr(ZEROP_TOKEN_ADDRESS)} full={ZEROP_TOKEN_ADDRESS} />
        <CopyRow label="Operator Registry" value={truncAddr(OPERATOR_REGISTRY_ADDRESS)} full={OPERATOR_REGISTRY_ADDRESS} />
        <CopyRow label="Subnet Rewards" value={truncAddr(SUBNET_REWARDS_ADDRESS)} full={SUBNET_REWARDS_ADDRESS} />
        <View style={{ marginTop: 10 }}>
          <CopyRow label="RPC Endpoint" value={SUBNET_RPC.slice(0, 35) + "..."} full={SUBNET_RPC} />
        </View>
      </View>

      {/* Recent Blocks Preview */}
      <View style={s.card}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
          onPress={() => setTab("blocks")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Box size={14} color="#FF9800" />
            <Text style={s.cardTitle}>Recent Blocks</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: DIM, fontSize: 12 }}>View all</Text>
            <ChevronRight size={14} color={DIM} />
          </View>
        </TouchableOpacity>
        {blocks.slice(0, 5).map((b) => (
          <View key={b.number} style={s.listRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <Text style={[s.mono, { color: GREEN, fontSize: 13, fontWeight: "700", minWidth: 36 }]}>#{b.number}</Text>
              <Text style={{ color: DIM, fontSize: 11 }}>{timeAgo(b.timestamp)}</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>
              {b.txCount} tx{b.txCount !== 1 ? "s" : ""}
            </Text>
          </View>
        ))}
        {blocks.length === 0 && <Text style={{ color: DIM, fontSize: 12, textAlign: "center", padding: 12 }}>No blocks found</Text>}
      </View>

      {/* Recent Transactions Preview */}
      <View style={s.card}>
        <TouchableOpacity
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}
          onPress={() => setTab("txns")}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ArrowRightLeft size={14} color="#4CAF50" />
            <Text style={s.cardTitle}>Recent Transactions</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: DIM, fontSize: 12 }}>View all</Text>
            <ChevronRight size={14} color={DIM} />
          </View>
        </TouchableOpacity>
        {txs.slice(0, 5).map((tx) => (
          <TouchableOpacity key={tx.hash} style={s.listRow} onPress={() => copyText(tx.hash)}>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {tx.status ? <CheckCircle size={11} color={GREEN} /> : <XCircle size={11} color="#F44336" />}
                <Text style={[s.mono, { color: "#60A5FA", fontSize: 12 }]}>{truncHash(tx.hash)}</Text>
              </View>
              <Text style={{ color: DIM, fontSize: 11 }}>
                {truncAddr(tx.from)} → {labelAddr(tx.to)}
              </Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>{timeAgo(tx.timestamp)}</Text>
          </TouchableOpacity>
        ))}
        {txs.length === 0 && <Text style={{ color: DIM, fontSize: 12, textAlign: "center", padding: 12 }}>No transactions found</Text>}
      </View>
    </>
  );

  // ── Tab: Blocks ──
  const renderBlocks = () => (
    <View style={s.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Box size={14} color="#FF9800" />
        <Text style={s.cardTitle}>All Blocks</Text>
        <Text style={{ color: DIM, fontSize: 12 }}>({blocks.length})</Text>
      </View>
      {blocks.map((b) => (
        <View key={b.number} style={s.blockRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={s.blockNum}>
              <Text style={[s.mono, { color: GREEN, fontSize: 13, fontWeight: "700" }]}>#{b.number}</Text>
            </View>
            <View style={{ gap: 2 }}>
              <TouchableOpacity onPress={() => copyText(b.hash)}>
                <Text style={[s.mono, { color: "#60A5FA", fontSize: 11 }]}>{truncHash(b.hash)}</Text>
              </TouchableOpacity>
              <Text style={{ color: DIM, fontSize: 11 }}>Miner: {truncAddr(b.miner)}</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" }}>
              {b.txCount} tx{b.txCount !== 1 ? "s" : ""}
            </Text>
            <Text style={{ color: DIM, fontSize: 11 }}>{timeAgo(b.timestamp)}</Text>
          </View>
        </View>
      ))}
      {blocks.length === 0 && (
        <Text style={{ color: DIM, fontSize: 13, textAlign: "center", padding: 20 }}>No blocks found</Text>
      )}
    </View>
  );

  // ── Tab: Transactions ──
  const renderTxns = () => (
    <View style={s.card}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <ArrowRightLeft size={14} color="#4CAF50" />
        <Text style={s.cardTitle}>All Transactions</Text>
        <Text style={{ color: DIM, fontSize: 12 }}>({txs.length})</Text>
      </View>
      {txs.map((tx) => (
        <TouchableOpacity key={tx.hash} style={s.txRow} onPress={() => copyText(tx.hash)} activeOpacity={0.7}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
            <View style={[s.statusDot, { backgroundColor: tx.status ? GREEN : "#F44336" }]}>
              {tx.status ? <CheckCircle size={10} color="#000" /> : <XCircle size={10} color="#fff" />}
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.mono, { color: "#60A5FA", fontSize: 12 }]}>{truncHash(tx.hash)}</Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                From: <Text style={s.mono}>{truncAddr(tx.from)}</Text>
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                To: <Text style={[s.mono, KNOWN_CONTRACTS[tx.to?.toLowerCase() || ""] ? { color: GREEN } : {}]}>
                  {labelAddr(tx.to)}
                </Text>
              </Text>
              {tx.value !== "0" && (
                <Text style={{ color: "#FF9800", fontSize: 11 }}>
                  Value: {fmtZerop(tx.value)} ZEROP
                </Text>
              )}
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 3 }}>
            <Text style={{ color: DIM, fontSize: 11 }}>Block #{tx.blockNumber}</Text>
            <Text style={{ color: DIM, fontSize: 11 }}>{timeAgo(tx.timestamp)}</Text>
            {tx.methodId !== "0x" && tx.methodId.length >= 10 && (
              <View style={s.methodBadge}>
                <Text style={s.methodText}>{tx.methodId.slice(0, 10)}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ))}
      {txs.length === 0 && (
        <Text style={{ color: DIM, fontSize: 13, textAlign: "center", padding: 20 }}>No transactions found</Text>
      )}
    </View>
  );

  // ── Main render ──
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
          <ArrowLeft size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerTitle}>Block Explorer</Text>
          <Text style={s.headerSub}>ZeroPrompt Subnet</Text>
        </View>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing} style={{ padding: 8 }}>
          <RefreshCw size={18} color={refreshing ? DIM : GREEN} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {([
          { key: "overview" as Tab, label: "Overview", icon: Activity },
          { key: "blocks" as Tab, label: "Blocks", icon: Layers },
          { key: "txns" as Tab, label: "Transactions", icon: ArrowRightLeft },
        ]).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <t.icon size={13} color={tab === t.key ? GREEN : DIM} />
            <Text style={[s.tabText, tab === t.key && { color: "#fff" }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={{ color: DIM, marginTop: 12, fontSize: 13 }}>Connecting to subnet...</Text>
          </View>
        ) : error ? (
          <View style={[s.card, { alignItems: "center", paddingVertical: 30 }]}>
            <XCircle size={32} color="#F44336" />
            <Text style={{ color: "#F44336", fontSize: 15, fontWeight: "600", marginTop: 12 }}>Connection Failed</Text>
            <Text style={{ color: DIM, fontSize: 12, marginTop: 6, textAlign: "center" }}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={handleRefresh}>
              <RefreshCw size={14} color="#000" />
              <Text style={{ color: "#000", fontWeight: "700", fontSize: 13 }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {tab === "overview" && renderOverview()}
            {tab === "blocks" && renderBlocks()}
            {tab === "txns" && renderTxns()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  headerSub: { color: DIM, fontSize: 11, marginTop: 1 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
    paddingHorizontal: 12,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: GREEN },
  tabText: { color: DIM, fontSize: 13, fontWeight: "600" },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  badge: {
    backgroundColor: "rgba(0,255,65,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: { color: GREEN, fontSize: 10, fontWeight: "800", fontFamily: MONO },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    padding: 12,
    minWidth: "46%" as any,
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  statValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: MONO,
    marginBottom: 4,
  },
  statLabel: { color: DIM, fontSize: 11 },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  copyRowLabel: { color: "rgba(255,255,255,0.6)", fontSize: 12, minWidth: 110 },
  copyRowValue: { color: "#60A5FA", fontSize: 12, fontFamily: MONO },
  mono: { fontFamily: MONO },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  blockNum: {
    backgroundColor: "rgba(0,255,65,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 50,
    alignItems: "center",
  },
  txRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  methodBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  methodText: { color: DIM, fontSize: 9, fontFamily: MONO },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GREEN,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
});
