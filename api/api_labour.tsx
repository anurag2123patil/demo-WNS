import URLS from "./base_url";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";


// GET edit data
export const fetchLabourMachineryForEdit = async (project_id: number) => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token");

    const res = await fetch(
        `${URLS.BASE_URL}/labour_machinery/edit/${project_id}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!res.ok) throw new Error(await res.text());
    return res.json();
};

// PUT edit save
// PUT edit save
export const updateLabourMachinery = async (payload: {
    date: string;
    labours: { wilpd_id?: number; wplm_id?: number; quantity: number }[];
    machineries: {
        wmpr_id?: number;
        machinery_id?: number;
        quantity: number;
        used_hrs: number;
        remark: string;
        machinery_name: string; // Ensure this is in the interface
    }[];
}) => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token");

    const body = {
        date: payload.date,
        labours: payload.labours.map(l => ({
            ...(l.wilpd_id ? { wilpd_id: l.wilpd_id } : { wplm_id: l.wplm_id }),
            quantity: l.quantity,
        })),
        machineries: payload.machineries.map(m => ({
            ...(m.wmpr_id ? { wmpr_id: m.wmpr_id } : { machinery_id: m.machinery_id }),
            quantity: m.quantity,
            used_hrs: m.used_hrs,
            remark: m.remark || "",
            // This is the critical line to send the custom name to your backend
            machinery_name: m.machinery_name || "",
        })),
    };

    console.log("🚀 updateLabourMachinery final payload:", JSON.stringify(body, null, 2));

    const res = await fetch(
        `${URLS.BASE_URL}/labour_machinery/update`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        }
    );

    const responseText = await res.text();
    if (!res.ok) throw new Error(responseText || "Update failed");

    try {
        return JSON.parse(responseText);
    } catch (e) {
        return { success: true };
    }
};
export interface LabourDetail {
    wplm_id: number;
    wilpd_id: number;
    name: string;
    Qty: number;
}

export interface MachineryDetail {
    wmpr_id: number;
    machinery_id: number;
    machinery_name: string;
    qty: number;
}

export interface ProjectLabourMachinerySummary {
    project_id: number;
    duration: string;
    machineryData: {
        Date: string;
        proj_id: number;
        labour_details: LabourDetail[];
        machinery_details: MachineryDetail[];
    }[];
    LabourLabelsdata: {
        wlm_name: string;
        wlm_id: number;
    }[];
}

export const fetchProjectLabourMachinerySummary = async (
    project_id: number,
    duration: string = "weak" // Defaulting to "weak" as seen in your example
): Promise<ProjectLabourMachinerySummary> => {
    try {
        const token = await AsyncStorage.getItem("access_token");

        if (!token) {
            throw new Error("No access token found");
        }

        const url =
            `${URLS.BASE_URL}/labour_machinery/project-labour-machinery-summary` +
            `?project_id=${project_id}&duration=${encodeURIComponent(duration)}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(
                `Failed to fetch labour machinery summary: ${response.status} - ${errText}`
            );
        }

        return await response.json();
    } catch (error) {
        console.error("❌ fetchProjectLabourMachinerySummary error:", error);
        throw error;
    }
};


export const fetchMachineryDropdown = async () => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const response = await fetch(
        `${URLS.BASE_URL}/labour_machinery/machinery-dropdown`,
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
    // [{ machinery_id, machinery_name }]
};
export const fetchProjectLabours = async (projectId: number) => {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
        throw new Error("No access token found");
    }

    const response = await fetch(
        `${URLS.BASE_URL}/labour_machinery/project-labours?project_id=${projectId}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to fetch project labours: ${err}`);
    }

    return response.json() as Promise<
        {
            wplm_id: number;
            labour_name: string;
        }[]
    >;
};



export const saveLabourMachinery = async (payload: any) => {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
        throw new Error("No access token found");
    }

    const response = await fetch(
        `${URLS.BASE_URL}/labour_machinery/save`,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Save failed: ${err}`);
    }

    return response.json();
};

export const deleteLabourMachineryByDate = async (date: string) => {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
        throw new Error("No access token found");
    }

    const response = await fetch(
        `${URLS.BASE_URL}/labour_machinery/delete-by-date`,
        {
            method: "DELETE",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                date: date,
            }),
        }
    );

    const responseText = await response.text();

    if (!response.ok) {
        throw new Error(responseText || "Delete failed");
    }

    try {
        return JSON.parse(responseText);
    } catch (e) {
        return { success: true };
    }
};