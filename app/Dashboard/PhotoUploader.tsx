import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Modal, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, X, Maximize2, Trash2 } from 'lucide-react-native';
import { uploadAttributeImage, deleteAttributeImage, getAttributeImages, AttributeImage } from '../../api/api_feature_data';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../hooks/useAlert';
import { useTheme } from '../../contexts/ThemeContext';

interface PhotoUploaderProps {
  featureId: number;
  attributeId: number;
  layerId: number;
  imageCount: number;
  isRequired: boolean;
  editMode: boolean;
  disabled?: boolean;
  childId?: number;
  onCountChange?: (count: number) => void;
  stampImageWithLocation?: (uri: string) => Promise<string>; 
  processImage?: (uri: string) => Promise<{ uri: string }>;
}

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

const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  featureId,
  attributeId,
  layerId,
  imageCount,
  isRequired,
  editMode,
  disabled = false,
  childId,
  onCountChange,
  stampImageWithLocation,
  processImage,
}) => {
  const { token } = useAuth();
  const { showAlert, AlertComponent } = useAlert();
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme, isDark);

  const [images, setImages] = useState<AttributeImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [zoomImage, setZoomImage] = useState<AttributeImage | null>(null);

  const maxAllowed = imageCount > 0 ? imageCount : 10;
  const canAddMore = images.length < maxAllowed;
  useEffect(() => {
    onCountChange?.(images.length);
  }, [images.length]);
  useEffect(() => {
    let cancelled = false;
    if (!token) return;

    getAttributeImages(featureId, attributeId, token, childId)
      .then((res) => {
        if (!cancelled && res.success) {
          setImages(res.data || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load images", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingInitial(false);
      });

    return () => {
      cancelled = true;
    };
  }, [featureId, attributeId, childId, token]);

  const handleDelete = async (img: AttributeImage) => {
    if (disabled || !token) return;
    try {
      const res = await deleteAttributeImage(img.image_id, token);
      if (res.success) {
        setImages((prev) => prev.filter((i) => i.image_id !== img.image_id));
        showAlert("Success", "Image deleted.", "success");
      }
    } catch (err) {
      console.error(err);
      showAlert("Error", "Failed to delete image.", "error");
    }
  };

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        handleUpload(result.assets[0].uri, false); // ← no stamping for gallery
      }
    } catch (error: any) {
      console.error("Gallery picker error:", error);
      showAlert("Error", "Could not open gallery picker.", "error");
    }
  };

const pickFromCamera = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    showAlert("Permission Denied", "Camera permission is required to take photos.", "error");
    return;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
  });
  if (!result.canceled && result.assets && result.assets.length > 0) {
    handleUpload(result.assets[0].uri, true);   // ← stamp camera captures
  }
};

  const handleCapture = () => {
    if (disabled) return;
    if (!canAddMore) {
      showAlert("Limit Reached", `Maximum ${maxAllowed} image(s) allowed.`, "error");
      return;
    }
    showAlert("Add Photo", "Choose a source", "info", [
      { text: "Camera", style: "default", onPress: pickFromCamera },
      { text: "Gallery", style: "default", onPress: pickFromGallery },
      { text: "Cancel", style: "cancel", onPress: () => { } },
    ]);
  };

  const handleUpload = async (uri: string, fromCamera: boolean = false) => {
  if (!token) return;
  setUploading(true);
  try {
    let finalUri = uri;

    if (processImage) {
      try {
        const processed = await processImage(uri);
        finalUri = processed.uri;
      } catch (e) {
        console.warn('Image processing failed, using original', e);
      }
    }

    // ── Geo-tag stamping (camera captures only, matches feature-image behavior) ──
    if (fromCamera && stampImageWithLocation) {
      try {
        finalUri = await stampImageWithLocation(finalUri);
      } catch (e) {
        console.warn('Geo-tag stamping failed, uploading original image', e);
      }
    }

    const fileName = finalUri.split('/').pop() || 'photo.jpg';
    const fileType = 'image/jpeg';

    const res = await uploadAttributeImage(
      featureId,
      attributeId,
      layerId,
      finalUri,
      fileName,
      fileType,
      token,
      childId
    );

    if (res.success && res.data) {
      setImages((prev) => [...prev, res.data]);
      showAlert("Success", "Image uploaded.", "success");
    }
  } catch (err) {
    console.error(err);
    showAlert("Error", "Failed to upload image.", "error");
  } finally {
    setUploading(false);
  }
};

  return (
    <View style={styles.container}>
      {/* ── Upload Button (edit mode only) ── */}
      {editMode && (
        <TouchableOpacity
          style={[
            styles.button,
            isRequired ? styles.buttonRequired : styles.buttonNormal,
            (!canAddMore || uploading || disabled) && styles.buttonDisabled,
          ]}
          onPress={handleCapture}
          disabled={!canAddMore || uploading || disabled}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={disabled ? (isDark ? '#64748B' : '#94A3B8') : (isRequired ? '#B45309' : theme.text)} />
          ) : (
            <Camera size={16} color={disabled ? (isDark ? '#64748B' : '#94A3B8') : (isRequired ? '#B45309' : theme.text)} />
          )}
          <Text style={[
            styles.buttonText, 
            isRequired ? styles.buttonTextRequired : styles.buttonTextNormal,
            disabled && { color: isDark ? '#64748B' : '#94A3B8' }
          ]}>
            {uploading ? 'Uploading...' : isRequired ? 'Attach photo (required)' : 'Attach photo'}
          </Text>
          {/* Always show count like web: (current/max) */}
          <Text style={[
            styles.countText, 
            isRequired && { color: isDark ? '#FCD34D' : '#B45309' },
            disabled && { color: isDark ? '#64748B' : '#94A3B8' }
          ]}>
            ({images.length}/{maxAllowed})
          </Text>
        </TouchableOpacity>
      )}

      {/* ── Images Gallery ── */}
      {loadingInitial ? (
        <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
      ) : images.length > 0 ? (
        <View style={styles.imageList}>
          {images.map((item) => (
            <View key={String(item.image_id)} style={{ width: 110 }}>
              <View style={styles.imageWrapper}>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => setZoomImage(item)} activeOpacity={0.85}>
                  <Image source={{ uri: item.file_path }} style={styles.thumbnail} />
                  {/* Zoom hint overlay in view mode or when disabled */}
                  {(!editMode || disabled) && (
                    <View style={styles.zoomOverlay}>
                      <View style={styles.zoomIconWrapper}>
                        <Maximize2 size={14} color="#374151" />
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
                {/* Delete button in edit mode only when allowable to edit */}
                {editMode && !disabled && (
                  <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
                    <X size={12} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
              {(item.uploaded_by || item.uploaded_at) && (
                <View style={{ paddingTop: 6, paddingHorizontal: 2, paddingBottom: 10 }}>
                  {!!item.uploaded_by && (
                    <Text style={{ fontSize: 11, color: theme.text, fontWeight: '600' }} numberOfLines={2}>
                      Uploaded By - {item.uploaded_by}
                    </Text>
                  )}
                  {!!item.uploaded_at && (
                    <Text style={{ fontSize: 10, color: theme.text, marginTop: 2, fontWeight: '400' }} numberOfLines={2}>
                      Uploaded At - {formatDateTime(item.uploaded_at)}
                    </Text>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
      ) : (
        /* No image placeholder — shown in both modes */
        !editMode && (
          <View style={styles.noImagePlaceholder}>
            <Camera size={20} color={theme.subtext} strokeWidth={1.5} />
            <Text style={styles.noImageText}>No photo uploaded yet</Text>
          </View>
        )
      )}

      {/* ── Fullscreen Zoom Modal ── */}
      <Modal visible={!!zoomImage} transparent animationType="fade" onRequestClose={() => setZoomImage(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>{zoomImage?.filename}</Text>
              <TouchableOpacity onPress={() => setZoomImage(null)} style={styles.closeButton}>
                <X size={20} color={theme.subtext} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalImageContainer}>
              {zoomImage && (
                <Image source={{ uri: zoomImage.file_path }} style={styles.fullImage} resizeMode="contain" />
              )}
            </View>
            {zoomImage && (zoomImage.uploaded_by || zoomImage.uploaded_at) && (
              <View style={{
                position: 'absolute',
                bottom: 20,
                left: 20,
                right: 20,
                backgroundColor: 'rgba(0,0,0,0.6)',
                padding: 15,
                borderRadius: 10,
                zIndex: 10,
              }}>
                {!!zoomImage.uploaded_by && (
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
                    Uploaded By - {zoomImage.uploaded_by}
                  </Text>
                )}
                {!!zoomImage.uploaded_at && (
                  <Text style={{ color: '#FFF', fontSize: 12, marginTop: 4 }}>
                    Uploaded At - {formatDateTime(zoomImage.uploaded_at)}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
      <AlertComponent />
    </View>
  );
};


const getStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    marginTop: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 44, // Mobile-friendly touch target
  },
  buttonNormal: {
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  buttonRequired: {
    borderColor: isDark ? '#B45309' : '#FCD34D',
    backgroundColor: isDark ? '#451A03' : '#FFFBEB',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonTextNormal: {
    color: theme.text,
  },
  buttonTextRequired: {
    color: isDark ? '#FCD34D' : '#B45309',
  },
  countText: {
    fontSize: 14,
    color: theme.subtext,
    marginLeft: 4,
  },
  imageList: {
    paddingVertical: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageWrapper: {
    width: 110,
    height: 110,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.inputBg,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  zoomOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomIconWrapper: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 8,
    borderRadius: 20,
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface2,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.text,
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 8, // Bigger touch target
    borderRadius: 20,
  },
  modalImageContainer: {
    backgroundColor: isDark ? '#000' : '#F9FAFB',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    height: '75%', // Ensure enough space
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  noImagePlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: isDark ? '#3A3A3C' : '#CBD5E1',
    alignSelf: 'flex-start',
    backgroundColor: isDark ? '#1C1C2E' : '#F8FAFC',
  },
  noImageText: {
    fontSize: 13,
    color: isDark ? '#94A3B8' : '#64748B',
    fontStyle: 'italic',
  },
});

export default PhotoUploader;

