import URLS from "./base_url";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Layer {
    layer_id: number;
    layer_name: string;
}

export interface LayersResponse {
    layers: Layer[];
}

export interface DailyReportEntry {
    wire_id: number;
    project_id: number;
    start_date: string;
    end_date: string;
    report_type: string;
    is_enable: boolean;
    created_by: number;
    created_at: string;
    updated_by: number | null;
    updated_at: string | null;
    report_path: string;
}

export interface DailyReportResponse {
    message: string;
    generated: boolean;
    project_id: number;
    report_date: string;
    report_url?: string;
    reports?: DailyReportEntry[];
}

export interface WeeklyReportResponse {
    message: string;
    generated: boolean;
    project_id: number;
    start_date: string;
    end_date: string;
    // present when generated: true
    report_url?: string;
    // present when generated: false (already exists)
    reports?: DailyReportEntry[];
}


// ─── GET all layers ───────────────────────────────────────────────────────────
export const getLayers = async (): Promise<LayersResponse> => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token");

    const res = await fetch(`${URLS.BASE_URL}/dashboard/layers`, {
        method: "GET",
        headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

// ─── Fetch Excel as base64 string ────────────────────────────────────────────
export const generateProjectExceleport = async (layerIds: number[]): Promise<string> => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token");

    const res = await fetch(`${URLS.BASE_URL}/excel_export/export/excel`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ selected_layers: layerIds }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status} - ${await res.text()}`);

    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunkSize)));
    }
    return btoa(binary);
};

// ─── Daily PDF Report ─────────────────────────────────────────────────────────
export const generateProjectPDFReportDaily = async (
    reportDate: string
): Promise<DailyReportResponse> => {
    try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) throw new Error("No access token found");

        const url = `${URLS.BASE_URL}/pdf-export/daily-report?report_date=${encodeURIComponent(reportDate)}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to generate daily report: ${response.status} - ${errText}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error("❌ generateProjectPDFReportDaily error:", error.message);
        throw error;
    }
};

// ─── Download a PDF from a public S3 URL → Blob ──────────────────────────────
export const downloadPdfFromUrl = async (pdfUrl: string): Promise<Blob> => {
    const response = await fetch(pdfUrl);
    if (!response.ok) {
        throw new Error(`Failed to download PDF from URL: ${response.status}`);
    }
    return await response.blob();
};

// ─── As-Of-Today PDF Report ───────────────────────────────────────────────────
export const generateProjectPDFReportAsOfToday = async (
    reportDate?: string
): Promise<{ blob: Blob; filename: string }> => {
    try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) throw new Error("No access token found");

        const url = reportDate
            ? `${URLS.BASE_URL}/pdf-export/as-of-today-report?report_date=${encodeURIComponent(reportDate)}`
            : `${URLS.BASE_URL}/pdf-export/as-of-today-report`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/pdf",
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to generate report: ${response.status} - ${errText}`);
        }

        // Extract filename from content-disposition header
        const disposition = response.headers.get("content-disposition") ?? "";
        const match = disposition.match(/filename="?([^"]+)"?/);
        const filename = match?.[1] ?? `waterInfra_Borsad_A_${Date.now()}.pdf`;

        const blob = await response.blob();
        return { blob, filename };
    } catch (error: any) {
        console.error("❌ generateProjectPDFReportAsOfToday error:", error.message);
        throw error;
    }
};

// ─── Weekly PDF Report ────────────────────────────────────────────────────────
export const generateProjectPDFReportWeekly = async (
    startDate: string,
    endDate: string
): Promise<WeeklyReportResponse> => {
    try {
        const token = await AsyncStorage.getItem("access_token");
        if (!token) throw new Error("No access token found");

        const url = `${URLS.BASE_URL}/pdf-export/weekly-report?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to generate weekly report: ${response.status} - ${errText}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error("❌ generateProjectPDFReportWeekly error:", error.message);
        throw error;
    }
};

// Keep old export name as alias for backward compatibility
export const generateProjectPDFReporDaily = generateProjectPDFReportDaily;