import URLS from "./base_url";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export const fetchMaterialDetails = async ({
    project_id,
    page = 1,
    limit = 10,
    search = "",
}: {
    project_id: number;
    page?: number;
    limit?: number;
    search?: string;
}) => {
    try {
        const token = await AsyncStorage.getItem("access_token");

        if (!token) {
            throw new Error("No access token found");
        }

        const url =
            `${URLS.BASE_URL}/material/details`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(
                `Failed to fetch materials: ${response.status} - ${errText}`
            );
        }

        return await response.json();
    } catch (error) {
        console.error("❌ fetchMaterialDetails error:", error);
        throw error;
    }
};


export const addMaterial = async (payload: {
    material_name: string;
    unit: string;
    material_id: number;
    tender_quantity?: number;
}) => {
    const token = await AsyncStorage.getItem("access_token");

    const response = await fetch(`${URLS.BASE_URL}/material/add`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }

    return response.json();
};



export const fetchInwardDetails = async ({
    material_id,
    project_id,
    page = 1,
    limit = 20,
}: {
    material_id: number;
    project_id: number;
    page?: number;
    limit?: number;
}) => {
    const token = await AsyncStorage.getItem("access_token");

    const url =
        `${URLS.BASE_URL}/material/inward-details` +
        `?material_id=${material_id}&project_id=${project_id}&page=${page}&limit=${limit}`;

    const res = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error(await res.text());
    }

    return res.json();
};






export const fetchUsageDetails = async ({
    material_id,
    project_id,
    page = 1,
    limit = 20,
}: {
    material_id: number;
    project_id: number;
    page?: number;
    limit?: number;
}) => {
    const token = await AsyncStorage.getItem("access_token");

    const url =
        `${URLS.BASE_URL}/material/usage-details` +
        `?material_id=${material_id}&project_id=${project_id}&page=${page}&limit=${limit}`;

    const res = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        throw new Error(await res.text());
    }

    return res.json();
};


export const addInwardStock = async (payload: {
    wimsd_id: number;
    material_id: number;
    quantity: number;
    date: string;
    comment: string;
    threshold: number;
}) => {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
        throw new Error("No access token found");
    }

    // Path updated to /api/v1/material/inward as per documentation
    const url = `${URLS.BASE_URL}/material/inward`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        if (response.status === 422) {
            const validationErr = await response.json();
            throw new Error(validationErr.detail[0]?.msg || "Validation Error");
        }
        const errText = await response.text();
        throw new Error(errText);
    }

    return await response.json();
};


export const addUsageStock = async (payload: {
    material_id: number;
    project_id: number;
    used_quantity: number;
    waste_quantity: number;
    date: string;
    comment?: string;
    created_by: number;
}) => {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
        throw new Error("No access token found");
    }

    const response = await fetch(`${URLS.BASE_URL}/material/usage`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }

    return response.json();
};

export const fetchMaterialDropdown = async () => {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
        throw new Error("No access token found");
    }

    const response = await fetch(
        `${URLS.BASE_URL}/material/projectMaterial`,
        {
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }

    return response.json(); // [{ material_id, material_name }]
};



export const deleteUsageStock = async (payload: {
    id: number;
    is_enable: boolean;
    updated_by: number;
}) => {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
        throw new Error("No access token found");
    }

    const response = await fetch(
        `${URLS.BASE_URL}/material/usage/delete`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }

    return response.json();
};


export const deleteInwardStock = async (payload: {
    id: number;
    is_enable: boolean;
    updated_by: number;
}) => {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
        throw new Error("No access token found");
    }

    const response = await fetch(
        `${URLS.BASE_URL}/material/inward/delete`,
        {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        }
    );

    if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
    }

    return response.json();
};



export const updateStockTransaction = async (
    type: "inward" | "usage",
    payload: {
        id: number;
        quantity?: number;
        used_quantity?: number;
        waste_quantity?: number;
        date: string;
        comment?: string;
        updated_by: number;
    }
) => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token");

    const response = await fetch(
        `${URLS.BASE_URL}/material/${type}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        }
    );

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
};



export const getExportLink = async (project_id: number) => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token");

    const response = await fetch(
        `${URLS.BASE_URL}/material/export-link?project_id=${project_id}`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(await response.text());
    }

    return response.json();
};

export const fetchProjectMaterial = async () => {
    try {
        const token = await AsyncStorage.getItem("access_token");

        if (!token) {
            throw new Error("No access token found");
        }

        // Updated URL to match Swagger: /api/v1/material/projectMaterial
        // Note: Swagger showed no query params, it likely uses the project_id from your JWT token
        const url = `${URLS.BASE_URL}/material/projectMaterial`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(
                `Failed to fetch dropdown: ${response.status} - ${errText}`
            );
        }

        return await response.json();
        // This will return the array: [{ material_id, material_name, unit, threshold }, ...]
    } catch (error) {
        console.error("❌ fetchMaterialDropdown error:", error);
        throw error;
    }
};


export const updateInwardQuantity = async (
    wimsd_id: number,
    quantity: number,
    threshold: number,   // ← add this
    tender_quantity?: number
) => {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
        throw new Error("No access token found");
    }

    const bodyData: any = { quantity, threshold };
    if (tender_quantity !== undefined) {
        bodyData.tender_quantity = tender_quantity;
    }

    const response = await fetch(
        `${URLS.BASE_URL}/material/inward_qty/${wimsd_id}`,
        {
            method: "PUT",
            headers: {
                "accept": "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(bodyData),
        }
    );

    if (!response.ok) {
        if (response.status === 422) {
            const validationErr = await response.json();
            throw new Error(validationErr.detail[0]?.msg || "Validation Error");
        }
        const errText = await response.text();
        throw new Error(errText);
    }

    return response.json();
};

export interface InventoryDetails {
    tender_quantity?: number;
    inward: {
        id: number;
        material_name: string;
        quantity: number;
        unit: string;
        date: string;
        comment: string;
    }[];
    outward: {
        id: number;
        material_name: string;
        unit: string;
        used_quantity: number;
        waste_quantity: number;
        date: string;
    }[];
}

export const fetchInventoryDetails = async (wimpr_id: number): Promise<InventoryDetails> => {
    try {
        const token = await AsyncStorage.getItem("access_token");

        if (!token) {
            throw new Error("No access token found");
        }

        // Endpoint: /api/v1/material/get_inventory_details/{wimpr_id}
        const url = `${URLS.BASE_URL}/material/get_inventory_details/${wimpr_id}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            if (response.status === 422) {
                const validationErr = await response.json();
                throw new Error(validationErr.detail[0]?.msg || "Validation Error");
            }
            const errText = await response.text();
            throw new Error(
                `Failed to fetch inventory details: ${response.status} - ${errText}`
            );
        }

        return await response.json();
    } catch (error) {
        console.error("❌ fetchInventoryDetails error:", error);
        throw error;
    }
};