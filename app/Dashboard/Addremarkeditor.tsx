import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AddRemarkEditorProps {
  onAddRemark?: (htmlContent: string) => void;
}

// ─── Rich Text HTML (runs inside WebView) ─────────────────────────────────────
const getRichEditorHTML = () => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      background: #fff;
      margin: 0;
      padding: 0;
      height: auto;
      overflow: auto;
    }

    /* ── Toolbar ── */
    #toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px;
      padding: 8px 10px;
      border-bottom: 1px solid #e5e7eb;
      background: #fff;
    }
    .toolbar-select {
      font-size: 13px;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 4px 2px;
      border-radius: 4px;
      color: #374151;
      outline: none;
    }
    .toolbar-select:hover { background: #f3f4f6; }
    .divider {
      width: 1px;
      height: 20px;
      background: #d1d5db;
      margin: 0 4px;
    }
    .tb-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: none;
      background: transparent;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      color: #374151;
      transition: background 0.15s;
    }
    .tb-btn:hover, .tb-btn.active { background: #e5e7eb; }
    .tb-btn svg { width: 15px; height: 15px; }

    /* ── Editor ── */
    #editor {
      min-height: 130px;
      max-height: 300px;
      overflow-y: auto;
      padding: 14px 14px 20px;
      outline: none;
      font-size: 14px;
      line-height: 1.6;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #editor:empty:before {
      content: attr(data-placeholder);
      color: #9ca3af;
      pointer-events: none;
    }
    #editor h1 { font-size: 2em; font-weight: 700; margin: 0.4em 0; }
    #editor h2 { font-size: 1.5em; font-weight: 700; margin: 0.4em 0; }
    #editor h3 { font-size: 1.17em; font-weight: 700; margin: 0.4em 0; }
    #editor h4 { font-size: 1em; font-weight: 700; margin: 0.4em 0; }
    #editor h5 { font-size: 0.83em; font-weight: 700; margin: 0.4em 0; }
    #editor h6 { font-size: 0.67em; font-weight: 700; margin: 0.4em 0; }
    #editor ul { padding-left: 1.5em; list-style: disc; }
    #editor ol { padding-left: 1.5em; list-style: decimal; }
    #editor a { color: #2563eb; text-decoration: underline; }

    /* ── Footer hint ── */
    #footer {
      padding: 6px 14px 10px;
      font-size: 11px;
      color: #6b7280;
    }
    #footer b { font-weight: 600; color: #374151; }
  </style>
</head>
<body>
  <div id="toolbar">
    <!-- Heading select -->
    <select class="toolbar-select" id="blockFormat" onchange="formatBlock(this.value)">
      <option value="p">Normal</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
      <option value="h5">Heading 5</option>
      <option value="h6">Heading 6</option>
    </select>

    <div class="divider"></div>

    <!-- Bold -->
    <button class="tb-btn" id="btn-bold" onclick="exec('bold')" title="Bold">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
    </button>

    <!-- Italic -->
    <button class="tb-btn" id="btn-italic" onclick="exec('italic')" title="Italic">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
    </button>

    <!-- Underline -->
    <button class="tb-btn" id="btn-underline" onclick="exec('underline')" title="Underline">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
    </button>

    <!-- Strikethrough -->
    <button class="tb-btn" id="btn-strikeThrough" onclick="exec('strikeThrough')" title="Strikethrough">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6C16 6 14.5 4 12 4C9.5 4 7 5.5 7 8C7 10 8.5 11.2 10 12"/><path d="M8 18C8 18 9.5 20 12 20C14.5 20 17 18.5 17 16C17 14 15.5 12.8 14 12"/></svg>
    </button>

    <div class="divider"></div>

    <!-- Ordered list -->
    <button class="tb-btn" id="btn-insertOrderedList" onclick="exec('insertOrderedList')" title="Ordered List">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
    </button>

    <!-- Unordered list -->
    <button class="tb-btn" id="btn-insertUnorderedList" onclick="exec('insertUnorderedList')" title="Bullet List">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
    </button>

    <div class="divider"></div>

    <!-- Alignment -->
    <button class="tb-btn" id="btn-align" onclick="cycleAlign()" title="Alignment">
      <svg id="alignIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
    </button>

    <!-- Link -->
    <button class="tb-btn" onclick="insertLink()" title="Insert Link">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </button>

    <!-- Clear formatting -->
    <button class="tb-btn" onclick="exec('removeFormat')" title="Clear Formatting">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3H7"/><path d="M14 3l-4 8"/><path d="M3 21l18-18"/><path d="M11 21H7"/></svg>
    </button>
  </div>

  <div
    id="editor"
    contenteditable="true"
    data-placeholder="Enter your remark here..."
    oninput="onEditorChange()"
  ></div>

  

  <script>
    var alignStates = ['left','center','right','full'];
    var alignIdx = 0;

    function exec(cmd, val) {
      document.getElementById('editor').focus();
      document.execCommand(cmd, false, val || null);
      updateActiveStates();
      onEditorChange();
    }

    function formatBlock(tag) {
      exec('formatBlock', tag === 'p' ? 'p' : tag);
    }

    function cycleAlign() {
      alignIdx = (alignIdx + 1) % alignStates.length;
      var align = alignStates[alignIdx];
      var cmds = { left:'justifyLeft', center:'justifyCenter', right:'justifyRight', full:'justifyFull' };
      exec(cmds[align]);
    }

    function insertLink() {
      var url = prompt('Enter URL:', 'https://');
      if (url) exec('createLink', url);
    }

    function updateActiveStates() {
      var cmds = ['bold','italic','underline','strikeThrough','insertOrderedList','insertUnorderedList'];
      cmds.forEach(function(cmd) {
        var btn = document.getElementById('btn-' + cmd);
        if (btn) {
          if (document.queryCommandState(cmd)) btn.classList.add('active');
          else btn.classList.remove('active');
        }
      });

      // Update block format selector
      var tag = document.queryCommandValue('formatBlock').toLowerCase();
      var sel = document.getElementById('blockFormat');
      var map = { h1:'h1', h2:'h2', h3:'h3', h4:'h4', h5:'h5', h6:'h6' };
      sel.value = map[tag] || 'p';
    }

    function sendHeight() {
      setTimeout(function() {
        var body = document.body;
        var html = document.documentElement;
        var height = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          html.clientHeight,
          html.scrollHeight,
          html.offsetHeight
        );
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'height',
          height: height
        }));
      }, 50);
    }

    function onEditorChange() {
      var html = document.getElementById('editor').innerHTML;
      // Strip empty placeholder
      if (html === '<br>') html = '';
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'content',
        html: html
      }));
      sendHeight();
    }

    document.getElementById('editor').addEventListener('keyup', function() {
      updateActiveStates();
      sendHeight();
    });
    document.getElementById('editor').addEventListener('mouseup', function() {
      updateActiveStates();
      sendHeight();
    });
    document.getElementById('editor').addEventListener('selectionchange', function() {
      updateActiveStates();
      sendHeight();
    });
    document.getElementById('editor').addEventListener('input', sendHeight);
    window.addEventListener('load', sendHeight);

    // Receive commands from RN
    document.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'clear') {
          document.getElementById('editor').innerHTML = '';
          onEditorChange();
        }
      } catch(err) {}
    });
    window.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'clear') {
          document.getElementById('editor').innerHTML = '';
          onEditorChange();
        }
      } catch(err) {}
    });
  </script>
</body>
</html>
`;

// ─── Component ────────────────────────────────────────────────────────────────
const AddRemarkEditor: React.FC<AddRemarkEditorProps> = ({ onAddRemark }) => {
  const webViewRef = useRef<WebView>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [editorHeight, setEditorHeight] = useState(200);
  const { selectedProject, token, isCompressImage, addGeoTag, hasAccess, hasWriteAccess } = useAuth();

  const handleMessage = (event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'content') {
        setHtmlContent(msg.html);
      } else if (msg.type === 'height') {
        const newHeight = Math.max(200, Number(msg.height));
        setEditorHeight(newHeight);
      }
    } catch (_) { }
  };

  const handleAddRemark = () => {
    const stripped = htmlContent.replace(/<[^>]*>/g, '').trim();
    if (!stripped) return;
    onAddRemark?.(htmlContent);
    // Clear editor
    webViewRef.current?.injectJavaScript(`
      document.getElementById('editor').innerHTML = '';
      onEditorChange();
      true;
    `);
    setHtmlContent('');
  };

  const isEmpty = !htmlContent.replace(/<[^>]*>/g, '').trim();

  return (
    <>
      {hasWriteAccess("DASHBOARD_REMARK") && (
        <View style={styles.container}>
          <Text style={styles.title}>Add New Remark</Text>

          {/* Rich Editor Box */}
          <View style={styles.editorBox}>
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: getRichEditorHTML() }}
              onMessage={handleMessage}
              style={{ height: Math.min(editorHeight, 400), borderRadius: 6 }}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
              keyboardDisplayRequiresUserAction={false}
              // Expand height as content grows
              onContentProcessDidTerminate={() => webViewRef.current?.reload()}
            />
          </View>

          {/* Add Remark Button */}
          <TouchableOpacity
            style={[styles.addButton, isEmpty && styles.addButtonDisabled]}
            onPress={handleAddRemark}
            disabled={isEmpty}
            activeOpacity={0.8}
          >
            <Text style={[styles.addButtonText, isEmpty && styles.addButtonTextDisabled]}>
              Add Remark
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  editorBox: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    // Shadow
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  addButton: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#bfdbfe',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  addButtonTextDisabled: {
    color: '#93c5fd',
  },
});

export default AddRemarkEditor;