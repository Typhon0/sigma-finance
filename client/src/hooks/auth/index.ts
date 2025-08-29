// Authentication hooks and utilities

// Re-export auth context
export {
	AuthProvider,
	useAuth as useAuthContext,
} from "../../lib/auth-context";
export { useAuthErrorHandler } from "../../lib/auth-error-handler";
// Re-export auth utilities
export {
	AuthRedirect,
	AuthState,
	EmailValidator,
	PasswordValidator,
	SessionManager,
	TokenManager,
} from "../../lib/auth-utils";
// Re-export auth types
export type {
	AuthContextType,
	AuthData,
	AuthError,
	AuthResponse,
	AuthUser,
	EmailVerificationInput,
	LoginInput,
	LogoutInput,
	PasswordResetConfirmInput,
	PasswordResetInput,
	RefreshTokenInput,
	RegisterInput,
	ResendVerificationInput,
} from "../../lib/types/auth.types";
export { useAuth, useAuthStatus, useEmailVerification } from "../use-auth";
// Re-export auth mutations for convenience
export {
	useConfirmPasswordResetMutation,
	useLoginMutation,
	useLogoutMutation,
	useRefreshTokenMutation,
	useRegisterMutation,
	useResendVerificationMutation,
	useResetPasswordMutation,
	useVerifyEmailMutation,
} from "../use-auth-mutations";
export {
	useAuthentication,
	useAuthForm,
	useAuthGuard,
} from "../use-authentication";
