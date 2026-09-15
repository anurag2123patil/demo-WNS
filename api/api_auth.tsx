import URLS from "./base_url";
import AsyncStorage from "@react-native-async-storage/async-storage";


export interface ForgotPasswordPayload {
    email: string;
}

export interface ForgotPasswordResponse {
    message: string;
}

// ─── POST forgot password (send OTP to email) ─────────────────────────────────
export const forgotPassword = async (email: string): Promise<ForgotPasswordResponse> => {
    const payload: ForgotPasswordPayload = { email };

    const res = await fetch(`${URLS.BASE_URL}/users/forgotPassword`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Failed to send OTP: ${res.status} - ${errText}`);
    }

    return res.json();
};


export interface VerifyOtpPayload {
    email: string;
    otp: string;
}

export interface VerifyOtpResponse {
    message: string;
}

// ─── POST verify OTP ──────────────────────────────────────────────────────────
export const verifyOtp = async (email: string, otp: string): Promise<VerifyOtpResponse> => {
    const payload: VerifyOtpPayload = { email, otp };

    const res = await fetch(`${URLS.BASE_URL}/users/verifyOtp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OTP verification failed: ${res.status} - ${errText}`);
    }

    return res.json();
};


export interface ResetPasswordPayload {
    email: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
}

export interface ResetPasswordResponse {
    message: string;
}

// ─── POST reset password ──────────────────────────────────────────────────────
export const resetPassword = async (
    email: string,
    otp: string,
    newPassword: string,
    confirmPassword: string
): Promise<ResetPasswordResponse> => {
    const payload: ResetPasswordPayload = { email, otp, newPassword, confirmPassword };

    const res = await fetch(`${URLS.BASE_URL}/users/resetPassword`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Password reset failed: ${res.status} - ${errText}`);
    }

    return res.json();
};