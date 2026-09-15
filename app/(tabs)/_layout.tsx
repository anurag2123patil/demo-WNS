import React, { useState } from "react";
import { View } from "react-native";
import { Tabs, useSegments, Redirect, router } from "expo-router";
import { Map, FileText, Bell, Package, Users, Layout, LayoutDashboard, Forklift, FolderKanban } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context"; // ← ADD THIS

import GlobalHeader from "./GlobalHeader";
import Sidebar from "./Sidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export default function TabLayout() {
  const { isAuthenticated, selectedProject, hasAccess, hasWriteAccess } = useAuth();

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const openSidebar = () => setSidebarVisible(true);
  const closeSidebar = () => setSidebarVisible(false);

  const { theme } = useTheme();
  const insets = useSafeAreaInsets(); // ← ADD THIS

  const segments = useSegments();
  const currentTab = segments[1];

  const titleMap: Record<string, string> = {
    index: "Dashboard",
    reports: "Reports",
    documents: "Documents",
    inventory: "Inventory",
    labour: "Labour",
  };

  const pageTitle = titleMap[currentTab] || "Dashboard";
  const sizes = 22;
  const fullTitle = selectedProject?.name
    ? `${pageTitle} (${selectedProject.name})`
    : pageTitle;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <GlobalHeader title={fullTitle} onMenuPress={openSidebar} onNotificationPress={() => router.push("/(tabs)/notifications")} />
      <Sidebar visible={sidebarVisible} onClose={closeSidebar} />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.button,
          tabBarInactiveTintColor: theme.subtext,
          tabBarLabelStyle: {
            color: theme.subtext,
            fontSize: 9,
            fontWeight: "500",
          },
          tabBarStyle: {
            backgroundColor: theme.cardColor,
            borderTopWidth: 0,
            borderTopColor: theme.borderColor,
            // ↓ KEY FIX: dynamically accounts for gesture bar & button nav
            height: 65 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            href: hasAccess("DASHBOARD") ? undefined : null,
            tabBarIcon: ({ size, color }) => <LayoutDashboard size={sizes} color={color} />,
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "Inventory",
            href: hasAccess("INVENTORY") ? undefined : null,

            tabBarIcon: ({ size, color }) => (
              <Package size={sizes} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="labour"
          options={{
            title: "Labour",
            href: hasAccess("LABOUR_AND_MACHINERY") ? undefined : null,

            tabBarIcon: ({ size, color }) => (
              <Forklift size={sizes} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="generic_activity"
          options={{
            title: "Activity",
            href: hasAccess("GENERIC_ACTIVITY") ? undefined : null,
            tabBarIcon: ({ size, color }) => (
              <Users size={sizes} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Reports",
            href: hasAccess("REPORTS") ? undefined : null,
            tabBarIcon: ({ size, color }) => (
              <FileText size={sizes} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="documents"
          options={{
            title: "Documents",
            href: hasAccess("PROJECT_DETAILS") ? undefined : null,
            tabBarIcon: ({ size, color }) => (
              <FolderKanban size={sizes} color={color} />
            ),
          }}
        />




        <Tabs.Screen name="profile" options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="GlobalHeader" options={{ href: null }} />
        <Tabs.Screen name="Sidebar" options={{ href: null }} />
      </Tabs>
    </View>
  );
}