import { useCallback, useState } from 'react';
import { useAuth } from './use-auth';
import { AuthErrorHandler } from '../lib/auth-error-handler';
import type { AuthError } from '../lib/types/auth.types';

/**
 * Comprehensive authentication hook with enhanced error handling and loading states
 */
export const useAuthentication = () => {
  const auth = useAuth();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAuthAction = useCallback(async <T>(
    action: () => Promise<T>,
    actionName: string,
    successMessage?: string
  ): Promise<T | null> => {
    setActionLoading(actionName);
    try {
      const result = await action();
      if (successMessage) {
        // Success message is handled by the auth context
      }
      return result;
    } catch (error) {
      console.error(`${actionName} error:`, error);
      return null;
    } finally {
      setActionLoading(null);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    return handleAuthAction(
      () => auth.login(email, password),
      'login'
    );
  }, [auth.login, handleAuthAction]);

  const register = useCallback(async (email: string, password: string, name: string) => {
    return handleAuthAction(
      () => auth.register(email, password, name),
      'register'
    );
  }, [auth.register, handleAuthAction]);

  const logout = useCallback(async () => {
    return handleAuthAction(
      () => auth.logout(),
      'logout'
    );
  }, [auth.logout, handleAuthAction]);

  const resetPassword = useCallback(async (email: string) => {
    return handleAuthAction(
      () => auth.resetPassword(email),
      'resetPassword'
    );
  }, [auth.resetPassword, handleAuthAction]);

  const confirmPasswordReset = useCallback(async (token: string, newPassword: string) => {
    return handleAuthAction(
      () => auth.confirmPasswordReset(token, newPassword),
      'confirmPasswordReset'
    );
  }, [auth.confirmPasswordReset, handleAuthAction]);

  const verifyEmail = useCallback(async (token: string) => {
    return handleAuthAction(
      () => auth.verifyEmail(token),
      'verifyEmail'
    );
  }, [auth.verifyEmail, handleAuthAction]);

  const resendVerification = useCallback(async (email: string) => {
    return handleAuthAction(
      () => auth.resendVerification(email),
      'resendVerification'
    );
  }, [auth.resendVerification, handleAuthAction]);

  const refreshToken = useCallback(async () => {
    return handleAuthAction(
      () => auth.refreshToken(),
      'refreshToken'
    );
  }, [auth.refreshToken, handleAuthAction]);

  return {
    // User state
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,

    // Action loading states
    isActionLoading: (action: string) => actionLoading === action,
    isAnyActionLoading: actionLoading !== null,
    currentAction: actionLoading,

    // Authentication actions
    login,
    register,
    logout,
    resetPassword,
    confirmPasswordReset,
    verifyEmail,
    resendVerification,
    refreshToken,

    // Utility functions
    refreshUserData: auth.refreshUserData,
  };
};

/**
 * Hook for form-specific authentication with field-level error handling
 */
export const useAuthForm = () => {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = useCallback(async <T>(
    action: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (errors: AuthError[]) => void
  ) => {
    setIsSubmitting(true);
    setFieldErrors({});

    try {
      const result = await action();
      onSuccess?.(result);
      return result;
    } catch (error: any) {
      // Extract field errors if available
      if (error.graphQLErrors) {
        const authErrors: AuthError[] = error.graphQLErrors
          .map((gqlError: any) => gqlError.extensions?.authError)
          .filter(Boolean);
        
        if (authErrors.length > 0) {
          setFieldErrors(AuthErrorHandler.getFieldErrors(authErrors));
          onError?.(authErrors);
        }
      }
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setFieldErrors(prev => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  return {
    fieldErrors,
    isSubmitting,
    handleFormSubmit,
    clearFieldError,
    clearAllErrors,
    hasFieldError: (field: string) => !!fieldErrors[field],
    getFieldError: (field: string) => fieldErrors[field],
  };
};

/**
 * Hook for authentication guards and redirects
 */
export const useAuthGuard = () => {
  const { isAuthenticated, isLoading, user } = useAuth();

  const requireAuth = useCallback(() => {
    if (!isLoading && !isAuthenticated) {
      throw new Error('Authentication required');
    }
  }, [isAuthenticated, isLoading]);

  const requireEmailVerification = useCallback(() => {
    requireAuth();
    if (user && !user.emailVerified) {
      throw new Error('Email verification required');
    }
  }, [user, requireAuth]);

  const requireGuest = useCallback(() => {
    if (!isLoading && isAuthenticated) {
      throw new Error('Already authenticated');
    }
  }, [isAuthenticated, isLoading]);

  return {
    isAuthenticated,
    isLoading,
    isEmailVerified: user?.emailVerified ?? false,
    requireAuth,
    requireEmailVerification,
    requireGuest,
    canAccess: (requiresAuth: boolean, requiresVerification = false) => {
      if (isLoading) return false;
      if (requiresAuth && !isAuthenticated) return false;
      if (requiresVerification && (!user || !user.emailVerified)) return false;
      return true;
    },
  };
};