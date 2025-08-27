import { useQuery } from '@apollo/client';
import { useCallback, useEffect } from 'react';
import { ME_QUERY } from '../graphql/queries/auth.queries';
import { useAuth as useAuthContext } from '../lib/auth-context';
import { TokenManager, AuthState } from '../lib/auth-utils';
import type { AuthUser } from '../lib/types/auth.types';

/**
 * Enhanced authentication hook that provides current user data and auth state
 */
export const useAuth = () => {
  const authContext = useAuthContext();
  
  // Query current user data from server
  const { data, loading, error, refetch } = useQuery<{ me: AuthUser }>(ME_QUERY, {
    skip: !authContext.isAuthenticated,
    errorPolicy: 'all',
    fetchPolicy: 'cache-first',
    onError: (error) => {
      // If token is invalid, logout user
      if (error.graphQLErrors.some(err => err.extensions?.code === 'UNAUTHENTICATED')) {
        authContext.logout();
      }
    }
  });

  // Sync server user data with local context
  useEffect(() => {
    if (data?.me && authContext.user?.id !== data.me.id) {
      // Update local user data if server data is different
      const storedUser = TokenManager.getUser();
      if (storedUser) {
        const updatedUser = { ...storedUser, ...data.me };
        const token = TokenManager.getToken();
        const refreshToken = TokenManager.getRefreshToken();
        const expiry = TokenManager.getTokenExpiry();
        
        if (token && refreshToken && expiry) {
          TokenManager.setAuth(token, refreshToken, updatedUser, expiry);
        }
      }
    }
  }, [data?.me, authContext.user]);

  const refreshUserData = useCallback(async () => {
    try {
      await refetch();
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  }, [refetch]);

  return {
    ...authContext,
    // Override user with server data if available
    user: data?.me || authContext.user,
    isLoading: authContext.isLoading || loading,
    error,
    refreshUserData,
  };
};

/**
 * Hook for checking if user has verified email
 */
export const useEmailVerification = () => {
  const { user, resendVerification } = useAuth();
  
  const isEmailVerified = user?.emailVerified ?? false;
  const needsVerification = user && !isEmailVerified;
  
  const handleResendVerification = useCallback(async () => {
    if (user?.email) {
      await resendVerification(user.email);
    }
  }, [user?.email, resendVerification]);

  return {
    isEmailVerified,
    needsVerification,
    resendVerification: handleResendVerification,
  };
};

/**
 * Hook for authentication status checks
 */
export const useAuthStatus = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  
  return {
    isAuthenticated,
    isLoading,
    isEmailVerified: user?.emailVerified ?? false,
    hasUser: !!user,
  };
};