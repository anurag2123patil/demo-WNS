import React, {
    createContext,
    useContext,
    useRef,
    useState,
    useCallback,
} from 'react';
import {
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top' | 'bottom';

export interface ToastOptions {
    message: string;
    description?: string;
    type?: ToastType;
    duration?: number;        // ms — default 3000
    position?: ToastPosition; // default 'bottom'
    onPress?: () => void;
}

interface ToastItem extends Required<Omit<ToastOptions, 'description' | 'onPress'>> {
    id: string;
    description?: string;
    onPress?: () => void;
    translateY: Animated.Value;
    opacity: Animated.Value;
    scale: Animated.Value;
}

interface ToastContextValue {
    showToast: (options: ToastOptions | string) => void;
    success: (message: string, description?: string) => void;
    error: (message: string, description?: string) => void;
    warning: (message: string, description?: string) => void;
    info: (message: string, description?: string) => void;
    dismiss: (id: string) => void;
    dismissAll: () => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Config ──────────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<
    ToastType,
    { bg: string; border: string; icon: string; iconBg: string; textColor: string; descColor: string }
> = {
    success: {
        bg: '#0D1F17',
        border: '#1A4731',
        icon: '✓',
        iconBg: '#10B981',
        textColor: '#ECFDF5',
        descColor: '#6EE7B7',
    },
    error: {
        bg: '#1F0D0D',
        border: '#4B1111',
        icon: '✕',
        iconBg: '#EF4444',
        textColor: '#FEF2F2',
        descColor: '#FCA5A5',
    },
    warning: {
        bg: '#1F1700',
        border: '#4B3800',
        icon: '!',
        iconBg: '#F59E0B',
        textColor: '#FFFBEB',
        descColor: '#FCD34D',
    },
    info: {
        bg: '#0D1525',
        border: '#1E3A5F',
        icon: 'i',
        iconBg: '#3B82F6',
        textColor: '#EFF6FF',
        descColor: '#93C5FD',
    },
};

const MAX_TOASTS = 3;

// ─── Single Toast Component ───────────────────────────────────────────────────

interface SingleToastProps {
    toast: ToastItem;
    onDismiss: (id: string) => void;
}

const SingleToast: React.FC<SingleToastProps> = ({ toast, onDismiss }) => {
    const cfg = TOAST_CONFIG[toast.type];

    const animStyle = {
        opacity: toast.opacity,
        transform: [
            { translateY: toast.translateY },
            { scale: toast.scale },
        ],
    };

    return (
        <Animated.View style={[styles.toastWrapper, animStyle]}>
            <TouchableOpacity
                activeOpacity={toast.onPress ? 0.7 : 1}
                onPress={() => {
                    toast.onPress?.();
                    onDismiss(toast.id);
                }}
                style={[
                    styles.toastContainer,
                    {
                        backgroundColor: cfg.bg,
                        borderColor: cfg.border,
                    },
                ]}
            >
                {/* Left accent bar */}
                <View style={[styles.accentBar, { backgroundColor: cfg.iconBg }]} />

                {/* Icon badge */}
                <View style={[styles.iconBadge, { backgroundColor: cfg.iconBg }]}>
                    <Text style={styles.iconText}>{cfg.icon}</Text>
                </View>

                {/* Text block */}
                <View style={styles.textBlock}>
                    <Text style={[styles.toastMessage, { color: cfg.textColor }]} numberOfLines={2}>
                        {toast.message}
                    </Text>
                    {toast.description ? (
                        <Text style={[styles.toastDescription, { color: cfg.descColor }]} numberOfLines={2}>
                            {toast.description}
                        </Text>
                    ) : null}
                </View>

                {/* Dismiss button */}
                <TouchableOpacity
                    onPress={() => onDismiss(toast.id)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={styles.dismissBtn}
                >
                    <Text style={[styles.dismissText, { color: cfg.descColor }]}>✕</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const insets = useSafeAreaInsets();

    const dismiss = useCallback((id: string) => {
        setToasts(prev => {
            const toast = prev.find(t => t.id === id);
            if (!toast) return prev;

            // Animate out
            Animated.parallel([
                Animated.timing(toast.opacity, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(toast.translateY, {
                    toValue: 30,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.spring(toast.scale, {
                    toValue: 0.85,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setToasts(curr => curr.filter(t => t.id !== id));
            });

            return prev;
        });

        if (timeoutsRef.current[id]) {
            clearTimeout(timeoutsRef.current[id]);
            delete timeoutsRef.current[id];
        }
    }, []);

    const dismissAll = useCallback(() => {
        setToasts(prev => {
            prev.forEach(t => {
                Animated.parallel([
                    Animated.timing(t.opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                    Animated.timing(t.translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
                ]).start();
                if (timeoutsRef.current[t.id]) {
                    clearTimeout(timeoutsRef.current[t.id]);
                    delete timeoutsRef.current[t.id];
                }
            });
            setTimeout(() => setToasts([]), 220);
            return prev;
        });
    }, []);

    const showToast = useCallback(
        (options: ToastOptions | string) => {
            const opts: ToastOptions =
                typeof options === 'string' ? { message: options } : options;

            const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const type = opts.type ?? 'success';
            const duration = opts.duration ?? 3000;
            const position = opts.position ?? 'bottom';

            const translateY = new Animated.Value(position === 'bottom' ? 40 : -40);
            const opacity = new Animated.Value(0);
            const scale = new Animated.Value(0.88);

            const newToast: ToastItem = {
                id,
                message: opts.message,
                description: opts.description,
                type,
                duration,
                position,
                onPress: opts.onPress,
                translateY,
                opacity,
                scale,
            };

            setToasts(prev => {
                const updated = [newToast, ...prev].slice(0, MAX_TOASTS);
                return updated;
            });

            // Animate in
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 80,
                    friction: 8,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 280,
                    useNativeDriver: true,
                }),
                Animated.spring(scale, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 80,
                    friction: 7,
                }),
            ]).start();

            // Auto dismiss
            timeoutsRef.current[id] = setTimeout(() => dismiss(id), duration);
        },
        [dismiss]
    );

    // Convenience shortcuts
    const success = useCallback(
        (message: string, description?: string) =>
            showToast({ message, description, type: 'success' }),
        [showToast]
    );
    const error = useCallback(
        (message: string, description?: string) =>
            showToast({ message, description, type: 'error' }),
        [showToast]
    );
    const warning = useCallback(
        (message: string, description?: string) =>
            showToast({ message, description, type: 'warning' }),
        [showToast]
    );
    const info = useCallback(
        (message: string, description?: string) =>
            showToast({ message, description, type: 'info' }),
        [showToast]
    );

    // Separate top / bottom toasts for positioning
    const bottomToasts = toasts.filter(t => t.position === 'bottom');
    const topToasts = toasts.filter(t => t.position === 'top');

    return (
        <ToastContext.Provider value={{ showToast, success, error, warning, info, dismiss, dismissAll }}>
            {children}

            {/* ── Top toasts ── */}
            {topToasts.length > 0 && (
                <View
                    style={[
                        styles.toastStack,
                        styles.topStack,
                        { top: insets.top + 12 },
                    ]}
                    pointerEvents="box-none"
                >
                    {topToasts.map(t => (
                        <SingleToast key={t.id} toast={t} onDismiss={dismiss} />
                    ))}
                </View>
            )}

            {/* ── Bottom toasts ── */}
            {bottomToasts.length > 0 && (
                <View
                    style={[
                        styles.toastStack,
                        styles.bottomStack,
                        { bottom: insets.bottom + 24 },
                    ]}
                    pointerEvents="box-none"
                >
                    {bottomToasts.map(t => (
                        <SingleToast key={t.id} toast={t} onDismiss={dismiss} />
                    ))}
                </View>
            )}
        </ToastContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        throw new Error('useToast must be used inside <ToastProvider>');
    }
    return ctx;
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    toastStack: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 99999,
        elevation: 99999,
        gap: 8,
        pointerEvents: 'box-none',
    } as any,
    topStack: {
        alignItems: 'stretch',
    },
    bottomStack: {
        alignItems: 'stretch',
    },
    toastWrapper: {
        width: '100%',
    },
    toastContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        minHeight: 60,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    accentBar: {
        width: 4,
        alignSelf: 'stretch',
        borderTopLeftRadius: 16,
        borderBottomLeftRadius: 16,
    },
    iconBadge: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
        marginRight: 12,
        flexShrink: 0,
    },
    iconText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        lineHeight: 18,
    },
    textBlock: {
        flex: 1,
        paddingVertical: 14,
        paddingRight: 4,
        gap: 2,
    },
    toastMessage: {
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 19,
        letterSpacing: 0.1,
    },
    toastDescription: {
        fontSize: 12,
        fontWeight: '500',
        lineHeight: 16,
        marginTop: 2,
    },
    dismissBtn: {
        paddingHorizontal: 14,
        paddingVertical: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dismissText: {
        fontSize: 13,
        fontWeight: '700',
        opacity: 0.8,
    },
});