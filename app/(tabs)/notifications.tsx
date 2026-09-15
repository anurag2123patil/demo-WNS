// Notifications.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import {
  AlertTriangle,
  Package,
  ShieldCheck,
  Wrench,
  Users,
  TrendingDown,
  RefreshCw,
  X,
} from 'lucide-react-native';
import {
  fetchProjectAlerts,
  AlertsData,
  ProjectCompleted,
  InventoryAlert,
  VerificationAlertItem,
} from '../../api/api';
import { useTheme } from '../../contexts/ThemeContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateRange(dates: { dt: string }[]): string {
  if (!dates?.length) return '';
  if (dates.length === 1) return dates[0].dt;
  return `${dates[0].dt} to ${dates[dates.length - 1].dt}`;
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  count,
  color,
  badgeBg,
  badgeText,
}: {
  icon: React.ElementType;
  label: string;
  count?: number;
  color: string;
  badgeBg: string;
  badgeText: string;
}) {
  return (
    <View style={shStyles.row}>
      <Icon size={15} color={color} />
      <Text style={[shStyles.label, { color }]}>{label}</Text>
      {count !== undefined && count > 0 && (
        <View style={[shStyles.badge, { backgroundColor: badgeBg }]}>
          <Text style={[shStyles.badgeText, { color: badgeText }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

const shStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

// ── AlertRow ─────────────────────────────────────────────────────────────────

function AlertRow({
  children,
  bg,
  border,
  textColor,
}: {
  children: React.ReactNode;
  bg: string;
  border: string;
  textColor: string;
}) {
  return (
    <View style={[arStyles.container, { backgroundColor: bg, borderColor: border }]}>
      <AlertTriangle size={15} color="#F59E0B" style={{ marginTop: 2, flexShrink: 0 }} />
      <Text style={[arStyles.text, { color: textColor }]}>{children}</Text>
    </View>
  );
}

const arStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  text: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
  },
});

// ── Alert row components ──────────────────────────────────────────────────────

function ProjectAlertRow({
  item,
  alertProps,
  boldColor,
}: {
  item: ProjectCompleted;
  alertProps: AlertRowProps;
  boldColor: string;
}) {
  const behindPct = (
    parseFloat(String(item.perce_crr_dt)) - parseFloat(String(item.progress))
  ).toFixed(2);
  return (
    <AlertRow {...alertProps}>
      {'We are currently running '}
      <Text style={[{ fontWeight: '700', color: boldColor }]}>{behindPct} %</Text>
      {' behind schedule.'}
    </AlertRow>
  );
}

function InventoryAlertRow({
  item,
  alertProps,
  boldColor,
}: {
  item: InventoryAlert;
  alertProps: AlertRowProps;
  boldColor: string;
}) {
  return (
    <AlertRow {...alertProps}>
      {'The '}
      <Text style={{ fontWeight: '700', color: boldColor }}>{item.material_name}</Text>
      {' stock has fallen below the threshold limit. (Remaining Stock: '}
      <Text style={{ fontWeight: '700', color: boldColor }}>
        {parseFloat(String(item.remaining_percentage)).toFixed(2)} %
      </Text>
      {')'}
    </AlertRow>
  );
}

function VerificationAlertRow({
  item,
  alertProps,
  boldColor,
  linkColor,
}: {
  item: VerificationAlertItem;
  alertProps: AlertRowProps;
  boldColor: string;
  linkColor: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const labels = item.label_name.split(', ');
  const displayLabels = expanded ? labels : labels.slice(0, 15);

  return (
    <AlertRow {...alertProps}>
      {'A total of '}
      <Text style={{ fontWeight: '700', color: boldColor }}>{item.cnt}</Text>
      {' verifications are pending for '}
      <Text style={{ fontWeight: '700', color: boldColor }}>{item.wilm_name}</Text>
      {' layer labeled '}
      {displayLabels.join(', ')}
      {!expanded && labels.length > 15 && (
        <Text
          style={{ color: linkColor, fontWeight: '600' }}
          onPress={() => setExpanded(true)}
        >
          {'  +' + (labels.length - 15) + ' more'}
        </Text>
      )}
    </AlertRow>
  );
}

type AlertRowProps = { bg: string; border: string; textColor: string };

// ── All Clear ─────────────────────────────────────────────────────────────────

function AllClear({
  iconBoxBg,
  titleColor,
  subColor,
}: {
  iconBoxBg: string;
  titleColor: string;
  subColor: string;
}) {
  return (
    <View style={styles.allClearBox}>
      <View style={[styles.allClearIconBox, { backgroundColor: iconBoxBg }]}>
        <ShieldCheck size={28} color="#16A34A" />
      </View>
      <Text style={[styles.allClearTitle, { color: titleColor }]}>All systems normal</Text>
      <Text style={[styles.allClearSub, { color: subColor }]}>
        No active alerts for this project
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function Notifications() {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('All');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const { theme, isDark } = useTheme();

  // ── Theme aliases ──────────────────────────────────────────────────
  const pageBg = theme.background;
  const cardBg = theme.cardColor;
  const surface2 = theme.surface2;
  const textColor = theme.text;
  const headingColor = theme.heading;
  const mutedText = theme.textMuted;
  const borderColor = theme.borderColor;
  const primaryColor = theme.primaryColor;
  const dangerColor = theme.iconDanger;
  const overlayBg = theme.overlayBackground;
  const navigation = useNavigation();

  // Alert row theme
  const alertRowBg = isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB';
  const alertRowBorder = isDark ? 'rgba(245,158,11,0.25)' : '#FDE68A';
  const alertTextColor = isDark ? theme.subtext : '#374151';
  const boldColor = isDark ? theme.text : '#111827';
  const linkColor = isDark ? theme.iconPrimary : '#2563EB';

  const alertRowProps: AlertRowProps = {
    bg: alertRowBg,
    border: alertRowBorder,
    textColor: alertTextColor,
  };

  // Badge theme
  const sectionBadgeBg = isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7';
  const sectionBadgeText = isDark ? '#FCD34D' : '#92400E';

  // Header bg — amber tint in light, surface in dark
  const headerBg = isDark ? theme.surface : '#FFFBEB';
  const headerBorder = borderColor;

  // All-clear icon box
  const allClearIconBg = isDark ? 'rgba(22,163,74,0.12)' : '#F0FDF4';

  // ── Derived ────────────────────────────────────────────────────────

  const va = data?.verificationAlert;

  const verifications: VerificationAlertItem[] = [
    ...(va?.pipeline_alert ?? []),
    ...(va?.tank_alert ?? []),
    ...(va?.stp_alert ?? []),
    ...(va?.junction_alert ?? []),
    ...(va?.manhole_alert ?? []),
  ].filter((v) => parseInt(v.cnt) > 0);

  const machineryDates = va?.machinery_alert ?? [];
  const labourDates = va?.labour_alert ?? [];

  const projectAlerts = (data?.project_completed ?? []).filter(
    (p) => parseFloat(String(p.perce_crr_dt)) > parseFloat(String(p.progress)),
  );

  const inventoryAlerts = data?.data ?? [];

  const totalAlerts =
    (projectAlerts.length > 0 ? 1 : 0) +
    inventoryAlerts.length +
    verifications.length +
    (machineryDates.length > 0 ? 1 : 0) +
    (labourDates.length > 0 ? 1 : 0);

  const verificationSectionCount = verifications.length;

  // ── Fetch ──────────────────────────────────────────────────────────

  const loadData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const res = await fetchProjectAlerts();
      if (res.status) {
        setData(res.data);
        setLastRefreshed(new Date());
      } else {
        setError('Failed to fetch alerts.');
      }
    } catch (e: any) {
      setError(e.message || 'Network error.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const showProject = activeTab === 'All' || activeTab === 'Project';
  const showInventory = activeTab === 'All' || activeTab === 'Inventory';
  const showVerification = activeTab === 'All' || activeTab === 'Verification';

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={headerBg} />

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: headerBg, borderBottomColor: headerBorder },
        ]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.headerIconBox,
              { backgroundColor: '#F59E0B', shadowColor: '#F59E0B' },
            ]}
          >
            <AlertTriangle size={16} color="#fff" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: headingColor }]}>Alerts</Text>
            {!loading && (
              <Text style={[styles.headerSub, { color: mutedText }]}>
                {totalAlerts === 0
                  ? 'No active alerts'
                  : `${totalAlerts} active alert${totalAlerts !== 1 ? 's' : ''}`}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: surface2 }]}
          onPress={() => navigation.goBack()}
        >
          <X size={18} color={mutedText} />
        </TouchableOpacity>

      </View>

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.centered}>
          <RefreshCw size={24} color="#F59E0B" />
          <Text style={[styles.loadingText, { color: mutedText }]}>Loading alerts…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <AlertTriangle size={40} color={dangerColor} />
          <Text style={[styles.errorText, { color: dangerColor }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: primaryColor }]}
            onPress={() => loadData()}
          >
            <RefreshCw size={13} color="#fff" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              colors={['#F59E0B']}
              tintColor="#F59E0B"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* All clear */}
          {totalAlerts === 0 && (
            <AllClear
              iconBoxBg={allClearIconBg}
              titleColor={headingColor}
              subColor={mutedText}
            />
          )}

          {/* ── Project Alerts ── */}
          {showProject && projectAlerts.length > 0 && (
            <View>
              <SectionHeader
                icon={TrendingDown}
                label="Project Alerts"
                count={projectAlerts.length}
                color="#DC2626"
                badgeBg={sectionBadgeBg}
                badgeText={sectionBadgeText}
              />
              {projectAlerts.map((p) => (
                <ProjectAlertRow
                  key={p.wipr_id}
                  item={p}
                  alertProps={alertRowProps}
                  boldColor={boldColor}
                />
              ))}
            </View>
          )}

          {/* ── Inventory Alerts ── */}
          {showInventory && inventoryAlerts.length > 0 && (
            <View>
              <SectionHeader
                icon={Package}
                label="Inventory Alerts"
                count={inventoryAlerts.length}
                color="#D97706"
                badgeBg={sectionBadgeBg}
                badgeText={sectionBadgeText}
              />
              {inventoryAlerts.map((inv) => (
                <InventoryAlertRow
                  key={inv.wimpr_id}
                  item={inv}
                  alertProps={alertRowProps}
                  boldColor={boldColor}
                />
              ))}
            </View>
          )}

          {/* ── Verification Alerts ── */}
          {showVerification && verificationSectionCount > 0 && (
            <View>
              <SectionHeader
                icon={ShieldCheck}
                label="Verification Alerts"
                count={verificationSectionCount}
                color="#2563EB"
                badgeBg={sectionBadgeBg}
                badgeText={sectionBadgeText}
              />
              {verifications.map((v, i) => (
                <VerificationAlertRow
                  key={i}
                  item={v}
                  alertProps={alertRowProps}
                  boldColor={boldColor}
                  linkColor={linkColor}
                />
              ))}

              {/* Machinery sub-section */}
              {machineryDates.length > 0 && (
                <View>
                  <SectionHeader
                    icon={Wrench}
                    label="Machinery Alerts"
                    count={1}
                    color="#7C3AED"
                    badgeBg={sectionBadgeBg}
                    badgeText={sectionBadgeText}
                  />
                  <AlertRow {...alertRowProps}>
                    {'No machinery has been added for the dates from '}
                    <Text style={{ fontWeight: '700', color: boldColor }}>
                      {dateRange(machineryDates)}
                    </Text>
                    {'.'}
                  </AlertRow>
                </View>
              )}

              {/* Labour sub-section */}
              {labourDates.length > 0 && (
                <View>
                  <SectionHeader
                    icon={Users}
                    label="Labour Alerts"
                    count={1}
                    color="#059669"
                    badgeBg={sectionBadgeBg}
                    badgeText={sectionBadgeText}
                  />
                  <AlertRow {...alertRowProps}>
                    {'No labour has been added for the dates from '}
                    <Text style={{ fontWeight: '700', color: boldColor }}>
                      {dateRange(labourDates)}
                    </Text>
                    {'.'}
                  </AlertRow>
                </View>
              )}
            </View>
          )}

          {/* ── Footer ── */}
          {totalAlerts > 0 && lastRefreshed && (
            <View style={[styles.footer, { borderTopColor: borderColor }]}>
              <Text style={[styles.footerMeta, { color: mutedText }]}>
                Last refreshed: {lastRefreshed.toLocaleTimeString()}
              </Text>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tabs (kept for future use)
  tabsScroll: { flexGrow: 0 },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tabActive: {},
  tabText: { fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  // Scroll body
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },

  // All clear
  allClearBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  allClearIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  allClearTitle: { fontSize: 14, fontWeight: '700' },
  allClearSub: { fontSize: 12 },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerMeta: { fontSize: 11 },
  footerRefreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  footerRefreshText: { fontSize: 12, fontWeight: '700' },

  // Loading / error states
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  loadingText: { fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});