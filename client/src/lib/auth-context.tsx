import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	useConfirmPasswordResetMutation,
	useLoginMutation,
	useLogoutMutation,
	useRefreshTokenMutation,
	useRegisterMutation,
	useResendVerificationMutation,
	useResetPasswordMutation,
	useVerifyEmailMutation,
} from "../hooks/use-auth-mutations";
import { AuthErrorHandler } from "./auth-error-handler";
import type { AuthContextType, AuthError, AuthUser } from "./types/auth.types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token storage utilities
const TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "auth_user";
const TOKEN_EXPIRY_KEY = "token_expiry";

const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
const getStoredRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
const getStoredTokenExpiry = () => localStorage.getItem(TOKEN_EXPIRY_KEY);
const hasRefreshTokenChanged = (attemptedRefreshToken: string): boolean => {
	const currentRefreshToken = getStoredRefreshToken();
	return (
		typeof currentRefreshToken === "string" &&
		currentRefreshToken.length > 0 &&
		currentRefreshToken !== attemptedRefreshToken
	);
};
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

const _shouldRefreshToken = (expiresAt: string): boolean => {
	const expiry = new Date(expiresAt);
	const now = new Date();
	const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
	return expiry.getTime() - now.getTime() < fiveMinutes;
};

// Timeout wrapper to prevent hanging requests
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Request timed out")), ms);
		promise
			.then((value) => {
				clearTimeout(timer);
				resolve(value);
			})
			.catch((err) => {
				clearTimeout(timer);
				reject(err);
			});
	});
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<AuthUser | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const refreshTokenActionRef = useRef<(() => Promise<void>) | null>(null);
	const isLoggingOutRef = useRef(false);

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
			const requiresLogout = errors.some((error) => AuthErrorHandler.requiresLogout(error));
			if (requiresLogout) {
				clearStoredAuth();
				setUser(null);
			}

			const authError = new Error(errors[0].message) as Error & {
				authErrors?: AuthError[];
			};
			authError.authErrors = errors;
			throw authError;
		}
	};

	// Setup automatic token refresh
	const setupTokenRefresh = useCallback((expiresAt: string) => {
		if (refreshTimeoutRef.current) {
			clearTimeout(refreshTimeoutRef.current);
		}

		const expiry = new Date(expiresAt);
		const now = new Date();
		const timeUntilRefresh = expiry.getTime() - now.getTime() - 5 * 60 * 1000; // Refresh 5 minutes before expiry

		if (timeUntilRefresh > 0) {
			refreshTimeoutRef.current = setTimeout(async () => {
				try {
					await refreshTokenActionRef.current?.();
				} catch (_error) {
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
						await refreshTokenActionRef.current?.();
					} catch (_error) {
						clearStoredAuth();
						setUser(null);
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

	const login = useCallback(
		async (email: string, password: string) => {
			setIsLoading(true);
			try {
				const { data } = await withTimeout(
					loginMutation({
						variables: {
							input: { email, password },
						},
					}),
					10000, // 10 second timeout
				);

				if (data?.login.success && data.login.data) {
					const { token, refreshToken, user: authUser, expiresAt } = data.login.data;
					setStoredAuth(token, refreshToken, authUser, expiresAt);
					setUser(authUser);
					setupTokenRefresh(expiresAt);
					toast.success("Successfully logged in!");
				} else {
					handleAuthError(data?.login.errors);
				}
			} catch (error: unknown) {
				const authErrors =
					error && typeof error === "object" && "authErrors" in error
						? (error as { authErrors?: AuthError[] }).authErrors
						: undefined;

				if (!authErrors) {
					const errorMessage =
						error instanceof Error ? error.message : "Login failed. Please try again.";
					toast.error(
						errorMessage.includes("timed out")
							? "Login request timed out. Please check your connection."
							: errorMessage,
					);
				}
				throw error;
			} finally {
				setIsLoading(false);
			}
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
		[loginMutation, handleAuthError, setupTokenRefresh],
	);

	const register = useCallback(
		async (email: string, password: string, name: string) => {
			setIsLoading(true);
			try {
				const { data } = await registerMutation({
					variables: {
						input: { email, password, name },
					},
				});

				if (data?.register.success && data.register.data) {
					const { token, refreshToken, user: authUser, expiresAt } = data.register.data;
					setStoredAuth(token, refreshToken, authUser, expiresAt);
					setUser(authUser);
					setupTokenRefresh(expiresAt);
					toast.success("Account created successfully!");
				} else {
					handleAuthError(data?.register.errors);
				}
			} catch (error) {
				toast.error("Registration failed. Please try again.");
				throw error;
			} finally {
				setIsLoading(false);
			}
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
		[registerMutation, setupTokenRefresh, handleAuthError],
	);

	const logout = useCallback(async () => {
		if (isLoggingOutRef.current) {
			return;
		}
		isLoggingOutRef.current = true;
		try {
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
							input: { token },
						},
					});
				} catch (_error) {
					// Continue with logout even if server call fails
				}
			}

			clearStoredAuth();
			setUser(null);
			toast.success("Successfully logged out");
		} finally {
			isLoggingOutRef.current = false;
		}
	}, [logoutMutation]);

	const resetPassword = useCallback(
		async (email: string) => {
			try {
				const { data } = await resetPasswordMutation({
					variables: {
						input: { email },
					},
				});

				if (data?.resetPassword.success) {
					toast.success("Password reset email sent! Check your inbox.");
				} else {
					handleAuthError(data?.resetPassword.errors);
				}
			} catch (error) {
				toast.error("Failed to send reset email. Please try again.");
				throw error;
			}
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
		[resetPasswordMutation, handleAuthError],
	);

	const confirmPasswordReset = useCallback(
		async (token: string, newPassword: string) => {
			try {
				const { data } = await confirmPasswordResetMutation({
					variables: {
						input: { token, newPassword },
					},
				});

				if (data?.confirmPasswordReset.success) {
					toast.success("Password reset successfully! You can now log in.");
				} else {
					handleAuthError(data?.confirmPasswordReset.errors);
				}
			} catch (error) {
				toast.error("Failed to reset password. Please try again.");
				throw error;
			}
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
		[confirmPasswordResetMutation, handleAuthError],
	);

	const verifyEmail = useCallback(
		async (token: string) => {
			try {
				const { data } = await verifyEmailMutation({
					variables: {
						input: { token },
					},
				});

				if (data?.verifyEmail.success) {
					// Update user's email verification status
					if (user) {
						const updatedUser = { ...user, emailVerified: true };
						setUser(updatedUser);
						localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
					}
					toast.success("Email verified successfully!");
				} else {
					handleAuthError(data?.verifyEmail.errors);
				}
			} catch (error) {
				toast.error("Failed to verify email. Please try again.");
				throw error;
			}
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
		[verifyEmailMutation, user, handleAuthError],
	);

	const resendVerification = useCallback(
		async (email: string) => {
			try {
				const { data } = await resendVerificationMutation({
					variables: {
						input: { email },
					},
				});

				if (data?.resendVerification.success) {
					toast.success("Verification email sent! Check your inbox.");
				} else {
					handleAuthError(data?.resendVerification.errors);
				}
			} catch (error) {
				toast.error("Failed to send verification email. Please try again.");
				throw error;
			}
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
		[resendVerificationMutation, handleAuthError],
	);

	const refreshToken = useCallback(async () => {
		const storedRefreshToken = getStoredRefreshToken();
		if (!storedRefreshToken) {
			throw new Error("No refresh token available");
		}

		try {
			const { data } = await refreshTokenMutation({
				variables: {
					input: { refreshToken: storedRefreshToken },
				},
			});

			if (data?.refreshToken.success && data.refreshToken.data) {
				const {
					token,
					refreshToken: newRefreshToken,
					user: authUser,
					expiresAt,
				} = data.refreshToken.data;
				setStoredAuth(token, newRefreshToken, authUser, expiresAt);
				setUser(authUser);
				setupTokenRefresh(expiresAt);
			} else {
				if (hasRefreshTokenChanged(storedRefreshToken)) {
					return;
				}
				handleAuthError(data?.refreshToken.errors);
				throw new Error("Token refresh failed");
			}
		} catch (error) {
			if (hasRefreshTokenChanged(storedRefreshToken)) {
				return;
			}
			clearStoredAuth();
			setUser(null);
			throw error;
		}
		// biome-ignore lint/correctness/useExhaustiveDependencies: unavoidable
	}, [refreshTokenMutation, setupTokenRefresh, handleAuthError]);

	useEffect(() => {
		refreshTokenActionRef.current = refreshToken;
	}, [refreshToken]);

	const updateUser = useCallback((updates: Partial<AuthUser>) => {
		setUser((prev) => {
			if (!prev) return prev;
			const updated = { ...prev, ...updates };
			localStorage.setItem(USER_KEY, JSON.stringify(updated));
			return updated;
		});
	}, []);

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
		updateUser,
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
