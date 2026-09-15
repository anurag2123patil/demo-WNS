import React, { useEffect, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import {
  Search,
  Download,
  Trash2,
  FileText,
  Upload,
  X,
  Eye,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react-native';
import {
  getProjectDocuments,
  ProjectDocument,
  getDocumentDownloadUrl,
  getDocumentViewUrl,
  deleteDocument,
  uploadProjectDocument,
} from '@/api/api_document';
import { useTheme } from '../../contexts/ThemeContext';
import { WebView } from 'react-native-webview';
import { useAlert } from '@/hooks/useAlert';
import { useAuth } from '@/contexts/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function DocumentManagementScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadTagsInput, setUploadTagsInput] = useState('');
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const [deleteDocName, setDeleteDocName] = useState('');
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const { showAlert, AlertComponent } = useAlert();
  const { selectedProject, hasAccess, hasWriteAccess } = useAuth();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewType, setPreviewType] = useState<'pdf' | 'office' | 'image' | 'other'>('other');

  const { theme, isDark } = useTheme();

  // ── Theme aliases ─────────────────────────────────────────────────
  const pageBg = theme.background;
  const cardBg = theme.cardColor;
  const inputBg = theme.inputBackground;
  const borderColor = theme.borderColor;
  const secondaryText = theme.textMuted;
  const primaryColor = theme.primaryColor;
  const dangerColor = theme.iconDanger;
  const successColor = theme.iconSuccess;
  const textColor = theme.text;
  const headingColor = theme.heading;
  const surface2 = theme.surface2;
  const overlayBg = theme.overlayBackground;
  const dragHandle = theme.dragHandle;
  const badgeBlue = theme.badgeBlue;
  const disabledBg = theme.disabledBackground;
  const disabledText = theme.disabledText;
  const cancelBtnBg = theme.cancelBtnBg;
  const cancelBtnBorder = theme.cancelBtnBorder;
  const cancelBtnText = theme.cancelBtnText;

  // ── Helpers ───────────────────────────────────────────────────────
  const parseTags = (raw: string | null): string[] => {
    if (!raw) return [];
    return raw.split(',').map(t => t.trim()).filter(Boolean);
  };

  const detectFileType = (docType: string | null, filename: string): string => {
    const combined = `${docType ?? ''} ${filename}`.toLowerCase();
    if (combined.includes('pdf')) return 'pdf';
    if (combined.match(/xls|xlsx|spreadsheet|excel/)) return 'excel';
    if (combined.match(/doc|docx|word/)) return 'word';
    if (combined.match(/ppt|pptx|presentation/)) return 'ppt';
    if (combined.match(/jpg|jpeg|png|gif|webp|image/)) return 'image';
    return 'other';
  };

  const getFileIconStyle = (docType: string | null, filename: string = '') => {
    const type = detectFileType(docType, filename);
    switch (type) {
      case 'pdf': return { bg: theme.badgeRed, color: theme.iconDanger };
      case 'excel': return { bg: theme.badgeGreen, color: theme.iconSuccess };
      case 'word': return { bg: theme.badgeBlue, color: theme.iconPrimary };
      case 'ppt': return { bg: theme.badgeOrange, color: theme.iconWarning };
      case 'image': return { bg: isDark ? 'rgba(175,82,222,0.15)' : 'rgba(175,82,222,0.1)', color: '#AF52DE' };
      default: return { bg: theme.badgeBlue, color: theme.iconPrimary };
    }
  };

  const getFileTypeLabel = (docType: string | null, filename: string): string => {
    const type = detectFileType(docType, filename);
    const labels: Record<string, string> = {
      pdf: 'PDF', excel: 'EXCEL', word: 'WORD', ppt: 'PPT', image: 'IMAGE', other: 'FILE',
    };
    return labels[type] ?? 'FILE';
  };

  const buildPreviewUrl = (
    rawUrl: string,
    docType: string | null,
    filename: string = '',
  ): { url: string; type: 'pdf' | 'office' | 'image' | 'other' } => {
    const type = detectFileType(docType, filename);
    const encoded = encodeURIComponent(rawUrl);

    if (type === 'pdf') {
      if (Platform.OS === 'android') {
        return { url: `https://docs.google.com/viewer?url=${encoded}&embedded=true`, type: 'pdf' };
      }
      return { url: rawUrl, type: 'pdf' };
    }
    if (type === 'excel' || type === 'word' || type === 'ppt') {
      return {
        url: `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`,
        type: 'office',
      };
    }
    if (type === 'image') {
      return { url: rawUrl, type: 'image' };
    }
    return { url: rawUrl, type: 'other' };
  };

  const allTags = Array.from(
    new Set(documents.flatMap(doc => parseTags(doc.wids_category))),
  );

  const filteredDocuments = documents.filter(doc => {
    const searchLower = searchQuery.toLowerCase();
    const docTags = parseTags(doc.wids_category);
    const matchesSearch = 
      doc.wids_filename.toLowerCase().includes(searchLower) ||
      docTags.some(tag => tag.toLowerCase().includes(searchLower));
    const matchesTags =
      selectedTags.length === 0 || selectedTags.some(tag => docTags.includes(tag));
    return matchesSearch && matchesTags;
  });

  // ── Data ──────────────────────────────────────────────────────────
  useEffect(() => { fetchDocs(); }, []);
  // console.log("anurag", selectedProject?.projectData?.document_limit)
  const fetchDocs = async () => {
    try {
      setLoading(true);
      const data = await getProjectDocuments();
      setDocuments(data.documents);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      showAlert('Error', 'Could not load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const data = await getProjectDocuments();
      setDocuments(data.documents);
    } catch (error) {
      showAlert('Error', 'Could not refresh documents', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadDocument = async (docId: number, docName: string) => {
    try {
      const response = await getDocumentDownloadUrl(docId);
      if (response.url) await Linking.openURL(response.url);
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Could not retrieve the download link.', 'error');
    }
  };

  const toggleTag = (tag: string) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );

  const handleViewDocument = async (
    docId: number,
    docType: string | null,
    filename: string,
  ) => {
    try {
      setPreviewVisible(true);
      const response = await getDocumentViewUrl(docId);
      if (response.url) {
        const { url, type } = buildPreviewUrl(response.url, docType, filename);
        setPreviewUrl(url);
        setPreviewType(type);
      }
    } catch (error: any) {
      setPreviewVisible(false);
      showAlert('Preview Error', error.message || 'Could not open document preview.', 'error');
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        const file = result.assets[0];
        if (file.size && file.size > 200 * 1024 * 1024) {
          showAlert('Error', 'File size exceeds 200 MB limit', 'error');
          return;
        }
        setSelectedFile(file);
        if (!uploadFileName) setUploadFileName(file.name);
      }
    } catch (err) {
      showAlert('Error', 'Failed to select document', 'error');
    }
  };

  const handleDeletePress = (docId: number, docName: string) => {
    setDeleteDocId(docId);
    setDeleteDocName(docName);
    setDeleteVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (deleteDocId === null) return;
    try {
      const response = await deleteDocument(deleteDocId, true);
      if (response.success) {
        setDeleteVisible(false);
        setDeleteDocId(null);
        setDeleteDocName('');
        await fetchDocs();
        showAlert('Success', 'Document deleted successfully', 'success');
      } else {
        showAlert('Error', response.message || 'Could not delete the document');
      }
    } catch (error: any) {
      console.error('Delete Error:', error);
      showAlert('Error', error.message || 'Could not delete the document', 'error');
    }
  };

  const handleUpload = async () => {
    console.log("anurag limit", selectedProject?.projectData?.document_limit, documents.length, "and", documents.length)
    if (selectedProject?.projectData?.document_limit == documents.length) {
      showAlert('Limit Reached', 'You have reached the maximum number of documents for this project.', 'info');
      return;
    }
    if (!uploadFileName.trim() || !selectedFile) {
      showAlert('Validation', 'Please enter a name and select a file', 'info');
      return;
    }
    setUploading(true);
    try {
      await uploadProjectDocument(
        selectedFile.uri,
        selectedFile.name,
        selectedFile.mimeType || 'application/octet-stream',
        uploadFileName.trim(),
        uploadTagsInput.trim() || '',
      );
      showAlert('Success', 'Document uploaded successfully', 'success');
      setUploadVisible(false);
      setUploadFileName('');
      setUploadTagsInput('');
      setSelectedFile(null);
      await fetchDocs();
    } catch (error: any) {
      showAlert('Upload Failed', error.message || 'Something went wrong', 'error');
    } finally {
      setUploading(false);
    }
  };

  const closeUploadModal = () => {
    if (uploading) return;
    setUploadVisible(false);
    setUploadFileName('');
    setUploadTagsInput('');
    setSelectedFile(null);
  };

  // ── Document Card ─────────────────────────────────────────────────
  const renderDocument = ({ item }: { item: ProjectDocument }) => {
    const tags = parseTags(item.wids_category);
    const { bg, color } = getFileIconStyle(item.wids_doc_type, item.wids_filename);
    const dateStr = item.wids_createdat
      ? new Date(item.wids_createdat).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      : 'N/A';

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: borderColor,
            shadowColor: theme.shadowColor,
          },
        ]}
      >
        <View style={[styles.fileIconBox, { backgroundColor: bg }]}>
          <FileText size={24} color={color} />
        </View>

        <View style={styles.cardContent}>
          <Text style={[styles.docName, { color: textColor }]} numberOfLines={1}>
            {item.wids_filename}
          </Text>

          <View style={styles.tagsRow}>
            {tags.map(tag => (
              <View key={tag} style={[styles.tagPill, { backgroundColor: badgeBlue }]}>
                <Text style={[styles.tagPillText, { color: primaryColor }]}>{tag}</Text>
              </View>
            ))}
            <View style={[styles.tagPill, { backgroundColor: surface2 }]}>
              <Text style={[styles.tagPillText, { color: secondaryText }]}>
                {getFileTypeLabel(item.wids_doc_type, item.wids_filename)}
              </Text>
            </View>
          </View>

          <Text style={[styles.dateMeta, { color: secondaryText }]}>{dateStr}</Text>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: surface2 }]}
            onPress={() =>
              handleViewDocument(item.wids_id, item.wids_doc_type, item.wids_filename)
            }
          >
            <Eye size={15} color={primaryColor} />
          </TouchableOpacity>

          {hasWriteAccess('PROJECT_DETAILS_DOWNLOAD_DOCUMENTS') && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: surface2 }]}
              onPress={() => handleDownloadDocument(item.wids_id, item.wids_filename)}
            >
              <Download size={15} color={primaryColor} />
            </TouchableOpacity>
          )}

          {hasWriteAccess('PROJECT_DETAILS_DELETE_DOCUMENTS') && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: surface2 }]}
              onPress={() => handleDeletePress(item.wids_id, item.wids_filename)}
            >
              <Trash2 size={15} color={dangerColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ── Main Render ───────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <StatusBar barStyle={theme.statusBarStyle} />

      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: headingColor }]}>Project Documents</Text>
        <Text style={[styles.pageSubtitle, { color: secondaryText }]}>
          Manage project documents and files
        </Text>
      </View>

      {/* Search + Upload row */}
      <View style={styles.topRow}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: cardBg,
              borderColor: borderColor,
              shadowColor: theme.shadowColor,
            },
          ]}
        >
          <Search size={18} color={secondaryText} style={{ marginRight: 10 }} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Search documents..."
            placeholderTextColor={theme.inputPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity
            onPress={() => setFilterVisible(true)}
            style={styles.filterIconWrap}
          >
            <SlidersHorizontal size={18} color={secondaryText} />
            {selectedTags.length > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: primaryColor }]}>
                <Text style={styles.filterBadgeText}>{selectedTags.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {hasWriteAccess('PROJECT_DETAILS_UPLOAD_DOCUMENTS') && (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => setUploadVisible(true)}
          >
            <LinearGradient
              colors={["#60A5FA", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.uploadBtnGradient}
            >
              <Upload size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Active tag chips */}
      {selectedTags.length > 0 && (
        <View style={styles.activeTags}>
          {selectedTags.map(tag => (
            <View key={tag} style={[styles.activeTagPill, { backgroundColor: theme.primary }]}>
              <Text style={styles.activeTagText}>{tag}</Text>
              <TouchableOpacity onPress={() => toggleTag(tag)} style={{ marginLeft: 4 }}>
                <X size={11} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => setSelectedTags([])}>
            <Text style={[styles.clearAllInline, { color: primaryColor }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={[styles.loadingText, { color: secondaryText }]}>Loading documents...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDocuments}
          renderItem={renderDocument}
          keyExtractor={item => item.wids_id.toString()}
          contentContainerStyle={styles.listContent}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.centered}>
              <View style={[styles.emptyIconBox, { backgroundColor: surface2 }]}>
                <FileText size={32} color={theme.emptyIconColor} />
              </View>
              <Text style={[styles.emptyTitle, { color: textColor }]}>No documents found</Text>
              <Text style={[styles.emptySubtitle, { color: secondaryText }]}>
                {documents.length === 0
                  ? 'Upload your first document to get started'
                  : 'Try adjusting your search or filter'}
              </Text>
            </View>
          }
        />
      )}

      {/* ── FILTER BOTTOM SHEET ── */}
      <Modal
        visible={filterVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={[styles.sheetOverlay, { backgroundColor: overlayBg }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setFilterVisible(false)}
            activeOpacity={1}
          />
          <View style={[styles.sheet, { backgroundColor: cardBg }]}>
            {/* drag handle */}
            <View style={[styles.dragHandle, { backgroundColor: dragHandle }]} />

            <View style={[styles.sheetHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.sheetTitle, { color: headingColor }]}>Filter by Tags</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Text style={[styles.doneBtn, { color: primaryColor }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody}>
              {allTags.length === 0 ? (
                <Text style={{ color: secondaryText, textAlign: 'center', fontSize: 13 }}>
                  No tags available
                </Text>
              ) : (
                <View style={styles.tagsWrap}>
                  {allTags.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        styles.filterTagPill,
                        { backgroundColor: inputBg, borderColor: borderColor, borderWidth: 1 },
                        selectedTags.includes(tag) && {
                          backgroundColor: theme.primary,
                          borderColor: theme.primary,
                        },
                      ]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text
                        style={[
                          styles.filterTagText,
                          { color: textColor },
                          selectedTags.includes(tag) && { color: '#fff' },
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {selectedTags.length > 0 && (
                <TouchableOpacity
                  style={[styles.clearAllBtn, { backgroundColor: dangerColor }]}
                  onPress={() => { setSelectedTags([]); setFilterVisible(false); }}
                >
                  <Text style={styles.clearAllBtnText}>Clear All Filters</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── UPLOAD BOTTOM SHEET ── */}
      <Modal
        visible={uploadVisible}
        animationType="slide"
        transparent
        onRequestClose={closeUploadModal}
      >
        <View style={[styles.sheetOverlay, { backgroundColor: overlayBg }]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={closeUploadModal}
            activeOpacity={1}
          />
          <View style={[styles.uploadSheet, { backgroundColor: cardBg }]}>
            <View style={[styles.dragHandle, { backgroundColor: dragHandle }]} />

            <View style={[styles.sheetHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.sheetTitle, { color: headingColor }]}>Upload Document</Text>
              <TouchableOpacity onPress={closeUploadModal} disabled={uploading}>
                <X size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.sheetBody}>
              {/* Document Name */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: textColor }]}>
                  Document Name <Text style={{ color: dangerColor }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: inputBg,
                      color: textColor,
                      borderColor: borderColor,
                    },
                  ]}
                  placeholder="Project Blueprint"
                  placeholderTextColor={theme.inputPlaceholder}
                  value={uploadFileName}
                  onChangeText={setUploadFileName}
                  editable={!uploading}
                />
              </View>

              {/* File Picker */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: textColor }]}>
                  Select File <Text style={{ color: dangerColor }}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.filePicker,
                    {
                      backgroundColor: inputBg,
                      borderColor: selectedFile ? theme.primary : borderColor,
                    },
                  ]}
                  onPress={handlePickDocument}
                  disabled={uploading}
                >
                  <Upload size={20} color={selectedFile ? theme.primary : secondaryText} />
                  <Text
                    style={[
                      styles.filePickerText,
                      { color: selectedFile ? theme.primary : secondaryText, flex: 1 },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="middle"
                  >
                    {selectedFile ? selectedFile.name : 'Choose File'}
                  </Text>
                </TouchableOpacity>
                <Text style={[styles.fileHint, { color: secondaryText }]}>
                  PDF, DOC, XLSX, JPG, PNG, ZIP, RAR — up to 200MB
                </Text>
              </View>

              {/* Tags */}
              <View style={styles.formSection}>
                <Text style={[styles.formLabel, { color: textColor }]}>
                  Tags{' '}
                  <Text style={{ color: secondaryText, fontWeight: '400' }}>
                    (comma-separated)
                  </Text>
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: inputBg,
                      color: textColor,
                      borderColor: borderColor,
                    },
                  ]}
                  placeholder="blueprint, design, planning"
                  placeholderTextColor={theme.inputPlaceholder}
                  value={uploadTagsInput}
                  onChangeText={setUploadTagsInput}
                  editable={!uploading}
                />
              </View>

              <TouchableOpacity
                disabled={!uploadFileName.trim() || !selectedFile || uploading}
                style={[
                  styles.submitBtn,
                  { opacity: (!uploadFileName.trim() || !selectedFile || uploading) ? 0.5 : 1 },
                ]}
                onPress={handleUpload}
              >
                <LinearGradient
                  colors={["#60A5FA", "#2563EB"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.submitBtnGradient}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" style={{ marginRight: 8 }} />
                  ) : (
                    <Upload size={18} color="#fff" style={{ marginRight: 8 }} />
                  )}
                  <Text style={styles.submitBtnText}>
                    {uploading ? 'Uploading...' : 'Upload Document'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── DELETE CONFIRM MODAL ── */}
      <Modal
        visible={deleteVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View style={[styles.deleteOverlay, { backgroundColor: overlayBg }]}>
          <View
            style={[
              styles.deleteModal,
              { backgroundColor: cardBg, borderColor: borderColor },
            ]}
          >
            <View style={[styles.deleteIconWrap, { backgroundColor: theme.badgeRed }]}>
              <AlertCircle size={24} color={dangerColor} />
            </View>
            <Text style={[styles.deleteTitle, { color: headingColor }]}>Delete Document</Text>
            <Text style={[styles.deleteSubtitle, { color: secondaryText }]}>
              Are you sure you want to permanently delete this document? This action cannot be
              undone.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[
                  styles.deleteBtn,
                  styles.deleteBtnCancel,
                  { borderColor: cancelBtnBorder, backgroundColor: cancelBtnBg },
                ]}
                onPress={() => setDeleteVisible(false)}
              >
                <Text style={[styles.deleteBtnCancelText, { color: cancelBtnText }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, styles.deleteBtnConfirm, { backgroundColor: dangerColor }]}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.deleteBtnConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── DOCUMENT PREVIEW MODAL ── */}
      <Modal
        visible={previewVisible}
        animationType="fade"
        onRequestClose={() => { setPreviewVisible(false); setPreviewUrl(null); }}
      >
        <View style={[{ flex: 1 }, { backgroundColor: cardBg }]}>
          <View
            style={[
              styles.sheetHeader,
              {
                paddingTop: 50,
                borderBottomWidth: 1,
                borderBottomColor: borderColor,
              },
            ]}
          >
            <Text
              style={[styles.sheetTitle, { color: headingColor }]}
              numberOfLines={1}
            >
              Preview
            </Text>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: surface2 }]}
              onPress={() => { setPreviewVisible(false); setPreviewUrl(null); }}
            >
              <X size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {previewUrl ? (
            <WebView
              source={
                previewType === 'image'
                  ? {
                    html: `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${previewUrl}" style="max-width:100%;max-height:100vh;object-fit:contain"/></body></html>`,
                    baseUrl: '',
                  }
                  : { uri: previewUrl }
              }
              style={{ flex: 1 }}
              startInLoadingState
              scalesPageToFit
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              userAgent={
                Platform.OS === 'android'
                  ? 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0.4472.120 Mobile Safari/537.36'
                  : 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Version/14.0 Mobile/15E148 Safari/604.1'
              }
              onError={() => {
                showAlert(
                  'Preview Unavailable',
                  'Could not render this document. Try downloading it instead.',
                  'error',
                  [{ text: 'OK', onPress: () => setPreviewVisible(false) }],
                );
              }}
              renderLoading={() => (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { backgroundColor: cardBg, alignItems: 'center', justifyContent: 'center' },
                  ]}
                >
                  <ActivityIndicator size="large" color={primaryColor} />
                  <Text style={{ color: secondaryText, marginTop: 12, fontSize: 13 }}>
                    {previewType === 'office' ? 'Loading via Office Viewer…' : 'Loading document…'}
                  </Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={primaryColor} />
            </View>
          )}
        </View>
      </Modal>

      <AlertComponent />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  pageTitle: { fontSize: 22, fontWeight: '700' },
  pageSubtitle: { fontSize: 13, marginTop: 2 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterIconWrap: { position: 'relative', padding: 4 },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  uploadBtn: {
    borderRadius: 30,      // match your existing borderRadius
    overflow: "hidden",
    elevation: 8,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  uploadBtnGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 12,           // match your existing padding
  },
  activeTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  activeTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  activeTagText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  clearAllInline: { fontSize: 12, textDecorationLine: 'underline' },
  listContent: { paddingHorizontal: 12, paddingBottom: 30 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySubtitle: { fontSize: 13, textAlign: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  fileIconBox: {
    width: 48,
    height: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  cardContent: { flex: 1, minWidth: 0 },
  docName: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 5 },
  tagPill: {
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  tagPillText: { fontSize: 11, fontWeight: '500' },
  dateMeta: { fontSize: 11 },
  cardActions: { flexDirection: 'column', gap: 7, marginLeft: 10 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sheets
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '70%',
  },
  uploadSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '88%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700' },
  doneBtn: { fontSize: 15, fontWeight: '600' },
  sheetBody: { padding: 22, paddingBottom: 40 },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  filterTagPill: { borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18 },
  filterTagText: { fontSize: 14, fontWeight: '600' },
  clearAllBtn: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  clearAllBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Upload form
  formSection: { marginBottom: 20 },
  formLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  formInput: {
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    borderWidth: 1,
  },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    padding: 18,
    gap: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  filePickerText: { fontSize: 15, fontWeight: '600' },
  fileHint: { fontSize: 12, marginTop: 7, textAlign: 'center' },
  submitBtn: {
    borderRadius: 10,      // match your existing borderRadius
    overflow: "hidden",
    elevation: 4,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  submitBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,   // match your existing padding
    paddingHorizontal: 16,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Delete modal
  deleteOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deleteModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
  },
  deleteIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  deleteTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  deleteSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  deleteActions: { flexDirection: 'row', gap: 12, width: '100%' },
  deleteBtn: { flex: 1, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  deleteBtnCancel: { borderWidth: 1 },
  deleteBtnCancelText: { fontSize: 14, fontWeight: '600' },
  deleteBtnConfirm: {},
  deleteBtnConfirmText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});