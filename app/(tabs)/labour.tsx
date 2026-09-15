import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  PixelRatio,
  Dimensions,
  BackHandler,
  Keyboard
} from 'react-native';
import {
  Calendar, Plus, Users, Wrench, Edit2, Eye, Filter, Trash2,
  ChevronLeft, ChevronRight,
} from 'lucide-react-native';
import { useAlert } from '@/hooks/useAlert';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateLabourMachinery, fetchProjectLabourMachinerySummary, fetchMachineryDropdown,
  fetchProjectLabours, saveLabourMachinery, deleteLabourMachineryByDate
} from '@/api/api_labour';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Responsive helpers ───────────────────────────────────────────────────────
// Always read dimensions fresh so rotation / foldables work correctly.

const getWindow = () => Dimensions.get('window');

// Percentage-based width and height helpers
const wp = (percent: number) => (getWindow().width * percent) / 100;
const hp = (percent: number) => (getWindow().height * percent) / 100;

// Normalize a dp value against 375 base width.
// factor 0.5 = half-way between no scaling and full linear scaling (sweet spot).
const normalize = (size: number, factor = 0.5) => {
  const { width } = getWindow();
  const scale = width / 375;
  const newSize = size + (size * scale - size) * factor;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Icon size helper — slightly less aggressive scaling than text
const iconSize = (base: number) => normalize(base, 0.4);

// ─── Custom Date Picker ───────────────────────────────────────────────────────

const CustomDatePicker = ({ visible, onClose, onSelect, selectedDate, theme }: any) => {
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  const [mode, setMode] = useState<'calendar' | 'monthYear'>('calendar');

  useEffect(() => {
    if (visible) { setViewDate(new Date(selectedDate)); setMode('calendar'); }
  }, [visible, selectedDate]);

  if (!visible) return null;

  const changeMonth = (inc: number) => {
    const d = new Date(viewDate); d.setMonth(d.getMonth() + inc); setViewDate(d);
  };
  const changeYear = (inc: number) => {
    const d = new Date(viewDate); d.setFullYear(d.getFullYear() + inc); setViewDate(d);
  };
  const selectMonth = (i: number) => {
    const d = new Date(viewDate); d.setMonth(i); setViewDate(d); setMode('calendar');
  };

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();

  const isNextMonthDisabled =
    new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1) >
    new Date(today.getFullYear(), today.getMonth(), 1);

  const renderCalendar = () => {
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDay(year, month);
    const cells: JSX.Element[] = [];

    for (let i = 0; i < firstDay; i++)
      cells.push(<View key={`e-${i}`} style={dpStyles.dayCell} />);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isFuture = date > today;
      const isSelected = !isFuture &&
        date.getDate() === selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear();
      const isToday =
        day === new Date().getDate() &&
        month === new Date().getMonth() &&
        year === new Date().getFullYear();
      const _y = year, _m = month, _d = day;

      cells.push(
        <TouchableOpacity
          key={day}
          activeOpacity={isFuture ? 1 : 0.7}
          style={[
            dpStyles.dayCell,
            isSelected && { backgroundColor: theme.info, borderRadius: normalize(8) },
            !isSelected && isToday && { borderColor: theme.info, borderWidth: 1, borderRadius: normalize(8) },
            isFuture && { opacity: 0.3 },
          ]}
          onPress={() => {
            if (isFuture) return;
            onSelect(new Date(_y, _m, _d, 12, 0, 0, 0));
            onClose();
          }}
        >
          <Text style={[
            dpStyles.dayText,
            { color: isSelected ? '#fff' : theme.text },
            !isSelected && isToday && { color: theme.info, fontWeight: 'bold' },
            isFuture && { color: theme.disabledText },
          ]}>{day}</Text>
        </TouchableOpacity>
      );
    }

    return (
      <>
        <View style={dpStyles.header}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={dpStyles.arrow}>
            <ChevronLeft size={iconSize(22)} color={theme.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('monthYear')}>
            <Text style={[dpStyles.monthTitle, { color: theme.heading }]}>
              {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { if (!isNextMonthDisabled) changeMonth(1); }}
            style={[dpStyles.arrow, isNextMonthDisabled && { opacity: 0.3 }]}
          >
            <ChevronRight size={iconSize(22)} color={theme.text} />
          </TouchableOpacity>
        </View>
        <View style={dpStyles.weekRow}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <Text key={d} style={[dpStyles.weekText, { color: theme.iconMuted }]}>{d}</Text>
          ))}
        </View>
        <View style={dpStyles.daysGrid}>{cells}</View>
      </>
    );
  };

  const renderMonthYear = () => (
    <>
      <View style={dpStyles.header}>
        <TouchableOpacity onPress={() => changeYear(-1)} style={dpStyles.arrow}>
          <ChevronLeft size={iconSize(22)} color={theme.text} />
        </TouchableOpacity>
        <Text style={[dpStyles.monthTitle, { color: theme.heading, fontSize: normalize(20) }]}>
          {viewDate.getFullYear()}
        </Text>
        <TouchableOpacity onPress={() => changeYear(1)} style={dpStyles.arrow}>
          <ChevronRight size={iconSize(22)} color={theme.text} />
        </TouchableOpacity>
      </View>
      <View style={dpStyles.monthGrid}>
        {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
          <TouchableOpacity
            key={m}
            style={[
              dpStyles.monthBtn,
              { borderColor: theme.borderColor },
              viewDate.getMonth() === i && { backgroundColor: theme.info },
            ]}
            onPress={() => selectMonth(i)}
          >
            <Text style={[dpStyles.monthBtnText, { color: viewDate.getMonth() === i ? '#fff' : theme.text }]}>
              {m}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={{ marginTop: normalize(14), alignItems: 'center' }} onPress={() => setMode('calendar')}>
        <Text style={{ color: theme.info, fontSize: normalize(14) }}>Back to Calendar</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={dpStyles.overlay} pointerEvents="box-none">
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
      <View style={[dpStyles.panel, { backgroundColor: theme.cardColor }]}>
        {mode === 'calendar' ? renderCalendar() : renderMonthYear()}
        <TouchableOpacity
          style={[dpStyles.cancelBtn, { borderTopColor: theme.borderColor }]}
          onPress={onClose}
        >
          <Text style={{ color: theme.iconMuted, fontSize: normalize(15) }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const dpStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  panel: {
    width: wp(88),
    borderRadius: normalize(18),
    padding: normalize(18),
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 10000,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: normalize(14),
  },
  monthTitle: { fontSize: normalize(16), fontWeight: '700' },
  arrow: { padding: normalize(6) },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: normalize(8) },
  weekText: { width: wp(10), textAlign: 'center', fontSize: normalize(11) },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  dayText: { fontSize: normalize(13) },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  monthBtn: {
    width: '30%', paddingVertical: normalize(10), alignItems: 'center',
    borderRadius: normalize(8), marginBottom: normalize(8), borderWidth: 1,
  },
  monthBtnText: { fontSize: normalize(13), fontWeight: '500' },
  cancelBtn: { marginTop: normalize(10), alignItems: 'center', padding: normalize(10), borderTopWidth: 1 },
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyRecord {
  date: string;
  labourCount: number;
  machineryCount: number;
  rawLabourDetails: any[];
  rawMachineryDetails: any[];
}

interface MachineryRow {
  wmpr_id: number | null;
  machinery_id: number | null;
  name: string;
  qty: string;
  hrs: string;
  remark: string;
  custom_name: string;
  original_wmpr_id: number | null;
}

const FILTER_MAPPING: Record<string, string> = {
  'Last 7 Days': 'weak',
  'Last 15 Days': 'last_15_days',
  'Current Month': 'curr_month',
  'Previous Month': 'pre_month',
  'Last 3 Months': 'three_last_month',
  'Last 6 Months': 'six_last_month',
};
const FILTER_OPTIONS = Object.keys(FILTER_MAPPING);

const EMPTY_MACH_ROW: MachineryRow = {
  wmpr_id: null, machinery_id: null, name: '', qty: '', hrs: '',
  remark: '', custom_name: '', original_wmpr_id: null,
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LabourMachineryScreen() {
  const { theme, isDark } = useTheme();
  const { selectedProject, hasWriteAccess } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const insets = useSafeAreaInsets();

  // Re-render when orientation changes
  const [, setDims] = useState(getWindow());
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => setDims(window));
    return () => sub.remove();
  }, []);

  const [labourMaster, setLabourMaster] = useState<{ wplm_id: number; labour_name: string }[]>([]);
  const [machineryMaster, setMachineryMaster] = useState<{ machinery_id: number; machinery_name: string }[]>([]);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('Last 7 Days');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  const [addEditVisible, setAddEditVisible] = useState(false);
  const [viewDetailVisible, setViewDetailVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState<any>({ date: new Date(), labour: {} });
  const [machineryRows, setMachineryRows] = useState<MachineryRow[]>([{ ...EMPTY_MACH_ROW }]);
  const [formDatePicker, setFormDatePicker] = useState(false);
  const [machineryPickerVisible, setMachineryPickerVisible] = useState(false);
  const [activeMachineIndex, setActiveMachineIndex] = useState<number | null>(null);
  const [selectedRecordDetail, setSelectedRecordDetail] = useState<DailyRecord | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const inputBg = theme.inputBackground;
  const borderColor = theme.borderColor;
  const subTextColor = theme.textMuted;
  const placeholderColor = theme.inputPlaceholder;

  // ─── Android back handler ─────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (machineryPickerVisible) { setMachineryPickerVisible(false); return true; }
      if (addEditVisible) { setAddEditVisible(false); return true; }
      return false;
    });
    return () => sub.remove();
  }, [addEditVisible, machineryPickerVisible]);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setIsKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setIsKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // ─── API ──────────────────────────────────────────────────────────────────

  const loadSummaryData = async () => {
    if (!selectedProject?.id) return;
    setLoading(true);
    try {
      const data = await fetchProjectLabourMachinerySummary(selectedProject.id, FILTER_MAPPING[selectedFilter]);
      if (data?.machineryData) {
        const mapped: DailyRecord[] = data.machineryData.map((item: any) => ({
          date: item.Date,
          labourCount: (item.labour_details ?? []).reduce((a: number, c: any) => a + (Number(c.Qty) || 0), 0),
          machineryCount: (item.machinery_details ?? [])
            .filter((m: any) => Number(m.qty) > 0)
            .reduce((a: number, c: any) => a + (Number(c.qty) || 0), 0),
          rawLabourDetails: item.labour_details ?? [],
          rawMachineryDetails: (item.machinery_details ?? []).filter((m: any) => Number(m.qty) > 0),
        }));
        setDailyRecords(mapped.reverse());
      }
    } catch (err) {
      console.error('❌ Summary load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummaryData(); }, [selectedProject, selectedFilter]);

  useEffect(() => {
    const init = async () => {
      if (!selectedProject?.id) return;
      try {
        const [labours, machinery] = await Promise.all([
          fetchProjectLabours(selectedProject.id),
          fetchMachineryDropdown(),
        ]);
        setLabourMaster(labours);
        setMachineryMaster(machinery);
      } catch (err) { console.error('❌ Dropdown load error:', err); }
    };
    init();
  }, [selectedProject]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`;

  const handleSaveRecord = async () => {
    try {
      if (!selectedProject?.id) {
        showAlert('Project Required', 'Please select a valid project before saving.', 'info');
        return;
      }
      const dateStr = toDateStr(formData.date);

      const missingQtyOrHrs = machineryRows.find(
        m => m.machinery_id !== null && m.machinery_id !== 10 &&
          (!m.qty || m.qty.trim() === '' || Number(m.qty) <= 0 ||
            !m.hrs || m.hrs.trim() === '' || Number(m.hrs) <= 0)
      );
      const missingCustomName = machineryRows.find(
        m => m.machinery_id === 9 && Number(m.qty) > 0 && !m.custom_name?.trim()
      );

      if (missingQtyOrHrs) {
        showAlert('Missing Details', `Please enter both Quantity and Hours for "${missingQtyOrHrs.name || 'selected machinery'}".`, 'info');
        return;
      }
      if (missingCustomName) {
        showAlert('Custom Name Required', "Please enter a name for the 'Other' machinery.", 'info');
        return;
      }

      const resolveOtherName = (m: MachineryRow) =>
        m.machinery_id === 9 && m.custom_name?.trim() ? { machinery_name: m.custom_name.trim() } : {};

      const machineriesPayload = machineryRows
        .filter(m => m.machinery_id && Number(m.qty) > 0)
        .map(m => ({
          machinery_id: Number(m.machinery_id),
          quantity: Number(m.qty),
          used_hrs: Number(m.hrs || 0),
          remark: m.remark || '',
          ...resolveOtherName(m),
        }));

      if (isEditMode) {
        const rawDetails: any[] = formData.rawLabourDetails ?? [];

        const existingLabours = Object.entries(formData.labour)
          .map(([id, qty]) => {
            if (Number(qty) <= 0) return null;
            const orig = rawDetails.find((l: any) => String(l.wplm_id) === id);
            return orig?.wilpd_id ? { wilpd_id: Number(orig.wilpd_id), quantity: Number(qty) } : null;
          })
          .filter((l): l is { wilpd_id: number; quantity: number } => l !== null);

        const newLabours = Object.entries(formData.labour)
          .map(([id, qty]) => {
            if (Number(qty) <= 0) return null;
            const orig = rawDetails.find((l: any) => String(l.wplm_id) === id);
            return !orig?.wilpd_id ? { wplm_id: Number(id), quantity: Number(qty) } : null;
          })
          .filter((l): l is { wplm_id: number; quantity: number } => l !== null);

        const existingMachineries = machineryRows
          .filter(m => m.wmpr_id && Number(m.qty) > 0)
          .map(m => ({
            wmpr_id: Number(m.wmpr_id),
            quantity: Number(m.qty),
            used_hrs: Number(m.hrs || 0),
            remark: m.remark || '',
            machinery_name: m.machinery_id === 9 ? (m.custom_name?.trim() || m.name) : m.name,
          }));

        const newMachineries = machineryRows
          .filter(m => !m.wmpr_id && m.machinery_id && (Number(m.qty) > 0 || m.original_wmpr_id !== null))
          .map(m => ({
            machinery_id: Number(m.machinery_id),
            quantity: Number(m.qty),
            used_hrs: Number(m.hrs || 0),
            remark: m.remark || '',
            machinery_name: m.machinery_id === 9 ? (m.custom_name?.trim() || m.name) : m.name,
          }));

        const zeroedChangedMachineries = machineryRows
          .filter(m => m.original_wmpr_id !== null)
          .map(m => ({ wmpr_id: Number(m.original_wmpr_id), quantity: 0, used_hrs: 0, remark: '', machinery_name: m.name }));

        const hasAnything = [existingLabours, newLabours, existingMachineries, newMachineries, zeroedChangedMachineries].some(a => a.length > 0);
        if (!hasAnything) {
          showAlert('No Data', 'Please enter at least one Labour or Machinery quantity.', 'info');
          return;
        }

        const allUpdateMachineries = [...existingMachineries, ...zeroedChangedMachineries, ...newMachineries];
        if (existingLabours.length > 0 || allUpdateMachineries.length > 0) {
          await updateLabourMachinery({ date: dateStr, labours: existingLabours, machineries: allUpdateMachineries });
        }
        if (newLabours.length > 0) {
          await saveLabourMachinery({ date: dateStr, labours: newLabours, machineries: [], created_by: selectedProject.user_id ?? 1 });
        }

        showAlert('Success ✅', 'Record updated successfully.', 'info', [{
          text: 'OK', onPress: () => { setAddEditVisible(false); loadSummaryData(); },
        }]);

      } else {
        const laboursPayload = Object.entries(formData.labour)
          .map(([id, qty]) => ({ wplm_id: Number(id), quantity: Number(qty) }))
          .filter(l => l.quantity > 0);

        const allId10 = machineryRows.length > 0 && machineryRows.every(m => m.machinery_id === 10);
        if (machineriesPayload.length === 0 && !allId10) {
          showAlert('Machinery Required', "No machinery selected. Choose 'No Machinery' if applicable.", 'info');
          return;
        }
        if (laboursPayload.length === 0 && machineriesPayload.length === 0 && !allId10) {
          showAlert('No Data', 'Please enter at least one Labour or Machinery quantity.', 'info');
          return;
        }

        const doSave = async () => {
          const allLaboursPayload = labourMaster.map(l => ({
            wplm_id: l.wplm_id, quantity: Number(formData.labour?.[l.wplm_id] || 0),
          }));
          const finalMachineriesPayload = machineriesPayload.length > 0
            ? machineriesPayload
            : [{ machinery_id: 10, machinery_name: 'No Machinery', quantity: 0, used_hrs: 0, remark: '' }];

          const savePayload = {
            date: dateStr, labours: allLaboursPayload,
            machineries: finalMachineriesPayload, created_by: selectedProject.user_id ?? 1,
          };

          if (allLaboursPayload.every(l => l.quantity === 0)) {
            showAlert('Zero Labour', 'All Labour quantity is zero. Do you want to continue?', 'info', [
              { text: 'Cancel', style: 'cancel', onPress: () => { } },
              {
                text: 'Continue', onPress: async () => {
                  try {
                    await saveLabourMachinery(savePayload);
                    showAlert('Success ✅', 'Record saved successfully.', 'success', [{
                      text: 'OK', onPress: () => { setAddEditVisible(false); loadSummaryData(); },
                    }]);
                  } catch (err: any) {
                    showAlert('Error ❌', err?.response?.data?.message || err?.message || 'Something went wrong.', 'error');
                  }
                },
              },
            ]);
            return;
          }

          await saveLabourMachinery(savePayload);
          showAlert('Success ✅', 'Record saved successfully.', 'success', [{
            text: 'OK', onPress: () => { setAddEditVisible(false); loadSummaryData(); },
          }]);
        };

        const selDateStr = `${formData.date.getFullYear()}-${String(formData.date.getMonth() + 1).padStart(2, '0')}-${String(formData.date.getDate()).padStart(2, '0')}`;
        const existingRecord = dailyRecords.find(r => r.date.startsWith(selDateStr));

        if (existingRecord) {
          showAlert('Record Already Exists', 'A record already exists for this date. Continuing will replace all existing data. Are you sure?', 'info', [
            { text: 'Cancel', style: 'cancel', onPress: () => { } },
            {
              text: 'Continue', style: 'destructive', onPress: async () => {
                try {
                  const zeroedLabours = existingRecord.rawLabourDetails
                    .filter((l: any) => l.wilpd_id)
                    .map((l: any) => ({ wilpd_id: Number(l.wilpd_id), quantity: 0 }));
                  const zeroedMachineries = existingRecord.rawMachineryDetails
                    .filter((m: any) => m.wmpr_id || m.machinery_id)
                    .map((m: any) => m.wmpr_id
                      ? { wmpr_id: Number(m.wmpr_id), quantity: 0, used_hrs: 0, remark: '' }
                      : { machinery_id: Number(m.machinery_id), quantity: 0, used_hrs: 0, remark: '' });
                  if (zeroedLabours.length > 0 || zeroedMachineries.length > 0) {
                    await updateLabourMachinery({ date: dateStr, labours: zeroedLabours, machineries: zeroedMachineries });
                  }
                  await doSave();
                } catch (err: any) {
                  showAlert('Error ❌', err?.response?.data?.message || err?.message || 'Something went wrong.', 'error');
                }
              },
            },
          ]);
          return;
        }
        await doSave();
      }
    } catch (err: any) {
      showAlert('Error ❌', err?.response?.data?.message || err?.message || 'Something went wrong.', 'error');
    }
  };

  const handleEditRecord = async (record: DailyRecord) => {
    const labourMap: Record<number, string> = {};
    record.rawLabourDetails.forEach((l: any) => {
      if (l.wplm_id) labourMap[l.wplm_id] = String(l.Qty ?? '');
    });
    const machRows: MachineryRow[] = record.rawMachineryDetails
      .filter((m: any) => Number(m.qty) > 0)
      .map((m: any) => {
        const isOther = m.machinery_id === 9;
        return {
          wmpr_id: m.wmpr_id ?? null,
          machinery_id: m.machinery_id ?? null,
          name: isOther ? 'Other' : (m.machinery_name?.trim() ?? ''),
          qty: String(m.qty ?? ''),
          hrs: String(m.used_hrs ?? ''),
          remark: m.remark ?? '',
          custom_name: isOther ? (m.machinery_name?.trim() ?? '') : '',
          original_wmpr_id: null,
        };
      });
    setFormData({ date: new Date(record.date), labour: labourMap, rawLabourDetails: record.rawLabourDetails ?? [] });
    setMachineryRows(machRows.length > 0 ? machRows : [{ ...EMPTY_MACH_ROW }]);
    setIsEditMode(true);
    setAddEditVisible(true);
  };

  const handleViewRecord = (record: DailyRecord) => {
    setSelectedRecordDetail(record);
    setViewDetailVisible(true);
  };

  const formatShortDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const updateMachinery = (idx: number, key: string, value: any) => {
    setMachineryRows(prev => {
      const rows = [...prev];
      (rows[idx] as any)[key] = value;
      return rows;
    });
  };
  const handleDeleteRecord = async (record: DailyRecord) => {
    try {
      const dateOnly = record.date.split("T")[0]; // "2026-03-30"

      showAlert(
        "Delete Record",
        `Are you sure you want to delete record for ${dateOnly}`,
        "info",
        [
          { text: "Cancel", style: "cancel", onPress: () => { } },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteLabourMachineryByDate(dateOnly);

                showAlert("Deleted ✅", "Record deleted successfully.", "success", [
                  {
                    text: "OK",
                    onPress: () => {
                      loadSummaryData(); // refresh list
                    },
                  },
                ]);
              } catch (err: any) {
                showAlert(
                  "Error ❌",
                  err?.message || "Delete failed",
                  "error"
                );
              }
            },
          },
        ]
      );
    } catch (err: any) {
      showAlert("Error ❌", err?.message || "Something went wrong", "error");
    }
  };
  // ─── Record Card ──────────────────────────────────────────────────────────

  const renderRecordCard = ({ item }: { item: DailyRecord }) => (
    <View style={[
      styles.recordCard,
      { backgroundColor: theme.cardColor, shadowColor: theme.shadowColor, borderColor: theme.borderColor },
    ]}>
      <View style={styles.recordHeader}>
        <Text style={[styles.recordDate, { color: theme.text }]} numberOfLines={1}>
          {formatShortDate(item.date)}
        </Text>
        <View style={styles.recordActions}>
          <TouchableOpacity
            style={[styles.recordActionButton, { backgroundColor: inputBg }]}
            onPress={() => handleViewRecord(item)}
          >
            <Eye size={iconSize(17)} color={theme.iconPrimary} />
          </TouchableOpacity>
          {hasWriteAccess('LABOUR_AND_MACHINERY_EDIT_ENTRY') && (
            <TouchableOpacity
              style={[styles.recordActionButton, { backgroundColor: inputBg }]}
              onPress={() => handleEditRecord(item)}
            >
              <Edit2 size={iconSize(17)} color={theme.iconPrimary} />
            </TouchableOpacity>

          )}
          {hasWriteAccess('DELETE_LABOUR_AND_MACHINERY') && (
            <TouchableOpacity
              style={[styles.recordActionButton, { backgroundColor: inputBg }]}
              onPress={() => handleDeleteRecord(item)}
            >
              <Trash2 size={iconSize(17)} color={theme.iconDanger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.recordSummary, { backgroundColor: inputBg }]}>
        <View style={styles.summaryItem}>
          <Users size={iconSize(19)} color={theme.iconPrimary} />
          <View style={styles.summaryContent}>
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>Labour</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{item.labourCount} Workers</Text>
          </View>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: borderColor }]} />
        <View style={styles.summaryItem}>
          <Wrench size={iconSize(19)} color={theme.iconSuccess} />
          <View style={styles.summaryContent}>
            <Text style={[styles.summaryLabel, { color: subTextColor }]}>Machinery</Text>
            <Text style={[styles.summaryValue, { color: theme.text }]}>{item.machineryCount} Units</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} />

      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={[styles.mainTitle, { color: theme.text }]}>Labour & Machinery</Text>
      </View>

      {/* Filter Row */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, { backgroundColor: theme.cardColor, borderColor }]}
          onPress={() => setFilterDropdownOpen(true)}
        >
          <Filter size={iconSize(17)} color={theme.text} />
          <Text style={[styles.filterButtonText, { color: theme.text }]} numberOfLines={1}>
            {selectedFilter}
          </Text>
        </TouchableOpacity>
        {hasWriteAccess('LABOUR_AND_MACHINERY_ADD_ENTRY') && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setIsEditMode(false);
              setFormData({ date: new Date(), labour: {} });
              setMachineryRows([]);
              setAddEditVisible(true);
            }}
          >
            <LinearGradient
              colors={['#60A5FA', '#2563EB']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.addButtonGradient}
            >
              <Plus size={iconSize(20)} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {loading
        ? <ActivityIndicator size="large" color={theme.info} style={{ marginTop: hp(6) }} />
        : (
          <FlatList
            data={dailyRecords}
            renderItem={renderRecordCard}
            keyExtractor={item => item.date}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ color: subTextColor, fontSize: normalize(14) }}>No records found</Text>
              </View>
            }
          />
        )
      }

      {/* ── VIEW DETAIL MODAL ─────────────────────────────────────────────── */}
      <Modal visible={viewDetailVisible} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayBackground }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.cardColor }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <View style={{ flex: 1, marginRight: normalize(10) }}>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Daily Report</Text>
                <Text style={{ color: subTextColor, fontSize: normalize(13) }}>
                  {selectedRecordDetail ? formatShortDate(selectedRecordDetail.date) : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.closeIconButton, { backgroundColor: inputBg }]}
                onPress={() => setViewDetailVisible(false)}
              >
                <Plus size={iconSize(22)} color={theme.text} style={{ transform: [{ rotate: '45deg' }] }} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                // padding: 20,
                paddingBottom: normalize(isKeyboardVisible ? 380 : 120),
              }}            >
              {/* Labour */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconTitle}>
                  <Users size={iconSize(18)} color={theme.iconPrimary} />
                  <Text style={[styles.sectionTitleText, { color: theme.text }]}>Labour Distribution</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: theme.badgeBlue }]}>
                  <Text style={{ color: theme.iconPrimary, fontWeight: 'bold', fontSize: normalize(13) }}>
                    {selectedRecordDetail?.labourCount}
                  </Text>
                </View>
              </View>

              <View style={styles.detailGrid}>
                {selectedRecordDetail?.rawLabourDetails.map((l, i) => (
                  <View key={i} style={[styles.modernDetailCard, { backgroundColor: inputBg }]}>
                    <Text style={[styles.detailCardLabel, { color: subTextColor }]} numberOfLines={2}>{l.name}</Text>
                    <Text style={[styles.detailCardValue, { color: theme.text }]}>
                      {l.Qty}{' '}
                      <Text style={{ fontSize: normalize(11), fontWeight: '400' }}>Labours</Text>
                    </Text>
                  </View>
                ))}
              </View>

              <View style={[styles.sectionDivider, { backgroundColor: borderColor }]} />

              {/* Machinery */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconTitle}>
                  <Wrench size={iconSize(18)} color={theme.iconSuccess} />
                  <Text style={[styles.sectionTitleText, { color: theme.text }]}>Machinery Usage</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: theme.badgeGreen }]}>
                  <Text style={{ color: theme.iconSuccess, fontWeight: 'bold', fontSize: normalize(13) }}>
                    {selectedRecordDetail?.machineryCount}
                  </Text>
                </View>
              </View>

              {selectedRecordDetail?.rawMachineryDetails.map((m, i) => (
                <View key={i} style={[styles.machineryDetailRow, { backgroundColor: inputBg }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.machineryName, { color: theme.text }]} numberOfLines={2}>
                      {m.machinery_name?.trim() || 'Other'}
                    </Text>
                    <Text style={{ color: subTextColor, fontSize: normalize(12) }}>
                      {m.remark?.trim() || 'No Remarks'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', marginLeft: normalize(8) }}>
                    <Text style={[styles.machineryQty, { color: theme.text }]}>{m.qty} Units</Text>
                    <Text style={{ color: subTextColor, fontSize: normalize(12) }}>{m.used_hrs || 0} Hrs</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── ADD / EDIT SHEET (View-based — no Modal, fixes all iOS stacking) ─ */}
      {addEditVisible && (
        <View style={[
          styles.formSheetOverlay,
          {
            backgroundColor: theme.overlayBackground,
            // Offset from top so the sheet never covers the app navigation header
            top: insets.top,
          },
        ]}>
          <TouchableOpacity
            style={styles.formModalDismissArea}
            activeOpacity={1}
            onPress={() => setAddEditVisible(false)}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.formModalKAV}
            keyboardVerticalOffset={Platform.OS === 'ios' ? normalize(64) : 0}
          >
            <View style={[
              styles.formModal,
              {
                backgroundColor: theme.cardColor,
                // Cap height so drag-handle + header always remain visible
                maxHeight: getWindow().height - insets.top - insets.bottom - normalize(60),
              },
            ]}>
              <View style={[styles.dragHandle, { backgroundColor: theme.dragHandle }]} />

              {/* Sheet header */}
              <View style={[styles.formModalHeader, { borderBottomColor: borderColor }]}>
                <View style={styles.formModalTitleRow}>
                  <View style={[
                    styles.formModalIconBadge,
                    { backgroundColor: isEditMode ? theme.badgeOrange : theme.badgeBlue },
                  ]}>
                    {isEditMode
                      ? <Edit2 size={iconSize(15)} color={theme.iconWarning} />
                      : <Plus size={iconSize(15)} color={theme.iconPrimary} />}
                  </View>
                  <View>
                    <Text style={[styles.formModalTitle, { color: theme.text }]}>
                      {isEditMode ? 'Edit Record' : 'New Record'}
                    </Text>
                    <Text style={[styles.formModalSubtitle, { color: subTextColor }]}>
                      {isEditMode ? 'Update existing entry' : 'Add daily labour & machinery'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.formModalCloseBtn, { backgroundColor: inputBg }]}
                  onPress={() => setAddEditVisible(false)}
                >
                  <Plus size={iconSize(17)} color={subTextColor} style={{ transform: [{ rotate: '45deg' }] }} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.formModalBody}
                contentContainerStyle={{
                  // padding: 24,
                  paddingBottom: normalize(isKeyboardVisible ? 380 : 120),
                }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                automaticallyAdjustKeyboardInsets
              >
                {/* ── Date ── */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: normalize(4) }}>
                  <Text style={[styles.formSectionLabel, { color: subTextColor }]}>DATE</Text>
                  <Text style={[styles.formSectionRequired, { color: theme.iconDanger }]}>*</Text>
                </View>
                <TouchableOpacity
                  style={[styles.formDateBox, { backgroundColor: isEditMode ? theme.disabledBackground : inputBg, borderColor }]}
                  onPress={() => setFormDatePicker(true)}
                  disabled={isEditMode}
                >
                  <View style={styles.formDateLeft}>
                    <View style={[styles.formDateIconCircle, { backgroundColor: isEditMode ? theme.disabledBackground : theme.badgeBlue }]}>
                      <Calendar size={iconSize(15)} color={isEditMode ? theme.disabledText : theme.iconPrimary} />
                    </View>
                    <Text style={[styles.formDateText, { color: isEditMode ? theme.disabledText : theme.text }]} numberOfLines={1}>
                      {formData.date.toLocaleDateString('en-US', {
                        weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
                      })}
                    </Text>
                  </View>
                  {!isEditMode && <ChevronRight size={iconSize(15)} color={subTextColor} />}
                </TouchableOpacity>

                {/* ── Labour ── */}
                <View style={styles.formSectionHeaderRow}>
                  <View style={styles.formSectionLabelRow}>
                    <Text style={[styles.formSectionLabel, { color: subTextColor }]}>LABOUR</Text>
                  </View>
                  <Text style={[styles.formSectionCount, { color: subTextColor }]}>
                    {labourMaster.length} types
                  </Text>
                </View>

                <View style={[styles.formCard, { backgroundColor: inputBg, borderColor }]}>
                  {labourMaster.map((labour, idx) => (
                    <View
                      key={labour.wplm_id}
                      style={[
                        styles.formLabourRow,
                        idx < labourMaster.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
                      ]}
                    >
                      <View style={styles.formLabourLeft}>
                        <View style={[styles.formLabourAvatar, { backgroundColor: theme.badgeBlue }]}>
                          <Users size={iconSize(13)} color={theme.iconPrimary} />
                        </View>
                        <Text
                          style={[styles.formLabourName, { color: theme.text }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {labour.labour_name}
                        </Text>
                      </View>
                      <View style={[styles.formQtyWrapper, { backgroundColor: theme.cardColor, borderColor }]}>
                        <TextInput
                          style={[styles.formQtyInput, { color: theme.text }]}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={placeholderColor}
                          maxLength={7}
                          value={formData.labour?.[labour.wplm_id] ?? ''}
                          onChangeText={v =>
                            setFormData((prev: any) => ({
                              ...prev, labour: { ...prev.labour, [labour.wplm_id]: v },
                            }))
                          }
                        />
                      </View>
                    </View>
                  ))}
                </View>

                {/* ── Machinery ── */}
                <View style={styles.formSectionHeaderRow}>
                  <View style={styles.formSectionLabelRow}>
                    <Text style={[styles.formSectionLabel, { color: subTextColor }]}>MACHINERY</Text>
                    <Text style={[styles.formSectionRequired, { color: theme.iconDanger }]}>*</Text>
                  </View>
                  <Text style={[styles.formSectionCount, { color: subTextColor }]}>
                    {machineryRows.length} {machineryRows.length === 1 ? 'entry' : 'entries'}
                  </Text>
                </View>

                {machineryRows.map((row, index) => (
                  <View key={index} style={[styles.formMachCard, { backgroundColor: inputBg, borderColor }]}>
                    <View style={styles.formMachCardHeader}>
                      <View style={[styles.formMachIndexBadge, { backgroundColor: theme.badgeGreen }]}>
                        <Wrench size={iconSize(11)} color={theme.iconSuccess} />
                        <Text style={[styles.formMachIndexText, { color: theme.iconSuccess }]}>#{index + 1}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.formMachDeleteBtn, { backgroundColor: theme.badgeRed }]}
                        onPress={() => setMachineryRows(machineryRows.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={iconSize(13)} color={theme.iconDanger} />
                      </TouchableOpacity>
                    </View>

                    {/* Machine selector */}
                    <TouchableOpacity
                      style={[styles.formMachSelector, { backgroundColor: theme.cardColor, borderColor }]}
                      onPress={() => { setActiveMachineIndex(index); setMachineryPickerVisible(true); }}
                    >
                      <Text
                        style={{ color: row.name ? theme.text : placeholderColor, fontSize: normalize(14) }}
                        numberOfLines={1}
                      >
                        {row.name || 'Tap to select machine...'}
                      </Text>
                      <ChevronRight size={iconSize(15)} color={subTextColor} />
                    </TouchableOpacity>

                    {/* Custom name for "Other" */}
                    {row.machinery_id === 9 && (
                      <View style={{ marginBottom: normalize(10) }}>
                        <Text style={[styles.formMachFieldLabel, { color: subTextColor, marginBottom: normalize(6) }]}>
                          MACHINERY NAME
                        </Text>
                        <TextInput
                          placeholder="Enter machinery name"
                          placeholderTextColor={placeholderColor}
                          style={[
                            styles.formMachRemark,
                            { backgroundColor: theme.cardColor, borderColor: theme.iconSuccess, color: theme.text, borderWidth: 1.5 },
                          ]}
                          maxLength={20}
                          value={row.custom_name ?? ''}
                          onChangeText={v => updateMachinery(index, 'custom_name', v)}
                          autoFocus
                        />
                      </View>
                    )}

                    {/* Qty + Hrs */}
                    <View style={styles.formMachFieldRow}>
                      {(['qty', 'hrs'] as const).map(field => {
                        const isDisabled = row.machinery_id === 10;
                        return (
                          <View
                            key={field}
                            style={[
                              styles.formMachFieldBox,
                              {
                                backgroundColor: isDisabled ? theme.disabledBackground : theme.cardColor,
                                borderColor,
                              },
                            ]}
                          >
                            <Text style={[styles.formMachFieldLabel, { color: subTextColor }]}>
                              {field.toUpperCase()}
                            </Text>
                            <TextInput
                              placeholder="0"
                              keyboardType="numeric"
                              placeholderTextColor={placeholderColor}
                              maxLength={7}
                              style={[styles.formMachFieldInput, { color: isDisabled ? theme.disabledText : theme.text }]}
                              value={row[field]}
                              onChangeText={v => updateMachinery(index, field, v)}
                              editable={!isDisabled}
                            />
                          </View>
                        );
                      })}
                    </View>

                    {/* Remark */}
                    <TextInput
                      placeholder="Remark (optional)"
                      placeholderTextColor={placeholderColor}
                      style={[styles.formMachRemark, { backgroundColor: theme.cardColor, borderColor, color: theme.text }]}
                      value={row.remark}
                      onChangeText={v => updateMachinery(index, 'remark', v)}
                    />
                  </View>
                ))}

                {/* Add machine */}
                <TouchableOpacity
                  style={[styles.formAddMachBtn, { borderColor: theme.iconSuccess }]}
                  onPress={() => setMachineryRows([...machineryRows, { ...EMPTY_MACH_ROW }])}
                >
                  <Plus size={iconSize(15)} color={theme.iconSuccess} />
                  <Text style={{ color: theme.iconSuccess, fontWeight: '600', marginLeft: normalize(6), fontSize: normalize(14) }}>
                    Add Machine Entry
                  </Text>
                </TouchableOpacity>

                {/* Save */}
                <TouchableOpacity style={styles.formSaveBtn} onPress={handleSaveRecord}>
                  <LinearGradient
                    colors={isEditMode ? ['#FBBF24', '#D97706'] : ['#60A5FA', '#2563EB']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.formSaveBtnGradient}
                  >
                    <Text style={styles.formSaveBtnText}>
                      {isEditMode ? '✓  Update Record' : '✓  Save Record'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>

          {/* Date Picker — absolute overlay inside the View sheet */}
          <CustomDatePicker
            visible={formDatePicker}
            onClose={() => setFormDatePicker(false)}
            onSelect={(d: Date) => {
              setFormData((prev: any) => ({ ...prev, date: d }));
              setFormDatePicker(false);
            }}
            selectedDate={formData.date}
            theme={theme}
            isDark={isDark}
          />
        </View>
      )}

      {/* ── FILTER MODAL ──────────────────────────────────────────────────── */}
      <Modal visible={filterDropdownOpen} transparent animationType="fade">
        <View style={[styles.filterModalOverlay, { backgroundColor: theme.overlayBackground }]}>
          <View style={[styles.filterModalBox, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.filterModalTitle, { color: theme.text }]}>Select Filter</Text>
            {FILTER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt}
                style={[styles.filterOptionItem, { borderBottomColor: borderColor }]}
                onPress={() => { setSelectedFilter(opt); setFilterDropdownOpen(false); }}
              >
                <Text style={{ color: theme.text, fontSize: normalize(14) }}>{opt}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setFilterDropdownOpen(false)}
              style={[styles.filterModalCloseButton, { backgroundColor: theme.info }]}
            >
              <Text style={{ color: '#FFF', fontSize: normalize(14), fontWeight: '600' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MACHINERY PICKER MODAL ────────────────────────────────────────── */}
      <Modal visible={machineryPickerVisible} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlayBackground }]}>
          <View style={[styles.pickerModal, { backgroundColor: theme.cardColor }]}>
            <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Machinery</Text>
            <FlatList
              data={machineryMaster}
              keyExtractor={item => item.machinery_id.toString()}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, { borderBottomColor: borderColor }]}
                  onPress={() => {
                    if (activeMachineIndex !== null) {
                      const rows = [...machineryRows];
                      const cur = rows[activeMachineIndex];
                      const changed = cur.wmpr_id !== null && cur.machinery_id !== item.machinery_id;
                      rows[activeMachineIndex] = {
                        ...cur,
                        name: item.machinery_name,
                        machinery_id: item.machinery_id,
                        qty: '0', hrs: '0', custom_name: '',
                        wmpr_id: changed ? null : cur.wmpr_id,
                        original_wmpr_id: changed ? (cur.wmpr_id ?? cur.original_wmpr_id) : cur.original_wmpr_id,
                      };
                      setMachineryRows(rows);
                    }
                    setMachineryPickerVisible(false);
                  }}
                >
                  <Text style={{ color: theme.text, fontSize: normalize(14) }}>{item.machinery_name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setMachineryPickerVisible(false)} style={styles.pickerCancel}>
              <Text style={{ color: theme.info, fontSize: normalize(15), fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AlertComponent />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Every fixed pixel replaced with normalize() / wp() / hp() for full
// responsiveness across all Android & iOS screen sizes and densities.

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerSection: {
    paddingHorizontal: wp(4.5),
    paddingVertical: normalize(12),
    marginBottom: normalize(2),
  },
  mainTitle: { fontSize: normalize(21), fontWeight: '800', letterSpacing: -0.5 },

  // ── Filter row ─────────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4.5),
    marginVertical: normalize(12),
  },
  filterButton: {
    flex: 1,
    paddingVertical: normalize(11),
    paddingHorizontal: normalize(12),
    borderRadius: normalize(10),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: normalize(10),
  },
  filterButtonText: { marginLeft: normalize(8), fontSize: normalize(13), fontWeight: '500', flex: 1 },
  addButton: {
    width: normalize(42),
    height: normalize(42),
    borderRadius: normalize(21),
    overflow: 'hidden',
    elevation: 8,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  addButtonGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listContainer: { paddingHorizontal: wp(4), paddingBottom: hp(12) },
  emptyContainer: { paddingVertical: hp(6), alignItems: 'center' },

  // ── Record card ────────────────────────────────────────────────────────────
  recordCard: {
    borderRadius: normalize(14),
    padding: normalize(14),
    marginBottom: normalize(10),
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(10),
  },
  recordDate: { fontSize: normalize(15), fontWeight: '600', flex: 1 },
  recordActions: { flexDirection: 'row', gap: normalize(8) },
  recordActionButton: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(17),
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordSummary: { flexDirection: 'row', borderRadius: normalize(10), padding: normalize(10) },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: normalize(8) },
  summaryContent: { flex: 1 },
  summaryLabel: { fontSize: normalize(11) },
  summaryValue: { fontSize: normalize(13), fontWeight: '600' },
  summaryDivider: { width: 1, height: normalize(28), marginHorizontal: normalize(8) },

  // ── View-detail modal ──────────────────────────────────────────────────────
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { borderRadius: normalize(18), width: wp(92), maxHeight: hp(80) },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: normalize(16),
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: normalize(17), fontWeight: '700' },
  modalBody: { padding: normalize(16) },
  closeIconButton: {
    width: normalize(32),
    height: normalize(32),
    borderRadius: normalize(16),
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: normalize(12) },
  sectionIconTitle: { flexDirection: 'row', alignItems: 'center', gap: normalize(8) },
  sectionTitleText: { fontSize: normalize(15), fontWeight: '700' },
  badge: { paddingHorizontal: normalize(9), paddingVertical: normalize(3), borderRadius: normalize(7) },

  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: normalize(8), marginBottom: normalize(8) },
  modernDetailCard: { width: '48%', padding: normalize(11), borderRadius: normalize(10) },
  detailCardLabel: { fontSize: normalize(11), marginBottom: normalize(3) },
  detailCardValue: { fontSize: normalize(17), fontWeight: '700' },
  sectionDivider: { height: 1, marginVertical: normalize(16) },

  machineryDetailRow: {
    flexDirection: 'row',
    padding: normalize(12),
    borderRadius: normalize(10),
    marginBottom: normalize(8),
    alignItems: 'center',
  },
  machineryName: { fontSize: normalize(14), fontWeight: '600' },
  machineryQty: { fontSize: normalize(14), fontWeight: '700' },

  // ── Add/Edit View-based bottom sheet ───────────────────────────────────────
  formSheetOverlay: {
    position: 'absolute',
    // top is set inline via insets.top so the sheet starts below the nav header
    marginTop: normalize(40), // responsive offset — scales with screen density
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  formModalDismissArea: { flex: 1 },
  formModalKAV: { width: '100%', justifyContent: 'flex-end' },
  formModal: {
    borderTopLeftRadius: normalize(24),
    borderTopRightRadius: normalize(24),
    width: '100%',
    // maxHeight set inline using insets so header is always visible
  },
  dragHandle: {
    width: normalize(38),
    height: normalize(4),
    borderRadius: normalize(2),
    alignSelf: 'center',
    marginTop: normalize(10),
    marginBottom: normalize(4),
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(4.5),
    paddingVertical: normalize(14),
    borderBottomWidth: 1,
  },
  formModalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: normalize(10) },
  formModalIconBadge: {
    width: normalize(34),
    height: normalize(34),
    borderRadius: normalize(9),
    justifyContent: 'center',
    alignItems: 'center',
  },
  formModalTitle: { fontSize: normalize(16), fontWeight: '700' },
  formModalSubtitle: { fontSize: normalize(11), marginTop: 1 },
  formModalCloseBtn: {
    width: normalize(32),
    height: normalize(32),
    borderRadius: normalize(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
  formModalBody: { paddingHorizontal: wp(4.5), paddingTop: normalize(16) },

  // ── Section labels ─────────────────────────────────────────────────────────
  formSectionLabel: {
    fontSize: normalize(10), fontWeight: '700', letterSpacing: 0.8, marginBottom: normalize(6),
  },
  formSectionRequired: {
    fontSize: normalize(16), fontWeight: '700', letterSpacing: 0.8, marginBottom: normalize(6),
  },
  formSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: normalize(20),
    marginBottom: normalize(8),
  },
  formSectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: normalize(5) },
  formSectionCount: { fontSize: normalize(12) },

  // ── Date row ───────────────────────────────────────────────────────────────
  formDateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: normalize(13),
    borderRadius: normalize(12),
    borderWidth: 1,
  },
  formDateLeft: { flexDirection: 'row', alignItems: 'center', gap: normalize(9), flex: 1 },
  formDateIconCircle: {
    width: normalize(30),
    height: normalize(30),
    borderRadius: normalize(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  formDateText: { fontSize: normalize(13), fontWeight: '500', flex: 1 },

  // ── Labour card ────────────────────────────────────────────────────────────
  formCard: { borderRadius: normalize(12), borderWidth: 1, overflow: 'hidden' },
  formLabourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(11),
  },
  formLabourLeft: { flexDirection: 'row', alignItems: 'center', gap: normalize(9), flex: 1 },
  formLabourAvatar: {
    width: normalize(28),
    height: normalize(28),
    borderRadius: normalize(7),
    justifyContent: 'center',
    alignItems: 'center',
  },
  formLabourName: { fontSize: normalize(13), fontWeight: '500', flex: 1 },
  formQtyWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: normalize(9),
    borderWidth: 1,
    overflow: 'hidden',
    marginLeft: normalize(8),
  },
  formQtyInput: {
    width: normalize(52),
    textAlign: 'center',
    fontSize: normalize(14),
    fontWeight: '600',
    paddingVertical: normalize(7),
  },

  // ── Machinery card ─────────────────────────────────────────────────────────
  formMachCard: {
    borderRadius: normalize(12), borderWidth: 1,
    padding: normalize(12), marginBottom: normalize(10),
  },
  formMachCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: normalize(10),
  },
  formMachIndexBadge: {
    flexDirection: 'row', alignItems: 'center', gap: normalize(4),
    paddingHorizontal: normalize(7), paddingVertical: normalize(4), borderRadius: normalize(6),
  },
  formMachIndexText: { fontSize: normalize(10), fontWeight: '700' },
  formMachDeleteBtn: {
    width: normalize(28), height: normalize(28),
    borderRadius: normalize(8), justifyContent: 'center', alignItems: 'center',
  },
  formMachSelector: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: normalize(11), borderRadius: normalize(9), borderWidth: 1, marginBottom: normalize(10),
  },
  formMachFieldRow: { flexDirection: 'row', gap: normalize(10), marginBottom: normalize(10) },
  formMachFieldBox: { flex: 1, borderRadius: normalize(9), borderWidth: 1, padding: normalize(10) },
  formMachFieldLabel: {
    fontSize: normalize(9), fontWeight: '700', letterSpacing: 0.5, marginBottom: normalize(4),
  },
  formMachFieldInput: { fontSize: normalize(15), fontWeight: '600' },
  formMachRemark: {
    borderRadius: normalize(9), borderWidth: 1,
    padding: normalize(10), fontSize: normalize(13), minHeight: normalize(40),
  },
  formAddMachBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed',
    borderRadius: normalize(12), padding: normalize(13), marginTop: normalize(4),
  },
  formSaveBtn: {
    borderRadius: normalize(10),
    overflow: 'hidden',
    elevation: 4,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginTop: normalize(18),
    shadowOffset: { width: 0, height: 2 },
  },
  formSaveBtnGradient: {
    justifyContent: 'center', alignItems: 'center',
    paddingVertical: normalize(14), paddingHorizontal: normalize(16),
  },
  formSaveBtnText: { color: '#FFF', fontSize: normalize(15), fontWeight: '700', letterSpacing: 0.3 },

  // ── Filter modal ───────────────────────────────────────────────────────────
  filterModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterModalBox: { width: wp(80), borderRadius: normalize(14), padding: normalize(18) },
  filterModalTitle: { fontSize: normalize(16), fontWeight: '700', marginBottom: normalize(12) },
  filterOptionItem: { paddingVertical: normalize(13), borderBottomWidth: 1 },
  filterModalCloseButton: {
    marginTop: normalize(14), padding: normalize(12),
    borderRadius: normalize(9), alignItems: 'center',
  },

  // ── Picker modal ───────────────────────────────────────────────────────────
  pickerModal: {
    width: wp(88), borderRadius: normalize(14),
    padding: normalize(18), maxHeight: hp(60),
  },
  pickerTitle: { fontSize: normalize(16), fontWeight: '700', marginBottom: normalize(10), textAlign: 'center' },
  pickerItem: { paddingVertical: normalize(14), borderBottomWidth: 1 },
  pickerCancel: { marginTop: normalize(12), alignItems: 'center', paddingVertical: normalize(6) },
});