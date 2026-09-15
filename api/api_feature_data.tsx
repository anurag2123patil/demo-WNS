import URLS from "./base_url";

export interface FeatureDataFormResponse {
  feature_id: number;
  layer_id: number;
  project_id: number;
  attributes: Attribute[];
  saved_values: SavedValues;
}

export interface Attribute {
  attribute_id: number;
  attribute_type: "simple" | "group";
  name: string;
  question: string | null;
  input_type_name: string | null;
  possible_values: string | null;
  values: string | null;
  is_photo_required: boolean;
  image_count: number;
  is_mandatory: boolean;
  display_order: number;
  depends_on_id?: number | null;
  group?: AttributeGroup | null;
}

export interface AttributeGroup {
  group_id: number;
  group_name: string;
  applicable_to: string;
  allow_multiple: boolean;
  display_order: number;
  show_today_volume?: boolean;
  show_cumulative_volume?: boolean;
  today_volume?: number;
  cumulative_volume?: number;
  is_photo_required?: boolean;   // ← lives on group, not on attr
  image_count?: number;          // ← max images per group upload
  children: GroupChildAttribute[];
}

export interface GroupChildAttribute {
  child_id: number;
  name: string;
  input_type: string;
  possible_values: string | null;
  values: string | null;
  formula: string | null;
  unit_name?: string | null;
  is_photo_required: boolean;
  is_mandatory: boolean;
  display_order: number;
  is_group_by?: boolean;
}

export interface SavedValues {
  simple_values: SimpleValue[];
  group_entries: GroupEntry[];
}

export interface SimpleValue {
  data_id: number;
  attribute_id: number;
  value_text: string | null;
  value_num: number | null;
}

export interface GroupEntry {
  group_data_id: number;
  attribute_id: number;
  entry_index: number;
  created_at?: string;
  children: GroupEntryChildValue[];
}

export interface GroupEntryChildValue {
  value_id: number;
  child_id: number;
  child_name: string;
  input_type?: string;
  value_text: string | null;
  value_num: number | null;
  is_calculated: boolean;
}


export const getFeatureDataForm = async (
  layerId: number, 
  featureId: number,
  token: string
): Promise<FeatureDataFormResponse> => {
  const url = `${URLS.BASE_URL}/feature-data/form/${layerId}?feature_id=${featureId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch feature data form: ${response.status} - ${errText}`);
  }

  return response.json();
};

export interface AttributeImage {
  image_id: number;
  feature_id: number;
  attribute_id: number;
  file_path: string;
  filename: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  address?: string | null;
  uploaded_by?: number | null;
  uploaded_at?: string | null;
}

export interface SubmitPayload {
  feature_id: number;
  layer_id: number;
  simple_values: Array<{
    attribute_id: number;
    value_num: number | null;
    value_text: string | null;
  }>;
  group_entries: Array<{
    attribute_id: number;
    entry_index: number;
    children: Array<{
      child_id: number;
      value_num: number | null;
      value_text: string | null;
      is_calculated: boolean;
    }>;
  }>;
}

export interface GroupSummaryRow {
  entry_index: number;
  group_data_id: number;
  created_at: string;
  child_name: string;
  display_order: number;
  input_type: string;
  unit_name?: string | null;
  value_text: string | null;
  value_num: number | null;
  value: string;
}

export interface GroupSummaryTotal {
  child_name: string;
  input_type: string;
  total: number | string;
}

export interface GroupSummaryResponse {
  summary_type: "today" | "cumulative";
  rows: GroupSummaryRow[];
  totals: GroupSummaryTotal[];
}

export const deleteGroupEntry = async (
  groupDataId: number,
  token: string
): Promise<{ success: boolean; message: string }> => {
  const url = `${URLS.BASE_URL}/feature-data/entry/${groupDataId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to delete group entry: ${response.status} - ${errText}`);
  }
  return response.json();
};

export const submitFeatureData = async (
  payload: SubmitPayload,
  token: string
): Promise<{ success: boolean; saved_simple: number; saved_entries: number }> => {
  const url = `${URLS.BASE_URL}/feature-data/submit`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to submit feature data: ${response.status} - ${errText}`);
  }
  return response.json();
};

export const getGroupSummary = async (
  featureId: number,
  attributeId: number,
  summaryType: "today" | "cumulative",
  token: string
): Promise<GroupSummaryResponse> => {
  const url = `${URLS.BASE_URL}/feature-data/${featureId}/group-summary/${attributeId}?summary_type=${summaryType}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch group summary: ${response.status} - ${errText}`);
  }
  return response.json();
};

export const uploadAttributeImage = async (
  featureId: number,
  attributeId: number,
  layerId: number,
  fileUri: string, // in React Native, we pass the local file URI
  fileName: string,
  fileType: string,
  token: string,
  childId?: number
): Promise<{ success: boolean; data: AttributeImage }> => {
  const url = `${URLS.BASE_URL}/feature-data/upload-image`;
  
  const formData = new FormData();
  formData.append("feature_id", String(featureId));
  formData.append("attribute_id", String(attributeId));
  formData.append("layer_id", String(layerId));
  
  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: fileType,
  } as any);

  if (childId !== undefined) {
    formData.append("child_id", String(childId));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      // Don't set Content-Type for FormData in React Native, fetch does it automatically with boundary
      'Authorization': `Bearer ${token}`
    },
    body: formData,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to upload attribute image: ${response.status} - ${errText}`);
  }
  return response.json();
};

export const getAttributeImages = async (
  featureId: number,
  attributeId: number,
  token: string,
  childId?: number
): Promise<{ success: boolean; count: number; data: AttributeImage[] }> => {
  let url = `${URLS.BASE_URL}/feature-data/${featureId}/images?attribute_id=${attributeId}`;
  if (childId !== undefined) {
    url += `&child_id=${childId}`;
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch attribute images: ${response.status} - ${errText}`);
  }
  return response.json();
};

export const deleteAttributeImage = async (
  imageId: number,
  token: string
): Promise<{ success: boolean; message: string }> => {
  const url = `${URLS.BASE_URL}/feature-data/image/${imageId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to delete attribute image: ${response.status} - ${errText}`);
  }
  return response.json();
};
