import URLS from "./base_url";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ProjectDocument {
    wids_id: number;
    wids_filename: string;
    wids_filepath: string;
    wids_category: string;
    wids_doc_type: string;
    wids_isenable: boolean;
    wids_createdat: string;
    wids_updatedby: string | null;
    file_size_display: string | null;
}

export interface ProjectDocumentsResponse {
    project_id: number;
    total_count: number;
    documents: ProjectDocument[];
}


// ─── GET Project Documents ───────────────────────────────────────────────────
export const getProjectDocuments = async (): Promise<ProjectDocumentsResponse> => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const res = await fetch(`${URLS.BASE_URL}/project_documents/list`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error ${res.status}: ${errorText}`);
    }

    return res.json();
};


export interface DownloadDocumentResponse {
    url: string;
    filename: string;
    content_type: string;
    expires_in: number;
}


export const getDocumentDownloadUrl = async (documentId: number): Promise<DownloadDocumentResponse> => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const res = await fetch(`${URLS.BASE_URL}/project_documents/${documentId}/download`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const errorData = await res.json();
        // Handle 422 or other errors
        throw new Error(errorData?.detail?.[0]?.msg || `Download failed: ${res.status}`);
    }

    return res.json();
};

export const getDocumentViewUrl = async (documentId: number): Promise<DownloadDocumentResponse> => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const res = await fetch(`${URLS.BASE_URL}/project_documents/${documentId}/view`, {
        method: "GET",
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData?.detail?.[0]?.msg || `View request failed: ${res.status}`);
    }

    return res.json();
};


// ─── DELETE Document ─────────────────────────────────────────────────────────
export const deleteDocument = async (documentId: number, hardDelete: boolean = true): Promise<any> => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const res = await fetch(`${URLS.BASE_URL}/project_documents/${documentId}?hard_delete=${hardDelete}`, {
        method: "DELETE",
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
        },
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData?.detail?.[0]?.msg || `Delete failed: ${res.status}`);
    }

    return res.json();
};


export const uploadProjectDocument = async (
    fileUri: string,
    fileName: string,
    mimeType: string,
    displayName: string,
    tags: string
): Promise<any> => {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const formData = new FormData();

    // We create a file object that React Native's fetch understands
    formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType || 'application/octet-stream',
    } as any);

    formData.append('document_name', displayName);
    formData.append('tags', tags);

    const res = await fetch(`${URLS.BASE_URL}/project_documents/upload`, {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${token}`,
            // 'Content-Type': 'multipart/form-data' is NOT needed here, 
            // fetch sets it automatically with the correct boundary.
        },
        body: formData,
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData?.detail?.[0]?.msg || `Upload failed: ${res.status}`);
    }

    return res.json();
};