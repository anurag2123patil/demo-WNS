import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export default function AccessDenied({ moduleName }: { moduleName: string }) {
    const { theme } = useTheme();

    return (
        <View style={[styles.center, { backgroundColor: theme.background }]}>
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: theme.cardColor,
                        borderColor: theme.borderColor,
                        shadowColor: theme.shadowColor,
                    },
                ]}
            >
                <View style={[styles.iconBox, { backgroundColor: theme.badgeOrange }]}>
                    <AlertTriangle size={32} color={theme.iconWarning} />
                </View>
                <Text style={[styles.title, { color: theme.heading }]}>Access Denied</Text>
                <Text style={[styles.subtext, { color: theme.textMuted }]}>
                    You don't have permission to access the {moduleName}.{'\n'}
                    Please contact your administrator.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        padding: 30,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        width: '100%',
        elevation: 2,
        shadowOpacity: 0.07,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
    },
    iconBox: {
        width: 64,
        height: 64,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 15,
        marginBottom: 10,
    },
    subtext: {
        textAlign: 'center',
        fontSize: 16,
        lineHeight: 24,
    },
});