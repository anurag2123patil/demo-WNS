import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert, Platform } from "react-native";
import * as XLSX from "xlsx-js-style";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface InventoryItem {
  material_id: string;
  material_name: string;
  unit: string;
  total_qty: number;
  total_usage: number;
  today_usage: number;
  remaining: number;
  wastage: number;
  today_wastage: number;
}

export const handleExportInventory = async (
  inventory: InventoryItem[],
  projectId: number | string,
  showSuccessCallback?: (message: string) => void
) => {
  if (!inventory || inventory.length === 0) {
    Alert.alert("No Data", "No inventory data available to export");
    return;
  }

  try {
    const headerFill = { fgColor: { rgb: "2563EB" } };
    const headerFont = { bold: true, color: { rgb: "FFFFFF" }, sz: 11 };
    const headerAlign = { horizontal: "center", vertical: "middle", wrapText: true };
    const thinBorder = {
      top: { style: "thin", color: { rgb: "D1D5DB" } },
      bottom: { style: "thin", color: { rgb: "D1D5DB" } },
      left: { style: "thin", color: { rgb: "D1D5DB" } },
      right: { style: "thin", color: { rgb: "D1D5DB" } },
    };
    const evenRowFill = { fgColor: { rgb: "F3F4F6" } };

    const headers = [
      "Sr No", "Material Name", "Unit", "Total Qty", "Total Usage",
      "Today's Commulative Usage", "Total Wastage",
      "Today's Commulative Wastage", "Remaining Quantity",
    ];

    const wsData: any[][] = [headers];
    inventory.forEach((item, index) => {
      wsData.push([
        index + 1, item.material_name, item.unit, item.total_qty,
        item.total_usage, item.today_usage, item.wastage,
        item.today_wastage, item.remaining,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
      { wch: 28 }, { wch: 16 }, { wch: 30 }, { wch: 20 },
    ];
    ws["!rows"] = [{ hpx: 24 }];

    const totalRows = wsData.length;
    const totalCols = headers.length;
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        const cellRef = XLSX.utils.encode_cell({ c: col, r: row });
        const cell = ws[cellRef];
        if (!cell) continue;

        if (row === 0) {
          cell.s = { font: headerFont, fill: headerFill, alignment: headerAlign, border: thinBorder };
        } else {
          const isNumericCol = col === 0 || col >= 3;
          const isEvenRow = row % 2 === 0;
          cell.s = {
            font: { sz: 11, color: { rgb: "1F2937" } },
            alignment: { horizontal: isNumericCol ? "right" : "left", vertical: "middle" },
            border: thinBorder,
            ...(isEvenRow ? { fill: evenRowFill } : {}),
            ...(col === 0 ? { numFmt: "0" } : {}),
            ...(col >= 3 ? { numFmt: "0.00" } : {}),
          };
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Material Inventory");
    const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

    const fileName = `material_inventory_${projectId}_${new Date().toISOString().split("T")[0]}.xlsx`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, wbout, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (Platform.OS === "android") {
      await handleAndroidDownload(fileUri, fileName, showSuccessCallback);
    } else {
      await handleIOSSave(fileUri, fileName, showSuccessCallback);
    }
  } catch (error) {
    console.error("❌ Export failed:", error);
    Alert.alert("Export Failed", "Unable to export inventory. Please try again.");
  }
};

const DOWNLOADS_URI_KEY = "inventory_downloads_directory_uri";

const handleAndroidDownload = async (
  fileUri: string,
  fileName: string,
  showSuccessCallback?: (message: string) => void
) => {
  try {
    const SAF = FileSystem.StorageAccessFramework;

    // ✅ Check if we already have a saved Downloads URI
    let directoryUri = await AsyncStorage.getItem(DOWNLOADS_URI_KEY);

    if (!directoryUri) {
      // First time only — show the folder picker
      const result = await SAF.requestDirectoryPermissionsAsync(
        "content://com.android.externalstorage.documents/tree/primary%3ADownload"
      );

      if (!result.granted) {
        // User cancelled picker — fall back to share sheet
        await shareFile(fileUri, fileName, showSuccessCallback);
        return;
      }

      // ✅ Save URI permanently so we never ask again
      directoryUri = result.directoryUri;
      await AsyncStorage.setItem(DOWNLOADS_URI_KEY, directoryUri);
    }

    // Read temp file
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    try {
      // Write directly to saved Downloads folder — no picker shown
      const destUri = await SAF.createFileAsync(
        directoryUri,
        fileName,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      await SAF.writeAsStringAsync(destUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (showSuccessCallback) {
        showSuccessCallback("Excel saved to Downloads folder");
      } else {
        Alert.alert("✅ Downloaded", `${fileName} saved to your Downloads folder.`);
      }
    } catch (writeError) {
      // ✅ Saved URI may have expired (app reinstall / OS revoked it)
      // Clear it and retry once — will show picker again this one time
      console.warn("⚠️ Saved URI invalid, clearing and retrying...", writeError);
      await AsyncStorage.removeItem(DOWNLOADS_URI_KEY);
      await handleAndroidDownload(fileUri, fileName, showSuccessCallback);
    }
  } catch (error) {
    console.error("❌ Android download failed:", error);
    await shareFile(fileUri, fileName, showSuccessCallback);
  }
};

/**
 * iOS: Share sheet is the only option due to Apple sandbox restrictions
 */
const handleIOSSave = async (
  fileUri: string,
  fileName: string,
  showSuccessCallback?: (message: string) => void
) => {
  await shareFile(fileUri, fileName, showSuccessCallback);
};

/**
 * Fallback: Native share dialog (used for iOS always, Android as fallback)
 */
const shareFile = async (
  fileUri: string,
  fileName: string,
  showSuccessCallback?: (message: string) => void
) => {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: `Save ${fileName}`,
        UTI: "com.microsoft.excel.xlsx",
      });
      if (showSuccessCallback) {
        showSuccessCallback("Excel file exported successfully");
      }
    } else {
      Alert.alert("Export Complete", `File saved as ${fileName} in app documents folder`);
    }
  } catch (error) {
    console.error("❌ Share failed:", error);
    Alert.alert("Notice", "File created but sharing unavailable");
  }
};

export default handleExportInventory;