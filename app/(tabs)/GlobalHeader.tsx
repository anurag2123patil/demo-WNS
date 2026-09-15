import React, { useEffect, useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Menu, Bell } from "lucide-react-native";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProjectAlerts } from "@/api/api";

interface Props {
  title: string;
  onMenuPress?: () => void;
  onNotificationPress?: () => void;
  unreadCount?: number;
}

export default function GlobalHeader({
  title,
  onMenuPress,
  onNotificationPress,
  unreadCount = 0,
}: Props) {
  const { hasAccess, selectedProject } = useAuth();
  const [alertCount, setAlertCount] = useState(0);
  const getAlertCount = async () => {
    try {
      const res = await fetchProjectAlerts();
      if (res.status && res.data) {
        const d = res.data;
        const va = d.verificationAlert;

        // 1. Project Alerts (Behind schedule)
        const projectCount = d.project_completed.filter(
          (p: any) => parseFloat(p.perce_crr_dt) > parseFloat(p.progress)
        ).length > 0 ? 1 : 0;

        // 2. Inventory Alerts
        const inventoryCount = d.data?.length ?? 0;

        // 3. Verification Items
        const verifications = [
          ...(va?.pipeline_alert ?? []),
          ...(va?.tank_alert ?? []),
          ...(va?.stp_alert ?? []),
          ...(va?.junction_alert ?? []),
          ...(va?.manhole_alert ?? []),
        ].filter((v: any) => parseInt(v.cnt) > 0).length;

        // 4. Machinery & Labour flags
        const machineryCount = (va?.machinery_alert?.length ?? 0) > 0 ? 1 : 0;
        const labourCount = (va?.labour_alert?.length ?? 0) > 0 ? 1 : 0;

        // Total sum mirroring your Notifications logic
        setAlertCount(projectCount + inventoryCount + verifications + machineryCount + labourCount);
      }
    } catch (error) {
      console.error("Header Alert Fetch Error:", error);
    }
  };
  useEffect(() => {
    // console.log("Setting up alert count fetch for project:", selectedProject?.projectData?.logo_url);
    // 1. Initial fetch when component mounts or project changes
    if (hasAccess("DASHBOARD_ALERT")) {
      getAlertCount();
    }

    // 2. Set up the 5-second interval
    const intervalId = setInterval(() => {
      if (hasAccess("DASHBOARD_ALERT")) {
        getAlertCount();
      }
    }, 10000); // 5000ms = 5 seconds

    // 3. Cleanup function to stop the timer when the user leaves the screen
    return () => clearInterval(intervalId);

  }, [selectedProject?.id]);
  return (
    <View style={styles.header}>
      {/* LOGO */}
      {/* <View style={styles.logoWrapper}> */}
      <View style={styles.logoWrapper}>
        <Image
          source={
            selectedProject?.projectData?.logo_url
              ? { uri: selectedProject?.projectData?.logo_url }
              : require("@/assets/images/logo.png")
          }
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      {/* </View> */}

      {/* TITLE */}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>

      {/* RIGHT ICONS */}
      <View style={styles.rightIcons}>
        {/* NOTIFICATION BELL */}
        {hasAccess("DASHBOARD_ALERT") && (
          <TouchableOpacity
            onPress={onNotificationPress}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Bell size={22} color="#FFFFFF" />
            {/* Use alertCount here instead of unreadCount */}
            {alertCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {alertCount > 99 ? "99+" : alertCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        {/* MENU */}
        <TouchableOpacity
          onPress={onMenuPress}
          style={styles.iconButton}
          activeOpacity={0.7}
        >
          <Menu size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#0A8CD2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 30,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 3,
  },
  logo: {
    width: 70,   // increase size
    height: 30,
  },
  logoWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,   // rounded corners like image
    padding: 6,         // space around logo
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginHorizontal: 12,
  },
  rightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    position: "relative",
    padding: 6,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#0A8CD2",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
  },
});