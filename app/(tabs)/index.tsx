import React, { useState, useRef, useMemo, useEffect } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import AddRemarkEditor from '../Dashboard/Addremarkeditor';
import { useNavigation, useNavigationState } from '@react-navigation/native';

import * as ImageManipulator from 'expo-image-manipulator';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Switch,
  FlatList,
  Image,
  Animated,
  Linking,
  Platform,
  BackHandler,
  useWindowDimensions,
  StatusBar,
  ActivityIndicator,
  ImageBackground,
  Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import AccessDenied from '@/components/AccessDenied';
import {
  Search, Plus, Minus, Maximize, Navigation, Layers, X, MapPin, Check,
  Info, Save, MessageSquare, ImageIcon, Trash2, CheckSquare,
  ChevronDown, ChevronUp, Settings, Compass, ChevronRight,
  ExternalLink, FileText,
  Camera,
  BarChart3,
  Package,
  Satellite,
  LocateFixed
} from 'lucide-react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { DashboardStyles } from '../Dashboard/DashboardStyles';
import { useTheme } from '../../contexts/ThemeContext';
import {
  fetchKPI, getLayers, verifyFeature, verifyFeatureBulk, fetchLayerConfig,
  fetchVerificationFeatures, fetchFeatures, Feature, fetchWFSConfig, updatePipelineDetails,
  updateManholeDetails, updateJunctionDetails, updateTankDetails, updateSTPDetails, saveRemark,
  SaveRemarkPayload,
  fetchRemarkHistory,
  UpdateSTPPayload,
  fetchFeatureInfoUpdated,
  ExtentResponse, fetchSubactivityListByUnit, getProjectExtent, getSubImages, getUnitImage,
  saveSubactivityList, saveSubactivityUsage, saveUnitWeightage, uploadSubActivityImage, UploadSubActivityImagePayload, uploadUnitImage, UploadUnitImagePayload
  , deleteUnitImage
} from "@/api/api";
import URLS from '@/api/base_url';

import { mapHtml } from '../Dashboard/MapHtml';
import KPISection from '../Dashboard/KPISection';
import MapLayersModal from '../Dashboard/MapLayersModal';
import VerificationModal from '../Dashboard/VerificationModal';
import SearchFeatureModal from '../Dashboard/SearchFeatureModal';
import MapTypeModal from '../Dashboard/Maptypemodal';
import RemarkCard from '../Dashboard/Remarkcard';
import { useAlert } from '@/hooks/useAlert';
// import {mapTokenService} from "@/services/MapTokenService";
import { mapTokenService } from '../Dashboard/Maptokenservice';
import { secureGeoServerFetch } from '../Dashboard/Securegeoserverfetch';
import DynamicAttributePanel, { DynamicAttributePanelRef } from '../Dashboard/DynamicAttributePanel';
// --- HTML MAP CONTENT ---





const LAYER_COLORS = [
  '#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE',
  '#5856D6', '#00C7BE', '#FF2D55', '#A2845E', '#5AC8FA'
];



function DashboardMapViewInner() {
  const { width, height } = useWindowDimensions();
  const isTablet = width > 768;
  const { theme, isDark } = useTheme();
  const { selectedProject, token, isCompressImage, addGeoTag, hasAccess, hasWriteAccess } = useAuth();

  const project_id = selectedProject?.id;
  const webviewRef = useRef<WebView>(null);
  const imageGeoTag = selectedProject?.projectData?.add_geo_tag;
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [showVerified, setShowVerified] = useState(false);
  const [verificationLayers, setVerificationLayers] = useState<any[]>([]);
  const [currentLayer, setCurrentLayer] = useState('');
  const [verifSearchQuery, setVerifSearchQuery] = useState('');
  const [mapTokenReady, setMapTokenReady] = useState(false);
  const navigation = useNavigation();

  // States
  const [isMapReady, setIsMapReady] = useState(false);
  const [subactivities, setSubactivities] = useState<any[]>([]);
  const [unitWeightage, setUnitWeightage] = useState<any[]>([]);
  const [loadingSubactivities, setLoadingSubactivities] = useState(false);
  const [activeUnitId, setActiveUnitId] = useState<number | null>(null);
  const [layers, setLayers] = useState<any[]>([]);
  const [pipeline_by_types, setPipeline_by_types] = useState<any[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [kpiData, setKpiData] = useState<any>(null);
  const [loadingKpi, setLoadingKpi] = useState(false);
  const totalLen = kpiData?.total_length || 0;
  const compLen = kpiData?.completed_length || 0;
  const remLen = kpiData?.remaining_length || 0;
  const totalConn = kpiData?.connection_data?.total_connection || 0;
  const doneConn = kpiData?.connection_data?.done_connection || 0;
  const verifiedManholes = kpiData?.manhole_data?.verified_manholes || 0;
  const totalManholes = kpiData?.manhole_data?.total_manholes || 0;
  const hasManholeInWeightage = kpiData?.manhole_data?.has_manhole_in_weightage ?? false;
  const hasHouseConnInWeightage = kpiData?.manhole_data?.has_house_connection_in_weightage ?? true;
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [activeDeleteImageKey, setActiveDeleteImageKey] = useState<string | null>(null);
  const [mapTypeModalVisible, setMapTypeModalVisible] = useState(false);
  const [expandedUnitCardId, setExpandedUnitCardId] = useState<number | null>(null);
  const [cameraIframeUrl, setCameraIframeUrl] = useState<string | null>(null);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const EXCLUSIVE_LAYER_PAIRS = [
    ['1', '10'], // layer_id 1 and layer_id 10 are mutually exclusive
  ];
  const getConflictingLayerId = (layerId: string): string | null => {
    for (const pair of EXCLUSIVE_LAYER_PAIRS) {
      if (pair[0] === layerId) return pair[1];
      if (pair[1] === layerId) return pair[0];
    }
    return null;
  };

  const progressVal = kpiData?.progress_data?.progress || 0;
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'attributes' | 'remark' | 'images' | 'subactivities'>('attributes');
  const [editedAttributes, setEditedAttributes] = useState<any>({});
  const [layersVisible, setLayersVisible] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const pendingStampResolveRef = useRef<((uri: string) => void) | null>(null);

  const [unitImages, setUnitImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [newRemark, setNewRemark] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [image_limit, setImage_limit] = useState(0);
  const [planAlertShown, setPlanAlertShown] = useState(false);
  const [planDismissed, setPlanDismissed] = useState(false);
  const [lastClickedMapCoord, setLastClickedMapCoord] = useState<[number, number] | null>(null);
  // Add this state near your other useState declarations
  const [currentFeatureContext, setCurrentFeatureContext] = useState<{
    layerName: string;
    featureId: string | number;
  } | null>(null);
  const { showAlert, AlertComponent } = useAlert();
  const [unitRemarkHistories, setUnitRemarkHistories] = useState<
    Record<number, Array<{ id: string; user: string; text: string; date?: string }>>
  >({});
  const [isSaving, setIsSaving] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const layersConfigRef = useRef<Map<string, any>>(new Map());
  // const layersMapRef = useRef<Map<string, TileLayer<TileWMS>>>(new Map());
  const hasInitialZoomed = useRef(false);
  const suppressSheetCloseReset = useRef(false);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);
  const sidebarWidth = Math.min(width * 0.8, 350);
  const slideAnim = useRef(new Animated.Value(-sidebarWidth)).current;
  const snapPoints = useMemo(() => isTablet ? ['40%', '80%'] : ['35%', '60%', '90%'], [isTablet]);
  const mapTypeLabels = {
    osm: 'Standard Map',
    satellite: 'Satellite View',
    hybrid: 'Hybrid View'
  };
  const subTextColor = isDark ? '#A1A1AA' : '#8E8E93';
  const borderColor = isDark ? '#3A3A3C' : '#E5E5EA';
  const inputBg = isDark ? '#2C2C2E' : '#F5F5F7';
  const [mapType, setMapType] = useState<'osm' | 'satellite' | 'hybrid'>('satellite');
  const [verificationVisible, setVerificationVisible] = useState(false);
  const CONTAINER_PADDING = 16;
  const GAP = 10;
  const NUM_COLS = isTablet ? 6 : 3;
  const CARD_WIDTH = (width - 32 - 20) / (isTablet ? 6 : 3);
  const [featureError, setFeatureError] = useState<string | null>(null);


  const styles = DashboardStyles(theme, isDark, subTextColor, borderColor, inputBg);
  // const connPercent = totalConn > 0 ? ((doneConn / totalConn) * 100).toFixed(1) : "0";

  const completedPercentage = compLen && totalLen
    ? ((compLen / totalLen) * 100).toFixed(2)
    : '0.00';

  const initCallCountRef = useRef(0);
  const verifCallCountRef = useRef(0);

  const [expandedUnitId, setExpandedUnitId] = useState<number | null>(null);
  const [searchFeatures, setSearchFeatures] = useState<Feature[]>([]);
  const [verificationFeatures, setVerificationFeatures] = useState<Feature[]>([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [dropdown1Open, setDropdown1Open] = useState(false);
  const [dropdown2Open, setDropdown2Open] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showBdDropdown, setShowBdDropdown] = useState(false);
  const [typeOfManholeModalVisible, setTypeOfManholeModalVisible] = useState(false);

  const dynamicAttrRef = useRef<DynamicAttributePanelRef>(null);
  const [dropdown1Value, setDropdown1Value] = useState('Select Layer');
  const [dropdown1ValueText, setDropdown1ValueText] = useState('Select Layer');
  const [dropdown2Value, setDropdown2Value] = useState('Select Feature');
  const PAGE_SIZE = 10;
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchClick, setSearchClick] = useState(false);
  const [featureImages, setFeatureImages] = useState<string[]>([]);
  const [featureRemarks, setFeatureRemarks] = useState<any[]>([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [capturedImage, setCapturedImage] = useState<any>(null);
  const cachedLocationRef = useRef(null);
  const locationTimestampRef = useRef(0);
  const [subActivityRemark, setSubActivityRemark] = useState('');
  const imageDetailsRef = useRef<Record<string, { uploadedBy: string, uploadedAt: string }>>({});
  const [activeSubActivityId, setActiveSubActivityId] = useState<number | null>(null);
  const [showSubHistory, setShowSubHistory] = useState(false);
  const [subHistoryData, setSubHistoryData] = useState<any[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<{ [key: number]: boolean }>({});
  const [unitRemark, setUnitRemark] = useState('');
  const [activeUnitRemarkId, setActiveUnitRemarkId] = useState<number | null>(null);
  const [isEditingSubActivities, setIsEditingSubActivities] = useState(false);
  const [isEditingWeightage, setIsEditingWeightage] = useState(false);
  const [extent, setExtent] = useState<ExtentResponse | null>(null);
  const [isAddMaterialModalOpen, setIsAddMaterialModalOpen] = useState(false);
  const [activeUsageSubId, setActiveUsageSubId] = useState<number | null>(null);
  const [activeUsageUnitId, setActiveUsageUnitId] = useState<number | null>(null);
  const [unitImagesMetaMap, setUnitImagesMetaMap] = useState<Record<number, any[]>>({});
  const [modalImageContext, setModalImageContext] = useState<{
    type: 'feature' | 'unit' | 'sub';
    unitId?: number;
    subId?: number;
  } | null>(null);
  const [subImagesMetaMap, setSubImagesMetaMap] = useState<Record<number, any[]>>({});
  const layersLoadedRef = useRef(false);


  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);




  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3000);
  };

  const getCurrentLocation = (): Promise<{
    accuracy: number;
    lat: number;
    lng: number;
    localArea: string; // Renamed for clarity
  }> => {
    return new Promise(async (resolve, reject) => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          reject('Location permission denied');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const { latitude, longitude, accuracy } = location.coords;

        // ✅ Reverse Geocoding to get detailed address
        const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
        const item = reverse[0];

        // ✅ LOGIC CHANGE: Prioritize 'street' and 'name' for local details
        // item.name often contains the building/house name or specific lane
        // item.street contains the road name
        const street = item?.street || item?.name || "Unknown Road";
        const subArea = item?.district || item?.subregion || "";

        const localAreaName = street && subArea
          ? `${street}, ${subArea}`
          : street || subArea || "Unknown Location";

        resolve({
          accuracy: accuracy || 0,
          lat: latitude,
          lng: longitude,
          localArea: localAreaName,
        });
      } catch (error: any) {
        reject(`Location error: ${error.message}`);
      }
    });
  };

  const [materialFormData, setMaterialFormData] = useState({
    excavation: '',
    steel: '',
    concrete: ''
  });
  const getLayerSymbology = (layerName: string) => {

    const name = (layerName || '').toLowerCase();
    // Pipeline (regular)
    if (name.includes('pipeline') && !name.includes('existing') && !name.includes('category')) {
      return {
        type: 'line',
        statuses: [
          { name: 'Completed', innerColor: '#00FF00', shape: 'line' },
          { name: 'Pending', innerColor: '#FF0000', shape: 'line' },
          { name: 'On Going', innerColor: '#ffd931', shape: 'line' },
          { name: 'Verified', innerColor: '#00CCFF', shape: 'line' }
        ]
      };
    }
    if (name.includes('pipeline') && !name.includes('existing') && name.includes('category')) {
      console.log('Applying special symbology for category pipeline', pipeline_by_types);
      return {
        type: 'line',
        statuses: pipeline_by_types.map(item => ({
          name: item.wpstm_name,
          innerColor: item.wpstm_color,
          shape: 'line'
        }))
      };
    }
    // Tank (ESR/Sump) - Double circle
    if (name.includes('tank') && !name.includes('existing')) {
      return {
        type: 'point',
        statuses: [
          { name: 'Completed', innerColor: '#00FF00', outerColor: '#0000FF', shape: 'double-circle' },
          { name: 'Pending', innerColor: '#FF0000', outerColor: '#0000FF', shape: 'double-circle' },
          { name: 'On Going', innerColor: '#ffd931', outerColor: '#0000FF', shape: 'double-circle' },
          { name: 'Verified', innerColor: '#00CCFF', outerColor: '#0000FF', shape: 'double-circle' }
        ]
      };
    }

    if (name.includes('structure') && !name.includes('existing')) {
      return {
        type: 'point',
        statuses: [
          { name: 'Completed', innerColor: '#00FF00', outerColor: '#FFFF00', shape: 'double-circle' },
          { name: 'Pending', innerColor: '#FF0000', outerColor: '#FFFF00', shape: 'double-circle' },
          { name: 'On Going', innerColor: '#ffd931', outerColor: '#FFFF00', shape: 'double-circle' },
          { name: 'Verified', innerColor: '#00CCFF', outerColor: '#FFFF00', shape: 'double-circle' }
        ]
      };
    }


    // Specials - Single circle
    if (name.includes('special')) {
      return {
        type: 'point',
        statuses: [
          { name: 'Completed', innerColor: 'purple', shape: 'circle' }
        ]
      };
    }



    // Manhole (not existing) - Double circle
    if (name.includes('manhole') && !name.includes('existing')) {
      return {
        type: 'point',
        statuses: [
          { name: 'Completed', innerColor: '#00FF00', outerColor: '#787520', shape: 'double-circle' },
          { name: 'Pending', innerColor: '#FF0000', outerColor: '#787520', shape: 'double-circle' },
          { name: 'On Going', innerColor: '#ffd931', outerColor: '#787520', shape: 'double-circle' },
          { name: 'Verified', innerColor: '#00CCFF', outerColor: '#787520', shape: 'double-circle' }
        ]
      };
    }

    // Existing Pipeline - Dashed line
    if (name.includes('pipeline') && name.includes('existing')) {
      return {
        type: 'line',
        statuses: [
          { name: 'Existing', innerColor: '#FFA500', shape: 'dashed' }
        ]
      };
    }
    // if (name.includes('structure') && name.includes('existing')) {
    //   return {
    //     type: 'line',
    //     statuses: [
    //       { name: 'Existing', innerColor: '#FFA500', shape: 'dashed' }
    //     ]
    //   };
    // }
    // Existing STP/WTP/Headworks - Single circle
    if ((name.includes('structure') && name.includes('existing'))) {
      return {
        type: 'point',
        statuses: [
          { name: 'Existing', innerColor: '#acb0b1', outerColor: 'yellow', shape: 'double-circle' }
        ]
      };
    }
    // Existing Tank - Single circle
    if (name.includes('tank') && name.includes('existing')) {
      return {
        type: 'point',
        statuses: [
          { name: 'Existing', innerColor: '#acb0b1', outerColor: '#0000FF', shape: 'double-circle' }
        ]
      };
    }
    // Existing Manhole - Single circle
    if (name.includes('manhole') && name.includes('existing')) {
      return {
        type: 'point',
        statuses: [
          { name: 'Existing', innerColor: '#00CCFF', shape: 'circle' }
        ]
      };
    }



    // Default symbology
    return {
      type: 'point',
      statuses: [
        { name: 'Completed', innerColor: '#10B981', shape: 'circle' },
        { name: 'Pending', innerColor: '#EF4444', shape: 'circle' },
        { name: 'On Going', innerColor: '#ffd931', shape: 'circle' },
        { name: 'Verified', innerColor: '#3B82F6', shape: 'circle' }
      ]
    };
  };
  useEffect(() => {
    const onBackPress = () => {
      // 1. If bottom sheet is open → close it and stay on screen
      if (selectedFeature) {
        bottomSheetRef.current?.close();
        setSelectedFeature(null);
        setActiveTab('attributes');
        setIsEditing(false);
        setEditedAttributes({});
        setCapturedImage(null);
        webviewRef.current?.injectJavaScript(`
          if (window.handleRNMessage) {
            window.handleRNMessage({ data: JSON.stringify({ type: 'CLEAR_HIGHLIGHT' }) });
          } else if (window.clearHighlight) {
            window.clearHighlight();
          }
        `);
        return true;
      }

      // 2. Check if we can go back to a previous screen
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true;
      }

      // 3. No previous screen → this is the root/dashboard → show exit alert
      showAlert(
        'Exit App',
        'Are you sure you want to exit?',
        'warning',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => null,
          },
          {
            text: 'Exit',
            style: 'destructive',
            onPress: () => BackHandler.exitApp(),
          },
        ],
        { cancelable: false }
      );

      return true; // Always intercept
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );

    return () => subscription.remove();
  }, [selectedFeature, navigation]);


  // Add this helper function in your component (before the return statement)
  const calculateCumulativeUsage = (unit: any) => {
    let cumulativeExcavation = 0;
    let cumulativeSteel = 0;
    let cumulativeConcrete = 0;

    // Sum up all subactivity values
    unit.subactivities?.forEach((sa: any) => {
      cumulativeExcavation += parseFloat(sa.excavation) || 0;
      cumulativeSteel += parseFloat(sa.steel) || 0;
      cumulativeConcrete += parseFloat(sa.concrete) || 0;
    });

    // Get unit target values
    const unitExcavation = parseFloat(unit.wirelusg_excavation) || 0;
    const unitSteel = parseFloat(unit.wirelusg_steel) || 0;
    const unitConcrete = parseFloat(unit.wirelusg_concrete) || 0;

    // Calculate percentages
    const excavationPercentage = unitExcavation ? (cumulativeExcavation / unitExcavation) * 100 : 0;
    const steelPercentage = unitSteel ? (cumulativeSteel / unitSteel) * 100 : 0;
    const concretePercentage = unitConcrete ? (cumulativeConcrete / unitConcrete) * 100 : 0;



    return {
      excavation: {
        sum: cumulativeExcavation.toFixed(2),
        percentage: excavationPercentage.toFixed(2),
        target: unitExcavation.toFixed(2)
      },
      steel: {
        sum: cumulativeSteel.toFixed(2),
        percentage: steelPercentage.toFixed(2),
        target: unitSteel.toFixed(2)
      },
      concrete: {
        sum: cumulativeConcrete.toFixed(2),
        percentage: concretePercentage.toFixed(2),
        target: unitConcrete.toFixed(2)
      }
    };
  };

  const handleBulkUpdateLogic = async () => {
    const layerId = parseInt(activeCategory!);
    const newStatus = !showVerified;
    setIsBulkUpdating(true);
    try {
      await verifyFeatureBulk(selectedFeatureIds, layerId, newStatus, token);

      // Refresh the list locally
      await handleVerificationToggle(showVerified);

      // Refresh Map WebView Tiles
      webviewRef.current?.injectJavaScript(`
        if (window.wmsLayers) {
          Object.keys(wmsLayers).forEach(key => {
            const source = wmsLayers[key].getSource();
            if (source && typeof source.updateParams === 'function') {
              source.updateParams({ 't': ${Date.now()} });
            }
          });
        }
      `);

      showAlert('Success', newStatus ? 'Features verified' : 'Features unverified', "success",);
      setSelectedFeatureIds([]);
      await refreshKPI();
    } catch (err: any) {
      showAlert('Error', err.message, 'error');
    } finally {
      setIsBulkUpdating(false);
    }
  };
  const handleSaveMaterialUsage = async () => {
    if (!activeUsageSubId || !activeUsageUnitId) {
      showAlert("Error", "Missing identification IDs", 'error');
      return;
    }
    const currentUnit = selectedFeature?.rawResponse?.stp_table?.find(
      (u) => u.wirelusg_id === activeUsageUnitId
    );

    if (currentUnit) {
      const unitExc = parseFloat(currentUnit.wirelusg_excavation) || 0;
      const unitStl = parseFloat(currentUnit.wirelusg_steel) || 0;
      const unitCon = parseFloat(currentUnit.wirelusg_concrete) || 0;

      if (unitExc === 0 && unitStl === 0 && unitCon === 0) {
        showAlert("Validation Error", "The parent unit has no target material data. Save the Unit details first.", "info");
        return;
      }
    }
    try {
      setLoadingSubactivities(true); // Optional: show loader

      const payload = {
        wistpsu_fk_wiresu_id: activeUsageSubId,
        wistpsu_excavation: parseFloat(materialFormData.excavation) || 0,
        wistpsu_steel: parseFloat(materialFormData.steel) || 0,
        wistpsu_concrete: parseFloat(materialFormData.concrete) || 0,
        unit_id: activeUsageUnitId
      };
      console.log("📤 Saving Material Usage Payload:", payload);

      const response = await saveSubactivityUsage(payload);

      if (response.status) {
        showAlert("Success", response.message || "Usage saved successfully", 'success');
        setIsAddMaterialModalOpen(false);
        setMaterialFormData({ excavation: '', steel: '', concrete: '' }); // Reset form

        // Refresh the list to show updated values
        await loadSubactivitiesForUnit(activeUsageUnitId);
        await refreshCurrentFeature();

      } else {
        showAlert("Failed", response.message || "Could not save entry", 'error');
      }
    } catch (error: any) {
      showAlert("Error", error.message, 'error');
    } finally {
      setLoadingSubactivities(false);
    }
  };



  useEffect(() => {
    if (
      activeTab !== 'images' ||
      currentLayer !== 'waternetinfraa:structure_main' ||
      !selectedFeature?.rawResponse?.stp_table
    ) return;

    const preloadAllImageMeta = async () => {
      const units: any[] = selectedFeature.rawResponse.stp_table;

      for (const unit of units) {
        // Preload unit images if not already cached
        if (!unitImagesMetaMap[unit.wirelusg_id]) {
          try {
            const res = await getUnitImage(unit.wirelusg_id);
            if (res.data?.length > 0) {
              const items = res.data.filter((i: any) => i.file_path);
              if (items.length > 0) {
                setUnitImagesMetaMap(prev => ({ ...prev, [unit.wirelusg_id]: items }));
              }
            }
          } catch (_) { /* silently skip if unit has no images */ }
        }

        // Preload subactivity images if not already cached
        for (const sub of unit.subactivities || []) {
          const subId = sub.subactivity_id;
          if (!subImagesMetaMap[subId]) {
            try {
              const res = await getSubImages(subId);
              if (res.data?.length > 0) {
                const items = res.data.filter((i: any) => i.file_path);
                if (items.length > 0) {
                  setSubImagesMetaMap(prev => ({ ...prev, [subId]: items }));
                }
              }
            } catch (_) { /* silently skip if sub has no images */ }
          }
        }
      }
    };

    preloadAllImageMeta();
  }, [activeTab, currentLayer, selectedFeature]);


  useEffect(() => {
    if (isMapReady && extent && extent.bbox && !hasInitialZoomed.current) {
      const { minx, miny, maxx, maxy } = extent.bbox;

      // Wait for initMap() to finish setting up window.zoomToExtent
      const tryZoom = (attempts = 0) => {
        if (attempts > 10) return; // give up after ~1s

        const script = `
          (function() {
            if (typeof window.zoomToExtent === 'function') {
              window.zoomToExtent(${minx}, ${miny}, ${maxx}, ${maxy});
              true;
            } else {
              false;
            }
          })();
        `;

        webviewRef.current?.injectJavaScript(script);

        // Also schedule a retry in case zoomToExtent wasn't ready yet
        setTimeout(() => {
          if (!hasInitialZoomed.current) {
            tryZoom(attempts + 1);
          }
        }, 100);
      };

      // Small initial delay to let initMap() complete
      setTimeout(() => tryZoom(), 300);
      hasInitialZoomed.current = true;
    }
  }, [isMapReady, extent]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        await mapTokenService.fetchMapToken(token);
        if (!cancelled) setMapTokenReady(true);
      } catch (err) {
        console.error('❌ Map token fetch failed:', err);
      }
    };
    if (token) init();
    return () => {
      cancelled = true;
      mapTokenService.clearToken();
    };
  }, [token]);

  // useEffect(() => {
  //   if (!isMapReady || !mapTokenReady) return;   // <-- add mapTokenReady
  //   layers.forEach(l => {
  //     if (l.visible) toggleWmsLayer(l, false);
  //   });
  // }, [isMapReady, mapTokenReady, layers]);

  useEffect(() => {
    console.log("selectedProject", selectedProject);
    const loadProjectExtent = async () => {
      try {
        setLoadingKpi(true);
        const data = await getProjectExtent(project_id);
        setExtent(data);
      } catch (error: any) {
        console.error("Effect Error:", error.message);
        showAlert("Error", "Failed to load map boundaries", 'error');
      } finally {
        setLoadingKpi(false);
      }
    };

    if (project_id) {
      loadProjectExtent();
    }
  }, [project_id]);


  const toggleSubActivities = (unitId: number) => {
    setExpandedUnits(prev => {
      const isCurrentlyOpen = !!prev[unitId];
      // If already open → close all. If closed → close all and open only this one.
      return isCurrentlyOpen ? {} : { [unitId]: true };
    });
  };;
  const AttributeItem = ({ label, value, fieldKey, placeholder, options, combobox, allowOther }: { label: string; value?: string; fieldKey?: string; placeholder?: string; options?: string[]; combobox?: boolean; allowOther?: boolean }) => {
    const [modalVisible, setModalVisible] = useState(false);
    return (
      <View style={styles.attributeRow}>
        <Text style={styles.kvKey}>{label}</Text>
        {isEditing && fieldKey ? (
          combobox && options ? (
            // ── Combobox: free-text input + quick-select option chips ──
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.attributeInput, { backgroundColor: inputBg, color: theme.text }]}
                value={String(editedAttributes[fieldKey] ?? value ?? '')}
                placeholder={placeholder || `Enter ${label}`}
                placeholderTextColor="#8E8E93"
                keyboardType="numeric"
                onChangeText={(text) => setEditedAttributes({ ...editedAttributes, [fieldKey]: text })}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 6 }}
                contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingBottom: 2 }}
              >
                {options.map((opt) => {
                  const isSelected = String(editedAttributes[fieldKey] ?? value ?? '') === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setEditedAttributes({ ...editedAttributes, [fieldKey]: opt })}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: isSelected ? '#3B82F6' : borderColor,
                        backgroundColor: isSelected ? '#3B82F620' : (isDark ? '#2E3147' : '#F1F5F9'),
                      }}
                    >
                      <Text style={{ fontSize: 13, color: isSelected ? '#3B82F6' : theme.text, fontWeight: isSelected ? '600' : '400' }}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : options ? (
            <View>
              <TouchableOpacity 
                style={[styles.attributeInput, { backgroundColor: inputBg, justifyContent: 'center' }]} 
                onPress={() => setModalVisible(true)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: editedAttributes[fieldKey] ? theme.text : '#8E8E93' }}>
                    {editedAttributes[fieldKey] || value || placeholder || 'Select value'}
                  </Text>
                  <ChevronDown size={16} color={theme.text} />
                </View>
              </TouchableOpacity>
              
              {allowOther && 
               ((editedAttributes[fieldKey] !== undefined ? editedAttributes[fieldKey] : value) === 'Other' || 
                ((editedAttributes[fieldKey] !== undefined ? editedAttributes[fieldKey] : value) && !options.includes(editedAttributes[fieldKey] !== undefined ? editedAttributes[fieldKey] : value))) && (
                <TextInput
                  style={[styles.attributeInput, { backgroundColor: inputBg, color: theme.text, marginTop: 8 }]}
                  value={(editedAttributes[fieldKey] !== undefined ? editedAttributes[fieldKey] : value) === 'Other' ? '' : (editedAttributes[fieldKey] !== undefined ? editedAttributes[fieldKey] : value)}
                  placeholder={`Specify custom ${label.toLowerCase()}`}
                  placeholderTextColor="#8E8E93"
                  onChangeText={(text) => setEditedAttributes({ ...editedAttributes, [fieldKey]: text || 'Other' })}
                />
              )}
              
              <Modal visible={modalVisible} transparent animationType="fade">
                <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setModalVisible(false)}>
                  <View style={{ width: '80%', maxHeight: '60%', backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 12, padding: 16, elevation: 5 }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: theme.text }}>Select {label}</Text>
                    <ScrollView>
                      {(allowOther && !options.includes('Other') ? [...options, 'Other'] : options).map((opt) => (
                        <TouchableOpacity 
                          key={opt} 
                          style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: borderColor }}
                          onPress={() => {
                            setEditedAttributes({ ...editedAttributes, [fieldKey]: opt });
                            setModalVisible(false);
                          }}
                        >
                          <Text style={{ fontSize: 15, color: theme.text }}>{opt}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>
          ) : (
            <TextInput
              style={[styles.attributeInput, { backgroundColor: inputBg, color: theme.text }]}
              value={String(editedAttributes[fieldKey] ?? value ?? '')}
              placeholder={placeholder || `Enter ${label}`}
              placeholderTextColor="#8E8E93"
              onChangeText={(text) => setEditedAttributes({ ...editedAttributes, [fieldKey]: text })}
            />
          )
        ) : (
          <View style={[styles.attributeValue, {
            backgroundColor: isDark ? '#2E3147' : '#F8FAFC'
          }]}>
            <Text style={styles.kvValue}>{value || 'N/A'}</Text>
          </View>
        )}
      </View>
    );
  };


  const loadSubactivitiesForUnit = async (unitId: number) => {
    try {
      setLoadingSubactivities(true); // Assuming you have a loading state
      const response = await fetchSubactivityListByUnit(unitId);

      if (response.status) {
        // Update your state variables
        setSubactivities(response.subActivities || []);
        setUnitWeightage(response.unitWeightage || []);
      } else {
        showAlert("Notice", response.message || "Failed to fetch data", 'error');
      }
    } catch (err: any) {
      showAlert("Error", err.message || "Something went wrong while fetching subactivities", 'error');
    } finally {
      setLoadingSubactivities(false);
    }
  };
  const handleSaveWeightageOnly = async () => {
    if (!expandedUnitId || !unitWeightage[0]) {
      showAlert("Error", "No unit data found.", 'error');
      return;
    }

    try {
      setLoadingSubactivities(true);

      const data = unitWeightage[0];

      // 1. Check if any sub-activity in the list has material requirement enabled
      const isMatEnabled = subactivities.some(sa => sa.isMaterialReq || sa.wiresu_ismaterial_req);

      // 2. Prepare values: Force 0 if material is not enabled, otherwise parse from state
      const excavation = isMatEnabled ? (parseFloat(data.excavation) || 0) : 0;
      const steel = isMatEnabled ? (parseFloat(data.steel) || 0) : 0;
      const concrete = isMatEnabled ? (parseFloat(data.concrete) || 0) : 0;

      // Use manual sub-activity weightage from state, fallback to calculated list sum
      const totalSubWeightFromList = subactivities.reduce((sum, sa) => sum + (parseFloat(sa.weightage) || 0), 0);
      const allMaterialReq = subactivities.every(sa => sa.isMaterialReq || sa.wiresu_ismaterial_req);
      const subActivityWeightage = !allMaterialReq ? parseFloat(data.subactivityWeightage) : 0;

      // 3. Validate 100% sum
      const finalSum = excavation + steel + concrete + subActivityWeightage;

      // We use Math.abs and a small decimal check to handle floating point math issues
      if (Math.abs(finalSum - 100) > 0.01) {
        showAlert(
          "Validation Error",
          `The total sum must be exactly 100%. \n\nCurrent total: ${finalSum}%`,
          'warning'
        );
        setLoadingSubactivities(false);
        return;
      }

      // 4. Construct Payload based on your Swagger Schema
      const payload = {
        unitId: expandedUnitId,
        weightageId: data.wireluw_id || 0, // 0 for new, actual ID for update
        excavation: excavation,
        steel: steel,
        concrete: concrete,
        subActivityWeightage: subActivityWeightage
      };

      console.log("📤 Sending Weightage Payload:", payload);

      // 5. Call API
      const response = await saveUnitWeightage(payload);

      if (response.status) {
        showAlert("Success", "Unit weightage distribution saved.", 'success');
        setIsEditingWeightage(false); // Exit edit mode

        // 6. Refresh data to sync UI with backend
        await loadSubactivitiesForUnit(expandedUnitId);
        await refreshCurrentFeature();

      } else {
        throw new Error(response.message || "Failed to save");
      }
    } catch (err: any) {
      console.error("❌ saveUnitWeightage error:", err);
      showAlert("Error", err.message || "Something went wrong while saving weightage.", 'error');
    } finally {
      setLoadingSubactivities(false);
    }
  };
  const handleSaveSubActivityList = async (): Promise<boolean> => {
    if (!expandedUnitId) {
      showAlert("Error", "No unit selected", 'error');
      return false;
    }

    const allMaterialReq = subactivities.every(sa => sa.isMaterialReq || sa.wiresu_ismaterial_req);

    if (!allMaterialReq) {
      const totalWeight = subactivities.reduce(
        (sum, sa) => sum + (parseFloat(sa.weightage) || 0), 0
      );

      if (totalWeight !== 100) {
        showAlert(
          "Validation Error",
          `Total weightage must be exactly 100%. Current total: ${totalWeight}%`,
          "error",
          [{ text: "OK", onPress: () => { } }]
        );
        return false; // ← Stay in edit mode
      }
    }

    try {
      setLoadingSubactivities(true);
      const payload = subactivities.map((sa) => ({
        subactivityId: typeof sa.subactivityId === 'number' && sa.subactivityId > 1000000000
          ? null
          : (sa.subactivityId || sa.subactivity_id || null),
        subactivityName: sa.subactivityName || sa.subactivity_name,
        weightage: parseFloat(sa.weightage) || 0,
        isMaterialReq: !!(sa.isMaterialReq || sa.wiresu_ismaterial_req),
        remark: sa.remark || "",
        unitId: expandedUnitId
      }));

      const response = await saveSubactivityList(payload);

      if (response.status) {
        showAlert("Success", response.message || "Subactivity list saved successfully.", 'success');
        await loadSubactivitiesForUnit(expandedUnitId);
        await refreshCurrentFeature();
        setIsEditing(false);
        return true; // ← Success, allow edit mode to close
      } else {
        showAlert("Save Failed", response.message || "Unknown error occurred", 'error');
        return false; // ← Stay in edit mode
      }
    } catch (err: any) {
      showAlert("Error", err.message || "Something went wrong while saving", 'error');
      return false; // ← Stay in edit mode
    } finally {
      setLoadingSubactivities(false);
    }
  };


  // New Function for Unit Level History
  const handleViewUnitHistory = async (unitId: number) => {
    try {
      const res = await fetchRemarkHistory({
        isFeature: false,
        isUnit: true,
        isSubActivity: false,
        wilm_id: 3,
        unit_id: unitId,
      });

      const formatted = (res?.data?.remarkData || []).map(
        (item: any, index: number) => ({
          id: `unit-history-${index}-${Date.now()}`,
          user: item.created_by || 'Unknown',
          text: item.remark || '',
          date: item.created_at,
        })
      );

      // Store inline and also open the history modal
      setUnitRemarkHistories(prev => ({ ...prev, [unitId]: formatted }));
      setSubHistoryData(res?.data?.remarkData || []);
      setShowSubHistory(true);
    } catch (err) {
      showAlert("Error", "Failed to fetch unit history", 'error');
    }
  };


  const handleViewSubActivityHistory = async (subActivityId: number, unitId: number) => {
    try {
      const payload = {
        isFeature: false,
        isUnit: false,
        isSubActivity: true,
        wiresu_id: subActivityId,
        wilm_id: 3,
        unit_id: unitId,
      }
      console.log("Payload for Subactivity History:", payload);
      const res = await fetchRemarkHistory(payload);
      console.log("Response for Subactivity History:", payload);

      // According to your API historyRes.data.remarkData
      setSubHistoryData(res?.data?.remarkData || []);
      setShowSubHistory(true);
    } catch (err) {
      showAlert("Error", "Failed to fetch history", 'error');
    }
  };
  const getLayerIdFromCurrentLayer = (): string | null => {
    const layer = layers.find(l => l.alias === currentLayer || l.name === currentLayer);
    return layer ? layer.id : null;
  };
  const handleAddSubActivityRemark = async (subActivityId: number, unitId: number) => {
    if (subActivityId > 1000000000) {
      showAlert(
        "Save Required",
        "This is a new sub-activity. You must click 'Save' at the bottom of the list to register it before you can add remarks.",
        'warning'
      );
      return;
    }
    if (!subActivityRemark.trim()) return;

    try {
      const payload: SaveRemarkPayload = {
        isFeature: "false",
        isSubActivity: "true",
        isUnit: "true", // Backend requires this true as well based on your payload
        remark: subActivityRemark.trim(),
        wiresu_id: subActivityId,
        wilm_id: 3, // WTP/STP Location ID
        unit_id: unitId
      };

      console.log("📤 Sending STP Sub-Activity Payload:", payload);

      const response = await saveRemark(payload);

      if (response.status) {
        setSubActivityRemark('');
        setActiveSubActivityId(null);
        showAlert("Success", "Remark saved successfully");
      }
    } catch (err: any) {
      showAlert("Error", err.message || "Failed to save remark", 'error');
    }
  };
  const handleToggleVerifyFeature = async (item: any) => {
    try {
      const layerId = activeCategory;
      const newStatus = !item.is_verified; // 🔁 toggle

      if (!layerId) {
        showAlert("Error", "Layer not selected", 'error');
        return;
      }

      await verifyFeature(
        item.id,        // feature_id
        layerId,        // layer_id
        newStatus       // true / false
        , token);

      setVerificationFeatures(prev =>
        prev.map(f =>
          f.id === item.id
            ? { ...f, is_verified: newStatus }
            : f
        )
      );

      showAlert(
        "Success",
        newStatus ? "Feature verified" : "Feature unverified", "success"
      );
      await refreshKPI();
      webviewRef.current?.injectJavaScript(`
        Object.keys(wmsLayers).forEach(key => {
          const source = wmsLayers[key].getSource();
          if (source && typeof source.updateParams === 'function') {
            source.updateParams({ 'VERSION': '1.1.1', 't': Date.now() });
          }
        });
      `);
    } catch (err: any) {
      showAlert("Action Failed", err.message, "error");
    }
  };


  // Inside DashboardMapView component
  const isTankFeature = useMemo(() => {
    if (!selectedFeature) return false;
    // Payload uses 'labelname' for tanks and 'label' for pipelines
    const name = (selectedFeature.name || "").toLowerCase();
    const type = (selectedFeature.basic?.type || "").toLowerCase();
    return name.includes('tank') || name.includes('esr') || name.includes('sump') ||
      type.includes('esr') || type.includes('sump');
  }, [selectedFeature]);

  // ─── Per-layer wilm_id helpers ───────────────────────────────────────────────
  /** Pipeline (layer_id: 1, alias: waternetinfraa:pipeline_main) */
  const getWilmIdForPipeline = (): number => 1;

  /** Tank / ESR / Sump (layer_id: 2, alias: waternetinfraa:tank_main) */
  const getWilmIdForTank = (): number => 2;

  /** STP / WTP / Headworks / Structure (layer_id: 3, alias: waternetinfraa:structure_main) */
  const getWilmIdForStructure = (): number => 3;

  /** Junction / Special features (layer_id: 4) */
  const getWilmIdForSpecial = (): number => 4;

  /** Existing Pipeline (layer_id: 5, alias: waternetinfraa:pipeline_existing) */
  const getWilmIdForExistingPipeline = (): number => 5;

  /** Manhole (layer_id: 6, alias: waternetinfraa:manhole_main) */
  const getWilmIdForManhole = (): number => 6;

  // ─── Per-layer feature-ID extractors ─────────────────────────────────────────
  /** Returns the feature ID for Pipeline features */
  const getFeatureIdForPipeline = (feature: any): any =>
    feature?.basic?.id || feature?.basic?.feature_id;

  /** Returns the feature ID for Tank / ESR / Sump features */
  const getFeatureIdForTank = (feature: any): any =>
    feature?.basic?.id || feature?.basic?.feature_id;

  /** Returns the feature ID for STP / WTP / Headworks features */
  const getFeatureIdForStructure = (feature: any): any =>
    feature?.basic?.id || feature?.basic?.feature_id;

  /** Returns the feature ID for Junction / Special features */
  const getFeatureIdForSpecial = (feature: any): any =>
    feature?.basic?.id || feature?.basic?.feature_id;

  /** Returns the feature ID for Existing Pipeline features */
  const getFeatureIdForExistingPipeline = (feature: any): any =>
    feature?.basic?.id || feature?.basic?.feature_id;

  /** Returns the feature ID for Manhole features */
  const getFeatureIdForManhole = (feature: any): any =>
    feature?.basic?.wimg_id || feature?.basic?.id || feature?.basic?.feature_id;
  // ─────────────────────────────────────────────────────────────────────────────

  const handleAddRemark = async (htmlContent: string) => {
    // Strip HTML tags to check if there's actual text content
    const plainText = htmlContent.replace(/<[^>]*>/g, '').trim();
    if (!plainText || !selectedFeature) return;

    try {
      // ── Resolve wilm_id from the active layer alias (layer.id === layer_id === wilm_id) ──
      // This is authoritative: currentLayer is set to layerAlias at feature-click time,
      // and layers[] comes directly from the API with layer_id matching wilm_id.
      const activeLayer = layers.find(
        (l) => l.alias === currentLayer || l.name === currentLayer
      );
      const wilm_id: number = activeLayer?.id ?? 6; // fallback to 6 (manhole) if not found

      // ── Resolve feature ID — manhole uses wimg_id as its primary key ──
      let featId: any;
      if (wilm_id === getWilmIdForManhole()) {
        featId = getFeatureIdForManhole(selectedFeature);
      } else if (wilm_id === getWilmIdForPipeline()) {
        featId = getFeatureIdForPipeline(selectedFeature);
      } else if (wilm_id === getWilmIdForTank()) {
        featId = getFeatureIdForTank(selectedFeature);
      } else if (wilm_id === getWilmIdForStructure()) {
        featId = getFeatureIdForStructure(selectedFeature);
      } else if (wilm_id === getWilmIdForSpecial()) {
        featId = getFeatureIdForSpecial(selectedFeature);
      } else if (wilm_id === getWilmIdForExistingPipeline()) {
        featId = getFeatureIdForExistingPipeline(selectedFeature);
      } else {
        featId = selectedFeature.basic.id ||
          selectedFeature.basic.feature_id ||
          selectedFeature.basic.wimg_id;
      }

      console.log(`📌 handleAddRemark → layer: ${currentLayer}, wilm_id: ${wilm_id}, featId: ${featId}`);

      const payload: SaveRemarkPayload = {
        feature_id: featId,
        remark: htmlContent,          // ← send full HTML to API (preserves bold/italic/lists)
        isFeature: "true",
        isUnit: "false",
        isSubActivity: "false",
        wilm_id,
      };

      console.log("My Special Remark is:", payload);
      const response = await saveRemark(payload);

      if (response.status) {
        // No need to call setNewRemark('') — editor clears itself via WebView injection

        try {
          const historyRes = await fetchRemarkHistory({
            isFeature: true,
            isUnit: false,
            isSubActivity: false,
            feature_id: featId,
          });

          if (historyRes?.data?.remarkData) {
            const formattedRemarks = historyRes.data.remarkData.map((item: any, index: number) => ({
              id: `history-${index}-${Date.now()}`,
              user: item.created_by || 'Unknown',
              // Strip HTML for display in the remarks list card
              text: item.remark || '',
              date: item.created_at,
            }));

            setFeatureRemarks(formattedRemarks);
          }
        } catch (historyErr) {
          console.log('⚠️ Failed to refresh history:', historyErr);
        }

        showAlert("Success", "Remark saved successfully", 'success');
      }
    } catch (error: any) {
      console.error("❌ saveRemark error:", error);
      showAlert("Error", error.message || "Failed to save remark", 'error');
    }
  };

  const handleSearchButton = () => {
    setActiveCategory(null);
    setDropdown1Value('Select Layer');
    setDropdown1ValueText('Select Layer');
    setDropdown2Value('Select Feature');
    setSearchFeatures([]);
    setSearchQuery('');
    setSearchClick(false);

    setSearchVisible(true);
  };
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr || dateStr === 'Unknown') return dateStr || '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    return `${day}/${month}/${year}, ${strTime}`;
  };

  useEffect(() => {
    if (!searchVisible) {
      // setDropdown1Value('Select Layer');
      // setDropdown2Value('Select Feature');
      // setSearchFeatures([]);
      // setSearchQuery('');
      // setSearchClick(false);
      // setCapturedImage(null);


      setSearchQuery('');
      setSearchClick(false);
      setCapturedImage(null);
    }
  }, [searchVisible]);

  useEffect(() => {
    if (!activeCategory) {
      setSearchFeatures([]);
      setSearchClick(false);

      return;
    }
    setSearchFeatures([]);
    setSearchClick(false);
    setPage(1);
    setHasMore(true);
  }, [activeCategory]);

  useEffect(() => {
    // 👈 Only load if category is NOT null/empty
    if (!activeCategory || !hasMore || !searchVisible) return;

    let isMounted = true;
    const loadFeatures = async () => {
      try {
        setLoadingFeatures(true);
        const res = await fetchFeatures(activeCategory, page, PAGE_SIZE);
        if (!isMounted) return;
        const newFeatures = res.features || [];
        setSearchFeatures(prev => page === 1 ? newFeatures : [...prev, ...newFeatures]);
        if (newFeatures.length < PAGE_SIZE) setHasMore(false);
      } catch {
        if (isMounted) setHasMore(false);
      } finally {
        if (isMounted) setLoadingFeatures(false);
      }
    };
    loadFeatures();
    return () => { isMounted = false; };
  }, [activeCategory, page, searchVisible]);

  const getActiveLayerName = () => {
    const visibleLayers = layers.filter(l => l.visible);
    return visibleLayers.map(l => l.alias || l.name);
  };
  const getActiveLayers = () => {
    return layers.filter(l => l.visible);
  };

  //verification  
  const handleVerificationToggle = async (newValue: boolean) => {
    setShowVerified(newValue);
    setLoadingFeatures(true);

    try {
      const data = await fetchVerificationFeatures(newValue, token);
      setVerificationLayers(data.layers || []);

      // Find the current category in the new data to refresh the list
      if (activeCategory) {
        const selectedLayer = data.layers?.find((l) => l.layer_id === activeCategory);
        // Filter features locally to match the current tab (Verified or Pending)
        setVerificationFeatures(selectedLayer?.features || []);
      } else if (data.layers?.length > 0) {
        setActiveCategory(data.layers[0].layer_id);
        setVerificationFeatures(data.layers[0].features || []);
      }
    } catch (error) {
      console.error('Failed to fetch verification features:', error);
    } finally {
      setLoadingFeatures(false);
    }
  };

  const detectFeatureKind = (feature: any) => {
    if (!feature) return 'default';
    const name = (feature.basic?.label || feature.basic?.lable || '').toLowerCase();
    const type = (feature.basic?.type || '').toLowerCase();

    if (name.includes('existing pipeline') || type.includes('existing pipeline')) {
      return 'existing-pipeline';
    }
    if (name.includes('special')) return 'special';
    if (name.includes('stp') || name.includes('wtp') || name.includes('headworks') || type.includes('stp') || type.includes('wtp')) return 'wtp-stp';
    if (name.includes('pipeline') || type.includes('pipeline')) return 'pipeline';
    if (name.includes('manhole') || type.includes('manhole')) return 'manhole';
    if (name.includes('tank') || name.includes('esr') || name.includes('sump') || type.includes('esr') || type.includes('sump')) return 'tank';
    if (name.includes('pipeline_by_category') || type.includes('pipeline_by_category')) return 'pipeline-by-category';

    return 'default';
  };

  const getDisplayAttributes = (feature: any) => {
    if (!feature || !feature.basic) return [];

    const featureKind = detectFeatureKind(feature);
    const attrs = feature.basic;
    const rawResponse = feature;

    switch (currentLayer) {
      case 'pipeline':
        const statusId = attrs.status_id;
        const statusObj = rawResponse.geomStatusList?.find((s: any) => s.wists_id === statusId);
        const statusName = statusObj?.wists_name ||
          (statusId === 1 ? 'Completed' : statusId === 2 ? 'Pending' : statusId === 3 ? 'On Going' : 'Unknown');

        return [
          { label: 'Label', value: attrs.label || attrs.lable || 'N/A' },
          { label: 'Diameter (mm)', value: attrs.diameter || 'N/A' },
          { label: 'Length (m)', value: attrs.length || 'N/A' },
          { label: 'Material', value: attrs.material || 'N/A' },
          { label: 'Start Invert Level (m)', value: attrs.start_invertlevel || 'N/A' },
          { label: 'End Invert Level (m)', value: attrs.end_invertlevel || 'N/A' },
          { label: 'GL Start (m)', value: attrs.gl_start || 'N/A' },
          { label: 'GL End (m)', value: attrs.gl_end || 'N/A' },
          { label: 'Last Updated By', value: rawResponse.use_name || 'N/A' },
          { label: 'Last Updated At', value: attrs.updated_date || 'N/A' },
          { label: 'Status', value: statusName },
        ];

      case 'manhole':
        const mhStatusId = attrs.wimg_fk_wists_id;
        const mhStatusObj = rawResponse.geomStatusList?.find((s: any) => s.wists_id === mhStatusId);
        const mhStatusName = mhStatusObj?.wists_name ||
          (mhStatusId === 1 ? 'Completed' : mhStatusId === 2 ? 'Pending' : mhStatusId === 3 ? 'On Going' : 'Unknown');

        return [
          { label: 'Label', value: attrs.wimg_label || attrs.label || 'N/A' },
          { label: 'Elevation (Ground) (m)', value: attrs.wimg_elevation_ground || 'N/A' },
          { label: 'Elevation (Invert) (m)', value: attrs.wimg_elevation_invert || 'N/A' },
          { label: 'Diameter (m)', value: attrs.wimg_diameter || attrs.diameter || 'N/A' },
          { label: 'MH depth (m)', value: attrs.wimg_depth || 'N/A' },
          { label: 'Actual Depth (m)', value: attrs.wimg_actual_depth || 'N/A' },
          { label: 'Last Updated By', value: rawResponse.use_name || 'N/A' },
          { label: 'Last Updated At', value: attrs.updated_date || 'N/A' },
          { label: 'Status', value: mhStatusName },
        ];

      case 'tank':
        let tankStatus = 'N/A';
        if (attrs.isverify) {
          tankStatus = 'Verified';
        } else if (attrs.witg_finishing) {
          tankStatus = 'Completed';
        } else if (rawResponse.geomDetails?.some((d: any) => d.wiusts_id === 2)) {
          tankStatus = 'Ongoing';
        } else {
          tankStatus = 'Verified';
        }

        return [
          { label: 'Label', value: attrs.labelname || attrs.label || 'N/A' },
          { label: 'Capacity (MLD)', value: attrs.capacity || 'N/A' },
          { label: 'Type', value: attrs.type || 'N/A' },
          { label: 'Stagging Height', value: attrs.stag_height || 'N/A' },
          { label: 'Last Updated By', value: rawResponse.use_name || 'N/A' },
          { label: 'Last Updated At', value: attrs.updated_date || 'N/A' },
          { label: 'Status', value: tankStatus },
          { label: 'HasLinks', value: (rawResponse.sheet_links?.length > 0).toString() }
        ];

      case 'existing-pipeline':
        return [
          { label: 'Label', value: attrs.label || attrs.lable || 'N/A' },
          { label: 'Diameter', value: attrs.diameter || 'N/A' },
          { label: 'Length', value: attrs.length || 'N/A' },
          { label: 'Material', value: attrs.material || 'N/A' }
        ];

      case 'wtp-stp':
        const numUnits = rawResponse.stp_table?.length || 0;
        return [
          { label: 'Label', value: attrs.label || attrs.lable || 'N/A' },
          { label: 'Capacity (MLD)', value: attrs.capacity || 'N/A' },
          { label: 'Type', value: attrs.type || 'N/A' },
          { label: 'Last Updated By', value: rawResponse.use_name || 'N/A' },
          { label: 'Last Updated At', value: attrs.updated_date || 'N/A' },
          { label: 'No of Units', value: numUnits.toString() },
          { label: 'Status', value: attrs.status || 'N/A' },
        ];

      case 'special':
        return [
          { label: 'Label', value: attrs.label || attrs.lable || 'N/A' },
          { label: 'Last Updated By', value: rawResponse.use_name || 'N/A' },
          { label: 'Last Updated At', value: attrs.updated_date || 'N/A' },
          { label: 'Status', value: attrs.status || 'N/A' }
        ];
      case 'pipeline-by-category':
        return [
          { label: 'Label', value: attrs.label || attrs.lable || 'N/A' },
          { label: 'Diameter (mm)', value: attrs.diameter || 'N/A' },
          { label: 'Length (m)', value: attrs.length || 'N/A' },
          { label: 'Material', value: attrs.material || 'N/A' },
          { label: 'Last Updated By', value: attrs.use_name || 'N/A' },
          { label: 'Last Updated At', value: attrs.updated_date || 'N/A' },
          { label: 'Status', value: attrs.status || 'N/A' },
        ];

      case 'existing-tank':
        return [
          { label: 'Label', value: attrs.labelname || attrs.label || 'N/A' },
          { label: 'Capacity (MLD)', value: attrs.capacity || 'N/A' },
          { label: 'Type', value: attrs.type || 'N/A' },
          { label: 'Stagging Height', value: attrs.stag_height || 'N/A' },
        ];

      case 'existing-wtp-stp':
        return [
          { label: 'Label', value: attrs.labelname || attrs.lable || 'N/A' },
          { label: 'Capacity (MLD)', value: attrs.capacity || 'N/A' },
          { label: 'Type', value: attrs.type || 'N/A' },
        ];
      default:
        return [
          { label: 'Label', value: attrs.label || attrs.lable || 'N/A' },
          { label: 'Last Updated By', value: rawResponse.use_name || 'N/A' },
          { label: 'Last Updated At', value: attrs.updated_date || 'N/A' },
          { label: 'Status', value: attrs.status || 'N/A' }
        ];
    }
  };

  const loadWFSFeatureMobile = async (
    layerAlias: string,
    featureId: string | number
  ) => {
    try {
      console.log("🔍 Loading WFS Feature:", { layerAlias, featureId });

      // Clean layer name (remove workspace prefix if present)
      let cleanLayerName = layerAlias;
      if (layerAlias.includes(':')) {
        const parts = layerAlias.split(':');
        cleanLayerName = parts[parts.length - 1];
      }

      console.log("🧹 Cleaned layer name:", cleanLayerName);

      // ✅ Call the backend endpoint that constructs the WFS URL
      const response = await fetch(
        `${URLS.BASE_URL}/geoserver/wfs/feature`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            layerName: cleanLayerName,
            featureId: featureId.toString()
          })
        }
      );

      console.log("📡 Backend Response Status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Backend request failed (${response.status}):`, errorText);
        throw new Error(`Failed to fetch feature: ${response.status}`);
      }

      const featureCollection = await response.json();
      console.log("📦 Feature Collection received:", {
        type: featureCollection.type,
        featureCount: featureCollection.features?.length || 0
      });

      if (!featureCollection || !featureCollection.features || featureCollection.features.length === 0) {
        console.warn("⚠️ No features in response");
        // showAlert(
        //   'Feature Not Found',
        //   `Feature ID ${featureId} not found in ${cleanLayerName}`
        // );
        return;
      }

      console.log("✅ Feature found, preparing to render");

      // ✅ Inject into WebView to render bounding box
      const script = `
          (function() {
            try {
              const geojson = ${JSON.stringify(featureCollection)};
              console.log('📍 WebView: Rendering feature for ID: ${featureId}');
              console.log('📍 WebView: Feature count:', geojson.features.length);
              
              if (typeof window.renderWFSBBox === 'function') {
                window.renderWFSBBox(geojson);
                console.log('✅ WebView: Feature rendered successfully');
              } else {
                console.error('❌ WebView: renderWFSBBox not available');
              }
            } catch(e) {
              console.error('❌ WebView error:', e.message);
            }
          })();
        `;

      webviewRef.current?.injectJavaScript(script);
      console.log("✅ Feature location script injected");

      // Show success message

    } catch (err: any) {
      console.error('❌ Exception in loadWFSFeatureMobile:', err);
      showAlert(
        'Error Loading Feature',
        err.message || 'Unknown error occurred',
        "error"
      );
    }
  };

  // --- Logic Functions ---
  const onWebViewMessage = async (event: any) => {
    try {
      const raw = event.nativeEvent.data;

      // ✅ HANDLE STAMPED IMAGE RETURN
      if (raw.startsWith('STAMPED_IMAGE:')) {
        const dataUrl = raw.replace('STAMPED_IMAGE:', '');
        const base64Data = dataUrl.replace('data:image/jpeg;base64,', '');
        const fileUri = FileSystem.cacheDirectory + `stamped_${Date.now()}.jpg`;

        await FileSystem.writeAsStringAsync(fileUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (pendingStampResolveRef.current) {
          const resolve = pendingStampResolveRef.current;
          pendingStampResolveRef.current = null;
          resolve(fileUri);
          setIsSaving(false);
          return;
        }

        setCapturedImage({
          uri: fileUri,
          mimeType: 'image/jpeg',
          fileName: `stamped_${Date.now()}.jpg`,
        });

        setIsSaving(false); // Hide the loader now that image is ready
        return;
      }

      if (raw.startsWith('STAMP_ERROR:')) {
        console.warn('Stamp failed');
        if (pendingStampResolveRef.current) {
          pendingStampResolveRef.current = null;
        }
        setIsSaving(false);
        return;
      }

      // Standard JSON messages
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'MAP_INIT_COMPLETE') {
        setIsMapReady(true);
        return;
      }
      if (message.type === 'MAP_FEATURE_CLICK') {
        const { coordinate, resolution, projection } = message.payload;
        await handleFeatureClick(coordinate, resolution, projection);
      }
    } catch (err) {
      console.log("WebView message error", err);
    }
  };


  const highlightClickedFeature = async (layerAlias: string, featureId: string | number) => {
    try {
      // 1. Extract the clean name
      let cleanLayerName = layerAlias.includes(':') ? layerAlias.split(':').pop() : layerAlias;

      console.log("🔦 Requesting Highlight for:", { cleanLayerName, featureId });

      const response = await secureGeoServerFetch(
        `${URLS.BASE_URL}/geoserver/wfs/feature`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({ layerName: cleanLayerName, featureId: featureId.toString() })
        }
      );

      if (!response.ok) {
        console.log(`❌ Highlight request failed: ${response.status}`);
        return;
      }

      const featureCollection = await response.json();

      if (!featureCollection?.features?.length) {
        console.log('⚠️ No features in response for highlight');
        return;
      }

      console.log('✅ Feature collection received:', {
        featureCount: featureCollection.features.length,
        geometryType: featureCollection.features[0]?.geometry?.type
      });

      // 2. Inject with better error handling
      const script = `
        (function() {
          try {
            const fc = ${JSON.stringify(featureCollection)};
            console.log('📍 WebView: Received feature collection for highlight');
            console.log('📍 Geometry type:', fc.features[0]?.geometry?.type);
            
            if (typeof window.highlightFeature === 'function') {
              window.highlightFeature(fc);
              console.log('✅ Highlight applied successfully');
            } else {
              console.error('❌ window.highlightFeature is not available');
            }
          } catch(e) {
            console.error('❌ Highlight injection error:', e.message);
          }
        })();
      `;
      webviewRef.current?.injectJavaScript(script);

    } catch (err) {
      console.log('❌ Highlight Error:', err);
    }
  };
  const handleFeatureClick = async (
    coordinate: [number, number],
    resolution: number,
    projection: string
  ) => {
    try {
      setIsFetching(true);
      const activeLayers = getActiveLayers();

      if (!activeLayers || activeLayers.length === 0) {
        showAlert("No Active Layers", "Please enable at least one layer.", 'warning');
        return;
      }

      let featureFound = false;
      setLastClickedMapCoord(coordinate);
      setIsEditing(false);

      for (const layerObj of activeLayers) {
        try {
          const layerName = layerObj.name;
          const layerAlias = layerObj.alias || layerObj.name;

          if (!layerObj.wmsConfig) {
            console.log(`⚠️ No wmsConfig for: ${layerName}`);
            continue;
          }

          console.log(`🔍 Querying: ${layerName}`);

          const { url, params } = layerObj.wmsConfig;
          const size = 256;
          const halfSize = size / 2;
          const bufferPixels = 400;

          const minX = coordinate[0] - (resolution * bufferPixels);
          const minY = coordinate[1] - (resolution * bufferPixels);
          const maxX = coordinate[0] + (resolution * bufferPixels);
          const maxY = coordinate[1] + (resolution * bufferPixels);
          const bbox = `${minX},${minY},${maxX},${maxY}`;

          const pixelX = Math.floor(halfSize);
          const pixelY = Math.floor(halfSize);

          const urlParams = new URLSearchParams({
            REQUEST: 'GetFeatureInfo',
            QUERY_LAYERS: layerAlias,
            SERVICE: 'WMS',
            VERSION: '1.1.1',
            FORMAT: 'image/png',
            STYLES: '',
            TRANSPARENT: 'TRUE',
            tiled: 'true',
            exceptions: 'application/vnd.ogc.se_inimage',
            LAYERS: layerAlias,
            viewparams: `proj_id:${project_id}`,
            INFO_FORMAT: 'application/json',
            X: pixelX.toString(),
            Y: pixelY.toString(),
            WIDTH: size.toString(),
            HEIGHT: size.toString(),
            SRS: projection,
            BBOX: bbox
          });

          const featureInfoUrl = `${url}?${urlParams.toString()}`;
          const proxyUrl = featureInfoUrl.replace(
            /http:\/\/.*?\/geoserver/,  // Match the original GeoServer URL
            `${URLS.BASE_URL_Prod}/geoserver`  // Replace with your proxy
          );


          console.log(`📡 Fetching: ${proxyUrl}`);

          // const res = await fetch(proxyUrl, {
          //   headers: {
          //     'Authorization': `Bearer ${token}`,
          //     'Content-Type': 'application/json'
          //   }
          // });



          const res = await secureGeoServerFetch(proxyUrl, token);
          if (!res.ok) {
            console.log(`❌ HTTP ${res.status} for ${layerName}`);
            continue;
          }

          const data = await res.json();

          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            const properties = feature.properties || {};
            const featureId = properties.feature_id || properties.id || feature.id;

            console.log(`✅ Found Feature ID: ${featureId} in ${layerName}`);
            setCurrentFeatureContext({
              layerName: layerAlias,
              featureId: featureId.toString()
            });
            // Fetch enriched data
            const response = await fetchFeatureInfoUpdated({
              layerName: layerAlias,
              featureId: featureId.toString()
            });
            console.log("📊 Enriched Feature Info:", response);
            setImage_limit(response?.image_limit);
            highlightClickedFeature(layerAlias, featureId);

            if (response && response.geometryData && response.geometryData.length > 0) {
              const firstGeom = response.geometryData[0];
              const calculatedStatusId =
                firstGeom.st_id ||         // <--- Add this for STP
                firstGeom.status_id ||
                firstGeom.id_st ||
                firstGeom.wimg_fk_wists_id ||
                2;
              setActiveTab('attributes');
              setCurrentLayer(layerAlias);
              setSelectedFeature({
                basic: firstGeom,
                name: firstGeom.labelname || firstGeom.label || firstGeom.wimg_label || 'Feature Details',
                areaName: firstGeom.area_name || '',
                featureType: detectFeatureKind({ basic: firstGeom, ...response }),
                displayAttributes: getDisplayAttributes({ basic: firstGeom, ...response }),
                geomStatusList: response.geomStatusList || [],
                rawResponse: response,
                userName: response.use_name,
                status: {
                  id: calculatedStatusId,
                  name: response.geomStatusList?.find((s: any) =>
                    s.wists_id === calculatedStatusId
                  )?.wists_name || 'Pending'
                }
              });
              setSearchQuery('');
              setFeatureImages(extractImageUrls(response));
              console.log("📸 Extracted Images:", featureImages.length);

              // ── Load remarks via history API (consistent across all layers) ──
              // extractRemarks(response) relied on response.remark[] which is
              // missing/empty for tank and some other layers. fetchRemarkHistory
              // is the single source of truth used by all other remark flows.
              setFeatureRemarks([]); // clear stale remarks while loading
              try {
                const remarkRes = await fetchRemarkHistory({
                  isFeature: true,
                  isUnit: false,
                  isSubActivity: false,
                  feature_id: featureId,
                });
                if (remarkRes?.data?.remarkData) {
                  const formatted = remarkRes.data.remarkData.map(
                    (item: any, index: number) => ({
                      id: `history-${index}-${Date.now()}`,
                      user: item.created_by || 'Unknown',
                      text: item.remark || '',
                      date: item.created_at,
                    })
                  );
                  setFeatureRemarks(formatted);
                }
              } catch (remarkErr) {
                console.log('⚠️ Failed to load initial remarks:', remarkErr);
                // Fall back to what the feature info response has
                setFeatureRemarks(extractRemarks(response));
              }

              bottomSheetRef.current?.expand();

              featureFound = true;
              break;
            }
          }
        } catch (error) {
          console.log(`❌ Layer ${layerObj.name} check failed:`, error.message);
        }
      }

      if (!featureFound) {
        console.log("📍 Clicked empty area.");
      }
    } catch (error) {
      console.error("FeatureInfo main error:", error);
    }
    finally {
      setIsFetching(false);
    }
  };

const handleLengthExceeded = (newTotal: number, limit: number, onConfirm: () => void) => {
  suppressSheetCloseReset.current = true;
  bottomSheetRef.current?.close();

  setTimeout(() => {
    showAlert(
      "Exceeds Pipeline Length",
      `Total Excavation Length: ${newTotal.toFixed(2)} m\nPipeline Length: ${limit.toFixed(2)} m\n\nCumulative Pipeline Length (${newTotal.toFixed(2)} m) is exceeding Pipeline Length (${limit.toFixed(2)} m). Do you still want to continue?`,
      'warning',
      [
        { text: "Cancel", style: "cancel", onPress: () => bottomSheetRef.current?.expand() },
        { text: "Confirm", style: "destructive", onPress: () => { onConfirm(); bottomSheetRef.current?.expand(); } }
      ],
      { cancelable: false }
    );
  }, 300);
};
  
  // ✅ NEW: Direct refresh using stored context
  const refreshCurrentFeature = async () => {
    if (!currentFeatureContext) {
      console.warn("⚠️ No feature context available for refresh");
      return false;
    }

    try {
      console.log("🔄 Refreshing feature:", currentFeatureContext);

      const response = await fetchFeatureInfoUpdated({
        layerName: currentFeatureContext.layerName,
        featureId: currentFeatureContext.featureId
      });

      if (response && response.geometryData && response.geometryData.length > 0) {
        const firstGeom = response.geometryData[0];
        const calculatedStatusId =
          firstGeom.st_id ||         // <--- Add this for STP
          firstGeom.status_id ||
          firstGeom.id_st ||
          firstGeom.wimg_fk_wists_id ||
          2;
        // ✅ Update the feature with fresh data
        setSelectedFeature({
          basic: firstGeom,
          areaName: firstGeom.area_name || '',
          name: firstGeom.labelname || firstGeom.label || firstGeom.wimg_label || 'Feature Details',
          featureType: detectFeatureKind({ basic: firstGeom, ...response }),
          displayAttributes: getDisplayAttributes({ basic: firstGeom, ...response }),
          geomStatusList: response.geomStatusList || [],
          rawResponse: response,
          userName: response.use_name,
          status: {
            id: calculatedStatusId,
            name: response.geomStatusList?.find((s: any) =>
              s.wists_id === calculatedStatusId
            )?.wists_name || 'Pending'
          }
        });

        setFeatureImages(extractImageUrls(response));
        await refreshKPI();
        await refreshVerificationData();
        // ✅ Refresh remarks from API
        try {
          const historyRes = await fetchRemarkHistory({
            isFeature: true,
            isUnit: false,
            isSubActivity: false,
            feature_id: currentFeatureContext.featureId,
          });

          if (historyRes?.data?.remarkData) {
            const formattedRemarks = historyRes.data.remarkData.map((item: any, index: number) => ({
              id: `history-${index}-${Date.now()}`,
              user: item.created_by || 'Unknown',
              text: item.remark || '',
              date: item.created_at,
            }));

            setFeatureRemarks(formattedRemarks);
            webviewRef.current?.injectJavaScript(`
              Object.keys(wmsLayers).forEach(key => {
                const source = wmsLayers[key].getSource();
                if (source && typeof source.updateParams === 'function') {
                  source.updateParams({ 'VERSION': '1.1.1', 't': Date.now() });
                }
              });
            `);
          }
        } catch (historyErr) {
          console.log('⚠️ Failed to refresh remarks:', historyErr);
        }

        console.log("✅ Feature refreshed successfully");
        return true;
      } else {
        console.warn("⚠️ No data returned from refresh");
        return false;
      }
    } catch (error: any) {
      console.error("❌ Refresh failed:", error);
      showAlert(
        "Refresh Error",
        "Could not reload feature data. Please try again.",
        "error",
        [
          {
            text: "OK",
            onPress: () => { }   // or hideAlert if needed
          }
        ]
      );
      return false;
    }
  };

  const handleAddSheetLink = (newUrl: string) => {
    if (!newUrl) return;
    const newLink = {
      wigsl_id: Date.now(), // Temporary ID for UI
      wigsl_googlesheet_link: newUrl,
      wigsl_createdat: new Date().toISOString(),
    };

    setEditedAttributes(prev => ({
      ...prev,
      sheet_links: [...(prev.sheet_links || selectedFeature.rawResponse?.sheet_links || []), newLink]
    }));
  };

  // Function to add a new Camera Link
  const handleAddCameraLink = (newUrl: string) => {
    if (!newUrl) return;
    const newLink = {
      wicl_id: Date.now(),
      wicl_camera_link: newUrl,
      wicl_tags: '', // Initialize empty tags
      isNew: true,
      isDraft: true,
    };

    setEditedAttributes(prev => ({
      ...prev,
      camera_links: [...(prev.camera_links || selectedFeature.rawResponse?.camera_links || []), newLink]
    }));
  };

  const normalizeToAbsolute = (path: string | undefined | null) => {
    if (!path) return null;
    let p = String(path).trim();
    if (!p) return null;

    // 1. If it's a full S3 URL but contains the broken /./ sequence
    if (p.startsWith('http')) {
      // Remove any occurrences of /./ in the URL
      p = p.replace(/\/(\.\/)+/g, '/');
      return p;
    }

    // 2. Handle local relative paths
    const base = URLS.BASE_URL.replace(/\/$/, '');
    p = p.replace(/^\.\//, ''); // Strip leading ./

    if (p.startsWith('/')) return `${base}${p}`;
    console.log("My image URL:", `${base}/${p}`);
    return `${base}/${p}`;
  };

  // REPLACE the existing extractImageUrls function:
  const extractImageUrls = (source: any): string[] => {
    if (!source || !Array.isArray(source.image_date)) return [];

    const sortedImages = [...source.image_date].sort((a, b) => {
      const idDiff = (b.wiiu_id || 0) - (a.wiiu_id || 0);
      if (idDiff !== 0) return idDiff;
      return new Date(b.wiiu_updatedat || 0).getTime() -
        new Date(a.wiiu_updatedat || 0).getTime();
    });

    return sortedImages
      .filter(item => item?.wiiu_path)
      .map(item => {
        const abs = normalizeToAbsolute(item.wiiu_path);
        return `${abs}?t=${new Date(item.wiiu_updatedat).getTime()}&id=${item.wiiu_id}`;
      });
  };

  const extractRemarks = (source: any): Array<{ id: string, text: string, user: string, timestamp: Date }> => {
    const out: any[] = [];
    if (!source) return out;

    if (Array.isArray(source.remark)) {
      for (const r of source.remark) {
        if (typeof r === 'object' && r.remark) {
          out.push({
            id: Date.now() + Math.random().toString(),
            text: r.remark,
            user: r.created_by || 'Unknown User',
            date: r.created_at || '',
          });
        }
      }
    }

    return out;
  };


  const toggleWmsLayer = async (layer: any, manualToggle = false) => {
    try {
      const newVisibility = manualToggle ? !layer.visible : true;

      // ── TURN OFF ──
      // ── TURN OFF ──
      //     if (manualToggle && layer.visible) {
      //       webviewRef.current?.injectJavaScript(`
      //   (function() {
      //     if (wmsLayers['${layer.id}']) {
      //       map.removeLayer(wmsLayers['${layer.id}']);
      //       delete wmsLayers['${layer.id}'];
      //     }
      //   })();
      //   true;
      // `);

      //       const conflictId = getConflictingLayerId(layer.id);

      //       setLayers(prev => {
      //         const updated = prev.map(l => (l.id === layer.id ? { ...l, visible: false } : l));

      //         if (conflictId) {
      //           const pairedLayer = updated.find(l => l.id === conflictId);
      //           if (pairedLayer && !pairedLayer.visible) {
      //             // Use setTimeout so state has settled before toggling paired layer
      //             setTimeout(() => toggleWmsLayer(pairedLayer, false), 300);
      //           }
      //         }

      //         return updated;
      //       });

      //       return;
      //     }

      if (manualToggle && layer.visible) {
        webviewRef.current?.injectJavaScript(`
      (function() {
        if (wmsLayers['${layer.id}']) {
          map.removeLayer(wmsLayers['${layer.id}']);
          delete wmsLayers['${layer.id}'];
        }
      })();
      true;
    `);

        setLayers(prev =>
          prev.map(l => (l.id === layer.id ? { ...l, visible: false } : l))
        );

        return;
      }
      // ── TURN ON ──

      // 1. Turn off conflicting layer first (synchronously remove from map)
      const conflictId = getConflictingLayerId(layer.id);
      if (conflictId) {
        webviewRef.current?.injectJavaScript(`
          (function() {
            if (wmsLayers['${conflictId}']) {
              map.removeLayer(wmsLayers['${conflictId}']);
              delete wmsLayers['${conflictId}'];
              console.log('Removed conflicting layer: ${conflictId}');
            }
          })();
          true;
        `);

        // Update conflicting layer state to OFF immediately
        setLayers(prev => prev.map(l => (l.id === conflictId ? { ...l, visible: false } : l)));
      }

      // 2. Get or fetch WMS config
      let config = layer.wmsConfig;
      if (!config) {
        const configData = await fetchLayerConfig(
          layer.alias || layer.name,
          project_id,
          token
        );
        config = configData.config;
        layersConfigRef.current.set(layer.name, config);
      }

      // 3. Get a valid map token
      const currentMapToken = await mapTokenService.getValidMapToken(token);

      // 4. Push token into WebView and call addWMS
      const { url, params, serverType } = config;

      const script = `
        (function() {
          if (typeof window.updateMapToken === 'function') {
            window.updateMapToken('${currentMapToken}');
          } else {
            window._currentMapToken = '${currentMapToken}';
          }
          if (typeof addWMS === 'function') {
            addWMS({
              layerId: '${layer.id}',
              url: '${url}',
              params: ${JSON.stringify(params)},
              serverType: '${serverType || 'geoserver'}'
            });
            console.log('Layer added to map: ${layer.id}');
          } else {
            console.error('addWMS not defined yet');
          }
        })();
        true;
      `;

      webviewRef.current?.injectJavaScript(script);

      // 5. Update React state - include wmsConfig so it's cached
      setLayers(prev =>
        prev.map(l =>
          l.id === layer.id ? { ...l, visible: true, wmsConfig: config } : l
        )
      );
    } catch (error: any) {
      console.error('Layer toggle error:', error);
      if (manualToggle) {
        showAlert('Error', 'Could not load map layer', 'error');
        setLayers(prev =>
          prev.map(l => (l.id === layer.id ? { ...l, visible: false } : l))
        );
      }
    }
  };

  const handleZoomIn = () => webviewRef.current?.injectJavaScript(`handleRNMessage({ data: JSON.stringify({ type: 'ZOOM_IN' }) });`);
  const handleZoomOut = () => webviewRef.current?.injectJavaScript(`handleRNMessage({ data: JSON.stringify({ type: 'ZOOM_OUT' }) });`);
  const handleZoomToFit = () => {
    if (extent && extent.bbox) {
      const { minx, miny, maxx, maxy } = extent.bbox;

      const message = JSON.stringify({
        type: 'RESET_VIEW',
        payload: { minx, miny, maxx, maxy }
      });

      webviewRef.current?.injectJavaScript(`
        if (window.handleRNMessage) {
          handleRNMessage({ data: '${message}' });
        } else {
          // Fallback if event listener isn't ready
          window.dispatchEvent(new MessageEvent('message', { data: '${message}' }));
        }
      `);
    } else {
      showAlert("Notice", "Project boundary data is still loading.", 'warning');
    }
  };
  const handleLocate = async () => {
    try {
      // 1️⃣ Permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission denied', '', 'warning');
        return;
      }

      // 2️⃣ FAST: Get last known location (instant)
      const lastLocation = await Location.getLastKnownPositionAsync();

      if (lastLocation) {
        const { latitude, longitude } = lastLocation.coords;
        sendLocationToMap(latitude, longitude);
      }

      // 3️⃣ ACCURATE: Watch for better GPS fix
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced, // 👈 optimal
          timeInterval: 1000,
          distanceInterval: 5
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          sendLocationToMap(latitude, longitude);

          // Stop after first accurate fix
          subscription.remove();
        }
      );

    } catch (error) {
      showAlert('Error', 'Unable to fetch location', 'error');
    }
  };
  const sendLocationToMap = (lat: number, lon: number) => {
    webviewRef.current?.injectJavaScript(`
        handleRNMessage({
          data: JSON.stringify({
            type: 'SHOW_MY_LOCATION',
            payload: { lat: ${lat}, lon: ${lon} }
          })
        });
      `);
  };


  const handleAllLayersToggle = async () => {
    const allCurrentlyOn = layers.every(l => l.visible);
    const newState = !allCurrentlyOn;

    // Update UI immediately
    setLayers(prev => prev.map(l => ({ ...l, visible: newState })));

    // Then update map
    if (newState) {
      // Turn all ON
      for (const layer of layers) {
        if (!layer.visible) {
          await toggleWmsLayer(layer, false);
        }
      }
    } else {
      // Turn all OFF
      const script = layers.map(layer => `
        if (wmsLayers['${layer.id}']) {
          map.removeLayer(wmsLayers['${layer.id}']);
          delete wmsLayers['${layer.id}'];
        }
      `).join('\n');

      webviewRef.current?.injectJavaScript(script);
    }
  };
  const handleSelectAllToggle = (value: boolean) => {
    if (value) {
      // Select all
      setSelectedFeatureIds(verificationFeatures.map(f => f.id));
    } else {
      // Deselect all
      setSelectedFeatureIds([]);
    }
  };
  const activeCategoryRef = useRef<string | null>(activeCategory);
  useEffect(() => {
    activeCategoryRef.current = activeCategory;
  }, [activeCategory]);

  useEffect(() => {
    if (!token || !project_id) return;

    // ✅ Block duplicate calls caused by token rotation on same project
    // Allow through: genuine project change OR showVerified toggle
    const guardKey = `${project_id}-${showVerified}-${token?.slice(-8)}`;
    if (verifInitRef.current === guardKey) return;
    verifInitRef.current = guardKey;

    verifCallCountRef.current += 1;
    console.log(`🟢 verif called #${verifCallCountRef.current} | project: ${project_id} | showVerified: ${showVerified}`);

    setLoadingFeatures(true);

    fetchVerificationFeatures(showVerified, token)
      .then((data) => {
        setVerificationLayers(data.layers || []);

        const currentCategory = activeCategoryRef.current;

        if (!currentCategory && data.layers?.length > 0) {
          setActiveCategory(data.layers[0].layer_id);
          setVerificationFeatures(data.layers[0].features || []);
        } else {
          const selectedLayer = data.layers?.find(
            (l: any) => l.layer_id === currentCategory
          );
          setVerificationFeatures(selectedLayer?.features || []);
        }
      })
      .finally(() => setLoadingFeatures(false));
  }, [token, project_id, showVerified]);


  // useEffect(() => {
  //   if (!token) return;

  //   setLoadingFeatures(true);

  //   fetchVerificationFeatures(true, token)
  //     .then((data) => {
  //       console.log("Verification API Data:", data);

  //       setVerificationLayers(data.layers || []);

  //       if (data.layers?.length > 0) {
  //         setActiveCategory(data.layers[0].layer_id);
  //         setFeatures(data.layers[0].features || []);
  //       }

  //       // ✅ Set first layer as default
  //       if (data.layers?.length > 0) {
  //         setActiveCategory(data.layers[0].layer_id);
  //         setFeatures(data.layers[0].features || []);
  //       }
  //     })
  //     .catch(console.error)
  //     .finally(() => setLoadingFeatures(false));
  // }, [token]);

  useEffect(() => {
    if (!activeCategory || verificationLayers.length === 0) return;

    // Find the layer object that matches the new active category
    const selectedLayer = verificationLayers.find(
      (layer) => layer.layer_id === activeCategory
    );

    // Directly update the features list to be displayed in the modal
    if (selectedLayer) {
      setVerificationFeatures(selectedLayer.features || []);
    }
  }, [activeCategory, verificationLayers]);
  const initDataCalledRef = useRef<number | null>(null);
  const verifInitRef = useRef<number | null>(null);
  useEffect(() => {
    if (!project_id) return;
    console.log(`🔁 Project changed to ${project_id} — resetting all guards`);

    // Reset all guards
    initDataCalledRef.current = null;
    verifInitRef.current = null;
    layersLoadedRef.current = false;
    hasInitialZoomed.current = false;

    // Reset data states
    setLayers([]);
    setKpiData(null);
    setSelectedFeature(null);
    setVerificationData(null);
    setVerificationLayers([]);
    setVerificationFeatures([]);
    setExtent(null);
    setSearchQuery('');
    // ── ADD THESE ──
    setIsMapReady(false);
    setIsMapLoading(true);
    setMapTokenReady(false);
    bottomSheetRef.current?.close();
    setActiveTab('attributes');
    setIsEditing(false);
    setEditedAttributes({});
    setCapturedImage(null);
    setFeatureImages([]);
    setFeatureRemarks([]);
    setCurrentLayer('');
    setCurrentFeatureContext(null);
    setLastClickedMapCoord(null);
    setSubactivities([]);
    setUnitWeightage([]);
    setExpandedUnitId(null);
    setExpandedUnitCardId(null);
    setUnitImagesMetaMap({});
    setSubImagesMetaMap({});
    setFailedImages({});
    setPlanAlertShown(false);
    webviewRef.current?.reload();

  }, [project_id]);
  useEffect(() => {
    if (!token || !project_id) return;

    // ✅ Guard on project_id only — token rotates on every project switch
    const initKey = `${project_id}-${token?.slice(-8)}`;
    if (initDataCalledRef.current === initKey) return;
    initDataCalledRef.current = initKey;

    let isMounted = true;

    const initData = async () => {
      initCallCountRef.current += 1;
      console.log(`🔴 initData called #${initCallCountRef.current} | token_tail: ${token?.slice(-8)} | project: ${project_id}`);

      setLoadingLayers(true);
      try {
        const res = await getLayers(token);
        if (!isMounted) return;
        setPipeline_by_types(res?.pipeline_by_types);
        console.log(`📊 Layers API returned`, pipeline_by_types);
        const formatted: any[] = [];
        for (const l of res.layers) {
          if (!isMounted) break;

          if (!l.isdefaultshown) {
            formatted.push({
              id: l.layer_id.toString(),
              name: l.layer_name || '',
              alias: l.layer_alias || l.layer_name || '',
              visible: false,
              color: l.color || '#3B82F6',
              wmsConfig: null  // No config fetched, will be fetched on demand when toggled ON
            });
            continue;
          }

          try {
            if (formatted.length > 0) {
              await new Promise(resolve => setTimeout(resolve, 150));
            }

            const configRes = await fetchLayerConfig(
              l.layer_alias || l.layer_name,
              project_id,
              token
            );

            formatted.push({
              id: l.layer_id.toString(),
              name: l.layer_name || '',
              alias: l.layer_alias || l.layer_name || '',
              visible: l.isdefaultshown ?? true,
              color: l.color || '#3B82F6',
              wmsConfig: configRes?.config || null
            });
          } catch (err: any) {
            console.warn(`Skipping layer "${l.layer_name}" — config unavailable:`, err.message);
            formatted.push({
              id: l.layer_id.toString(),
              name: l.layer_name || '',
              alias: l.layer_alias || l.layer_name || '',
              visible: false,
              color: l.color || '#3B82F6',
              wmsConfig: null
            });
          }
        }

        if (!isMounted) return;
        setLayers(formatted.filter(l => l.name || l.alias));

        const kpiRes = await fetchKPI(token);
        if (!isMounted) return;
        setKpiData(kpiRes);

      } catch (e) {
        if (isMounted) showAlert("Error", "Failed to load dashboard data", 'error');
      }

      if (isMounted) setLoadingLayers(false);
    };

    initData();

    return () => {
      isMounted = false;
      // initDataCalledRef.current = null;
    };
  }, [token, project_id]);
  // Auto-load WMS layers once Map is Ready
  useEffect(() => {
    if (!isMapReady || !mapTokenReady || layers.length === 0) return;
    if (layersLoadedRef.current) return;
    const visibleLayers = layers.filter(l => l.visible && l.wmsConfig);
    if (visibleLayers.length === 0) return;
    layersLoadedRef.current = true;
    let cancelled = false;

    const loadLayers = async () => {
      try {
        // Get the current valid token once
        const mapToken = mapTokenService.getMapToken();
        if (!mapToken) {
          console.warn('⚠️ No map token available at load time');
          return;
        }

        // Push token into WebView once before any layer loads
        webviewRef.current?.injectJavaScript(
          `(function(){ window.updateMapToken('${mapToken}'); })(); true;`
        );

        // Small buffer to ensure the WebView processes the token update
        // before the first addWMS call fires
        await new Promise(resolve => setTimeout(resolve, 300));

        if (cancelled) return;

        // Load layers one by one — each call is now atomic (token + addWMS together)
        for (const l of visibleLayers) {
          if (cancelled) break;
          await toggleWmsLayer(l, false);
          // Brief pause between layers so the WebView message queue doesn't back up
          await new Promise(resolve => setTimeout(resolve, 150));
        }
      } catch (err) {
        console.error('Auto-load layers failed:', err);
      }
    };

    loadLayers();

    return () => {
      cancelled = true;
      layersLoadedRef.current = false;
    };
  }, [isMapReady, mapTokenReady, layers.length]);

  // --- Render ---
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<number[]>([]);
  const allSelected =
    verificationFeatures.length > 0 &&
    selectedFeatureIds.length === verificationFeatures.length;

  const handlePickImageForSubActivity = async (unitId: number, subactivityId: number) => {
    const subImgCount = (subImagesMetaMap[subactivityId] || []).length;
    if (image_limit && subImgCount >= image_limit) {
      showAlert("Limit Reached", `You can upload only ${image_limit} images for this feature.`, 'warning');
      return;
    }
    const asset = await pickImageSource();
    if (!asset) return;
    if (subactivityId > 1000000000) {
      showAlert(
        "Save Required",
        "This is a new sub-activity. Please click 'Save Sub-Activities' first to register it before uploading an image.",
        'warning'
      );
      return;
    }
    try {
      setIsSaving(true);
      const featId = selectedFeature.basic.id || selectedFeature.basic.feature_id;
      const processedAsset = await processImage(asset.uri);
      // const stampedUri = await stampImageWithLocation(processedAsset.uri);
      const stampedUri = asset.source === 'camera'
        ? await stampImageWithLocation(processedAsset.uri)
        : processedAsset.uri;
      const payload: UploadSubActivityImagePayload = {
        unit_id: unitId,
        feature_id: featId,
        subactivityId: subactivityId,
        locationdata: "",
        location_error: "",
        file: {
          uri: stampedUri,
          name: asset.fileName || `sub_${subactivityId}.jpg`,
          type: asset.mimeType || 'image/jpeg'
        }
      };
      const response = await uploadSubActivityImage(payload);
      if (response.status === true) {
        showAlert("Success", "Sub-activity image uploaded.", 'success');
        await refreshCurrentFeature();

      }
    } catch (error: any) {
      showAlert("Upload Failed", error.message, 'error');
    }
    finally {
      setIsSaving(false);
    }
  };

  const handlePickImageForUnit = async (unitId: number) => {
    const unitImgCount = (unitImagesMetaMap[unitId] || []).length;
    if (image_limit && unitImgCount >= image_limit) {
      showAlert("Limit Reached", `You can only upload up to ${image_limit} images for this feature.`, 'warning');
      return;
    }
    const asset = await pickImageSource();
    if (!asset) return;

    try {
      setIsSaving(true);
      console.log(`📸 Starting upload for Unit: ${unitId}`);
      const featId = selectedFeature.basic.id || selectedFeature.basic.feature_id;
      const processedAsset = await processImage(asset.uri);
      // const stampedUri = await stampImageWithLocation(processedAsset.uri);
      const stampedUri = asset.source === 'camera'
        ? await stampImageWithLocation(processedAsset.uri)
        : processedAsset.uri;
      const payload: UploadUnitImagePayload = {
        unit_id: unitId,
        feature_id: featId,
        locationdata: "",
        location_error: "",
        file: {
          uri: stampedUri,
          name: asset.fileName || `unit_${unitId}.jpg`,
          type: asset.mimeType || 'image/jpeg'
        }
      };

      const response = await uploadUnitImage(payload);
      if (response.status === true) {
        showAlert("Success", "Unit image uploaded.", 'success');
        await refreshCurrentFeature();
      }
    } catch (error: any) {
      showAlert("Upload Failed", error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };


  const handleViewUnitImage = async (unitId: number) => {
    try {
      const response = await getUnitImage(unitId);

      if (response.data && response.data.length > 0) {
        const items = response.data.filter((item: any) => item.file_path);
        const paths = items.map((item: any) => item.file_path);

        if (paths.length > 0) {
          // Cache full objects for gallery metadata display
          setUnitImagesMetaMap(prev => ({ ...prev, [unitId]: items }));

          setUnitImages(paths);
          setCurrentImageIndex(0);
          setSelectedImage(paths[0]);
          setShowImageModal(true);
          setModalImageContext({ type: 'unit', unitId });

        } else {
          showAlert("Notice", "No image path found for this unit.", 'error');
        }
      }
    } catch (error: any) {
      showAlert("Error", error.message || "Could not retrieve unit images.", 'error');
    }
  };



  const handleViewSubImage = async (subactivity_id: number) => {
    try {
      const response = await getSubImages(subactivity_id);

      if (response.data && response.data.length > 0) {
        const items = response.data.filter((item: any) => item.file_path);
        const paths = items.map((item: any) => item.file_path);

        if (paths.length > 0) {
          // Cache full objects for gallery metadata display
          setSubImagesMetaMap(prev => ({ ...prev, [subactivity_id]: items }));

          setUnitImages(paths);
          setCurrentImageIndex(0);
          setSelectedImage(paths[0]);
          setShowImageModal(true);
          setModalImageContext({ type: 'sub', subId: subactivity_id });

        } else {
          showAlert("Notice", "No image path found for this unit.", 'warning');
        }
      }
    } catch (error: any) {
      showAlert("Error", error.message || "Could not retrieve unit images.", 'error');
    }
  };
  const pickImageSource = async () => {
    return new Promise((resolve) => {
      showAlert(
        "Select Image Source",
        "Choose how you want to upload the photo",
        "info",
        [
          {
            text: "Camera",
            onPress: async () => {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== 'granted') {
                showAlert('Permission Denied', 'Camera access is required.', 'error');
                resolve(null);
                return;
              }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.5,
              });
              if (result.canceled) { resolve(null); return; }
              resolve({ ...result.assets[0], source: 'camera' }); // ← tag source
            }
          },
          {
            text: "Gallery",
            onPress: async () => {
              try {
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.5,
                });
                if (result.canceled || !result.assets || result.assets.length === 0) {
                  resolve(null);
                  return;
                }
                resolve({ ...result.assets[0], source: 'gallery' }); // ← tag source
              } catch (error: any) {
                console.error("Gallery picker error:", error);
                showAlert('Error', 'Could not open gallery picker.', 'error');
                resolve(null);
              }
            }
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(null)
          }
        ]
      );
    });
  };
  const processImage = async (uri: string) => {
    // If project setting says NO compression, return original URI
    if (!isCompressImage) return { uri };

    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Resize to a standard width (HD)
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
      );
      return result;
    } catch (error) {
      console.error("Compression failed:", error);
      return { uri }; // Fallback to original if something goes wrong
    }
  };
  const stampImageWithLocation = (processedUri: string): Promise<string> => {
    return new Promise(async (resolve) => {

      // ✅ If geo tag disabled → return original image immediately
      if (!imageGeoTag) {
        resolve(processedUri);
        return;
      }

      // ✅ If geo tag enabled → stamp and return stamped image
      try {
        let location = null;
        try {
          location = await getCurrentLocation();
        } catch (e) {
          resolve(processedUri);
          return;
        }

        const base64 = await FileSystem.readAsStringAsync(processedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const lat = location.lat.toFixed(6);
        const lng = location.lng.toFixed(6);
        const acc = Math.round(location.accuracy);

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const timestamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        const line1 = `lat: ${lat}  long: ${lng}  accuracy: ${acc}m`;
        const line2 = `timestamp: ${timestamp}`;

        pendingStampResolveRef.current = resolve;

        const script = `
          if (window.drawWatermark) {
            window.drawWatermark(
              "data:image/jpeg;base64,${base64}",
              "${line1}",
              "${line2}"
            );
          }
          true;
        `;
        webviewRef.current?.injectJavaScript(script);

        setTimeout(() => {
          if (pendingStampResolveRef.current === resolve) {
            pendingStampResolveRef.current = null;
            resolve(processedUri);
          }
        }, 10000);

      } catch (err) {
        resolve(processedUri);
      }
    });
  };


  const handlePickImage = async () => {
    if (!isEditing) return;
    if (image_limit && featureImages.length >= image_limit) {
      showAlert("Limit Reached", `You can only upload up to ${image_limit} images for this feature.`, 'warning');
      return;
    }
    const asset = await pickImageSource();
    if (asset) {
      setIsSaving(true);
      try {
        const processedAsset = await processImage(asset.uri);
        // const finalUri = await stampImageWithLocation(processedAsset.uri);
        const finalUri = asset.source === 'camera'
          ? await stampImageWithLocation(processedAsset.uri)
          : processedAsset.uri;
        setCapturedImage({
          uri: finalUri,
          mimeType: 'image/jpeg',
          fileName: `img_${Date.now()}.jpg`
        });
        setIsSaving(false);

      } catch (err) {
        console.log("Image processing error:", err);
        setIsSaving(false);
      }
    }
  };
  // const handlePickImage = async () => {
  //   if (!isEditing) return;

  //   const asset = await pickImageSource();
  //   if (asset) {
  //     setIsSaving(true); // Keep loader on while stamping
  //     try {
  //       const processedAsset = await processImage(asset.uri);

  //       let location = null;
  //       try {
  //         location = await getCurrentLocation();
  //       } catch (e) { location = null; }

  //       if (!location) {
  //         setCapturedImage(processedAsset);
  //         setIsSaving(false);
  //         return;
  //       }

  //       const base64 = await FileSystem.readAsStringAsync(processedAsset.uri, {
  //         encoding: FileSystem.EncodingType.Base64,
  //       });
  //       const lat = location.lat.toFixed(6);
  //       const lng = location.lng.toFixed(6);
  //       const acc = Math.round(location.accuracy);
  //       const localArea = location.localArea;

  //       const line1 = `lat: ${lat}  long: ${lng}  accuracy: ${acc}m`;
  //       const line2 = `location: ${localArea.replace(/"/g, "'")}`; // Using 'location:' label

  //       const script = `
  //           if (window.drawWatermark) {
  //               window.drawWatermark(
  //                   "data:image/jpeg;base64,${base64}",
  //                   "${line1}",
  //                   "${line2}"
  //               );
  //           }
  //           true;
  //       `;

  //       webviewRef.current?.injectJavaScript(script);
  //       // setCapturedLocation(location);
  //       // ❌ DO NOT setCapturedImage here. Wait for the message back from WebView.
  //       webviewRef.current?.injectJavaScript(script);

  //     } catch (err) {
  //       console.log("Image processing error:", err);
  //       setIsSaving(false);
  //     }
  //   }
  // };
  const refreshKPI = async () => {
    try {
      const kpiRes = await fetchKPI(token);
      setKpiData(kpiRes);
    } catch (e) {
      console.warn('KPI refresh failed:', e);
    }
  };
  const refreshVerificationData = async () => {
    try {
      const data = await fetchVerificationFeatures(showVerified, token);
      setVerificationLayers(data.layers || []);
      if (activeCategory) {
        const selectedLayer = data.layers?.find((l: any) => l.layer_id === activeCategory);
        setVerificationFeatures(selectedLayer?.features || []);
      } else if (data.layers?.length > 0) {
        setActiveCategory(data.layers[0].layer_id);
        setVerificationFeatures(data.layers[0].features || []);
      }
    } catch (err) {
      console.warn('Verification refresh failed:', err);
    }
  };
  const handleSavePipelineDetails = async () => {
    try {
      setIsSaving(true);
      const currentStatusId = editedAttributes.status_id || selectedFeature.status.id;
      const isCompleted = currentStatusId === 1;

      // Ensure we have a valid ID
      const featId = selectedFeature.basic.id ||
        selectedFeature.basic.feature_id ||
        selectedFeature.basic.wimg_id;

      if (!featId) {
        showAlert("Error", "Feature ID not found", 'error');
        return;
      }
      
      // ========== MANDATORY VALIDATION START ==========
      // resolvedActualLength is always derived from the max group-by length
      // when status is Complete. Dynamic attributes are saved first to ensure
      // savedValuesRef is up to date before getMaxGroupLength() is called.
      let resolvedActualLength: number | null = null;
      if (isCompleted) {
        // Step 1: Save dynamic attribute group entries first so the
        // savedValuesRef inside DynamicAttributePanel is fresh.
        try {
          await dynamicAttrRef.current?.triggerSave();
        } catch (dynErr) {
          // triggerSave already shows its own validation alert; stop here.
          setIsSaving(false);
          return;
        }

        // Step 2: Always derive Actual Length from the group-by type that has
        // the highest cumulative length — this overrides any manually typed value.
        const highestGroupLength = dynamicAttrRef.current?.getMaxGroupLength() ?? 0;
        const hasGroupData = dynamicAttrRef.current?.hasGroupAttributes?.() ?? false;
        
        if (highestGroupLength > 0) {
          resolvedActualLength = highestGroupLength;
          // Reflect the auto-resolved value in the UI field
          setEditedAttributes((prev: any) => ({ ...prev, adusdefln: String(highestGroupLength) }));
        } else if (hasGroupData) {
          showAlert(
            "Missing Information",
            "No group length entries found. Please add excavation/laying entries before marking this pipeline as Completed.",
            'info'
          );
          setIsSaving(false);
          return;
        } else {
          // No group attributes exist, so actual length must be manually entered
          const manualLength = parseFloat(String(editedAttributes.adusdefln || selectedFeature.basic?.usdeflen || '0'));
          if (isNaN(manualLength) || manualLength <= 0) {
            showAlert(
              "Missing Information",
              "Please enter a valid Actual Length before marking this pipeline as Completed.",
              'info'
            );
            setIsSaving(false);
            return;
          }
          resolvedActualLength = manualLength;
        }

        // 3. Check Image (capturedImage)
        // if (!capturedImage) {
        //   showAlert("Image Required", "A site photo is mandatory when marking a pipeline as Completed.", "info");
        //   return;
        // }
      }
      if (!capturedImage && featureImages.length === 0) {
        showAlert("Image Required", "At least one site photo is required to save this feature.", "info");
        return;
      }
      // ========== MANDATORY VALIDATION END ==========

      let imageFile = null;
      if (capturedImage) {
        const type = capturedImage.mimeType || capturedImage.type || 'image/jpeg';
        const extension = type.split('/')[1] || 'jpg';
        const filename = `img_${Date.now()}.${extension}`;
        let uri = capturedImage.uri;
        // React Native: ensure proper file:// prefix on Android
        if (Platform.OS === 'android' && !uri.startsWith('file://') && !uri.startsWith('content://')) {
          uri = 'file://' + uri;
        }
        imageFile = { uri, name: filename, type };
      }
      let currentLocationData: {
        accuracy: number;
        lat: number;
        lng: number;
        address: string;
      } | null = null;
      let currentLocationError = '';

      try {
        console.log('🌍 Starting location fetch (Pipeline)...');
        currentLocationData = await getCurrentLocation();
        console.log('✅ Pipeline location obtained:', currentLocationData);
      } catch (error) {
        currentLocationError = error instanceof Error ? error.message : String(error);
        console.error('❌ Pipeline location error:', currentLocationError);
      }
      let locationDataString = '';
      if (currentLocationData) {
        locationDataString = JSON.stringify({
          accuracy: Number(currentLocationData.accuracy) || 0,
          lat: Number(currentLocationData.lat),
          lng: Number(currentLocationData.lng),
          address:
            typeof currentLocationData.address === 'string'
              ? currentLocationData.address
              : JSON.stringify(currentLocationData.address || '')
        });

        console.log('📍 Pipeline location data:', locationDataString);
      }

      const remarkToSend = newRemark.trim();

      const payload = {
        layer_id: 1,
        featureId: featId,
        status_id: currentStatusId,
        adusdefln: isCompleted ? (resolvedActualLength ?? 0) : 0,
        locationdata: locationDataString,
        location_error: String(currentLocationError || ''),
        file: imageFile,
        remark: remarkToSend,
      };
      console.log("Pipeline payment:", payload)
      const response = await updatePipelineDetails(payload);



      if (response.status === true || response.status_code === "200") {
        // showAlert("Success", "Pipeline updated successfully",'success');
        if (newRemark.trim()) {
          await saveRemark({
            feature_id: featId,
            remark: newRemark.trim(),
            isFeature: "true",
            isUnit: "false",
            isSubActivity: "false",
            wilm_id: 1
          });
          setNewRemark('');
        }
        showToast("Pipeline saved successfully ✓");
        setIsEditing(false);
        setCapturedImage(null);
        setNewRemark('');
        await refreshCurrentFeature();

        // if (lastClickedMapCoord) {
        //   handleFeatureClick(
        //     lastClickedMapCoord,
        //     selectedFeature.rawResponse?.resolution || 0.17,
        //     "EPSG:3857"
        //   );
        // }
      }
    } catch (error: any) {
      showAlert("Error", error.message, 'error');
    }
    finally {
      setIsSaving(false);
    }
  };
  const handleSaveManholeDetails = async () => {
    try {
      setIsSaving(true);
      const targetStatusId = editedAttributes.status_id || selectedFeature.status.id;
      const isCompleted = targetStatusId === 1;
      const featId = selectedFeature.basic.id || selectedFeature.basic.wimg_id || selectedFeature.basic.feature_id;

      if (!featId) {
        showAlert("Error", "Feature ID not found", 'error');
        return;
      }

      // ========== MANDATORY VALIDATION START ==========
      // 1. Check Actual Depth (depthactul)
      const depthValRaw = editedAttributes.depthactul ?? selectedFeature.basic?.wimg_actual_depth;
      const parsedDepth = parseFloat(depthValRaw);
      if (isCompleted) {
        if (!depthValRaw || isNaN(parsedDepth) || parsedDepth <= 0) {
          showAlert(
            "Information Required",
            "Please enter a valid Actual Depth (numeric value > 0) to mark this Manhole as Completed.",
            "info"
          );
          return;
        }

        // 2. Check Image (capturedImage)
        // if (!capturedImage) {
        //   showAlert(
        //     "Image Required",
        //     "A site photo is mandatory when marking a Manhole as Completed.",
        //     "info"
        //   );
        //   return;
        // }
      }
      if (!capturedImage && featureImages.length === 0) {
        showAlert("Image Required", "At least one site photo is required to save this feature.", "info");
        return;
      }
      // ========== MANDATORY VALIDATION END ==========
      const imageToUpload = capturedImage ? {
        uri: capturedImage.uri,
        type: capturedImage.mimeType || capturedImage.type || 'image/jpeg',
        name: capturedImage.fileName || `manhole_${featId}.jpg`,
      } : null;
      const remarkToSend = newRemark.trim();
      let currentLocationData: {
        accuracy: number;
        lat: number;
        lng: number;
        address: string;
      } | null = null;
      let currentLocationError = '';

      try {
        console.log('🌍 Starting location fetch (Pipeline)...');
        currentLocationData = await getCurrentLocation();
        console.log('✅ Pipeline location obtained:', currentLocationData);
      } catch (error) {
        currentLocationError = error instanceof Error ? error.message : String(error);
        console.error('❌ Pipeline location error:', currentLocationError);
      }
      let locationDataString = '';
      if (currentLocationData) {
        locationDataString = JSON.stringify({
          accuracy: Number(currentLocationData.accuracy) || 0,
          lat: Number(currentLocationData.lat),
          lng: Number(currentLocationData.lng),
          address:
            typeof currentLocationData.address === 'string'
              ? currentLocationData.address
              : JSON.stringify(currentLocationData.address || '')
        });

        console.log('📍 Pipeline location data:', locationDataString);
      }
      const payload = {
        layer_id: 6,
        featureId: featId,
        status_id: targetStatusId,
        depthactul: isCompleted ? parseFloat(editedAttributes.depthactul ?? selectedFeature.basic?.wimg_actual_depth) : null,
        locationdata: locationDataString,
        location_error: String(currentLocationError || ''),
        file: imageToUpload,
        remark: remarkToSend,
        wimg_diameter: editedAttributes.wimg_diameter ?? selectedFeature.basic?.wimg_diameter ?? null,
        wimg_bottom_diameter: editedAttributes.wimg_bottom_diameter ?? selectedFeature.basic?.wimg_bottom_diameter ?? null,
        wimg_manhole_type: editedAttributes.wimg_manhole_type ?? selectedFeature.basic?.wimg_manhole_type ?? null,
        wimg_type_of_manhole: editedAttributes.wimg_type_of_manhole ?? selectedFeature.basic?.wimg_type_of_manhole ?? null,
        wimg_strata_type: editedAttributes.wimg_strata_type ?? selectedFeature.basic?.wimg_strata_type ?? null,
      };
      console.log("Manhole Payment:", payload);
      const response = await updateManholeDetails(payload);

      if (response.status === true || response.status_code === "200") {
        // showAlert("Success", "Manhole updated successfully");
        showToast("Manhole saved successfully ✓");
        if (newRemark.trim()) {
          await saveRemark({
            feature_id: featId,
            remark: newRemark.trim(),
            isFeature: "true",
            isUnit: "false",
            isSubActivity: "false",
            wilm_id: 6
          });
          setNewRemark('');
        }
        setIsEditing(false);
        setCapturedImage(null);
        setNewRemark('');

        await refreshCurrentFeature();
      } else {
        showAlert("Error", response.message || "Failed to update manhole", 'error');
      }
    } catch (error: any) {
      console.error("Save Error:", error);
      showAlert("Error", error.message || "An error occurred while saving", 'error');
    }
    finally {
      setIsSaving(false);
    }
  };

  const validateTankExecutionSequence = () => {
    const details = selectedFeature.rawResponse?.GeomDetails || [];

    for (let i = 0; i < details.length; i++) {
      const rowKey = `exec_${i}`;
      const rowData = editedAttributes[rowKey] || details[i];
      const statusId = rowData.wiusts_id;
      const excavation = parseFloat(rowData.excavation) || 0;
      const steel = parseFloat(rowData.steel) || 0;
      const concrete = parseFloat(rowData.concrete) || 0;

      const hasNonZeroValues = excavation > 0 || steel > 0 || concrete > 0;

      // Rule: If values exist, status must be Ongoing (2) or Completed (1)
      if (hasNonZeroValues && statusId === 3) {
        const stageName = selectedFeature.rawResponse?.execution_mastertable?.find(
          m => m.wies_id === details[i].ex_status_id
        )?.wies_name || `Row ${i + 1}`;

        showAlert(
          "Validation Error",
          `* Values are non zero in row: ${stageName}, so status must be selected either ongoing or completed.`,
          'error'
        );
        return false;
      }

      // Sequential Rule: Previous layer must be Completed or Ongoing
      if (i > 0) {
        const prevRowKey = `exec_${i - 1}`;
        const prevRowData = editedAttributes[prevRowKey] || details[i - 1];
        const prevStatusId = prevRowData.wiusts_id;

        // If current row is Ongoing or Completed, previous must be too
        if ((statusId === 1 || statusId === 2) && prevStatusId === 3) {
          const currentStageName = selectedFeature.rawResponse?.execution_mastertable?.find(
            m => m.wies_id === details[i].ex_status_id
          )?.wies_name || `Row ${i + 1}`;

          const prevStageName = selectedFeature.rawResponse?.execution_mastertable?.find(
            m => m.wies_id === details[i - 1].ex_status_id
          )?.wies_name || `Row ${i}`;

          showAlert(
            "Sequential Error",
            `Cannot complete "${currentStageName}" while "${prevStageName}" is still pending.`,
            'error'
          );
          return false;
        }
      }
    }

    return true;
  };

  const handleSaveTankDetails = async () => {
    try {
      setIsSaving(true);
      const currentStatusId = editedAttributes.status_id || selectedFeature.status.id;
      const isCompleted = currentStatusId === 1;
      if (!validateTankExecutionSequence()) {
        return; // Stop save if validation fails
      }
      if (isCompleted) {
        // Validate that ALL execution stages are Completed before allowing Tank completion
        const masterTable = selectedFeature.rawResponse?.execution_mastertable || [];
        const details = selectedFeature.rawResponse?.GeomDetails || [];

        for (let i = 0; i < masterTable.length; i++) {
          const rowKey = `exec_${i}`;
          const existingDetail = details.find((d: any) => d.ex_status_id === masterTable[i].wies_id);
          const rowData = editedAttributes[rowKey] || existingDetail;
          const rowStatusId = rowData?.wiusts_id ?? 3;

          if (rowStatusId !== 1) {
            showAlert(
              "Execution Incomplete",
              `All execution stages must be "Completed" before marking the Tank as Completed.\n\nPending stage: "${masterTable[i].wies_name}"`,
              'warning'
            );
            setIsSaving(false);
            return;
          }
        }

        // if (!capturedImage) {
        //   showAlert("Image Required", "A site photo is mandatory when marking a Tank as Completed.", 'info');
        //   return;
        // }
      }
      if (!capturedImage && featureImages.length === 0) {
        showAlert("Image Required", "At least one site photo is required to save this feature.", "info");
        return;
      }
      const featId = selectedFeature.basic.id || selectedFeature.basic.feature_id || selectedFeature.id;
      const TANK_LAYER_ID = 2;
      const originalDetails = selectedFeature.rawResponse?.GeomDetails || [];
      const masterTable = selectedFeature.rawResponse?.execution_mastertable || [];
      const currentDetails = selectedFeature.rawResponse?.GeomDetails || [];
      // 1. Format Sheet Links to match Web Logic
      const sheet_links_to_save = (editedAttributes.sheet_links || selectedFeature.rawResponse?.sheet_links || [])
        .filter(link => (link.wigsl_googlesheet_link || link.link || '').trim().length > 0)
        .map(link => {
          // Check all possible locations for the tag string
          const finalTag = link.wigsl_tags || link.tag || link.tags || '';

          return {
            id: link.isNew ? null : (link.wigsl_id || link.id || null),
            link: link.wigsl_googlesheet_link || link.link || '',
            tag: String(finalTag).trim() // ✅ Ensure this is a string
          };
        });

      // 2. Format Camera Links
      const camera_links_to_save = (editedAttributes.camera_links || selectedFeature.rawResponse?.camera_links || [])
        .filter(link => (link.wicl_camera_link || link.link || '').trim().length > 0)
        .map(link => {
          const finalTag = link.wicl_tags || link.tag || link.tags || '';


          return {
            id: link.isNew ? null : (link.wicl_id || link.id || null),
            link: link.wicl_camera_link || link.link || '',
            tag: String(finalTag).trim()
          };
        });

      // 3. Execution Table Data
      const execution_table_data = masterTable.map((master: any, index: number) => {
        const rowKey = `exec_${index}`;

        // Find existing detail that matches this master entry
        const existingDetail = currentDetails.find(
          (d: any) => d.ex_status_id === master.wies_id
        );

        // editedAttributes[rowKey] takes priority, then existing DB data, then defaults
        const editedRow = editedAttributes[rowKey];

        const finalStatusId = editedRow?.wiusts_id
          ?? existingDetail?.wiusts_id
          ?? 3; // Pending

        const finalExcavation = parseFloat(
          editedRow?.excavation ?? existingDetail?.excavation ?? 0
        );
        const finalSteel = parseFloat(
          editedRow?.steel ?? existingDetail?.steel ?? 0
        );
        const finalConcrete = parseFloat(
          editedRow?.concrete ?? existingDetail?.concrete ?? 0
        );

        return {
          WIRELEST_FK_WIES_ID: master.wies_id,
          WIRELEST_FK_WITG_ID: String(featId),
          WITP_FK_WIUSTS_ID: finalStatusId,
          quantity: [
            { WIRELEST_FK_WIEST_ID: 1, WIRELEST_QUANTITY: finalExcavation },
            { WIRELEST_FK_WIEST_ID: 2, WIRELEST_QUANTITY: finalSteel },
            { WIRELEST_FK_WIEST_ID: 3, WIRELEST_QUANTITY: finalConcrete }
          ]
        };
      });
      let currentLocationData: {
        accuracy: number;
        lat: number;
        lng: number;
        address: string;
      } | null = null;
      let currentLocationError = '';

      try {
        console.log('🌍 Starting location fetch (Pipeline)...');
        currentLocationData = await getCurrentLocation();
        console.log('✅ Pipeline location obtained:', currentLocationData);
      } catch (error) {
        currentLocationError = error instanceof Error ? error.message : String(error);
        console.error('❌ Pipeline location error:', currentLocationError);
      }
      let locationDataString = '';
      if (currentLocationData) {
        locationDataString = JSON.stringify({
          accuracy: Number(currentLocationData.accuracy) || 0,
          lat: Number(currentLocationData.lat),
          lng: Number(currentLocationData.lng),
          address:
            typeof currentLocationData.address === 'string'
              ? currentLocationData.address
              : JSON.stringify(currentLocationData.address || '')
        });

        console.log('📍 Pipeline location data:', locationDataString);
      }
      const normalizedUpfile = capturedImage ? {
        uri: capturedImage.uri,
        name: `tank_${featId}_${Date.now()}.jpg`,
        type: capturedImage.mimeType || capturedImage.type || 'image/jpeg',
      } : null;
      const payload = {
        feature_id: featId,
        layer_id: TANK_LAYER_ID,
        status_id: editedAttributes.status_id || selectedFeature.status.id,
        finish: (editedAttributes.status_id || selectedFeature.status.id) === 1 ? "true" : "false",
        execution_table: JSON.stringify(execution_table_data),
        tank_remark: newRemark || "",
        sheet_links: JSON.stringify(sheet_links_to_save),
        camera_links: JSON.stringify(camera_links_to_save),
        locationdata: locationDataString,
        location_error: String(currentLocationError || ''),
        upfile: normalizedUpfile,
      };
      console.log("📤 MOBILE SAVING TANK PAYLOAD:", payload);
      // 4. API Call
      const response = await updateTankDetails(payload);

      if (response.status === true || response.status_code === "200") {
        // showAlert("Success", "Tank details stored successfully");
        showToast("Tank saved successfully ✓");

        setIsEditing(false);
        setEditedAttributes({});
        setCapturedImage(null);

        // Refresh the UI by fetching feature info again
        await refreshCurrentFeature();
      }
    } catch (error) {
      console.error("❌ Save Error:", error);
      showAlert("Error", error.message || "Failed to save details", 'error');
    }
    finally {
      setIsSaving(false);
    }
  };
  const handleSaveJunctionDetails = async () => {
    try {
      setIsSaving(true);
      const featId = selectedFeature.basic.feature_id ||
        selectedFeature.basic.id ||
        selectedFeature.basic.id_st;
      const currentStatusId =
        editedAttributes.status_id ||
        selectedFeature.rawResponse?.geometryData?.[0]?.id_st ||
        selectedFeature.rawResponse?.geometryData?.[0]?.st_id;
      const isCompleted = currentStatusId === 1;

      console.log("Current Status ID:", currentStatusId);
      console.log("Is Completed:", isCompleted);
      // if (isCompleted) {
      //   if (!capturedImage) {
      //     showAlert("Image Required", "A site photo is mandatory when marking a Special as Completed.", 'info');
      //     return;
      //   }
      // }
      if (!capturedImage && featureImages.length === 0) {
        showAlert("Image Required", "At least one site photo is required to save this feature.", "info");
        return;
      }
      const SPECIAL_LAYER_ID = 4;
      let currentLocationData: {
        accuracy: number;
        lat: number;
        lng: number;
        address: string;
      } | null = null;
      let currentLocationError = '';

      try {
        console.log('🌍 Starting location fetch (Pipeline)...');
        currentLocationData = await getCurrentLocation();
        console.log('✅ Pipeline location obtained:', currentLocationData);
      } catch (error) {
        currentLocationError = error instanceof Error ? error.message : String(error);
        console.error('❌ Pipeline location error:', currentLocationError);
      }
      let locationDataString = '';
      if (currentLocationData) {
        locationDataString = JSON.stringify({
          accuracy: Number(currentLocationData.accuracy) || 0,
          lat: Number(currentLocationData.lat),
          lng: Number(currentLocationData.lng),
          address:
            typeof currentLocationData.address === 'string'
              ? currentLocationData.address
              : JSON.stringify(currentLocationData.address || '')
        });

        console.log('📍 Special location data:', locationDataString);
      }

      // 1. First update the special status with image
      const normalizedUpfile = capturedImage ? {
        uri: capturedImage.uri,
        name: `special_${featId}_${Date.now()}.jpg`,
        type: capturedImage.mimeType || capturedImage.type || 'image/jpeg',
      } : null;
      const specialPayload = {
        layer_id: SPECIAL_LAYER_ID,
        featureId: featId,
        status_id: editedAttributes.status_id || selectedFeature.status.id,
        locationdata: locationDataString,
        location_error: String(currentLocationError || ''),
        upfile: normalizedUpfile
      };

      console.log("📦 Payload to update-junction-details:", specialPayload);

      // 2. Update special details (status and image)
      const response = await updateJunctionDetails(specialPayload);
      console.log("✅ Special Update Response:", response);

      if (response.status || response.status_code === "200") {
        showToast("Special saved successfully ✓");

        // 3. Check if there's a remark in the editedAttributes
        // OR use a separate state for special feature remarks
        const remarkToSave = editedAttributes.remark || newRemark;

        if (remarkToSave && remarkToSave.trim()) {
          try {
            const remarkPayload = {
              feature_id: featId,
              remark: remarkToSave.trim(),
              isFeature: "true",
              isUnit: "false",
              isSubActivity: "false",
              wilm_id: 4 // For specials
            };

            console.log("📝 Remark Payload:", remarkPayload);

            const remarkResponse = await saveRemark(remarkPayload);
            console.log("✅ Remark API Response:", remarkResponse);

            if (remarkResponse.status) {
              // Add to local UI state
              const newRemarkObj = {
                id: Date.now().toString(),
                text: remarkToSave.trim(),
                user: "You",
                timestamp: new Date(),
              };
              setFeatureRemarks(prev => [newRemarkObj, ...prev]);
              console.log("✅ Remark saved successfully locally");
            }
          } catch (remarkErr: any) {
            console.error("❌ Remark save error:", remarkErr.message);
            // Don't fail the whole operation if remark fails
          }
        }

        // 4. Update UI state with new status


        // 5. Reset states
        setIsEditing(false);
        setCapturedImage(null);
        setNewRemark('');
        setEditedAttributes({});
        await refreshCurrentFeature();

        // showAlert("Success", "Special feature updated successfully");

      } else {
        throw new Error(response.message || "Failed to update special feature");
      }

    } catch (error: any) {
      console.error("❌ Special/Junction Save Error:", error);
      showAlert("Error", error.message || "Failed to save special details", 'error');
    }
    finally {
      setIsSaving(false);
    }
  };
  const handleSaveSTPDetails = async () => {
    try {
      setIsSaving(true);
      // 1. Identify Feature and IDs
      const featId = selectedFeature.basic.id || selectedFeature.basic.feature_id || selectedFeature.id;
      const STP_LAYER_ID = 3;
      const currentStatusId = editedAttributes.status_id || selectedFeature.status.id;
      const isCompleted = currentStatusId === 1;
      if (isCompleted) {
        if (currentStatusId === 1) {
          const targetList =
            editedAttributes.tablarr_internal ||
            selectedFeature.rawResponse?.stp_table ||
            [];

          const allUnitsCompleted = targetList.every((unit: any, idx: number) => {
            const unitKey = `unit_${idx}`;
            const editedUnit = editedAttributes[unitKey] || unit;
            return parseInt(editedUnit.wirelusg_status_id) === 1;
          });

          if (!allUnitsCompleted) {
            showAlert(
              "Units Incomplete",
              "All units must be marked as 'Completed' before the STP/WTP/Headworks can be set to Completed.",
              "warning"
            );
            setIsSaving(false);
            return;
          }
        }
      }
      if (!capturedImage && featureImages.length === 0) {
        showAlert("Image Required", "At least one site photo is required to save this feature.", "info");
        return;
      }

      // 2. Use the dynamically adjusted list from internal state if editing, 
      //    otherwise fallback to original records.
      const targetList = editedAttributes.tablarr_internal || selectedFeature.rawResponse?.stp_table || [];

      if (editedAttributes.isVerifyStatus === true) {
        console.log("🛠️ Toggling verification for feature:", featId);
        await verifyFeature(featId, STP_LAYER_ID, true, token);
      }
      const totalUnitWeightage = targetList.reduce((sum: number, unit: any, index: number) => {
        const unitKey = `unit_${index}`;
        const editedUnit = editedAttributes[unitKey] || unit;
        return sum + (parseFloat(editedUnit.wirelusg_waitage) || unit.wirelusg_waitage || 0);
      }, 0);

      if (Math.abs(totalUnitWeightage - 100) > 0.01) {
        showAlert(
          "Unit Weightage Error",
          `Total unit weightage must be exactly 100%.\n\nCurrent total: ${totalUnitWeightage.toFixed(1)}%\n\nPlease adjust the weightage distribution across all units.`,
          'warning'
        );
        setIsSaving(false);
        return;
      }
      // 3. Format the unit array (tablarr) for the API
      const tablarr = targetList.map((unit: any, index: number) => {
        const unitKey = `unit_${index}`;

        // Get any text/numeric edits made specifically to this card
        const editedUnit = editedAttributes[unitKey] || unit;

        return {
          // IMPORTANT: If isNewEntry is true, we send null to trigger 'Create' on backend
          unit_id: unit.isNewEntry ? 0 : (unit.wirelusg_id || 0),
          unit_name: editedUnit.wirelusg_unit_name || unit.wirelusg_unit_name || `Unit ${index + 1}`,
          excavation: parseFloat(editedUnit.wirelusg_excavation) || 0,
          steel: parseFloat(editedUnit.wirelusg_steel) || 0,
          concrete: parseFloat(editedUnit.wirelusg_concrete) || 0,
          status_id: parseInt(editedUnit.wirelusg_status_id) || unit.wirelusg_status_id || 3,
          completed_percentage: parseFloat(editedUnit.wirelusg_completed_percetange) || unit.wirelusg_completed_percetange || 0,
          mechanical_unit: parseInt(editedUnit.wirelusg_mechanical_unit) || unit.wirelusg_mechanical_unit || 3,
          unit_waitage: parseFloat(editedUnit.wirelusg_waitage) || unit.wirelusg_waitage || 0, // ← ADD THIS

          // Subactivities usually aren't created on the fly here, so we pass existing or empty
          subactivities: unit.subactivities?.map((sa) => ({
            subactivity_id: sa.subactivity_id,
            name: sa.subactivity_name,
            weightage: sa.weightage,
            remark: sa.remark || "",
            sub_status: sa.sub_status || 3,
            ismaterial_req: !!sa.wiresu_ismaterial_req,
            // ✅ ADDED: Usage fields matching your web payload
            excavation: parseFloat(sa.excavation) || 0,
            steel: parseFloat(sa.steel) || 0,
            concrete: parseFloat(sa.concrete) || 0
          })) || []
        };
      });

      // 4. Format Sheet and Camera Links
      const sheet_links_to_save = (editedAttributes.sheet_links || selectedFeature.rawResponse?.sheet_links || [])
        .map((link: any) => ({
          id: link.wigsl_id || null,
          link: link.wigsl_googlesheet_link || link.link || '',
          tag: link.wigsl_tags || link.tag || ''
        }));

      const camera_links_to_save = (editedAttributes.camera_links || selectedFeature.rawResponse?.camera_links || [])
        .map((link: any) => ({
          id: link.wicl_id || null,
          link: link.wicl_camera_link || link.link || '',
          tag: link.wicl_tags || link.tag || ''
        }));

      let currentLocationData: {
        accuracy: number;
        lat: number;
        lng: number;
        address: string;
      } | null = null;
      let currentLocationError = '';

      try {
        console.log('🌍 Starting location fetch (Pipeline)...');
        currentLocationData = await getCurrentLocation();
        console.log('✅ Pipeline location obtained:', currentLocationData);
      } catch (error) {
        currentLocationError = error instanceof Error ? error.message : String(error);
        console.error('❌ Pipeline location error:', currentLocationError);
      }
      let locationDataString = '';
      if (currentLocationData) {
        locationDataString = JSON.stringify({
          accuracy: Number(currentLocationData.accuracy) || 0,
          lat: Number(currentLocationData.lat),
          lng: Number(currentLocationData.lng),
          address:
            typeof currentLocationData.address === 'string'
              ? currentLocationData.address
              : JSON.stringify(currentLocationData.address || '')
        });

        console.log('📍 Pipeline location data:', locationDataString);
      }
      const normalizedUpfile = capturedImage ? {
        uri: capturedImage.uri,
        name: `stp_${featId}_${Date.now()}.jpg`,
        type: capturedImage.mimeType || capturedImage.type || 'image/jpeg',
      } : null;
      // 5. Construct Final Payload
      const payload: UpdateSTPPayload = {
        layer_id: STP_LAYER_ID,
        featureId: featId,
        status_id: editedAttributes.status_id || editedAttributes.st_id || selectedFeature.status.id,
        no_unit: tablarr.length,
        tablarr: JSON.stringify(tablarr),
        sheet_links: JSON.stringify(sheet_links_to_save),
        camera_links: JSON.stringify(camera_links_to_save),
        stp_remark: newRemark || "",
        locationdata: locationDataString,
        location_error: String(currentLocationError || ''),
        upfile: normalizedUpfile,
      };

      console.log("🚀 Submitting STP Data:", payload);

      // 6. Execute API Call
      const response = await updateSTPDetails(payload);

      if (response.status === true || response.status_code === "200") {
        // showAlert("Success", "STP details and unit configuration updated.");
        showToast("STP/WTP/Headworks saved successfully ✓");

        // 7. Cleanup UI State
        setIsEditing(false);

        setCapturedImage(null);
        setEditedAttributes({}); // Clear the internal temporary list
        setNewRemark('');

        // 8. Refresh the data to show updated record names and real DB IDs
        await refreshCurrentFeature();
      } else {
        showAlert("Save Failed", response.message || "Unknown error occurred", 'error');
      }
    } catch (error: any) {
      console.error("STP Save Error:", error);
      showAlert("Error", error.message || "An error occurred while saving STP details", 'error');
    }
    finally {
      setIsSaving(false);
    }
  };
  const planStatus = useMemo(() => {
    console.log("📅 Plan status calculated:", selectedProject?.currentSubscription?.wirelprsub_end_date);
    const endDateStr = selectedProject?.currentSubscription?.wirelprsub_end_date;
    if (!endDateStr) return null;

    const endDate = new Date(endDateStr);
    const today = new Date();
    endDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round(
      (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
      return { type: 'expired' as const, days: Math.abs(diffDays) };
    } else if (diffDays <= 30) {
      return { type: 'expiring' as const, days: diffDays };
    }
    return null;
  }, [selectedProject?.id, selectedProject?.currentSubscription?.wirelprsub_end_date]);
  if (planStatus?.type === 'expired' && !planDismissed) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <View style={{
          backgroundColor: '#FFF',
          borderRadius: 20,
          padding: 32,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 8,
          width: '100%',
        }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: '#FEE2E2',
            justifyContent: 'center', alignItems: 'center',
            marginBottom: 20,
          }}>
            <Text style={{ fontSize: 36 }}>⛔</Text>
          </View>

          <Text style={{
            fontSize: 22, fontWeight: '900', color: '#DC2626',
            marginBottom: 8, textAlign: 'center',
          }}>
            Plan Expired
          </Text>

          <Text style={{
            fontSize: 14, color: '#6B7280',
            textAlign: 'center', lineHeight: 22, marginBottom: 24,
          }}>
            Your plan expired{' '}
            <Text style={{ fontWeight: '700', color: '#DC2626' }}>
              {planStatus.days} day{planStatus.days !== 1 ? 's' : ''} ago
            </Text>
            .{'\n'}Please renew your subscription to continue using the dashboard.
          </Text>

          <View style={{ width: '100%', height: 1, backgroundColor: '#F3F4F6', marginBottom: 20 }} />

          {/* ADD THIS BUTTON */}
          <TouchableOpacity
            style={{
              backgroundColor: '#DC2626',
              paddingVertical: 14,
              paddingHorizontal: 32,
              borderRadius: 12,
              width: '100%',
              alignItems: 'center',
              marginBottom: 12,
            }}
            onPress={() => setPlanDismissed(true)}
          >
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>
              Continue
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
            Contact your administrator or support team to renew your plan.
          </Text>
        </View>
      </View>
    );
  }

  if (planStatus?.type === 'expiring' && !planDismissed) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center', padding: 32 }}>
        <View style={{
          backgroundColor: '#FFF',
          borderRadius: 20,
          padding: 32,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 8,
          width: '100%',
        }}>
          {/* Yellow circle icon */}
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: '#FEF3C7',
            justifyContent: 'center', alignItems: 'center',
            marginBottom: 20,
          }}>
            <Text style={{ fontSize: 36 }}>⚠️</Text>
          </View>

          <Text style={{
            fontSize: 22, fontWeight: '900', color: '#D97706',
            marginBottom: 8, textAlign: 'center',
          }}>
            Plan Expiring Soon
          </Text>

          <Text style={{
            fontSize: 14, color: '#6B7280',
            textAlign: 'center', lineHeight: 22, marginBottom: 24,
          }}>
            Your plan will expire in{' '}
            <Text style={{ fontWeight: '700', color: '#D97706' }}>
              {planStatus.days} day{planStatus.days !== 1 ? 's' : ''}
            </Text>
            .{'\n'}Renew now to avoid any interruption to your service.
          </Text>

          {/* Divider */}
          <View style={{ width: '100%', height: 1, backgroundColor: '#F3F4F6', marginBottom: 20 }} />

          {/* Continue button - lets them proceed anyway */}
          <TouchableOpacity
            style={{
              backgroundColor: '#F59E0B',
              paddingVertical: 14,
              paddingHorizontal: 32,
              borderRadius: 12,
              width: '100%',
              alignItems: 'center',
              marginBottom: 12,
            }}
            onPress={() => setPlanDismissed(true)}
          >
            <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 15 }}>
              Continue
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center' }}>
            Contact your administrator to renew your plan.
          </Text>
        </View>
      </View>
    );
  }
  if (!hasAccess("DASHBOARD")) {
    return <AccessDenied moduleName="Map Dashboard" />;
  }
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Header */}
      {hasWriteAccess("DASHBOARD_FEATURE_VERIFICATION") && (
        <View style={styles.headerControls}>
          <TouchableOpacity style={styles.verificationButton} onPress={() => setVerificationVisible(true)}>
            <CheckSquare size={18} color="#FFFFFF" />
            <Text style={styles.verificationButtonText}>Verification</Text>
          </TouchableOpacity>
        </View>
      )}
      <KPISection
        showIndicators={showIndicators}
        setShowIndicators={setShowIndicators}
        loadingKpi={loadingKpi}
        theme={theme}
        isDark={isDark}
        kpiData={{
          totalLen,
          compLen,
          progressVal,
          remLen,
          completedPercentage,
          doneConn,
          totalConn,
          totalManholes,
          verifiedManholes,
          hasManholeInWeightage,
          hasHouseConnInWeightage,
        }}
        config={{
          padding: CONTAINER_PADDING,
          gap: GAP,
          cardWidth: CARD_WIDTH,
          subTextColor: subTextColor
        }}
        refreshKPI={refreshKPI}
      />

      {/* Map */}
      <View style={[styles.mapContainer, { borderColor: borderColor }]}>
        <WebView
          ref={webviewRef}
          source={{ html: mapHtml }}
          onMessage={onWebViewMessage}
          onLoadEnd={() => {
            // setIsMapReady(true);
            setTimeout(() => {
              setIsMapLoading(false);
            }, 2000);
          }}
          javaScriptEnabled domStorageEnabled

        />
        <View style={styles.mapTypeIndicator}>
          <Text style={styles.mapTypeIndicatorText}>
            {mapTypeLabels[mapType]}
          </Text>
        </View>
        <TouchableOpacity style={[styles.layersButton, { backgroundColor: theme.cardColor }]} onPress={() => setLayersVisible(true)}>
          <Layers size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.fabContainer}>
          {/* <TouchableOpacity style={[styles.fab, { backgroundColor: isDark ? '#0a0a0b' : '#007AFF' }]} onPress={handleZoomIn}><Plus size={24} color="#FFFFFF" /></TouchableOpacity>
          <TouchableOpacity style={[styles.fab, { backgroundColor: isDark ? '#3A3A3C' : '#007AFF' }]} onPress={handleZoomOut}><Minus size={24} color="#FFFFFF" /></TouchableOpacity> */}
          <TouchableOpacity style={[styles.fab, { backgroundColor: isDark ? '#3A3A3C' : '#007AFF' }]} onPress={handleZoomToFit}><Maximize size={24} color="#FFFFFF" /></TouchableOpacity>
          <TouchableOpacity style={[styles.fab, { backgroundColor: isDark ? '#3A3A3C' : '#007AFF' }]} onPress={handleLocate}><LocateFixed size={24} color="#FFFFFF" /></TouchableOpacity>
          <TouchableOpacity style={[styles.fab, { backgroundColor: isDark ? '#3A3A3C' : '#007AFF' }]} onPress={() => setMapTypeModalVisible(true)}><Satellite size={20} color="#FFFFFF" /></TouchableOpacity>
          {hasAccess("DASHBOARD_SEARCH_FEATURE") && (
            <TouchableOpacity style={[styles.fab, { backgroundColor: isDark ? '#3A3A3C' : '#007AFF' }]} onPress={handleSearchButton}><Search size={24} color="#FFFFFF" /></TouchableOpacity>
          )}
        </View>
      </View>

      {/* Layers Modal */}
      <MapLayersModal
        visible={layersVisible}
        onClose={() => setLayersVisible(false)}
        layers={layers}
        theme={theme}
        subTextColor={subTextColor}
        borderColor={borderColor}
        getLayerSymbology={getLayerSymbology}
        toggleWmsLayer={toggleWmsLayer}
      />

      {/* Feature Bottom Sheet */}
      {selectedFeature && (
        <BottomSheet ref={bottomSheetRef} index={0} snapPoints={snapPoints} enablePanDownToClose backgroundStyle={{ backgroundColor: theme.cardColor }}>
          <View style={styles.bottomSheetHeader}>
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>{selectedFeature.name}</Text>
            <TouchableOpacity style={styles.directionsButton}><Compass color="#FFF" size={18} /><Text style={{ color: '#FFF' }}>Directions</Text></TouchableOpacity>
          </View>
          <BottomSheetScrollView>
            <View style={{ padding: 16 }}>
              {Object.entries(editedAttributes).map(([k, v]) => (
                <View key={k} style={styles.attributeRow}>
                  <Text style={{ color: subTextColor, fontSize: 12 }}>{k}</Text>
                  <TextInput style={[styles.attributeInput, { backgroundColor: inputBg, color: theme.text }]} value={String(v)} />
                </View>
              ))}
            </View>
          </BottomSheetScrollView>
        </BottomSheet>
      )}
      <VerificationModal
        visible={verificationVisible}
        onClose={() => {
          setVerificationVisible(false);
          setVerifSearchQuery('');
        }}
        theme={theme}
        isDark={isDark}
        isTablet={isTablet}
        borderColor={borderColor}
        subTextColor={subTextColor}
        inputBg={inputBg}
        // States passed from parent
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        verifSearchQuery={verifSearchQuery}
        setVerifSearchQuery={setVerifSearchQuery}
        showVerified={showVerified}
        setShowVerified={setShowVerified}
        verificationLayers={verificationLayers}
        verificationFeatures={verificationFeatures}
        selectedFeatureIds={selectedFeatureIds}
        setSelectedFeatureIds={setSelectedFeatureIds}
        loadingFeatures={loadingFeatures}
        isBulkUpdating={isBulkUpdating}
        // Actions
        handleSelectAllToggle={handleSelectAllToggle}
        handleToggleVerifyFeature={handleToggleVerifyFeature}
        highlightClickedFeature={highlightClickedFeature}
        loadWFSFeatureMobile={loadWFSFeatureMobile}
        handleBulkUpdate={handleBulkUpdateLogic}
        LAYER_COLORS={LAYER_COLORS}
      />
      <SearchFeatureModal
        visible={searchVisible}
        onClose={() => {
          setSearchVisible(false);
          setDropdown1Open(false);
        }}
        theme={theme}
        borderColor={borderColor}
        subTextColor={subTextColor}
        inputBg={inputBg}
        layers={layers}
        activeCategory={activeCategory}
        searchFeatures={searchFeatures}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        loadingFeatures={loadingFeatures}
        hasMore={hasMore}
        page={page}
        setPage={setPage}
        dropdown1Open={dropdown1Open}
        setDropdown1Open={setDropdown1Open}
        dropdown1Value={dropdown1Value}
        dropdown1ValueText={dropdown1ValueText}
        searchClick={searchClick}
        setSearchClick={setSearchClick}
        onLayerSelect={(layer) => {
          setDropdown1Value(layer.alias);
          setDropdown1ValueText(layer.name);
          setSearchFeatures([]);
          setSearchQuery('');
          setPage(1);
          setHasMore(true);
          setActiveCategory(layer.id);
          setDropdown1Open(false);
          setDropdown2Value('Select Feature');
        }}
        onFeatureSelect={(alias, id) => {
          const matchedLayer = layers.find(
            l => l.id === activeCategory || l.alias === alias || l.name === alias
          );
          if (matchedLayer && !matchedLayer.visible) {
            toggleWmsLayer(matchedLayer, false);
          }
          setDropdown2Value(id);
          loadWFSFeatureMobile(alias, id);
          highlightClickedFeature(alias, id);
          setSearchVisible(false);
          setSearchQuery('');
          setNewRemark('');
          setCapturedImage(null);
          setIsEditing(false);
        }}
      />
      {selectedFeature && (
        <BottomSheet
          ref={bottomSheetRef}
          index={0}
          snapPoints={snapPoints}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: theme.cardColor }}
          onClose={() => {
          if (suppressSheetCloseReset.current) {
            suppressSheetCloseReset.current = false;
            return; // skip resetting state — this was a programmatic temporary close
          }
          // 1. Reset React States
          setSelectedFeature(null);
          setActiveTab('attributes');
          setIsEditing(false);
          setEditedAttributes({});
          setCapturedImage(null);
          setSearchQuery('');
          // 2. Clear the Map Highlight immediately
          const clearScript = `...`;
          webviewRef.current?.injectJavaScript(clearScript);
        }}
        >
          <View style={styles.bottomSheetHeader}>
            {/* Left Section: Name and Edit Button in a Column */}
            <View style={{ flex: 1, gap: 8 }}>
              <View style ={{flexDirection :'row'}}>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>
                {selectedFeature.name || selectedFeature.label || 'Feature Details'}
              </Text>
              <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>
              {selectedFeature?.areaName ? (
              <Text
                style={{
                  color: theme.text,
                  fontSize: 18,
                  fontWeight: 'bold',
                }}
              >
                ({selectedFeature.areaName})
              </Text>
            ) : null}
              </Text>
              </View>
              {/* Edit Button - Moved here to be below the name */}
              {activeTab === 'attributes' &&
                currentLayer !== 'waternetinfraa:pipeline_existing' &&
                currentLayer !== 'waternetinfraa:pipeline_by_category' &&
                currentLayer !== 'waternetinfraa:tank_existing' &&
                currentLayer !== 'waternetinfraa:manhole_existing' &&
                currentLayer !== 'waternetinfraa:structure_existing' &&
                !isEditing && hasWriteAccess("DASHBOARD_UPDATE_ATTRIBUTES") && (
                  <TouchableOpacity
                    onPress={() => setIsEditing(true)}
                    disabled={selectedFeature.basic?.isverify === true || selectedFeature.basic?.wimg_isverified === true}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: isDark ? '#1E3A5F' : '#F0F7FF',

                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: selectedFeature.basic?.isverify || selectedFeature.basic?.wimg_isverified
                        ? '#CBD5E1'
                        : '#007AFF',
                      alignSelf: 'flex-start', // Keeps the button from stretching full width
                    }}
                  >
                    <Settings
                      size={14}
                      color={selectedFeature.basic?.isverify || selectedFeature.basic?.wimg_isverified ? '#94A3B8' : '#007AFF'}
                    />
                    <Text style={{
                      color: selectedFeature.basic?.isverify || selectedFeature.basic?.wimg_isverified ? '#94A3B8' : '#007AFF',
                      fontSize: 13,
                      fontWeight: '700'
                    }}>
                      Edit Feature Data
                    </Text>
                  </TouchableOpacity>
                )}
            </View>

            {/* Right Section: Action Buttons (Save/Cancel/Close) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isEditing && (
                <>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        if (dynamicAttrRef.current) {
                          await dynamicAttrRef.current.triggerSave();
                        }
                      } catch (e) {
                        console.error("Dynamic save failed", e);
                        return;
                      }
                      if (currentLayer.includes('pipeline')) handleSavePipelineDetails();
                      else if (currentLayer.includes('manhole')) handleSaveManholeDetails();
                      else if (currentLayer.includes('specials')) handleSaveJunctionDetails();
                      else if (currentLayer.includes('tank')) handleSaveTankDetails();
                      else if (currentLayer.includes('structure_main')) handleSaveSTPDetails();
                    }}
                    style={[styles.actionButton, styles.saveButtonAction, { minWidth: 0, paddingHorizontal: 14, paddingVertical: 8 }]}
                  >
                    <Check size={16} color="#FFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => { setIsEditing(false); setEditedAttributes({}); setCapturedImage(null); }}
                    style={[styles.actionButton, styles.cancelButton, { minWidth: 0, paddingHorizontal: 14, paddingVertical: 8 }]}
                  >
                    <X size={16} color="#EF4444" />
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity onPress={() => bottomSheetRef.current?.close()}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* TAB SELECTOR */}
          {currentLayer === 'waternetinfraa:structure_main' ? (
            <View style={[styles.tabSelector, { borderBottomColor: borderColor }]}>
              <TouchableOpacity
                style={[styles.tabForStp, activeTab === 'attributes' && styles.activeTab]}
                onPress={() => setActiveTab('attributes')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'attributes' ? '#007AFF' : subTextColor }]}>
                  Attributes
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabForStp, activeTab === 'subactivities' && styles.activeTab]}
                onPress={() => setActiveTab('subactivities')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'subactivities' ? '#007AFF' : subTextColor }]}>
                  Sub Activities
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabForStp, activeTab === 'remark' && styles.activeTab]}
                onPress={() => {
                  setActiveTab('remark');
                  setSearchQuery('');
                }}              >
                <Text style={[styles.tabText, { color: activeTab === 'remark' ? '#007AFF' : subTextColor }]}>
                  Remarks
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabForStp, activeTab === 'images' && styles.activeTab]}
                onPress={async () => {
                  setIsLoadingImages(true);
                  setActiveTab('images');
                  setTimeout(() => setIsLoadingImages(false), 800);
                }}              >
                <Text style={[styles.tabText, { color: activeTab === 'images' ? '#007AFF' : subTextColor }]}>
                  Image Gallery
                </Text>
              </TouchableOpacity>
            </View>
          ) : (

            <View style={[styles.tabSelector, { borderBottomColor: borderColor }]}>

              <TouchableOpacity
                style={[styles.tab, activeTab === 'attributes' && styles.activeTab]}
                onPress={() => setActiveTab('attributes')}
              >
                <Text style={[styles.tabTextNotForSTP, { color: activeTab === 'attributes' ? '#007AFF' : subTextColor }]}>
                  Attributes
                </Text>
              </TouchableOpacity>
              {currentLayer !== 'waternetinfraa:pipeline_existing' &&
                currentLayer !== 'waternetinfraa:tank_existing' &&
                currentLayer !== 'waternetinfraa:manhole_existing' &&
                currentLayer !== 'waternetinfraa:structure_existing' && (
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'remark' && styles.activeTab]}
                    onPress={() => {
                      setActiveTab('remark');
                      setSearchQuery('');  // ← ADD THIS
                    }}                >
                    <Text style={[styles.tabTextNotForSTP, { color: activeTab === 'remark' ? '#007AFF' : subTextColor }]}>
                      Remarks
                    </Text>
                  </TouchableOpacity>
                )}
              {currentLayer !== 'waternetinfraa:pipeline_existing' &&
                currentLayer !== 'waternetinfraa:tank_existing' &&
                currentLayer !== 'waternetinfraa:manhole_existing' &&
                currentLayer !== 'waternetinfraa:structure_existing' &&
                hasAccess("DASHBOARD_VIEW_IMAGE_GALLERY") && (

                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'images' && styles.activeTab]}
                    onPress={async () => {
                      setIsLoadingImages(true);
                      setActiveTab('images');
                      setTimeout(() => setIsLoadingImages(false), 800);
                    }}                  >
                    <Text style={[styles.tabTextNotForSTP, { color: activeTab === 'images' ? '#007AFF' : subTextColor }]}>
                      Image Gallery
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          )}

          <BottomSheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {/* 1. ATTRIBUTES TAB */}
            {activeTab === 'attributes' && (
              <View style={{ gap: 12 }}>
                {/* ✅ Dynamic Attributes Function */}
                {(() => {
                  let hasRenderedDynamicAttr = false;
                  const renderDynamicAttributes = () => {
                    if (hasRenderedDynamicAttr) return null;
                    if (
                      !selectedFeature?.basic || 
                      !(selectedFeature.basic.id || selectedFeature.basic.feature_id) || 
                      !currentLayer || 
                      !hasAccess("DASHBOARD_DYNAMIC_ATTRIBUTES")
                    ) {
                      return null;
                    }
                    // Hide dynamic attributes when status is Pending (id = 2 or name is Pending)
                    const currentStatusId =
                      editedAttributes.status_id ??
                      editedAttributes.st_id ??
                      selectedFeature.status?.id ??
                      selectedFeature.basic?.st_id ??
                      selectedFeature.basic?.status_id ??
                      selectedFeature.basic?.id_st ??
                      selectedFeature.basic?.wimg_fk_wists_id;

                    const statusObj = selectedFeature.geomStatusList?.find(
                      (s: any) => s.wists_id === currentStatusId
                    );
                    const statusName = (statusObj?.wists_name || selectedFeature.status?.name || '').toLowerCase().trim();

                    if (currentStatusId === 2 || statusName === 'pending') {
                      return null;
                    }

                    hasRenderedDynamicAttr = true;
                     const parentLengthLimit =
                        currentLayer === 'waternetinfraa:pipeline_main'
                          ? parseFloat(String(selectedFeature.basic?.length ?? '')) || undefined
                          : undefined;
                    return (
                      <DynamicAttributePanel
                        ref={dynamicAttrRef}
                        featureId={selectedFeature.basic.id || selectedFeature.basic.feature_id}
                        layerId={getLayerIdFromCurrentLayer()}
                        isVerified={selectedFeature.basic?.isverify === true || selectedFeature.basic?.wimg_isverified === true}
                        externalEditMode={isEditing}
                        parentLengthLimit={parentLengthLimit}
                        onRequestCloseSheet={() => bottomSheetRef.current?.close()}
                        onRequestReopenSheet={() => bottomSheetRef.current?.expand()}
                        onLengthExceeded={handleLengthExceeded}
                        skipMandatoryValidation={
                          currentLayer === 'waternetinfraa:pipeline_main' &&
                          (editedAttributes.status_id ?? selectedFeature.status?.id) === 3
                        }
                        forceAllMandatory={
                          currentLayer === 'waternetinfraa:pipeline_main' &&
                          (editedAttributes.status_id ?? selectedFeature.status?.id) === 1
                        }
                        stampImageWithLocation={stampImageWithLocation} 
                        processImage={processImage}
                      />
                    );
                  };

                  const featureType = selectedFeature.featureType || 'default';
                  console.log("My layers", currentLayer);
                  
                  const switchResult = (() => {
                    switch (currentLayer) {
                    // ========== PIPELINE ==========
                    case 'waternetinfraa:pipeline_main':
                      const isPipeVerified = selectedFeature.basic?.isverify === true;
                      const isCompletedStatus = (editedAttributes.status_id || selectedFeature.status.id) === 1;
                      const isCompletedStatusVerify = selectedFeature.status.id === 1;

                      return (
                        <>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Pipeline Details</Text>
                            <AttributeItem label="Label" value={String(selectedFeature.basic?.label || 'N/A')} />
                            <AttributeItem label="Diameter (mm)" value={String(selectedFeature.basic?.diameter || 'N/A')} />
                            <AttributeItem label="Length (m)" value={String(selectedFeature.basic?.length || 'N/A')} />
                            <AttributeItem label="Material" value={String(selectedFeature.basic?.material || 'N/A')} />
                            {/* <AttributeItem label="GL Start (m)" value={String(selectedFeature.basic?.gl_start || '0')} /> */}
                            {/* <AttributeItem label="GL End (m)" value={String(selectedFeature.basic?.gl_end || '0')} /> */}
                            <AttributeItem label="Last Updated By" value={String(selectedFeature.userName || 'N/A')} />
                            <AttributeItem label="Last Updated At" value={String(selectedFeature.basic?.updated_date || 'N/A')} />
                            {selectedFeature?.basic?.project_type_id === 2 && (
                              <>
                                <AttributeItem label="Start Invert Level (m)" value={String(selectedFeature.basic?.start_invertlevel || '0')} />
                                <AttributeItem label="End Invert Level (m)" value={String(selectedFeature.basic?.end_invertlevel || '0')} />
                              </>
                            )}
                            {isCompletedStatus && (
                              <View style={styles.attributeRow}>
                                <Text style={styles.kvKey}>Actual Length (m)</Text>
                                {isEditing && !isPipeVerified ? (
                                  <TextInput
                                    style={styles.attributeInput}
                                    placeholder="Enter actual length"
                                    placeholderTextColor="#8E8E93"
                                    keyboardType="numeric"
                                    value={String(editedAttributes.adusdefln || '')}
                                    onChangeText={(val) => setEditedAttributes({ ...editedAttributes, adusdefln: val })}
                                  />
                                ) : (
                                  <View style={[styles.attributeValue, {
                                    backgroundColor: isDark ? '#2E3147' : '#F8FAFC'
                                  }]}>
                                    <Text style={styles.kvValue}>{selectedFeature.basic?.usdeflen || 'N/A'}</Text>
                                  </View>
                                )}
                              </View>
                            )}

                            {isCompletedStatusVerify && hasWriteAccess("DASHBOARD_FEATURE_VERIFICATION") && (
                              <View style={[styles.attributeRow, {
                                marginTop: 10,
                                paddingTop: 15,
                                borderTopWidth: 1,
                                borderTopColor: borderColor,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }]}>
                                <View>
                                  <Text style={styles.kvKey}>Attribute Verification</Text>
                                  <Text style={{ fontSize: 11, color: isPipeVerified ? '#16A34A' : '#64748B' }}>
                                    {isPipeVerified ? '✓ Data is verified' : '○ Pending verification'}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  // Remove disabled={!isEditing} if you want users to verify without 
                                  onPress={async () => {
                                    try {
                                      setIsVerifying(true);
                                      const featId = selectedFeature.basic.id || selectedFeature.basic.feature_id;
                                      const layerId = getLayerIdFromCurrentLayer();
                                      const newStatus = !isPipeVerified;

                                      if (!layerId) {
                                        showAlert("Error", "Layer not identified", 'error');
                                        return;
                                      }

                                      await verifyFeature(featId, layerId, newStatus, token);

                                      webviewRef.current?.injectJavaScript(`
                                        Object.keys(wmsLayers).forEach(key => {
                                          const source = wmsLayers[key].getSource();
                                          if (source && typeof source.updateParams === 'function') {
                                            source.updateParams({ 'VERSION': '1.1.1', 't': Date.now() });
                                          }
                                        });
                                      `);

                                      await refreshCurrentFeature();
                                      showAlert("Success", newStatus ? "Feature verified" : "Feature unverified", 'success');
                                      await refreshKPI();
                                    } catch (err: any) {
                                      showAlert("Action Failed", err.message, 'error');
                                    } finally {
                                      setIsVerifying(false);
                                    }
                                  }}
                                >
                                  <Text style={{
                                    color: isPipeVerified ? '#EF4444' : '#15803D',
                                    fontWeight: '800',
                                    fontSize: 12
                                  }}>
                                    {isPipeVerified ? 'UNVERIFY' : 'VERIFY'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>

                          {renderDynamicAttributes()}
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Status Timeline</Text>
                            <View style={styles.statusBadgeContainer}>
                              {selectedFeature.geomStatusList?.map((status: any) => {
                                const isActive = (editedAttributes.status_id || selectedFeature.status?.id) === status.wists_id;
                                const themeColor = status.wists_color || '#808080';

                                return (
                                  <TouchableOpacity
                                    key={status.wists_id}
                                    disabled={!isEditing || isPipeVerified}
                                    onPress={() => {
                                      const newStatusId = status.wists_id;
                                      const updatedAttrs: any = { ...editedAttributes, status_id: newStatusId };

                                      // When switching to Complete (id=1), auto-fill Actual Length
                                      // from the highest group-attribute Length entry if not already set.
                                      if (newStatusId === 1) {
                                        const currentLen = editedAttributes.adusdefln;
                                        const hasManualLen = currentLen && String(currentLen).trim() !== '' && parseFloat(String(currentLen)) > 0;
                                        if (!hasManualLen) {
                                          const highest = dynamicAttrRef.current?.getMaxGroupLength() ?? 0;
                                          if (highest > 0) {
                                            updatedAttrs.adusdefln = String(highest);
                                          }
                                        }
                                      }

                                      setEditedAttributes(updatedAttrs);
                                    }}
                                    style={[
                                      styles.statusBadge,
                                      {
                                        backgroundColor: isActive ? `${themeColor}20` : '#F3F4F6',
                                        borderWidth: isActive ? 2 : 0,
                                        borderColor: themeColor,
                                        opacity: !isEditing && !isActive ? 0.6 : 1
                                      }
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeText,
                                        {
                                          color: isActive ? themeColor : '#4B5563',
                                          fontWeight: isActive ? '700' : '400'
                                        }
                                      ]}
                                    >
                                      {status.wists_name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>

                          {/* Media & Schematic sections remain unchanged */}
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Upload Media</Text>
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                              <TouchableOpacity
                                disabled={!isEditing || isPipeVerified}
                                style={{
                                  width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed',
                                  borderColor: isEditing ? '#007AFF' : '#CBD5E1',
                                  justifyContent: 'center', alignItems: 'center',
                                  backgroundColor: isEditing ? '#F0F7FF' : '#F1F5F7'
                                }}
                                onPress={handlePickImage}
                              >
                                <Camera size={24} color={isEditing ? "#007AFF" : "#94A3B8"} />
                                <Text style={{ fontSize: 10, color: isEditing ? '#007AFF' : '#94A3B8', marginTop: 4 }}>Capture</Text>
                              </TouchableOpacity>

                              {capturedImage ? (
                                <View style={{ width: 80, height: 80, position: 'relative' }}>
                                  {/* The Image */}
                                  <Image
                                    source={{ uri: capturedImage.uri }}
                                    style={{ width: 80, height: 80, borderRadius: 8 }}
                                  />

                                  {/* The X Button Container */}
                                  <TouchableOpacity
                                    onPress={() => setCapturedImage(null)}
                                    activeOpacity={0.7}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      backgroundColor: '#EF4444',
                                      width: 26,
                                      height: 26,
                                      borderRadius: 13,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      borderWidth: 2,
                                      borderColor: '#FFF',
                                      zIndex: 99,
                                      elevation: 6,
                                    }}
                                  >
                                    <X size={14} color="#FFF" strokeWidth={3} />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>No preview</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Latest Uploaded Media</Text>

                            {selectedFeature.rawResponse?.image_date && selectedFeature.rawResponse.image_date.length > 0 ? (
                              (() => {
                                // Find the latest image based on wiiu_id
                                const images = [...selectedFeature.rawResponse.image_date];
                                const latestImg = images.sort((a, b) => b.wiiu_id - a.wiiu_id)[0];
                                const imageUri = normalizeToAbsolute(latestImg.wiiu_path);

                                return (
                                  <TouchableOpacity
                                    style={[styles.previousImageContainer, { width: 140 }]}
                                    onPress={() => {
                                      setSelectedImage(imageUri);
                                      setShowImageModal(true);
                                    }}
                                  >
                                    <Image
                                      source={{ uri: imageUri }}
                                      style={[styles.previousImage, { width: 140, height: 140 }]}
                                      resizeMode="cover"
                                    />
                                    {latestImg?.wiiu_id && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                      <TouchableOpacity
                                        onPress={() => {
                                          showAlert(
                                            "Delete Image",
                                            "Are you sure you want to delete this image?",
                                            "warning",
                                            [
                                              { text: "Cancel", style: "cancel", onPress: () => { } },
                                              {
                                                text: "Delete",
                                                style: "destructive",
                                                onPress: async () => {
                                                  try {
                                                    await deleteUnitImage({
                                                      image_id: latestImg.wiiu_id,
                                                      isFeature: "true",
                                                      isUnit: "false",
                                                      isSubActivity: "false",
                                                    });
                                                    showToast("Image deleted successfully ✓");
                                                    await refreshCurrentFeature();
                                                  } catch (err: any) {
                                                    showAlert("Error", err.message, "error");
                                                  }
                                                },
                                              },
                                            ]
                                          );
                                        }}
                                        style={{
                                          position: 'absolute',
                                          top: 6,
                                          right: 6,
                                          backgroundColor: '#EF4444',
                                          width: 30,
                                          height: 30,
                                          borderRadius: 15,
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          borderWidth: 2,
                                          borderColor: '#FFF',
                                          zIndex: 99,
                                          elevation: 6,
                                        }}
                                      >
                                        <Trash2 size={14} color="#FFF" />
                                      </TouchableOpacity>
                                    )}
                                    <View style={styles.imageDateBadge}>
                                      <Text style={styles.imageDateText}>
                                        Latest
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })()
                            ) : (
                              /* --- FALLBACK UI WHEN NO IMAGES EXIST --- */
                              <View style={styles.noImagePlaceholder}>
                                <ImageIcon size={32} color="#94A3B8" strokeWidth={1.5} />
                                <Text style={styles.noImageText}>No images uploaded for this feature</Text>
                              </View>
                            )}
                          </View>
                          {selectedFeature.basic.project_type_id === 2 ? (
                            <View style={styles.card}>
                              <Text style={styles.sectionTitle}>Pipeline Schematic Diagram</Text>
                              <View style={styles.schematicWrapper}>
                                <ImageBackground
                                  source={require('@/assets/images/schematic.png')}
                                  style={styles.schematicBg}
                                  resizeMode="contain"
                                >
                                  {/* ... schematic tags remain the same ... */}
                                  <View style={[styles.floatingTag, { top: 2, left: 2 }]}>
                                    <Text style={styles.tagLabelText}>GL - {selectedFeature.basic?.gl_start || 0} (m)</Text>
                                  </View>
                                  <View style={[styles.floatingTag, { bottom: 35, left: 5 }]}>
                                    <Text style={styles.tagLabelText}>IL - {selectedFeature.basic?.start_invertlevel || 0} (m)</Text>
                                  </View>
                                  <View style={styles.centerTagContainer}>
                                    <Text style={styles.pipeNameText}>{selectedFeature.basic?.label || 'P-2300'}</Text>
                                    <Text style={styles.tagLabelText}>L - {selectedFeature.basic?.length || 0} (m)</Text>
                                  </View>
                                  <View style={[styles.floatingTag, { top: 30, right: 10 }]}>
                                    <Text style={styles.tagLabelText}>GL - {selectedFeature.basic?.gl_end || 0} (m)</Text>
                                  </View>
                                  <View style={[styles.floatingTag, { bottom: 5, right: 15 }]}>
                                    <Text style={styles.tagLabelText}>IL - {selectedFeature.basic?.end_invertlevel || 0} (m)</Text>
                                  </View>
                                </ImageBackground>
                              </View>
                            </View>
                          ) : (<></>)}
                        </>
                      );


                    // ========== TANK ==========

                    case 'waternetinfraa:tank_main':
                      const isTankVerified = selectedFeature.basic?.isverify === true;
                      const isCompletedStatusVerifyTank = selectedFeature.status.id === 1;

                      return (
                        <>
                          {/* 1. General Information Card */}
                          <View style={styles.card}>
                            <AttributeItem label="Label" value={selectedFeature.basic?.labelname || selectedFeature.basic?.label} />
                            <AttributeItem label="Capacity (MLD)" value={String(selectedFeature.basic?.capacity || 'N/A')} />
                            <AttributeItem label="Type" value={selectedFeature.basic?.type} />
                            <AttributeItem label="Stagging Height" value={String(selectedFeature.basic?.stag_height || 'N/A')} />
                            <AttributeItem label="Last Updated By" value={selectedFeature.userName || 'N/A'} />
                            <AttributeItem label="Last Updated At" value={selectedFeature.basic?.updated_date || 'N/A'} />

                            {isCompletedStatusVerifyTank && hasWriteAccess("DASHBOARD_FEATURE_VERIFICATION") && (
                              <View style={[styles.attributeRow, {
                                marginTop: 10,
                                paddingTop: 15,
                                borderTopWidth: 1,
                                borderTopColor: borderColor,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }]}>
                                <View>
                                  <Text style={styles.kvKey}>Attribute Verification</Text>
                                  <Text style={{ fontSize: 11, color: isTankVerified ? '#16A34A' : '#64748B' }}>
                                    {isTankVerified ? '✓ Data is verified' : '○ Pending verification'}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  // Remove disabled={!isEditing} if you want users to verify without 
                                  onPress={async () => {
                                    try {
                                      setIsVerifying(true);
                                      const featId = selectedFeature.basic.id || selectedFeature.basic.feature_id;
                                      const layerId = getLayerIdFromCurrentLayer();
                                      const newStatus = !isTankVerified;

                                      if (!layerId) {
                                        showAlert("Error", "Layer not identified", 'success');
                                        return;
                                      }

                                      await verifyFeature(featId, layerId, newStatus, token);

                                      webviewRef.current?.injectJavaScript(`
                                        Object.keys(wmsLayers).forEach(key => {
                                          const source = wmsLayers[key].getSource();
                                          if (source && typeof source.updateParams === 'function') {
                                            source.updateParams({ 'VERSION': '1.1.1', 't': Date.now() });
                                          }
                                        });
                                      `);

                                      await refreshCurrentFeature();
                                      showAlert("Success", newStatus ? "Feature verified" : "Feature unverified", 'success');
                                      await refreshKPI();
                                    } catch (err: any) {

                                      showAlert("Action Failed", err.message, 'error');
                                    }
                                    finally {
                                      setIsVerifying(false);
                                    }
                                  }}
                                >
                                  <Text style={{
                                    color: isTankVerified ? '#EF4444' : '#15803D',
                                    fontWeight: '800',
                                    fontSize: 12
                                  }}>
                                    {isTankVerified ? 'UNVERIFY' : 'VERIFY'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                          {renderDynamicAttributes()}
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Status Timeline</Text>

                            <View style={styles.statusBadgeContainer}>
                              {selectedFeature.geomStatusList?.map((status: any) => {
                                const isActive = (editedAttributes.status_id || selectedFeature.status?.id) === status.wists_id;
                                console.log("My status ANurag", selectedFeature.status?.id, status.wists_id);
                                const themeColor = status.wists_color || '#808080';

                                return (
                                  <TouchableOpacity
                                    key={status.wists_id}
                                    // Enable clicking if in editing mode
                                    disabled={!isEditing || isTankVerified}
                                    onPress={() => setEditedAttributes({ ...editedAttributes, status_id: status.wists_id })}
                                    style={[
                                      styles.statusBadge,
                                      {
                                        // If active: Light version of the theme color (adding '20' for transparency)
                                        // If inactive: Light gray
                                        backgroundColor: isActive ? `${themeColor}20` : '#F3F4F6',
                                        borderWidth: isActive ? 2 : 0,
                                        borderColor: themeColor,
                                        opacity: isTankVerified && !isActive ? 0.4 : 1
                                      }
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeText,
                                        {
                                          color: isActive ? themeColor : '#4B5563',
                                          fontWeight: isActive ? '700' : '400'
                                        }
                                      ]}
                                    >
                                      {status.wists_name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>

                          </View>

                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Upload Media</Text>
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                              <TouchableOpacity
                                disabled={!isEditing || isTankVerified}
                                style={{
                                  width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed',
                                  borderColor: (isEditing && !isTankVerified) ? '#007AFF' : '#CBD5E1',
                                  justifyContent: 'center', alignItems: 'center',
                                  backgroundColor: (isEditing && !isTankVerified) ? '#F0F7FF' : '#F1F5F9'
                                }}
                                onPress={handlePickImage}
                              >
                                <Camera size={24} color={(isEditing && !isTankVerified) ? "#007AFF" : "#94A3B8"} />
                                <Text style={{ fontSize: 10, color: (isEditing && !isTankVerified) ? '#007AFF' : '#94A3B8', marginTop: 4 }}>Capture</Text>
                              </TouchableOpacity>

                              {capturedImage ? (
                                <View style={{ width: 80, height: 80, position: 'relative' }}>
                                  {/* The Image */}
                                  <Image
                                    source={{ uri: capturedImage.uri }}
                                    style={{ width: 80, height: 80, borderRadius: 8 }}
                                  />

                                  {/* The X Button Container */}
                                  <TouchableOpacity
                                    onPress={() => setCapturedImage(null)}
                                    activeOpacity={0.7}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      backgroundColor: '#EF4444',
                                      width: 26,
                                      height: 26,
                                      borderRadius: 13,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      borderWidth: 2,
                                      borderColor: '#FFF',
                                      zIndex: 99,
                                      elevation: 6,
                                    }}
                                  >
                                    <X size={14} color="#FFF" strokeWidth={3} />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>No preview</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Latest Uploaded Media</Text>

                            {selectedFeature.rawResponse?.image_date && selectedFeature.rawResponse.image_date.length > 0 ? (
                              (() => {
                                // Find the latest image based on wiiu_id
                                const images = [...selectedFeature.rawResponse.image_date];
                                const latestImg = images.sort((a, b) => b.wiiu_id - a.wiiu_id)[0];
                                const imageUri = normalizeToAbsolute(latestImg.wiiu_path);

                                return (
                                  <TouchableOpacity
                                    style={[styles.previousImageContainer, { width: 140 }]}
                                    onPress={() => {
                                      setSelectedImage(imageUri);
                                      setShowImageModal(true);
                                    }}
                                  >
                                    <Image
                                      source={{ uri: imageUri }}
                                      style={[styles.previousImage, { width: 140, height: 140 }]}
                                      resizeMode="cover"
                                    />
                                    {latestImg?.wiiu_id && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                      <TouchableOpacity
                                        onPress={() => {
                                          showAlert(
                                            "Delete Image",
                                            "Are you sure you want to delete this image?",
                                            "warning",
                                            [
                                              { text: "Cancel", style: "cancel", onPress: () => { } },
                                              {
                                                text: "Delete",
                                                style: "destructive",
                                                onPress: async () => {
                                                  try {
                                                    await deleteUnitImage({
                                                      image_id: latestImg.wiiu_id,
                                                      isFeature: "true",
                                                      isUnit: "false",
                                                      isSubActivity: "false",
                                                    });
                                                    showToast("Image deleted successfully ✓");
                                                    await refreshCurrentFeature();
                                                  } catch (err: any) {
                                                    showAlert("Error", err.message, "error");
                                                  }
                                                },
                                              },
                                            ]
                                          );
                                        }}
                                        style={{
                                          position: 'absolute',
                                          top: 6,
                                          right: 6,
                                          backgroundColor: '#EF4444',
                                          width: 30,
                                          height: 30,
                                          borderRadius: 15,
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          borderWidth: 2,
                                          borderColor: '#FFF',
                                          zIndex: 99,
                                          elevation: 6,
                                        }}
                                      >
                                        <Trash2 size={14} color="#FFF" />
                                      </TouchableOpacity>
                                    )}
                                    <View style={styles.imageDateBadge}>
                                      <Text style={styles.imageDateText}>
                                        Latest
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })()
                            ) : (
                              /* --- FALLBACK UI WHEN NO IMAGES EXIST --- */
                              <View style={styles.noImagePlaceholder}>
                                <ImageIcon size={32} color="#94A3B8" strokeWidth={1.5} />
                                <Text style={styles.noImageText}>No images uploaded for this feature</Text>
                              </View>
                            )}
                          </View>

                          {/* 2. Asset Links Section */}
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Asset Links & Documentation</Text>
                            <View style={{ gap: 10 }}>
                              <TouchableOpacity style={styles.linkRow} onPress={() => setLinkModalVisible(true)}>
                                <View style={styles.iconBadgeBlue}>
                                  <FileText size={20} color="#0EA5E9" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                  <Text style={styles.linkTextPrimary}>Google Sheets</Text>
                                  <Text style={styles.linkMetaText}>
                                    {(editedAttributes.sheet_links || selectedFeature.rawResponse?.sheet_links || []).length} Documents linked
                                  </Text>
                                </View>
                                <ChevronRight size={18} color="#94A3B8" />
                              </TouchableOpacity>

                              <TouchableOpacity style={styles.linkRow} onPress={() => setCameraModalVisible(true)}>
                                <View style={styles.iconBadgeOrange}>
                                  <Camera size={20} color="#F59E0B" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                  <Text style={styles.linkTextPrimary}>Camera Links</Text>
                                  <Text style={styles.linkMetaText}>
                                    {(editedAttributes.camera_links || selectedFeature.rawResponse?.camera_links || []).length} Feeds active
                                  </Text>
                                </View>
                                <ChevronRight size={18} color="#94A3B8" />
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* 3. Execution Master Cards */}
                          <Text style={[styles.sectionTitle, { marginTop: 10, marginLeft: 4 }]}>Execution Master</Text>

                          {(() => {
                            const details = selectedFeature.rawResponse?.GeomDetails || [];
                            const masterTable = selectedFeature.rawResponse?.execution_mastertable || [];

                            // Create the combined list for logic checks
                            const fullExecutionList = masterTable.length > 0
                              ? masterTable.map((master) => {
                                const existing = details.find((d) => d.ex_status_id === master.wies_id);
                                return existing
                                  ? existing
                                  : {
                                    ex_status_id: master.wies_id,
                                    ex_status: master.wies_name,
                                    wiusts_id: 3,        // Pending by default
                                    excavation: 0,
                                    steel: 0,
                                    concrete: 0,
                                    isAutoAdded: true,   // Visual flag for unrecorded entries
                                  };
                              })
                              : details;

                            return fullExecutionList.map((item, index) => {
                              const uniqueKey = `tank-exec-${item.ex_status_id || index}-${index}`;
                              const rowKey = `exec_${index}`;
                              const rowData = editedAttributes[rowKey] || item;

                              // ✅ SEQUENTIAL VISIBILITY LOGIC
                              // index 0 is always visible.
                              // index N is visible only if index N-1 has wiusts_id === 1 (Completed)
                              let isVisible = false;
                              if (index === 0) {
                                isVisible = true;
                              } else {
                                const prevRowKey = `exec_${index - 1}`;
                                const prevData = editedAttributes[prevRowKey] || fullExecutionList[index - 1];
                                if (prevData.wiusts_id === 1) {
                                  isVisible = true;
                                }
                              }

                              // If logic determines it shouldn't be shown yet, return null
                              if (!isVisible) return null;

                              const stageInfo = { wies_name: item.ex_status };

                              return (
                                <View key={uniqueKey} style={[
                                  styles.execCard,
                                  { zIndex: (fullExecutionList.length - index) }
                                ]}>
                                  <View style={styles.execHeader}>
                                    <Text style={styles.execStatusText}>
                                      {stageInfo?.wies_name || item.ex_status}
                                    </Text>

                                    {isEditing && !isTankVerified ? (
                                      <View style={{ position: 'relative' }}>
                                        <TouchableOpacity
                                          style={[styles.dropdown, { paddingVertical: 6, width: 130 }]}
                                          onPress={() => setDropdown2Open(dropdown2Open === uniqueKey ? null : uniqueKey)}
                                        >
                                          <Text style={{ fontSize: 12, fontWeight: '700', color: theme.text }}>
                                            {selectedFeature.rawResponse?.uni_status_list?.find(
                                              s => s.wiusts_id === rowData.wiusts_id
                                            )?.wiusts_name || 'Select'}
                                          </Text>
                                          <ChevronDown size={14} color="#64748B" />
                                        </TouchableOpacity>

                                        {dropdown2Open === uniqueKey && (
                                          <View style={[styles.dropdownList, { position: 'absolute', top: 36, left: 0, right: 0, zIndex: 1000, backgroundColor: theme.cardColor }]}>
                                            {selectedFeature.rawResponse?.uni_status_list?.map((status) => (
                                              <TouchableOpacity
                                                key={status.wiusts_id}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                  const newStatusId = status.wiusts_id;
                                                  let updatedAttributes = {
                                                    ...editedAttributes,
                                                    [rowKey]: { ...rowData, wiusts_id: newStatusId }
                                                  };
                                                  if (newStatusId === 2 || newStatusId === 3) {
                                                    fullExecutionList.forEach((_, nextIdx) => {
                                                      if (nextIdx > index) {
                                                        const nextRowKey = `exec_${nextIdx}`;

                                                        // Get original metadata for the next row but force values to 0 and status to Pending
                                                        const nextRowOriginal = fullExecutionList[nextIdx];

                                                        updatedAttributes[nextRowKey] = {
                                                          ...nextRowOriginal,
                                                          wiusts_id: 3,      // Force Status to Pending
                                                          excavation: "0",   // Reset values to 0
                                                          steel: "0",
                                                          concrete: "0"
                                                        };
                                                      }
                                                    });
                                                  }
                                                  setEditedAttributes(updatedAttributes);
                                                  setDropdown2Open(null);
                                                }}
                                              >
                                                <Text style={{ color: theme.text }}>{status.wiusts_name}</Text>
                                              </TouchableOpacity>
                                            ))}
                                          </View>
                                        )}
                                      </View>
                                    ) : (
                                      <View style={{ alignItems: 'flex-end' }}>
                                        <View style={[
                                          styles.statusPill,
                                          {
                                            backgroundColor:
                                              item.wiusts_id === 1 ? '#DCFCE7'
                                                : item.wiusts_id === 2 ? '#FEF3C7'
                                                  : '#F1F5F9'
                                          }
                                        ]}>
                                          <Text style={[
                                            styles.statusPillText,
                                            {
                                              color:
                                                item.wiusts_id === 1 ? '#15803D'
                                                  : item.wiusts_id === 2 ? '#B45309'
                                                    : '#64748B'
                                            }
                                          ]}>
                                            {selectedFeature.rawResponse?.uni_status_list?.find(
                                              s => s.wiusts_id === item.wiusts_id
                                            )?.wiusts_name || 'Pending'}
                                          </Text>
                                        </View>
                                        {item.isAutoAdded && (
                                          <Text style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>
                                            ○ Not yet recorded
                                          </Text>
                                        )}
                                      </View>
                                    )}
                                  </View>

                                  <View style={styles.execGrid}>
                                    {[{ field: 'excavation', label: 'Excavation' }, { field: 'steel', label: 'Steel' }, { field: 'concrete', label: 'Concrete' }].map((cfg) => (
                                      <View key={cfg.field} style={styles.execField}>
                                        <Text style={styles.execLabel}>{cfg.label}</Text>
                                        {isEditing && !isTankVerified ? (
                                          <TextInput
                                            //keyboardType="numeric"
                                            editable={
                                              isEditing &&
                                              !isTankVerified &&
                                              (index === 0 || (editedAttributes[`exec_${index - 1}`]?.wiusts_id === 1 || fullExecutionList[index - 1]?.wiusts_id === 1))
                                            }
                                            style={[styles.attributeInput, { marginTop: 0, padding: 6, textAlign: 'center', backgroundColor: inputBg }]}
                                            value={String(rowData[cfg.field] ?? '0')}
                                            onChangeText={(val) => setEditedAttributes({
                                              ...editedAttributes,
                                              [rowKey]: { ...rowData, [cfg.field]: val }
                                            })}
                                          />
                                        ) : (
                                          <View style={styles.inputContainer}>
                                            <Text style={styles.execValueText}>{item[cfg.field] || '0'}</Text>
                                          </View>
                                        )}
                                      </View>
                                    ))}
                                  </View>
                                </View>
                              );
                            });
                          })()}
                        </>
                      );

                    // ========== STP/WTP/Headworks ==========
                    case 'waternetinfraa:structure_main':
                      const isCompletedStatusVerifySTP = selectedFeature.status.id === 1;
                      const isSTPVerified = selectedFeature.basic?.isverify === true;

                      return (
                        <>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>STP/WTP/Headworks</Text>
                            <AttributeItem label="Label" value={selectedFeature.basic?.lable || selectedFeature.basic?.label} />
                            <AttributeItem label="Capacity (MLD)" value={String(selectedFeature.basic?.capacity || 'N/A')} />
                            <AttributeItem label="Type" value={String(selectedFeature.basic?.type || 'N/A')} />
                            <AttributeItem label="Last Updated By" value={String(selectedFeature.userName || 'N/A')} />
                            <AttributeItem label="Last Updated At" value={selectedFeature.basic?.updated_date || 'N/A'} />
                            {isCompletedStatusVerifySTP && hasWriteAccess("DASHBOARD_FEATURE_VERIFICATION") && (
                              <View style={[styles.attributeRow, {
                                marginTop: 10,
                                paddingTop: 15,
                                borderTopWidth: 1,
                                borderTopColor: borderColor,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }]}>
                                <View>
                                  <Text style={styles.kvKey}>Attribute Verification</Text>
                                  <Text style={{ fontSize: 11, color: isSTPVerified ? '#16A34A' : '#64748B' }}>
                                    {isSTPVerified ? '✓ Data is verified' : '○ Pending verification'}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  // Remove disabled={!isEditing} if you want users to verify without 
                                  onPress={async () => {
                                    try {
                                      setIsVerifying(true);
                                      const featId = selectedFeature.basic.id || selectedFeature.basic.feature_id;
                                      const layerId = getLayerIdFromCurrentLayer();
                                      const newStatus = !isSTPVerified;

                                      if (!layerId) {
                                        showAlert("Error", "Layer not identified", 'error');
                                        return;
                                      }

                                      await verifyFeature(featId, layerId, newStatus, token);

                                      webviewRef.current?.injectJavaScript(`
                                        Object.keys(wmsLayers).forEach(key => {
                                          const source = wmsLayers[key].getSource();
                                          if (source && typeof source.updateParams === 'function') {
                                            source.updateParams({ 'VERSION': '1.1.1', 't': Date.now() });
                                          }
                                        });
                                      `);

                                      await refreshCurrentFeature();
                                      showAlert("Success", newStatus ? "Feature verified" : "Feature unverified", 'success');
                                      await refreshKPI();
                                    } catch (err: any) {
                                      showAlert("Action Failed", err.message, 'error');
                                    }
                                    finally { setIsVerifying(false); }
                                  }}
                                >
                                  <Text style={{
                                    color: isSTPVerified ? '#EF4444' : '#15803D',
                                    fontWeight: '800',
                                    fontSize: 12
                                  }}>
                                    {isSTPVerified ? 'UNVERIFY' : 'VERIFY'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                            <View style={styles.attributeRow}>
                              <Text style={styles.kvKey}>No of Unit</Text>
                              {isEditing && !(selectedFeature.basic?.isverify || selectedFeature.basic?.isVerify) ? (
                                <TextInput
                                  style={[styles.attributeInput, { backgroundColor: inputBg, color: theme.text }]}
                                  //keyboardType="numeric"
                                  value={String(editedAttributes.unit ?? selectedFeature.rawResponse?.stp_table?.length ?? '0')}
                                  onChangeText={(text) => {
                                    const newCount = parseInt(text) || 0;
                                    const originalTable = selectedFeature.rawResponse?.stp_table || [];
                                    let updatedTable = [];

                                    for (let i = 0; i < newCount; i++) {
                                      if (originalTable[i]) {
                                        updatedTable.push(originalTable[i]);
                                      } else {
                                        updatedTable.push({
                                          wirelusg_id: Date.now() + i,
                                          wirelusg_unit_name: `New Unit ${i + 1}`,
                                          wirelusg_excavation: 0,
                                          wirelusg_steel: 0,
                                          wirelusg_concrete: 0,
                                          wirelusg_status_id: 3,
                                          wirelusg_completed_percetange: 0,
                                          wirelusg_mechanical_unit: 3,
                                          wirelusg_waitage: 0,       // ← ADD THIS
                                          subactivities: [],
                                          isNewEntry: true
                                        });
                                      }
                                    }

                                    // ── AUTO-DISTRIBUTE EQUAL WEIGHTAGE ──
                                    if (newCount > 0) {
                                      const equalShare = parseFloat((100 / newCount).toFixed(2));
                                      const remainder = parseFloat((100 - equalShare * newCount).toFixed(2));
                                      updatedTable = updatedTable.map((u, i) => ({
                                        ...u,
                                        wirelusg_waitage: i === 0 ? equalShare + remainder : equalShare
                                      }));
                                    }

                                    setEditedAttributes({
                                      ...editedAttributes,
                                      unit: text,
                                      tablarr_internal: updatedTable
                                    });
                                  }}
                                />
                              ) : (
                                <View style={[styles.attributeValue, {
                                  backgroundColor: isDark ? '#2E3147' : '#F8FAFC'
                                }]}>
                                  <Text style={styles.kvValue}>{String(selectedFeature.basic?.unit || '0')}</Text>
                                </View>
                              )}
                            </View>
                            {/* <View style={styles.attributeRow}>
                              <Text style={styles.kvKey}>Status</Text>
                              {isEditing ? (
                                <TouchableOpacity
                                  style={[styles.dropdown, { marginTop: 5, borderColor: '#007AFF' }]}
                                  onPress={() => setDropdown2Open(dropdown2Open === 'overall' ? null : 'overall')}
                                >
                                  <Text style={{ color: theme.text }}>
                                    {selectedFeature.geomStatusList?.find((s: any) => s.wists_id === (editedAttributes.st_id || selectedFeature.status.id))?.wists_name || 'Select Status'}
                                  </Text>
                                  <ChevronDown size={18} color={theme.text} />
                                </TouchableOpacity>
                              ) : (
                                <View style={[styles.attributeValue, { backgroundColor: '#F8FAFC' }]}>
                                  <Text style={styles.kvValue}>{selectedFeature.status?.name || 'N/A'}</Text>
                                </View>
                              )}

                              {isEditing && dropdown2Open === 'overall' && (
                                <View style={[styles.dropdownList, { position: 'relative', zIndex: 100, backgroundColor: theme.cardColor }]}>
                                  {selectedFeature.geomStatusList?.map((status: any) => (
                                    <TouchableOpacity
                                      key={status.wists_id}
                                      style={styles.dropdownItem}
                                      onPress={() => {
                                        setEditedAttributes({ ...editedAttributes, st_id: status.wists_id });
                                        setDropdown2Open(null);
                                      }}
                                    >
                                      <Text style={{ color: theme.text }}>{status.wists_name}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              )}
                            </View> */}
                          </View>
                          {renderDynamicAttributes()}
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Status Timeline</Text>
                            <View style={styles.statusBadgeContainer}>
                              {selectedFeature.geomStatusList?.map((status: any) => {
                                const isActive = (
                                  editedAttributes.status_id ||
                                  editedAttributes.st_id ||
                                  selectedFeature.status?.id ||
                                  selectedFeature.basic?.st_id
                                ) === status.wists_id;
                                const themeColor = status.wists_color || '#808080';

                                return (
                                  <TouchableOpacity
                                    key={status.wists_id}
                                    // Enable clicking if in editing mode
                                    // disabled={!isEditing}
                                    disabled={!isEditing || selectedFeature.basic?.isverify || selectedFeature.basic?.isVerify}
                                    onPress={() => setEditedAttributes({ ...editedAttributes, status_id: status.wists_id })}
                                    style={[
                                      styles.statusBadge,
                                      {
                                        // If active: Light version of the theme color (adding '20' for transparency)
                                        // If inactive: Light gray
                                        backgroundColor: isActive ? `${themeColor}20` : '#F3F4F6',
                                        borderWidth: isActive ? 2 : 0,
                                        borderColor: themeColor,
                                        opacity: !isEditing && !isActive ? 0.6 : 1 // Dim non-active ones when not editing
                                      }
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeText,
                                        {
                                          color: isActive ? themeColor : '#4B5563',
                                          fontWeight: isActive ? '700' : '400'
                                        }
                                      ]}
                                    >
                                      {status.wists_name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Upload Media</Text>
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                              <TouchableOpacity
                                disabled={!isEditing}
                                style={{
                                  width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed',
                                  borderColor: isEditing ? '#007AFF' : '#CBD5E1',
                                  justifyContent: 'center', alignItems: 'center',
                                  backgroundColor: isEditing ? '#F0F7FF' : '#F1F5F7'
                                }}
                                onPress={handlePickImage}
                              >
                                <Camera size={24} color={isEditing ? "#007AFF" : "#94A3B8"} />
                                <Text style={{ fontSize: 10, color: isEditing ? '#007AFF' : '#94A3B8', marginTop: 4 }}>Capture</Text>
                              </TouchableOpacity>

                              {capturedImage ? (
                                <View style={{ width: 80, height: 80, position: 'relative' }}>
                                  {/* The Image */}
                                  <Image
                                    source={{ uri: capturedImage.uri }}
                                    style={{ width: 80, height: 80, borderRadius: 8 }}
                                  />

                                  {/* The X Button Container */}
                                  <TouchableOpacity
                                    onPress={() => setCapturedImage(null)}
                                    activeOpacity={0.7}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      backgroundColor: '#EF4444',
                                      width: 26,
                                      height: 26,
                                      borderRadius: 13,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      borderWidth: 2,
                                      borderColor: '#FFF',
                                      zIndex: 99,
                                      elevation: 6,
                                    }}
                                  >
                                    <X size={14} color="#FFF" strokeWidth={3} />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>No preview</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Latest Uploaded Media</Text>

                            {selectedFeature.rawResponse?.image_date && selectedFeature.rawResponse.image_date.length > 0 ? (
                              (() => {
                                // Find the latest image based on wiiu_id
                                const images = [...selectedFeature.rawResponse.image_date];
                                const latestImg = images.sort((a, b) => b.wiiu_id - a.wiiu_id)[0];
                                const imageUri = normalizeToAbsolute(latestImg.wiiu_path);

                                return (
                                  <TouchableOpacity
                                    style={[styles.previousImageContainer, { width: 140 }]}
                                    onPress={() => {
                                      setSelectedImage(imageUri);
                                      setShowImageModal(true);
                                    }}
                                  >
                                    <Image
                                      source={{ uri: imageUri }}
                                      style={[styles.previousImage, { width: 140, height: 140 }]}
                                      resizeMode="cover"
                                    />
                                    {latestImg?.wiiu_id && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                      <TouchableOpacity
                                        onPress={() => {
                                          showAlert(
                                            "Delete Image",
                                            "Are you sure you want to delete this image?",
                                            "warning",
                                            [
                                              { text: "Cancel", style: "cancel", onPress: () => { } },
                                              {
                                                text: "Delete",
                                                style: "destructive",
                                                onPress: async () => {
                                                  try {
                                                    await deleteUnitImage({
                                                      image_id: latestImg.wiiu_id,
                                                      isFeature: "true",
                                                      isUnit: "false",
                                                      isSubActivity: "false",
                                                    });
                                                    showToast("Image deleted successfully ✓");
                                                    await refreshCurrentFeature();
                                                  } catch (err: any) {
                                                    showAlert("Error", err.message, "error");
                                                  }
                                                },
                                              },
                                            ]
                                          );
                                        }}
                                        style={{
                                          position: 'absolute',
                                          top: 6,
                                          right: 6,
                                          backgroundColor: '#EF4444',
                                          width: 30,
                                          height: 30,
                                          borderRadius: 15,
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          borderWidth: 2,
                                          borderColor: '#FFF',
                                          zIndex: 99,
                                          elevation: 6,
                                        }}
                                      >
                                        <Trash2 size={14} color="#FFF" />
                                      </TouchableOpacity>
                                    )}
                                    <View style={styles.imageDateBadge}>
                                      <Text style={styles.imageDateText}>
                                        Latest
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })()
                            ) : (
                              /* --- FALLBACK UI WHEN NO IMAGES EXIST --- */
                              <View style={styles.noImagePlaceholder}>
                                <ImageIcon size={32} color="#94A3B8" strokeWidth={1.5} />
                                <Text style={styles.noImageText}>No images uploaded for this feature</Text>
                              </View>
                            )}
                          </View>
                          <View style={[styles.card, { marginTop: 12 }]}>
                            <Text style={styles.sectionTitle}>Asset Links</Text>
                            <TouchableOpacity style={styles.linkRow} onPress={() => setLinkModalVisible(true)}>
                              <FileText size={20} color="#0EA5E9" />
                              <Text style={styles.linkTextPrimary}>Google Sheet Links ({(editedAttributes.sheet_links || selectedFeature.rawResponse?.sheet_links || []).length})</Text>
                              <ChevronRight size={18} color="#94A3B8" />
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.linkRow, { marginTop: 8 }]} onPress={() => setCameraModalVisible(true)}>
                              <Camera size={20} color="#F59E0B" />
                              <Text style={styles.linkTextPrimary}>Camera Links ({(editedAttributes.camera_links || selectedFeature.rawResponse?.camera_links || []).length})</Text>
                              <ChevronRight size={18} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>

                          <Text style={[styles.sectionTitle, { marginLeft: 4, marginTop: 20 }]}>
                            Unit Progress Details
                          </Text>
                          {(() => {
                            const allUnits = isEditing && editedAttributes.tablarr_internal
                              ? editedAttributes.tablarr_internal
                              : (selectedFeature?.rawResponse?.stp_table || []);

                            const totalWeightage = allUnits.reduce((sum: number, u: any, i: number) => {
                              const key = `unit_${i}`;
                              const edited = editedAttributes[key] || u;
                              return sum + (parseFloat(edited.wirelusg_waitage) || u.wirelusg_waitage || 0);
                            }, 0);

                            const isBalanced = Math.abs(totalWeightage - 100) < 0.01;
                            return (
                              <>
                                {hasAccess("SET_STP_UNIT_WEIGHTAGE") && (
                                  <View style={{
                                    marginHorizontal: 4,
                                    marginTop: 8,
                                    marginBottom: 12,
                                    padding: 14,
                                    borderRadius: 10,
                                    backgroundColor: isBalanced ? (isDark ? '#0D2B1F' : '#F0FDF4') : (isDark ? '#3D1010' : '#FEF2F2'),
                                    borderWidth: 1.5,
                                    borderColor: isBalanced ? '#DCFCE7' : '#FEE2E2',
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                  }}>
                                    <View>
                                      <Text style={{ fontSize: 12, color: isBalanced ? '#15803D' : '#EF4444', fontWeight: '600' }}>
                                        Total Unit Weightage
                                      </Text>
                                      <Text style={{ fontSize: 11, color: isBalanced ? '#16A34A' : '#DC2626', marginTop: 2 }}>
                                        {isBalanced ? '✓ Balanced' : `⚠ ${(100 - totalWeightage).toFixed(1)}% remaining`}
                                      </Text>
                                    </View>
                                    <Text style={{ fontSize: 22, fontWeight: '900', color: isBalanced ? '#15803D' : '#EF4444' }}>
                                      {totalWeightage.toFixed(1)}%
                                    </Text>
                                  </View>
                                )}
                              </>
                            );
                          })()}
                          {((isEditing && editedAttributes.tablarr_internal)
                            ? editedAttributes.tablarr_internal
                            : (selectedFeature?.rawResponse?.stp_table || [])
                          ).map((unit: any, index: number) => {
                            const unitKey = `unit_${index}`;
                            const unitData = editedAttributes[unitKey] || unit;
                            const isExpandedCard = expandedUnitCardId === (unit.wirelusg_id ?? index);
                            const isEditingUnitRemark = activeUnitRemarkId === unit.wirelusg_id;
                            const statusDropdownKey = `unit_status_${index}`;
                            const mechDropdownKey = `unit_mech_${index}`;
                            const isUnitCompleted = unitData.wirelusg_status_id === 1;
                            const currentMechStatus = selectedFeature.rawResponse?.machuni_status_list?.find(
                              (m: any) => m.wimus_id == unitData.wirelusg_mechanical_unit
                            );
                            const handleUnitRemarkFromEditor = async (htmlContent: string) => {
                              const plainText = htmlContent.replace(/<[^>]*>/g, '').trim();
                              if (!plainText) return;
                              try {
                                const payload: SaveRemarkPayload = {
                                  isFeature: "false",
                                  isSubActivity: "false",
                                  isUnit: "true",
                                  remark: htmlContent,
                                  wilm_id: 3,
                                  unit_id: unit.wirelusg_id,
                                };
                                const response = await saveRemark(payload);
                                if (response.status) {
                                  setActiveUnitRemarkId(null);
                                  showAlert("Success", "Unit remark saved successfully", 'success');
                                  try {
                                    const historyRes = await fetchRemarkHistory({
                                      isFeature: false,
                                      isUnit: true,
                                      isSubActivity: false,
                                      wilm_id: 3,
                                      unit_id: unit.wirelusg_id,
                                    });
                                    const formatted = (historyRes?.data?.remarkData || []).map(
                                      (item: any, idx: number) => ({
                                        id: `unit-history-${idx}-${Date.now()}`,
                                        user: item.created_by || 'Unknown',
                                        text: item.remark || '',
                                        date: item.created_at,
                                      })
                                    );
                                    setUnitRemarkHistories(prev => ({ ...prev, [unit.wirelusg_id]: formatted }));
                                  } catch (_) { }
                                }
                              } catch (err: any) {
                                showAlert("Error", err.message || "Failed to save unit remark", 'error');
                              }
                            };

                            // ✅ ADD THIS inside the same map, before the return (for subactivities)
                            const handleSubActivityRemarkFromEditor = async (htmlContent: string) => {
                              const plainText = htmlContent.replace(/<[^>]*>/g, '').trim();
                              if (!plainText || !activeSubActivityId) return;
                              if (activeSubActivityId > 1000000000) {
                                showAlert("Save Required", "Save this sub-activity first before adding remarks.", 'warning');
                                return;
                              }
                              try {
                                const payload: SaveRemarkPayload = {
                                  isFeature: "false",
                                  isSubActivity: "true",
                                  isUnit: "true",
                                  remark: htmlContent,
                                  wiresu_id: activeSubActivityId,
                                  wilm_id: 3,
                                  unit_id: unit.wirelusg_id,
                                };
                                const response = await saveRemark(payload);
                                if (response.status) {
                                  setActiveSubActivityId(null);
                                  showAlert("Success", "Remark saved successfully", 'success');
                                }
                              } catch (err: any) {
                                showAlert("Error", err.message || "Failed to save remark", 'error');
                              }
                            };

                            return (
                              <View
                                key={unit.wirelusg_id || `new-unit-${index}`}
                                style={[
                                  styles.unitCard,
                                  {
                                    backgroundColor: theme.cardColor,
                                    borderColor: isExpandedCard ? '#007AFF' : borderColor,
                                    borderWidth: isExpandedCard ? 1.5 : 1,
                                    zIndex: (dropdown2Open === mechDropdownKey || dropdown2Open === statusDropdownKey) ? 5000 : (100 - index),
                                    marginBottom: 10,
                                    overflow: 'visible',
                                  }
                                ]}
                              >
                                {/* ── HEADER AREA (Always Visible) ── */}
                                <View style={{ paddingVertical: 8, width: '100%' }}>

                                  {/* ROW 1: Unit Name (Full Width) */}
                                  <TouchableOpacity
                                    activeOpacity={0.7}
                                    onPress={() => setExpandedUnitCardId(isExpandedCard ? null : (unit.wirelusg_id ?? index))}
                                    style={{ width: '100%', marginBottom: 8 }}
                                  >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <Text
                                        style={{
                                          fontSize: 16, // Slightly larger for header feel
                                          fontWeight: '800',
                                          color: isExpandedCard ? '#007AFF' : theme.text,
                                          flex: 1, // Allows text to take available space
                                        }}
                                      >
                                        {unitData.wirelusg_unit_name || `Unit ${index + 1}`}
                                      </Text>
                                      {isExpandedCard ? (
                                        <ChevronUp size={20} color="#007AFF" />
                                      ) : (
                                        <ChevronDown size={20} color={subTextColor} />
                                      )}
                                    </View>
                                  </TouchableOpacity>

                                  {/* ROW 2: Status, Percentage, and Action Icons */}
                                  <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'space-between', // Pushes icons to the right
                                    width: '100%'
                                  }}>

                                    {/* Left Side: Status Pill & Percentage */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                      <View style={[
                                        styles.statusPill,
                                        { backgroundColor: unitData.wirelusg_status_id === 1 ? '#DCFCE7' : (isDark ? '#2E3147' : '#F1F5F9'), paddingVertical: 4 }
                                      ]}>
                                        <Text style={[
                                          styles.statusPillText,
                                          { fontSize: 10, color: unitData.wirelusg_status_id === 1 ? '#15803D' : '#64748B', fontWeight: '600' }
                                        ]}>
                                          {selectedFeature.rawResponse?.uni_status_list?.find((s: any) => s.wiusts_id === unitData.wirelusg_status_id)?.wiusts_name || 'Pending'}
                                        </Text>
                                      </View>

                                      <Text style={{ fontSize: 12, color: subTextColor, fontWeight: '800' }}>
                                        {unitData.wirelusg_completed_percetange || 0}%
                                      </Text>
                                    </View>

                                    {/* Right Side: Action Icons */}
                                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                      <TouchableOpacity
                                        style={styles.subActionIconCircle}
                                        onPress={() => isEditing ? handlePickImageForUnit(unit.wirelusg_id) : handleViewUnitImage(unit.wirelusg_id)}
                                      >
                                        {isEditing ? (
                                          <Camera size={18} color="#007AFF" />
                                        ) : (
                                          <ImageIcon size={18} color={unit.wiuiu_path ? "#007AFF" : "#94A3B8"} />
                                        )}
                                      </TouchableOpacity>

                                      <TouchableOpacity style={styles.subActionIconCircle} onPress={() => handleViewUnitHistory(unit.wirelusg_id)}>
                                        <FileText size={18} color="#64748B" />
                                      </TouchableOpacity>
                                      {hasWriteAccess("DASHBOARD_REMARK") && isEditing &&(

                                        <TouchableOpacity
                                          style={[
                                            styles.subActionIconCircle,
                                            activeUnitRemarkId === unit.wirelusg_id && { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }
                                          ]}
                                          onPress={() => {
                                            const isOpen = activeUnitRemarkId === unit.wirelusg_id;
                                            setActiveUnitRemarkId(isOpen ? null : unit.wirelusg_id);
                                            if (!isOpen) setExpandedUnitCardId(unit.wirelusg_id);
                                          }}
                                        >
                                          <MessageSquare
                                            size={18}
                                            color={activeUnitRemarkId === unit.wirelusg_id ? '#EF4444' : '#007AFF'}
                                          />
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  </View>
                                </View>

                                {/* ── EXPANDED CARD BODY ── */}
                                {isExpandedCard && (
                                  <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 14 }}>

                                    {/* Edit Unit Name Input */}
                                    {isEditing && !isUnitCompleted && !selectedFeature.basic?.isverify && (
                                      <View style={{ marginBottom: 12 }}>
                                        <Text style={styles.metricLabel}>Unit Name</Text>
                                        <TextInput
                                          style={[styles.attributeInput, { color: theme.text, marginTop: 4 }]}
                                          value={unitData.wirelusg_unit_name}
                                          placeholder="Unit Name"
                                          onChangeText={(text) => setEditedAttributes({
                                            ...editedAttributes,
                                            [unitKey]: { ...unitData, wirelusg_unit_name: text }
                                          })}
                                        />
                                      </View>
                                    )}

                                    {/* Remark Editor (shown below header icon toggle) */}
                                    {!isEditing && activeUnitRemarkId === unit.wirelusg_id && (
                                      <View style={{ marginBottom: 16 }}>
                                        <AddRemarkEditor onAddRemark={handleUnitRemarkFromEditor} />
                                      </View>
                                    )}

                                    {/* Metrics Grid */}
                                    <View style={[styles.metricsGrid, { marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                                      {[
                                        { label: 'Estimated Excavation m³', field: 'wirelusg_excavation' },
                                        { label: 'Estimated Steel MT', field: 'wirelusg_steel' },
                                        { label: 'Estimated Concrete m³', field: 'wirelusg_concrete' },
                                      ].map((m) => (
                                        <View
                                          key={m.field}
                                          style={[
                                            styles.metricItem,
                                            {
                                              flex: 1,
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              paddingHorizontal: 4,
                                              marginHorizontal: 4,
                                            },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.metricLabel,
                                              { textAlign: 'center' },
                                            ]}
                                            numberOfLines={2}
                                          >
                                            {m.label}
                                          </Text>

                                          {isEditing && !isUnitCompleted && !selectedFeature.basic?.isverify ? (
                                            <TextInput
                                              style={[
                                                styles.metricValue,
                                                {
                                                  color: theme.text,
                                                  borderBottomWidth: 1,
                                                  borderColor: '#007AFF',
                                                  textAlign: 'center',
                                                  width: '100%',
                                                  minWidth: 45,
                                                },
                                              ]}
                                              value={String(unitData[m.field] ?? '0')}
                                              onChangeText={(val) =>
                                                setEditedAttributes({
                                                  ...editedAttributes,
                                                  [unitKey]: { ...unitData, [m.field]: val },
                                                })
                                              }
                                            />
                                          ) : (
                                            <Text
                                              style={[
                                                styles.metricValue,
                                                { color: theme.text, textAlign: 'center' },
                                              ]}
                                            >
                                              {unit[m.field] ?? '0'}
                                            </Text>
                                          )}
                                        </View>
                                      ))}
                                    </View>
                                    {/* ── UNIT WEIGHTAGE ROW ── */}
                                    {hasAccess("SET_STP_UNIT_WEIGHTAGE") && (

                                      <View style={{ marginTop: 10, marginBottom: 4 }}>
                                        <Text style={styles.metricLabel}>Unit Weightage (%)</Text>

                                        {isEditing ? (
                                          <TextInput
                                            style={{
                                              borderWidth: 1.5,
                                              borderColor: '#007AFF',
                                              borderRadius: 8,
                                              paddingHorizontal: 10,
                                              paddingVertical: 6,
                                              fontSize: 16,
                                              fontWeight: '700',
                                              color: '#007AFF',
                                              textAlign: 'center',
                                              width: 'auto',
                                              backgroundColor: '#F0F7FF',
                                              marginTop: 6,
                                            }}
                                            // keyboardType="numeric"
                                            value={String(unitData.wirelusg_waitage ?? 0)}
                                            onChangeText={(val) =>
                                              setEditedAttributes({
                                                ...editedAttributes,
                                                [unitKey]: { ...unitData, wirelusg_waitage: val },
                                              })
                                            }
                                          />
                                        ) : (
                                          <View style={{
                                            backgroundColor: isDark ? '#1E3A5F' : '#EBF5FF',
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 8,
                                            alignSelf: 'flex-start',
                                            marginTop: 6,
                                          }}>
                                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#007AFF' }}>
                                              {parseFloat(String(unit.wirelusg_waitage ?? 0)).toFixed(2)}%
                                            </Text>
                                          </View>
                                        )}
                                      </View>
                                    )}
                                    {/* Mechanical & Status Selectors */}
                                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.metricLabel}>Mechanical Unit</Text>
                                        {isEditing && !isUnitCompleted && !selectedFeature.basic?.isverify ? (
                                          <View style={{ marginTop: 6, gap: 6 }}>
                                            {selectedFeature.rawResponse?.machuni_status_list?.map((m: any) => {
                                              const isSelected = unitData.wirelusg_mechanical_unit === m.wimus_id;
                                              const mechColors: Record<number, string> = {
                                                1: '#00CC44', // Completed - green
                                                2: '#FF3B30', // Pending - red
                                                3: '#FFCC00', // Other - yellow
                                              };
                                              const dotColor = mechColors[m.wimus_id] || '#94A3B8';
                                              return (
                                                <TouchableOpacity
                                                  key={m.wimus_id}
                                                  style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    paddingVertical: 6,
                                                    paddingHorizontal: 4,
                                                  }}
                                                  onPress={() => {
                                                    setEditedAttributes({
                                                      ...editedAttributes,
                                                      [unitKey]: { ...unitData, wirelusg_mechanical_unit: m.wimus_id }
                                                    });
                                                  }}
                                                >
                                                  {/* Radio Circle */}
                                                  <View style={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: 11,
                                                    borderWidth: 2.5,
                                                    borderColor: dotColor,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    backgroundColor: '#FFF',
                                                  }}>
                                                    {/* Inner circle — always visible, filled only when selected */}
                                                    <View style={{
                                                      width: 11,
                                                      height: 11,
                                                      borderRadius: 6,
                                                      borderWidth: isSelected ? 0 : 2,
                                                      borderColor: dotColor,
                                                      backgroundColor: isSelected ? dotColor : 'transparent',
                                                    }} />
                                                  </View>
                                                  <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: isSelected ? '700' : '500',
                                                    color: isSelected ? '#007AFF' : theme.text,
                                                  }}>
                                                    {m.wimus_name}
                                                  </Text>
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </View>
                                        ) : (
                                          <View style={{ marginTop: 6, gap: 6 }}>
                                            {selectedFeature.rawResponse?.machuni_status_list?.map((m: any) => {
                                              const isSelected = unitData.wirelusg_mechanical_unit === m.wimus_id;
                                              const mechColors: Record<number, string> = {
                                                1: '#00CC44',
                                                2: '#FF3B30',
                                                3: '#FFCC00',
                                              };
                                              const dotColor = mechColors[m.wimus_id] || '#94A3B8';
                                              return (
                                                <View
                                                  key={m.wimus_id}
                                                  style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    paddingVertical: 6,
                                                    paddingHorizontal: 4,
                                                    opacity: isSelected ? 1 : 0.35,
                                                  }}
                                                >
                                                  <View style={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: 11,
                                                    borderWidth: 2.5,
                                                    borderColor: dotColor,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    backgroundColor: '#FFF',
                                                  }}>
                                                    <View style={{
                                                      width: 11,
                                                      height: 11,
                                                      borderRadius: 6,
                                                      borderWidth: isSelected ? 0 : 2,
                                                      borderColor: dotColor,
                                                      backgroundColor: isSelected ? dotColor : 'transparent',
                                                    }} />
                                                  </View>
                                                  <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: isSelected ? '700' : '500',
                                                    color: isSelected ? dotColor : theme.text,
                                                  }}>
                                                    {m.wimus_name}
                                                  </Text>
                                                </View>
                                              );
                                            })}
                                          </View>
                                        )}

                                      </View>

                                      {/* Unit Status */}
                                      <View style={{ flex: 1 }}>
                                        <Text style={styles.metricLabel}>Status</Text>
                                        {isEditing && !isUnitCompleted && !selectedFeature.basic?.isverify ? (
                                          <View style={{ marginTop: 6, gap: 6 }}>
                                            {selectedFeature.rawResponse?.uni_status_list?.map((s: any) => {
                                              const isSelected = unitData.wirelusg_status_id === s.wiusts_id;
                                              const statusColors: Record<number, string> = {
                                                1: '#00CC44', // Completed - green
                                                2: '#FF3B30', // Pending - red
                                                3: '#FFCC00', // Verified / Other - yellow
                                              };
                                              const dotColor = statusColors[s.wiusts_id] || '#94A3B8';
                                              return (
                                                <TouchableOpacity
                                                  key={s.wiusts_id}
                                                  style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    paddingVertical: 6,
                                                    paddingHorizontal: 4,
                                                  }}
                                                  onPress={() => {
                                                    if (s.wiusts_id === 1) {
                                                      const mechUnit = Number(unitData.wirelusg_mechanical_unit);
                                                      const isAllowed = mechUnit === 1 || mechUnit === 2;
                                                      if (!isAllowed) {
                                                        showAlert("Restriction", "Mechanical Unit must be Completed first.", 'warning');
                                                        return;
                                                      }
                                                      const allSubsCompleted = unit.subactivities?.every(
                                                        (sub: any) => sub.sub_status === 1
                                                      );
                                                      if (!allSubsCompleted) {
                                                        showAlert(
                                                          "Restriction",
                                                          "All sub-activities must be marked as 'Completed' before the main unit can be closed.",
                                                          'warning'
                                                        );
                                                        return;
                                                      }
                                                      const completedPercentage = parseFloat(unitData.wirelusg_completed_percetange) || 0;
                                                      if (completedPercentage !== 100) {
                                                        showAlert(
                                                          "Restriction",
                                                          `Unit progress must be 100% to mark as Completed. Current progress is ${completedPercentage}%.`,
                                                          'warning'
                                                        );
                                                        return;
                                                      }
                                                    }
                                                    setEditedAttributes({
                                                      ...editedAttributes,
                                                      [unitKey]: { ...unitData, wirelusg_status_id: s.wiusts_id }
                                                    });
                                                  }}
                                                >
                                                  {/* Radio Circle */}
                                                  <View style={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: 11,
                                                    borderWidth: 2.5,
                                                    borderColor: dotColor,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    backgroundColor: '#FFF',
                                                  }}>
                                                    {/* Inner circle — always visible, filled only when selected */}
                                                    <View style={{
                                                      width: 11,
                                                      height: 11,
                                                      borderRadius: 6,
                                                      borderWidth: isSelected ? 0 : 2,
                                                      borderColor: dotColor,
                                                      backgroundColor: isSelected ? dotColor : 'transparent',
                                                    }} />
                                                  </View>
                                                  <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: isSelected ? '700' : '500',
                                                    color: isSelected ? '#007AFF' : theme.text,
                                                  }}>
                                                    {s.wiusts_name}
                                                  </Text>
                                                </TouchableOpacity>
                                              );
                                            })}
                                          </View>
                                        ) : (
                                          <View style={{ marginTop: 6, gap: 6 }}>
                                            {selectedFeature.rawResponse?.uni_status_list?.map((s: any) => {
                                              const isSelected = unitData.wirelusg_status_id === s.wiusts_id;
                                              const statusColors: Record<number, string> = {
                                                1: '#00CC44',
                                                2: '#FF3B30',
                                                3: '#FFCC00',
                                              };
                                              const dotColor = statusColors[s.wiusts_id] || '#94A3B8';
                                              return (
                                                <View
                                                  key={s.wiusts_id}
                                                  style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    paddingVertical: 6,
                                                    paddingHorizontal: 4,
                                                    opacity: isSelected ? 1 : 0.35,
                                                  }}
                                                >
                                                  <View style={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: 11,
                                                    borderWidth: 2.5,
                                                    borderColor: dotColor,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    backgroundColor: '#FFF',
                                                  }}>
                                                    <View style={{
                                                      width: 11,
                                                      height: 11,
                                                      borderRadius: 6,
                                                      borderWidth: isSelected ? 0 : 2,
                                                      borderColor: dotColor,
                                                      backgroundColor: isSelected ? dotColor : 'transparent',
                                                    }} />
                                                  </View>
                                                  <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: isSelected ? '700' : '500',
                                                    color: isSelected ? dotColor : theme.text,
                                                  }}>
                                                    {s.wiusts_name}
                                                  </Text>
                                                </View>
                                              );
                                            })}
                                          </View>
                                        )}
                                      </View>
                                    </View>

                                    {/* Nested Sub-Activities Section */}
                                    {unit.subactivities && unit.subactivities.length > 0 && (
                                      <View style={{ marginTop: 15, borderTopWidth: 1, borderTopColor: borderColor }}>
                                        <TouchableOpacity style={styles.subActivityHeader} onPress={() => toggleSubActivities(unit.wirelusg_id)}>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <CheckSquare size={16} color={theme.text} />
                                            <Text style={[styles.metricLabel, { color: theme.text, marginBottom: 0 }]}>Sub Activities ({unit.subactivities.length})</Text>
                                          </View>
                                          {expandedUnits[unit.wirelusg_id] ? <ChevronUp size={20} color="#007AFF" /> : <ChevronDown size={20} color={subTextColor} />}
                                        </TouchableOpacity>

                                        {expandedUnits[unit.wirelusg_id] && (
                                          <View style={{ marginTop: 10, gap: 12 }}>
                                            <View style={styles.cumulativeCard}>
                                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                                <BarChart3 size={16} color="#475569" style={{ marginRight: 6 }} />
                                                <Text style={styles.cumulativeHeaderTitle}>UNIT CUMULATIVE USAGE</Text>
                                              </View>

                                              {(() => {
                                                const usage = calculateCumulativeUsage(unit);

                                                const items = [
                                                  {
                                                    label: 'Excavation',
                                                    data: usage.excavation,
                                                    unit: 'm³',
                                                    color: '#009640'
                                                  },
                                                  {
                                                    label: 'Steel',
                                                    data: usage.steel,
                                                    unit: 'MT',
                                                    color: '#007AFF'
                                                  },
                                                  {
                                                    label: 'Concrete',
                                                    data: usage.concrete,
                                                    unit: 'm³',
                                                    color: '#F59E0B'
                                                  }
                                                ];

                                                return items.map((item, idx) => (
                                                  <View key={idx} style={styles.usageRow}>
                                                    <View style={styles.rowBetween}>
                                                      <Text style={[styles.usageItemLabel, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                                                        {item.label}
                                                      </Text>
                                                      <Text style={[styles.usagePercentageText, { color: item.color }]}>
                                                        {item.data.sum} {item.unit} ({item.data.percentage}%)
                                                      </Text>
                                                    </View>

                                                    <View style={[styles.usageBarBackground, { backgroundColor: isDark ? '#3A3A3C' : '#E2E8F0' }]}>
                                                      <View style={[
                                                        styles.usageBarFill,
                                                        {
                                                          width: `${Math.min(parseFloat(item.data.percentage), 100)}%`,
                                                          backgroundColor: parseFloat(item.data.percentage) > 100 ? '#EF4444' : item.color
                                                        }
                                                      ]} />
                                                    </View>

                                                    <View style={styles.rowBetween}>
                                                      <Text style={styles.usageSubStats}>
                                                        Unit Target: {item.data.target} {item.unit}
                                                      </Text>
                                                    </View>
                                                  </View>
                                                ));
                                              })()}
                                            </View>
                                            {unit.subactivities.map((sub: any) => {
                                              const isEditingThisSub = activeSubActivityId === sub.subactivity_id;
                                              const subDropdownKey = `sub_${unit.wirelusg_id}_${sub.subactivity_id}`;
                                              const isSubDropdownOpen = dropdown2Open === subDropdownKey;
                                              return (
                                                <View
                                                  key={sub.subactivity_id}
                                                  style={[
                                                    styles.subActivityCard2,
                                                    {
                                                      backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                                                      // CHANGE: Ensure this specific sub-card sits above others when open
                                                      zIndex: isSubDropdownOpen ? 1000 : 1,
                                                      elevation: isSubDropdownOpen ? 10 : 1,
                                                      overflow: 'visible', // Allow dropdown to spill out
                                                    }
                                                  ]}
                                                >
                                                  <View style={styles.subActivityHeaderRow}>
                                                    <View style={{ flex: 1 }}>
                                                      <Text style={[styles.subActivityName, { color: theme.text }]}>{sub.subactivity_name}</Text>

                                                      {isEditing && !isUnitCompleted && !selectedFeature.basic?.isverify ? (
                                                        <View style={{ position: 'relative', zIndex: 10000 }}>
                                                          <TouchableOpacity
                                                            style={[styles.dropdown, { paddingVertical: 4, paddingHorizontal: 8, marginTop: 4, borderColor: '#007AFF', height: 30 }]}
                                                            onPress={() => setDropdown2Open(isSubDropdownOpen ? null : subDropdownKey)}
                                                          >
                                                            <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>
                                                              {selectedFeature.rawResponse?.uni_status_list?.find((s: any) => s.wiusts_id === (sub.sub_status || 3))?.wiusts_name || 'Select Status'}
                                                            </Text>
                                                            <ChevronDown size={14} color="#007AFF" />
                                                          </TouchableOpacity>

                                                          {isSubDropdownOpen && (
                                                            <View style={{
                                                              position: 'absolute',
                                                              top: 32,
                                                              left: 0,
                                                              right: 0,
                                                              backgroundColor: theme.cardColor,
                                                              borderRadius: 6,
                                                              borderWidth: 1,
                                                              borderColor: borderColor,
                                                              zIndex: 11000,
                                                              elevation: 20 // CHANGE: High elevation for Android visibility
                                                            }}>
                                                              {selectedFeature.rawResponse?.uni_status_list?.map((s: any) => (
                                                                <TouchableOpacity
                                                                  key={s.wiusts_id}
                                                                  style={styles.dropdownItem}
                                                                  onPress={() => { sub.sub_status = s.wiusts_id; setDropdown2Open(null); }}
                                                                >
                                                                  <Text style={{ color: theme.text, fontSize: 12 }}>{s.wiusts_name}</Text>
                                                                </TouchableOpacity>
                                                              ))}
                                                            </View>
                                                          )}
                                                        </View>
                                                      ) : (
                                                        <View
                                                          style={[
                                                            styles.statusPill,
                                                            {
                                                              alignSelf: 'flex-start',
                                                              marginTop: 4,
                                                              backgroundColor:
                                                                sub.sub_status === 1
                                                                  ? '#DCFCE7' // Completed
                                                                  : sub.sub_status === 2
                                                                    ? '#FEF3C7' // Ongoing
                                                                    : '#F1F5F9', // Pending
                                                            },
                                                          ]}
                                                        >
                                                          <Text
                                                            style={[
                                                              styles.statusPillText,
                                                              {
                                                                fontSize: 10,
                                                                color:
                                                                  sub.sub_status === 1
                                                                    ? '#15803D' // Completed
                                                                    : sub.sub_status === 2
                                                                      ? '#D97706' // Ongoing
                                                                      : '#64748B', // Pending
                                                              },
                                                            ]}
                                                          >
                                                            {sub.sub_status === 1
                                                              ? 'Completed'
                                                              : sub.sub_status === 2
                                                                ? 'Ongoing'
                                                                : 'Pending'}
                                                          </Text>
                                                        </View>
                                                      )}
                                                    </View>
                                                    <View style={styles.subActivityActions}>
                                                      {sub.wiresu_ismaterial_req && (
                                                        <TouchableOpacity
                                                          style={styles.addMaterialTrigger}
                                                          onPress={() => {
                                                            setActiveUsageSubId(sub.subactivity_id);
                                                            setActiveUsageUnitId(unit.wirelusg_id);
                                                            setMaterialFormData({ excavation: '', steel: '', concrete: '' });
                                                            setIsAddMaterialModalOpen(true);
                                                          }}
                                                        >
                                                          <Plus size={16} color="#FFF" />
                                                        </TouchableOpacity>
                                                      )}
                                                      <TouchableOpacity
                                                        style={styles.subActionIconCircle}
                                                        onPress={() => isEditing ? handlePickImageForSubActivity(unit.wirelusg_id, sub.subactivity_id) : handleViewSubImage(sub.subactivity_id)}
                                                      >
                                                        {isEditing ? <Camera size={16} color="#007AFF" /> : <ImageIcon size={16} color="#007AFF" />}
                                                      </TouchableOpacity>

                                                      <TouchableOpacity
                                                        style={styles.subActionIconCircle}
                                                        onPress={() => handleViewSubActivityHistory(sub.subactivity_id, unit.wirelusg_id)}
                                                      >
                                                        <FileText size={16} color="#64748B" />
                                                      </TouchableOpacity>
                                                      {hasWriteAccess("DASHBOARD_REMARK") && isEditing && (
                                                        <TouchableOpacity
                                                          style={styles.subActionIconCircle}
                                                          onPress={() => { setSubActivityRemark(''); setActiveSubActivityId(isEditingThisSub ? null : sub.subactivity_id); }}
                                                        >
                                                          <MessageSquare size={16} color={isEditingThisSub ? '#EF4444' : '#007AFF'} />
                                                        </TouchableOpacity>
                                                      )}


                                                    </View>
                                                  </View>

                                                  {/* Material usage metrics */}
                                                  {/* {sub.wiresu_ismaterial_req && ( */}
                                                  <View style={[styles.metricsGrid, { marginTop: 10 }]}>
                                                    {[
                                                      { label: 'Excavation', value: sub.excavation, unit: 'm³' },
                                                      { label: 'Steel', value: sub.steel, unit: 'MT' },
                                                      { label: 'Concrete', value: sub.concrete, unit: 'm³' },
                                                    ].map((m) => (
                                                      <View key={m.label} style={styles.metricItem}>
                                                        <Text style={styles.metricLabel}>{m.label}</Text>
                                                        <Text style={[styles.metricValue, { color: theme.text, fontSize: 12 }]}>
                                                          {m.value || '0'} <Text style={{ fontSize: 9, color: '#94A3B8' }}>{m.unit}</Text>
                                                        </Text>
                                                      </View>
                                                    ))}
                                                  </View>
                                                  {/* )} */}

                                                  {/* Weightage + material badge */}
                                                  <View style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between', // Pushes elements to the far ends
                                                    marginTop: 8
                                                  }}>
                                                    {/* Left Side */}
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                      <BarChart3 size={11} color="#64748B" />
                                                      <Text style={{ fontSize: 10, color: '#475569', fontWeight: '700' }}>
                                                        Weight: {sub.weightage || 0}%
                                                      </Text>
                                                    </View>

                                                    {/* Right Side Badge */}
                                                    {sub.wiresu_ismaterial_req ? (
                                                      <View style={styles.materialBadge}>
                                                        <Package size={10} color="#0891B2" />
                                                        <Text style={styles.materialText}>Material Req.</Text>
                                                      </View>
                                                    ) : (
                                                      <View style={styles.materialBadgeOrange}>
                                                        <Package size={10} color="#C2410C" />
                                                        <Text style={styles.materialTextOrange}>Material Not Req.</Text>
                                                      </View>
                                                    )}
                                                  </View>

                                                  {isEditingThisSub && <AddRemarkEditor onAddRemark={handleSubActivityRemarkFromEditor} />}
                                                </View>
                                              );
                                            })}
                                          </View>
                                        )}
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </>
                      );

                    // ========== Existing Pipeline ==========
                    case 'waternetinfraa:pipeline_existing':
                      return (
                        <View style={styles.card}>
                          <Text style={styles.sectionTitle}>Existing Pipeline</Text>
                          <AttributeItem label="Label" value={selectedFeature.basic?.label} />
                          <AttributeItem label="Diameter" value={String(selectedFeature.basic?.diameter || 'N/A')} />
                          <AttributeItem label="Length" value={String(selectedFeature.basic?.length || 'N/A')} />
                          <AttributeItem label="Material" value={String(selectedFeature.basic?.material || 'N/A')} />
                        </View>
                      );

                    // ==========  MANHOLE ==========
                    case 'waternetinfraa:manhole_main':
                      const isMhVerified = selectedFeature.basic?.wimg_isverified === true || selectedFeature.basic?.isverify === true;
                      const currentMhStatus = editedAttributes.status_id || selectedFeature.status?.id;
                      const showActualDepth = currentMhStatus === 1;
                      const isCompletedStatusVerifyManhole = selectedFeature.status.id === 1;
                      
                      return (
                        <>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Manhole</Text>
                            <AttributeItem label="Label" value={selectedFeature.basic?.wimg_label} />
                            <AttributeItem label="Elevation (Ground) (m)" value={String(selectedFeature.basic?.wimg_elevation_ground || 'N/A')} />
                            <AttributeItem label="Elevation (Invert) (m)" value={String(selectedFeature.basic?.wimg_elevation_invert || 'N/A')} />
                            <View style={styles.attributeRow}>
                              <Text style={styles.kvKey}>Diameter (m)</Text>
                              {isEditing ? (
                                <TextInput
                                  style={[styles.attributeInput, { backgroundColor: inputBg, color: theme.text }]}
                                  value={String(editedAttributes.wimg_diameter ?? selectedFeature.basic?.wimg_diameter ?? '')}
                                  placeholder="Enter diameter"
                                  placeholderTextColor="#8E8E93"
                                  keyboardType="numeric"
                                  onChangeText={(text) =>
                                    setEditedAttributes((prev: any) => ({ ...prev, wimg_diameter: text }))
                                  }
                                />
                              ) : (
                                <View style={[styles.attributeValue, { backgroundColor: isDark ? '#2E3147' : '#F8FAFC' }]}>
                                  <Text style={styles.kvValue}>{selectedFeature.basic?.wimg_diameter || 'N/A'}</Text>
                                </View>
                              )}
                            </View>
                            {/* Bottom Diameter — inlined to keep TextInput stable in tree (prevents keyboard dismiss) */}
                            <View style={styles.attributeRow}>
                              <Text style={styles.kvKey}>Bottom Diameter (m)</Text>
                              {isEditing ? (
                                <View style={{ flex: 1 }}>
                                  <TextInput
                                    style={[styles.attributeInput, { backgroundColor: inputBg, color: theme.text }]}
                                    value={String(editedAttributes.wimg_bottom_diameter ?? selectedFeature.basic?.wimg_bottom_diameter ?? '')}
                                    placeholder="Type or select value"
                                    placeholderTextColor="#8E8E93"
                                    keyboardType="numeric"
                                    onFocus={() => setShowBdDropdown(true)}
                                    onChangeText={(text) => {
                                      setEditedAttributes((prev: any) => ({ ...prev, wimg_bottom_diameter: text }));
                                    }}
                                  />
                                  {showBdDropdown && (() => {
                                    const allOpts: string[] = Array.isArray(selectedFeature.rawResponse?.bottom_diameter_options)
                                      ? selectedFeature.rawResponse.bottom_diameter_options
                                      : typeof selectedFeature.basic?.bottom_diameter_options === 'string'
                                        ? selectedFeature.basic.bottom_diameter_options.split(',')
                                        : [];
                                    const typedVal = String(editedAttributes.wimg_bottom_diameter ?? selectedFeature.basic?.wimg_bottom_diameter ?? '');
                                    const opts = typedVal
                                      ? allOpts.filter((o) => o.toLowerCase().includes(typedVal.toLowerCase()))
                                      : allOpts;
                                    if (!opts.length) return null;
                                    return (
                                      <View style={{
                                        marginTop: 4,
                                        borderWidth: 1,
                                        borderColor: borderColor,
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                        backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF',
                                      }}>
                                        {opts.map((opt, idx) => {
                                          const isSelected = typedVal === opt;
                                          return (
                                            <TouchableOpacity
                                              key={opt}
                                              onPress={() => {
                                                setEditedAttributes((prev: any) => ({ ...prev, wimg_bottom_diameter: opt }));
                                                setShowBdDropdown(false);
                                              }}
                                              style={{
                                                paddingHorizontal: 14,
                                                paddingVertical: 12,
                                                borderBottomWidth: idx < opts.length - 1 ? 1 : 0,
                                                borderBottomColor: borderColor,
                                                backgroundColor: isSelected ? (isDark ? '#3B82F615' : '#EFF6FF') : 'transparent',
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                              }}
                                            >
                                              <Text style={{ fontSize: 15, color: isSelected ? '#3B82F6' : theme.text, fontWeight: isSelected ? '600' : '400' }}>
                                                {opt}
                                              </Text>
                                              {isSelected && (
                                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />
                                              )}
                                            </TouchableOpacity>
                                          );
                                        })}
                                      </View>
                                    );
                                  })()}
                                </View>
                              ) : (
                                <View style={[styles.attributeValue, { backgroundColor: isDark ? '#2E3147' : '#F8FAFC' }]}>
                                  <Text style={styles.kvValue}>{selectedFeature.basic?.wimg_bottom_diameter || 'N/A'}</Text>
                                </View>
                              )}
                            </View>


                            <AttributeItem 
                              label="Manhole Type" 
                              value={selectedFeature.basic?.wimg_manhole_type} 
                              fieldKey="wimg_manhole_type" 
                              options={selectedFeature.rawResponse?.manhole_type_options || selectedFeature.rawResponse?.manhole_type_list?.map((x:any)=>x.value) || undefined}
                            />
                            <View style={styles.attributeRow}>
                            <Text style={styles.kvKey}>Type of Manhole</Text>
                            {isEditing ? (() => {
                              const options = selectedFeature.rawResponse?.type_of_manhole_list?.map((x: any) => x.value) || [];
                              const currentVal = editedAttributes.wimg_type_of_manhole !== undefined
                                ? editedAttributes.wimg_type_of_manhole
                                : selectedFeature.basic?.wimg_type_of_manhole;
                              const isOtherActive = currentVal === 'Other' || (currentVal && !options.includes(currentVal));

                              return (
                                <View>
                                  <TouchableOpacity
                                    style={[styles.attributeInput, { backgroundColor: inputBg, justifyContent: 'center' }]}
                                    onPress={() => setTypeOfManholeModalVisible(true)}
                                  >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <Text style={{ color: currentVal ? theme.text : '#8E8E93' }}>
                                        {currentVal || 'Select value'}
                                      </Text>
                                      <ChevronDown size={16} color={theme.text} />
                                    </View>
                                  </TouchableOpacity>

                                  {isOtherActive && (
                                    <TextInput
                                      style={[styles.attributeInput, { backgroundColor: inputBg, color: theme.text, marginTop: 8 }]}
                                      value={currentVal === 'Other' ? '' : currentVal}
                                      placeholder="Specify custom type of manhole"
                                      placeholderTextColor="#8E8E93"
                                      onChangeText={(text) =>
                                        setEditedAttributes((prev: any) => ({ ...prev, wimg_type_of_manhole: text || 'Other' }))
                                      }
                                    />
                                  )}

                                  <Modal visible={typeOfManholeModalVisible} transparent animationType="fade">
                                    <TouchableOpacity
                                      style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                                      activeOpacity={1}
                                      onPress={() => setTypeOfManholeModalVisible(false)}
                                    >
                                      <View style={{ width: '80%', maxHeight: '60%', backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF', borderRadius: 12, padding: 16, elevation: 5 }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: theme.text }}>Select Type of Manhole</Text>
                                        <ScrollView>
                                          {(!options.includes('Other') ? [...options, 'Other'] : options).map((opt: string) => (
                                            <TouchableOpacity
                                              key={opt}
                                              style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: borderColor }}
                                              onPress={() => {
                                                setEditedAttributes((prev: any) => ({ ...prev, wimg_type_of_manhole: opt }));
                                                setTypeOfManholeModalVisible(false);
                                              }}
                                            >
                                              <Text style={{ fontSize: 15, color: theme.text }}>{opt}</Text>
                                            </TouchableOpacity>
                                          ))}
                                        </ScrollView>
                                      </View>
                                    </TouchableOpacity>
                                  </Modal>
                                </View>
                              );
                            })() : (
                              <View style={[styles.attributeValue, { backgroundColor: isDark ? '#2E3147' : '#F8FAFC' }]}>
                                <Text style={styles.kvValue}>{selectedFeature.basic?.wimg_type_of_manhole || 'N/A'}</Text>
                              </View>
                            )}
                          </View>
                           
                            <AttributeItem label="MH depth (m)" value={selectedFeature.basic?.wimg_depth} />
                            <AttributeItem label="Last Updated By" value={selectedFeature?.userName || 'N/A'} />
                            <AttributeItem label="Last Updated At" value={selectedFeature.basic?.updated_date || 'N/A'} />
                            
                            {showActualDepth && (
                              <View style={styles.attributeRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={styles.kvKey}>Actual Depth (m)</Text>
                                  {/* {isMhVerified && <Check size={14} color="#10B981" />} */}
                                </View>

                                {isEditing && !isMhVerified ? (
                                  <TextInput
                                    //keyboardType="numeric"
                                    style={styles.attributeInput}
                                    placeholder="Enter actual depth"
                                    placeholderTextColor="#8E8E93"

                                    // Persistence: fallback to saved value if no edit exists yet
                                    value={String(editedAttributes.depthactul ?? selectedFeature.basic?.wimg_actual_depth ?? '')}
                                    onChangeText={(val) => setEditedAttributes({ ...editedAttributes, depthactul: val })}
                                  />
                                ) : (
                                  <View style={[styles.attributeValue]}>
                                    <Text style={[styles.kvValue]}>
                                      {selectedFeature.basic?.wimg_actual_depth || '0'}
                                    </Text>
                                  </View>

                                )}
                              </View>
                            )}
                            {(selectedFeature.basic?.wimg_strata_type || !isEditing) && (
                              <AttributeItem label="Strata Type" value={selectedFeature.basic?.wimg_strata_type} fieldKey="wimg_strata_type" />
                            )}
                            {isCompletedStatusVerifyManhole && hasWriteAccess("DASHBOARD_FEATURE_VERIFICATION") && (
                              <View style={[styles.attributeRow, {
                                marginTop: 10,
                                paddingTop: 15,
                                borderTopWidth: 1,
                                borderTopColor: borderColor,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }]}>
                                <View>
                                  <Text style={styles.kvKey}>Attribute Verification</Text>
                                  <Text style={{ fontSize: 11, color: isMhVerified ? '#16A34A' : '#64748B' }}>
                                    {isMhVerified ? '✓ Data is verified' : '○ Pending verification'}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  // Remove disabled={!isEditing} if you want users to verify without 
                                  onPress={async () => {
                                    try {
                                      setIsVerifying(true);
                                      const featId = selectedFeature.basic.id || selectedFeature.basic.feature_id;
                                      const layerId = getLayerIdFromCurrentLayer();
                                      const newStatus = !isMhVerified;

                                      if (!layerId) {
                                        showAlert("Error", "Layer not identified", 'error');
                                        return;
                                      }

                                      await verifyFeature(featId, layerId, newStatus, token);

                                      webviewRef.current?.injectJavaScript(`
                                        Object.keys(wmsLayers).forEach(key => {
                                          const source = wmsLayers[key].getSource();
                                          if (source && typeof source.updateParams === 'function') {
                                            source.updateParams({ 'VERSION': '1.1.1', 't': Date.now() });
                                          }
                                        });
                                      `);

                                      await refreshCurrentFeature();
                                      showAlert("Success", newStatus ? "Feature verified" : "Feature unverified", 'success');
                                      await refreshKPI();
                                    } catch (err: any) {
                                      showAlert("Action Failed", err.message, 'error');
                                    }
                                    finally { setIsVerifying(false); }
                                  }}
                                >
                                  <Text style={{
                                    color: isMhVerified ? '#EF4444' : '#15803D',
                                    fontWeight: '800',
                                    fontSize: 12
                                  }}>
                                    {isMhVerified ? 'UNVERIFY' : 'VERIFY'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View >
                          {renderDynamicAttributes()}
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Status Timeline</Text>
                            <View style={styles.statusBadgeContainer}>
                              {selectedFeature.geomStatusList?.map((status: any) => {
                                const isActive = (editedAttributes.status_id || selectedFeature.status?.id) === status.wists_id;
                                const themeColor = status.wists_color || '#808080';

                                return (
                                  <TouchableOpacity
                                    key={status.wists_id}
                                    // Enable clicking if in editing mode
                                    disabled={!isEditing || isMhVerified}
                                    onPress={() => setEditedAttributes({ ...editedAttributes, status_id: status.wists_id })}
                                    style={[
                                      styles.statusBadge,
                                      {
                                        // If active: Light version of the theme color (adding '20' for transparency)
                                        // If inactive: Light gray
                                        backgroundColor: isActive ? `${themeColor}20` : '#F3F4F6',
                                        borderWidth: isActive ? 2 : 0,
                                        borderColor: themeColor,
                                        opacity: !isEditing && !isActive ? 0.6 : 1 // Dim non-active ones when not editing
                                      }
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeText,
                                        {
                                          color: isActive ? themeColor : '#4B5563',
                                          fontWeight: isActive ? '700' : '400'
                                        }
                                      ]}
                                    >
                                      {status.wists_name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Upload Media</Text>
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                              <TouchableOpacity
                                disabled={!isEditing}
                                style={{
                                  width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed',
                                  borderColor: isEditing ? '#007AFF' : '#CBD5E1',
                                  justifyContent: 'center', alignItems: 'center',
                                  backgroundColor: isEditing ? '#F0F7FF' : '#F1F5F7'
                                }}
                                onPress={handlePickImage}
                              >
                                <Camera size={24} color={isEditing ? "#007AFF" : "#94A3B8"} />
                                <Text style={{ fontSize: 10, color: isEditing ? '#007AFF' : '#94A3B8', marginTop: 4 }}>Capture</Text>
                              </TouchableOpacity>

                              {capturedImage ? (
                                <View style={{ width: 80, height: 80, position: 'relative' }}>
                                  {/* The Image */}
                                  <Image
                                    source={{ uri: capturedImage.uri }}
                                    style={{ width: 80, height: 80, borderRadius: 8 }}
                                  />

                                  {/* The X Button Container */}
                                  <TouchableOpacity
                                    onPress={() => setCapturedImage(null)}
                                    activeOpacity={0.7}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      backgroundColor: '#EF4444',
                                      width: 26,
                                      height: 26,
                                      borderRadius: 13,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      borderWidth: 2,
                                      borderColor: '#FFF',
                                      zIndex: 99,
                                      elevation: 6,
                                    }}
                                  >
                                    <X size={14} color="#FFF" strokeWidth={3} />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>No preview</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Latest Uploaded Media</Text>

                            {selectedFeature.rawResponse?.image_date && selectedFeature.rawResponse.image_date.length > 0 ? (
                              (() => {
                                // Find the latest image based on wiiu_id
                                const images = [...selectedFeature.rawResponse.image_date];
                                const latestImg = images.sort((a, b) => b.wiiu_id - a.wiiu_id)[0];
                                const imageUri = normalizeToAbsolute(latestImg.wiiu_path);

                                return (
                                  <TouchableOpacity
                                    style={[styles.previousImageContainer, { width: 140 }]}
                                    onPress={() => {
                                      setSelectedImage(imageUri);
                                      setShowImageModal(true);
                                    }}
                                  >
                                    <Image
                                      source={{ uri: imageUri }}
                                      style={[styles.previousImage, { width: 140, height: 140 }]}
                                      resizeMode="cover"
                                    />
                                    {latestImg?.wiiu_id && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                      <TouchableOpacity
                                        onPress={() => {
                                          showAlert(
                                            "Delete Image",
                                            "Are you sure you want to delete this image?",
                                            "warning",
                                            [
                                              { text: "Cancel", style: "cancel", onPress: () => { } },
                                              {
                                                text: "Delete",
                                                style: "destructive",
                                                onPress: async () => {
                                                  try {
                                                    await deleteUnitImage({
                                                      image_id: latestImg.wiiu_id,
                                                      isFeature: "true",
                                                      isUnit: "false",
                                                      isSubActivity: "false",
                                                    });
                                                    showToast("Image deleted successfully ✓");
                                                    await refreshCurrentFeature();
                                                  } catch (err: any) {
                                                    showAlert("Error", err.message, "error");
                                                  }
                                                },
                                              },
                                            ]
                                          );
                                        }}
                                        style={{
                                          position: 'absolute',
                                          top: 6,
                                          right: 6,
                                          backgroundColor: '#EF4444',
                                          width: 30,
                                          height: 30,
                                          borderRadius: 15,
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          borderWidth: 2,
                                          borderColor: '#FFF',
                                          zIndex: 99,
                                          elevation: 6,
                                        }}
                                      >
                                        <Trash2 size={14} color="#FFF" />
                                      </TouchableOpacity>
                                    )}
                                    <View style={styles.imageDateBadge}>
                                      <Text style={styles.imageDateText}>
                                        Latest
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })()
                            ) : (
                              /* --- FALLBACK UI WHEN NO IMAGES EXIST --- */
                              <View style={styles.noImagePlaceholder}>
                                <ImageIcon size={32} color="#94A3B8" strokeWidth={1.5} />
                                <Text style={styles.noImageText}>No images uploaded for this feature</Text>
                              </View>
                            )}
                          </View>
                        </>
                      );

                    // ==========  Specials ==========
                    case 'waternetinfraa:specials':
                      const isSpecialVerified = selectedFeature.basic?.isverify === true;
                      const isCompletedStatusVerifySpecial = selectedFeature.status.id === 1;

                      return (
                        <>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Specials Details</Text>
                            {/* Use 'lable' (with the typo from your JSON) */}
                            <AttributeItem label="Label" value={selectedFeature.basic?.lable || 'N/A'} />
                            <AttributeItem label="Last Updated By" value={selectedFeature.userName || 'N/A'} />
                            <AttributeItem label="Last Updated At" value={selectedFeature.basic?.updated_date || 'N/A'} />
                            {isCompletedStatusVerifySpecial && hasWriteAccess("DASHBOARD_FEATURE_VERIFICATION") && (
                              <View style={[styles.attributeRow, {
                                marginTop: 10,
                                paddingTop: 15,
                                borderTopWidth: 1,
                                borderTopColor: borderColor,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }]}>
                                <View>
                                  <Text style={styles.kvKey}>Attribute Verification</Text>
                                  <Text style={{ fontSize: 11, color: isSpecialVerified ? '#16A34A' : '#64748B' }}>
                                    {isSpecialVerified ? '✓ Data is verified' : '○ Pending verification'}
                                  </Text>
                                </View>

                                <TouchableOpacity
                                  // Remove disabled={!isEditing} if you want users to verify without 
                                  onPress={async () => {
                                    try {
                                      setIsVerifying(true);
                                      const featId = selectedFeature.basic.id || selectedFeature.basic.feature_id;
                                      const layerId = getLayerIdFromCurrentLayer();
                                      const newStatus = !isSpecialVerified;

                                      if (!layerId) {
                                        showAlert("Error", "Layer not identified", 'error');
                                        return;
                                      }

                                      await verifyFeature(featId, layerId, newStatus, token);

                                      webviewRef.current?.injectJavaScript(`
                                        Object.keys(wmsLayers).forEach(key => {
                                          const source = wmsLayers[key].getSource();
                                          if (source && typeof source.updateParams === 'function') {
                                            source.updateParams({ 'VERSION': '1.1.1', 't': Date.now() });
                                          }
                                        });
                                      `);

                                      await refreshCurrentFeature();
                                      showAlert("Success", newStatus ? "Feature verified" : "Feature unverified", 'success');
                                      await refreshKPI();
                                    } catch (err: any) {
                                      showAlert("Action Failed", err.message, 'error');
                                    }
                                    finally { setIsVerifying(false); }
                                  }}
                                >
                                  <Text style={{
                                    color: isSpecialVerified ? '#EF4444' : '#15803D',
                                    fontWeight: '800',
                                    fontSize: 12
                                  }}>
                                    {isSpecialVerified ? 'UNVERIFY' : 'VERIFY'}
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>

                          {renderDynamicAttributes()}
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Status Timeline</Text>
                            <View style={styles.statusBadgeContainer}>
                              {selectedFeature.geomStatusList?.map((status: any) => {
                                const isActive = (editedAttributes.status_id || selectedFeature.status?.id) === status.wists_id;

                                const themeColor = status.wists_color || '#808080';

                                return (
                                  <TouchableOpacity
                                    key={status.wists_id}
                                    // Enable clicking if in editing mode
                                    disabled={!isEditing || isSpecialVerified}
                                    onPress={() => setEditedAttributes({ ...editedAttributes, status_id: status.wists_id })}
                                    style={[
                                      styles.statusBadge,
                                      {
                                        backgroundColor: isActive ? `${themeColor}20` : '#F3F4F6',
                                        borderWidth: isActive ? 2 : 0,
                                        borderColor: themeColor,
                                        opacity: !isEditing && !isActive ? 0.6 : 1 // Dim non-active ones when not editing
                                      }
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeText,
                                        {
                                          color: isActive ? themeColor : '#4B5563',
                                          fontWeight: isActive ? '700' : '400'
                                        }
                                      ]}
                                    >
                                      {status.wists_name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                          <View style={[styles.card, { marginTop: 12 }]}>
                            <Text style={styles.sectionTitle}>Upload Media</Text>
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                              <TouchableOpacity
                                disabled={!isEditing}
                                style={{
                                  width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed',
                                  borderColor: isEditing ? '#007AFF' : '#CBD5E1',
                                  justifyContent: 'center', alignItems: 'center',
                                  backgroundColor: isEditing ? '#F0F7FF' : '#F1F5F9'
                                }}
                                onPress={handlePickImage}
                              >
                                <Camera size={24} color={isEditing ? "#007AFF" : "#94A3B8"} />
                                <Text style={{ fontSize: 10, color: isEditing ? '#007AFF' : '#94A3B8', marginTop: 4 }}>Capture</Text>
                              </TouchableOpacity>

                              {capturedImage ? (
                                <View style={{ width: 80, height: 80, position: 'relative' }}>
                                  {/* The Image */}
                                  <Image
                                    source={{ uri: capturedImage.uri }}
                                    style={{ width: 80, height: 80, borderRadius: 8 }}
                                  />

                                  {/* The X Button Container */}
                                  <TouchableOpacity
                                    onPress={() => setCapturedImage(null)}
                                    activeOpacity={0.7}
                                    style={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      backgroundColor: '#EF4444',
                                      width: 26,
                                      height: 26,
                                      borderRadius: 13,
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      borderWidth: 2,
                                      borderColor: '#FFF',
                                      zIndex: 99,
                                      elevation: 6,
                                    }}
                                  >
                                    <X size={14} color="#FFF" strokeWidth={3} />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 10, color: '#94A3B8' }}>No preview</Text>
                                </View>
                              )}
                            </View>
                            {isEditing && (
                              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 8 }}>
                                * Image will be uploaded when you click "Save Changes"
                              </Text>
                            )}
                          </View>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Latest Uploaded Media</Text>

                            {selectedFeature.rawResponse?.image_date && selectedFeature.rawResponse.image_date.length > 0 ? (
                              (() => {
                                // Find the latest image based on wiiu_id
                                const images = [...selectedFeature.rawResponse.image_date];
                                const latestImg = images.sort((a, b) => b.wiiu_id - a.wiiu_id)[0];
                                const imageUri = normalizeToAbsolute(latestImg.wiiu_path);

                                return (
                                  <TouchableOpacity
                                    style={[styles.previousImageContainer, { width: 140 }]}
                                    onPress={() => {
                                      setSelectedImage(imageUri);
                                      setShowImageModal(true);
                                    }}
                                  >
                                    <Image
                                      source={{ uri: imageUri }}
                                      style={[styles.previousImage, { width: 140, height: 140 }]}
                                      resizeMode="cover"
                                    />
                                    {latestImg?.wiiu_id && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                      <TouchableOpacity
                                        onPress={() => {
                                          showAlert(
                                            "Delete Image",
                                            "Are you sure you want to delete this image?",
                                            "warning",
                                            [
                                              { text: "Cancel", style: "cancel", onPress: () => { } },
                                              {
                                                text: "Delete",
                                                style: "destructive",
                                                onPress: async () => {
                                                  try {
                                                    await deleteUnitImage({
                                                      image_id: latestImg.wiiu_id,
                                                      isFeature: "true",
                                                      isUnit: "false",
                                                      isSubActivity: "false",
                                                    });
                                                    showToast("Image deleted successfully ✓");
                                                    await refreshCurrentFeature();
                                                  } catch (err: any) {
                                                    showAlert("Error", err.message, "error");
                                                  }
                                                },
                                              },
                                            ]
                                          );
                                        }}
                                        style={{
                                          position: 'absolute',
                                          top: 6,
                                          right: 6,
                                          backgroundColor: '#EF4444',
                                          width: 30,
                                          height: 30,
                                          borderRadius: 15,
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          borderWidth: 2,
                                          borderColor: '#FFF',
                                          zIndex: 99,
                                          elevation: 6,
                                        }}
                                      >
                                        <Trash2 size={14} color="#FFF" />
                                      </TouchableOpacity>
                                    )}
                                    <View style={styles.imageDateBadge}>
                                      <Text style={styles.imageDateText}>
                                        Latest
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })()
                            ) : (
                              /* --- FALLBACK UI WHEN NO IMAGES EXIST --- */
                              <View style={styles.noImagePlaceholder}>
                                <ImageIcon size={32} color="#94A3B8" strokeWidth={1.5} />
                                <Text style={styles.noImageText}>No images uploaded for this feature</Text>
                              </View>
                            )}
                          </View>
                        </>
                      );

                    case 'waternetinfraa:pipeline_by_category':
                      const isCompletedStatusPipelineCat = (editedAttributes.status_id || selectedFeature.status.id) === 1;
                      const isPipeVerifiedPipelineCat = selectedFeature.basic?.isverify === true;

                      return (

                        <View style={styles.card}>
                          <Text style={styles.sectionTitle}>Pipeline Details (Read Only)</Text>
                          <AttributeItem label="Label" value={selectedFeature.basic?.label || selectedFeature.basic?.lable} />
                          <AttributeItem label="Diameter (mm)" value={String(selectedFeature.basic?.diameter || 'N/A')} />
                          <AttributeItem label="Length (m)" value={String(selectedFeature.basic?.length || 'N/A')} />
                          <AttributeItem label="Material" value={String(selectedFeature.basic?.material || 'N/A')} />
                          {/* <AttributeItem label="Start Invert Level (m)" value={String(selectedFeature.basic?.start_invertlevel || 'N/A')} />
                          <AttributeItem label="End Invert Level (m)" value={String(selectedFeature.basic?.end_invertlevel || 'N/A')} /> */}
                          {/* <AttributeItem label="GL Start (m)" value={String(selectedFeature.basic?.gl_start || 'N/A')} />
                          <AttributeItem label="GL End (m)" value={String(selectedFeature.basic?.gl_end || 'N/A')} /> */}
                          <AttributeItem label="Last Updated By" value={String(selectedFeature.userName || 'N/A')} />
                          <AttributeItem label="Last Updated At" value={String(selectedFeature.basic?.updated_date || 'N/A')} />
                          {/* <AttributeItem label="Status" value={String(selectedFeature.status?.name || 'N/A')} /> */}
                          {isCompletedStatusPipelineCat && (
                            <View style={styles.attributeRow}>
                              <Text style={styles.kvKey}>Actual Length (m)</Text>
                              <View style={[styles.attributeValue, {
                                backgroundColor: isDark ? '#2E3147' : '#F8FAFC'
                              }]}>
                                <Text style={styles.kvValue}>{selectedFeature.basic?.usdeflen || 'N/A'}</Text>
                              </View>

                            </View>
                          )}
                          {renderDynamicAttributes()}
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Status Timeline</Text>
                            <View style={styles.statusBadgeContainer}>
                              {selectedFeature.geomStatusList?.map((status: any) => {
                                const isActive = (editedAttributes.status_id || selectedFeature.status?.id) === status.wists_id;
                                const themeColor = status.wists_color || '#808080';

                                return (
                                  <TouchableOpacity
                                    key={status.wists_id}
                                    disabled={!isEditing || isPipeVerified}
                                    onPress={() => {
                                      // Update the status_id which triggers the Actual Length field visibility above
                                      setEditedAttributes({ ...editedAttributes, status_id: status.wists_id });
                                    }}
                                    style={[
                                      styles.statusBadge,
                                      {
                                        backgroundColor: isActive ? `${themeColor}20` : '#F3F4F6',
                                        borderWidth: isActive ? 2 : 0,
                                        borderColor: themeColor,
                                        opacity: !isEditing && !isActive ? 0.6 : 1
                                      }
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.statusBadgeText,
                                        {
                                          color: isActive ? themeColor : '#4B5563',
                                          fontWeight: isActive ? '700' : '400'
                                        }
                                      ]}
                                    >
                                      {status.wists_name}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Latest Uploaded Media</Text>

                            {selectedFeature.rawResponse?.image_date && selectedFeature.rawResponse.image_date.length > 0 ? (
                              (() => {
                                // Find the latest image based on wiiu_id
                                const images = [...selectedFeature.rawResponse.image_date];
                                const latestImg = images.sort((a, b) => b.wiiu_id - a.wiiu_id)[0];
                                const imageUri = normalizeToAbsolute(latestImg.wiiu_path);

                                return (
                                  <TouchableOpacity
                                    style={[styles.previousImageContainer, { width: 140 }]}
                                    onPress={() => {
                                      setSelectedImage(imageUri);
                                      setShowImageModal(true);
                                    }}
                                  >
                                    <Image
                                      source={{ uri: imageUri }}
                                      style={[styles.previousImage, { width: 140, height: 140 }]}
                                      resizeMode="cover"
                                    />
                                    {latestImg?.wiiu_id && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                      <TouchableOpacity
                                        onPress={() => {
                                          showAlert(
                                            "Delete Image",
                                            "Are you sure you want to delete this image?",
                                            "warning",
                                            [
                                              { text: "Cancel", style: "cancel", onPress: () => { } },
                                              {
                                                text: "Delete",
                                                style: "destructive",
                                                onPress: async () => {
                                                  try {
                                                    await deleteUnitImage({
                                                      image_id: latestImg.wiiu_id,
                                                      isFeature: "true",
                                                      isUnit: "false",
                                                      isSubActivity: "false",
                                                    });
                                                    showToast("Image deleted successfully ✓");
                                                    await refreshCurrentFeature();
                                                  } catch (err: any) {
                                                    showAlert("Error", err.message, "error");
                                                  }
                                                },
                                              },
                                            ]
                                          );
                                        }}
                                        style={{
                                          position: 'absolute',
                                          top: 6,
                                          right: 6,
                                          backgroundColor: '#EF4444',
                                          width: 30,
                                          height: 30,
                                          borderRadius: 15,
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                          borderWidth: 2,
                                          borderColor: '#FFF',
                                          zIndex: 99,
                                          elevation: 6,
                                        }}
                                      >
                                        <Trash2 size={14} color="#FFF" />
                                      </TouchableOpacity>
                                    )}
                                    <View style={styles.imageDateBadge}>
                                      <Text style={styles.imageDateText}>
                                        Latest
                                      </Text>
                                    </View>
                                  </TouchableOpacity>
                                );
                              })()
                            ) : (
                              /* --- FALLBACK UI WHEN NO IMAGES EXIST --- */
                              <View style={styles.noImagePlaceholder}>
                                <ImageIcon size={32} color="#94A3B8" strokeWidth={1.5} />
                                <Text style={styles.noImageText}>No images uploaded for this feature</Text>
                              </View>
                            )}
                          </View>
                          {selectedFeature.basic.project_type_id === 2 ? (
                            <View style={styles.card}>
                              <Text style={styles.sectionTitle}>Pipeline Schematic Diagram</Text>
                              <View style={styles.schematicWrapper}>
                                <ImageBackground
                                  source={require('@/assets/images/schematic.png')}
                                  style={styles.schematicBg}
                                  resizeMode="contain"
                                >
                                  {/* ... schematic tags remain the same ... */}
                                  <View style={[styles.floatingTag, { top: 2, left: 2 }]}>
                                    <Text style={styles.tagLabelText}>GL - {selectedFeature.basic?.gl_start || 0} (m)</Text>
                                  </View>
                                  <View style={[styles.floatingTag, { bottom: 35, left: 5 }]}>
                                    <Text style={styles.tagLabelText}>IL - {selectedFeature.basic?.start_invertlevel || 0} (m)</Text>
                                  </View>
                                  <View style={styles.centerTagContainer}>
                                    <Text style={styles.pipeNameText}>{selectedFeature.basic?.label || 'P-2300'}</Text>
                                    <Text style={styles.tagLabelText}>L - {selectedFeature.basic?.length || 0} (m)</Text>
                                  </View>
                                  <View style={[styles.floatingTag, { top: 30, right: 10 }]}>
                                    <Text style={styles.tagLabelText}>GL - {selectedFeature.basic?.gl_end || 0} (m)</Text>
                                  </View>
                                  <View style={[styles.floatingTag, { bottom: 5, right: 15 }]}>
                                    <Text style={styles.tagLabelText}>IL - {selectedFeature.basic?.end_invertlevel || 0} (m)</Text>
                                  </View>
                                </ImageBackground>
                              </View>
                            </View>
                          ) : (<></>)}
                        </View>
                      );

                    case 'waternetinfraa:tank_existing':

                      return (
                        <>
                          {/* 1. General Information Card */}
                          <View style={styles.card}>
                            <AttributeItem label="Label" value={selectedFeature.basic?.labelname || selectedFeature.basic?.label} />
                            <AttributeItem label="Capacity (MLD)" value={String(selectedFeature.basic?.capacity || 'N/A')} />
                            <AttributeItem label="Type" value={selectedFeature.basic?.type} />
                            <AttributeItem label="Stagging Height" value={String(selectedFeature.basic?.stag_height || 'N/A')} />
                          </View>
                        </>
                      );


                    case 'waternetinfraa:structure_existing':

                      return (
                        <>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Existing STP/WTP/Headworks</Text>
                            <AttributeItem label="Label" value={selectedFeature.basic?.lable || selectedFeature.basic?.label} />
                            <AttributeItem label="Capacity (MLD)" value={String(selectedFeature.basic?.capacity || 'N/A')} />
                            <AttributeItem label="Type" value={String(selectedFeature.basic?.type || 'N/A')} />
                          </View>
                        </>
                      );

                    case 'waternetinfraa:manhole_existing':

                      return (
                        <>
                          <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Manhole</Text>
                            <AttributeItem label="Label" value={selectedFeature.basic?.label} />
                            <AttributeItem label="Diameter (m)" value={selectedFeature.basic?.diameter || 'N/A'} />
                            <AttributeItem label="Elevation (Ground) (m)" value={String(selectedFeature.basic?.elevation_ground || 'N/A')} />
                            <AttributeItem label="Elevation (Invert) (m)" value={String(selectedFeature.basic?.elevation_invert || 'N/A')} />
                            <AttributeItem label="MH depth (m)" value={selectedFeature.basic?.depth || 'N/A'} />
                          </View >
                        </>
                      );

                  }
                  })();

                  return (
                    <>
                      {switchResult}
                      {renderDynamicAttributes()}
                    </>
                  );
                })()}

              </View>
            )}

            {activeTab === 'subactivities' && (
              <View style={{ flex: 1 }}>
                {/* HEADER SECTION WITH MODAL PICKER */}
                <View style={{
                  flexDirection: 'column', // Changed from 'row'
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start', // Align items to the left
                  paddingHorizontal: 4,
                  marginBottom: 16,
                }}>
                  <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>
                    Sub Activity Details
                  </Text>

                  {/* UNIT SELECTOR TRIGGER */}
                  <TouchableOpacity
                    style={styles.unitPickerButton}
                    onPress={() => setUnitPickerVisible(true)}
                  >
                    <Text style={styles.unitPickerButtonText}>
                      {selectedFeature?.rawResponse?.stp_table?.find((u: any) => u.wirelusg_id === expandedUnitId)?.wirelusg_unit_name || "Select Unit"}
                    </Text>
                    <ChevronRight size={16} color="#007AFF" />
                  </TouchableOpacity>
                </View>

                {/* UNIT SELECTION MODAL */}
                <Modal
                  visible={unitPickerVisible}
                  transparent
                  animationType="slide"
                  onRequestClose={() => setUnitPickerVisible(false)}
                >
                  <View style={styles.modalOverlayCenter}>
                    <View style={[styles.searchModal, { backgroundColor: theme.cardColor, maxHeight: '80%' }]}>
                      <View style={styles.modalHeader}>
                        <View>
                          <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>Unit Selection</Text>
                          <Text style={{ color: subTextColor, fontSize: 12 }}>Pick a unit to view sub-activities</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            setUnitPickerVisible(false);
                            setSearchQuery('');
                          }}
                          style={styles.closeCircleSmall}
                        >
                          <X color={theme.text} size={20} />
                        </TouchableOpacity>
                      </View>

                      <View
                        style={[
                          styles.searchInputWrapper,
                          {
                            // 👈 Change background to gray and reduce opacity if no layer is selected
                            backgroundColor: activeCategory ? inputBg : (isDark ? '#1C1C1E' : '#F1F5F9'),
                            borderColor: activeCategory ? '#007AFF' : borderColor,
                            opacity: activeCategory ? 1 : 0.5
                          }
                        ]}
                      >
                        <Search size={18} color={subTextColor} />
                        <TextInput
                          // 👈 Dynamic placeholder text
                          placeholder={activeCategory ? "Search feature..." : "Select a layer first..."}
                          placeholderTextColor="#8E8E93"
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          // 👈 LOCK THE KEYBOARD until activeCategory is set
                          editable={!!activeCategory}
                          style={[
                            styles.searchInput,
                            { color: theme.text }
                          ]}
                          // 👈 Show a hint if they try to click it while disabled
                          onPressIn={() => {
                            if (!activeCategory) {
                              showAlert("Step Required", "Please select a Layer from the dropdown above before searching for features.", 'info');
                            } else {
                              setSearchClick(true);
                              setDropdown1Open(false);
                            }
                          }}
                        />
                      </View>
                      <FlatList
                        data={(selectedFeature?.rawResponse?.stp_table || []).filter((item: any) =>
                          item.wirelusg_unit_name.toLowerCase().includes(searchQuery.toLowerCase())
                        )}
                        keyExtractor={(item) => item.wirelusg_id.toString()}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => {
                          const isActive = expandedUnitId === item.wirelusg_id;
                          return (
                            <TouchableOpacity
                              style={[
                                styles.dropdownItem,
                                isActive && {
                                  backgroundColor: isDark ? 'rgba(0, 122, 255, 0.15)' : '#EBF5FF',
                                  borderColor: '#007AFF',
                                  borderWidth: 1
                                }
                              ]}
                              onPress={() => {
                                setExpandedUnitId(item.wirelusg_id);
                                loadSubactivitiesForUnit(item.wirelusg_id);
                                setSearchQuery('');
                                setUnitPickerVisible(false);
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={[styles.unitIconCircle, { backgroundColor: isActive ? '#007AFF' : '#CBD5E1' }]}>
                                  <Package size={14} color="#FFF" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                  <Text style={{
                                    color: theme.text,
                                    fontSize: 15,
                                    fontWeight: isActive ? '700' : '500'
                                  }}>
                                    {item.wirelusg_unit_name}
                                  </Text>
                                  {isActive && <Text style={{ color: '#007AFF', fontSize: 11, fontWeight: '600' }}>Currently Selected</Text>}
                                </View>
                                {isActive && <Check size={20} color="#007AFF" />}
                              </View>
                            </TouchableOpacity>
                          );
                        }}
                        ListEmptyComponent={
                          <View style={{ padding: 40, alignItems: 'center' }}>
                            <Text style={{ color: subTextColor }}>No units match your search.</Text>
                          </View>
                        }
                      />
                    </View>
                  </View>
                </Modal>

                {selectedFeature?.rawResponse?.stp_table?.length > 0 ? (
                  <>
                    {loadingSubactivities ? (
                      <View style={{ padding: 40, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#007AFF" />
                        <Text style={{ marginTop: 10, color: subTextColor }}>Loading activities...</Text>
                      </View>
                    ) : !expandedUnitId ? (
                      <View style={{ padding: 40, alignItems: 'center' }}>
                        <Info size={40} color={subTextColor} strokeWidth={1.5} />
                        <Text style={{ color: subTextColor, marginTop: 10, textAlign: 'center' }}>
                          Please click the button above to select a unit.
                        </Text>
                      </View>
                    ) : (
                      selectedFeature.rawResponse.stp_table
                        .filter((u: any) => u.wirelusg_id === expandedUnitId)
                        .map((unit: any) => {
                          const subList = subactivities;
                          const weightageData = unitWeightage.length > 0 ? unitWeightage[0] : null;
                          const isMaterialEnabledInAnySub = subList.some(sa => sa.isMaterialReq || sa.wiresu_ismaterial_req);
                          const totalSubWeight = subList.reduce((sum, sa) => sum + (parseFloat(sa.weightage) || 0), 0);
                          const allMaterialReq = subactivities.every(sa => sa.isMaterialReq || sa.wiresu_ismaterial_req);

                          return (
                            <View key={unit.wirelusg_id} style={{ gap: 12 }}>
                              {/* ========== SUB-ACTIVITIES CARD ========== */}
                              <View style={styles.card}>
                                {/* HEADER WITH EDIT BUTTON */}
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <Text style={[styles.unitTitle, { color: '#007AFF', flex: 1 }]} numberOfLines={1}>
                                    {unit.wirelusg_unit_name}
                                  </Text>
                                  {!allMaterialReq && (
                                    <View style={{
                                      backgroundColor: totalSubWeight === 100 ? '#DCFCE7' : '#FEE2E2',
                                      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
                                      borderColor: totalSubWeight === 100 ? '#BBF7D0' : '#FECACA'
                                    }}>
                                      <Text style={{ fontSize: 12, fontWeight: '800', color: totalSubWeight === 100 ? '#15803D' : '#EF4444' }}>
                                        Total: {totalSubWeight}%
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {isEditingSubActivities && !allMaterialReq && (
                                  <View style={[styles.weightageValidation, { backgroundColor: totalSubWeight === 100 ? '#F0FDF4' : '#FEF2F2' }]}>
                                    <Text style={{ fontSize: 11, color: totalSubWeight === 100 ? '#15803D' : '#B91C1C', fontWeight: '700' }}>
                                      {totalSubWeight === 100 ? "✓ balanced (100%)" : `⚠ Total must be 100% (Current: ${totalSubWeight}%)`}
                                    </Text>
                                  </View>
                                )}

                                {subList.map((sa: any, sIdx: number) => {
                                  const isEditingThisSub = activeSubActivityId === (sa.subactivityId || sa.subactivity_id);
                                  const isMaterialReq = sa.isMaterialReq || sa.wiresu_ismaterial_req;
                                  const isNewUnsaved = typeof sa.subactivityId === 'number' && sa.subactivityId > 1000000000;

                                  return (
                                    <View key={sa.subactivityId || sa.subactivity_id || sIdx} style={styles.subActivityEditCard}>
                                      {isEditingSubActivities && (
                                        <TouchableOpacity
                                          onPress={() => {
                                            showAlert(
                                              "Delete Sub Activity",
                                              "Are you sure you want to delete this sub activity?",
                                              "warning",
                                              [
                                                {
                                                  text: "Cancel",
                                                  style: "cancel",
                                                  onPress: () => { }   // ✅ required
                                                },
                                                {
                                                  text: "Delete",
                                                  style: "destructive",
                                                  onPress: () => {
                                                    const newSubs = [...subactivities];
                                                    newSubs.splice(sIdx, 1);
                                                    setSubactivities(newSubs);
                                                  },
                                                },
                                              ]
                                            );
                                          }}
                                          style={{
                                            position: 'absolute',
                                            top: 8,
                                            left: 6,
                                            zIndex: 10,

                                            backgroundColor: '#FEE2E2',
                                            borderRadius: 16,
                                            padding: 6,
                                          }}
                                        >
                                          <Trash2 size={14} color="#EF4444" />
                                        </TouchableOpacity>

                                      )}
                                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <View style={{ flex: 1 }}>
                                          {isEditingSubActivities ? (
                                            <TextInput
                                              style={[styles.attributeInput, { marginBottom: 8 }]}
                                              value={sa.subactivityName || sa.subactivity_name}
                                              placeholder="Sub Activity Name"
                                              placeholderTextColor="#8E8E93"

                                              onChangeText={(text) => {
                                                const newSubs = [...subList];
                                                newSubs[sIdx] = { ...newSubs[sIdx], subactivity_name: text, subactivityName: text };
                                                setSubactivities(newSubs);
                                              }}
                                            />
                                          ) : (
                                            <Text style={styles.subActivityName}>{sa.subactivityName || sa.subactivity_name}</Text>
                                          )}
                                        </View>


                                        {/* <View style={styles.subActivityActions}>
                                          {!isNewUnsaved && (
                                            <>
                                              {isEditingSubActivities ? (
                                                <TouchableOpacity
                                                  onPress={() => handlePickImageForSubActivity(unit.wirelusg_id, sa.subactivityId || sa.subactivity_id)}
                                                  style={styles.subActionIconCircle}
                                                >
                                                  <Camera size={16} color="#007AFF" />
                                                </TouchableOpacity>
                                              ) : (
                                                <TouchableOpacity
                                                  onPress={() => handleViewSubImage(sa.subactivityId || sa.subactivity_id)}
                                                  style={[styles.subActionIconCircle, { backgroundColor: '#E0F2FE' }]}
                                                >
                                                  <ImageIcon size={16} color="#007AFF" />
                                                </TouchableOpacity>
                                              )}
                                              <TouchableOpacity
                                                onPress={() => handleViewSubActivityHistory(sa.subactivityId || sa.subactivity_id, unit.wirelusg_id)}
                                              >
                                                <FileText size={16} color="#64748B" />
                                              </TouchableOpacity>
                                              <TouchableOpacity
                                                onPress={() => { setSubActivityRemark(''); setActiveSubActivityId(isEditingThisSub ? null : (sa.subactivityId || sa.subactivity_id)); }}
                                              >
                                                <MessageSquare size={16} color={isEditingThisSub ? "#EF4444" : "#007AFF"} />
                                              </TouchableOpacity>
                                            </>
                                          )}
                                        </View> */}
                                      </View>

                                      {!isEditingSubActivities && (
                                        <View style={{ flexDirection: 'row', marginTop: 8, gap: 12 }}>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <BarChart3 size={12} color="#64748B" />
                                            <Text style={{ fontSize: 11, color: '#475569', fontWeight: '600' }}>Weight: {sa.weightage || 0}%</Text>
                                          </View>
                                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Package size={12} color={isMaterialReq ? "#10B981" : "#64748B"} />
                                            <Text style={{ fontSize: 11, color: isMaterialReq ? "#15803D" : "#64748B", fontWeight: '600' }}>
                                              {isMaterialReq ? "Material Required" : "No Material Req."}
                                            </Text>
                                          </View>
                                        </View>
                                      )}

                                      {isEditingSubActivities && (
                                        <View style={[styles.rowBetween, { marginTop: 12 }]}>
                                          <View style={styles.flexRowCenter}>
                                            <Text style={styles.metricLabel}>Material Req:</Text>
                                            <Switch
                                              value={!!isMaterialReq}
                                              onValueChange={(val) => {
                                                const newSubs = [...subList];
                                                newSubs[sIdx] = { ...newSubs[sIdx], wiresu_ismaterial_req: val, isMaterialReq: val, weightage: val ? 0 : newSubs[sIdx].weightage };
                                                setSubactivities(newSubs);
                                              }}
                                            />
                                          </View>
                                          <View style={styles.flexRowCenter}>
                                            <Text style={styles.metricLabel}>Weight %:</Text>
                                            <TextInput
                                              //keyboardType="numeric"
                                              editable={!isMaterialReq}
                                              style={[styles.weightInput, isMaterialReq && styles.disabledInput]}
                                              value={String(sa.weightage || 0)}
                                              onChangeText={(text) => {
                                                const newSubs = [...subList];
                                                newSubs[sIdx] = { ...newSubs[sIdx], weightage: parseInt(text) || 0 };
                                                setSubactivities(newSubs);
                                              }}
                                            />
                                          </View>
                                        </View>
                                      )}

                                      {isEditingThisSub && (
                                        <View style={styles.subActivityRemarkBox}>
                                          <TextInput
                                            style={[styles.textInput, { height: 60, fontSize: 12, backgroundColor: isDark ? '#2C2C2E' : '#FFF' }]}
                                            placeholder="Enter activity remark..."
                                            placeholderTextColor="#8E8E93"

                                            value={subActivityRemark}
                                            onChangeText={setSubActivityRemark}
                                            multiline
                                          />
                                          <TouchableOpacity
                                            style={[styles.addButton, { width: '100%', height: 40, marginTop: 8, backgroundColor: '#10B981' }]}
                                            onPress={() => handleAddSubActivityRemark(sa.subactivityId || sa.subactivity_id, unit.wirelusg_id)}
                                          >
                                            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>Save Remark</Text>
                                          </TouchableOpacity>
                                        </View>
                                      )}
                                    </View>
                                  );
                                })}

                                {isEditingSubActivities && (
                                  <TouchableOpacity
                                    style={styles.addInlineButton}
                                    onPress={() => {
                                      const newSub = { subactivityId: Date.now(), subactivityName: '', weightage: 0, wiresu_ismaterial_req: false };
                                      setSubactivities([...subList, newSub]);
                                    }}
                                  >
                                    <Plus size={16} color="#10B981" />
                                    <Text style={{ color: '#10B981', fontWeight: 'bold' }}>Add Subactivity</Text>
                                  </TouchableOpacity>
                                )}

                                {/* SUB-ACTIVITIES ACTION BUTTONS */}
                                {hasWriteAccess("DASHBOARD_ADD_SUBACTIVITY") && (
                                  <View style={styles.centeredActionContainer}>
                                    {!isEditingSubActivities ? (
                                      <TouchableOpacity
                                        style={[styles.actionButton, styles.editButton]}
                                        onPress={() => setIsEditingSubActivities(true)}
                                        disabled={
                                          selectedFeature.basic?.isverify === true
                                        }
                                      >
                                        <Settings size={18} color="#007AFF" />
                                        <Text style={styles.editButtonText}>Edit Sub-Activities</Text>
                                      </TouchableOpacity>
                                    ) : (
                                      <View style={styles.buttonGroup}>
                                        <TouchableOpacity
                                          style={[styles.actionButton, styles.saveButtonAction]}
                                          onPress={async () => {
                                            const success = await handleSaveSubActivityList();
                                            if (success) {
                                              setIsEditingSubActivities(false);
                                            }
                                          }}
                                        >
                                          <Check size={18} color="#FFF" />
                                          <Text style={styles.saveButtonTextAction}>Save</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={[styles.actionButton, styles.cancelButton]}
                                          onPress={() => {
                                            setIsEditingSubActivities(false);
                                            loadSubactivitiesForUnit(expandedUnitId);
                                          }}
                                        >
                                          <X size={18} color="#EF4444" />
                                          <Text style={styles.cancelButtonText}>Cancel</Text>
                                        </TouchableOpacity>
                                      </View>
                                    )}
                                  </View>
                                )}
                              </View>

                              {/* ========== WEIGHTAGE DISTRIBUTION CARD ========== */}

                              <View style={[
                                styles.card,
                                {
                                  backgroundColor: isDark ? '#2E3147' : '#F8FAFC',
                                  borderLeftWidth: 4,
                                  borderLeftColor: '#0EA5E9',
                                  paddingVertical: 14,
                                  marginTop: 20,
                                  marginBottom: 10
                                }
                              ]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={[styles.metricLabel, { color: '#0EA5E9', marginBottom: 2 }]}>UNIT WEIGHTAGE DISTRIBUTION</Text>
                                    {!isMaterialEnabledInAnySub && isEditingWeightage ? (
                                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
                                        <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: '700' }}>Locked: No Material Activities</Text>
                                      </View>
                                    ) : (
                                      <Text style={{ fontSize: 10, color: '#64748B' }}>Configure component ratios</Text>
                                    )}
                                  </View>

                                  {(() => {
                                    const excValue = isMaterialEnabledInAnySub ? (parseFloat(unitWeightage[0]?.excavation) || 0) : 0;
                                    const stlValue = isMaterialEnabledInAnySub ? (parseFloat(unitWeightage[0]?.steel) || 0) : 0;
                                    const conValue = isMaterialEnabledInAnySub ? (parseFloat(unitWeightage[0]?.concrete) || 0) : 0;
                                    const subValue = parseFloat(unitWeightage[0]?.subactivityWeightage) || 0;
                                    const allMaterialReq = subactivities.every(sa => sa.isMaterialReq || sa.wiresu_ismaterial_req);

                                    const total = !allMaterialReq ? (excValue + stlValue + conValue + subValue).toFixed(0) : (excValue + stlValue + conValue).toFixed(0);
                                    const isBalanced = total === '100';

                                    return (
                                      <View style={{
                                        backgroundColor: isBalanced ? '#DCFCE7' : '#FEE2E2',
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        borderColor: isBalanced ? '#BBF7D0' : '#FECACA'
                                      }}>
                                        <Text style={{ fontSize: 12, fontWeight: '900', color: isBalanced ? '#15803D' : '#EF4444' }}>
                                          Sum: {total}%
                                        </Text>
                                      </View>
                                    );
                                  })()}
                                </View>

                                <View style={styles.verticalMetricsContainer}>
                                  {/* EXCAVATION */}
                                  <View style={styles.verticalMetricRow}>
                                    <View style={styles.metricLabelGroup}>
                                      <View style={[styles.indicatorDot, { backgroundColor: '#009640' }]} />
                                      <Text style={styles.verticalMetricLabel}>Excavation (%)</Text>
                                    </View>
                                    <View style={styles.verticalMetricInputArea}>
                                      {isEditingWeightage ? (
                                        <TextInput
                                          //keyboardType="numeric"
                                          editable={isMaterialEnabledInAnySub}
                                          style={[styles.weightInput, !isMaterialEnabledInAnySub && styles.disabledInput]}
                                          value={isMaterialEnabledInAnySub ? String(unitWeightage[0]?.excavation ?? '0') : "0"}
                                          onChangeText={(v) => setUnitWeightage([{ ...unitWeightage[0], excavation: v }])}
                                        />
                                      ) : (
                                        <Text style={[styles.verticalMetricValue, { color: theme.text }]}>
                                          {isMaterialEnabledInAnySub ? (unitWeightage[0]?.excavation ?? '0') : '0'}%
                                        </Text>
                                      )}
                                    </View>
                                  </View>

                                  {/* STEEL */}
                                  <View style={styles.verticalMetricRow}>
                                    <View style={styles.metricLabelGroup}>
                                      <View style={[styles.indicatorDot, { backgroundColor: '#007AFF' }]} />
                                      <Text style={styles.verticalMetricLabel}>Steel (%)</Text>
                                    </View>
                                    <View style={styles.verticalMetricInputArea}>
                                      {isEditingWeightage ? (
                                        <TextInput
                                          //keyboardType="numeric"
                                          editable={isMaterialEnabledInAnySub}
                                          style={[styles.weightInput, !isMaterialEnabledInAnySub && styles.disabledInput]}
                                          value={isMaterialEnabledInAnySub ? String(unitWeightage[0]?.steel ?? '0') : "0"}
                                          onChangeText={(v) => setUnitWeightage([{ ...unitWeightage[0], steel: v }])}
                                        />
                                      ) : (
                                        <Text style={[styles.verticalMetricValue, { color: theme.text }]}>
                                          {isMaterialEnabledInAnySub ? (unitWeightage[0]?.steel ?? '0') : '0'}%
                                        </Text>
                                      )}
                                    </View>
                                  </View>

                                  {/* CONCRETE */}
                                  <View style={styles.verticalMetricRow}>
                                    <View style={styles.metricLabelGroup}>
                                      <View style={[styles.indicatorDot, { backgroundColor: '#F59E0B' }]} />
                                      <Text style={styles.verticalMetricLabel}>Concrete (%)</Text>
                                    </View>
                                    <View style={styles.verticalMetricInputArea}>
                                      {isEditingWeightage ? (
                                        <TextInput
                                          //keyboardType="numeric"
                                          editable={isMaterialEnabledInAnySub}
                                          style={[styles.weightInput, !isMaterialEnabledInAnySub && styles.disabledInput]}
                                          value={isMaterialEnabledInAnySub ? String(unitWeightage[0]?.concrete ?? '0') : "0"}
                                          onChangeText={(v) => setUnitWeightage([{ ...unitWeightage[0], concrete: v }])}
                                        />
                                      ) : (
                                        <Text style={[styles.verticalMetricValue, { color: theme.text }]}>
                                          {isMaterialEnabledInAnySub ? (unitWeightage[0]?.concrete ?? '0') : '0'}%
                                        </Text>
                                      )}
                                    </View>
                                  </View>

                                  {/* SUB-ACTIVITIES (Total) */}

                                  <View style={[styles.verticalMetricRow, styles.subActivityRowHighlight]}>
                                    <View style={styles.metricLabelGroup}>
                                      <View style={[styles.indicatorDot, { backgroundColor: '#007AFF' }]} />
                                      <Text style={[styles.verticalMetricLabel, { fontWeight: '800' }]}>Subactivity (%)</Text>
                                    </View>
                                    <View style={styles.verticalMetricInputArea}>
                                      {isEditingWeightage && !allMaterialReq ? (
                                        <TextInput
                                          style={[styles.weightInput, { borderColor: '#007AFF', color: '#007AFF' }]}
                                          value={String(unitWeightage[0]?.subactivityWeightage ?? totalSubWeight ?? '0')}
                                          onChangeText={(v) => setUnitWeightage([{ ...unitWeightage[0], subactivityWeightage: v }])}
                                        />
                                      ) : (
                                        <View style={styles.subPillDisplay}>
                                          <Text style={styles.subPillText}>
                                            {allMaterialReq ? '0' : (unitWeightage[0]?.subactivityWeightage ?? totalSubWeight ?? 0)}%
                                          </Text>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                </View>

                                {/* WEIGHTAGE ACTION BUTTONS */}
                                <View style={[styles.centeredActionContainer, { marginTop: 16 }]}>
                                  {!isEditingWeightage ? (
                                    <TouchableOpacity
                                      style={[styles.actionButton, styles.editButton]}
                                      disabled={
                                        selectedFeature.basic?.isverify === true
                                      }
                                      onPress={() => setIsEditingWeightage(true)}
                                    >
                                      <Settings size={18} color="#007AFF" />
                                      <Text style={styles.editButtonText}>Edit Weightage</Text>
                                    </TouchableOpacity>
                                  ) : (
                                    <View style={styles.buttonGroup}>
                                      <TouchableOpacity
                                        style={[styles.actionButton, styles.saveButtonAction]}
                                        onPress={async () => {
                                          const res = await handleSaveWeightageOnly();
                                          setIsEditingWeightage(false);
                                        }}
                                      >
                                        <Check size={18} color="#FFF" />
                                        <Text style={styles.saveButtonTextAction}>Save</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.actionButton, styles.cancelButton]}
                                        onPress={() => {
                                          setIsEditingWeightage(false);
                                          loadSubactivitiesForUnit(expandedUnitId);
                                        }}
                                      >
                                        <X size={18} color="#EF4444" />
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>
                              </View>

                            </View>
                          );
                        })
                    )}
                  </>
                ) : (
                  <Text style={styles.emptyText}>No sub activity data available</Text>
                )}
              </View>
            )}

            {/*2. REMARKS TAB */}
            {activeTab === 'remark' && (
              <View style={styles.containerRemark}>
                {/* Input Section - hidden for read-only layers */}
                {currentLayer !== 'waternetinfraa:pipeline_by_category' && (
                  <AddRemarkEditor onAddRemark={handleAddRemark} />
                )}

                {/* Search Box */}
                <View style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderRadius: 10,
                    borderWidth: 1,
                    paddingHorizontal: 10,
                    marginTop: 12,
                    marginBottom: 12,
                    height: 40,
                  },
                  { borderColor, backgroundColor: theme.cardColor }
                ]}>
                  <Search size={16} color={subTextColor} style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 14, color: theme.text }}
                    placeholder="Search remarks…"
                    placeholderTextColor={subTextColor}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <X size={16} color={subTextColor} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* List Section */}
                <View style={styles.historyContainer}>
                  <Text style={styles.sectionTitleRemark}>
                    Recent Remarks
                    {searchQuery.trim() ? (
                      <Text style={{ fontSize: 12, color: subTextColor, fontWeight: '400' }}>
                        {' '}— {featureRemarks.filter(r =>
                          r.text.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length} result(s)
                      </Text>
                    ) : null}
                  </Text>

                  {(() => {
                    const filtered = searchQuery.trim()
                      ? featureRemarks.filter(r =>
                        r.text.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      : featureRemarks;

                    return filtered.length > 0 ? (
                      filtered.map((remark, idx) => (
                        <RemarkCard
                          key={`remark-${remark.id}-${idx}`}
                          remark={remark}
                          theme={theme}
                          isDark={isDark}
                          subTextColor={subTextColor}
                          borderColor={borderColor}
                        />
                      ))
                    ) : (
                      <View style={{
                        alignItems: 'center',
                        paddingVertical: 32,
                        gap: 8,
                      }}>
                        <MessageSquare size={36} color={subTextColor} strokeWidth={1.5} />
                        <Text style={{ color: subTextColor, fontSize: 14, fontWeight: '600' }}>
                          {searchQuery.trim() ? 'No remarks match your search' : 'No remarks yet'}
                        </Text>
                        {searchQuery.trim() && (
                          <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={{ color: '#007AFF', fontSize: 13 }}>Clear search</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </View>
            )}


            {/* 3. IMAGES TAB */}
            {/* 3. IMAGES TAB */}
            {activeTab === 'images' && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setActiveDeleteImageKey(null)}
                style={{ flex: 1 }}
              >
                {isLoadingImages ? (
                  <View style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 60,
                    gap: 12,
                  }}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={{ color: subTextColor, fontSize: 14, fontWeight: '600' }}>
                      Loading images...
                    </Text>
                  </View>
                ) : (
                  <View>
                    {currentLayer === 'waternetinfraa:structure_main' ? (
                      // ===== STP: GROUPED IMAGE GALLERY =====
                      <View style={{ gap: 20 }}>

                        {/* --- SECTION 1: Feature-Level Images --- */}
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <View style={{ width: 4, height: 20, backgroundColor: '#007AFF', borderRadius: 2 }} />
                            <Text style={[styles.sectionTitle, { marginBottom: 0, color: '#007AFF' }]}>Feature Images</Text>
                            <View style={{ backgroundColor: isDark ? '#1E3A5F' : '#EBF5FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                              <Text style={{ fontSize: 11, color: '#007AFF', fontWeight: '700' }}>{featureImages.length}</Text>
                            </View>
                          </View>
                          {featureImages.length > 0 ? (

                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                              {featureImages.map((img, idx) => {
                                const hasFailed = failedImages[img];
                                const sortedImages = [...(selectedFeature.rawResponse?.image_date || [])].sort(
                                  (a, b) => (b.wiiu_id || 0) - (a.wiiu_id || 0)
                                );
                                const imgMeta = sortedImages[idx];
                                const uploadedBy = imgMeta?.uploaded_by || imgMeta?.created_by || imgMeta?.use_name || 'Unknown';
                                const uploadedAt = imgMeta?.uploaded_at || imgMeta?.wiiu_updatedat || 'Unknown';
                                const imageKey = `feature-${idx}`;
                                const isDeleteVisible = activeDeleteImageKey === imageKey;
                                console.log("asasasas", imgMeta);
                                return (
                                  <View key={idx} style={{ width: '48%' }}>
                                    <TouchableOpacity
                                      style={{ aspectRatio: 1 }}
                                      disabled={hasFailed}
                                      onPress={() => {
                                        setSelectedImage(img);
                                        setShowImageModal(true);
                                      }}
                                    >
                                      <View style={[styles.imageGalleryCard, { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9', borderColor }]}>
                                        {hasFailed ? (
                                          <View style={styles.failContainer}><Text style={styles.failText}>Failed to load</Text></View>
                                        ) : (
                                          <Image
                                            source={{ uri: img }}
                                            style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                            resizeMode="cover"
                                            onError={() => setFailedImages(prev => ({ ...prev, [img]: true }))}
                                          />
                                        )}
                                        {idx === 0 && (
                                          <View style={[styles.latestBadgeContainer, { backgroundColor: '#007AFF' }]}>
                                            <Text style={styles.latestBadgeText}>Latest</Text>
                                          </View>
                                        )}
                                        {imgMeta?.wiiu_id && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                          <TouchableOpacity
                                            onPress={() => {
                                              showAlert(
                                                "Delete Image",
                                                "Are you sure you want to delete this image?",
                                                "warning",
                                                [
                                                  { text: "Cancel", style: "cancel", onPress: () => { } },
                                                  {
                                                    text: "Delete",
                                                    style: "destructive",
                                                    onPress: async () => {
                                                      try {
                                                        await deleteUnitImage({
                                                          image_id: imgMeta.wiiu_id,
                                                          isFeature: "true",
                                                          isUnit: "false",
                                                          isSubActivity: "false",
                                                        });
                                                        showToast("Image deleted successfully ✓");
                                                        await refreshCurrentFeature();
                                                      } catch (err: any) {
                                                        showAlert("Error", err.message, "error");
                                                      }
                                                    },
                                                  },
                                                ]
                                              );
                                            }}
                                            style={{
                                              position: "absolute",
                                              top: 6,
                                              right: 6,
                                              backgroundColor: "#EF4444",
                                              width: 30,
                                              height: 30,
                                              borderRadius: 15,
                                              justifyContent: "center",
                                              alignItems: "center",
                                              borderWidth: 2,
                                              borderColor: "#FFF",
                                              zIndex: 99,
                                              elevation: 6,
                                            }}
                                          >
                                            <Trash2 size={14} color="#FFF" />
                                          </TouchableOpacity>
                                        )}
                                      </View>
                                    </TouchableOpacity>

                                    <View style={{ paddingTop: 6, paddingHorizontal: 2, paddingBottom: 10 }}>
                                      <Text style={{ fontSize: 11, color: theme.text, fontWeight: '600' }} numberOfLines={2}>
                                        Uploaded By - {uploadedBy}
                                      </Text>
                                      <Text style={{ fontSize: 10, color: theme.text, marginTop: 2, fontWeight: '400' }} numberOfLines={2}>
                                        Uploaded At - {formatDateTime(uploadedAt)}
                                      </Text>
                                      {(() => {
                                        imageDetailsRef.current[img] = { uploadedBy, uploadedAt: formatDateTime(uploadedAt) };
                                        return null;
                                      })()}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          ) : (
                            <View style={[styles.noImagePlaceholder, { paddingVertical: 20 }]}>
                              <ImageIcon size={28} color="#94A3B8" strokeWidth={1.5} />
                              <Text style={styles.noImageText}>No feature images uploaded</Text>
                            </View>
                          )}
                        </View>

                        {/* --- SECTION 2: Unit Images --- */}
                        {/* --- SECTION 2: Unit Images + Sub Images grouped together --- */}
                        {(selectedFeature?.rawResponse?.stp_table || []).map((unit: any) => {
                          const cachedUnitItems: any[] = unitImagesMetaMap[unit.wirelusg_id] || [];
                          const hasUnitCache = cachedUnitItems.length > 0;

                          const displayUnitItems = hasUnitCache
                            ? [...cachedUnitItems].sort((a, b) => {
                              const idA = Number(a.wiuiu_id ?? a.id ?? a.unit_image_id ?? 0);
                              const idB = Number(b.wiuiu_id ?? b.id ?? b.unit_image_id ?? 0);
                              if (idB !== idA) return idB - idA;
                              return new Date(b.uploaded_at ?? b.wiuiu_updatedat ?? 0).getTime() -
                                new Date(a.uploaded_at ?? a.wiuiu_updatedat ?? 0).getTime();
                            })
                            : (unit.wiuiu_path ? [{ file_path: unit.wiuiu_path, uploaded_by: null, uploaded_at: null }] : []);

                          // Collect subactivities that have images
                          const subsWithImages = (unit.subactivities || []).filter((sub: any) => {
                            const cached = subImagesMetaMap[sub.subactivity_id] || [];
                            return cached.length > 0;
                          });

                          // Skip this unit block entirely if no unit images AND no sub images
                          if (displayUnitItems.length === 0 && subsWithImages.length === 0) return null;

                          return (
                            <View key={`unit-block-${unit.wirelusg_id}`} style={{ marginBottom: 20 }}>

                              {/* ── UNIT HEADER ── */}
                              <View style={{
                                flexDirection: 'row', alignItems: 'center',
                                gap: 8, marginBottom: 12,
                                paddingBottom: 8,
                                borderBottomWidth: 1,
                                borderBottomColor: isDark ? '#3A3A3C' : '#E2E8F0',
                              }}>
                                <View style={{ width: 4, height: 20, backgroundColor: '#10B981', borderRadius: 2 }} />
                                <Text style={[styles.sectionTitle, { marginBottom: 0, color: '#10B981', flex: 1 }]} numberOfLines={2}>
                                  {unit.wirelusg_unit_name}
                                </Text>
                                <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                  <Text style={{ fontSize: 10, color: '#15803D', fontWeight: '700' }}>
                                    Unit · {displayUnitItems.length} {displayUnitItems.length === 1 ? 'photo' : 'photos'}
                                  </Text>
                                </View>
                              </View>

                              {/* ── UNIT IMAGES ── */}
                              {displayUnitItems.length > 0 ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                  {displayUnitItems.map((imgItem: any, imgIdx: number) => {
                                    const imgUri = normalizeToAbsolute(imgItem.file_path);
                                    if (!imgUri) return null;
                                    const hasFailed = failedImages[imgUri];
                                    const uploadedBy = imgItem.uploaded_by || imgItem.created_by || imgItem.use_name || 'Unknown';
                                    const rawDate = imgItem.uploaded_at || imgItem.wiuiu_updatedat || imgItem.wiuiu_createdat || '';
                                    const unitImgId = imgItem.wiuiu_id ?? imgItem.id ?? imgItem.unit_image_id ?? null;

                                    return (
                                      <View key={`unit-${unit.wirelusg_id}-img-${imgIdx}`} style={{ width: '48%' }}>
                                        <TouchableOpacity
                                          style={{ aspectRatio: 1 }}
                                          disabled={hasFailed}
                                          onPress={() => {
                                            const allPaths = displayUnitItems.map((i: any) => normalizeToAbsolute(i.file_path)).filter(Boolean);
                                            setUnitImages(allPaths);
                                            setCurrentImageIndex(imgIdx);
                                            setModalImageContext({ type: 'unit', unitId: unit.wirelusg_id });
                                            setSelectedImage(imgUri);
                                            setShowImageModal(true);
                                          }}
                                        >
                                          <View style={[styles.imageGalleryCard, { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9', borderColor }]}>
                                            {hasFailed ? (
                                              <View style={styles.failContainer}>
                                                <Text style={styles.failText}>Failed to load</Text>
                                              </View>
                                            ) : (
                                              <Image
                                                source={{ uri: imgUri }}
                                                style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                                resizeMode="cover"
                                                onError={() => setFailedImages(prev => ({ ...prev, [imgUri]: true }))}
                                              />
                                            )}
                                            {imgIdx === 0 && (
                                              <View style={[styles.latestBadgeContainer, { backgroundColor: '#10B981' }]}>
                                                <Text style={styles.latestBadgeText}>Latest</Text>
                                              </View>
                                            )}
                                            {unitImgId && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                              <TouchableOpacity
                                                onPress={() => {
                                                  showAlert("Delete Image", "Are you sure you want to delete this image?", "warning", [
                                                    { text: "Cancel", style: "cancel", onPress: () => { } },
                                                    {
                                                      text: "Delete", style: "destructive",
                                                      onPress: async () => {
                                                        try {
                                                          await deleteUnitImage({
                                                            image_id: unitImgId,
                                                            isFeature: "false",
                                                            isUnit: "true",
                                                            isSubActivity: "false",
                                                          });
                                                          showToast("Image deleted successfully ✓");
                                                          setUnitImagesMetaMap(prev => ({
                                                            ...prev,
                                                            [unit.wirelusg_id]: (prev[unit.wirelusg_id] || []).filter(
                                                              (i: any) => (i.wiuiu_id ?? i.id ?? i.unit_image_id) !== unitImgId
                                                            ),
                                                          }));
                                                          await refreshCurrentFeature();
                                                        } catch (err: any) {
                                                          showAlert("Error", err.message, "error");
                                                        }
                                                      },
                                                    },
                                                  ]);
                                                }}
                                                style={{
                                                  position: "absolute", top: 6, right: 6,
                                                  backgroundColor: "#EF4444", width: 30, height: 30,
                                                  borderRadius: 15, justifyContent: "center", alignItems: "center",
                                                  borderWidth: 2, borderColor: "#FFF", zIndex: 99, elevation: 6,
                                                }}
                                              >
                                                <Trash2 size={14} color="#FFF" />
                                              </TouchableOpacity>
                                            )}
                                          </View>
                                        </TouchableOpacity>
                                        <View style={{ paddingTop: 6, paddingHorizontal: 2, paddingBottom: 10 }}>
                                          <Text style={{ fontSize: 11, color: theme.text, fontWeight: '600' }} numberOfLines={2}>
                                            Uploaded By - {uploadedBy}
                                          </Text>
                                          <Text style={{ fontSize: 10, color: theme.text, marginTop: 2 }} numberOfLines={2}>
                                            Uploaded At - {formatDateTime(rawDate)}
                                          </Text>
                                          {(() => {
                                            if (imgUri) imageDetailsRef.current[imgUri] = { uploadedBy, uploadedAt: formatDateTime(rawDate) };
                                            return null;
                                          })()}
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                              ) : (
                                <View style={[styles.noImagePlaceholder, { paddingVertical: 16, marginBottom: 12 }]}>
                                  <ImageIcon size={24} color="#94A3B8" strokeWidth={1.5} />
                                  <Text style={[styles.noImageText, { fontSize: 12 }]}>No unit images uploaded</Text>
                                </View>
                              )}

                              {/* ── SUB-ACTIVITY IMAGES (under this unit) ── */}
                              {subsWithImages.length > 0 && (
                                <View style={{
                                  marginLeft: 12,
                                  paddingLeft: 12,
                                  borderLeftWidth: 2,
                                  borderLeftColor: isDark ? '#3A3A3C' : '#E2E8F0',
                                }}>
                                  {subsWithImages.map((sub: any, subGroupIdx: number) => {
                                    const subId = sub.subactivity_id;
                                    const cachedItems: any[] = subImagesMetaMap[subId] || [];

                                    const displayItems = [...cachedItems].sort((a, b) => {
                                      const idA = Number(a.wisiu_id ?? a.id ?? a.sub_image_id ?? a.subactivity_image_id ?? 0);
                                      const idB = Number(b.wisiu_id ?? b.id ?? b.sub_image_id ?? b.subactivity_image_id ?? 0);
                                      if (idB !== idA) return idB - idA;
                                      return new Date(b.uploaded_at ?? b.created_at ?? 0).getTime() -
                                        new Date(a.uploaded_at ?? a.created_at ?? 0).getTime();
                                    });

                                    return (
                                      <View key={`sub-group-${subId}-${subGroupIdx}`} style={{ marginBottom: 16 }}>
                                        {/* Sub header */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                                          <Text style={{ fontSize: 12, color: theme.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                                            {sub.subactivity_name}
                                          </Text>
                                          <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                                            <Text style={{ fontSize: 10, color: '#B45309', fontWeight: '700' }}>
                                              {displayItems.length} {displayItems.length === 1 ? 'photo' : 'photos'}
                                            </Text>
                                          </View>
                                        </View>

                                        {/* Sub images grid */}
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                          {displayItems.map((imgItem: any, imgIdx: number) => {
                                            const subImgUri = normalizeToAbsolute(imgItem.file_path);
                                            if (!subImgUri) return null;
                                            const hasFailed = failedImages[subImgUri];
                                            const uploadedBy = imgItem.uploaded_by || imgItem.created_by || 'Unknown';
                                            const rawDate = imgItem.uploaded_at || imgItem.created_at || '';
                                            const subImgId = imgItem.wisiu_id ?? imgItem.id ?? imgItem.sub_image_id ?? imgItem.subactivity_image_id ?? null;

                                            return (
                                              <View key={`sub-${subId}-img-${imgIdx}`} style={{ width: '48%' }}>
                                                <TouchableOpacity
                                                  style={{ aspectRatio: 1 }}
                                                  disabled={hasFailed}
                                                  onPress={() => {
                                                    const allPaths = displayItems.map((i: any) => normalizeToAbsolute(i.file_path)).filter(Boolean);
                                                    setUnitImages(allPaths);
                                                    setCurrentImageIndex(imgIdx);
                                                    setSelectedImage(subImgUri);
                                                    setModalImageContext({ type: 'sub', subId });
                                                    setShowImageModal(true);
                                                  }}
                                                >
                                                  <View style={[styles.imageGalleryCard, { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9', borderColor }]}>
                                                    {hasFailed ? (
                                                      <View style={styles.failContainer}>
                                                        <Text style={styles.failText}>Failed to load</Text>
                                                      </View>
                                                    ) : (
                                                      <Image
                                                        source={{ uri: subImgUri }}
                                                        style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                                        resizeMode="cover"
                                                        onError={() => setFailedImages(prev => ({ ...prev, [subImgUri]: true }))}
                                                      />
                                                    )}
                                                    {imgIdx === 0 && (
                                                      <View style={[styles.latestBadgeContainer, { backgroundColor: '#F59E0B' }]}>
                                                        <Text style={styles.latestBadgeText}>Latest</Text>
                                                      </View>
                                                    )}
                                                    {subImgId && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                                      <TouchableOpacity
                                                        onPress={() => {
                                                          showAlert("Delete Image", "Are you sure you want to delete this image?", "warning", [
                                                            { text: "Cancel", style: "cancel", onPress: () => { } },
                                                            {
                                                              text: "Delete", style: "destructive",
                                                              onPress: async () => {
                                                                try {
                                                                  await deleteUnitImage({
                                                                    image_id: subImgId,
                                                                    isFeature: "false",
                                                                    isUnit: "false",
                                                                    isSubActivity: "true",
                                                                  });
                                                                  showToast("Image deleted successfully ✓");
                                                                  setSubImagesMetaMap(prev => {
                                                                    const existing = prev[subId] || [];
                                                                    const updated = existing.filter((i: any) => {
                                                                      const id = i.wisiu_id ?? i.id ?? i.sub_image_id ?? i.subactivity_image_id;
                                                                      return id !== subImgId;
                                                                    });
                                                                    return { ...prev, [subId]: updated };
                                                                  });
                                                                  await refreshCurrentFeature();
                                                                } catch (err: any) {
                                                                  showAlert("Error", err.message, "error");
                                                                }
                                                              },
                                                            },
                                                          ]);
                                                        }}
                                                        style={{
                                                          position: "absolute", top: 6, right: 6,
                                                          backgroundColor: "#EF4444", width: 30, height: 30,
                                                          borderRadius: 15, justifyContent: "center", alignItems: "center",
                                                          borderWidth: 2, borderColor: "#FFF", zIndex: 99, elevation: 6,
                                                        }}
                                                      >
                                                        <Trash2 size={14} color="#FFF" />
                                                      </TouchableOpacity>
                                                    )}
                                                  </View>
                                                </TouchableOpacity>
                                                <View style={{ paddingTop: 6, paddingHorizontal: 2, paddingBottom: 10 }}>
                                                  <Text style={{ fontSize: 11, color: theme.text, fontWeight: '600' }} numberOfLines={2}>
                                                    Uploaded By - {uploadedBy}
                                                  </Text>
                                                  <Text style={{ fontSize: 10, color: theme.text, marginTop: 2 }} numberOfLines={2}>
                                                    Uploaded At - {formatDateTime(rawDate)}
                                                  </Text>
                                                  {(() => {
                                                    if (subImgUri) imageDetailsRef.current[subImgUri] = { uploadedBy, uploadedAt: formatDateTime(rawDate) };
                                                    return null;
                                                  })()}
                                                </View>
                                              </View>
                                            );
                                          })}
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {/* --- SECTION 3: Sub-Activity Images --- */}
                        {/* {(() => {
                          const allSubsWithImages: Array<{ unitName: string; sub: any; cachedItems: any[]; }> = [];

                          (selectedFeature?.rawResponse?.stp_table || []).forEach((unit: any) => {
                            (unit.subactivities || []).forEach((sub: any) => {
                              const subId = sub.subactivity_id;
                              const cached: any[] = subImagesMetaMap[subId] || [];
                              const hasCached = cached.length > 0;
                              if (hasCached) {
                                allSubsWithImages.push({ unitName: unit.wirelusg_unit_name, sub, cachedItems: cached });
                              }
                            });
                          });

                          if (allSubsWithImages.length === 0) return null;

                          const totalSubImages = allSubsWithImages.reduce((sum, entry) => {
                            return sum + (entry.cachedItems.length > 0 ? entry.cachedItems.length : 1);
                          }, 0);

                          return (
                            <View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <View style={{ width: 4, height: 20, backgroundColor: '#F59E0B', borderRadius: 2 }} />
                                <Text style={[styles.sectionTitle, { marginBottom: 0, color: '#F59E0B' }]}>Sub-Activity Images</Text>
                                <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                  <Text style={{ fontSize: 11, color: '#B45309', fontWeight: '700' }}>{totalSubImages}</Text>
                                </View>
                              </View>

                              {allSubsWithImages.map(({ unitName, sub, cachedItems }, groupIdx) => {
                                const subId = sub.subactivity_id;

                                const displayItems = cachedItems.length > 0
                                  ? [...cachedItems].sort((a, b) => {
                                    const idA = Number(a.subactivity_image_id ?? a.id ?? a.sub_image_id ?? 0);
                                    const idB = Number(b.subactivity_image_id ?? b.id ?? b.sub_image_id ?? 0);
                                    if (idB !== idA) return idB - idA;
                                    const dateA = new Date(a.uploaded_at ?? a.created_at ?? a.subactivity_image_updatedat ?? a.subactivity_image_createdat ?? a.updated_at ?? 0).getTime();
                                    const dateB = new Date(b.uploaded_at ?? b.created_at ?? b.subactivity_image_updatedat ?? b.subactivity_image_createdat ?? b.updated_at ?? 0).getTime();
                                    return dateB - dateA;
                                  })
                                  : [];
                                return (
                                  <View key={`sub-group-${subId}-${groupIdx}`} style={{ marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingHorizontal: 4 }}>
                                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                                      <Text style={{ fontSize: 12, color: theme.text, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                                        {sub.subactivity_name}
                                      </Text>
                                      <Text style={{ fontSize: 10, color: subTextColor }}>{unitName}</Text>
                                    </View>

                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                      {displayItems.map((imgItem: any, imgIdx: number) => {
                                        const subImgUri = normalizeToAbsolute(imgItem.file_path);
                                        if (!subImgUri) return null;
                                        const hasFailed = failedImages[subImgUri];
                                        const uploadedBy = imgItem.uploaded_by || imgItem.created_by || imgItem.use_name || imgItem.subactivity_uploaded_by || imgItem.subactivity_created_by || 'Unknown';
                                        const rawDate = imgItem.uploaded_at || imgItem.created_at || imgItem.subactivity_image_updatedat || imgItem.subactivity_image_createdat || '';
                                        const subImgId = imgItem.wisiu_id ?? imgItem.id ?? imgItem.sub_image_id ?? null;
                                        const imageKey = `sub-${subId}-${imgIdx}`;
                                        const isDeleteVisible = activeDeleteImageKey === imageKey;

                                        return (
                                          <View key={`sub-${subId}-img-${imgIdx}`} style={{ width: '48%' }}>
                                            <TouchableOpacity
                                              style={{ aspectRatio: 1 }}
                                              disabled={hasFailed}
                                              onPress={() => {
                                                const allPaths = displayItems.map((i: any) => normalizeToAbsolute(i.file_path)).filter(Boolean);
                                                setUnitImages(allPaths);
                                                setCurrentImageIndex(imgIdx);
                                                setSelectedImage(subImgUri);
                                                setModalImageContext({ type: 'sub', subId });

                                                setShowImageModal(true);
                                              }}
                                            >
                                              <View style={[styles.imageGalleryCard, { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9', borderColor }]}>
                                                {hasFailed ? (
                                                  <View style={styles.failContainer}>
                                                    <Text style={styles.failText}>Failed to load</Text>
                                                  </View>
                                                ) : (
                                                  <Image
                                                    source={{ uri: subImgUri }}
                                                    style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                                    resizeMode="cover"
                                                    onError={() => setFailedImages(prev => ({ ...prev, [subImgUri]: true }))}
                                                  />
                                                )}
                                                {imgIdx === 0 && (
                                                  <View style={[styles.latestBadgeContainer, { backgroundColor: '#F59E0B' }]}>
                                                    <Text style={styles.latestBadgeText}>Latest</Text>
                                                  </View>
                                                )}
                                                {hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                                  <TouchableOpacity
                                                    onPress={() => {
                                                      showAlert(
                                                        "Delete Image",
                                                        "Are you sure you want to delete this image?",
                                                        "warning",
                                                        [
                                                          { text: "Cancel", style: "cancel", onPress: () => { } },
                                                          {
                                                            text: "Delete",
                                                            style: "destructive",
                                                            onPress: async () => {
                                                              try {
                                                                console.log("sassssa", subImgId);
                                                                await deleteUnitImage({
                                                                  image_id: subImgId,
                                                                  isFeature: "false",
                                                                  isUnit: "false",
                                                                  isSubActivity: "true",
                                                                });
                                                                showToast("Image deleted successfully ✓");

                                                                // Instantly remove from cache so gallery updates without hard refresh
                                                                setSubImagesMetaMap(prev => {
                                                                  const existing = prev[subId] || [];
                                                                  const updated = existing.filter((i: any) => {
                                                                    const id = i.wisiu_id ?? i.id ?? i.sub_image_id ?? i.subactivity_image_id;
                                                                    return id !== subImgId;
                                                                  });
                                                                  return { ...prev, [subId]: updated };
                                                                });

                                                                await refreshCurrentFeature();
                                                              } catch (err: any) {
                                                                showAlert("Error", err.message, "error");
                                                              }
                                                            },
                                                          },
                                                        ]
                                                      );
                                                    }}
                                                    style={{
                                                      position: "absolute",
                                                      top: 6,
                                                      right: 6,
                                                      backgroundColor: "#EF4444",
                                                      width: 30,
                                                      height: 30,
                                                      borderRadius: 15,
                                                      justifyContent: "center",
                                                      alignItems: "center",
                                                      borderWidth: 2,
                                                      borderColor: "#FFF",
                                                      zIndex: 99,
                                                      elevation: 6,
                                                    }}
                                                  >
                                                    <Trash2 size={14} color="#FFF" />
                                                  </TouchableOpacity>
                                                )}
                                              </View>
                                            </TouchableOpacity>

                                            <View style={{ paddingTop: 6, paddingHorizontal: 2, paddingBottom: 10 }}>
                                              <Text style={{ fontSize: 11, color: theme.text, fontWeight: '600' }} numberOfLines={2}>
                                                Uploaded By - {uploadedBy}
                                              </Text>
                                              <Text style={{ fontSize: 10, color: theme.text, marginTop: 2, fontWeight: '400' }} numberOfLines={2}>
                                                Uploaded At - {formatDateTime(rawDate)}
                                              </Text>
                                              {(() => {
                                                if (img) imageDetailsRef.current[img] = { uploadedBy, uploadedAt: formatDateTime(rawDate) };
                                                return null;
                                              })()}
                                            </View>
                                          </View>
                                        );
                                      })}
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })()} */}

                        {/* Empty state */}
                        {featureImages.length === 0 &&
                          !(selectedFeature?.rawResponse?.stp_table || []).some((u: any) => u.wiuiu_path) &&
                          !(selectedFeature?.rawResponse?.stp_table || []).some((u: any) =>
                            (u.subactivities || []).some((s: any) => s.wisuiu_path)
                          ) && (
                            <View style={{ alignItems: 'center', padding: 40 }}>
                              <ImageIcon size={48} color={subTextColor} strokeWidth={1.5} />
                              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600', marginTop: 12 }}>No Images Found</Text>
                              <Text style={{ color: subTextColor, textAlign: 'center', marginTop: 6 }}>
                                No images have been uploaded for this STP/WTP yet.
                              </Text>
                            </View>
                          )}
                      </View>
                    ) : (
                      // ===== OTHER LAYERS: ORIGINAL FLAT GALLERY =====
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {featureImages.length > 0 ? (
                          featureImages.map((img, idx) => {
                            const hasFailed = failedImages[img];
                            const sortedImages = [...(selectedFeature.rawResponse?.image_date || [])].sort(
                              (a, b) => (b.wiiu_id || 0) - (a.wiiu_id || 0)
                            );
                            const imgMeta = sortedImages[idx];
                            const uploadedBy = imgMeta?.uploaded_by || imgMeta?.created_by || imgMeta?.use_name || 'Unknown';
                            const uploadedAt = imgMeta?.wiiu_updatedat || imgMeta?.uploaded_at || '';
                            const imageKey = `flat-feature-${idx}`;
                            const isDeleteVisible = activeDeleteImageKey === imageKey;

                            return (
                              <View key={idx} style={{ width: '48%' }}>
                                <TouchableOpacity
                                  style={{ aspectRatio: 1 }}
                                  disabled={hasFailed}
                                  onPress={() => {
                                    setSelectedImage(img);
                                    setShowImageModal(true);
                                  }}
                                >
                                  <View style={[styles.imageGalleryCard, { backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9', borderColor }]}>
                                    {hasFailed ? (
                                      <View style={styles.failContainer}><Text style={styles.failText}>Failed to load</Text></View>
                                    ) : (
                                      <Image
                                        source={{ uri: img }}
                                        style={{ width: '100%', height: '100%', borderRadius: 8 }}
                                        resizeMode="cover"
                                        onError={() => setFailedImages(prev => ({ ...prev, [img]: true }))}
                                      />
                                    )}
                                    {idx === 0 && (
                                      <View style={[styles.latestBadgeContainer, { backgroundColor: '#007AFF' }]}>
                                        <Text style={styles.latestBadgeText}>Latest</Text>
                                      </View>
                                    )}
                                    {imgMeta?.wiiu_id && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (
                                      <TouchableOpacity
                                        onPress={() => {
                                          showAlert(
                                            "Delete Image",
                                            "Are you sure you want to delete this image?",
                                            "warning",
                                            [
                                              { text: "Cancel", style: "cancel", onPress: () => { } },
                                              {
                                                text: "Delete",
                                                style: "destructive",
                                                onPress: async () => {
                                                  try {
                                                    await deleteUnitImage({
                                                      image_id: imgMeta.wiiu_id,
                                                      isFeature: "true",
                                                      isUnit: "false",
                                                      isSubActivity: "false",
                                                    });
                                                    showToast("Image deleted successfully ✓");
                                                    await refreshCurrentFeature();
                                                  } catch (err: any) {
                                                    showAlert("Error", err.message, "error");
                                                  }
                                                },
                                              },
                                            ]
                                          );
                                        }}
                                        style={{
                                          position: "absolute",
                                          top: 6,
                                          right: 6,
                                          backgroundColor: "#EF4444",
                                          width: 30,
                                          height: 30,
                                          borderRadius: 15,
                                          justifyContent: "center",
                                          alignItems: "center",
                                          borderWidth: 2,
                                          borderColor: "#FFF",
                                          zIndex: 99,
                                          elevation: 6,
                                        }}
                                      >
                                        <Trash2 size={14} color="#FFF" />
                                      </TouchableOpacity>
                                    )}
                                  </View>
                                </TouchableOpacity>

                                <View style={{ paddingTop: 6, paddingHorizontal: 2, paddingBottom: 10 }}>
                                  <Text style={{ fontSize: 11, color: theme.text, fontWeight: '600' }} numberOfLines={2}>
                                    Uploaded By - {uploadedBy}
                                  </Text>
                                  <Text style={{ fontSize: 10, color: theme.text, marginTop: 2, fontWeight: '400' }} numberOfLines={2}>
                                    Uploaded At - {formatDateTime(uploadedAt)}
                                  </Text>
                                  {(() => {
                                    imageDetailsRef.current[img] = { uploadedBy, uploadedAt: formatDateTime(uploadedAt) };
                                    return null;
                                  })()}
                                </View>
                              </View>
                            );
                          })
                        ) : (
                          <View style={{ flex: 1, alignItems: 'center', padding: 40 }}>
                            <ImageIcon size={48} color={subTextColor} />
                            <Text style={{ color: subTextColor, marginTop: 10 }}>No images found</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            )}
            {(activeTab === 'attributes') &&
              currentLayer !== 'waternetinfraa:pipeline_existing' &&
              currentLayer !== 'waternetinfraa:pipeline_by_category' &&
              currentLayer !== 'waternetinfraa:tank_existing' &&
              currentLayer !== 'waternetinfraa:manhole_existing' &&
              currentLayer !== 'waternetinfraa:structure_existing'
              && hasWriteAccess("DASHBOARD_UPDATE_ATTRIBUTES") && (
                <View style={styles.centeredActionContainer}>
                  {!isEditing ? (
                    <View>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.editButton,
                          selectedFeature.basic?.isverify && { opacity: 0.6 } // Optional: visual cue for disabled state
                        ]}
                        onPress={() => setIsEditing(true)}
                        disabled={selectedFeature.basic?.isverify === true || selectedFeature.basic?.wimg_isverified === true}
                      >
                        <Settings size={18} color="#007AFF" />
                        <Text style={styles.editButtonText}>Edit Feature Data</Text>
                      </TouchableOpacity>

                      {/* ✅ VERIFICATION MESSAGE */}
                      {(selectedFeature.basic?.isverify === true || selectedFeature.basic?.wimg_isverified === true) && (
                        <View style={styles.verifiedContainer}>
                          <Text style={styles.verifiedText}>✓ Feature Verified</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={styles.buttonGroup}>


                      <TouchableOpacity
                        style={[styles.actionButton, styles.saveButtonAction]}
                        onPress={async () => {
                          try {
                            if (dynamicAttrRef.current) {
                              await dynamicAttrRef.current.triggerSave();
                            }
                          } catch (e) {
                            console.error("Dynamic save failed", e);
                            return; // Stop if validation fails
                          }
                          // Dynamically call the correct save function
                          { console.log("my current layer is ", currentLayer) }
                          if (currentLayer.includes('pipeline')) {
                            handleSavePipelineDetails();
                          } else if (currentLayer.includes('manhole')) {
                            handleSaveManholeDetails();
                          } else if (currentLayer.includes('specials')) {
                            handleSaveJunctionDetails();
                          } else if (currentLayer.includes('tank')) {
                            handleSaveTankDetails();
                          } else if (currentLayer.includes('structure_main')) { // Add this check
                            handleSaveSTPDetails();
                          } else {
                            showAlert("Notice", "Save logic for this layer is not implemented.", 'warning');
                          }
                        }}                  >
                        <Check size={18} color="#FFF" />
                        <Text style={styles.saveButtonTextAction}>Save Changes</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => {
                          setIsEditing(false);
                          setEditedAttributes({});
                          setCapturedImage(null);
                        }}
                      >
                        <X size={18} color="#EF4444" />
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
          </BottomSheetScrollView>
        </BottomSheet>
      )
      }
      {/* Image Preview Modal */}
      <Modal visible={showImageModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 1 }}
            onPress={() => setShowImageModal(false)}
          >
            <X size={32} color="#FFF" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
            />
          )}
          {selectedImage && imageDetailsRef.current[selectedImage] && (
            <View style={{
              position: 'absolute',
              bottom: 40,
              left: 20,
              right: 20,
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: 15,
              borderRadius: 10,
              zIndex: 10,
            }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
                Uploaded By - {imageDetailsRef.current[selectedImage].uploadedBy}
              </Text>
              <Text style={{ color: '#FFF', fontSize: 12, marginTop: 4 }}>
                Uploaded At - {imageDetailsRef.current[selectedImage].uploadedAt}
              </Text>
            </View>
          )}
        </View>
      </Modal>
      {/* Enhanced Map Loading Overlay with Progress */}
      {isMapLoading && (
        <View style={styles.mapLoadingOverlay}>
          <View style={styles.loaderContainer}>
            {/* Animated spinning circle */}
            <View style={styles.spinnerWrapper}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>

            {/* Loading icon */}
            <View style={styles.mapIconCircle}>
              <Layers size={32} color="#007AFF" />
            </View>

            {/* Text */}
            <Text style={styles.loaderText}>Initializing Map</Text>
            <Text style={styles.loaderSubText}>Loading layers and features...</Text>

            {/* Progress dots */}
            <View style={styles.progressDots}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
            </View>
          </View>
        </View>
      )}
      {/* Google Sheet Links Modal */}
      <Modal visible={linkModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: theme.cardColor, height: '80%' }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.sectionTitle}>Google Sheet Links</Text>
              <TouchableOpacity onPress={() => setLinkModalVisible(false)}><X color={theme.text} size={22} /></TouchableOpacity>
            </View>

            {/* --- ADD NEW LINK BUTTON (Visible only in Edit Mode) --- */}
            {isEditing && (
              <TouchableOpacity
                style={styles.addNewButton}
                onPress={() => {
                  // 1. Create a new empty link object
                  const newLink = {
                    wigsl_googlesheet_link: '',
                    wigsl_tags: '',
                    isNew: true,
                    isDraft: true,
                    wigsl_id: null, // Useful for keyExtractor
                  };

                  // 2. Get current links
                  const existingLinks = editedAttributes.sheet_links || selectedFeature.rawResponse?.sheet_links || [];
                  setEditedAttributes({
                    ...editedAttributes,
                    sheet_links: [newLink, ...existingLinks]
                  });
                }}
              >
                <Plus size={18} color="#FFF" />
                <Text style={styles.addNewButtonText}>Add New Sheet Link</Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={editedAttributes.sheet_links || selectedFeature?.rawResponse?.sheet_links || []}
              keyExtractor={(item, index) => item.wigsl_id?.toString() || `link-${index}`}
              renderItem={({ item, index }) => {
                const isDraft = item.isDraft;
                const showButtons = item.isDraft || item.isNew;
                return (
                  <View style={[styles.linkCard, { backgroundColor: theme.cardColor, borderColor: item.isNew ? '#007AFF' : borderColor }]}>
                    {isEditing ? (
                      <View style={{ gap: 10 }}>
                        <Text style={styles.subLabel}>Document URL</Text>
                        <TextInput
                          style={[styles.attributeInput, { backgroundColor: inputBg }]}
                          value={item.wigsl_googlesheet_link}
                          onChangeText={(text) => {
                            const newList = [...(editedAttributes.sheet_links || selectedFeature.rawResponse.sheet_links)];
                            // Force isDraft to true here so buttons appear for existing items
                            newList[index] = { ...newList[index], wigsl_googlesheet_link: text, isDraft: true };
                            setEditedAttributes({ ...editedAttributes, sheet_links: newList });
                          }}
                        />

                        <Text style={styles.subLabel}>Tags</Text>
                        <TextInput
                          style={[styles.attributeInput, { backgroundColor: inputBg }]}
                          value={item.wigsl_tags || item.tag || ''}
                          onChangeText={(text) => {
                            const newList = [...(editedAttributes.sheet_links || selectedFeature.rawResponse.sheet_links)];
                            newList[index] = { ...newList[index], wigsl_tags: text, tag: text, isDraft: true };
                            setEditedAttributes({ ...editedAttributes, sheet_links: newList });
                          }}
                        />

                        {showButtons && (
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <TouchableOpacity
                              style={[styles.inlineBtn, { backgroundColor: '#10B981' }]}
                              onPress={() => {
                                const newList = [...(editedAttributes.sheet_links || [])];
                                newList[index] = {
                                  ...newList[index],
                                  isDraft: false,
                                  isNew: false
                                };
                                setEditedAttributes({ ...editedAttributes, sheet_links: newList });
                              }}
                            >
                              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Add</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.inlineBtn, { backgroundColor: '#EF4444' }]}
                              onPress={() => {
                                // Revert to original data from rawResponse
                                const newList = [...(editedAttributes.sheet_links || [])];
                                const original = selectedFeature.rawResponse.sheet_links[index];
                                if (original) {
                                  newList[index] = { ...original, isDraft: false };
                                } else {
                                  newList.splice(index, 1); // Remove if it was brand new
                                }
                                setEditedAttributes({ ...editedAttributes, sheet_links: newList });
                              }}
                            >
                              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => Linking.openURL(item.wigsl_googlesheet_link)}>
                        <View style={styles.cardHeader}>
                          <FileText size={18} color="#0EA5E9" />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text numberOfLines={1} style={[styles.linkPrimaryText, { color: theme.text }]}>
                              {item.wigsl_googlesheet_link}
                            </Text>
                            {/* Date visible in View Mode */}
                            {item.wigsl_createdat && (
                              <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                                Uploaded At: {new Date(item.wigsl_createdat).toLocaleDateString()}
                              </Text>
                            )}
                          </View>
                          <ExternalLink size={16} color="#94A3B8" />
                        </View>

                        {/* --- TAGS SECTION (RESTORED) --- */}
                        <View style={styles.tagContainer}>
                          {item.wigsl_tags ? item.wigsl_tags.split(',').map((t, i) => (
                            <View key={i} style={styles.tagBadge}>
                              <Text style={styles.tagText}>{t.trim()}</Text>
                            </View>
                          )) : <Text style={styles.linkMetaText}>No tags</Text>}
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Camera Links Modal */}
      <Modal visible={cameraModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.bottomSheet, { backgroundColor: theme.cardColor, height: '80%' }]}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.sectionTitle}>Camera Feeds</Text>
              <TouchableOpacity onPress={() => setCameraModalVisible(false)}><X color={theme.text} size={22} /></TouchableOpacity>
            </View>

            {isEditing && (
              <TouchableOpacity
                style={[styles.addNewButton, { backgroundColor: '#F59E0B' }]}
                onPress={() => {
                  const newCam = {
                    wicl_camera_link: '',
                    wicl_tags: '',
                    wicl_id: null, // Temporary ID
                    isNew: true,
                    isDraft: true
                  };

                  const existingCams = editedAttributes.camera_links || selectedFeature.rawResponse?.camera_links || [];
                  setEditedAttributes({
                    ...editedAttributes,
                    camera_links: [newCam, ...existingCams] // New camera link shows at the TOP
                  });
                }}
              >
                <Plus size={18} color="#FFF" />
                <Text style={styles.addNewButtonText}>Add New Camera Feed</Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={editedAttributes.camera_links || selectedFeature?.rawResponse?.camera_links || []}
              keyExtractor={(item, index) => item.wicl_id?.toString() || `cam-${index}`}
              renderItem={({ item, index }) => {
                const isDraft = item.isDraft;
                const showButtons = item.isDraft || item.isNew;
                return (
                  <View style={[styles.linkCard, { backgroundColor: theme.cardColor, borderColor: item.isNew ? '#F59E0B' : borderColor }]}>
                    {isEditing ? (
                      <View style={{ gap: 10 }}>
                        <Text style={styles.subLabel}>Camera Feed URL</Text>
                        <TextInput
                          style={[styles.attributeInput, { backgroundColor: inputBg }]}
                          value={item.wicl_camera_link}
                          onChangeText={(text) => {
                            const newList = [...(editedAttributes.camera_links || selectedFeature.rawResponse.camera_links)];
                            newList[index] = { ...newList[index], wicl_camera_link: text, isDraft: true };
                            setEditedAttributes({ ...editedAttributes, camera_links: newList });
                          }}
                        />

                        <Text style={styles.subLabel}>Tags</Text>
                        <TextInput
                          style={[styles.attributeInput, { backgroundColor: inputBg }]}
                          value={item.wicl_tags || item.tag || ''}
                          onChangeText={(text) => {
                            const newList = [...(editedAttributes.camera_links || selectedFeature.rawResponse.camera_links)];
                            newList[index] = { ...newList[index], wicl_tags: text, tag: text, isDraft: true };
                            setEditedAttributes({ ...editedAttributes, camera_links: newList });
                          }}
                        />

                        {showButtons && (
                          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <TouchableOpacity
                              style={[styles.inlineBtn, { backgroundColor: '#10B981' }]}
                              onPress={() => {
                                const newList = [...(editedAttributes.camera_links || [])];
                                newList[index] = {
                                  ...newList[index],
                                  isDraft: false,
                                  isNew: false
                                };
                                setEditedAttributes({ ...editedAttributes, camera_links: newList });
                              }}
                            >
                              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Add</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.inlineBtn, { backgroundColor: '#EF4444' }]}
                              onPress={() => {
                                const newList = [...(editedAttributes.camera_links || [])];
                                const original = selectedFeature.rawResponse.camera_links[index];
                                if (original) {
                                  newList[index] = { ...original, isDraft: false };
                                } else {
                                  newList.splice(index, 1);
                                }
                                setEditedAttributes({ ...editedAttributes, camera_links: newList });
                              }}
                            >
                              <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => {
                          const url = item.wicl_camera_link || item.link || '';
                          if (url.startsWith('https://')) {
                            setCameraIframeUrl(url);
                          } else {
                            Linking.openURL(url);
                          }
                        }}
                      >
                        <View style={styles.cardHeader}>
                          <Camera size={18} color="#F59E0B" />
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text numberOfLines={1} style={[styles.linkPrimaryText, { color: theme.text }]}>
                              {item.wicl_camera_link || item.link}
                            </Text>
                            {item.wicl_createdat && (
                              <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                                Added: {new Date(item.wicl_createdat).toLocaleDateString()}
                              </Text>
                            )}
                            {/* Badge indicating how it will open */}
                            {/* <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                              {(item.wicl_camera_link || item.link || '').startsWith('https://') ? (
                                <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                  <Text style={{ fontSize: 9, color: '#15803D', fontWeight: '700' }}>▶ Opens in-app viewer</Text>
                                </View>
                              ) : (
                                <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                  <Text style={{ fontSize: 9, color: '#B45309', fontWeight: '700' }}>↗ Opens in browser</Text>
                                </View>
                              )}
                            </View> */}
                          </View>
                          <ExternalLink size={16} color="#94A3B8" />
                        </View>

                        {/* --- CAMERA TAGS DISPLAY --- */}
                        <View style={styles.tagContainer}>
                          {(item.wicl_tags || item.tag) ? (item.wicl_tags || item.tag).split(',').map((t, i) => (
                            <View key={i} style={[styles.tagBadge, { backgroundColor: '#FEF3C7' }]}>
                              <Text style={[styles.tagText, { color: '#B45309' }]}>{t.trim()}</Text>
                            </View>
                          )) : <Text style={styles.linkMetaText}>No tags</Text>}
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>
      {/* Image Preview Modal */}
      <Modal
        visible={showImageModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowImageModal(false);
          setUnitImages([]);
          setCurrentImageIndex(0);
          setModalImageContext(null);
        }}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.97)',
          justifyContent: 'space-between',
        }}>

          {/* ── TOP BAR ── */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 54,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255,255,255,0.08)',
          }}>
            {/* Counter pill */}
            {unitImages.length > 1 ? (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}>
                <ImageIcon size={13} color="#94A3B8" />
                <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 }}>
                  {currentImageIndex + 1}
                  <Text style={{ color: '#64748B', fontWeight: '400' }}> / {unitImages.length}</Text>
                </Text>
              </View>
            ) : (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
              }}>
                <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>Image Preview</Text>
              </View>
            )}

            {/* Right side: Delete + Close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>

              {/* Delete button — only for unit/sub images with write access */}
              {modalImageContext && modalImageContext.type !== 'feature' && hasWriteAccess("DASHBOARD_DELETE_IMAGE") && (() => {
                // Resolve the image ID for the currently visible image
                let currentImgId: number | null = null;
                let isFeatureFlag = "false";
                let isUnitFlag = "false";
                let isSubFlag = "false";

                if (modalImageContext.type === 'unit' && modalImageContext.unitId != null) {
                  const items = unitImagesMetaMap[modalImageContext.unitId] || [];
                  const sorted = [...items].sort((a, b) => {
                    const idA = Number(a.wiuiu_id ?? a.id ?? a.unit_image_id ?? 0);
                    const idB = Number(b.wiuiu_id ?? b.id ?? b.unit_image_id ?? 0);
                    if (idB !== idA) return idB - idA;
                    return new Date(b.uploaded_at ?? b.wiuiu_updatedat ?? 0).getTime() -
                      new Date(a.uploaded_at ?? a.wiuiu_updatedat ?? 0).getTime();
                  });
                  const item = sorted[currentImageIndex];
                  currentImgId = item?.wiuiu_id ?? item?.id ?? item?.unit_image_id ?? null;
                  isUnitFlag = "true";
                } else if (modalImageContext.type === 'sub' && modalImageContext.subId != null) {
                  const items = subImagesMetaMap[modalImageContext.subId] || [];
                  const sorted = [...items].sort((a, b) => {
                    const idA = Number(a.wisiu_id ?? a.id ?? a.sub_image_id ?? a.subactivity_image_id ?? 0);
                    const idB = Number(b.wisiu_id ?? b.id ?? b.sub_image_id ?? b.subactivity_image_id ?? 0);
                    if (idB !== idA) return idB - idA;
                    return new Date(b.uploaded_at ?? b.created_at ?? b.subactivity_image_updatedat ?? 0).getTime() -
                      new Date(a.uploaded_at ?? a.created_at ?? a.subactivity_image_updatedat ?? 0).getTime();
                  });
                  const item = sorted[currentImageIndex];
                  currentImgId = item?.wisiu_id ?? item?.id ?? item?.sub_image_id ?? item?.subactivity_image_id ?? null;
                  isSubFlag = "true";
                }

                if (!currentImgId) return null;

                return (
                  <TouchableOpacity
                    onPress={() => {
                      showAlert(
                        "Delete Image",
                        "Are you sure you want to delete this image?",
                        "warning",
                        [
                          { text: "Cancel", style: "cancel", onPress: () => { } },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await deleteUnitImage({
                                  image_id: currentImgId!,
                                  isFeature: isFeatureFlag,
                                  isUnit: isUnitFlag,
                                  isSubActivity: isSubFlag,
                                });
                                showToast("Image deleted successfully ✓");

                                // Remove from local cache so gallery updates instantly
                                if (modalImageContext.type === 'unit' && modalImageContext.unitId != null) {
                                  const uid = modalImageContext.unitId;
                                  setUnitImagesMetaMap(prev => {
                                    const items = prev[uid] || [];
                                    const sorted = [...items].sort((a, b) => {
                                      const idA = Number(a.wiuiu_id ?? a.id ?? a.unit_image_id ?? 0);
                                      const idB = Number(b.wiuiu_id ?? b.id ?? b.unit_image_id ?? 0);
                                      return idB - idA;
                                    });
                                    return {
                                      ...prev,
                                      [uid]: sorted.filter((_, i) => i !== currentImageIndex),
                                    };
                                  });
                                } else if (modalImageContext.type === 'sub' && modalImageContext.subId != null) {
                                  const sid = modalImageContext.subId;
                                  setSubImagesMetaMap(prev => {
                                    const items = prev[sid] || [];
                                    const sorted = [...items].sort((a, b) => {
                                      const idA = Number(a.wisiu_id ?? a.id ?? a.sub_image_id ?? a.subactivity_image_id ?? 0);
                                      const idB = Number(b.wisiu_id ?? b.id ?? b.sub_image_id ?? b.subactivity_image_id ?? 0);
                                      return idB - idA;
                                    });
                                    return {
                                      ...prev,
                                      [sid]: sorted.filter((_, i) => i !== currentImageIndex),
                                    };
                                  });
                                }

                                // Update the unitImages array shown in the modal
                                const newImages = unitImages.filter((_, i) => i !== currentImageIndex);
                                if (newImages.length === 0) {
                                  // No more images — close modal
                                  setShowImageModal(false);
                                  setUnitImages([]);
                                  setCurrentImageIndex(0);
                                  setModalImageContext(null);
                                } else {
                                  const newIndex = Math.min(currentImageIndex, newImages.length - 1);
                                  setUnitImages(newImages);
                                  setCurrentImageIndex(newIndex);
                                  setSelectedImage(newImages[newIndex]);
                                }

                                await refreshCurrentFeature();
                              } catch (err: any) {
                                showAlert("Error", err.message, "error");
                              }
                            },
                          },
                        ]
                      );
                    }}
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: 'rgba(239,68,68,0.85)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: 1.5,
                      borderColor: 'rgba(255,255,255,0.3)',
                    }}
                  >
                    <Trash2 size={18} color="#FFF" />
                  </TouchableOpacity>
                );
              })()}

              {/* Close button */}
              <TouchableOpacity
                onPress={() => {
                  setShowImageModal(false);
                  setUnitImages([]);
                  setCurrentImageIndex(0);
                  setModalImageContext(null);
                }}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <X size={20} color="#E2E8F0" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── IMAGE AREA ── */}
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            )}

            {/* Left tap zone */}
            {unitImages.length > 1 && currentImageIndex > 0 && (
              <TouchableOpacity
                onPress={() => {
                  const newIdx = currentImageIndex - 1;
                  setCurrentImageIndex(newIdx);
                  setSelectedImage(unitImages[newIdx]);
                }}
                style={{
                  position: 'absolute',
                  left: 0, top: 0, bottom: 0,
                  width: '30%',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  paddingLeft: 12,
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '300', marginTop: -2 }}>‹</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Right tap zone */}
            {unitImages.length > 1 && currentImageIndex < unitImages.length - 1 && (
              <TouchableOpacity
                onPress={() => {
                  const newIdx = currentImageIndex + 1;
                  setCurrentImageIndex(newIdx);
                  setSelectedImage(unitImages[newIdx]);
                }}
                style={{
                  position: 'absolute',
                  right: 0, top: 0, bottom: 0,
                  width: '30%',
                  justifyContent: 'center',
                  alignItems: 'flex-end',
                  paddingRight: 12,
                }}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: 'rgba(0,0,0,0.55)',
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  <Text style={{ color: '#FFF', fontSize: 22, fontWeight: '300', marginTop: -2 }}>›</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* ── IMAGE METADATA ── */}
          {selectedImage && imageDetailsRef.current[selectedImage] && (
            <View style={{
              position: 'absolute',
              bottom: (unitImages.length > 1) ? 120 : 40,
              left: 20,
              right: 20,
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: 15,
              borderRadius: 10,
              zIndex: 10,
            }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
                Uploaded By - {imageDetailsRef.current[selectedImage].uploadedBy}
              </Text>
              <Text style={{ color: '#FFF', fontSize: 12, marginTop: 4 }}>
                Uploaded At - {imageDetailsRef.current[selectedImage].uploadedAt}
              </Text>
            </View>
          )}

          {/* ── BOTTOM BAR ── */}
          {unitImages.length > 1 && (
            <View style={{
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 36,
              borderTopWidth: 1,
              borderTopColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              gap: 16,
            }}>
              {/* Dot indicators */}
              <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
                {unitImages.map((_, dotIdx) => (
                  <TouchableOpacity
                    key={dotIdx}
                    onPress={() => {
                      setCurrentImageIndex(dotIdx);
                      setSelectedImage(unitImages[dotIdx]);
                    }}
                  >
                    <View style={{
                      width: dotIdx === currentImageIndex ? 22 : 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: dotIdx === currentImageIndex
                        ? '#007AFF'
                        : 'rgba(255,255,255,0.25)',
                    }} />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Prev / Next buttons */}
              <View style={{ flexDirection: 'row', gap: 14, width: '100%' }}>
                <TouchableOpacity
                  disabled={currentImageIndex === 0}
                  onPress={() => {
                    const newIdx = currentImageIndex - 1;
                    setCurrentImageIndex(newIdx);
                    setSelectedImage(unitImages[newIdx]);
                  }}
                  style={{
                    flex: 1, alignItems: 'center', justifyContent: 'center',
                    paddingVertical: 13, borderRadius: 14,
                    backgroundColor: currentImageIndex === 0
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(255,255,255,0.12)',
                    borderWidth: 1,
                    borderColor: currentImageIndex === 0
                      ? 'rgba(255,255,255,0.05)'
                      : 'rgba(255,255,255,0.18)',
                  }}
                >
                  <Text style={{
                    color: currentImageIndex === 0 ? '#3A3A3C' : '#E2E8F0',
                    fontSize: 14, fontWeight: '700',
                  }}>‹ Previous</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={currentImageIndex === unitImages.length - 1}
                  onPress={() => {
                    const newIdx = currentImageIndex + 1;
                    setCurrentImageIndex(newIdx);
                    setSelectedImage(unitImages[newIdx]);
                  }}
                  style={{
                    flex: 1, alignItems: 'center', justifyContent: 'center',
                    paddingVertical: 13, borderRadius: 14,
                    backgroundColor: currentImageIndex === unitImages.length - 1
                      ? 'rgba(255,255,255,0.05)'
                      : '#007AFF',
                    borderWidth: 1,
                    borderColor: currentImageIndex === unitImages.length - 1
                      ? 'rgba(255,255,255,0.05)'
                      : '#007AFF',
                  }}
                >
                  <Text style={{
                    color: currentImageIndex === unitImages.length - 1 ? '#3A3A3C' : '#FFF',
                    fontSize: 14, fontWeight: '700',
                  }}>Next ›</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>
      </Modal>
      {/* Sub-Activity History Modal */}
      <Modal visible={showSubHistory} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.searchModal, { backgroundColor: theme.cardColor, maxHeight: '80%', width: '90%' }]}>

            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: borderColor }}>
              <View>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Activity History</Text>
                <Text style={{ color: subTextColor, fontSize: 12 }}>Detailed log of previous remarks</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSubHistory(false)}
                style={{ padding: 8, backgroundColor: isDark ? '#2C2C2E' : '#F1F5F9', borderRadius: 20 }}
              >
                <X size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Remark List */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {subHistoryData.length > 0 ? (
                subHistoryData.map((h, i) => (
                  <RemarkCard
                    key={`sub-history-${i}`}
                    // Map your API fields to the RemarkCard props
                    remark={{
                      id: String(i),
                      user: h.created_by || 'Unknown User',
                      text: h.remark || '', // This will render HTML if RemarkCard supports it
                      date: h.created_at,
                    }}
                    isDark={isDark}
                    theme={theme}
                    subTextColor={subTextColor}
                    borderColor={borderColor}
                  />
                ))
              ) : (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <MessageSquare size={48} color={subTextColor} strokeWidth={1} />
                  <Text style={{ textAlign: 'center', color: subTextColor, marginTop: 12, fontSize: 14 }}>
                    No history entries found for this activity.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Close Button at bottom for better UX */}
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelButton, { width: '100%', marginTop: 10 }]}
              onPress={() => setShowSubHistory(false)}
            >
              <Text style={styles.cancelButtonText}>Close History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      <Modal
        visible={isAddMaterialModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddMaterialModalOpen(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.materialModalContent}>
            {/* Header */}
            <View style={styles.materialModalHeader}>
              <View>
                <Text style={styles.materialModalTitle}>Add Material Usage Entry</Text>
                {/* <Text style={styles.materialModalSubTitle}>For: Test Android 2 (Unit: New Unit 10)</Text> */}
              </View>
              <TouchableOpacity onPress={() => setIsAddMaterialModalOpen(false)}>
                <X color="#334155" size={24} />
              </TouchableOpacity>
            </View>

            {/* Form Fields */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Excavation (Cum)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter excavation quantity"
                placeholderTextColor="#8E8E93"

                // //keyboardType="numeric"
                value={materialFormData.excavation}
                onChangeText={(v) => setMaterialFormData({ ...materialFormData, excavation: v })}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Steel (Ton)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter steel quantity"
                placeholderTextColor="#8E8E93"

                //keyboardType="numeric"
                value={materialFormData.steel}
                onChangeText={(v) => setMaterialFormData({ ...materialFormData, steel: v })}
              />
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Concrete (Cum)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Enter concrete quantity"
                placeholderTextColor="#8E8E93"

                //keyboardType="numeric"
                value={materialFormData.concrete}
                onChangeText={(v) => setMaterialFormData({ ...materialFormData, concrete: v })}
              />
            </View>

            {/* Footer Buttons */}
            <View style={styles.materialModalFooter}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={handleSaveMaterialUsage}
              >
                <Plus size={18} color="#FFF" />
                <Text style={styles.saveBtnText}>Save Entry</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setIsAddMaterialModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={isSaving} transparent animationType="fade">
        <View style={styles.loaderOverlay}>
          <View style={styles.loaderContent}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loaderMessage}>Saving Details...</Text>
            <Text style={styles.loaderSubMessage}>Please wait while we update the server</Text>
          </View>
        </View>
      </Modal>
      <Modal visible={isFetching} transparent animationType="fade">
        <View style={styles.loaderOverlay}>
          <View style={styles.loaderContent}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loaderMessage}>Fetching Details...</Text>
            <Text style={styles.loaderSubMessage}>Please wait while we Fetching the feature</Text>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!cameraIframeUrl}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setCameraIframeUrl(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Header */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 8,
            paddingBottom: 12,
            paddingHorizontal: 16,
            backgroundColor: '#1C1C1E',
            borderBottomWidth: 1,
            borderBottomColor: '#3A3A3C',
          }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '700' }}>Camera Feed</Text>
              <Text style={{ color: '#94A3B8', fontSize: 10 }} numberOfLines={1}>{cameraIframeUrl}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => cameraIframeUrl && Linking.openURL(cameraIframeUrl)}
                style={{
                  backgroundColor: '#F59E0B',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <ExternalLink size={14} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>Browser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCameraIframeUrl(null)}
                style={{
                  backgroundColor: '#3A3A3C',
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <X size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* WebView */}
          {cameraIframeUrl && (
            <WebView
              source={{ uri: cameraIframeUrl }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              startInLoadingState
              renderLoading={() => (
                <View style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: '#000',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <ActivityIndicator size="large" color="#F59E0B" />
                  <Text style={{ color: '#94A3B8', marginTop: 12, fontSize: 13 }}>Loading camera feed...</Text>
                </View>
              )}
              onError={() => {
                showAlert(
                  'Load Failed',
                  'The camera feed could not be loaded. Try opening it in your browser instead.',
                  'error',
                  [
                    { text: 'Open in Browser', onPress: () => { setCameraIframeUrl(null); cameraIframeUrl && Linking.openURL(cameraIframeUrl); } },
                    { text: 'Close', onPress: () => setCameraIframeUrl(null) }
                  ]
                );
              }}
            />
          )}
        </View>
      </Modal>
      <Modal visible={isVerifying} transparent animationType="fade">
        <View style={styles.loaderOverlay}>
          <View style={styles.loaderContent}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loaderMessage}>Verifying Feature...</Text>
            <Text style={styles.loaderSubMessage}>Please wait while we update verification status</Text>
          </View>
        </View>
      </Modal>
      <MapTypeModal
        visible={mapTypeModalVisible}
        onClose={() => setMapTypeModalVisible(false)}
        currentMapType={mapType}
        isDark={isDark}
        theme={theme}
        onSelect={(type) => {
          setMapType(type);
          webviewRef.current?.injectJavaScript(`window.setMapBaseLayer('${type}');`);
        }}
      />
      {/* Toast Notification */}
      {toast && (
        <View style={[
          {
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 14,
            paddingHorizontal: 18,
            borderRadius: 14,
            zIndex: 99999,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
          },
          toast.type === 'success'
            ? { backgroundColor: '#10B981' }
            : { backgroundColor: '#EF4444' }
        ]}>
          {toast.type === 'success'
            ? <Check size={20} color="#FFF" />
            : <X size={20} color="#FFF" />
          }
          <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700', flex: 1 }}>
            {toast.message}
          </Text>
        </View>
      )}
      <AlertComponent />

    </View >
  );
}

/**
 * Wrapper that forces a full remount of the entire dashboard screen
 * whenever the selected project changes. This guarantees all state,
 * refs, effects, and the WebView (iOS WKWebView) are reset completely.
 */
export default function DashboardMapView() {
  const { selectedProject } = useAuth();
  return <DashboardMapViewInner key={selectedProject?.id ?? 'no-project'} />;
}
