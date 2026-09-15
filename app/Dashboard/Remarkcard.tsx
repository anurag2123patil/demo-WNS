import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface RemarkCardProps {
    remark: {
        id: string;
        user: string;
        text: string;
        date?: string;
    };
    theme: any;
    isDark: boolean;          // ← ADD THIS
    subTextColor: string;
    borderColor: string;
}

/** Returns true if the string contains any HTML tags */
const isHTML = (str: string) => /<[a-z][\s\S]*>/i.test(str);

/** Wrap bare HTML in a full document with nice typography */
/** Wrap bare HTML in a full document with nice typography */
const buildHTML = (content: string, isDark: boolean) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: ${isDark ? '#E2E8F0' : '#374151'};
      padding: 4px 2px;
      background: transparent;
      overflow: hidden;
    }
    b, strong { font-weight: 700; }
    i, em { font-style: italic; }
    u { text-decoration: underline; }
    s, strike { text-decoration: line-through; }
    ul { padding-left: 20px; list-style-type: disc; }
    ol { padding-left: 20px; list-style-type: decimal; }
    li { margin-bottom: 2px; }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
    h2 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    h3 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
    h4 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
    h5 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    h6 { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
    p { margin-bottom: 4px; }
    a { color: ${isDark ? '#60A5FA' : '#2563EB'}; }
    body::after { content: ''; display: block; }
  </style>
</head>
<body>
  ${content}
  <script>
    function sendHeight() {
      const h = document.body.scrollHeight;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
    }
    document.addEventListener('DOMContentLoaded', sendHeight);
    new MutationObserver(sendHeight).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', sendHeight);
    setTimeout(sendHeight, 100);
    setTimeout(sendHeight, 400);
  </script>
</body>
</html>
`;


export default function RemarkCard({ remark, theme, isDark, subTextColor, borderColor }: RemarkCardProps) {
    const [webViewHeight, setWebViewHeight] = React.useState(40);

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'height' && data.value > 0) {
                setWebViewHeight(data.value);
            }
        } catch (_) { }
    };

    const hasHTML = isHTML(remark.text);

    return (
        <View style={[styles.remarkCard, { backgroundColor: theme.cardColor, borderColor }]}>
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: isDark ? '#3A3D4E' : '#F1F5F9' }]}>
                <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                        {(remark.user || 'U')[0].toUpperCase()}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.userName, { color: theme.text }]}>
                        {remark.user}
                    </Text>
                    {remark.date ? (
                        <Text style={[styles.dateText, { color: subTextColor }]}>
                            {formatDate(remark.date)}
                        </Text>
                    ) : null}
                </View>
            </View>

            {/* Body */}
            <View style={[styles.body, { backgroundColor: theme.cardColor }]}>
                {hasHTML ? (
                    <WebView
                        source={{ html: buildHTML(remark.text, isDark) }}  // ← pass isDark
                        style={{ height: webViewHeight, backgroundColor: 'transparent' }}
                        scrollEnabled={false}
                        onMessage={handleMessage}
                        originWhitelist={['*']}
                        javaScriptEnabled
                        nestedScrollEnabled={false}
                    />
                ) : (
                    <Text style={[styles.plainText, { color: subTextColor }]}>
                        {remark.text}
                    </Text>
                )}
            </View>
        </View>
    );
}

const formatDate = (dateStr: string) => {
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr; // ← returns raw string if unparseable
        return d.toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return dateStr;
    }
};

const styles = StyleSheet.create({
    remarkCard: {
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderBottomWidth: 1,
        // ← borderBottomColor removed, now set inline with isDark
    },
    avatarCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '800',
    },
    userName: {
        fontSize: 14,
        fontWeight: '700',
    },
    dateText: {
        fontSize: 11,
        marginTop: 1,
    },
    body: {
        padding: 12,
        paddingTop: 8,
    },
    plainText: {
        fontSize: 14,
        lineHeight: 20,
    },
});