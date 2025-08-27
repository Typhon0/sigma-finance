import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../lib/auth-context';

interface UseAuthGuardOptions {
  requireAuth?: boolean;
  requireEmailVerified?: boolean;
  redirectTo?: string;
  redirectIfAuthenticated?: string;
}

export function useAuthGuard(options: UseAuthGuardOptions = {}) {
  const {
    requireAuth = true,
    requireEmailVerified = false,
    redirectTo = '/auth/login',
    redirectIfAuthenticated,
  } = options;

  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // Redirect authenticated users away from auth pages
    if (redirectIfAuthenticated && isAuthenticated) {
      navigate({ to: redirectIfAuthenticated });
      return;
    }

    // Redirect unauthenticated users to login
    if (requireAuth && !isAuthenticated) {
      navigate({ to: redirectTo });
      return;
    }

    // Check email verification requirement
    if (requireEmailVerified && user && !user.emailVerified) {
      navigate({ to: '/auth/verify-email' });
      return;
    }
  }, [
    isLoading,
    isAuthenticated,
    user,
    requireAuth,
    requireEmailVerified,
    redirectTo,
    redirectIfAuthenticated,
    navigate,
  ]);

  return {
    isLoading,
    isAuthenticated,
    user,
    canAccess: isAuthenticated && (!requireEmailVerified || user?.emailVerified),
  };
}