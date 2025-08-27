// Authentication hooks and utilities
export { useAuth, useEmailVerification, useAuthStatus } from '../use-auth';
export { useAuthentication, useAuthForm, useAuthGuard } from '../use-authentication';
export { useAuthErrorHandler } from '../../lib/auth-error-handler';

// Re-export auth mutations for convenience
export {
  useRegisterMutation,
  useLoginMutation,
  useLogoutMutation,
  useResetPasswordMutation,
  useConfirmPasswordResetMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useRefreshTokenMutation,
} from '../use-auth-mutations';

// Re-export auth context
export { useAuth as useAuthContext, AuthProvider } from '../../lib/auth-context';

// Re-export auth utilities
export {
  TokenManager,
  AuthState,
  AuthRedirect,
  PasswordValidator,
  EmailValidator,
  SessionManager,
} from '../../lib/auth-utils';

// Re-export auth types
export type {
  AuthUser,
  AuthData,
  AuthError,
  AuthResponse,
  AuthContextType,
  RegisterInput,
  LoginInput,
  LogoutInput,
  PasswordResetInput,
  PasswordResetConfirmInput,
  EmailVerificationInput,
  ResendVerificationInput,
  RefreshTokenInput,
} from '../../lib/types/auth.types';