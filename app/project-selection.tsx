import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { Search, Folder, Power, Check } from "lucide-react-native";
import { fetchMyProjects } from "@/api/api";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlert } from "@/hooks/useAlert";

export default function ProjectSelectionScreen() {
  const router = useRouter();
  const { selectProject, user, logout, selectedProject } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert, AlertComponent } = useAlert();
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const formatDate = (date: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-GB");
    // Output: 03/04/2026
  };
  const handleLogout = () => {
    showAlert(
      "Sign Out",
      "Are you sure you want to sign out?",
      "warning",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => { },
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              router.replace("/login");
            } catch (err) {
              console.error("Logout failed:", err);
            }
          },
        },
      ]
    );
  };

  const handleProjectSelect = async (project: any) => {
    if (loading) return;
    setLoading(true);
    try {
      await selectProject(project);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    } catch (err) {
      console.error("Failed to select project:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const data = await fetchMyProjects();
        const mapped = data.map((p: any) => ({
          ...p,
          startDate: "-",
          endDate: "-",
          progress: 0,
        }));
        setProjects(mapped);
      } catch (err) {
        console.error("Failed to load projects", err);
      } finally {
        setLoading(false);
      }
    };
    loadProjects();
  }, []);

  const renderProjectCard = ({ item }: { item: any }) => {
    const isSelected = selectedProject?.id === item.id;

    return (
      <TouchableOpacity
        onPress={() => handleProjectSelect(item)}
        activeOpacity={0.9}
        style={[styles.projectCard, isSelected && styles.projectCardSelected]}
      >
        {/* ID Badge */}
        <View style={styles.dateContainer}>
          <View style={[styles.idBadge, isSelected && styles.idBadgeSelected]}>
            <Text style={[
              styles.dateText,
              { color: isSelected ? "#fff" : "#006064" }
            ]}>
              Start Date : {formatDate(item.start_date)}
            </Text>
          </View>

          <View style={[styles.idBadge, isSelected && styles.idBadgeSelected]}>
            <Text style={[
              styles.dateText,
              { color: isSelected ? "#fff" : "#006064" }
            ]}>
              End Date : {formatDate(item.end_date)}
            </Text>
          </View>
        </View>
        {/* Icon Box */}
        <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
          <Folder
            size={28}
            color={isSelected ? "#ffffff" : "#005f6b"}
            strokeWidth={2.2}
          />
        </View>

        {/* Project Name */}
        <Text style={[styles.projectName, isSelected && styles.projectNameSelected]}>
          {item.name}
        </Text>

        {/* Currently Selected Badge OR Select Project button */}
        {isSelected ? (
          <View style={styles.selectedBadge}>
            <Check size={14} color="#ffffff" strokeWidth={2.5} />
            <Text style={styles.selectedBadgeText}>Currently Selected</Text>
          </View>
        ) : (
          <View style={styles.selectBtn}>
            <Text style={styles.selectBtnText}>Select Project</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const initials = user?.firstname
    ? user.firstname
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : "U";

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        {/* Top row: avatar + logout */}
        <View style={styles.topRow}>
          <View style={styles.avatarPill}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
            {user?.firstname ? (
              <Text style={styles.avatarName} numberOfLines={1}>
                {user.firstname} {user.lastname}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            onPress={handleLogout}
            activeOpacity={0.7}
            style={styles.logoutBtn}
          >
            <Power size={16} color="rgba(255, 255, 255, 0.9)" strokeWidth={2.5} />
            <Text style={styles.logoutLabel}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.welcomeText}>
          Welcome Back{user?.firstname ? `, ${user.firstname.split(" ")[0]}` : ""}!
        </Text>
        <Text style={styles.subHeader}>Choose Your Project</Text>

        {/* Active project pill */}
        {/* {selectedProject && (
          <View style={styles.activeProjectPill}>
            <View style={styles.activeProjectDot} />
            <Text style={styles.activeProjectLabel} numberOfLines={1}>
              Active: <Text style={styles.activeProjectName}>{selectedProject.name}</Text>
            </Text>
          </View>
        )} */}
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <Search size={18} color="#006d75" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search projects..."
          placeholderTextColor="#6a7b80"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* PROJECT LIST */}
      <FlatList
        data={filteredProjects}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProjectCard}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      />
      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#b2ebf2",
  },

  header: {
    paddingHorizontal: 24,
    paddingBottom: 26,
    backgroundColor: "#2a828e",
    marginTop: -1,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 6,
    shadowColor: "#00424a",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  avatarPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 50,
    paddingRight: 14,
    paddingVertical: 4,
    paddingLeft: 4,
    gap: 8,
    maxWidth: "60%",
  },

  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#80deea",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarInitials: {
    fontSize: 13,
    fontWeight: "800",
    color: "#004d55",
    letterSpacing: 0.5,
  },

  avatarName: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#e0ffff",
    flexShrink: 1,
  },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },

  logoutLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 0.2,
  },

  welcomeText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.3,
  },

  subHeader: {
    marginTop: 5,
    fontSize: 15,
    color: "#b2f0f5",
    opacity: 0.9,
  },

  searchContainer: {
    marginTop: 18,
    marginHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#b2ebf2",
    gap: 10,
  },

  searchInput: {
    flex: 1,
    fontSize: 15.5,
    color: "#003c43",
  },

  listContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
  },

  // ─── Base card ───────────────────────────────────────────────────────────────
  projectCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
    borderWidth: 2,
    borderColor: "#c9f3f4",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },

  // ─── Selected card overrides ──────────────────────────────────────────────
  projectCardSelected: {
    backgroundColor: "#2a9baa",   // solid teal fill matching the screenshot
    borderColor: "#1d8494",
    shadowColor: "#006675",
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  idBadge: {
    backgroundColor: "#e0f7fa",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "600",
  },
  idBadgeSelected: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#8ADCE6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  iconBoxSelected: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },

  projectName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#004d55",
    marginBottom: 10,
  },

  projectNameSelected: {
    color: "#ffffff",
  },

  // ─── "Currently Selected" badge ──────────────────────────────────────────
  selectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },

  selectedBadgeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ffffff",
    letterSpacing: 0.2,
  },

  // ─── "Select Project" button (unselected cards) ───────────────────────────
  selectBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#e0f7fa",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#b2ebf2",
  },

  selectBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#006064",
    letterSpacing: 0.2,
  },
  activeProjectPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },

  activeProjectDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#80ffea",
  },

  activeProjectLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },

  activeProjectName: {
    color: "#ffffff",
    fontWeight: "700",
  },
  dateContainer: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "column",
    gap: 10,
  },
});