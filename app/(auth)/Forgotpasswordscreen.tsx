import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
    ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Mail, Lock, User, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react-native";
// import { forgotPassword, verifyOtp, resetPassword } from "../api/api_auth"; // ← adjust path
import { forgotPassword, verifyOtp, resetPassword } from "../../api/api_auth";
// ─── Step types ──────────────────────────────────────────────────────────────
type Step = "request" | "verify" | "reset" | "success";

export default function ForgotPasswordScreen() {
    const router = useRouter();

    const [step, setStep] = useState<Step>("request");

    // Step 1 – request
    const [email, setEmail] = useState("");

    // Step 2 – verify OTP
    const [otp, setOtp] = useState("");
    const [timer, setTimer] = useState(0);
    const [otpError, setOtpError] = useState<string | null>(null);

    // Step 3 – reset password
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [resetError, setResetError] = useState<string | null>(null);
    const [otpResent, setOtpResent] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // ── Timer countdown ────────────────────────────────────────────────────────
    useEffect(() => {
        let interval: any;
        if (timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const timerFormat = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    // ── Step 1: Send OTP ───────────────────────────────────────────────────────
    const handleSendOTP = async () => {
        if (!email.trim()) return;

        setRequestError(null);
        setLoading(true);
        try {
            await forgotPassword(email.trim());
            setTimer(300);
            setStep("verify");
        } catch (err: any) {
            setRequestError("Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendOTP = async () => {
        setResendLoading(true);
        setOtpError(null);
        setOtpResent(false); // Hide previous success message if any

        try {
            await forgotPassword(email.trim());
            setTimer(300);
            setOtp("");
            setOtpResent(true);
            // Hide success message after 3 seconds
            setTimeout(() => setOtpResent(false), 3000);
        } catch (err: any) {
            setOtpError("Failed to resend OTP. Please try again.");
        } finally {
            setResendLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (otp.length < 6) {
            setOtpError("Please enter a valid 6-digit OTP.");
            return;
        }
        setOtpError(null);
        setLoading(true);
        try {
            await verifyOtp(email.trim(), otp.trim());
            setStep("reset");
        } catch (err: any) {
            setOtpError("Invalid OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Step 3: Reset Password ─────────────────────────────────────────────────
    const handleResetPassword = async () => {
        if (newPassword.length < 6) {
            setResetError("Password must be at least 6 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setResetError("Passwords do not match.");
            return;
        }
        setResetError(null);
        setLoading(true);
        try {
            await resetPassword(email.trim(), otp.trim(), newPassword, confirmPassword);
            setStep("success");
        } catch (err: any) {
            setResetError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Stepper indicator ──────────────────────────────────────────────────────
    const steps = ["Request", "Verify", "Reset"];
    const stepIndex = step === "request" ? 0 : step === "verify" ? 1 : step === "reset" ? 2 : 3;

    return (
        <LinearGradient colors={["#2a828e", "#b2ebf2"]} style={{ flex: 1 }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "padding"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 40}
                enabled
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Top bar ── */}
                    <View style={styles.topBar}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                            <ArrowLeft size={22} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.screenTitle}>Forgot Password</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* ── Step indicator (hidden on success) ── */}
                    {step !== "success" && (
                        <View style={styles.stepperRow}>
                            {steps.map((label, idx) => (
                                <React.Fragment key={label}>
                                    <View style={styles.stepItem}>
                                        <View
                                            style={[
                                                styles.stepDot,
                                                idx < stepIndex && styles.stepDotDone,
                                                idx === stepIndex && styles.stepDotActive,
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.stepDotText,
                                                    idx <= stepIndex && { color: "#fff" },
                                                ]}
                                            >
                                                {idx < stepIndex ? "✓" : idx + 1}
                                            </Text>
                                        </View>
                                        <Text
                                            style={[
                                                styles.stepLabel,
                                                idx === stepIndex && styles.stepLabelActive,
                                            ]}
                                        >
                                            {label}
                                        </Text>
                                    </View>
                                    {idx < steps.length - 1 && (
                                        <View
                                            style={[
                                                styles.stepLine,
                                                idx < stepIndex && styles.stepLineDone,
                                            ]}
                                        />
                                    )}
                                </React.Fragment>
                            ))}
                        </View>
                    )}

                    {/* ════════════════════════════════════════════
                        STEP 1 – Request OTP
                    ════════════════════════════════════════════ */}
                    {step === "request" && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Reset your password</Text>
                            <Text style={styles.cardSubtitle}>
                                Enter your registered email to receive an OTP.
                            </Text>

                            {requestError && (
                                <View style={styles.errorBox}>
                                    <Text style={styles.errorText}>{requestError}</Text>
                                </View>
                            )}

                            {/* Email */}
                            <Text style={styles.label}>Email Address</Text>
                            <View style={styles.inputIconRow}>
                                <Mail size={20} color="#6a7b80" />
                                <TextInput
                                    style={styles.iconInput}
                                    placeholder="Enter your email"
                                    placeholderTextColor="#6a7b80"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.primaryButton,
                                    (!email.trim() || loading) && styles.buttonDisabled,
                                ]}
                                onPress={handleSendOTP}
                                disabled={!email.trim() || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryText}>Send OTP</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ════════════════════════════════════════════
                        STEP 2 – Verify OTP
                    ════════════════════════════════════════════ */}
                    {step === "verify" && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Enter OTP</Text>
                            <Text style={styles.cardSubtitle}>
                                A 6-digit OTP has been sent to{" "}
                                <Text style={{ color: "#fff", fontWeight: "700" }}>{email}</Text>.
                            </Text>
                            {otpResent && (
                                <View style={styles.successBox}>
                                    <Text style={styles.successText}>OTP resent successfully!</Text>
                                </View>
                            )}
                            {otpError && (
                                <View style={styles.errorBox}>
                                    <Text style={styles.errorText}>{otpError}</Text>
                                </View>
                            )}

                            <Text style={styles.label}>OTP</Text>
                            <View style={styles.inputIconRow}>
                                <Lock size={20} color="#6a7b80" />
                                <TextInput
                                    style={styles.iconInput}
                                    placeholder="Enter 6-digit OTP"
                                    placeholderTextColor="#6a7b80"
                                    keyboardType="numeric"
                                    maxLength={6}
                                    value={otp}
                                    onChangeText={setOtp}
                                />
                            </View>

                            {/* Timer / Resend */}
                            <View style={{ alignItems: "center", marginBottom: 16, height: 24, justifyContent: "center" }}>
                                {resendLoading ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : timer > 0 ? (
                                    <Text style={styles.timerText}>
                                        Resend OTP in <Text style={{ fontWeight: "700" }}>{timerFormat(timer)}</Text>
                                    </Text>
                                ) : (
                                    <TouchableOpacity onPress={handleResendOTP}>
                                        <Text style={styles.resendText}>Resend OTP</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleVerifyOTP}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryText}>Verify OTP</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryButton}
                                onPress={() => {
                                    setStep("request");
                                    setOtp("");
                                    setOtpError(null);
                                }}
                            >
                                <Text style={styles.secondaryText}>← Back</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ════════════════════════════════════════════
                        STEP 3 – Reset Password
                    ════════════════════════════════════════════ */}
                    {step === "reset" && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Create New Password</Text>
                            <Text style={styles.cardSubtitle}>
                                Choose a strong password for your account.
                            </Text>

                            {resetError && (
                                <View style={styles.errorBox}>
                                    <Text style={styles.errorText}>{resetError}</Text>
                                </View>
                            )}

                            <Text style={styles.label}>New Password</Text>
                            <View style={styles.inputIconRow}>
                                <Lock size={20} color="#6a7b80" />
                                <TextInput
                                    style={styles.iconInput}
                                    placeholder="Enter new password"
                                    placeholderTextColor="#6a7b80"
                                    secureTextEntry={!showNewPassword}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />
                                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                                    {showNewPassword ? (
                                        <EyeOff size={20} color="#6a7b80" />
                                    ) : (
                                        <Eye size={20} color="#6a7b80" />
                                    )}
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Confirm Password</Text>
                            <View style={styles.inputIconRow}>
                                <Lock size={20} color="#6a7b80" />
                                <TextInput
                                    style={styles.iconInput}
                                    placeholder="Re-enter new password"
                                    placeholderTextColor="#6a7b80"
                                    secureTextEntry={!showConfirmPassword}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                                    {showConfirmPassword ? (
                                        <EyeOff size={20} color="#6a7b80" />
                                    ) : (
                                        <Eye size={20} color="#6a7b80" />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Password strength hint */}
                            {newPassword.length > 0 && (
                                <View style={styles.strengthRow}>
                                    {["length", "upper", "number"].map((rule) => {
                                        const passed =
                                            rule === "length"
                                                ? newPassword.length >= 8
                                                : rule === "upper"
                                                    ? /[A-Z]/.test(newPassword)
                                                    : /[0-9]/.test(newPassword);
                                        return (
                                            <View key={rule} style={styles.strengthItem}>
                                                <View
                                                    style={[
                                                        styles.strengthDot,
                                                        passed ? styles.strengthPass : styles.strengthFail,
                                                    ]}
                                                />
                                                <Text style={styles.strengthLabel}>
                                                    {rule === "length"
                                                        ? "8+ chars"
                                                        : rule === "upper"
                                                            ? "Uppercase"
                                                            : "Number"}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleResetPassword}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryText}>Reset Password</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* ════════════════════════════════════════════
                        STEP 4 – Success
                    ════════════════════════════════════════════ */}
                    {step === "success" && (
                        <View style={[styles.card, { alignItems: "center" }]}>
                            <View style={styles.successIconWrap}>
                                <CheckCircle size={60} color="#2a828e" />
                            </View>
                            <Text style={[styles.cardTitle, { textAlign: "center" }]}>
                                Password Reset!
                            </Text>
                            <Text
                                style={[
                                    styles.cardSubtitle,
                                    { textAlign: "center", marginBottom: 28 },
                                ]}
                            >
                                Your password has been successfully updated. You can now login with
                                your new password.
                            </Text>
                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={() => router.replace("/login")}
                            >
                                <Text style={styles.primaryText}>Back to Login</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
    content: {
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    topBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: Platform.OS === "ios" ? 54 : 40,
        paddingBottom: 20,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
    },
    screenTitle: {
        color: "#fff",
        fontSize: 20,
        fontWeight: "800",
    },
    stepperRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 28,
    },
    stepItem: {
        alignItems: "center",
        gap: 6,
    },
    stepDot: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.25)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "rgba(255,255,255,0.4)",
    },
    stepDotActive: {
        backgroundColor: "#2a828e",
        borderColor: "#fff",
    },
    stepDotDone: {
        backgroundColor: "#004d55",
        borderColor: "#c9f3f4",
    },
    stepDotText: {
        fontSize: 13,
        fontWeight: "700",
        color: "rgba(255,255,255,0.6)",
    },
    stepLabel: {
        fontSize: 11,
        fontWeight: "600",
        color: "rgba(255,255,255,0.55)",
    },
    stepLabelActive: {
        color: "#fff",
    },
    stepLine: {
        flex: 1,
        height: 2,
        backgroundColor: "rgba(255,255,255,0.25)",
        marginBottom: 18,
        marginHorizontal: 4,
    },
    stepLineDone: {
        backgroundColor: "#c9f3f4",
    },
    card: {
        backgroundColor: "#004d55",
        borderRadius: 20,
        borderWidth: 2,
        borderColor: "#c9f3f4",
        padding: 22,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: "#fff",
        marginBottom: 6,
    },
    cardSubtitle: {
        fontSize: 13,
        color: "#b2ebf2",
        marginBottom: 22,
        lineHeight: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: "700",
        color: "#fff",
        marginBottom: 6,
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
        marginTop: 4,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    primaryText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    secondaryButton: {
        padding: 14,
        borderRadius: 14,
        alignItems: "center",
        marginTop: 10,
        borderWidth: 1.5,
        borderColor: "#c9f3f4",
    },
    secondaryText: {
        color: "#c9f3f4",
        fontSize: 15,
        fontWeight: "600",
    },
    timerText: {
        color: "#b2ebf2",
        fontSize: 14,
    },
    resendText: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "700",
        textDecorationLine: "underline",
    },
    errorBox: {
        backgroundColor: "#ffdede",
        padding: 10,
        borderRadius: 10,
        marginBottom: 14,
    },
    errorText: {
        color: "#b00020",
        fontWeight: "600",
        fontSize: 13,
    },
    strengthRow: {
        flexDirection: "row",
        gap: 16,
        marginBottom: 16,
        marginTop: -8,
    },
    strengthItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    strengthDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    strengthPass: { backgroundColor: "#4caf50" },
    strengthFail: { backgroundColor: "#ef5350" },
    strengthLabel: {
        fontSize: 11,
        color: "#b2ebf2",
        fontWeight: "600",
    },
    successIconWrap: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#c9f3f4",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    successBox: {
        backgroundColor: "#d4edda", // Light green background
        padding: 10,
        borderRadius: 10,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#c3e6cb",
    },
    successText: {
        color: "#155724", // Dark green text
        fontWeight: "600",
        fontSize: 13,
        textAlign: "center",
    },
});