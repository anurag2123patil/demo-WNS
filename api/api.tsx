import URLS from "./base_url";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import * as FileSystem from "expo-file-system";
const layerConfigCache = new Map<string, any>();

export const fetchMe = async () => {
  const token = await AsyncStorage.getItem("access_token");

  if (!token) {
    throw new Error("No access token found");
  }

  const response = await fetch(`${URLS.BASE_URL}/users/me`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(err);
  }

  return response.json();
  // { id, email, username, firstname, lastname, ... }
};

export const registerUser = async (data: {
  email: string;
  username: string;
  firstname: string;
  lastname: string;
  mobile_no: string;
  password: string;
  role_id: number;
  project_id?: number;
  client_id?: number;
  created_by?: number;
}) => {
  try {
    const response = await fetch(`${URLS.BASE_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Register failed: ${response.status} - ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("❌ registerUser error:", error);
    throw error;
  }
};

/**
 * POST /api/v1/auth/login
 */
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error("Request timed out. Please try again.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
};
export const loginUser = async (data: { username: string; password: string }) => {
  try {
    const response = await fetchWithTimeout(`${URLS.BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Login failed: ${response.status} - ${errText}`);
    }

    const json = await response.json();

    if (json?.access_token) {
      await AsyncStorage.setItem("access_token", json.access_token);
    }

    return json; // { access_token, ... }
  } catch (error) {
    console.error("❌ loginUser error:", error);
    throw error;
  }
};


export const fetchMyProjects = async () => {
  try {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
      throw new Error("No access token found");
    }

    const response = await fetch(
      `${URLS.BASE_URL}/users/me/projects`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Failed to fetch projects: ${response.status} - ${errText}`
      );
    }

    return await response.json(); // [{ id, name }]
  } catch (error) {
    console.error("❌ fetchMyProjects error:", error);
    throw error;
  }
};

export const selectProjectApi = async (project_id: number, token: string) => {
  const response = await fetch(
    `${URLS.BASE_URL}/auth/me/select-project?project_id=${project_id}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Select project failed: ${errText}`);
  }

  return response.json(); // { access_token, token_type }
};

export interface KPIResponse {
  total_length: number;
  remaining_length: number;
  completed_length: number;
  connection_data: {
    total_connection: number;
    done_connection: number;
  };
  inventory_alert_data: {
    wimpr_id: number;
    material_name: string;
    unit: string;
    threshold: number;
    used_stock: number;
    total_stock: number;
    remaining_percentage: number;
    wimu_updatedat: string;
  }[];
  progress_data: {
    wipr_id: number;
    wipr_name: string;
    curr_date: string;
    duration_in_days1: number;
    min_wpp_start_date: string;
    max_wpp_end_date: string;
    perce_crr_dt: number;
    progress: number;
  };
  manhole_data?: {
    total_manholes: number;
    verified_manholes: number;
    has_manhole_in_weightage: boolean;
    has_house_connection_in_weightage: boolean;
  };
}
const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries = 3,
  timeoutMs = 60000  // 60s for file uploads
): Promise<Response> => {
  let lastError: any;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);
      return response;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;

      const isRetryable =
        err.name === 'AbortError' ||
        err.message === 'Network request failed' ||
        err.message?.includes('timeout');

      if (!isRetryable || attempt === retries) break;

      const delay = attempt * 2000; // 2s, 4s
      console.warn(`⚠️ Attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  throw lastError;
};
// ---- Helper to build headers ----
const buildHeaders = (token: string) => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});


export const fetchKPI = async (token: string): Promise<KPIResponse> => {
  const response = await fetch(`${URLS.BASE_URL}/dashboard/kpi`, {
    method: "GET",
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to fetch KPI");
  }

  return response.json();
};


export const getLayers = async (token: string) => {
  const response = await fetch(
    `${URLS.BASE_URL}/dashboard/layers`, {
    method: "GET",
    headers: buildHeaders(token),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to fetch KPI");
  }

  return response.json();
}



export async function fetchLayerConfig(
  layerName: string,
  projectId: number,
  token: string,
  retries = 2,
  delayMs = 500
) {
  const cleanName = layerName.includes(':')
    ? layerName.split(':')[1]
    : layerName;

  // ── Cache key includes projectId so different projects get fresh configs ──
  const cacheKey = `${cleanName}-${projectId}`;
  if (layerConfigCache.has(cacheKey)) {
    return layerConfigCache.get(cacheKey);
  }

  try {
    if (!token) throw new Error("Access token missing");

    const url = `${URLS.BASE_URL}/geoserver/${encodeURIComponent(cleanName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 503 && retries > 0) {
        await new Promise(res => setTimeout(res, delayMs));
        return fetchLayerConfig(layerName, projectId, token, retries - 1, delayMs * 2);
      }
      throw new Error(`Failed to fetch layer config: ${response.status}`);
    }

    const data = await response.json();

    // ── Store in cache ──
    layerConfigCache.set(cacheKey, data);
    return data;
  } catch (error) {
    console.error('fetchLayerConfig error:', error);
    throw error;
  }
}
export const clearLayerConfigCache = () => layerConfigCache.clear();

export interface Feature {
  id: number;
  label: string;
}
export const fetchFeatures = async (
  layer_id: number,
  page: number = 1,
  limit: number = 10
): Promise<{ features: Feature[]; total?: number }> => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const url =
      `${URLS.BASE_URL}/dashboard/features/${layer_id}` +
      `?page=${page}&limit=${limit}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to fetch features: ${response.status} - ${errText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ fetchFeatures error for layer ${layer_id}:`, error);
    throw error;
  }
};



export async function fetchVerificationFeatures(
  isVerified: boolean,
  token: string
) {
  const url = `${URLS.BASE_URL}/dashboard/verification_features?is_verified=${isVerified}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed: ${response.status}`);
  }

  return response.json();
}


export const verifyFeature = async (
  featureId: number,
  layerId: number,
  isVerified: boolean,
  token: string
) => {
  const url = `${URLS.BASE_URL}/dashboard/feature/verification`;

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      feature_id: featureId,
      layer_id: layerId,
      is_verified: isVerified,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.detail || `Verification failed (${response.status})`);
  }

  return response.json(); // ✅ returns updated feature
};


export const verifyFeatureBulk = async (
  featureIds: number[],
  layerId: number,
  isVerified: boolean,
  token: string
) => {
  const url = `${URLS.BASE_URL}/dashboard/feature/verification/bulk`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      feature_ids: featureIds,
      layer_id: layerId,
      is_verified: isVerified,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData?.detail || `Verification failed (${response.status})`);
  }

  return response.json(); // ✅ returns updated feature
};



export const fetchWFSConfig = async (
  layerName: string,
  featureId: string | number,
  token: string
) => {
  try {
    if (!token) {
      throw new Error("Access token missing");
    }

    // Clean layer name (remove workspace if present)
    const cleanName = layerName.includes(':')
      ? layerName.split(':')[1]
      : layerName;

    const url = `${URLS.BASE_URL}/geoserver/wfs/config/${encodeURIComponent(cleanName)}/${featureId}`;

    console.log("🔍 Fetching WFS Config:", url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch WFS config: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ fetchWFSConfig error:', error);
    throw error;
  }
};


export interface SheetLink {
  wigsl_id: number;
  wigsl_googlesheet_link: string;
  wigsl_createdat: string;
  wigsl_updatedat: string | null;

}
export interface CameraLink {
  wicl_id: number;
  wicl_camera_link: string;
  wicl_createdat: string;
  wicl_updatedat: string;
}
export interface FeatureInfoResponse {
  geometryData: GeometryData[];
  geomStatusList: any[];
  stp_table: any[];
  execution_mastertable: any[];
  image_date: any[];
  GeomDetails: any[];
  role_id: number;
  uni_status_list: any[];
  machuni_status_list: any[];
  remark: any[];
  use_name: string;
  // ✅ ADD THESE TWO LINES
  sheet_links?: SheetLink[];
  camera_links?: CameraLink[];
}

export interface GeometryData {
  label: string;
  length: number;
  diameter: number;
  isverify: boolean;
  material: string;
  status_id: number;
  start_invertlevel: number;
  end_invertlevel: number;
  start_manhole: string;
  end_manhole: string;
  gl_start: number;
  gl_end: number;
  proj_id: number;
  proj_name: string;
  project_type_id: number;
  updated_date: string | null;
  usdeflen: number | null;
}

export interface FeatureInfoResponse {
  geometryData: GeometryData[];
  geomStatusList: any[];
  stp_table: any[];
  execution_mastertable: any[];
  image_date: any[];
  GeomDetails: any[];
  role_id: number;
  uni_status_list: any[];
  machuni_status_list: any[];
  remark: any[];
  use_name: string;
}

export const fetchFeatureInfo = async (
  payload: FeatureInfoResponse
): Promise<FeatureInfoResponse> => {
  const token = await AsyncStorage.getItem("access_token");
  if (!token) throw new Error("No access token found");

  const url = `${URLS.BASE_URL}/geoserver/featureinfo_bkp`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Failed to fetch feature info: ${response.status} - ${errText}`
    );
  }

  const data = await response.json();

  if (!data || typeof data !== "object") {
    throw new Error("Invalid feature info response");
  }

  return data as FeatureInfoResponse;
};


export interface FeatureInfoPayload {
  layerName: string;
  featureId: string;
}
// This matches your Swagger: POST /api/v1/geoserver/featureinfo
export const fetchFeatureInfoUpdated = async (
  payload: FeatureInfoPayload // Accepts { layerName, featureId }
): Promise<any> => { // Use your specific Response type if available
  const token = await AsyncStorage.getItem("access_token");
  if (!token) throw new Error("No access token found");

  const url = `${URLS.BASE_URL}/geoserver/featureinfo`;

  console.log("📡 API Call: fetchFeatureInfoUpdated with:", payload);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    // Spread the payload object directly into JSON.stringify
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("❌ API Error:", errText);
    throw new Error(`Enriched fetch failed: ${response.status}`);
  }

  return await response.json();
};




export interface UpdatePipelinePayload {
  layer_id: number;
  featureId: number;
  status_id: number;
  adusdefln?: number;
  locationdata?: string | null;
  location_error?: string | null;
  file?: {
    uri: string;
    name: string;
    type: string;
  };
  remark?: string;
}

export const updatePipelineDetails = async (payload: UpdatePipelinePayload) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const formData = new FormData();

    formData.append('layer_id', String(payload.layer_id));
    formData.append('featureId', String(payload.featureId));
    formData.append('status_id', String(payload.status_id));
    formData.append('adusdefln', payload.adusdefln ? String(payload.adusdefln) : '0');
    formData.append('locationdata', payload.locationdata || "");
    formData.append('remark', payload.remark || "");
    formData.append('location_error', payload.location_error || "");

    // ✅ FIXED: Pass plain { uri, name, type } object — React Native handles multipart natively
    // Do NOT strip file:// on iOS — RN fetch polyfill requires it
    if (payload.file && payload.file.uri) {
      formData.append("file", {
        uri: payload.file.uri,
        name: payload.file.name,
        type: payload.file.type,
      } as any);
    }

    console.log("📤 Sending Pipeline Details...");

    const response = await fetchWithRetry(`${URLS.BASE_URL}/dashboard/update-pipeline-details`, {
      method: "POST",
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        // ✅ Do NOT set Content-Type — RN sets multipart boundary automatically
      },
      body: formData,
    });

    let data;
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.log("📄 Raw response:", text);
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }
    }

    if (!response.ok) {
      throw new Error(data.message || `Server error: ${response.status}`);
    }

    console.log("✅ Pipeline API Response:", data);
    return data;

  } catch (error: any) {
    console.error('❌ updatePipelineDetails error:', error);
    throw error;
  }
};




export interface UpdateManholePayload {
  layer_id: number;
  featureId: number;
  status_id: number;
  depthactul?: number | null;
  locationdata?: string | null;
  location_error?: string | null;
  file?: any;
  remark?: string;
  wimg_diameter?: string | null;
  wimg_bottom_diameter?: string | null;
  wimg_manhole_type?: string | null;
  wimg_type_of_manhole?: string | null;
  wimg_strata_type?: string | null;
}

export const updateManholeDetails = async (payload: UpdateManholePayload) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const formData = new FormData();

    formData.append("layer_id", String(payload.layer_id));
    formData.append("featureId", String(payload.featureId));
    formData.append("status_id", String(payload.status_id));

    if (payload.status_id === 1 && payload.depthactul !== undefined && payload.depthactul !== null) {
      formData.append("depthactul", String(payload.depthactul));
    }

    formData.append('locationdata', payload.locationdata || "");
    formData.append('remark', payload.remark || "");
    formData.append('location_error', payload.location_error || "");

    if (payload.wimg_diameter !== undefined && payload.wimg_diameter !== null) formData.append("wimg_diameter", String(payload.wimg_diameter));
    if (payload.wimg_bottom_diameter !== undefined && payload.wimg_bottom_diameter !== null) formData.append("wimg_bottom_diameter", String(payload.wimg_bottom_diameter));
    if (payload.wimg_manhole_type !== undefined && payload.wimg_manhole_type !== null) formData.append("wimg_manhole_type", String(payload.wimg_manhole_type));
    if (payload.wimg_type_of_manhole !== undefined && payload.wimg_type_of_manhole !== null) formData.append("wimg_type_of_manhole", String(payload.wimg_type_of_manhole));
    if (payload.wimg_strata_type !== undefined && payload.wimg_strata_type !== null) formData.append("wimg_strata_type", String(payload.wimg_strata_type));

    // ✅ FIXED: Use actual mimeType/type from ImagePicker result, not hardcoded 'image/jpeg'
    // Do NOT strip file:// — React Native requires it for the fetch polyfill
    if (payload.file && payload.file.uri) {
      const mimeType = payload.file.mimeType || payload.file.type || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      formData.append('file', {
        uri: payload.file.uri,
        type: mimeType,
        name: payload.file.fileName || `manhole_${payload.featureId}_${Date.now()}.${ext}`,
      } as any);
    }

    console.log("📤 Sending Manhole Details...");

    const response = await fetchWithRetry(`${URLS.BASE_URL}/dashboard/update-manhole-details`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        // ✅ Do NOT set Content-Type
      },
      body: formData,
    });

    const resText = await response.text();
    console.log("📥 Server Response:", resText);

    let resJson;
    try {
      resJson = JSON.parse(resText);
    } catch (e) {
      throw new Error(`Server Error: ${resText}`);
    }

    if (!response.ok) {
      const errorMsg = resJson.detail || resJson.data || resJson.message || "Manhole update failed";
      throw new Error(errorMsg);
    }

    return resJson;
  } catch (error: any) {
    console.error("❌ updateManholeDetails error:", error.message);
    throw error;
  }
};


export interface UpdateSpecialPayload {
  layer_id: number;
  featureId: number;
  status_id: number;
  locationdata?: string | null;
  location_error?: string | null;
  upfile?: any;
}

/**
 * POST /api/v1/dashboard/update-junction-details
 */
export const updateJunctionDetails = async (payload: UpdateSpecialPayload) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const formData = new FormData();

    formData.append("layer_id", String(payload.layer_id));
    formData.append("featureId", String(payload.featureId));
    formData.append("status_id", String(payload.status_id));
    formData.append('locationdata', payload.locationdata || "");
    formData.append('location_error', payload.location_error || "");

    // ✅ FIXED: Pass plain { uri, name, type } — do NOT strip file:// or manipulate URI
    // Removed: cleanedUri / Platform.OS iOS strip — breaks RN fetch polyfill
    if (payload.upfile && payload.upfile.uri) {
      const mimeType = payload.upfile.mimeType || payload.upfile.type || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      formData.append("upfile", {
        uri: payload.upfile.uri,
        name: `junction_${payload.featureId}_${Date.now()}.${ext}`,
        type: mimeType,
      } as any);
    }

    console.log('📤 Sending Junction Details...');

    const response = await fetchWithRetry(`${URLS.BASE_URL}/dashboard/update-junction-details`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        // ✅ Do NOT set Content-Type
      },
      body: formData,
    });

    const resJson = await response.json();

    if (!response.ok) {
      throw new Error(resJson.data || resJson.message || "Junction update failed");
    }

    return resJson;
  } catch (error: any) {
    console.error("❌ updateJunctionDetails error:", error.message);
    throw error;
  }
};


export interface UpdateTankPayload {
  feature_id: number;
  layer_id: number;
  finish: string;
  sheet_links: any[];
  camera_links: string;
  status_id: number;
  tank_remark?: string;
  execution_table: any[];
  locationdata?: string | null;
  location_error?: string | null;
  upfile?: any;
}


export const updateTankDetails = async (payload: UpdateTankPayload) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const formData = new FormData();

    formData.append("feature_id", String(payload.feature_id));
    formData.append("layer_id", String(payload.layer_id));
    formData.append("status_id", String(payload.status_id));
    formData.append("finish", String(payload.finish ?? "false"));
    formData.append("tank_remark", payload.tank_remark || "");

    let sheetLinksArray = [];
    if (typeof payload.sheet_links === 'string') {
      try { sheetLinksArray = JSON.parse(payload.sheet_links); } catch (e) { sheetLinksArray = []; }
    } else {
      sheetLinksArray = payload.sheet_links || [];
    }
    const formattedSheetLinks = sheetLinksArray.map(link => ({
      id: link.id || null,
      link: link.link || link.wigsl_googlesheet_link || '',
      tag: String(link.tag || link.wigsl_tags || '')
    }));
    formData.append("sheet_links", JSON.stringify(formattedSheetLinks));

    let cameraLinksArray = [];
    if (typeof payload.camera_links === 'string') {
      try { cameraLinksArray = JSON.parse(payload.camera_links); } catch (e) { cameraLinksArray = []; }
    } else {
      cameraLinksArray = payload.camera_links || [];
    }
    const formattedCameraLinks = cameraLinksArray.map(link => ({
      id: link.id || null,
      link: link.link || link.wicl_camera_link || '',
      tag: String(link.tag || link.tags || '')
    }));
    formData.append("camera_links", JSON.stringify(formattedCameraLinks));

    formData.append("execution_table", payload.execution_table || "[]");
    formData.append('locationdata', payload.locationdata || "");
    formData.append('location_error', payload.location_error || "");

    // ✅ FIXED: Pass plain { uri, name, type } — removed Platform.OS iOS uri.replace("file://", "")
    // Stripping file:// breaks React Native's fetch polyfill on iOS
    if (payload.upfile && payload.upfile.uri) {
      const mimeType = payload.upfile.mimeType || payload.upfile.type || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      formData.append("upfile", {
        uri: payload.upfile.uri,
        name: `tank_${payload.feature_id}_${Date.now()}.${ext}`,
        type: mimeType,
      } as any);
    }

    console.log("📤 Sending Tank Details...");

    const response = await fetchWithRetry(
      `${URLS.BASE_URL}/dashboard/update-tank-details`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          // ✅ Do NOT set Content-Type
        },
        body: formData,
      }
    );

    const resJson = await response.json();

    if (!response.ok) {
      console.error("❌ Server error response:", resJson);
      throw new Error(resJson.message || "Failed to update tank details");
    }

    return resJson;
  } catch (error: any) {
    console.error("❌ updateTankDetails error:", error.message);
    throw error;
  }
};



export interface UpdateSTPPayload {
  layer_id: number;
  featureId: number;
  status_id: number;
  no_unit: number;
  tablarr: string;
  stp_remark?: string | null;
  sheet_links: string;
  camera_links: string;
  locationdata?: string | null;
  location_error?: string | null;
  upfile?: any;
}


export const updateSTPDetails = async (payload: UpdateSTPPayload) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const formData = new FormData();

    formData.append("layer_id", String(payload.layer_id));
    formData.append("featureId", String(payload.featureId));
    formData.append("status_id", String(payload.status_id));
    formData.append("no_unit", String(payload.no_unit));

    const ensureString = (val: any) =>
      typeof val === 'string' ? val : JSON.stringify(val || []);

    formData.append("tablarr", ensureString(payload.tablarr));
    formData.append("sheet_links", ensureString(payload.sheet_links));
    formData.append("camera_links", ensureString(payload.camera_links));
    formData.append("stp_remark", payload.stp_remark || "");
    formData.append('locationdata', payload.locationdata || "");
    formData.append('location_error', payload.location_error || "");

    // ✅ FIXED: Pass plain { uri, name, type } — removed Platform.OS iOS uri.replace("file://", "")
    // Stripping file:// breaks React Native's fetch polyfill on iOS
    if (payload.upfile && payload.upfile.uri) {
      const mimeType = payload.upfile.mimeType || payload.upfile.type || 'image/jpeg';
      const ext = mimeType.split('/')[1] || 'jpg';
      formData.append("upfile", {
        uri: payload.upfile.uri,
        name: `stp_${payload.featureId}_${Date.now()}.${ext}`,
        type: mimeType,
      } as any);
    }

    console.log("📤 Sending STP Details...");

    const response = await fetchWithRetry(`${URLS.BASE_URL}/stpdetails/update-details`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // ✅ Do NOT set Content-Type
      },
      body: formData,
    });

    const resText = await response.text();
    let resJson;

    try {
      resJson = JSON.parse(resText);
    } catch (e) {
      throw new Error(`Server Error (500): Check backend logs. Response: ${resText.substring(0, 100)}`);
    }

    if (!response.ok) {
      const errorMsg = resJson.message || resJson.detail || `Error ${response.status}`;
      throw new Error(errorMsg);
    }

    return resJson;
  } catch (error: any) {
    console.error("❌ updateSTPDetails error:", error.message);
    throw error;
  }
};

export interface SaveRemarkPayload {
  wilm_id?: number;
  wiresu_id?: number;
  unit_id?: number;
  feature_id?: number;
  isFeature: "true" | "false";
  isUnit: "true" | "false";
  isSubActivity: "true" | "false";
  remark: string;
}


export const saveRemark = async (payload: SaveRemarkPayload) => {
  try {
    const token = await AsyncStorage.getItem("access_token");

    if (!token) {
      throw new Error("No access token found");
    }

    console.log("📤 Saving Remark Payload:", payload);
    console.log("🌐 Sending to:", `${URLS.BASE_URL}/remark/save`);

    const response = await fetch(`${URLS.BASE_URL}/remark/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("📡 Response Status:", response.status);

    const resText = await response.text();
    console.log("📨 Raw Response:", resText);

    let resJson;

    try {
      resJson = JSON.parse(resText);
      console.log("✅ Parsed Response:", resJson);
    } catch (e) {
      console.error("❌ Failed to parse response as JSON:", resText);
      throw new Error(`Server Error: ${resText.substring(0, 100)}`);
    }

    if (!response.ok) {
      const errorMsg = resJson.message || resJson.detail || `Error ${response.status}`;
      console.error("❌ API Error:", errorMsg);
      throw new Error(errorMsg);
    }

    return resJson;
  } catch (error: any) {
    console.error("❌ saveRemark error:", error.message);
    console.error("❌ saveRemark stack:", error.stack);
    throw error;
  }
};

export interface GetRemarkHistoryParams {
  isFeature: boolean;
  isUnit: boolean;
  isSubActivity: boolean;
  feature_id?: number;
  unit_id?: number;
  wiresu_id?: number;
  wilm_id?: number;
}

export const fetchRemarkHistory = async (
  params: GetRemarkHistoryParams
) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const query = new URLSearchParams({
      isFeature: String(params.isFeature),
      isUnit: String(params.isUnit),
      isSubActivity: String(params.isSubActivity),
    });

    if (params.feature_id)
      query.append("feature_id", String(params.feature_id));
    if (params.unit_id)
      query.append("unit_id", String(params.unit_id));
    if (params.wiresu_id)
      query.append("wiresu_id", String(params.wiresu_id));

    const url = `${URLS.BASE_URL}/remark/history?${query.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const resText = await response.text();
    let resJson;

    try {
      resJson = JSON.parse(resText);
    } catch {
      throw new Error(`Server Error: ${resText}`);
    }

    if (!response.ok) {
      throw new Error(resJson.message || resJson.detail || "Failed to fetch remark history");
    }

    return resJson;
  } catch (error: any) {
    console.error("❌ fetchRemarkHistory error:", error.message);
    throw error;
  }
};


export interface UploadUnitImagePayload {
  unit_id: number;
  feature_id: number;
  locationdata?: string | null;
  location_error?: string | null;
  file: any;
}


export const uploadUnitImage = async (payload: UploadUnitImagePayload) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const formData = new FormData();

    formData.append("featureId", String(payload.feature_id));
    formData.append("unitId", String(payload.unit_id));
    formData.append('locationdata', payload.locationdata || "");
    formData.append('location_error', payload.location_error || "");

    // ✅ FIXED: Pass plain { uri, name, type } — removed Platform.OS iOS uri.replace("file://", "")
    // Stripping file:// breaks React Native's fetch polyfill on iOS
    if (payload.file && payload.file.uri) {
      const mimeType = payload.file.mimeType || payload.file.type || "image/jpeg";
      const ext = mimeType.split('/')[1] || 'jpg';
      formData.append('file', {
        uri: payload.file.uri,
        name: payload.file.fileName || payload.file.name || `unit_${payload.unit_id}_${Date.now()}.${ext}`,
        type: mimeType,
      } as any);
    }

    console.log("📤 POSTing unit image...");
    const targetUrl = `${URLS.BASE_URL}/unit_images/upload-unit-image`;

    const response = await fetchWithRetry(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        // ✅ Do NOT set Content-Type
      },
      body: formData,
    });

    const resText = await response.text();
    let resJson;
    try {
      resJson = JSON.parse(resText);
    } catch (e) {
      console.log("📄 Raw Server Response:", resText);
      throw new Error("Server returned invalid JSON");
    }

    if (!response.ok) {
      if (response.status === 422) {
        console.log("❌ Validation Error Detail:", JSON.stringify(resJson.detail));
      }
      throw new Error(resJson.message || `Error ${response.status}`);
    }

    return resJson;
  } catch (error: any) {
    console.error('❌ uploadUnitImage Exception:', error.message);
    throw error;
  }
};



export const getUnitImage = async (unitId: number) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const targetUrl = `${URLS.BASE_URL}/unit_images/unit-image/${unitId}`;
    console.log("🔍 Fetching unit image for Unit:", unitId);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const resText = await response.text();
    let data;

    try {
      data = JSON.parse(resText);
    } catch (e) {
      throw new Error("Server returned invalid JSON");
    }

    if (!response.ok) {
      throw new Error(data.message || `Error ${response.status}: Failed to fetch image`);
    }

    console.log("✅ Unit Image Path Received:", data);
    return data;

  } catch (error: any) {
    console.error('❌ getUnitImage error:', error.message);
    throw error;
  }
};



export interface UploadSubActivityImagePayload {
  unit_id: number;
  feature_id: number;
  locationdata?: string | null;
  location_error?: string | null;
  file: any;
  subactivityId: number;
}

export const uploadSubActivityImage = async (payload: UploadSubActivityImagePayload) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const formData = new FormData();

    formData.append("featureId", String(payload.feature_id));
    formData.append("unit_id", String(payload.unit_id));
    formData.append("subactivityId", String(payload.subactivityId));
    formData.append('locationdata', payload.locationdata || "");
    formData.append('location_error', payload.location_error || "");

    // ✅ FIXED: Pass plain { uri, name, type } — do NOT strip file:// or copy content:// URIs
    // React Native's native networking handles both file:// and content:// URIs directly
    if (payload.file && payload.file.uri) {
      const mimeType = payload.file.mimeType || payload.file.type || "image/jpeg";
      const ext = mimeType.split('/')[1] || 'jpg';
      formData.append('file', {
        uri: payload.file.uri,
        name: payload.file.fileName || payload.file.name || `sub_${payload.subactivityId}_${Date.now()}.${ext}`,
        type: mimeType,
      } as any);
    }

    const targetUrl = `${URLS.BASE_URL}/unit_images/upload-subactivity-image`;

    // Retry logic (up to 3 attempts)
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`📤 Upload attempt ${attempt}/3 to:`, targetUrl);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            // ✅ Do NOT set Content-Type
          },
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const resText = await response.text();
        let resJson;
        try {
          resJson = JSON.parse(resText);
        } catch (e) {
          throw new Error(`Server returned invalid JSON: ${resText.substring(0, 100)}`);
        }

        if (!response.ok) {
          if (response.status === 422) {
            console.log("❌ Validation Error Detail:", JSON.stringify(resJson.detail));
          }
          throw new Error(resJson.message || `Error ${response.status}`);
        }

        console.log(`✅ Upload succeeded on attempt ${attempt}`);
        return resJson;

      } catch (err: any) {
        lastError = err;
        const isNetworkError = err.message === 'Network request failed' || err.name === 'AbortError';

        if (isNetworkError && attempt < 3) {
          const delay = attempt * 1500;
          console.warn(`⚠️ Attempt ${attempt} failed (${err.message}). Retrying in ${delay}ms...`);
          await new Promise(res => setTimeout(res, delay));
        } else {
          break;
        }
      }
    }

    throw lastError;

  } catch (error: any) {
    console.error('❌ uploadSubActivityImage Exception:', error.message);
    throw error;
  }
};



export const getSubImages = async (subactivity_id: number) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const targetUrl = `${URLS.BASE_URL}/unit_images/subactivity-images/${subactivity_id}`;
    console.log("🔍 Fetching sub-activity image for ID:", subactivity_id);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const resText = await response.text();
    let data;

    try {
      data = JSON.parse(resText);
    } catch (e) {
      throw new Error("Server returned invalid JSON");
    }

    if (!response.ok) {
      throw new Error(data.message || `Error ${response.status}: Failed to fetch image`);
    }

    console.log("✅ Sub-activity Image Path Received:", data);
    return data;

  } catch (error: any) {
    console.error('❌ getSubImage error:', error.message);
    throw error;
  }
};


export const fetchSubactivityListByUnit = async (unitId: number) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const targetUrl = `${URLS.BASE_URL}/subactivity/get-subactivity-list-by-unit?unitId=${unitId}`;
    console.log("🔍 Fetching sub-activities for Unit ID:", unitId);

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const resText = await response.text();
    let resJson;

    try {
      resJson = JSON.parse(resText);
    } catch (e) {
      console.log("📄 Raw Server Response:", resText);
      throw new Error("Server returned invalid JSON");
    }

    if (!response.ok) {
      if (response.status === 422) {
        console.log("❌ Validation Error Detail:", JSON.stringify(resJson.detail));
      }
      throw new Error(resJson.message || `Error ${response.status}`);
    }

    return resJson;
  } catch (error: any) {
    console.error('❌ fetchSubactivityListByUnit Exception:', error.message);
    throw error;
  }
};


export const saveSubactivityList = async (payload: any[]) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const targetUrl = `${URLS.BASE_URL}/subactivity/save-subactivity-list-by-unit`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const resJson = await response.json();

    if (!response.ok) {
      if (response.status === 422 && resJson.detail) {
        console.log("❌ API Validation Error:", JSON.stringify(resJson.detail));
        const errorMessage = resJson.detail[0]?.msg || "Invalid data format sent to server";
        throw new Error(errorMessage);
      }
      throw new Error(resJson.message || `Error ${response.status}: Failed to save`);
    }

    console.log("✅ Subactivity List Saved Successfully");
    return resJson;

  } catch (error: any) {
    console.error('❌ saveSubactivityList Exception:', error.message);
    throw error;
  }
};


export const saveUnitWeightage = async (payload: {
  unitId: number;
  weightageId: number;
  excavation: number;
  steel: number;
  concrete: number;
  subActivityWeightage: number;
}) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const targetUrl = `${URLS.BASE_URL}/subactivity/save-unit-weightage`;

    console.log("📤 Saving Unit Weightage to:", targetUrl);
    console.log("📤 Payload:", JSON.stringify(payload, null, 2));

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const resJson = await response.json();

    if (!response.ok) {
      if (response.status === 400 && resJson.detail) {
        console.log("❌ Business Logic Error:", resJson.detail);
        throw new Error(resJson.detail);
      }
      if (response.status === 422 && resJson.detail) {
        console.log("❌ Validation Error Detail:", JSON.stringify(resJson.detail));
        const msg = Array.isArray(resJson.detail)
          ? resJson.detail[0]?.msg
          : resJson.detail;
        throw new Error(msg || "Validation Error: Check your input.");
      }
      throw new Error(resJson.message || `Error ${response.status}`);
    }

    console.log("✅ Weightage saved successfully");
    return resJson;
  } catch (error: any) {
    console.error('❌ saveUnitWeightage Exception:', error.message);
    throw error;
  }
};


export interface ExtentResponse {
  bbox: {
    minx: number;
    miny: number;
    maxx: number;
    maxy: number;
  };
  projection: string;
  center: [number, number];
  zoom_level: number;
  feature_count: number;
  layer_name: string;
}

export const getProjectExtent = async (projectId: number): Promise<ExtentResponse> => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");
    const targetUrl = `${URLS.BASE_URL}/geoserver/extent/project/${projectId}`;

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const resText = await response.text();
    let resJson;

    try {
      resJson = JSON.parse(resText);
    } catch (e) {
      console.log("📄 Raw Server Response:", resText);
      throw new Error("Server returned invalid JSON");
    }

    if (!response.ok) {
      if (response.status === 422) {
        console.log("❌ Validation Error Detail:", JSON.stringify(resJson.detail));
      }
      throw new Error(resJson.message || `Error ${response.status}: Failed to fetch extent`);
    }

    return resJson;
  } catch (error: any) {
    console.error('❌ getProjectExtent Exception:', error.message);
    throw error;
  }
};


export const saveSubactivityUsage = async (payload: {
  wistpsu_fk_wiresu_id: number;
  wistpsu_excavation: number;
  wistpsu_steel: number;
  wistpsu_concrete: number;
  unit_id: number;
}) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");
    const response = await fetch(`${URLS.BASE_URL}/subactivity/save-usage`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data;
  } catch (error: any) {
    throw new Error(error.message || "Failed to save material usage");
  }
};


export interface ProjectCompleted {
  wipr_id: number;
  wipr_name: string;
  curr_date: string;
  duration_in_days1: number;
  min_wpp_start_date: string;
  max_wpp_end_date: string;
  perce_crr_dt: number;
  progress: number;
  runningBack: boolean;
}

export interface InventoryAlert {
  wimpr_id: number;
  material_name: string;
  unit: string;
  threshold: number;
  used_stock: number;
  wimu_updatedat: string;
  total_stock: number;
  remaining_percentage: number;
}

export interface VerificationAlertItem {
  label_name: string;
  wilm_name: string;
  cnt: number;
}
export interface VerificationAlert {
  pipeline_alert: VerificationAlertItem[];
  tank_alert: VerificationAlertItem[];
  stp_alert: VerificationAlertItem[];
  junction_alert: any[];
  manhole_alert: any[];
  machinery_alert: any[];
  labour_alert: any[];
}

export interface AlertsData {
  project_completed: ProjectCompleted[];
  data: InventoryAlert[];
  verificationAlert: VerificationAlert;
}

export interface AlertsResponse {
  status_code: string;
  status: boolean;
  data: AlertsData;
}

export const fetchProjectAlerts = async (): Promise<AlertsResponse> => {
  try {
    const token = await AsyncStorage.getItem("access_token");

    const response = await fetch(`${URLS.BASE_URL}/alerts/getProjectAlerts`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json: AlertsResponse = await response.json();
    return json;
  } catch (error) {
    console.error('fetchProjectAlerts error:', error);
    throw error;
  }
};

export interface HouseConnectionCountResponse {
  proj_id: number;
  total_connection: number;
  done_connection: number;
  todays_connection: number;
}

export interface SaveHouseConnectionPayload {
  no_of_connection: number;
  total_count: number;
}


export const getHouseConnectionCount =
  async (): Promise<HouseConnectionCountResponse> => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (!token) throw new Error("No access token found");

      const response = await fetch(`${URLS.BASE_URL}/house_connection/count`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(
          `Failed to fetch house connection count: ${response.status} - ${errText}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error("❌ getHouseConnectionCount error:", error);
      throw error;
    }
  };


export const saveHouseConnection = async (
  payload: SaveHouseConnectionPayload
): Promise<string> => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const response = await fetch(`${URLS.BASE_URL}/house_connection/save`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const resText = await response.text();
    let resJson;

    try {
      resJson = JSON.parse(resText);
    } catch {
      throw new Error(`Server Error: ${resText}`);
    }

    if (!response.ok) {
      if (response.status === 422 && resJson?.detail) {
        const msg = Array.isArray(resJson.detail)
          ? resJson.detail[0]?.msg
          : resJson.detail;
        throw new Error(msg || "Validation error");
      }
      throw new Error(resJson?.message || resJson?.detail || `Error ${response.status}`);
    }

    return resJson;
  } catch (error) {
    console.error("❌ saveHouseConnection error:", error);
    throw error;
  }
};



export interface DeleteImagePayload {
  image_id: number;
  isFeature: "true" | "false";
  isUnit: "true" | "false";
  isSubActivity: "true" | "false";
}

export const deleteUnitImage = async (payload: DeleteImagePayload) => {
  try {
    const token = await AsyncStorage.getItem("access_token");
    if (!token) throw new Error("No access token found");

    const targetUrl = `${URLS.BASE_URL}/unit_images/delete`;
    console.log("🗑️ Deleting Image:", payload.image_id);

    const response = await fetch(targetUrl, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const resText = await response.text();
    let resJson;

    try {
      resJson = JSON.parse(resText);
    } catch (e) {
      throw new Error("Server returned invalid JSON");
    }

    if (!response.ok) {
      if (response.status === 422) {
        console.error("❌ Validation Error:", resJson.detail);
        throw new Error(resJson.detail[0]?.msg || "Validation failed");
      }
      throw new Error(resJson.message || `Error ${response.status}: Delete failed`);
    }

    console.log("✅ Image Deleted Successfully from:", resJson.deleted_from);
    return resJson;

  } catch (error: any) {
    console.error("❌ deleteUnitImage Error:", error.message);
    throw error;
  }
};


