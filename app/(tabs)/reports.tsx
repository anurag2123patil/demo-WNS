import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import {
  FileText,
  Download,
  Calendar as CalendarIcon,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getLayers,
  generateProjectExceleport,
  generateProjectPDFReportDaily,
  generateProjectPDFReportWeekly,
  generateProjectPDFReportAsOfToday,
  Layer,
} from '../../api/api_report';
import { useAuth } from '@/contexts/AuthContext';
import { useAlert } from '@/hooks/useAlert';
import { LinearGradient } from 'expo-linear-gradient';

// ---------------------------------------------------------------------------
// WEEK HELPERS
// ---------------------------------------------------------------------------

const getWeekMonday = (d: Date): Date => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getWeekSunday = (monday: Date): Date => {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
};

const isWeekEndInFuture = (sunday: Date): boolean => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sunday > today;
};


const CustomDatePicker = ({ visible, onClose, onSelect, selectedDate, theme }: any) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const [mode, setMode] = useState<'calendar' | 'monthYear'>('calendar');

  useEffect(() => {
    if (visible) { setViewDate(new Date(selectedDate)); setMode('calendar'); }
  }, [visible, selectedDate]);

  const changeMonth = (inc: number) => {
    const d = new Date(viewDate); d.setMonth(d.getMonth() + inc); setViewDate(d);
  };
  const changeYear = (inc: number) => {
    const d = new Date(viewDate); d.setFullYear(d.getFullYear() + inc); setViewDate(d);
  };
  const selectMonth = (idx: number) => {
    const d = new Date(viewDate); d.setMonth(idx); setViewDate(d); setMode('calendar');
  };
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();

  const renderCalendar = () => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells = [];
    for (let i = 0; i < getFirstDay(y, m); i++) cells.push(<View key={`e${i}`} style={dpStyles.cell} />);

    for (let d = 1; d <= getDaysInMonth(y, m); d++) {
      const thisDay = new Date(y, m, d);
      const isFuture = thisDay > today;
      const isSelected =
        d === selectedDate.getDate() &&
        m === selectedDate.getMonth() &&
        y === selectedDate.getFullYear();
      const isToday =
        d === today.getDate() && m === today.getMonth() && y === today.getFullYear();

      cells.push(
        <TouchableOpacity
          key={d}
          style={[
            dpStyles.cell,
            isSelected && !isFuture && { backgroundColor: theme.primaryColor, borderRadius: 8 },
            !isSelected && isToday && { borderWidth: 1.5, borderColor: theme.primaryColor, borderRadius: 8 },
            isFuture && { opacity: 0.3 },
          ]}
          onPress={() => {
            if (isFuture) return;
            onSelect(new Date(y, m, d));
            onClose();
          }}
          disabled={isFuture}
        >
          <Text style={[
            dpStyles.cellText,
            { color: isSelected && !isFuture ? '#fff' : theme.text },
            !isSelected && isToday && { color: theme.primaryColor, fontWeight: '700' },
          ]}>
            {d}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <>
        <View style={dpStyles.header}>
          <TouchableOpacity onPress={() => changeMonth(-1)}><ChevronLeft size={22} color={theme.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('monthYear')}>
            <Text style={[dpStyles.monthTitle, { color: theme.heading }]}>
              {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeMonth(1)}><ChevronRight size={22} color={theme.text} /></TouchableOpacity>
        </View>
        <View style={dpStyles.weekRow}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <Text key={day} style={[dpStyles.weekLabel, { color: theme.statsLabelColor }]}>{day}</Text>
          ))}
        </View>
        <View style={dpStyles.grid}>{cells}</View>
      </>
    );
  };

  const renderMonthYear = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return (
      <>
        <View style={dpStyles.header}>
          <TouchableOpacity onPress={() => changeYear(-1)}><ChevronLeft size={22} color={theme.text} /></TouchableOpacity>
          <Text style={[dpStyles.monthTitle, { color: theme.heading, fontSize: 22 }]}>{viewDate.getFullYear()}</Text>
          <TouchableOpacity onPress={() => changeYear(1)}><ChevronRight size={22} color={theme.text} /></TouchableOpacity>
        </View>
        <View style={dpStyles.monthGrid}>
          {months.map((m, idx) => (
            <TouchableOpacity
              key={m}
              style={[
                dpStyles.monthBtn,
                { borderColor: theme.inputBorder },
                viewDate.getMonth() === idx && { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor },
              ]}
              onPress={() => selectMonth(idx)}>
              <Text style={[
                dpStyles.monthBtnText,
                { color: viewDate.getMonth() === idx ? '#fff' : theme.text },
              ]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={{ marginTop: 14, alignItems: 'center' }} onPress={() => setMode('calendar')}>
          <Text style={{ color: theme.primaryColor, fontSize: 14 }}>Back to Calendar</Text>
        </TouchableOpacity>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[dpStyles.overlay, { backgroundColor: theme.modalOverlay }]}>
        <View style={[dpStyles.panel, { backgroundColor: theme.cardColor, shadowColor: theme.cardShadow }]}>
          {mode === 'calendar' ? renderCalendar() : renderMonthYear()}
          <TouchableOpacity
            style={[dpStyles.cancelBtn, { borderTopColor: theme.commentBorderTop }]}
            onPress={onClose}>
            <Text style={{ color: theme.subTextColor, fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  panel: { width: '88%', borderRadius: 20, padding: 18, elevation: 8, shadowOpacity: 0.25, shadowRadius: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingHorizontal: 6 },
  monthTitle: { fontSize: 17, fontWeight: '700' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  weekLabel: { width: 34, textAlign: 'center', fontWeight: '600', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  cellText: { fontSize: 15 },
  cancelBtn: { marginTop: 14, alignItems: 'center', padding: 10, borderTopWidth: 1 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 6 },
  monthBtn: { width: '30%', paddingVertical: 12, alignItems: 'center', borderRadius: 10, marginBottom: 10, borderWidth: 1 },
  monthBtnText: { fontSize: 15, fontWeight: '500' },
});

// ---------------------------------------------------------------------------
// MAIN SCREEN
// ---------------------------------------------------------------------------
type ReportType = 'daily' | 'weekly' | 'as_of_today';

const toApiDateString = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getPdfFilename = (url: string, fallback: string): string => {
  try {
    const pathname = url.split('?')[0];
    const extracted = pathname.substring(pathname.lastIndexOf('/') + 1);
    return extracted && extracted.endsWith('.pdf') ? extracted : fallback;
  } catch {
    return fallback;
  }
};

export default function ReportsScreen() {
  const { theme, isDark } = useTheme();
  const { showAlert, AlertComponent } = useAlert();
  const { hasWriteAccess } = useAuth();

  // ── PDF state ──
  const [reportDate, setReportDate] = useState(new Date());
  const [weeklyStartDate, setWeeklyStartDate] = useState<Date>(() => getWeekMonday(new Date()));
  const [weeklyEndDate, setWeeklyEndDate] = useState<Date>(() => getWeekSunday(getWeekMonday(new Date())));

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showWeeklyPicker, setShowWeeklyPicker] = useState(false);

  const [reportType, setReportType] = useState<ReportType>('daily');
  const [exportingPdf, setExportingPdf] = useState(false);

  // ── Excel state ──
  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayers, setSelectedLayers] = useState<number[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(true);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => { fetchLayersData(); }, []);

  const fetchLayersData = async () => {
    try {
      setLoadingLayers(true);
      setLayerError(null);
      const data = await getLayers();
      setLayers(data.layers);
    } catch (err) {
      setLayerError(err instanceof Error ? err.message : 'Failed to load layers');
    } finally {
      setLoadingLayers(false);
    }
  };

  const toggleLayer = (id: number) =>
    setSelectedLayers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // ── Weekly snap logic ──
  const handleWeeklyDateSelect = (d: Date) => {
    const monday = getWeekMonday(d);
    const sunday = getWeekSunday(monday);

    if (isWeekEndInFuture(sunday)) {
      const prevMonday = new Date(monday);
      prevMonday.setDate(monday.getDate() - 7);
      const prevSunday = getWeekSunday(prevMonday);
      setWeeklyStartDate(prevMonday);
      setWeeklyEndDate(prevSunday);
      showAlert(
        'Week Not Complete',
        'Report for current week is not yet generated, do you wish to generate for last week.',
        'warning',
      );
    } else {
      setWeeklyStartDate(monday);
      setWeeklyEndDate(sunday);
    }
  };

  // ── Write base64 to disk then share ──
  const saveAndShare = async (base64: string, filename: string, mimeType: string) => {
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri, { mimeType, dialogTitle: 'Export Report' });
    } else {
      showAlert('Saved', 'File saved to device.', 'success');
    }
  };


  const downloadAndShareFromUrl = async (pdfUrl: string, filename: string) => {
    const fileUri = `${FileSystem.documentDirectory}${filename}`;
    const downloadResult = await FileSystem.downloadAsync(pdfUrl, fileUri);
    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status ${downloadResult.status}`);
    }
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(downloadResult.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Export Report',
      });
    } else {
      showAlert('Saved', 'File saved to device.', 'success');
    }
  };

  // ── Blob → base64 → share (as_of_today returns a raw blob) ──
  const blobToBase64AndShare = async (blob: Blob, filename: string) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise<void>((resolve, reject) => {
      reader.onloadend = async () => {
        try {
          const base64data = (reader.result as string).split(',')[1];
          await saveAndShare(base64data, filename, 'application/pdf');
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to process PDF file'));
    });
  };

  const handleExportExcel = async () => {
    if (selectedLayers.length === 0) {
      showAlert('No layers selected', 'Please select at least one layer.', 'warning');
      return;
    }
    setExportingExcel(true);
    try {
      const base64 = await generateProjectExceleport(selectedLayers);
      await saveAndShare(
        base64,
        `export_${Date.now()}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    } catch (err) {
      showAlert('Export Failed', err instanceof Error ? err.message : 'Something went wrong', 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      if (reportType === 'daily') {
        const formattedDate = toApiDateString(reportDate);
        const data = await generateProjectPDFReportDaily(formattedDate);
        const pdfUrl = data.report_url || (data.reports && data.reports.length > 0 ? data.reports[0].report_path : null);
        if (!pdfUrl) {
          throw new Error(data.message || 'No report URL received from server');
        }
        const filename = getPdfFilename(pdfUrl, `daily_report_${formattedDate}.pdf`);
        await downloadAndShareFromUrl(pdfUrl, filename);

      } else if (reportType === 'weekly') {
        // ── If the current week is not yet complete, ask the user ──────────
        if (isWeekEndInFuture(weeklyEndDate)) {
          setExportingPdf(false); // stop spinner while waiting for user input

          const lastMonday = new Date(weeklyStartDate);
          lastMonday.setDate(weeklyStartDate.getDate() - 7);
          const lastSunday = getWeekSunday(lastMonday);

          showAlert(
            'Weekly Report',
            'Report for current week is not yet generated, do you wish to generate for last week?',
            'warning',
            [
              {
                text: 'No',
                style: 'cancel',
                onPress: () => {},
              },
              {
                text: 'Yes',
                style: 'default',
                onPress: async () => {
                  setExportingPdf(true);
                  try {
                    const start = toApiDateString(lastMonday);
                    const end = toApiDateString(lastSunday);
                    const data = await generateProjectPDFReportWeekly(start, end);
                    const pdfUrl = data.report_url || (data.reports && data.reports.length > 0 ? data.reports[0].report_path : null);
                    if (!pdfUrl) {
                      throw new Error(data.message || 'No report URL received from server');
                    }
                    const filename = getPdfFilename(pdfUrl, `weekly_report_${end}.pdf`);
                    await downloadAndShareFromUrl(pdfUrl, filename);
                  } catch (err) {
                    showAlert('Export Failed', err instanceof Error ? err.message : 'Something went wrong', 'error');
                  } finally {
                    setExportingPdf(false);
                  }
                },
              },
            ],
          );
          return;
        }

        // ── Week is complete — export as-is ────────────────────────────────
        const start = toApiDateString(weeklyStartDate);
        const end = toApiDateString(weeklyEndDate);
        const data = await generateProjectPDFReportWeekly(start, end);
        const pdfUrl = data.report_url || (data.reports && data.reports.length > 0 ? data.reports[0].report_path : null);
        if (!pdfUrl) {
          throw new Error(data.message || 'No report URL received from server');
        }
        const filename = getPdfFilename(pdfUrl, `weekly_report_${end}.pdf`);
        await downloadAndShareFromUrl(pdfUrl, filename);

      } else {
        // as_of_today
        const { blob, filename } = await generateProjectPDFReportAsOfToday(toApiDateString(reportDate));
        await blobToBase64AndShare(blob, filename);
      }

    } catch (err) {
      showAlert('Export Failed', err instanceof Error ? err.message : 'Something went wrong', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Accent colors ──
  const accentBlue = theme.primaryColor;
  const accentGreen = theme.accent;
  const iconBlueBg = isDark ? 'rgba(10,132,255,0.15)' : 'rgba(0,122,255,0.08)';
  const iconGreenBg = isDark ? 'rgba(34,166,153,0.15)' : 'rgba(34,166,153,0.08)';
  const selectedLayerBg = isDark ? 'rgba(10,132,255,0.12)' : 'rgba(0,122,255,0.06)';

  return (
    <ScrollView
      style={[s.container, { backgroundColor: theme.background }]}
      contentContainerStyle={s.content}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={s.pageHeader}>
        <Text style={[s.pageTitle, { color: theme.heading }]}>Reports</Text>
        <Text style={[s.pageSubtitle, { color: theme.subTextColor }]}>
          Generate and export project reports
        </Text>
      </View>

      {/* ── PDF EXPORT CARD ── */}
      {hasWriteAccess('REPORTS_PDF_EXPORT') && (
        <View style={[s.card, { backgroundColor: theme.cardColor, borderColor: theme.borderColor, shadowColor: theme.cardShadow }]}>
          <View style={s.cardHeader}>
            <View style={[s.iconWrap, { backgroundColor: iconBlueBg }]}>
              <FileText size={22} color={accentBlue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: theme.heading }]}>PDF Export</Text>
              <Text style={[s.cardSubtitle, { color: theme.subTextColor }]}>
                Generate PDF reports for your projects
              </Text>
            </View>
          </View>

          <View style={[s.divider, { backgroundColor: theme.commentBorderTop }]} />

          <Text style={[s.label, { color: theme.text }]}>Report Type</Text>
          <View style={[s.toggleRow, { backgroundColor: theme.inputBg }]}>
            {([
              { key: 'daily', label: 'Daily' },
              { key: 'weekly', label: 'Weekly' },
              { key: 'as_of_today', label: 'As Of Today' },
            ] as { key: ReportType; label: string }[]).map(item => (
              <TouchableOpacity
                key={item.key}
                style={s.toggleBtn}
                onPress={() => setReportType(item.key)}
              >
                {reportType === item.key ? (
                  <LinearGradient
                    colors={["#60A5FA", "#2563EB"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={s.toggleBtnGradient}
                  >
                    <Text style={[s.toggleText, { color: '#fff' }]}>{item.label}</Text>
                  </LinearGradient>
                ) : (
                  <View style={s.toggleBtnGradient}>
                    <Text style={[s.toggleText, { color: theme.text }]}>{item.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Daily / As-Of-Today date picker */}
          {(reportType === 'daily' || reportType === 'as_of_today') && (
            <>
              <Text style={[s.label, { color: theme.text }]}>Report Date</Text>
              <TouchableOpacity
                style={[s.selector, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                onPress={() => setShowDatePicker(true)}>
                <CalendarIcon size={18} color={accentBlue} />
                <Text style={[s.selectorText, { color: theme.text, marginLeft: 8 }]}>
                  {formatDate(reportDate)}
                </Text>
              </TouchableOpacity>
              <CustomDatePicker
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                onSelect={(d: Date) => setReportDate(d)}
                selectedDate={reportDate}
                theme={theme}
              />
            </>
          )}

          {/* Weekly range picker */}
          {reportType === 'weekly' && (
            <>
              <Text style={[s.label, { color: theme.text }]}>Week (Mon – Sun)</Text>
              <TouchableOpacity
                style={[s.selector, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                onPress={() => setShowWeeklyPicker(true)}>
                <CalendarIcon size={18} color={accentBlue} />
                <Text style={[s.selectorText, { color: theme.text, marginLeft: 8 }]}>
                  {formatDate(weeklyStartDate)}  →  {formatDate(weeklyEndDate)}
                </Text>
              </TouchableOpacity>
              <CustomDatePicker
                visible={showWeeklyPicker}
                onClose={() => setShowWeeklyPicker(false)}
                onSelect={handleWeeklyDateSelect}
                selectedDate={weeklyStartDate}
                theme={theme}
              />
            </>
          )}

          <TouchableOpacity
            style={[s.exportBtn, { shadowColor: theme.cardShadow, opacity: exportingPdf ? 0.7 : 1 }]}
            onPress={handleExportPdf}
            disabled={exportingPdf}
          >
            <LinearGradient
              colors={["#60A5FA", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.exportBtnGradient}
            >
              {exportingPdf
                ? <ActivityIndicator color="#fff" size="small" />
                : <Download size={18} color="#fff" />}
              <Text style={s.exportBtnText}>
                {exportingPdf ? 'Exporting…' : 'Export PDF Report'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ── EXCEL EXPORT CARD ── */}
      {hasWriteAccess('REPORTS_EXCEL_EXPORT') && (
        <View style={[s.card, { backgroundColor: theme.cardColor, borderColor: theme.borderColor, shadowColor: theme.cardShadow, marginTop: 16 }]}>
          <View style={s.cardHeader}>
            <View style={[s.iconWrap, { backgroundColor: iconGreenBg }]}>
              <Layers size={22} color={accentGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, { color: theme.heading }]}>Excel Export</Text>
              <Text style={[s.cardSubtitle, { color: theme.subTextColor }]}>
                Export project layers to Excel
              </Text>
            </View>
          </View>

          <View style={[s.divider, { backgroundColor: theme.commentBorderTop }]} />

          <Text style={[s.label, { color: theme.text }]}>
            Select Layers{selectedLayers.length > 0 ? ` (${selectedLayers.length} selected)` : ''}
          </Text>

          {loadingLayers ? (
            <View style={s.centerBox}>
              <ActivityIndicator color={accentBlue} />
              <Text style={[s.centerText, { color: theme.subTextColor }]}>Loading layers…</Text>
            </View>
          ) : layerError ? (
            <View style={[s.errorBox, { backgroundColor: theme.surface2, borderColor: theme.dangerColor }]}>
              <Text style={[s.errorText, { color: theme.dangerColor }]}>{layerError}</Text>
              <TouchableOpacity onPress={fetchLayersData} style={{ marginTop: 8 }}>
                <Text style={[s.retryText, { color: accentBlue }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.layerGrid}>
              {layers
                .filter(layer => [1, 2, 3, 4, 6].includes(layer.layer_id))
                .map(layer => {
                  const isSelected = selectedLayers.includes(layer.layer_id);
                  return (
                    <TouchableOpacity
                      key={layer.layer_id}
                      style={[
                        s.layerCard,
                        {
                          backgroundColor: isSelected ? selectedLayerBg : theme.inputBg,
                          borderColor: isSelected ? accentBlue : theme.inputBorder,
                        },
                      ]}
                      onPress={() => toggleLayer(layer.layer_id)}>
                      <View style={s.layerCardLeft}>
                        <View style={[s.layerDot, { backgroundColor: accentBlue }]} />
                        <Text style={[s.layerName, { color: theme.text }]} numberOfLines={1}>
                          {layer.layer_name}
                        </Text>
                      </View>
                      {isSelected && <CheckSquare size={18} color={accentBlue} />}
                    </TouchableOpacity>
                  );
                })}
            </View>
          )}

          <TouchableOpacity
            style={[
              s.exportBtn,
              {
                shadowColor: theme.cardShadow,
                marginTop: 20,
                opacity: (selectedLayers.length === 0 || exportingExcel) ? 0.5 : 1,
              },
            ]}
            onPress={handleExportExcel}
            disabled={selectedLayers.length === 0 || exportingExcel}
          >
            <LinearGradient
              colors={["#34D399", "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.exportBtnGradient}
            >
              {exportingExcel
                ? <ActivityIndicator color="#fff" size="small" />
                : <Download size={18} color="#fff" />}
              <Text style={s.exportBtnText}>
                {exportingExcel ? 'Exporting…' : 'Export Excel Report'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <AlertComponent />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, marginTop: 4 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  cardSubtitle: { fontSize: 13, marginTop: 2 },
  divider: { height: 1, marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.2 },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  selectorText: { fontSize: 15, flex: 1 },
  toggleRow: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 20 },
  toggleBtn: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  toggleBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
  toggleText: { fontSize: 13, fontWeight: '600' },
  exportBtn: {
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 4,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  exportBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  exportBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  layerGrid: { flexDirection: 'column', gap: 8 },
  layerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  layerCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  layerDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  layerName: { fontSize: 13, fontWeight: '600', flex: 1 },
  centerBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  centerText: { fontSize: 14, marginTop: 4 },
  errorBox: { borderRadius: 12, borderWidth: 1, padding: 16, alignItems: 'center' },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryText: { fontSize: 14, fontWeight: '600' },
});