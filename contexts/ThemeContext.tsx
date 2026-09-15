import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 1. Define your Light and Dark themes
const lightTheme = {
    mode: 'light',

    // ── Backgrounds ──────────────────────────────────────────────────────────
    background: '#F2F2F7',
    surface: '#FFFFFF',
    surface2: '#F2EFF4',
    cardColor: '#ffffff',
    cardColor2: '#cdcdcdff',

    // ── Text ─────────────────────────────────────────────────────────────────
    text: '#000000',
    subtext: '#3a3a3aff',
    heading: '#000000',
    textMuted: '#6B7280',

    // ── Borders ──────────────────────────────────────────────────────────────
    border: '#E5E7EB',
    borderColor: '#E2E8F0',
    borderBottomColor: '#E2E8F0',
    line: '#ffffff',

    // ── Brand ────────────────────────────────────────────────────────────────
    primary: '#007AFF',
    primary600: '#A50034',
    primary200: '#DDBEE2',
    secondary: '#F4B740',
    accent: '#22A699',

    // ── Semantic ─────────────────────────────────────────────────────────────
    success: '#2E7D32',
    warning: '#F59E0B',
    danger: '#D32F2F',
    info: '#007AFF',

    // ── Interactive ──────────────────────────────────────────────────────────
    button: '#007AFF',
    buttonText: '#FFFFFF',

    // ── Inputs ───────────────────────────────────────────────────────────────
    inputBg: '#F3F4F6',
    inputBackground: '#F5F5F7',
    inputBorder: '#E5E7EB',
    inputText: '#000000',
    inputPlaceholder: '#C7C7CC',

    // ── Status bar ───────────────────────────────────────────────────────────
    statusBarStyle: 'dark-content' as 'dark-content' | 'light-content',

    // ── Overlays ─────────────────────────────────────────────────────────────
    overlayBackground: 'rgba(0,0,0,0.45)',
    modalOverlay: 'rgba(0,0,0,0.45)',

    // ── Shadows ──────────────────────────────────────────────────────────────
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    cardShadow: '#000',

    // ── Semantic icon tints ───────────────────────────────────────────────────
    iconPrimary: '#007AFF',
    iconSuccess: '#34C759',
    iconWarning: '#FF9500',
    iconDanger: '#FF3B30',
    iconMuted: '#8E8E93',

    // ── Badge surfaces (semi-transparent) ────────────────────────────────────
    badgeBlue: 'rgba(0,122,255,0.12)',
    badgeGreen: 'rgba(52,199,89,0.12)',
    badgeOrange: 'rgba(255,149,0,0.12)',
    badgeRed: 'rgba(255,59,48,0.12)',

    // ── Component misc ───────────────────────────────────────────────────────
    dragHandle: '#C7C7CC',
    disabledBackground: '#E5E5EA',
    disabledText: '#8E8E93',

    // ── Inventory-specific ───────────────────────────────────────────────────
    subTextColor: '#6B7280',
    dangerColor: '#DC2626',
    primaryColor: '#007AFF',
    toastBg: '#2563EB',
    tabActiveBorder: '#007AFF',
    tabActiveText: '#007AFF',
    statsLabelColor: '#6B7280',
    iconCircleBg: '#ff6b6bb0',
    paginationDisabledOpacity: 0.5,
    searchBoxBg: '#FFFFFF',
    searchBoxBorder: '#D1D5DB',
    searchBoxShadow: '#000',
    suggestionBg: '#FFFFFF',
    loaderDotColor: '#007AFF',
    deleteBoxBg: '#FFFFFF',
    transCardBg: '#FFFFFF',
    transEditBg: '#F3F4F6',
    commentBorderTop: 'rgba(0,0,0,0.06)',
    dateBadgeBg: 'rgba(156,163,175,0.12)',
    emptyIconColor: '#E5E7EB',
    cancelBtnBg: '#FFFFFF',
    cancelBtnBorder: '#D1D5DB',
    cancelBtnText: '#374151',
    headingPillBg: '#FFFFFF',
    sheetIndicator: '#9CA3AF',
};

// ─── Dark Theme ──────────────────────────────────────────────────────────────
const darkTheme = {
    mode: 'dark',

    // ── Backgrounds ──────────────────────────────────────────────────────────
    background: '#1E2130',
    surface: '#252836',
    surface2: '#2E3147',
    cardColor: '#252836',
    cardColor2: '#2E3147',

    // ── Text ─────────────────────────────────────────────────────────────────
    text: '#E2E8F0',
    subtext: '#94A3B8',
    heading: '#FFFFFF',
    textMuted: '#94A3B8',

    // ── Borders ──────────────────────────────────────────────────────────────
    border: '#2A2E3F',
    borderColor: '#3A3D4E',
    borderBottomColor: '#3A3D4E',
    line: '#000000',

    // ── Brand ────────────────────────────────────────────────────────────────
    primary: '#007AFF',
    primary600: '#C4006A',
    primary200: '#7A3060',
    secondary: '#F4B740',
    accent: '#22A699',

    // ── Semantic ─────────────────────────────────────────────────────────────
    success: '#4CAF50',
    warning: '#F59E0B',
    danger: '#EF5350',
    info: '#0A84FF',

    // ── Interactive ──────────────────────────────────────────────────────────
    button: '#0A84FF',
    buttonText: '#FFFFFF',

    // ── Inputs ───────────────────────────────────────────────────────────────
    inputBg: '#2C2C2E',
    inputBackground: '#2C2C2E',
    inputBorder: '#3A3A3C',
    inputText: '#E2E8F0',
    inputPlaceholder: '#636366',

    // ── Status bar ───────────────────────────────────────────────────────────
    statusBarStyle: 'light-content' as 'dark-content' | 'light-content',

    // ── Overlays ─────────────────────────────────────────────────────────────
    overlayBackground: 'rgba(0,0,0,0.65)',
    modalOverlay: 'rgba(0,0,0,0.65)',

    // ── Shadows ──────────────────────────────────────────────────────────────
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    cardShadow: 'transparent',

    // ── Semantic icon tints ───────────────────────────────────────────────────
    iconPrimary: '#0A84FF',
    iconSuccess: '#30D158',
    iconWarning: '#FF9F0A',
    iconDanger: '#FF453A',
    iconMuted: '#636366',

    // ── Badge surfaces ────────────────────────────────────────────────────────
    badgeBlue: 'rgba(10,132,255,0.15)',
    badgeGreen: 'rgba(48,209,88,0.15)',
    badgeOrange: 'rgba(255,159,10,0.15)',
    badgeRed: 'rgba(255,69,58,0.15)',

    // ── Component misc ───────────────────────────────────────────────────────
    dragHandle: '#48484A',
    disabledBackground: '#1C1C1E',
    disabledText: '#48484A',

    // ── Inventory-specific ───────────────────────────────────────────────────
    subTextColor: '#A1A1AA',
    dangerColor: '#DC2626',
    primaryColor: '#0A84FF',
    toastBg: '#1D4ED8',
    tabActiveBorder: '#0A84FF',
    tabActiveText: '#0A84FF',
    statsLabelColor: '#A1A1AA',
    iconCircleBg: '#ff6b6bb0',
    paginationDisabledOpacity: 0.4,
    searchBoxBg: '#252836',
    searchBoxBorder: '#3A3A3C',
    searchBoxShadow: 'transparent',
    suggestionBg: '#1C1C1E',
    loaderDotColor: '#0A84FF',
    deleteBoxBg: '#252836',
    transCardBg: '#1C1C1E',
    transEditBg: '#2C2C2E',
    commentBorderTop: 'rgba(255,255,255,0.06)',
    dateBadgeBg: 'rgba(156,163,175,0.08)',
    emptyIconColor: '#3A3A3C',
    cancelBtnBg: '#2C2C2E',
    cancelBtnBorder: '#3A3A3C',
    cancelBtnText: '#E2E8F0',
    headingPillBg: '#252836',
    sheetIndicator: '#A1A1AA',
};
// 2. Create the Context
const ThemeContext = createContext();

// 3. Create the Provider Component
export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        const loadTheme = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('user-theme');
                if (savedTheme !== null) {
                    setIsDark(JSON.parse(savedTheme));
                }
            } catch (e) {
                console.error("Failed to load theme", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadTheme();
    }, []);
    // Toggle function
    const toggleTheme = async () => {
        try {
            const newValue = !isDark;
            setIsDark(newValue);
            await AsyncStorage.setItem('user-theme', JSON.stringify(newValue));
        } catch (e) {
            console.error("Failed to save theme", e);
        }
    };
    // Determine which theme object to use
    const theme = isDark ? darkTheme : lightTheme;
    if (isLoading) return null;
    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

// 4. Custom Hook for easy access (Best Practice)
export const useTheme = () => useContext(ThemeContext);