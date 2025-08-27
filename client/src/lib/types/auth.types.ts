// Authentication types that match the GraphQL schema

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface AuthData {
  token: string;
  refreshToken: string;
  expiresAt: string; // ISO date string
  user: AuthUser;
}

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

export interface AuthResponse {
  success: boolean;
  data?: AuthData;
  errors?: AuthError[];
}

export interface LogoutResponse {
  success: boolean;
  errors?: AuthError[];
}

export interface PasswordResetResponse {
  success: boolean;
  errors?: AuthError[];
}

export interface EmailVerificationResponse {
  success: boolean;
  errors?: AuthError[];
}

// Input types for GraphQL mutations
export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface LogoutInput {
  token: string;
}

export interface PasswordResetInput {
  email: string;
}

export interface PasswordResetConfirmInput {
  token: string;
  newPassword: string;
}

export interface EmailVerificationInput {
  token: string;
}

export interface ResendVerificationInput {
  email: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

// Authentication context types
export interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  refreshToken: () => Promise<void>;
}

// Error codes from backend
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];