import URLS from "./base_url";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface SubActivity {
    subactivity_id: number;
    subactivity_name: string;
    subactivity_description?: string;
    subactivity_waitage: number;
    status_id: number | null;
}

export interface Activity {
    activity_id: number;
    activity_name: string;
    activity_description?: string;
    activity_waitage: number;
    status_id: number | null;
    subactivities: SubActivity[];
}

export interface StatusItem {
    status_id: number;
    status_name: string;
}

export interface BulkUpdateItem {
    type: "activity" | "subactivity";
    id: number;
    status_id: number;
}

export interface BulkUpdateResult {
    success: boolean;
    errors: Array<{ id: number; type: string; message: string }>;
}

export interface ActivityListResponse {
    activities: Activity[];
}

// ─── API Calls ───────────────────────────────────────────────────────────────

/**
 * Fetch all available statuses
 */
export const getStatusList = async (): Promise<StatusItem[]> => {
    try {
        const token = await AsyncStorage.getItem("access_token");

        if (!token) {
            throw new Error("No access token found");
        }

        const response = await fetch(`${URLS.BASE_URL}/activities/status-list`, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to fetch status list: ${response.status} - ${errText}`);
        }

        const json = await response.json();
        return json.data ?? json;
    } catch (error) {
        console.error("❌ getStatusList error:", error);
        throw error;
    }
};

/**
 * Fetch all activities with their sub-activities
 */
export const getActivityList = async (): Promise<ActivityListResponse> => {
    try {
        const token = await AsyncStorage.getItem("access_token");

        if (!token) {
            throw new Error("No access token found");
        }

        const response = await fetch(`${URLS.BASE_URL}/activities/GetAllGenericActivitylist`, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to fetch activity list: ${response.status} - ${errText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("❌ getActivityList error:", error);
        throw error;
    }
};

/**
 * Bulk update status for activities and/or sub-activities
 */
export const bulkUpdateStatus = async (
    updates: BulkUpdateItem[]
): Promise<BulkUpdateResult> => {
    try {
        const token = await AsyncStorage.getItem("access_token");

        if (!token) {
            throw new Error("No access token found");
        }

        const response = await fetch(`${URLS.BASE_URL}/activities/bulk-update-status`, {
            method: "PATCH",
            headers: {
                "accept": "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ updates }),
        });

        if (!response.ok) {
            if (response.status === 422) {
                const validationErr = await response.json();
                throw new Error(validationErr.detail[0]?.msg || "Validation Error");
            }
            const errText = await response.text();
            throw new Error(`Failed to update statuses: ${response.status} - ${errText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("❌ bulkUpdateStatus error:", error);
        throw error;
    }
};

/**
 * Extracts a readable error message from a fetch/API error
 */
export const extractErrorMsg = (e: any, fallback = "Something went wrong"): string => {
    const detail = e?.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
        return detail.map((d: any) => d?.msg ?? String(d)).join(", ");
    return e?.message ?? fallback;
};
