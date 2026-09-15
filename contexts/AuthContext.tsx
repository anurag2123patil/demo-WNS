import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMe, selectProjectApi } from "@/api/api";

interface User {
  id: number;
  email: string;
  username: string;
  firstname: string;
  lastname: string;
}

interface AccessItem {
  module_id: number;
  module_name: string;
  module_code: string;
  feature_id: number;
  feature_name: string;
  feature_code: string;
  mapping_id: number;
  is_access: boolean;
  is_write_access: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  token: string | null;
  projectSelected: boolean;
  selectedProject: any;
  isCompressImage: boolean;
  addGeoTag: boolean;
  accessList: AccessItem[];
  login: (userData: User, token: string) => void;
  logout: () => Promise<void>;
  selectProject: (project: any) => void;
  hasAccess: (featureCode: string) => boolean;
  hasWriteAccess: (featureCode: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [projectSelected, setProjectSelected] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isCompressImage, setIsCompressImage] = useState(true);
  const [addGeoTag, setAddGeoTag] = useState(false);
  const [accessList, setAccessList] = useState<AccessItem[]>([]);

  const login = async (userData: User, token: string) => {
    setUser(userData);
    setToken(token);
    setIsAuthenticated(true);
    await AsyncStorage.setItem("access_token", token);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(["access_token", "refresh_token"]);
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
    setProjectSelected(false);
    setSelectedProject(null);
    setIsCompressImage(false);
    setAddGeoTag(false);
    setAccessList([]);
  };

  useEffect(() => {
    const checkPersistedAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem("access_token");
        if (storedToken) {
          const userData = await fetchMe();
          setToken(storedToken);
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Silent login failed:", error);
        await AsyncStorage.removeItem("access_token");
      } finally {
        setIsLoading(false);
      }
    };
    checkPersistedAuth();
  }, []);

  const selectProject = async (project: any) => {
    if (!token) throw new Error("No token available for selecting project");
    try {
      const res = await selectProjectApi(project.id, token);

      if (res?.access_token) {
        setToken(res.access_token);
        await AsyncStorage.setItem("access_token", res.access_token);
      }

      const projectConfig = res.project_data;

      // ✅ FIX: Save the roleData into the selectedProject state
      setSelectedProject({
        ...project,
        roleData: res.roleData, // This contains the role.name "Super Admin"
        projectData: res.project_data, // This contains the project configuration like compress_image and add_geo_tag
        currentSubscription: res.current_subscription
      });

      setProjectSelected(true);
      setIsCompressImage(!!projectConfig?.compress_image);
      setAddGeoTag(!!projectConfig?.add_geo_tag);

      if (res?.access && Array.isArray(res.access)) {
        setAccessList(res.access);
      }
    } catch (error) {
      console.error("❌ selectProject error:", error);
      throw error;
    }
  };
  // ✅ Check if user has read access to a feature
  const hasAccess = (featureCode: string): boolean => {
    const feature = accessList.find((item) => item.feature_code === featureCode);
    return feature?.is_access ?? false;
    // return false;
  };

  // ✅ Check if user has write access to a feature
  const hasWriteAccess = (featureCode: string): boolean => {
    const feature = accessList.find((item) => item.feature_code === featureCode);
    return feature?.is_write_access ?? false;
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        token,
        projectSelected,
        selectedProject,
        isCompressImage,
        addGeoTag,
        accessList,
        login,
        logout,
        selectProject,
        hasAccess,
        hasWriteAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}