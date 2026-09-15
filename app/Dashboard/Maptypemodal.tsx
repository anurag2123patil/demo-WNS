import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    StyleSheet,
    Image,
    useWindowDimensions,
    Platform,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';

type MapType = 'osm' | 'satellite' | 'hybrid';

interface MapOption {
    id: MapType;
    label: string;
    description: string;
    preview: string;
    gradient: string[];
    accent: string;
}

const MAP_OPTIONS: MapOption[] = [
    {
        id: 'satellite',
        label: 'Satellite',
        description: 'High-resolution aerial & satellite imagery',
        preview: 'satellite',
        gradient: ['#1A2A1A', '#2D4A2D'],
        accent: '#34C759',
    },
    {
        id: 'osm',
        label: 'Standard',
        description: 'Classic street map with roads, labels & terrain',
        preview: 'osm',
        gradient: ['#E8F4FD', '#B8D9F0'],
        accent: '#007AFF',
    },
    {
        id: 'hybrid',
        label: 'Hybrid',
        description: 'Satellite imagery with roads & place labels',
        preview: 'hybrid',
        gradient: ['#1A2030', '#2A3850'],
        accent: '#FF9500',
    },
];

// Google Maps style preview thumbnails
const PreviewThumbnail = ({ type }: { type: MapType }) => {
    if (type === 'osm') {
        return (
            <View style={[thumb.container, { backgroundColor: '#E8E0D5' }]}>
                <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#F5F0E8' }} />
                <View style={[thumb.patch, { top: '0%', left: '0%', width: '38%', height: '42%', backgroundColor: '#C8E6C4' }]} />
                <View style={[thumb.patch, { top: '58%', left: '55%', width: '28%', height: '22%', backgroundColor: '#C8E6C4' }]} />
                <View style={[thumb.patch, { top: '72%', left: '0%', width: '35%', height: '28%', backgroundColor: '#AAD3DF' }]} />
                <View style={[thumb.patch, { top: '80%', left: '30%', width: '15%', height: '20%', backgroundColor: '#AAD3DF' }]} />
                <View style={[thumb.patch, { top: '8%', left: '42%', width: '14%', height: '10%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '8%', left: '58%', width: '18%', height: '12%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '8%', left: '78%', width: '20%', height: '8%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '22%', left: '42%', width: '20%', height: '16%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '22%', left: '65%', width: '16%', height: '14%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '22%', left: '83%', width: '14%', height: '18%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '48%', left: '5%', width: '18%', height: '16%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '48%', left: '26%', width: '14%', height: '20%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '48%', left: '42%', width: '10%', height: '12%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '48%', left: '55%', width: '20%', height: '8%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '58%', left: '42%', width: '12%', height: '16%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '58%', left: '56%', width: '15%', height: '10%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '75%', left: '38%', width: '15%', height: '12%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '75%', left: '56%', width: '18%', height: '16%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.patch, { top: '75%', left: '76%', width: '22%', height: '22%', backgroundColor: '#DEDAD4' }]} />
                <View style={[thumb.road, { top: '43%', left: 0, right: 0, height: 6, backgroundColor: '#F9A825' }]} />
                <View style={[thumb.road, { top: '41.5%', left: 0, right: 0, height: 1.5, backgroundColor: '#E65100' }]} />
                <View style={[thumb.road, { top: '49%', left: 0, right: 0, height: 1.5, backgroundColor: '#E65100' }]} />
                <View style={[thumb.road, { top: 0, bottom: 0, left: '38%', width: 6, backgroundColor: '#F9A825' }]} />
                <View style={[thumb.road, { top: 0, bottom: 0, left: '36.5%', width: 1.5, backgroundColor: '#E65100' }]} />
                <View style={[thumb.road, { top: 0, bottom: 0, left: '44%', width: 1.5, backgroundColor: '#E65100' }]} />
                <View style={[thumb.road, { top: '25%', left: '38%', right: 0, height: 3, backgroundColor: '#FFFFFF' }]} />
                <View style={[thumb.road, { top: '66%', left: 0, right: 0, height: 3, backgroundColor: '#FFFFFF' }]} />
                <View style={[thumb.road, { top: '43%', left: '60%', bottom: 0, width: 3, backgroundColor: '#FFFFFF' }]} />
                <View style={[thumb.road, { top: '25%', left: '75%', height: '18%', width: 3, backgroundColor: '#FFFFFF' }]} />
                <View style={[thumb.road, { top: '15%', left: '42%', right: 0, height: 2, backgroundColor: '#FFFFFF' }]} />
                <View style={[thumb.road, { top: '55%', left: '38%', right: '30%', height: 2, backgroundColor: '#FFFFFF' }]} />
                <View style={[thumb.road, { top: '25%', left: '55%', height: '18%', width: 2, backgroundColor: '#FFFFFF' }]} />
                <View style={[thumb.road, { top: '66%', left: '55%', bottom: 0, width: 2, backgroundColor: '#FFFFFF' }]} />
                <View style={[thumb.road, { top: '66%', left: '78%', bottom: 0, width: 2, backgroundColor: '#FFFFFF' }]} />
                <View style={{ position: 'absolute', top: '30%', left: '56%', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#EA4335', borderWidth: 2, borderColor: '#FFF' }} />
                    <View style={{ width: 2, height: 5, backgroundColor: '#EA4335', marginTop: -1 }} />
                </View>
            </View>
        );
    }

    if (type === 'satellite') {
        return (
            <View style={[thumb.container, { backgroundColor: '#2A3A22' }]}>
                <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#3B4A30' }} />
                <View style={[thumb.patch, { top: '0%', left: '0%', width: '32%', height: '30%', backgroundColor: '#4A6828' }]} />
                <View style={[thumb.patch, { top: '0%', left: '33%', width: '28%', height: '22%', backgroundColor: '#5A7A30' }]} />
                <View style={[thumb.patch, { top: '0%', left: '62%', width: '38%', height: '28%', backgroundColor: '#3D5820' }]} />
                <View style={[thumb.patch, { top: '23%', left: '62%', width: '20%', height: '20%', backgroundColor: '#6A8A38' }]} />
                <View style={[thumb.patch, { top: '23%', left: '83%', width: '17%', height: '25%', backgroundColor: '#485E28' }]} />
                <View style={[thumb.patch, { top: '32%', left: '0%', width: '25%', height: '35%', backgroundColor: '#2D4A18' }]} />
                <View style={[thumb.patch, { top: '55%', left: '15%', width: '20%', height: '30%', backgroundColor: '#253D14' }]} />
                <View style={[thumb.patch, { top: '22%', left: '30%', width: '32%', height: '42%', backgroundColor: '#5A5A50' }]} />
                <View style={[thumb.patch, { top: '24%', left: '32%', width: '8%', height: '6%', backgroundColor: '#6A6A60', opacity: 0.8 }]} />
                <View style={[thumb.patch, { top: '24%', left: '42%', width: '6%', height: '6%', backgroundColor: '#707068', opacity: 0.8 }]} />
                <View style={[thumb.patch, { top: '24%', left: '50%', width: '9%', height: '6%', backgroundColor: '#686860', opacity: 0.8 }]} />
                <View style={[thumb.patch, { top: '32%', left: '32%', width: '10%', height: '8%', backgroundColor: '#787870' }]} />
                <View style={[thumb.patch, { top: '32%', left: '44%', width: '7%', height: '8%', backgroundColor: '#6E6E66' }]} />
                <View style={[thumb.patch, { top: '42%', left: '32%', width: '6%', height: '6%', backgroundColor: '#747468' }]} />
                <View style={[thumb.patch, { top: '42%', left: '40%', width: '10%', height: '10%', backgroundColor: '#6C6C64' }]} />
                <View style={[thumb.patch, { top: '52%', left: '34%', width: '8%', height: '8%', backgroundColor: '#727268' }]} />
                <View style={[thumb.patch, { top: '52%', left: '44%', width: '12%', height: '8%', backgroundColor: '#686860' }]} />
                <View style={[thumb.patch, { top: '65%', left: '0%', width: '45%', height: '35%', backgroundColor: '#1A3A6C' }]} />
                <View style={[thumb.patch, { top: '60%', left: '5%', width: '35%', height: '10%', backgroundColor: '#1E4278' }]} />
                <View style={[thumb.patch, { top: '72%', left: '5%', width: '30%', height: '2%', backgroundColor: 'rgba(100,160,220,0.4)' }]} />
                <View style={[thumb.patch, { top: '80%', left: '8%', width: '22%', height: '2%', backgroundColor: 'rgba(100,160,220,0.3)' }]} />
                <View style={[thumb.patch, { top: '65%', left: '48%', width: '22%', height: '35%', backgroundColor: '#4A6228' }]} />
                <View style={[thumb.patch, { top: '65%', left: '71%', width: '29%', height: '20%', backgroundColor: '#526A2C' }]} />
                <View style={[thumb.patch, { top: '80%', left: '71%', width: '15%', height: '20%', backgroundColor: '#3E5420' }]} />
                <View style={[thumb.patch, { top: '80%', left: '87%', width: '13%', height: '20%', backgroundColor: '#5E7830' }]} />
                <View style={[thumb.road, { top: '63%', left: '25%', right: 0, height: 2, backgroundColor: 'rgba(200,180,140,0.6)' }]} />
                <View style={[thumb.road, { top: '45%', left: '62%', bottom: 0, width: 2, backgroundColor: 'rgba(200,180,140,0.5)' }]} />
                <View style={[thumb.patch, { top: '5%', left: '70%', width: '18%', height: '6%', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4 }]} />
                <View style={[thumb.patch, { top: '3%', left: '75%', width: '12%', height: '5%', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4 }]} />
            </View>
        );
    }

    return (
        <View style={[thumb.container, { backgroundColor: '#3B4A30' }]}>
            <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#3B4A30' }} />
            <View style={[thumb.patch, { top: '0%', left: '0%', width: '32%', height: '30%', backgroundColor: '#4A6828' }]} />
            <View style={[thumb.patch, { top: '0%', left: '33%', width: '28%', height: '22%', backgroundColor: '#5A7A30' }]} />
            <View style={[thumb.patch, { top: '0%', left: '62%', width: '38%', height: '28%', backgroundColor: '#3D5820' }]} />
            <View style={[thumb.patch, { top: '32%', left: '0%', width: '25%', height: '35%', backgroundColor: '#2D4A18' }]} />
            <View style={[thumb.patch, { top: '22%', left: '30%', width: '32%', height: '42%', backgroundColor: '#5A5A50' }]} />
            <View style={[thumb.patch, { top: '65%', left: '0%', width: '45%', height: '35%', backgroundColor: '#1A3A6C' }]} />
            <View style={[thumb.patch, { top: '65%', left: '48%', width: '52%', height: '35%', backgroundColor: '#4A6228' }]} />
            <View style={[thumb.patch, { top: '23%', left: '62%', width: '38%', height: '42%', backgroundColor: '#3D5820' }]} />
            <View style={[thumb.patch, { top: '24%', left: '32%', width: '8%', height: '6%', backgroundColor: '#6A6A60', opacity: 0.8 }]} />
            <View style={[thumb.patch, { top: '32%', left: '32%', width: '10%', height: '8%', backgroundColor: '#787870' }]} />
            <View style={[thumb.patch, { top: '42%', left: '40%', width: '10%', height: '10%', backgroundColor: '#6C6C64' }]} />
            <View style={[thumb.road, { top: '44%', left: 0, right: 0, height: 5, backgroundColor: '#FFD54F' }]} />
            <View style={[thumb.road, { top: '42.5%', left: 0, right: 0, height: 1, backgroundColor: '#F9A825' }]} />
            <View style={[thumb.road, { top: '49.5%', left: 0, right: 0, height: 1, backgroundColor: '#F9A825' }]} />
            <View style={[thumb.road, { top: 0, bottom: 0, left: '60%', width: 5, backgroundColor: '#FFD54F' }]} />
            <View style={[thumb.road, { top: 0, bottom: 0, left: '58.5%', width: 1, backgroundColor: '#F9A825' }]} />
            <View style={[thumb.road, { top: 0, bottom: 0, left: '65.5%', width: 1, backgroundColor: '#F9A825' }]} />
            <View style={[thumb.road, { top: '25%', left: '30%', right: 0, height: 3, backgroundColor: '#FFFFFF' }]} />
            <View style={[thumb.road, { top: '64%', left: 0, right: 0, height: 3, backgroundColor: '#FFFFFF' }]} />
            <View style={[thumb.road, { top: '0%', left: '30%', height: '44%', width: 3, backgroundColor: '#FFFFFF' }]} />
            <View style={[thumb.road, { top: '44%', left: '80%', bottom: 0, width: 3, backgroundColor: '#FFFFFF' }]} />
            <View style={[thumb.road, { top: '15%', left: '0%', right: '40%', height: 2, backgroundColor: 'rgba(255,255,255,0.85)' }]} />
            <View style={[thumb.road, { top: '55%', left: '30%', right: '35%', height: 2, backgroundColor: 'rgba(255,255,255,0.85)' }]} />
            <View style={[thumb.road, { top: '44%', left: '44%', bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.85)' }]} />
            <View style={{ position: 'absolute', top: '10%', left: '34%', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }}>
                <View style={{ width: 22, height: 3, backgroundColor: '#555', borderRadius: 1 }} />
            </View>
            <View style={{ position: 'absolute', top: '68%', left: '50%', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }}>
                <View style={{ width: 18, height: 3, backgroundColor: '#555', borderRadius: 1 }} />
            </View>
            <View style={{ position: 'absolute', top: '30%', left: '66%', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }}>
                <View style={{ width: 14, height: 3, backgroundColor: '#555', borderRadius: 1 }} />
            </View>
            <View style={{ position: 'absolute', top: '34%', left: '47%', alignItems: 'center' }}>
                <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#EA4335', borderWidth: 1.5, borderColor: '#FFF' }} />
                <View style={{ width: 2, height: 4, backgroundColor: '#EA4335', marginTop: -1 }} />
            </View>
        </View>
    );
};

const thumb = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
    },
    road: {
        position: 'absolute',
    },
    patch: {
        position: 'absolute',
    },
});

interface MapTypeModalProps {
    visible: boolean;
    onClose: () => void;
    currentMapType: MapType;
    onSelect: (type: MapType) => void;
    isDark?: boolean;
    theme?: any;
}

export default function MapTypeModal({
    visible,
    onClose,
    currentMapType,
    onSelect,
    isDark = false,
    theme,
}: MapTypeModalProps) {
    const { width, height } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const isTablet = width > 768;
    const isLandscape = width > height;

    const bg = isDark ? '#0F0F13' : '#F2F2F7';
    const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
    const textColor = isDark ? '#FFFFFF' : '#0F172A';
    const subColor = isDark ? '#8E8E93' : '#64748B';
    const dividerColor = isDark ? '#2C2C2E' : '#E2E8F0';

    // Bottom padding = safe area inset (nav bar) + extra breathing room
    const bottomPadding = insets.bottom + 12;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={[styles.backdrop]}>
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

                <View style={[
                    styles.sheet,
                    {
                        backgroundColor: bg,
                        maxWidth: isTablet ? 600 : '100%',
                        width: isTablet ? 600 : '100%',
                        alignSelf: 'center',
                        // Key fix: dynamic bottom padding based on safe area
                        paddingBottom: bottomPadding,
                    }
                ]}>
                    {/* Handle */}
                    <View style={[styles.handle, { backgroundColor: isDark ? '#3A3A3C' : '#CBD5E1' }]} />

                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: dividerColor }]}>
                        <View>
                            <Text style={[styles.headerTitle, { color: textColor }]}>Map Style</Text>
                            <Text style={[styles.headerSub, { color: subColor }]}>Choose your preferred view</Text>
                        </View>
                        <TouchableOpacity style={[styles.closeBtn, { backgroundColor: isDark ? '#2C2C2E' : '#E8EDF2' }]} onPress={onClose}>
                            <X size={18} color={textColor} />
                        </TouchableOpacity>
                    </View>

                    {/* Cards */}
                    <View style={[styles.cardsRow, { gap: 12 }]}>
                        {MAP_OPTIONS.map((option) => {
                            const isActive = currentMapType === option.id;
                            return (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[
                                        styles.card,
                                        {
                                            backgroundColor: cardBg,
                                            borderColor: isActive ? option.accent : 'transparent',
                                            flex: 1,
                                            shadowColor: isActive ? option.accent : '#000',
                                            shadowOpacity: isActive ? 0.25 : 0.06,
                                            shadowOffset: { width: 0, height: isActive ? 4 : 2 },
                                            shadowRadius: isActive ? 12 : 6,
                                            elevation: isActive ? 8 : 2,
                                        }
                                    ]}
                                    onPress={() => {
                                        onSelect(option.id);
                                        onClose();
                                    }}
                                    activeOpacity={0.85}
                                >
                                    {/* Preview Thumbnail */}
                                    <View style={[
                                        styles.previewContainer,
                                        {
                                            borderColor: isActive ? option.accent : (isDark ? '#2C2C2E' : '#E2E8F0'),
                                        }
                                    ]}>
                                        <PreviewThumbnail type={option.id} />

                                        {/* Active checkmark overlay */}
                                        {isActive && (
                                            <View style={[styles.checkOverlay, { backgroundColor: option.accent }]}>
                                                <Check size={10} color="#FFF" strokeWidth={3} />
                                            </View>
                                        )}
                                    </View>

                                    {/* Label */}
                                    <View style={styles.cardInfo}>
                                        <Text style={[
                                            styles.cardLabel,
                                            {
                                                color: isActive ? option.accent : textColor,
                                                fontWeight: isActive ? '800' : '600',
                                            }
                                        ]} numberOfLines={1}>
                                            {option.label}
                                        </Text>

                                        {/* Active indicator dot */}
                                        {isActive && (
                                            <View style={[styles.activeDot, { backgroundColor: option.accent }]} />
                                        )}
                                    </View>

                                    {/* Active border glow bottom accent */}
                                    {isActive && (
                                        <View style={[styles.activeAccentBar, { backgroundColor: option.accent }]} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Current selection info */}
                    <View style={[styles.infoBar, { backgroundColor: isDark ? '#1C1C1E' : '#EBF5FF', borderColor: isDark ? '#2C2C2E' : '#BFDBFE' }]}>
                        <View style={[styles.infoIcon, { backgroundColor: MAP_OPTIONS.find(o => o.id === currentMapType)?.accent + '20' }]}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: MAP_OPTIONS.find(o => o.id === currentMapType)?.accent }} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.infoText, { color: textColor }]}>
                                {MAP_OPTIONS.find(o => o.id === currentMapType)?.label} view active
                            </Text>
                            <Text style={[styles.infoSub, { color: subColor }]} numberOfLines={1}>
                                {MAP_OPTIONS.find(o => o.id === currentMapType)?.description}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 12,
        paddingHorizontal: 16,
        // NOTE: paddingBottom is now set dynamically in the component using insets
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 16,
        marginBottom: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    headerSub: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardsRow: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    card: {
        borderRadius: 16,
        borderWidth: 2,
        overflow: 'hidden',
        position: 'relative',
    },
    previewContainer: {
        height: 100,
        margin: 8,
        marginBottom: 0,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1.5,
        position: 'relative',
    },
    checkOverlay: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    cardInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 6,
        gap: 5,
    },
    cardLabel: {
        fontSize: 12,
        textAlign: 'center',
    },
    activeDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    activeAccentBar: {
        height: 3,
        width: '50%',
        alignSelf: 'center',
        borderRadius: 2,
        marginBottom: 8,
        opacity: 0.6,
    },
    infoBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        gap: 12,
        marginBottom: 4,
    },
    infoIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 14,
        fontWeight: '700',
    },
    infoSub: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },
});