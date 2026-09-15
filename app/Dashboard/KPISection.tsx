import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  PixelRatio,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import {
  TrendingUp,
  CheckCircle2,
  BarChart3,
  Clock,
  MapPin,
  Percent,
  Home,
  ChevronUp,
  ChevronDown,
  Pencil,
  X,
  CircleCheckBig,
  ChartNoAxesColumnIncreasing,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import {
  getHouseConnectionCount,
  saveHouseConnection,
  HouseConnectionCountResponse,
} from '@/api/api';
import { useAlert } from '@/hooks/useAlert';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface KPISectionProps {
  showIndicators: boolean;
  setShowIndicators: (val: boolean) => void;
  loadingKpi: boolean;
  theme: any;
  isDark: boolean; // ← ADDED
  kpiData: {
    totalLen: number | string;
    compLen: number | string;
    progressVal: number | string;
    remLen: number | string;
    completedPercentage: string;
    doneConn: number | string;
    totalConn: number | string;
    totalManholes: number | string;
    verifiedManholes: number | string;
    hasManholeInWeightage?: boolean;
    hasHouseConnInWeightage?: boolean;
  };
  config: {
    padding: number;
    gap: number;
  };
  refreshKPI?: () => Promise<void>;
}

// ─── Responsive font scaling ──────────────────────────────────────────────────
const scale = (size: number, screenWidth: number): number => {
  const baseWidth = 375;
  const scaleFactor = Math.min(screenWidth / baseWidth, 1.4);
  const newSize = size * scaleFactor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// ─── Column count by device width ─────────────────────────────────────────────
const getColumns = (width: number): number => {
  if (width >= 768) return 4;
  if (width >= 480) return 3;
  if (width <= 320) return 2;
  return 3;
};

// ─── House Connections Modal ───────────────────────────────────────────────────
interface ConnectionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (noOfConnection: string, totalCount: string) => Promise<void>;
  saving: boolean;
  cumulative: string;
  todayCompleted: string;
  initialTotalTentative: string;
  isDark: boolean; // ← ADDED
  theme: any;      // ← ADDED
}

const ConnectionsModal: React.FC<ConnectionsModalProps> = ({
  visible,
  onClose,
  onSave,
  saving,
  cumulative,
  todayCompleted,
  initialTotalTentative,
  isDark,
  theme,
}) => {
  const [totalTentative, setTotalTentative] = useState(initialTotalTentative);
  const [todayNew, setTodayNew] = useState('');

  const { showAlert, AlertComponent } = useAlert();

  useEffect(() => {
    setTotalTentative(initialTotalTentative);
  }, [initialTotalTentative]);

  const handleSave = async () => {
    if (!todayNew || isNaN(Number(todayNew)) || Number(todayNew) <= 0) {
      showAlert('Invalid Input', "Please enter a valid count for Today's new connections.", 'error');
      return;
    }
    if (!totalTentative || isNaN(Number(totalTentative)) || Number(totalTentative) <= 0) {
      showAlert('Invalid Input', 'Please enter a valid Total tentative connections value.', 'error');
      return;
    }
    const newCumulative = Number(cumulative) + Number(todayNew);
    if (newCumulative > Number(totalTentative)) {
      showAlert(
        'Limit Exceeded',
        `New connection count exceeds total pending connection count.`,
        'error'
      );
      return;
    }
    await onSave(todayNew, totalTentative);
    setTodayNew('');
  };

  const handleClose = () => {
    setTodayNew('');
    onClose();
  };

  // ─── Dark-aware modal colors ───────────────────────────────────────────────
  const cardBg = isDark ? '#252836' : '#fff';
  const titleColor = isDark ? '#E2E8F0' : '#111';
  const dividerColor = isDark ? '#3A3D4E' : '#e5e5e5';
  const labelColor = isDark ? '#94A3B8' : '#333';
  const inputBg = isDark ? '#1E2130' : '#fff';
  const inputBorder = isDark ? '#3A3D4E' : '#ddd';
  const inputText = isDark ? '#E2E8F0' : '#222';
  const placeholderColor = isDark ? '#64748B' : '#aaa';
  const readonlyBg = isDark ? '#2E3147' : '#f5f5f5';
  const readonlyTextColor = isDark ? '#94A3B8' : '#555';
  const closeBtnBg = isDark ? '#2E3147' : '#fff';
  const closeBtnBorder = isDark ? '#3A3D4E' : '#ccc';
  const closeBtnTextColor = isDark ? '#E2E8F0' : '#444';
  const closeIconColor = isDark ? '#94A3B8' : '#555';

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={modalStyles.overlay} onPress={handleClose}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}
          >
            <Pressable
              style={[modalStyles.card, { backgroundColor: cardBg, maxHeight: '85%' }]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 0 }}>

                {/* Header */}
                <View style={modalStyles.header}>
                  <Text style={[modalStyles.title, { color: titleColor }]}>
                    House Connections Details
                  </Text>
                  <TouchableOpacity
                    onPress={handleClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={18} color={closeIconColor} />
                  </TouchableOpacity>
                </View>

                <View style={[modalStyles.divider, { backgroundColor: dividerColor }]} />

                {/* ── Row 1: Total tentative connections — EDITABLE ── */}
                <View style={modalStyles.row}>
                  <Text style={[modalStyles.rowLabel, { color: labelColor }]}>
                    Total tentative connections
                  </Text>
                  <Text style={[modalStyles.colon, { color: labelColor }]}>:</Text>
                  <TextInput
                    style={[
                      modalStyles.input,
                      { color: inputText, backgroundColor: inputBg, borderColor: inputBorder },
                    ]}
                    value={totalTentative}
                    onChangeText={setTotalTentative}
                    placeholder="Enter total"
                    placeholderTextColor={placeholderColor}
                    keyboardType="numeric"
                    editable={!saving}
                  />
                </View>

                {/* ── Row 2: Cumulative connections — READ-ONLY ── */}
                <View style={modalStyles.row}>
                  <Text style={[modalStyles.rowLabel, { color: labelColor }]}>
                    Cumulative connections
                  </Text>
                  <Text style={[modalStyles.colon, { color: labelColor }]}>:</Text>
                  <View style={[
                    modalStyles.readonlyBox,
                    { backgroundColor: readonlyBg, borderColor: inputBorder },
                  ]}>
                    <Text style={[modalStyles.readonlyText, { color: readonlyTextColor }]}>
                      {cumulative}
                    </Text>
                  </View>
                </View>

                {/* ── Row 3: Today's completed connections — READ-ONLY ── */}
                <View style={modalStyles.row}>
                  <Text style={[modalStyles.rowLabel, { color: labelColor }]}>
                    Today's completed connections
                  </Text>
                  <Text style={[modalStyles.colon, { color: labelColor }]}>:</Text>
                  <View style={[
                    modalStyles.readonlyBox,
                    { backgroundColor: readonlyBg, borderColor: inputBorder },
                  ]}>
                    <Text style={[modalStyles.readonlyText, { color: readonlyTextColor }]}>
                      {todayCompleted}
                    </Text>
                  </View>
                </View>

                {/* ── Row 4: Today's new connections — EDITABLE ── */}
                <View style={modalStyles.row}>
                  <Text style={[modalStyles.rowLabel, { color: labelColor }]}>
                    Today's new connections
                  </Text>
                  <Text style={[modalStyles.colon, { color: labelColor }]}>:</Text>
                  <TextInput
                    style={[
                      modalStyles.input,
                      { color: inputText, backgroundColor: inputBg, borderColor: inputBorder },
                    ]}
                    value={todayNew}
                    onChangeText={setTodayNew}
                    placeholder="Enter count"
                    placeholderTextColor={placeholderColor}
                    keyboardType="numeric"
                    editable={!saving}
                  />
                </View>

                {/* Footer */}
                <View style={modalStyles.footer}>
                  <TouchableOpacity
                    style={[
                      modalStyles.closeBtn,
                      { backgroundColor: closeBtnBg, borderColor: closeBtnBorder },
                    ]}
                    onPress={handleClose}
                    activeOpacity={0.8}
                    disabled={saving}
                  >
                    <Text style={[modalStyles.closeBtnText, { color: closeBtnTextColor }]}>
                      Close
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[modalStyles.saveBtn, saving && modalStyles.saveBtnDisabled]}
                    onPress={handleSave}
                    activeOpacity={0.8}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={modalStyles.saveBtnText}>Save</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <AlertComponent />
    </>
  );
};

// ─── Main KPISection ───────────────────────────────────────────────────────────
const KPISection: React.FC<KPISectionProps> = ({
  showIndicators,
  setShowIndicators,
  loadingKpi,
  theme,
  isDark,
  kpiData,
  config,
  refreshKPI,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const { hasAccess, hasWriteAccess } = useAuth();

  // ─── House connection state ──────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [connData, setConnData] = useState<HouseConnectionCountResponse | null>(null);
  const [loadingConn, setLoadingConn] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchConnectionCount = useCallback(async () => {
    setLoadingConn(true);
    try {
      const result = await getHouseConnectionCount();
      setConnData(result);
    } catch (err: any) {
      console.error('❌ fetchConnectionCount error:', err?.message);
    } finally {
      setLoadingConn(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectionCount();
  }, [fetchConnectionCount]);

  const handleSaveConnections = async (noOfConnection: string, totalCount: string) => {
    setSaving(true);
    try {
      await saveHouseConnection({
        no_of_connection: Number(noOfConnection),
        total_count: Number(totalCount),
      });
      setModalVisible(false);
      await fetchConnectionCount();
      if (refreshKPI) await refreshKPI();
    } catch (err: any) {
      console.error('❌ handleSaveConnections error:', err?.message);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const totalConn = connData?.total_connection ?? kpiData.totalConn;
  const doneConn = connData?.done_connection ?? kpiData.doneConn;
  const todayConn = connData?.todays_connection ?? 0;
  const hasManhole = kpiData.hasManholeInWeightage ?? false;
  const hasHouseConn = kpiData.hasHouseConnInWeightage ?? true; // default true for backward compat

  // ─── KPI list — bgColors adapt to dark mode ───────────────────────────────
  const kpiList = [
    { label: 'Total Length', value: `${kpiData.totalLen} KM`, icon: TrendingUp, color: '#D32F2F', bgColor: isDark ? '#3B1F1F' : '#FFEBEE', isConnections: false },
    { label: 'Completed', value: `${kpiData.compLen} KM`, icon: CircleCheckBig, color: '#15803D', bgColor: isDark ? '#1A3A3E' : '#E0F7FA', isConnections: false },
    { label: 'Progress', value: `${kpiData.progressVal}%`, icon: ChartNoAxesColumnIncreasing, color: '#1976D2', bgColor: isDark ? '#1A2C3E' : '#E3F2FD', isConnections: false },
    { label: 'Remaining', value: `${kpiData.remLen} KM`, icon: Clock, color: '#D32F2F', bgColor: isDark ? '#3B1F1F' : '#FFEBEE', isConnections: false },
    { label: 'Completed %', value: `${kpiData.completedPercentage}%`, icon: Percent, color: '#15803D', bgColor: isDark ? '#1A3A3E' : '#E0F7FA', isConnections: false },
  ];

  // 6th card logic:
  // - If House Connections is in weightage → show Connections card (with edit pencil)
  // - Else if Manhole is in weightage but NO House Connections → show Manhole Count as 6th card
  if (hasHouseConn) {
    kpiList.push({
      label: 'Connections',
      value: `${doneConn}/${totalConn}`,
      icon: Home,
      color: '#5C4B7E',
      bgColor: isDark ? '#2A1F3E' : '#F3E5F5',
      isConnections: true,
    });
  } else if (hasManhole) {
    // Manhole replaces House Connections as 6th card
    kpiList.push({
      label: 'Manhole Count',
      value: `${kpiData.verifiedManholes}/${kpiData.totalManholes}`,
      icon: MapPin,
      color: '#f97316',
      bgColor: isDark ? '#3E2A1F' : '#FFF3E0',
      isConnections: false,
    });
  }

  // 7th card: if BOTH House Connections AND Manhole are in weightage
  if (hasHouseConn && hasManhole) {
    kpiList.push({
      label: 'Manhole Count',
      value: `${kpiData.verifiedManholes}/${kpiData.totalManholes}`,
      icon: MapPin,
      color: '#f97316',
      bgColor: isDark ? '#3E2A1F' : '#FFF3E0',
      isConnections: false,
    });
  }

  // ─── Dynamic sizing ────────────────────────────────────────────────────────
  const numColumns = getColumns(screenWidth);
  const colGap = 8;
  const totalGap = colGap * (numColumns - 1);
  const hPadding = config.padding * 2;
  const cardWidth = (screenWidth - hPadding - totalGap) / numColumns;

  const iconSize = scale(12, screenWidth);
  const editIconSize = scale(10, screenWidth);
  const labelSize = scale(10, screenWidth);
  const valueSize = scale(13, screenWidth);
  const cardMinH = scale(72, screenWidth);
  const iconPad = scale(4, screenWidth);
  const cardPadV = scale(10, screenWidth);
  const cardPadH = scale(8, screenWidth);

  return (
    <View style={{ marginBottom: 10 }}>

      {/* Header / Toggle */}
      <TouchableOpacity
        style={[
          hasWriteAccess('DASHBOARD_FEATURE_VERIFICATION')
            ? styles.dropDownContainer2
            : styles.dropDownContainer,
          { backgroundColor: theme.cardColor || '#fff' },
        ]}
        onPress={() => setShowIndicators(!showIndicators)}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.metrixStyle,
          { color: theme.text || '#000', fontSize: scale(14, screenWidth) },
        ]}>
          Key Performance Indicators ({kpiList.length} metrics)
        </Text>
        {showIndicators
          ? <ChevronUp size={scale(20, screenWidth)} color={theme.text} />
          : <ChevronDown size={scale(20, screenWidth)} color={theme.text} />
        }
      </TouchableOpacity>

      {/* KPI Grid */}
      {showIndicators && (
        <View style={{ paddingHorizontal: config.padding }}>
          {loadingKpi ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator color={theme.text} />
              <Text style={{ color: theme.text, marginLeft: 8 }}>Loading...</Text>
            </View>
          ) : (
            <View style={[styles.kpiGrid, { gap: colGap }]}>
              {kpiList.map((item, index) => (
                <View
                  key={index}
                  style={[
                    styles.card,
                    {
                      borderLeftColor: item.color,
                      backgroundColor: isDark ? '#252836' : '#fff',
                      borderColor: isDark ? '#3A3D4E' : '#eee',
                      width: cardWidth,
                      minHeight: cardMinH,
                      paddingVertical: cardPadV,
                      paddingHorizontal: cardPadH,
                    },
                  ]}
                >
                  {/* Icon + Label */}
                  <View style={styles.headerRow}>
                    <View style={[
                      styles.iconContainer,
                      { backgroundColor: item.bgColor, padding: iconPad },
                    ]}>
                      {item.isConnections && loadingConn
                        ? <ActivityIndicator size="small" color={item.color} />
                        : <item.icon size={iconSize} color={item.color} strokeWidth={2.5} />
                      }
                    </View>

                    <Text
                      style={[
                        styles.label,
                        { fontSize: labelSize, flex: 1, color: isDark ? '#94A3B8' : '#666' },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {item.label}
                    </Text>
                  </View>

                  {/* Value + optional Edit button */}
                  <View style={{ flexDirection: 'row' }}>
                    <Text
                      style={[
                        styles.value,
                        { fontSize: valueSize, color: isDark ? '#E2E8F0' : '#111' },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {item.value}
                    </Text>

                    {item.isConnections && hasWriteAccess('DASHBOARD_HOUSECONNECTION_EDIT') && (
                      <TouchableOpacity
                        style={[styles.editBtn, { backgroundColor: item.bgColor }]}
                        onPress={() => {
                          fetchConnectionCount();
                          setModalVisible(true);
                        }}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        activeOpacity={0.7}
                      >
                        <Pencil size={editIconSize} color={item.color} strokeWidth={2.5} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* House Connections Modal */}
      <ConnectionsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveConnections}
        saving={saving}
        cumulative={`${doneConn}`}
        todayCompleted={`${todayConn}`}
        initialTotalTentative={`${totalConn}`}
        isDark={isDark}
        theme={theme}
      />
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  dropDownContainer: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  dropDownContainer2: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  metrixStyle: {
    fontWeight: '700',
    flexShrink: 1,
    marginRight: 8,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    // backgroundColor, borderColor set inline via isDark
    borderRadius: 6,
    borderWidth: 1,
    borderLeftWidth: 4,
    flexDirection: 'column',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconContainer: {
    borderRadius: 4,
    marginRight: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    flexShrink: 1,
    // color set inline via isDark
  },
  value: {
    fontWeight: 'bold',
    // color set inline via isDark
  },
  editBtn: {
    borderRadius: 4,
    padding: 3,
    marginLeft: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    // backgroundColor set inline via isDark
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 420,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
    marginRight: 8,
    // color set inline via isDark
  },
  divider: {
    height: 1,
    marginBottom: 14,
    // backgroundColor set inline via isDark
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 36,
  },
  rowLabel: {
    flex: 1.1,
    fontSize: 13,
    fontWeight: '500',
    flexWrap: 'wrap',
    paddingRight: 4,
    // color set inline via isDark
  },
  colon: {
    fontSize: 13,
    marginHorizontal: 6,
    fontWeight: '500',
    // color set inline via isDark
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    // color, backgroundColor, borderColor set inline via isDark
  },
  readonlyBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    // backgroundColor, borderColor set inline via isDark
  },
  readonlyText: {
    fontSize: 13,
    fontWeight: '600',
    // color set inline via isDark
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  closeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
    // backgroundColor, borderColor set inline via isDark
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    // color set inline via isDark
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 6,
    backgroundColor: '#2E7D32',
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    backgroundColor: '#81C784',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});

export default KPISection;