import { useMutation } from "@apollo/client";
import {
	CONFIRM_PASSWORD_RESET_MUTATION,
	LOGIN_MUTATION,
	LOGOUT_MUTATION,
	REFRESH_TOKEN_MUTATION,
	REGISTER_MUTATION,
	RESEND_VERIFICATION_MUTATION,
	RESET_PASSWORD_MUTATION,
	VERIFY_EMAIL_MUTATION,
} from "../graphql/mutations/auth.mutations";
import type {
	AuthResponse,
	EmailVerificationInput,
	EmailVerificationResponse,
	LoginInput,
	LogoutInput,
	LogoutResponse,
	PasswordResetConfirmInput,
	PasswordResetInput,
	PasswordResetResponse,
	RefreshTokenInput,
	RegisterInput,
	ResendVerificationInput,
} from "../lib/types/auth.types";

// Register mutation hook
export const useRegisterMutation = () => {
	return useMutation<{ register: AuthResponse }, { input: RegisterInput }>(REGISTER_MUTATION);
};

// Login mutation hook
export const useLoginMutation = () => {
	return useMutation<{ login: AuthResponse }, { input: LoginInput }>(LOGIN_MUTATION);
};

// Logout mutation hook
export const useLogoutMutation = () => {
	return useMutation<{ logout: LogoutResponse }, { input: LogoutInput }>(LOGOUT_MUTATION);
};

// Reset password mutation hook
export const useResetPasswordMutation = () => {
	return useMutation<{ resetPassword: PasswordResetResponse }, { input: PasswordResetInput }>(
		RESET_PASSWORD_MUTATION,
	);
};

// Confirm password reset mutation hook
export const useConfirmPasswordResetMutation = () => {
	return useMutation<
		{ confirmPasswordReset: PasswordResetResponse },
		{ input: PasswordResetConfirmInput }
	>(CONFIRM_PASSWORD_RESET_MUTATION);
};

// Verify email mutation hook
export const useVerifyEmailMutation = () => {
	return useMutation<{ verifyEmail: EmailVerificationResponse }, { input: EmailVerificationInput }>(
		VERIFY_EMAIL_MUTATION,
	);
};

// Resend verification mutation hook
export const useResendVerificationMutation = () => {
	return useMutation<
		{ resendVerification: EmailVerificationResponse },
		{ input: ResendVerificationInput }
	>(RESEND_VERIFICATION_MUTATION);
};

// Refresh token mutation hook
export const useRefreshTokenMutation = () => {
	return useMutation<{ refreshToken: AuthResponse }, { input: RefreshTokenInput }>(
		REFRESH_TOKEN_MUTATION,
	);
};
