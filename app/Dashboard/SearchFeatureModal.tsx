import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Alert
} from 'react-native';
import { Search, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useAlert } from '@/hooks/useAlert';

interface SearchFeatureModalProps {
  visible: boolean;
  onClose: () => void;
  theme: any;
  borderColor: string;
  subTextColor: string;
  inputBg: string;
  // State from Parent
  layers: any[];
  activeCategory: string | number | null;
  searchFeatures: any[];
  searchQuery: string;
  setSearchQuery: (text: string) => void;
  loadingFeatures: boolean;
  hasMore: boolean;
  page: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  // Dropdown UI States
  dropdown1Open: boolean;
  setDropdown1Open: (val: boolean) => void;
  dropdown1Value: string;
  dropdown1ValueText: string;
  searchClick: boolean;
  setSearchClick: (val: boolean) => void;
  // Actions
  onLayerSelect: (layer: any) => void;
  onFeatureSelect: (dropdown1Value: string, featureId: any) => void;
}

const SearchFeatureModal: React.FC<SearchFeatureModalProps> = (props) => {
  const {
    visible, onClose, theme, borderColor, subTextColor, inputBg,
    layers, activeCategory, searchFeatures, searchQuery, setSearchQuery,
    loadingFeatures, hasMore, setPage,
    dropdown1Open, setDropdown1Open, dropdown1Value, dropdown1ValueText,
    searchClick, setSearchClick,
    onLayerSelect, onFeatureSelect
  } = props;
  const { showAlert, AlertComponent } = useAlert();

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlayCenter}>
            <TouchableWithoutFeedback>
              <View style={[styles.searchModal, { backgroundColor: theme.cardColor }]}>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 16 }}>
                  Search Features
                </Text>

                {/* Layer Selection Dropdown */}
                <TouchableOpacity
                  style={[styles.dropdown, { borderColor }]}
                  onPress={() => {
                    setDropdown1Open(!dropdown1Open);
                    setSearchClick(false);
                  }}
                >
                  <Text style={{ color: theme.text }}>{dropdown1ValueText}</Text>
                  {dropdown1Open ? <ChevronUp size={18} color={theme.text} /> : <ChevronDown size={18} color={theme.text} />}
                </TouchableOpacity>

                {dropdown1Open && !searchClick && (
                  <View style={[styles.dropdownList, { borderColor }]}>
                    {layers.map(layer => (
                      <TouchableOpacity
                        key={layer.id}
                        style={styles.dropdownItem}
                        onPress={() => onLayerSelect(layer)}
                      >
                        <Text style={{ color: theme.text }}>{layer.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Feature Search Input */}
                <View style={[styles.searchInputWrapper, { backgroundColor: inputBg, borderColor }]}>
                  <Search size={18} color={subTextColor} />
                  <TextInput
                    placeholder="Search feature..."
                    placeholderTextColor="#8E8E93"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={[styles.searchInput, { color: theme.text }]}
                    onPressIn={() => {
                      if (activeCategory) {
                        setSearchClick(true);
                        setDropdown1Open(false);
                      } else {
                        showAlert("Notice", "Please select a Layer from the dropdown above first.", 'warning');
                      }
                    }}
                  />
                </View>

                {/* Search Results List */}
                {searchClick && activeCategory && dropdown1Value !== 'Select Layer' && (
                  <View style={[styles.dropdownList, { maxHeight: 320, borderColor }]}>
                    <FlatList
                      data={searchFeatures.filter(item =>
                        item.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        String(item.id).includes(searchQuery)
                      )}
                      keyExtractor={(item) => item.id.toString()}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={styles.dropdownItem}
                          onPress={() => onFeatureSelect(dropdown1Value, item.id)}
                        >
                          <Text style={{ color: theme.text }}>
                            {item.label ?? `Feature ${item.id}`}
                          </Text>
                        </TouchableOpacity>
                      )}
                      ListEmptyComponent={() => (
                        <View style={{ padding: 16, alignItems: 'center' }}>
                          <Text style={{ color: subTextColor }}>No matching features</Text>
                        </View>
                      )}
                      ListFooterComponent={() => {
                        if (loadingFeatures) return <ActivityIndicator style={{ padding: 12 }} />;
                        if (hasMore && searchQuery === '') {
                          return (
                            <TouchableOpacity style={styles.loadMoreBtn} onPress={() => setPage(prev => prev + 1)}>
                              <Text style={styles.loadMoreText}>Load more</Text>
                            </TouchableOpacity>
                          );
                        }
                        return null;
                      }}
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                >
                  <Text style={{ color: '#FFF', fontWeight: '600' }}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <AlertComponent />
    </>

  );
};

const styles = StyleSheet.create({
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  searchModal: { width: '90%', borderRadius: 16, padding: 20 },
  dropdown: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 10, borderWidth: 1 },
  dropdownList: { marginTop: 6, borderRadius: 10, overflow: 'hidden', borderWidth: 1 },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 0.5, borderColor: '#ddd' },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  loadMoreBtn: { padding: 12, alignItems: 'center' },
  loadMoreText: { color: '#007AFF', fontWeight: '600' },
  closeButton: { marginTop: 20, backgroundColor: '#007AFF', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }
});

export default SearchFeatureModal;