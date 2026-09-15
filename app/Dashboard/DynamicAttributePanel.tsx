import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator, Alert } from 'react-native';
import { Camera, X, Maximize2, Trash2, ChevronDown, Check, AlertTriangle, BarChart3, AlertCircle } from 'lucide-react-native';
import { 
  getFeatureDataForm, submitFeatureData, getGroupSummary, deleteGroupEntry, 
  Attribute as AttributeConfig, GroupChildAttribute, GroupEntry, 
  GroupSummaryResponse, SubmitPayload
} from '../../api/api_feature_data';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../hooks/useAlert';
import { useTheme } from '../../contexts/ThemeContext';
import PhotoUploader from './PhotoUploader';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type InputType = "Number" | "Text" | "Dropdown" | "Calculated" | "Boolean";

export type FormDataState = {
  [attrId: string]: string | GroupEntryState[];
};

export interface GroupEntryState {
  __group_data_id?: number;
  __created_at?: string;
  [fieldName: string]: string | number | undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formula evaluator (safe — no eval)
// ─────────────────────────────────────────────────────────────────────────────
function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function evalFormula(formula: string, vals: Record<string, string>): string {
  if (!formula) return "";
  try {
    let expr = formula;
    const sortedKeys = Object.keys(vals).sort((a, b) => b.length - a.length);
    sortedKeys.forEach((k) => {
      const v = vals[k];
      const num = parseFloat(v);
      const numStr = isNaN(num) ? "0" : String(num);
      expr = expr.split(k).join(numStr);
    });
    
    if (!/^[\d\s+\-*/().]+$/.test(expr)) return "";
    const result = new Function(`"use strict"; return (${expr})`)();
    return isNaN(result) ? "" : Number(result.toFixed(4)).toString();
  } catch {
    return "";
  }
}

function emptyEntry(children: GroupChildAttribute[]): GroupEntryState {
  const entry: GroupEntryState = {};
  children.forEach((c) => { entry[c.name] = ""; });
  return entry;
}

// NOTE: recognizes "boolean" (and "bool") ahead of the other checks so that
// backend types like "Boolean" render as a radio-button group instead of
// falling through to a plain dropdown/text input.
function normalizeInputType(raw?: string | null): InputType {
  if (!raw) return "Text";
  const r = raw.toLowerCase();
  if (r.includes("boolean") || r === "bool") return "Boolean";
  if (r.includes("enum") || r.includes("dropdown")) return "Dropdown";
  if (r.includes("calculated")) return "Calculated";
  if (r.includes("number") || r.includes("integer")) return "Number";
  return "Text";
}

// ─────────────────────────────────────────────────────────────────────────────
// Dropdown Component (Custom Modal Picker)
// ─────────────────────────────────────────────────────────────────────────────
const CustomDropdown = ({ value, options, onSelect, disabled, placeholder, styles, theme }: any) => {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <>
      <TouchableOpacity 
        style={[styles.input, styles.dropdownInput, disabled && styles.disabledInput]} 
        onPress={() => !disabled && setModalVisible(true)}
      >
        <Text style={value ? styles.inputText : styles.placeholderText}>{value || placeholder}</Text>
        <ChevronDown size={18} color={theme.subtext} />
      </TouchableOpacity>
      <Modal visible={modalVisible} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{placeholder}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 8 }}>
                <X size={24} color={theme.subtext} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: '70%' }}>
              {options.map((opt: string) => (
                <TouchableOpacity 
                  key={opt} 
                  style={styles.dropdownOption}
                  onPress={() => { onSelect(opt); setModalVisible(false); }}
                >
                  <Text style={styles.dropdownOptionText}>{opt}</Text>
                  {value === opt && <Check size={20} color={theme.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Radio Button Group (used for Boolean / Yes-No style fields)
// ─────────────────────────────────────────────────────────────────────────────
const RadioButtonGroup = ({ value, options, onSelect, disabled, styles }: any) => {
  return (
    <View style={styles.radioGroup}>
      {options.map((opt: string) => {
        const selected = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={styles.radioOption}
            activeOpacity={0.7}
            onPress={() => !disabled && onSelect(opt)}
            disabled={disabled}
          >
            <View
              style={[
                styles.radioCircle,
                selected && styles.radioCircleSelected,
                disabled && styles.radioCircleDisabled,
              ]}
            >
              {selected && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.radioLabel, disabled && styles.radioLabelDisabled]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Friendly Group Summary Cards (Replaces the horizontal table)
// ─────────────────────────────────────────────────────────────────────────────
const GroupSummaryList = ({ data, onDeleteRow, configChildren, styles, theme }: any) => {
  if (!data || !data.rows || data.rows.length === 0) {
    return <Text style={styles.noEntriesText}>No entries to show.</Text>;
  }

  const entryMap = new Map<number, { group_data_id: number; created_at: string; cells: Record<string, string> }>();
  data.rows.forEach((r: any) => {
    if (!entryMap.has(r.entry_index)) {
      entryMap.set(r.entry_index, { group_data_id: r.group_data_id, created_at: r.created_at, cells: {} });
    }
    entryMap.get(r.entry_index)!.cells[r.child_name] = r.value;
  });
  const entries = [...entryMap.entries()].sort((a, b) => a[0] - b[0]);
  const columns = [...new Map(data.rows.map((r: any) => [r.child_name, r.display_order])).entries()]
    .sort((a, b) => (a[1] as number) - (b[1] as number)).map(([name]) => name as string);
  
  const totalColumns = columns.filter((col, idx) =>
    idx === 0 || col.toLowerCase().includes('volume')
  );

  // Build unitMap from config children (most reliable source) with fallback to API row unit_name
  const unitMap: Record<string, string> = {};
  if (configChildren && Array.isArray(configChildren)) {
    configChildren.forEach((c: any) => {
      if (c.unit_name) unitMap[c.name] = c.unit_name;
    });
  }
  // Fallback: also pick up any unit_name that comes from the API rows
  data.rows.forEach((r: any) => {
    if (r.unit_name && !unitMap[r.child_name]) unitMap[r.child_name] = r.unit_name;
  });

  return (
    <View style={styles.cardListContainer}>
      {entries.map(([, e], i) => (
        <View key={e.group_data_id} style={styles.entryCard}>
          <View style={styles.entryCardHeader}>
            <Text style={styles.entryCardIndex}>Entry #{i + 1}</Text>
            <View style={styles.entryCardHeaderRight}>
              <Text style={styles.entryCardDate}>{formatDate(e.created_at)}</Text>
              {onDeleteRow && (
                <TouchableOpacity style={styles.deleteButtonSmall} onPress={() => onDeleteRow(e.group_data_id)}>
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.entryCardBody}>
            {columns.map(c => {
              const raw = e.cells[c];
              const num = raw !== undefined ? parseFloat(raw) : NaN;
              const display = raw === undefined ? "-" : (!isNaN(num) ? num.toFixed(2) : raw);
              const unit = unitMap[c];
              const label = unit ? `${c} (${unit})` : c;
              return (
                <View key={c} style={styles.entryKeyValue}>
                  <Text style={styles.entryKey}>{label}</Text>
                  <Text style={styles.entryValue}>{display}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {/* Footer Totals */}
      {data.totals && data.totals.length > 0 && (
        <View style={[styles.entryCard, styles.totalsCard]}>
          <Text style={styles.totalsHeader}>Totals</Text>
          <View style={styles.entryCardBody}>
            {totalColumns.filter((c: string) => !!data.totals.find((tt: any) => tt.child_name === c)).map(c => {
              const t = data.totals.find((tt: any) => tt.child_name === c);
              if (!t) return null;
              const tVal = typeof t.total === "number" ? t.total.toFixed(2) : t.total;
              const unit = unitMap[c] || t.unit_name;
              const label = unit ? `${c} (${unit})` : c;
              return (
                <View key={c} style={styles.entryKeyValue}>
                  <Text style={styles.entryKey}>{label}</Text>
                  <Text style={[styles.entryValue, styles.totalValueText]}>{tVal}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VolumeCards Component
// ─────────────────────────────────────────────────────────────────────────────
const VolumeCards = ({
  todayVol, cumulativeVol, unit, featureId, attrId, groupName, editMode, showTodayVolume, showCumulativeVolume, onEntryDeleted, configChildren, styles, theme, isDark
}: any) => {
  const { token, hasWriteAccess, hasAccess } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const [activeView, setActiveView] = useState<"today" | "cumulative" | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<GroupSummaryResponse | null>(null);

  useEffect(() => { if (editMode) setActiveView(null); }, [editMode]);

  const openSummary = async (type: "today" | "cumulative") => {
    if (activeView === type) { setActiveView(null); return; }
    setActiveView(type);
    setSummaryLoading(true);
    try {
      if (token) {
        const res = await getGroupSummary(featureId, attrId, type, token);
        setSummaryData(res);
      }
    } catch (err) {
      showAlert("Error", "Failed to load summary.", "error");
      setSummaryData(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const confirmDelete = (id: number) => {
    showAlert("Delete Record", "Are you sure you want to delete this record?",'warning', [
      { text: "Cancel", style: "cancel" , onPress: () => { }},
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!token) return;
        try {
          await deleteGroupEntry(id, token);
          showAlert("Success", "Entry deleted.", "success");
          if (onEntryDeleted) onEntryDeleted(id);
          const res = await getGroupSummary(featureId, attrId, activeView!, token);
          setSummaryData(res);
        } catch (err) {
          showAlert("Error", "Failed to delete entry.", "error");
        }
      }}
    ]);
  };

  if (!showTodayVolume && !showCumulativeVolume) return null;

  return (
    <View style={styles.volumeCardsContainer}>
      <View style={styles.volumeCardsRow}>
        {showTodayVolume && (
          <TouchableOpacity style={[styles.volumeCard, activeView === 'today' && styles.volumeCardActiveGreen]} onPress={() => openSummary('today')}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.volumeCardTitle} numberOfLines={3}>Today's Summary{unit ? ` (${unit})` : ''} {activeView === 'today' ? '▾' : ''}</Text>
              <Text style={[styles.volumeCardValue, { color: isDark ? '#4ADE80' : '#16A34A' }]} numberOfLines={1}>{todayVol.toFixed(2)}</Text>
            </View>
            <View style={[styles.volumeCardIconWrapper, { backgroundColor: activeView === 'today' ? (isDark ? '#14532D' : '#BBF7D0') : (isDark ? '#064E3B' : '#DCFCE7') }]}>
              <BarChart3 size={15} color={isDark ? '#4ADE80' : '#16A34A'} />
            </View>
          </TouchableOpacity>
        )}
        {showCumulativeVolume && (
          <TouchableOpacity style={[styles.volumeCard, activeView === 'cumulative' && styles.volumeCardActiveBlue]} onPress={() => openSummary('cumulative')}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.volumeCardTitle} numberOfLines={3}>Cumulative Summary{unit ? ` (${unit})` : ''} {activeView === 'cumulative' ? '▾' : ''}</Text>
              <Text style={[styles.volumeCardValue, { color: isDark ? '#60A5FA' : '#2563EB' }]} numberOfLines={1}>{cumulativeVol.toFixed(2)}</Text>
            </View>
            <View style={[styles.volumeCardIconWrapper, { backgroundColor: activeView === 'cumulative' ? (isDark ? '#1E3A8A' : '#BFDBFE') : (isDark ? '#172554' : '#DBEAFE') }]}>
              <BarChart3 size={15} color={isDark ? '#60A5FA' : '#2563EB'} />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {activeView && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>{groupName} — {activeView === 'today' ? 'Today\'s' : 'Cumulative'} Entries</Text>
            <TouchableOpacity onPress={() => setActiveView(null)} style={{ padding: 4 }}><X size={20} color={theme.subtext} /></TouchableOpacity>
          </View>
          {summaryLoading ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ padding: 20 }} />
          ) : (
            <GroupSummaryList data={summaryData} onDeleteRow={editMode ? confirmDelete : undefined} configChildren={configChildren} styles={styles} theme={theme} />
          )}
        </View>
      )}
      <AlertComponent />
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GroupSection Component
// ─────────────────────────────────────────────────────────────────────────────
const GroupSection = ({
  attr, entries, editMode, featureId, layerId, onAddEntry, onDeleteEntry, onEntryDeleted, disabled, disabledReason, onPhotoCountChange, styles, theme, isDark, parentLengthLimit, onRequestCloseSheet, onRequestReopenSheet, onLengthExceeded, skipMandatoryValidation, stampImageWithLocation, processImage
}: any) => {
  const children = attr.group?.children || [];
  const [draft, setDraft] = useState<GroupEntryState>(() => emptyEntry(children));
  const [showTable, setShowTable] = useState(false);
  
  useEffect(() => { if (editMode) setShowTable(false); }, [editMode]);

  const sortedChildren = [...children].sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

  useEffect(() => {
    const vals: Record<string, string> = {};
    children.forEach((c: any) => { vals[c.name] = String(draft[c.name] ?? ""); });
    let changed = false;
    const updated = { ...draft };
    children.forEach((c: any) => {
      const type = normalizeInputType(c.input_type);
      if (type === "Calculated" && c.formula) {
        const r = evalFormula(c.formula, vals);
        if (updated[c.name] !== r) { updated[c.name] = r; changed = true; }
      }
    });
    if (changed) setDraft(updated);
  }, [JSON.stringify(draft)]);

  const volumeChild = children.find((c: any) => normalizeInputType(c.input_type) === "Calculated");
  const unit = volumeChild?.unit_name || volumeChild?.unit || "";
  const { showAlert, AlertComponent } = useAlert();

  // We always enforce column-level mandatory validation when adding an entry.
  // skipMandatoryValidation only bypasses group-level checks during 'Save'.
  const canAdd = !disabled && children
    .filter((c: any) => c.is_mandatory && normalizeInputType(c.input_type) !== "Calculated")
    .every((c: any) => String(draft[c.name] ?? "").trim() !== "");

  const performAdd = () => {
    onAddEntry({ ...draft });
    setDraft(emptyEntry(children));
    setShowTable(true);
  };

  const handleAdd = () => {
    if (disabled) { showAlert("Warning", disabledReason || "Cannot add entry", "error"); return; }
    if (!canAdd) { showAlert("Validation Error", "Please fill all required fields before adding.", "error"); return; }

    // ── Length-vs-pipeline-length validation ──
    const lengthChild = children.find(
      (c: any) => normalizeInputType(c.input_type) !== "Calculated" && c.name.toLowerCase().includes("length")
    );

    if (lengthChild && parentLengthLimit !== undefined && parentLengthLimit !== null && !isNaN(parentLengthLimit)) {
      // Find the group-by child (e.g. Strata Type or TYPE)
      const groupByChild =
        (children as any[]).find((c: any) => c.is_group_by) ??
        children.find((c: any) => normalizeInputType(c.input_type) === 'Dropdown');

      const draftGroupValue = groupByChild ? String(draft[groupByChild.name] ?? "") : null;

      const existingTotal = entries.reduce((sum: number, e: any) => {
        // If there's a group-by child, only include entries with the same selected type
        if (groupByChild && String(e[groupByChild.name] ?? "") !== draftGroupValue) {
          return sum;
        }
        const v = parseFloat(String(e[lengthChild.name] ?? "0"));
        return sum + (isNaN(v) ? 0 : v);
      }, 0);
      const newVal = parseFloat(String(draft[lengthChild.name] ?? "0")) || 0;
      const newTotal = existingTotal + newVal;

      if (newTotal > parentLengthLimit) {
        // Hand this off to the PARENT (DashboardMapView) — its showAlert/AlertComponent
        // lives outside the BottomSheet, so it survives the sheet closing.
        if (onLengthExceeded) {
          onLengthExceeded(newTotal, parentLengthLimit, () => performAdd());
        } else {
          // Fallback: still perform the add if no handler was wired up
          performAdd();
        }
        return;
      }
    }

    performAdd();
  };

  const newEntries = entries.filter((e: any) =>
    e.__group_data_id === undefined && children.some((c: any) => String(e[c.name] ?? "").trim() !== "")
  );

  const todayTotal = newEntries.reduce((sum: number, e: any) => {
    const v = volumeChild ? parseFloat(String(e[volumeChild.name] ?? "0")) : 0;
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const visibleEntries = editMode
    ? newEntries
    : entries.filter((e: any) => children.some((c: any) => String(e[c.name] ?? "").trim() !== ""));

  return (
    <View style={styles.groupSection}>
      {volumeChild && (
        <VolumeCards
          todayVol={attr.group?.today_volume || 0}
          cumulativeVol={attr.group?.cumulative_volume || 0}
          unit={unit}
          featureId={featureId}
          attrId={attr.attribute_id}
          groupName={attr.group?.group_name || attr.name}
          editMode={editMode}
          showTodayVolume={attr.group?.show_today_volume ?? true}
          showCumulativeVolume={attr.group?.show_cumulative_volume ?? true}
          onEntryDeleted={onEntryDeleted}
          configChildren={children}
          styles={styles}
          theme={theme}
          isDark={isDark}
        />
      )}

      {disabled && disabledReason && (
        <View style={styles.warningBanner}>
          <AlertTriangle size={18} color={isDark ? "#FCD34D" : "#B45309"} />
          <Text style={styles.warningText}>{disabledReason}</Text>
        </View>
      )}

      {editMode && (
        <View style={[styles.addFormContainer, disabled && { opacity: 0.4 }]} pointerEvents={disabled ? "none" : "auto"}>
          <Text style={styles.addFormTitle}>Add {attr.group?.group_name || attr.name}</Text>
          <View style={styles.addFormGrid}>
            {sortedChildren.filter(c => normalizeInputType(c.input_type) !== "Calculated").map((c) => {
              const type = normalizeInputType(c.input_type);
              const opts = c.possible_values ? c.possible_values.split(",").map((v: string) => v.trim()).filter(Boolean) : [];
              const val = String(draft[c.name] ?? "");
              const label = `${c.name}${c.unit_name ? ` (${c.unit_name})` : ""}`;
              return (
                <View key={c.child_id} style={styles.inputWrapper}>
                  <Text style={styles.label}>
                    {label}{c.is_mandatory && <Text style={{ color: '#EF4444' }}> *</Text>}
                  </Text>
                  {type === "Dropdown" ? (
                    <CustomDropdown 
                      value={val} 
                      options={opts} 
                      onSelect={(v: string) => setDraft(p => ({ ...p, [c.name]: v }))} 
                      placeholder={`Select ${c.name}`} 
                      disabled={disabled}
                      styles={styles}
                      theme={theme}
                    />
                  ) : type === "Boolean" ? (
                    <RadioButtonGroup
                      value={val}
                      options={opts}
                      onSelect={(v: string) => setDraft(p => ({ ...p, [c.name]: v }))}
                      disabled={disabled}
                      styles={styles}
                    />
                  ) : (
                    <TextInput
                      style={[styles.input, disabled && styles.disabledInput]}
                      value={val}
                      placeholder={`Enter ${c.name.toLowerCase()}`}
                      placeholderTextColor={theme.inputPlaceholder}
                      onChangeText={(t) => setDraft(p => ({ ...p, [c.name]: t }))}
                      keyboardType={type === "Number" ? "numeric" : "default"}
                      editable={!disabled}
                    />
                  )}
                </View>
              );
            })}
            
            {volumeChild && (
              <View style={[styles.inputWrapper, { justifyContent: 'flex-end', paddingBottom: 10 }]}>
                <Text style={styles.label}>Volume{unit ? ` (${unit})` : ''}</Text>
                <Text style={styles.volumeCalcText}>{Number(draft[volumeChild.name] || 0).toFixed(2)}</Text>
              </View>
            )}
          </View>
          
          <TouchableOpacity style={[styles.addButton, (disabled || !canAdd) && styles.addButtonDisabled]} onPress={handleAdd} disabled={disabled || !canAdd}>
            <Text style={styles.addButtonText}>Add / Save</Text>
          </TouchableOpacity>


        </View>
      )}

      {visibleEntries.length > 0 && (
        <>
          {(!volumeChild && showTable) && (
            <View style={styles.summaryContainer}>
               <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>{attr.group?.group_name || attr.name} — Today's Entries</Text>
                {!editMode && <TouchableOpacity onPress={() => setShowTable(false)} style={{ padding: 4 }}><X size={20} color={theme.subtext} /></TouchableOpacity>}
              </View>
              
              <View style={styles.cardListContainer}>
                {visibleEntries.map((row: any, displayIdx: number) => {
                  const realIdx = entries.indexOf(row);
                  return (
                    <View key={displayIdx} style={styles.entryCard}>
                      <View style={styles.entryCardHeader}>
                        <Text style={styles.entryCardIndex}>Entry #{displayIdx + 1}</Text>
                        <View style={styles.entryCardHeaderRight}>
                          <Text style={styles.entryCardDate}>{formatDate(row.__created_at)}</Text>
                          {editMode && (
                            <TouchableOpacity style={styles.deleteButtonSmall} onPress={() => onDeleteEntry(realIdx)}>
                              <Trash2 size={16} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <View style={styles.entryCardBody}>
                        {sortedChildren.map(c => {
                          const raw = String(row[c.name] ?? "");
                          const num = parseFloat(raw);
                          const display = raw === "" ? "-" : (!isNaN(num) ? num.toFixed(2) : raw);
                          const childLabel = c.unit_name ? `${c.name} (${c.unit_name})` : c.name;
                          return (
                            <View key={c.child_id} style={styles.entryKeyValue}>
                              <Text style={styles.entryKey}>{childLabel}</Text>
                              <Text style={styles.entryValue}>{display}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {!volumeChild && !showTable && !editMode && (
            <TouchableOpacity onPress={() => setShowTable(true)} style={{ marginVertical: 12 }}>
              <Text style={styles.showEntriesText}>Show entries ({visibleEntries.length})</Text>
            </TouchableOpacity>
          )}

          {(volumeChild && showTable) && (
            <View style={styles.summaryContainer}>
              <View style={styles.cardListContainer}>
                {visibleEntries.map((row: any, displayIdx: number) => {
                  const realIdx = entries.indexOf(row);
                  return (
                    <View key={displayIdx} style={styles.entryCard}>
                      <View style={styles.entryCardHeader}>
                        <Text style={styles.entryCardIndex}>Entry #{displayIdx + 1}</Text>
                        <View style={styles.entryCardHeaderRight}>
                          <Text style={styles.entryCardDate}>{formatDate(row.__created_at)}</Text>
                          {editMode && (
                            <TouchableOpacity style={styles.deleteButtonSmall} onPress={() => onDeleteEntry(realIdx)}>
                              <Trash2 size={16} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <View style={styles.entryCardBody}>
                        {sortedChildren.map(c => {
                          const raw = String(row[c.name] ?? "");
                          const num = parseFloat(raw);
                          const display = raw === "" ? "-" : (!isNaN(num) ? num.toFixed(2) : raw);
                          const childLabel = c.unit_name ? `${c.name} (${c.unit_name})` : c.name;
                          return (
                            <View key={c.child_id} style={styles.entryKeyValue}>
                              <Text style={styles.entryKey}>{childLabel}</Text>
                              <Text style={styles.entryValue}>{display}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
                <View style={[styles.entryCard, styles.totalsCard]}>
                  <Text style={styles.totalsHeader}>Total Volume</Text>
                  <Text style={[styles.entryValue, styles.totalValueText]}>{todayTotal.toFixed(2)} {unit}</Text>
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {editMode && visibleEntries.length === 0 && (
        <Text style={styles.emptyEntriesText}>No entries yet. Use the form above to add entries.</Text>
      )}

      {/* ── Photo Section — visible in both edit & view mode ── */}
      {!!(attr.group?.is_photo_required || (attr.group?.image_count && attr.group.image_count > 0)) && (
        <View style={{
          marginTop: 12,
          borderTopWidth: 1,
          borderTopColor: isDark ? '#2E3147' : '#E2E8F0',
          paddingTop: 12,
        }}>
          <Text style={[styles.label, { marginBottom: 8, fontWeight: '600' }]}>
            {attr.group?.group_name || attr.name} — Photo
            {attr.group?.is_photo_required && <Text style={{ color: '#EF4444' }}> *</Text>}
          </Text>
          <PhotoUploader
            featureId={featureId}
            attributeId={attr.attribute_id}
            layerId={layerId}
            imageCount={attr.group?.image_count || 0}
            isRequired={!!attr.group?.is_photo_required}
            editMode={editMode}
            disabled={disabled}
            onCountChange={(count: number) => onPhotoCountChange?.(null, count)}
            stampImageWithLocation={stampImageWithLocation}
            processImage={processImage}
          />
        </View>
      )}


      <AlertComponent />
    </View>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// Main DynamicAttributePanel Component
// ─────────────────────────────────────────────────────────────────────────────
export interface DynamicAttributePanelProps {
  featureId: number;
  layerId: number;
  isVerified?: boolean;
  externalEditMode?: boolean;
  onSaveComplete?: () => void;
  parentLengthLimit?: number;
  onRequestCloseSheet?: () => void;  
  /** When true, mandatory field validation is skipped (e.g. pipeline On Going status). */
  skipMandatoryValidation?: boolean;
  /** When true, all attributes are treated as mandatory regardless of API config (e.g. pipeline Complete status). */
  forceAllMandatory?: boolean;
  stampImageWithLocation?: (uri: string) => Promise<string>; 
  processImage?: (uri: string) => Promise<{ uri: string }>;
}

export interface DynamicAttributePanelRef {
  triggerSave: () => Promise<void>;
  /** Returns the max effective length across all groups (using group_by/Dropdown grouping).
   *  Matches the web's getMaxGroupLength implementation exactly. */
  getMaxGroupLength: () => number;
  /** Returns true if the configuration contains at least one group attribute */
  hasGroupAttributes: () => boolean;
}

const DynamicAttributePanel = forwardRef(({
  featureId, layerId, isVerified = false, externalEditMode, onSaveComplete, parentLengthLimit, onRequestCloseSheet, onRequestReopenSheet, onLengthExceeded, skipMandatoryValidation = false, forceAllMandatory = false, stampImageWithLocation, processImage
}: DynamicAttributePanelProps, ref: React.Ref<DynamicAttributePanelRef>) => {
  const { token, hasWriteAccess } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const { theme, isDark } = useTheme();
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const setPhotoCount = useCallback((key: string, count: number) => {
    setPhotoCounts(prev => (prev[key] === count ? prev : { ...prev, [key]: count }));
  }, []);
  const styles = getStyles(theme, isDark);
  
  const [config, setConfig] = useState<AttributeConfig[]>([]);
  const [formData, setFormData] = useState<FormDataState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Always-current refs — used by useImperativeHandle closures to avoid stale state
  // (mirrors the web implementation)
  const savedValuesRef = useRef<{ simple_values: any[]; group_entries: any[] }>({ simple_values: [], group_entries: [] });
  const configRef = useRef<AttributeConfig[]>([]);

  const activeEditMode = (externalEditMode !== undefined ? externalEditMode : false) && hasWriteAccess("DASHBOARD_DYNAMIC_ATTRIBUTES");

  const loadData = useCallback(async () => {
    if (!token || !featureId || !layerId) return;
    setLoading(true);
    try {
      const res = await getFeatureDataForm(layerId, featureId, token);
      
      const fd: FormDataState = {};
      const attrs = res.attributes || [];
      
      attrs.sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

      attrs.forEach(attr => {
        if (attr.attribute_type === "simple") {
          const sv = res.saved_values?.simple_values?.find(v => v.attribute_id === attr.attribute_id);
          // Only take saved values, or default to empty string
          fd[attr.attribute_id] = sv ? String(sv.value_num ?? sv.value_text ?? "") : "";
        } else {
          const entries = res.saved_values?.group_entries?.filter(e => e.attribute_id === attr.attribute_id) || [];
          if (entries.length === 0) {
            fd[attr.attribute_id] = attr.group?.allow_multiple ? [] : [emptyEntry(attr.group?.children || [])];
          } else {
            const sorted = [...entries].sort((a, b) => a.entry_index - b.entry_index);
            fd[attr.attribute_id] = sorted.map(entry => {
              const row: GroupEntryState = {};
              (attr.group?.children || []).forEach(child => {
                const cv = entry.children.find(c => c.child_id === child.child_id);
                row[child.name] = cv ? String(cv.value_num ?? cv.value_text ?? "") : "";
                row.__group_data_id = entry.group_data_id;
              });
              if (entry.created_at) row.__created_at = entry.created_at;
              return row;
            });
          }
        }
      });
      
      setConfig(attrs);
      setFormData(fd);
      // Keep refs current so useImperativeHandle always reads latest saved data
      configRef.current = attrs;
      savedValuesRef.current = res.saved_values ?? { simple_values: [], group_entries: [] };
    } catch (err) {
      console.error(err);
      showAlert("Error", "Failed to load field data.", "error");
    } finally {
      setLoading(false);
    }
  }, [featureId, layerId, token]);

  useEffect(() => { loadData(); }, [loadData]);

  const checkDependency = (attr: AttributeConfig): { met: boolean; reason?: string } => {
    if (!attr.depends_on_id) return { met: true };
    const parentAttr = config.find(a => a.attribute_id === attr.depends_on_id);
    if (!parentAttr) return { met: true };

    if (parentAttr.attribute_type === "simple") {
      const parentVal = String(formData[parentAttr.attribute_id] ?? "").trim();
      const parentType = normalizeInputType(parentAttr.input_type_name);

      // ── Yes / No gate ──────────────────────────────────────────────────────
      // Applies when:
      //   • the input is a Dropdown / ENUM whose possible_values includes "yes"  OR
      //   • the input is a Boolean type  OR
      //   • the raw possible_values explicitly contains "no" (handles Yes,No lists)
      const possibleLower = (parentAttr.possible_values ?? "").toLowerCase();
      const isYesNoField =
        (parentType === "Dropdown" || parentType === "Boolean") &&
        possibleLower.includes("yes");

      if (isYesNoField) {
        const valLower = parentVal.toLowerCase();
        // "yes" enables; everything else (blank, "no", any other choice) disables
        if (valLower === "yes") return { met: true };
        if (valLower === "" ) return { met: false, reason: `Requires "${parentAttr.name}" to be answered` };
        return { met: false, reason: `Requires "${parentAttr.name}" to be Yes` };
      }

      // ── Numeric gate ───────────────────────────────────────────────────────
      // If the field stores a number, enable when the value is >= 1.
      if (parentType === "Number") {
        const num = parseFloat(parentVal);
        if (isNaN(num) || num < 1) {
          return { met: false, reason: `Requires "${parentAttr.name}" to be at least 1` };
        }
        return { met: true };
      }

      // ── Generic "must be filled" gate ─────────────────────────────────────
      if (parentVal === "") {
        return { met: false, reason: `Requires "${parentAttr.name}" to be filled first` };
      }
      return { met: true };

    } else {
      // ── Group parent: at least one saved or drafted entry required ─────────
      const parentEntries = (formData[parentAttr.attribute_id] as GroupEntryState[]) || [];
      const hasValidEntry = parentEntries.some(e => {
        if (e.__group_data_id) return true;
        return (parentAttr.group?.children || []).some(c => {
           if (normalizeInputType(c.input_type) === "Calculated") return false;
           return String(e[c.name] ?? "").trim() !== "";
        });
      });
      if (!hasValidEntry) return { met: false, reason: `Requires at least one entry in "${parentAttr.group?.group_name || parentAttr.name}"` };
      return { met: true };
    }
  };


  const doSave = async () => {
    if (config.length === 0 || !token) return;
    setSaving(true);
    try {
      const simple_values: any[] = [];
      const group_entries: any[] = [];
      
      for (const attr of config) {
        const dep = checkDependency(attr);

        if (attr.attribute_type === "simple") {
          const raw = String(formData[attr.attribute_id] ?? "");

          // ── Completed-status (forceAllMandatory) validation ────────────────
          // Only validate attributes that are explicitly mandatory in their config.
          // Non-mandatory attributes are completely bypassed.
          if (!skipMandatoryValidation && forceAllMandatory && dep.met && attr.is_mandatory) {
            // Boolean Yes-No fields (radio buttons only, NOT dropdowns): value MUST be "Yes"
            const attrType = normalizeInputType(attr.input_type_name);
            const possibleLower = (attr.possible_values ?? "").toLowerCase();
            const isYesNoField =
              attrType === "Boolean" ||
              (attrType === "Text" && possibleLower.includes("yes") && possibleLower.includes("no"));

            if (isYesNoField) {
              const valLower = raw.trim().toLowerCase();
              if (valLower !== "yes" && valLower !== "true" && valLower !== "1") {
                showAlert(
                  "Validation Error",
                  `"${attr.name}" must be set to "Yes" when status is Completed.`,
                  'error'
                );
                throw new Error(`Validation failed for ${attr.name}`);
              }
            } else if (raw.trim() === "") {
              // Non-boolean mandatory simple attribute must have a value
              showAlert("Validation Error", `Please enter a value for "${attr.name}".`, 'error');
              throw new Error(`Validation failed for ${attr.name}`);
            }
          }

          // ── Regular mandatory validation (non-forceAllMandatory) ───────────
          if (!skipMandatoryValidation && !forceAllMandatory && dep.met && attr.is_mandatory && raw.trim() === "") {
            showAlert("Validation Error", `Please enter a value for ${attr.name}.`,'error');
            throw new Error(`Validation failed for ${attr.name}`);
          }

          // Photo validation: mandatory if the field has a value, OR if it's strictly mandatory for the status
          if (attr.is_photo_required && (raw.trim() !== "" || !skipMandatoryValidation)) {
            const count = photoCounts[String(attr.attribute_id)] ?? (attr.image_count || 0);
            if (count === 0) {
              showAlert("Validation Error", `Please attach a required photo for ${attr.name}.`, 'error');
              throw new Error(`Validation failed for ${attr.name} photo`);
            }
          }
          const isNum = normalizeInputType(attr.input_type_name) === "Number";
          simple_values.push({
            attribute_id: attr.attribute_id,
            value_num: isNum && raw !== "" ? Number(raw) : null,
            value_text: !isNum ? raw : null,
          });
        } else {
          const entries = (formData[attr.attribute_id] as GroupEntryState[]) || [];

          // For Completed status: group is mandatory if attr.is_mandatory OR any child is mandatory
          const hasMandatoryChild = (attr.group?.children || []).some((c: any) => c.is_mandatory);
          const isGroupMandatory = dep.met && (
            forceAllMandatory
              ? (attr.is_mandatory || hasMandatoryChild)
              : attr.is_mandatory
          );
          
          const validEntries = entries.filter(e => {
            if (e.__group_data_id) return true;
            return (attr.group?.children || []).some(c => {
               if (normalizeInputType(c.input_type) === "Calculated") return false;
               return String(e[c.name] ?? "").trim() !== "";
            });
          });

          if (!skipMandatoryValidation && isGroupMandatory && validEntries.length === 0) {
            showAlert("Validation Error", `Please save at least one entry for "${attr.group?.group_name || attr.name}" before proceeding.`,'error');
            throw new Error(`Validation failed for ${attr.name}`);
          }
          
          // Photo validation: mandatory if the group has entries, OR if it's strictly mandatory for the status
          if (attr.group?.is_photo_required && (validEntries.length > 0 || !skipMandatoryValidation)) {
            const count = photoCounts[String(attr.attribute_id)] ?? 0;
            if (count === 0) {
              showAlert(
                "Validation Error",
                `Please attach a required photo for "${attr.group?.group_name || attr.name}".`,
                'error'
              );
              throw new Error(`Validation failed for ${attr.name} photo`);
            }
          }
          validEntries.forEach((entry, idx) => {
            const children = (attr.group?.children || []).map(child => {
              const raw = String(entry[child.name] ?? "");
              const isCalc = normalizeInputType(child.input_type) === "Calculated";
              const isNum = normalizeInputType(child.input_type) === "Number" || isCalc;
              return {
                child_id: child.child_id,
                value_num: isNum && raw !== "" ? Number(raw) : null,
                value_text: !isNum && raw !== "" ? raw : null,
                is_calculated: isCalc,
              };
            });
            group_entries.push({
              attribute_id: attr.attribute_id,
              entry_index: idx + 1,
              children
            });
          });
        }
      }

      const payload: SubmitPayload = { feature_id: featureId, layer_id: layerId, simple_values, group_entries };
      await submitFeatureData(payload, token);
      
      await loadData();
      if (onSaveComplete) onSaveComplete();
    } catch (err) {
      console.error(err);
      if (!(err instanceof Error && err.message.startsWith("Validation failed"))) {
        showAlert("Error", "Failed to save field data.", "error");
      }
      throw err;
    } finally {
      setSaving(false);
    }
  };

  useImperativeHandle(ref, () => ({
    triggerSave: async () => { await doSave(); },
    /**
     * Mirrors web DynamicAttributePanel.getMaxGroupLength() exactly:
     * - Uses savedValuesRef (raw API group_entries — never stale)
     * - Finds a Length child: Number type whose name starts with "l"
     * - Finds a groupByChild: child flagged is_group_by OR first Dropdown child
     * - If groupByChild: sums lengths per group value, returns max across groups
     * - If no groupByChild: sums all lengths for that attribute
     * - Returns the max across ALL group attributes (0 if none)
     */
    getMaxGroupLength: (): number => {
      const currentConfig = configRef.current;
      const currentSaved = savedValuesRef.current;
      let maxLen = 0;

      currentConfig
        .filter((a) => a.attribute_type === 'group')
        .forEach((a) => {
          const attrId = a.attribute_id;
          const children = a.group?.children || [];

          // Match any Number child whose name starts with "l" (length, Length, len, etc.)
          const lengthChild = children.find(
            (c) => normalizeInputType(c.input_type) === 'Number' && c.name.toLowerCase().startsWith('l')
          );
          if (!lengthChild) return;

          // Prefer explicitly marked group_by child; fall back to first Dropdown child
          const groupByChild =
            (children as any[]).find((c: any) => c.is_group_by) ??
            children.find((c) => normalizeInputType(c.input_type) === 'Dropdown');

          const savedEntries = (currentSaved.group_entries || []).filter(
            (e: any) => e.attribute_id === attrId
          );
          if (savedEntries.length === 0) return;

          let grpMax = 0;

          if (groupByChild) {
            const groupByChildId = groupByChild.child_id;
            const lengthChildId = lengthChild.child_id;
            const sumByGroup: Record<string, number> = {};

            savedEntries.forEach((entry: any) => {
              const gbCell = (entry.children || []).find((c: any) => c.child_id === groupByChildId);
              const lenCell = (entry.children || []).find((c: any) => c.child_id === lengthChildId);
              const gv: string = gbCell?.value_text ?? '__none__';
              const v = Number(lenCell?.value_num ?? parseFloat(lenCell?.value_text ?? '0'));
              sumByGroup[gv] = (sumByGroup[gv] ?? 0) + (isNaN(v) ? 0 : v);
            });

            const vals = Object.values(sumByGroup);
            grpMax = vals.length > 0 ? Math.max(...vals) : 0;
          } else {
            const lengthChildId = lengthChild.child_id;
            grpMax = savedEntries.reduce((sum: number, entry: any) => {
              const lenCell = (entry.children || []).find((c: any) => c.child_id === lengthChildId);
              const v = Number(lenCell?.value_num ?? parseFloat(lenCell?.value_text ?? '0'));
              return sum + (isNaN(v) ? 0 : v);
            }, 0);
          }

          if (grpMax > maxLen) maxLen = grpMax;
        });

      return maxLen;
    },
    hasGroupAttributes: (): boolean => {
      return configRef.current.some(a => a.attribute_type === 'group');
    },
  }));

  if (loading) {
    return <ActivityIndicator size="large" color={theme.primary} style={{ padding: 40 }} />;
  }
  
  if (config.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Dynamic Attributes</Text>
      
      <View style={styles.card}>
        {config.map((attr, idx) => {
          const dep = checkDependency(attr);
          // Always show all attributes — just disable them when the dependency is not met.

          if (attr.attribute_type === "simple") {
            const type = normalizeInputType(attr.input_type_name);
            const isDrop = type === "Dropdown";
            const isBoolean = type === "Boolean";
            const opts = attr.possible_values ? attr.possible_values.split(",").map(v => v.trim()).filter(Boolean) : [];
            const val = String(formData[attr.attribute_id] ?? "");
            
            return (
              <View key={attr.attribute_id} style={[styles.simpleFieldRow, idx === config.length - 1 && { borderBottomWidth: 0 }, !dep.met && { opacity: 0.6 }]}>
                <View style={styles.simpleFieldLabelCol}>
                  <Text style={styles.label}>{idx + 1}. {attr.name}{attr.is_mandatory && <Text style={{color: '#EF4444'}}> *</Text>}</Text>
                  {!!attr.question && <Text style={styles.questionText}>{attr.question}</Text>}
                  {!dep.met && <Text style={{ fontSize: 11, color: '#B45309' }}>{dep.reason}</Text>}
                </View>
                <View style={styles.simpleFieldInputCol}>
                  {activeEditMode && !isVerified ? (
                    isBoolean ? (
                      <RadioButtonGroup
                        value={val}
                        options={opts}
                        onSelect={(v: string) => setFormData(p => ({ ...p, [attr.attribute_id]: v }))}
                        disabled={!dep.met}
                        styles={styles}
                      />
                    ) : isDrop ? (
                      <CustomDropdown 
                        value={val} 
                        options={opts} 
                        onSelect={(v: string) => setFormData(p => ({ ...p, [attr.attribute_id]: v }))} 
                        placeholder={`Select ${attr.name}`}
                        disabled={!dep.met}
                        styles={styles}
                        theme={theme}
                      />
                    ) : (
                      <TextInput
                        style={[styles.input, !dep.met && styles.disabledInput]}
                        value={val}
                        onChangeText={(t) => setFormData(p => ({ ...p, [attr.attribute_id]: t }))}
                        keyboardType={type === "Number" ? "numeric" : "default"}
                        placeholder={`Enter ${attr.name}`}
                        placeholderTextColor={theme.inputPlaceholder}
                        editable={dep.met}
                      />
                    )
                  ) : (
                    <Text style={styles.readonlyValue}>{val || '-'}</Text>
                  )}
                  {!!(attr.is_photo_required || (attr.image_count && attr.image_count > 0)) && (
                    <PhotoUploader
                      featureId={featureId}
                      attributeId={attr.attribute_id}
                      layerId={layerId}
                      imageCount={attr.image_count || 0}
                      isRequired={attr.is_photo_required}
                      editMode={activeEditMode && !isVerified}
                      disabled={!dep.met}
                      onCountChange={(count) => setPhotoCount(String(attr.attribute_id), count)}
                      stampImageWithLocation={stampImageWithLocation}  
                      processImage={processImage}
                    />
                  )}
                </View>
              </View>
            );
          }
          
          return (
            <View key={attr.attribute_id} style={styles.groupWrapper}>
              <View style={styles.groupHeader}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.groupTitle, { marginRight: 0 }]}>{idx + 1}. {attr.group?.group_name || attr.name}</Text>
                  {!!attr.question && <Text style={styles.questionText}>{attr.question}</Text>}
                </View>
                {!!attr.group?.applicable_to && <View style={styles.badge}><Text style={styles.badgeText}>{attr.group.applicable_to}</Text></View>}
              </View>
              <GroupSection
                attr={attr}
                entries={(formData[attr.attribute_id] as GroupEntryState[]) || []}
                editMode={activeEditMode && !isVerified}
                featureId={featureId}
                layerId={layerId}
                disabled={!dep.met}
                disabledReason={dep.reason}
                onRequestCloseSheet={onRequestCloseSheet}
                onRequestReopenSheet={onRequestReopenSheet}
                parentLengthLimit={parentLengthLimit}
                onLengthExceeded={onLengthExceeded}
                skipMandatoryValidation={skipMandatoryValidation} 
                stampImageWithLocation={stampImageWithLocation}  
                processImage={processImage}
                onAddEntry={(entry: GroupEntryState) => {
                  setFormData(prev => {
                    const current = (prev[attr.attribute_id] as GroupEntryState[]) || [];
                    const filtered = current.filter(e => Object.entries(e).some(([k, v]) => !k.startsWith("__") && String(v ?? "").trim() !== ""));
                    return { ...prev, [attr.attribute_id]: [...filtered, entry] };
                  });
                }}
                onDeleteEntry={(idx: number) => {
                  setFormData(prev => {
                    const updated = [...((prev[attr.attribute_id] as GroupEntryState[]) || [])];
                    updated.splice(idx, 1);
                    return { ...prev, [attr.attribute_id]: updated };
                  });
                }}
                onEntryDeleted={async (id: number) => {
                  setFormData(prev => {
                    const updated = { ...prev };
                    if (updated[attr.attribute_id]) {
                      updated[attr.attribute_id] = (updated[attr.attribute_id] as GroupEntryState[]).filter(e => e.__group_data_id !== id);
                    }
                    return updated;
                  });
                  if (token) {
                    try {
                      const res = await getFeatureDataForm(layerId, featureId, token);
                      if (res.attributes) {
                        setConfig(res.attributes.sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999)));
                      }
                    } catch (e) {
                      console.error("Failed to refresh config after delete", e);
                    }
                  }
                }}
                 onPhotoCountChange={(childId: number | null, count: number) =>
                    setPhotoCount(childId === null ? String(attr.attribute_id) : `${attr.attribute_id}_${childId}`, count)}  
                styles={styles}
                theme={theme}
                isDark={isDark}
              />
            </View>
          );
        })}
      </View>
       <AlertComponent />
    </View>
  );
});

const getStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.text, marginBottom: 12, marginLeft: 4 },
  card: { 
    backgroundColor: theme.cardColor, 
    borderRadius: 16, 
    padding: 16, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3, 
    marginBottom: 16 
  },
  
  // Simple fields
  simpleFieldRow: { flexDirection: 'column', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  simpleFieldLabelCol: { marginBottom: 8 },
  simpleFieldInputCol: { width: '100%' },
  label: { fontSize: 14, fontWeight: '500', color: theme.subtext, marginBottom: 4 },
  input: { 
    backgroundColor: '#ffffff', 
    borderWidth: 1, 
    borderColor: theme.inputBorder, 
    borderRadius: 12, 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    fontSize: 16, 
    color: theme.inputText,
    minHeight: 48 
  },
  disabledInput: { backgroundColor: isDark ? '#374151' : '#E2E8F0', color: theme.textMuted, opacity: 0.5, borderColor: isDark ? '#4B5563' : '#CBD5E1' },
  readonlyValue: { fontSize: 16, color: theme.text, paddingVertical: 4, fontWeight: '500' },
  
  // Custom Dropdown
  dropdownInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputText: { color: theme.inputText, fontSize: 16 },
  placeholderText: { color: theme.inputPlaceholder, fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surface2, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: theme.text },
  dropdownOption: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: theme.border },
  dropdownOptionText: { fontSize: 16, color: theme.text },

  // Radio Button Group (Boolean fields)
  radioGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 20, paddingVertical: 6 },
  radioOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.inputBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: { borderColor: theme.primary },
  radioCircleDisabled: { borderColor: isDark ? '#4B5563' : '#D1D5DB', opacity: 0.6 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.primary },
  radioLabel: { fontSize: 15, color: theme.text, fontWeight: '500' },
  radioLabelDisabled: { color: theme.textMuted },
  
  // Group fields
  groupWrapper: { marginTop: 20, padding: 16, backgroundColor: theme.surface2, borderRadius: 16, borderWidth: 1, borderColor: theme.border },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' },
  groupTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginRight: 12 },
  questionText: { fontSize: 13, color: theme.subtext, marginTop: 4, fontStyle: 'italic' },
  badge: { backgroundColor: isDark ? '#451A03' : '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16 },
  badgeText: { fontSize: 11, fontWeight: '700', color: isDark ? '#FCD34D' : '#D97706' },
  
  groupSection: { flex: 1 },
  addFormContainer: { backgroundColor: theme.cardColor, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16 },
  addFormTitle: { fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 12 },
  addFormGrid: { flexDirection: 'column', gap: 12 },
  inputWrapper: { width: '100%', marginBottom: 4 },
  volumeCalcText: { fontSize: 18, fontWeight: '700', color: isDark ? '#60A5FA' : '#2563EB', paddingTop: 4 },
  addButton: { backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 12, shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 2 },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  photoUploadersRow: { flexDirection: 'column', marginTop: 16 },
  
  // Volume Cards
  volumeCardsContainer: { marginBottom: 20 },
  volumeCardsRow: { flexDirection: 'row', gap: 12 },
  volumeCard: { flex: 1, backgroundColor: theme.cardColor, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  volumeCardActiveGreen: { borderColor: isDark ? '#4ADE80' : '#22C55E', backgroundColor: isDark ? '#022C22' : '#F0FDF4' },
  volumeCardActiveBlue: { borderColor: isDark ? '#60A5FA' : '#3B82F6', backgroundColor: isDark ? '#172554' : '#EFF6FF' },
  volumeCardTitle: { fontSize: 11, color: theme.subtext, fontWeight: '600', marginBottom: 4 },
  volumeCardValue: { fontSize: 12, fontWeight: 'bold' },
  volumeCardIconWrapper: { padding: 8, borderRadius: 20 },
  
  // Summaries & Cards (Replaces Tables)
  summaryContainer: { marginTop: 16, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: theme.surface2, borderBottomWidth: 1, borderBottomColor: theme.border },
  summaryTitle: { fontSize: 15, fontWeight: '600', color: theme.text },
  
  cardListContainer: { padding: 12, gap: 12 },
  entryCard: { backgroundColor: theme.cardColor, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  entryCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  entryCardIndex: { fontSize: 14, fontWeight: '700', color: theme.text },
  entryCardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  entryCardDate: { fontSize: 13, color: theme.textMuted },
  deleteButtonSmall: { padding: 6, backgroundColor: isDark ? '#450a0a' : '#FEE2E2', borderRadius: 8 },
  entryCardBody: { flexDirection: 'column', gap: 8 },
  entryKeyValue: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  entryKey: { fontSize: 14, color: theme.subtext, flex: 1, paddingRight: 8 },
  entryValue: { fontSize: 14, color: theme.text, fontWeight: '500', flex: 1, textAlign: 'right' },
  
  totalsCard: { backgroundColor: isDark ? '#1E3A8A' : '#EFF6FF', borderColor: isDark ? '#1E40AF' : '#DBEAFE' },
  totalsHeader: { fontSize: 16, fontWeight: '700', color: isDark ? '#93C5FD' : '#1E40AF', marginBottom: 12, textAlign: 'center' },
  totalValueText: { fontSize: 16, fontWeight: '700', color: isDark ? '#60A5FA' : '#2563EB' },
  
  noEntriesText: { padding: 24, textAlign: 'center', color: theme.subtext, fontSize: 15 },
  emptyEntriesText: { fontSize: 14, color: theme.textMuted, fontStyle: 'italic', marginTop: 12, textAlign: 'center' },
  showEntriesText: { color: theme.primary, fontSize: 15, fontWeight: '600', textAlign: 'center', padding: 8 },
  
  warningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? '#451A03' : '#FFFBEB', padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: isDark ? '#78350F' : '#FEF3C7', gap: 8 },
  warningText: { color: isDark ? '#FCD34D' : '#B45309', fontSize: 13, flex: 1, fontWeight: '500' }
});

export default DynamicAttributePanel;