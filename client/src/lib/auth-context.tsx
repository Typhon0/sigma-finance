import type React from "react";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useResetPasswordMutation,
  useConfirmPasswordResetMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useRefreshTokenMutation
} from "../hooks/use-auth-mutations";
import type { AuthUser, AuthContextType, AuthError } from "./types/auth.types";
import { AuthErrorHandler } from "./auth-error-handler";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token storage utilities
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'auth_user';
const TOKEN_EXPIRY_KEY = 'token_expiry';

const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
const getStoredTokenExpiry = () => localStorage.getItem(TOKEN_EXPIRY_KEY);
const getStoredUser = (): AuthUser | null => {
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
};

const setStoredAuth = (token: string, refreshToken: string, user: AuthUser, expiresAt: string) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiresAt);
};

const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
};

const isTokenExpired = (expiresAt: string): boolean => {
  return new Date(expiresAt) <= new Date();
};

const shouldRefreshToken = (expiresAt: string): boolean => {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  return expiry.getTime() - now.getTime() < fiveMinutes;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // GraphQL mutations
  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();
  const [logoutMutation] = useLogoutMutation();
  const [resetPasswordMutation] = useResetPasswordMutation();
  const [confirmPasswordResetMutation] = useConfirmPasswordResetMutation();
  const [verifyEmailMutation] = useVerifyEmailMutation();
  const [resendVerificationMutation] = useResendVerificationMutation();
  const [refreshTokenMutation] = useRefreshTokenMutation();

  // Helper function to handle auth errors
  const handleAuthError = (errors?: AuthError[]) => {
    if (errors && errors.length > 0) {
      AuthErrorHandler.showErrors(errors);
      
      // Check if any error requires logout
      const requiresLogout = errors.some(error => AuthErrorHandler.requiresLogout(error));
      if (requiresLogout) {
        logout();
      }
      
      throw new Error(errors[0].message);
    }
  };

  // Setup automatic token refresh
  const setupTokenRefresh = useCallback((expiresAt: string) => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    const expiry = new Date(expiresAt);
    const now = new Date();
    const timeUntilRefresh = expiry.getTime() - now.getTime() - (5 * 60 * 1000); // Refresh 5 minutes before expiry

    if (timeUntilRefresh > 0) {
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          await refreshToken();
        } catch (error) {
          console.error('Automatic token refresh failed:', error);
          // Don't logout automatically on refresh failure, let user continue until token actually expires
        }
      }, timeUntilRefresh);
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = getStoredUser();
      const storedToken = getStoredToken();
      const storedExpiry = getStoredTokenExpiry();
      
      if (storedUser && storedToken && storedExpiry) {
        if (isTokenExpired(storedExpiry)) {
          // Token is expired, try to refresh
          try {
            await refreshToken();
          } catch (error) {
            console.error('Token refresh failed on init:', error);
            clearStoredAuth();
          }
        } else {
          // Token is still valid
          setUser(storedUser);
          setupTokenRefresh(storedExpiry);
        }
      }
      
      setIsLoading(false);
    };

    initializeAuth();
  }, [setupTokenRefresh]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await loginMutation({
        variables: {
          input: { email, password }
        }
      });

      if (data?.login.success && data.login.data) {
        const { token, refreshToken, user: authUser, expiresAt } = data.login.data;
        setStoredAuth(token, refreshToken, authUser, expiresAt);
        setUser(authUser);
        setupTokenRefresh(expiresAt);
        toast.success('Successfully logged in!');
      } else {
        handleAuthError(data?.login.errors);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please try again.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [loginMutation]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const { data } = await registerMutation({
        variables: {
          input: { email, password, name }
        }
      });

      if (data?.register.success && data.register.data) {
        const { token, refreshToken, user: authUser, expiresAt } = data.register.data;
        setStoredAuth(token, refreshToken, authUser, expiresAt);
        setUser(authUser);
        setupTokenRefresh(expiresAt);
        toast.success('Account created successfully!');
      } else {
        handleAuthError(data?.register.errors);
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Registration failed. Please try again.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [registerMutation]);

  const logout = useCallback(async () => {
    const token = getStoredToken();
    
    // Clear refresh timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    if (token) {
      try {
        await logoutMutation({
          variables: {
            input: { token }
          }
        });
      } catch (error) {
        console.error('Logout error:', error);
        // Continue with logout even if server call fails
      }
    }
    
    clearStoredAuth();
    setUser(null);
    toast.success('Successfully logged out');
  }, [logoutMutation]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { data } = await resetPasswordMutation({
        variables: {
          input: { email }
        }
      });

      if (data?.resetPassword.success) {
        toast.success('Password reset email sent! Check your inbox.');
      } else {
        handleAuthError(data?.resetPassword.errors);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      toast.error('Failed to send reset email. Please try again.');
      throw error;
    }
  }, [resetPasswordMutation]);

  const confirmPasswordReset = useCallback(async (token: string, newPassword: string) => {
    try {
      const { data } = await confirmPasswordResetMutation({
        variables: {
          input: { token, newPassword }
        }
      });

      if (data?.confirmPasswordReset.success) {
        toast.success('Password reset successfully! You can now log in.');
      } else {
        handleAuthError(data?.confirmPasswordReset.errors);
      }
    } catch (error) {
      console.error('Confirm password reset error:', error);
      toast.error('Failed to reset password. Please try again.');
      throw error;
    }
  }, [confirmPasswordResetMutation]);

  const verifyEmail = useCallback(async (token: string) => {
    try {
      const { data } = await verifyEmailMutation({
        variables: {
          input: { token }
        }
      });

      if (data?.verifyEmail.success) {
        // Update user's email verification status
        if (user) {
          const updatedUser = { ...user, emailVerified: true };
          setUser(updatedUser);
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        }
        toast.success('Email verified successfully!');
      } else {
        handleAuthError(data?.verifyEmail.errors);
      }
    } catch (error) {
      console.error('Email verification error:', error);
      toast.error('Failed to verify email. Please try again.');
      throw error;
    }
  }, [verifyEmailMutation, user]);

  const resendVerification = useCallback(async (email: string) => {
    try {
      const { data } = await resendVerificationMutation({
        variables: {
          input: { email }
        }
      });

      if (data?.resendVerification.success) {
        toast.success('Verification email sent! Check your inbox.');
      } else {
        handleAuthError(data?.resendVerification.errors);
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      toast.error('Failed to send verification email. Please try again.');
      throw error;
    }
  }, [resendVerificationMutation]);

  const refreshToken = useCallback(async () => {
    const storedRefreshToken = getStoredRefreshToken();
    if (!storedRefreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const { data } = await refreshTokenMutation({
        variables: {
          input: { refreshToken: storedRefreshToken }
        }
      });

      if (data?.refreshToken.success && data.refreshToken.data) {
        const { token, refreshToken: newRefreshToken, user: authUser, expiresAt } = data.refreshToken.data;
        setStoredAuth(token, newRefreshToken, authUser, expiresAt);
        setUser(authUser);
        setupTokenRefresh(expiresAt);
      } else {
        handleAuthError(data?.refreshToken.errors);
        // If refresh fails, logout user
        await logout();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout user
      await logout();
      throw error;
    }
  }, [refreshTokenMutation, logout]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    resetPassword,
    confirmPasswordReset,
    verifyEmail,
    resendVerification,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
}


