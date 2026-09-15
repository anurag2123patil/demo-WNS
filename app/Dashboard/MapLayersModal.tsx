import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions
} from 'react-native';
import { X } from 'lucide-react-native';

interface MapLayersModalProps {
  visible: boolean;
  onClose: () => void;
  layers: any[];
  theme: any;
  subTextColor: string;
  borderColor: string;
  getLayerSymbology: (name: string) => any;
  toggleWmsLayer: (layer: any, manual: boolean) => void;
}

const MapLayersModal: React.FC<MapLayersModalProps> = ({
  visible,
  onClose,
  layers,
  theme,
  subTextColor,
  borderColor,
  getLayerSymbology,
  toggleWmsLayer,
}) => {
  const { width, height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlayCenter}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.layerPanel, { backgroundColor: theme.cardColor, width: width - 32 }]}>
          {/* Header */}
          <View style={styles.layerHeader}>
            <View>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Map Layers</Text>
              <Text style={{ color: subTextColor, fontSize: 12 }}>Manage layer visibility</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeCircleSmall}>
              <X color={theme.text} size={20} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content Area */}
          <View style={{ maxHeight: height * 0.55 }}>
            <ScrollView
              showsVerticalScrollIndicator={true}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              {layers.map((layer) => {
                const symbology = getLayerSymbology(layer.alias || layer.name || '')

                return (
                  <View
                    key={layer.id}
                    style={[styles.layerContainerCard, { backgroundColor: theme.cardColor, borderColor: borderColor }]}
                  >
                    <View style={styles.layerCardHeaderRow}>
                      <Text style={[styles.layerTitleText, { color: theme.text }]}>{layer.name}</Text>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => toggleWmsLayer(layer, true)}
                        style={[
                          styles.statusToggleButton,
                          { backgroundColor: layer.visible ? '#00C853' : '#B0BEC5' }
                        ]}
                      >
                        <Text style={styles.statusToggleText}>{layer.visible ? 'ON' : 'OFF'}</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.symbologyListContainer}>
                      {symbology.statuses.map((status: any, idx: number) => (
                        <View key={idx} style={styles.symbologyRow}>
                          <View style={styles.symbolIconWrapper}>
                            {status.shape === 'line' && <View style={[styles.lineSymbolDraw, { backgroundColor: status.color || status.innerColor }]} />}
                            {status.shape === 'circle' && <View style={[styles.circleSymbolDraw, { backgroundColor: status.innerColor }]} />}
                            {status.shape === 'double-circle' && (
                              <View style={[styles.outerCircleDraw, { backgroundColor: status.outerColor || '#FFFF00' }]}>
                                <View style={[styles.innerCircleDraw, { backgroundColor: status.innerColor || '#00C853' }]} />
                              </View>
                            )}
                            {status.shape === 'dashed' && (
                              <View style={styles.dashedLineContainer}>
                                <View style={[styles.dash, { backgroundColor: '#FFA500' }]} />
                                <View style={[styles.dash, { backgroundColor: '#FFA500', marginLeft: 2 }]} />
                                <View style={[styles.dash, { backgroundColor: '#FFA500', marginLeft: 2 }]} />
                              </View>
                            )}
                          </View>
                          <Text style={[styles.symbologyLabel, { color: theme.text }]}>{status.name}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  layerPanel: { borderRadius: 24, padding: 20, elevation: 20, maxHeight: '85%' },
  layerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  closeCircleSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' },
  layerContainerCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  layerCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8 },
  layerTitleText: { fontSize: 15, fontWeight: '800' },
  statusToggleButton: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 15, minWidth: 50, alignItems: 'center' },
  statusToggleText: { color: '#FFF', fontSize: 11, fontWeight: '900' },
  symbologyListContainer: { gap: 10 },
  symbologyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  symbolIconWrapper: {
    width: 32,           // Slightly wider to accommodate the 20px circle comfortably
    height: 32,
    justifyContent: 'center',
    alignItems: 'center'
  },
  symbologyLabel: { fontSize: 13, fontWeight: '500' },
  lineSymbolDraw: { width: 24, height: 2 },
  circleSymbolDraw: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
  outerCircleDraw: {
    width: 20,        // was 18
    height: 20,       // was 18  
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,   // ADD THIS - makes the outer ring visible as a border
    borderColor: 'rgba(0,0,0,0.1)',
  },
  innerCircleDraw: {
    width: 10,        // was 8
    height: 10,       // was 8
    borderRadius: 5,
    borderWidth: 0,   // remove border, color alone is enough
  },
  dashedLineContainer: { flexDirection: 'row', gap: 2 },
  dash: { width: 4, height: 2 },
});

export default MapLayersModal;