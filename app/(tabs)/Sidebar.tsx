import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  TouchableWithoutFeedback,
  Modal,
  SafeAreaView,
  ScrollView,
  Platform,
  Switch,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import {
  User,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  X,
  SquarePen,
  Users,
  Moon,
  Sun,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { clearLayerConfigCache } from "@/api/api";
import { useAlert } from "@/hooks/useAlert";
import { useTheme } from "../../contexts/ThemeContext";
const { width } = Dimensions.get("window");
const SIDEBAR_WIDTH = width * 0.75;
const USER = {
  name: "Admin",
  role: "Site Engineer",
  avatar: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
  email: "admin.admin@austere.co.in",
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function Sidebar({ visible, onClose }: Props) {
  const { theme, toggleTheme, isDark } = useTheme();
  const { showAlert, AlertComponent } = useAlert();
  const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();
  const { logout, hasAccess, user, selectedProject } = useAuth();
  const fullName = user ? `${user.firstname} ${user.lastname}` : "Guest User";
  const userRole = selectedProject?.roleData?.role?.name || "No Role Assigned";
  // const displayRole = user?.roleData?.role?.name || "Member";
  const avatarUrl = "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  useEffect(() => {
    if (visible) {
      setShowModal(true);
      console.log("M user", selectedProject);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SIDEBAR_WIDTH,
        duration: 240,
        useNativeDriver: true,
      }).start(() => setShowModal(false));
    }
  }, [visible]);

  if (!showModal) return null;

  const navigate = (path: string) => {
    onClose();
    setTimeout(() => {
      router.push(path as any);
    }, 250);
  };

  const handleLogout = async () => {
    showAlert(
      "Sign Out",
      "Are you sure you want to sign out?",
      "warning",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => { }
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            onClose();
            await logout();
            clearLayerConfigCache();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };
  return (
    <Modal transparent visible={showModal} animationType="none">
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sidebar,
            { backgroundColor: theme.background, transform: [{ translateX: slideAnim }] },
          ]}
        >
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.header}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />

              {/* UPDATED: Dynamic Name and Role */}
              <Text style={styles.name}>{`${fullName}`}</Text>
              <Text style={styles.role}>{userRole}</Text>

              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={26} color="#FFF" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.menuSection}>
              {/* Profile */}
              {/* <TouchableOpacity style={styles.menuItem} onPress={() => navigate("/profile")}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBg,]}>
                    <User size={20} color="#8E8E93" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>Profile</Text>
                </View>
                <ChevronRight size={20} color="#C7C7CC" />
              </TouchableOpacity> */}

              {/* Project Selection */}
              <TouchableOpacity style={styles.menuItem} onPress={() => navigate("/project-selection")}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBg]}>
                    <SquarePen size={20} color="#8E8E93" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>Project Selection</Text>
                </View>
                <ChevronRight size={20} color="#C7C7CC" />
              </TouchableOpacity>

              {/* Notifications */}
              {/* {hasAccess("DASHBOARD_ALERT") && (
                <TouchableOpacity style={styles.menuItem} onPress={() => navigate("/notifications")}>
                  <View style={styles.menuLeft}>
                    <View style={[styles.iconBg]}>
                      <Bell size={20} color="#8E8E93" />
                    </View>
                    <Text style={[styles.menuText, { color: theme.text }]}>Notifications</Text>
                  </View>
                  <ChevronRight size={20} color="#C7C7CC" />

                </TouchableOpacity>
              )} */}
              {hasAccess("GENERIC_ACTIVITY") && (

                <TouchableOpacity style={styles.menuItem} onPress={() => navigate("/generic_activity")}>
                  <View style={styles.menuLeft}>
                    <View style={[styles.iconBg]}>
                      <Users size={20} color="#8E8E93" />
                    </View>
                    <Text style={[styles.menuText, { color: theme.text }]}>Generic Activity</Text>
                  </View>
                  <ChevronRight size={20} color="#C7C7CC" />

                </TouchableOpacity>
              )}


              {/* Settings */}
              {/* <TouchableOpacity style={styles.menuItem} onPress={() => navigate("/settings")}>
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBg, { backgroundColor: "#F5F5F7" }]}>
                    <Settings size={20} color="#8E8E93" />
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>Settings</Text>
                </View>
                <ChevronRight size={20} color="#C7C7CC" />
              </TouchableOpacity> */}
              <View style={styles.menuItem}>
                <View style={styles.menuLeft}>
                  <View style={styles.iconBg}>
                    {/* Dynamic icon based on theme */}
                    {isDark ? (
                      <View style={[styles.iconBg, { backgroundColor: "#3A3A3C" }]}>
                        <Moon size={20} color="#FFD60A" />
                      </View>
                    ) : (
                      <View style={[styles.iconBg, { backgroundColor: "#F2F2F7" }]}>
                        <Sun size={20} color="#8E8E93" />
                      </View>
                    )}
                  </View>
                  <Text style={[styles.menuText, { color: theme.text }]}>Dark Mode</Text>
                </View>

                <Switch
                  trackColor={{ false: "#D1D1D6", true: "#34C759" }} // iOS style green for 'on'
                  thumbColor={Platform.OS === "ios" ? undefined : isDark ? "#FFFFFF" : "#F4F3F4"}
                  onValueChange={toggleTheme}
                  value={isDark}
                />
              </View>
              <View style={styles.divider} />

              {/* LOGOUT - Now placed inside the ScrollView below Settings */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={handleLogout}
              >
                <View style={styles.menuLeft}>
                  <View style={[styles.iconBg, { backgroundColor: "#FFEBEB" }]}>
                    <LogOut size={20} color="#FF3B30" />
                  </View>
                  <Text style={[styles.menuText, { color: "#FF3B30" }]}>Sign Out</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Animated.View>
      </View>
      <AlertComponent />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },

  sidebar: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    // backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 10,
  },
  row: {
    flexDirection: 'row', // Side by side
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 200,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    backgroundColor: "#007AFF",
    paddingVertical: 32,
    alignItems: "center",
    marginBottom: 10,
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },

  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFF",
    marginTop: 10,
  },

  role: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
  },

  closeButton: {
    position: "absolute",
    top: Platform.OS === "android" ? 40 : 20,
    right: 20,
  },

  menuSection: {
    paddingTop: 10,
  },

  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },

  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  menuText: {
    fontSize: 16,
    color: "#1C1C1E",
    fontWeight: "500",
  },

  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginVertical: 8,
    marginHorizontal: 20,
  },

  badge: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },

  badgeText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },

  footerLogout: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
    gap: 12,
  },

  logoutText: {
    fontSize: 16,
    color: "#FF3B30",
    fontWeight: "600",
  },
});
