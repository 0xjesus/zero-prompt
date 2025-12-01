import { useEffect, useState, useMemo } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  Image,
  Switch,
  useWindowDimensions,
  LayoutAnimation
} from "react-native";
import {
  Terminal, Save, RefreshCw, Edit2, X, Upload,
  Search, Filter, ArrowUp, ArrowDown, CheckSquare, Square, ArrowLeft,
  Image as ImageIcon, Globe, Brain, Mic, Trash2, MoreHorizontal, ChevronDown, ChevronUp, Gift
} from 'lucide-react-native';

const ZEROPROMPT_LOGO = require('../assets/logos/zero-prompt-logo.png');
import { useTheme } from "../context/ThemeContext";

const API_URL = "http://localhost:3001";

type Model = {
  id: number;
  openrouterId: string;
  name: string;
  description?: string;
  contextLength?: number;
  publicPricingPrompt?: number;
  publicPricingCompletion?: number;
  architecture?: { modality?: string; has_web_search?: boolean; is_reasoning?: boolean; has_audio?: boolean };
  isActive: boolean;
  iconUrl?: string;
};

export default function AdminScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width > 1024;
  
  // Data
  const [rawModels, setRawModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Model>('isActive'); 
  const [sortDesc, setSortDesc] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [capFilter, setCapFilter] = useState<'all' | 'image' | 'web' | 'reasoning'>('all');
  
  // UI State
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Selection & Edit
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [editingModel, setEditingModel] = useState<Model | null>(null);

  // --- Fetch ---
  const fetchModels = () => {
    setLoading(true);
    fetch(`${API_URL}/models`)
      .then((r) => r.json())
      .then((data) => setRawModels(data.models || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchModels(); }, []);

  // --- Computed ---
  const filteredModels = useMemo(() => {
      let res = rawModels;

      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          res = res.filter(m => 
              m.name.toLowerCase().includes(q) || 
              m.openrouterId.toLowerCase().includes(q) ||
              (m.description || "").toLowerCase().includes(q)
          );
      }

      if (activeFilter !== 'all') {
          res = res.filter(m => activeFilter === 'active' ? m.isActive : !m.isActive);
      }

      if (capFilter !== 'all') {
          if (capFilter === 'image') res = res.filter(m => m.architecture?.modality?.includes('image'));
          if (capFilter === 'web') res = res.filter(m => m.architecture?.has_web_search);
          if (capFilter === 'reasoning') res = res.filter(m => m.architecture?.is_reasoning);
      }

      res = [...res].sort((a, b) => {
          if (sortField === 'isActive') return sortDesc ? (a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1) : (a.isActive === b.isActive ? 0 : a.isActive ? 1 : -1);
          
          const valA = a[sortField] as any;
          const valB = b[sortField] as any;
          if (valA < valB) return sortDesc ? 1 : -1;
          if (valA > valB) return sortDesc ? -1 : 1;
          return 0;
      });

      return res;
  }, [rawModels, searchQuery, sortField, sortDesc, activeFilter, capFilter]);

  // --- Actions ---
  const toggleExpanded = (id: number) => {
      const next = new Set(expandedItems);
      if (next.has(id)) next.delete(id); else next.add(id);
      setExpandedItems(next);
  };

  const toggleRowExpand = (id: number) => {
      const next = new Set(expandedRows);
      if (next.has(id)) next.delete(id); else next.add(id);
      setExpandedRows(next);
  };

  const handleSort = (field: keyof Model) => {
      if (sortField === field) setSortDesc(!sortDesc);
      else {
          setSortField(field);
          setSortDesc(true);
      }
  };

  const toggleSelection = (id: number) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      setSelectedIds(next);
  };

  const toggleSelectAll = () => {
      if (selectedIds.size === filteredModels.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(filteredModels.map(m => m.id)));
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate') => {
      if (selectedIds.size === 0) return;
      const updates = Array.from(selectedIds).map(id => 
          fetch(`${API_URL}/models/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isActive: action === 'activate' })
          })
      );
      await Promise.all(updates);
      fetchModels();
      setSelectedIds(new Set());
  };

  const handleSync = async () => {
      setSyncing(true);
      try {
          await fetch(`${API_URL}/models/sync`, { method: "POST" });
          fetchModels();
          alert("Synced!");
      } catch (e) { alert("Sync failed"); } 
      finally { setSyncing(false); }
  };

  const handleSave = async () => {
      if (!editingModel) return;
      try {
          const res = await fetch(`${API_URL}/models/${editingModel.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(editingModel)
          });
          if (res.ok) {
              setEditingModel(null);
              fetchModels();
          } else {
              alert("Update failed");
          }
      } catch (e) {
          alert("Error saving model");
      }
  };

  const handleImageUpload = async (e: any) => {
      if (Platform.OS !== 'web') return;
      const file = e.target.files[0];
      if (!file) return;

      try {
          const presignRes = await fetch(`${API_URL}/storage/presigned?fileName=${file.name}&contentType=${file.type}&folder=models`);
          const { uploadUrl, publicUrl } = await presignRes.json();

          await fetch(uploadUrl, {
              method: "PUT",
              body: file,
              headers: { "Content-Type": file.type, "x-amz-acl": "public-read" }
          });

          setEditingModel({ ...editingModel!, iconUrl: publicUrl });
      } catch (err) {
          alert("Upload failed");
      }
  };

  // --- RENDERERS ---

  const CapsBadges = ({ m }: { m: Model }) => (
      <View style={{flexDirection: 'row', gap: 6, flexWrap: 'wrap'}}>
          {m.architecture?.modality?.includes('image') && (
              <View style={[styles.badge, {borderColor: theme.accent, backgroundColor: 'rgba(0,255,255,0.15)'}]}>
                  <ImageIcon size={10} color={theme.accent} />
                  <Text style={[styles.badgeText, {color: '#000'}]}>Visual</Text>
              </View>
          )}
          {m.architecture?.has_web_search && (
              <View style={[styles.badge, {borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.15)'}]}>
                  <Globe size={10} color="#4CAF50" />
                  <Text style={[styles.badgeText, {color: '#4CAF50'}]}>Web</Text>
              </View>
          )}
          {m.architecture?.is_reasoning && (
              <View style={[styles.badge, {borderColor: '#9C27B0', backgroundColor: 'rgba(156,39,176,0.15)'}]}>
                  <Brain size={10} color="#9C27B0" />
                  <Text style={[styles.badgeText, {color: '#9C27B0'}]}>Thinking</Text>
              </View>
          )}
          {m.architecture?.has_audio && (
              <View style={[styles.badge, {borderColor: '#FF9800', backgroundColor: 'rgba(255,152,0,0.15)'}]}>
                  <Mic size={10} color="#FF9800" />
                  <Text style={[styles.badgeText, {color: '#FF9800'}]}>Audio</Text>
              </View>
          )}
      </View>
  );

  // 1. Mobile Card View
  const renderCard = ({ item }: { item: Model }) => {
      const expanded = expandedItems.has(item.id);
      const isSelected = selectedIds.has(item.id);

      return (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: isSelected ? theme.primary : theme.border }]}>
              <View style={styles.cardHeader}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1}}>
                      <TouchableOpacity onPress={() => toggleSelection(item.id)}>
                          {isSelected ? <CheckSquare size={20} color={theme.primary}/> : <Square size={20} color={theme.secondary}/>}
                      </TouchableOpacity>
                      {item.iconUrl ? 
                          <Image source={{uri: item.iconUrl}} style={{width: 32, height: 32, borderRadius: 6}} /> : 
                          <View style={[styles.iconPlaceholder, { backgroundColor: theme.background }]}>
                              <Terminal size={16} color={theme.secondary} />
                          </View>
                      }
                      <View style={{flex: 1}}>
                          <Text style={[styles.cardTitle, {color: theme.text}]} numberOfLines={1}>{item.name}</Text>
                          <Text style={{color: theme.secondary, fontSize: 10}}>{item.openrouterId}</Text>
                      </View>
                  </View>
                  <Switch 
                      value={item.isActive} 
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor={theme.background}
                  />
              </View>

              <View style={styles.cardStats}>
                  <CapsBadges m={item} />
                  <View style={{flexDirection: 'row', gap: 12, marginTop: 8}}>
                      <Text style={{color: theme.text, fontSize: 12}}>
                          <Text style={{color: theme.secondary}}>CTX: </Text>{Math.round((item.contextLength || 0) / 1024)}k
                      </Text>
                      <Text style={{color: theme.text, fontSize: 12}}>
                          <Text style={{color: theme.secondary}}>IN: </Text>${item.publicPricingPrompt}
                      </Text>
                      <Text style={{color: theme.text, fontSize: 12}}>
                          <Text style={{color: theme.secondary}}>OUT: </Text>${item.publicPricingCompletion}
                      </Text>
                  </View>
              </View>

              <TouchableOpacity onPress={() => toggleExpanded(item.id)} style={styles.cardDescBtn}>
                  <Text numberOfLines={expanded ? undefined : 2} style={{color: theme.textMuted, fontSize: 12, flex: 1}}>
                      {item.description || "No description available."}
                  </Text>
                  {expanded ? <ChevronUp size={14} color={theme.secondary}/> : <ChevronDown size={14} color={theme.secondary}/>}
              </TouchableOpacity>

              {expanded && (
                  <View style={[styles.cardActions, {borderTopColor: theme.border}]}>
                      <TouchableOpacity style={[styles.actionBtn, {backgroundColor: theme.background}]} onPress={() => setEditingModel(item)}>
                          <Edit2 size={14} color={theme.text}/>
                          <Text style={{color: theme.text, fontSize: 12, fontWeight: 'bold'}}>Edit Config</Text>
                      </TouchableOpacity>
                  </View>
              )}
          </View>
      );
  };

  // 2. Desktop Table View
  const renderRow = ({ item }: { item: Model }) => {
      const isExpanded = expandedRows.has(item.id);
      return (
        <View style={[styles.row, { borderBottomColor: theme.border, backgroundColor: selectedIds.has(item.id) ? 'rgba(0,255,65,0.05)' : 'transparent' }]}>
            <TouchableOpacity onPress={() => toggleSelection(item.id)} style={styles.colSelect}>
                {selectedIds.has(item.id) ? <CheckSquare size={16} color={theme.primary} /> : <Square size={16} color={theme.border} />}
            </TouchableOpacity>
            
            <View style={styles.colName}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    {item.iconUrl ? 
                        <Image source={{uri: item.iconUrl}} style={{width: 24, height: 24, borderRadius: 4}} /> : 
                        <Terminal size={16} color={theme.secondary} />
                    }
                    <View>
                        <Text style={[styles.cellText, { color: theme.text, fontWeight: 'bold' }]} numberOfLines={1}>{item.name}</Text>
                        <Text style={[styles.cellSub, { color: theme.secondary }]} numberOfLines={1}>{item.openrouterId}</Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.colDesc} onPress={() => toggleRowExpand(item.id)}>
                <Text numberOfLines={isExpanded ? undefined : 2} style={{color: theme.textMuted, fontSize: 11}}>
                    {item.description || "No description."}
                </Text>
            </TouchableOpacity>

            <View style={styles.colContext}>
                <Text style={[styles.cellText, {color: theme.text}]}>{Math.round((item.contextLength || 0) / 1024)}k</Text>
            </View>

            <View style={styles.colPrice}>
                <Text style={[styles.cellText, { color: theme.text }]}>${item.publicPricingPrompt}</Text>
                <Text style={[styles.cellSub, { color: theme.secondary }]}>${item.publicPricingCompletion}</Text>
            </View>

            <View style={styles.colCaps}>
                <CapsBadges m={item} />
            </View>

            <View style={styles.colActive}>
                <Switch 
                    value={item.isActive} 
                    activeThumbColor={theme.primary}
                    trackColor={{ false: theme.border, true: 'rgba(0,255,65,0.2)' }}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
            </View>

            <TouchableOpacity style={styles.colAction} onPress={() => setEditingModel(item)}>
                <Edit2 size={16} color={theme.secondary} />
            </TouchableOpacity>
        </View>
      );
  };

  const renderHeader = () => (
      <View style={[styles.row, styles.headerRow, { borderBottomColor: theme.border, backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={toggleSelectAll} style={styles.colSelect}>
              {selectedIds.size > 0 ? <CheckSquare size={16} color={theme.primary} /> : <Square size={16} color={theme.secondary} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleSort('name')} style={styles.colName}><Text style={[styles.th, {color: theme.secondary}]}>MODEL</Text></TouchableOpacity>
          <View style={styles.colDesc}><Text style={[styles.th, {color: theme.secondary}]}>DESCRIPTION</Text></View>
          <TouchableOpacity onPress={() => handleSort('contextLength')} style={styles.colContext}><Text style={[styles.th, {color: theme.secondary}]}>CTX</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => handleSort('publicPricingPrompt')} style={styles.colPrice}><Text style={[styles.th, {color: theme.secondary}]}>PRICE</Text></TouchableOpacity>
          <View style={styles.colCaps}><Text style={[styles.th, {color: theme.secondary}]}>CAPS</Text></View>
          <TouchableOpacity onPress={() => handleSort('isActive')} style={styles.colActive}><Text style={[styles.th, {color: theme.secondary}]}>ON</Text></TouchableOpacity>
          <View style={styles.colAction}></View>
      </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => router.replace("/")} style={{ marginRight: 12 }}>
                  <ArrowLeft color={theme.text} size={24} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: theme.text }]}>GOD MODE</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.syncBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={handleSync}
            disabled={syncing}
          >
              {syncing ? <ActivityIndicator size="small" color={theme.primary} /> : <RefreshCw size={16} color={theme.primary} />}
              <Text style={{ color: theme.primary, fontWeight: 'bold' }}>SYNC</Text>
          </TouchableOpacity>
      </View>

      {/* Toolbar */}
      <View style={[styles.toolbar, { borderBottomColor: theme.border }]}>
          <View style={styles.searchContainer}>
              <Search size={16} color={theme.secondary} />
              <TextInput 
                  placeholder="Search neural models..." 
                  placeholderTextColor={theme.textMuted}
                  style={[styles.searchInput, { color: theme.text }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
              />
          </View>
      </View>

      {/* Filters */}
      <View style={[styles.filterBar, { borderBottomColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8, paddingHorizontal: 12}}>
              {['all', 'active', 'inactive'].map(f => (
                  <TouchableOpacity 
                    key={f} 
                    style={[styles.chip, activeFilter === f && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                    onPress={() => setActiveFilter(f as any)}
                  >
                      <Text style={{color: activeFilter === f ? theme.background : theme.text, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase'}}>{f}</Text>
                  </TouchableOpacity>
              ))}
              <View style={{width: 1, height: 20, backgroundColor: theme.border, marginHorizontal: 4}} />
              {['all', 'image', 'web', 'reasoning'].map(f => (
                  <TouchableOpacity 
                    key={f} 
                    style={[styles.chip, capFilter === f && { backgroundColor: theme.accent, borderColor: theme.accent }]}
                    onPress={() => setCapFilter(f as any)}
                  >
                      <Text style={{color: capFilter === f ? theme.background : theme.text, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase'}}>{f === 'all' ? 'Any Cap' : f}</Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>

      {/* Content */}
      <FlatList 
        data={filteredModels}
        renderItem={isDesktop ? renderRow : renderCard}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={isDesktop ? renderHeader : null}
        stickyHeaderIndices={isDesktop ? [0] : undefined}
        contentContainerStyle={{ paddingBottom: 100, padding: isDesktop ? 0 : 12, gap: isDesktop ? 0 : 12 }}
      />

      {/* Floating Bulk Actions */}
      {selectedIds.size > 0 && (
          <View style={[styles.bulkBar, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
              <Text style={{color: theme.text, fontWeight: 'bold'}}>{selectedIds.size} Selected</Text>
              <View style={{flexDirection: 'row', gap: 8}}>
                  <TouchableOpacity style={[styles.bulkBtn, {backgroundColor: theme.primary}]} onPress={() => handleBulkAction('activate')}>
                      <Text style={{color: theme.background, fontWeight: 'bold'}}>Activate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.bulkBtn, {backgroundColor: '#ff4444'}]} onPress={() => handleBulkAction('deactivate')}>
                      <Text style={{color: '#fff', fontWeight: 'bold'}}>Disable</Text>
                  </TouchableOpacity>
              </View>
          </View>
      )}

      {/* Edit Modal */}
      <Modal visible={!!editingModel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.modalHeader}>
                      <Text style={[styles.modalTitle, { color: theme.text }]}>EDIT CONFIG</Text>
                      <TouchableOpacity onPress={() => setEditingModel(null)}><X color={theme.text}/></TouchableOpacity>
                  </View>
                  <ScrollView>
                      <View style={styles.formGroup}>
                          <Text style={[styles.label, { color: theme.secondary }]}>Display Name</Text>
                          <TextInput 
                            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                            value={editingModel?.name}
                            onChangeText={t => setEditingModel({...editingModel!, name: t})}
                          />
                      </View>
                      <View style={styles.formGroup}>
                          <Text style={[styles.label, { color: theme.secondary }]}>Icon (Upload SVG/PNG)</Text>
                          <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                              {editingModel?.iconUrl && (
                                  <Image source={{ uri: editingModel.iconUrl }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: '#fff' }} />
                              )}
                              {Platform.OS === 'web' && (
                                  <label style={styles.uploadBtn}>
                                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{display: 'none'}} />
                                      <View style={[styles.btnInner, { backgroundColor: theme.primary }]}>
                                          <Upload size={16} color="#000" />
                                          <Text style={{fontWeight: 'bold', color: '#000'}}>Upload</Text>
                                      </View>
                                  </label>
                              )}
                          </View>
                      </View>
                      <View style={styles.rowInputs}>
                          <View style={[styles.formGroup, {flex: 1}]}>
                              <Text style={[styles.label, { color: theme.secondary }]}>Prompt Price ($)</Text>
                              <TextInput 
                                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                                value={String(editingModel?.publicPricingPrompt || "")}
                                onChangeText={t => setEditingModel({...editingModel!, publicPricingPrompt: parseFloat(t)})}
                                keyboardType="numeric"
                              />
                          </View>
                          <View style={[styles.formGroup, {flex: 1}]}>
                              <Text style={[styles.label, { color: theme.secondary }]}>Comp. Price ($)</Text>
                              <TextInput 
                                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
                                value={String(editingModel?.publicPricingCompletion || "")}
                                onChangeText={t => setEditingModel({...editingModel!, publicPricingCompletion: parseFloat(t)})}
                                keyboardType="numeric"
                              />
                          </View>
                      </View>
                  </ScrollView>
                  <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleSave}>
                      <Save size={18} color="#000" />
                      <Text style={{ fontWeight: '900', color: '#000' }}>SAVE CHANGES</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '900' },
  syncBtn: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, alignItems: 'center' },

  toolbar: { flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center', borderBottomWidth: 1 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  searchInput: { flex: 1, fontSize: 14 },
  iconBtn: { padding: 10, borderRadius: 8 },
  
  filterBar: { paddingVertical: 12, borderBottomWidth: 1 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },

  // Card Styles (Mobile)
  card: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  cardTitle: { fontWeight: 'bold', fontSize: 14 },
  cardStats: { padding: 12, gap: 8 },
  cardDescBtn: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardActions: { padding: 12, alignItems: 'flex-end', borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },

  // Table Styles (Desktop)
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, minHeight: 60 },
  headerRow: { paddingVertical: 12, borderBottomWidth: 1 },
  
  colSelect: { width: 40, alignItems: 'center' },
  colName: { flex: 2.5, paddingRight: 12 },
  colDesc: { flex: 3, paddingRight: 12 },
  colContext: { width: 80 },
  colPrice: { width: 100 },
  colCaps: { flex: 1.5 },
  colActive: { width: 50, alignItems: 'center' },
  colAction: { width: 40, alignItems: 'flex-end' },

  th: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  cellText: { fontSize: 13 },
  cellSub: { fontSize: 10, opacity: 0.7 },
  
  iconPlaceholder: { width: 32, height: 32, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: 'bold' },

  bulkBar: { position: 'absolute', bottom: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 10 },
  bulkBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', maxWidth: 500, padding: 24, borderRadius: 16, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 12, marginBottom: 8, fontWeight: 'bold' },
  input: { padding: 12, borderRadius: 8, borderWidth: 1 },
  rowInputs: { flexDirection: 'row', gap: 16 },
  uploadBtn: { cursor: 'pointer' },
  btnInner: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: 8, alignItems: 'center' },
  saveBtn: { flexDirection: 'row', gap: 8, padding: 16, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 16 }
});