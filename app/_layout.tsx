import React, { useState, useEffect } from 'react'; // Added hooks
import { View, Text, StyleSheet } from 'react-native'; // Added UI components
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {ThemeProvider} from '@/contexts/ThemeContext';
import NetInfo from "@react-native-community/netinfo"; // Added NetInfo

// Sub-component to handle the UI and safe area spacing
const OfflineNotice = () => {
  const [isOffline, setIsOffline] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Listen for network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Logic: Show if explicitly disconnected OR if Wi-Fi is on but no internet access
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View style={[styles.offlineContainer, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.offlineText}>No Internet Connection</Text>
    </View>
  );
};

export default function RootLayout() {
  useFrameworkReady();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>                          
        <ThemeProvider>
          <AuthProvider>
            {/* The Stack contains your screens */}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="project-selection" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="+not-found" />
            </Stack>

            {/* This sits ON TOP of the stack globally */}
            <OfflineNotice />
            
            <StatusBar style="auto" />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>                      
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  offlineContainer: {
    backgroundColor: '#b52424',
    height: 90,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    position: 'absolute',
    top: 0,
    zIndex: 9999, // Ensure it's above all other layers
  },
  offlineText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14
  },
});