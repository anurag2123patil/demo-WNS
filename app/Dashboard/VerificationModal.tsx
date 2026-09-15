import React, { useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
  Switch, FlatList, ActivityIndicator, StyleSheet, useWindowDimensions,
  Animated,
} from 'react-native';
import { X, Search, Check, MapPin } from 'lucide-react-native';

const VerificationModal: React.FC<VerificationModalProps> = (props) => {
  const { width, height } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(height)).current;




  const {
    visible, onClose, theme, isDark, isTablet, borderColor, subTextColor, inputBg,
    activeCategory, setActiveCategory, verifSearchQuery, setVerifSearchQuery,
    showVerified, setShowVerified, verificationLayers, verificationFeatures,
    selectedFeatureIds, setSelectedFeatureIds, loadingFeatures, isBulkUpdating,
    handleSelectAllToggle, handleToggleVerifyFeature, highlightClickedFeature,
    loadWFSFeatureMobile, handleBulkUpdate, LAYER_COLORS
  } = props;

  const allSelected = verificationFeatures.length > 0 && selectedFeatureIds.length === verificationFeatures.length;
  useEffect(() => {
    if (activeCategory && verificationLayers.length > 0) {
      // Find the currently selected layer object
      const selectedLayer = verificationLayers.find(
        (layer) => layer.layer_id === activeCategory
      );

      // Update the local features list based on the new category
      // Note: ensure the parent provides a way to update verificationFeatures 
      // or filter them locally if they are all passed down.
      if (selectedLayer) {
        // If verificationFeatures is managed by parent via props, 
        // ensure the parent's setActiveCategory also updates the features list.
      }
    }
  }, [activeCategory, verificationLayers]);
  useEffect(() => {
    // Clear selections whenever the user toggles between Verified and Pending assets
    setSelectedFeatureIds([]);
  }, [showVerified, activeCategory, setSelectedFeatureIds]);
  useEffect(() => {
    if (props.visible) {
      slideAnim.setValue(height);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400, // Fast: 200ms
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [props.visible]);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlayCenter}>
        <Animated.View
          style={[
            styles.verificationModal,
            {
              backgroundColor: theme.cardColor,
              width: isTablet ? 600 : width - 24,
              maxHeight: height * 0.85,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          {/* Header */}
          <View style={[styles.verificationHeader, { borderBottomColor: borderColor }]}>
            <View>
              <Text style={[styles.verificationTitle, { color: theme.text }]}>Feature Verification</Text>
              <Text style={[styles.verificationSubtitle, { color: subTextColor }]}>Verify features and sub-features</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <X size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {/* Categories Tabs */}
          <View style={[styles.tabsContainer, { borderBottomColor: borderColor }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 16 }}>
              {verificationLayers.length > 0 ? (
                verificationLayers.map((layer, index) => {
                  const isActive = activeCategory === layer.layer_id;
                  const assignedColor = LAYER_COLORS[index % LAYER_COLORS.length];
                  return (
                    <TouchableOpacity
                      key={layer.layer_id}
                      onPress={() => { setActiveCategory(layer.layer_id); setVerifSearchQuery(''); }}
                      style={[styles.verifTab, isActive && { borderBottomColor: assignedColor }]}
                    >
                      <View style={[styles.verifTabDot, { backgroundColor: assignedColor }]} />
                      <Text style={[styles.verifTabText, { color: isActive ? (isDark ? '#FFF' : '#000') : subTextColor }, isActive && styles.verifTabTextActive]}>
                        {layer.layer_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 14 }}><Text style={{ color: subTextColor }}>Loading Layers...</Text></View>
              )}
            </ScrollView>
          </View>

          {/* Search Input */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View style={[styles.searchInputWrapper, { backgroundColor: inputBg, borderColor }]}>
              <Search size={18} color={subTextColor} />
              <TextInput
                placeholder="Search by feature name..."
                placeholderTextColor="#8E8E93"
                value={verifSearchQuery}
                onChangeText={setVerifSearchQuery}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {verifSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setVerifSearchQuery('')}><X size={18} color={subTextColor} /></TouchableOpacity>
              )}
            </View>
          </View>

          {/* Verification Toggle */}
          <View style={styles.toggleRow}>
            <Text style={{ color: theme.text, fontWeight: '600' }}>Show Verified Assets</Text>
            <Switch
              value={showVerified}
              onValueChange={(val) => { setShowVerified(val); setVerifSearchQuery(''); }}
              trackColor={{ false: '#E5E7EB', true: '#34D399' }}
              thumbColor={showVerified ? '#10B981' : '#F3F4F6'}
            />
          </View>

          {/* Select All */}
          <View style={[styles.selectAllRow, { backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB', borderBottomColor: borderColor }]}>
            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Select All</Text>
            <TouchableOpacity style={[styles.checkboxBase, allSelected && styles.checkboxChecked]} onPress={() => handleSelectAllToggle(!allSelected)}>
              {allSelected && <Check size={16} color="#FFFFFF" strokeWidth={3} />}
            </TouchableOpacity>
          </View>

          {/* Data List */}
          <FlatList
            data={verificationFeatures
              .filter((item) => Boolean(item.is_verified) === showVerified)
              .filter((item) => {
                if (!verifSearchQuery) return true;
                return item.label?.toLowerCase().includes(verifSearchQuery.toLowerCase()) || item.id?.toString().includes(verifSearchQuery);
              })
            }
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, flexGrow: 1 }}
            ListHeaderComponent={loadingFeatures ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={isDark ? "#FFF" : "#007AFF"} />
                <Text style={{ color: subTextColor, marginTop: 10 }}>Fetching features...</Text>
              </View>
            ) : null}
            // ... inside your FlatList renderItem ...
            renderItem={({ item }) => {
              const isSelected = selectedFeatureIds.includes(item.id);
              const isVerified = Boolean(item.is_verified);

              return (
                <View style={[styles.featureCard, { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF', borderColor }]}>
                  <View style={styles.cardMainRow}>

                    {/* Left: Checkbox & Name */}
                    <View style={styles.nameSection}>
                      <TouchableOpacity
                        style={[styles.checkboxBase, isSelected && styles.checkboxChecked]}
                        onPress={() => {
                          if (!isSelected) setSelectedFeatureIds(prev => [...prev, item.id]);
                          else setSelectedFeatureIds(prev => prev.filter(id => id !== item.id));
                        }}
                      >
                        {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={4} />}
                      </TouchableOpacity>

                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={[styles.featureCardTitle, { color: theme.text }]} numberOfLines={1}>
                          {item.label ?? 'Unnamed Feature'}
                        </Text>
                        <View style={styles.statusIndicator}>
                          <View style={[styles.miniDot, { backgroundColor: isVerified ? '#22C55E' : '#F97316' }]} />
                          <Text style={[styles.statusText, { color: subTextColor }]}>
                            {isVerified ? 'Verified' : 'Pending'}
                          </Text>
                        </View>
                        {isVerified && (
                          <View style={styles.statusIndicator}>
                            {/* <Text style={[styles.statusText, { color: theme.text }]}>
                              Verified Date :
                            </Text> */}
                            <View style={[styles.miniDot, { backgroundColor: isVerified ? '#22C55E' : '#F97316' }]} />

                            <Text style={[styles.statusText, { color: subTextColor }]}>
                              {item.verified_dt}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Right: Action Icons */}
                    <View style={styles.actionIconsRow}>
                      {/* Locate Button */}
                      <TouchableOpacity
                        style={[styles.iconActionBtn, { backgroundColor: '#007AFF' }]}
                        onPress={() => {
                          onClose();
                          const activeLayerObj = verificationLayers.find(l => l.layer_id === activeCategory);
                          const layerAlias = activeLayerObj?.layer_alias || activeLayerObj?.layer_name;
                          if (layerAlias) {
                            highlightClickedFeature(layerAlias, item.id);
                            loadWFSFeatureMobile(layerAlias, item.id);
                          }
                        }}
                      >
                        <MapPin size={18} color="#FFFFFF" />
                      </TouchableOpacity>

                      {/* Verify/Unverify Toggle Button */}
                      <TouchableOpacity
                        style={[styles.iconActionBtn, { backgroundColor: isVerified ? '#DC2626' : '#16A34A' }]}
                        onPress={() => handleToggleVerifyFeature(item)}
                      >
                        {isVerified ? <X size={18} color="#FFFFFF" /> : <Check size={18} color="#FFFFFF" />}
                      </TouchableOpacity>
                    </View>

                  </View>
                </View>
              );
            }}
          />

          {/* Bulk Action */}
          {selectedFeatureIds.length > 0 && (
            <TouchableOpacity
              disabled={isBulkUpdating}
              style={[styles.bulkBtn, { backgroundColor: showVerified ? '#EF4444' : '#10B981' }]}
              onPress={handleBulkUpdate}
            >
              {isBulkUpdating ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                // Dynamic Icon Logic:
                showVerified ? <X size={20} color="#FFF" /> : <Check size={20} color="#FFF" />
              )}
              <Text style={styles.bulkBtnText}>
                {showVerified ? "Unverify Selected" : "Verify Selected"} ({selectedFeatureIds.length})
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};
const styles = StyleSheet.create({
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  verificationModal: { borderRadius: 16, overflow: 'hidden' },
  verificationHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  verificationTitle: { fontSize: 18, fontWeight: '700' },
  verificationSubtitle: { fontSize: 13, marginTop: 2 },
  tabsContainer: { borderBottomWidth: 1 },
  verifTab: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  verifTabDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  verifTabText: { fontSize: 14 },
  verifTabTextActive: { fontWeight: '600' },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  searchInput: { flex: 1, marginLeft: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderBottomWidth: 1 },
  checkboxBase: { width: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderRadius: 6, borderWidth: 2, borderColor: '#10B981' },
  checkboxChecked: { backgroundColor: '#10B981' },
  featureCard: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, elevation: 3 },
  featureCardHeader: { flexDirection: 'row', marginBottom: 12 },
  featureCardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  btnLocate: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 },
  btnTextWhite: { color: '#FFF', fontWeight: '600' },
  badgeOrange: { backgroundColor: '#FFEDD5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 },
  badgeTextOrange: { color: '#C2410C', fontWeight: 'bold', fontSize: 11 },
  statusBadgeSmall: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  btnVerify: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 6, marginTop: 12 },
  bulkBtn: { padding: 14, marginHorizontal: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  bulkBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16, marginLeft: 8 },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
  },
  actionIconsRow: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VerificationModal;