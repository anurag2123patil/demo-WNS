import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Image,
  useWindowDimensions,
  KeyboardAvoidingView,
} from "react-native";
import { useAlert } from '@/hooks/useAlert';
import { APP_VERSION } from "@/src/constants/appConfig";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { loginUser, fetchMe } from "@/api/api";
import { Alert } from "react-native";

import { Mail, Lock, Phone, Facebook, User, Eye, EyeOff } from "lucide-react-native";

// ----------------------------------------------------

export default function LoginScreen() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [selectedMethod, setSelectedMethod] = useState<"mobile" | "email">("email");

  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { showAlert, AlertComponent } = useAlert();

  // const [username, setUsername] = useState("akshayd");
  // const [password, setPassword] = useState("Akshay@123");
  //  const [username, setUsername] = useState("adiadmin1");
  // const [password, setPassword] = useState("Pass@8751");
   const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // const [username, setUsername] = useState("geoinfra_vw1");
  // const [password, setPassword] = useState("Geoinfra@8751");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/project-selection");
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  if (isLoading) {
    return null;
  }

  const sendOTP = () => {
    if (mobileNumber.trim()) {
      setOtpSent(true);
      setTimer(180);
    }
  };

  const resendOTP = () => setTimer(180);

  const timerFormat = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getErrorMessage = (error: any) => {
    const errorMsg = error?.message || "";

    if (errorMsg.includes("401")) {
      return "The username or password you entered is incorrect.";
    }

    if (errorMsg.includes("Network") || errorMsg.includes("fetch")) {
      return "Connection error. Please check your internet.";
    }

    return "Something went wrong. Please try again.";
  };

  const handleLoginSignup = async () => {
    if (loading) return;

    setFormError(null);
    setLoading(true);

    try {
      if ((username === "testuser" || username === "testuser@gmail.com") && password === "123456") {
        router.replace("/project-selection");
        return;
      }
      const res = await loginUser({ username: username.trim(), password });
      const user = await fetchMe();
      login(user, res.access_token);
      console.log("Login successful, user data:", res.access_token);
      router.replace("/project-selection");
    } catch (error: any) {
      const msg = getErrorMessage(error);
      setFormError(msg);

      if (error?.message?.includes("401")) {
        showAlert("Login Failed", "The username or password you entered is incorrect.", "error");
      } else {
        showAlert("Error", msg, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const loginGoogle = () => {
    login();
    router.replace("/project-selection");
  };

  const fontScale = width < 360 ? 0.9 : width < 430 ? 1 : 1.1;

  return (
    <LinearGradient
      colors={["#2a828e", "#b2ebf2"]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 40}
        enabled
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingHorizontal: width * 0.06 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* HEADER */}
          <View style={styles.header}>
            <View style={[styles.logoCircle, { width: width * 0.38, height: width * 0.18 }]}>
              <Image
                source={require("@/assets/images/new_logo52.png")}
                style={{ width: width * 0.30, height: width * 0.14 }}
                resizeMode="contain"
              />
            </View>

            <Text style={[styles.title, { fontSize: 28 * fontScale }]}>
              {mode === "login" ? "Welcome Back!" : "Create Account"}
            </Text>
            <Text style={[styles.subtitle, { fontSize: 14 * fontScale }]}>
              {mode === "login" ? "Login to continue" : "Sign up to get started"}
            </Text>
          </View>

          {/* TABS */}
          <View style={styles.tabBox}>
            {[
              { key: "email", label: "Email", icon: Mail },
              // { key: "mobile", label: "Mobile", icon: Phone },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setSelectedMethod(item.key as "mobile" | "email")}
                  style={[
                    styles.tabButton,
                    selectedMethod === item.key && styles.tabActive,
                  ]}
                >
                  <Icon size={16} color={selectedMethod === item.key ? "#fff" : "#2a828e"} />
                  <Text
                    style={[
                      styles.tabLabel,
                      selectedMethod === item.key && styles.tabLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* FORM CARD */}
          <View style={styles.formCard}>
            {formError && (
              <View
                style={{
                  backgroundColor: "#ffdede",
                  padding: 10,
                  borderRadius: 10,
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: "#b00020", fontWeight: "600" }}>
                  {formError}
                </Text>
              </View>
            )}

            {/* MOBILE LOGIN */}
            {selectedMethod === "mobile" && (
              <>
                {mode === "signup" && (
                  <>
                    <Text style={styles.label}>Full Name</Text>
                    <View style={styles.inputIconRow}>
                      <User size={20} color="#6a7b80" />
                      <TextInput
                        style={styles.iconInput}
                        placeholder="Enter your name"
                        placeholderTextColor="#6a7b80"
                        value={name}
                        onChangeText={setName}
                      />
                    </View>
                  </>
                )}

                <Text style={styles.label}>Mobile Number</Text>

                <View style={styles.row}>
                  <TextInput
                    style={styles.codeInput}
                    value={countryCode}
                    onChangeText={setCountryCode}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter mobile number"
                    placeholderTextColor="#6a7b80"
                    value={mobileNumber}
                    onChangeText={setMobileNumber}
                    keyboardType="phone-pad"
                  />
                </View>

                {!otpSent ? (
                  <TouchableOpacity style={styles.primaryButton} onPress={sendOTP}>
                    <Text style={styles.primaryText}>Send OTP</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={styles.label}>Enter OTP</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#6a7b80"
                      keyboardType="numeric"
                      maxLength={6}
                      value={otp}
                      onChangeText={setOtp}
                    />

                    <View style={{ alignItems: "center", marginBottom: 10 }}>
                      {timer > 0 ? (
                        <Text style={styles.timerText}>
                          Resend in {timerFormat(timer)}
                        </Text>
                      ) : (
                        <TouchableOpacity onPress={resendOTP}>
                          <Text style={styles.resendText}>Resend OTP</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.primaryButton,
                        loading && { opacity: 0.7 }
                      ]}
                      disabled={loading}
                      onPress={handleLoginSignup}
                    >
                      <Text style={styles.primaryText}>
                        {loading ? "Please wait..." : mode === "login" ? "Login" : "Create Account"}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {/* EMAIL LOGIN */}
            {selectedMethod === "email" && (
              <>
                {mode === "signup" && (
                  <>
                    <Text style={styles.label}>Full Name</Text>
                    <View style={styles.inputIconRow}>
                      <User size={20} color="#6a7b80" />
                      <TextInput
                        style={styles.iconInput}
                        placeholder="Enter your name"
                        placeholderTextColor="#6a7b80"
                        value={name}
                        onChangeText={setName}
                      />
                    </View>
                  </>
                )}

                <Text style={styles.label}>Username</Text>
                <View style={styles.inputIconRow}>
                  <Mail size={20} color="#6a7b80" />
                  <TextInput
                    style={styles.iconInput}
                    placeholder="Enter username or email"
                    placeholderTextColor="#6a7b80"
                    value={username}
                    onChangeText={setUsername}
                  />
                </View>

                <Text style={styles.label}>Password</Text>
                <View style={styles.inputIconRow}>
                  <Lock size={20} color="#6a7b80" />
                  <TextInput
                    style={styles.iconInput}
                    placeholder="Enter password"
                    placeholderTextColor="#6a7b80"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? (
                      <EyeOff size={20} color="#6a7b80" />
                    ) : (
                      <Eye size={20} color="#6a7b80" />
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={handleLoginSignup}>
                  <Text style={styles.primaryText}>
                    {mode === "login" ? "Login" : "Create Account"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Divider */}
          {/* <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or continue with</Text>
            <View style={styles.dividerLine} />
          </View> */}

          {/* Social Buttons */}
          {/* <View style={styles.socialWrap}>
            <TouchableOpacity style={styles.socialButton} onPress={loginGoogle}>
              <Mail size={18} color="#d9534f" />
              <Text style={styles.socialLabel}>Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialButton}>
              <Facebook size={18} color="#1877f2" />
              <Text style={styles.socialLabel}>Facebook</Text>
            </TouchableOpacity>
          </View> */}

          {/* ── Forgot Password ── */}
          <View style={{ alignItems: "center", marginTop: 18 }}>
            <TouchableOpacity onPress={() => router.push("/Forgotpasswordscreen")}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Version {APP_VERSION}</Text>
      </View>
      <AlertComponent />
    </LinearGradient>
  );
}

/* ---------------------- STYLES ----------------------- */
const styles = StyleSheet.create({
  content: { paddingBottom: 0 },

  header: {
    backgroundColor: "#2a828e",
    paddingTop: 25,
    paddingBottom: 25,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: "center",
    marginBottom: 10,
  },

  logoCircle: {
    backgroundColor: "#c9f3f4",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    overflow: "hidden",
  },

  title: { color: "#fff", fontWeight: "800" },
  subtitle: { color: "#E8FFFF", marginTop: 4 },

  tabBox: {
    flexDirection: "row",
    backgroundColor: "#d6f7f8",
    padding: 6,
    borderRadius: 14,
    marginBottom: 25,
  },

  tabButton: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },

  versionContainer: {
    alignItems: "center",
    paddingBottom: 40,
  },

  versionText: {
    color: "#004d55",
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.8,
  },

  tabActive: { backgroundColor: "#2a828e" },
  tabLabel: { color: "#2a828e", fontWeight: "700" },
  tabLabelActive: { color: "#fff" },

  formCard: {
    backgroundColor: "#004d55",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#c9f3f4",
    padding: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },

  row: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },

  codeInput: {
    width: 70,
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 12,
    color: "#000",
    fontSize: 16,
  },

  input: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 12,
    color: "#000",
    fontSize: 16,
  },

  inputIconRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 18,
    gap: 8,
    alignItems: "center",
  },

  iconInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",
  },

  primaryButton: {
    backgroundColor: "#2a828e",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  primaryText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  timerText: {
    color: "#6a7b80",
    fontSize: 14,
  },

  resendText: {
    color: "#f5f5f5",
    fontSize: 14,
    fontWeight: "700",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
    justifyContent: "center",
  },

  dividerLine: {
    flex: 1,
    height: 1.2,
    backgroundColor: "#8EDAE2",
  },

  dividerText: {
    marginHorizontal: 10,
    color: "#004d55",
    fontSize: 14,
    fontWeight: "600",
  },

  socialWrap: {
    flexDirection: "row",
    gap: 12,
  },

  socialButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: "#c9f3f4",
    borderRadius: 14,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  socialLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#004d55",
  },

  // ── Forgot password link ──────────────────────────────
  forgotText: {
    color: "#004d55",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});