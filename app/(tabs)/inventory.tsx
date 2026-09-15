import React, { useState, useRef, useMemo, useEffect } from "react";
import CustomDatePicker from "../Inventory/Customdatepicker";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  StatusBar,
  PixelRatio,
  ActivityIndicator,
  Keyboard
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useAlert } from "@/hooks/useAlert";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Package,
  Plus,
  TrendingUp,
  Edit2,
  Trash2,
  Save,
  X,
  AlertCircle,
  Check,
  Download,
  Search,
} from "lucide-react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useTheme } from "../../contexts/ThemeContext";
import {
  fetchMaterialDetails,
  addMaterial,
  fetchInwardDetails,
  fetchUsageDetails,
  addInwardStock,
  addUsageStock,
  fetchMaterialDropdown,
  deleteInwardStock,
  deleteUsageStock,
  updateStockTransaction,
  getExportLink,
  fetchProjectMaterial,
  updateInwardQuantity,
  fetchInventoryDetails,
  InventoryDetails,
} from "@/api/api_inventory";
import { handleExportInventory } from "../utils/exportInventoryExcel";
import { useAuth } from "@/contexts/AuthContext";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform, Alert } from "react-native";
import * as Linking from "expo-linking";
import URLS from "@/api/base_url";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Material {
  id: string;
  material_name: string;
  unit: string;
  threshold?: number;
  tender_quantity?: number;
}

interface InventoryItem {
  wimpr_id: number;
  material_id: string;
  material_name: string;
  unit: string;
  total_qty: number;
  total_usage: number;
  today_usage: number;
  remaining: number;
  wastage: number;
  today_wastage: number;
  tender_quantity?: number;
}

interface Transaction {
  id: string;
  delete_id: number;
  material_id: string;
  material_name: string;
  quantity: number;
  wastage?: number;
  transaction_type: "inward" | "usage" | "wastage";
  date: string;
  comment: string;
  created_at: string;
  tender_quantity?: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function InventoryMobile() {
  const { showAlert, AlertComponent } = useAlert();
  const { theme, isDark } = useTheme();
  const [isExporting, setIsExporting] = useState(false);
  const { user, selectedProject, hasAccess, hasWriteAccess } = useAuth();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isFocused = useIsFocused();

  // ── Destructure all theme tokens so every style reference is clean ─────────
  const {
    inputBg,
    inputBorder,
    subTextColor,
    dangerColor,
    primaryColor,
    modalOverlay: overlayColor,
    toastBg,
    tabActiveBorder,
    tabActiveText,
    statsLabelColor,
    iconCircleBg,
    cardShadow,
    searchBoxBg,
    searchBoxBorder,
    searchBoxShadow,
    suggestionBg,
    loaderDotColor,
    transCardBg,
    transEditBg,
    commentBorderTop,
    dateBadgeBg,
    emptyIconColor,
    cancelBtnBg,
    cancelBtnBorder,
    cancelBtnText,
    headingPillBg,
    sheetIndicator,
  } = theme;

  const borderColor = theme.borderColor;

  // ── State ─────────────────────────────────────────────────────────────────
  const [materials, setMaterials] = useState<Material[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const [allMaterials, setAllMaterials] = useState<InventoryItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMaterialSelectorModal, setShowMaterialSelectorModal] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [showInwardDatePicker, setShowInwardDatePicker] = useState(false);
  const [showUsageDatePickerCustom, setShowUsageDatePickerCustom] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: "", unit: "", tender_quantity: "" });
  const [materialErrors, setMaterialErrors] = useState<{ name?: string; unit?: string; tender_quantity?: string }>({});

  const [newInward, setNewInward] = useState({ material_id: "", quantity: "", comment: "" });
  const [selectedMaterialName, setSelectedMaterialName] = useState("");
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);

  const [newUsage, setNewUsage] = useState({
    material_id: "",
    usage_quantity: "",
    wastage_quantity: "",
    comment: "",
  });
  const [selectedMaterialName2, setSelectedMaterialName2] = useState("");
  const [showMaterialDropdown2, setShowMaterialDropdown2] = useState(false);

  const [editing, setEditing] = useState<string | null>(null);
  const [editedTrans, setEditedTrans] = useState<any>({});

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [inwardDate, setInwardDate] = useState<Date>(new Date());
  const [usageDate, setUsageDate] = useState<Date>(new Date());
  const [minUsageDate, setMinUsageDate] = useState(undefined);

  const [inventorySearch, setInventorySearch] = useState("");

  const [toast, setToast] = useState({ visible: false, message: "" });

  const bottomSheetRef = useRef<BottomSheet>(null);
  const addMaterialSheetRef = useRef<BottomSheet>(null);
  const addInwardSheetRef = useRef<BottomSheet>(null);
  const addUsageSheetRef = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => ["50%", "85%"], []);
  const formSnapPoints = useMemo(() => ["60%", "95%"], []);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [activeTab, setActiveTab] = useState<"inward" | "outward">("inward");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const selectedMaterial = allMaterials.find((i) => i.material_id === selectedMaterialId);

  const [inwardHistory, setInwardHistory] = useState<Transaction[]>([]);
  const [outwardHistory, setOutwardHistory] = useState<Transaction[]>([]);

  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingMaterialDropdown, setLoadingMaterialDropdown] = useState(false);
  const [displayedMaterialsCount, setDisplayedMaterialsCount] = useState(10);
  const [displayedInwardMaterialsCount, setDisplayedInwardMaterialsCount] = useState(10);
  const [displayedUsageMaterialsCount, setDisplayedUsageMaterialsCount] = useState(10);

  const [materialSelectedFromDropdown, setMaterialSelectedFromDropdown] = useState(false);
  const [selectedExistingMaterialId, setSelectedExistingMaterialId] = useState<string | null>(null);

  const [inwardMaterialId, setInwardMaterialId] = useState("");
  const [inwardQuantity, setInwardQuantity] = useState("");
  const [inwardThreshold, setInwardThreshold] = useState("0");
  const [inwardUnit, setInwardUnit] = useState("—");
  const [showInwardConfirm, setShowInwardConfirm] = useState(false);
  const [inwardConfirmData, setInwardConfirmData] = useState({ newTotal: 0, tenderQuantity: 0 });
  const [showEditInwardConfirm, setShowEditInwardConfirm] = useState(false);
  const [editInwardConfirmData, setEditInwardConfirmData] = useState<{ newTotal: number, tenderQuantity: number, editedTrans: any, currentThreshold: number } | null>(null);
  const [inwardComment, setInwardComment] = useState("");
  const [stockMaterialId, setStockMaterialId] = useState("");

  const [inwardErrors, setInwardErrors] = useState<{
    material?: string;
    quantity?: string;
    date?: string;
    threshold?: string;
  }>({});
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialSearch2, setMaterialSearch2] = useState("");

  const [showUsageMaterialSelectorModal, setShowUsageMaterialSelectorModal] = useState(false);
  const [usageMaterialSearch, setUsageMaterialSearch] = useState("");

  const [usageErrors, setUsageErrors] = useState<{
    material?: string;
    usage?: string;
    wastage?: string;
    date?: string;
  }>({});
  const [showMaterialSuggestions, setShowMaterialSuggestions] = useState(false);
  const [projectMaterials, setProjectMaterials] = useState<Material[]>([]);
  const [inwardMaterialSearch, setInwardMaterialSearch] = useState("");

  // ── Filtered / paginated lists ────────────────────────────────────────────
  const filteredExistingMaterials = materials.filter((m) =>
    newMaterial.name.length > 0
      ? m.material_name.toLowerCase().includes(newMaterial.name.toLowerCase())
      : true
  );
  const displayedMaterials = filteredExistingMaterials.slice(0, displayedMaterialsCount);
  const hasMoreMaterials = displayedMaterialsCount < filteredExistingMaterials.length;
  const loadMoreMaterials = () => hasMoreMaterials && setDisplayedMaterialsCount((p) => p + 10);

  const filteredUsageMaterials = projectMaterials.filter((m) =>
    usageMaterialSearch.length > 0
      ? m.material_name.toLowerCase().includes(usageMaterialSearch.toLowerCase())
      : true
  );
  const displayedUsageMaterials = filteredUsageMaterials.slice(0, displayedUsageMaterialsCount);
  const hasMoreUsageMaterials = displayedUsageMaterialsCount < filteredUsageMaterials.length;
  const loadMoreUsageMaterials = () =>
    hasMoreUsageMaterials && setDisplayedUsageMaterialsCount((p) => p + 10);

  const filteredProjectMaterials = projectMaterials.filter((m) =>
    inwardMaterialSearch.length > 0
      ? m.material_name.toLowerCase().includes(inwardMaterialSearch.toLowerCase())
      : true
  );
  const displayedInwardMaterials = filteredProjectMaterials.slice(0, displayedInwardMaterialsCount);
  const hasMoreInwardMaterials = displayedInwardMaterialsCount < filteredProjectMaterials.length;
  const loadMoreInwardMaterials = () =>
    hasMoreInwardMaterials && setDisplayedInwardMaterialsCount((p) => p + 10);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setDisplayedUsageMaterialsCount(10);
  }, [usageMaterialSearch]);

  useEffect(() => {
    setDisplayedInwardMaterialsCount(10);
  }, [inwardMaterialSearch]);

  useEffect(() => {
    setDisplayedMaterialsCount(10);
  }, [newMaterial.name]);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 500);
    return () => clearTimeout(t);
  }, [inventorySearch]);

  useEffect(() => {
    setPage(1);
  }, [inventorySearch]);

  useEffect(() => {
    if (selectedProject?.id) {
      setPage(1);
      loadMaterials();
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject?.id) {
      setPage(1);
      loadProjectMaterials();
    }
  }, [selectedProject]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setIsKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setIsKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!isFocused) {
      closeSheetIfOpen();
    }
  }, [isFocused]);

  useEffect(() => {
    if (selectedProject?.id) loadMaterialDropdown();
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject?.id) {
      const filtered = inventorySearch.trim()
        ? allMaterials.filter((item) =>
          item.material_name.toLowerCase().includes(inventorySearch.toLowerCase().trim())
        )
        : allMaterials;
      const calcPages = Math.ceil(filtered.length / 10) || 1;
      setTotalPages(calcPages);
      setInventory(filtered.slice((page - 1) * 10, page * 10));
      setHasNextPage(page < calcPages);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [page, allMaterials, inventorySearch]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  // ── Helpers ───────────────────────────────────────────────────────────────
  const closeSheetIfOpen = () => {
    bottomSheetRef.current?.close();
    addMaterialSheetRef.current?.close();
    addInwardSheetRef.current?.close();
    addUsageSheetRef.current?.close();
  };

  const showSuccess = (msg: string) => {
    setToast({ visible: true, message: msg });
    setTimeout(() => setToast({ visible: false, message: "" }), 2500);
  };

  const toLocalISOString = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes()) +
      ":" +
      pad(date.getSeconds())
    );
  };

  const isDuplicateMaterial = (name: string) =>
    materials.some((m) => m.material_name.trim().toLowerCase() === name.trim().toLowerCase());

  // ── API Calls ─────────────────────────────────────────────────────────────
  const loadMaterials = async () => {
    try {
      setLoading(true);
      const res = await fetchMaterialDetails({
        project_id: Number(selectedProject.id),
        page: 1,
        limit: 10,
        search: inventorySearch,
      });
      const list = Array.isArray(res?.records) ? res.records : [];
      const mapped: InventoryItem[] = list.map((item: any) => ({
        wimpr_id: Number(item.wimpr_id),
        material_id: String(item.material_id ?? item.id ?? ""),
        material_name: item.material_name ?? "Unknown",
        unit: item.unit ?? "-",
        total_qty: Number(item.total_qty) || 0,
        total_usage: Number(item.total_usage) || 0,
        today_usage: Number(item.today_usage) || 0,
        remaining: Number(item.remaining) || 0,
        wastage: Number(item.wastage) || 0,
        today_wastage: Number(item.today_wastage) || 0,
        tender_quantity: Number(item.tender_quantity) || 0,
      }));
      setAllMaterials(mapped);
      const calcPages = Math.ceil(mapped.length / 10);
      setTotalPages(calcPages);
      setInventory(mapped.slice((page - 1) * 10, page * 10));
      setHasNextPage(page < calcPages);
    } catch (error) {
      console.error("❌ Failed to load materials", error);
      setAllMaterials([]);
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectMaterials = async () => {
    try {
      const data = await fetchProjectMaterial();
      const mapped: Material[] = (Array.isArray(data) ? data : []).map((m: any) => ({
        id: String(m.material_id),
        material_name: m.material_name,
        unit: m.unit || "-",
        threshold: m.threshold,
        tender_quantity: m.tender_quantity,
      }));
      setProjectMaterials(mapped);
    } catch (error) {
      console.error("Failed to load project materials:", error);
      setProjectMaterials([]);
    }
  };

  const loadMaterialDropdown = async () => {
    if (!selectedProject?.id) return;
    try {
      setLoadingMaterialDropdown(true);
      const res = await fetchMaterialDropdown();
      const data = Array.isArray(res) ? res : res?.records || [];
      const mapped: Material[] = data.map((m: any) => ({
        id: String(m.material_id),
        material_name: m.material_name,
        unit: m.unit || "-",
        threshold: m.threshold,
        tender_quantity: m.tender_quantity,
      }));
      setMaterials(mapped);
    } catch (error) {
      console.error("❌ Failed to load material dropdown", error);
      setMaterials([]);
    } finally {
      setLoadingMaterialDropdown(false);
    }
  };

  const handleOpenMaterial = async (wimpr_id: number) => {
    try {
      const selectedItem = allMaterials.find((i) => i.wimpr_id === wimpr_id);
      setSelectedMaterialId(selectedItem?.material_id || "");
      setActiveTab("inward");
      setLoadingDetails(true);
      closeSheetIfOpen();
      bottomSheetRef.current?.snapToIndex(0);
      const res: InventoryDetails = await fetchInventoryDetails(wimpr_id);
      const transformData = (list: any[], type: "inward" | "usage"): Transaction[] =>
        list.map((item, index) => ({
          ...item,
          quantity: type === "inward" ? Number(item.quantity) : Number(item.used_quantity),
          wastage: type === "usage" ? Number(item.waste_quantity || 0) : 0,
          comment: item.comment || "-",
          transaction_type: type,
          date: item.date,
          id: `${type}-${item.id}`,
          delete_id: item.id,
          tender_quantity: Number(res?.tender_quantity || 0),
        }));
      setInwardHistory(transformData(res.inward, "inward"));
      setOutwardHistory(transformData(res.outward, "usage"));
    } catch (error) {
      console.error("❌ Failed to load inventory details", error);
      setInwardHistory([]);
      setOutwardHistory([]);
      showAlert("Error", "Could not fetch stock history", "error");
    } finally {
      setLoadingDetails(false);
    }
  };
  const loadMinUsageDateForMaterial = async (materialId: string) => {
    try {
      const item = allMaterials.find((i) => String(i.material_id) === String(materialId));
      if (!item) {
        setMinUsageDate(undefined);
        return;
      }
      const res: InventoryDetails = await fetchInventoryDetails(item.wimpr_id);
      const inwardList: any[] = Array.isArray(res?.inward) ? res.inward : [];
      if (inwardList.length === 0) {
        setMinUsageDate(undefined);
        return;
      }
      // Find the earliest date among all inward entries
      const earliest = inwardList
        .map((entry) => new Date(entry.date))
        .reduce((min, d) => (d < min ? d : min), new Date(inwardList[0].date));
      earliest.setHours(0, 0, 0, 0);
      setMinUsageDate(earliest);
    } catch {
      setMinUsageDate(undefined);
    }
  };
  const handleDeleteTransaction = async () => {
    if (!deleteId || isNaN(Number(deleteId)) || !user?.id) return;
    try {
      setLoading(true);
      if (activeTab === "inward") {
        const totalInwardAfterDelete = inwardHistory
          .filter((t) => t.delete_id !== Number(deleteId))
          .reduce((sum, t) => sum + t.quantity, 0);
        const totalOutward = outwardHistory.reduce(
          (sum, t) => sum + t.quantity + (t.wastage ?? 0),
          0
        );
        if (totalOutward > totalInwardAfterDelete) {
          showAlert(
            "Cannot Delete",
            "Cannot delete inward entry due to existing outward stock usage.",
            "error"
          );
          setShowDeleteModal(false);
          setDeleteId(null);
          setLoading(false);
          return;
        }
        await deleteInwardStock({ id: Number(deleteId), is_enable: false, updated_by: user.id });
        const updatedInward = inwardHistory.filter((t) => t.delete_id !== Number(deleteId));
        setInwardHistory(updatedInward);
        if (updatedInward.length === 0 && outwardHistory.length === 0)
          bottomSheetRef.current?.close();
        showSuccess("Inward entry deleted successfully");
      } else {
        await deleteUsageStock({ id: Number(deleteId), is_enable: false, updated_by: user.id });
        const updatedOutward = outwardHistory.filter((t) => t.delete_id !== Number(deleteId));
        setOutwardHistory(updatedOutward);
        if (inwardHistory.length === 0 && updatedOutward.length === 0)
          bottomSheetRef.current?.close();
        showSuccess("Outward entry deleted successfully");
      }
      setShowDeleteModal(false);
      setDeleteId(null);
      loadMaterials();
    } catch (error) {
      console.error("❌ Delete failed", error);
      showAlert("Error", "Failed to delete transaction. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMaterial = async () => {
    const materialName = newMaterial.name.trim();
    const unit = newMaterial.unit.trim();
    const tq = Number(newMaterial.tender_quantity);
    const errors: any = {};
    if (!materialName) {
      errors.name = "Material name is required";
    }
    if (!unit) {
      errors.unit = "Unit is required";
    }
    if (!newMaterial.tender_quantity.trim() || isNaN(tq) || tq <= 0) {
      errors.tender_quantity = "Valid tender quantity is required";
    }
    if (Object.keys(errors).length > 0) {
      setMaterialErrors(errors);
      const firstError = errors.name || errors.unit || errors.tender_quantity;
      showAlert("Invalid Input", firstError, "warning");
      return;
    }
    const existingMaterial = materials.find(
      (m) => m.material_name.toLowerCase() === materialName.toLowerCase()
    );
    const targetMaterialId = existingMaterial ? Number(existingMaterial.id) : 0;
    try {
      setLoading(true);
      await addMaterial({ material_id: targetMaterialId, material_name: materialName, unit, tender_quantity: tq });
      showSuccess(
        targetMaterialId > 0
          ? `Material "${materialName}" linked to project`
          : `Material "${materialName}" added`
      );
      setNewMaterial({ name: "", unit: "", tender_quantity: "" });
      setMaterialErrors({});
      addMaterialSheetRef.current?.close();
      setMaterialSelectedFromDropdown(false);
      setSelectedExistingMaterialId(null);
      await Promise.all([loadMaterials(), loadMaterialDropdown(), loadProjectMaterials()]);
    } catch (error: any) {
      console.error("❌ Add material failed", error);
      showAlert("Submission Failed", "The material could not be added.", "error");
    } finally {
      setLoading(false);
    }
  };

  const processAddInward = async (qty: number) => {
    try {
      setLoading(true);
      await addInwardStock({
        wimsd_id: 0,
        material_id: Number(inwardMaterialId),
        quantity: qty,
        date: toLocalISOString(inwardDate),
        comment: inwardComment || "",
        threshold: Number(inwardThreshold) || 0,
      });
      showSuccess("Inward stock added");
      addInwardSheetRef.current?.close();
      setInwardMaterialId("");
      setInwardQuantity("");
      setInwardComment("");
      setInwardThreshold("0");
      setInwardUnit("—");
      setInwardMaterialSearch("");
      setInwardDate(new Date());
      setInwardErrors({});
      setLoading(true);
      setPage(1);
      loadMaterials();
    } catch (e: any) {
      showAlert("Error", e.message || "Failed to add inward", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddInward = async () => {
    const errors: any = {};
    if (!inwardMaterialId) {
      errors.material = "Material is required";
      setInwardErrors(errors);
      return;
    }
    const qty = Number(inwardQuantity);
    if (!inwardQuantity || isNaN(qty) || qty <= 0) errors.quantity = "Valid quantity required";
    const threshold = Number(inwardThreshold);
    if (inwardThreshold === "" || isNaN(threshold) || threshold < 0)
      errors.threshold = "Valid threshold required";
    if (!inwardDate) errors.date = "Date is required";
    if (Object.keys(errors).length > 0) {
      setInwardErrors(errors);
      const firstError = errors.material || errors.quantity || errors.threshold || errors.date;
      showAlert("Invalid Input", firstError, "warning");
      return;
    }

    setLoading(true);
    let tenderQuantity = 0;
    let currentTotal = 0;

    const invItem = allMaterials.find(i => String(i.material_id) === inwardMaterialId);

    if (invItem) {
      try {
        const res: InventoryDetails = await fetchInventoryDetails(invItem.wimpr_id);
        tenderQuantity = Number(res?.tender_quantity) || 0;
        const inwardList: any[] = Array.isArray(res?.inward) ? res.inward : [];
        currentTotal = inwardList.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      } catch (e) {
        console.error("Failed to fetch accurate tender_quantity", e);
        currentTotal = invItem.total_qty;
      }
    } else {
      const matDetails = projectMaterials.find(m => m.id === inwardMaterialId) || materials.find(m => m.id === inwardMaterialId);
      tenderQuantity = matDetails?.tender_quantity || matDetails?.threshold || 0;
    }

    setLoading(false);

    const newTotal = currentTotal + qty;

    if (tenderQuantity > 0 && newTotal > tenderQuantity) {
      setInwardConfirmData({ newTotal, tenderQuantity });
      setShowInwardConfirm(true);
      return;
    }

    await processAddInward(qty);
  };

  const handleAddUsage = async () => {
    const errors: any = {};
    if (!stockMaterialId) errors.material = "Material is required";
    const usageQty = Number(newUsage.usage_quantity || 0);
    const wasteQty = Number(newUsage.wastage_quantity || 0);
    if (usageQty < 0) errors.usage = "Usage cannot be negative";
    if (wasteQty < 0) errors.wastage = "Wastage cannot be negative";
    if (usageQty === 0 && wasteQty === 0) {
      errors.usage = "Enter usage or wastage";
      errors.wastage = "Enter usage or wastage";
    }
    const selectedItem = allMaterials.find(
      (i) => String(i.material_id) === String(stockMaterialId)
    );
    if (selectedItem) {
      const availableQty = Number(selectedItem.remaining ?? 0);
      const totalOut = usageQty + wasteQty;
      if (usageQty > availableQty) {
        errors.usage = `Usage can not be more than stock (available: ${availableQty})`;
      }
      if (wasteQty > availableQty) {
        errors.wastage = `Wastage can not be more than stock (available: ${availableQty})`;
      }
      if (totalOut > availableQty && !errors.usage && !errors.wastage) {
        errors.usage = `Combined limit exceeded (available: ${availableQty})`;
        errors.wastage = `Combined limit exceeded (available: ${availableQty})`;
      }
    } else if (stockMaterialId) {
      errors.usage = "No stock available for this material";
    }
    if (!usageDate) errors.date = "Date is required";
    if (Object.keys(errors).length > 0) {
      setUsageErrors(errors);
      const firstError = errors.usage || errors.wastage || errors.material || errors.date;
      showAlert("Invalid Input", firstError, "warning");
      return;
    }
    try {
      setLoading(true);
      await addUsageStock({
        material_id: Number(stockMaterialId),
        project_id: Number(selectedProject.id),
        used_quantity: usageQty,
        waste_quantity: wasteQty,
        date: toLocalISOString(usageDate),
        comment: newUsage.comment ?? "",
        created_by: user.id,
      });
      showSuccess("Usage recorded");
      setStockMaterialId("");
      setUsageMaterialSearch("");
      addUsageSheetRef.current?.close();
      setMinUsageDate(undefined);
      setNewUsage({ material_id: "", usage_quantity: "", wastage_quantity: "", comment: "" });
      setMaterialSearch2("");
      setShowMaterialDropdown2(false);
      setUsageDate(new Date());
      setUsageErrors({});
      setLoading(true);
      setPage(1);
      loadMaterials();
    } catch (e) {
      alert("Failed to add usage");
    } finally {
      setLoading(false);
    }
  };

  const processSaveEditInward = async (editedTrans: Transaction, currentThreshold: number) => {
    try {
      setLoading(true);
      await updateInwardQuantity(
        editedTrans.delete_id,
        Number(editedTrans.quantity),
        currentThreshold,
        editedTrans.tender_quantity
      );
      setInwardHistory((prev) =>
        prev.map((t) =>
          t.id === editedTrans.id ? { ...t, quantity: Number(editedTrans.quantity), tender_quantity: editedTrans.tender_quantity } : t
        )
      );
      showSuccess("Inward updated");
      setEditing(null);
      setEditedTrans({});
      loadMaterials();
      const currentItem = allMaterials.find((i) => i.material_id === selectedMaterialId);
      if (currentItem) {
        const currentTab = activeTab;
        await handleOpenMaterial(currentItem.wimpr_id);
        setActiveTab(currentTab);
      }
    } catch (err: any) {
      console.error("❌ Update failed", err);
      showAlert("Error", "Failed to update transaction");
    } finally {
      setLoading(false);
      setShowEditInwardConfirm(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing || !user?.id || !selectedProject?.id || !selectedMaterialId) return;
    const newQty = Number(editedTrans.quantity);
    const newWastage = Number(editedTrans.wastage || 0);
    if (activeTab === "inward") {
      if (isNaN(newQty) || newQty <= 0) {
        showAlert(
          "Invalid Input",
          "Quantity must be a positive number greater than zero.",
          "warning"
        );
        return;
      }
    } else {
      if (isNaN(newQty) || newQty < 0) {
        showAlert("Invalid Input", "Usage quantity cannot be negative.", "warning");
        return;
      }
      if (isNaN(newWastage) || newWastage < 0) {
        showAlert("Invalid Input", "Wastage cannot be a negative number.", "warning");
        return;
      }
      if (newQty === 0 && newWastage === 0) {
        showAlert(
          "Invalid Input",
          "Usage and Wastage cannot both be 0. Enter at least one value.",
          "warning"
        );
        return;
      }
    }
    try {
      setLoading(true);
      if (activeTab === "inward") {
        const totalInward = inwardHistory.reduce((sum, t) => {
          const qty = t.id === editing ? Number(editedTrans.quantity) : Number(t.quantity);
          return sum + qty;
        }, 0);
        const totalOutward = outwardHistory.reduce(
          (sum, t) => sum + Number(t.quantity) + Number(t.wastage ?? 0),
          0
        );
        if (totalInward < totalOutward) {
          const otherInwardSum = inwardHistory.reduce(
            (sum, t) => (t.id !== editing ? sum + Number(t.quantity) : sum),
            0
          );
          const minAllowed = Math.max(0, totalOutward - otherInwardSum);
          showAlert(
            "Cannot Update",
            `Inward quantity cannot be less than used or wastage quantity.\n\nMinimum allowed: ${minAllowed.toFixed(2)}\nTotal outward: ${totalOutward.toFixed(2)}`,
            "info"
          );
          setLoading(false);
          return;
        }
        const currentThreshold =
          projectMaterials.find((m) => m.id === selectedMaterialId)?.threshold ?? 0;

        const tenderQty = editedTrans.tender_quantity || 0;
        if (tenderQty > 0 && totalInward > tenderQty) {
          setEditInwardConfirmData({
            newTotal: totalInward,
            tenderQuantity: tenderQty,
            editedTrans: editedTrans as Transaction,
            currentThreshold,
          });
          setShowEditInwardConfirm(true);
          return;
        }

        await processSaveEditInward(editedTrans as Transaction, currentThreshold);
        return;
      } else {
        const totalInward = inwardHistory.reduce((sum, t) => sum + Number(t.quantity), 0);
        const totalOutward = outwardHistory.reduce((sum, t) => {
          const used = t.id === editing ? Number(editedTrans.quantity) : Number(t.quantity);
          const waste =
            t.id === editing ? Number(editedTrans.wastage ?? 0) : Number(t.wastage ?? 0);
          return sum + used + waste;
        }, 0);
        if (totalInward < totalOutward) {
          const otherOutwardSum = outwardHistory.reduce(
            (sum, t) =>
              t.id !== editing ? sum + Number(t.quantity) + Number(t.wastage ?? 0) : sum,
            0
          );
          const maxAllowed = Math.max(0, totalInward - otherOutwardSum);
          showAlert(
            "Cannot Update",
            `Outward quantity cannot be more than inward stock.\n\nMaximum allowed: ${maxAllowed.toFixed(2)}\nTotal inward: ${totalInward.toFixed(2)}`
          );
          setLoading(false);
          return;
        }
        await deleteUsageStock({
          id: editedTrans.delete_id,
          is_enable: false,
          updated_by: user.id,
        });
        await addUsageStock({
          material_id: Number(selectedMaterialId),
          project_id: Number(selectedProject.id),
          used_quantity: Number(editedTrans.quantity),
          waste_quantity: Number(editedTrans.wastage ?? 0),
          date: editedTrans.date,
          comment: editedTrans.comment ?? "",
          created_by: user.id,
        });
        showSuccess("Usage updated");
      }
      setEditing(null);
      setEditedTrans({});
      loadMaterials();
      const currentItem = allMaterials.find((i) => i.material_id === selectedMaterialId);
      if (currentItem) {
        const currentTab = activeTab;
        await handleOpenMaterial(currentItem.wimpr_id);
        setActiveTab(currentTab);
      }
    } catch (err) {
      console.error("❌ Update failed", err);
      showAlert("Error", "Failed to update transaction");
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <View style={styles.headerInfoSection}>
        <Text style={[styles.mainTitle, { color: theme.text }]}>Inventory Management</Text>
        <Text style={[styles.subTitle, { color: subTextColor }]}>
          Track materials, stock, and usage
        </Text>
      </View>

      {/* ── Action Buttons ─────────────────────────────────────────────────── */}
      <View style={styles.actionsRow}>
        {hasWriteAccess("INVENTORY_ADD_MATERIAL") && (
          <TouchableOpacity
            style={styles.actionButtonWrapper}
            activeOpacity={0.85}
            onPress={() => {
              closeSheetIfOpen();
              setIsSheetOpen(true);
              addMaterialSheetRef.current?.snapToIndex(1);
            }}
          >
            <LinearGradient
              colors={["#60A5FA", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.newMaterialButton}
            >
              <Plus size={normalize(16)} color="#FFFFFF" />
              <Text style={styles.newMaterialText} numberOfLines={1} adjustsFontSizeToFit>
                New Material
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {hasWriteAccess("INVENTORY_ADD_INWARD_STOCK") && (
          <TouchableOpacity
            style={styles.actionButtonWrapper}
            activeOpacity={0.85}
            onPress={() => {
              closeSheetIfOpen();
              setIsSheetOpen(true);
              addInwardSheetRef.current?.snapToIndex(1);
            }}
          >
            <LinearGradient
              colors={["#60A5FA", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.newMaterialButton}
            >
              <TrendingUp size={normalize(16)} color="#FFF" />
              <Text style={styles.newMaterialText} numberOfLines={1} adjustsFontSizeToFit>
                Add Inward
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {hasWriteAccess("INVENTORY_ADD_OUTWARD_STOCK") && (
          <TouchableOpacity
            style={styles.actionButtonWrapper}
            activeOpacity={0.85}
            onPress={() => {
              closeSheetIfOpen();
              setIsSheetOpen(true);
              addUsageSheetRef.current?.snapToIndex(1);
            }}
          >
            <LinearGradient
              colors={["#60A5FA", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.newMaterialButton}
            >
              <Plus size={normalize(16)} color="#FFF" />
              <Text style={styles.newMaterialText} numberOfLines={1} adjustsFontSizeToFit>
                Add Usage
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <View style={[styles.searchWrapper, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: searchBoxBg,
              borderColor: searchBoxBorder,
              shadowColor: searchBoxShadow,
            },
          ]}
        >
          <View style={styles.searchIconWrap}>
            <Search size={normalize(16)} color={subTextColor} />
          </View>
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search material..."
            placeholderTextColor={subTextColor}
            value={inventorySearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
            onChangeText={(text) => {
              setInventorySearch(text);
              setPage(1);
              const filtered = allMaterials.filter((item) =>
                item.material_name.toLowerCase().includes(text.toLowerCase().trim())
              );
              const calcPages = Math.ceil(filtered.length / 10) || 1;
              setTotalPages(calcPages);
              setInventory(filtered.slice(0, 10));
              setHasNextPage(calcPages > 1);
            }}
          />
          {inventorySearch.length > 0 && (
            <TouchableOpacity
              style={styles.searchClearBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              onPress={() => {
                setInventorySearch("");
                setPage(1);
                const calcPages = Math.ceil(allMaterials.length / 10) || 1;
                setTotalPages(calcPages);
                setInventory(allMaterials.slice(0, 10));
                setHasNextPage(calcPages > 1);
              }}
            >
              <View style={styles.searchClearCircle}>
                <X size={normalize(10)} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        </View>
        {inventorySearch.length > 0 && (
          <Text style={[styles.searchResultCount, { color: subTextColor }]}>
            {inventory.length} result{inventory.length !== 1 ? "s" : ""} found
          </Text>
        )}
      </View>

      {/* ── Section Heading ────────────────────────────────────────────────── */}
      <View style={styles.headingCardContainer}>
        <View
          style={[
            styles.headingPill,
            {
              backgroundColor: headingPillBg,
              borderColor: borderColor,
            },
          ]}
        >
          <Text style={[styles.listHeading, { color: theme.text }]}>Material Stock</Text>
        </View>
      </View>

      {/* ── Inventory List ─────────────────────────────────────────────────── */}
      <ScrollView style={{ flex: 1, marginTop: 10 }} ref={scrollViewRef}>
        {loading && (
          <View style={{ marginTop: 20 }}>
            <ActivityIndicator size="small" color={primaryColor} />
            <Text style={[{ textAlign: "center", marginTop: 8 }, { color: subTextColor }]}>
              Loading materials...
            </Text>
          </View>
        )}

        {!loading &&
          inventory.map((item) => (
            <TouchableOpacity
              key={item.wimpr_id}
              style={[
                styles.inventoryCard,
                {
                  backgroundColor: theme.cardColor,
                  shadowColor: cardShadow,
                },
              ]}
              onPress={() => handleOpenMaterial(item.wimpr_id)}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.iconCircle, { backgroundColor: iconCircleBg }]}>
                  <Package size={normalize(20)} color="#FFF" />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text
                    style={[styles.materialName, { color: theme.text }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.material_name}
                  </Text>
                  <Text style={[styles.materialUnit, { color: subTextColor }]}>
                    Unit:{" "}
                    {item.unit.length > 20 ? `${item.unit.substring(0, 20)}...` : item.unit}
                  </Text>
                </View>
                <View style={styles.statsItem}>
                  <Text style={[styles.statsLabel, { color: statsLabelColor }]}>
                    Today Wastage
                  </Text>
                  <Text style={[styles.statsValue, { color: theme.text }]}>
                    {item.tender_quantity ?? 0}
                  </Text>
                </View>
              </View>

              <View style={[styles.cardDivider, { backgroundColor: borderColor }]} />

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statsRow}>
                  <View style={styles.statsItem}>
                    <Text style={[styles.statsLabel, { color: statsLabelColor }]}>Total Qty</Text>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {item.total_qty}
                    </Text>
                  </View>
                  <View style={styles.statsItem}>
                    <Text style={[styles.statsLabel, { color: statsLabelColor }]}>
                      Total Usage
                    </Text>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {item.total_usage}
                    </Text>
                  </View>
                  <View style={styles.statsItem}>
                    <Text style={[styles.statsLabel, { color: statsLabelColor }]}>
                      Total Wastage
                    </Text>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {item.wastage ?? 0}
                    </Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.statsItem}>
                    <Text style={[styles.statsLabel, { color: statsLabelColor }]}>Remaining</Text>
                    <Text
                      style={[
                        styles.statsValue,
                        { color: item.remaining <= 0 ? dangerColor : theme.success || "#10B981" },
                      ]}
                    >
                      {item.remaining}
                    </Text>
                  </View>
                  <View style={styles.statsItem}>
                    <Text style={[styles.statsLabel, { color: statsLabelColor }]}>
                      Today Usage
                    </Text>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {item.today_usage}
                    </Text>
                  </View>
                  <View style={styles.statsItem}>
                    <Text style={[styles.statsLabel, { color: statsLabelColor }]}>
                      Today Wastage
                    </Text>
                    <Text style={[styles.statsValue, { color: theme.text }]}>
                      {item.today_wastage ?? 0}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}

        {!loading && inventory.length === 0 && (
          <Text style={[styles.noDataText, { color: subTextColor }]}>
            No matching materials found
          </Text>
        )}

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {!loading && inventory.length > 0 && (
          <View style={[styles.paginationRow, { backgroundColor: theme.cardColor, borderColor }]}>
            <TouchableOpacity
              disabled={page === 1}
              onPress={() => {
                setPage(Math.max(1, page - 1));
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
              style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
            >
              <Text
                style={[
                  styles.pageBtnText,
                  { color: page === 1 ? subTextColor : primaryColor },
                ]}
              >
                Previous
              </Text>
            </TouchableOpacity>
            <Text style={[styles.pageTextCompact, { color: theme.text }]}>
              Page {page} of {totalPages}
            </Text>
            <TouchableOpacity
              disabled={!hasNextPage}
              onPress={() => {
                setPage(page + 1);
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
              }}
              style={[styles.pageBtn, !hasNextPage && styles.pageBtnDisabled]}
            >
              <Text
                style={[
                  styles.pageBtnText,
                  { color: !hasNextPage ? subTextColor : primaryColor },
                ]}
              >
                Next
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── Bottom Sheet ───────────────────────────────────────────────────── */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        onChange={(index) => setIsSheetOpen(index !== -1)}
        backgroundStyle={{ backgroundColor: theme.cardColor }}
        handleIndicatorStyle={{ backgroundColor: sheetIndicator }}
      >
        {selectedMaterial ? (
          <>
            {/* Sheet Header */}
            <View style={[styles.sheetHeader, { borderColor }]}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.sheetTitle, { color: theme.text }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {selectedMaterial.material_name}
                </Text>
                <Text style={[styles.sheetSub, { color: subTextColor }]}>
                  Unit:{" "}
                  {selectedMaterial.unit.length > 20
                    ? `${selectedMaterial.unit.substring(0, 20)}...`
                    : selectedMaterial.unit}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.sheetCloseBtn}
                onPress={() => bottomSheetRef.current?.close()}
              >
                <X size={20} color={theme.text} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={[styles.tabRow, { borderColor }]}>
              {(["inward", "outward"] as const).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tabButton,
                    activeTab === tab && {
                      borderBottomWidth: 2,
                      borderBottomColor: tabActiveBorder,
                    },
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: subTextColor },
                      activeTab === tab && { color: tabActiveText, fontWeight: "600" },
                    ]}
                  >
                    {tab === "inward"
                      ? `Inward (${inwardHistory.length})`
                      : `Outward (${outwardHistory.length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sheet Content */}
            <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 60 }}>
              {loadingDetails ? (
                <View style={styles.detailsLoaderContainer}>
                  <ActivityIndicator size="large" color={primaryColor} />
                  <Text style={[styles.loaderText, { color: subTextColor }]}>
                    Fetching history...
                  </Text>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                  {(activeTab === "inward"
                    ? [...inwardHistory].reverse()
                    : [...outwardHistory].reverse()
                  ).map((t, index) => {
                    const isEditingThis = editing === t.id;
                    return (
                      <View
                        key={`${activeTab}-${t.id ?? index}`}
                        style={[
                          styles.transCard,
                          {
                            backgroundColor: transCardBg,
                            borderColor: isEditingThis ? primaryColor : borderColor,
                          },
                        ]}
                      >
                        {/* Transaction Header */}
                        <View style={styles.transHeader}>
                          <View
                            style={[styles.dateBadge, { backgroundColor: dateBadgeBg }]}
                          >
                            <Text style={[styles.transDateText, { color: subTextColor }]}>
                              {new Date(t.date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </Text>
                          </View>
                          {!isEditingThis && (
                            <View style={styles.actionGroup}>
                              {(activeTab === "inward"
                                ? hasWriteAccess("INVENTORY_EDIT_INWARD_STOCK")
                                : hasWriteAccess("INVENTORY_EDIT_OUTWARD_STOCK")) && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setEditedTrans({ ...t });
                                      setEditing(t.id);
                                    }}
                                  >
                                    <Edit2 size={18} color={primaryColor} />
                                  </TouchableOpacity>
                                )}
                              {(activeTab === "inward"
                                ? hasWriteAccess("INVENTORY_DELETE_INWARD_STOCK")
                                : hasWriteAccess("INVENTORY_DELETE_OUTWARD_STOCK")) && (
                                  <TouchableOpacity
                                    onPress={() => {
                                      setDeleteId(String(t.delete_id));
                                      setShowDeleteModal(true);
                                    }}
                                  >
                                    <Trash2 size={18} color={dangerColor} />
                                  </TouchableOpacity>
                                )}
                            </View>
                          )}
                        </View>

                        {/* Body */}
                        {isEditingThis ? (
                          <View>
                            <Text
                              style={[styles.inputLabel, { color: theme.text, marginTop: 0 }]}
                            >
                              {activeTab === "inward" ? "Inward Quantity" : "Usage Quantity"}
                            </Text>
                            <TextInput
                              style={[
                                styles.inputBox,
                                {
                                  backgroundColor: transEditBg,
                                  color: theme.text,
                                  borderWidth: 1,
                                  borderColor,
                                },
                              ]}
                              keyboardType="numeric"
                              autoFocus
                              maxLength={7}
                              value={String(editedTrans.quantity)}
                              onChangeText={(v) =>
                                setEditedTrans({ ...editedTrans, quantity: v })
                              }
                            />
                            {activeTab === "inward" && (
                              <>
                                <Text
                                  style={[styles.inputLabel, { color: theme.text }]}
                                >
                                  Tender Quantity
                                </Text>
                                <TextInput
                                  style={[
                                    styles.inputBox,
                                    {
                                      backgroundColor: transEditBg,
                                      color: theme.text,
                                      borderWidth: 1,
                                      borderColor,
                                    },
                                  ]}
                                  keyboardType="numeric"
                                  value={String(editedTrans.tender_quantity ?? 0)}
                                  onChangeText={(v) =>
                                    setEditedTrans({ ...editedTrans, tender_quantity: Number(v) })
                                  }
                                />
                              </>
                            )}
                            {activeTab === "outward" && (
                              <>
                                <Text
                                  style={[styles.inputLabel, { color: theme.text }]}
                                >
                                  Wastage Quantity
                                </Text>
                                <TextInput
                                  style={[
                                    styles.inputBox,
                                    {
                                      backgroundColor: transEditBg,
                                      color: theme.text,
                                      borderWidth: 1,
                                      borderColor,
                                    },
                                  ]}
                                  keyboardType="numeric"
                                  value={String(editedTrans.wastage ?? 0)}
                                  onChangeText={(v) =>
                                    setEditedTrans({ ...editedTrans, wastage: v })
                                  }
                                />
                              </>
                            )}
                            <View style={styles.saveEditActions}>
                              <TouchableOpacity
                                style={[styles.saveEditButton, { flex: 1, marginTop: 0 }]}
                                onPress={handleSaveEdit}
                              >
                                <Save size={16} color="#FFF" />
                                <Text style={styles.saveEditText}>Save</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.saveEditButton,
                                  {
                                    flex: 1,
                                    marginTop: 0,
                                    backgroundColor: transEditBg,
                                  },
                                ]}
                                onPress={() => {
                                  setEditing(null);
                                  setEditedTrans({});
                                }}
                              >
                                <Text style={[styles.saveEditText, { color: theme.text }]}>
                                  Cancel
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : (
                          <View>
                            <View style={styles.amountContainer}>
                              <Text style={[styles.amountLabel, { color: subTextColor }]}>
                                {activeTab === "inward" ? "Quantity:" : "Used:"}
                              </Text>
                              <Text
                                style={[
                                  styles.amountValue,
                                  {
                                    color:
                                      activeTab === "inward"
                                        ? theme.success || "#10B981"
                                        : primaryColor,
                                  },
                                ]}
                              >
                                {Number(t.quantity).toFixed(2)}{" "}
                                <Text style={{ fontSize: 12 }}>{selectedMaterial.unit}</Text>
                              </Text>
                            </View>
                            <View style={styles.amountContainer}>
                              <Text style={[styles.amountLabel, { color: subTextColor }]}>
                                Tender Qty
                              </Text>
                              <Text
                                style={[
                                  styles.amountValue2,
                                  {
                                    color:
                                      activeTab === "inward"
                                        ? theme.inputText || "#000000"
                                        : primaryColor,
                                  },
                                ]}
                              >
                                {Number(t.tender_quantity).toFixed(2)}{" "}
                                {/* <Text style={{ fontSize: 12 }}>{selectedMaterial.tender_quantity}</Text> */}
                              </Text>
                            </View>
                            {activeTab === "outward" && (
                              <View style={styles.amountContainer}>
                                <Text style={[styles.amountLabel, { color: subTextColor }]}>
                                  Wastage:
                                </Text>
                                <Text
                                  style={[
                                    styles.amountValue,
                                    { color: dangerColor, fontSize: 16 },
                                  ]}
                                >
                                  {Number(t.wastage).toFixed(2)}{" "}
                                  <Text style={{ fontSize: 12 }}>{selectedMaterial.unit}</Text>
                                </Text>
                              </View>
                            )}
                            <View
                              style={[
                                styles.commentBox,
                                { borderTopColor: commentBorderTop },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.amountLabel,
                                  { color: subTextColor, marginBottom: 4 },
                                ]}
                              >
                                Comments:
                              </Text>
                              <Text style={[styles.commentText, { color: theme.text }]}>
                                {t.comment?.trim() ? t.comment : "No remarks provided"}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}

                  {/* Empty States */}
                  {((activeTab === "inward" && inwardHistory.length === 0) ||
                    (activeTab === "outward" && outwardHistory.length === 0)) && (
                      <View style={{ alignItems: "center", marginTop: 60 }}>
                        <Package size={48} color={emptyIconColor} />
                        <Text style={[styles.emptyLabel, { color: subTextColor }]}>
                          No {activeTab} history found
                        </Text>
                      </View>
                    )}
                </View>
              )}
            </BottomSheetScrollView>
          </>
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color={primaryColor} />
          </View>
        )}
      </BottomSheet>

      {/* ── Add Material BottomSheet ─────────────────────────────────────────────── */}
      <BottomSheet
        ref={addMaterialSheetRef}
        index={-1}
        snapPoints={formSnapPoints}
        enablePanDownToClose
        onClose={() => {
          setIsSheetOpen(false);
          setMaterialErrors({});
          setMaterialSelectedFromDropdown(false);
          setSelectedExistingMaterialId(null);
          setNewMaterial({ name: "", unit: "", tender_quantity: "" });
          setShowMaterialSuggestions(false);
          setDisplayedMaterialsCount(10);
        }}
        backgroundStyle={{ backgroundColor: theme.cardColor }}
        handleIndicatorStyle={{ backgroundColor: sheetIndicator }}
        keyboardBehavior="padding"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            padding: 24,
            paddingBottom: normalize(isKeyboardVisible ? 380 : 120),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.modalBigTitle, { color: theme.text }]}>Add New Material</Text>

          <Text style={[styles.inputLabel, { color: theme.text }]}>
            Material Name <Text style={{ color: dangerColor }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.inputField,
              {
                backgroundColor: inputBg,
                color: theme.text,
                borderWidth: materialErrors.name ? 1 : 0,
                borderColor: materialErrors.name ? dangerColor : "transparent",
              },
            ]}
            placeholder="Search or type new Material..."
            placeholderTextColor={subTextColor}
            value={newMaterial.name}
            maxLength={50}
            onFocus={() => setShowMaterialSuggestions(true)}
            onBlur={() => setTimeout(() => setShowMaterialSuggestions(false), 200)}
            onChangeText={(v) => {
              setNewMaterial(
                materialSelectedFromDropdown
                  ? { name: v, unit: "", tender_quantity: "" }
                  : { ...newMaterial, name: v }
              );
              setShowMaterialSuggestions(true);
              setMaterialSelectedFromDropdown(false);
              if (materialErrors.name) setMaterialErrors((e) => ({ ...e, name: undefined }));
            }}
          />

          {/* Suggestions Dropdown */}
          {showMaterialSuggestions && (
            <View
              style={[
                styles.suggestionBox,
                {
                  backgroundColor: suggestionBg,
                  borderColor,
                  maxHeight: SCREEN_HEIGHT * 0.3,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={[styles.suggestionHeader, { color: subTextColor }]}>
                  {newMaterial.name.length > 0 ? "Similar materials:" : "Existing materials:"} (
                  {filteredExistingMaterials.length})
                </Text>
                <TouchableOpacity onPress={() => setShowMaterialSuggestions(false)}>
                  <X size={16} color={subTextColor} />
                </TouchableOpacity>
              </View>

              {loadingMaterialDropdown ? (
                <View style={{ padding: 30, alignItems: "center" }}>
                  <ActivityIndicator size="small" color={loaderDotColor} />
                  <Text style={[styles.dropItemText, { color: subTextColor, marginTop: 12 }]}>
                    Loading materials...
                  </Text>
                </View>
              ) : filteredExistingMaterials.length === 0 ? (
                <Text
                  style={[
                    styles.dropItemText,
                    { color: subTextColor, textAlign: "center", padding: 20 },
                  ]}
                >
                  {newMaterial.name.length > 0 ? "No matching materials" : "No materials found"}
                </Text>
              ) : (
                <View style={{ maxHeight: 200, marginTop: 10 }}>
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    onScroll={({ nativeEvent }) => {
                      const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                      if (
                        layoutMeasurement.height + contentOffset.y >=
                        contentSize.height - 20
                      )
                        loadMoreMaterials();
                    }}
                    scrollEventThrottle={400}
                  >
                    {displayedMaterials.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.suggestionItem, { borderColor }]}
                        onPress={() => {
                          setNewMaterial({ name: m.material_name, unit: m.unit, tender_quantity: "" });
                          setMaterialSelectedFromDropdown(true);
                          setShowMaterialSuggestions(false);
                          setSelectedExistingMaterialId(m.id);
                          setDisplayedMaterialsCount(10);
                          if (materialErrors.name)
                            setMaterialErrors((e) => ({ ...e, name: undefined }));
                        }}
                      >
                        <View style={styles.materialSelectorItemContent}>
                          <Text
                            style={[styles.materialSelectorItemName, { color: theme.text }]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {m.material_name?.trim() ? m.material_name : "NA"}
                          </Text>
                          <Text
                            style={[styles.materialSelectorItemUnit, { color: subTextColor }]}
                          >
                            {m.unit.length > 20 ? `${m.unit.substring(0, 20)}...` : m.unit || "-"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {hasMoreMaterials && (
                      <TouchableOpacity
                        style={{ padding: 12, alignItems: "center" }}
                        onPress={loadMoreMaterials}
                      >
                        <Text
                          style={[
                            styles.dropItemText,
                            { color: primaryColor, fontWeight: "600" },
                          ]}
                        >
                          Load more...
                        </Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {materialErrors.name && (
            <Text style={[styles.errorText, { color: dangerColor }]}>{materialErrors.name}</Text>
          )}

          <Text style={[styles.inputLabel, { color: theme.text }]}>
            Unit <Text style={{ color: dangerColor }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.inputField,
              {
                backgroundColor: materialSelectedFromDropdown
                  ? isDark
                    ? "#1C1C1E"
                    : "#ECEEF1"
                  : inputBg,
                color: theme.text,
                borderWidth: materialErrors.unit ? 1 : 0,
                borderColor: materialErrors.unit ? dangerColor : "transparent",
              },
            ]}
            placeholder="e.g., Bags, Kg, Tons"
            placeholderTextColor={subTextColor}
            value={newMaterial.unit}
            maxLength={20}
            editable={!materialSelectedFromDropdown}
            onChangeText={(v) => {
              setNewMaterial({ ...newMaterial, unit: v });
              if (materialErrors.unit) setMaterialErrors((e) => ({ ...e, unit: undefined }));
            }}
          />
          {materialSelectedFromDropdown && (
            <Text style={[styles.infoText, { color: subTextColor }]}>
              Unit is auto-filled from existing material
            </Text>
          )}
          {materialErrors.unit && (
            <Text style={[styles.errorText, { color: dangerColor }]}>{materialErrors.unit}</Text>
          )}

          <Text style={[styles.inputLabel, { color: theme.text, marginTop: 16 }]}>
            Tender Quantity <Text style={{ color: dangerColor }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.inputField,
              {
                backgroundColor: inputBg,
                color: theme.text,
                borderWidth: materialErrors.tender_quantity ? 1 : 0,
                borderColor: materialErrors.tender_quantity ? dangerColor : "transparent",
              },
            ]}
            placeholder="Enter Tender Quantity"
            placeholderTextColor={subTextColor}
            keyboardType="numeric"
            value={newMaterial.tender_quantity}
            maxLength={10}
            onChangeText={(v) => {
              const sanitized = v.replace(/[^0-9.]/g, '');
              if (sanitized.split('.').length > 2) return;
              setNewMaterial({ ...newMaterial, tender_quantity: sanitized });
              if (materialErrors.tender_quantity) setMaterialErrors((e) => ({ ...e, tender_quantity: undefined }));
            }}
          />
          {materialErrors.tender_quantity && (
            <Text style={[styles.errorText, { color: dangerColor }]}>{materialErrors.tender_quantity}</Text>
          )}

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                { backgroundColor: cancelBtnBg, borderWidth: 1, borderColor: cancelBtnBorder },
              ]}
              activeOpacity={0.85}
              onPress={() => {
                addMaterialSheetRef.current?.close();
              }}
            >
              <Text style={[styles.cancelButtonText, { color: cancelBtnText }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gradientButtonWrapper}
              activeOpacity={0.85}
              onPress={handleAddMaterial}
            >
              <LinearGradient
                colors={
                  newMaterial.name.trim().length > 0 && isDuplicateMaterial(newMaterial.name)
                    ? ["#34D399", "#10B981"]
                    : ["#60A5FA", "#2563EB"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientButton}
              >
                <Text style={styles.gradientButtonText}>
                  {newMaterial.name.trim().length > 0 && isDuplicateMaterial(newMaterial.name)
                    ? "Link Material"
                    : "Add Material"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* ── Add Inward BottomSheet ───────────────────────────────────────────────── */}
      <BottomSheet
        ref={addInwardSheetRef}
        index={-1}
        snapPoints={formSnapPoints}
        enablePanDownToClose
        onClose={() => {
          setIsSheetOpen(false);
          setInwardMaterialId("");
          setInwardQuantity("");
          setInwardComment("");
          setInwardThreshold("0");
          setInwardUnit("—");
          setInwardMaterialSearch("");
          setInwardDate(new Date());
          setInwardErrors({});
        }}
        backgroundStyle={{ backgroundColor: theme.cardColor }}
        handleIndicatorStyle={{ backgroundColor: sheetIndicator }}
        keyboardBehavior="padding"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            padding: 24,
            paddingBottom: normalize(isKeyboardVisible ? 380 : 120),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.modalBigTitle, { color: theme.text }]}>Add Inward Stock</Text>
          <Text style={[styles.modalSubTitle, { color: subTextColor }]}>
            Add new stock received
          </Text>

          <Text style={[styles.inputLabel, { color: theme.text }]}>
            Material <Text style={{ color: dangerColor }}>*</Text>
          </Text>
          <View
            style={[
              styles.inputField,
              {
                backgroundColor: inputBg,
                borderWidth: inwardErrors.material ? 1 : 0,
                borderColor: dangerColor,
                height: 50,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingRight: 8,
              },
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => {
                setShowMaterialSelectorModal(true);
              }}
            >
              <Text style={{ color: inwardMaterialSearch ? theme.text : subTextColor }}>
                {inwardMaterialSearch || "Search material..."}
              </Text>
            </TouchableOpacity>
            {(inwardMaterialSearch || inwardMaterialId) ? (
              <TouchableOpacity
                onPress={() => {
                  setInwardMaterialSearch("");
                  setInwardMaterialId("");
                  setInwardUnit("—");
                  setInwardThreshold("0");
                  setInwardErrors((e) => ({ ...e, material: undefined }));
                }}
              >
                <View style={styles.searchClearCircle}>
                  <X size={normalize(10)} color="#fff" />
                </View>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.rowLayout}>
            <View style={styles.flexHalf}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Unit</Text>
              <View style={[styles.inputField, { backgroundColor: isDark ? "#1C1C1E" : "#ECEEF1", justifyContent: "center" }]}>
                <Text style={{ color: subTextColor }}>{inwardUnit}</Text>
              </View>
            </View>
            <View style={styles.flexHalf}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Alert Threshold</Text>
              <TextInput
                style={[styles.inputField, { backgroundColor: inputBg, color: theme.text }]}
                keyboardType="numeric"
                value={inwardThreshold}
                onChangeText={setInwardThreshold}
              />
            </View>
          </View>

          <View style={styles.rowLayout}>
            <View style={styles.flexHalf}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Quantity *</Text>
              <TextInput
                style={[styles.inputField, { backgroundColor: inputBg, color: theme.text, borderWidth: inwardErrors.quantity ? 1 : 0, borderColor: dangerColor }]}
                keyboardType="numeric"
                value={inwardQuantity}
                onChangeText={setInwardQuantity}
              />
            </View>
            <View style={styles.flexHalf}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Date *</Text>
              <TouchableOpacity
                style={[styles.inputField, { backgroundColor: inputBg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                onPress={() => setShowInwardDatePicker(true)}
              >
                <Text style={{ color: theme.text }}>{inwardDate.toLocaleDateString("en-IN")}</Text>
                <Package size={16} color={subTextColor} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.inputLabel, { color: theme.text }]}>Comment</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: inputBg, color: theme.text }]}
            multiline
            value={inwardComment}
            onChangeText={setInwardComment}
          />

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: cancelBtnBg }]}
              onPress={() => addInwardSheetRef.current?.close()}
            >
              <Text style={{ color: cancelBtnText }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gradientButtonWrapper}
              onPress={handleAddInward}
            >
              <LinearGradient colors={["#60A5FA", "#2563EB"]} style={styles.gradientButton}>
                <Text style={styles.gradientButtonText}>Add Inward</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* ── Add Usage BottomSheet ────────────────────────────────────────────────── */}
      <BottomSheet
        ref={addUsageSheetRef}
        index={-1}
        snapPoints={formSnapPoints}
        enablePanDownToClose
        onClose={() => {
          setIsSheetOpen(false);
          setUsageErrors({});
          setStockMaterialId("");
          setUsageMaterialSearch("");
          setNewUsage({ material_id: "", usage_quantity: "", wastage_quantity: "", comment: "" });
        }}
        backgroundStyle={{ backgroundColor: theme.cardColor }}
        handleIndicatorStyle={{ backgroundColor: sheetIndicator }}
        keyboardBehavior="padding"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            padding: 24,
            paddingBottom: normalize(isKeyboardVisible ? 380 : 120),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.modalBigTitle, { color: theme.text }]}>Add Usage</Text>
          <Text style={[styles.modalSubTitle, { color: subTextColor }]}>Record usage and/or wastage</Text>

          <Text style={[styles.inputLabel, { color: theme.text }]}>Material *</Text>
          <TouchableOpacity
            style={[
              styles.inputField,
              {
                backgroundColor: inputBg,
                justifyContent: "center",
                borderWidth: usageErrors.material ? 1 : 0,
                borderColor: dangerColor,
              },
            ]}
            onPress={() => setShowUsageMaterialSelectorModal(true)}
          >
            <Text style={{ color: usageMaterialSearch ? theme.text : subTextColor }}>
              {usageMaterialSearch || "Select material..."}
            </Text>
          </TouchableOpacity>
          {usageErrors.material && (
            <Text style={[styles.errorText, { color: dangerColor }]}>{usageErrors.material}</Text>
          )}

          <View style={styles.rowLayout}>
            <View style={styles.flexHalf}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Usage Qty *</Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderWidth: usageErrors.usage ? 1 : 0,
                    borderColor: dangerColor,
                  },
                ]}
                keyboardType="numeric"
                value={newUsage.usage_quantity}
                onChangeText={(v) => {
                  setNewUsage({ ...newUsage, usage_quantity: v });
                  if (usageErrors.usage) setUsageErrors((e) => ({ ...e, usage: undefined }));
                }}
              />
              {usageErrors.usage && (
                <Text style={[styles.errorText, { color: dangerColor, fontSize: 10 }]}>
                  {usageErrors.usage}
                </Text>
              )}
            </View>
            <View style={styles.flexHalf}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Wastage Qty *</Text>
              <TextInput
                style={[
                  styles.inputField,
                  {
                    backgroundColor: inputBg,
                    color: theme.text,
                    borderWidth: usageErrors.wastage ? 1 : 0,
                    borderColor: dangerColor,
                  },
                ]}
                keyboardType="numeric"
                value={newUsage.wastage_quantity}
                onChangeText={(v) => {
                  setNewUsage({ ...newUsage, wastage_quantity: v });
                  if (usageErrors.wastage) setUsageErrors((e) => ({ ...e, wastage: undefined }));
                }}
              />
              {usageErrors.wastage && (
                <Text style={[styles.errorText, { color: dangerColor, fontSize: 10 }]}>
                  {usageErrors.wastage}
                </Text>
              )}
            </View>
          </View>

          <Text style={[styles.inputLabel, { color: theme.text }]}>Date *</Text>
          <TouchableOpacity
            style={[styles.inputField, { backgroundColor: inputBg, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
            onPress={() => setShowUsageDatePickerCustom(true)}
          >
            <Text style={{ color: theme.text }}>{usageDate.toLocaleDateString("en-IN")}</Text>
            <Package size={16} color={subTextColor} />
          </TouchableOpacity>

          <Text style={[styles.inputLabel, { color: theme.text }]}>Comment</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: inputBg, color: theme.text }]}
            multiline
            value={newUsage.comment}
            onChangeText={(v) => setNewUsage({ ...newUsage, comment: v })}
          />

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: cancelBtnBg }]}
              onPress={() => addUsageSheetRef.current?.close()}
            >
              <Text style={{ color: cancelBtnText }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gradientButtonWrapper}
              onPress={handleAddUsage}
            >
              <LinearGradient colors={["#60A5FA", "#2563EB"]} style={styles.gradientButton}>
                <Text style={styles.gradientButtonText}>Add Usage</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      {/* ── Delete Modal ───────────────────────────────────────────────────── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: overlayColor }]}>
          <View style={[styles.deleteBox, { backgroundColor: theme.cardColor }]}>
            <AlertCircle size={40} color={dangerColor} />
            <Text style={[styles.deleteTitle, { color: theme.text }]}>Delete Transaction?</Text>
            <Text style={[styles.deleteMsg, { color: subTextColor }]}>
              This action cannot be undone.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.cancelDeleteBtn, { backgroundColor: inputBg }]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={[styles.cancelDeleteText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteBtn, { backgroundColor: dangerColor }]}
                onPress={handleDeleteTransaction}
              >
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Exceeds Tender Quantity Modal ────────────────────────────────────── */}
      <Modal
        visible={showInwardConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInwardConfirm(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: overlayColor }]}>
          <View style={[styles.deleteBox, { backgroundColor: theme.cardColor }]}>
            <AlertCircle size={40} color="#F59E0B" />
            <Text style={[styles.deleteTitle, { color: theme.text, marginTop: 12 }]}>
              Exceeds Tender Quantity
            </Text>
            <Text style={[styles.deleteMsg, { color: subTextColor, marginTop: 12, lineHeight: 20 }]}>
              Adding this inward stock will bring the total inward quantity to{" "}
              <Text style={{ fontWeight: "700", color: dangerColor }}>
                {inwardConfirmData.newTotal.toFixed(2)}
              </Text>
              , which exceeds the Tender Quantity of{" "}
              <Text style={{ fontWeight: "700" }}>
                {inwardConfirmData.tenderQuantity.toFixed(2)}
              </Text>.
            </Text>
            <Text style={[styles.deleteMsg, { color: "#D97706", fontWeight: "600", marginTop: 16 }]}>
              Do you still want to continue?
            </Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.cancelDeleteBtn, { backgroundColor: inputBg }]}
                onPress={() => setShowInwardConfirm(false)}
              >
                <Text style={[styles.cancelDeleteText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteBtn, { backgroundColor: "#F59E0B" }]}
                onPress={() => {
                  setShowInwardConfirm(false);
                  processAddInward(Number(inwardQuantity));
                }}
              >
                <Text style={styles.confirmDeleteText}>Continue & Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Exceeds Tender Quantity Modal for Edit ────────────────────────────── */}
      <Modal
        visible={showEditInwardConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditInwardConfirm(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: overlayColor }]}>
          <View style={[styles.deleteBox, { backgroundColor: theme.cardColor }]}>
            <AlertCircle size={40} color="#F59E0B" />
            <Text style={[styles.deleteTitle, { color: theme.text, marginTop: 12 }]}>
              Exceeds Tender Quantity
            </Text>
            <Text style={[styles.deleteMsg, { color: subTextColor, marginTop: 12, lineHeight: 20 }]}>
              Updating this inward stock will bring the total inward quantity to{" "}
              <Text style={{ fontWeight: "700", color: dangerColor }}>
                {editInwardConfirmData?.newTotal.toFixed(2)}
              </Text>
              , which exceeds the Tender Quantity of{" "}
              <Text style={{ fontWeight: "700" }}>
                {editInwardConfirmData?.tenderQuantity.toFixed(2)}
              </Text>.
            </Text>
            <Text style={[styles.deleteMsg, { color: "#D97706", fontWeight: "600", marginTop: 16 }]}>
              Do you still want to continue?
            </Text>

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.cancelDeleteBtn, { backgroundColor: inputBg }]}
                onPress={() => setShowEditInwardConfirm(false)}
              >
                <Text style={[styles.cancelDeleteText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmDeleteBtn, { backgroundColor: "#F59E0B" }]}
                onPress={() => {
                  if (editInwardConfirmData) {
                    processSaveEditInward(editInwardConfirmData.editedTrans, editInwardConfirmData.currentThreshold);
                  }
                }}
              >
                <Text style={styles.confirmDeleteText}>Continue & Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast.visible && (
        <View style={[styles.toastBox, { backgroundColor: toastBg }]}>
          <Check size={20} color="#FFF" />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* ── Export FAB ─────────────────────────────────────────────────────── */}
      {!isSheetOpen && hasAccess("INVENTORY_EXCEL_EXPORT") && (
        <TouchableOpacity
          style={styles.exportFab}
          activeOpacity={0.8}
          onPress={() =>
            handleExportInventory(allMaterials, selectedProject.id, showSuccess)
          }
        >
          <LinearGradient
            colors={["#60A5FA", "#2563EB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.exportFabGradient}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Download size={22} color="#FFF" />
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* ── Inward Material Selector Modal ─────────────────────────────────── */}
      <Modal
        visible={showMaterialSelectorModal}
        transparent
        animationType="slide"
        onClose={() => {
          setShowMaterialSelectorModal(false);
          if (!inwardMaterialId) {
            setInwardMaterialSearch("");
          }
        }}
      >
        <View style={[styles.modalOverlayInner, { backgroundColor: overlayColor }]}>
          <View style={[styles.materialSelectorModal, { backgroundColor: theme.cardColor }]}>
            <View style={[styles.materialSelectorHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.materialSelectorTitle, { color: theme.text }]}>
                Select Material
              </Text>
              <TouchableOpacity onPress={() => {
                setShowMaterialSelectorModal(false);
                if (!inwardMaterialId) {
                  setInwardMaterialSearch("");
                }
              }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.materialSearchContainer, { backgroundColor: inputBg }]}>
              <Search size={18} color={subTextColor} />
              <TextInput
                style={[styles.materialSearchInput, { color: theme.text }]}
                placeholder="Search materials..."
                placeholderTextColor={subTextColor}
                value={inwardMaterialSearch}
                onChangeText={(text) => {
                  setInwardMaterialSearch(text);
                  setDisplayedMaterialsCount(10);
                  if (text === "") {
                    setInwardMaterialId("");
                    setInwardUnit("—");
                    setInwardThreshold("0");
                  }
                }}
                autoFocus
              />
            </View>

            <Text style={[styles.materialResultsCount, { color: subTextColor }]}>
              {filteredProjectMaterials.length} materials found
            </Text>

            <ScrollView
              style={styles.materialSelectorList}
              keyboardShouldPersistTaps="always"
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20)
                  loadMoreInwardMaterials();
              }}
              scrollEventThrottle={400}
            >
              {filteredProjectMaterials.length === 0 ? (
                <View style={styles.materialEmptyState}>
                  <Text style={[styles.materialEmptyText, { color: subTextColor }]}>
                    No materials found
                  </Text>
                </View>
              ) : (
                <>
                  {displayedInwardMaterials.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.materialSelectorItem, { borderBottomColor: borderColor }]}
                      onPress={() => {
                        setInwardMaterialId(m.id);
                        setInwardMaterialSearch(m.material_name);
                        setInwardUnit(m.unit || "—");
                        setInwardThreshold(String(m.tender_quantity || m.threshold || "0"));
                        setShowMaterialSelectorModal(false);
                        setDisplayedInwardMaterialsCount(10);
                        if (inwardErrors.material)
                          setInwardErrors((e) => ({ ...e, material: undefined }));
                      }}
                    >
                      <View style={styles.materialSelectorItemContent}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.materialSelectorItemName, { color: theme.text }]}>
                            {m.material_name}
                          </Text>
                          {m.threshold !== undefined && (
                            <Text
                              style={{ fontSize: 12, color: "#EF4444", marginTop: 2, fontWeight: "500" }}
                            >
                              Threshold: {m.threshold}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={[styles.materialSelectorItemUnit, { color: subTextColor }]}
                        >
                          {m.unit.length > 20 ? `${m.unit.substring(0, 20)}...` : m.unit}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {hasMoreInwardMaterials && (
                    <TouchableOpacity
                      style={styles.materialLoadMore}
                      onPress={loadMoreInwardMaterials}
                    >
                      <Text style={[styles.materialLoadMoreText, { color: primaryColor }]}>
                        Load more...
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Usage Material Selector Modal ──────────────────────────────────── */}
      <Modal
        visible={showUsageMaterialSelectorModal}
        transparent
        animationType="slide"
        onClose={() => {
          setShowUsageMaterialSelectorModal(false);
          if (!stockMaterialId) {
            setUsageMaterialSearch("");
          }
        }}
      >
        <View style={[styles.modalOverlayInner, { backgroundColor: overlayColor }]}>
          <View style={[styles.materialSelectorModal, { backgroundColor: theme.cardColor }]}>
            <View style={[styles.materialSelectorHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.materialSelectorTitle, { color: theme.text }]}>
                Select Material
              </Text>
              <TouchableOpacity onPress={() => {
                setShowUsageMaterialSelectorModal(false);
                if (!stockMaterialId) {
                  setUsageMaterialSearch("");
                }
              }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.materialSearchContainer, { backgroundColor: inputBg }]}>
              <Search size={18} color={subTextColor} />
              <TextInput
                style={[styles.materialSearchInput, { color: theme.text }]}
                placeholder="Search materials..."
                placeholderTextColor={subTextColor}
                value={usageMaterialSearch}
                onChangeText={(text) => {
                  setUsageMaterialSearch(text);
                  setDisplayedUsageMaterialsCount(10);
                  if (text === "") setStockMaterialId("");
                }}
                autoFocus
              />
            </View>

            <Text style={[styles.materialResultsCount, { color: subTextColor }]}>
              {filteredUsageMaterials.length} materials found
            </Text>

            <ScrollView
              style={styles.materialSelectorList}
              keyboardShouldPersistTaps="always"
              onScroll={({ nativeEvent }) => {
                const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
                if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20)
                  loadMoreUsageMaterials();
              }}
              scrollEventThrottle={400}
            >
              {filteredUsageMaterials.length === 0 ? (
                <View style={styles.materialEmptyState}>
                  <Text style={[styles.materialEmptyText, { color: subTextColor }]}>
                    No materials found
                  </Text>
                </View>
              ) : (
                <>
                  {displayedUsageMaterials.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.materialSelectorItem, { borderBottomColor: borderColor }]}
                      onPress={() => {
                        setStockMaterialId(m.id);
                        setUsageMaterialSearch(m.material_name);
                        setShowUsageMaterialSelectorModal(false);
                        setDisplayedUsageMaterialsCount(10);
                        if (usageErrors.material)
                          setUsageErrors((e) => ({ ...e, material: undefined }));

                        // ── NEW: load min date for this material ──────────────────
                        loadMinUsageDateForMaterial(m.id);
                        // Also reset usageDate if it falls outside the new valid range
                        setUsageDate(new Date());
                        setShowUsageMaterialSelectorModal(false);
                        setDisplayedUsageMaterialsCount(10);
                        if (usageErrors.material)
                          setUsageErrors((e) => ({ ...e, material: undefined }));
                      }}
                    >
                      <View style={styles.materialSelectorItemContent}>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.materialSelectorItemName, { color: theme.text }]}
                          >
                            {m.material_name}
                          </Text>
                        </View>
                        <Text
                          style={[styles.materialSelectorItemUnit, { color: subTextColor }]}
                        >
                          {m.unit.length > 20 ? `${m.unit.substring(0, 20)}...` : m.unit}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {hasMoreUsageMaterials && (
                    <TouchableOpacity
                      style={styles.materialLoadMore}
                      onPress={loadMoreUsageMaterials}
                    >
                      <Text style={[styles.materialLoadMoreText, { color: primaryColor }]}>
                        Load more...
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Date Pickers ───────────────────────────────────────────────────── */}
      <CustomDatePicker
        visible={showInwardDatePicker}
        onClose={() => {
          setShowInwardDatePicker(false);
        }}
        onSelect={(d: Date) => {
          setInwardDate(d);
          setInwardErrors((e) => ({ ...e, date: undefined }));
          setShowInwardDatePicker(false);
        }}
        selectedDate={inwardDate}
        theme={theme}
        isDark={isDark}
      />
      <CustomDatePicker
        visible={showUsageDatePickerCustom}
        onClose={() => {
          setShowUsageDatePickerCustom(false);
        }}
        onSelect={(d: Date) => {
          setUsageDate(d);
          setUsageErrors((e) => ({ ...e, date: undefined }));
          setShowUsageDatePickerCustom(false);
        }}
        selectedDate={usageDate}
        theme={theme}
        isDark={isDark}
        minDate={minUsageDate}
      />

      <AlertComponent />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// NOTE: Only structural / layout values live here.
// Every color is applied inline via theme tokens above.
const styles = StyleSheet.create({
  container: { flex: 1 },

  headerInfoSection: {
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(12),
    marginBottom: normalize(4),
  },
  mainTitle: { fontSize: normalize(22), fontWeight: "800", letterSpacing: -0.5 },
  subTitle: {
    fontSize: normalize(13),
    fontWeight: "500",
    marginTop: normalize(2),
    lineHeight: normalize(18),
  },

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: normalize(12),
    marginBottom: normalize(12),
    width: "100%",
  },
  actionButtonWrapper: { flex: 1, marginHorizontal: 4 },
  newMaterialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: normalize(12),
    paddingHorizontal: normalize(4),
    borderRadius: normalize(10),
    minHeight: normalize(48),
    elevation: 4,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  newMaterialText: {
    color: "#FFFFFF",
    fontSize: normalize(12),
    fontWeight: "700",
    marginLeft: normalize(4),
    textAlign: "center",
  },

  searchWrapper: {
    paddingHorizontal: normalize(14),
    paddingTop: normalize(4),
    paddingBottom: normalize(8),
    width: "100%",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: normalize(12),
    minHeight: normalize(48),
    paddingHorizontal: normalize(12),
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIconWrap: { marginRight: normalize(8), justifyContent: "center", alignItems: "center" },
  searchInput: {
    flex: 1,
    fontSize: normalize(14),
    lineHeight: normalize(20),
    includeFontPadding: false,
    textAlignVertical: "center",
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  searchClearBtn: { marginLeft: normalize(8), justifyContent: "center", alignItems: "center" },
  searchClearCircle: {
    width: normalize(18),
    height: normalize(18),
    borderRadius: normalize(9),
    backgroundColor: "#9CA3AF",
    justifyContent: "center",
    alignItems: "center",
  },
  searchResultCount: { fontSize: normalize(11), marginTop: normalize(4), marginLeft: normalize(4), fontWeight: "500" },

  headingCardContainer: {
    paddingHorizontal: normalize(16),
    marginBottom: normalize(15),
    alignItems: "flex-start",
  },
  headingPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: normalize(8),
    paddingHorizontal: normalize(16),
    borderRadius: normalize(25),
    borderWidth: 1,
  },
  listHeading: { fontSize: normalize(14), fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },

  inventoryCard: {
    padding: normalize(16),
    marginHorizontal: "3%",
    marginBottom: normalize(12),
    borderRadius: normalize(15),
    elevation: 3,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: { flexDirection: "row", alignItems: "center", width: "100%" },
  iconCircle: { width: normalize(40), height: normalize(40), borderRadius: normalize(20), justifyContent: "center", alignItems: "center" },
  headerTextContainer: { flex: 1, marginLeft: normalize(12) },
  materialName: { fontSize: normalize(16), fontWeight: "700" },
  materialUnit: { fontSize: 12, marginTop: 2 },
  cardDivider: { height: 1, width: "100%", marginVertical: normalize(12) },
  statsGrid: { width: "100%" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: normalize(12) },
  statsItem: { width: "30%" },
  statsLabel: { fontSize: normalize(11), fontWeight: "600", marginBottom: 2 },
  statsValue: { fontSize: normalize(13), fontWeight: "700" },
  noDataText: { textAlign: "center", marginTop: 40, fontSize: 15 },

  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: normalize(16),
    marginVertical: normalize(20),
    padding: normalize(10),
    borderRadius: normalize(12),
    borderWidth: 1,
  },
  pageBtn: { paddingVertical: normalize(10), paddingHorizontal: normalize(20), borderRadius: normalize(8), minWidth: normalize(100), alignItems: "center", justifyContent: "center" },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnText: { fontSize: normalize(14), fontWeight: "700" },
  pageTextCompact: { fontSize: normalize(16), fontWeight: "800" },

  sheetHeader: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 18, fontWeight: "700" },
  sheetSub: { fontSize: 12 },
  sheetCloseBtn: { padding: 6 },

  tabRow: { flexDirection: "row", borderBottomWidth: 1 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontSize: 14 },

  detailsLoaderContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 50 },
  loaderText: { marginTop: 12, fontSize: normalize(14), fontWeight: "500" },

  transCard: { padding: 16, marginVertical: 8, borderRadius: 12, borderWidth: 1 },
  transHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  dateBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  transDateText: { fontSize: 12, fontWeight: "700", marginLeft: 4, textTransform: "uppercase" },
  actionGroup: { flexDirection: "row", gap: 12 },
  amountContainer: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 },
  amountLabel: { fontSize: 13, fontWeight: "500", marginRight: 6, flexShrink: 1 },
  amountValue: { fontSize: 18, fontWeight: "800" },
  amountValue2: { fontSize: 16, fontWeight: "400" },
  commentBox: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, flexDirection: "column" },
  commentText: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  saveEditActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  saveEditButton: { marginTop: 10, backgroundColor: "#007AFF", padding: 10, borderRadius: 10, flexDirection: "row", justifyContent: "center", gap: 6 },
  saveEditText: { color: "#FFF", fontWeight: "700" },
  inputBox: { marginTop: 10, padding: 10, borderRadius: 8, fontSize: 14 },
  emptyLabel: { textAlign: "center", marginTop: 40, fontSize: 15, fontWeight: "500" },

  modalOverlay: { flex: 1, justifyContent: "center", padding: 20 },
  modalOverlayInner: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  modalBoxLarge: { padding: 24, borderRadius: 14 },
  modalBigTitle: { fontSize: 22, fontWeight: "700" },
  modalSubTitle: { fontSize: 14, marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: "600", marginTop: 14, marginBottom: 6 },
  inputField: { padding: 12, borderRadius: 10, fontSize: 14, marginTop: 0 },
  inputFieldDate: { padding: 14, borderRadius: 10, fontSize: 15, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  textArea: { padding: 12, borderRadius: 10, height: 100, textAlignVertical: "top", fontSize: 15 },
  modalFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, gap: 12 },
  cancelButton: { flex: 1, height: 48, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  cancelButtonText: { textAlign: "center", fontSize: 13, fontWeight: "600" },
  gradientButtonWrapper: { flex: 1 },
  gradientButton: { height: 48, borderRadius: 10, justifyContent: "center", alignItems: "center", elevation: 4, shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  gradientButtonText: { color: "#FFF", fontSize: 14, fontWeight: "600" },

  rowLayout: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 2 },
  flexHalf: { flex: 1 },

  suggestionBox: { marginTop: 8, padding: 12, borderRadius: 8, borderWidth: 1, zIndex: 10 },
  suggestionHeader: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  suggestionItem: { paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dropItemText: { fontSize: 15 },
  infoText: { fontSize: 11, fontStyle: "italic", marginTop: 4 },

  deleteBox: { padding: 20, borderRadius: 12, alignItems: "center", marginHorizontal: 20 },
  deleteTitle: { fontSize: 18, fontWeight: "700", marginTop: 10 },
  deleteMsg: { marginTop: 4, textAlign: "center" },
  deleteActions: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 20 },
  cancelDeleteBtn: { flex: 1, padding: 12, borderRadius: 10, marginRight: 8 },
  confirmDeleteBtn: { flex: 1, padding: 12, borderRadius: 10, marginLeft: 8 },
  cancelDeleteText: { textAlign: "center", fontWeight: "600" },
  confirmDeleteText: { textAlign: "center", fontWeight: "600", color: "#FFF" },

  toastBox: { position: "absolute", bottom: 30, right: 20, left: 20, padding: 12, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  toastText: { color: "#FFF", fontWeight: "600" },

  exportFab: { position: "absolute", bottom: 50, right: 20, width: 60, height: 60, borderRadius: 30, overflow: "hidden", elevation: 8, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  exportFabGradient: { flex: 1, justifyContent: "center", alignItems: "center" },

  materialSelectorModal: { backgroundColor: "#FFF", borderRadius: 14, height: "76%", width: "100%", overflow: "hidden" },
  materialSelectorHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  materialSelectorTitle: { fontSize: 20, fontWeight: "700" },
  materialSearchContainer: { flexDirection: "row", alignItems: "center", margin: 16, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, gap: 8 },
  materialSearchInput: { flex: 1, fontSize: 15, padding: 0 },
  materialResultsCount: { fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
  materialSelectorList: { flex: 1, paddingBottom: 20 },
  materialEmptyState: { padding: 40, alignItems: "center" },
  materialEmptyText: { fontSize: 15, textAlign: "center" },
  materialSelectorItem: { paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  materialSelectorItemContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" },
  materialSelectorItemName: { fontSize: 13, fontWeight: "500", flex: 1, marginRight: 10 },
  materialSelectorItemUnit: { fontSize: 13, flexShrink: 0 },
  materialLoadMore: { padding: 16, alignItems: "center", marginBottom: 20 },
  materialLoadMoreText: { fontSize: 14, fontWeight: "600" },

  errorText: { fontSize: 12, marginTop: 4 },
});